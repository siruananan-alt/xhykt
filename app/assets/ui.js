/* ============================================================
   ui.js · 共享 UI 层（管理端 9 页 + 导师端共用地基）
   ------------------------------------------------------------
   职责：
     1. 顶栏（9 项管理导航 / 3 项导师导航 / 3 项学员导航）统一生成
     2. 待办红点（todoCounts() 唯一口径，三级消费方：顶栏角标 / KPI / 预警）
     3. 状态 class 映射（mx 四态 / tag / tcard 五态）—— 全站唯一来源
     4. 14 个弹窗的打开函数（含逐字确认、prompt 打回、登记表）
     5. 表格渲染（tbl）与单元格（th/td）
     6. CSV 导出（带BOM）

   注意： 业务规则一律不写在本文件 —— 判定全在 mock-data.js，本文件只做表现层。
   规则出处：《原网站功能基线》/《差异矩阵》
   ============================================================ */

/* ---------- 顶栏 ---------- */
// 管理端固定 9 项，顺序与基线完全一致（看板 L1456 / tracking L1474 / journey L1695 /
// readiness L1897 / courses L1494 / students L1567 / plans L1578 / perms L1583 / users L1592）
const NAV_ADMIN = [
  ['admin-dashboard.html','看板'],
  ['admin-tracking.html',  '学习跟踪'],
  ['admin-journey.html',   '闯关总览'],
  ['admin-readiness.html', '转正达标线'],
  ['admin-courses.html',   '课程管理'],
  ['admin-students.html',  '学员管理'],
  ['admin-plans.html',     '带教计划'],
  ['admin-perms.html',     '权限矩阵'],
  ['admin-users.html',     '用户管理']
];
const NAV_MENTOR = [
  ['mentor.html','工作台'],
  ['mentor-coach.html','我的带教'],
  ['mentor-mentee.html','徒弟详情']
];
const NAV_STUDENT = [
  ['student-journey.html','我的闯关'],
  ['student-courses.html','课程库'],
  ['student-me.html','我的档案']
];

// enforceGate 开关：基线默认 false、**开启**需 confirm「开启闯关强制解锁？」
// 【已修正】原沙盒做成反向的「关闭强制解锁」，语义反了
function gateSwitchHTML(){
  const on=MOCK.DB.settings.enforceGate===true;
  return `<label class="gatesw" title="开启后学员只能按顺序闯关，未解锁课程的视频地址不下发">
    <span class="tag ${on?'ok':'ghost'}">${on?'强制解锁 已开':'强制解锁 已关'}</span>
    <input type="checkbox" id="gateSw" ${on?'checked':''}>
    <span class="sw" aria-hidden="true"></span>
  </label>`;
}

/* 注意：【2026-10-04 新增 opts.noNav】上下文页（如 student-level.html 关卡详情、mentee 徒弟详情）
   是从列表点进来的下级页，**不该进同级导航**（否则用户以为它是平级入口）。
   基线约束：这类页面的顶栏不得出现 .nav2。默认行为不变，只有显式传 noNav 才隐藏。 */
function topbarHTML(role,page,opts){
  opts = opts || {};
  const nav = role==='admin'?NAV_ADMIN : role==='student'?NAV_STUDENT : NAV_MENTOR;
  const brand2 = role==='admin'?'教务管理端' : role==='student'?'':'带教工作台';
  const chips = nav.map(([h,t])=>
    `<a href="${h}"${h===page?' class="on" aria-current="page"':''}>${t}</a>`).join('<i aria-hidden="true"></i>');
  const todo = role==='admin'||role==='mentor'
    ? `<button class="todo-btn" id="todoBtn" type="button" data-todo>待办<i class="dot" hidden></i></button>` : '';
  const gate = role==='admin'?gateSwitchHTML() : '';
  /* 注意：【2026-10-04 修正全站潜伏 bug】顶栏是**字符串**、由各页自己在 DOMContentLoaded 里
     `slot.innerHTML = UI.topbarHTML(...)` 挂载。而 app.js 的 DOMContentLoaded 是**最先注册**的
     （它是最早加载的脚本）-> 它跑 `initRole()` 时 #topbarSlot 还是空的 -> `#roleMenu` 拿到 null、
     `#roleBtn` 拿不到、click 监听也没绑。结果：**所有用 topbarSlot 的页面角色菜单都是空的**
     （实测 6 页 menuBtns=0）。历史上 verify.js 能过，只因当时 mentor.html 还是硬编码顶栏。
     修法：由 topbarHTML 自己**延迟一拍**做初始化 —— 调用方同一 tick 内已完成 innerHTML 赋值，
     setTimeout(...,0) 落地时 DOM 一定就绪。这样 20 个调用页一处修复、无需各补 initRole()。 */
  setTimeout(initTopbar, 0);
  /* 【2026-10-05】品牌区改为返回首页的链接。
     href 由 app.js 的 homeUrl() 算（站点挂两层，首页不在 SITE_BASE 里，见 app.js §6b）。
     注意： 用 aria-label 而不是 title：品牌区两行排布下 title 会在鼠标停留时
        覆盖出一个和两行文字打架的原生提示框。 */
  return `<header class="topbar">
  <div class="tb-in">
    <a class="brand" href="${homeUrl()}" aria-label="返回首页：企业内部学习站">
      <span class="logo">学</span>
      <span class="bn">企业内部学习站${brand2?`<span class="bn2">${brand2}</span>`:''}</span>
    </a>
    ${opts.noNav?'':`<nav class="nav2" aria-label="分类导航">${chips}</nav>`}
    ${todo}${gate}
    <div class="acct-wrap" id="acctWrap">
      <button type="button" class="role-chip" id="acctBtn" aria-haspopup="menu" aria-expanded="false"
              aria-controls="acctMenu" title="切换账号">
        <span class="avatar" data-who-av>范</span>
        <span class="who-txt"><span data-who-name>范文淼</span><span data-who-role>教务管理员</span></span>
        <span class="acct-caret" aria-hidden="true"></span>
      </button>
      <div class="acct-menu" id="acctMenu" role="menu" aria-label="切换账号"></div>
    </div>
  </div>
</header>`;
}

