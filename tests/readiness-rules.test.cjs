const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const rules=require('../app/assets/readiness-rules');
test('inclusive counts and strictly less-than editing share the exact same browser/server implementation',()=>{
  const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../app/assets/readiness-rules.js'),'utf8'),ctx);
  for(const [key,value,expected] of [['traffic',0,false],['traffic',799,false],['traffic',800,true],['traffic',801,true],['accounts',0,false],['accounts',3,false],['accounts',4,true],['accounts',5,true],['editing',1.49,true],['editing',1.5,false],['editing',1.51,false]]){
    const r=rules.evaluate(key,value);assert.equal(r.valid,true);assert.equal(r.met,expected);
    assert.equal(ctx.ReadinessRules.evaluate(key,value).met,expected);
  }
});
test('empty, negative, infinite, fractional counts, zero editing and non-numeric types cannot be registered',()=>{
  for(const key of ['traffic','editing','accounts'])for(const value of ['',null,undefined,'  ',-1,NaN,Infinity,'abc',true,[],{}])assert.equal(rules.evaluate(key,value).valid,false,`${key}:${String(value)}`);
  assert.equal(rules.evaluate('traffic',799.5).valid,false);
  assert.equal(rules.evaluate('accounts',3.5).valid,false);
  assert.equal(rules.evaluate('editing',0).valid,false);
  assert.equal(rules.evaluate('study',12).valid,false);
});
