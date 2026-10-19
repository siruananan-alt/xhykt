// Runs the prepared function with synthetic accounts and in-memory storage only.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const filename=path.resolve(process.argv[2],'index.js');
const reads=[];let initializations=0;
const localRequire=createRequire(filename);
const fakeHttps={Agent:require('node:https').Agent,request(options,callback){
  const req=new EventEmitter();let body='';
  req.write=chunk=>{body+=chunk;};req.destroy=error=>{req.emit('error',error);req.emit('close');};
  req.end=()=>queueMicrotask(()=>{
    const key=options.path.slice(1).split('?')[0];
    const res=new EventEmitter();res.headers={};
    if(options.method==='GET'){
      reads.push(key);res.statusCode=key in ctx.fixtures?200:404;
    }else{
      assert.equal(options.method,'PUT');
      const copy=options.headers['x-cos-copy-source'];
      ctx.fixtures[key]=copy?structuredClone(ctx.fixtures[decodeURIComponent(copy.split('/').slice(1).join('/'))]):JSON.parse(body);
      res.statusCode=200;
    }
    callback(res);
    res.emit('data',Buffer.from(JSON.stringify(ctx.fixtures[key]||{})));res.emit('end');req.emit('close');
  });
  return req;
}};
const ctx=vm.createContext({require:name=>name==='https'?fakeHttps:localRequire(name),exports:{},Buffer,console,setTimeout,clearTimeout,
  process:{env:{ETRAIN_SECRET:'isolated-local-test-secret',ETRAIN_BUCKET:'local-fixture-bucket',TENCENTCLOUD_SECRETID:'local',TENCENTCLOUD_SECRETKEY:'local'}},
  initialize:async()=>{initializations++;},
});
vm.runInContext(fs.readFileSync(filename,'utf8')+`
  ensureCatalog=initialize;
  this.fixtures={'data/courses.json':COURSES,'data/levels.json':LEVELS,
    'data/mentors.json':MENTORS,'data/trainees.json':TRAINEES,
    'data/settings.json':{enforceGate:false},'data/users.json':{
      A:{wid:'A',role:'admin',name:'Local Admin',passwordHash:hashPw('local-password')},
      M1:{wid:'M1',role:'mentor',name:'Local Mentor',passwordHash:hashPw('local-password')},
      S001:{wid:'S001',role:'student',name:'Local Student',passwordHash:hashPw('local-password')}
    }};
  this.runtime=performanceRuntime;this.read=readJSON;this.write=writeJSON;
`,ctx);
(async()=>{
  const invoke=ctx.exports.main;
  const admin=await invoke({action:'login',wid:'A',password:'local-password'});
  assert.ok(admin.token);assert.equal(admin.user.passwordHash,undefined);
  reads.length=0;
  const full=await invoke({action:'data',token:admin.token,page:'admin-dashboard.html'});
  assert.equal(full.error,undefined);assert.equal(reads.length,18);assert.equal(new Set(reads).size,18);
  assert.equal(full.users.length,3);assert.equal(full.users[0].passwordHash,undefined);
  assert.equal(full.settings.enforceGate,false);assert.equal(initializations,1);
  assert.equal(full.diagnostics,undefined);
  reads.length=0;
  const scoped=await invoke({action:'data',token:admin.token,page:'admin-courses.html'});
  assert.equal(scoped.error,undefined);assert.equal(reads.length,9);assert.equal(initializations,1);
  assert.deepEqual(scoped.courses,full.courses);
  reads.length=0;
  await invoke({action:'adminUserList',token:admin.token});assert.deepEqual(reads,['data/users.json']);
  const student=await invoke({action:'login',wid:'S001',password:'local-password'});assert.ok(student.token);
  reads.length=0;
  const learner=await invoke({action:'data',token:student.token,page:'admin-courses.html'});
  assert.equal(learner.error,undefined);assert.equal(reads.length,18);assert.equal(learner.users,undefined);
  assert.ok(learner.trainees.every(t=>t.id==='S001'));
  ctx.fixtures['data/trainees.json']=[{id:'S001',mentorId:'M1'},{id:'OTHER',mentorId:'M2'}];
  ctx.fixtures['data/readiness.json']={S001:{traffic:{met:true,value:1000}},OTHER:{traffic:{met:true,value:5000}}};
  const mentor=await invoke({action:'login',wid:'M1',password:'local-password'});assert.ok(mentor.token);
  const mentorFull=await invoke({action:'data',token:mentor.token,page:'unknown.html'});
  for(const page of ['mentor.html','mentor-coach.html','mentor-mentee.html','mentor-courses.html']){
    reads.length=0;const scopedMentor=await invoke({action:'data',token:mentor.token,page});
    assert.equal(scopedMentor.error,undefined);assert.equal(reads.length,10);assert.equal(scopedMentor.users,undefined);
    assert.equal(scopedMentor.trainees.length,1);assert.equal(scopedMentor.trainees[0].id,'S001');
    assert.equal(scopedMentor.readiness.OTHER,undefined);
    for(const field of ['user','courses','mentors','trainees','levels','journey','learn','settings','tasks','readiness','courseGate'])assert.deepEqual(scopedMentor[field],mentorFull[field],page+': '+field);
  }
  if(process.argv.includes('--internal-timing')){
    reads.length=0;
    const instrumented=await invoke({action:'data',token:mentor.token,page:'mentor.html',perf:true});
    assert.equal(instrumented.diagnostics.readCount,10);
    assert.equal(instrumented.diagnostics.initializationStarted,false);
    assert.ok(instrumented.diagnostics.handlerMs>=instrumented.diagnostics.loadMs);
    assert.ok(instrumented.diagnostics.slowestReads.every(r=>/^[a-z]+$/.test(r.table)));
    assert.deepEqual(instrumented.tasks,mentorFull.tasks);assert.deepEqual(instrumented.readiness,mentorFull.readiness);
  }
  ctx.fixtures['data/settings.json'].enforceGate=true;
  const latest=await invoke({action:'data',token:student.token});
  assert.equal(latest.settings.enforceGate,true);assert.equal(initializations,1);
  await ctx.runtime.run(async()=>{
    assert.equal((await ctx.read('data/settings.json',{})).enforceGate,true);
    await ctx.write('data/settings.json',{enforceGate:false});
    assert.equal((await ctx.read('data/settings.json',{})).enforceGate,false);
  });
  console.log('Prepared function integration passed: full=18 reads, course management=9, mentor pages=10, users=1; latest settings and role isolation preserved.');
})().catch(e=>{console.error(e);process.exitCode=1;});