/* 顶栏挂载后的一次性收尾。
   【2026-10-04 · 方案 A】原「角色切换下拉菜单」是**沙盒原型演示工具**（可自由切换学员/导师/管理员视角）。
   真给团队用就是权限漏洞：任何登录者点一下就能进别人的工作台。
   已按用户决策**整体移除** —— 右上角改为**静态身份牌**（只显示"你是谁"，不可点、不可切）。
   角色由登录账号决定，前端不再提供任何手动切换入口。

   【2026-10-05 · 重新加回「切换账号」】用户需求：演示/验收时要能一键换账号看不同角色视角。
   风险与开关见 app.js §6b（ACCOUNT_SWITCHER_ENABLED，一个字即可全站下线）。
   与 10-04 的差异（有意为之，别误改回去）：
     1. 粒度从「角色」改成「**账号**」—— 真实存在 4 个账号（M1/M2 同为导师但不同人），
        按角色切会分不出 M1 和 M2。
     2. live 真实后端模式下**不静默改身份**（token 才是真身份）-> 降级为跳登录页预填工号。

   注意：【必须在这里重刷身份】topbarHTML 产出的身份牌带着**硬编码默认值**（范文淼）。
   app.js 的 initRole() 在 DOMContentLoaded 里跑，而顶栏是各页**稍后**才 innerHTML 挂上去的
   -> initRole 执行时 [data-who-name] 还不存在，写了个空；#acctMenu 更是还不存在。
   若这里不补一次，身份牌会永远显示默认的「范文淼 教务管理员」——**无论谁登录**（实测踩到），
   账号菜单也会因为找不到 #acctMenu 而永远是空的。
   修法：挂载后按**当前会话身份**重刷文案 + 重建菜单。优先级：
     1. 真实登录身份（sessionStorage.etrainWho，由 mock-api-live.persistIdentity 落盘）
     2. 沙盒 Mock 会话（MOCKAPI.S，真实用户不在其中时会落空）
     3. protoRole / data-role -> setRoleSilently 兜底 */
function initTopbar(){
  if(typeof renderRoleMenu==='function'){
    try{ renderRoleMenu(); }catch(e){ /* 公开页无 #acctMenu -> 空操作 */ }
  }
  if(typeof setRoleSilently==='function'){
    const k=sessionStorage.getItem('protoRole')||document.body.dataset.role;
    if(k){ try{ setRoleSilently(k); return; }catch(e){ /* 落到下面兜底 */ } }
  }
  /* 无 protoRole（公开页等）：至少按真实/Mock 身份刷一次文案 */
  const live=(typeof window.readIdentity==='function'&&window.readIdentity())
          || (window.MOCKAPI&&MOCKAPI.S&&MOCKAPI.S.wid?MOCKAPI.S:null);
  if(live&&live.name){
    document.querySelectorAll('[data-who-name]').forEach(e=>e.textContent=live.name);
    document.querySelectorAll('[data-who-av]').forEach(e=>e.textContent=String(live.name).slice(0,1));
  }
}

/* ---------- 待办红点：唯一口径 = MOCK.todoCounts() ---------- */
function refreshTodoDot(wid){
  const btn=document.getElementById('todoBtn'); if(!btn) return;
  const c=MOCK.todoCounts(wid);
  btn.innerHTML='待办'+` <b class="tb-n">${c.total||''}</b>`+'<i class="dot" hidden></i>';
  btn.querySelector('.dot').hidden = c.total===0;
}

/* ---------- 状态 class 映射（mx 四态，全站唯一来源） ---------- */
// PRD 硬约束：四态必须「形状+颜色+符号三重编码」，色弱/黑白打印也能读
// m 恒等于该关实际存在的环节数（学/练/考，最多 3）——【已修正】原沙盒出现 1·4/1·2/0·2
function mxCell(wid,lv,opts){
  opts=opts||{};
  const unlocked=MOCK.levelUnlocked(wid,lv);
  if(!unlocked) return `<span class="mx lock" title="未解锁（需先通过第 ${lv.no-1} 关）">—</span>`;
  const p=MOCK.levelProgress(wid,lv);
  const cur = MOCK.currentLevelOf(wid).id===lv.id;
  const cls = p.done===p.total ? 'ok' : (p.done>0 ? 'doing' : 'todo');
  const sym = cls==='ok'?'<svg class="ic"><use href="#i-check"/></svg>' : (cls==='doing'? `${p.done}·${p.total}` : '·');
  const detail = MOCK.LV_STAGES
    .filter(s=>lv.stages&&lv.stages[s])
    .map(s=>`${MOCK.LV_STAGE_CN[s]}${p.states.find(x=>x.stage===s).ok?' 已过':' 未过'}`)
    .join(' · ');
  return `<span class="mx ${cls}${cur?' cur':''}" title="${esc(lv.title)} · ${detail}${cur?' · 当前关':''}">${sym}</span>`;
}
function mxLegend(){
  return `<div class="mxlegend">
    <span><span class="mx ok"><svg class='ic'><use href='#i-check'/></svg></span> 全部环节通过</span>
    <span><span class="mx doing">1·3</span> 已过 1 / 共 3 环节</span>
    <span><span class="mx todo">·</span> 已解锁未开始</span>
    <span><span class="mx lock">—</span> 未解锁（前置未过）</span>
    <span><span class="mx doing cur">2·3</span> 3px 深墨描边 = 当前所在关卡</span>
  </div>`;
}

/* ---------- PRD 5.3-A 阶段进度条 .stagebar（唯一渲染器） ----------
   3 阶段 × 5 周是平台的时间骨架。渲染规则：
     · done  绿实底  = 该阶段**全部关卡**都通过
     · cur   绿描边  = 当前阶段（含"已过 n / 共 m"）
     · 其余  灰虚边  = 未开始
   注意： 阶段归属只读 MOCK.LEVEL_PHASES（后端 LEVEL_PHASES 镜像），
      不要按 level.no 手写 1-6/7-9/10-12 —— 那会在调整关卡数时静默错位。
   注意： 分母 = 该阶段**实际存在的关卡数**（levels 过滤），不是硬编码 6/3/3。 */
function stagebar(wid){
  const phases = MOCK.LEVEL_PHASES;
  const lvDone = lv => MOCK.levelDone(wid, lv);
  const curLv  = MOCK.currentLevelOf(wid);
  const curNo  = curLv ? curLv.no : 1;
  const cells = phases.map(ph=>{
    const inPh = MOCK.DB.levels.filter(l=>l.no>=ph.from && l.no<=ph.to);
    const done = inPh.filter(lvDone).length;
    const total= inPh.length;
    const allDone = total>0 && done===total;
    // 当前阶段 = 含"当前关"的那一段（若三段全过则无当前段）
    const isCur = !allDone && curNo>=ph.from && curNo<=ph.to;
    const cls = allDone ? 'done' : (isCur ? 'cur' : '');
    const pgTxt = allDone
      ? `${total}<small>/ ${total} 关 · 已通关</small>`
      : isCur
        ? `${done}<small>/ ${total} 关 · 进行中</small>`
        : `${done}<small>/ ${total} 关</small>`;
    return `<div class="stg ${cls}">
      <div class="nm">${allDone?'<svg class="ic"><use href="#i-check"/></svg> ':''}${esc(ph.name)}</div>
      <div class="wk">${esc(ph.week)} · L${String(ph.from).padStart(2,'0')}–L${String(ph.to).padStart(2,'0')}</div>
      <div class="pg">${pgTxt}</div>
    </div>`;
  }).join('');
  // 收口小字：第几周 · 还剩几关 · 转正还差几条达标线
  const allLv = MOCK.DB.levels.length;
  const doneLv= MOCK.DB.levels.filter(lvDone).length;
  const curPh = phases.find(p=>curNo>=p.from && curNo<=p.to);
  const leftLv= allLv-doneLv;
  const leftRd= MOCK.READINESS_LINES.filter(l=>!readinessMeta(l,wid).met).length;
  // 注意： LEVEL_PHASES[].week **自带「第 N 周」**（如 '第 1 周'），别再套一层「第」。
  const foot = `${curPh?esc(curPh.week):'—'} · 还剩 ${leftLv} 关 · 转正还差 ${leftRd} 条达标线`;
  return `<div class="stagebar">${cells}</div><div class="hint" style="margin:-6px 0 var(--s3)">${foot}</div>`;
}

