(function(){
  'use strict';
  const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const colorNames={yellow:'暖阳黄',pink:'桃花粉',blue:'晴空蓝',green:'禾芽绿',purple:'浅藤紫'};
  let mine=false,page=1,posts=[],started=false,busy=false,loading=false,refreshPending=false,searchTimer,focusBefore;
  const roles={student:'学员',mentor:'带教老师',admin:'管理员'};
  function allowed(){return !needsLoginGate()&&['student','mentor','admin'].includes(currentRole())&&(!LIVE.enabled||!!LIVE.user);}
  async function api(action,data={}){
    if(!LIVE.enabled)throw new Error('便签墙需要登录真实账号使用，演示模式不会发布内容。');
    try{return await liveApi(action,data);}catch(e){if(isAuthError(e))liveOnAuthExpired();throw e;}
  }
  const date=at=>{const d=new Date(at);return Number.isNaN(d.getTime())?'':d.toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});};
  function card(n){
    return `<article class="wall-note${n.pinned?' is-featured':''}" data-color="${esc(n.color)}"><div class="note-top"><div class="note-author"><span class="avatar" data-avatar-role="${esc(n.authorRole)}" aria-hidden="true"></span><strong>${esc(n.authorName)}</strong></div>${n.pinned?'<span class="note-pin"><span aria-hidden="true">★</span> 精选</span>':''}</div><p class="note-text">${esc(n.text)}</p><div class="note-bottom"><time datetime="${esc(n.createdAt)}" title="${esc(n.updatedAt?'编辑于 '+date(n.updatedAt):date(n.createdAt))}">${esc(date(n.createdAt))}${n.updatedAt?' · 已编辑':''}</time><button class="note-like" data-act="like" data-id="${esc(n.id)}" aria-pressed="${n.liked}" aria-label="${n.liked?'取消点赞':'点赞'}，${n.likeCount} 人点赞"><span aria-hidden="true">${n.liked?'♥':'♡'}</span> ${n.likeCount}</button>${n.canEdit||n.canDelete||MOCKAPI.S.role==='admin'?`<details class="note-menu"><summary aria-label="便签操作">···</summary><div class="note-actions">${n.canEdit?`<button data-act="edit" data-id="${esc(n.id)}">编辑</button>`:''}${MOCKAPI.S.role==='admin'&&!n.pinned?`<button data-act="pin" data-id="${esc(n.id)}">设为精选</button>`:''}${n.canDelete?`<button data-act="delete" data-id="${esc(n.id)}">删除</button>`:''}</div></details>`:''}</div></article>`;
  }
  function error(message){if(!allowed())return;$('wallError').hidden=false;$('wallError').innerHTML=esc(message)+' <button class="btn ghost sm" type="button" data-retry>重试</button>';}
  async function load(quiet=false){
    if(!allowed())return;
    if(loading){refreshPending=true;return;}
    loading=true;
    const params={mine,page,q:$('wallSearch').value,tag:$('wallTag').value,sort:$('wallSort').value};
    $('wallFilters').dataset.active=String(mine||!!params.q||!!params.tag||params.sort!=='latest');
    if(!quiet)$('wallSync').textContent='正在更新…';
    try{
      const r=await api('communityList',params);if(!allowed())return;
      const current={mine,page,q:$('wallSearch').value,tag:$('wallTag').value,sort:$('wallSort').value};
      if(JSON.stringify(current)!==JSON.stringify(params)){refreshPending=true;return;}
      page=r.page;posts=r.posts;
      // Preserve a focused card control during automatic background updates.
      const active=document.activeElement,focused=active?.closest('#noteWall button');
      const opened=[...document.querySelectorAll('.note-menu[open]')].map(el=>el.closest('.wall-note').querySelector('[data-id]').dataset.id);
      const focus=focused?{id:focused.dataset.id,act:focused.dataset.act}:null;
      $('noteWall').innerHTML=posts.length?posts.map(card).join(''):`<div class="wall-empty"><strong>${r.total?'没有找到便签':'第一张便签，等你来贴'}</strong><p>${r.total?'换个关键词或分类试试。':'今天学到了什么？写下来，和大家一起分享。'}</p>${!r.total?'<button class="btn" data-new>＋ 写一张便签</button>':''}</div>`;
      for(const id of opened){const el=$('noteWall').querySelector(`[data-id="${id}"]`)?.closest('.wall-note').querySelector('.note-menu');if(el)el.open=true;}
      if(focus)$('noteWall').querySelector(`[data-id="${focus.id}"][data-act="${focus.act}"]`)?.focus({preventScroll:true});
      $('wallCount').textContent=`共 ${r.total} 张便签${r.count!==r.total?' · 当前筛选 '+r.count+' 张':''}`;
      $('wallSync').textContent='站内所有人可见 · 刚刚更新';$('wallError').hidden=true;
      $('wallPager').innerHTML=r.pages>1?`<button class="btn ghost sm" data-page="${page-1}" ${page===1?'disabled':''}>上一页</button><span>${page} / ${r.pages}</span><button class="btn ghost sm" data-page="${page+1}" ${page===r.pages?'disabled':''}>下一页</button>`:'';
    }catch(e){error(e.message);$('wallSync').textContent='更新失败，已保留当前内容';}
    finally{loading=false;if(refreshPending){refreshPending=false;load();}}
  }
  function compose(n){
    if(!allowed())return;
    focusBefore=document.activeElement;
    let color=n?.color||'yellow';
    UI.openModal(`<form id="noteForm" class="wall-compose" role="dialog" aria-modal="true" aria-labelledby="noteDialogTitle"><div class="compose-heading"><h2 id="noteDialogTitle"><span aria-hidden="true">✎</span> ${n?'编辑你的留言':'写下你的留言'}</h2><span id="noteLength">0 / 500</span></div><label for="noteText" class="sr-only">便签内容</label><textarea id="noteText" placeholder="在这里写下你想说的话…" required>${esc(n?.text||'')}</textarea><div class="compose-controls"><span class="color-label">选择颜色：</span><div class="wall-colors" role="group" aria-label="便签颜色">${Object.entries(colorNames).map(([key,name])=>`<button type="button" class="wall-swatch" data-color="${key}" aria-label="${name}" aria-pressed="${key===color}"></button>`).join('')}</div><button id="cancelNote" type="button">取消</button><button id="saveNote" type="submit">${n?'保存':'发布'}</button></div><details class="compose-extra"><summary>添加分类 · 站内所有人可见</summary><label for="noteTag">分类 </label><select id="noteTag">${['心得','提问','分享','加油'].map(t=>`<option ${n?.tag===t?'selected':''}>${t}</option>`).join('')}</select></details><p id="noteFormError" class="wall-form-error" role="alert"></p></form>`);
    const text=$('noteText'),save=$('saveNote');
    const count=()=>{const len=[...text.value.trim()].length;$('noteLength').textContent=len+' / 500';save.disabled=len===0||len>500;};count();text.addEventListener('input',count);
    $('cancelNote').onclick=()=>closeModal();
    $('noteForm').addEventListener('keydown',event=>{
      if(event.key!=='Tab')return;
      const controls=[...$('noteForm').querySelectorAll('button:not(:disabled),textarea,select,summary')].filter(el=>el.getClientRects().length);
      const first=controls[0],last=controls[controls.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    });
    $('noteForm').querySelectorAll('[data-color]').forEach(button=>button.onclick=()=>{color=button.dataset.color;$('noteForm').querySelectorAll('[data-color]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));});
    $('noteForm').onsubmit=async e=>{
      e.preventDefault();if(busy||save.disabled)return;busy=true;save.disabled=true;save.textContent='正在保存…';$('noteFormError').textContent='';
      try{await api(n?'communityEdit':'communityCreate',{id:n?.id,text:text.value.trim(),color,tag:$('noteTag').value});closeModal();if(!n){page=1;mine=false;$('wallSearch').value='';$('wallTag').value='';$('wallSort').value='latest';tabs();}toast(n?'便签已更新':'便签已发布');await load();}
      catch(err){if($('noteFormError'))$('noteFormError').textContent=err.message;}
      finally{busy=false;if(save.isConnected){count();save.textContent=n?'保存修改':'发布便签';}}
    };
    setTimeout(()=>text.focus(),0);
  }
  function tabs(){document.querySelectorAll('[data-mine]').forEach(b=>b.setAttribute('aria-pressed',String(mine===(b.dataset.mine==='true'))));}
  async function action(button){
    if(busy)return;
    const n=posts.find(n=>n.id===button.dataset.id);if(!n)return;
    const act=button.dataset.act;
    if(act==='edit')return compose(n);
    if(act==='delete'){
      UI.openModal(UI.modal('删除这张便签？','<p>删除后，所有人都将无法再看到这张便签。</p>','<button class="btn ghost" type="button" id="keepNote">保留</button><button class="btn danger" type="button" id="deleteNote">确认删除</button>'));
      $('keepNote').onclick=()=>closeModal();$('deleteNote').onclick=async()=>{
        if(busy)return;busy=true;const del=$('deleteNote');del.disabled=true;
        try{await api('communityDelete',{id:n.id,confirm:true});closeModal();toast('便签已删除');await load();}catch(e){closeModal();error(e.message);}finally{busy=false;}
      };return;
    }
    busy=true;button.disabled=true;
    try{await api(act==='like'?'communityLike':'communityPin',{id:n.id,active:act==='like'?!n.liked:!n.pinned});await load();}catch(e){error(e.message);}finally{busy=false;button.disabled=false;}
  }
  // Panning only moves this viewer's canvas; it never writes note positions.
  let hand=false,panX=0,panY=0,drag=null;
  function paintPan(){
    $('wallPlane').style.transform=`translate(${panX}px,${panY}px)`;
    $('wallViewport').style.backgroundPosition=`${panX}px ${panY}px`;
  }
  function endDrag(event){
    if(!drag||(event?.pointerId!==undefined&&event.pointerId!==drag.id))return;
    const id=drag.id;drag=null;$('wallViewport').classList.remove('is-dragging');
    if($('wallViewport').hasPointerCapture(id))$('wallViewport').releasePointerCapture(id);
  }
  function setHand(on){
    endDrag();hand=on;
    $('wallViewport').classList.toggle('hand-mode',on);
    $('wallHand').setAttribute('aria-pressed',String(on));
    $('panStatus').textContent=on?'拖动已开启：按住画布拖动，也可用方向键移动；按 Escape 退出。':'拖动已关闭';
  }
  function initPan(){
    const viewport=$('wallViewport');
    $('wallHand').onclick=()=>{setHand(!hand);if(hand)viewport.focus({preventScroll:true});};
    viewport.addEventListener('pointerdown',event=>{
      if(!hand||busy||event.button!==0||!event.isPrimary||event.target.closest('button,a,input,select,textarea,summary,details'))return;
      drag={id:event.pointerId,x:event.clientX,y:event.clientY,startX:panX,startY:panY};
      viewport.setPointerCapture(event.pointerId);viewport.classList.add('is-dragging');event.preventDefault();
    });
    viewport.addEventListener('pointermove',event=>{
      if(!drag||event.pointerId!==drag.id)return;
      panX=drag.startX+event.clientX-drag.x;panY=drag.startY+event.clientY-drag.y;paintPan();
    });
    for(const type of ['pointerup','pointercancel','lostpointercapture'])viewport.addEventListener(type,endDrag);
    window.addEventListener('blur',endDrag);
    viewport.addEventListener('keydown',event=>{
      if(!hand||event.target!==viewport)return;
      if(event.key==='Escape'){setHand(false);$('wallHand').focus();return;}
      const movement={ArrowLeft:[60,0],ArrowRight:[-60,0],ArrowUp:[0,60],ArrowDown:[0,-60]}[event.key];
      if(movement){event.preventDefault();panX+=movement[0];panY+=movement[1];paintPan();}
    });
  }
  function render(){
    if(!allowed())return;
    const role=MOCKAPI.S.role;document.body.classList.remove('role-student','role-mentor','role-admin');document.body.classList.add('role-'+role);document.body.dataset.role=role;
    $('topbarSlot').innerHTML=UI.topbarHTML(role,'community.html');
    if(!started){started=true;load();}else load(true);
  }
  document.addEventListener('DOMContentLoaded',()=>{
    if(needsLoginGate())return;
    initPan();
    $('newNote').onclick=()=>compose();$('refreshWall').onclick=()=>load();
    $('wallReset').onclick=$('wallHome').onclick=()=>{endDrag();panX=0;panY=0;paintPan();$('wallViewport').scrollTo(0,0);mine=false;page=1;$('wallSearch').value='';$('wallTag').value='';$('wallSort').value='latest';tabs();$('wallFilters').open=false;window.scrollTo({top:0,behavior:'auto'});load();};
    document.querySelectorAll('[data-mine]').forEach(b=>b.onclick=()=>{mine=b.dataset.mine==='true';page=1;tabs();load();});
    $('wallSearch').oninput=()=>{clearTimeout(searchTimer);page=1;searchTimer=setTimeout(load,300);};
    ['wallTag','wallSort'].forEach(id=>$(id).onchange=()=>{page=1;load();});
    document.querySelector('main').addEventListener('click',event=>{const b=event.target.closest('button');if(!b)return;if(b.hasAttribute('data-new'))compose();if(b.hasAttribute('data-retry'))load();if(b.dataset.page){page=Number(b.dataset.page);load();window.scrollTo({top:0,behavior:'auto'});}if(b.dataset.act)action(b);});
    new MutationObserver(()=>{if(!$('mask').classList.contains('on')&&focusBefore){focusBefore?.focus();focusBefore=null;}}).observe($('mask'),{attributes:true,attributeFilter:['class']});
    setInterval(()=>{if(!document.hidden&&!busy&&!drag&&!$('mask').classList.contains('on'))load(true);},30000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!busy)load(true);});render();
  });
  window.render=render;window.__rerender=render;
})();
