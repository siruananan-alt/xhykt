const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const gate=require('../functions/etrain-api/gate-policy.js');
function frontend(){
  const ctx=vm.createContext({window:{}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../app/assets/mock-data.js'),'utf8'),ctx);
  return ctx.window.MOCK;
}
test('switch off opens every valid level on both client and server without marking any complete',()=>{
  const mock=frontend();
  mock.DB.journey={};mock.DB.tasks={};mock.DB.learn={};
  for(const value of [false,undefined,'true',1]){
    mock.DB.settings.enforceGate=value;
    for(const lv of mock.DB.levels){
      assert.equal(mock.levelUnlocked('S001',lv),true);
      assert.equal(gate({settings:{enforceGate:value},levels:mock.DB.levels},'S001',lv,()=>{throw new Error('must not apply prerequisites');}),true);
      assert.equal(mock.levelDone('S001',lv),false);
    }
  }
  assert.equal(mock.levelUnlocked('S001',null),false);
  assert.equal(gate({settings:{}},'S001',null,()=>true),false);
});
test('switch on enforces previous-level completion and reopening immediately removes restrictions',()=>{
  const mock=frontend();
  mock.DB.settings.enforceGate=true;mock.DB.journey={};mock.DB.learn={};mock.DB.tasks={};
  const first=mock.DB.levels[0],second=mock.DB.levels[1];
  assert.equal(mock.levelUnlocked('S001',first),true);
  assert.equal(mock.levelUnlocked('S001',second),false);
  const all={settings:{enforceGate:true},levels:mock.DB.levels};
  assert.equal(gate(all,'S001',second,(_all,w,lv)=>mock.levelDone(w,lv)),false);
  mock.DB.journey.S001={[first.id]:{study:{ok:true}}};
  assert.equal(mock.levelUnlocked('S001',second),true);
  assert.equal(gate(all,'S001',second,(_all,w,lv)=>mock.levelDone(w,lv)),true);
  mock.DB.settings.enforceGate=false;all.settings.enforceGate=false;
  const last=mock.DB.levels.at(-1);
  assert.equal(mock.levelUnlocked('S001',last),true);
  assert.equal(gate(all,'S001',last,()=>false),true);
});
test('switch write applies the acknowledged server value without a stale follow-up read',async()=>{
  const source=fs.readFileSync(path.join(__dirname,'../app/assets/mock-api-live.js'),'utf8');
  const write=source.slice(source.indexOf('function liveWrite('),source.indexOf('/* ---------- 视频上传接线'));
  const entry=source.slice(source.indexOf('    mockSetGate:'),source.indexOf('    /* 【2026-10-09 P0-2】'));
  const calls=[];
  const ctx=vm.createContext({MOCK:{DB:{settings:{enforceGate:false,practiceVideos:{L04:{url:'kept'}}}}},
    liveApi:async(action,body)=>{calls.push({action,body});return {ok:true,settings:{enforceGate:true}};},
    liveRefresh:async()=>{throw new Error('must not fetch stale value');},liveRerender(){},toast(){},console});
  vm.runInContext(write+'\nthis.setGate=({'+entry+'}).mockSetGate;',ctx);
  await ctx.setGate(true);
  assert.equal(ctx.MOCK.DB.settings.enforceGate,true);
  assert.equal(ctx.MOCK.DB.settings.practiceVideos.L04.url,'kept');
  assert.equal(calls[0].action,'adminSetSetting');assert.equal(calls[0].body.value,true);
  ctx.liveApi=async()=>{throw new Error('network failure');};
  await assert.rejects(ctx.setGate(false),/network failure/);
  assert.equal(ctx.MOCK.DB.settings.enforceGate,true);
});

test('dashboard warnings reflect the switch instead of claiming all task entries are locked',()=>{
  const page=fs.readFileSync(path.join(__dirname,'../app/pages/admin-dashboard.html'),'utf8');
  const code=page.slice(page.indexOf('function renderWarn('),page.indexOf('/* 4. 12 关通过率'));
  const mock=frontend();
  const nodes={warnNote:{},warnBody:{}};
  const ctx=vm.createContext({MOCK:mock,document:{getElementById:id=>nodes[id]}});
  vm.runInContext(code,ctx);
  ctx.renderWarn(mock.DB.trainees,{total:0,practice:0,exam:0});
  assert.ok(nodes.warnNote.innerHTML.includes('强制解锁已关闭'));
  assert.equal(nodes.warnBody.innerHTML.includes('锁死'),false);
  mock.DB.settings.enforceGate=true;
  ctx.renderWarn(mock.DB.trainees,{total:0,practice:0,exam:0});
  assert.ok(nodes.warnNote.innerHTML.includes('强制解锁已开启'));
  assert.ok(nodes.warnBody.innerHTML.includes('暂不能进入首个练习关卡'));
});
