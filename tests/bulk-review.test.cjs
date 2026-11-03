const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('app/assets/ui.js','utf8');
const code=source.slice(source.indexOf('async function runBulkPass(){'),source.indexOf('/* 1. 代录闯关结果',source.indexOf('async function runBulkPass(){')));
function setup(api){const messages=[];const c={window:{__bulkSel:[{}]},MOCKAPI:{mockBulkPass:api},closeModal(){},toast:(s,k)=>messages.push([s,k])};vm.createContext(c);vm.runInContext(code,c);return {c,messages};}
test('waits for async review and blocks repeat clicks',async()=>{let resolve,calls=0;const {c,messages}=setup(()=>{calls++;return new Promise(r=>resolve=r)});const p=c.runBulkPass();await c.runBulkPass();assert.equal(calls,1);assert.equal(messages.length,1);resolve({ok:1,skip:[]});await p;assert.equal(messages.at(-1)[1],'ok');assert.equal(c.window.__bulkRunning,false);});
test('partial failure is visible',async()=>{const {c,messages}=setup(async()=>({ok:1,skip:[{why:'state changed'}]}));await c.runBulkPass();assert.match(messages.at(-1)[0],/未通过 1 条/);});
test('network failures and malformed responses release the lock',async()=>{for(const api of [async()=>{throw Error('network')},async()=>undefined]){const {c,messages}=setup(api);await c.runBulkPass();assert.equal(messages.at(-1)[1],'err');assert.equal(c.window.__bulkRunning,false);}});
test('synchronous sandbox responses still work; empty selection sends nothing',async()=>{let calls=0;const {c,messages}=setup(()=>{calls++;return {ok:1,skip:[]}});await c.runBulkPass();await c.runBulkPass();assert.equal(calls,1);assert.equal(messages.at(-1)[1],'ok');});

test('confirmation catches async failures and ignores double clicks',async()=>{
 const s=fs.readFileSync('app/assets/app.js','utf8');const code=s.slice(s.indexOf('function confirmBox('),s.indexOf('/* ---------- 4.',s.indexOf('function confirmBox(')));
 let calls=0;const button={disabled:false},messages=[];const c={document:{getElementById:()=>button},openModal(){},closeModal(){},console:{error(){}},toast:x=>messages.push(x)};vm.createContext(c);vm.runInContext(code,c);
 c.confirmBox('test','','Promise.reject(new Error("offline"))');await button.onclick();assert.match(messages[0],/offline/);
 button.disabled=false;c.confirmBox('test','',async()=>{calls++;throw Error('failure')});await Promise.all([button.onclick(),button.onclick()]);assert.equal(calls,1);assert.match(messages.at(-1),/failure/);
});
