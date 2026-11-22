const fs = require('node:fs');
const path = require('node:path');
const [source, destination] = process.argv.slice(2);
if (!source || !destination || fs.existsSync(destination)) {
  throw new Error('Usage: node prepare-winter-video.cjs <cloud backup> <new staging directory>');
}
const modules = path.resolve(__dirname, '../functions/etrain-api');
const practicePath = path.join(modules, 'practice-video.js');
const patchPractice = fs.readFileSync(practicePath, 'utf8').replace(/\r\n/g, '\n');
const baseline = patchPractice
  .replace(/  const objectDirectory = .*\n  const loadForLevel = .*\n/, '')
  .replaceAll("'^'+objectDirectory+d.levelId", "'^assets/practice-videos/'+d.levelId")
  .replaceAll('await loadForLevel(d.levelId)', 'await loadAll()')
  .replaceAll('await loadForLevel(lv.id)', 'await loadAll()')
  .replaceAll("writeJSON(PREFIX+'settings.json',st,lv.id)", "writeJSON(PREFIX+'settings.json',st)")
  .replace("const key=objectDirectory+lv.id", "const key='assets/practice-videos/'+lv.id")
  .replace(/^      if\(deps\.objectDirectory && .*\n/m, '');
const existing = fs.readFileSync(path.join(source, 'practice-video.js'), 'utf8').replace(/\r\n/g, '\n');
if (existing !== baseline) throw new Error('Practice video source differs from the expected baseline');

let code = fs.readFileSync(path.join(source, 'index.js'), 'utf8');
const anchor = '  const act = data.action;';
if (code.split(anchor).length !== 2 || !/if \(act === "buildTag"\) return \{ tag: "[^"]+" \};/.test(code)) {
  throw new Error('Cloud function anchors missing');
}
const routes = [
  "  if (act === 'winterVideoList') return winterVideos.list();",
  '  if (winterVideos.supports(act)) return winterVideos.handle(act, verifyToken(data.token), data);',
].join('\n');
code = code.replace(anchor, anchor + '\n' + routes)
  .replace('async function handle(data) {', "const winterVideos = require('./winter-video.js')({readJSON,writeJSON,PREFIX,getStaticBucket,getVerifiedCreds,cosRequest,presign,presignTokenHeader,videoUrl,REGION});\nasync function handle(data) {")
  .replace(/if \(act === "buildTag"\) return \{ tag: "[^"]+" \};/, 'if (act === "buildTag") return { tag: "b-winter-video-1" };');
fs.cpSync(source, destination, {recursive: true});
fs.writeFileSync(path.join(destination, 'index.js'), code);
fs.copyFileSync(practicePath, path.join(destination, 'practice-video.js'));
fs.copyFileSync(path.join(modules, 'winter-video.js'), path.join(destination, 'winter-video.js'));
