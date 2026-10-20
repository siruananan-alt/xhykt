const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const page=fs.readFileSync(path.join(__dirname,'../app/pages/student-me.html'),'utf8');
const code=page.slice(page.indexOf('function renderMentor(wid)'),page.indexOf('/* 5. 时间线'));
function render(mentorId,extra={}){
 const users={M1:{wid:'M1',name:'自己的老师',role:'mentor'},M2:{wid:'M2',name:'其他老师',role:'mentor'},A1:{wid:'A1',name:'教务一',role:'admin'},A2:{wid:'A2',name:'教务二',role:'admin'},S2:{wid:'S2',name:'其他学员',role:'student'},...extra};
 const box={};
 const ctx=vm.createContext({MOCK:{DB:{users},traineeOf:()=>({id:'S1',mentorId}),userOf:id=>users[id]},document:{getElementById:()=>box},esc:value=>String(value??'')});
 vm.runInContext(code,ctx);ctx.renderMentor('S1');return box.innerHTML;
}
test('student sees assigned mentor and all administrators, with the real mentor ID',()=>{
 const html=render('M1');
 assert.match(html,/自己的老师（M1）/);assert.match(html,/教务一/);assert.match(html,/教务二/);
 assert.doesNotMatch(html,/其他老师|其他学员|跨区带教/);
});
test('reassignment replaces the previous mentor immediately',()=>{
 const html=render('M2');assert.match(html,/其他老师（M2）/);assert.doesNotMatch(html,/自己的老师/);
});
test('missing, deleted or invalid mentor assignments keep administrators without exposing other mentors',()=>{
 for(const id of [undefined,'DELETED','A1','S2']){
  const html=render(id);assert.match(html,/尚未分配有效的带教老师/);assert.match(html,/教务一/);
  assert.doesNotMatch(html,/自己的老师|其他老师|跨区带教|· 带教导师/);
 }
});
