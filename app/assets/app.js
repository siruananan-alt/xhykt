/* ============================================================
   企业培训平台 · 原型交互层
   职责：1. SVG 图标精灵注入  2. 顶栏角色切换（模拟登录态）
        3. Toast / Modal / 确认框  4. 表单校验三态
        5. 列表筛选与批量选择    6. 二级导航当前项高亮
   纯原生 JS，无依赖；仅原型使用，不进生产。
   ============================================================ */

/* ---------- 1. 图标精灵：复用生产同一套 24×24 描边 symbol ---------- */
const ICONS = {
  'i-book':'<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5A2.5 2.5 0 0 1 4 20.5z"/>',
  'i-play':'<path d="M6 4.5v15l13-7.5z"/>',
  'i-file':'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>',
  'i-clipboard':'<path d="M9 4H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/>',
  'i-handshake':'<path d="m11 17-2.5 2.5a2.1 2.1 0 0 1-3-3l1.6-1.6"/><path d="m13 17 2.5 2.5a2.1 2.1 0 0 0 3-3L16 14"/><path d="M6 12 3.5 9.5a2.1 2.1 0 0 1 0-3l3-3a2.1 2.1 0 0 1 3 0L11 5"/><path d="m13 5 1.5-1.5a2.1 2.1 0 0 1 3 0l3 3a2.1 2.1 0 0 1 0 3L18 12"/><path d="M9 12.5 11 14a1.6 1.6 0 0 0 2.2 0L15 12"/>',
  'i-user':'<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
  'i-users':'<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6"/><path d="M17.5 14.2A6.5 6.5 0 0 1 21.5 20"/>',
  'i-award':'<circle cx="12" cy="9" r="5.5"/><path d="m8.5 13.6-1.2 7 4.7-2.6 4.7 2.6-1.2-7"/>',
  'i-alert':'<path d="M10.3 3.9 2.6 17.4A2 2 0 0 0 4.3 20.4h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4.2"/><path d="M12 17h.01"/>',
  'i-check':'<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  'i-check-circle':'<circle cx="12" cy="12" r="9"/><path d="m8.5 12.3 2.4 2.4 4.7-4.7"/>',
  'i-lock':'<rect x="4.5" y="10" width="15" height="10.5" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14v3"/>',
  'i-star':'<path d="m12 3.6 2.55 5.2 5.75.83-4.15 4.05 1 5.72L12 16.7l-5.15 2.7 1-5.72-4.15-4.05 5.75-.83z"/>',
  'i-trash':'<path d="M4 6.5h16"/><path d="M9.5 6.5V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v1.5"/><path d="M6.5 6.5 7.4 19a2 2 0 0 0 2 1.9h5.2a2 2 0 0 0 2-1.9l.9-12.5"/><path d="M10.5 10.5v6M13.5 10.5v6"/>',
  'i-upload':'<path d="M12 16V4"/><path d="m7.5 8.5 4.5-4.5 4.5 4.5"/><path d="M4 15v3.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V15"/>',
  'i-film':'<rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><path d="M7.5 4.5v15M16.5 4.5v15M2.5 12h19M2.5 8.2h5M2.5 15.8h5M16.5 8.2h5M16.5 15.8h5"/>',
  'i-chart':'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  'i-grid':'<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>',
  'i-flag':'<path d="M5 21V4"/><path d="M5 5h11l-2 3.5L16 12H5z"/>',
  'i-arrow-l':'<path d="M19 12H5"/><path d="m11 6-6 6 6 6"/>',
  'i-close':'<path d="M6 6l12 12M18 6 6 18"/>',
  'i-clock':'<circle cx="12" cy="12" r="9"/><path d="M12 7v5.5l3.5 2"/>',
  'i-search':'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',
  'i-filter':'<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
  'i-download':'<path d="M12 4v11"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M4 20h16"/>',
  /* i-logout（2026-10-05 新增）：门框 + 向左箭头 = 走出登录态。
     注意： ICONS 是**查表式**：图标名不存在时 ic() 仍返回 <svg><use href="#缺失"/></svg>，
     浏览器渲染成**空 svg**（不是报错）-> 槽位留个空白。故新增图标必须同步补进这张表。 */
  'i-logout':'<path d="M14 4.5H6.5A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5H14"/><path d="M11.5 8.5 8 12l3.5 3.5"/><path d="M8.5 12H19"/>',
  'i-party':'<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>',
  'i-pencil':'<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/>',
  'i-mail':'<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 7l9 6 9-6"/>',
  'i-dot':'<circle cx="12" cy="12" r="5.5" fill="currentColor" stroke="none"/>',
  'i-think':'<path d="M6 15a3.5 3.5 0 0 1 0-7 4 4 0 0 1 7.7-1.2A3.8 3.8 0 0 1 18 15z"/><circle cx="9" cy="18.5" r="1" fill="currentColor" stroke="none"/><circle cx="13" cy="20" r="1.3" fill="currentColor" stroke="none"/>',
  'i-star-o':'<path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.8 7.2 19.5l.9-5.4L4.2 9.7l5.4-.8z"/>',
  'i-tri-r-sm':'<path d="M9 6.5 18 12 9 17.5z" fill="currentColor" stroke="none"/>',
  'i-tri-d-sm':'<path d="M6.5 9 12 18l5.5-9z" fill="currentColor" stroke="none"/>',
  'i-arrow-r':'<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  'i-arrow-lr':'<path d="M4 12h16"/><path d="m7 9-3 3 3 3"/><path d="m17 9 3 3-3 3"/>',
  'i-arrow-dl':'<path d="M20 12H4"/><path d="m7 9-3 3 3 3"/><path d="m11 9-3 3 3 3"/>'
};
// 带圈数字徽标 i-num1..i-num12：圆 + 居中数字（替代带圈数字字形 1.-12.）
for(let n=1;n<=12;n++){
  ICONS['i-num'+n]='<circle cx="12" cy="12" r="9.5"/><text x="12" y="16.2" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor" stroke="none">'+n+'</text>';
}
function injectIcons(){
  const s=document.createElementNS('http://www.w3.org/2000/svg','svg');
  s.setAttribute('class','spr');s.setAttribute('aria-hidden','true');
  s.innerHTML=Object.keys(ICONS).map(k=>`<symbol id="${k}" viewBox="0 0 24 24">${ICONS[k]}</symbol>`).join('');
  document.body.insertBefore(s,document.body.firstChild);
  // 把纯 HTML 写法 <span data-ic="i-clock"></span> 就地换成 <svg><use/></svg>。
  // 之前漏了这一步：sprite 注入了但没人引用，图标槽位全是空的（沙盒长期隐藏缺陷）。
  document.querySelectorAll('[data-ic]').forEach(el=>{
    const n=el.dataset.ic;
    if(!ICONS[n])return;                       // 图标名写错时保持原样，不静默吞掉
    el.innerHTML='<svg class="ic"><use href="#'+n+'"/></svg>';
  });
  // 元素本身带图标的（如 <a data-ic2="i-play">文字</a>）：把 svg 插到最前面，文字保留
  document.querySelectorAll('[data-ic2]').forEach(el=>{
    const n=el.dataset.ic2;
    if(!ICONS[n])return;
    el.insertAdjacentHTML('afterbegin','<svg class="ic"><use href="#'+n+'"/></svg>');
  });
}
const ic=(n,cls='')=>`<svg class="ic ${cls}"><use href="#${n}"/></svg>`;

