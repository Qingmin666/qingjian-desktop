'use strict';
const MARGIN=8,GAP=14;
function bounds(pair,showMain=true){const rects=showMain?[pair.activity,pair.main]:[pair.activity];const x=Math.min(...rects.map(r=>r.x)),y=Math.min(...rects.map(r=>r.y));return{x,y,width:Math.max(...rects.map(r=>r.x+r.width))-x,height:Math.max(...rects.map(r=>r.y+r.height))-y};}
function fit(pair,work,showMain){const b=bounds(pair,showMain);const dx=b.width>work.width?work.x-b.x:Math.max(work.x-b.x,Math.min(0,work.x+work.width-b.x-b.width));const dy=b.height>work.height?work.y-b.y:Math.max(work.y-b.y,Math.min(0,work.y+work.height-b.y-b.height));return Object.fromEntries(Object.entries(pair).map(([k,r])=>[k,{...r,x:Math.round(r.x+dx),y:Math.round(r.y+dy)}]));}
function detect(anchor,work,previous=null){const near=previous?42:22;const candidates=[['top',Math.abs(anchor.y-work.y-MARGIN)],['left',Math.abs(anchor.x-work.x-MARGIN)],['right',Math.abs(work.x+work.width-MARGIN-anchor.x-anchor.width)]];const found=candidates.filter(([,d])=>d<=near).sort((a,b)=>a[1]-b[1])[0];return found?.[0]||null;}
function arrange({anchor,mainSize,compactSize,expandedSize,expanded,edge,mode,work,centered=false}){
 const margin=Math.min(MARGIN,Math.max(0,(Math.min(work.width,work.height)-1)/4));
 const left=work.x+margin,top=work.y+margin,right=work.x+work.width-margin,bottom=work.y+work.height-margin;
 const width=right-left,height=bottom-top,clamp=(n,lo,hi)=>Math.max(lo,Math.min(n,hi));
 const rect=r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,Math.round(v)]));
 const side=edge==='left'||edge==='right';
 if(edge){
  // Capsule geometry is independent of task display mode: revealing the list must never move it.
  const cw=Math.min(side?compactSize.height:compactSize.width,width),ch=Math.min(side?compactSize.width:compactSize.height,height);
  const cx=edge==='right'?right-cw:edge==='left'?left:clamp(centered?left+(width-cw)/2:anchor.x,left,right-cw);
  const cy=edge==='top'?top:clamp(centered?top+(height-ch)/2:anchor.y,top,bottom-ch);
  const aw=expanded?Math.min(expandedSize.width,side?Math.max(1,width-GAP-Math.min(100,width/3)):width):cw;
  const ah=expanded?Math.min(expandedSize.height,side?height:Math.max(1,height-GAP-Math.min(100,height/3))):ch;
  const activity=rect({width:aw,height:ah,x:edge==='left'?left:edge==='right'?right-aw:clamp(cx+(cw-aw)/2,left,right-aw),y:edge==='top'?top:clamp(cy+(ch-ah)/2,top,bottom-ah)});
  const availableWidth=side?(edge==='left'?right-activity.x-activity.width-GAP:activity.x-left-GAP):width;
  const availableHeight=side?height:bottom-activity.y-activity.height-GAP;
  const mw=Math.max(1,Math.min(mainSize.width,availableWidth)),mh=Math.max(1,Math.min(mode==='first'?148:mainSize.height,availableHeight));
  const main=rect({width:mw,height:mh,x:side?(edge==='left'?activity.x+activity.width+GAP:activity.x-mw-GAP):clamp(activity.x+(activity.width-mw)/2,left,right-mw),y:side?clamp(activity.y+(activity.height-mh)/2,top,bottom-mh):activity.y+activity.height+GAP});
  return {activity,main};
 }
 const activity={x:anchor.x,y:anchor.y,width:Math.min(work.width,expanded?expandedSize.width:compactSize.width),height:Math.min(expanded?expandedSize.height:compactSize.height,Math.max(44,work.height-Math.min(mainSize.height,work.height-100)-GAP))};
 activity.x=anchor.x+(compactSize.width-activity.width)/2;
 const main={width:Math.min(mainSize.width,work.width),height:Math.min(mainSize.height,Math.max(1,work.height-activity.height-GAP)),x:0,y:activity.y+activity.height+GAP};main.x=activity.x+(activity.width-main.width)/2;
 return fit({activity,main},work,true);
}
// One radius for both CSS and glass at every intermediate size, avoiding the transient circle on collapse.
function activityRadius(compactSize){return Math.min(24,compactSize.height/2);}
function targetRate(setting,displayRate=60){const actual=Number.isFinite(displayRate)&&displayRate>=24?displayRate:60;return Math.max(24,Math.min(240,setting==='auto'?actual:Math.min(Number(setting)||60,actual)));}
module.exports={activityRadius,MARGIN,GAP,bounds,fit,detect,arrange,targetRate};
