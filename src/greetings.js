(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.QJGreetings=api;})(globalThis,()=>{
'use strict';
const period=h=>h>=5&&h<11?'morning':h>=11&&h<14?'noon':h>=14&&h<18?'afternoon':'evening';
const intervalMs=s=>{const n=Number(s.greetingInterval);return Number.isFinite(n)?Math.max(0,Math.min(3600,Math.round(n)))*1000:20000;};
function start(getSettings){
 let pool=null,timer=null,fade=null,last='',currentKey='',scheduled=null,currentNickname=null,disposed=false;
 const nodes=()=>[...document.querySelectorAll('[data-greeting]')];
 const key=s=>period(new Date().getHours())+'|'+s.nickname;
 function schedule(){clearTimeout(timer);const s=getSettings();if(!s||!pool||disposed)return;scheduled=intervalMs(s);if(scheduled>0)timer=setTimeout(()=>next(),scheduled);}
 function next(force=false){if(!pool||disposed)return;const s=getSettings();if(!s)return;currentKey=key(s);currentNickname=s.nickname;
 const choices=pool[period(new Date().getHours())].map(t=>t.replaceAll('{name}',s.nickname||'你')).filter(t=>t!==last);const text=choices[Math.floor(Math.random()*choices.length)]||last;last=text;
 clearTimeout(fade);const list=nodes(),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 if(!s.greetingAnimation||reduced||force){for(const n of list){n.textContent=text;n.classList.remove('greeting-fade');}}
 else{for(const n of list)n.classList.add('greeting-fade');fade=setTimeout(()=>{for(const n of nodes()){n.textContent=text;n.classList.remove('greeting-fade');}},260);}
 schedule();
 }
 fetch('greetings.json').then(r=>r.json()).then(data=>{if(!disposed){pool=data;next(true);}}).catch(()=>{for(const n of nodes())n.textContent='留一点空间给今天';});
 return {refresh(){const s=getSettings();if(!s||!pool||disposed)return;if((intervalMs(s)>0&&key(s)!==currentKey)||s.nickname!==currentNickname)next(true);else if(intervalMs(s)!==scheduled)schedule();},destroy(){disposed=true;clearTimeout(timer);clearTimeout(fade);}};
}
return {period,intervalMs,start};
});
