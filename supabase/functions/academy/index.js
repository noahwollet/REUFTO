import {emailVerificationCurrent,verificationKey,normalizePath} from './security.js';
import {emailVerificationRoute} from './email-verification.js';
import worker from './core.js';
import ASSETS from './assets.json' with {type:'json'};
import {refreshReferenceAssets,referenceUploadChoices} from './reference-library.js';
import CATALOG from './catalog.json' with {type:'json'};
import {environment,sb,rpc,SB_URL} from './persistence.js';
const ALLOWED='https://noahwollet.github.io';
const cors={'Access-Control-Allow-Origin':ALLOWED,'Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-reu-role,x-reu-presentation,x-reu-presentation-role,x-reu-presentation-trainee,x-file-name,x-record-version,x-onboarding-form,x-reference-file,x-reference-version','Access-Control-Expose-Headers':'Content-Disposition,X-REU-Request-ID','Vary':'Origin','Cache-Control':'no-store'};
function result(value,status=200){return Response.json(value,{status,headers:cors})}
async function securityEvent(action,status,email='Unknown or unsigned visitor'){try{await sb('/rest/v1/activity_events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:crypto.randomUUID(),at:new Date().toISOString(),request_id:crypto.randomUUID(),user_id:'',actor_email:email,role:'unassigned',category:'Authentication',action,phase:status<400?'Completed':'Denied or failed',status,method:'POST',path:'/auth',demonstration:0,details:'{}'})})}catch{}}
async function authRoute(req,path){
 if(req.method!=='POST')return result({error:'Use POST.'},405);
 let b;try{const raw=await req.text();if(raw.length>6000)return result({error:'Request too large'},413);b=JSON.parse(raw)}catch{return result({error:'Invalid request'},400)}
 const email=String(b.email||'').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>200)return result({error:'Enter a valid email address.'},400);
 const throttle=await rpc('reu_auth_attempt',{email_value:email});if(!throttle){await securityEvent('Sign-in rate limit reached',429);return result({error:'Too many requests. Please wait 15 minutes.'},429)}
 let cfg=await environment.BUCKET.get('academy/config.json');const members=cfg?(await cfg.json()).members:[];
 const assigned=email===CATALOG.bootstrapOwnerEmail||members.some(x=>x.email===email&&x.active!==false);
 if(!assigned){await securityEvent('Sign-in or registration rejected for an unassigned email',403,email);return result({error:'Sign-in unavailable. Verify your email and password or contact the Training Officer.'},403)}
 let endpoint,payload;
 if(path==='/auth/login'){endpoint='/token?grant_type=password';payload={email,password:b.password}}
 else if(path==='/auth/signup'){if(typeof b.password!=='string'||b.password.length<12)return result({error:'Use a password of at least 12 characters.'},400);endpoint='/signup';payload={email,password:b.password}}
 else if(path==='/auth/recover'){endpoint='/recover';payload={email}}
 else return result({error:'Not found'},404);
 const r=await fetch(SB_URL+'/auth/v1'+endpoint,{method:'POST',headers:{apikey:Deno.env.get('SUPABASE_ANON_KEY'),'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await r.json();
 await securityEvent((path==='/auth/login'?'Employee sign-in':path==='/auth/signup'?'Employee account registration':'Password recovery request')+(r.ok?' succeeded':' failed'),r.status,email);
 if(!r.ok)return result({error:data.msg||data.error_description||data.message||'Authentication failed. Please try again.'},r.status);
 return result(data);
}
export async function handle(req){
 const origin=req.headers.get('Origin');if(origin&&origin!==ALLOWED)return result({error:'Origin not allowed'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 const raw=new URL(req.url);const path=normalizePath(raw.pathname);
 if(path.startsWith('/auth/'))return authRoute(req,path);
 const auth=req.headers.get('Authorization')||'';
 if(!auth.startsWith('Bearer ')){await securityEvent('Unsigned website access attempt',401);return result({error:'Sign in to your REU account.'},401)}
 const userResponse=await fetch(SB_URL+'/auth/v1/user',{headers:{apikey:Deno.env.get('SUPABASE_ANON_KEY'),Authorization:auth}});
 if(!userResponse.ok){await securityEvent('Invalid or expired sign-in token',401);return result({error:'Your session expired. Sign in again.'},401)}
 const user=await userResponse.json();if(!user.email_confirmed_at)return result({error:'Confirm your email before signing in.'},403);
 let session,claims;try{const token=JSON.parse(atob(auth.slice(7).split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));session=token.session_id;claims=token}catch{return result({error:'Invalid session'},401)}
 if(!session||!await rpc('reu_session_live',{session_id:session,user_id:user.id}))return result({error:'Your session has ended. Sign in again.'},401);
 const cfg=await environment.BUCKET.get('academy/config.json');const config=cfg?await cfg.json():{members:[]};
 const email=user.email.toLowerCase();if(email!==CATALOG.bootstrapOwnerEmail&&!(config.members||[]).some(m=>m.email===email&&m.active!==false))return result({error:'This account has no REU training role.'},403);
 const stored=await environment.BUCKET.get(verificationKey(session));const approval=stored?await stored.json():null;
 if(path.startsWith('/api/academy/email-verification/')){const r=await emailVerificationRoute(req,path,user,claims,approval,securityEvent);return result(await r.json(),r.status)}
 if(!emailVerificationCurrent(approval,user))return result({error:'Verify the code sent to your email to continue.',code:'email_verification_required'},403);
 const headers=new Headers(req.headers);for(const k of [...headers.keys()])if(k.startsWith('oai-'))headers.delete(k);
 headers.set('oai-authenticated-user-id',user.id);headers.set('oai-authenticated-user-email',user.email.toLowerCase());
 // Names are display values only; roles and assignments come from server-controlled records.
 headers.set('oai-authenticated-user-full-name',encodeURIComponent(user.user_metadata?.name||user.email));headers.set('oai-authenticated-user-full-name-encoding','percent-encoded-utf-8');headers.set('Origin','https://reu-api.internal');
 const internal=new Request('https://reu-api.internal'+path+raw.search,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:req.body,duplex:'half'}:{})});
 await refreshReferenceAssets(ASSETS);const r=await worker.fetch(internal,environment);if(path==='/api/academy/bootstrap'&&r.ok){const payload=await r.json();const files=referenceUploadChoices();return result({...payload,migration:{documentsPending:files.some(f=>!f.available)},...(payload.account.role==='admin'?{referenceUploads:files}:{})})}const h=new Headers(r.headers);for(const[k,v]of Object.entries(cors))h.set(k,v);return new Response(r.body,{status:r.status,headers:h});
}
Deno.serve(async req=>{try{return await handle(req)}catch(e){console.error('REU request failed',String(e.message).slice(0,160));return result({error:'The training service is unavailable. Please retry shortly.'},503)}});
