/* 管理端作业档案：只读取现有 tasks，沿用截图鉴权与查看器。 */
(function(root){
 'use strict';
 const statuses={submitted:'待批改',passed:'已通过',rejected:'已打回'};
 const state={page:1,pageSize:12,rows:[],all:[],initialized:false};
 const esc=value=>UI.esc(String(value==null?'':value));
 const time=value=>{const d=new Date(value);return value&&Number.isFinite(d.getTime())?d.toLocaleString('zh-CN',{hour12:false}):'未记录';};
 function entries(rows){
  if(MOCKAPI.S.role!=='admin')return [];
  const defs=Array.isArray(MOCK.DB.taskDefs)?MOCK.DB.taskDefs:MOCK.TASK_DEFS||[];
  const out=[];
  (rows||[]).forEach(t=>Object.entries(MOCK.DB.tasks[t.id]||{}).forEach(([lvId,tasks])=>Object.entries(tasks||{}).forEach(([taskId,raw])=>{
   if(!raw||typeof raw!=='object')return;
   if(!statuses[raw.status]&&!(raw.versions&&raw.versions.length)&&!raw.at&&!raw.note&&!(raw.shots&&raw.shots.length))return;
   const existing=Array.isArray(raw.versions)?raw.versions.filter(v=>v&&typeof v==='object'):[];
   const versions=existing.length?existing:[{v:raw.latest||1,note:raw.note,at:raw.at,by:raw.by,byName:raw.byName,shots:raw.shots||[]}];
   const current=versions.find(v=>Number(v.v)===Number(raw.latest))||versions[versions.length-1];
   const level=(MOCK.DB.levels||[]).find(l=>l.id===lvId),exam=taskId===MOCK.EXAM_TASK;
   const def=defs.find(d=>d.id===taskId&&d.levelId===lvId)||defs.find(d=>d.id===taskId);
   const title=exam?'关卡考核':def&&def.title||taskId;
   const mentor=MOCK.userOf(t.mentorId)||{};
   out.push({tid:t.id,name:t.name||t.id,mentor:mentor.name||'',lvId,level,taskId,title,def,exam,raw,current,versions,status:raw.status||'unknown',at:current.at||raw.at||''});
  })));
  return out.sort((a,b)=>(Date.parse(b.at)||0)-(Date.parse(a.at)||0)||a.tid.localeCompare(b.tid)||a.lvId.localeCompare(b.lvId)||a.taskId.localeCompare(b.taskId));
 }
 function tag(status){return `<span class="tag ${status==='passed'?'ok':status==='rejected'?'danger':status==='submitted'?'warn':'ghost'}">${esc(statuses[status]||'状态未记录')}</span>`;}
 function init(){
  if(state.initialized)return;
  const panel=document.getElementById('assignmentRecords');if(!panel)return;
  state.initialized=true;
  ['assignmentSearch','assignmentStudent','assignmentStatus','assignmentLevel'].forEach(id=>document.getElementById(id).addEventListener(id==='assignmentSearch'?'input':'change',()=>{state.page=1;draw();}));
  panel.addEventListener('click',event=>{
   const detail=event.target.closest('[data-assignment-index]');
   if(detail){open(Number(detail.dataset.assignmentIndex));return;}
   const pager=event.target.closest('[data-assignment-page]');
   if(pager){state.page+=Number(pager.dataset.assignmentPage);draw();return;}
   if(event.target.closest('[data-assignment-reset]')){
    ['assignmentSearch','assignmentStudent','assignmentStatus','assignmentLevel'].forEach(id=>document.getElementById(id).value='');state.page=1;draw();
   }
  });
  document.addEventListener('click',event=>{
   const trigger=event.target.closest('[data-show-assignments]');if(trigger)show(trigger.dataset.showAssignments||'');
  });
 }
 function options(id,values,label){
  const el=document.getElementById(id),old=el.value;
  el.innerHTML=`<option value="">${label}</option>`+values.map(([value,text])=>`<option value="${esc(value)}">${esc(text)}</option>`).join('');
  if(values.some(([v])=>v===old))el.value=old;
 }
 function render(rows){
  init();if(!state.initialized)return;
  state.rows=rows||[];state.all=entries(rows);
  options('assignmentStudent',state.rows.map(t=>[t.id,(t.name||t.id)+' · '+t.id]),'全部学员');
  const lvs=new Map((MOCK.DB.levels||[]).map(l=>[l.id,'第 '+l.no+' 关 · '+l.title]));
  state.all.forEach(e=>{if(!lvs.has(e.lvId))lvs.set(e.lvId,e.lvId+'（历史关卡）');});
  options('assignmentLevel',[...lvs],'全部关卡');draw();
 }
 function draw(){
  const q=document.getElementById('assignmentSearch').value.trim().toLowerCase(),tid=document.getElementById('assignmentStudent').value,status=document.getElementById('assignmentStatus').value,level=document.getElementById('assignmentLevel').value;
  const filtered=state.all.filter(e=>(!tid||e.tid===tid)&&(!status||(status==='reviewed'?['passed','rejected'].includes(e.status):e.status===status))&&(!level||e.lvId===level)&&(!q||[e.name,e.tid,e.mentor,e.lvId,e.level&&e.level.title,e.title,e.taskId,e.exam?'考核':'练习',e.current.note].join(' ').toLowerCase().includes(q)));
  const pages=Math.max(1,Math.ceil(filtered.length/state.pageSize));state.page=Math.max(1,Math.min(state.page,pages));
  document.getElementById('assignmentCount').textContent='共 '+state.all.length+' 份作业';
  document.getElementById('assignmentSummary').textContent='待批改 '+state.all.filter(e=>e.status==='submitted').length+' · 已通过 '+state.all.filter(e=>e.status==='passed').length+' · 已打回 '+state.all.filter(e=>e.status==='rejected').length+'；当前筛选 '+filtered.length+' 份';
  const visible=filtered.slice((state.page-1)*state.pageSize,state.page*state.pageSize);
  document.getElementById('assignmentList').innerHTML=visible.map(e=>`<article class="assignment-row"><div class="assignment-identity"><b>${esc(e.name)}</b><span class="hint">${esc(e.tid)} · ${esc(e.mentor||'带教未指定')}</span></div><div class="assignment-task"><b>${esc(e.level?'第 '+e.level.no+' 关 · '+e.title:e.lvId+' · '+e.title)}</b><p class="assignment-note">${esc(e.current.note||'无提交说明')}</p><span class="hint">提交：${esc(time(e.at))} · ${e.versions.length} 个版本</span></div><div class="assignment-result">${tag(e.status)}<span class="hint">${e.raw.reviewedByName||e.raw.reviewedBy?'批改人：'+esc(e.raw.reviewedByName||e.raw.reviewedBy):e.status==='submitted'?'等待批改':'批改人未记录'}</span></div><button type="button" class="btn sm ghost" data-assignment-index="${state.all.indexOf(e)}" aria-label="查看${esc(e.name)}的${esc(e.title)}作业详情">查看详情</button></article>`).join('')||'<div class="empty"><b>'+(state.all.length?'没有符合条件的作业':'暂无学员提交作业')+'</b><p class="hint">'+(state.all.length?'请调整学员、状态、关卡或搜索条件。':'学员提交练习或考核后，会在这里显示。')+'</p></div>';
  document.getElementById('assignmentPager').innerHTML=`<button class="btn sm ghost" type="button" data-assignment-page="-1"${state.page<=1?' disabled':''}>上一页</button><span class="hint">${state.page} / ${pages} 页</span><button class="btn sm ghost" type="button" data-assignment-page="1"${state.page>=pages?' disabled':''}>下一页</button>`;
 }
 function show(tid){
  if(MOCKAPI.S.role!=='admin')return;
  const panel=document.getElementById('assignmentRecords');if(!panel)return;
  panel.open=true;document.getElementById('assignmentStudent').value=tid||'';
  document.getElementById('assignmentStatus').value='';document.getElementById('assignmentLevel').value='';document.getElementById('assignmentSearch').value='';state.page=1;draw();
  panel.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});
 }
 function shots(version){
  const list=(Array.isArray(version.shots)?version.shots:[]).filter(s=>s&&typeof s.key==='string'&&s.key).map(s=>({key:s.key,name:s.name||''}));
  return list.length?`<div data-assignment-shots="${esc(JSON.stringify(list))}"><p class="hint">正在加载截图…</p></div>`:'<p class="hint">本次提交未附截图。</p>';
 }
 async function hydrate(holders){
  const unique=[...new Set(holders.flatMap(h=>JSON.parse(h.dataset.assignmentShots||'[]').map(s=>s.key)))],urls={};
  // 现有签名接口每次最多接收三张；历史版本展开时再按批次读取。
  for(let i=0;i<unique.length;i+=3)Object.assign(urls,await UI.signShots(unique.slice(i,i+3)));
  holders.forEach(h=>{
   if(!h.isConnected)return;
   const list=JSON.parse(h.dataset.assignmentShots||'[]'),missing=list.some(s=>!urls[s.key]);
   h.innerHTML=UI.shotsHTML(list,urls,{})+(missing?'<p class="hint">部分截图暂未加载成功。</p><button class="btn sm ghost" type="button" data-assignment-retry>重试截图</button>':'');
   const retry=h.querySelector('[data-assignment-retry]');if(retry)retry.addEventListener('click',()=>hydrate([h]));
  });
 }
 function versionHTML(v,label){
  return `<section class="assignment-version"><h3>${esc(label)}</h3><p class="hint">提交时间：${esc(time(v.at))} · 提交人：${esc(v.byName||v.by||'未记录')}</p><p class="assignment-submission">${esc(v.note||'无提交说明')}</p>${shots(v)}${v.reviewedAt||v.reviewedBy||v.reviewedByName?`<p class="hint">该版本留存的批改人：${esc(v.reviewedByName||v.reviewedBy||'未记录')} · ${esc(time(v.reviewedAt))}</p>`:''}${v.reviewNote?`<div class="note">该版本留存的批改意见：${esc(v.reviewNote)}</div>`:''}</section>`;
 }
 function open(index){
  if(MOCKAPI.S.role!=='admin')return;
  // 重读数据，避免筛选或批改刷新后误用旧记录。
  const prior=state.all[index];if(!prior)return;
  const e=entries(MOCKAPI.visibleTrainees(MOCKAPI.S.wid)).find(x=>x.tid===prior.tid&&x.lvId===prior.lvId&&x.taskId===prior.taskId);
  if(!e)return toast('该作业记录已变化，请刷新列表。','warn');
  const raw=e.raw,history=e.versions.filter(v=>v!==e.current),examConfig=e.level&&e.level.stages&&e.level.stages.exam;
  const req=e.def&&e.def.req||e.exam&&examConfig&&(examConfig.req||examConfig.requirement)||'';
  const review=raw.reviewedAt||raw.reviewedBy||raw.reviewedByName||raw.reviewNote||raw.reviewedVersion;
  UI.openModal(modal('学员作业详情',`<div class="assignment-detail-head"><b>${esc(e.name)} · ${esc(e.tid)}</b>${tag(e.status)}<p>${esc(e.level?'第 '+e.level.no+' 关 · '+e.level.title:e.lvId)} / ${esc(e.title)}</p></div>${req?`<div class="note"><b>作业要求：</b>${esc(req)}</div>`:''}${versionHTML(e.current,'最新提交 · 第 '+(e.current.v||raw.latest||1)+' 版')}<section class="assignment-version"><h3>批改信息</h3>${review?`<p class="hint">批改人：${esc(raw.reviewedByName||raw.reviewedBy||'未记录')}<br>批改时间：${esc(time(raw.reviewedAt))}${raw.reviewedVersion?'<br>关联提交：第 '+esc(raw.reviewedVersion)+' 版':''}</p><p class="assignment-submission">${esc(raw.reviewNote||'未填写批改意见')}</p>`:`<p class="hint">${e.status==='submitted'?'尚未批改。':'该历史记录未留存批改人、时间或意见。'}</p>`}</section>${history.length?`<details class="fold"><summary>历史提交（${history.length} 版）</summary><div class="fold-body">${history.slice().reverse().map(v=>versionHTML(v,'第 '+(v.v||'—')+' 版')).join('')}</div></details>`:''}`,'<button type="button" class="btn ghost" onclick="closeModal()">关闭</button>'));
  const modalNode=document.getElementById('modal'),fold=modalNode.querySelector('details.fold');
  hydrate([...modalNode.querySelectorAll('[data-assignment-shots]')].filter(h=>!h.closest('details.fold')));
  if(fold)fold.addEventListener('toggle',()=>{if(fold.open)hydrate([...fold.querySelectorAll('[data-assignment-shots]')]);});
 }
 root.Assignments={render,show,entries};
})(window);
