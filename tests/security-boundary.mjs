import assert from 'node:assert/strict';
import {mfaRequired,normalizePath} from '../supabase/functions/academy/security.js';
const config={members:[{email:'both@example.test',roles:['admin','trainee']},{email:'fto@example.test',roles:['trainer']},{email:'inactive@example.test',roles:['admin'],active:false}]};
const verified=[{status:'verified',factor_type:'totp'}];
assert.ok(mfaRequired('owner@example.test',config,'owner@example.test',{aal:'aal1'},[]));
assert.ok(mfaRequired('both@example.test',config,'owner@example.test',{aal:'aal1'},verified));
assert.ok(mfaRequired('both@example.test',config,'owner@example.test',{aal:'aal2'},[]));
assert.equal(mfaRequired('both@example.test',config,'owner@example.test',{aal:'aal2'},verified),false);
assert.equal(mfaRequired('fto@example.test',config,'owner@example.test',{aal:'aal1'},[]),false);
assert.ok(mfaRequired('fto@example.test',config,'owner@example.test',{aal:'aal1'},verified));
assert.equal(mfaRequired('inactive@example.test',config,'owner@example.test',{aal:'aal1'},[]),false); // core separately denies inactive membership
for(const prefix of ['/academy','/functions/v1/academy',''])assert.equal(normalizePath(prefix+'/auth/signup'),'/auth/signup');
assert.equal(normalizePath('/academy-other/auth/signup'),'/academy-other/auth/signup');
globalThis.Deno={env:{get:()=> 'test'},serve(){}};
const {handle}=await import('../supabase/functions/academy/index.js');
const {environment}=await import('../supabase/functions/academy/persistence.js');
const worker=(await import('../supabase/functions/academy/core.js')).default;
environment.BUCKET={get:async()=>({json:async()=>config})};
let live=true,valid=true,user={id:'user-1',email:'both@example.test',email_confirmed_at:'2026-01-01',factors:verified},seen;
globalThis.fetch=async(url)=>{if(url.includes('/auth/v1/user'))return Response.json(user,{status:valid?200:401});if(url.includes('/rpc/reu_session_live'))return Response.json(live);if(url.includes('/reu_assets'))return Response.json([]);throw Error('Unexpected dependency '+url)};
worker.fetch=async req=>{seen=req;return Response.json({ok:true})};
function request(aal='aal1',headers={}){const token='test.'+btoa(JSON.stringify({aal,session_id:'session-1'}))+'.test';return new Request('https://project.supabase.co/academy/api/academy/trainees/test',{headers:{Authorization:'Bearer '+token,...headers}})}
assert.equal((await handle(request('aal1',{'X-REU-Role':'trainee'}))).status,403); // switching down never bypasses Admin MFA
assert.equal((await handle(request('aal2'))).status,200);
assert.equal((await handle(request('aal2',{'oai-authenticated-user-email':'attacker@example.test','oai-authenticated-user-id':'attacker','oai-made-up':'admin'}))).status,200);
assert.equal(seen.headers.get('oai-authenticated-user-email'),'both@example.test');assert.equal(seen.headers.get('oai-authenticated-user-id'),'user-1');assert.equal(seen.headers.get('oai-made-up'),null);
live=false;assert.equal((await handle(request('aal2'))).status,401);live=true;
user={...user,email_confirmed_at:null};assert.equal((await handle(request('aal2'))).status,403);user={...user,email_confirmed_at:'2026-01-01'};
valid=false;assert.equal((await handle(request('aal2'))).status,401);
console.log('PASS: Admin and multirole MFA enforcement, verified-factor requirement, live-session checks, email confirmation and identity-header replacement (mocked Auth)');
