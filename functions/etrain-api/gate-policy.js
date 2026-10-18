'use strict';
module.exports=function levelUnlocked(all,wid,lv,levelDone){
  if(!lv)return false;
  if(!all.settings||all.settings.enforceGate!==true)return true;
  if(lv.no===1)return true;
  const previous=(all.levels||[]).find(l=>l.no===lv.no-1);
  if(!previous)return true;
  return levelDone(all,wid,previous);
};
