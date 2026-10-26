'use strict';
const {dueTasks}=require('./task-core.js');
function createReminderService({getState,deliver,now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout,onError=()=>{}}){
 let timer=null,stopped=true,busy=false;
 function schedule(){clearTimer(timer);if(stopped)return;const current=now();const next=getState().tasks.filter(t=>!t.done&&t.remindAt&&!t.remindedAt).reduce((min,t)=>Math.min(min,Date.parse(t.remindAt)),Infinity);timer=setTimer(tick,Math.max(1000,Math.min(30000,next-current)));}
 async function tick(){clearTimer(timer);if(stopped||busy)return;busy=true;try{for(const t of dueTasks(getState(),now()).slice(0,5)){if(stopped)break;await deliver(t);}}catch(e){onError(e);}finally{busy=false;schedule();}}
 return{start(){stopped=false;return tick();},reschedule:schedule,check:tick,stop(){stopped=true;clearTimer(timer);}};
}
module.exports={createReminderService};
