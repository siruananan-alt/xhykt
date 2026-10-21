const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const factory=require('../functions/etrain-api/community.js');
function setup(){
  const store=new Map([['data/users.json',{S1:{role:'student',name:'学员甲'},S2:{role:'student',name:'学员乙'},M1:{role:'mentor',name:'老师'},admin:{role:'admin',name:'管理员'}}]]);
  let maxPages=0;
  const api=factory({PREFIX:'data/',crypto,readJSON:async(k,d)=>store.has(k)?structuredClone(store.get(k)):d,writeJSON:async(k,v)=>store.set(k,structuredClone(v)),cosRequest:async(method,key,body,headers,query)=>{
    if(method==='DELETE'){store.delete(key);return {status:204};}
    const all=[...store.keys()].filter(k=>k.startsWith(query.prefix)).sort().filter(k=>!query.marker||k>query.marker),batch=all.slice(0,2);maxPages++;
    return {status:200,body:Buffer.from('<ListBucketResult>'+batch.map(k=>'<Contents><Key>'+k+'</Key></Contents>').join('')+'<IsTruncated>'+(all.length>2)+'</IsTruncated>'+(all.length>2?'<NextMarker>'+batch.at(-1)+'</NextMarker>':'')+'</ListBucketResult>')};
  }});
  const call=(wid,action,data={})=>api({wid,role:wid==='admin'?'admin':'student'},{action,...data});
  const create=(wid,text='今天学到了剪辑技巧')=>call(wid,'communityCreate',{text,color:'green',tag:'心得'});
  return {store,call,create,api,pages:()=>maxPages};
}
test('concurrent posts and distinct voters persist, duplicate likes are idempotent; paginated storage is fully read',async()=>{
  const s=setup(),made=await Promise.all(Array.from({length:26},(_,i)=>s.create(i%2?'S1':'S2','便签 '+i))),id=made[0].id;
  await Promise.all(['S1','S2','M1'].map(wid=>s.call(wid,'communityLike',{id,active:true})));
  await s.call('S1','communityLike',{id,active:true});
  const r=await s.call('S1','communityList',{sort:'popular'});assert.equal(r.total,26);assert.equal(r.posts.length,24);assert.equal(r.posts[0].likeCount,3);assert.equal(r.posts[0].liked,true);assert.ok(s.pages()>1);
  assert.equal((await s.call('S2','communityList',{page:2})).posts.length,2);
  await s.call('S1','communityLike',{id,active:false});assert.equal((await s.call('S1','communityList',{sort:'popular'})).posts[0].likeCount,2);
});
test('server enforces authorship, current account role, deletion confirmation and administrator pinning',async()=>{
  const s=setup(),{id}=await s.create('S1');
  await assert.rejects(s.call('S2','communityEdit',{id,text:'改别人的',color:'blue',tag:'分享'}),/只能修改/);
  await assert.rejects(s.call('S2','communityDelete',{id,confirm:true}),/只能删除/);
  await assert.rejects(s.call('M1','communityPin',{id,active:true}),/仅管理员/);
  await assert.rejects(s.call('S1','communityDelete',{id}),/确认/);
  await s.call('admin','communityPin',{id,active:true});assert.equal((await s.call('S2','communityList')).posts[0].pinned,true);
  await s.call('admin','communityDelete',{id,confirm:true});assert.equal((await s.call('S1','communityList')).total,0);
  await assert.rejects(s.call('S1','communityEdit',{id,text:'不能复活',color:'green',tag:'心得'}),/已被删除/);
  assert.ok(s.store.has('data/community/posts/'+id+'.json'),'original retained for recovery');
  await assert.rejects(s.call('missing','communityList'),/账号不可用/);
  const another=await s.create('S1');
  await assert.rejects(s.api({wid:'S1',role:'admin'},{action:'communityPin',id:another.id,active:true}),/仅管理员/,'stored role overrides a stale or forged role claim');
});
test('edits, unicode length validation, search, own filter, categories and immutable history',async()=>{
  const s=setup(),{id}=await s.create('S1');await s.create('S2');
  await s.call('S1','communityEdit',{id,text:'<img src=x onerror=alert(1)> 学习心得',color:'pink',tag:'分享'});
  const r=await s.call('S2','communityList',{q:'学习心得',tag:'分享'});assert.equal(r.count,1);assert.match(r.posts[0].text,/<img/);assert.equal(r.posts[0].canEdit,false);
  assert.equal((await s.call('S1','communityList',{mine:true})).count,1);
  assert.equal([...s.store.keys()].filter(k=>k.includes('/edits/')).length,1);
  await assert.rejects(s.create('S1','😀'.repeat(501)),/500/);await assert.rejects(s.create('S1',' '),/填写/);
  await assert.rejects(s.call('S1','communityLike',{id:'../../users',active:true}),/编号无效/);
});
