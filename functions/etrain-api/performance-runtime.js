'use strict';
const {AsyncLocalStorage}=require('node:async_hooks');

module.exports=function createPerformanceRuntime(){
  const requests=new AsyncLocalStorage();
  const initializers=new Map();
  return {
    run:fn=>requests.run(new Map(),fn),
    read(key,load){
      const cache=requests.getStore();
      if(!cache)return Promise.resolve().then(load);
      if(cache.has(key))return cache.get(key);
      const promise=Promise.resolve().then(load).catch(error=>{
        if(cache.get(key)===promise)cache.delete(key);
        throw error;
      });
      cache.set(key,promise);
      return promise;
    },
    invalidate(key){requests.getStore()?.delete(key);},
    once(key,initialize){
      if(!initializers.has(key)){
        const promise=Promise.resolve().then(initialize).catch(error=>{
          if(initializers.get(key)===promise)initializers.delete(key);
          throw error;
        });
        initializers.set(key,promise);
      }
      return initializers.get(key);
    }
  };
};
