'use strict';
// Separate objects per post, revision and voter: no shared read/modify/write table.
// Deletion is a permanent tombstone; revisions remain recoverable.
module.exports=function({readJSON,writeJSON,cosRequest,PREFIX,crypto}){
  const base=PREFIX+'community/';
  const idOK=id=>typeof id==='string'&&/^\d{13}-[a-f0-9]{16}$/.test(id);
  const colors=['green','yellow','blue','pink','purple'];
  const tags=['心得','提问','分享','加油'];
  const xml=s=>s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
  const hash=wid=>crypto.createHash('sha256').update(wid).digest('hex');
  const path=(type,id)=>base+type+'/'+id+'.json';
  async function keys(){
    let marker='',out=[];
    do{
      const r=await cosRequest('GET','',null,null,{prefix:base,'max-keys':'1000',...(marker?{marker}:{})});
      if(r.status!==200)throw new Error('便签暂时加载失败，请稍后重试');
      const body=r.body.toString('utf8');
      const batch=[...body.matchAll(/<Contents>[\s\S]*?<Key>([\s\S]*?)<\/Key>[\s\S]*?<\/Contents>/g)].map(m=>xml(m[1]));
      out.push(...batch);
      const more=/<IsTruncated>\s*true\s*<\/IsTruncated>/.test(body);
      const next=body.match(/<NextMarker>([\s\S]*?)<\/NextMarker>/);
      const value=more?(next?xml(next[1]):batch[batch.length-1]):'';
      if(more&&(!value||value===marker))throw new Error('便签列表未加载完整，请重试');
      marker=value;
    }while(marker);
    return out.map(k=>k.slice(base.length));
  }
  async function actor(me){
    const users=await readJSON(PREFIX+'users.json',{}),u=users[me.wid];
    if(!u||!['student','mentor','admin'].includes(u.role)||u.disabled||u.status==='disabled')throw new Error('账号不可用，请重新登录');
    return {wid:me.wid,name:u.name||me.wid,role:u.role};
  }
  function content(data){
    const text=typeof data.text==='string'?data.text.trim():'';
    if(!text||[...text].length>500)throw new Error('请填写 1～500 字的便签内容');
    if(!colors.includes(data.color)||!tags.includes(data.tag))throw new Error('请选择有效的颜色和分类');
    return {text,color:data.color,tag:data.tag};
  }
  async function note(id){
    if(!idOK(id))throw new Error('便签编号无效');
    const [root,deleted]=await Promise.all([readJSON(path('posts',id),null),readJSON(path('deleted',id),null)]);
    if(!root||deleted)throw new Error('这张便签已被删除或不存在，请刷新');
    return root;
  }
  async function list(me,data){
    const all=await keys(),deleted=new Set(),pins=new Set(),likes=new Map(),edits=new Map(),mine=hash(me.wid);
    for(const key of all){
      const [type,idpart,file]=key.split('/'),id=idpart?.replace(/\.json$/,'');
      if(!idOK(id))continue;
      if(type==='deleted')deleted.add(id);
      if(type==='pins')pins.add(id);
      if(type==='likes'){
        const entry=likes.get(id)||{count:0,liked:false};entry.count++;if(file===mine+'.json')entry.liked=true;likes.set(id,entry);
      }
      if(type==='edits'&&file&&(!edits.has(id)||file>edits.get(id)))edits.set(id,file);
    }
    const ids=all.filter(k=>/^posts\//.test(k)).map(k=>k.slice(6,-5)).filter(id=>idOK(id)&&!deleted.has(id));
    // Content is read in small batches; historical revisions never need fetching.
    let posts=[];
    for(let i=0;i<ids.length;i+=16){
      posts.push(...await Promise.all(ids.slice(i,i+16).map(async id=>{
        const root=await readJSON(path('posts',id),null);if(!root)return null;
        const edit=edits.has(id)?await readJSON(base+'edits/'+id+'/'+edits.get(id),null):null;
        const fields=edit?{text:edit.text,color:edit.color,tag:edit.tag,updatedAt:edit.at}:{};
        return {...root,...fields,likeCount:likes.get(id)?.count||0,liked:likes.get(id)?.liked||false,pinned:pins.has(id),canEdit:root.authorId===me.wid,canDelete:root.authorId===me.wid||me.role==='admin'};
      })));
    }
    posts=posts.filter(Boolean);
    const total=posts.length,q=String(data.q||'').trim().slice(0,100).toLowerCase();
    posts=posts.filter(n=>(data.mine!==true||n.authorId===me.wid)&&(!tags.includes(data.tag)||n.tag===data.tag)&&(!q||(n.text+' '+n.authorName).toLowerCase().includes(q)));
    posts.sort((a,b)=>Number(b.pinned)-Number(a.pinned)||(data.sort==='popular'?b.likeCount-a.likeCount:0)||b.id.localeCompare(a.id));
    const count=posts.length,pages=Math.max(1,Math.ceil(count/24)),page=Math.max(1,Math.min(pages,Math.trunc(Number(data.page)||1)));
    return {ok:true,posts:posts.slice((page-1)*24,page*24),total,count,page,pages};
  }
  return async function(me,data){
    me=await actor(me);
    if(data.action==='communityList')return list(me,data);
    if(data.action==='communityCreate'){
      const fields=content(data),id=Date.now()+'-'+crypto.randomBytes(8).toString('hex');
      const post={id,...fields,authorId:me.wid,authorName:me.name,authorRole:me.role,createdAt:new Date().toISOString()};
      await writeJSON(path('posts',id),post);return {ok:true,id};
    }
    const root=await note(data.id),id=root.id;
    if(data.action==='communityEdit'){
      if(root.authorId!==me.wid)throw new Error('只能修改自己的便签');
      const revision=Date.now()+'-'+crypto.randomBytes(8).toString('hex');
      await writeJSON(base+'edits/'+id+'/'+revision+'.json',{...content(data),at:new Date().toISOString(),by:me.wid});
    }else if(data.action==='communityDelete'){
      if(root.authorId!==me.wid&&me.role!=='admin')throw new Error('只能删除自己的便签');
      if(data.confirm!==true)throw new Error('请确认删除这张便签');
      await writeJSON(path('deleted',id),{by:me.wid,at:new Date().toISOString()});
    }else if(data.action==='communityLike'||data.action==='communityPin'){
      const pin=data.action==='communityPin';
      if(pin&&me.role!=='admin')throw new Error('仅管理员可以置顶');
      if(typeof data.active!=='boolean')throw new Error('操作参数无效');
      const key=pin?path('pins',id):base+'likes/'+id+'/'+hash(me.wid)+'.json';
      if(data.active)await writeJSON(key,{by:me.wid,at:new Date().toISOString()});
      else {const r=await cosRequest('DELETE',key);if(r.status<200||r.status>=300)throw new Error('操作未成功，请重试');}
    }else throw new Error('无效的便签操作');
    return {ok:true};
  };
};
