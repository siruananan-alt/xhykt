// Bundle the canonical pure rules into the existing entry point so cached HTML
// does not need to know about a newly introduced script dependency.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../app/assets');
const begin='/* GENERATED_READINESS_RULES_START */',end='/* GENERATED_READINESS_RULES_END */';
const file=path.join(root,'app.js'),rules=fs.readFileSync(path.join(root,'readiness-rules.js'),'utf8').trim();
let app=fs.readFileSync(file,'utf8');
if(app.startsWith(begin))app=app.slice(app.indexOf(end)+end.length).replace(/^\s*\r?\n/,'');
fs.writeFileSync(file,begin+'\n'+rules+'\n'+end+'\n'+app);
console.log('Canonical readiness rules bundled in app.js.');
