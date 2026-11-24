// Invoke only after Supabase verifies the access token and live session.
export const MFA_WINDOW_SECONDS=24*60*60;
export function mfaRequired(claims,factors=[],nowSeconds=Math.floor(Date.now()/1000)){
 if(claims.aal!=='aal2'||!factors.some(f=>f.status==='verified'&&f.factor_type==='totp'))return true;
 const verifiedAt=Math.max(0,...(Array.isArray(claims.amr)?claims.amr:[]).filter(x=>x?.method==='totp'&&Number.isFinite(x.timestamp)&&x.timestamp<=nowSeconds).map(x=>x.timestamp));
 return verifiedAt<=0||nowSeconds-verifiedAt>=MFA_WINDOW_SECONDS;
}
export function normalizePath(path){return path.replace(/^\/(?:functions\/v1\/)?academy(?=\/|$)/,'')||'/'}
// Access is selected from server-managed account records, never a browser header.
export function assignedAccess(member,owner=false){
 if(owner)return 'admin';
 const roles=[...new Set((Array.isArray(member?.roles)?member.roles:[member?.role]).filter(r=>['admin','trainer','trainee'].includes(r)))];
 return roles.includes(member?.primaryRole)?member.primaryRole:roles.includes(member?.role)?member.role:roles[0];
}