/* ---------- 2. Toast ---------- */
function toast(msg,kind){
  const box=document.getElementById('toasts')||(()=>{const d=document.createElement('div');d.id='toasts';d.className='toasts';document.body.appendChild(d);return d;})();
  const el=document.createElement('div');
  el.className='toast'+(kind?' '+kind:'');
  const ico=kind==='err'?'i-alert':(kind==='warn'?'i-clock':'i-check-circle');
  el.innerHTML=ic(ico)+'<span>'+msg+'</span>';
  box.appendChild(el);
  setTimeout(()=>{el.style.transition='opacity .2s';el.style.opacity='0';setTimeout(()=>el.remove(),220);},2400);
}

/* ---------- 3. Modal ---------- */
function openModal(html){
  const m=document.getElementById('mask');
  document.getElementById('modal').innerHTML=html;
  m.classList.add('on');
  document.body.style.overflow='hidden';
}
function closeModal(){
  const m=document.getElementById('mask');if(m)m.classList.remove('on');
  document.body.style.overflow='';
}
function confirmBox(title,body,onOk,okLabel){
  openModal(`<div class="m-h"><h2>${title}</h2><span class="x" onclick="closeModal()">×</span></div>
    <div class="m-b">${body}</div>
    <div class="m-f"><button class="btn ghost" onclick="closeModal()">取消</button>
    <button class="btn" onclick="closeModal();${onOk}">${okLabel||'确认'}</button></div>`);
}

/* ---------- 4. 表单校验（三态：默认 / 校验失败 / 校验通过） ---------- */
const RULES={
  /* 注意：【2026-10-04 修】原正则 /^[A-Za-z]{1,6}\d{1,6}$/ 要求「字母+数字」，
     把真实账号 `admin`（纯字母、无数字）挡在登录门外 —— 生产与后端**都没有**格式校验
     （后端只查「账号存在 + 密码对」）。此处放宽为：字母开头，字母/数字组合，1–12 位。
     兼容 S001 / M1 / M2 / admin 全部真实工号。 */
  wid:   {test:v=>/^[A-Za-z][A-Za-z0-9]{0,11}$/.test(v.trim()),msg:'工号格式：字母开头，字母+数字（如 M1 / S001 / admin）'},
  name:  {test:v=>v.trim().length>=2,msg:'姓名至少 2 个字'},
  pwd:   {test:v=>v.length>=6,msg:'密码至少 6 位'},
  num:   {test:v=>Number(v)>0,msg:'请填大于 0 的数字'},
  traffic:{test:v=>Number(v)>=0&&Number(v)<=99999,msg:'月引流人数需在 0–99999 之间'},
  note:  {test:v=>v.trim().length>=4,msg:'请至少写 4 个字，说明你做了什么、结果如何'}
};
function bindForm(formId,onOk){
  const f=document.getElementById(formId);if(!f)return;
  f.addEventListener('submit',e=>{
    e.preventDefault();let bad=null;
    f.querySelectorAll('[data-rule]').forEach(el=>{
      const r=RULES[el.dataset.rule];if(!r)return;
      const wrap=el.closest('.fld');wrap.classList.remove('bad','good');
      if(!r.test(el.value)){wrap.classList.add('bad');bad=bad||el;}
      else if(el.value.trim())wrap.classList.add('good');
    });
    if(bad){bad.focus();toast('请先修正标红的那一项','err');return;}
    onOk&&onOk(new FormData(f));
  });
  // 输入时实时清除错误态
  f.addEventListener('input',e=>{
    const wrap=e.target.closest('.fld');if(!wrap)return;
    const r=RULES[e.target.dataset.rule];if(!r)return;
    wrap.classList.remove('bad');
    if(e.target.value.trim()&&r.test(e.target.value))wrap.classList.add('good');else wrap.classList.remove('good');
  });
}



/* ---------- 6. 角色切换（模拟登录态，演示不同角色的视图优先级） ---------- */
const ROLES={
  student:{name:'朱子悦',wid:'S001',role:'学员',initial:'朱'},
  mentor: {name:'郑丽薪',wid:'M1', role:'带教导师',initial:'郑'},
  admin:  {name:'范文淼',wid:'admin',role:'教务管理员',initial:'范'}
};
/* 【2026-10-04 用户决策】去掉培训师角色。
   原因：线上**没有 trainer 角色账号**，M2 曾锃湘真实身份就是导师（mock-data.js 里 role:'mentor'）。
   原沙盒把 M2 借去当"培训师演示身份"，导致同一个工号在两个角色里出现，且培训师的可审范围
   与"考核=导师审自己徒弟、管理员平行兜底"的真实规则冲突。
   历史文件 pages/trainer.html **保留但不挂任何入口**（留决策痕迹，不删）。
   注意： 后端 canReview 仍保留 trainer 分支不动 —— 那是原网站既有实现，本次只改沙盒表现层。 */
/* 切角色 = 换登录身份，必须同步 Mock 会话（mock-api.js 的 S.wid）。
   否则页面拿 admin 身份读数据：学员页会看到 admin 的学习记录，且因 admin 全关卡通过
   而永远不触发锁页 —— 这正是「同频/锁页」断言失败的根因。 */
function syncMockSession(wid){
  if(typeof window.MOCKAPI==='object' && typeof window.MOCKAPI.setSession==='function'){
    try{ window.MOCKAPI.setSession(wid); }catch(e){/* 账号不存在时保持原状 */}
  }
}
/* 【2026-10-04 · 方案 A】原 setRole() 供「原型演示角色切换器」调用（会写 protoRole + toast）。
   已随角色切换菜单一并移除：生产环境角色由登录账号决定，前端不再提供手动切换入口。
   保留 setRoleSilently()（只渲染身份文案、不改会话），它才是登录态的正式渲染路径。 */
/* 角色菜单：由 JS 生成，13 个页面不重复写菜单 DOM。
   切换后按「当前页属于哪个角色」跳到该角色的落地页，模拟真实登录后只能看自己视图。 */
const ROLE_HOME={student:'student-journey.html',mentor:'mentor.html',admin:'admin-dashboard.html'};

