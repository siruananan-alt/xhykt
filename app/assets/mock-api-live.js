/* ============================================================
   mock-api-live.js · 真实后端接线层（Layer L）
   ------------------------------------------------------------
   定位：**增量层**，在 mock-api.js 之后加载。它不改 mock-api.js 一行。

   注意：【2026-10-04 阶段四·生产化改造】**默认已切换为「接真实后端」**。
      原因：本目录即将部署为生产前端，「默认沙盒」等于部署了也没接后端
      （任何人任何密码都能进 + 看 mock 假数据）。故把默认值反转。

   开关（任一，优先级从高到低）：
     1. URL ?sandbox=1            -> 本次**退回沙盒**（内存演示，供离线演示/验收脚本）
     2. URL ?live=1               -> 本次强制接真实（显式确认，等价默认）
     3. localStorage.etrainLive   -> '1' 真实 / '0' 沙盒（长期偏好，覆盖默认）
     4. window.ETRAIN_LIVE        -> true 真实 / false 沙盒（代码里显式指定）
     5. 以上都无                  -> **默认 = 真实后端**（生产行为）

   注意： 验收脚本注意：10 个依赖沙盒（`protoRole` 直切视角）的脚本**必须带 `?sandbox=1`**，
      否则会走真实登录、拿不到 mock 会话。已在各脚本 BASE 里改好。

   做什么：
     A. 会话层：login(工号,密码) -> 存 token -> data -> 覆写 MOCK.DB（真实数据）
     B. 写路径：把 MOCKAPI 上的 mockXxx 换成真实 api(action) 调用（签名不变）
   不做什么：
     · 不动页面代码（html / ui.js / app.js 一行不改）
     · 不动 mock-api.js（保留为演示/离线回退）
     · 不删任何业务规则（判定仍走 mock-data.js 的纯函数，与后端同源）

   注意： 真实数据红线：接线后的验证一律自建临时账号，绝不碰线上真实账号。
   注意： 阈值/撤销认证/转移徒弟 三个缺口按用户 2026-10-04 决策处理：
       1. 撤销认证 = 前端去掉按钮（本层不提供实现）
       2. 改阈值   = 前端去掉入口（本层不提供实现）
       3. 转移徒弟 = 真实调 adminTransferTrainee（平台 bug 未解，UI 标注暂不可用）
   ============================================================ */

/* ---------- 配置 ---------- */
const LIVE = {
  enabled: false,
  /* api 地址解析（2026-10-05 轻量服务器托管改造）：
     1) window.ETRAIN_API 显式指定，优先级最高
     2) URL ?api= 显式指定
     3) CloudBase 托管域（*.tcloudbaseapp.com / *.tcloudbase.com）、本机调试
        （localhost / 127.0.0.1，验收脚本依赖）、file:// 协议：跨域直连云函数（原行为不变）
     4) 其余 http/https 来源（轻量服务器 IP、未来自有域名）：同源 /etrain，
        由该源的反向代理转发到云函数。原因：CloudBase 云接入的 CORS 按来源放行
        （2026-10-05 实测：IP origin 预检被拒；tcloudbaseapp 域与 localhost 正常放行），
        同源请求不走 CORS，一劳永逸。代理配置在轻量服务器 /etc/caddy/Caddyfile。 */
  apiUrl: (function(){
    if(window.ETRAIN_API) return window.ETRAIN_API;
    const q = new URLSearchParams(location.search).get('api');
    if(q) return q;
    const h = location.hostname;
    const tcb = /(^|\.)tcloudbase(app)?\.com$/.test(h);
    const local = (h === 'localhost' || h === '127.0.0.1');
    const http = (location.protocol === 'http:' || location.protocol === 'https:');
    /* 2026-10-06 GitHub Pages / 自有域：函数端已自行应答 CORS（etrain-api corsHeaders），
       走跨域直连云函数。同源 /etrain 反代只存在于轻量服务器，这两类来源没有。 */
    const external = /(^|\.)github\.io$/.test(h) || /(^|\.)xhykt\.work$/.test(h);
    return (http && !tcb && !local && !external)
      ? '/etrain'
      : 'https://micheal-enviorment1-d0bh1b0787c0.service.tcloudbase.com/etrain';
  })(),
  token: null,
  user: null,
  lastError: null
};
(function initLiveFlag(){
  const qs = new URLSearchParams(location.search);
  const q = qs.get('live'), sandbox = qs.get('sandbox');
  /* URL 显式声明优先，其次是 localStorage 长期偏好，最后**回落真实**。 */
  if(sandbox === '1'){ try{ localStorage.setItem('etrainLive','0'); }catch(e){} }
  if(q === '0'){ try{ localStorage.setItem('etrainLive','0'); }catch(e){} }
  if(q === '1'){ try{ localStorage.setItem('etrainLive','1'); }catch(e){} }
  let local = null;
  try{ local = localStorage.getItem('etrainLive'); }catch(e){}
  if(q === '1' || sandbox === '1'){                    // URL 显式 -> 直接定
    LIVE.enabled = (q === '1');
  }else if(window.ETRAIN_LIVE === true || window.ETRAIN_LIVE === false){
    LIVE.enabled = window.ETRAIN_LIVE === true;        // 代码显式指定
  }else if(local === '1' || local === '0'){
    LIVE.enabled = local === '1';                      // 长期偏好
  }else{
    LIVE.enabled = true;                               // 注意： 默认：真实后端
  }
})();

