"use strict";
function createHoverState(){let active=false,entered=null,left=null;return{
 get active(){return active;},reset(){active=false;entered=left=null;},
 update({now,enabled,docked,inside,overCapsule,busy,openDelay,closeDelay}){
  if(!enabled||!docked){const changed=active;this.reset();return changed?'close':null;}
  if(busy){entered=left=null;return null;}
  if(active){if(inside)left=null;else if(left===null)left=now;else if(now-left>=closeDelay){this.reset();return 'close';}}
  else if(overCapsule){if(entered===null)entered=now;else if(now-entered>=openDelay){active=true;entered=left=null;return 'open';}}else entered=null;
  return null;
 }
};}
module.exports={createHoverState};
