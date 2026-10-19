(function(root,factory){
  const rules=factory();
  if(typeof module==='object'&&module.exports) module.exports=rules;
  else root.ReadinessRules=rules;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const definitions={
    traffic:{threshold:800,compare:'gte',unit:'人',rule:'每月引流 ≥ 800 人',integer:true},
    editing:{threshold:1.5,compare:'lt',unit:'小时',rule:'长视频剪辑耗时 < 1.5 小时',integer:false},
    accounts:{threshold:4,compare:'gte',unit:'个',rule:'运营账号数 ≥ 4 个',integer:true}
  };
  function evaluate(key,raw){
    const rule=definitions[key];
    if(!rule)return {valid:false,met:false,error:'不支持手工登记此达标线'};
    if(raw===null||raw===undefined||(typeof raw==='string'&&raw.trim()===''))
      return {valid:false,met:false,error:'请填写实际数值'};
    if(!['string','number'].includes(typeof raw))return {valid:false,met:false,error:'请填写有效数字'};
    const value=Number(raw);
    if(!Number.isFinite(value)||value<0)return {valid:false,met:false,error:'数值必须为非负有限数字'};
    if(rule.integer&&!Number.isSafeInteger(value))return {valid:false,met:false,error:'人数和账号数必须为非负整数'};
    if(key==='editing'&&value===0)return {valid:false,met:false,error:'剪辑耗时必须大于 0 小时'};
    const met=rule.compare==='lt'?value<rule.threshold:value>=rule.threshold;
    const gap=met?'已达到标准':key==='editing'?'需少于 1.5 小时；1.5 小时不达标':`还差 ${rule.threshold-value} ${rule.unit}`;
    return {valid:true,value,met,gap,...rule};
  }
  return {definitions,evaluate};
});
