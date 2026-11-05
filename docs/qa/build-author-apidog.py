"""Tạo hợp đồng đề xuất, testcase và CSV author; không sửa backend."""
import ast
import csv
import json
from pathlib import Path

OUT = Path(__file__).parent / 'author-apidog'
OUT.mkdir(exist_ok=True)
def dump(name, value):
    (OUT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')

# Tái sử dụng cơ chế fixture local và cleanup của bộ faculty.
tree = ast.parse((Path(__file__).parent / 'build-faculty-apidog.py').read_text())
scripts = {n.targets[0].id: ast.literal_eval(n.value.func.value) for n in tree.body
           if isinstance(n, ast.Assign) and isinstance(n.targets[0], ast.Name)
           and n.targets[0].id in ['PRE', 'POST']}
for key in scripts:
    for before, after in [('/faculty', '/author'), ('qaFacultyId', 'qaAuthorId'),
                          ('facultyName', 'fullName'), ('description', 'affiliation'), ('QA_FAC_', 'QA_AUT_')]:
        scripts[key] = scripts[key].replace(before, after)
# Schema hiện không trim; không tự thêm yêu cầu trim vào hợp đồng.
scripts['POST'] = scripts['POST'].replace('expected.fullName.trim()', 'expected.fullName').replace('expected.affiliation.trim()', 'expected.affiliation')
scripts['POST'] += "\nif(cfg.code>=400) pm.test(cfg.id+' data null',()=>pm.expect(result.data).to.equal(null));\nif(cfg.fieldMessage) pm.test(cfg.id+' field message',()=>pm.expect(result.errors.some(e=>e.field===cfg.field && e.message===cfg.fieldMessage)).to.equal(true));\n"
# Cleanup luôn thực hiện trước assertion, kể cả khi response không phải JSON.
scripts['POST'] = scripts['POST'].replace('const result=pm.response.json();', 'let result={}; try { result=pm.response.json(); } catch (_) {}')

cases=[]
def add(method, label, body=None, code=200, target='fixture', field=None, message=None, field_message=None):
    cases.append(dict(id=f'AUT-{method}-{label}', method=method, body=body, code=code,
                      target=target, field=field, message=message, fieldMessage=field_message,
                      technique='BVA' if any(x in label for x in ['50','51','255','256','EMPTY']) else 'EP'))
add('GET_LIST','LIST',target='none')
add('GET','EXISTING')
for method in ['GET','PUT','DELETE']:
    body={'fullName':'{{qaName}}_NEW'} if method=='PUT' else None
    add(method,'INVALID_ID',body,400,'invalid',message='Mã tác giả không hợp lệ')
    add(method,'NOT_FOUND',body,404,'missing',message='Tác giả không tồn tại')
for method in ['POST','PUT']:
    target='none' if method=='POST' else 'fixture'
    for label,body,field,fmsg in [
        ('EMPTY_BODY',{},'fullName',None),
        ('MISSING_NAME',{'notes':'x'},'fullName',None),
        ('NULL_NAME',{'fullName':None},'fullName',None),
        ('NUMBER_NAME',{'fullName':1},'fullName',None),
        ('ARRAY_NAME',{'fullName':[]},'fullName',None),
        ('EMPTY_NAME',{'fullName':''},'fullName','Full name is required'),
        ('NAME_51',{'fullName':'A'*51},'fullName','Full name must be at most 50 characters'),
        ('AFFILIATION_256',{'fullName':'{{qaName}}','affiliation':'A'*256},'affiliation','Affiliation must be at most 255 characters'),
        ('NULL_AFFILIATION',{'fullName':'{{qaName}}','affiliation':None},'affiliation',None),
        ('NUMBER_AFFILIATION',{'fullName':'{{qaName}}','affiliation':1},'affiliation',None),
        ('NULL_NOTES',{'fullName':'{{qaName}}','notes':None},'notes',None),
        ('NUMBER_NOTES',{'fullName':'{{qaName}}','notes':1},'notes',None),
    ]:
        add(method,label,body,400,target,field,'Dữ liệu gửi lên không hợp lệ',fmsg)
    for label, body in [
        ('VALID',{'fullName':'{{qaName}}_NEW','affiliation':'CTU','notes':'Ghi chú tác giả'}),
        ('OPTIONAL_OMITTED',{'fullName':'{{qaName}}_NEW'}),
        ('OPTIONAL_EMPTY',{'fullName':'{{qaName}}_NEW','affiliation':'','notes':''}),
        ('NAME_50',{'fullName':'{{qaName50}}'}),
        ('AFFILIATION_255',{'fullName':'{{qaName}}_NEW','affiliation':'A'*255}),
        ('UNKNOWN_STRIPPED',{'fullName':'{{qaName}}_NEW','extra':True}),
    ]:
        add(method,label,body,201 if method=='POST' else 200,target)
    add(method,'DUPLICATE',{'fullName':'{{qaName}}'},409,
        'fixture' if method=='POST' else 'duplicate',message='Tác giả đã tồn tại')
add('PUT','SAME_NAME',{'fullName':'{{qaName}}'})
add('DELETE','EXISTING')
scripts['PRE'] = scripts['PRE'].replace("pm.variables.set('qaName100', name.padEnd(100, 'A'));", "pm.variables.set('qaName50', name.padEnd(50, 'A'));")
scripts['POST'] += "\nif(cfg.code<400 && cfg.body?.notes!==undefined) pm.test(cfg.id+' notes',()=>pm.expect(result.data.notes).to.equal(cfg.body.notes));\nif(cfg.id.endsWith('UNKNOWN_STRIPPED')) pm.test(cfg.id+' extra stripped',()=>pm.expect(result.data).not.to.have.property('extra'));\n"
author={'type':'object','required':['_id','fullName'],'properties':{'_id':{'type':'string','pattern':'^[a-fA-F0-9]{24}$'},'fullName':{'type':'string'},'affiliation':{'type':'string'},'notes':{'type':'string'}}}
input_schema={'type':'object','required':['fullName'],'properties':{'fullName':{'type':'string','minLength':1,'maxLength':50},'affiliation':{'type':'string','maxLength':255},'notes':{'type':'string'}},'description':'Trường dư bị loại bỏ theo Zod mặc định; PUT yêu cầu fullName. Chưa chốt chính sách khoảng trắng và trùng không phân biệt hoa/thường.'}
def wrapper(code,listing=False):
    return {'type':'object','required':['status','data']+(['message'] if code>=400 else []),'properties':{'status':{'type':'string','enum':['error' if code>=400 else 'success']},'data':{'type':'null'} if code>=400 else ({'type':'array','items':author} if listing else author),**({'message':{'type':'string'},'errors':{'type':'array','items':{'type':'object','required':['field','message'],'properties':{'field':{'type':'string'},'message':{'type':'string'}}}}} if code>=400 else {})}}
oas={'openapi':'3.1.0','info':{'title':'CTULib author — hợp đồng đề xuất','version':'1.0.0'},'servers':[{'url':'http://localhost:8080'}],'paths':{}}
endpoints=[]
for key,name,path in [('GET_LIST','Danh sách tác giả','/author'),('GET','Chi tiết tác giả','/author/{id}'),('POST','Tạo tác giả','/author'),('PUT','Cập nhật tác giả','/author/{id}'),('DELETE','Xóa tác giả','/author/{id}')]:
    verb='get' if key=='GET_LIST' else key.lower()
    codes=sorted({c['code'] for c in cases if c['method']==key})
    ep=dict(name=name,method=verb,path=path,status='testing',tags=['Author'],auth={'type':'noauth'},
            description='Hợp đồng kiểm thử đề xuất ngày 05/11/2026, chưa phải đặc tả author có sẵn. ID sai: 400/Mã tác giả không hợp lệ; không tồn tại: 404/Tác giả không tồn tại; trùng tên: 409/Tác giả đã tồn tại. Validation: 400/Dữ liệu gửi lên không hợp lệ. Backend hiện mount nhầm authRouter; xem báo cáo trong repository.',
            parameters={'path':[{'name':'id','required':True,'type':'string','schema':{'type':'string','pattern':'^[a-fA-F0-9]{24}$'}}] if '{id}' in path else [],'query':[],'header':[],'cookie':[]},
            requestBody={'type':'application/json','required':True,'jsonSchema':input_schema} if key in ['POST','PUT'] else {'type':'none'},
            responses=[{'name':str(c),'code':c,'contentType':'json','jsonSchema':wrapper(c,key=='GET_LIST')} for c in codes])
    endpoints.append({'key':key,'payload':ep})
    op={'summary':name,'description':ep['description'],'responses':{str(c):{'description':str(c),'content':{'application/json':{'schema':wrapper(c,key=='GET_LIST')}}} for c in codes}}
    if '{id}' in path: op['parameters']=[{'in':'path','name':'id','required':True,'schema':{'type':'string','pattern':'^[a-fA-F0-9]{24}$'}}]
    if key in ['POST','PUT']: op['requestBody']={'required':True,'content':{'application/json':{'schema':input_schema}}}
    oas['paths'].setdefault(path,{})[verb]=op
rows=[]
for c in cases:
    ep=next(e['payload'] for e in endpoints if e['key']==c['method'])
    rows.append(dict(caseId=c['id'],method=ep['method'].upper(),path=ep['path'],body=json.dumps(c['body'],ensure_ascii=False),fixture=c['target'],expectedCode=c['code'],expectedMessage=c['message'] or '',errorField=c['field'] or '',fieldMessage=c['fieldMessage'] or '',technique=c['technique'],preconditions='Backend local:8080; fixture QA_AUT_ độc lập',steps='Tạo fixture nếu cần; gửi request; kiểm tra HTTP/wrapper/message/data; dọn fixture',priority='High'))
with (OUT/'author.dataset.csv').open('w',newline='') as f:
    w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
dump('cases.json',cases);dump('endpoints.json',endpoints);dump('scripts.json',scripts);dump('author.openapi.json',oas)
print(json.dumps({'endpoints':len(endpoints),'cases':len(cases)}))
