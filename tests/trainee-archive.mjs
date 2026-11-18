import assert from 'node:assert/strict';
import {archiveRoute} from '../supabase/functions/academy/archive.js';
globalThis.crypto??=(await import('node:crypto')).webcrypto;
function fixture(){
 const entries=new Map(),files=new Map([['academy/files/one/file1',new TextEncoder().encode('%PDF-original')],['academy/files/one/orphan',new Uint8Array([1,2,3])]]);let version='v1',record={shifts:[{id:'signed',history:[{original:'retained'}]}],attachments:[{id:'file1',name:'Signed.pdf',mime:'application/pdf'}]},fail=false;
 const bucket={get:async k=>k==='academy/enrollments/one.json'?{etag:version,json:async()=>record}:entries.has(k)?{json:async()=>entries.get(k)}:files.has(k)?{body:files.get(k)}:null,put:async(k,v)=>entries.set(k,JSON.parse(v)),delete:async k=>entries.delete(k),listFiles:async prefix=>[...files.keys()].filter(k=>k.startsWith(prefix)),removeFiles:async paths=>{if(fail)throw Error('Storage failed');paths.forEach(k=>files.delete(k))}};
 const persist=async(e,k,v,expected)=>{assert.equal(expected,version);version='v'+(Number(version.slice(1))+1);record=structuredClone(v);return version};
 const db={prepare:()=>({bind(){return this},all:async()=>({results:[{id:'shift'}]})}),batch:async()=>{}};
 const call=async(kind,b={},role='admin')=>archiveRoute({request:new Request('https://test/'+kind,{method:kind==='archive'?'GET':'POST',...(kind==='archive'?{}:{body:JSON.stringify(b)})}),env:{BUCKET:bucket},a:{role,email:'admin@test'},p:{id:'one',name:'Trainee One'},r:{value:structuredClone(record),etag:version},kind,need:(ok,message,status)=>{if(!ok)throw Object.assign(Error(message),{status})},persist,freshData:()=>({shifts:[],attachments:[]}),dkey:id=>'academy/enrollments/'+id+'.json',db});
 return {call,files,entries,get record(){return record},set fail(v){fail=v},change(){version='v9'}};
}
for(const role of ['trainee','trainer']){const f=fixture();await assert.rejects(f.call('archive',{},role),/Only administrators/);await assert.rejects(f.call('clear-paperwork',{},role),/Only administrators/);assert.equal(f.files.size,2)}
{
 const f=fixture();await assert.rejects(f.call('clear-paperwork',{confirmName:'Trainee One',savedAndOpened:true}),/Download/);const packet=await f.call('archive');assert.equal(packet.files.length,2);assert.equal(atob(packet.files[0].base64),'%PDF-original');assert.equal(packet.record.shifts[0].history[0].original,'retained');assert.equal(f.files.size,2);
 const b={confirmName:'Trainee One',savedAndOpened:true,token:packet.receipt.token};await assert.rejects(f.call('clear-paperwork',{...b,confirmName:'Other'}),/Confirm/);f.change();await assert.rejects(f.call('clear-paperwork',b),/changed after export/);assert.equal(f.files.size,2);
}
{
 const f=fixture(),packet=await f.call('archive'),b={confirmName:'Trainee One',savedAndOpened:true,token:packet.receipt.token};f.fail=true;await assert.rejects(f.call('clear-paperwork',b),/Storage failed/);assert.ok(f.record.cleanupPending);assert.equal(f.record.shifts.length,1);f.fail=false;await f.call('clear-paperwork',b);assert.equal(f.files.size,0);assert.equal(f.record.shifts.length,0);assert.ok(f.record.paperworkCleared);assert.equal(f.entries.size,0);
}
console.log('PASS: archive role boundaries, original bytes/history, orphan evidence inclusion, explicit acknowledgment, version races, failure locking and retry, complete cleanup');