/* ---------- 6b. 品牌区回首页 + 切换账号（2026-10-05· 用户需求） ----------
   注意：注意：【安全边界，必须先读】下面这个「切换账号」是**有意重新打开**的权限面：
     2026-10-04 曾把「角色切换下拉菜单」整体移除，理由是它让任何登录者点一下就能进别人的工作台。
     2026-10-05 用户明确要求加回「切换账号」（用途：演示/验收时快速换视角看不同角色的页面）。
     -> 因此必须有**一个一行可关的开关**，出事时改一个字即可全站下线，不必回滚代码：

       const ACCOUNT_SWITCHER_ENABLED = true;   <- 改成 false 即隐藏入口（下方逻辑整体不挂载）

   [红]【为什么默认 true 而不是 false】用户是培训负责人，这个站的常态使用场景包含
     「上课时投屏演示各角色视角」「验收脚本切视角」，关掉会直接挡住主用途。
     真正的风险窗口是「真实学员在用的时候」—— 见下方 live 分支的降级设计。
   [红]【live 模式下绝不静默切身份】真实后端有 token 与密码校验，前端改 sessionStorage
     只能改「前端显示的身份」，后端仍按 token 里的真实身份返数据 -> 会造成
     「界面是管理员、数据是学员」的错配，比不做切换更危险。
     所以 live 模式下降级为「跳登录页并预填工号」，让切换走**真实鉴权**。 */

/* [红] 总开关：改这一行即可全站关闭「切换账号」入口。 */
const ACCOUNT_SWITCHER_ENABLED = true;

/* 品牌区链接 = 落地页首页（站点根的 index.html）。
   注意：注意： 站点挂两层，且**两层的位置不一样** —— 这是最容易写错的一处：
     沙箱  …/training-courses/proto/index.html       <- 首页与 pages/ **同级**
     线上  …/training-courses/index.html             <- 首页在 app/ 的**上一级**
   所以不能无条件「退一层」（沙箱会退到 training-courses/ 外面，点回首页变成跨到线上那份），
   也不能无条件「原地取」（线上会指向 app/index.html，不存在）。
   判据 = SITE_BASE 末段目录名是否为线上部署目录 'app'。
   [红] 这个判据依赖部署目录名 —— 若哪天换名，这里会静默指错。
     两道保险：1. window.ETRAIN_HOME 可显式覆盖，不用改逻辑；
             2. verify-acctsw.js 在沙箱断言 /proto/index.html、
                _p-acctsw.js 在线上断言 /training-courses/index.html —— 错了会立刻报出来。 */
function homeUrl(){
  const ext=(typeof window!=='undefined'&&window.ETRAIN_HOME)||'';
  if(ext) return ext;
  const base=SITE_BASE.replace(/\/+$/,'');                 // 去掉尾部斜杠
  return /\/app$/.test(base)
    ? base.replace(/\/[^/]+$/,'/')+'index.html'             // 线上：退一层
    : base+'/index.html';                                  // 沙箱：原地
}

/* 账号清单：优先用**真实登录拿到的** users 字典（管理员登录时由 adminUserList 补齐），
   回落 mock 种子（沙盒 / 非管理员）。这是唯一取账号的地方，切换器与登录页演示入口共用。
   注意： 非管理员在 live 模式下拿到的是 mock 种子（后端不下发 users、adminUserList 仅 admin 可调）
     -> 菜单里会列出真实存在但当前身份无权查看的账号。这正是「有意打开的权限面」，
        靠上面那个开关兜底。 */
function accountList(){
  const d=(window.MOCK&&MOCK.DB&&MOCK.DB.users)||{};
  return Object.keys(d).map(wid=>{
    const u=d[wid]||{};
    return { wid, name:u.name||wid, role:u.role||'student', title:u.title||'' };
  }).sort((a,b)=>ROLE_ORDER(a.role)-ROLE_ORDER(b.role)||a.wid.localeCompare(b.wid));
}
/* 排序：管理员 -> 导师 -> 学员（演示时最常先看管理端）。 */
const ROLE_ORDER=r=>({admin:0,mentor:1,student:2}[r]??9);

/* 执行切换。返回 'switched' | 'toLogin' | 'off' | 'unknown'，供调用方决定提示语。 */
function switchAccount(wid){
  if(!ACCOUNT_SWITCHER_ENABLED) return 'off';
  const acc=accountList().find(a=>a.wid===wid);
  if(!acc) return 'unknown';
  const liveOn=typeof window.LIVE!=='undefined'&&LIVE.enabled===true;
  if(liveOn){
    /* 真实后端模式：**不静默改身份**（token 才是真身份，静默改会「界面与数据错配」），
       改为跳登录页并预填工号 —— 切换必须走真实鉴权。 */
    try{ sessionStorage.setItem('etrainPreWid',acc.wid); }catch(e){}
    location.href=pageUrl('pages/login.html');
    return 'toLogin';
  }
  /* 沙盒模式：前端演示切换（写会话层 + Mock 会话 + 按角色跳落地页）。 */
  try{ sessionStorage.setItem('protoRole',acc.role); }catch(e){}
  /* [红][红] 必须把**具体账号**一并持久化，不能只写 protoRole。
     原因：ROLES 是沙盒固定表，只有 3 项，且 mentor 恒等于 M1（郑丽薪）。
     M1 与 M2 **同为 mentor** -> 只写 role='mentor'，跳过去后 setRoleSilently('mentor')
     会从 ROLES 取回 M1，身份牌显示「郑丽薪」、Mock 会话被写回 M1
     —— 明明点了 M2 却显示 M1（2026-10-05 实测踩到）。
     这里复用 persistIdentity（写 sessionStorage.etrainWho），
     它正是 setRoleSilently 的第一优先级来源（etrainWho > LIVE.user > ROLES）。 */
  if(typeof window.persistIdentity==='function'){
    try{ window.persistIdentity({wid:acc.wid, role:acc.role, name:acc.name}); }catch(e){}
  }
  syncMockSession(acc.wid);
  location.href=roleHomeUrl(acc.role);
  return 'switched';
}

/* ---------- 6c. 退出登录（2026-10-05· 用户需求） ----------
   放在「切换账号」下拉的最后一项。与切换的区别：切换是**换一个人**，退出是**谁都不留**。 */

/* [红][红] 必须清**两项**登录痕迹，不能只清 token。
   判据来自 currentRole()（守卫认登录的方式）：
       loggedIn = !!sessionStorage.protoRole || !!sessionStorage.etrainToken
   只清 etrainToken -> protoRole 还在 -> 守卫照样认你是登录态 -> **退出等于没退**，
   手输 URL 仍能进工作台（这正是 10-04 修过的那个「没登录反而畅通」漏洞的同款）。
   落地页右上角也判 protoRole（initAuthSlot）-> 不清它会显示「进入工作台」。 */
