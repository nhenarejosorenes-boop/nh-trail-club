"""TEST-only real Auth/REST tests. Fixture setup/cleanup is privileged and separate.
No credentials, tokens, or client data are printed. Synthetic users only.
"""
import json,sys,uuid,urllib.request,urllib.error
cfg=json.load(open(sys.argv[1]));assert cfg['url']=='https://bsykqjiownewnzguilli.supabase.co','TEST only'
checks=[];tokens=[]
def request(path,token=None,method='GET',data=None):
 headers={'apikey':cfg['key'],'Content-Type':'application/json','Prefer':'return=representation'}
 if token:headers['Authorization']='Bearer '+token
 req=urllib.request.Request(cfg['url']+path,headers=headers,method=method,data=None if data is None else json.dumps(data).encode())
 try:
  with urllib.request.urlopen(req,timeout=25) as r:
   body=r.read();return r.status,json.loads(body) if body else None
 except urllib.error.HTTPError as e:
  body=e.read();return e.code,json.loads(body) if body else None
def check(name,passed,status=None):
 checks.append({'check':name,'pass':bool(passed),'http':status})
 if not passed:raise AssertionError(name)
try:
 for n,u in enumerate(cfg['users']):
  status,res=request('/auth/v1/token?grant_type=password',method='POST',data={'email':u['email'],'password':u['password']});check('login_'+str(n),status==200 and bool(res.get('access_token')),status);tokens.append(res['access_token'])
 a,b,c=cfg['users'];ta,tb,tc=tokens
 shape={'version':1,'notes':'Synthetic prescription','targets':{'distance':'','elevation':'','minutes':'','effort':''},'blocks':[{'stage':x,'items':[]} for x in ['warmup','main','cooldown']]}
 shape['blocks'][1]['items']=[{'id':str(uuid.uuid4()),'name':'Sentadilla','sets':'3','reps':'8 por lado','weight':'22.5','rest':'60','duration':'','intensity':'RPE 6','notes':'Synthetic note'}]
 status,res=request('/rest/v1/training_templates',tc,'POST',{'name':'Builder API synthetic template','title':'Synthetic session','category':'fuerza','structure':shape});check('coach_template_save',status==201 and res[0]['structure']==shape,status);tid=res[0]['id']
 status,res=request('/rest/v1/training_templates?select=id&id=eq.'+tid,ta);check('client_template_hidden',status==200 and res==[],status)
 status,res=request('/rest/v1/weekly_training_plan',tc,'POST',{'athlete_id':a['id'],'session_date':'2026-10-26','category':'fuerza','title':'Builder API synthetic session','details':'Compatibility text','structure':shape});check('coach_save_session',status==201 and res[0]['structure']==shape,status);sid=res[0]['id']
 status,res=request('/rest/v1/weekly_training_plan?select=id,structure,completed&id=eq.'+sid,ta);check('client_structure_roundtrip',status==200 and res[0]['structure']==shape and not res[0]['completed'],status)
 status,res=request('/rest/v1/weekly_training_plan?select=id,structure&id=eq.'+sid,tb);check('foreign_structure_hidden',status==200 and res==[],status)
 shape['blocks'][1]['items'][0]['sets']='4'
 status,res=request('/rest/v1/weekly_training_plan?id=eq.'+sid,tc,'PATCH',{'structure':shape});check('coach_edit_preserves_all_fields',status==200 and res[0]['structure']==shape,status)
 status,res=request('/rest/v1/weekly_training_plan',tc,'POST',{'athlete_id':b['id'],'session_date':'2026-10-27','category':'fuerza','title':'Builder API synthetic copy','structure':shape});check('copy_separate_identity_not_completed',status==201 and res[0]['id']!=sid and not res[0]['completed'],status)
 status,res=request('/rest/v1/rpc/mark_training_completed',ta,'POST',{'p_id':sid,'p_completed':True});check('client_complete',status in (200,204),status)
 status,res=request('/rest/v1/weekly_training_plan?select=structure,completed&id=eq.'+sid,ta);check('completion_does_not_change_prescription',status==200 and res[0]['completed'] and res[0]['structure']==shape,status)
 status,res=request('/rest/v1/weekly_training_plan?id=eq.'+sid,ta,'PATCH',{'structure':{}});check('client_cannot_change_prescription',status in (200,204,403) and not res,status)
 status,res=request('/rest/v1/training_templates',ta,'POST',{'name':'Forbidden','title':'Forbidden','category':'fuerza','structure':shape});check('client_cannot_create_template',status==403,status)
 status,res=request('/rest/v1/weekly_training_plan?id=eq.'+sid,tc,'PATCH',{'structure':{}});check('invalid_structure_rejected',status==400,status)
 status,res=request('/rest/v1/training_templates?select=id');check('anonymous_template_denied',status in (401,403),status)
 status,res=request('/rest/v1/weekly_training_plan?select=id,structure');check('anonymous_training_denied',status in (401,403),status)
except Exception as e:checks.append({'check':'suite_finished','pass':False,'error_type':type(e).__name__})
finally:
 for n,t in enumerate(tokens):
  try:
   status,_=request('/auth/v1/logout',t,'POST');checks.append({'check':'logout_'+str(n),'pass':status in (200,204),'http':status})
  except Exception as e:checks.append({'check':'logout_'+str(n),'pass':False,'error_type':type(e).__name__})
 result={'environment':'TEST','passed':sum(c['pass'] for c in checks),'failed':sum(not c['pass'] for c in checks),'checks':checks}
 print(json.dumps(result,indent=2));sys.exit(bool(result['failed']))
