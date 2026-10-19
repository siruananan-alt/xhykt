(function(){
  'use strict';
  const $=id=>document.getElementById(id),esc=value=>UI.esc(String(value??''));
  const text=value=>new DOMParser().parseFromString(String(value??''),'text/html').body.textContent||'';
  const ordered=()=>MOCK.DB.levels.slice().sort((a,b)=>a.no-b.no);
  let keyword=new URLSearchParams(location.search).get('q')||'';
  let ready=false,renderedId='';
  function link(id,q=keyword){const url=new URL(location.href);url.searchParams.set('lv',id);q?url.searchParams.set('q',q):url.searchParams.delete('q');return url.href;}
  function idsOf(lv){return lv.stages?.study?.courseIds||[];}
  function courseOf(cid){return MOCK.DB.courses.find(c=>c.id===cid);}
  function tasksOf(lv){return MOCK.TASK_DEFS.filter(task=>task.levelId===lv.id);}
  function matches(lv){
    const courses=idsOf(lv).map(courseOf).filter(Boolean);
    return text([lv.no,lv.title,lv.phase,...courses.flatMap(c=>[c.title,...(c.chapters||[]).map(ch=>ch.title)]),...tasksOf(lv).map(t=>t.title)].join(' ')).toLocaleLowerCase().includes(keyword.trim().toLocaleLowerCase());
  }
  function stageNames(lv){return ['study','practice','exam'].filter(s=>lv.stages?.[s]).map(s=>({study:'学',practice:'练',exam:'考'})[s]);}
  function choose(id,push=true){
    if(push)history.pushState(null,'',link(id));else history.replaceState(null,'',link(id));
    closePreview();render();
    if(matchMedia('(max-width:640px)').matches)$('courseContent').scrollIntoView({block:'start'});
  }
  function renderDirectory(levels,current){
    const groups=new Map();levels.forEach(lv=>{const phase=lv.phase||'其他关卡';if(!groups.has(phase))groups.set(phase,[]);groups.get(phase).push(lv);});
    $('directoryCount').textContent=ordered().length+' 关';
    $('directoryResults').textContent=keyword.trim()?'找到 '+levels.length+' 个关卡':'';
    $('levelDirectory').innerHTML=Array.from(groups,([name,items])=>`<div class="mc-phase"><h3>${esc(name)}</h3>${items.map(lv=>`<a class="mc-level" href="${esc(link(lv.id))}" data-level="${esc(lv.id)}" ${lv.id===current?'aria-current="page"':''}><span class="mc-number">${esc(String(lv.no).padStart(2,'0'))}</span><span><b>${esc(text(lv.title))}</b><small>${esc(stageNames(lv).join(' · '))}</small></span></a>`).join('')}</div>`).join('');
    $('mobileLevel').innerHTML=Array.from(groups,([name,items])=>`<optgroup label="${esc(name)}">${items.map(lv=>`<option value="${esc(lv.id)}" ${lv.id===current?'selected':''}>第 ${esc(lv.no)} 关 · ${esc(text(lv.title))}</option>`).join('')}</optgroup>`).join('');
    $('mobileLevel').disabled=!levels.length;
  }
  function empty(message){return `<div class="mc-empty">${esc(message)}</div>`;}
  function duration(seconds){const n=Number(seconds);return n>0?Math.ceil(n/60)+' 分钟':'时长待补充';}
  function mediaUrl(raw){
    try{const source=String(raw||'').trim();if(!source)return '';const url=new URL(source.startsWith('assets/')?'../'+source:source,location.href);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password?url.href:'';}catch(e){return '';}
  }
  function videoButton(title,source,subtitle=''){
    const url=mediaUrl(source);
    return `<div class="mc-chapter"><div><h4>${esc(text(title))}</h4>${subtitle?`<p class="hint">${esc(subtitle)}</p>`:''}</div>${url?`<button class="btn sm" data-preview-url="${esc(url)}" data-preview-title="${esc(text(title))}">预览视频</button>`:'<span class="tag ghost">暂未上传</span>'}</div>`;
  }
  function documents(course,lv){
    const docs=course.docs||[];
    return `<div class="mc-docs"><b>课件资料</b>${docs.length?`<ul>${docs.map((doc,index)=>{
      try{return `<li><a href="${esc(DocumentPreview.readerLink(course.id,index,doc,location.href,{mentorLevel:lv.id}))}">${esc(doc.name||'课程资料')}${doc.size?' · '+esc(doc.size):''}</a></li>`;}catch(e){return `<li>${esc(doc.name||'课程资料')} · 地址暂不可用</li>`;}
    }).join('')}</ul>`:'<p class="hint">暂无资料</p>'}</div>`;
  }
  function quiz(ch){
    const questions=ch.questions||[];
    return `<details class="mc-quiz"><summary>${esc(text(ch.title))} · 测验内容</summary>${questions.length?questions.map((q,i)=>`<div class="mc-question"><b>${i+1}. ${esc(q.q||q.question||'题目待补充')}</b><ol type="A">${(q.a||q.options||[]).map(option=>`<li>${esc(option)}</li>`).join('')}</ol><p class="mc-answer">正确答案：${Number.isInteger(q.ans)&&(q.a||q.options||[])[q.ans]!==undefined?esc(String.fromCharCode(65+q.ans)+' · '+(q.a||q.options)[q.ans]):'暂未配置'}</p></div>`).join(''):empty('暂未录入测验题目')}</details>`;
  }
  function study(lv){
    const courses=idsOf(lv);
    return section('学','课程与资料','逐章预览课程视频，查看课件和测验内容。',courses.length?courses.map(cid=>{
      const c=courseOf(cid);if(!c)return empty('关联课程 '+cid+' 暂不可用，请联系管理员核对。');
      const chapters=c.chapters||[];
      return `<article class="mc-course"><div class="mc-heading"><h3>${esc(text(c.title))}</h3><span class="tag ghost">${chapters.length} 个章节</span></div><p class="hint">${esc(c.lecturer||'讲师待补充')}${c.subject?' · '+esc(c.subject):''}${c.status==='off'?' · 已下架课程':''}</p>${c.desc?`<p class="mc-intro">${esc(text(c.desc))}</p>`:''}${chapters.length?chapters.map(ch=>ch.type==='video'?videoButton(ch.title,ch.src,duration(ch.dur)):ch.type==='quiz'?quiz(ch):`<div class="mc-chapter"><div><h4>${esc(text(ch.title))}</h4><p class="hint">${ch.type==='sync'||ch.gate?'带教同频环节':'课程环节'}${ch.desc?' · '+esc(text(ch.desc)):''}</p></div></div>`).join(''):empty('暂无章节')}${documents(c,lv)}</article>`;
    }).join(''):empty('本关暂无关联课程，请查看本关其他环节。'));
  }
  function tutorial(lv){
    const raw=(MOCK.DB.settings.practiceVideos||{})[lv.id];
    const videos=(Array.isArray(raw)?raw:raw?[raw]:[]).filter(Boolean);
    return `<div class="mc-tutorials"><h3>教学示范视频</h3>${videos.length?videos.map((v,i)=>videoButton(v.title||'教学示范视频 '+(i+1),v.url,'示范 '+(i+1))).join(''):empty('暂未上传教学示范视频')}</div>`;
  }
  function shotText(id){return MOCK.DB.settings.taskShots?.[id]===true?'需提交截图（最多 3 张）':'截图可选（最多 3 张）';}
  function section(icon,title,hint,body){return `<section class="card mc-stage" data-stage="${esc(icon)}"><div class="mc-stage-title"><span class="mc-stage-icon">${esc(icon)}</span><div><h2>${esc(title)}</h2><p class="hint">${esc(hint)}</p></div></div>${body}</section>`;}
  function practice(lv){
    const tasks=tasksOf(lv),fallback=lv.stages.practice.tasks||[];
    const content=tasks.length?tasks.map(task=>`<article class="mc-task"><h3>${esc(task.title)}</h3><p>${esc(task.req||'按任务要求完成成果。')}</p><span class="tag ghost">${esc(shotText(task.id))}</span></article>`).join(''):fallback.length?fallback.map(title=>`<article class="mc-task"><h3>${esc(title)}</h3><p class="hint">详细任务要求暂未配置。</p></article>`).join(''):empty('本关暂无任务定义');
    return section('练','练习任务',tasks.length+' 项任务 · 查看学员需要完成的成果。',content+tutorial(lv));
  }
  function exam(lv){
    const config=lv.stages.exam;
    return section('考','考核要求','核对考核方式与提交材料。',`<article class="mc-task"><h3>考核内容</h3><p>${esc(config.req||config.requirement||'按本关产出做一次实操，提交结果数据（截图）。')}</p>${lv.stages.practice?'<p class="hint">学员需先通过本关练习任务，再提交考核。</p>':''}<span class="tag ghost">${esc(shotText(MOCK.EXAM_TASK))}</span></article>${!lv.stages.practice?tutorial(lv):''}`);
  }
  function render(){
    if(typeof needsLoginGate==='function'&&needsLoginGate())return;
    if(window.LIVE?.enabled&&!LIVE.user)return;
    if(!['mentor','admin'].includes(MOCKAPI.S.role))return;
    const all=ordered(),params=new URLSearchParams(location.search);
    $('courseEyebrow').textContent='带教备课 · '+all.length+' 个关卡 · 完整教学内容';
    if(!all.length){renderDirectory([],null);$('courseContent').innerHTML='<div class="card">'+empty('暂无关卡配置，请联系管理员。')+'</div>';return;}
    let id=params.get('lv')||all[0].id;
    const lv=all.find(item=>item.id===id),filtered=all.filter(matches);
    renderDirectory(filtered,id);
    if(!lv){$('courseContent').innerHTML=`<div class="card"><h2>找不到这一个关卡</h2><p class="hint">关卡可能已被移除，或链接中的关卡编号不正确。</p><button class="btn" data-first-level>返回第一关</button></div>`;return;}
    if(!params.has('lv'))history.replaceState(null,'',link(id));
    if(!filtered.length){$('courseContent').innerHTML='<div class="card"><h2>没有找到匹配内容</h2><p class="hint">试试其他关卡名、课程名或任务名。</p><button class="btn ghost" data-clear-search>清空搜索</button></div>';return;}
    if(!filtered.some(item=>item.id===id)){id=filtered[0].id;history.replaceState(null,'',link(id));return render();}
    if(renderedId&&renderedId!==id)closePreview();renderedId=id;
    const index=filtered.indexOf(lv),stages=stageNames(lv);
    $('courseContent').innerHTML=`<header class="card mc-hero"><div class="mc-kicker">${esc(lv.phase||'关卡内容')} · ${esc(lv.week||'')}</div><h2>第 ${esc(lv.no)} 关 · ${esc(text(lv.title))}</h2>${lv.desc||lv.goal||lv.description?`<p class="mc-intro">${esc(text(lv.desc||lv.goal||lv.description))}</p>`:''}<div class="mc-tags">${stages.map(s=>`<span class="tag ghost">${esc(s)} 环节</span>`).join('')}<span class="tag ghost">老师备课预览</span></div></header>${lv.stages.study?study(lv):''}${lv.stages.practice?practice(lv):''}${lv.stages.exam?exam(lv):''}${!stages.length?'<div class="card">'+empty('本关暂无教学环节')+'</div>':''}<div class="mc-pager">${index>0?`<a class="btn ghost sm" data-level="${esc(filtered[index-1].id)}" href="${esc(link(filtered[index-1].id))}">← 上一关</a>`:'<span></span>'}${index<filtered.length-1?`<a class="btn ghost sm" data-level="${esc(filtered[index+1].id)}" href="${esc(link(filtered[index+1].id))}">下一关 →</a>`:''}</div>`;
  }
  function closePreview(){const video=$('modal')?.querySelector('video');if(video){video.pause();video.removeAttribute('src');video.load();video.remove();closeModal();}}
  function preview(url,title){
    closePreview();
    UI.openModal(UI.modal(title,`<div class="mc-player"><video controls playsinline preload="metadata" src="${esc(url)}" aria-label="${esc(title)}"></video><p class="mc-video-error" role="status" hidden>视频暂时无法播放，请检查网络后重试，或联系管理员核对文件。</p><div class="mc-player-controls"><span class="hint">教学内容预览</span><label>播放速度 <select aria-label="播放速度">${[0.75,1,1.25,1.5,2].map(n=>`<option value="${n}" ${n===1?'selected':''}>${n}×</option>`).join('')}</select></label></div></div>`, '<button class="btn ghost" onclick="closeModal()">关闭预览</button>'));
    const video=$('modal').querySelector('video');video.addEventListener('error',()=>{$('modal').querySelector('.mc-video-error').hidden=false;});
    $('modal').querySelector('select').addEventListener('change',event=>video.playbackRate=Number(event.target.value));
  }
  document.addEventListener('DOMContentLoaded',()=>{
    if(typeof needsLoginGate==='function'&&needsLoginGate())return;
    ready=true;$('topbarSlot').innerHTML=UI.topbarHTML('mentor','mentor-courses.html');
    $('courseSearch').value=keyword;
    $('courseSearch').addEventListener('input',event=>{keyword=event.target.value;history.replaceState(null,'',link(new URLSearchParams(location.search).get('lv')||ordered()[0]?.id||'',keyword));render();});
    $('mobileLevel').addEventListener('change',event=>choose(event.target.value));
    document.querySelector('main').addEventListener('click',event=>{
      const level=event.target.closest('[data-level]');
      if(level&&event.button===0&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey){event.preventDefault();choose(level.dataset.level);return;}
      const button=event.target.closest('[data-preview-url]');if(button)preview(button.dataset.previewUrl,button.dataset.previewTitle);
      if(event.target.closest('[data-first-level]')){keyword='';$('courseSearch').value='';choose(ordered()[0].id,false);}
      if(event.target.closest('[data-clear-search]')){keyword='';$('courseSearch').value='';history.replaceState(null,'',link(new URLSearchParams(location.search).get('lv')||ordered()[0].id,''));render();}
    });
    new MutationObserver(()=>{if(!$('mask').classList.contains('on'))closePreview();}).observe($('mask'),{attributes:true,attributeFilter:['class']});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&$('modal').querySelector('video'))closePreview();});
    window.addEventListener('pagehide',closePreview);render();
  });
  window.addEventListener('popstate',()=>{closePreview();keyword=new URLSearchParams(location.search).get('q')||'';if(ready){$('courseSearch').value=keyword;render();}});
  window.render=render;window.__rerender=render;
})();