/* ---------- A. 会话层 ---------- */
/* 极薄 fetch 封装：与生产 platform-app-cloud.html 的 api() 同形。
   返回后端原始 JSON（不吞错），失败抛 Error 让调用方 try/catch。 */
/* 【2026-10-05 上线前加固】需要 confirm:true 的不可逆动作清单。
   必须与后端 needConfirm 的接入点保持一致（后端加新删除类动作时这里也要加）。 */
const DELETE_ACTIONS = {
  adminUserDelete:1, adminCourseDelete:1, adminChapterDelete:1, adminTaskRevoke:1
};
async function liveApi(action, extra){
  const body = Object.assign({ action }, extra || {});
  if(LIVE.token && body.token === undefined) body.token = LIVE.token;
  /* 【2026-10-05 上线前加固】不可逆操作（删用户/删课程/删章节/撤销任务）服务端要求
     confirm:true 才放行。前端侧的真实来源是 confirmBox 二次确认弹窗 —— 用户点「确认删除」
     才会走到这里，所以在这里统一补 confirm:true，等价于"人已确认"。
     注意：不要在这里无条件给所有 action 加：只给这 4 个删除类动作加，
        否则等于把服务端门禁架空（门禁的意义是挡脚本/直调，不挡人）。 */
  if(DELETE_ACTIONS[action] && body.confirm === undefined) body.confirm = true;
  let r;
  try{
    r = await fetch(LIVE.apiUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
  }catch(e){
    const err = new Error('连不上后端（' + LIVE.apiUrl + '）：' + (e.message || e));
    LIVE.lastError = err.message; throw err;
  }
  let j;
  try{ j = await r.json(); }catch(e){ throw new Error('后端返回的不是 JSON（HTTP ' + r.status + '）'); }
  if(j && j.error){ const err = new Error(j.error); LIVE.lastError = j.error; throw err; }
  return j;
}

/* 真实登录：写 token + user；随后必须再调 liveRefresh() 拉全量数据 */
async function liveLogin(wid, password){
  const j = await liveApi('login', { wid, password, token: null });
  LIVE.token = j.token; LIVE.user = j.user;
  try{ sessionStorage.setItem('etrainToken', j.token); }catch(e){}
  persistIdentity(j.user);                      // <- 持久化真实身份（跳页后仍能渲染身份牌）
  return j.user;
}

/* 【2026-10-04 · 方案 A 修复】把真实登录身份写进 sessionStorage。
   注意： 为什么必须持久化：MOCKAPI.S 是**内存变量**，页面一跳就回到 mock 默认值（admin/范文淼）。
   而顶栏身份牌由 initTopbar() 渲染，早于 liveRefresh() 的异步完成 ->
   若不落地持久化，**每个学员都会看到「朱子悦」、每个导师都看到「郑丽薪」**（实测线上踩到）。
   键名用 etrainWho（独立于 protoRole，后者只存角色、前者存完整身份）。 */
function persistIdentity(u){
  if(!u || !u.wid) return;
  try{ sessionStorage.setItem('etrainWho', JSON.stringify({ wid:u.wid, role:u.role, name:u.name||u.wid })); }catch(e){}
}
function readIdentity(){
  try{ const s=sessionStorage.getItem('etrainWho'); return s?JSON.parse(s):null; }catch(e){ return null; }
}

/* 用 token 拉全量数据并覆写 MOCK.DB。
   注意： 关键字段映射（见《接线映射表》§1）：
      actionData.levelPhases -> MOCK.DB.phases（改名）；
      actionData.user（单数）-> 会话；
      **actionData 不下发 users 字典**（已核对后端 L772-775：返回体里没有 users），
      故管理员单独补一次 adminUserList（见下方 fetchUsersIfAdmin）。
   注意：【2026-10-04 二次修正】首版以为"漏映射 users"是 bug，补了 map.users —— 实测证明
      **后端确实不下发**（data.users 恒空）。若不补，`admin-users`「用户表」、
      `admin-dashboard`「带教团队」、`student-me`「带教联系人」在 live 模式下会
      永远显示 **mock 种子的假用户**（admin/M1/M2/S001 恰好同名，极易误判为"对的"）。 */
async function liveRefresh(){
  const d = await liveApi('data');
  // 覆盖式写入：只覆盖后端真正下发的键，未下发的保持（如 seedlogCourses）
  const map = {
    courses:'courses', plans:'plans', mentors:'mentors', trainees:'trainees',
    gates:'gates', competency:'competency', signoffs:'signoffs', coaching:'coaching',
    learn:'learn', fav:'fav', qa:'qa', rating:'rating', levels:'levels',
    journey:'journey', readiness:'readiness', courseGate:'courseGate',
    settings:'settings', tasks:'tasks', taskDefs:'taskDefs', readinessLines:'readinessLines'
    /* users: 不在此处 —— actionData 不下发，改由 fetchUsersIfAdmin 用 adminUserList 补齐 */
  };
  Object.keys(map).forEach(k=>{ if(d[k] !== undefined) MOCK.DB[map[k]] = d[k]; });
  if(d.levelPhases) MOCK.DB.phases = d.levelPhases;              // <- 唯一改名点
  /* 会话同步：注意： MOCKAPI / S 由 mock-api.js 定义，正常都在；但**跳页时序**下
     liveBootstrap 可能在页面脚本完成初始化前跑，故一律防御性赋值，
     绝不让「同步会话」这一步抛错把整个 refresh 打断（数据其实已写好）。 */
  /* 注意： users 字典：actionData **不下发**（后端已核对）-> 管理员单独补一次全量账号列表。
     非管理员不补（后端 adminUserList 仅 admin 可调）；他们的 DB.users 保持 mock 种子，
     但**非管理员页面不消费 DB.users**（实测：只有 admin-dashboard/admin-users/student-me
     三处，前两者仅 admin 可见；student-me 只用来渲染「带教联系人」，其数据本就在 trainees 里）。 */
  if(d.user){
    LIVE.user = d.user;
    persistIdentity(d.user);                    // <- 持久化（与 liveLogin 同源；覆盖免密恢复路径）
    const S = (typeof MOCKAPI !== 'undefined' && MOCKAPI && MOCKAPI.S) ? MOCKAPI.S : null;
    if(S){ S.wid = d.user.wid; S.role = d.user.role; S.name = d.user.name; }
    MOCK.DB.users = MOCK.DB.users || {};
    MOCK.DB.users[d.user.wid] = Object.assign({}, MOCK.DB.users[d.user.wid], d.user);
    if(d.user.role === 'admin') await fetchUsersIfAdmin();
  }
  /* 待办角标：refreshTodoDot 在 ui.js（本文件之后加载），跳页时可能尚未定义 -> 防御。 */
  try{
    const dotFn = (typeof UI !== 'undefined' && UI && typeof UI.refreshTodoDot === 'function')
      ? UI.refreshTodoDot : (typeof refreshTodoDot === 'function' ? refreshTodoDot : null);
    const sw = (typeof MOCKAPI !== 'undefined' && MOCKAPI && MOCKAPI.S) ? MOCKAPI.S.wid : null;
    if(dotFn && sw) dotFn(sw);
  }catch(e){ console.warn('[live] 刷新待办角标失败（不影响数据）：' + e.message); }
  return d;
}

/* 管理员专属：用 adminUserList 补齐 MOCK.DB.users（actionData 不下发 users）。
   注意： 必须在「会话已是 admin」后调用；非 admin 会在后端被拒（仅管理员可操作）-> 静默跳过。
   注意：【2026-10-04】不补的话，admin-users「用户表」/ admin-dashboard「带教团队」在 live 模式
      显示的是 mock 种子的假用户（恰好 admin/M1/M2/S001 同名 -> 极易误判为真实数据）。 */
async function fetchUsersIfAdmin(){
  try{
    const r = await liveApi('adminUserList');
    if(r && r.ok && Array.isArray(r.users)){
      const dict = {};
      r.users.forEach(u=>{ if(u && u.wid) dict[u.wid] = u; });
      MOCK.DB.users = dict;
    }
  }catch(e){ /* 非 admin 或无权限：静默（不影响其它数据） */ }
}

/* ---------- B. 写路径：真实 action 包装 ---------- */
/* 每个包装：调真实 action -> 成功后 liveRefresh() -> 触发页面重绘。
   与 mock 版**同签名、同副作用语义**，故页面代码零改动。
   rej 原因仍走 window.__rejNote（后端 reviewTask 的 note 字段）。
   注意：【2026-10-04 修正】mock 层写后走 `rerenderAfterWrite()`（= refreshTodoDot + 调 window.__rerender()）。
      live 层初版**漏了调重绘** -> 写操作虽落库，但页面不重绘，用户看不到变化。
      现统一走 `liveRerender()`：优先 window.__rerender，缺失则回退 window.render()。
      同时**读路径**（liveBootstrap 拉完数据后）也走同一入口 —— 否则首屏停在 mock 那一帧。 */
function liveWrite(action, buildBody, opts){
  opts = opts || {};
  return async function(){
    const args = Array.prototype.slice.call(arguments);
    const body = buildBody.apply(null, args);
    const out = await liveApi(action, body);
    if(opts.noRefresh !== true){
      try{ await liveRefresh(); }catch(e){ /* 读失败不阻断写成功提示 */ }
    }
    try{
      if(typeof UI !== 'undefined' && UI.refreshTodoDot && typeof MOCKAPI !== 'undefined' && MOCKAPI && MOCKAPI.S){
        UI.refreshTodoDot(MOCKAPI.S.wid);
      }
      liveRerender();
    }catch(e){ console.warn('[live] 写后重绘失败（数据已落库）：' + e.message); }
    return out;
  };
}

/* ---------- 视频上传接线（2026-10-05） ----------
   [红] 为什么必须分片、且必须浏览器直传 COS（后端注释里记了原因，这里不重复）：
     云函数单请求体上限约 100KB，而 COS 分片要求每片 ≥1MB，两者不可兼容；
     故**分片数据由浏览器直接 PUT 到 COS**，云函数只签 URL 与最终入库。
     为什么不用 AppendObject：那种对象不支持改元数据，Content-Disposition 改不成
     inline（实测 405）-> 浏览器强制下载而非内联播放。

   为什么不用云函数中转单片：一个大视频几百分片，每次多一跳云函数既慢又可能超时。

   注意： 凭证一致性：uploadInit 与 uploadSign 可能落到**不同云函数实例**，
     各自签的 token 快照未必同一份（q-ak 与 token 必须同源，否则 COS 报
     InvalidAccessKeyId）。故每一片都调 uploadSign 拿「该片专属」的 url+token，
     不复用 init 返回的那个 token —— 后端注释里也是这么要求的。 */
const UPLOAD_PART = 5 * 1024 * 1024;   // 5MB/片：远大于 1MB 下限，又不至于让 500MB 视频变成 100 片

/* 单片 PUT 到 COS。返回该片的 ETag（合并分片时必需，格式带引号要原样传给后端）。 */
async function putPart(url, token, blob, onProgress){
  /* COS 分片直传必须带 x-cos-security-token，否则 403。 */
  const r = await fetch(url, {
    method: 'PUT',
    headers: { 'x-cos-security-token': token },
    body: blob
  });
  if(!r.ok){
    const t = await r.text().catch(() => '');
    throw new Error('分片上传失败 HTTP ' + r.status + ' ' + t.replace(/\s+/g, ' ').slice(0, 160));
  }
  const etag = r.headers.get('ETag') || '';
  if(!etag) throw new Error('COS 未返回 ETag（合并分片必需），可能被中间层剥掉了响应头');
  if(onProgress) onProgress();
  return etag;
}

/* 上传一个视频到指定章节。
   onProgress(done, total) —— 已传片数/总片数（UI 画进度条用，不是字节级）。
   注意： 失败时必须调 uploadClear 清掉半成品分片：否则 COS 上留一个未合并的
     uploadId 占着存储，且同名旧对象已在 init 阶段被删 -> 章节变成「既没旧视频也没新视频」。 */
async function liveUploadVideo(cid, chid, file, onProgress){
  if(!LIVE.enabled) throw new Error('当前是沙盒模式，无法真正上传（沙盒只演示界面）');
  if(!file) throw new Error('没有选文件');
  if(file.size <= 0) throw new Error('文件是空的');
  if(!/\.mp4$/i.test(file.name)) throw new Error('只支持 .mp4（当前项目视频统一 mp4，避免服务端转码开销）');

  let init = null, done = 0;
  try{
    /* 1. init：云函数签发 init/complete 预签名 URL + uploadId（并删掉同名旧对象） */
    init = await liveApi('uploadInit', { cid, chid });
    const total = Math.max(1, Math.ceil(file.size / UPLOAD_PART));
    const parts = [];
    /* 2. 逐片 PUT 到 COS。每片都现签 URL，保证 token 与该片的 q-ak 同源。 */
    for(let pn = 1; pn <= total; pn++){
      const blob = file.slice((pn - 1) * UPLOAD_PART, pn * UPLOAD_PART);
      const s = await liveApi('uploadSign', { cid, chid, uploadId: init.uploadId, partNumber: pn });
      const etag = await putPart(s.url, s.token, blob, () => {
        done++; if(onProgress) onProgress(done, total);
      });
      parts.push({ partNumber: pn, etag });
    }
    /* 3. complete：云函数代发合并请求（带完成标记），并把 videoUrl 写进 ch.src。
       注意： 合并后还要 HEAD 校验字节数，由后端做，前端不重复校验。 */
    const fin = await liveApi('uploadComplete', { cid, chid, uploadId: init.uploadId, parts });
    try{ await liveRefresh(); }catch(e){ /* 读失败不阻断「上传成功」这个结论 */ }
    try{ liveRerender(); }catch(e){ console.warn('[live] 上传后重绘失败：' + e.message); }
    return fin;
  }catch(e){
    /* 半成品清理：尽力而为，失败不掩盖原始错误（原始错误才是用户要看的） */
    try{ await liveApi('uploadClear', { cid, chid }); }catch(_){ /* 忽略 */ }
    throw e;
  }
}

/* 换 PDF：写课程级 docs。后端 action 已有权限校验与地址格式校验。 */
const liveSetChapterPdf = liveWrite('adminChapterPdf', (cid, name, url) => ({ cid, name, url }));
/* 删章节：后端会连带删 COS 视频对象、但保留学员学习记录。 */
const liveDelChapter = liveWrite('adminChapterDelete', (cid, chid) => ({ cid, chid }));

/* 把当前 window.MOCKAPI 的写函数替换为真实实现（仅当 LIVE.enabled） */
function wireLiveWrites(){
  if(!LIVE.enabled) return false;
  if(!window.MOCKAPI){ console.warn('[live] MOCKAPI 未就绪，跳过接线'); return false; }

  const W = {
    // reviewTask(tid, levelId, taskId, pass) —— 第一参是学员工号
    mockReview: liveWrite('reviewTask', (tid, levelId, taskId, pass)=>({
      tid, levelId, taskId, pass: pass === true,
      note: (typeof window.__rejNote === 'string' && window.__rejNote) || ''
    })),
    // submitTask(tid, levelId, taskId, note) —— tid 由 token 决定，后端忽略
    mockSubmitTask: liveWrite('submitTask', (tid, levelId, taskId, note)=>({
      levelId, taskId, note: String(note || '')
    })),
    mockSetJourney:  liveWrite('adminSetJourney',  (tid, levelId, stage, ok)=>({ tid, levelId, stage, ok })),
    // adminSetReadiness(tid, key, met)：met 1/0/null(清除)。
    // 注意： 后端 adminSetReadiness：met===null 的语义是 data.clear===true（删记录）；
    //    非清除时必须带上当前 value，否则后端会把已登记的数值写成 null（后端 raw==="" -> value=null）。
    mockSetReadiness: liveWrite('adminSetReadiness', (tid, key, met)=>{
      if(met === null || met === undefined) return { tid, key, clear: true };
      const cur = ((MOCK.DB.readiness[tid]||{})[key]) || {};
      return { tid, key, met: met === 1 || met === true, value: (cur.value==null ? '' : cur.value) };
    }),
    // 保存登记：读弹层里的数值/备注（id 规则 rdv-<key> / rdn-<key>，见 ui.js openReadiness）
    mockSaveReadiness: liveWrite('adminSetReadiness', (tid, key)=>{
      const cur = ((MOCK.DB.readiness[tid]||{})[key]) || {};
      const vEl = document.getElementById('rdv-' + key), nEl = document.getElementById('rdn-' + key);
      const raw = vEl ? vEl.value : '';
      return { tid, key, met: cur.met === true,
               value: raw === '' ? '' : Number(raw),
               note: nEl ? String(nEl.value || '').slice(0,200) : '' };
    }),
    mockCertify:     liveWrite('adminCertify',     (tid)=>({ tid })),
    mockSetGate:     liveWrite('adminSetSetting',  (on)=>({ key:'enforceGate', value: !!on })),
    mockAddUser:     liveWrite('adminUserUpsert',  ()=>({
      wid: val('#uWid'), name: val('#uName'), dept: val('#uDept'),
      role: val('#uRole'), password: val('#uPw')
    })),
    mockTransfer:    liveWrite('adminTransferTrainee', (wid)=>({ tid: wid, to: val('#trTo') })),
    mockDeleteUser:  liveWrite('adminUserDelete',  (wid)=>({ wid })),
    mockCourseStatus:liveWrite('adminCourseStatus',(cid, on)=>({ cid, status: on ? 'on' : 'off' })),
    mockDeleteCourse:liveWrite('adminCourseDelete',(cid)=>({ cid })),
    mockSignoff:     liveWrite('signoff',          (wid)=>{
      // 后端 actionSignoff(me,d) 读 d.tid / d.pid / d.rating；pid 取该学员带教计划的第一个 plan
      const byPlan = ((MOCK.DB.competency[wid] || {}).byPlan) || {};
      const pid = Object.keys(byPlan)[0] || '';
      return { tid: wid, pid, rating: val('#rt') };
    }),
    mockCheckin:     liveWrite('checkin',          ()=>({})),
    mockToggleFav:   liveWrite('fav',              (cid)=>({ cid })),
    mockSetRate:     liveWrite('rate',             (cid, n)=>({ cid, n })),
    mockPostQA:      liveWrite('qa',               (cid)=>({ cid, txt: val('#qaTxt') || val('#mpNote') })),
    mockMarkDone:    liveWrite('learn', (cid, chid, type, label, extra)=>{
      extra = extra || {};
      return { cid, chid, done: true, type: type || 'complete', label: label || '',
               speed: extra.speed, resumeAt: extra.resumeAt, dragSkip: extra.dragSkip };
    }),
    mockSubmitSync:  liveWrite('gateMentee', (cid, chid)=>({ cid, chid, note: val('#syncNote') }))
  };

  // 装机：MOCKAPI 与 window 双份（mock-api.js 两处都导出了）。
  // 注意： 只替换**确实存在**的函数 —— 沙盒目前没有 mockSetComp / mockGateMentor，
  //    若强行新增会让「接口面」与页面认知不符；这两个 action 等页面需要时再接。
  let wired = 0;
  Object.keys(W).forEach(k=>{
    if(typeof window.MOCKAPI[k] === 'function'){
      window.MOCKAPI[k] = W[k];
      window[k] = W[k];
      wired++;
    }
  });
  // 批量通过没有后端 action -> 逐条调真实 reviewTask（保留逐条过权限语义）
  window.MOCKAPI.mockBulkPass = async function(list){
    const items = Array.isArray(list) ? list : [];
    const skip = []; let ok = 0;
    for(const it of items){
      const gate = (typeof canReview === 'function') ? canReview(MOCKAPI.S.wid, it.tid, it.taskId) : true;
      if(gate !== true){ skip.push(Object.assign({}, it, { why: String(gate) })); continue; }
      try{
        await liveApi('reviewTask', { tid: it.tid, levelId: it.lvId || it.levelId, taskId: it.taskId, pass: true, note: '' });
        ok++;
      }catch(e){ skip.push(Object.assign({}, it, { why: e.message || '失败' })); }
    }
    try{ await liveRefresh(); }catch(e){}
    return { ok, skip };
  };
  window.mockBulkPass = window.MOCKAPI.mockBulkPass;

  /* ---------- 两个缺口：按用户 2026-10-04 决策，不接后端 ---------- */
  /* 1. 撤销转正认证：用户选 B（去掉 UI 按钮）。后端确实没有"直接撤销认证"的 action，
     但可用 adminSetReadiness(clear:true) 连带撤销 —— 那会同时删掉该条线登记，语义不同。
     本层不擅自替代；若仍被调用，给出明确说明而不是静默失败。 */
  window.MOCKAPI.mockRevokeCertify = async function(tid){
    if(typeof toast === 'function') toast('该操作暂不支持', 'err');
    return { error: 'unsupported' };
  };
  window.mockRevokeCertify = window.MOCKAPI.mockRevokeCertify;

  /* 2. 达标线阈值可改：用户选 C（去掉该功能）。后端阈值为常量、无写接口。
     若旧入口仍被触发，明确拒绝，不做"假生效"。 */
  window.MOCKAPI.mockSetReadinessThreshold = async function(){
    if(typeof toast === 'function') toast('阈值暂不支持在线修改', 'err');
    return { error: 'unsupported' };
  };
  window.mockSetReadinessThreshold = window.MOCKAPI.mockSetReadinessThreshold;

  console.log('[live] 已接线真实后端：' + LIVE.apiUrl + '（写路径 ' + wired + ' 个 + 批量通过）');
  return true;
}

/* 小工具：读表单值（找不到则返回空串，避免 undefined 传到后端） */
function val(sel){ const e = document.querySelector(sel); return e ? String(e.value || '').trim() : ''; }

/* ---------- 统一重绘入口（live 层的兜底，不依赖页面注册 __rerender） ----------
   注意：【2026-10-04 修正 · 关键】
     真实数据是**异步**到达的，而页面普遍在 `DOMContentLoaded` 里**同步**调 render() 渲一帧
     （此时 DB 还是 mock 种子、S.wid 还是默认 'admin'）-> 首屏是假数据。
     mock 层的写路径靠 `window.__rerender()` 覆盖重绘，但**只有部分页面注册了它**：
       实测 student-level.html / student-me.html **没有** window.__rerender（只有内部 render）。
     若只调 __rerender，这两个页面会**永远停在 mock 那一帧**（实测：显示 admin 的假进度
     「已看 3/3 · 1.25× 倍速」，而真实临时号 learn 记录为空）。
   回退策略：__rerender 存在用它；否则**直接调页面自己的 window.render()**。
     实测 12 个页面**全都有** window.render（函数声明绑定到全局），故此回退覆盖面 100%，
     且**无需改任何页面代码**（守住"接线不改页面"的原则）。 */
function liveRerender(){
  try{
    if(typeof window.__rerender === 'function'){ window.__rerender(); return; }
    if(typeof window.render === 'function'){ window.render(); return; }
    console.warn('[live] 页面未暴露 render/__rerender，无法重绘（数据已就绪）');
  }catch(e){
    console.warn('[live] 重绘失败（数据已就绪，仅 UI 未刷新）：' + e.message);
  }
}

/* ---------- P0-2（2026-10-05）：首屏加载态 / 失败错误条 / token 失效收敛 ----------
   [红] 为什么必须加这一层（实测三连，见《上线前优化清单》P0-2）：
     1. 联网时：DOMContentLoaded 里页面已同步用 mock 种子渲了一帧「走完 3 关」的假进度，
        真实数据要 600ms~1.4s 才到 -> 用户每次跳页都看到一次假数据；
     2. 断网/后端故障：永远停在假进度，且实测 toast 不出现 -> 用户拿着假数据操作；
     3. token 失效：页面照常渲染，既不提示也不跳登录 -> 以为登录有效，写操作其实全失败。
   修法：
     1. 有 token 就**在发起请求前**同步压上加载态（main 用 visibility 隐藏，保留高度防跳动）；
     2. 失败**不放出来**，改显示居中错误卡 + 重试按钮；
     3. 后端明确说「登录已失效」-> 清登录痕迹 + 走 requireLogin()（接上 5g 未登录收敛）。
   注意： 时序：liveBootstrap 的同步部分跑在页面的 DOMContentLoaded 处理器之后、
        浏览器首次绘制之前 -> 假数据那一帧**根本不会被画出来**。 */
function livePageName(){
  var f = (location.pathname.split('/').pop() || '').split('?')[0];
  return f;
}
/* login.html 刻意豁免：它是给「还没登录」的人看的，
   已登录用户访问时若被加载层盖住，反而正常不了。 */
function liveGateAllowed(){
  return !/^login\.html$/.test(livePageName());
}
function liveSetLoading(on){
  var h = document.documentElement;
  try{
    if(on) h.setAttribute('data-live-loading','1');
    else h.removeAttribute('data-live-loading');
  }catch(e){}
  var n = document.getElementById('__liveLoad');
  if(on){
    if(!n && document.body){
      n = document.createElement('div'); n.id = '__liveLoad'; n.className = 'liveload';
      n.innerHTML = '<div class="liveload-box">'+
        '<span class="liveload-spin" aria-hidden="true"></span>'+
        '<b>正在加载真实数据…</b>'+
        '<span class="liveload-sub">首次进入约需 1 秒</span></div>';
      document.body.appendChild(n);
    }
  }else if(n){ n.remove(); }
}
function liveClearError(){
  var n = document.getElementById('__liveErr');
  if(n) n.remove();
}
function liveShowError(msg, noRetry){
  /* [红] 只移除动画层、**保留** data-live-loading —— 错误时主内容区必须继续隐藏，
     否则断网用户看到的还是本地示例数据（实测 B3 失败就是这个原因：
     最初版本在这里调 liveSetLoading(false)，把隐藏标记也一并撤了）。
     真正放出来只有两条路：重试成功（liveBootstrap）或 token 失效（liveOnAuthExpired）。 */
  var ln = document.getElementById('__liveLoad');
  if(ln) ln.remove();
  try{ document.documentElement.setAttribute('data-live-loading','1'); }catch(e){}
  var n = document.getElementById('__liveErr');
  if(!n && document.body){
    n = document.createElement('div'); n.id = '__liveErr'; n.className = 'liveerr';
    document.body.appendChild(n);
  }
  if(!n) return;
  /* 注意： 不能用全局 esc（ui.js 才有，design-spec 之类页面会 undefined）—— 与 requireLogin 同一教训 */
  var safe = String(msg == null ? '' : msg).replace(/[<>&]/g, '');
  n.innerHTML = '<div class="liveerr-box">'+
    '<b>数据加载失败</b>'+
    '<span class="liveerr-msg">'+safe+'</span>'+
    (noRetry ? '' : '<button class="btn" type="button" id="__liveRetry">重试</button>')+
    '<span class="liveload-sub">页面暂不显示数据，以免你看到的是本地示例数据。</span>'+
  '</div>';
  var b = document.getElementById('__liveRetry');
  if(b) b.addEventListener('click', function(){ liveShowError('正在重试…', true); liveBootstrap(); });
}
/* 后端说 token 无效：清干净登录痕迹，再交回给 5g 的未登录收敛 */
function liveOnAuthExpired(){
  liveSetLoading(false);                    /* [红] 必须先放出来，否则 requireLogin 写进 main 的占位也被隐藏 */
  liveClearError();
  try{
    sessionStorage.removeItem('etrainToken');
    sessionStorage.removeItem('etrainWho');
    sessionStorage.removeItem('protoRole');
    sessionStorage.removeItem('etrainPreWid');
  }catch(e){}
  LIVE.token = null; LIVE.user = null;
  if(typeof requireLogin === 'function'){ requireLogin(livePageName()); return; }
  liveShowError('登录已失效，请重新登录。', true);
}
/* 后端「登录已失效」的判据：只认这一句，别用宽泛的 /token/（会把别的错误误判成掉登录） */
function isAuthError(e){
  var m = String((e && e.message) || e || '');
  return m.indexOf('登录已失效') >= 0;
}

/* ---------- 一次性握手：进入任一页面时若开了 live 就登录+拉数 ----------
   注意： 不做自动跳转、不自动登录（避免无密码时卡死）。
   登录由 login.html 显式调用 LIVE.login()；其余页面只做「有 token 就 refresh」。 */
async function liveBootstrap(){
  if(!LIVE.enabled) return;
  // 复用上次 token（同标签页会话内）
  try{ if(!LIVE.token) LIVE.token = sessionStorage.getItem('etrainToken') || null; }catch(e){}
  if(!LIVE.token){ console.info('[live] 未登录：请从登录页用工号+密码进入'); return; }
  if(liveGateAllowed()) liveSetLoading(true);
  try{
    await liveRefresh();
    liveSetLoading(false);
    liveClearError();
    liveRerender();
    return true;
  }catch(e){
    console.warn('[live] 拉取真实数据失败：' + e.message);
    if(isAuthError(e)){ liveOnAuthExpired(); return false; }
    if(liveGateAllowed()) liveShowError(e.message);
    else if(typeof toast === 'function') toast('真实后端拉取失败：' + e.message, 'err');
    return false;
  }
}

/* ---------- 导出 ---------- */
window.LIVE = LIVE;
window.liveApi = liveApi;
window.LIVE.login = liveLogin;
window.LIVE.refresh = liveRefresh;
window.LIVE.wire = wireLiveWrites;
window.LIVE.bootstrap = liveBootstrap;
/* 上传相关（2026-10-05）。挂 window 而非 LIVE：它们需要页面拿 file 对象和
   进度回调自己编排，不是「写完自动刷新」的那类小操作。
   注意： 教训（任务 G 踩过）：全局函数并非处处可用 —— `esc` 在 ui.js，
     design-spec.html 不引 ui.js 就报 undefined。故这三个函数**只依赖
     liveApi / LIVE**，不碰 UI / toast，调用方（页面）自己负责提示与弹层。 */
window.liveUploadVideo = liveUploadVideo;
window.liveSetChapterPdf = liveSetChapterPdf;
window.liveDelChapter = liveDelChapter;

/* ---------- 自启动（页面无需改一行 JS，只需多引一个 <script>） ----------
   时机：本文件在 mock-api.js 之后加载；但页面自己的 DOMContentLoaded 处理器
   （可能触发首次 render）会先跑。故这里在 DOMContentLoaded 里只做两件不抢时序的事：
     1. wire()  —— 换掉写函数（纯赋值，立即生效，不影响首屏）
     2. bootstrap() —— 异步拉真实数据；拉到后走 liveRerender() 覆盖首屏
        （优先 __rerender，缺失回退页面自己的 render()——见 liveRerender 注释）
   若页面在拉到数据前已用 mock 种子渲染过一帧，会在 liveRefresh 后自动重绘覆盖，
   不会留下"看起来是假数据"的中间态（真数据到达即覆盖）。 */
document.addEventListener('DOMContentLoaded', function(){
  if(!LIVE.enabled) return;
  try{ wireLiveWrites(); }catch(e){ console.warn('[live] wire 失败', e); }
  liveBootstrap();
});
