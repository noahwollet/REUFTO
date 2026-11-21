// Invoke only after Supabase verifies the access token and live session.
export function mfaRequired(claims,factors=[]){return claims.aal!=='aal2'||!factors.some(f=>f.status==='verified'&&f.factor_type==='totp')}
export function normalizePath(path){return path.replace(/^\/(?:functions\/v1\/)?academy(?=\/|$)/,'')||'/'}
// Access is selected from server-managed account records, never a browser header.
export function assignedAccess(member,owner=false){
 if(owner)return 'admin';
 const roles=[...new Set((Array.isArray(member?.roles)?member.roles:[member?.role]).filter(r=>['admin','trainer','trainee'].includes(r)))];
 return roles.includes(member?.primaryRole)?member.primaryRole:roles.includes(member?.role)?member.role:roles[0];
}
