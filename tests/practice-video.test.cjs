const {test}=require('node:test');
const assert=require('node:assert/strict');
const create=require('../functions/etrain-api/practice-video.js');
function fixture(options={}){
  const calls=[],writes=[];
  const old={url:'https://example.com/previous.mp4'};
  const all={levels:[{id:'L05',title:'实操',stages:{practice:{}}},{id:'L01',stages:{study:{}}}],settings:{enforceGate:true,practiceVideos:{L05:old},taskShots:{a:true}}};
  const service=create({PREFIX:'data/',REGION:'ap-shanghai',loadAll:async()=>structuredClone(all),
    writeJSON:async(key,value)=>{writes.push({key,value});all.settings=structuredClone(value);},
    getStaticBucket:async()=> 'bucket',getVerifiedCreds:async()=>({token:'paired'}),
    presignTokenHeader:c=>({'x-cos-security-token':c.token}),presign:()=> 'https://example.com/part',videoUrl:(_b,k)=>'https://example.com/'+k,
    cosRequest:async(method,key,body,headers,query)=>{
      calls.push({method,key,query});
      if(query&&query.uploads==='')return {status:200,body:'<UploadId>session</UploadId>'};
      if(method==='HEAD')return {status:200,body:'',headers:{'content-length':options.badSize?'1':'12'}};
      return {status:options.failMerge?500:200,body:options.failMerge?'<Error>failure</Error>':''};
    }});
  const admin={role:'admin'};
  async function init(){return service.handle('practiceVideoInit',admin,{levelId:'L05',name:'demo.mp4',size:12});}
  return {service,all,calls,writes,old,admin,init};
}
test('practice upload uses a new object; only verified completion publishes the new video',async()=>{
  const f=fixture(),start=await f.init();
  assert.ok(start.uploadId);assert.equal(f.writes.length,0);
  assert.notEqual(start.key,(await f.init()).key);
  const data={levelId:'L05',key:start.key,uploadId:start.uploadId,size:12,parts:[{partNumber:1,etag:'abc123'}]};
  const sign=await f.service.handle('practiceVideoSign',f.admin,{...data,partNumber:1});
  assert.equal(sign.token,'paired');
  const result=await f.service.handle('practiceVideoComplete',f.admin,data);
  assert.equal(result.ok,true);assert.equal(f.writes.length,1);
  assert.equal(f.all.settings.taskShots.a,true);
  assert.notEqual(f.all.settings.practiceVideos.L05.url,f.old.url);
});
test('merge or HEAD failure keeps the previous video configured',async()=>{
  for(const options of [{failMerge:true},{badSize:true}]){
    const f=fixture(options),start=await f.init();
    const r=await f.service.handle('practiceVideoComplete',f.admin,{levelId:'L05',key:start.key,uploadId:start.uploadId,size:12,parts:[{partNumber:1,etag:'abc123'}]});
    assert.ok(r.error);assert.equal(f.writes.length,0);assert.equal(f.all.settings.practiceVideos.L05.url,f.old.url);
  }
});
test('upload authorization, source key, size and part validation reject invalid requests',async()=>{
  const f=fixture();
  assert.ok((await f.service.handle('practiceVideoInit',{role:'student'},{levelId:'L05'})).error);
  assert.ok((await f.service.handle('practiceVideoInit',f.admin,{levelId:'L01',name:'x.mp4',size:12})).error);
  assert.ok((await f.service.handle('practiceVideoInit',f.admin,{levelId:'L05',name:'x.exe',size:12})).error);
  assert.ok((await f.service.handle('practiceVideoInit',f.admin,{levelId:'L05',name:'x.mp4',size:3*1024**3})).error);
  const start=await f.init();
  assert.ok((await f.service.handle('practiceVideoSign',f.admin,{levelId:'L05',key:'assets/videos/course.mp4',uploadId:'x',partNumber:1})).error);
  assert.ok((await f.service.handle('practiceVideoComplete',f.admin,{levelId:'L05',...start,parts:[{partNumber:2,etag:'bad<xml>'}]})).error);
  assert.equal(f.writes.length,0);
});
test('aborting an upload keeps the existing mapping; remove clears only the selected mapping',async()=>{
  const f=fixture(),start=await f.init();
  assert.equal((await f.service.handle('practiceVideoAbort',f.admin,{...start,levelId:'L05'})).ok,true);
  assert.equal(f.writes.length,0);assert.equal(f.all.settings.practiceVideos.L05.url,f.old.url);
  assert.equal((await f.service.handle('practiceVideoRemove',f.admin,{levelId:'L05'})).ok,true);
  assert.equal(f.all.settings.practiceVideos.L05,undefined);assert.equal(f.all.settings.taskShots.a,true);
});
test('locked students receive no practice video URL; mentors and admins can preview',()=>{
  const f=fixture();
  assert.deepEqual(f.service.visible(f.all,{role:'student',wid:'S1'},()=>false),{});
  assert.equal(f.service.visible(f.all,{role:'student',wid:'S1'},()=>true).L05.url,f.old.url);
  assert.equal(f.service.visible(f.all,{role:'admin'},()=>false).L05.url,f.old.url);
});
