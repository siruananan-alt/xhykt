(function(){
  'use strict';
  const esc=value=>UI.esc(String(value||''));
  function info(levelId){
    const value=((MOCK.DB.settings||{}).practiceVideos||{})[levelId];
    return Array.isArray(value)?value:(value&&value.url?[value]:[]);
  }
  const capacity=levelId=>levelId==='L08'?3:1;
  function videoPlayer(levelId,video,slot){
    if(!video||!video.url)return '';
    let url;try{url=new URL(video.url);if(url.protocol!=='https:')return '';}catch(e){return '';}
    return `<section class="practice-tutorial" style="margin-bottom:24px"><h3>教学视频${capacity(levelId)>1?' '+(slot+1):''}</h3>
      <p class="hint">观看操作讲解，可暂停、回看和全屏播放。</p>
      <video controls playsinline preload="metadata" controlslist="nodownload" style="display:block;width:100%;max-height:540px;background:#111;border-radius:12px;margin-top:12px" aria-label="${esc(video.title||'练习教学视频')}" src="${esc(url.href)}"></video>
      <p class="hint" data-video-error hidden>视频暂时无法播放，请检查网络或联系管理员。</p></section>`;
  }
  function player(levelId){return info(levelId).slice(0,capacity(levelId)).map((video,slot)=>videoPlayer(levelId,video,slot)).join('');}
  function bindErrors(root){root.querySelectorAll('.practice-tutorial video').forEach(v=>v.addEventListener('error',()=>{v.parentElement.querySelector('[data-video-error]').hidden=false;}));}
  function renderAdmin(){
    const box=document.getElementById('practiceVideoAdmin');if(!box)return;
    box.innerHTML=MOCK.DB.levels.filter(l=>l.id==='L04'||l.stages&&l.stages.practice).map(l=>{
      const videos=info(l.id),total=capacity(l.id);
      const slots=Array.from({length:total},(_,slot)=>{
        const video=videos[slot],configured=!!(video&&video.url);
        return `<div style="margin-top:12px"><div class="row" style="gap:12px;flex-wrap:wrap"><b>教学视频${total>1?' '+(slot+1):''}</b>
        <span class="tag ${configured?'ok':'ghost'}">${configured?'已配置':'未配置'}</span>
        <button class="btn sm" data-practice-upload="${esc(l.id)}" data-slot="${slot}" aria-label="${esc(l.title)} · ${configured?'替换':'上传'}教学视频 ${slot+1}">${configured?'替换视频':'上传教学视频'}</button>
        ${configured?`<button class="btn ghost sm" data-practice-remove="${esc(l.id)}" data-slot="${slot}" aria-label="${esc(l.title)} · 移除教学视频 ${slot+1}">移除视频</button>`:''}</div>${videoPlayer(l.id,video,slot)}</div>`;
      }).join('');
      return `<div class="card" style="margin:12px 0"><div class="row" style="justify-content:space-between;gap:12px;flex-wrap:wrap"><b>第 ${esc(l.no)} 关 · ${esc(l.title)}</b><span class="tag ghost">${videos.slice(0,total).filter(v=>v&&v.url).length}/${total} 已配置</span></div>${slots}</div>`;
    }).join('');
    box.querySelectorAll('[data-practice-upload]').forEach(btn=>btn.onclick=()=>pick(btn.dataset.practiceUpload,Number(btn.dataset.slot)));
    box.querySelectorAll('[data-practice-remove]').forEach(btn=>btn.onclick=()=>{
      if(!window.LIVE||!LIVE.enabled)return toast('请在真实后端模式管理教学视频','err');
      confirmBox('移除教学视频','移除后，该位置的视频将不再显示。其他视频和任务卡保持正常。','PracticeVideo.remove('+JSON.stringify(btn.dataset.practiceRemove)+','+Number(btn.dataset.slot)+')','确认移除');
    });
    bindErrors(box);
  }
  function pick(levelId,slot){
    if(!window.LIVE||!LIVE.enabled)return toast('沙盒模式不能真正上传视频，请在真实后端模式操作','err');
    const input=document.createElement('input');input.type='file';input.accept='video/mp4,.mp4';
    input.onchange=()=>{const file=input.files[0];if(file)upload(levelId,slot,file);};input.click();
  }
  async function upload(levelId,slot,file){
    openModal('<div class="m-h"><h2>上传教学视频'+(capacity(levelId)>1?' '+(slot+1):'')+'</h2></div><div class="m-b"><p>'+esc(file.name)+'</p><progress id="practiceUploadProgress" max="100" value="0" style="width:100%"></progress><p id="practiceUploadStatus" role="status">正在准备上传，请保持本页打开…</p></div>');
    const bar=document.getElementById('practiceUploadProgress'),text=document.getElementById('practiceUploadStatus');
    try{
      await window.liveUploadVideo('__practice__',levelId,file,(done,total)=>{const n=Math.round(done/total*100);bar.value=n;text.textContent=n===100?'正在核对并保存视频…':'已上传 '+n+'%';},{slot});
      closeModal();toast('教学视频上传完成','ok');renderAdmin();
    }catch(e){closeModal();toast('上传失败：'+e.message,'err');}
  }
  async function remove(levelId,slot=0){
    try{await liveApi('practiceVideoRemove',{levelId,slot});await LIVE.refresh();closeModal();renderAdmin();toast('已移除教学视频','ok');}catch(e){toast('移除失败：'+e.message,'err');}
  }
  window.PracticeVideo={player,bindErrors,renderAdmin,remove};
})();
