'use strict';
const {AsyncLocalStorage}=require('node:async_hooks');
const {performance}=require('node:perf_hooks');

module.exports=function createPerformanceRuntime({now=()=>performance.now()}={}){
  const requests=new AsyncLocalStorage();
  const initializers=new Map();
  return {
    run(fn,diagnostics=false){
      const cache=new Map();
      if(diagnostics)cache.metrics={start:now(),reads:[],phases:{},initializationStarted:false};
      return requests.run(cache,fn);
    },
    read(key,load){
      const cache=requests.getStore();
      if(!cache)return Promise.resolve().then(load);
      if(cache.has(key))return cache.get(key);
      const started=cache.metrics?now():0;
      const promise=Promise.resolve().then(load).then(value=>{
        if(cache.metrics){
          const match=/^data\/([a-z]+)\.json$/.exec(key);
          cache.metrics.reads.push({table:match?match[1]:'other',ms:Math.max(0,now()-started)});
        }
        return value;
      }).catch(error=>{
        if(cache.get(key)===promise)cache.delete(key);
        throw error;
      });
      cache.set(key,promise);
      return promise;
    },
    invalidate(key){requests.getStore()?.delete(key);},
    async phase(name,fn){
      const metrics=requests.getStore()?.metrics;
      if(!metrics)return fn();
      const started=now();
      try{return await fn();}finally{metrics.phases[name]=Math.max(0,now()-started);}
    },
    snapshot(){
      const metrics=requests.getStore()?.metrics;
      if(!metrics)return undefined;
      const rounded=value=>Math.round(Math.max(0,value));
      return {handlerMs:rounded(now()-metrics.start),catalogMs:rounded(metrics.phases.catalog||0),loadMs:rounded(metrics.phases.snapshot||0),
        readCount:metrics.reads.length,initializationStarted:metrics.initializationStarted,
        slowestReads:metrics.reads.slice().sort((a,b)=>b.ms-a.ms).slice(0,3).map(r=>({table:r.table,ms:rounded(r.ms)}))};
    },
    once(key,initialize){
      if(!initializers.has(key)){
        const metrics=requests.getStore()?.metrics;
        if(metrics)metrics.initializationStarted=true;
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
