// Admin-only export and explicit cleanup. Never delete as a download side effect.
export async function archiveRoute({request,env,a,p,r,kind,need,persist,freshData,dkey,db}) {
 need(a.role==='admin','Only administrators archive or clear trainee paperwork.',403);
 need(!env.presentationOwner,'Use the live Admin workspace for record archiving.',403);
 const id=p.id,key=dkey(id),receiptKey='academy/archive-receipts/'+id+'.json',d=r.value;
 if(kind==='archive') {
  need(request.method==='GET','Use GET.',405);
  need(!d.paperworkCleared&&!d.cleanupPending,'Paperwork has been cleared or cleanup is pending.',409);
  const listed=await env.BUCKET.listFiles('academy/files/'+id+'/');
  const names=new Set(listed);for(const f of d.attachments||[])names.add('academy/files/'+id+'/'+f.id);
  const files=[];let total=0;
  for(const path of names){const f=await env.BUCKET.get(path);need(f,'An evidence file is missing. Cleanup is blocked.',409);const bytes=new Uint8Array(await new Response(f.body).arrayBuffer());total+=bytes.length;need(total<=40*1024*1024,'This packet exceeds the single-download limit. Contact the administrator; no records were deleted.',413);let raw='';for(let i=0;i<bytes.length;i+=8192)raw+=String.fromCharCode(...bytes.subarray(i,i+8192));const meta=(d.attachments||[]).find(x=>path.endsWith('/'+x.id));files.push({path,name:meta?.name||path.split('/').at(-1),mime:meta?.mime||'application/octet-stream',base64:btoa(raw),size:bytes.length});}
  const calendar=(await db.prepare('SELECT * FROM scheduled_shifts WHERE trainee_id = ?').bind(id).all()).results;
  const current=await env.BUCKET.get(key);need((current?.etag||null)===r.etag,'Training changed during export. Download a new packet.',409);
  const receipt={token:crypto.randomUUID(),version:r.etag,by:a.email,at:new Date().toISOString(),files:[...names]};
  await env.BUCKET.put(receiptKey,JSON.stringify(receipt));
  return {person:p,record:d,calendar,files,receipt,exportedAt:receipt.at};
 }
 need(request.method==='POST','Use POST.',405);
 const b=await request.json();need(b.confirmName===p.name&&b.savedAndOpened===true,'Confirm the saved packet and type the trainee name.',400);
 need(!d.paperworkCleared,'Paperwork was already cleared.',409);
 const stored=await env.BUCKET.get(receiptKey),receipt=stored?await stored.json():null;
 need(receipt&&receipt.by===a.email&&receipt.token===b.token,'Download the complete packet from this Admin account first.',409);
 need(d.cleanupPending?.token===receipt.token||r.etag===receipt.version,'Training changed after export. Download a new complete packet.',409);
 if(!d.cleanupPending){d.cleanupPending={token:receipt.token,by:a.email,at:new Date().toISOString()};r.etag=await persist(env,key,d,r.etag);}
 // A failed storage operation leaves a locked, retryable record, never a false success.
 const paths=await env.BUCKET.listFiles('academy/files/'+id+'/');
 await env.BUCKET.removeFiles([...new Set([...paths,...receipt.files])]);
 need((await env.BUCKET.listFiles('academy/files/'+id+'/')).length===0,'Some files remain. Retry cleanup.',409);
 await db.batch([db.prepare('DELETE FROM scheduled_shifts WHERE trainee_id = ?').bind(id),db.prepare('DELETE FROM shift_calendars WHERE trainee_id = ?').bind(id)]);
 const cleared=freshData(id);cleared.paperworkCleared={at:new Date().toISOString(),by:a.email,exportedAt:receipt.at,fileCount:receipt.files.length};
 await persist(env,key,cleared,r.etag);
 await env.BUCKET.delete(receiptKey);
 return {ok:true};
}
