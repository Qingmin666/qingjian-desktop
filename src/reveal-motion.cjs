"use strict";
function frame(rect,edge,progress,opening=true){
 const t=Math.max(0,Math.min(1,progress)),ease=t*t*(3-2*t),visibility=opening?ease:1-ease;
 const shift=Math.round(28*(1-visibility)),dx=edge==='left'?-shift:edge==='right'?shift:0,dy=edge==='top'?-shift:0;
 return {rect:{...rect,x:rect.x+dx,y:rect.y+dy},opacity:visibility};
}
module.exports={frame};
