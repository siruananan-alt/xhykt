/* 原型站真实浏览器验收（沙盒专用，不接触任何线上数据）
   跑法：NODE_PATH=C:/Users/sia/.workbuddy/binaries/node/workspace/node_modules node proto/assets/verify.js
   检查项：
     1. 16 个页面组合全部能打开、无 JS 报错、无 404
     2. 控制台错误 / 页面异常
     3. 横向溢出（整页 scrollWidth > 视口）
     4. 触控目标 < 44px（手机视口下）
     5. 关键组件是否真的渲染出（.mx 四态、.stagebar、.ph 占位符、.btn）
     6. 交互链路：公开首页滚动联动 + 登录分流 + 角色切换 + 批改弹层 + 表单三态
     7. 截图输出到 proto/_shots/

   注意： 跑在脚本内置的 http 静态服务上，不用 file:// ——
   file:// 下跨目录相对路径（../index.html）会解析失败并静默跳到空 URL，
   这类问题在真实 http 下不复现，用 file:// 验收等于测了个假环境。 */
const {chromium}=require('playwright-core');
const path=require('path'),fs=require('fs'),url=require('url'),http=require('http');

const ROOT=path.resolve(__dirname,'..');
const PAGES=[
  ['landing','index.html',null,1440],                                     // 公开营销首页（未登录）
  ['landing-m','index.html',null,390],                                    // 公开首页 · 手机
  ['design-spec','pages/design-spec.html','admin',1280],                   // 设计规范陈列台
  ['login','pages/login.html','student',1280],
  ['student-journey','pages/student-journey.html','student',390],   // 学员=手机
  ['student-level','pages/student-level.html','student',390],
  ['student-courses','pages/student-courses.html','student',390],
  ['student-me','pages/student-me.html','student',390],
  ['mentor','pages/mentor.html','mentor',1280],
  ['mentor-mentee','pages/mentor-mentee.html','mentor',1280],
  ['mentor-coach','pages/mentor-coach.html','mentor',1280],
  // 【2026-10-04 决策】trainer.html 已停用（保留文件留痕），不再进截图清单
  ['admin-dashboard','pages/admin-dashboard.html','admin',1440],
  ['admin-journey','pages/admin-journey.html','admin',1440],
  ['admin-journey-m','pages/admin-journey.html','admin',390],         // 窄屏卡片视图
  ['admin-readiness','pages/admin-readiness.html','admin',1280],
  ['admin-courses','pages/admin-courses.html','admin',1280],
];
const SHOTS=path.join(ROOT,'_shots');
fs.mkdirSync(SHOTS,{recursive:true});

let pass=0,fail=0;const bad=[];
const ok=m=>{pass++;console.log('  \x1b[32m[勾]\x1b[0m '+m);};
const no=m=>{fail++;bad.push(m);console.log('  \x1b[31m[叉]\x1b[0m '+m);};
function chk(cond,m){cond?ok(m):no(m);}

/* 内置零依赖静态服务：验收必须跑在 http:// 上，和沙盒实际使用方式一致。
   file:// 下 ../index.html 这类跨目录相对路径会解析失败并静默跳空 URL。 */
const MIME={'.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8',
  '.js':'text/javascript;charset=utf-8','.json':'application/json','.svg':'image/svg+xml',
  '.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.md':'text/markdown;charset=utf-8'};
function serve(root){
  return new Promise(res=>{
    const s=http.createServer((req,rq)=>{
      let p=decodeURIComponent(req.url.split('?')[0]);
      if(p==='/')p='/index.html';
      // 浏览器自动请求 favicon，沙盒不提供 —— 回 204 而不是 404，
      // 否则每个页面都会记一条"资源失败"，把真问题淹掉（是误报，不是缺陷）
      if(p==='/favicon.ico'){rq.writeHead(204);return rq.end();}
      const f=path.join(root,path.normalize(p).replace(/^([\\/])+/,''));
      if(!f.startsWith(root)){rq.writeHead(403);return rq.end();}
      fs.readFile(f,(e,buf)=>{
        if(e){rq.writeHead(404);return rq.end('404');}
        rq.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream'});
        rq.end(buf);
      });
    });
    s.listen(0,'127.0.0.1',()=>res({server:s,base:'http://127.0.0.1:'+s.address().port+'/'}));
  });
}