/* 把 readinessBadge 的结论统一成 {met, ok, val, tag} —— 供 stagebar 小字与徽章网格共用 */
function readinessMeta(line, wid){
  const b=readinessBadge(line.key,wid);
  return { met:b.cls==='ok', ok:b.cls==='ok', val:b.val, tag:b.tag, badge:b };
}

/* ---------- PRD 5.3-B 转正达标线徽章 4 张贴纸卡 .rd-badge ----------
   转正是这个平台唯一的终点。做成格子而不是列表：
     · 绿实心 = 已达成
     · 绿描边 = **已达标但数值未登记**（最需要管理员补录的状态 —— PRD 明确要求单独做出来）
     · 灰     = 未达标
   注意： 飞书来源的三条必须标「以飞书为准」，否则学员会以为是系统自动判的。 */
function rdBadgeGrid(wid){
  const cells = MOCK.READINESS_LINES.map(line=>{
    const b=readinessBadge(line.key,wid);
    const isSite=line.source==='site';
    // 三态口径**只从 readinessBadge 取**（唯一口径），本函数不再自己算 hasRec。
    // 注意：【2026-10-04 修正】原实现就地重算 hasRec，与 readinessBadge 的判定分家 ->
    //    同一份数据两处结论不一致（badge 说 no，格子说 todo）。已改为读 b.hasRec。
    const cls = b.cls==='ok' ? 'ok' : (b.hasRec?'no':'todo');
    const icon=['i-book','i-chart','i-film','i-users'][MOCK.READINESS_LINES.indexOf(line)]||'i-book';
    return `<div class="rd-badge ${cls}" title="${esc(line.name)} · ${esc(line.rule)}">
      <span class="rb-ic" data-ic="${icon}"></span>
      <b>${esc(line.name)}</b>
      <span class="rb-val">${esc(b.val)}</span>
      <span class="rb-src">${isSite?'系统自动':'以飞书为准'}</span>
    </div>`;
  }).join('');
  return `<div class="rd-badges">${cells}</div>`;
}

// 任务卡五态：未提交 / 待审核 / 已通过 / 已打回 / 未解锁（PRD 5.3-C 硬约束：
// 「待审核」是全站唯一需要另一个人介入的状态 -> 橙+脉冲；「已打回」必须显示原因）
function taskCardClass(rec){
  if(!rec) return '';
  if(rec.status==='passed')    return 'done';
  if(rec.status==='rejected')  return 'rej';
  if(rec.status==='submitted') return 'wait pulse';
  return '';
}
function taskTagHTML(rec){
  if(!rec)              return '<span class="tag ghost">未提交</span>';
  if(rec.status==='passed')   return '<span class="tag ok">已通过</span>';
  if(rec.status==='submitted')return `<span class="tag warn pulse">${MOCK.TASK_ST_CN.submitted}</span>`;
  if(rec.status==='rejected') return '<span class="tag danger">已打回</span>';
  return '<span class="tag ghost">未提交</span>';
}

/* ---------- 表格 ---------- */
// 基线 8 张表统一套 .tblwrap 横向滚动（手机端溢出已归零，见 check-mobile.js）
function tbl(headers,rows,cls){
  return `<div class="tblwrap"><table class="${cls||''}">
  <thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>
  <tbody>${rows.join('')}</tbody></table></div>`;
}
function tr(cells,attrs){ return `<tr ${attrs||''}>${cells.map(c=>`<td>${c}</td>`).join('')}</tr>`; }

// 达标线徽章 4 张贴纸卡（PRD 5.3-B）
// 三态：绿实心=已达成 / 绿描边=已达标但数据未登记（最需要管理员补录）/ 灰=未达标
// 注意：【2026-10-04】阈值一律走 MOCK.effectiveThreshold()，**禁止**再读 line.threshold ——
//    管理端改过阈值后，直读常量会显示旧数值（"改了没生效"的假 bug）。
/* 达标线徽章（PRD 5.3-B）—— **唯一口径**，所有消费方（管理端明细 / 学员徽章格 /
   学员我的页）都必须读本函数的返回值，不得自己重算 met / hasRec。
   注意：【2026-10-04】阈值一律走 MOCK.effectiveThreshold()，**禁止**再读 line.threshold ——
      管理端改过阈值后，直读常量会显示旧数值（"改了没生效"的假 bug）。
   返回：{ cls:'ok'|'no', met, hasRec, name, val, tag, src, rec, line, eff }
     · met    = 是否达标（study 走关卡全通，其余严格 met===true）
     · hasRec = 是否有登记记录（study 恒 true；其余看 value/met 是否有值）
       -> 三态渲染 = met?'ok' : (hasRec?'no':'todo')，由消费方按此式得出，不另立规则 */
function readinessBadge(lineKey, wid){
  const line=MOCK.READINESS_LINES.find(l=>l.key===lineKey);
  const eff =MOCK.effectiveThreshold(lineKey);
  const rec=MOCK.DB.readiness[wid]||{};
  const r=rec[lineKey];
  if(lineKey==='study'){
    const done=MOCK.DB.levels.filter(l=>MOCK.levelDone(wid,l)).length;
    const ok=MOCK.DB.levels.length>0 && done===MOCK.DB.levels.length;   // 空关卡不判通关
    return { cls:ok?'ok':'no', met:ok, hasRec:true, name:line.name,
             val:`${done} / ${MOCK.DB.levels.length} 关`,
             tag:ok?'已通关':'进行中', src:'系统自动', eff };
  }
  const v=r?r.value:null, ok=!!(r&&r.met===true);   // 基线：met 严格 === true
  const hasRec=!!(r&&(r.value!=null||r.met!=null));
  return { cls:ok?'ok':'no', met:ok, hasRec, name:line.name,
           val: v===null?'—':`${v} / ${eff.threshold} ${eff.unit}`,
           tag: ok?'已达标':(hasRec?'未达标':'未登记'), src:'飞书', rec:r, line, eff };
}

