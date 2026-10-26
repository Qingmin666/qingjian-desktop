"use strict";
function createInteractionGate(ttl=3000){const reports=new Map();return{
 report(role,busy,now=Date.now()){if(busy)reports.set(role,now);else reports.delete(role);},
 delete:role=>reports.delete(role),clear:()=>reports.clear(),
 isBusy(isVisible,now=Date.now()){for(const [role,time]of reports)if(!isVisible(role)||now-time>ttl)reports.delete(role);return reports.size>0;}
};}
module.exports={createInteractionGate};
