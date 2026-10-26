'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],C=window.QJTasks;
let state,showDone=true,selected=null,contextId=null,editing=null,parentId=null,queue=Promise.resolve(),toastTimer,undoTasks=null,dragId=null,gesture=null;
let inlineEdit=null,inlinePointerDown=false,quickComposing=false;
const folded=new Set();
const checkSVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m5 12 4 4L19 6"/></svg>';
function notify(message,undo=false){clearTimeout(toastTimer);$('#toast-message').textContent=message;$('#undo').hidden=!undo;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,undo?9000:4500);}
function receive(next){if(state&&next.revision<state.revision)return;const focusNew=next.selectedTaskId&&next.selectedTaskId!==state?.selectedTaskId;state=next;if(dragId)return;if(focusNew){const t=state.tasks.find(t=>t.id===next.selectedTaskId);if(t?.parentId)folded.delete(t.parentId);}render();if(focusNew)requestAnimationFrame(()=>$$('.task-row').find(r=>r.dataset.id===next.selectedTaskId)?.scrollIntoView({block:'nearest'}));}
function action(a){const result=queue.then(()=>window.todo.action(a)).then(next=>{receive(next);return next;});queue=result.catch(e=>notify('保存失败：'+e.message));return result;}
function dayLabel(date){return date===C.dateKey()?'今天':new Date(date+'T12:00:00').toLocaleDateString('zh-CN',{month:'long',day:'numeric'});}
function stamp(value){return new Date(value).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});}
function button(text,title,fn,cls=''){const b=document.createElement('button');b.type='button';b.textContent=text;b.title=title;b.setAttribute('aria-label',title);b.className=cls;b.onclick=e=>{e.stopPropagation();Promise.resolve(fn()).catch(()=>{});};return b;}
function closePopovers(){for(const p of $$('.popover'))p.hidden=true;}
function taskRow(t,child=false){
 const row=document.createElement('article');row.className='task-row'+(t.done?' done':'')+(child?' child-row':'')+(selected===t.id||state.selectedTaskId===t.id?' selected':'');row.dataset.id=t.id;row.tabIndex=0;
 const handle=button('⠿',state.settings.sortMode==='manual'?'拖动排序；也可用 Alt＋上下方向键':'自动排序中，切换为手动排序后可拖动',()=>{},'drag-handle');handle.draggable=state.settings.sortMode==='manual';
 handle.ondragstart=e=>{finishInline(false).catch(()=>{});dragId=t.id;e.dataTransfer.setData('text/plain',t.id);e.dataTransfer.effectAllowed='move';row.classList.add('dragging');$('#root-drop').hidden=false;};
 handle.ondragend=()=>{dragId=null;$('#root-drop').hidden=true;clearDropHints();row.classList.remove('dragging');render();};
 const check=button('',(t.done?'标记未完成：':'完成：')+t.title,()=>action({type:'toggle',id:t.id}),'check');check.innerHTML=checkSVG;check.setAttribute('role','checkbox');check.setAttribute('aria-checked',String(t.done));
 const title=document.createElement('div');title.className='task-title';const text=document.createElement('span');text.className='title-text';text.textContent=t.title;text.tabIndex=0;text.title='点击直接修改标题';text.setAttribute('role','button');text.onclick=e=>{e.stopPropagation();startInline(t.id,text).catch(e=>notify(e.message));};text.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();e.stopPropagation();startInline(t.id,text).catch(e=>notify(e.message));}};title.append(text);
 const meta=document.createElement('div');meta.className='task-meta';
 if(t.dueAt){const tag=document.createElement('span');tag.textContent='截止 '+stamp(t.dueAt);tag.className=!t.done&&Date.parse(t.dueAt)<Date.now()?'overdue':'';meta.append(tag);}
 if(t.remindAt){const tag=document.createElement('span');tag.textContent=(t.remindedAt?'已提醒 ':'提醒 ')+stamp(t.remindAt);meta.append(tag);}
 const kids=C.children(state,t.id);
 if(kids.length){meta.append(button((folded.has(t.id)?'▸ ':'▾ ')+kids.filter(c=>c.done).length+'/'+kids.length,'展开或收起子任务',()=>{folded.has(t.id)?folded.delete(t.id):folded.add(t.id);render();},'child-toggle'));}
 if(t.pinned){const tag=document.createElement('span');tag.className='pin-label';tag.textContent='置顶';meta.append(tag);}
 if(meta.childNodes.length)title.append(meta);
 row.append(handle,check,title,button('···','编辑任务与时间；右键可打开更多操作',()=>edit(t),'row-menu'));
 row.onclick=()=>{selected=t.id;$$('.task-row').forEach(r=>r.classList.toggle('selected',r.dataset.id===t.id));};
 row.oncontextmenu=e=>{e.preventDefault();openContext(t.id,e.clientX,e.clientY);};
 row.onkeydown=e=>{if(e.target.tagName==='INPUT')return;if(e.key==='F2'){e.preventDefault();edit(t);}if(e.key==='Delete'){e.preventDefault();remove(t.id);}if(e.altKey&&['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();nudge(t.id,e.key==='ArrowUp'?-1:1);}if(e.key==='ContextMenu'||e.shiftKey&&e.key==='F10'){e.preventDefault();const r=row.getBoundingClientRect();openContext(t.id,r.x+50,r.y+25);}};
 row.ondragover=e=>{const plan=dropPlan(e,t);if(!plan)return;e.preventDefault();e.dataTransfer.dropEffect='move';clearDropHints();row.dataset.drop=plan.kind;};
 row.ondragleave=e=>{if(!row.contains(e.relatedTarget))delete row.dataset.drop;};
 row.ondrop=e=>{const plan=dropPlan(e,t);e.preventDefault();e.stopPropagation();clearDropHints();if(plan){if(plan.kind==='child')folded.delete(t.id);action(plan.action).catch(()=>{});}};
 return row;
}
function render(){
 if(!state||dragId)return;const date=state.selectedDate,firstMode=state.displayMode==='first',groups=C.forDay(state,date,showDone);
 document.body.dataset.revealing=String(state.revealing);document.body.dataset.displayMode=state.displayMode;document.body.dataset.material=state.settings.material;
 $('#view-title').textContent=dayLabel(date);QJAppearance.apply(state.settings);greetings.refresh();
 $('#view-date').value=date;$('#sort-mode').value=state.settings.sortMode;$('#toggle-done').textContent=showDone?'隐藏已完成':'显示已完成';
 function rows(tasks){return tasks.flatMap(t=>[taskRow(t),...(!folded.has(t.id)?C.children(state,t.id).filter(c=>showDone||!c.done).map(c=>taskRow(c,true)):[])]);}
 if(!inlineEdit){if(firstMode){const t=C.first(state,date);$('#pinned-list').replaceChildren();$('#daily-list').replaceChildren(...(t?[taskRow(t)]:[]));}else{$('#pinned-list').replaceChildren(...rows(groups.pinned));$('#daily-list').replaceChildren(...rows(groups.daily));}}
 $('#empty').hidden=firstMode?!!C.first(state,date):groups.pinned.length+groups.daily.length>0;
 const roots=state.tasks.filter(t=>!t.parentId&&(t.pinned||t.date===date));$('#count').textContent=roots.filter(t=>t.done).length+' / '+roots.length;
 for(const [id,key]of [['always-top','alwaysOnTop'],['close-to-tray','closeToTray'],['dock-enabled','dockEnabled'],['auto-complete-parent','autoCompleteParent'],['dock-centered','dockCentered'],['hover-expand','hoverExpand'],['greeting-animation','greetingAnimation']])$('#'+id).checked=state.settings[key];
 for(const [id,key]of [['dock-mode','dockMode'],['frame-rate','frameRate'],['material','material'],['theme','theme']])$('#'+id).value=state.settings[key];
 for(const [id,key]of [['hover-delay','hoverDelay'],['hover-close-delay','hoverCloseDelay'],['nickname','nickname'],['greeting-interval','greetingInterval']])if(document.activeElement!==$('#'+id))$('#'+id).value=state.settings[key];
 $('#dock-position').value=state.dockEdge||'free';
 $('#frame-rate-status').textContent='当前目标更新频率：'+Math.round(state.frameRate)+' Hz（实际流畅度取决于系统合成）';
 document.documentElement.style.setProperty('--tint',state.settings.tint/100);$('#tint').value=state.settings.tint;$('#tint-value').textContent=state.settings.tint+'%';
 applyFontSize(state.settings.fontSize);fontPicker.render();$('#data-location').textContent=state.dataFile;
 $('#close').title=state.settings.closeToTray?'收起到托盘，继续后台提醒':'完全退出轻笺';
}
async function startInline(id,source){
 if(dragId)return;if(inlineEdit?.id===id){inlineEdit.input.focus();return;}
 if(inlineEdit&&!await finishInline(false))return;
 const task=state.tasks.find(t=>t.id===id);if(!task)return;
 const row=$$('.task-row').find(r=>r.dataset.id===id),label=row?.querySelector('.title-text')||source;if(!label)return;
 const input=document.createElement('input');input.type='text';input.className='inline-title-input';input.value=task.title;input.maxLength=500;input.setAttribute('aria-label','修改任务标题');
 const session={id,input,original:task.title,saving:null,composing:false};inlineEdit=session;selected=id;
 input.oncompositionstart=()=>session.composing=true;input.oncompositionend=()=>session.composing=false;
 input.onpointerdown=e=>e.stopPropagation();input.onclick=e=>e.stopPropagation();
 input.onkeydown=e=>{
  e.stopPropagation();if(e.isComposing||session.composing||e.keyCode===229)return;
  if(e.key==='Enter'){e.preventDefault();finishInline(false).catch(()=>{});}
  else if(e.key==='Escape'){e.preventDefault();finishInline(true).catch(()=>{});}
 };
 input.onblur=()=>{if(inlineEdit===session&&!inlinePointerDown)finishInline(false).catch(()=>{});};
 label.replaceWith(input);input.focus();input.select();
}
async function finishInline(cancel=false){
 const session=inlineEdit;if(!session)return true;if(session.saving)return session.saving;
 const value=session.input.value.trim();
 if(cancel||!value||value===session.original){inlineEdit=null;inlinePointerDown=false;if(!cancel&&!value)notify('标题不能为空，已保留原内容');render();return true;}
 session.input.disabled=true;
 session.saving=(async()=>{try{
  await action({type:'rename',id:session.id,title:value});
  if(inlineEdit===session){inlineEdit=null;render();}return true;
 }catch{session.input.disabled=false;session.saving=null;if(inlineEdit===session)session.input.focus();return false;}})();
 return session.saving;
}
function clearDropHints(){for(const row of $$('.task-row[data-drop]'))delete row.dataset.drop;$('#root-drop').classList.remove('drop-active');}
function dropPlan(e,target){
 const moving=state.tasks.find(x=>x.id===dragId);if(!moving||moving.id===target.id||state.settings.sortMode!=='manual')return null;
 const r=e.currentTarget.getBoundingClientRect(),ratio=(e.clientY-r.top)/r.height;
 if(!target.parentId&&ratio>=.28&&ratio<=.72){if(C.children(state,moving.id).length)return null;return {kind:'child',action:{type:'move',id:moving.id,parentId:target.id}};}
 if(moving.id===target.parentId)return null;
 const kind=ratio<.5?'before':'after';return {kind,action:{type:'move',id:moving.id,parentId:target.parentId,date:target.date,pinned:target.pinned,[kind==='before'?'beforeId':'afterId']:target.id}};
}
async function openComposer(){if(!await finishInline(false))return;await fullWindow();closePopovers();$('#quick-composer').hidden=false;$('#quick-title').focus();}
function closeComposer(){const focused=$('#quick-title');focused.blur();$('#quick-composer').hidden=true;}
$('#quick-composer').onsubmit=async e=>{e.preventDefault();if(quickComposing)return;const input=$('#quick-title'),value=input.value.trim();if(!value||input.disabled)return;input.disabled=true;try{await action({type:'add',title:value,date:state.selectedDate});input.value='';}catch{}finally{input.disabled=false;if(!$('#quick-composer').hidden)input.focus();}};
$('#quick-title').oncompositionstart=()=>quickComposing=true;$('#quick-title').oncompositionend=()=>quickComposing=false;
$('#quick-cancel').onclick=closeComposer;$('#quick-title').onkeydown=e=>{if(e.isComposing||quickComposing||e.keyCode===229){if(e.key==='Enter')e.preventDefault();return;}if(e.key==='Escape'){e.preventDefault();closeComposer();}};
$('#root-drop').ondragover=e=>{if(dragId){e.preventDefault();clearDropHints();$('#root-drop').classList.add('drop-active');}};
$('#root-drop').ondragleave=()=>$('#root-drop').classList.remove('drop-active');
$('#root-drop').ondrop=e=>{e.preventDefault();clearDropHints();if(dragId)action({type:'move',id:dragId,parentId:null,pinned:false,date:state.selectedDate}).catch(()=>{});};
function sameGroup(a,b){return a.parentId===b.parentId&&(a.parentId||a.pinned===b.pinned&&(a.pinned||a.date===b.date));}
function orderedGroup(t){return C.sort(state.tasks.filter(a=>sameGroup(a,t)),'manual');}
function reorder(t,ids){return action({type:'reorder',ids,parentId:t.parentId,pinned:t.pinned,date:t.date});}
async function moveBefore(id,targetId){const t=state.tasks.find(t=>t.id===id),target=state.tasks.find(t=>t.id===targetId);if(!t||!target||id===targetId||!sameGroup(t,target)||t.done!==target.done||state.settings.sortMode!=='manual')return;const ids=orderedGroup(t).map(t=>t.id).filter(x=>x!==id);ids.splice(ids.indexOf(targetId),0,id);await reorder(t,ids);}
async function nudge(id,delta){const t=state.tasks.find(t=>t.id===id);if(!t)return;if(state.settings.sortMode!=='manual'){notify('请先切换为手动排序');return;}const group=orderedGroup(t),i=group.findIndex(t=>t.id===id),j=i+delta;if(j<0||j>=group.length||group[i].done!==group[j].done)return;[group[i],group[j]]=[group[j],group[i]];await reorder(t,group.map(t=>t.id));}
function openContext(id,x,y){contextId=id;selected=id;closePopovers();const t=state.tasks.find(t=>t.id===id),menu=$('#context-menu');$('#pin-menu-label').textContent=t.pinned?'取消置顶':'置顶到每天';for(const cmd of ['pin','child'])menu.querySelector('[data-command='+cmd+']').hidden=!!t.parentId;menu.hidden=false;menu.style.left=Math.max(8,Math.min(x,innerWidth-menu.offsetWidth-8))+'px';menu.style.top=Math.max(8,Math.min(y,innerHeight-menu.offsetHeight-8))+'px';menu.querySelector('button').focus();}
async function fullWindow(){if(state.displayMode!=='all'){await window.todo.control('show-all');receive(await window.todo.load());}}
function localTime(value){if(!value)return'';const d=new Date(value);return C.dateKey(d)+'T'+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');}
function iso(value){if(!value)return null;const d=new Date(value);if(!Number.isFinite(d.getTime())||localTime(d.toISOString())!==value)throw Error('这个本地时间不存在，请重新选择');return d.toISOString();}
async function edit(task=null,childOf=null){
 if(!await finishInline(false))return;await fullWindow();if(task)task=state.tasks.find(t=>t.id===task.id);closePopovers();editing=task?.id||null;parentId=task?.parentId||childOf;const p=parentId?state.tasks.find(t=>t.id===parentId):null;
 $('#editor-heading').textContent=task?'编辑任务':p?'添加子任务':'添加任务';$('#task-title').value=task?.title||'';$('#task-date').value=task?.date||p?.date||state.selectedDate;$('#task-date').disabled=!!p;
 $('#task-due').value=localTime(task?.dueAt);$('#task-remind').value=localTime(task?.remindAt);$('#editor-error').textContent='';$('#task-dialog').showModal();$('#task-title').focus();
}
async function remove(id){if(inlineEdit&&(inlineEdit.id===id||state.tasks.find(t=>t.id===inlineEdit.id)?.parentId===id))await finishInline(true);const t=state.tasks.find(t=>t.id===id);if(!t)return;closePopovers();const removed=state.tasks.filter(c=>c.id===id||c.parentId===id);if(removed.length>1&&!confirm('将删除主任务及其 '+(removed.length-1)+' 个子任务。删除后可撤销，是否继续？'))return;await action({type:'delete',id});undoTasks=removed;notify('任务已删除',true);}
$('#context-menu').onclick=e=>{const cmd=e.target.closest('[data-command]')?.dataset.command,t=state.tasks.find(t=>t.id===contextId);if(!t)return;closePopovers();if(cmd==='edit')edit(t);if(cmd==='child')edit(null,t.id);if(cmd==='pin')action({type:'pin',id:t.id});if(cmd==='delete')remove(t.id);if(cmd==='up'||cmd==='down')nudge(t.id,cmd==='up'?-1:1);};
$('#add-button').onclick=openComposer;$('#editor-close').onclick=$('#editor-cancel').onclick=()=>$('#task-dialog').close();
$('#task-form').onsubmit=async e=>{e.preventDefault();$('#editor-save').disabled=true;try{const a={type:editing?'edit':'add',title:$('#task-title').value.trim(),dueAt:iso($('#task-due').value),remindAt:iso($('#task-remind').value)};if(editing)a.id=editing;else a.parentId=parentId;if(!parentId)a.date=$('#task-date').value;await action(a);$('#task-dialog').close();notify(editing?'任务已更新':'任务已添加');}catch(e){$('#editor-error').textContent=e.message;}finally{$('#editor-save').disabled=false;}};
$('#undo').onclick=async()=>{if(!undoTasks)return;try{await action({type:'restore',tasks:undoTasks});undoTasks=null;notify('已恢复任务及子任务');}catch{}};
$('#view-date').onchange=e=>window.todo.selectDate(e.target.value).then(receive).catch(e=>notify(e.message));$('#today-button').onclick=()=>window.todo.selectDate(C.dateKey()).then(receive);
$('#sort-mode').onchange=e=>action({type:'settings',settings:{sortMode:e.target.value}});$('#toggle-done').onclick=()=>{showDone=!showDone;render();};
$('#settings-button').onclick=async()=>{await fullWindow();const visible=!$('#settings').hidden;closePopovers();$('#settings').hidden=visible;};$('#settings-close').onclick=closePopovers;
for(const [id,key]of [['always-top','alwaysOnTop'],['close-to-tray','closeToTray'],['dock-enabled','dockEnabled'],['auto-complete-parent','autoCompleteParent'],['dock-centered','dockCentered'],['hover-expand','hoverExpand'],['greeting-animation','greetingAnimation']])$('#'+id).onchange=e=>action({type:'settings',settings:{[key]:e.target.checked}});
for(const [id,key]of [['dock-mode','dockMode'],['frame-rate','frameRate'],['material','material'],['theme','theme']])$('#'+id).onchange=e=>action({type:'settings',settings:{[key]:e.target.value}});
$('#dock-position').onchange=e=>window.todo.control('dock:'+e.target.value);
$('#tint').oninput=e=>{document.documentElement.style.setProperty('--tint',e.target.value/100);$('#tint-value').textContent=e.target.value+'%';window.todo.previewSettings({tint:Number(e.target.value)});};$('#tint').onchange=e=>action({type:'settings',settings:{tint:Number(e.target.value)}});
function applyFontSize(v){const n=Math.max(12,Math.min(30,Math.round(Number(v)||18)));document.documentElement.style.setProperty('--task-font',n+'px');$('#font-size').value=n;$('#font-size-number').value=n;return n;}
function saveFontSize(v){return action({type:'settings',settings:{fontSize:applyFontSize(v)}});}
$('#font-size').oninput=e=>{applyFontSize(e.target.value);window.todo.previewSettings({fontSize:Number(e.target.value)});};$('#font-size').onchange=e=>saveFontSize(e.target.value);$('#font-size-number').onchange=e=>saveFontSize(e.target.value);$('#font-reset').onclick=()=>saveFontSize(18);
$('#notification-test').onclick=async()=>{try{await window.todo.control('notification-test');notify('已请求系统通知；若未弹出，请检查系统通知与勿扰设置');}catch(e){notify(e.message);}};
$('#export').onclick=async()=>{try{if(await window.todo.exportData())notify('备份已导出');}catch(e){notify(e.message);}};
$('#import').onclick=async()=>{try{const next=await window.todo.importData();if(next){receive(next);notify('任务已导入，原数据已自动备份');}}catch(e){notify('导入失败：'+e.message);}};
$('#minimize').onclick=()=>window.todo.control('minimize');$('#close').onclick=()=>window.todo.control('close');$('#mode-button').onclick=()=>window.todo.control('mode-next');
document.addEventListener('pointerdown',e=>{
 inlinePointerDown=!!inlineEdit&&!inlineEdit.input.contains(e.target);
 if(!$('#quick-composer').hidden&&!e.target.closest('#quick-composer,#add-button'))closeComposer();
 if(!e.target.closest('.popover,#settings-button,#task-dialog'))closePopovers();
},true);
// Finish after the destination click runs, so saving never removes a checkbox or drag handle mid-click.
document.addEventListener('click',e=>{const outside=inlineEdit&&!inlineEdit.input.contains(e.target);inlinePointerDown=false;if(outside)finishInline(false).catch(()=>{});});
document.addEventListener('pointerup',()=>{setTimeout(()=>{inlinePointerDown=false;if(inlineEdit&&document.activeElement!==inlineEdit.input)finishInline(false).catch(()=>{});},0);},true);
document.addEventListener('pointercancel',()=>{inlinePointerDown=false;if(inlineEdit&&document.activeElement!==inlineEdit.input)finishInline(false).catch(()=>{});},true);
document.addEventListener('keydown',e=>{if(e.ctrlKey&&e.key.toLowerCase()==='q'){e.preventDefault();window.todo.control('quit');}if(e.ctrlKey&&e.key.toLowerCase()==='n'){e.preventDefault();if(!$('#task-dialog').open)openComposer();}if(e.ctrlKey&&e.key.toLowerCase()==='z'&&!['INPUT','TEXTAREA'].includes(e.target.tagName)&&undoTasks){e.preventDefault();$('#undo').click();}if(e.key==='Escape')closePopovers();});
$('#window-header').onpointerdown=e=>{if(e.button!==0||e.target.closest('button,input,select'))return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);gesture=e.pointerId;window.todo.beginGesture('move');};
$$('[data-resize]').forEach(h=>h.onpointerdown=e=>{if(e.button!==0||$('#task-dialog').open)return;e.preventDefault();h.setPointerCapture(e.pointerId);gesture=e.pointerId;window.todo.beginGesture(h.dataset.resize);});
function finish(e){if(gesture!==e.pointerId)return;gesture=null;window.todo.endGesture();}
document.addEventListener('pointerup',finish);document.addEventListener('pointercancel',finish);document.addEventListener('lostpointercapture',finish);window.addEventListener('blur',()=>{gesture=null;window.todo.endGesture();});
const fontPicker=window.TodoFonts.create({getSelected:()=>state?.settings.fontFamily||'',onSelect:fontFamily=>action({type:'settings',settings:{fontFamily}})});
window.todo.onState(receive);window.todo.onPreview(s=>{if(s.tint!==undefined)document.documentElement.style.setProperty('--tint',s.tint/100);if(s.fontSize!==undefined)applyFontSize(s.fontSize);});
window.todo.onCompose(openComposer);window.todo.onSettings(async()=>{await fullWindow();$('#settings').hidden=false;});
window.todo.load().then(s=>{receive(s);fontPicker.load();if(s.warning)notify(s.warning);}).catch(e=>notify('读取失败：'+e.message));
setInterval(()=>{if(state&&!document.hidden&&!$('#task-dialog').open)render();},60000);

for(const [id,key]of [['hover-delay','hoverDelay'],['hover-close-delay','hoverCloseDelay'],['nickname','nickname'],['greeting-interval','greetingInterval']])$('#'+id).onchange=e=>action({type:'settings',settings:{[key]:key==='nickname'?e.target.value:Number(e.target.value)}});
const greetings=QJGreetings.start(()=>state?.settings);