/* ---------- 待批改清单（唯一口径，批量通过两入口共用） ----------
   返回该角色可见范围内的所有 submitted 条目，带可读标签。
   与 todoCounts() 同源同规则：admin 全站 / mentor 只自己徒弟 / 学员只自己。
   注意： 批量通过**必须**逐条过 canReview —— 本函数只负责"列出候选"，
      不负责"是否可批"（后者由 mockBulkPass 逐条判定）。 */
function pendingList(wid){
  const role=MOCK.userOf(wid).role;
  let wids=[];
  if(role==='admin')       wids=MOCK.DB.trainees.map(t=>t.id);
  else if(role==='mentor') wids=MOCK.DB.trainees.filter(t=>t.mentorId===wid).map(t=>t.id);
  else                     wids=[wid];
  const out=[];
  wids.forEach(w=>{
    const t=MOCK.traineeOf(w); if(!t) return;
    const byLv=MOCK.DB.tasks[w]||{};
    Object.keys(byLv).forEach(lvId=>{
      const one=byLv[lvId]||{};
      Object.keys(one).forEach(taskId=>{
        const r=one[taskId]; if(!r||r.status!=='submitted') return;
        const isExam=taskId===MOCK.EXAM_TASK;
        const def=MOCK.TASK_DEFS.find(d=>d.id===taskId);
        const lv=MOCK.levelOf(lvId);
        out.push({
          tid:w, lvId, taskId, isExam,
          traineeName:t.name,
          label: isExam ? ('第 '+lvId.slice(1)+' 关考核') : ((def&&def.title)||taskId),
          note: r.note||'', at: r.at||'',
          lvTitle: (lv&&lv.title)||'',
          by: r.byName||w
        });
      });
    });
  });
  // 排序：先按学员工号，再按关卡号（与矩阵行序一致，便于逐行核对）
  out.sort((a,b)=> a.tid===b.tid
    ? (Number(a.lvId.slice(1))-Number(b.lvId.slice(1)))
    : (a.tid<b.tid?-1:1));
  return out;
}

/* 批量通过「复选框清单」——两入口共用一个渲染器，避免各写一份走偏 */
function bulkListHTML(list){
  if(!list.length) return '<div class="empty"><div class="big"><svg class="ic"><use href="#i-party"/></svg></div><b>没有待批改的提交</b></div>';
  return list.map((p,i)=>`
    <label class="check" data-bulk-i="${i}">
      <input type="checkbox" class="bsel" data-tid="${esc(p.tid)}" data-lv="${esc(p.lvId)}" data-task="${esc(p.taskId)}">
      <span><b>${esc(p.traineeName)}（${esc(p.tid)}）· ${esc(p.label)}</b>
        <span class="tag ghost">${p.isExam?'考 环节':'练 环节'}</span><br>
        <span style="color:var(--muted);font-size:12.5px">${esc(p.by)} 提交${p.at?(' · '+esc(String(p.at).slice(0,16).replace('T',' '))):''}${p.note?(' · '+esc(p.note.slice(0,60))):''}</span>
      </span>
    </label>`).join('');
}

// 提交后被跳过的条目（越权 / 状态已变）——回显明细，绝不静默吞掉
function bulkSkipHTML(skip){
  if(!skip||!skip.length) return '';
  return `<div class="note danger" style="margin-top:var(--s3)">已跳过 ${skip.length} 条：${
    skip.map(s=>`${esc(s.tid)} ${esc(s.lvId)} ${esc(s.taskId)}——${esc(s.why)}`).join('；')}</div>`;
}

/* ---------- 弹窗 ---------- */
// 全部走 app.js 的 openModal(html)，零抽屉（基线无抽屉）
function modal(title, body, footer){
  return `<div class="m-h"><h2>${esc(title)}</h2><span class="x" onclick="closeModal()">×</span></div>
  <div class="m-b">${body}</div>
  <div class="m-f">${footer||'<button class="btn ghost" onclick="closeModal()">取消</button><button class="btn" onclick="closeModal()">知道了</button>'}</div>`;
}
function fld(label, inner, tip){
  return `<div class="fld"><label>${label}</label>${inner}${tip?`<div class="tip">${tip}</div>`:''}</div>`;
}

/* ---------- 学员端三弹窗（基线 openPlayer L1092 / openSync L1140 / openQuiz L1155） ---------- */
// 9. 播放器。V2 第2层闸门在这里。
//    【2026-10-06 改】学员看课零手动操作：倍速/断点/模拟拖拽三个填报字段与「标记本章完成」
//    按钮已全部移除，改为视频自然播完（ended 事件）自动 mockMarkDone 落库。
//    mockMarkDone 内部对缺失的 #spd/#rs/#dr 有 ||{} 防御，speed 默认 1，链路不变。
//    无 src 的占位章节无法自动完成 -> 由管理端代录兜底（服务端既有能力）。
function openPlayer(cid, chid, wid){
  wid = wid || MOCKAPI.S.wid;
  if(MOCK.courseLocked(cid, wid)){ toast(MOCK.lockReason(cid, wid),'warn'); return; }
  const c=MOCK.courseOf(cid); if(!c) return;
  const ch=c.chapters.find(x=>x.id===chid); if(!ch) return;      // 防御：章节不存在直接返回
  const player = (ch.type==='video' && ch.src)
    ? `<video src="${esc(ch.src)}" controls playsinline preload="metadata"
         onended="mockMarkDone('${cid}','${chid}','complete','')"
         style="width:100%;border-radius:12px;background:#000;max-height:62vh"></video>
       <p class="sub" style="margin:10px 0 0">看完自动记录完成。</p>`
    : `<div style="background:var(--ink);color:#e2e8f0;border-radius:12px;padding:36px;text-align:center;font-size:13px">
         视频播放区（演示占位）${ch.src?'':' · 该章节视频尚未上传'}</div>`;
  openModal(`<div class="m-h"><h2>${esc(ch.title)}</h2><span class="x" onclick="closeModal()">×</span></div>
   <div class="m-b">
     ${player}
   </div>`);
}
// 10. 带教同频确认：只写 mentee，mentor 必须导师端确认（服务端强制，绕不过）
function openSync(cid, chid){
  openModal(modal('带教同频确认',
    `<div class="note ok" style="margin:0 0 12px">你先确认并提交反思；导师在「导师端」确认后，后续章节才会解锁。</div>
     ${fld('反思 *',`<textarea id="note" rows="4" placeholder="例如：已完成账号资料，头像与简介按规范填写，请导师确认。"></textarea>`,
       '反思必填，不能空提交')}`,
    `<button class="btn ghost" onclick="closeModal()">取消</button>
     <button class="btn" onclick="mockSubmitSync('${cid}','${chid}')">我确认已与导师同频</button>`));
}
// 11. 随堂测验：交卷判分，错题进错题本
function openQuiz(cid, chid){
  const c=MOCK.courseOf(cid); if(!c) return;
  const ch=c.chapters.find(x=>x.id===chid); if(!ch) return;
  const qs=ch.questions||[];
  if(!qs.length){ toast('该测验暂未录入题目','warn'); return; }
  openModal(`<div class="m-h"><h2>${esc(ch.title)}</h2><span class="x" onclick="closeModal()">×</span></div>
   <div class="m-b">
     ${qs.map((q,i)=>`<div style="margin-bottom:14px">
       <div style="font-weight:600">${i+1}. ${esc(q.q)}</div>
       ${q.a.map((a,j)=>`<label style="display:block;margin:4px 0;font-weight:400;color:var(--text)">
         <input type="radio" name="q${i}" value="${j}"> ${esc(a)}</label>`).join('')}
     </div>`).join('')}
     <button class="btn" onclick="gradeQuiz('${cid}','${chid}',this)">提交批改</button>
     <div id="quizRes"></div>
   </div>`);
}
function gradeQuiz(cid, chid, btn){
  const c=MOCK.courseOf(cid); if(!c) return;
  const ch=c.chapters.find(x=>x.id===chid); if(!ch) return;
  const qs=ch.questions||[];
  let score=0; const wrong=[];
  qs.forEach((q,i)=>{
    const sel=document.querySelector(`input[name=q${i}]:checked`);
    const v=sel?parseInt(sel.value,10):-1;
    if(v===q.ans) score++; else wrong.push({ q:q.q, a:q.a[q.ans] });
  });
  // 复用 mockMarkDone：type=quiz 不进 done 数组，只记 wrong + 事件
  mockMarkDone(cid, chid, 'quiz', '得分 '+score+'/'+qs.length, { wrong });
  const res=document.getElementById('quizRes');
  if(res) res.innerHTML=`<div class="note ok" style="margin-top:12px">得分 <b>${score}/${qs.length}</b>。${
    wrong.length ? ('错题已记入错题本：'+wrong.map(w=>'《'+esc(w.q)+'》正确答案：'+esc(w.a)).join('；')) : '全部正确！'}</div>`;
}


