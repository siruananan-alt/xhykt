const {test}=require('node:test');
const assert=require('node:assert/strict');
const create=require('../functions/etrain-api/practice-video.js');
function fixture(options={}){
  const calls=[],writes=[];
  const old={url:'https://example.com/previous.mp4'};
  const all={levels:[{id:'L05',title:'实操',stages:{practice:{}}},{id:'L04',title:'流量一站式入门',stages:{study:{},exam:{}}},{id:'L08',title:'高导粉获客秘籍',stages:{practice:{}}},{id:'L01',stages:{study:{}}}],settings:{enforceGate:true,practiceVideos:{L05:old},taskShots:{a:true}}};
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
  assert.notEqual(f.all.settings.practiceVideos.L05[0].url,f.old.url);
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

test('fourth lesson supports a tutorial without adding a practice pass requirement',async()=>{
  const f=fixture();
  const start=await f.service.handle('practiceVideoInit',f.admin,{levelId:'L04',name:'demo.mp4',size:12});
  assert.ok(start.uploadId);
  const r=await f.service.handle('practiceVideoComplete',f.admin,{...start,levelId:'L04',size:12,parts:[{partNumber:1,etag:'abc123'}]});
  assert.equal(r.ok,true);
  assert.equal(f.all.levels.find(l=>l.id==='L04').stages.practice,undefined);
  assert.ok(f.service.visible(f.all,{role:'student',wid:'S1'},()=>true).L04[0].url);
});

test('three high-conversion videos coexist; replacing or removing a slot preserves the others and legacy video',async()=>{
  const f=fixture();
  f.all.settings.practiceVideos.L08=f.old;
  const upload=async(slot)=>{
    const start=await f.service.handle('practiceVideoInit',f.admin,{levelId:'L08',slot,name:'demo.mp4',size:12});
    return f.service.handle('practiceVideoComplete',f.admin,{...start,levelId:'L08',slot,size:12,parts:[{partNumber:1,etag:'abc123'}]});
  };
  await upload(1);await upload(2);
  assert.equal(f.all.settings.practiceVideos.L08.length,3);
  assert.equal(f.all.settings.practiceVideos.L08[0].url,f.old.url);
  const third=f.all.settings.practiceVideos.L08[2].url;
  await upload(1);
  assert.equal(f.all.settings.practiceVideos.L08[2].url,third);
  await f.service.handle('practiceVideoRemove',f.admin,{levelId:'L08',slot:1});
  assert.equal(f.all.settings.practiceVideos.L08[1],null);
  assert.equal(f.all.settings.practiceVideos.L08[0].url,f.old.url);
  assert.equal(f.all.settings.practiceVideos.L08[2].url,third);
});

test('slot boundaries and cross-slot uploaded keys are enforced on the server',async()=>{
  const f=fixture();
  for(const [levelId,slot] of [['L04',1],['L05',1],['L08',3],['L08',-1],['L08',1.5]]){
    assert.ok((await f.service.handle('practiceVideoInit',f.admin,{levelId,slot,name:'x.mp4',size:12})).error);
  }
  const start=await f.service.handle('practiceVideoInit',f.admin,{levelId:'L08',slot:2,name:'x.mp4',size:12});
  assert.ok((await f.service.handle('practiceVideoSign',f.admin,{...start,levelId:'L08',slot:0,partNumber:1})).error);
  assert.equal(f.calls.some(c=>c.method==='DELETE'),false);
});

test('learner player renders populated slots in order and tolerates a removed middle video',()=>{
  const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
  const settings={practiceVideos:{L08:[{url:'https://example.com/one.mp4'},null,{url:'https://example.com/three.mp4'}],L04:{url:'https://example.com/four.mp4'}}};
  const ctx=vm.createContext({window:{},URL,MOCK:{DB:{settings}},UI:{esc:s=>String(s)}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../app/assets/practice-video.js'),'utf8'),ctx);
  const html=ctx.window.PracticeVideo.player('L08');
  assert.equal((html.match(/<video /g)||[]).length,2);
  assert.ok(html.indexOf('one.mp4')<html.indexOf('three.mp4'));
  assert.ok(html.includes('教学视频 3'));
  assert.ok(ctx.window.PracticeVideo.player('L04').includes('four.mp4'));
});

test('fourth tutorial renders inside the existing exam card with no additional stage or card',()=>{
  const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
  const page=fs.readFileSync(path.join(__dirname,'../app/pages/student-level.html'),'utf8');
  const render=page.slice(page.indexOf('function renderStages('),page.indexOf('/* 环节 1：'));
  const exam=page.slice(page.indexOf('function examBlock('),page.indexOf('/* ---------- 下一关预告'));
  const box={innerHTML:''};
  const ctx=vm.createContext({document:{getElementById:()=>box},
    MOCK:{LV_STAGES:['study','practice','exam'],EXAM_TASK:'EXAM',DB:{tasks:{}},lvStageOk:()=>false},
    UI:{normalizeTaskRecFE:()=>null,currentVersion:()=>null},
    PracticeVideo:{player:()=>'<video controls></video>',bindErrors(){}},
    studyBlock:()=>'<div class="card">学</div>',practiceBlock:()=>{throw new Error('must not add practice');},
    shotRequiredUI:()=>false,shotPickerHTML:()=>'',esc:s=>String(s)});
  vm.runInContext(render+'\n'+exam+'\nrenderStages("S1",{id:"L04",stages:{study:{},exam:{}}});',ctx);
  assert.equal((box.innerHTML.match(/class="card"/g)||[]).length,2);
  assert.equal((box.innerHTML.match(/<video/g)||[]).length,1);
  assert.ok(box.innerHTML.indexOf('考 · 关卡考核')<box.innerHTML.indexOf('<video'));
  assert.ok(box.innerHTML.indexOf('<video')<box.innerHTML.indexOf('考核要求：'));
});