const LOGOUT_KEYS=['etrainToken','etrainWho','protoRole','etrainPreWid','etrainGuardFrom'];

/* Mock 会话也要复位：mock-api.js 的 S 是内存变量（默认 {wid:'admin'}），
   不复位的话退出后再进沙盒页，身份牌会凭空显示 admin —— 正是 10-04 那个
   「静态 HTML 默认值掩盖身份来源 bug」的同类。 */
function doLogout(){
  LOGOUT_KEYS.forEach(k=>{ try{ sessionStorage.removeItem(k); }catch(e){} });
  try{ if(window.LIVE){ LIVE.token=null; LIVE.user=null; } }catch(e){}
  try{ if(typeof window.MOCKAPI!=='undefined'&&MOCKAPI.S){ MOCKAPI.S.wid='guest'; MOCKAPI.S.role='guest'; } }catch(e){}
  /* 不清 localStorage.etrainLive —— 那是「用沙盒还是真实后端」的**模式偏好**，
     不是登录态。退出登录不该把人的工作模式也重置（清了会静默切到沙盒，行为诡异）。 */
  location.href=pageUrl('pages/login.html');
}

const PAGE_ROLE={  // 文件名 -> 该页本该属于的角色（首页 index.html 是所有角色共用，故不列入）
  'login.html':'student','student-journey.html':'student','student-level.html':'student',
  'student-courses.html':'student','student-me.html':'student',
  'mentor.html':'mentor','mentor-mentee.html':'mentor','mentor-coach.html':'mentor',
  // trainer.html 已不挂入口（保留文件留痕）。若要重新启用，加回 'trainer.html':'trainer' 并补 ROLES 项。
  'admin-dashboard.html':'admin','admin-journey.html':'admin',
  'admin-readiness.html':'admin','admin-courses.html':'admin',
  // 【2026-10-04 补齐】原网站管理端 9 页，缺的 5 页此前没建，切角色时会漏跳
  'admin-tracking.html':'admin','admin-students.html':'admin',
  'admin-plans.html':'admin','admin-perms.html':'admin','admin-users.html':'admin',
  // 【2026-10-04 补齐】学员课程详情 / 播放器两页
  'student-course.html':'student','student-learn.html':'student',
  'design-spec.html':'admin'
};

/* ---------- 5. 页面级角色守卫（2026-10-04 · 用户需求「登录后只能看见自己端」） ----------
   【问题】页面是**静态文件**，谁都能直接打开别人的端：
     学员手输 /app/pages/admin-dashboard.html 就能进来看到管理端界面（数据被后端过滤成空，
     但界面框架、按钮、口径全暴露，且没有任何提示，体验上像"坏了"）。
   【做法】在每页最早时机比对「当前身份」与「本页归属角色」，不符就把人**送回他自己的落地页**。
   【身份来源优先级（关键）】
     1. MOCKAPI.S（会话层）—— 真实登录与沙盒切角色都会写它，最权威
     2. LIVE.user.role   —— 真实登录刚回来、refresh 尚未落地时的兜底
     3. sessionStorage.protoRole —— 沙盒遗留/刷新后恢复
     4. body.dataset.role（页面自带声明）—— 最后兜底，保证"至少不会比现在更差"
   注意： 为什么不能只读 protoRole：真实登录路径**不写** protoRole（只有沙盒 quick() 写），
     若只读它，用 admin 登录却残留 'student' 就会被误弹回学员页。
   【豁免】公开页（index.html，data-public=1）与登录页不拦 —— 它们本就人人可看。
   【为什么用 replace 而不是 href】不留历史记录，避免用户按「返回」又被弹一次形成死循环。 */
function guardPage(){
  if(isPublicPage()) return false;                       // 公开营销页：人人可看
  const here=hereFile();
  if(here==='login.html') return false;                  // 登录页：未登录也要能打开
  const need=PAGE_ROLE[here];
  if(!need) return false;                                // 未登记归属的页（如新加的页）不拦，避免误伤
  const me=currentRole();
  /* [红][红]【2026-10-05 · 用户需求「未登录只能看见首页内容」】
     原来这里是 `if(!me) return false;` —— 未登录**直接放行**，把页面交给各页 render()。
     而各页 render() 直读 mock-data.js 的静态种子（4 个真实工号+姓名），
     -> 未登录手输 admin-users.html 就能看到账号列表。

     【为什么不跳走，而是停在原页显示占位】用户 2026-10-05 明确选了「停在原页」：
       · 跳回首页 = URL 变了，用户不知道自己刚才想看什么，且浏览器「后退」会再被弹一次；
       · 停在原页 = URL 不变、内容区替换成「请先登录」，语义最清楚。
     所以这里返回 false（**不拦**，让页面正常启动），改由 requireLogin() 擦掉内容区。

     注意： 别和下面的「角色不符」搞混：那是**已登录但进错端**（弹回自己的落地页）；
        这里是**压根没登录**（留在原地提示登录）。两件事、两个判据。*/
  if(!me){
    requireLogin(here);
    return false;
  }
  // admin 是"全站可见"的管理视角：允许看管理端 + 学员端/导师端（要检查学员的视图）。
  // 反向不成立：学员/导师绝不进管理端。
  if(me===need) return false;
  if(me==='admin' && need!=='admin') return false;
  // 不符 -> 送回自己的落地页
  const home=pageUrl('pages/'+ROLE_HOME[me]);
  try{ sessionStorage.setItem('etrainGuardFrom',here); }catch(e){}
  location.replace(home);
  return true;
}
/* 当前身份（角色键）。多源合并，权威优先。
   注意：【不能直接用 MOCKAPI.S.role】mock-api.js 的 S 默认值是 `{wid:'admin', role:'admin'}`
     —— 它是**沙盒初始值**不是登录态。若无脑采信，未登录的人打开受保护页会被判定为 admin，
     而 admin 我特意放行全部页面 -> 等于**没登录反而畅通无阻**，正好与需求相反。
   所以：必须能证明"这个会话真的登录过"，才认这个身份。判据二选一：
     1. sessionStorage.protoRole 有值（登录时 syncSession 写的，或沙盒切角色写的）
     2. sessionStorage.etrainToken 有值（真实登录拿到的 token）—— 沙盒下两者都可能有
   拿不到任何登录痕迹 -> 返回 null（守卫不拦，交给各页原有逻辑；线上真实后端仍会在
   接口层拒绝，页面表现为数据空，不会泄露）。 */
