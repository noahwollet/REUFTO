import REFERENCES from './references.json' with {type:'json'};
import {sb,rpc,environment} from './persistence.js';
const templates=[{file:'REU_IM_Fillable.pdf',title:'IM training blank fillable form'},{file:'REU_CEVO_Fillable.pdf',title:'CEVO blank fillable forms'},{file:'REU_Map_Test_Layout_Draft.pdf',title:'Map assessment candidate draft'},{file:'REU_Map_Test_Admin_Key_Draft.pdf',title:'Map assessment Admin answer key',adminOnly:true}];
const choices=[...REFERENCES,...templates];
let library=[];
export function referenceMime(file){return file.endsWith('.pdf')?'application/pdf':file.endsWith('.docx')?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':file.endsWith('.pptx')?'application/vnd.openxmlformats-officedocument.presentationml.presentation':null}
export async function refreshReferenceAssets(assets){const rows=await(await sb('/rest/v1/reu_assets?select=key,mime,sha256,bytes')).json();const allowed=new Set(choices.map(x=>'assets/'+x.file));for(const key of Object.keys(assets))delete assets[key];for(const row of rows)if(allowed.has(row.key))assets['/'+row.key.slice(7)]={key:row.key,type:row.mime};library=choices.map(x=>{const row=rows.find(r=>r.key==='assets/'+x.file);return {file:x.file,title:x.title,adminOnly:!!x.adminOnly,available:!!row,version:row?.sha256||'',bytes:row?.bytes||0}});return library}
export function referenceUploadChoices(){return library}
async function limitedBody(req,ensure){const reader=req.body?.getReader();ensure(reader,'Choose a file.');let total=0;const chunks=[];for(;;){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>15*1024*1024){await reader.cancel();ensure(false,'Reference files must be 15 MB or smaller.',413)}chunks.push(value)}const bytes=new Uint8Array(total);let offset=0;for(const x of chunks){bytes.set(x,offset);offset+=x.length}return bytes}
export async function uploadReference(req,actor,ensure,beforeWrite){
 ensure(actor.role==='admin','Only Admins can upload reference documents.',403);ensure(req.method==='POST','Use POST.',405);
 const file=req.headers.get('X-Reference-File')||'';const choice=choices.find(x=>x.file===file);ensure(choice,'Choose an existing REU reference or blank template.');const mime=referenceMime(file);ensure(mime,'Unsupported reference format.');
 const bytes=await limitedBody(req,ensure);ensure(bytes.length>8,'Choose a complete document.');ensure(mime==='application/pdf'?new TextDecoder().decode(bytes.slice(0,5))==='%PDF-':bytes[0]===80&&bytes[1]===75,'The document does not match the selected PDF or Office file format.');
 const rows=await(await sb('/rest/v1/reu_assets?key=eq.'+encodeURIComponent('assets/'+file)+'&select=sha256')).json();const expected=req.headers.get('X-Reference-Version')||null;ensure((rows[0]?.sha256||null)===expected,'This reference changed. Refresh before replacing it.',409);
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('');
 await beforeWrite(file);
 const storagePath='references/'+crypto.randomUUID()+'/'+file;await environment.BUCKET.put(storagePath,bytes,{httpMetadata:{contentType:mime}});
 const saved=await rpc('reu_asset_put',{k:'assets/'+file,m:mime,byte_count:bytes.length,hash,storage_path:storagePath,expected_hash:expected,uploaded_by:actor.email});ensure(saved,'This reference changed during upload. Refresh and review before retrying.',409);
 return {ok:true,file,version:hash,reviewRequired:!choice.adminOnly};
}