/* 12. 批量通过 openBulkPass —— 原 trainer.html 批量区迁到管理端两入口
   基线原文（trainer.html L172-175 / L199 / L202-203）逐字保留：
     · 说明：只适用于**纯口述、答案唯一**的考核（第 1 关「业务怎么跑」这类）。
             实操类（第 7 关模板剪辑、第 8 关加微数据）**不能批量**——那必须逐条看。
     · 确认框：确认批量通过？/ 将对所选的纯口述类考核一键通过。通过后会立即解锁下一关，
       学员端马上能看到。+ <b>建议：</b>批量前抽查 1 条，确认答案口径没问题。
   注意： 与基线唯一的不同：基线把"纯口述/实操"写死在 HTML 的 disabled 上；
      这里没有这个字段可依据，改成**逐条走 canReview 权限判定**，越权条目自动跳过并回显原因。
      —— 这才符合「admin 与导师平行可审」的真实规则，且不会误批别人的徒弟。 */
function openBulkPass(list){
  const items = Array.isArray(list) ? list : pendingList(MOCKAPI.S.wid);
  openModal(`<div class="m-h"><h2>批量通过</h2><span class="x" onclick="closeModal()">×</span></div>
  <div class="m-b">
    <div class="note warn">
      只适用于<b>纯口述、答案唯一</b>的考核（第 1 关「业务怎么跑」这类）。
      实操类（第 7 关模板剪辑、第 8 关加微数据）<b>不能批量</b>——那必须逐条看。
      <br>你只能批<b>自己有权审核</b>的条目，其余会被自动跳过并列出原因。
    </div>
    ${items.length?`
      <label class="check" style="border-bottom:2px solid var(--line);padding-bottom:10px">
        <input type="checkbox" id="bselAll">
        <span><b>全选当前列表</b>（勾上后批量按钮才可用）</span>
      </label>
      <div id="bselList" style="margin:var(--s3) 0">${bulkListHTML(items)}</div>`:bulkListHTML(items)}
    <div id="bskipBox"></div>
  </div>
  <div class="m-f">
    <span class="hint" id="bulkHint" style="margin-right:auto">未选择时按钮为 <b>disabled</b>。</span>
    <button class="btn ghost" onclick="closeModal()">取消</button>
    <button class="btn warn" id="bulkBtn" disabled onclick="doBulkPass()">批量通过（0）</button>
  </div>`);
  bindBulkSelect();
}
function bindBulkSelect(){
  const list=document.getElementById('bselList'); if(!list) return;
  const btn=document.getElementById('bulkBtn'), hint=document.getElementById('bulkHint');
  function sync(){
    const bs=[...document.querySelectorAll('.bsel:not([disabled])')];
    const n=bs.filter(c=>c.checked).length;
    if(btn){ btn.textContent='批量通过（'+n+'）'; btn.disabled=n===0; }
    if(hint) hint.innerHTML = n===0
      ? '未选择时按钮为 <b>disabled</b>。'
      : '已选 <b>'+n+'</b> 条。';
  }
  const all=document.getElementById('bselAll');
  if(all) all.addEventListener('change',()=>{
    document.querySelectorAll('.bsel:not([disabled])').forEach(c=>c.checked=all.checked);
    sync();
  });
  document.querySelectorAll('.bsel').forEach(c=>c.addEventListener('change',sync));
  sync();
}
function doBulkPass(){
  const sel=[...document.querySelectorAll('.bsel')].filter(c=>c.checked)
    .map(c=>({ tid:c.dataset.tid, lvId:c.dataset.lv, taskId:c.dataset.task }));
  if(!sel.length) return;
  // 注意： 确认框会替换掉 .mask 里的 DOM —— 必须**先把选择快照到 window**，
  //    否则确认时 .bsel 已不存在，runBulkPass 会拿到空数组（曾经的经典 bug）。
  window.__bulkSel=sel;
  const body=`将对所选的 <b>${sel.length}</b> 条纯口述类考核一键通过。通过后会立即解锁下一关，学员端马上能看到。<br><br>
    <b>建议：</b>批量前抽查 1 条，确认答案口径没问题。`;
  confirmBox('确认批量通过？', body, 'runBulkPass()', '确认批量通过');
}
function runBulkPass(){
  const list=window.__bulkSel||[]; window.__bulkSel=null;
  const res=MOCKAPI.mockBulkPass(list);
  closeModal();
  if(res.skip.length) setTimeout(()=>toast('已跳过 '+res.skip.length+' 条（权限/状态已变）','warn'),300);
}

