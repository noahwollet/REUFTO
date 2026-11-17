from pathlib import Path
import json,base64,shutil,re,hashlib,secrets,os
R=Path(__file__).resolve().parents[1];S=Path(os.environ['REU_SOURCE']).resolve();D=R/'docs';F=R/'supabase/functions/academy';T=R.parent/'tmp/github-migration';T.mkdir(exist_ok=True)
refs=json.loads((S/'public/documents.js').read_text().removeprefix('const uploadedDocuments=').removesuffix(';'))
assets={};names=[x['file'] for x in refs]+['REU_IM_Fillable.pdf','REU_CEVO_Fillable.pdf','REU_Map_Test_Layout_Draft.pdf','REU_Map_Test_Admin_Key_Draft.pdf']
import mimetypes
for n in names:
 if (S/'public'/n).exists():assets['/'+n]={'type':mimetypes.guess_type(n)[0] or 'application/octet-stream','key':'assets/'+n}
(F/'assets.json').write_text(json.dumps(assets));(F/'references.json').write_text(json.dumps(refs));shutil.copy(S/'academy/catalog.json',T/'catalog.json')
private_catalog=json.loads((T/'catalog.json').read_text());private_catalog['bootstrapOwnerEmail']=os.environ['REU_BOOTSTRAP_EMAIL'];(F/'catalog.json').write_text(json.dumps(private_catalog))
server=(S/'academy/server.js').read_text().replace('Sign in with your assigned ChatGPT account.','Sign in with your REU account.').replace("const OWNER='"+os.environ['REU_BOOTSTRAP_EMAIL']+"'","const OWNER=CATALOG.bootstrapOwnerEmail")
a=server.index('function serveAsset(');b=server.index('\nexport default',a)
server=server[:a]+'''async function serveAsset(path,attachment=false){const asset=ASSETS[path];need(asset,'Not found.',404);const f=await environment.BUCKET.get(asset.key);need(f,'Document unavailable.',404);return new Response(f.body,{headers:{'Content-Type':asset.type,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store',...(attachment?{'Content-Disposition':'attachment; filename="'+path.slice(1)+'"'}:{})}})}'''+server[b:]
code="import CATALOG from './catalog.json' with {type:'json'};\nimport REFERENCES from './references.json' with {type:'json'};\nimport ASSETS from './assets.json' with {type:'json'};\nimport {environment} from './persistence.js';\n"
for name in ['activity.js','calendar.js','presentation.js','daily_pqs.js','workflow.js']:code+=(S/'academy'/name).read_text()+'\n'
code+=server
(F/'core.js').write_text(code)
for name in ['academy.css','reu-patch.jpg','reu-header.png']:shutil.copy(S/'public'/name,D/name)
js=(S/'public/academy.js').read_text()+'\n'+(S/'public/workflow-ui.js').read_text();js=js.replace('__REU_LETTERHEAD_DATA__','data:image/png;base64,'+base64.b64encode((D/'reu-header.png').read_bytes()).decode())
# Use relative public assets under the GitHub project path.
for name in ['reu-patch.jpg','reu-header.png']:js=js.replace('/'+name,'./'+name)
js=js.replace('load().catch(error=>', 'startReuSession().catch(error=>')
js=js.replace('<a class="button primary" href="/signin-with-chatgpt?return_to=%2F" target="_top">Sign in with ChatGPT</a>','<button class="button primary" onclick="showReuLogin()">Sign in to REU</button>')
js=js.replace('Use the email assigned to your REU training account.','Use the email assigned to your REU training account.')
js=js.replace('href="/signout-with-chatgpt?return_to=%2F" target="_top" onclick="recordSignout()"','href="#" onclick="signOutReu();return false"')
js=js.replace('ChatGPT sign-in email','REU sign-in email').replace('ChatGPT account','REU account')
(D/'academy.js').write_text(js)
html=(S/'public/index.html').read_text().replace('href="/academy.css"','href="./academy.css"').replace('src="/reu-patch.jpg"','src="./reu-patch.jpg"').replace('<script src="/academy.js" defer>','<script src="./connection.js"></script><script src="./auth.js"></script><script src="./academy.js" defer>')
(D/'index.html').write_text(html);(D/'404.html').write_text(html);(D/'.nojekyll').write_text('')
(D/'connection.js').write_text("window.REU_CONNECTION="+json.dumps({'url':'https://rcdfrljvcpqnpptiteuu.supabase.co','publishableKey':'sb_publishable_qNQ8t_6F8Qu2vPb95EYg2Q_BY0m2eGN','api':'https://rcdfrljvcpqnpptiteuu.supabase.co/functions/v1/academy'})+';')
manifest=[]
for path,meta in assets.items():
 f=S/'public'/path[1:];manifest.append({'path':str(f),'name':meta['key'],'mime':meta['type'],'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()})
(T/'assets-manifest.json').write_text(json.dumps(manifest))
print('Prepared frontend, protected backend and',len(manifest),'private documents')
