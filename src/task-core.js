/* Shared task rules: browser and Node use exactly the same ordering. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.QJTasks=factory();})(globalThis,()=>{
'use strict';
const DEFAULTS={material:'glass',tint:68,alwaysOnTop:false,fontSize:18,fontFamily:'',sortMode:'manual',closeToTray:true,dockEnabled:true,dockMode:'all',frameRate:'auto',autoCompleteParent:true,dockCentered:false,hoverExpand:true,hoverDelay:350,hoverCloseDelay:800,theme:'orange',nickname:'',greetingAnimation:true,greetingInterval:20};
const dateKey=(d=new Date())=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
function validDate(v){return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&dateKey(new Date(v+'T12:00:00'))===v;}
function time(v){if(v===null||v===undefined||v==='')return null;if(typeof v!=='string'||!/(Z|[+-]\d\d:\d\d)$/.test(v)||!Number.isFinite(Date.parse(v)))throw Error('时间格式不正确，请重新选择日期和时间');return new Date(v).toISOString();}
function settings(v={}){const s={...DEFAULTS};for(const k of ['alwaysOnTop','closeToTray','dockEnabled','autoCompleteParent','dockCentered','hoverExpand','greetingAnimation'])if(k in v)s[k]=v[k]===true;for(const [k,options]of Object.entries({theme:['orange','sage','mist','lavender','sand','rose'],material:['glass','transparent','solid'],sortMode:['manual','due','created','title'],dockMode:['capsule','first','all'],frameRate:['auto','60','120','144','165','240']}))if(options.includes(v[k]))s[k]=v[k];for(const [k,min,max] of [['hoverDelay',100,3000],['hoverCloseDelay',200,10000],['greetingInterval',0,3600]]){const n=Number(v[k]);if(Number.isFinite(n))s[k]=Math.round(Math.max(min,Math.min(max,n)));}s.nickname=typeof v.nickname==='string'?v.nickname.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,20):'';s.tint=Math.max(15,Math.min(85,Number(v.tint)||68));s.fontSize=Math.max(12,Math.min(30,Math.round(Number(v.fontSize)||18)));s.fontFamily=typeof v.fontFamily==='string'&&!/[\u0000-\u001f\u007f]/.test(v.fontFamily)?v.fontFamily.trim().slice(0,256):'';return s;}
function validate(raw){
 if(!raw||![1,2].includes(raw.version)||!Array.isArray(raw.tasks)||raw.tasks.length>50000)throw Error('数据文件格式不正确');
 const s=structuredClone(raw),ids=new Set();s.version=2;s.settings=settings(s.settings);
 s.tasks.forEach((t,i)=>{if(!t||typeof t.id!=='string'||!t.id||t.id.length>128||ids.has(t.id)||typeof t.title!=='string'||!t.title.trim()||t.title.length>500||!validDate(t.date)||typeof t.done!=='boolean'||typeof t.pinned!=='boolean')throw Error('任务数据不完整或包含重复编号');ids.add(t.id);t.title=t.title.trim();t.parentId=t.parentId||null;t.order=Number.isFinite(t.order)?t.order:i;t.dueAt=time(t.dueAt);t.remindAt=time(t.remindAt);t.remindedAt=time(t.remindedAt);t.createdAt=Number.isFinite(Date.parse(t.createdAt))?new Date(t.createdAt).toISOString():t.date+'T12:00:00.000Z';});
 const byId=new Map(s.tasks.map(t=>[t.id,t]));
 for(const t of s.tasks)if(t.parentId){const p=byId.get(t.parentId);if(!p||p.parentId||p.id===t.id)throw Error('子任务只能有一层，且必须关联有效主任务');t.date=p.date;t.pinned=false;}
 return s;
}
function sort(tasks,mode='manual'){return [...tasks].sort((a,b)=>Number(a.done)-Number(b.done)||(mode==='due'?(a.dueAt?Date.parse(a.dueAt):Infinity)-(b.dueAt?Date.parse(b.dueAt):Infinity):mode==='created'?a.createdAt.localeCompare(b.createdAt):mode==='title'?a.title.localeCompare(b.title,'zh-CN'):0)||a.order-b.order||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));}
function forDay(s,date,showDone=true){const roots=s.tasks.filter(t=>!t.parentId&&(showDone||!t.done));return{pinned:sort(roots.filter(t=>t.pinned),s.settings.sortMode),daily:sort(roots.filter(t=>!t.pinned&&t.date===date),s.settings.sortMode)};}
function first(s,date){const g=forDay(s,date,false);return [...g.pinned,...g.daily][0]||null;}
function children(s,id){return sort(s.tasks.filter(t=>t.parentId===id),'manual');}
function dueTasks(s,now=Date.now()){const byId=new Map(s.tasks.map(t=>[t.id,t]));return s.tasks.filter(t=>!t.done&&(!t.parentId||!byId.get(t.parentId)?.done)&&t.remindAt&&!t.remindedAt&&Date.parse(t.remindAt)<=now).sort((a,b)=>Date.parse(a.remindAt)-Date.parse(b.remindAt));}
return{DEFAULTS,dateKey,validDate,time,settings,validate,sort,forDay,first,children,dueTasks};
});
