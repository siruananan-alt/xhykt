/* Shared document routing. Files remain in COS; reader URLs contain only course references. */
(function(root){
  'use strict';
  const HOSTING = 'https://micheal-enviorment1-d0bh1b0787c0-1492265383.tcloudbaseapp.com';
  function resolveUrl(value, base){
    const raw = String(value || '').trim();
    if(!raw) throw new Error('资料地址为空');
    const url = new URL(raw, raw.startsWith('/assets/docs/') ? HOSTING : base);
    if(!['http:', 'https:'].includes(url.protocol)) throw new Error('资料地址不支持在线查看');
    if(url.username || url.password) throw new Error('资料地址包含不支持的身份信息');
    return url.href;
  }
  function readerLink(cid, index, doc, currentUrl, context){
    const source = resolveUrl(doc.url, currentUrl);
    if(!new URL(source).pathname.toLowerCase().endsWith('.pdf') && !String(doc.name || '').toLowerCase().endsWith('.pdf')) return source;
    const current = new URL(currentUrl);
    const reader = new URL('pdf-reader.html', current);
    reader.search = '';
    reader.searchParams.set('c', cid);
    reader.searchParams.set('doc', String(index));
    if(context && context.mentorLevel){
      reader.searchParams.set('from','mentor-courses');
      reader.searchParams.set('lv',context.mentorLevel);
    }
    for(const key of ['sandbox', 'live', 'api']){
      if(current.searchParams.has(key)) reader.searchParams.set(key, current.searchParams.get(key));
    }
    return reader.href;
  }
  function pageKey(wid, cid, index, source){
    return 'etrain:pdf-page:' + [wid, cid, index, new URL(source).pathname].map(x=>encodeURIComponent(String(x))).join(':');
  }
  const api = { resolveUrl, readerLink, pageKey };
  if(typeof module === 'object' && module.exports) module.exports = api;
  else root.DocumentPreview = api;
})(typeof window === 'undefined' ? globalThis : window);
