"""Đồng bộ tài nguyên author mới qua Apidog CLI; không chạy test."""
import json
import subprocess
from pathlib import Path
OUT=Path(__file__).parent/'author-apidog'
PROJECT='1405851'
def read(name): return json.loads((OUT/name).read_text())
def dump(name,data): (OUT/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
def cli(*args):
    p=subprocess.run(['apidog',*map(str,args)],capture_output=True,text=True)
    try: result=json.loads(p.stdout[p.stdout.find("{\n"):])
    except ValueError: raise RuntimeError(p.stdout[:1000]+p.stderr[:300])
    if p.returncode or not result.get('success'): raise RuntimeError(json.dumps(result,ensure_ascii=False))
    return result.get('data')
def create(kind,payload,filename):
    dump(filename,payload)
    cli('cli-schema','validate',kind+'-create','--file',OUT/filename)
    return cli(kind,'create','--project',PROJECT,'--file',OUT/filename)
state=read('cloud-resources.json') if (OUT/'cloud-resources.json').exists() else {'projectId':int(PROJECT),'endpoints':{},'cases':{}}
def save(): dump('cloud-resources.json',state)
if 'folder' not in state:
    state['folder']=create('folder',{'name':'Author — hợp đồng và kiểm thử','type':'endpoint','moduleId':1512539},'folder-create.json'); save()
for item in read('endpoints.json'):
    key=item['key']
    if key not in state['endpoints']:
        payload=item['payload'];payload['folderId']=state['folder']['id']
        made=create('endpoint',payload,'endpoint-'+key+'.json')
        state['endpoints'][key]=cli('endpoint','get',made['id'],'--project',PROJECT);save()
        print('endpoint',key,made['id'],flush=True)
scripts=read('scripts.json')
for c in read('cases.json'):
    if c['id'] in state['cases']: continue
    ep=state['endpoints'][c['method']]
    response=next(r for r in ep['responses'] if int(r['code'])==c['code'])
    param={'path':[{'name':'id','value':'{{qaAuthorId}}','type':'string','enable':True}] if '{id}' in ep['path'] else [],'header':[],'query':[],'cookie':[]}
    cfg=json.dumps(c,ensure_ascii=False)
    payload=dict(name=c['id'],apiDetailId=ep['id'],categoryId=1967042 if c['technique']=='BVA' else (1967041 if c['code']>=400 else 1967040),method=ep['method'],path=ep['path'],responseId=response['id'],parameters=param,commonParameters={},auth={'type':'noauth'},requestBody={'type':'application/json','data':json.dumps(c['body'],ensure_ascii=False)} if c['body'] is not None else {'type':'none'},advancedSettings={'timeout':5000},preProcessors=[{'type':'customScript','data':scripts['PRE'].replace('__CFG__',cfg),'enable':True,'defaultEnable':True}],postProcessors=[{'type':'customScript','data':scripts['POST'].replace('__CFG__',cfg),'enable':True,'defaultEnable':True}])
    made=create('test-case',payload,'case-'+c['id']+'.json')
    state['cases'][c['id']]=made['id'];save();print('case',c['id'],made['id'],flush=True)
if 'dataset' not in state:
    state['dataset']=create('test-data',{'name':'Author — dữ liệu đối chiếu 48 ca (CSV trong repository)','type':'STATIC','relatedType':'PUBLIC'},'dataset-create.json');save()
if 'suite' not in state:
    payload={'name':'Author — 48 ca CRUD, validation và message lỗi','description':'Hợp đồng đề xuất; fixture QA_AUT_ độc lập; chỉ localhost:8080. Dataset author.dataset.csv là bảng đối chiếu, không lặp toàn bộ suite 48 lần.','priority':1,'items':[{'id':'author-cases','name':'48 ca API author','type':'STATIC_TEST_CASE','testCases':[{'id':i} for i in state['cases'].values()]}]}
    state['suite']=create('test-suite',payload,'suite-create.json');save()
print(json.dumps({'endpointCount':len(state['endpoints']),'caseCount':len(state['cases']),'dataset':state['dataset'],'suite':state['suite']},ensure_ascii=False),flush=True)