/* 1. 代录闯关结果 openJourney（L1786）*/
function openJourney(tid){
  const t=MOCK.traineeOf(tid); if(!t) return toast('找不到该学员','err');
  const rows=MOCK.DB.levels.map(lv=>{
    const p=MOCK.levelProgress(tid,lv);
    const btns=MOCK.LV_STAGES.filter(s=>lv.stages&&lv.stages[s]).map(s=>
      `<button class="btn sm ${p.states.find(x=>x.stage===s).ok?'':'ghost'}" onclick="mockSetJourney('${tid}','${lv.id}','${s}',${p.states.find(x=>x.stage===s).ok?0:1})">${MOCK.LV_STAGE_CN[s]}${p.states.find(x=>x.stage===s).ok?' 已过':' 记通过'}</button>`).join('');
    return `<div class="rowitem"><div class="mid"><b>第 ${lv.no} 关 · ${esc(lv.title)}</b>
      <div class="d">${p.done} / ${p.total} 环节已过</div>
      <div class="acts">${btns}</div></div></div>`;
  }).join('');
  openModal(modal('代录闯关结果',
    `<div class="note warn"><b>${esc(t.name)}（${t.id}）</b> · 代录写入的是 <code>journey.json</code>，学员端「下一关」立即重算。
     代录记录<b>没有</b> <code>auto</code> 字段（基线 L1413），与审核写入不同。</div>
     <div class="jump-list">${rows}</div>`,
    '<button class="btn ghost" onclick="closeModal()">关闭</button>'));
  return true;
}
// 2. 批改提交 openAdminReview（L1820）—— admin 兜底，显示 req 与 attempts
function openAdminReview(tid){
  const t=MOCK.traineeOf(tid); if(!t) return toast('找不到该学员','err');
  const pend=[];
  Object.keys(MOCK.DB.tasks[tid]||{}).forEach(lvId=>{
    const byT=MOCK.DB.tasks[tid][lvId];
    Object.keys(byT).forEach(tid2=>{
      const r=byT[tid2];
      if(r&&r.status==='submitted') pend.push({lvId,taskId:tid2,...r});
    });
  });
  const items=pend.length?pend.map(p=>{
    const def=MOCK.TASK_DEFS.find(d=>d.id===p.taskId);
    const stage=p.taskId===MOCK.EXAM_TASK?'exam':'practice';
    const attempts=(p.reviewedAt?2:1);
    return `<div class="tcard wait">
      <div class="tcard-h"><span class="tag warn pulse">${MOCK.TASK_ST_CN.submitted}</span><b>${p.taskId===MOCK.EXAM_TASK?p.lvId+' 关考核':esc((def&&def.title)||p.taskId)}</b></div>
      <p class="req">${esc(p.note||'（无说明）')}</p>
      <p class="sub">提交于 ${esc(p.at||'')} · 第 ${attempts} 次${p.reviewNote?` · 上次打回：${esc(p.reviewNote)}`:''}</p>
      <div class="acts">
        <button class="btn sm" onclick="mockReview('${tid}','${p.lvId}','${p.taskId}',1)">通过</button>
        <button class="btn sm ghost danger" onclick="askRejectReason('${tid}','${p.lvId}','${p.taskId}')">打回</button>
      </div></div>`;
  }).join('') : `<div class="empty"><div class="big"><svg class='ic'><use href='#i-party'/></svg></div><b>没有待批改的提交</b></div>`;
  openModal(modal('批改提交',
    `<div class="note warn"><b>${esc(t.name)}（${t.id}）</b> · 待批改 ${pend.length} 条 · 你是管理员（兜底权限，可审练+考）
     <br>管理员弹层比其他两处<b>多显示</b> req（学员提交说明）与 attempts（第几次提交）。</div>${items}`,
    '<button class="btn ghost" onclick="closeModal()">关闭</button>'));
  return true;
}
// 3. 开启强制解锁？ toggleGate（L1860）—— 基线默认关、开启需确认
function openGateConfirm(){
  const on=MOCK.DB.settings.enforceGate===true;
  openModal(modal(on?'关闭强制解锁？':'开启闯关强制解锁？',
    `<div class="note ${on?'warn':'danger'}">${on
      ? '关闭后，学员可以跳关直接看后面的课程。影响：失去「必须按顺序闯关」的约束；学员可能跳过任务卡训练。<br>建议：只有在紧急补救（如某关卡视频下架）时才临时关闭。'
      : '开启后，学员只能按顺序闯关：看第 N 关 <svg class="ic"><use href="#i-arrow-dl"/></svg> 第 N−1 关全过。未解锁课程的<b>视频地址不会下发</b>到学员端。<br>影响：L01–L04 目前只有管理和考，没有任务卡 —— 开启后学员在第 5 关前就会卡住，请先确认代录已补齐。'}</div>`,
    `<button class="btn ghost" onclick="closeModal()">取消</button>
     <button class="btn" onclick="mockSetGate(${on?0:1})">${on?'关闭强制解锁':'确认开启'}</button>`));
}
// 4. 转正达标线登记 openReadiness（L1922）—— 按 source 分支
function openReadiness(tid, key){
  const t=MOCK.traineeOf(tid);
  const line=MOCK.READINESS_LINES.find(l=>l.key===key);
  if(line.source==='site'){
    const done=MOCK.DB.levels.filter(l=>MOCK.levelDone(tid,l)).length;
    return openModal(modal('转正达标线登记',
      `<div class="note ok"><b>学习达标</b> 由系统自动判定，<b>不需要人工登记</b>。<br>
       当前：${done} / ${MOCK.DB.levels.length} 关全通。</div>`));
  }
  const rec=(MOCK.DB.readiness[tid]||{})[key]||{};
  const eff=MOCK.effectiveThreshold(key);
  const cmpTxt=eff.compare==='lt'?`<  ${eff.threshold} ${eff.unit}`:`≥ ${eff.threshold} ${eff.unit}`;
  openModal(modal('转正达标线登记',
    `<div class="note"><b>${esc(t.name)}（${t.id}）</b> · ${esc(line.name)} ·达标线：${cmpTxt} · <span class="tag ghost">口径以飞书为准</span></div>
     ${fld('数值 * '+esc(line.name),`<input id="rdv-${key}" type="number" step="any" min="0" value="${rec.value??''}" data-rule="${key==='traffic'?'traffic':'num'}">
       <div class="err">${key==='traffic'?'月引流人数需在 0–99999 之间':'请填大于 0 的数字'}</div><div class="ok">格式正确</div>`,
       line.hint)}
     ${fld('备注',`<input id="rdn-${key}" type="text" value="${esc(rec.note||'')}" placeholder="数据来源、口径说明">`,
       '这段备注会同步给带教导师，让他知道数据从哪来。')}
     <div class="acts">
       <button class="btn sm" onclick="mockSetReadiness('${tid}','${key}',1)">达标</button>
       <button class="btn sm ghost" onclick="mockSetReadiness('${tid}','${key}',0)">未达标</button>
       ${rec.at?'<button class="btn sm ghost danger" onclick="mockSetReadiness(\''+tid+'\',\''+key+'\',null)">清除</button>':''}
     </div>
     <div class="note warn"><svg class='ic'><use href='#i-alert'/></svg> <b>判定口径未变：</b>是否达标仍是「登记结论」说了算（<code>met</code> 严格 <code>=== true</code>），
     阈值<b>从不用来自动比较</b>。<br>
     阈值可在「达标线规则」表里改（写入 <code>settings</code>，全站展示口径同步）——但你改的是<b>给</b><b>人看的数字</b>，不是判定规则。</div>`,
    `<button class="btn ghost" onclick="closeModal()">取消</button>
     <button class="btn" onclick="mockSaveReadiness('${tid}','${key}')">保存登记</button>`));
}

