'use strict';
const crypto=require('node:crypto');
module.exports=function createPracticeVideos(deps){
  const {loadAll,writeJSON,PREFIX,getStaticBucket,getVerifiedCreds,cosRequest,presign,presignTokenHeader,videoUrl,REGION}=deps;
  function checkResponse(r,label){
    if(r.status<200||r.status>=300||/<Error>/.test(String(r.body))) throw new Error(label+'失败，请重试');
  }
  function session(d){
    if(!new RegExp('^assets/practice-videos/'+d.levelId+'-[a-f0-9]{24}\\.mp4$').test(d.key||''))throw new Error('视频上传标识无效');
    if(typeof d.uploadId!=='string'||!d.uploadId)throw new Error('缺少上传会话');
  }
  async function handle(action,me,d){
    if(!me||me.role!=='admin')return {error:'仅管理员可管理练习教学视频'};
    try{
      if(!/^L\d{2}$/.test(d.levelId||''))return {error:'关卡编号无效'};
      const all=await loadAll();
      const lv=all.levels.find(x=>x.id===d.levelId);
      if(!lv||!lv.stages||!lv.stages.practice)return {error:'该关卡没有练习环节'};
      if(action==='practiceVideoRemove'){
        const st=all.settings||{};
        st.practiceVideos=Object.assign({},st.practiceVideos);
        delete st.practiceVideos[lv.id];
        await writeJSON(PREFIX+'settings.json',st);
        return {ok:true};
      }
      const bucket=await getStaticBucket();
      if(action==='practiceVideoInit'){
        if(!/\.mp4$/i.test(d.name||'')||!Number.isSafeInteger(d.size)||d.size<=0||d.size>2*1024**3)return {error:'请选择不超过 2GB 的 MP4 视频'};
        const key='assets/practice-videos/'+lv.id+'-'+crypto.randomBytes(12).toString('hex')+'.mp4';
        const cred=await getVerifiedCreds();
        const r=await cosRequest('POST',key,Buffer.alloc(0),{'content-type':'video/mp4','x-cos-acl':'public-read'},{uploads:''},bucket,cred);
        checkResponse(r,'初始化上传');
        const uploadId=(String(r.body).match(/<UploadId>([^<]+)<\/UploadId>/)||[])[1];
        if(!uploadId)throw new Error('未取得上传会话');
        return {ok:true,key,uploadId};
      }
      session(d);
      if(action==='practiceVideoSign'){
        if(!Number.isInteger(d.partNumber)||d.partNumber<1||d.partNumber>10000)throw new Error('分片编号无效');
        const cred=await getVerifiedCreds();
        return {ok:true,url:presign('PUT',bucket+'.cos.'+REGION+'.myqcloud.com',d.key,{partNumber:String(d.partNumber),uploadId:d.uploadId},presignTokenHeader(cred),cred),token:cred.token||''};
      }
      if(action==='practiceVideoAbort'){
        const r=await cosRequest('DELETE',d.key,null,{}, {uploadId:d.uploadId},bucket);
        if(r.status!==404)checkResponse(r,'取消上传');
        return {ok:true};
      }
      if(action!=='practiceVideoComplete')return {error:'未知的视频操作'};
      if(!Array.isArray(d.parts)||!d.parts.length||d.parts.length>10000)throw new Error('分片列表无效');
      const parts=d.parts.slice().sort((a,b)=>a.partNumber-b.partNumber);
      if(parts.some((p,i)=>p.partNumber!==i+1||!/^"?[a-zA-Z0-9-]{1,100}"?$/.test(p.etag||'')))throw new Error('分片编号或校验值无效');
      const xml='<CompleteMultipartUpload>'+parts.map(p=>'<Part><PartNumber>'+p.partNumber+'</PartNumber><ETag>"'+p.etag.replaceAll('"','')+'"</ETag></Part>').join('')+'</CompleteMultipartUpload>';
      const r=await cosRequest('POST',d.key,Buffer.from(xml),{'content-type':'application/xml'},{uploadId:d.uploadId},bucket);
      checkResponse(r,'合并视频');
      const head=await cosRequest('HEAD',d.key,null,{},undefined,bucket);
      checkResponse(head,'核对视频');
      const size=Number(head.headers['content-length']);
      if(size!==d.size||size<=0)throw new Error('视频大小校验失败，请重新上传');
      // 合并、HEAD 全部成功后才发布新地址；失败时现有视频继续可用。
      const latest=await loadAll();
      const st=latest.settings||{};
      const video={title:lv.title+' · 练习教学',url:videoUrl(bucket,d.key),size,updatedAt:new Date().toISOString()};
      st.practiceVideos=Object.assign({},st.practiceVideos,{[lv.id]:video});
      await writeJSON(PREFIX+'settings.json',st);
      return {ok:true,video,size};
    }catch(e){return {error:e.message};}
  }
  function visible(all,me,levelUnlockedFor){
    const out={};
    for(const lv of all.levels||[]){
      const v=((all.settings||{}).practiceVideos||{})[lv.id];
      if(v&&lv.stages&&lv.stages.practice&&(me.role!=='student'||levelUnlockedFor(all,me.wid,lv)))out[lv.id]=v;
    }
    return out;
  }
  return {handle,visible};
};
