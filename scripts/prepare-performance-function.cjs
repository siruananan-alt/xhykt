const fs=require('node:fs'),path=require('node:path');
const [sourceDir,destDir]=process.argv.slice(2);
if(!sourceDir||!destDir)throw new Error('Usage: node scripts/prepare-performance-function.cjs <backup> <staging>');
const source=path.resolve(sourceDir),dest=path.resolve(destDir);
if(source===dest)throw new Error('Keep backup separate');
fs.mkdirSync(dest,{recursive:true});
for(const name of ['index.js','server.js','package.json','scf_bootstrap','practice-video.js','gate-policy.js'])fs.copyFileSync(path.join(source,name),path.join(dest,name));
let code=fs.readFileSync(path.join(dest,'index.js'),'utf8');
function one(from,to){if(code.split(from).length!==2)throw new Error('Unexpected upstream near '+from.slice(0,90));code=code.replace(from,to);}
one('const https = require("https");',`const https = require("https");
const performanceRuntime = require('./performance-runtime.js')();
const storageResponse = require('./storage-response.js');
const dataView = require('./data-view.js');
const COS_AGENT = new https.Agent({keepAlive:true,maxSockets:24,maxFreeSockets:8});`);
one('const options = { method: method.toUpperCase(), hostname: endpoint, path: uri, headers };','const options = { method: method.toUpperCase(), hostname: endpoint, path: uri, headers, agent: COS_AGENT };');
one('res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));',`res.on('error', reject);
      res.on("end", () => {
        if(res.statusCode>=200 && res.statusCode<300 && /^(PUT|DELETE)$/i.test(method))performanceRuntime.invalidate(key);
        resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) });
      });`);
one('    if (buf) req.write(buf);',`    storageResponse.armDeadline(req,method);
    if (buf) req.write(buf);`);
const read=/async function readJSON\(cloudPath, def\) \{[\s\S]*?\r?\n\}/g;
if([...code.matchAll(read)].length!==1)throw new Error('Unexpected readJSON');
code=code.replace(read,`async function readJSON(cloudPath, def) {
  const result=await performanceRuntime.read(cloudPath,async()=>storageResponse.decodeJSON(await cosRequest('GET',cloudPath)));
  return result.missing?def:result.value;
}`);
one('async function loadAll() {',`async function loadAll(requestedKeys) {
  const wants = name=>!requestedKeys || requestedKeys.includes(name);`);
// Only the snapshot reader gets selective loading; mutations retain full reads.
const begin=code.indexOf('async function loadAll(requestedKeys)'),end=code.indexOf('/* ---------- 各动作 ---------- */',begin);
let loader=code.slice(begin,end),count=0;
loader=loader.replace(/readJSON\(PREFIX \+ "([a-z]+)\.json", ([^\r\n]+?)\)(,?)(\r?\n)/g,(all,name,fallback,comma,newline)=>{
  count++;
  const empty=['courses','plans','mentors','trainees','levels'].includes(name)?'[]':'{}';
  return `(wants('${name}')?readJSON(PREFIX + "${name}.json", ${fallback}):Promise.resolve(${empty}))${comma}${newline}`;
});
if(count!==18)throw new Error('Expected 18 snapshot tables, found '+count);
code=code.slice(0,begin)+loader+code.slice(end);
one('async function actionData(me) {\n  await ensureCatalog();\n  const all = await loadAll();'.replaceAll('\n',code.includes('\r\n')?'\r\n':'\n'),`async function actionData(me,d={}) {
  await performanceRuntime.once('catalog',ensureCatalog);
  const all = await loadAll(me.role==='admin'?dataView.keysFor(d.page):null);`);
one('if (act === "data") return await actionData(me);','if (act === "data") return await actionData(me,data);');
one('return { role: me.role, user: profile, courses: coursesOut,','return { role: me.role, user: profile, users: dataView.publicUsers(me.role,all.users), courses: coursesOut,');
one('  const all = await loadAll();\n  const list = Object.keys(all.users).map(k => stripPw(all.users[k]));'.replaceAll('\n',code.includes('\r\n')?'\r\n':'\n'),`  const users = await readJSON(PREFIX+'users.json',{});
  const list = Object.keys(users).map(k => stripPw(users[k]));`);
one('const result = await handle(data || {});','const result = await performanceRuntime.run(()=>handle(data || {}));');
const tag=/if \(act === "buildTag"\) return \{ tag: "([^"]+)" \};/g;
if([...code.matchAll(tag)].length!==1)throw new Error('Unexpected build tag');
code=code.replace(tag,'if (act === "buildTag") return { tag: "b20261019-performance-v1" };');
fs.writeFileSync(path.join(dest,'index.js'),code);
for(const name of ['performance-runtime.js','storage-response.js','data-view.js'])fs.copyFileSync(path.resolve(__dirname,'../functions/etrain-api',name),path.join(dest,name));
console.log('Prepared performance improvements; existing runtime settings and access controls preserved.');
