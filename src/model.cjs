'use strict';
const {randomUUID}=require('node:crypto'),C=require('./task-core.js');
const createState=()=>({version:2,tasks:[],settings:{...C.DEFAULTS},window:null});
function title(v){if(typeof v!=='string'||!v.trim()||v.trim().length>500)throw Error('标题须为 1–500 个字');return v.trim();}
function mutate(state,action){
 const s=structuredClone(state),t=s.tasks.find(t=>t.id===action.id);
 const requireTask=()=>{if(!t)throw Error('任务不存在');};
 switch(action.type){
 case 'add':{const p=action.parentId?s.tasks.find(t=>t.id===action.parentId):null;if(action.parentId&&(!p||p.parentId))throw Error('请选择有效主任务');const date=p?p.date:action.date;if(!C.validDate(date))throw Error('请选择有效日期');s.tasks.push({id:randomUUID(),title:title(action.title),date,parentId:p?.id||null,showDate:true,done:false,pinned:false,order:Math.max(-1,...s.tasks.map(t=>t.order))+1,createdAt:new Date().toISOString(),dueAt:C.time(action.dueAt),remindAt:C.time(action.remindAt),remindedAt:null});if(p)p.done=false;break;}
 case 'edit':case 'rename':requireTask();if('title'in action)t.title=title(action.title);if('date'in action){if(!C.validDate(action.date)||t.parentId)throw Error('子任务跟随主任务日期');t.date=action.date;for(const child of s.tasks.filter(c=>c.parentId===t.id))child.date=t.date;}
 for(const k of ['dueAt','remindAt'])if(k in action){const v=C.time(action[k]);if(k==='remindAt'&&v!==t.remindAt)t.remindedAt=null;t[k]=v;}break;
 case 'toggle':requireTask();t.done=!t.done;if(!t.parentId){for(const c of s.tasks.filter(c=>c.parentId===t.id))c.done=t.done;}else{const p=s.tasks.find(p=>p.id===t.parentId);if(!t.done)p.done=false;else if(s.settings.autoCompleteParent&&s.tasks.filter(c=>c.parentId===p.id).every(c=>c.done))p.done=true;}break;
 case 'pin':requireTask();if(t.parentId)throw Error('请置顶主任务');t.pinned=!t.pinned;break;
 case 'delete':requireTask();s.tasks=s.tasks.filter(c=>c.id!==t.id&&c.parentId!==t.id);break;
 case 'restore':{const items=Array.isArray(action.tasks)?action.tasks:action.task?[action.task]:[];if(!items.length)throw Error('没有可恢复的任务');for(const item of items){if(s.tasks.some(t=>t.id===item.id))throw Error('任务已存在');s.tasks.push(item);}break;}
 case 'reorder':{if(s.settings.sortMode!=='manual')throw Error('请先切换至手动排序');if(!Array.isArray(action.ids)||new Set(action.ids).size!==action.ids.length)throw Error('排序列表不正确');const group=s.tasks.filter(t=>(t.parentId||null)===(action.parentId||null)&&(action.parentId||t.pinned===!!action.pinned&&(t.pinned||t.date===action.date)));if(group.length!==action.ids.length||group.some(t=>!action.ids.includes(t.id)))throw Error('只能在同一分组内排序，请刷新后再试');action.ids.forEach((id,i)=>s.tasks.find(t=>t.id===id).order=i);break;}
 case 'move':{
  requireTask();if(s.settings.sortMode!=='manual')throw Error('请先切换至手动排序');
  const oldParent=t.parentId,newParent=action.parentId||null,p=newParent?s.tasks.find(x=>x.id===newParent):null;
  if(newParent&&(!p||p.parentId||p.id===t.id))throw Error('只能移入有效主任务，不能循环嵌套');
  if(newParent&&s.tasks.some(x=>x.parentId===t.id))throw Error('这个主任务还有子任务，请先移出其子任务再转为子任务');
  const date=p?p.date:action.date||t.date;if(!C.validDate(date))throw Error('请选择有效日期');
  const pinned=p?false:action.pinned===undefined?t.pinned:action.pinned===true;
  const group=s.tasks.filter(x=>x.id!==t.id&&(x.parentId||null)===newParent&&(newParent||x.pinned===pinned&&(pinned||x.date===date))).sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id));
  if(action.beforeId&&action.afterId)throw Error('不能同时指定前后位置');
  const ref=action.beforeId||action.afterId;let index=group.length;
  if(ref){index=group.findIndex(x=>x.id===ref);if(index<0)throw Error('目标位置不存在或不属于同一分组');if(action.afterId)index++;}
  t.parentId=newParent;t.date=date;t.pinned=pinned;group.splice(index,0,t);group.forEach((x,n)=>x.order=n);
  for(const child of s.tasks.filter(x=>x.parentId===t.id))child.date=date;
  for(const id of new Set([oldParent,newParent].filter(Boolean))){const parent=s.tasks.find(x=>x.id===id),kids=s.tasks.filter(x=>x.parentId===id);if(kids.some(x=>!x.done))parent.done=false;else if(kids.length&&s.settings.autoCompleteParent)parent.done=true;}
  break;
 }
 case 'settings':if(!action.settings||typeof action.settings!=='object'||Array.isArray(action.settings))throw Error('设置参数不正确');s.settings=C.settings({...s.settings,...action.settings});break;
 default:throw Error('未知操作');
 }
 return C.validate(s);
}
function merge(state,raw){const incoming=C.validate(raw),s=structuredClone(state);const added=incoming.tasks.filter(t=>!s.tasks.some(a=>a.id===t.id));for(const t of added)if(t.parentId&&s.tasks.some(a=>a.id===t.parentId))throw Error('备份的主任务编号与现有数据冲突，请使用独立数据目录恢复');s.tasks.push(...added);return C.validate(s);}
module.exports={...C,createState,mutate,merge};
