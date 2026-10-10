/* ============================================================
   mock-api.js · 32 个 action 的写操作实现（前端内存版）
   ------------------------------------------------------------
   注意： 严格照抄后端业务规则，不改判定、不改字段。
   每条都标了基线行号；与后端不一致的地方显式注明「基线缺陷，保留」。

   权限矩阵（【2026-10-04 用户决策】已去掉培训师角色）：
     mentor  = 只能审自己徒弟，taskId 可为 practice 或 EXAM   <- 考核由**导师**审
     admin   = 全部（**与导师平行**的兜底，不是"上级终审"）
     其他    = 无审核权限
   注意： 用户明确：「考核给导师审核就可以，不需要管理员终审；管理员也可以审核但是是和导师平行的」。
      即 admin 不是串行链路里的一环，而是**平行**的第二个可审人 —— 谁先审谁生效。
   注意： 后端 canReview 仍保留 trainer 分支不动（原网站既有实现），本次只改沙盒表现层。
   注意： 基线 L1458 块注释写「导师不能碰 EXAM」，但 L1470-1473 代码无 taskId 检查
     —— 代码为准，注释过时（已列入【需要确认 #7】）
   ============================================================ */

/* ---------- 当前会话身份 ---------- */
const S = { wid:'admin', role:'admin', name:'范文淼' };
function setSession(wid){
  const u=MOCK.userOf(wid);
  if(!u) return toast('账号不存在','err');
  S.wid=wid; S.role=u.role; S.name=u.name;
  document.body.className=document.body.className.replace(/role-\w+/g,'').trim()+' role-'+u.role;
  document.querySelectorAll('[data-who-name]').forEach(e=>e.textContent=u.name);
  document.querySelectorAll('[data-who-role]').forEach(e=>e.textContent=UI.roleCN(u.role));
  document.querySelectorAll('[data-who-av]').forEach(e=>e.textContent=u.name.slice(0,1));
  UI.refreshTodoDot(wid);
}

/* ---------- 权限判定（actionData L734-737 的唯一基准） ---------- */
function visibleTrainees(wid){
  const role=MOCK.userOf(wid).role;
  if(role==='admin') return MOCK.DB.trainees.slice();
  if(role==='mentor')           return MOCK.DB.trainees.filter(t=>t.mentorId===wid);
  return MOCK.DB.trainees.filter(t=>t.id===wid);
}

/* ---------- reviewTask（后端 L1463-1515） ---------- */
function canReview(wid, tid, taskId){
  const role=MOCK.userOf(wid).role;
  const t=MOCK.traineeOf(tid);
  if(role==='mentor'){
    if(!t||t.mentorId!==wid) return '只能审自己徒弟的提交';
    return true;                                        // 练 + 考均可
  }
  // admin：与导师**平行**的可审人（谁先审谁生效），不是"终审"
  if(role==='admin') return true;
  return '无审核权限（仅导师 / 管理员）';
}
function mockReview(tid, levelId, taskId, pass){
  const err=canReview(S.wid,tid,taskId);
  if(err!==true) return toast(err,'err');
  const T=(MOCK.DB.tasks[tid]=MOCK.DB.tasks[tid]||{}), L=(T[levelId]=T[levelId]||{});
  let rec=L[taskId];
  if(!rec||rec.status!=='submitted') return toast('该任务还没有提交记录，无法审核','err');
  /* 【模块 B5】归一化旧结构：审核记录与「当前提交版本」绑定。 */
  if(!Array.isArray(rec.versions)){
    rec={ status:rec.status, latest:1, reviewedVersion:rec.reviewedVersion,
          versions:[{ v:1, note:rec.note, at:rec.at, by:rec.by, byName:rec.byName, shots:rec.shots||[] }] };
    L[taskId]=rec;
  }
  rec.reviewedVersion = rec.latest || 1;   // 绑定「审核的是哪一版」

  const me=MOCK.userOf(S.wid);
  if(!pass){
    // 后端 L1487-1493：reviewNote 默认值 + .slice(0,300)
    const note=(typeof window.__rejNote==='string'&&window.__rejNote)||'';
    rec.status='rejected';
    rec.reviewNote=note.slice(0,300)||'请修改后重新提交';
    rec.reviewedAt=new Date().toISOString();
    rec.reviewedBy=S.wid; rec.reviewedByName=me.name;
    toast('已打回 · 学员会原文看到这段话','warn');
  }else{
    rec.status='passed';
    rec.reviewedAt=new Date().toISOString();
    rec.reviewedBy=S.wid; rec.reviewedByName=me.name;
    const J=(MOCK.DB.journey[tid]=MOCK.DB.journey[tid]||{}), SL=(J[levelId]=J[levelId]||{});
    let journeyWritten=false;
    if(taskId===MOCK.EXAM_TASK){
      // 后端 L1500-1502：EXAM 通过直接写 journey.exam，带 auto 字段
      SL.exam={ ok:true, by:S.wid, byName:me.name, at:rec.at, auto:true };
      journeyWritten=true;
    }else{
      // 后端 L1504-1508：该关全部卡 passed 才写 journey.practice（幂等）
      const defs=MOCK.TASK_DEFS.filter(d=>d.levelId===levelId);
      if(defs.length && defs.every(d=>(L[d.id]||{}).status==='passed')){
        SL.practice={ ok:true, by:S.wid, byName:me.name, at:rec.reviewedAt, auto:true };
        journeyWritten=true;
      }
    }
    toast(journeyWritten?('已通过 · 已写入闯关记录'):'已通过 · 本关仍有卡未交，「练」暂不记通过');
    if(journeyWritten){
      const cur=MOCK.currentLevelOf(tid);
      if(cur.no>Number(levelId.slice(1))) toast(`第 ${levelId} 关已通关 <svg class='ic'><use href='#i-arrow-r'/></svg> 第 ${cur.no} 关 ${cur.title} 已解锁`,'ok');
    }
  }
  rerenderAfterWrite();
  return true;
}

