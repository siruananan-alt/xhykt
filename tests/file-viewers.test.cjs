const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const routing = require('../app/assets/document-preview.js');
const base = 'https://xhykt.work/app/pages/student-course.html?c=C1&sandbox=1';

test('legacy Chinese PDF resolves to the existing Tencent file, without double encoding', () => {
  const file = encodeURIComponent('流量团队新人启动课堂.pdf');
  assert.equal(routing.resolveUrl('/assets/docs/'+file,base), 'https://micheal-enviorment1-d0bh1b0787c0-1492265383.tcloudbaseapp.com/assets/docs/'+file);
});
test('PDF reader navigation keeps course identity and preview mode but excludes source credentials', () => {
  const reader = new URL(routing.readerLink('C1',2,{name:'PDF',url:'https://example.com/private.pdf?signature=secret'},base));
  assert.equal(reader.pathname,'/app/pages/pdf-reader.html');
  assert.equal(reader.searchParams.get('c'),'C1');
  assert.equal(reader.searchParams.get('doc'),'2');
  assert.equal(reader.searchParams.get('sandbox'),'1');
  assert.equal(reader.href.includes('secret'),false);
});
test('external non-PDF documents keep their original destination', () => {
  const link = 'https://example.com/doc?view=1#section';
  assert.equal(routing.readerLink('C1',0,{url:link},base),link);
});
test('unsafe or missing source addresses are rejected', () => {
  for(const url of ['', 'javascript:alert(1)', 'data:text/html,test', 'file:///secret', 'https://name:password@example.com/test.pdf']) assert.throws(()=>routing.resolveUrl(url,base));
});
test('reading positions are separated by account and document, independent of signed URL expiry', () => {
  const key = routing.pageKey('S1','C1',0,'https://example.com/a.pdf?signature=first');
  assert.equal(key,routing.pageKey('S1','C1',0,'https://example.com/a.pdf?signature=second'));
  assert.notEqual(key,routing.pageKey('S2','C1',0,'https://example.com/a.pdf'));
  assert.notEqual(key,routing.pageKey('S1','C1',0,'https://example.com/b.pdf'));
});

const ui = fs.readFileSync(path.join(__dirname,'../app/assets/ui.js'),'utf8');
const shotSource = ui.slice(ui.indexOf('/* 截图查看：'),ui.indexOf('/* ---------- 表格 ---------- */')).replace('import(__imagePreviewUrl)','loadPreview()');
function shotsHarness(signer){
  const calls=[],errors=[],shown=[];
  const live={enabled:true};
  const context = vm.createContext({ URL,document:{currentScript:{src:'https://xhykt.work/app/assets/ui.js'}},window:{LIVE:live},LIVE:live,
    MOCKAPI:{mockShotSign:async keys=>{calls.push(Array.from(keys));return signer(keys);}},console:{warn(){}},toast:message=>errors.push(message),
    loadPreview:async()=>({showImages:async(items,index)=>shown.push({items:Array.from(items,x=>({...x})),index})}),
  });
  vm.runInContext(shotSource,context);
  return { context,calls,errors,shown };
}
test('live screenshot preview cannot reuse cached URL after authorization failure', async () => {
  const h=shotsHarness(()=>{throw new Error('登录已失效');});
  h.context.window.__shotCache['shots/S1/task/a.png']='https://example.com/stale';
  await h.context.openShotViewer('shots/S1/task/a.png');
  assert.equal(h.shown.length,0);
  assert.match(h.errors[0],/授权已失效/);
});
test('image gallery obtains fresh signatures and opens the selected item', async () => {
  const h=shotsHarness(keys=>({urls:Object.fromEntries(keys.map(k=>[k,'https://example.com/fresh/'+k]))}));
  const links=['a','b'].map(key=>({dataset:{shotKey:key},querySelector:()=>({alt:'图片'+key})}));
  const trigger={closest:()=>({querySelectorAll:()=>links})};
  await h.context.openShotViewer('b',trigger);
  assert.deepEqual(h.calls,[['a','b']]);
  assert.equal(h.shown[0].index,1);
  assert.equal(h.shown[0].items[1].url,'https://example.com/fresh/b');
});
test('late signature response cannot reopen an older gallery selection', async () => {
  let release;
  const h=shotsHarness(keys=>keys[0]==='a'?new Promise(resolve=>{release=resolve;}):{urls:{b:'https://example.com/b'}});
  const first=h.context.openShotViewer('a');
  await h.context.openShotViewer('b');
  release({urls:{a:'https://example.com/a'}});
  await first;
  assert.equal(h.shown.length,1);
  assert.equal(h.shown[0].items[0].key,'b');
});
test('pages load the new UI version and the PDF core/worker version matches', () => {
  for(const name of fs.readdirSync(path.join(__dirname,'../app/pages'))){
    if(!name.endsWith('.html')) continue;
    const html=fs.readFileSync(path.join(__dirname,'../app/pages',name),'utf8');
    assert.equal(/assets\/ui\.js\?v=1015h/.test(html),false,name);
  }
  const core=fs.readFileSync(path.join(__dirname,'../app/assets/vendor/pdfjs-6.4.299/build/pdf.min.mjs'),'utf8');
  const worker=fs.readFileSync(path.join(__dirname,'../app/assets/vendor/pdfjs-6.4.299/build/pdf.worker.min.mjs'),'utf8');
  assert.ok(core.includes('6.4.299'));assert.ok(worker.includes('6.4.299'));
});
