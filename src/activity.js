(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TodoActivity = api;
})(typeof globalThis === 'object' ? globalThis : this, function() {
  'use strict';
  const DAY = 86400000;
  function key(date = new Date()) {
    return `${String(date.getFullYear()).padStart(4,'0')}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  }
  const parse = value => new Date(value + 'T12:00:00');
  function shift(value, days) { const date=parse(value); date.setDate(date.getDate()+days); return key(date); }
  const weekday = value => (parse(value).getDay()+6)%7;
  const numericDate = value => value.replaceAll('-', '/');
  function daysBetween(a,b) { return Math.round((Date.UTC(...a.split('-').map((v,i)=>Number(v)-(i===1?1:0)))-Date.UTC(...b.split('-').map((v,i)=>Number(v)-(i===1?1:0))))/DAY); }
  function period(mode, anchor) {
    const d=parse(anchor),y=d.getFullYear(),m=d.getMonth();
    let start,end;
    if(mode==='year'){start=`${y}-01-01`;end=`${y}-12-31`;}
    else if(mode==='month'){start=key(new Date(y,m,1,12));end=key(new Date(y,m+1,0,12));}
    else {start=shift(anchor,-weekday(anchor));end=shift(start,6);}
    const gridStart=mode==='week'?start:shift(start,-weekday(start));
    const gridEnd=mode==='week'?end:shift(end,6-weekday(end));
    const cells=[];
    for(let date=gridStart;date<=gridEnd;date=shift(date,1))cells.push({date,inPeriod:date>=start&&date<=end,weekday:weekday(date),week:Math.floor(daysBetween(date,gridStart)/7)});
    return {mode,start,end,gridStart,gridEnd,cells,columns:mode==='year'?cells.length/7:7};
  }
  function movePeriod(mode, anchor, direction) {
    if(mode==='week')return shift(anchor,direction*7);
    const d=parse(anchor),month=mode==='year'?d.getMonth():d.getMonth()+direction;
    const year=d.getFullYear()+(mode==='year'?direction:0);
    const first=new Date(year,month,1,12);
    const last=new Date(first.getFullYear(),first.getMonth()+1,0,12).getDate();
    first.setDate(Math.min(d.getDate(),last));return key(first);
  }
  function summarize(tasks) {
    const map=new Map();
    for(const task of tasks){
      // A pin is a shared display shortcut, not a recurring copy of the task.
      let day=map.get(task.date);if(!day){day={total:0,done:0};map.set(task.date,day);}
      day.total++;if(task.done)day.done++;
    }
    for(const [date,day] of map)map.set(date,stat(day));
    return map;
  }
  function stat(day={total:0,done:0}) {
    const ratio=day.total?day.done/day.total:0;
    return {total:day.total,done:day.done,ratio,percent:Math.round(ratio*100),level:ratio>0?Math.ceil(ratio*4):0};
  }
  return {key,parse,shift,weekday,numericDate,period,movePeriod,summarize,stat,daysBetween};
});