/* 打回原因输入：基线用原生 prompt，逐字保留原文（两条文案不同，不可合并）
   基线 L1286 任务卡：打回原因（学员会看到，便于修改后重新提交）：
   基线 L1318 考核  ：打回原因（学员会看到）：
   cb 无参时读 window.__rejNote；传了 tid/levelId/taskId 则直接回调实参 */
function askRejectReason(tid, levelId, taskId, cb){
  const isExam=taskId===MOCK.EXAM_TASK;
  const msg=isExam?'打回原因（学员会看到）：'
                  :'打回原因（学员会看到，便于修改后重新提交）：';
  const note=window.prompt(msg);
  if(note===null) return;              // 取消 = 不动数据
  if(typeof cb==='function') return cb(note);
  window.__rejNote=note;
  mockReview(tid,levelId,taskId,0);
  window.__rejNote=null;
}

/* ---------- 批量通过（原 trainer.html 的批量区，迁到管理端两入口） ----------
   【2026-10-04 用户决策】培训师角色移除后，原培训师页的「批量通过」迁到管理端：
     入口1. admin-journey.html 闯关总览（勾选待批考核 -> 一键通过）
     入口2. admin-dashboard.html 看板「待批改」卡片（同一条链路）
   权限：**逐条**走 canReview（admin 与导师平行可审，谁先审谁生效）——
         绝不能只判一次角色就批量写，否则越权条目会被连带通过。
   返回：{ ok:n, skip:[{tid,lvId,taskId,why}] } —— skip 明细回传给 UI 展示，不静默吞掉。 */
function mockBulkPass(list){
  const items=Array.isArray(list)?list:[];
  if(!items.length) return { ok:0, skip:[] };
  const me=MOCK.userOf(S.wid);
  const now=new Date().toISOString();
  let ok=0; const skip=[];
  items.forEach(it=>{
    const tid=it.tid, lvId=it.lvId, taskId=it.taskId;
    const err=canReview(S.wid,tid,taskId);
    if(err!==true){ skip.push({ tid,lvId,taskId, why:err }); return; }
    const T=(MOCK.DB.tasks[tid]=MOCK.DB.tasks[tid]||{}), L=(T[lvId]=T[lvId]||{});
    const rec=L[taskId];
    if(!rec||rec.status!=='submitted'){ skip.push({ tid,lvId,taskId, why:'该条已不是待审核状态' }); return; }
    // 落库字段与 mockReview 通过分支逐字一致（后端 L1495-1502）
    rec.status='passed';
    rec.reviewedAt=now;
    rec.reviewedBy=S.wid; rec.reviewedByName=me.name;
    const J=(MOCK.DB.journey[tid]=MOCK.DB.journey[tid]||{}), SL=(J[lvId]=J[lvId]||{});
    if(taskId===MOCK.EXAM_TASK){
      SL.exam={ ok:true, by:S.wid, byName:me.name, at:rec.at, auto:true };
    }else{
      // 与 mockReview 同规则：该关全部卡 passed 才写 journey.practice（含空清单防御）
      const defs=MOCK.TASK_DEFS.filter(d=>d.levelId===lvId);
      if(defs.length && defs.every(d=>(L[d.id]||{}).status==='passed'))
        SL.practice={ ok:true, by:S.wid, byName:me.name, at:now, auto:true };
    }
    ok++;
  });
  toast(ok?('已批量通过 '+ok+' 条'+(skip.length?(' · '+skip.length+' 条跳过'):'')):'没有可批量通过的条目', ok?'ok':'warn');
  rerenderAfterWrite();
  return { ok, skip };
}

