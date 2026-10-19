const fs=require('node:fs'),path=require('node:path');
const [src,dst]=process.argv.slice(2);
if(!src||!dst)throw Error('Usage: node prepare-internal-timing-function.cjs <latest-backup> <staging>');
const source=path.resolve(src),dest=path.resolve(dst);
if(source===dest)throw Error('Keep backup separate');
fs.cpSync(source,dest,{recursive:true});
const file=path.join(dest,'index.js');let code=fs.readFileSync(file,'utf8');
function one(from,to){if(code.split(from).length!==2)throw Error('Unexpected upstream near '+from);code=code.replace(from,to);}
one("await performanceRuntime.once('catalog',ensureCatalog);","await performanceRuntime.phase('catalog',()=>performanceRuntime.once('catalog',ensureCatalog));");
const oldScope="const all = await loadAll(me.role==='admin'?dataView.keysFor(d.page):null);";
const scope=code.includes(oldScope)?oldScope:'const all = await loadAll(dataView.keysFor(d.page,me.role));';
one(scope,"const all = await performanceRuntime.phase('snapshot',()=>loadAll(dataView.keysFor(d.page,me.role)));");
one('tasks, taskDefs: TASK_DEFS };','tasks, taskDefs: TASK_DEFS, diagnostics: d.perf===true?performanceRuntime.snapshot():undefined };');
one('performanceRuntime.run(()=>handle(data || {}))',"performanceRuntime.run(()=>handle(data || {}),data && data.action==='data' && data.perf===true)");
code=code.replace(/if \(act === "buildTag"\) return \{ tag: "[^"]+" \};/,'if (act === "buildTag") return { tag: "b20261019-internal-timing-v1" };');
fs.writeFileSync(file,code);
fs.copyFileSync(path.resolve(__dirname,'../functions/etrain-api/performance-runtime.js'),path.join(dest,'performance-runtime.js'));
fs.copyFileSync(path.resolve(__dirname,'../functions/etrain-api/data-view.js'),path.join(dest,'data-view.js'));
console.log('Prepared opt-in internal timing; default responses and permission logic preserved.');
