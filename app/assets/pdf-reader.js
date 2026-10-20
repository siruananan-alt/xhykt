(function(){
  'use strict';
  const assetBase = new URL('.', document.currentScript.src);
  const vendor = new URL('vendor/pdfjs-6.4.299/', assetBase);
  const params = new URLSearchParams(location.search);
  const cid = params.get('c') || 'C1';
  const docIndex = Number(params.get('doc') || 0);
  let modules, viewer, linkService, findController, eventBus;
  let loadTask, openedUrl = '', loadSerial = 0, storageKey = '', restoredPage = 1;
  const $ = id=>document.getElementById(id);
  function status(text){ if($('readerStatus')){ $('readerStatus').textContent=text; $('readerStatus').hidden=!text; } }
  function controls(on){ document.querySelectorAll('[data-reader-control]').forEach(el=>el.disabled=!on); }
  async function setup(){
    if(viewer) return;
    modules ||= (async()=>{
      const pdfjs = await import(new URL('build/pdf.min.mjs', vendor));
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('build/pdf.worker.min.mjs', vendor).href;
      const ui = await import(new URL('web/pdf_viewer.mjs', vendor));
      return { pdfjs, ui };
    })().catch(e=>{modules=null;throw e;});
    const { pdfjs, ui } = await modules;
    eventBus = new ui.EventBus();
    linkService = new ui.PDFLinkService({ eventBus, externalLinkTarget: ui.LinkTarget.BLANK, externalLinkRel: 'noopener noreferrer' });
    findController = new ui.PDFFindController({ eventBus, linkService });
    viewer = new ui.PDFViewer({ container:$('pdfContainer'), viewer:$('pdfPages'), eventBus, linkService, findController,
      annotationMode:pdfjs.AnnotationMode.ENABLE, enableScripting:false, enableAutoLinking:false,
      maxCanvasPixels:8*1024*1024, imageResourcesPath:new URL('web/images/',vendor).href });
    linkService.setViewer(viewer);
    eventBus.on('pagesinit',()=>{
      viewer.currentScaleValue='page-width';
      viewer.currentPageNumber=Math.min(viewer.pagesCount,Math.max(1,restoredPage));
      $('pageNumber').max=viewer.pagesCount;
      $('pageCount').textContent='/ '+viewer.pagesCount;
      controls(true);
      syncPage();
    });
    eventBus.on('pagerendered',e=>{
      if(e.error) return showError(e.error);
      status('');
    });
    eventBus.on('pagechanging',({pageNumber})=>{
      syncPage();
      try{ if(storageKey) localStorage.setItem(storageKey,String(pageNumber)); }catch(e){}
    });
    eventBus.on('scalechanging',({scale})=>{ $('zoomValue').textContent=Math.round(scale*100)+'%'; });
    eventBus.on('updatefindmatchescount',({matchesCount})=>{ $('searchResult').textContent=matchesCount.total ? matchesCount.current+' / '+matchesCount.total : '没有匹配文字'; });
    eventBus.on('updatefindcontrolstate',({state})=>{ if(state===1) $('searchResult').textContent='没有匹配文字'; });
  }
  function syncPage(){
    if(!viewer || !$('pageNumber')) return;
    $('pageNumber').value=viewer.currentPageNumber;
    $('previousPage').disabled=viewer.currentPageNumber<=1;
    $('nextPage').disabled=viewer.currentPageNumber>=viewer.pagesCount;
  }
  function showError(error){
    if(!$('readerError')) return;
    status(''); controls(false);
    $('readerError').hidden=false;
    $('readerErrorText').textContent=error.name==='PasswordException' ? '这份 PDF 需要密码，请联系管理员提供可在线阅读的版本。' : 'PDF 加载失败：'+(error.message || '请检查网络后重试。');
  }
  async function openDocument(force){
    if(typeof needsLoginGate==='function' && needsLoginGate()) return;
    if(window.LIVE && LIVE.enabled && !LIVE.user) return;
    let serial=loadSerial;
    try{
      const course=MOCK.courseOf(cid);
      if(!course) throw new Error('找不到这门课程');
      if(MOCKAPI.S.role==='student' && MOCK.courseLocked(cid,MOCKAPI.S.wid)) throw new Error('课程尚未解锁，请先完成前置关卡。');
      if(!Number.isInteger(docIndex) || docIndex<0) throw new Error('资料编号无效');
      const doc=(course.docs || [])[docIndex];
      if(!doc) throw new Error('这份资料已被移除或尚未上传');
      const url=DocumentPreview.resolveUrl(doc.url,location.href);
      const mentorContext=['mentor','admin'].includes(MOCKAPI.S.role)&&params.get('from')==='mentor-courses';
      const back=new URL(mentorContext?'mentor-courses.html':'student-course.html',location.href);
      if(mentorContext){
        const level=MOCK.DB.levels.find(l=>l.id===params.get('lv')&&(l.stages?.study?.courseIds||[]).includes(cid));
        if(level)back.searchParams.set('lv',level.id);
      }else back.searchParams.set('c',cid);
      for(const key of ['sandbox','live','api']) if(params.has(key)) back.searchParams.set(key,params.get(key));
      $('backToCourse').href=back.href;
      $('backToCourse').textContent=mentorContext?'返回关卡内容':'返回课程';
      $('documentTitle').textContent=doc.name || '课程资料';
      document.title=(doc.name || '课程资料')+' · PDF 阅读 · 云课堂内部学习站';
      if(openedUrl===url && !force) return;
      serial=++loadSerial;
      openedUrl=url;
      status('正在加载 PDF…'); $('readerError').hidden=true; controls(false);
      if(loadTask){ await loadTask.destroy(); loadTask=null; }
      await setup();
      if(serial!==loadSerial) return;
      viewer.setDocument(null); linkService.setDocument(null);
      storageKey=DocumentPreview.pageKey(MOCKAPI.S.wid,cid,docIndex,url);
      try{ restoredPage=Number(localStorage.getItem(storageKey)) || 1; }catch(e){restoredPage=1;}
      const {pdfjs}=await modules;
      loadTask=pdfjs.getDocument({url, cMapUrl:new URL('cmaps/',vendor).href,cMapPacked:true,
        standardFontDataUrl:new URL('standard_fonts/',vendor).href,wasmUrl:new URL('wasm/',vendor).href,
        iccUrl:new URL('iccs/',vendor).href, isEvalSupported:false, enableXfa:false, withCredentials:false});
      let timer=setTimeout(()=>{ if(serial===loadSerial){ loadTask?.destroy(); showError(new Error('加载超过 30 秒，请重新加载。')); } },30000);
      loadTask.onProgress=({loaded,total})=>{ if(serial===loadSerial) status(total ? '正在加载 PDF… '+Math.min(100,Math.round(loaded/total*100))+'%' : '正在加载 PDF…'); };
      loadTask.onPassword=()=>{ loadTask.destroy(); showError({name:'PasswordException'}); };
      try{
        const pdf=await loadTask.promise;
        if(serial!==loadSerial){ await pdf.loadingTask.destroy(); return; }
        linkService.setDocument(pdf); viewer.setDocument(pdf);
      }finally{ clearTimeout(timer); }
    }catch(error){ if(serial===loadSerial){ openedUrl=''; showError(error); } }
  }
  function find(previous,again){
    eventBus?.dispatch('find',{source:window,type:again?'again':'',query:$('searchText').value,
      phraseSearch:true,caseSensitive:false,entireWord:false,highlightAll:true,findPrevious:previous,matchDiacritics:false});
  }
  window.__rerender=()=>openDocument(false);
  document.addEventListener('DOMContentLoaded',()=>{
    if(!isSandboxPreview() && !sessionStorage.getItem('etrainToken')){ requireLogin('pdf-reader.html'); return; }
    if(typeof needsLoginGate==='function' && needsLoginGate()) return;
    $('previousPage').onclick=()=>{viewer.currentPageNumber--;};
    $('nextPage').onclick=()=>{viewer.currentPageNumber++;};
    $('pageNumber').onchange=()=>{viewer.currentPageNumber=Math.min(viewer.pagesCount,Math.max(1,Number($('pageNumber').value)||1));syncPage();};
    $('zoomOut').onclick=()=>{viewer.currentScale=Math.max(.25,viewer.currentScale/1.2);};
    $('zoomIn').onclick=()=>{viewer.currentScale=Math.min(4,viewer.currentScale*1.2);};
    $('fitWidth').onclick=()=>{viewer.currentScaleValue='page-width';};
    $('rotatePage').onclick=()=>{viewer.pagesRotation=(viewer.pagesRotation+90)%360;};
    $('searchForm').onsubmit=event=>{event.preventDefault();find(false,true);};
    $('searchText').oninput=()=>find(false,false);
    $('findPrevious').onclick=()=>find(true,true); $('findNext').onclick=()=>find(false,true);
    $('retryDocument').onclick=()=>openDocument(true);
    if(!window.LIVE || !LIVE.enabled) openDocument(false);
  });
  window.addEventListener('pagehide',()=>{loadSerial++;loadTask?.destroy();});
})();