function currentRole(){
  let k=null, hasToken=false;
  try{ k=sessionStorage.getItem('protoRole'); hasToken=!!sessionStorage.getItem('etrainToken'); }catch(e){}
  const loggedIn=!!k||hasToken;
  if(!loggedIn) return null;                       // 未登录：不认任何身份
  if(k && ROLE_HOME[k]) return k;                  // 1. 显式角色（最准）
  const lr=(window.LIVE && LIVE.user && LIVE.user.role)||null;
  if(lr && ROLE_HOME[lr]) return lr;               // 2. 后端返回的真实角色
  if(typeof window.MOCKAPI==='object' && window.MOCKAPI.S && window.MOCKAPI.S.role
     && ROLE_HOME[window.MOCKAPI.S.role]){
    return window.MOCKAPI.S.role;                  // 3. 会话层（已有登录痕迹才采信）
  }
  const d=document.body.dataset.role;              // 4. 页面自带声明，最后兜底
  if(d && ROLE_HOME[d]) return d;
  return null;
}
/* 被守卫弹回来时给一句解释，别让人以为"点错了"。 */
/* 页面中文名（仅用于守卫提示语；未登记的页回落到文件名，不报错） */
const PAGE_CN={
  'student-journey.html':'我的闯关','student-courses.html':'课程库','student-me.html':'我的档案',
  'student-course.html':'课程详情','student-learn.html':'章节学习','student-level.html':'关卡详情',
  'mentor.html':'带教工作台','mentor-coach.html':'我的带教','mentor-mentee.html':'徒弟详情',
  'admin-dashboard.html':'数据看板','admin-tracking.html':'学习跟踪','admin-journey.html':'闯关总览',
  'admin-readiness.html':'转正达标线','admin-courses.html':'课程管理','admin-students.html':'学员管理',
  'admin-plans.html':'带教计划','admin-perms.html':'权限矩阵','admin-users.html':'用户管理'
};
function showGuardNotice(){
  let from='';
  try{ from=sessionStorage.getItem('etrainGuardFrom')||''; sessionStorage.removeItem('etrainGuardFrom'); }catch(e){}
  if(!from) return;
  toast('「'+(PAGE_CN[from]||from)+'」不属于你的工作台，已返回你的首页');
}

/* ---------- 5c. 未登录收敛（2026-10-05 · 用户需求「未登录只能看见首页内容」） ----------
   【要解决的现实问题】
   页面是静态文件，谁都能直接打开别人的端。未登录打开 admin-users.html 时，
   各页 render() 直读 mock-data.js 的静态种子（admin/M1/M2/S001 的真实工号+姓名），
   于是「没登录也能看到账号名册」。后端一次都没被调用（实测 calls=0），
   但**信息已经泄露在页面上了** —— 安全判据要看「数据从哪来」，不能只看接口。

   【为什么不用 location.replace 弹走】
   用户明确选了「停在原页显示请先登录」：URL 不变-> 用户知道自己刚才想看什么；
   浏览器「后退」也不会再被弹一次形成死循环。跳走只适用于「已登录但进错端」。

   【执行时机：必须在各页 render() 之前】
   各页自己的 DOMContentLoaded 监听器是**后注册**的，app.js 这个监听器先注册
   -> 按注册顺序执行 -> 本函数先跑，在 mock-data 被渲染进 DOM 之前就把 main 擦掉。

   注意： 但「先跑」不等于「跑完就没事」—— 实测（_dbg-needlogin.js）暴露**三个坑**：
     1. 各页 render() 仍会在**自己的**监听器里执行，而它 getElementById 的节点
        已被整个替换掉 -> 页面全部抛 `Cannot set properties of null`。
        -> 用 body 类名让各页 render() 短路（见下 needsLoginGate）。
     2. 只擦 <main> **不够**：顶栏是 <main> 的兄弟节点，各页 topbarHTML()/initNav()
        会往里渲染身份牌（真实姓名+工号）-> 实测「郑丽薪」照样出现在页面上。
        -> 顶栏一并擦掉。
     3. 沙盒判据**不能**写成「LIVE 不存在就是沙盒」：design-spec.html 不引
        mock-api-live.js（它不调后端），LIVE 全局压根不存在 -> 会被误判成沙盒而豁免，
        实测该页仍泄露 3 个真实姓名。
        -> 改成「只有**显式沙盒**才豁免」，判据见下。 */
/* 是不是「设计预览/沙盒」环境？
   注意： 判据必须只依赖**两个显式信号**，不能依赖 window.LIVE 是否存在：
     1. URL 带?sandbox=1 或 ?live=0
     2. localStorage.etrainLive === '0'（mock-api-live.js 的长期偏好键）
        【2026-10-09 P0-1】该信号只在**开发环境**（localhost/127.0.0.1/file:）仍算沙盒；
        正式域名忽略残留（mock-api-live.js initLiveFlag 同口径并自愈清除）——
        否则旧浏览器偏好会把正式用户静默切进演示数据（郑州/武汉校区不一致的根源）。
   这两者都与「页面有没有引mock-api-live.js」无关——
   而 design-spec.html 恰好不引它（它不调后端），只有这样才能一并判对。
   注意： 别改回读 window.LIVE：踩过两次（详见 requireLogin 上方注释）。*/
function isSandboxPreview(){
  try{
    const qs=new URLSearchParams(location.search);
    if(qs.get('sandbox')==='1') return true;
    if(qs.get('live')==='0') return true;
  }catch(e){}
  try{
    const h=location.hostname;
    const dev=(h==='localhost'||h==='127.0.0.1'||location.protocol==='file:');
    if(dev && localStorage.getItem('etrainLive')==='0') return true;
  }catch(e){}
  return false;
}
window.isSandboxPreview = isSandboxPreview;

