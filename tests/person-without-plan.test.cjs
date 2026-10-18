const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'../app/assets',name),'utf8');

test('student account creation and editing work without a plan field or catalog',()=>{
  const values={uRole:'student',uWid:'S9009',uName:'测试学员',uDept:'武汉',uPw:'abcdef',uMentor:'M1',uTitle:''};
  const errors=[];
  const context=vm.createContext({window:{},document:{getElementById:id=>{
    assert.ok(Object.hasOwn(values,id),'unexpected form field '+id);
    return {value:values[id]};
  }},toast:(message,type)=>{if(type==='err')errors.push(message);},closeModal(){},UI:{refreshTodoDot(){}}});
  vm.runInContext(read('mock-data.js'),context);
  context.MOCK=context.window.MOCK;
  vm.runInContext(read('mock-api.js'),context);
  context.window.MOCKAPI.mockAddUser();
  assert.deepEqual(errors,[]);
  assert.equal(context.MOCK.userOf('S9009').mentorId,'M1');
  assert.equal(context.MOCK.traineeOf('S9009').name,'测试学员');
  assert.equal(context.MOCK.DB.plans,undefined);
  context.window.MOCKAPI.mockEditStudent('S9009',{name:'更新学员',dept:'武汉',mentorId:'M2'});
  assert.equal(context.MOCK.traineeOf('S9009').mentorId,'M2');
  assert.equal(context.MOCK.userOf('S9009').name,'更新学员');
});