(async()=>{
  const {server,base}=await serve(ROOT);
  console.log('\x1b[90m验收服务已起：'+base+'\x1b[0m');
  const b=await chromium.launch({channel:'msedge'});
  /* 注意：【2026-10-04 阶段四】mock-api-live.js 的默认值已反转为「接真实后端」
     （生产行为）。本脚本验的是**沙盒 UI 基线**，必须显式退回沙盒：
     统一包装 newContext，给每个新页面注入 localStorage.etrainLive='0'
     （initLiveFlag 里 localStorage 优先级高于默认值）。这样零遗漏，
     且不必改任何 goto 的 URL（避免与已有的 ?lv= 等参数冲突）。 */
  const _nc=b.newContext.bind(b);
  b.newContext=async opts=>{
    const c=await _nc(opts);
    await c.addInitScript(()=>{ try{ localStorage.setItem('etrainLive','0'); }catch(e){} });
    return c;
  };
  // ---------- 1. 逐页加载 ----------
  console.log('\n\x1b[1m[1] '+PAGES.length+' 个页面组合加载 / 控制台 / 溢出 / 触控 / 组件\x1b[0m');
  for(const [name,rel,role,w] of PAGES){
    const ctx=await b.newContext({viewport:{width:w,height:900},isMobile:w<500,hasTouch:w<500});
    const pg=await ctx.newPage();
    // 每个页面组合都用干净登录态起：否则上一段遗留的 protoRole 会让公开页
    // 渲染出"进入工作台"，把"未登录长什么样"这条基线悄悄改掉。
    if(rel==='index.html')await pg.addInitScript(()=>sessionStorage.removeItem('protoRole'));
    const errs=[];
    pg.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
    pg.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
    pg.on('requestfailed',r=>errs.push('REQFAIL: '+r.url().split('/').pop()));
    await pg.goto(base+rel,{waitUntil:'networkidle'});
    await pg.waitForTimeout(160);
    console.log('\n· '+name+'  ('+rel+', '+w+'px, role='+(role||'公开')+')');
    chk(errs.length===0,'无 JS 报错/资源失败'+(errs.length?' -> '+errs.slice(0,2).join(' | '):''));
    // 角色类是否正确落地（role=null 的公开页不参与这项）
    if(role){
      const rc=await pg.evaluate(()=>document.body.className);
      chk(rc.includes('role-'+role),'body 角色类 = role-'+role+'  (实际: '+rc.trim()+')');
    }else{
      // 公开页必须"无身份"：不能出现任何人的姓名，也不能挂 role-* 密度档
      const info=await pg.evaluate(()=>({
        pub:document.body.dataset.public,
        names:document.querySelectorAll('[data-who-name]').length,
        cls:document.body.className
      }));
      chk(info.pub==='1','公开页标记 data-public="1" 生效（未登录也能完整浏览）');
      chk(info.names===0,'公开页不注入任何登录身份（无 [data-who-name] 节点）');
      chk(!/role-/.test(info.cls),'公开页不挂 role-* 密度档（实际: "'+info.cls.trim()+'"）');
    }
    // 横向溢出
    const ov=await pg.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}));
    chk(ov.sw<=ov.cw+1,'无整页横向溢出 ('+ov.sw+'/'+ov.cw+')');
    // 组件是否渲染
    const c=await pg.evaluate(()=>({
      mx:document.querySelectorAll('.mx').length,
      ph:document.querySelectorAll('.ph').length,
      btn:document.querySelectorAll('.btn').length,
      tag:document.querySelectorAll('.tag').length,
      stage:document.querySelectorAll('.stagebar').length,
      ic:document.querySelectorAll('svg.ic use').length,
      icSlot:document.querySelectorAll('[data-ic],[data-ic2]').length,
      brand:!!document.querySelector('.brand'),
      auth:!!document.querySelector('.auth')
    }));
    // 登录页是分栏布局，本来就没有顶栏（有 .auth 品牌侧 + 表单侧）
    chk(c.brand||c.auth,(c.brand?'顶栏渲染':'登录页分栏布局渲染（无顶栏是设计）'));
    chk(c.btn>0||c.auth,'按钮渲染 ('+c.btn+')');
    // 只有实际用到图标的页面才断言 sprite 注入
    if(c.icSlot)chk(c.ic>0,'图标 sprite 注入成功 ('+c.ic+' 个 / '+c.icSlot+' 个槽位)');
    else console.log('    · 本页未使用图标（合理）');
    if(c.ph)console.log('    · 图片占位符 '+c.ph+' 个（已按规范预留）');
    if(c.mx)console.log('    · 状态格 .mx '+c.mx+' 个 / 标签 '+c.tag+' / 阶段条 '+c.stage);
    // 触控目标（手机视口）
    if(w<500){
      const small=await pg.evaluate(()=>{
        const out=[];
        document.querySelectorAll('a.btn,button.btn,.btn,.nav2 a,input[type=submit]').forEach(el=>{
          const r=el.getBoundingClientRect();
          if(r.width===0||r.height===0)return;
          if(r.height<44)out.push((el.textContent||el.tagName).trim().slice(0,14)+':'+Math.round(r.height));
        });
        return out;
      });
      chk(small.length===0,'触控目标全部 ≥44px'+(small.length?' -> 偏小: '+small.slice(0,4).join(', '):''));
    }
    await pg.screenshot({path:path.join(SHOTS,name+'.png'),fullPage:w<500});
    await ctx.close();
  }

  // ---------- 2. 交互链路 ----------
  console.log('\n\x1b[1m[2] 交互链路\x1b[0m');
  const ctx=await b.newContext({viewport:{width:390,height:900},isMobile:true,hasTouch:true});
  const pg=await ctx.newPage();
  const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  const U=f=>base+f;

  // 2.1 登录 -> 校验失败 -> 校验通过 -> 跳转
  await pg.goto(U('pages/login.html'),{waitUntil:'networkidle'});
  await pg.fill('#loginForm input[data-rule=wid]','');
  await pg.click('#loginForm button[type=submit]');
  await pg.waitForTimeout(200);
  chk(await pg.locator('.fld.bad').count()>0,'登录：空工号提交 -> 字段标红（.fld.bad）');
  chk(await pg.locator('.toast').count()>0,'登录：同时弹吐司提示');
  await pg.fill('#loginForm input[data-rule=wid]','1abc');
  await pg.click('#loginForm button[type=submit]');
  await pg.waitForTimeout(150);
  chk(await pg.locator('.fld.bad').count()>0,'登录：工号 "1abc"（数字开头）-> 仍标红');
  await pg.fill('#loginForm input[data-rule=wid]','S001');
  await pg.waitForTimeout(120);
  chk(await pg.locator('.fld.good').count()>0,'登录：填 "S001" -> 实时转绿态（.fld.good）');
  /* 【2026-10-04 阶段四改造】原「选一个演示身份」<select id="who"> 已删除
     （真实登录页不该有身份选择器）。改为点沙盒演示入口的对应按钮，
     等价于原来的 selectOption（都走 quick(k) -> 直接切视角）。 */
  await pg.click('#demoBox .row:has-text("郑丽薪") button');
  await pg.waitForTimeout(600);
  chk(/\/pages\/mentor\.html$/.test(pg.url()),'登录：导师 -> 跳自己的工作面板 mentor.html');
  const role1=await pg.evaluate(()=>document.body.className);
  chk(role1.includes('role-mentor'),'跳转后自动切到 role-mentor 密度档');
  // 3 个角色必须各进各的面板，不能全落到同一页
  // 【2026-10-04 决策】培训师角色已移除；M2 曾锃湘以导师身份登录，与 M1 同落 mentor.html
  for(const [k,file,nm] of [['student','student-journey','朱子悦'],['admin','admin-dashboard','范文淼']]){
    await pg.goto(U('pages/login.html'),{waitUntil:'networkidle'});
    await pg.click('#demoBox .row:has-text("'+nm+'") button');
    await pg.waitForTimeout(550);
    chk(pg.url().endsWith('/pages/'+file+'.html'),'登录：'+k+' -> 独立面板 '+file+'.html');
  }
  // M2 导师身份登录 -> 也落 mentor.html
  await pg.goto(U('pages/login.html'),{waitUntil:'networkidle'});
  await pg.click('#demoBox .row:has-text("曾锃湘") button');
  await pg.waitForTimeout(550);
  chk(pg.url().endsWith('/pages/mentor.html'),'登录：M2（导师）-> mentor.html');

  // 2.2 顶栏身份牌（【2026-10-04 · 方案 A】角色切换菜单已移除 -> 断言改为「不存在切换入口」）
  await pg.goto(U('pages/mentor.html'),{waitUntil:'networkidle'});
  await pg.waitForTimeout(300);
  chk(await pg.locator('#roleBtn').count()===0,'角色切换按钮已移除（#roleBtn 不存在）');
  chk(await pg.locator('#roleMenu').count()===0,'角色切换菜单已移除（#roleMenu 不存在）');
  chk(await pg.locator('.role-chip').count()===1,'右上角为静态身份牌 .role-chip');
  const whoChip=await pg.evaluate(()=>{const e=document.querySelector('[data-who-name]');return e?e.textContent:'';});
  chk(!!whoChip,'身份牌显示当前登录姓名：'+whoChip);
  /* 【核心不变量】身份牌姓名必须与**会话角色**一致，而不是页面里写死的默认文案。
     本段 protoRole='mentor' -> 必须显示导师本人（郑丽薪），绝不能是默认的「范文淼」。
     这正是修复前的真 bug：顶栏挂载晚于 initRole，导致所有页身份牌永远显示默认的范文淼。
     因此断言写成「等于该角色姓名」+「不等于默认文案」，两条都查。 */
  chk(whoChip==='郑丽薪','身份牌姓名=会话角色本人（mentor->郑丽薪）| 实测 '+whoChip);
  chk(whoChip!=='范文淼','身份牌未被硬编码默认值污染（范文淼=admin 默认名）');

  // 2.3 批改弹层（三处入口共用同一条链路）
  //  注意：【2026-10-04 重写】mentor.html 已改为数据驱动：
  //   - 按钮选择器 `.rowitem.wait button[data-modal]` -> `.rowitem.wait button[data-review]`
  //     （新实现用 data-review 标记「批改」按钮，不再复用 data-modal）
  //   - **真实种子数据里没有任何 submitted 记录**（S001 卡在 L04，且 L04 无任务卡）
  //     -> 导师队列天然为空。旧断言直接点队列首条会超时。
  //     改为先造一条待批记录（把自己徒弟某关的任务卡置为 submitted），再走批改链路。
  //   - 上一步切成了 admin，这里必须把会话拉回导师，否则 S.wid='admin' 无徒弟。
  //     注意：【2026-10-04 修正】一开始用 addInitScript 注入 protoRole —— 但 addInitScript
  //     会**在该 page 的每一次导航都重跑**，导致后面「未登录态」那段 removeItem+reload
  //     被重新写回 mentor（实测 pr="mentor"、右上角显示「进入工作台」，2 条假失败）。
  //     正确做法：用 evaluate 写一次 sessionStorage（导航不重跑），随后 goto 即可。
  await pg.goto(U('index.html'),{waitUntil:'domcontentloaded'});
  await pg.evaluate(()=>sessionStorage.setItem('protoRole','mentor'));
  await pg.goto(U('pages/mentor.html'),{waitUntil:'networkidle'});
  const seeded=await pg.evaluate(()=>{
    const M=window.MOCK, me=window.MOCKAPI.S.wid;
    const t=(M.DB.trainees||[]).find(x=>x.mentorId===me);
    if(!t) return 0;
    // 找该徒弟第一张有定义的任务卡所在关卡
    const def=M.TASK_DEFS[0];
    const lvId=def.levelId;
    M.DB.tasks[t.id]=M.DB.tasks[t.id]||{};
    M.DB.tasks[t.id][lvId]=M.DB.tasks[t.id][lvId]||{};
    M.DB.tasks[t.id][lvId][def.id]={status:'submitted',note:'验收造数：已按要求提交成果',by:t.id,at:'2026-10-04T08:00:00Z'};
    window.__rerender && window.__rerender();
    return 1;
  });
  await pg.waitForTimeout(200);
  const before=await pg.locator('.rowitem.wait').count();
  chk(seeded===1 && before>0,'导师：造 1 条待批 -> 队列出现 '+before+' 条');
  await pg.locator('.rowitem.wait button[data-review]').first().click();
  await pg.waitForTimeout(250);
  chk(await pg.locator('.mask.on').count()>0,'导师：点「批改」-> 弹层打开');
  chk(await pg.locator('.modal .m-h h2').count()>0,'弹层有标题栏');
  await pg.locator('.modal .m-f .btn').last().click();
  await pg.waitForTimeout(250);
  chk(await pg.locator('.toast').count()>0,'确认通过 -> 弹吐司');
  chk(await pg.locator('.mask.on').count()===0,'确认后弹层自动关闭');
  // Esc 关闭：重新造一条再点开
  await pg.evaluate(()=>{
    const M=window.MOCK, me=window.MOCKAPI.S.wid;
    const t=(M.DB.trainees||[]).find(x=>x.mentorId===me);
    const def=M.TASK_DEFS[0], lvId=def.levelId;
    M.DB.tasks[t.id][lvId][def.id]={status:'submitted',note:'验收造数：再提交一次',by:t.id,at:'2026-10-04T09:00:00Z'};
    window.__rerender && window.__rerender();
  });
  await pg.waitForTimeout(200);
  await pg.locator('.rowitem.wait button[data-review]').first().click();
  await pg.waitForTimeout(200);
  await pg.keyboard.press('Escape');
  await pg.waitForTimeout(200);
  chk(await pg.locator('.mask.on').count()===0,'Esc 可关闭弹层');

  // 2.4 学员提交任务卡 -> 表单校验 -> 提交后卡片转「待审核」
  //     注意：【2026-10-04 重写】student-level.html 已改为数据驱动：
  //     - 选择器由固定 id `#submitG3` 改为 `form[data-card="T-G3"]`（任意任务卡通用）
  //     - 真实数据下 S001 卡在 L04，默认落地渲染 L04（无任务卡）-> 必须显式 ?lv=L07
  //       且先把 L01–L06 全过掉，否则只渲染锁页
  //     - 旧断言「提交后按钮 disabled」已不成立：新实现是提交后重渲染成「待审核」卡
  //       （表单整个消失），改成断言「出现待审核标签 + 表单不再存在」更贴切
  //     注意：【2026-10-04 二次修正 · 新增页面守卫后必改】上一步把会话设成了 mentor，
  //     而本页归属 student —— 守卫（app.js guardPage）会**把导师弹回 mentor.html**，
  //     导致随后的 evaluate 在"正在导航的页面"上执行 -> MOCKAPI undefined -> FATAL。
  //     这不是守卫的 bug，而是本脚本原先在"导师身份下打开学员页"——本就是越权动作。
  //     修法：进入本页前先把身份切回 student（与真实使用一致）。
  await pg.evaluate(()=>sessionStorage.setItem('protoRole','student'));
  await pg.goto(U('pages/student-level.html')+'?lv=L07',{waitUntil:'networkidle'});
  await pg.waitForTimeout(300);
  await pg.evaluate(()=>{
    const M=window.MOCK,wid=window.MOCKAPI.S.wid;
    M.DB.journey[wid]=M.DB.journey[wid]||{};M.DB.learn[wid]=M.DB.learn[wid]||{};M.DB.tasks[wid]=M.DB.tasks[wid]||{};
    M.DB.levels.filter(l=>l.no<=6).forEach(lv=>{
      const st=lv.stages||{};
      ['study','practice','exam'].forEach(s=>{ if(!st[s])return;
        M.DB.journey[wid][lv.id]=M.DB.journey[wid][lv.id]||{};
        M.DB.journey[wid][lv.id][s]={ok:true,by:'M1',byName:'郑丽薪',at:'2026-10-04T08:00:00Z'};
      });
      ((st.study&&st.study.courseIds)||[]).forEach(cid=>{
        const c=M.courseOf(cid); if(!c)return;
        M.DB.learn[wid][M.KEY(wid,cid)]={done:((c.chapters)||[]).filter(ch=>ch.type==='video').map(ch=>ch.id)};
      });
      M.DB.tasks[wid][lv.id]=M.DB.tasks[wid][lv.id]||{};
      M.TASK_DEFS.filter(d=>d.levelId===lv.id).forEach(d=>{
        M.DB.tasks[wid][lv.id][d.id]={status:'passed',note:'已过',by:'M1',byName:'郑丽薪',at:'2026-10-04T08:00:00Z'};
      });
    });
    M.DB.tasks[wid]['L07']={};                 // T-G1/T-G3 都清成未提交
    render();
  });
  await pg.waitForTimeout(200);
  const F='form[data-card="T-G3"]';
  await pg.fill(F+' input','x');
  await pg.click(F+' button[type=submit]');
  await pg.waitForTimeout(200);
  chk(await pg.locator(F+' .fld.bad').count()>0,'学员：任务卡链接填 "x" -> 标红阻断');
  await pg.fill(F+' input','https://pan.quark.cn/s/剪映模板v2 已整理字幕样式与导出参数');
  await pg.waitForTimeout(150);
  chk(await pg.locator(F+' .fld.good').count()>0,'补全后 -> 转绿态');
  await pg.click(F+' button[type=submit]');
  await pg.waitForTimeout(300);
  chk(await pg.locator('.tcard.wait').count()>0,'提交成功 -> 卡片重渲染为「待审核」');
  chk(await pg.locator(F).count()===0,'提交成功后提交表单不再存在（防重复提交）');

  // 2.5 矩阵 tooltip + 窄屏卡片切换
  //     真实线上状态（DB_JOURNEY.S001）：L01/L02/L03 已过，卡在 L04 的「考」未代录
  //     -> 应恰有 3 个 [勾] + 1 个当前关（doing 或 todo，带 .cur 描边）+ 8 个未解锁
  //     注意：【2026-10-04 · 新增页面守卫后必改】上一段把身份切成了 student，
  //     而 admin-journey.html 归属 admin -> 守卫会把学员弹回 student-journey.html，
  //     随后的 evaluate（读 MOCKAPI）就在"正在导航的页面"上执行 -> ReferenceError。
  //     进管理端页前必须先把身份切回 admin。
  await pg.evaluate(()=>sessionStorage.setItem('protoRole','admin'));
  await pg.setViewportSize({width:1440,height:900});
  await pg.goto(U('pages/admin-journey.html'),{waitUntil:'networkidle'});
  await pg.waitForTimeout(400);
  chk(await pg.locator('.mxtbl').isVisible(),'矩阵：宽屏显示表格');
  chk(!(await pg.locator('.mxcards').isVisible()),'矩阵：宽屏隐藏卡片视图');
  const tally=await pg.evaluate(()=>{
    const t={};
    document.querySelectorAll('.mxtbl .mx').forEach(e=>e.classList.forEach(c=>{if(['ok','doing','todo','lock','cur'].includes(c))t[c]=(t[c]||0)+1;}));
    return t;
  });
  chk((tally.ok||0)>=1,`矩阵有已通关色块 [勾]（${tally.ok||0} 个）`);
  chk((tally.lock||0)>=1,`矩阵有未解锁色块 —（${tally.lock||0} 个）`);
  // 关键回归：色块四态必须与 levelDone 一致（曾出现 mxCell 说 [勾] 而 levelDone 说未过的矛盾）
  const consistent=await pg.evaluate(()=>{
    const rows=MOCKAPI.visibleTrainees(MOCKAPI.S.wid);
    const cells=[...document.querySelectorAll('.mxtbl tbody tr')];
    return rows.every((t,i)=>{
      if(!cells[i]) return true;
      const tds=[...cells[i].querySelectorAll('td')].slice(1,-1);   // 去掉「学员」与「操作」
      return tds.every((td,j)=>{
        const lv=MOCK.DB.levels[j]; if(!lv) return true;
        const el=td.querySelector('.mx'); if(!el) return true;
        const isOk=el.classList.contains('ok');
        return isOk === MOCK.levelDone(t.id,lv);                    // 两者必须同源同结果
      });
    });
  });
  chk(consistent,'矩阵色块四态与 levelDone() 完全一致（消除"[勾] 但未过"的矛盾）');
  const title=await pg.locator('.mxtbl .mx').first().getAttribute('title');
  chk(!!title,'矩阵色块 title 含明细（悬停可见）');
  const cur=await pg.locator('.mxtbl .mx.cur').count();
  chk(cur===1,'矩阵：当前关 3px 功能性描边唯一（.mx.cur='+cur+'）');
  // 搜索：用真实学员姓名
  const firstName=await pg.evaluate(()=>MOCKAPI.visibleTrainees(MOCKAPI.S.wid)[0].name);
  await pg.fill('#q',firstName);
  await pg.waitForTimeout(200);
  chk(await pg.locator('#filterCount').textContent()==='1',`矩阵：搜索"${firstName}"-> 计数=1`);
  await pg.fill('#q','');
  await pg.setViewportSize({width:390,height:900});
  await pg.waitForTimeout(250);
  chk(!(await pg.locator('.mxtbl').isVisible()),'矩阵：≤900px 隐藏表格（纯 CSS 切换）');
  chk(await pg.locator('.mxcards').isVisible(),'矩阵：≤900px 显示卡片视图');

  // 2.6 批量选择【2026-10-04 决策】培训师角色移除，「批量通过」迁到管理端
  //     （闯关总览 + 看板两入口，验收在 verify-admin-batch.js 单独跑）

  // 2.7 顶栏 chip 导航：当前项高亮 + 分组分隔线
  //   注意：【2026-10-04 修正陈旧断言】本页已并入统一顶栏（UI.topbarHTML），管理端导航
  //      = NAV_ADMIN 的 **9 项**（看板/学习跟踪/闯关总览/转正达标线/课程管理/学员管理/
  //        带教计划/权限矩阵/用户管理），末尾再补 1 项「转正达标线」入口时曾误以为只有 3 项。
  //      「9 项 + 8 条分隔线」是当前基线（verify-admin5.js 早就在按 9 项断言）。
  //      旧断言写死 3 链接 / 2 竖线，是硬编码导航时代的残留，必然误报 —— 别改回去。
  await pg.goto(U('pages/admin-readiness.html'),{waitUntil:'networkidle'});
  await pg.waitForTimeout(300);        // 顶栏由 DOMContentLoaded 注入，等一帧再数
  const on=await pg.locator('.nav2 a.on').textContent();
  chk(on.includes('达标线'),'顶栏 chip 按 pathname 自动高亮当前项（'+on.trim()+'）');
  // chip 在顶栏胶囊内（不再在 <main> 第二行）
  const inBar=await pg.locator('.topbar .nav2').count();
  chk(inBar===1,'chip 导航已搬进顶栏 .topbar 内（不是页面第二行）');
  const inMain=await pg.locator('main .nav2').count();
  chk(inMain===0,'<main> 里没有残留的旧 chip 条');
  // 管理端导航 9 项（与 NAV_ADMIN 一致；verify-admin5.js 同口径）
  const adminN=await pg.locator('.nav2 a').count();
  chk(adminN===9,'管理端导航 9 项（NAV_ADMIN 口径），实测 '+adminN);
  // 分组竖线 = 链接数 − 1（chip 之间插分隔线；不再是固定的 2 条）
  const sepN=await pg.locator('.nav2 i').count();
  chk(sepN===adminN-1,'chip 分隔线数 = 链接数 − 1（'+adminN+' -> '+(adminN-1)+'），实测 '+sepN);
  // 每个 chip 都是有效内部链接
  const badHref=await pg.evaluate(()=>[...document.querySelectorAll('.nav2 a')]
    .map(a=>a.getAttribute('href')).filter(h=>!h||h.startsWith('#')));
  chk(badHref.length===0,'chip 全部是有效页内链接（无空/锚点）');
  // 学员端 3 项 + 关卡详情不进导航
  // 注意：【2026-10-04 · 新增页面守卫后必改】上一段是管理端页（身份 admin），
  // 这段要开学员页 -> 必须先把身份切回 student，否则被守卫弹回 admin 落地页。
  await pg.evaluate(()=>sessionStorage.setItem('protoRole','student'));
  await pg.goto(U('pages/student-journey.html'),{waitUntil:'networkidle'});
  await pg.waitForTimeout(300);
  /* 【身份牌交叉验证】此处身份 = student -> 身份牌必须显示「朱子悦」，不能是 admin 的「范文淼」。
     这一条专治「硬编码默认文案」类 bug：之前管理员视角碰巧与默认值相同而蒙混过关。 */
  const chipStu=await pg.evaluate(()=>{const e=document.querySelector('[data-who-name]');return e?e.textContent:'';});
  chk(chipStu==='朱子悦','身份牌随学员身份显示「朱子悦」| 实测 '+chipStu);
  const sN=await pg.locator('.nav2 a').count();
  chk(sN===3,'学员端补齐 chip 导航 3 项（此前为 0），实测 '+sN);
  await pg.goto(U('pages/student-level.html'),{waitUntil:'networkidle'});
  const lvNav=await pg.locator('.nav2').count();
  chk(lvNav===0,'关卡详情页作为上下文页不进导航（避免多一个无同级入口）');

  // 2.7b 公开营销首页：未登录可看全貌 + 滚动联动 + 登录态切换
  await pg.goto(U('index.html'),{waitUntil:'networkidle'});
  chk((await pg.locator('.lp-hero').count())===1,'公开页：Hero 渲染');
  chk((await pg.locator('.lp-card').count())===3,'公开页：三张功能卡（闯关/课程库/我的档案）');
  chk((await pg.locator('.lp-role').count())===3,'公开页：3 个角色卡（学员/导师/管理员）');
  chk((await pg.locator('.lp-lv-i').count())===3,'公开页：12 关压成 3 段时间轴');
  chk((await pg.locator('.lp-alt').count())===3,'公开页：简介+配文交替区 3 段');
  // 图片占位符：每个都必须写清"要放什么图"，data-use 不能空
  const ph=await pg.evaluate(()=>[...document.querySelectorAll('.ph')].map(p=>({
    use:p.dataset.use||'',sz:p.dataset.size||'',t:(p.textContent||'').trim().length
  })));
  chk(ph.length>=7,'公开页：图片占位符 '+ph.length+' 个（Hero+3 卡+时间轴+团队+3 配文+二维码）');
  chk(ph.every(p=>p.use&&p.sz&&p.t>10),'占位符全部带尺寸+用途说明+建议内容（实测缺失 '+
    ph.filter(p=>!(p.use&&p.sz&&p.t>10)).length+' 个）');
  // 顶栏：常驻 + 6 个 chip 指向页内区块
  const sticky=await pg.evaluate(()=>getComputedStyle(document.querySelector('.topbar')).position);
  chk(sticky==='sticky','顶栏 position:sticky，滚动到底仍在（导航按钮始终在顶部）');
  const spyN=await pg.locator('.nav2[data-spy] a[href^="#"]').count();
  chk(spyN===6,'顶栏 chip 全部指向页内区块，实测 '+spyN+' 个');
  // 滚动联动：滚到"关于"区，chip 高亮应跟着换
  const sp=await pg.evaluate(async()=>{
    const t=document.getElementById('about');
    window.scrollTo({top:t.offsetTop+40,behavior:'instant'});
    await new Promise(r=>setTimeout(r,420));
    return document.querySelector('.nav2[data-spy] a.on')?.getAttribute('href');
  });
  chk(sp==='#about','滚动联动：滚到「关于」区 chip 高亮跟着换（实测 '+sp+'）');
  // 点 chip 真的能滚过去（锚点可用）
  await pg.click('.nav2[data-spy] a[href="#feat"]');
  await pg.waitForTimeout(700);
  const sy=await pg.evaluate(()=>window.scrollY);
  chk(sy>200,'点顶栏 chip 能滚到对应区块（scrollY='+Math.round(sy)+'）');
  // 滚动后顶栏加 .scrolled（压缩态）
  const scr=await pg.evaluate(()=>document.querySelector('.topbar').classList.contains('scrolled'));
  chk(scr,'滚动后顶栏进入压缩态 .scrolled');
  // 唯一主行动：全页只有 1 个实心绿大按钮在首屏
  const cta=await pg.locator('.lp-hero .btn:not(.ghost)').count();
  chk(cta===1,'首屏唯一主行动按钮（实心绿），实测 '+cta+' 个');
  // 品牌区必须两行：主名和"武汉校区"挤成一行会读不开
  const br=await pg.evaluate(()=>{
    const b=document.querySelector('.brand .bn');
    return {rows:b?Math.round(b.getBoundingClientRect().height):0,
            h:b?Math.round(b.querySelector('.bn2').getBoundingClientRect().height):0};
  });
  chk(br.rows>br.h+8,'品牌区两行排布（总高 '+br.rows+'px > 副名 '+br.h+'px），未挤成一行');
  // 登录态：默认未登录 -> 登录按钮；种了登录态 -> 进 工作台
  // 先显式清掉登录态：上面 2.1 的 4 角色循环刚把 protoRole 写成了 admin，
  // 不清的话"未登录"这条断言必然失败 —— 这是测试自身的时序，不是产品缺陷。
  await pg.evaluate(()=>sessionStorage.removeItem('protoRole'));
  await pg.reload({waitUntil:'networkidle'});
  const l1=await pg.locator('#authSlot a').textContent();
  chk(l1.includes('登录')&&!l1.includes('进入'),'未登录态：右上角显示「登录」，实测「'+l1.trim()+'」');
  // 未登录态必须零真实姓名：公开页给所有人看，不能一进来看见谁是谁
  const leak=await pg.evaluate(()=>{
    const t=document.body.innerText;
    return ['朱子悦','郑丽薪','曾锃湘','范文淼','S001','M1','M2'].filter(n=>t.includes(n));
  });
  chk(leak.length===0,'未登录态：整页不含任何真实姓名/工号（实测命中：'+(leak.join('、')||'无')+'）');
  await pg.evaluate(()=>sessionStorage.setItem('protoRole','mentor'));
  await pg.reload({waitUntil:'networkidle'});
  const l2=await pg.locator('#authSlot a').textContent();
  const l2h=await pg.locator('#authSlot a').getAttribute('href');
  chk(l2.includes('进入工作台')&&l2h.includes('mentor'),'已登录态：变「进入工作台」并指向该角色面板（'+l2h+'）');
  // 已登录态只允许出现"自己"的名字 —— 别人的仍不许出现
  const leak2=await pg.evaluate(()=>{
    const t=document.body.innerText;
    return ['朱子悦','曾锃湘','范文淼','S001'].filter(n=>t.includes(n));
  });
  chk(leak2.length===0,'已登录态：只显示本人身份，不出现他人姓名（实测命中：'+(leak2.join('、')||'无')+'）');
  await pg.evaluate(()=>sessionStorage.removeItem('protoRole'));
  // 公开页手机端：主行动全宽 + 无横向溢出
  const mctx=await b.newContext({viewport:{width:390,height:900},isMobile:true,hasTouch:true});
  const mp=await mctx.newPage();
  await mp.goto(U('index.html'),{waitUntil:'networkidle'});
  const bw=await mp.locator('.lp-cta .btn:not(.ghost)').boundingBox();
  chk(bw.width>300,'公开页手机端：主行动按钮全宽（'+Math.round(bw.width)+'px）');
  const ovf=await mp.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  chk(ovf<=0,'公开页手机端无横向溢出（溢出 '+ovf+'px）');
  // 手机端触控目标
  const small=await mp.evaluate(()=>{
    const out=[];
    document.querySelectorAll('a.btn,button.btn,.btn,.nav2 a,.lp-foot-nav a').forEach(el=>{
      const r=el.getBoundingClientRect();
      if(r.width===0||r.height===0)return;
      if(r.height<44)out.push((el.textContent||el.tagName).trim().slice(0,12)+':'+Math.round(r.height));
    });
    return out;
  });
  chk(small.length===0,'公开页手机端触控目标全部 ≥44px'+(small.length?' -> 偏小: '+small.slice(0,4).join(', '):''));
  // 桌面端主行动不能被拉成满宽（满宽会盖过标语）
  const dctx=await b.newContext({viewport:{width:1440,height:900}});
  const dp=await dctx.newPage();
  await dp.goto(U('index.html'),{waitUntil:'networkidle'});
  const dbw=await dp.locator('.lp-cta .btn:not(.ghost)').boundingBox();
  const dcw=await dp.locator('.lp-hero-tx').boundingBox();
  chk(dbw.width<dcw.width*0.5,'桌面端主行动按钮不占满宽（'+Math.round(dbw.width)+'px / 文本栏 '+Math.round(dcw.width)+'px）');
  await dctx.close();
  await mctx.close();

  // 2.8 折叠块默认展开策略
  // 注意：【2026-10-04 · 新增页面守卫后必改】上面几段把登录态反复清了又设，
  // 到这里身份不确定；本页归属 mentor -> 显式设一次，别依赖 data-role 兜底（太脆）。
  await pg.evaluate(()=>sessionStorage.setItem('protoRole','mentor'));
  await pg.goto(U('pages/mentor-mentee.html'),{waitUntil:'networkidle'});
  const openN=await pg.locator('details[open]').count();
  const allN=await pg.locator('details').count();
  chk(openN<allN,'徒弟详情：'+allN+' 个折叠块只默认展开 '+openN+' 个（当前关），已通关的收起');
  chk(openN===1,'只有当前关默认展开');

  chk(errs.length===0,'全流程无 JS 异常'+(errs.length?' -> '+errs.slice(0,2).join('|'):''));
  await ctx.close();

  await b.close();
  console.log('\n\x1b[1m结果：'+pass+' 通过 / '+fail+' 失败\x1b[0m');
  if(fail){console.log('\n失败项：');bad.forEach(x=>console.log('  · '+x));}
  console.log('截图已输出：proto/_shots/');
  process.exit(fail?1:0);
})().catch(e=>{console.error('FATAL',e);process.exit(2);});
