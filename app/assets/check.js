/* check.js — 静态校验（开发期用，不进生产运行时）
 * 职责：
 *   1) 全量扫描 proto 源码，确认没有残留的 emoji / 符号字形（兜底「emoji→SVG」任务）。
 *   2) 收集 app.js 的 ICONS 表，校验所有 <use href="#i-xxx"/> / data-ic / ic('i-xxx')
 *      引用的图标都真实存在，避免「替换成 SVG 但 symbol 没定义」的空白图标。
 * 用法：node check.js   （在 proto/assets/ 下运行，或任意位置均可，路径自适应）
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');          // proto/
const ASSETS = path.join(ROOT, 'assets');

// —— 1. 残留字形扫描（用 \u 转义，源码本身保持无 emoji）——
const GLYPH_RE = /[\u{1F389}\u{1F465}\u{1F4C4}\u{1F4CB}\u{1F4DD}\u{1F4ED}\u{1F512}\u{1F534}\u{1F914}\u{1F91D}\u{26A0}\u{2605}\u{2606}\u{25B6}\u{25B8}\u{25BE}\u{2713}\u{2717}\u{2190}\u{2192}\u{2194}\u{21D0}\u{2460}-\u{246B}]/gu;

// —— 2. ICONS 表收集 ——
function collectIcons(){
  const appJs = fs.readFileSync(path.join(ASSETS, 'app.js'), 'utf8');
  const ids = new Set();
  const re = /'(i-[a-z0-9-]+)'\s*:/g;      // 'i-xxx':
  let m;
  while((m = re.exec(appJs))) ids.add(m[1]);
  // 带圈数字徽标 i-num1..i-num12 由循环生成，补进来
  for(let n=1;n<=12;n++) ids.add('i-num'+n);
  return ids;
}

// 提取文件中所有图标引用：use href="#i-x" / data-ic="i-x" / data-ic2="i-x" / ic('i-x')
function collectRefs(txt){
  const refs = new Set();
  let m;
  const reUse = /use\s+href="#(i-[a-z0-9-]+)"/g;
  while((m = reUse.exec(txt))) refs.add(m[1]);
  const reData = /data-ic2?="(i-[a-z0-9-]+)"/g;
  while((m = reData.exec(txt))) refs.add(m[1]);
  const reIc = /ic\(\s*'(i-[a-z0-9-]+)'/g;
  while((m = reIc.exec(txt))) refs.add(m[1]);
  return refs;
}

function walk(dir, acc){
  for(const f of fs.readdirSync(dir)){
    const p = path.join(dir, f);
    const s = fs.statSync(p);
    if(s.isDirectory()) walk(p, acc);
    else if(/\.(js|html|css)$/.test(f)) acc.push(p);
  }
  return acc;
}

const files = walk(ROOT, []);
const icons = collectIcons();

let glyphHits = 0;
const missing = new Map();   // iconId -> [files]

for(const fp of files){
  // 跳过自身：它的报告行里含 ✓/✗（落在 GLYPH_RE 范围内），自扫描会误报
  if(path.basename(fp) === 'check.js') continue;
  const txt = fs.readFileSync(fp, 'utf8');
  const rel = path.relative(ROOT, fp).replace(/\\/g, '/');
  // 字形残留
  const gh = txt.match(GLYPH_RE);
  if(gh){
    glyphHits += gh.length;
    console.log(`  字形残留 ${rel}: ${gh.length} 处  ${gh.slice(0,8).join(' ')}`);
  }
  // 图标引用缺失
  for(const id of collectRefs(txt)){
    if(!icons.has(id)){
      if(!missing.has(id)) missing.set(id, []);
      missing.get(id).push(rel);
    }
  }
}

console.log('\n=== check.js 报告 ===');
console.log(`扫描文件：${files.length}`);
console.log(`ICONS 定义：${icons.size} 个`);
console.log(`残留字形：${glyphHits} 处 ${glyphHits===0?'✓ 无':'✗ 有'}`);
if(missing.size){
  console.log('缺失图标引用（引用了但未在 ICONS 定义）：');
  for(const [id, fs2] of missing) console.log(`  #${id}  <-  ${[...new Set(fs2)].join(', ')}`);
}else{
  console.log('图标引用完整性：✓ 全部命中');
}
process.exit(glyphHits===0 && missing.size===0 ? 0 : 1);
