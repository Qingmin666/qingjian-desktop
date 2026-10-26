"use strict";
window.QJAppearance={apply(s){document.documentElement.dataset.theme=s.theme||'orange';}};
// Interaction protection covers date pickers, task edits, settings, menus and HTML drag/drop.
let interactionDragging=false;
function reportInteraction(){
 if(document.hidden||document.visibilityState==='hidden'){interactionDragging=false;window.todo.busy(false);return;}
 const visible=el=>!!el&&el.getClientRects().length>0,active=document.activeElement;
 const panel=[...document.querySelectorAll('dialog[open],.popover:not([hidden])')].some(visible);
 window.todo.busy(interactionDragging||panel||['INPUT','SELECT','TEXTAREA'].includes(active?.tagName)&&visible(active));
}
for(const event of ['focusin','focusout','pointerup','click','change','close','keydown'])document.addEventListener(event,()=>setTimeout(reportInteraction,0),true);
document.addEventListener('dragstart',()=>{interactionDragging=true;reportInteraction();});document.addEventListener('dragend',()=>{interactionDragging=false;reportInteraction();});
setInterval(reportInteraction,300);

document.addEventListener('visibilitychange',reportInteraction);
