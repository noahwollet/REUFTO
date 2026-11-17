// Invoke only after Supabase verifies the access token and the live session.
export function mfaRequired(email,config,ownerEmail,claims,factors=[]){
 const member=(config.members||[]).find(m=>m.email===email&&m.active!==false);
 const roles=member?.roles||[member?.role];
 const admin=email===ownerEmail||roles.includes('admin');
 const enrolled=factors.some(f=>f.status==='verified');
 return (admin||enrolled)&&(claims.aal!=='aal2'||!enrolled);
}
export function normalizePath(path){return path.replace(/^\/(?:functions\/v1\/)?academy(?=\/|$)/,'')||'/'}