function requireLogin(here){
  /* [红] 沙盒豁免：proto/ 是**设计预览**环境，靠 ?sandbox=1 / etrainLive='0' + protoRole
     直切视角来验收（10 个脚本都这么干，见 verify.js 的 addInitScript）。
     若不豁免，全部沙盒验收会在启动第一步就被擦成「请先登录」—— 改一处废整套验收。

     注意：【判据怎么定，两次踩坑的结论】
        第一版：`!(window.LIVE && LIVE.enabled === true)` ——「读不到 LIVE 就当沙盒」。
          错：design-spec.html 只引 app.js、不引 mock-api-live.js -> LIVE 恒为 undefined
          -> 被判成沙盒 -> 豁免 -> 未登录仍看到硬编码的 3 个真实姓名（实测复现）。
        第二版：只看 `LIVE.enabled === false`。也错：同样是 design-spec，它没有 LIVE，
          判据返回 undefined -> 不豁免 -> 沙盒验收里被擦成「请先登录」，
          verify.js 的 design-spec / login 两项基线当场失败（实测 165/1）。
        定案：**显式沙盒 = 「URL 带 sandbox=1/live=0」或「localStorage.etrainLive='0'」**，
        这两个信号都与「有没有加载 live 脚本」无关 -> 缺 LIVE 的页面也能正确判成沙盒。
        默认（都没读��到）按**线上**处理，收敛 —— 宁可多挡一次，不可漏挡姓名。*/
  const sandbox = isSandboxPreview();
  if(sandbox) return false;

  const cn = PAGE_CN[here] || '该页面';
  const box = document.querySelector('main') || document.body;
  /* 注意： 这里**不能**用 esc()：它定义在 ui.js，而 design-spec.html 只引 app.js、不引 ui.js
     -> 直接调用抛 `esc is not defined`（实测踩到）。
     PAGE_CN 是本文件里的**字面量表**（非用户输入），此处转义只需挡尖括号，最小防护即可。
     别为了"统一"去调 esc —— 各页脚本加载顺序不同，全局函数并非处处可用。 */
  const safeCn = String(cn).replace(/[<>&]/g, '');
  const gate =
    '<div class="needlogin">'+
      '<div class="needlogin-ico" aria-hidden="true">'+ic('i-user')+'</div>'+
      '<h1>请先登录</h1>'+
      '<p>「'+safeCn+'」是登录后才能查看的工作台内容。</p>'+
      '<a class="btn lg" href="'+pageUrl('pages/login.html')+'">去登录</a>'+
      '<p class="needlogin-why">账号由教务管理员统一创建，不提供自助注册。</p>'+
    '</div>';

  /*[红] 1. 先立标记，让各页 render() 一进来就自己退出（见 needsLoginGate）。
     顺序很关键：必须**先**加类，**后**擦 DOM —— 反了的话 render() 会在
     类名生效前已经开始跑，仍会报错。 */
  document.body.classList.add('needlogin-body');

  /* 2. 擦内容区。整块替换而不是逐个识别要挡的表格/KPI/卡片：
     各页要露的东西五花八门，逐个识别必然漏（这正是我第一版漏掉顶栏的原因）。 */
  box.innerHTML = gate;

  /* 3. 顶栏单独擦：它在 <main> 外面，但各页 topbarHTML()/initNav() 会往里塞
     「范文淼· 管理员」这类身份牌 -> 不擦等于没收敛。 */
  const tb = document.getElementById('topbarSlot');
  if(tb) tb.innerHTML = '';
  const nav = document.querySelector('.topbar');
  if(nav) nav.remove();

  /* 4. 隐藏浮层：遮罩/弹层/toast 容器一并清掉，避免残留上一次的内容。 */
  ['mask','modal','toasts'].forEach(id=>{const n=document.getElementById(id); if(n) n.innerHTML='';});

  return true;
}
/* 各页 render() 的统一短路闸：未登录收敛生效后，render 立刻返回，不再碰 DOM。
   —— 为什么必须有这个：
   各页 render() 是为「DOM 已渲染好」写的，里面全是 `document.getElementById(x).innerHTML=…`。
   requireLogin() 把 <main> 整个换掉之后，那些 getElementById 全部返回 null
   -> 8 个页面实测全部抛 `Cannot set properties of null`。
   在 app.js 里挂一个同名全局函数，各页 render() 首行调用即可**一处生效、20 页受益**。
   注意： 这属于「接线层」改动：不改任何业务规则、不改字段与接口，只在无登录态时不让它跑。 */
function needsLoginGate(){
  try { return document.body.classList.contains('needlogin-body'); } catch(e){ return false; }
}
window.needsLoginGate = needsLoginGate;
/* 首页是 4 角色共用落地页：路径为 / 或 /index.html 时 PAGE_ROLE 查不到 -> 视为共用，不跳走。 */
const hereFile=()=>(location.pathname.split('/').pop())||'index.html';
/* 公开营销页（index.html，data-public="1"）：给还没登录的人看。
   它不该出现任何登录身份 —— 没有姓名、没有角色密度档，右上角只有「登录」入口。
   所以整段身份注入在这里直接跳过，只渲染登录入口。 */
const isPublicPage=()=>document.body.dataset.public==='1';
/* 【2026-10-04 · 二次修正：改为**绝对路径**，不要再返回相对前缀】
   站点可挂两层，页面之间用**同级相对**链接（pages/xxx.html）：
     1. 沙箱：proto/index.html 与 proto/pages/* 同级          -> 相对链接天然可用
     2. 线上：落地页在 /training-courses/index.html，
            UI 页在 /training-courses/app/pages/*            -> 相对链接会丢一层，需补 'app/'
   判断依据 = 本脚本自身 URL 里「assets 的上一级目录名」：
     …/app/assets/app.js   -> assets 的上一级 = app   -> 站点根 /…/training-courses/app/
     …/proto/assets/app.js -> assets 的上一级 = proto -> 站点根 /…/training-courses/proto/

   注意：【为什么必须返回绝对路径，而不是 'app/' 这种相对前缀】
     首版返回 `'app/'`，只在**从落地页（/training-courses/）出发**时解析正确。
     而守卫是在 **pages/ 内部**触发跳转的：`location.replace('app/pages/student-journey.html')`
     相对当前 `/training-courses/app/pages/admin-dashboard.html` 解析
     -> `/training-courses/app/pages/app/pages/student-journey.html` -> **404**。
     表现极具迷惑性：URL 停在原页不跳（replace 失败）、后续脚本不再加载、
     连 `typeof injectIcons` 都是 undefined（浏览器已开始卸载该页）。
     -> 定案：用 currentScript.src 取到脚本绝对 URL，砍掉 'assets/app.js' 两段即得站点根。
       这样**从任意页面、任意深度**出发都解析到同一处，沙箱与线上共用一份代码。 */
const SITE_BASE=(()=>{try{
  const u=new URL(document.currentScript.src, location.href);   // 绝对化
  if(u.pathname.split('/').slice(-2)[0]!=='assets') return '';
  return u.pathname.replace(/assets\/app\.js$/, '');            // /…/app/ 或 /…/proto/
}catch(e){return '';}})();
const pageUrl=p=>SITE_BASE+p;                                   // 绝对路径，任意页面可用
/* 登录后按账号进不同工作面板：落点全在 ROLE_HOME 这一个表里，
   公开页与 login.html 共用它，两边不会各写一份而走偏。 */
const roleHomeUrl=k=>pageUrl('pages/'+ROLE_HOME[k]);
function initAuthSlot(){
  const box=document.getElementById('authSlot');if(!box)return;
  const k=sessionStorage.getItem('protoRole');
  const r=k&&ROLES[k]?ROLES[k]:null;
  // 已登录 -> 换成「进入工作台」并写明去哪；未登录 -> 「登录」
  box.innerHTML=r
    ?'<a class="btn sm" href="'+roleHomeUrl(k)+'">进入工作台</a>'
    :'<a class="btn sm" href="'+pageUrl('pages/login.html')+'">登录</a>';
  const t=document.getElementById('authWho');
  if(t)t.textContent=r?('已登录：'+r.name+' · '+r.role):'未登录';
}
/* ---------- 5b. 账号切换下拉（2026-10-05 新增，替代已废弃的 renderRoleMenu） ----------
   注意： 命名沿用 renderRoleMenu 是为了**不改 13 个页面的调用点**；语义已从「角色」变成「账号」。
   开关：ACCOUNT_SWITCHER_ENABLED（见 §6b）。关掉时本函数不输出任何 DOM，页面回到 10-04 的静态身份牌。 */
