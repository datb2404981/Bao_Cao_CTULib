// Chạy script pm của bộ import qua HTTP; không thay thế kiểm tra import trong Apidog.
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const root = new URL('./faculty-apidog/', import.meta.url);
const project = JSON.parse(await readFile(new URL('faculty.apidog.json', root)));
const results = [];
function expect(actual) {
  const chain = {};
  for (const key of ['to','be','have','and']) Object.defineProperty(chain,key,{get:()=>chain});
  chain.equal = expected => assert.deepEqual(actual, expected);
  chain.property = key => assert.ok(actual != null && Object.hasOwn(actual,key));
  chain.match = regex => assert.match(actual,regex);
  chain.an = type => assert.equal(Array.isArray(actual)?'array':typeof actual,type);
  return chain;
}
for (const item of project.apiCollection[0].items) {
  for (const c of item.api.cases) {
    const variables = new Map();
    const checks = [];
    let pending = [];
    const resolve = text => text.replace(/\{\{([^}]+)\}\}/g,(_,key)=>variables.get(key) ?? `{{${key}}}`);
    const path = c.path.replace('{id}', '{{qaFacultyId}}');
    const pm = {
      variables:{get:key=>variables.get(key),set:(key,value)=>variables.set(key,value),replaceIn:resolve},
      request:{url:{toString:()=>`http://localhost:8080${path}`}}, expect,
      test(name,fn) {try {fn();checks.push({name,pass:true});}catch(e){checks.push({name,pass:false,error:e.message});}},
      sendRequest(request,callback) {
        const promise=(async()=>{
          let response;
          try {
            const r=await fetch(request.url,{method:request.method,headers:request.header,body:request.body?.raw,signal:AbortSignal.timeout(10000)});
            const body=await r.json();response={code:r.status,json:()=>body};
          } catch(e) {callback(e,undefined);return;}
          callback(null,response);
        })();
        pending.push(promise);
      },
    };
    async function drain() {
      while(pending.length){const batch=pending;pending=[];const settled=await Promise.allSettled(batch);for(const r of settled)if(r.status==='rejected')throw r.reason;}
    }
    let actual;
    try {
      for(const hook of c.preProcessors)vm.runInNewContext(hook.data,{pm,URL},{timeout:1000});
      await drain();
      const r=await fetch(resolve(pm.request.url.toString()),{method:item.api.method.toUpperCase(),
        headers:c.requestBody.type==='application/json'?{'Content-Type':'application/json'}:{},
        body:c.requestBody.data ? resolve(c.requestBody.data) : undefined,signal:AbortSignal.timeout(10000)});
      actual={code:r.status,body:await r.json()};
      pm.response={code:actual.code,json:()=>actual.body};
      for(const hook of c.postProcessors)vm.runInNewContext(hook.data,{pm,URL},{timeout:1000});
      await drain();
    } catch(e) {checks.push({name:'execution',pass:false,error:e.message});}
    // Xác minh không để lại fixture, kể cả khi assertion hoặc script thất bại.
    const owned=JSON.parse(variables.get('qaOwnedIds')||'[]');
    if(item.api.method==='post' && actual?.code===201 && actual.body.data?.facultyName?.startsWith('QA_FAC_'))owned.push(actual.body.data._id);
    for(const id of new Set(owned)) {
      const path=`http://localhost:8080/faculty/${id}`;
      const r=await fetch(path,{signal:AbortSignal.timeout(10000)});
      if(r.status===200)await fetch(path,{method:'DELETE',signal:AbortSignal.timeout(10000)});
      const verify=await fetch(path,{signal:AbortSignal.timeout(10000)});
      checks.push({name:'verify cleanup '+id,pass:verify.status===404});
    }
    results.push({id:c.name,code:actual?.code,pass:checks.length>0&&checks.every(x=>x.pass),checks,
      ...(checks.some(x=>!x.pass)?{response:actual?.body}:{})});
  }
}
const report={time:new Date().toISOString(),runner:'HTTP + vm mô phỏng pm; chưa chạy trong Apidog',
  total:results.length,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length,results};
await writeFile(new URL('execution-results.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,failed:report.failed,
  failures:results.filter(r=>!r.pass).map(r=>({id:r.id,code:r.code,checks:r.checks.filter(c=>!c.pass)}))},null,2));
