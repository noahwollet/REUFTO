import assert from 'node:assert/strict';
globalThis.Deno={env:{get:()=> 'test'}};
const worker=(await import('../supabase/functions/academy/core.js')).default;
const version=(await import('../supabase/functions/academy/catalog.json',{with:{type:'json'}})).default.version;
const members=[{email:'trainer@example.test',name:'Trainer',roles:['trainer']},{email:'admin@example.test',name:'Admin',roles:['admin']},{email:'trainee@example.test',name:'Trainee',roles:['trainee'],traineeId:'none'}];
const config={version,members,people:[],referenceRelease:[]};const trainer={email:members[0].email,version,lessons:{},attendance:0,mentoredShifts:[],examAttempts:[{id:'one',at:'2026-11-18',score:91,mcPoints:29,answers:{secret:'PRIVATE_GRADE_SENTINEL'},review:{decision:'Approved',points:47,passed:true,notes:'PRIVATE_GRADE_SENTINEL'},bank:{secret:'PRIVATE_GRADE_SENTINEL'}}],audit:[{score:91}],appointment:null};
const env={BUCKET:{get:async key=>key==='academy/config.json'?{etag:'cfg',json:async()=>config}:key.startsWith('academy/instructors/')?{etag:'trainer',json:async()=>trainer}:null},DB:{prepare:()=>({bind(){return this},run:async()=>({success:true}),all:async()=>({results:[]})})}};
const req=(path,email)=>new Request('https://reu-api.internal/api/academy'+path,{headers:{'oai-authenticated-user-id':'test','oai-authenticated-user-email':email}});
for(const path of ['/bootstrap','/instructor/'+encodeURIComponent(members[0].email)]){const res=await worker.fetch(req(path,members[0].email),env);assert.equal(res.status,200);const text=await res.text();assert.ok(!text.includes('PRIVATE_GRADE_SENTINEL'));assert.ok(!text.includes('mcPoints'));assert.ok(!text.includes('"score":91'));assert.ok(text.includes('Approved'));}
const admin=await worker.fetch(req('/instructor/'+encodeURIComponent(members[0].email),members[1].email),env);assert.equal(admin.status,200);assert.ok((await admin.text()).includes('PRIVATE_GRADE_SENTINEL'));
const trainee=await worker.fetch(req('/instructor/'+encodeURIComponent(members[0].email),members[2].email),env);assert.equal(trainee.status,403);
console.log('PASS: real API routing hides scores, answers, private notes and keys from trainers in bootstrap and instructor GET; Admin access retained; trainee access denied');
