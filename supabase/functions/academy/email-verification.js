import {rpc,environment,SB_URL} from './persistence.js';
import {verificationKey,passwordProven,EMAIL_VERIFICATION_MS} from './security.js';
export async function emailVerificationRoute(req,path,user,claims,previous,log){
 const response=(v,status=200)=>Response.json(v,{status});
 if(req.method!=='POST')return response({error:'Use POST.'},405);
 if(!passwordProven(claims,previous,user))return response({error:'Sign in with your password before verifying your email.',code:'password_required'},403);
 if(!await rpc('reu_auth_attempt',{email_value:user.email.toLowerCase()}))return response({error:'Too many requests. Please wait 15 minutes.'},429);
 let payload;try{const raw=await req.text();if(raw.length>2000)return response({error:'Request too large.'},413);payload=JSON.parse(raw||'{}')}catch{return response({error:'Invalid request.'},400)}
 const verifying=path==='/api/academy/email-verification/verify';
 if(!verifying&&path!=='/api/academy/email-verification/send')return response({error:'Not found.'},404);
 if(verifying&&!/^[0-9]{6,10}$/.test(String(payload.code||'')))return response({error:'Enter the code from your email.'},400);
 const r=await fetch(SB_URL+'/auth/v1'+(verifying?'/verify':'/otp'),{method:'POST',headers:{apikey:Deno.env.get('SUPABASE_ANON_KEY'),'Content-Type':'application/json'},body:JSON.stringify(verifying?{email:user.email,token:String(payload.code),type:'email'}:{email:user.email,create_user:false})});
 const data=await r.json();
 if(!r.ok){await log(verifying?'Email code verification failed':'Email code delivery request failed',r.status,user.email);return response({error:data.msg||data.message||data.error_description||'Email verification failed.'},r.status)}
 if(!verifying){await log('Email verification code requested',200,user.email);return response({ok:true})}
 if(data.user?.id!==user.id||data.user?.email?.toLowerCase()!==user.email.toLowerCase()||!data.access_token||!data.refresh_token)return response({error:'Verification identity mismatch.'},403);
 let session;try{session=JSON.parse(atob(data.access_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).session_id}catch{return response({error:'Verification returned an invalid session.'},502)}
 if(!/^[0-9a-f-]{36}$/i.test(session||'')||!await rpc('reu_session_live',{session_id:session,user_id:user.id}))return response({error:'Verification session is unavailable.'},401);
 const verifiedAt=new Date().toISOString(),expiresAt=new Date(Date.parse(verifiedAt)+EMAIL_VERIFICATION_MS).toISOString();
 const saved=await environment.BUCKET.put(verificationKey(session),JSON.stringify({userId:user.id,email:user.email.toLowerCase(),verifiedAt,expiresAt}));
 if(!saved)return response({error:'Verification could not be saved. Please try again.'},503);
 await log('Email code verified for a 15-day sign-in period',200,user.email);
 return response({...data,email_verified_until:expiresAt});
}