/* ---------- adminSetJourney（后端 L1389 代录） ---------- */
function mockSetJourney(tid, levelId, stage, ok){
  if(S.role!=='admin') return toast('只有管理员能代录','err');
  const J=(MOCK.DB.journey[tid]=MOCK.DB.journey[tid]||{}), SL=(J[levelId]=J[levelId]||{});
  const me=MOCK.userOf(S.wid);
  if(ok){
    // 基线 L1413：代录记录**没有 auto 字段**（与审核写入不同，这里保持）
    SL[stage]={ ok:true, by:S.wid, byName:me.name, at:new Date().toISOString() };
    toast('已代录 '+MOCK.LV_STAGE_CN[stage]+'= 通过','ok');
  }else{
    delete SL[stage];
    toast('已清除该环节的代录记录');
  }
  rerenderAfterWrite();
}

/* ---------- adminSetReadiness（后端 L1526） ---------- */
function mockSetReadiness(tid, key, met){     // met: 1 / 0 / null(清除)
  if(S.role!=='admin') return toast('只有管理员能登记','err');
  const R=(MOCK.DB.readiness[tid]=MOCK.DB.readiness[tid]||{});
  const me=MOCK.userOf(S.wid);
  if(met===null){
    delete R[key];
    delete R.certifiedAt; delete R.certifiedBy; delete R.certifiedByName;   // L1543 联动撤销
    toast('已清除登记 · 转正认证同时被撤销','warn');
  }else{
    const cur=R[key]||{};
    R[key]={ ...cur, value:cur.value??null, met:met===1, by:S.wid, byName:me.name, at:new Date().toISOString() };
    if(met!==1){                          // L1558：登记为未达标 -> 连带撤销认证
      delete R.certifiedAt; delete R.certifiedBy; delete R.certifiedByName;
      toast('已登记为未达标 · 转正认证同时被撤销','warn');
    }else toast('已登记为达标','ok');
  }
  rerenderAfterWrite();
}
function mockSaveReadiness(tid, key){
  const v=document.getElementById('rdv-'+key), n=document.getElementById('rdn-'+key);
  if(!v) return;
  const line=MOCK.READINESS_LINES.find(l=>l.key===key);
  const val=v.value===''?null:Number(v.value);
  // 基线只用 key/name/source 判定，阈值仅下发展示；此处保持同一口径
  // 注意：【2026-10-04】原实现末尾漏了 rerenderAfterWrite()（同函数前半段有、这里没有），
  //   表现为「保存登记 -> toast 弹了但卡片数值不变」，必须手动刷新才更新。补上。
  const R=(MOCK.DB.readiness[tid]=MOCK.DB.readiness[tid]||{}), me=MOCK.userOf(S.wid);
  const old=R[key]||{};
  R[key]={ value:val, note:n?n.value.slice(0,200):'', by:S.wid, byName:me.name, at:new Date().toISOString(), met:old.met===true };
  toast('已保存登记 · 学员端达标线卡同步更新');
  closeModal(); rerenderAfterWrite();
}

/* ---------- adminCertify（后端 L1573） ---------- */
function mockCertify(tid){
  if(S.role!=='admin') return toast('只有管理员能认证转正','err');
  const t=MOCK.traineeOf(tid);
  if(!t) return toast('找不到该学员','err');
  const studyDone=MOCK.DB.levels.length>0 && MOCK.DB.levels.every(l=>MOCK.levelDone(tid,l));
  const R=MOCK.DB.readiness[tid]||{};
  const others=['traffic','editing','accounts'].filter(k=>!(R[k]&&R[k].met===true));
  if(!studyDone||others.length){
    const miss=[];
    if(!studyDone) miss.push('学习达标');
    others.forEach(k=>miss.push(MOCK.READINESS_LINES.find(l=>l.key===k).name));
    return toast(`还有 ${miss.length} 条线未达标（${miss.join('、')}），不能认证转正`,'err');
  }
  const me=MOCK.userOf(S.wid);
  if(R.certifiedAt) return toast('该学员已认证过（幂等）');
  R.certifiedAt=new Date().toISOString();
  R.certifiedBy=S.wid; R.certifiedByName=me.name;
  toast(t.name+' · 转正认证通过','ok');
  rerenderAfterWrite();
}
/* 注意：【2026-10-04 用户决策 1.=B】新 UI 已去掉「撤销认证」按钮 —— 后端无 revoke action，
   接线时无法真实生效。本函数**保留**（沙盒演示 + 老验收脚本引用），但生产 UI 不再有入口。 */
function mockRevokeCertify(tid){
  const R=MOCK.DB.readiness[tid]; if(!R) return;
  delete R.certifiedAt; delete R.certifiedBy; delete R.certifiedByName;
  toast('已撤销转正认证 · 3 条线登记保留');
  rerenderAfterWrite();
}

/* ---------- 达标线阈值：mock 实现保留，但新 UI 已无入口（2026-10-04 用户决策 2.=C） ----------
   【为什么保留】这份 mock 实现 + verify-readiness-threshold 验收脚本是阶段三的成果与决策痕迹，
     保留在沙盒里不影响生产。**生产 UI 不再暴露任何「改阈值」入口**（见 ui.js 同段注释）。
   注意： 三条硬约束（写错就是破坏基线）：
     1. 只允许 admin；导师/学员一律拒；
     2. source==='site'（学习达标）**禁止改** —— 它的阈值 = 关卡总数，改了会与实际判定脱节；
     3. **绝不写 READINESS_LINES**：那是"后端下发常量"的镜像。
        改写它 -> 会让人误判"后端返回值变了"，也破坏了"Mock = 线上真实"这一前提。
   传 reset=true -> 删掉覆盖值，回落到后端常量（弹层要提供"恢复默认"，否则改错了没法回退）。 */
