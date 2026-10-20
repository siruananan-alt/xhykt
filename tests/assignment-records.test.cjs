const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function setup(){
 const tasks={S1:{L02:{EXAM:{status:'passed',note:'旧版考核',at:'2026-10-01T08:00:00Z',reviewedBy:'M1',reviewedByName:'导师甲',reviewedAt:'2026-10-02T08:00:00Z'}}},S2:{L05:{T1:{status:'submitted',latest:2,versions:[{v:1,note:'第一版',at:'2026-10-03T08:00:00Z',shots:[{key:'old.png'}]},{v:2,note:'第二版',at:'2026-10-04T08:00:00Z',shots:[{key:'new.png'}]}]},T2:{status:'rejected',note:'待修改',reviewNote:'请补充对比',at:'2026-10-03T09:00:00Z'}}}};
 const rows=[{id:'S1',name:'学员甲',mentorId:'M1'},{id:'S2',name:'学员乙',mentorId:'M1'}];
 const mock={DB:{tasks,levels:[{id:'L02',no:2,title:'考核关'},{id:'L05',no:5,title:'练习关'}],taskDefs:[{id:'T1',levelId:'L05',title:'最新任务名'}]},TASK_DEFS:[{id:'T1',title:'旧任务名'}],EXAM_TASK:'EXAM',userOf:id=>id==='M1'?{name:'导师甲'}:null};
 const ctx=vm.createContext({window:{},MOCK:mock,MOCKAPI:{S:{role:'admin'}}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../app/assets/assignment-records.js'),'utf8'),ctx);
 return {ctx,mock,rows,entries:()=>ctx.window.Assignments.entries(rows)};
}
test('all submitted, passed and rejected assignments are readable, including exams and legacy records',()=>{
 const s=setup(),list=s.entries();assert.equal(list.length,3);assert.equal(list.find(e=>e.exam).raw.reviewedByName,'导师甲');assert.equal(list.find(e=>e.status==='rejected').raw.reviewNote,'请补充对比');assert.equal(list[0].status,'submitted');
});
test('latest submission and historical screenshots are preserved without modifying stored data',()=>{
 const s=setup(),before=JSON.stringify(s.mock.DB.tasks),e=s.entries().find(e=>e.taskId==='T1');
 assert.equal(e.current.note,'第二版');assert.equal(e.current.shots[0].key,'new.png');assert.equal(e.versions[0].shots[0].key,'old.png');assert.equal(JSON.stringify(s.mock.DB.tasks),before);
});
test('refreshed task definitions take precedence, and removed task/level records remain readable',()=>{
 const s=setup();assert.equal(s.entries().find(e=>e.taskId==='T1').title,'最新任务名');
 s.mock.DB.tasks.S1.ARCHIVED={REMOVED:{status:'passed',note:'历史任务'}};const old=s.entries().find(e=>e.taskId==='REMOVED');assert.ok(old);assert.equal(old.level,undefined);assert.equal(old.title,'REMOVED');
});
test('unsubmitted tasks are excluded and learner scope is respected',()=>{
 const s=setup();s.mock.DB.tasks.S1.L02.DRAFT={status:'todo'};assert.equal(s.entries().length,3);assert.equal(s.ctx.window.Assignments.entries(s.rows.slice(0,1)).length,1);
 for(const role of ['student','mentor']){s.ctx.MOCKAPI.S.role=role;assert.equal(s.entries().length,0);}
});
test('a missing latest pointer falls back to the final existing version, with no fake review attribution',()=>{
 const s=setup(),raw=s.mock.DB.tasks.S2.L05.T1;raw.latest=99;const e=s.entries().find(e=>e.taskId==='T1');assert.equal(e.current.v,2);assert.equal(e.raw.reviewedBy,undefined);
});
