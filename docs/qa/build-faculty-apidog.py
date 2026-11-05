"""Tạo bộ import faculty độc lập, không ghi vào dự án Apidog từ xa."""
import csv
import json
from pathlib import Path

OUT = Path(__file__).parent / 'faculty-apidog'
OUT.mkdir(exist_ok=True)

def dump(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')

cases = []
def add(method, label, body=None, code=200, target='fixture', field=None, message=None):
    cases.append(dict(id=f'FAC-{method}-{label}', method=method, body=body,
                      code=code, target=target, field=field, message=message))

add('GET_LIST', '001', target='none')
add('GET', 'EXISTING')
for method in ['GET', 'PUT', 'DELETE']:
    body = {'facultyName': '{{qaName}}_UPDATED'} if method == 'PUT' else None
    add(method, 'BAD_ID', body, 400, 'invalid', message='Mã khoa không hợp lệ')
    add(method, 'NOT_FOUND', body, 404, 'missing', message='Khoa không tồn tại')
invalid = [
    ('EMPTY_BODY', {}, 'facultyName'),
    ('MISSING_NAME', {'description': 'x'}, 'facultyName'),
    ('NULL_NAME', {'facultyName': None}, 'facultyName'),
    ('NUMBER_NAME', {'facultyName': 1}, 'facultyName'),
    ('BOOL_NAME', {'facultyName': True}, 'facultyName'),
    ('ARRAY_NAME', {'facultyName': []}, 'facultyName'),
    ('OBJECT_NAME', {'facultyName': {}}, 'facultyName'),
    ('EMPTY_NAME', {'facultyName': ''}, 'facultyName'),
    ('SPACE_NAME', {'facultyName': '   '}, 'facultyName'),
    ('NAME_101', {'facultyName': 'A' * 101}, 'facultyName'),
    ('DESC_NULL', {'facultyName': '{{qaName}}', 'description': None}, 'description'),
    ('DESC_NUMBER', {'facultyName': '{{qaName}}', 'description': 1}, 'description'),
    ('DESC_ARRAY', {'facultyName': '{{qaName}}', 'description': []}, 'description'),
    ('DESC_1001', {'facultyName': '{{qaName}}', 'description': 'A' * 1001}, 'description'),
    ('EXTRA_FIELD', {'facultyName': '{{qaName}}', 'extra': True}, 'extra'),
]
for method in ['POST', 'PUT']:
    for label, body, field in invalid:
        add(method, label, body, 400, 'none' if method == 'POST' else 'fixture',
            field, 'Dữ liệu gửi lên không hợp lệ')
    success_code = 201 if method == 'POST' else 200
    target = 'none' if method == 'POST' else 'fixture'
    for label, body in [
        ('VALID', {'facultyName': '{{qaName}}_NEW', 'description': 'Mô tả mới'}),
        ('NO_DESC', {'facultyName': '{{qaName}}_NEW'}),
        ('EMPTY_DESC', {'facultyName': '{{qaName}}_NEW', 'description': ''}),
        ('DESC_1000', {'facultyName': '{{qaName}}_NEW', 'description': 'A' * 1000}),
        ('NAME_100', {'facultyName': '{{qaName100}}'}),
        ('TRIM', {'facultyName': ' {{qaName}}_NEW ', 'description': ' text '}),
    ]:
        add(method, label, body, success_code, target)
    add(method, 'DUPLICATE', {'facultyName': '{{qaName}}'}, 409,
        'fixture' if method == 'POST' else 'duplicate',
        message='Khoa đã tồn tại' if method == 'POST' else 'Dữ liệu đã tồn tại')
add('PUT', 'SAME_NAME', {'facultyName': '{{qaName}}'}, 200)
add('DELETE', 'EXISTING')

PRE = r"""
const cfg = __CFG__;
const resolved = pm.variables.replaceIn(pm.request.url.toString());
if (!/^http:\/\/(localhost|127\.0\.0\.1):8080(?:\/|$)/.test(resolved)) {
  throw new Error('BLOCKED: chỉ chạy trên localhost:8080, không dùng dữ liệu thật');
}
const root = (resolved.match(/^https?:\/\/[^\/]+/) || ['http://localhost:8080'])[0];
const name = 'QA_FAC_' + Date.now() + '_' + Math.random().toString(16).slice(2,10);
pm.variables.set('qaName', name);
pm.variables.set('qaName100', name.padEnd(100, 'A'));
pm.variables.set('qaOwnedIds', '[]');
pm.variables.set('qaRoot', root);
function seed(seedName, next) {
  pm.sendRequest({url:root+'/faculty',method:'POST',header:{'Content-Type':'application/json'},
    body:{mode:'raw',raw:JSON.stringify({facultyName:seedName,description:'QA fixture'})}}, (err,res)=>{
    if(err || res.code!==201) throw new Error('BLOCKED: không tạo được fixture '+cfg.id);
    const id=res.json().data._id;
    if(!/^[a-f0-9]{24}$/.test(id)) throw new Error('BLOCKED: fixture không có ID');
    const ids=JSON.parse(pm.variables.get('qaOwnedIds'));ids.push(id);
    pm.variables.set('qaOwnedIds',JSON.stringify(ids));next(id);
  });
}
if(cfg.target==='invalid') pm.variables.set('qaFacultyId','invalid');
else if(cfg.target==='missing') pm.variables.set('qaFacultyId','000000000000000000000001');
else if(cfg.target==='fixture' || cfg.target==='duplicate') {
  seed(name, id=>{
    pm.variables.set('qaFacultyId',id);
    if(cfg.target==='duplicate') seed(name+'_OTHER', other=>pm.variables.set('qaFacultyId',other));
  });
}
""".strip()

POST = r"""
const cfg=__CFG__;
const result=pm.response.json();
const root=pm.variables.get('qaRoot');
const ids=JSON.parse(pm.variables.get('qaOwnedIds')||'[]');
// Thu hồi cả bản ghi tạo thành công ngoài dự kiến để ca lỗi không để rác.
if(cfg.method==='POST' && pm.response.code===201 && result.data?.facultyName?.startsWith('QA_FAC_')) ids.push(result.data._id);
for(const id of [...new Set(ids)]) {
  const alreadyDeleted=cfg.method==='DELETE' && pm.response.code===200 && id===pm.variables.get('qaFacultyId');
  if(!alreadyDeleted) pm.sendRequest({url:root+'/faculty/'+id,method:'DELETE'},(err,res)=>{
    pm.test(cfg.id+' cleanup '+id,()=>{pm.expect(err).to.equal(null);pm.expect(res.code).to.equal(200);});
  });
}
pm.test(cfg.id+' HTTP',()=>pm.expect(pm.response.code).to.equal(cfg.code));
pm.test(cfg.id+' wrapper',()=>{
  pm.expect(result.status).to.equal(cfg.code<400?'success':'error');
  pm.expect(result).to.have.property('data');
});
if(cfg.message) pm.test(cfg.id+' message',()=>pm.expect(result.message).to.equal(cfg.message));
if(cfg.field) pm.test(cfg.id+' lỗi từng trường',()=>{
  pm.expect(result.errors).to.be.an('array');
  pm.expect(result.errors.some(e=>e.field===cfg.field && typeof e.message==='string')).to.equal(true);
});
if(cfg.code<400) pm.test(cfg.id+' dữ liệu',()=>{
  if(cfg.method==='GET_LIST') {pm.expect(result.data).to.be.an('array');return;}
  pm.expect(result.data._id).to.match(/^[a-f0-9]{24}$/);
  if(cfg.method!=='POST') pm.expect(result.data._id).to.equal(pm.variables.get('qaFacultyId'));
  if(cfg.body && ['POST','PUT'].includes(cfg.method)) {
    const expected=JSON.parse(pm.variables.replaceIn(JSON.stringify(cfg.body)));
    pm.expect(result.data.facultyName).to.equal(expected.facultyName.trim());
    if(expected.description!==undefined) pm.expect(result.data.description).to.equal(expected.description.trim());
  }
});
""".strip()

faculty = {'type':'object','required':['_id','facultyName'], 'properties':{
    '_id':{'type':'string','pattern':'^[a-fA-F0-9]{24}$'},
    'facultyName':{'type':'string'},'description':{'type':'string'},'__v':{'type':'integer'}}}
input_schema = {'type':'object','additionalProperties':False,'required':['facultyName'], 'properties':{
    'facultyName':{'type':'string','minLength':1,'maxLength':100,'description':'Trim trước khi kiểm tra'},
    'description':{'type':'string','maxLength':1000}}}
def wrapper(code, listing=False):
    if code >= 400:
        return {'type':'object','required':['status','message','data'],'properties':{
            'status':{'type':'string','enum':['error']}, 'message':{'type':'string'},
            'data':{'type':'null'}, 'errors':{'type':'array','items':{'type':'object','required':['field','message'],
            'properties':{'field':{'type':'string'},'message':{'type':'string'}}}}}}
    return {'type':'object','required':['status','data'],'properties':{
        'status':{'type':'string','enum':['success']}, 'data':{'type':'array','items':faculty} if listing else faculty}}

project = {'apidogProject':'1.0.0','$schema':{'app':'apidog','type':'project','version':'1.2.0'},
           'info':{'name':'CTULib faculty','description':'API và ca kiểm thử faculty; tiêu chí đề xuất từ code/review, chưa phải kết quả PASS trên Apidog.'},
           'projectSetting':{'auth':{},'securityScheme':{},'apiStatuses':['developing','testing','released','deprecated']},
           'apiCollection':[{'name':'Faculty','items':[],'auth':{'type':'noauth'}}]}
for key in ['socketCollection','docCollection','webSocketCollection','socketIOCollection','mcpClientCollection',
            'responseCollection','schemaCollection','securitySchemeCollection','oasComponentCollection','requestCollection',
            'environments','commonScripts','globalVariables','customFunctions','projectTestCaseCategories','projectTestCaseTags','projectAssociations','moduleSettings']:
    project[key]=[]
project['commonParameters']={}
project['projectSetting']['servers']=[{'id':'910000','name':'Default Server','moduleId':910000}]
project['moduleSettings']=[{'id':'910000','name':'Faculty','description':'Bộ kiểm thử khoa độc lập','moduleVariables':[],'openApiInfo':{}}]
project['apiCollection'][0].update({'id':910001,'parentId':0,'moduleId':910000,'serverId':'',
    'visibility':'SHARED','securityScheme':{},'preProcessors':[],'postProcessors':[],
    'identityPattern':{'httpApi':{'type':'methodAndPath','bodyType':'','fields':[]}}})
oas={'openapi':'3.1.0','info':{'title':'CTULib faculty','version':'1.0.0'},
     'servers':[{'url':'http://localhost:8080'}],'paths':{},'security':[]}
counter=91000000
for method,name,path in [('GET_LIST','Danh sách khoa','/faculty'),('GET','Chi tiết khoa','/faculty/{id}'),
                         ('POST','Tạo khoa','/faculty'),('PUT','Cập nhật khoa','/faculty/{id}'),('DELETE','Xóa khoa','/faculty/{id}')]:
    verb='get' if method=='GET_LIST' else method.lower()
    group=[c for c in cases if c['method']==method]
    responses=[]
    codes=sorted(set(c['code'] for c in group))
    response_ids={code:str(counter+i+1) for i,code in enumerate(codes)}
    counter+=100
    for code in codes:
        responses.append({'id':response_ids[code],'code':code,'name':str(code),'headers':[],
                          'jsonSchema':wrapper(code,method=='GET_LIST'),'contentType':'json','mediaType':'application/json',
                          'description':'Tiêu chí mong đợi; xem README về lỗi backend đang mở.'})
    params={'path':[{'id':'id#0','name':'id','required':True,'enable':True,'type':'string','schema':{'type':'string'}}] if '{id}' in path else [],
            'query':[],'header':[],'cookie':[]}
    api={'method':verb,'path':path,'parameters':params,'auth':{'type':'noauth'},'securityScheme':{},'commonParameters':{},
         'responses':responses,'responseExamples':[], 'requestBody':{'type':'application/json','required':True,'jsonSchema':input_schema,'parameters':[]} if method in ['POST','PUT'] else {'type':'none'},
         'description':'Backend hiện chưa gắn auth cho faculty. Quyền truy cập chưa được chốt. PUT yêu cầu facultyName; description tùy chọn.',
         'tags':['Faculty'],'status':'testing','cases':[],'type':'http','preProcessors':[],'postProcessors':[]}
    api.update({'id':str(counter-1),'moduleId':910000,'serverId':'','visibility':'SHARED',
                'inheritPreProcessors':{},'inheritPostProcessors':{},'advancedSettings':{},'mocks':[]})
    for i,c in enumerate(group):
        serialized=json.dumps(c,ensure_ascii=False)
        api['cases'].append({'id':counter+i,'type':'TEST_CASE','path':path,'name':c['id'],
            'responseId':response_ids[c['code']],
            'parameters':{'path':[{'id':'id#0','name':'id','value':'{{qaFacultyId}}','type':'string','enable':True}] if '{id}' in path else [],'query':[],'header':[],'cookie':[]},
            'requestBody':{'type':'application/json','data':json.dumps(c['body'],ensure_ascii=False)} if c['body'] is not None else {'type':'none'},
            'auth':{'type':'noauth'},'securityScheme':{},'commonParameters':{},'apiTestDataList':[],
            'moduleId':910000,'visibility':'INHERITED','advancedSettings':{'disabledSystemHeaders':{}},
            'preProcessors':[{'type':'customScript','data':PRE.replace('__CFG__',serialized),'enable':True,'defaultEnable':True}],
            'postProcessors':[{'type':'customScript','data':POST.replace('__CFG__',serialized),'enable':True,'defaultEnable':True}],
            'inheritPreProcessors':{},'inheritPostProcessors':{},'requestResult':None})
    project['apiCollection'][0]['items'].append({'name':name,'api':api})
    operation={'summary':name,'tags':['Faculty'],'responses':{str(code):{'description':str(code),'content':{'application/json':{'schema':wrapper(code,method=='GET_LIST')}}} for code in codes}}
    if '{id}' in path: operation['parameters']=[{'in':'path','name':'id','required':True,'schema':{'type':'string','pattern':'^[a-fA-F0-9]{24}$'}}]
    if method in ['POST','PUT']: operation['requestBody']={'required':True,'content':{'application/json':{'schema':input_schema}}}
    oas['paths'].setdefault(path,{})[verb]=operation
    stem=verb.upper()+'_faculty'+('_id' if '{id}' in path else '')
    with (OUT/(stem+'.dataset.csv')).open('w',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=['caseId','method','path','body','fixture','expectedCode','expectedMessage','errorField'])
        writer.writeheader()
        for c in group: writer.writerow(dict(caseId=c['id'],method=verb.upper(),path=path,
            body=json.dumps(c['body'],ensure_ascii=False) if c['body'] is not None else '',fixture=c['target'],
            expectedCode=c['code'],expectedMessage=c['message'] or '',errorField=c['field'] or ''))
dump(OUT/'faculty.apidog.json',project)
dump(OUT/'faculty.openapi.json',oas)
dump(OUT/'cases.json',cases)
print(json.dumps({'endpoints':5,'cases':len(cases),'datasetRows':len(cases),'output':str(OUT)}))
