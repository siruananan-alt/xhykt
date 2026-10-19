'use strict';
module.exports={
  decodeJSON(response){
    if(response.status===404)return {missing:true};
    if(response.status!==200)throw new Error('读取业务数据失败，请稍后重试（HTTP '+response.status+'）');
    try{return {value:JSON.parse(response.body.toString('utf8'))};}
    catch(e){throw new Error('业务数据格式异常，请联系管理员');}
  },
  armDeadline(request,method,{setTimer=setTimeout,clearTimer=clearTimeout,readMs=7000,writeMs=20000}={}){
    const ms=/^(GET|HEAD)$/i.test(method)?readMs:writeMs;
    const timer=setTimer(()=>request.destroy(new Error('云存储请求超时，请稍后重试')),ms);
    const clear=()=>clearTimer(timer);
    request.once('close',clear);
    return clear;
  }
};
