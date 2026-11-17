// These checks run only after Supabase verifies the token and live session.
export const EMAIL_VERIFICATION_MS=15*24*60*60*1000;
export const verificationKey=session=>'academy/email-verifications/'+session+'.json';
export function verificationBound(record,user){return !!record&&record.userId===user.id&&record.email===user.email.toLowerCase()}
export function emailVerificationCurrent(record,user,now=Date.now()){
 if(!verificationBound(record,user))return false;
 const start=Date.parse(record.verifiedAt),end=Date.parse(record.expiresAt);
 return Number.isFinite(start)&&Number.isFinite(end)&&start<=now&&end>now&&end-start<=EMAIL_VERIFICATION_MS;
}
export function passwordProven(claims,record,user){return (claims.amr||[]).some(x=>x.method==='password')||verificationBound(record,user)}
export function normalizePath(path){return path.replace(/^\/(?:functions\/v1\/)?academy(?=\/|$)/,'')||'/'}