function mockSetReadinessThreshold(key, value, reset){
  if(S.role!=='admin'){ toast('只有管理员能改达标线阈值','err'); return { error:'只有管理员能改达标线阈值' }; }
  const line=MOCK.READINESS_LINES.find(l=>l.key===key);
  if(!line){ toast('不存在的达标线','err'); return { error:'不存在的达标线' }; }
  if(line.source==='site'){ toast('「学习达标」由系统自动判定，阈值不可改','err'); return { error:'「学习达标」由系统自动判定，阈值不可改' }; }
  const box=(MOCK.DB.settings.readinessThresholds = MOCK.DB.settings.readinessThresholds||{});
  const me=MOCK.userOf(S.wid);
  if(reset){
    delete box[key];
    toast('已恢复默认阈值（'+line.threshold+' '+line.unit+'）','warn');
    closeModal(); rerenderAfterWrite();
    return { ok:true, reset:true, threshold:line.threshold };
  }
  const n=Number(value);
  if(value===''||value===null||value===undefined||!isFinite(n)||n<=0){
    toast('请填一个大于 0 的数字','err');
    return { error:'请填一个大于 0 的数字' };
  }
  box[key]={ value:n, by:S.wid, byName:me.name, at:new Date().toISOString() };
  toast('「'+line.name+'」阈值已改为 '+n+' '+line.unit+' · 已全员同步','warn');
  closeModal(); rerenderAfterWrite();
  return { ok:true, reset:false, threshold:n };
}

/* ---------- adminSetSetting（后端 L1377） ---------- */
function mockSetGate(on){
  if(S.role!=='admin') return toast('只有管理员能改这个开关','err');
  MOCK.DB.settings.enforceGate = on?true:false;
  toast(on?'强制解锁已开启':'强制解锁已关闭', on?'warn':'');
  closeModal();
  const sw=document.getElementById('gateSw'); if(sw) sw.checked=!!on;
  const lb=document.querySelector('.gatesw .tag');
  if(lb){ lb.className='tag '+(on?'ok':'ghost'); lb.textContent=on?'强制解锁 已开':'强制解锁 已关'; }
  rerenderAfterWrite();
}

/* ---------- 用户管理 ---------- */
function mockAddUser(){
  const g=id=>document.getElementById(id).value.trim();
  const role=g('uRole'), wid=g('uWid'), name=g('uName');
  const errs=[];
  /* 注意：【2026-10-04 同步】与 app.js RULES.wid 一致：字母开头、字母数字组合。
     原版要求「字母+数字」会把 admin 挡住（生产/后端均无格式校验）。 */
  if(!/^[A-Za-z][A-Za-z0-9]{0,11}$/.test(wid)) errs.push('工号格式：字母开头，字母+数字（如 M1 / S001 / admin）');
  if(name.length<2) errs.push('姓名至少 2 个字');
  const pw=document.getElementById('uPw').value;
  if(pw.length<6) errs.push('密码至少 6 位');
  const mentorId=g('uMentor');
  if(role==='student'&&!mentorId) errs.push('学员必须挂所属导师');
  if(errs.length) return toast(errs[0],'err');
  if(MOCK.userOf(wid)) return toast('工号 '+wid+' 已存在','err');

  MOCK.DB.users[wid]={ wid, role, name, dept:g('uDept')||'武汉校区', planId:g('uPlan'),
    mentorId: role==='student'?mentorId:'', title: g('uTitle'), points:0, lastCheckin:'' };
  if(role==='student'){
    MOCK.DB.trainees.push({ id:wid, name, wid, dept:g('uDept')||'武汉校区', mentorId, planId:g('uPlan'),
      joinDate:new Date().toISOString().slice(0,10), stage:'新手期', week:1, note:'' });
  }else{
    MOCK.DB.mentors.push({ id:wid, name, wid, dept:g('uDept')||'武汉校区', title:g('uTitle')||roleCN(role), planId:g('uPlan'), replyBy:'' });
  }
  toast('已创建 '+name+'（'+wid+'）','ok');
  closeModal(); rerenderAfterWrite();
}
function mockTransfer(wid){
  const to=document.getElementById('trTo').value;
  if(!to) return toast('请选择目标导师','err');
  const t=MOCK.traineeOf(wid); if(!t) return;
  t.mentorId=to;
  MOCK.DB.users[wid].mentorId=to;
  toast('已转到 '+(MOCK.mentorOf(to)||{}).name,'ok');
  closeModal(); rerenderAfterWrite();
}
function mockDeleteUser(wid){
  const msg=`确定删除用户 ${wid} ？\n\n将删除其账号与档案；其历史学习/同频/出师记录会保留。`;
  if(!window.confirm(msg)) return;
  delete MOCK.DB.users[wid];
  const ti=MOCK.DB.trainees.findIndex(t=>t.id===wid); if(ti>=0) MOCK.DB.trainees.splice(ti,1);
  const mi=MOCK.DB.mentors.findIndex(m=>m.id===wid);  if(mi>=0) MOCK.DB.mentors.splice(mi,1);
  toast('已删除 '+wid); rerenderAfterWrite();
}

