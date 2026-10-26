(function() {
  'use strict';
  const A=window.TodoActivity, WEEKDAYS=['一','二','三','四','五','六','日'];
  const MONTHS=['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  function create({root,getTasks,getSelected,onSelect}) {
    let mode='year',anchor=A.key(),summary=new Map(),currentPeriod,focusDate,openEpoch=0,pointer=null;
    const chart=root.querySelector('#activity-chart'),viewport=root.querySelector('#activity-viewport');
    const tooltip=root.querySelector('#activity-tooltip');
    function progress(day) {
      const rate=document.createElement('span');rate.className='activity-rate';
      rate.setAttribute('role','progressbar');rate.setAttribute('aria-label','完成率');
      rate.setAttribute('aria-valuemin','0');rate.setAttribute('aria-valuemax','100');rate.setAttribute('aria-valuenow',day.percent);
      const offset=(1-day.ratio)*34.5575;
      rate.innerHTML=`<svg viewBox="0 0 16 16" aria-hidden="true"><circle class="rate-track" cx="8" cy="8" r="5.5"/><circle class="rate-fill" cx="8" cy="8" r="5.5" opacity="${day.done>0?1:0}" stroke-dasharray="34.5575" stroke-dashoffset="${offset}"/></svg><span>${day.percent}%</span>`;
      return rate;
    }
    function stats(date) {return summary.get(date)||A.stat();}
    function detail(date,target) {
      const day=stats(date),dateLabel=document.createElement('span');dateLabel.className='activity-date';dateLabel.textContent=A.numericDate(date);
      const count=document.createElement('span');count.className='activity-count';count.textContent=day.total?`${day.done} / ${day.total} 已完成`:'没有任务';
      const line=document.createElement('div');line.className='activity-detail-line';line.append(count,progress(day));
      target.replaceChildren(dateLabel,line);
    }
    function hideTooltip(){tooltip.hidden=true;root.querySelectorAll('[aria-describedby="activity-tooltip"]').forEach(cell=>cell.removeAttribute('aria-describedby'));}
    function showTooltip(button) {
      if(!button?.dataset.date)return;
      detail(button.dataset.date,tooltip);tooltip.hidden=false;
      button.setAttribute('aria-describedby','activity-tooltip');
      const box=button.getBoundingClientRect(),parent=root.getBoundingClientRect();
      const x=Math.max(8,Math.min(box.x-parent.x+box.width/2-tooltip.offsetWidth/2,root.clientWidth-tooltip.offsetWidth-8));
      const below=box.bottom-parent.top+8;
      tooltip.style.left=x+'px';tooltip.style.top=((below+tooltip.offsetHeight<root.clientHeight-6?below:Math.max(8,box.top-parent.top-tooltip.offsetHeight-8))+root.scrollTop)+'px';
    }
    function revealPointer(){
      if(!pointer||root.hidden)return;
      const button=document.elementFromPoint(pointer.x,pointer.y)?.closest('.activity-cell');
      if(button&&chart.contains(button))showTooltip(button);else hideTooltip();
    }
    function makeCell(cell) {
      if(!cell.inPeriod){const empty=document.createElement('span');empty.className='activity-blank';empty.setAttribute('aria-hidden','true');place(empty,cell);return empty;}
      const day=stats(cell.date),button=document.createElement('button');
      button.type='button';button.className='activity-cell';button.dataset.date=cell.date;button.dataset.level=day.level;
      button.classList.toggle('is-today',cell.date===A.key());button.classList.toggle('is-selected',cell.date===getSelected());
      button.setAttribute('aria-label',`${A.numericDate(cell.date)}, ${day.done} / ${day.total} 已完成, ${day.percent}%`);
      button.setAttribute('aria-pressed',String(cell.date===getSelected()));
      if(cell.date===A.key())button.setAttribute('aria-current','date');
      button.tabIndex=cell.date===focusDate?0:-1;
      if(mode!=='year'){const number=document.createElement('span');number.textContent=Number(cell.date.slice(-2));button.append(number);}
      place(button,cell);
      button.onclick=()=>{hideTooltip();onSelect(cell.date);};
      button.onpointerenter=()=>showTooltip(button);button.onpointerleave=hideTooltip;
      button.onfocus=()=>{focusDate=cell.date;chart.querySelectorAll('.activity-cell').forEach(c=>c.tabIndex=c===button?0:-1);showTooltip(button);};
      button.onblur=hideTooltip;return button;
    }
    function place(element,cell) {
      element.style.gridColumn=String(mode==='year'?cell.week+1:cell.weekday+1);
      element.style.gridRow=String(mode==='year'?cell.weekday+1:mode==='week'?1:cell.week+1);
    }
    function render({scrollToDate=false,keepFocus=false}={}) {
      hideTooltip();summary=A.summarize(getTasks());currentPeriod=A.period(mode,anchor);
      const activeDate=focusDate;
      focusDate=activeDate>=currentPeriod.start&&activeDate<=currentPeriod.end?activeDate:getSelected()>=currentPeriod.start&&getSelected()<=currentPeriod.end?getSelected():currentPeriod.start;
      root.dataset.activityView=mode;
      root.querySelectorAll('[data-activity-mode]').forEach(button=>{const selected=button.dataset.activityMode===mode;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;});
      const label=mode==='year'?anchor.slice(0,4):mode==='month'?`${MONTHS[A.parse(anchor).getMonth()]} ${anchor.slice(0,4)}`:`${A.numericDate(currentPeriod.start)} – ${A.numericDate(currentPeriod.end)}`;
      root.querySelector('#activity-period-label').textContent=label;
      chart.setAttribute('aria-label',label+' 完成日历');
      chart.style.setProperty('--weeks',currentPeriod.columns);
      chart.replaceChildren(...currentPeriod.cells.map(makeCell));
      const headings=root.querySelector('#activity-months');headings.replaceChildren();
      if(mode==='year'){
        let previousColumn=-3;
        for(const cell of currentPeriod.cells)if(cell.inPeriod&&cell.date.endsWith('-01')&&cell.week-previousColumn>=3){
          const month=document.createElement('span');month.textContent=MONTHS[A.parse(cell.date).getMonth()];month.style.left=cell.week*18+'px';headings.append(month);previousColumn=cell.week;
        }
        headings.style.width=(currentPeriod.columns*18-3)+'px';
      }
      const weekdays=root.querySelector('#activity-weekdays');weekdays.replaceChildren(...WEEKDAYS.map((name,index)=>{const span=document.createElement('span');span.textContent=mode==='year'?(index%2===0?name[0]:''):name;return span;}));
      detail(getSelected(),root.querySelector('#activity-selected'));
      const epoch=++openEpoch;
      requestAnimationFrame(()=>{
        if(epoch!==openEpoch||root.hidden)return;
        const focused=chart.querySelector(`[data-date="${focusDate}"]`);
        if(scrollToDate&&mode==='year'&&focused)viewport.scrollLeft=Math.max(0,focused.offsetLeft-viewport.clientWidth*.8);
        if(keepFocus&&focused){focused.scrollIntoView({block:'nearest',inline:'nearest'});focused.focus({preventScroll:true});}
        else revealPointer();
      });
    }
    function changePeriod(direction,keepFocus=false) {anchor=A.movePeriod(mode,anchor,direction);focusDate=anchor;render({scrollToDate:true,keepFocus});}
    function focusDay(date) {
      if(date<currentPeriod.start||date>currentPeriod.end){anchor=date;focusDate=date;render({scrollToDate:true,keepFocus:true});return;}
      const cell=chart.querySelector(`[data-date="${date}"]`);cell?.scrollIntoView({block:'nearest',inline:'nearest'});cell?.focus({preventScroll:true});
    }
    chart.onkeydown=event=>{
      const date=event.target.closest('[data-date]')?.dataset.date;if(!date)return;
      const offsets={ArrowLeft:mode==='year'?-7:-1,ArrowRight:mode==='year'?7:1,ArrowUp:mode==='year'?-1:-7,ArrowDown:mode==='year'?1:7};
      if(event.key in offsets){event.preventDefault();focusDay(A.shift(date,offsets[event.key]));}
      else if(event.key==='Home'||event.key==='End'){event.preventDefault();focusDay(event.ctrlKey?(event.key==='Home'?currentPeriod.start:currentPeriod.end):A.shift(date,(event.key==='Home'?0:6)-A.weekday(date)));}
      else if(event.key==='PageUp'||event.key==='PageDown'){event.preventDefault();changePeriod(event.key==='PageUp'?-1:1,true);}
    };
    root.querySelector('[role=tablist]').onkeydown=event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();
      const modes=['year','month','week'],index=modes.indexOf(mode);
      const next=event.key==='Home'?0:event.key==='End'?2:(index+(event.key==='ArrowRight'?1:2))%3;
      root.querySelector(`[data-activity-mode="${modes[next]}"]`).click();root.querySelector(`[data-activity-mode="${mode}"]`).focus();
    };
    root.querySelectorAll('[data-activity-mode]').forEach(button=>button.onclick=()=>{mode=button.dataset.activityMode;focusDate=anchor;render({scrollToDate:true});});
    root.querySelector('#activity-previous').onclick=()=>changePeriod(-1);
    root.querySelector('#activity-next').onclick=()=>changePeriod(1);
    root.querySelector('#activity-today').onclick=()=>{hideTooltip();onSelect(A.key());};
    root.addEventListener('pointermove',event=>{pointer={x:event.clientX,y:event.clientY};revealPointer();});
    root.addEventListener('pointerleave',()=>{pointer=null;hideTooltip();});
    viewport.addEventListener('scroll',()=>{hideTooltip();requestAnimationFrame(revealPointer);},{passive:true});
    viewport.addEventListener('wheel',event=>{if(mode==='year'&&Math.abs(event.deltaY)>Math.abs(event.deltaX)&&viewport.scrollWidth>viewport.clientWidth){viewport.scrollLeft+=event.deltaY;event.preventDefault();}},{passive:false});
    return {open(date,{keyboard=false}={}){anchor=date;focusDate=date;root.hidden=false;render({scrollToDate:true,keepFocus:keyboard});},
      refresh(){if(!root.hidden){const focused=chart.contains(document.activeElement);render({keepFocus:focused});}},hideTooltip};
  }
  window.TodoActivityCalendar={create};
})();