function renderRoleMenu(){
  if(!ACCOUNT_SWITCHER_ENABLED) return;
  const box=document.getElementById('acctMenu'); if(!box) return;
  const me=(typeof window.readIdentity==='function'&&window.readIdentity())
        || (window.LIVE&&LIVE.user&&LIVE.user.wid?LIVE.user:null)
        || {wid:(window.MOCKAPI&&MOCKAPI.S&&MOCKAPI.S.wid)||''};
  const list=accountList();
  /* 【2026-10-05 上线收口】真实后端（live）模式下，账号切换列表对普通用户隐藏：
     任何登录者都能一眼看到全站账号名单并一键跳登录页，属于演示便利而非业务功能。
     上线后下拉里只保留「退出登录」。沙盒演示模式（?sandbox=1 等）行为不变。 */
  const liveOn=(typeof window.LIVE!=='undefined'&&window.LIVE&&window.LIVE.enabled===true);
  if(liveOn){
    box.innerHTML=
      `<button type="button" class="acct-i acct-out" data-acct-logout="1" role="menuitem">`+
        `<span class="acct-ico" aria-hidden="true">${ic('i-logout')}</span>`+
        `<span class="acct-n"><b>退出登录</b><span>清除本机会话，需重新登录</span></span>`+
      `</button>`;
    const outOnly=box.querySelector('[data-acct-logout]');
    if(outOnly) outOnly.addEventListener('click',doLogout);
    return;
  }
  if(!list.length){ box.innerHTML=''; return; }
  box.innerHTML=
    `<div class="acct-t">切换账号</div>`+
    list.map(a=>{
      const cur=a.wid===me.wid;
      return `<button type="button" class="acct-i${cur?' cur':''}" data-acct-wid="${esc(a.wid)}" role="menuitem">
        <span class="avatar" aria-hidden="true">${esc(String(a.name).slice(0,1))}</span>
        <span class="acct-n"><b>${esc(a.name)}</b><span>${esc(a.wid)} · ${esc(UI.roleCN(a.role))}</span></span>
        ${cur?'<span class="acct-cur" aria-hidden="true">当前</span>':''}
      </button>`;
    }).join('')+
    /* 退出放在最后，用分隔线与「切换账号」区隔 —— 两组语义不同（换人 vs 走人），
       挤在一起容易误点。role="menuitem" + id 供无障碍与验收定位。 */
    `<div class="acct-sep" role="separator"></div>`+
    `<button type="button" class="acct-i acct-out" data-acct-logout="1" role="menuitem">`+
      `<span class="acct-ico" aria-hidden="true">${ic('i-logout')}</span>`+
      `<span class="acct-n"><b>退出登录</b><span>清除本机会话，需重新登录</span></span>`+
    `</button>`;
  box.querySelectorAll('[data-acct-wid]').forEach(b=>
    b.addEventListener('click',()=>doSwitchAccount(b.dataset.acctWid)));
  const outBtn=box.querySelector('[data-acct-logout]');
  if(outBtn) outBtn.addEventListener('click',doLogout);
}
function doSwitchAccount(wid){
  const r=switchAccount(wid);
  if(r==='off'){ toast('切换账号功能已关闭'); return; }
  if(r==='unknown'){ toast('账号不存在：'+wid,'err'); return; }
  /* switched / toLogin 都会立刻跳转，这里只兜底提示（不会看到）。 */
  if(r==='toLogin') toast('请用该账号的密码登录');
}
/* 下拉的开合。全部走 **document 事件委托**，不直接绑在 #acctBtn 上。
   注意： 为什么必须委托：顶栏是各页在 DOMContentLoaded **之后**才 innerHTML 挂上去的
     （见 ui.js topbarHTML 注释），此刻 getElementById('acctBtn') 拿到 null。
     绑元素 = 静默失效（这正是 10-04 「所有页面角色菜单都是空的」那个 bug 的同款成因）。
     委托绑在 document 上 = 无论顶栏何时挂载都能响应。 */
let _acctDocBound=false;
function bindAccountMenu(){
  if(!ACCOUNT_SWITCHER_ENABLED||_acctDocBound) return;
  _acctDocBound=true;
  const wrap=()=>document.getElementById('acctWrap');
  /* 注意： 形参叫 v 不叫 open：叫 open 会遮蔽外层的 let open，出现「点了没反应又关不掉」的死结。 */
  const setOpen=(w,v)=>{
    w.classList.toggle('open',v);
    const b=w.querySelector('#acctBtn');
    if(b) b.setAttribute('aria-expanded',v?'true':'false');
  };
  let open=false;
  document.addEventListener('click',e=>{
    const w=wrap(); if(!w) return;
    const btn=e.target.closest('#acctBtn');
    /* 注意：注意： setOpen 必须传**第二个参数**。classList.toggle(token) 不传 force 时是「切换」语义，
       传 undefined 也一样按「切换」处理 -> 会出现「菜单开了但 aria-expanded 写的是 false」
       的分裂状态（2026-10-05 实测踩到）。所以三处调用一律显式传 true/false。 */
    if(btn&&w.contains(btn)){ open=!w.classList.contains('open'); setOpen(w,open); return; }
    if(!w.contains(e.target)&&w.classList.contains('open')){ open=false; setOpen(w,false); }
  });
  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape') return;
    const w=wrap(); if(!w||!w.classList.contains('open')) return;
    open=false; setOpen(w,false);
    const b=w.querySelector('#acctBtn'); if(b) b.focus();
  });
}
function initRole(){
  if(isPublicPage()){initAuthSlot();return;}   // 公开页不注入身份
  const k=sessionStorage.getItem('protoRole')||document.body.dataset.role||'student';
  setRoleSilently(k);                          // 只渲染身份文案，不提供任何切换交互
  renderRoleMenu();                           // 账号切换下拉（开关关掉时为空操作）
  bindAccountMenu();
}

