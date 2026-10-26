'use strict';
const $=s=>document.querySelector(s);let state,fonts=null,wasExpanded=false,pointer=null;
const calendar=window.TodoActivityCalendar.create({root:$('#activity-menu'),getTasks:()=>state?.tasks.filter(t=>!t.parentId)||[],getSelected:()=>state?.selectedDate||window.TodoActivity.key(),onSelect:date=>window.todo.selectDate(date)});
function render(){if(!state)return;const s=state.settings,root=document.documentElement;root.style.setProperty('--font',window.TodoFonts.familyStack(s.fontFamily,fonts));root.style.setProperty('--task-font',s.fontSize+'px');root.style.setProperty('--tint',s.tint/100);document.body.dataset.material=s.material;document.body.dataset.expanded=String(state.expanded);root.style.setProperty('--activity-radius',state.duo.cornerRadius+'px');$('#capsule').setAttribute('aria-expanded',String(state.expanded));
 QJAppearance.apply(s);document.body.dataset.vertical=String(['left','right'].includes(state.dockEdge));document.body.dataset.transitioning=String(state.transitioning);
 const date=state.selectedDate,stat=window.TodoActivity.summarize(state.tasks.filter(t=>!t.parentId)).get(date)||window.TodoActivity.stat();
 $('#capsule-date').textContent=date===window.TodoActivity.key()?'今天':window.TodoActivity.numericDate(date);
 $('#capsule-progress').setAttribute('aria-label',stat.done+' 项已完成，共 '+stat.total+' 项，'+stat.percent+'%');
 $('#capsule-progress').innerHTML='<svg viewBox="0 0 16 16" aria-hidden="true"><circle class="rate-track" cx="8" cy="8" r="5.5"/><circle class="rate-fill" cx="8" cy="8" r="5.5" opacity="'+(stat.done?1:0)+'" stroke-dasharray="34.5575" stroke-dashoffset="'+((1-stat.ratio)*34.5575)+'"/></svg><span>'+stat.percent+'%</span>';
 $('#capsule').title='轻笺 · 点击展开日历，拖动移动，右键打开菜单'+(state.dockEdge?' · 已贴靠':'');
 if(state.expanded){if(!wasExpanded)calendar.open(date);else calendar.refresh();}else{$('#activity-menu').hidden=true;calendar.hideTooltip();}wasExpanded=state.expanded;
}
function receive(next){if(state&&next.revision<state.revision)return;state=next;render();}
window.todo.onState(receive);window.todo.onPreview(s=>{if(s.tint!==undefined)document.documentElement.style.setProperty('--tint',s.tint/100);if(s.fontSize!==undefined)document.documentElement.style.setProperty('--task-font',s.fontSize+'px');});window.todo.load().then(receive);window.todo.listFonts().then(list=>{fonts=list;render();}).catch(()=>{});
$('#activity-collapse').onclick=()=>window.todo.control('activity-collapse');
$('.activity-content').addEventListener('scroll',()=>calendar.hideTooltip(),{passive:true});
$('#capsule').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();window.todo.control('activity-expand');}};
document.addEventListener('contextmenu',e=>{e.preventDefault();window.todo.control('capsule-menu');});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.expanded){e.preventDefault();window.todo.control('activity-collapse');}});
function start(e,kind){if(e.button!==0||kind==='move'&&e.target.closest('button'))return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);pointer={id:e.pointerId,x:e.screenX,y:e.screenY,moved:false,kind,capsule:!!e.target.closest('#capsule')};document.body.classList.add('resize-active');window.todo.beginGesture(kind);}
$('#capsule').addEventListener('pointerdown',e=>start(e,'move'));$('.activity-heading').addEventListener('pointerdown',e=>start(e,'move'));
document.querySelectorAll('[data-resize]').forEach(h=>h.addEventListener('pointerdown',e=>start(e,h.dataset.resize)));
document.addEventListener('pointermove',e=>{if(pointer&&Math.hypot(e.screenX-pointer.x,e.screenY-pointer.y)>4)pointer.moved=true;});
function finish(e){if(!pointer||pointer.id!==e.pointerId)return;const moved=pointer.moved||Math.hypot(e.screenX-pointer.x,e.screenY-pointer.y)>4,expand=pointer.capsule&&!moved&&pointer.kind==='move'&&e.type==='pointerup';pointer=null;document.body.classList.remove('resize-active');window.todo.endGesture();if(expand)window.todo.control('activity-expand');}
document.addEventListener('pointerup',finish);document.addEventListener('pointercancel',finish);document.addEventListener('lostpointercapture',finish);window.addEventListener('blur',()=>{pointer=null;document.body.classList.remove('resize-active');window.todo.endGesture();});