/* ---------- 改达标线阈值：已移除（2026-10-04 用户决策 C） ----------
   【为什么不做了】后端阈值为常量、**无写接口**，前端改只能改本地展示、接真实后端后无法生效
   -> 与其留一个"看着能改其实没用"的入口，不如去掉，阈值只读展示。
   历史：阶段三曾按"管理端可改"实现（写 MOCK.DB.settings.readinessThresholds + effectiveThreshold
   解析 + 全站同步），那套 mock 实现与验收脚本 verify-readiness-threshold 保留在 mock-api.js，
   仅供沙盒演示；**新 UI 不再暴露任何入口**。
   仍保留的：MOCK.effectiveThreshold(key) —— 只读解析器，用于展示「阈值 / 单位」文案。 */
// 5. 新增用户 openAddUser（L1616）—— 8 字段 + 角色联动
function openAddUser(){
  openModal(modal('新增用户',
    `<form id="addUserForm" data-form="addUserForm">
     ${fld('角色 *',`<select id="uRole" onchange="onRoleChange()">
        <option value="student">学员</option><option value="mentor">带教导师</option>
        <option value="admin">教务管理员</option></select>`,
        '角色决定工作台：学员看闯关，导师审徒弟，管理员平行兜底')}
     ${fld('工号 *',`<input id="uWid" data-rule="wid" placeholder="如 M1 / S001" value="">`,'学员 S+数字，导师 M+数字，管理员 admin')}
     ${fld('姓名 *',`<input id="uName" placeholder="真实姓名">`)}
     ${fld('校区',`<input id="uDept" value="">`,'选填。留空则沿用组织归属默认值')}
     <div id="mentorBox">${fld('所属导师 *',`<select id="uMentor"><option value="">请选择</option>
        ${MOCK.DB.mentors.map(m=>`<option value="${m.id}">${m.name}（${m.id}）</option>`).join('')}</select>`,
        '学员必须挂导师，否则带教链断掉')}</div>
     ${fld('带教计划',`<select id="uPlan"><option value="">不绑定</option>
        ${MOCK.DB.plans.map(p=>`<option value="${p.id}">${p.name}</option>`).join('')}</select>`)}
     <div id="titleBox" hidden>${fld('职称',`<input id="uTitle" placeholder="如 带教导师">`)}</div>
     ${fld('初始密码 *',`<input id="uPw" data-rule="pwd" placeholder="至少 6 位">`,
       '<svg class="ic"><use href="#i-alert"/></svg> 基线此处是 <code>type="text"</code> 明文，是既有缺陷。迁移保持不变，不擅自改字段。')}
     </form>`,
    '<button class="btn ghost" onclick="closeModal()">取消</button><button class="btn" onclick="mockAddUser()">创建</button>'));
}
function onRoleChange(){
  const r=document.getElementById('uRole').value;
  document.getElementById('mentorBox').hidden = r!=='student';
  document.getElementById('titleBox').hidden = !(r==='mentor');
}
// 6. 重置密码 openResetPw（L1647）
function openResetPw(wid){
  openModal(modal('重置密码',
    `<div class="note warn"><b>${wid}</b> 的密码将被重置。新密码至少 6 位，存 <code>scrypt$N$r$p$salt$hash</code>。</div>
     ${fld('新密码 * '+`<input id="rpPw" data-rule="pwd" placeholder="至少 6 位">`,'重置后该账号当前 token 仍可用 7 天（基线 verifyToken 不查库，属既有缺陷）')}`,
    '<button class="btn ghost" onclick="closeModal()">取消</button><button class="btn" onclick="closeModal();toast(\'已重置\');">确认重置</button>'));
}
// 7. 转移徒弟 openTransfer（L1667）
/* 注意：【2026-10-04 · 阶段四决策 3.=B】平台 bug 未解 -> **UI 标注「暂不可用」并禁用确认按钮**。
   事实核对（本轮已复核）：
     · 后端 `adminTransferTrainee` 在 $LATEST 的 handle() 分发**是正确的**（源码有该分支）；
     · `buildTag` 探针证实执行实例跑的是最新构建；
     · 但**执行实例仍返「未知动作」** -> 判定为**平台侧问题**（分发未生效）。
   决策：真实调用已接（live 层 mockTransfer -> adminTransferTrainee），但**不给用户可点的按钮**，
        避免点了必然报错。待平台修复后，去掉 disabled 即可（只改这一处）。
   红线：绝不删除该功能代码 —— 后端修好后可立即恢复。 */