/* ---------- 【2026-10-09 第三轮·模块 A】沙盒版：编辑资料 / 重置密码 / 换工号 ----------
   沙盒只演示界面与本地数据流；live 模式下由 mock-api-live.js 换成真实 action。 */
function mockEditStudent(wid, fields){
  fields = fields || {};
  const u = MOCK.userOf(wid); if(!u) throw new Error('学员不存在：'+wid);
  const t = MOCK.traineeOf(wid);
  // 校区白名单（与后端 CAMPUS_WHITELIST 同源口径）：非空且不在名单 → 拒绝，不自动替换
  const CL = (window.UI && UI.CAMPUS_LIST) || ["武汉","合肥","郑州","龙校","成都","重庆","西安","大连","南京","杭州","广州","南昌","福州","昆明"];
  if(fields.dept !== undefined && fields.dept !== '' && CL.indexOf(fields.dept) < 0)
    throw new Error('校区「'+fields.dept+'」不在支持名单内，请从下拉中重新选择');
  if(fields.mentorId){
    const m = MOCK.userOf(fields.mentorId);
    if(!m || m.role !== 'mentor') throw new Error('目标不是导师角色，不能作为带教老师');
  }
  if(fields.name !== undefined)   u.name = fields.name;
  if(fields.dept)                 u.dept = fields.dept;
  if(fields.mentorId !== undefined) u.mentorId = fields.mentorId;
  if(fields.planId !== undefined) u.planId = fields.planId;
  if(t){
    if(fields.name !== undefined)   t.name = fields.name;
    if(fields.dept)                 t.dept = fields.dept;
    if(fields.mentorId !== undefined) t.mentorId = fields.mentorId;
    if(fields.planId !== undefined) t.planId = fields.planId;
  }
  return { ok:true, wid };
}
function mockResetPw(wid, pw){
  const u = MOCK.userOf(wid); if(!u) throw new Error('账号不存在：'+wid);
  if(!pw || pw.length < 6) throw new Error('密码至少 6 位');
  u.pwResetAt = new Date().toISOString();   // 沙盒不存明文，只记时间（与后端口径一致：不保存明文）
  return { ok:true, wid };
}
/* 换工号：沙盒版做一次「完整键重命名」，模拟后端多表迁移（含 wid|xxx 复合键）。 */
function mockMigrateWid(oldWid, newWid, apply){
  const u = MOCK.userOf(oldWid);
  if(!u) { if(MOCK.userOf(newWid)) return { ok:true, already:true }; throw new Error('工号不存在：'+oldWid); }
  if(u.role !== 'student') throw new Error('本轮仅支持迁移学员工号');
  if(MOCK.userOf(newWid)) throw new Error('新工号已被占用：'+newWid);
  const ren = k => (k === oldWid) ? newWid : (k.indexOf(oldWid+'|') === 0 ? newWid + k.slice(oldWid.length) : k);
  const plan = {};
  ['learn','gates','journey','readiness','tasks','coaching','competency','signoffs','fav','qa','rating'].forEach(tn=>{
    const src = MOCK.DB[tn]; if(!src || typeof src !== 'object') return;
    const hit = Object.keys(src).filter(k=>k===oldWid || k.indexOf(oldWid+'|')===0).length;
    if(hit) plan[tn] = hit;
  });
  const tHit = (MOCK.DB.trainees||[]).filter(t=>t.id===oldWid).length;
  if(tHit) plan.trainees = tHit;
  plan.users = 1;
  if(!apply) return { ok:true, dryRun:true, changedTables:Object.keys(plan), counts:plan };
  // apply：逐表重命名
  ['learn','gates','journey','readiness','tasks','coaching','competency','signoffs','fav','qa','rating'].forEach(tn=>{
    const src = MOCK.DB[tn]; if(!src) return;
    const out = {};
    Object.keys(src).forEach(k=>{ out[ren(k)] = src[k]; });
    MOCK.DB[tn] = out;
  });
  (MOCK.DB.trainees||[]).forEach(t=>{ if(t.id===oldWid) t.id = newWid; });
  MOCK.DB.users[newWid] = u; delete MOCK.DB.users[oldWid];
  u.wid = newWid;
  return { ok:true, migrated:true, newWid };
}

/* ---------- 【2026-10-09 第三轮·模块 B】作业截图（沙盒版）----------
   沙盒不真正上传：mockUploadInitShot 返回一个本地 blob URL 占位，模拟「已上传完成的描述符」。 */
