// Invoke only after Supabase verifies the access token and live session.
export function mfaRequired(claims,factors=[]){return claims.aal!=='aal2'||!factors.some(f=>f.status==='verified'&&f.factor_type==='totp')}
export function normalizePath(path){return path.replace(/^\/(?:functions\/v1\/)?academy(?=\/|$)/,'')||'/'}
