const {test}=require('node:test'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const createRuntime=require('../functions/etrain-api/performance-runtime');
const response=require('../functions/etrain-api/storage-response');
const view=require('../functions/etrain-api/data-view');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

test('reads coalesce within one request, never across concurrent users or subsequent requests',async()=>{
  const runtime=createRuntime();let calls=0;
  const load=async()=>({sequence:++calls});
  const [a,b]=await Promise.all([runtime.run(async()=>{
    const [x,y]=await Promise.all([runtime.read('users',load),runtime.read('users',load)]);
    assert.equal(x,y);return x;
  }),runtime.run(()=>runtime.read('users',load))]);
  assert.notEqual(a,b);assert.equal(calls,2);
  await runtime.run(()=>runtime.read('users',load));assert.equal(calls,3);
});
test('writes invalidate cached reads; failed reads and failed initialization can be retried',async()=>{
  const runtime=createRuntime();let value=1,initializations=0;
  await runtime.run(async()=>{
    assert.equal(await runtime.read('settings',async()=>value),1);
    value=2;runtime.invalidate('settings');
    assert.equal(await runtime.read('settings',async()=>value),2);
    await assert.rejects(runtime.read('broken',async()=>{throw Error('offline');}),/offline/);
    assert.equal(await runtime.read('broken',async()=>3),3);
  });
  await assert.rejects(runtime.once('catalog',async()=>{throw Error('offline');}),/offline/);
  const initialize=async()=>{initializations++;};
  await Promise.all([runtime.once('catalog',initialize),runtime.once('catalog',initialize)]);
  await runtime.once('catalog',initialize);assert.equal(initializations,1);
});
test('internal timing is opt-in and measures parallel reads without adding their durations',async()=>{
  let tick=0,releaseA,releaseB;
  const runtime=createRuntime({now:()=>tick});
  await runtime.run(async()=>{
    await runtime.phase('catalog',()=>runtime.once('catalog',async()=>{tick=5;}));
    const loaded=runtime.phase('snapshot',()=>Promise.all([
      runtime.read('data/courses.json',()=>new Promise(resolve=>{releaseA=resolve;})),
      runtime.read('data/settings.json',()=>new Promise(resolve=>{releaseB=resolve;}))
    ]));
    await Promise.resolve();tick=25;releaseA({});await runtime.read('data/courses.json',()=>{throw Error('must coalesce');});
    tick=45;releaseB({});await loaded;
    tick=47;const metrics=runtime.snapshot();
    assert.equal(metrics.handlerMs,47);assert.equal(metrics.catalogMs,5);assert.equal(metrics.loadMs,40);
    assert.equal(metrics.readCount,2);assert.equal(metrics.initializationStarted,true);
    assert.deepEqual(metrics.slowestReads.map(r=>r.table),['settings','courses']);
  },true);
  await runtime.run(async()=>{
    await runtime.once('catalog',()=>{throw Error('should reuse initialization');});
    assert.equal(runtime.snapshot().initializationStarted,false);assert.equal(runtime.snapshot().readCount,0);
  },true);
  await runtime.run(()=>assert.equal(runtime.snapshot(),undefined));
});
test('only missing objects use defaults; storage failures cannot silently replace live data with seeds',()=>{
  assert.deepEqual(response.decodeJSON({status:404}),{missing:true});
  assert.deepEqual(response.decodeJSON({status:200,body:Buffer.from('{"enforceGate":true}')}),{value:{enforceGate:true}});
  for(const status of [403,429,500])assert.throws(()=>response.decodeJSON({status}),/读取业务数据失败/);
  assert.throws(()=>response.decodeJSON({status:200,body:Buffer.from('broken')}),/格式异常/);
});
test('storage deadline remains armed through response body and clears on request close',()=>{
  const req=new EventEmitter();let callback,delay,cleared=false,error;
  req.destroy=e=>{error=e;req.emit('close');};
  response.armDeadline(req,'GET',{setTimer:(fn,ms)=>{callback=fn;delay=ms;return 42;},clearTimer:id=>{assert.equal(id,42);cleared=true;}});
  req.emit('response',{});assert.equal(cleared,false);assert.equal(delay,7000);
  callback();assert.match(error.message,/超时/);assert.equal(cleared,true);
  response.armDeadline(new EventEmitter(),'PUT',{setTimer:(_,ms)=>{assert.equal(ms,20000);},clearTimer(){}});
});
test('page scopes default to full data and only administrator receives sanitized user profiles',()=>{
  assert.equal(view.keysFor('student.html'),null);assert.equal(view.keysFor(undefined),null);
  assert.ok(view.keysFor('admin-courses.html').includes('settings'));
  assert.equal(view.keysFor('admin-courses.html','mentor'),null);
  assert.equal(view.keysFor('mentor.html','student'),null);
  for(const page of ['mentor.html','mentor-coach.html','mentor-mentee.html']){
    const keys=view.keysFor(page,'mentor');assert.equal(keys.length,10);
    for(const required of ['courses','users','mentors','trainees','levels','journey','learn','settings','tasks','readiness'])assert.ok(keys.includes(required));
  }
  const users={S001:{wid:'S001',role:'student',passwordHash:'secret'}};
  for(const role of ['student','mentor','trainer'])assert.equal(view.publicUsers(role,users),undefined);
  assert.deepEqual(view.publicUsers('admin',users),[{wid:'S001',role:'student'}]);
});
test('administrator refresh uses bundled users in one request, old servers retain compatibility',async()=>{
  const source=fs.readFileSync(path.join(__dirname,'../app/assets/mock-api-live.js'),'utf8');
  const chunk=source.slice(source.indexOf('async function liveRefresh(){'),source.indexOf('/* ---------- B. 写路径'));
  const calls=[];let bundled=true;
  const ctx=vm.createContext({LIVE:{token:'a'},MOCK:{DB:{users:{deleted:{wid:'deleted'}}}},
    livePageName:()=> 'admin-dashboard.html',persistIdentity(){},console,
    liveApi:async(action,body)=>{calls.push({action,body});return action==='data'
      ?{user:{wid:'A',role:'admin'},users:bundled?[{wid:'A',role:'admin'}]:undefined,trainees:[],mentors:[]}
      :{ok:true,users:[{wid:'A',role:'admin'}]};}});
  vm.runInContext(chunk,ctx);await ctx.liveRefresh();
  assert.deepEqual(calls.map(c=>c.action),['data']);assert.equal(calls[0].body.page,'admin-dashboard.html');
  assert.equal(ctx.MOCK.DB.users.deleted,undefined);
  bundled=false;calls.length=0;await ctx.liveRefresh();assert.deepEqual(calls.map(c=>c.action),['data','adminUserList']);
  ctx.liveApi=async()=>{ctx.LIVE.token='b';return {user:{wid:'wrong',role:'admin'}};};
  await assert.rejects(ctx.liveRefresh(),/登录身份已变化/);assert.equal(ctx.LIVE.user.wid,'A');
});

test('prefetch finds a late-rendered navigation and excludes external, query and login URLs',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../app/assets/app.js'),'utf8');
  const chunk=source.slice(source.indexOf('function initNavigationPrefetch(){'),source.indexOf('/* 可选诊断'));
  let idle,anchors=[];const links=[],listeners={};
  const ctx=vm.createContext({navigator:{connection:{effectiveType:'4g'}},URL,Set,
    location:{href:'https://site.test/app/pages/admin-courses.html',origin:'https://site.test',pathname:'/app/pages/admin-courses.html'},
    window:{requestIdleCallback:fn=>{idle=fn;}},document:{
      addEventListener:(type,fn)=>{listeners[type]=fn;},querySelectorAll:()=>anchors,
      createElement:()=>({}),head:{appendChild:link=>links.push(link)}
    }});
  vm.runInContext(chunk,ctx);ctx.initNavigationPrefetch();
  anchors=[{href:'https://site.test/app/pages/admin-dashboard.html'},{href:'https://site.test/app/pages/admin-tracking.html'}];
  idle();assert.equal(links.length,2);
  const focus=href=>listeners.focusin({target:{closest:()=>({href})}});
  for(const href of ['https://elsewhere.test/other.html','https://site.test/other.html?token=private','https://site.test/app/pages/login.html'])focus(href);
  assert.equal(links.length,2);focus('https://site.test/app/pages/admin-perms.html');assert.equal(links.length,3);
  assert.ok(links.every(link=>link.rel==='prefetch' && link.as==='document'));
  links.length=0;ctx.navigator.connection.saveData=true;ctx.initNavigationPrefetch();assert.equal(links.length,0);
});