function mockSetTaskShot(taskId, required){
  if(!MOCK.DB.settings) MOCK.DB.settings = {};
  if(!MOCK.DB.settings.taskShots) MOCK.DB.settings.taskShots = {};
  if(required) MOCK.DB.settings.taskShots[taskId] = true;
  else delete MOCK.DB.settings.taskShots[taskId];
  return { ok:true, taskShots: MOCK.DB.settings.taskShots };
}
function shotRequiredOf(taskId){
  const m = (MOCK.DB.settings && MOCK.DB.settings.taskShots) || {};
  return m[taskId] === true;
}
/* 沙盒：不给真 URL，只登记一个 pending 描述符；真正「完成」由 UI 在选文件后直接给 size/type。 */
function mockUploadInitShot(levelId, taskId, type, size, name){
  const CL_TYPES = ['image/jpeg','image/jpg','image/png','image/webp'];
  if(CL_TYPES.indexOf(String(type||'').toLowerCase()) < 0) throw new Error('截图格式不支持（仅 JPG / PNG / WebP）');
  if(!(size > 0) || size > 5*1024*1024) throw new Error('截图超过 5MB 上限');
  const wid = S.wid;
  const key = 'shots/' + wid + '/' + levelId + '/' + taskId + '/' + Math.random().toString(16).slice(2,10) + '.jpg';
  return { ok:true, key, url:'', sandbox:true };
}
function mockShotSign(keys){
  // 沙盒：本地 blob 由调用方自己持有，这里返回空 map（UI 会回退到本地预览）
  return { ok:true, urls:{}, ttl:600 };
}
/* 沙盒版截图上传：不真的 PUT，只走一遍校验并返回描述符（live 模式由 mock-api-live.js 覆盖）。 */
async function liveUploadShot(levelId, taskId, file){
  if(!file) throw new Error('没有选文件');
  const ALLOW = ['image/jpeg','image/jpg','image/png','image/webp'];
  const ty = String(file.type || '').toLowerCase();
  if(ALLOW.indexOf(ty) < 0) throw new Error('仅支持 JPG / PNG / WebP');
  if(!(file.size > 0)) throw new Error('文件是空的');
  if(file.size > 5*1024*1024) throw new Error('截图超过 5MB 上限：' + file.name);
  const wid = S.wid;
  const key = 'shots/' + wid + '/' + levelId + '/' + taskId + '/' + Math.random().toString(16).slice(2,10) + '.jpg';
  try{ file.__sandboxUrl = URL.createObjectURL(file); }catch(e){}
  return { key, type: ty, size: file.size, name: file.name };
}

/* ---------- 课程管理 ---------- */
function mockCourseStatus(cid, on){
  const c=MOCK.courseOf(cid); if(!c) return;
  if(on){
    if(!window.confirm(`确定上架「${c.title}」？\n\n上架后学员即可在课程中心看到这门课。`)) return;
    c.status='on';
  }else{
    if(!window.confirm(`确定下架「${c.title}」？\n\n下架后学员端将不再显示这门课（学员已有的学习进度会保留），管理端仍可见，可以随时重新上架。`)) return;
    c.status='off';
  }
  toast(on?'已上架':'已下架 · 学习进度保留');
  rerenderAfterWrite();
}
function mockDeleteCourse(cid){
  const c=MOCK.courseOf(cid); if(!c) return;
  const typed=(document.getElementById('dcTitle')||{}).value;
  if(typed!==c.title) return toast(`课程名不一致，已取消删除。请完整输入「${c.title}」。`,'err');
  const i=MOCK.DB.courses.findIndex(x=>x.id===cid);
  MOCK.DB.courses.splice(i,1);
  MOCK.DB.seedlogCourses.push(cid);       // 不复活（基线 seedlog-courses.json 语义）
  toast('已删除 '+cid+' · 已登记到 seedlog，不会被种子复活');
  closeModal(); rerenderAfterWrite();
}

/* ---------- 出师 ---------- */
function mockSignoff(wid){
  const rt=document.getElementById('rt').value;
  const byPlan=(MOCK.DB.competency[wid]||{}).byPlan||{};
  const comps=Object.values(byPlan).flatMap(p=>Object.entries(p.comps||{}));
  if(!(comps.length>0&&comps.every(([,v])=>v))) return toast('胜任力未全达标，不能出师','err');
  MOCK.DB.signoffs[wid]={ planId:Object.keys(byPlan)[0]||'', rating:rt, mentorName:S.name, ts:new Date().toISOString() };
  (MOCK.DB.coaching[wid]=MOCK.DB.coaching[wid]||{id:wid,events:[]}).events.push(
    { ts:new Date().toISOString(), ev:'出师', txt:'结业评级：'+rt });
  toast('已生成结业凭证 · 评级「'+rt+'」','ok');
  closeModal(); rerenderAfterWrite();
}

