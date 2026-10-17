const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname,'../app/assets/mock-api-live.js'),'utf8');

function harness(values){
  const context=vm.createContext({document:{querySelector:sel=>Object.hasOwn(values,sel)?{value:values[sel]}:null},
    liveWrite:(_action,builder)=>builder});
  const helpers=source.slice(source.indexOf('function rawVal('),source.indexOf('/* ---------- 统一重绘入口'));
  const creation=source.match(/mockAddUser:\s*(liveWrite\('adminUserUpsert',[\s\S]*?\}\)\))/)[1];
  vm.runInContext(helpers+'\nthis.createAccount='+creation,context);
  return context;
}

test('account creation sends exactly the password entered, including whitespace and Unicode',()=>{
  for(const password of [' abc123 ', '\tabc123\t', '中文密码123', 'abc 123']){
    const context=harness({'#uPw':password,'#uWid':' M7 ','#uName':' 导师 ','#uRole':'mentor'});
    const payload=context.createAccount();
    assert.equal(payload.password,password);
    assert.equal(payload.wid,'M7');
    assert.equal(payload.name,'导师');
  }
});

test('missing password remains empty; reset-password builder preserves the original value',()=>{
  const context=harness({});
  assert.equal(context.createAccount().password,'');
  const reset=source.match(/mockResetPw:\s*(liveWrite\('adminResetPw',[^\n]*?\}\)\))/)[1];
  vm.runInContext('this.resetPassword='+reset,context);
  assert.equal(context.resetPassword('M7',' abc123 ').password,' abc123 ');
});
