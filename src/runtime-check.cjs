'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function run(api){
 const out=path.resolve(api.config.outputDir),results=[];fs.mkdirSync(out,{recursive:true});
 const log=(name,detail={})=>{results.push({name,time:new Date().toISOString(),...detail});fs.writeFileSync(path.join(out,'progress.json'),JSON.stringify(results,null,2));};
 const view=()=>api.view();
 const js=code=>view().executeJavaScript(code);
 const action=a=>js('window.todo.action('+JSON.stringify(a)+')');
 const wait=async(fn,label,timeout=5000)=>{const start=Date.now();while(Date.now()-start<timeout){if(await fn())return;await sleep(80);}throw Error('超时：'+label);};
 const checkpoint=async(name,fn)=>{log(name+"：开始");await fn();log(name,{passed:true});};
 log("自检启动",{pid:process.pid});let success=false,error=null;
 try{
 assert.equal(api.state().tasks.length,0,'自检只允许运行在空白隔离 profile');
 await checkpoint('中文界面与设置交互',async()=>{
  assert.equal(await js("document.documentElement.lang"),'zh-CN');
  await js("document.querySelector('#settings-button').click()");
  await wait(()=>js("!document.querySelector('#settings').hidden"),'设置面板打开');
  assert.ok(await js("document.querySelector('#dock-position')!==null"));
  await js("document.querySelector('#settings-close').click()");
 });
 const reminder=new Date(Date.now()+60000).toISOString(),due=new Date(Date.now()+86400000).toISOString();
 await checkpoint('主页面直接添加与三个点编辑时间',async()=>{
  await js("document.querySelector('#add-button').click()");
  await wait(()=>js("!document.querySelector('#quick-composer').hidden"),'主页面输入栏');
  assert.equal(await js("document.querySelector('#task-dialog').open"),false);
  await js("document.querySelector('#quick-title').value='自检主任务';document.querySelector('#quick-composer').requestSubmit()");
  await wait(()=>api.state().tasks.length===1,'直接添加保存');
  await js("document.querySelector('#quick-cancel').click();document.querySelector('.row-menu').click()");
  await wait(()=>js("document.querySelector('#task-dialog').open"),'三个点编辑器');
  await js("document.querySelector('#task-due').value=localTime("+JSON.stringify(due)+");document.querySelector('#task-remind').value=localTime("+JSON.stringify(reminder)+");document.querySelector('#task-form').requestSubmit()");
  await wait(()=>js("!document.querySelector('#task-dialog').open"),'任务保存');
  const t=api.state().tasks[0];assert.ok(t.dueAt&&t.remindAt);assert.equal(new Date(t.dueAt).getSeconds(),0);assert.equal(new Date(t.remindAt).getSeconds(),0);
 });
 const parent=api.state().tasks[0].id;
 // Use exact 60 seconds from this point for a bounded real scheduler test.
 await action({type:'edit',id:parent,remindAt:new Date(Date.now()+60000).toISOString()});
 await checkpoint('子任务编辑与完成联动',async()=>{
  await js("openContext(state.tasks.find(t=>!t.parentId).id,40,80);document.querySelector('[data-command=child]').click()");
  await wait(()=>js("document.querySelector('#task-dialog').open"),'子任务编辑器');
  await js("document.querySelector('#task-title').value='自检子任务';document.querySelector('#task-form').requestSubmit()");
  await wait(()=>api.state().tasks.length===2,'子任务保存');
  const child=api.state().tasks.find(t=>t.parentId===parent);
  await js("document.querySelector('[data-id="+JSON.stringify(child.id)+"] .check').click()");
  await wait(()=>api.state().tasks.every(t=>t.done),'子任务完成父任务联动');
  await action({type:'toggle',id:parent});assert.ok(api.state().tasks.every(t=>!t.done));
 });
 await checkpoint('自动排序与手动顺序恢复',async()=>{
  await action({type:'add',title:'更早截止的任务',date:api.state().selectedDate,dueAt:new Date(Date.now()+3600000).toISOString()});
  const other=api.state().tasks.find(t=>t.title==='更早截止的任务').id;
  await action({type:'settings',settings:{sortMode:'due'}});
  assert.equal(await js("document.querySelector('#daily-list .task-row').dataset.id"),other);
  await action({type:'settings',settings:{sortMode:'manual'}});
  await action({type:'reorder',ids:[other,parent],date:api.state().selectedDate});
  await action({type:'settings',settings:{sortMode:'created'}});await action({type:'settings',settings:{sortMode:'manual'}});
  assert.equal(await js("document.querySelector('#daily-list .task-row').dataset.id"),other);
 });
 await checkpoint('主子任务删除与整组撤销',async()=>{const saved=api.state().tasks.filter(t=>t.id===parent||t.parentId===parent);await action({type:'delete',id:parent});assert.equal(api.state().tasks.length,1);await action({type:'restore',tasks:saved});assert.equal(api.state().tasks.length,3);});
 await checkpoint('顶部吸附、首项和仅胶囊模式',async()=>{
  api.setDock('top');api.changeMode('first');await sleep(150);assert.equal(api.windows().main.bounds.height,148);assert.ok(api.windows().main.visible&&api.windows().activity.visible);
  api.changeMode('capsule');await sleep(150);assert.equal(api.windows().main.visible,false);assert.equal(api.windows().activity.visible,true);
  api.changeMode('all');await sleep(150);assert.equal(api.windows().main.visible,true);
 });
 await checkpoint('展开收回三轮恢复原位',async()=>{
  await wait(()=>api.windows().activity.bounds.height===api.state().duo.layout.activity.height,"胶囊尺寸稳定");const before=api.windows(),anchor=api.state().duo.layout.activity;log("归位基线",{main:before.main.bounds,activity:before.activity.bounds});
  for(let i=0;i<3;i++){await api.transition(true);await sleep(60);await api.transition(false);await sleep(60);}
  await wait(()=>api.windows().activity.bounds.height===api.state().duo.layout.activity.height,"收回尺寸稳定");const after=api.windows();log("归位结果",{main:after.main.bounds,activity:after.activity.bounds});for(const role of ['main','activity'])for(const k of ['x','y','width','height'])assert.ok(Math.abs(before[role].bounds[k]-after[role].bounds[k])<=2,role+'.'+k);
  assert.deepEqual(api.state().duo.layout.activity,anchor);
 });
 await checkpoint('左右贴靠与工作区约束',async()=>{for(const edge of ['left','right']){api.setDock(edge);await sleep(100);assert.equal(api.state().dockEdge,edge);assert.ok(api.windows().main.visible);}});
 await checkpoint('托盘驻留与恢复',async()=>{assert.ok(api.tray());api.hideToTray();await sleep(150);assert.ok(Object.values(api.windows()).every(w=>!w.visible));api.showApp({full:true});await sleep(150);assert.ok(Object.values(api.windows()).every(w=>w.visible));});
 await checkpoint('刷新率选项生效',async()=>{await action({type:'settings',settings:{frameRate:'60'}});assert.ok(api.state().frameRate<=60);await action({type:'settings',settings:{frameRate:'auto'}});assert.ok(api.state().frameRate>=24);});
 await checkpoint('原生毛玻璃宿主',async()=>{await wait(()=>Object.values(api.windows()).every(w=>w.native.blur),'毛玻璃宿主就绪',10000);assert.ok(Object.values(api.windows()).every(w=>w.native.glassVisible));});
 await checkpoint('V2 侧边纵向、向内展开、居中与设置持久化',async()=>{
  await action({type:'settings',settings:{dockCentered:true,hoverExpand:false,theme:'mist',nickname:'测试同学',hoverDelay:450,hoverCloseDelay:1100}});
  for(const edge of ['left','right']){api.setDock(edge);await sleep(200);let b=api.windows();assert.ok(b.activity.bounds.height>b.activity.bounds.width);if(edge==='left')assert.ok(b.main.bounds.x>=b.activity.bounds.x+b.activity.bounds.width-2);else assert.ok(b.main.bounds.x+b.main.bounds.width<=b.activity.bounds.x+2);const before=b.activity.bounds;await api.transition(true);await api.transition(false);await sleep(100);assert.deepEqual(api.windows().activity.bounds,before);}
  assert.equal(await js("document.documentElement.dataset.theme"),'mist');await sleep(600);assert.ok((await js("document.querySelector('[data-greeting]').textContent")).includes('测试同学'));
  assert.equal(api.state().settings.dockMode,'all');assert.equal(api.state().settings.hoverDelay,450);
 });
 await checkpoint('V2 渲染进程异常后的自动恢复与数据保留',async()=>{
  const count=api.state().tasks.length;view().forcefullyCrashRenderer();await sleep(1600);await wait(()=>js("!!document.querySelector('#settings-button')").catch(()=>false),'界面异常恢复',8000);assert.equal(api.state().tasks.length,count);assert.ok(api.windows().main.visible);
 });
 if(api.config.quick){success=true;log('快速运行自检通过',{passed:true});return;}
 await checkpoint('系统测试通知',async()=>{const count=api.events.length;await api.testNotification();await wait(()=>api.events.slice(count).some(e=>['toast-show','balloon-show'].includes(e.event)),'系统通知显示事件',12000);log('通知通道记录',{events:api.events.slice(count)});});
 api.setDock('top');api.changeMode('all');await sleep(150);
 const image=await view().capturePage();fs.writeFileSync(path.join(out,'main.png'),image.toPNG());
 api.hideToTray();log('等待一分钟提醒，应用已驻留托盘');
 await checkpoint('驻留托盘时一分钟提醒及去重',async()=>{
  await wait(()=>!!api.state().tasks.find(t=>t.id===parent)?.remindedAt,'一分钟提醒调度',75000);
  await wait(()=>api.events.some(e=>e.event==='toast-show'&&e.taskId===parent)||api.events.filter(e=>e.event==='balloon-show').length>=2,'一分钟系统通知显示',12000);
  const stamp=api.state().tasks.find(t=>t.id===parent).remindedAt;await sleep(1200);assert.equal(api.state().tasks.find(t=>t.id===parent).remindedAt,stamp);assert.ok(Object.values(api.windows()).every(w=>!w.visible));
 });
 success=true;log('全部运行自检通过',{passed:true});
 }catch(e){error=e.stack;log('运行自检失败',{passed:false,error});}
 finally{const result={success,error,tests:results,notifications:api.events,finalState:api.state(),windows:api.windows()};fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));if(api.config.exitOnComplete!==false)api.quit();}
}
module.exports={run};