function openTransfer(wid){
  const t=MOCK.traineeOf(wid); if(!t) return;
  const others=MOCK.DB.mentors.filter(m=>m.id!==t.mentorId);
  if(!others.length) return toast('系统里没有其他导师可转移，请先建导师','warn');
  openModal(modal('转移徒弟（暂不可用）',
    `<div class="note warn"><b>${esc(t.name)}（${wid}）</b> 当前导师：${esc((MOCK.mentorOf(t.mentorId)||{}).name||t.mentorId)}</div>
     ${fld('转到 *',`<select id="trTo" disabled><option value="">请选择</option>
       ${others.map(m=>`<option value="${m.id}">${m.name}（${m.id}）</option>`).join('')}</select>`,
       '转移后：越权判定立刻改用新导师；历史学习/同频/出师记录保留')}
     <div class="note danger"><b>暂不可用</b>：后端 <code>adminTransferTrainee</code> 的云函数执行实例返回「未知动作」，
       属<b>平台侧问题</b>（代码分发正确、构建已是最新）。<b>在平台修复前，此功能保持禁用</b>，
       请暂时用「用户管理 <svg class='ic'><use href='#i-arrow-r'/></svg> 删除后重建」或联系管理员线下调整。功能代码已保留，平台修复后即可启用。</div>`,
    '<button class="btn ghost" onclick="closeModal()">关闭</button><button class="btn" disabled title="平台修复后启用">确认转移</button>'));
}
// 8. 删除课程（逐字输入完整课名）L1531-1552
function openDeleteCourse(cid){
  const c=MOCK.courseOf(cid); if(!c) return;
  openModal(modal('删除课程',
    `<div class="note danger"><b>${c.id} · ${esc(c.title)}</b><br>删除后学员端不再显示这门课；<b>已有学习进度会保留</b>；该关卡的「练/考」不受影响。</div>
     ${fld('请完整输入课程名以确认删除 *',`<input id="dcTitle" placeholder="${esc(c.title)}" autocomplete="off">`,
       '基线为严格字符串相等：<code>if(typed!==c.title)</code>')}
     <div class="note warn">建议：如果只是要改内容，用「换视频」而不是删课程。</div>`,
    `<button class="btn ghost" onclick="closeModal()">取消</button>
     <button class="btn danger" onclick="mockDeleteCourse('${cid}')">确认删除</button>`));
}
// 9. 学习轨迹 showTimeline（L1478）
function openTimeline(wid){
  const ev=MOCK.DB.coaching[wid]?MOCK.DB.coaching[wid].events:[];
  const items=ev.length?ev.map(e=>`<div class="ev"><span class="ts">${esc(e.ts.slice(0,16).replace('T',' '))}</span>
    <span class="tx"><span class="tag ghost">${esc(e.ev)}</span> ${esc(e.txt)}</span></div>`).join('')
    :'<div class="empty"><div class="big"><svg class="ic"><use href="#i-mail"/></svg></div><b>还没有教日志记录</b></div>';
  const t=MOCK.traineeOf(wid);
  openModal(modal('学习轨迹 · '+(t?t.name:wid),
    items + `<div class="note">来源：<code>data/coaching.json</code> 的 <code>events[]</code>，<code>ev</code> 取值 <code>同频 / 出师 / 任务</code>。</div>`,
    '<button class="btn ghost" onclick="closeModal()">关闭</button>'));
}
// 10. 确认出师 openSignoff（L1398）—— 胜任力全达标才允许（后端 L839）
function openSignoff(wid){
  const t=MOCK.traineeOf(wid); if(!t) return;
  const byPlan=(MOCK.DB.competency[wid]||{}).byPlan||{};
  const comps=Object.values(byPlan).flatMap(p=>Object.entries(p.comps||{}));
  const all=comps.length>0&&comps.every(([,v])=>v);
  openModal(modal('确认出师',
    `<div class="note ${all?'ok':'warn'}">胜任力 ${comps.filter(([,v])=>v).length} / ${comps.length} 项达标${all?'，<b>允许出师</b>':'，<b>未全过，不能出师</b>（基线 L839前置校验）'}</div>
     ${fld('结业评级 *',`<select id="rt"><option value="达标">达标</option><option value="熟练">熟练</option><option value="可带教他人">可带教他人</option></select>`)}
     <div class="note warn"><svg class='ic'><use href='#i-alert'/></svg> <code>signoffs.json</code> 只存一个 <code>planId</code> <svg class='ic'><use href='#i-arrow-r'/></svg> 一个学员只能出师一次（基线既有限制）。</div>`,
    `<button class="btn ghost" onclick="closeModal()">取消</button>
     <button class="btn" ${all?'':'disabled'} onclick="mockSignoff('${wid}')">生成结业凭证</button>`));
}

/* ---------- CSV 导出（基线 2 处，均带 BOM） ---------- */
function exportCSV(filename, headers, rows){
  const csv=[headers.join(','),...rows.map(r=>r.map(c=>`"${String(c==null?'':c).replace(/"/g,'""')}"`).join(','))].join('\r\n');
  const blob=new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download=filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  toast('已导出 '+filename);
}
// 学习报告 8 列（基线 L1486：比页面表少「轨迹」列）
function exportLearningReport(){
  exportCSV('学习报告.csv',
    ['工号','姓名','校区','导师','当前关卡','最后观看','拖拽跳过','同频完成'],
    MOCK.DB.trainees.map(t=>{
      const cur=MOCK.currentLevelOf(t.id);
      let last='—',drag='否',sync='否';
      Object.keys(MOCK.DB.learn).forEach(k=>{
        if(k.split('|')[0]!==t.id) return;
        const r=MOCK.DB.learn[k];
        if(r.events&&r.events.length) last=r.events[r.events.length-1].ts.slice(0,16).replace('T',' ');
        if(r.dragSkip) drag='是';
      });
      const g=Object.keys(MOCK.DB.gates).some(k=>k.startsWith(t.id+'|')&&MOCK.DB.gates[k].mentee&&MOCK.DB.gates[k].mentor);
      if(g) sync='是';
      return [t.id,t.name,t.dept,(MOCK.mentorOf(t.mentorId)||{}).name||t.mentorId,
              '第 '+cur.no+' 关 '+cur.title,last,drag,sync];
    }));
}
// 转正名单 8 列（基线 L1997）
function exportCertCSV(){
  exportCSV('转正名单.csv',
    ['工号','姓名','导师','学习达标','月引流','剪辑效率','账号运营','已达标','认证状态','认证时间','认证操作人'],
    MOCK.DB.trainees.map(t=>{
      const r=MOCK.DB.readiness[t.id]||{};
      const studyOk=MOCK.DB.levels.every(l=>MOCK.levelDone(t.id,l));
      const n=['traffic','editing','accounts'].filter(k=>r[k]&&r[k].met===true).length;
      const done=studyOk&&n===3;
      return [t.id,t.name,(MOCK.mentorOf(t.mentorId)||{}).name||t.mentorId,
              studyOk?'已达标':'未达标',
              r.traffic&&r.traffic.met===true?'已达标':'未达标',
              r.editing&&r.editing.met===true?'已达标':'未达标',
              r.accounts&&r.accounts.met===true?'已达标':'未达标',
              (studyOk?1:0)+n+'/4',
              r.certifiedAt?'已认证':'未认证', r.certifiedAt||'', r.certifiedByName||''];
    }));
}

/* ---------- 小工具 ---------- */
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function roleCN(r){ return {student:'学员',mentor:'带教导师',admin:'教务管理员',trainer:'培训师'}[r]||r; }
// roleCN 保留 trainer 映射：后端 adminUserUpsert 仍支持该角色，仅沙盒演示不再提供入口
// 切角色时统一落点（app.js 的 ROLE_HOME 用它）
window.UI={topbarHTML,initTopbar,refreshTodoDot,mxCell,mxLegend,stagebar,rdBadgeGrid,readinessMeta,taskCardClass,taskTagHTML,tbl,tr,
  readinessBadge,openModal:window.openModal,modal,fld,openJourney,openAdminReview,openGateConfirm,
  openReadiness,openAddUser,onRoleChange,openResetPw,openTransfer,openDeleteCourse,openTimeline,
  openSignoff,openPlayer,openSync,openQuiz,gradeQuiz,
  pendingList,bulkListHTML,bulkSkipHTML,openBulkPass,
  exportCSV,exportLearningReport,exportCertCSV,esc,roleCN,NAV_ADMIN};
Object.assign(window,{openPlayer,openSync,openQuiz,gradeQuiz,openBulkPass,doBulkPass,runBulkPass,readinessBadge,stagebar,rdBadgeGrid,readinessMeta});