/* ---------- 学员提交 ---------- */
/* 【2026-10-09 第三轮·模块 B1/B5】支持截图 + 版本化：
   shots: [{key,type,size,name}]（最多 3 张，后端已强校验；沙盒重复一次同样的校验）。
   版本：每次提交 push 一个 version，latest 指向它；重新提交不覆盖历史。 */
function mockSubmitTask(tid, levelId, taskId, note, shots){
  const lv=MOCK.levelOf(levelId);
  if(!lv) return toast('关卡不存在','err');
  if(!MOCK.levelUnlocked(tid,lv)) return toast(`第 ${levelId} 关未解锁，无法提交`,'err');
  if(!note||!note.trim()) return toast('请填写完成说明','err');
  if(taskId===MOCK.EXAM_TASK){
    if(!lv.stages.exam) return toast('该关没有考核环节','err');
  }else{
    const def=MOCK.TASK_DEFS.find(d=>d.id===taskId);
    if(!def||def.levelId!==levelId) return toast('任务卡不属于该关','err');
    if(!lv.stages.practice) return toast('该关没有任务卡环节','err');
  }
  if(MOCK.DB.journey[tid]&&MOCK.DB.journey[tid][levelId]&&MOCK.DB.journey[tid][levelId][taskId==='EXAM'?'exam':'practice']&&
     MOCK.DB.journey[tid][levelId][taskId==='EXAM'?'exam':'practice'].ok)
    return toast('该环节已通过，不能重复提交','err');
  // 截图校验（与后端 shotRequiredOf / MAX_SHOTS / 类型 / 大小同口径）
  const list = Array.isArray(shots) ? shots : [];
  if(list.length > 3) return toast('截图最多 3 张','err');
  for(const s of list){
    const ty = String((s&&s.type)||'').toLowerCase();
    if(['image/jpeg','image/jpg','image/png','image/webp'].indexOf(ty) < 0) return toast('截图格式不支持（仅 JPG / PNG / WebP）','err');
    if(!(Number(s&&s.size)>0) || Number(s.size) > 5*1024*1024) return toast('截图超过 5MB 上限','err');
  }
  if(shotRequiredOf(taskId) && list.length < 1) return toast('该任务卡要求上传至少 1 张截图','err');

  const T=(MOCK.DB.tasks[tid]=MOCK.DB.tasks[tid]||{}), L=(T[levelId]=T[levelId]||{});
  let rec = L[taskId];
  // 归一化旧结构（单对象 → versions[1]）
  if(rec && !Array.isArray(rec.versions)){
    rec = { status: rec.status, versions: [{ v:1, note:rec.note, at:rec.at, by:rec.by, byName:rec.byName,
             shots:rec.shots||[], reviewNote:rec.reviewNote, reviewedBy:rec.reviewedBy, reviewedAt:rec.reviewedAt }],
            latest:1, reviewedVersion:rec.reviewedVersion };
  }
  if(rec && rec.status==='passed') return toast('该任务卡已通过，不能重复提交','err');
  if(!rec) rec = { status:'submitted', versions:[], latest:0 };
  const nextV = (rec.latest || 0) + 1;
  rec.versions.push({ v:nextV, note:note.slice(0,500), at:new Date().toISOString(),
                      by:tid, byName:(MOCK.userOf(tid)||{}).name || tid, shots:list.slice(0,3) });
  rec.latest = nextV;
  rec.status = 'submitted';
  delete rec.reviewNote; delete rec.reviewedBy; delete rec.reviewedAt; delete rec.reviewedVersion;
  L[taskId] = rec;
  toast(list.length ? ('已提交（'+list.length+' 张截图），等带教导师批改') : '已提交，等带教导师批改');
  rerenderAfterWrite();
}

/* ---------- 打卡（后端 L871） ---------- */
function mockCheckin(){
  const u=MOCK.userOf(S.wid);
  const today=new Date().toISOString().slice(0,10);   // 注意： 基线用 UTC 日期（既有缺陷，保留）
  if(u.lastCheckin===today){ toast('今天已打过卡'); return; }
  u.points+=10; u.lastCheckin=today;
  toast('打卡成功 +10 · 当前积分 '+u.points,'ok');
  rerenderAfterWrite();
}

/* ============================================================
   学员端学习行为写操作（后端 fav / rate / qa / learn / gateMentee）
   注意： 全部只写内存 Mock，不落 COS；字段名照抄后端
   ============================================================ */
