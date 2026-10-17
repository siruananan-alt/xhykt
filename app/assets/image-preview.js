const vendor = new URL('./vendor/viewerjs-1.15.2/', import.meta.url);
let library, activeViewer, activeGallery, activeCleanup;

function loadAsset(tag, url){
  return new Promise((resolve,reject)=>{
    const el=document.createElement(tag);
    if(tag==='link'){el.rel='stylesheet';el.href=url;} else {el.src=url;el.async=true;}
    const timer=setTimeout(()=>{el.remove();reject(new Error('图片查看器加载超时'));},15000);
    el.onload=()=>{clearTimeout(timer);resolve();};
    el.onerror=()=>{clearTimeout(timer);el.remove();reject(new Error('图片查看器加载失败，请重试'));};
    document.head.appendChild(el);
  });
}
async function ensureViewer(){
  library ||= Promise.all([
    loadAsset('link',new URL('viewer.min.css',vendor).href),
    window.Viewer ? Promise.resolve() : loadAsset('script',new URL('viewer.min.js',vendor).href),
  ]).then(()=>{
    if(typeof window.Viewer!=='function') throw new Error('图片查看器未能初始化');
  }).catch(e=>{library=null;throw e;});
  return library;
}
export async function showImages(items,index,returnFocus){
  await ensureViewer();
  activeCleanup?.();
  const gallery=document.createElement('div');
  gallery.hidden=true;
  items.forEach(item=>{
    const image=document.createElement('img');
    image.src=item.url; image.alt=item.name || '作业截图';
    image.addEventListener('error',()=>window.toast?.('图片加载失败，请关闭后重新打开获取授权。','err'),{once:true});
    gallery.appendChild(image);
  });
  document.body.appendChild(gallery);
  let instance;
  function escape(event){
    if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();instance?.hide();}
  }
  function cleanup(){
    window.removeEventListener('keydown',escape,true);
    instance?.destroy();gallery.remove();
    if(activeViewer===instance){activeViewer=null;activeGallery=null;activeCleanup=null;}
    if(returnFocus?.isConnected) returnFocus.focus();
  }
  instance=new window.Viewer(gallery,{
    navbar:items.length>1,initialViewIndex:index,transition:false,zIndex:10000,
    title:[true,(image,data)=>image.alt+' · '+data.naturalWidth+' × '+data.naturalHeight],
    toolbar:{zoomIn:true,zoomOut:true,oneToOne:true,reset:true,prev:items.length>1,next:items.length>1,rotateLeft:true,rotateRight:true,flipHorizontal:true,flipVertical:true},
    ready(){
      const labels={'zoom-in':'放大','zoom-out':'缩小','one-to-one':'原始尺寸',reset:'重置',prev:'上一张',next:'下一张','rotate-left':'向左旋转','rotate-right':'向右旋转','flip-horizontal':'水平翻转','flip-vertical':'垂直翻转',mix:'关闭',hide:'关闭'};
      instance.viewer.querySelectorAll('[data-viewer-action]').forEach(button=>{
        const label=labels[button.dataset.viewerAction];
        if(label && button.getAttribute('role')==='button'){button.title=label;button.setAttribute('aria-label',label);}
      });
      instance.view(index);
    },hidden:cleanup,
  });
  window.addEventListener('keydown',escape,true);
  activeViewer=instance;activeGallery=gallery;activeCleanup=cleanup;
  instance.show();
}
