(function(){
  'use strict';
  const esc=value=>UI.esc(String(value||''));
  function info(levelId){return ((MOCK.DB.settings||{}).practiceVideos||{})[levelId];}
  function player(levelId){
    const video=info(levelId);
    if(!video||!video.url)return '';
    let url;try{url=new URL(video.url);if(url.protocol!=='https:')return '';}catch(e){return '';}
    return `<section class="practice-tutorial" style="margin-bottom:24px"><h3>练习教学视频</h3>
      <p class="hint">先看操作示范，再完成下方任务卡。视频可反复观看。</p>
      <video controls playsinline preload="metadata" controlslist="nodownload" style="display:block;width:100%;max-height:540px;background:#111;border-radius:12px;margin-top:12px" aria-label="${esc(video.title||'练习教学视频')}" src="${esc(url.href)}"></video>
      <p class="hint" data-video-error hidden>视频暂时无法播放，请检查网络或联系管理员。</p></section>`;
  }
  function bindErrors(root){root.querySelectorAll('.practice-tutorial video').forEach(v=>v.addEventListener('error',()=>{v.parentElement.querySelector('[data-video-error]').hidden=false;}));}
  function renderAdmin(){
    const box=document.getElementById('practiceVideoAdmin');if(!box)return;
    box.innerHTML=MOCK.DB.levels.filter(l=>l.stages&&l.stages.practice).map(l=>{
      const video=info(l.id);
      return `<div class="card" style="margin:12px 0"><div class="row" style="justify-content:space-between;gap:12px;flex-wrap:wrap"><b>第 ${esc(l.no)} 关 · ${esc(l.title)}</b>
      <span class="tag ${video?'ok':'ghost'}">${video?'已配置':'未配置'}</span>
      <button class="btn sm" data-practice-upload="${esc(l.id)}">${video?'替换视频':'上传教学视频'}</button>
      ${video?`<button class="btn ghost sm" data-practice-remove="${esc(l.id)}">移除视频</button>`:''}</div>${video?player(l.id):''}</div>`;
    }).join('');
    box.querySelectorAll('[data-practice-upload]').forEach(btn=>btn.onclick=()=>pick(btn.dataset.practiceUpload));
    box.querySelectorAll('[data-practice-remove]').forEach(btn=>btn.onclick=()=>{
      if(!window.LIVE||!LIVE.enabled)return toast('请在真实后端模式管理教学视频','err');
      confirmBox('移除教学视频','移除后，该关卡的练习区将不再显示教学视频。任务卡保持正常。','PracticeVideo.remove('+JSON.stringify(btn.dataset.practiceRemove)+')','确认移除');
    });
    bindErrors(box);
  }
  function pick(levelId){
    if(!window.LIVE||!LIVE.enabled)return toast('沙盒模式不能真正上传视频，请在真实后端模式操作','err');
    const input=document.createElement('input');input.type='file';input.accept='video/mp4,.mp4';
    input.onchange=()=>{const file=input.files[0];if(file)upload(levelId,file);};input.click();
  }
  async function upload(levelId,file){
    openModal('<div class="m-h"><h2>上传练习教学视频</h2></div><div class="m-b"><p>'+esc(file.name)+'</p><progress id="practiceUploadProgress" max="100" value="0" style="width:100%"></progress><p id="practiceUploadStatus" role="status">正在准备上传，请保持本页打开…</p></div>');
    const bar=document.getElementById('practiceUploadProgress'),text=document.getElementById('practiceUploadStatus');
    try{
      await window.liveUploadVideo('__practice__',levelId,file,(done,total)=>{const n=Math.round(done/total*100);bar.value=n;text.textContent=n===100?'正在核对并保存视频…':'已上传 '+n+'%';});
      closeModal();toast('教学视频上传完成','ok');renderAdmin();
    }catch(e){closeModal();toast('上传失败：'+e.message,'err');}
  }
  async function remove(levelId){
    try{await liveApi('practiceVideoRemove',{levelId});await LIVE.refresh();closeModal();renderAdmin();toast('已移除教学视频','ok');}catch(e){toast('移除失败：'+e.message,'err');}
  }
  window.PracticeVideo={player,bindErrors,renderAdmin,remove};
})();