function setRoleSilently(k){
  const r=ROLES[k];if(!r)return;
  /* 【2026-10-04 · 方案 A 修复】优先用**真实登录身份**渲染身份牌，而不是 ROLES 常量表。
     注意： 背景：ROLES 是沙盒演示的固定表（学员恒=朱子悦/S001）。线上真实账号登录后，
        若仍走 ROLES，**张三登录也会显示「朱子悦」**（实测线上踩到）。
        真实身份由 mock-api-live 的 persistIdentity() 落进 sessionStorage.etrainWho。
     优先级：etrainWho（真实）> LIVE.user（内存，刷新后才有）> ROLES（沙盒）。 */
  const live=(typeof window.readIdentity==='function'&&window.readIdentity())
          || (window.LIVE&&LIVE.user&&LIVE.user.wid?LIVE.user:null);
  const nm=(live&&live.name)||r.name, rl=live?r.role:r.role, av=(nm||'?').slice(0,1);
  document.querySelectorAll('[data-who-name]').forEach(e=>e.textContent=nm);
  document.querySelectorAll('[data-who-role]').forEach(e=>e.textContent=rl);
  document.querySelectorAll('[data-who-av]').forEach(e=>e.textContent=av);
  document.body.className=document.body.className.replace(/role-\w+/g,'').trim()+' role-'+k;
  // Mock 会话：真实账号优先用其真实 wid；沙盒才回落到 ROLES 的演示 wid
  syncMockSession((live&&live.wid)||r.wid);
}

/* ---------- 6. 列表筛选 + 批量选择 ---------- */
function bindFilter(inputSel,itemSel){
  const inp=document.querySelector(inputSel);if(!inp)return;
  inp.addEventListener('input',()=>{
    const q=inp.value.trim().toLowerCase();
    let n=0;
    document.querySelectorAll(itemSel).forEach(it=>{
      const hit=!q||it.textContent.toLowerCase().includes(q);it.style.display=hit?'':'none';if(hit)n++;
    });
    const c=document.getElementById('filterCount');if(c)c.textContent=n;
  });
}
function bindSelectAll(masterSel,itemSel,onChange){
  const m=document.querySelector(masterSel);if(!m)return;
  m.addEventListener('change',()=>{
    document.querySelectorAll(itemSel).forEach(c=>{if(c.closest('[style*="display: none"]'))return;c.checked=m.checked;});
    onChange&&onChange();
  });
}

/* ---------- 7. 顶栏 chip 导航：当前项高亮 + 溢出提示 ---------- */
function initNav(){
  const here=hereFile();
  const nav=document.querySelector('.nav2');
  document.querySelectorAll('.nav2 a').forEach(a=>{
    // 去掉 ../ 前缀后比对，根路径 index.html 的 href="index.html" 才能正确高亮
    const href=(a.getAttribute('href')||'').split('/').pop();
    if(href===here){a.classList.add('on');a.setAttribute('aria-current','page');}
  });
  // chip 溢出时给导航区右侧加渐隐，提示"右边还有"（不占布局、不用 JS 判宽改结构）
  if(nav){
    const sync=()=>{
      const over=nav.scrollWidth-nav.clientWidth>2;
      nav.classList.toggle('has-over',over);
      nav.classList.toggle('at-end',nav.scrollLeft+nav.clientWidth>=nav.scrollWidth-2);
    };
    nav.addEventListener('scroll',sync,{passive:true});
    window.addEventListener('resize',sync);
    sync();
  }
}

/* ---------- 7b. 公开首页：chip 指向页内区块，需要滚动联动 ----------
   顶栏"始终在顶部"靠 CSS 的 position:sticky，但"当前在哪个区块"CSS 算不出来：
   页内锚点 href="#x" 在 initNav 里按 pathname 比对，永远命中不了。
   所以这里用 IntersectionObserver 观察各区块，进视口就给对应 chip 加 .on。
   不用 scroll 事件轮询 —— 滚动时被动监听会掉帧，Observer 由浏览器在合成线程触发。 */
function initScrollSpy(){
  const nav=document.querySelector('.nav2[data-spy]');
  if(!nav||!('IntersectionObserver' in window))return;
  const links={};
  nav.querySelectorAll('a[href^="#"]').forEach(a=>{
    const id=a.getAttribute('href').slice(1);
    if(document.getElementById(id))links[id]=a;
  });
  if(!Object.keys(links).length)return;
  const setOn=id=>{
    Object.keys(links).forEach(k=>links[k].classList.toggle('on',k===id));
  };
  setOn(Object.keys(links)[0]);
  const io=new IntersectionObserver(es=>{
    // 多个区块同时可见时取最靠上的那个，避免"往下滚 chip 反而跳回上一节"
    const vis=es.filter(e=>e.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top);
    if(vis[0])setOn(vis[0].target.id);
  },{rootMargin:'-45% 0px -50% 0px'});   // 只认"屏幕中部那条带"，进出都干脆
  Object.keys(links).forEach(id=>{const s=document.getElementById(id);if(s)io.observe(s);});
  // 顶部胶囊滚动后压缩：和 Duolingo 一致，但只用 2px 描边 + 尺寸变化，不用柔和投影
  const bar=document.querySelector('.topbar');
  if(bar)window.addEventListener('scroll',()=>{bar.classList.toggle('scrolled',window.scrollY>24);},{passive:true});
}

/* ---------- 8. 启动 ---------- */
document.addEventListener('DOMContentLoaded',()=>{
  /* 注意： 守卫必须**第一个**跑：不符就 replace 跳走，后续初始化全部不执行。
     放在 initRole/injectIcons 之前，避免先渲染出别人的界面再跳（会闪一下且浪费）。 */
  if(guardPage()) return;
  injectIcons();initRole();initNav();initScrollSpy();
  showGuardNotice();          // 若上一页是被守卫弹回来的，给一句解释
  const m=document.getElementById('mask');if(m)m.addEventListener('click',e=>{if(e.target===m)closeModal();});
  /* 原「点击空白处收起角色菜单」已随菜单移除（#roleMenu 不存在了）。 */
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
  // 页面内声明式交互：<button data-toast="提交成功"> / data-modal / data-confirm
  document.addEventListener('click',e=>{
    const t=e.target.closest('[data-toast]');
    if(t){toast(t.dataset.toast,t.dataset.toastKind||'');return;}
    const m2=e.target.closest('[data-modal]');
    if(m2){openModal(document.getElementById(m2.dataset.modal).innerHTML);return;}
    const c=e.target.closest('[data-confirm]');
    if(c){
      confirmBox(c.dataset.title||'确认操作',c.dataset.body||'该操作会写入线上数据，原型仅作演示。',
        c.dataset.ok||'okConfirm()',c.dataset.oklabel||'确认');
      return;
    }
  });
  // 声明式表单：<form data-form="loginForm" data-ok="toast('…')">
  // data-ok 里的 this 指向表单本身（用 .call(f) 传入），这样回调里可以 this.querySelector(...)
  document.querySelectorAll('form[data-form]').forEach(f=>
    bindForm(f.id,function(){const msg=f.dataset.ok;if(msg)(new Function('toast',msg)).call(f,toast);}));
});
