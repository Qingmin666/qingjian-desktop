const GAP=32;
const minimum=(role,expanded)=>role==='main'?{width:470,height:280}:{width:280,height:expanded?180:44};
function above(main,size){return{x:Math.round(main.x+(main.width-size.width)/2),y:main.y-GAP-size.height,width:size.width,height:size.height};}
function translate(pair,dx,dy){return Object.fromEntries(Object.entries(pair).map(([role,r])=>[role,{...r,x:r.x+Math.round(dx),y:r.y+Math.round(dy)}]));}
function resize(pair,role,next){
  if(role==='main')return{main:next,activity:above(next,pair.activity)};
  return{activity:next,main:{...pair.main,x:Math.round(next.x+(next.width-pair.main.width)/2),y:next.y+next.height+GAP}};
}
function fit(pair,work){
  const left=Math.min(pair.main.x,pair.activity.x),right=Math.max(pair.main.x+pair.main.width,pair.activity.x+pair.activity.width);
  const top=pair.activity.y,bottom=pair.main.y+pair.main.height;
  const dx=right-left<=work.width?Math.max(work.x-left,Math.min(0,work.x+work.width-right)):work.x-left;
  const dy=bottom-top<=work.height?Math.max(work.y-top,Math.min(0,work.y+work.height-bottom)):work.y-top;
  return translate(pair,dx,dy);
}
function capResize(pair,role,next,kind,work,expanded){
  const min=minimum(role,expanded),other=pair[role==='main'?'activity':'main'];
  const maxHeight=Math.max(min.height,work.height-GAP-other.height);
  const height=Math.min(next.height,role==='activity'&&!expanded?96:maxHeight),width=Math.min(next.width,Math.max(min.width,work.width));
  return{...next,x:kind.includes('w')?next.x+next.width-width:next.x,y:kind.includes('n')?next.y+next.height-height:next.y,width,height};
}
module.exports={GAP,minimum,above,translate,resize,fit,capResize};
