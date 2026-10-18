// Apply the isolated practice-video service to a freshly downloaded deployment.
const fs=require('node:fs');
const path=require('node:path');
const [sourceDir,destDir]=process.argv.slice(2);
if(!sourceDir||!destDir)throw new Error('Usage: node scripts/prepare-practice-function.cjs <downloaded-source> <staging-dir>');
const source=path.resolve(sourceDir),dest=path.resolve(destDir);
if(source===dest)throw new Error('Keep the downloaded backup separate');
fs.mkdirSync(dest,{recursive:true});
for(const name of ['index.js','server.js','package.json','scf_bootstrap'])fs.copyFileSync(path.join(source,name),path.join(dest,name));
let code=fs.readFileSync(path.join(dest,'index.js'),'utf8');
function replaceOne(from,to){if(code.split(from).length!==2)throw new Error('Unexpected upstream source near '+from.slice(0,80));code=code.replace(from,to);}
replaceOne('async function handle(data) {',`const practiceVideos = require('./practice-video.js')({loadAll,writeJSON,PREFIX,getStaticBucket,getVerifiedCreds,cosRequest,presign,presignTokenHeader,videoUrl,REGION});
async function handle(data) {`);
replaceOne('  const act = data.action;',`  const act = data.action;
  if (['practiceVideoInit','practiceVideoSign','practiceVideoComplete','practiceVideoAbort','practiceVideoRemove'].includes(act)) {
    const me = verifyToken(data.token);
    if (!me) return { error: '登录已失效，请重新登录' };
    return await practiceVideos.handle(act, me, data);
  }`);
replaceOne('settings: { enforceGate: enforce, taskShots }','settings: { enforceGate: enforce, taskShots, practiceVideos: practiceVideos.visible(all,me,(state,w,lv)=>!gateEnforced(state)||levelUnlockedFor(state,w,lv)) }');
const tags=[...code.matchAll(/if \(act === "buildTag"\) return \{ tag: "([^"]+)" \};/g)];
if(tags.length!==1)throw new Error('Unexpected build tag');
code=code.replace(tags[0][0],'if (act === "buildTag") return { tag: "b20261018-practice-video-v1" };');
fs.writeFileSync(path.join(dest,'index.js'),code);
fs.copyFileSync(path.resolve(__dirname,'../functions/etrain-api/practice-video.js'),path.join(dest,'practice-video.js'));
console.log('Prepared function code; previous runtime configuration and environment variables must be preserved.');