function learnOf(wid,cid){
  return (MOCK.DB.learn[MOCK.KEY(wid,cid)] ||= { done:[], speed:1, resumeAt:0, dragSkip:false, events:[], wrong:[] });
}
// fav：整课收藏/取消（后端 L1006 fav）
function mockToggleFav(cid){
  const w=S.wid;
  const F=(MOCK.DB.fav[w]=MOCK.DB.fav[w]||{courses:{}});
  const C=F.courses=F.courses||{};
  const wasOn=!!C[cid];
  if(wasOn) delete C[cid]; else C[cid]=new Date().toISOString();
  toast(wasOn?'已取消收藏':'已加入收藏');
  rerenderAfterWrite();
}
// rate：1–5 星（后端 L1030 rate），同工号覆盖
function mockSetRate(cid,n){
  if(!(n>=1&&n<=5)) return toast('评分只能是 1–5','err');
  const R=(MOCK.DB.rating[cid]=MOCK.DB.rating[cid]||{id:cid,scores:{}});
  R.scores[S.wid]=n;                       // 后端按 wid 存，同工号覆盖
  toast('已评 '+n+' 星');
  rerenderAfterWrite();
}
function avgRating(cid){
  const s=(MOCK.DB.rating[cid]||{}).scores||{};
  const v=Object.values(s);
  return v.length? v.reduce((a,b)=>a+b,0)/v.length : 0;
}
// qa：答疑留言（后端 L1049 qa），只显示工号 u
function mockPostQA(cid){
  const el=document.getElementById('qaTxt');
  const txt=el?el.value.trim():'';
  if(!txt) return toast('请输入内容','err');
  const Q=(MOCK.DB.qa[cid]=MOCK.DB.qa[cid]||{id:cid,items:[]});
  Q.items.push({ u:S.wid, ts:new Date().toISOString().slice(0,16).replace('T',' '), txt });
  toast('留言已发布');
  rerenderAfterWrite();
}
// learn：标记本章完成（后端 L1104 learn），带 speed/resumeAt/dragSkip + 事件流
function mockMarkDone(cid,chid,type,label,extra){
  if(MOCK.courseLocked(cid,S.wid)) return toast(MOCK.lockReason(cid,S.wid),'warn');   // 第2层闸门
  const c=MOCK.courseOf(cid); if(!c) return;
  const ch=c.chapters.find(x=>x.id===chid); if(!ch) return;
  const lr=learnOf(S.wid,cid);
  if(type!=='quiz' && !lr.done.includes(chid)) lr.done.push(chid);
  lr.speed=Number((document.getElementById('spd')||{}).value||lr.speed||1);
  lr.resumeAt=parseInt((document.getElementById('rs')||{}).value||lr.resumeAt||0,10)||0;
  lr.dragSkip=((document.getElementById('dr')||{}).value==='1')||lr.dragSkip;
  lr.events=lr.events||[];
  lr.events.push({ ts:new Date().toISOString(), t:lr.resumeAt, d:0 });   // events 只增不删
  if(type==='quiz' && extra && extra.wrong) lr.wrong=(lr.wrong||[]).concat(extra.wrong);
  toast(label?('已记录：'+label):'已标记本章完成','ok');
  closeModal(); rerenderAfterWrite();
}
// gateMentee：学员提交同频反思（后端 L1120）—— 只写 mentee，mentor 必须导师端确认
function mockSubmitSync(cid,chid){
  const el=document.getElementById('note');
  const note=el?el.value.trim():'';
  if(!note) return toast('请填写反思再提交','err');
  const g=(MOCK.DB.gates[MOCK.KEY3(S.wid,cid,chid)] ||= { mentee:false, menteeNote:'', mentor:false });
  g.mentee=true; g.menteeNote=note;
  toast('已提交，等待导师确认后解锁');
  closeModal(); rerenderAfterWrite();
}

/* ---------- 写操作后重绘（基线 mentorRerender L1269-1282 四路分支的等价实现） ---------- */
function rerenderAfterWrite(){
  UI.refreshTodoDot(S.wid);
  if(typeof window.__rerender==='function') window.__rerender();
}

window.MOCKAPI={S,setSession,visibleTrainees,canReview,mockReview,askRejectReason,mockBulkPass,
  mockSetJourney,mockSetReadiness,mockSaveReadiness,mockCertify,mockRevokeCertify,mockSetGate,
  mockSetReadinessThreshold,
  mockAddUser,mockTransfer,mockDeleteUser,mockCourseStatus,mockDeleteCourse,mockSignoff,
  mockSubmitTask,mockCheckin,learnOf,mockToggleFav,mockSetRate,avgRating,mockPostQA,
  mockMarkDone,mockSubmitSync,rerenderAfterWrite,
  mockEditStudent,mockResetPw,mockMigrateWid,mockSetTaskShot,mockUploadInitShot,mockShotSign};
Object.assign(window,{setSession,canReview,mockReview,askRejectReason,mockBulkPass,mockSetJourney,
  mockSetReadiness,mockSaveReadiness,mockCertify,mockRevokeCertify,mockSetGate,mockAddUser,
  mockSetReadinessThreshold,
  mockTransfer,mockDeleteUser,mockCourseStatus,mockDeleteCourse,mockSignoff,mockSubmitTask,
  mockCheckin,learnOf,mockToggleFav,mockSetRate,avgRating,mockPostQA,mockMarkDone,mockSubmitSync,
  mockEditStudent,mockResetPw,mockMigrateWid,mockSetTaskShot,mockUploadInitShot,mockShotSign});
window.liveUploadShot = liveUploadShot;