test('navigation timing is opt-in, separates response/body and stops painting when closed',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../app/assets/app.js'),'utf8');
  const chunk=source.slice(source.indexOf('(function initNavigationTiming(){'));
  const storage=new Map(),panels=[];let tick=0;
  function element(){return {children:[],listeners:{},style:{},appendChild(child){this.children.push(child);},
    replaceChildren(){this.children=[];},addEventListener(type,fn){this.listeners[type]=fn;},remove(){this.removed=true;}};}
  const ctx=vm.createContext({URLSearchParams,location:{search:''},sessionStorage:{
    getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},
    window:{performance:{now:()=>tick,getEntriesByType:type=>type==='navigation'?[{startTime:0,responseStart:30,responseEnd:40,domContentLoadedEventEnd:70}]:[]}},
    requestAnimationFrame:fn=>fn(),document:{body:{appendChild:panel=>panels.push(panel)},createElement:element,addEventListener(){}}});
  vm.runInContext(chunk,ctx);assert.equal(ctx.window.ETRAIN_TIMING,undefined);assert.equal(panels.length,0);
  ctx.location.search='?perf=1';vm.runInContext(chunk,ctx);
  const timing=ctx.window.ETRAIN_TIMING;
  tick=100;const sample=timing.start('data');tick=400;timing.headers(sample);tick=450;timing.end(sample,true,{handlerMs:200,catalogMs:0,loadMs:199,readCount:10,initializationStarted:false,slowestReads:[{table:'courses',ms:190}]});tick=470;timing.ready();
  assert.equal(panels.length,1);
  const text=panels[0].children.map(e=>e.textContent).join('\n');
  assert.match(text,/本页 470 毫秒/);assert.match(text,/300 毫秒 \/ 50 毫秒/);assert.equal(storage.size,1);
  assert.match(text,/云函数内部处理：200 毫秒/);assert.match(text,/实际读取文件：10 份/);
  const close=panels[0].children.at(-1);close.listeners.click();assert.equal(storage.size,0);assert.equal(panels[0].removed,true);
  const length=panels[0].children.length;timing.end(sample,false);assert.equal(panels[0].children.length,length);
});
