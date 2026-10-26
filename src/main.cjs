'use strict';
const {app,BrowserWindow,ipcMain,nativeTheme,dialog,Menu,screen,Tray,Notification,powerMonitor,clipboard}=require('electron');
const fs=require('node:fs'),path=require('node:path'),{performance}=require('node:perf_hooks');
const M=require('./model.cjs'),D=require('./dock-geometry.cjs');
const {createTaskTools}=require('./mcp-tools.cjs'),{createMcpController}=require('./mcp-server.cjs');let mcp=null;
const revealFrame=require('./reveal-motion.cjs').frame;let reveal=null,visibleMode=null;
const hover=require('./hover-state.cjs').createHoverState();let hoverTimer=null;const busyRoles=require('./interaction-gate.cjs').createInteractionGate();let menuOpen=false;
function diagnostic(event,detail={}){try{const file=path.join(app.getPath('userData'),'runtime.log');fs.mkdirSync(path.dirname(file),{recursive:true});if(fs.existsSync(file)&&fs.statSync(file).size>1048576)fs.renameSync(file,file+'.previous');fs.appendFileSync(file,JSON.stringify({time:new Date().toISOString(),event,...detail})+'\n');}catch{}}
const {attachNativeWindow}=require('./native-window.cjs'),{createNativeGroup}=require('./native-group.cjs'),{gestureBounds,EDGES}=require('./window-geometry.cjs'),{listSystemFonts}=require('./system-fonts.cjs'),{createReminderService}=require('./reminders.cjs');
const testConfigFile=path.join(path.dirname(process.execPath),'QINGJIAN_TEST.json');
let testConfig={};try{if(fs.existsSync(testConfigFile))testConfig=JSON.parse(fs.readFileSync(testConfigFile,'utf8'));}catch(e){console.error('Invalid isolated test configuration:',e.message);}
const testing=process.argv.includes('--test-mode')||testConfig.selfTest===true,customData=process.argv.find(a=>a.startsWith('--data-dir='));
app.setName('轻笺');app.setAppUserModelId('QingJian.Desktop');
app.setPath('userData',customData?path.resolve(customData.slice(11)):testConfig.dataDir?path.resolve(testConfig.dataDir):app.isPackaged?path.join(path.dirname(process.execPath),'data'):path.resolve(__dirname,'../data'));
nativeTheme.themeSource='dark';Menu.setApplicationMenu(null);
let state,dataFile,warning='',revision=0,selectedDate=M.dateKey(),selectedTaskId=null;
const windows={},natives={};let nativeGroup,tray,reminders,layout,expanded=false,animation=null,gesture=null,gestureTimer=null,saveTimer=null;
let ready=false,quitting=false,hiddenToTray=false,applying=false,visibilityTimer=null,dayTimer=null,lastDay=M.dateKey();
let compactSize={width:344,height:48},expandedSize={width:370,height:352},mainSize={width:660,height:500},anchor={x:100,y:100},dockEdge=null,displayId=null;
const notifications=new Set(),notificationEvents=[];let balloonTaskId=null;
function persist(next){fs.mkdirSync(path.dirname(dataFile),{recursive:true});fs.writeFileSync(dataFile+'.tmp',JSON.stringify(next,null,2),'utf8');fs.renameSync(dataFile+'.tmp',dataFile);state=next;}
function loadState(){
 if(!fs.existsSync(dataFile)){persist(M.createState());return;}
 const raw=JSON.parse(fs.readFileSync(dataFile,'utf8'));state=M.validate(raw);
 if(raw.version!==2){fs.copyFileSync(dataFile,dataFile+'.v1-backup-'+Date.now());persist(state);}
}
function mode(){if(visibleMode)return visibleMode;return dockEdge?(hover.active?'all':state.settings.dockMode):'all';}
function work(){const displays=screen.getAllDisplays(),chosen=displays.find(d=>d.id===displayId);return chosen||screen.getDisplayMatching({...anchor,...compactSize});}
function rate(){return D.targetRate(state.settings.frameRate,work().displayFrequency);}
function arranged(){return D.arrange({anchor,compactSize,expandedSize,mainSize,expanded,edge:dockEdge,mode:mode(),work:work().workArea,centered:state.settings.dockCentered});}
function snapshot(){return{...state,warning,dataFile,revision,selectedDate,selectedTaskId,expanded,transitioning:!!animation,displayMode:mode(),dockEdge,frameRate:rate(),hiddenToTray,mcp:mcp?.status(),hoverExpanded:hover.active,revealing:!!reveal,duo:{layout,compactSize,expandedSize,cornerRadius:D.activityRadius(compactSize)},runtime:testing?Object.fromEntries(Object.entries(natives).map(([r,n])=>[r,n.inspect()])):undefined};}
function broadcast(){revision++;const s=snapshot();for(const w of Object.values(windows))if(!w.isDestroyed())w.webContents.send('state:changed',s);return s;}
function errorNotice(error){warning=error.message||String(error);if(ready)broadcast();}
function saveLayoutNow(){clearTimeout(saveTimer);if(!state)return;try{persist({...state,qjWindow:{anchor,compactSize,expandedSize,mainSize,dockEdge,displayId}});}catch(e){errorNotice(e);}}
function saveLayout(){clearTimeout(saveTimer);saveTimer=setTimeout(saveLayoutNow,180);}
function applyLayout(next){
 if(!nativeGroup||quitting)return;applying=true;
 try{natives.activity.setRadius(D.activityRadius(compactSize));nativeGroup.setBounds(Object.entries(next).map(([role,r])=>({native:natives[role],rect:screen.dipToScreenRect(windows[role],r),moveOnly:!!layout&&layout[role].width===r.width&&layout[role].height===r.height&&windows[role].getContentBounds().width===r.width&&windows[role].getContentBounds().height===r.height&&screen.getDisplayMatching(layout[role]).id===screen.getDisplayMatching(r).id})));layout=next;}finally{applying=false;}
}
function want(role){return ready&&!quitting&&!hiddenToTray&&(role==='activity'||mode()!=='capsule');}
function reconcileVisibility(){
 if(!ready||quitting||animation||gesture||reveal)return;
 for(const [role,w]of Object.entries(windows)){
  if(w.isDestroyed())continue;
  if(!want(role)){natives[role].hideGlass('mode-or-tray');if(w.isVisible())w.hide();}
  else{if(w.isMinimized())w.restore();if(!w.isVisible()){w.showInactive();setImmediate(()=>{if(ready&&!quitting&&want(role))applyLayout(arranged());});}if(natives[role].presentation().presented)natives[role].syncGlass(true);else natives[role].hideGlass('desktop-hidden');}
 }
}
function stopAnimation(){if(animation){clearTimeout(animation.timer);const done=animation.resolve;animation=null;done();}}
function endGesture(update=true){
 if(!gesture)return;const kind=gesture.kind;if(update)updateGesture();clearTimeout(gestureTimer);gestureTimer=null;gesture=null;
 if(kind==='move'){
  displayId=screen.getDisplayMatching(layout.activity).id;
  const b=D.bounds(layout,mode()!=='capsule');
  dockEdge=state.settings.dockEnabled?D.detect({x:b.x,y:layout.activity.y,width:b.width},work().workArea,dockEdge):null;
 }
 applyLayout(arranged());reconcileVisibility();saveLayout();broadcast();
}
function updateGesture(cursor=screen.getCursorScreenPoint()){
 if(!gesture||quitting)return;
 const dx=cursor.x-gesture.cursor.x,dy=cursor.y-gesture.cursor.y;
 if(gesture.kind==='move'){
  const pair=Object.fromEntries(Object.entries(gesture.layout).map(([k,r])=>[k,{...r,x:r.x+dx,y:r.y+dy}]));
  const display=screen.getDisplayMatching(pair.activity),next=D.fit(pair,display.workArea,mode()!=='capsule');
  applyLayout(next);anchor={x:next.activity.x+(expanded?(next.activity.width-compactSize.width)/2:0),y:next.activity.y};
 }else{
  if(gesture.role==='activity'&&dockEdge)return;
  const min=gesture.role==='main'?{width:470,height:mode()==='first'?148:280}:{width:280,height:expanded?180:44};
  const next=gestureBounds(gesture.layout[gesture.role],gesture.kind,{x:dx,y:dy},min),area=work().workArea;
  const size={width:Math.min(next.width,area.width),height:Math.min(next.height,Math.max(min.height,area.height-90))};
  if(gesture.role==='main'){if(mode()==='first')mainSize.width=size.width;else mainSize=size;}else if(expanded)expandedSize=size;else compactSize={width:size.width,height:Math.min(72,size.height)};
  if(!dockEdge){if(gesture.role==='activity')anchor={x:next.x+(expanded?(size.width-compactSize.width)/2:0),y:next.y};}
  applyLayout(arranged());
 }
}
function beginGesture(role,kind){
 if(animation||reveal||quitting||hiddenToTray||!(role in windows)||(kind!=='move'&&!EDGES.has(kind)))return;
 endGesture(false);gesture={role,kind,layout:structuredClone(layout),cursor:screen.getCursorScreenPoint()};
 const poll=()=>{if(!gesture)return;if(!testing&&!natives[role].leftDown()){endGesture();return;}const start=performance.now();updateGesture();gestureTimer=setTimeout(poll,Math.max(1,1000/rate()-(performance.now()-start)));};poll();
}
function transition(open){
 cancelReveal();
 if(quitting||open===expanded)return Promise.resolve();
 endGesture();stopAnimation();const from=structuredClone(layout);expanded=open;const target=arranged(),started=performance.now();
 return new Promise(resolve=>{
  const a={resolve,timer:null};animation=a;broadcast();
  const tick=()=>{if(animation!==a)return;const tickStart=performance.now(),t=Math.min(1,(tickStart-started)/210),ease=1-Math.pow(1-t,3);
   const next={};for(const role of ['main','activity']){next[role]={};for(const k of ['x','y','width','height'])next[role][k]=Math.round(from[role][k]+(target[role][k]-from[role][k])*ease);}
   applyLayout(next);
   if(t===1){animation=null;applyLayout(target);reconcileVisibility();saveLayout();broadcast();resolve();}else a.timer=setTimeout(tick,Math.max(1,1000/rate()-(performance.now()-tickStart)));
  };tick();
 });
}
function setDock(edge){cancelReveal();hover.reset();if(![null,'top','left','right'].includes(edge))throw Error('未知贴靠位置');endGesture();stopAnimation();if(edge&&!state.settings.dockEnabled)persist(M.mutate(state,{type:'settings',settings:{dockEnabled:true}}));dockEdge=edge;applyLayout(arranged());reconcileVisibility();saveLayout();broadcast();}
function changeMode(value){cancelReveal();hover.reset();if(!['capsule','first','all'].includes(value))return;endGesture();stopAnimation();persist(M.mutate(state,{type:'settings',settings:{dockMode:value}}));applyLayout(arranged());reconcileVisibility();refreshTray();broadcast();}
function showApp({full=false,taskId=null,compose=false}={}){
 cancelReveal();
 hiddenToTray=false;
 if(full&&dockEdge&&!state.settings.hoverExpand)changeMode('all');
 if(full&&dockEdge&&state.settings.hoverExpand&&!hover.active){hover.update({now:0,enabled:true,docked:true,inside:true,overCapsule:true,busy:false,openDelay:0,closeDelay:800});hover.update({now:1,enabled:true,docked:true,inside:true,overCapsule:true,busy:false,openDelay:0,closeDelay:800});}
 if(taskId){const t=state.tasks.find(t=>t.id===taskId);if(t){selectedDate=t.date;selectedTaskId=t.id;}}
 applyLayout(arranged());reconcileVisibility();
 const target=mode()==='capsule'?windows.activity:windows.main;target.show();target.focus();broadcast();if(compose)windows.main.webContents.send('compose:open');
}
function hideToTray(){if(!tray)return;cancelReveal();hover.reset();busyRoles.clear();endGesture();stopAnimation();expanded=false;hiddenToTray=true;layout=arranged();reconcileVisibility();broadcast();refreshTray();}
function applyMaterial(){for(const [role,w]of Object.entries(windows)){w.setBackgroundColor('#00000000');w.setAlwaysOnTop(state.settings.alwaysOnTop,'pop-up-menu');natives[role].applyBlur(state.settings.material);}reconcileVisibility();}
function buildTrayMenu(){return Menu.buildFromTemplate([
 {label:'显示轻笺',click:()=>showApp()},{label:'隐藏到托盘',click:hideToTray},{label:'添加任务',click:()=>showApp({full:true,compose:true})},
 {type:'separator'},{label:'贴靠位置',submenu:[['top','顶部'],['left','左侧'],['right','右侧'],[null,'自由悬浮']].map(([edge,label])=>({label,click:()=>{setDock(edge);showApp();}}))},
 {label:'贴靠时居中',type:'checkbox',checked:state.settings.dockCentered,click:()=>{persist(M.mutate(state,{type:'settings',settings:{dockCentered:!state.settings.dockCentered}}));applyLayout(arranged());saveLayout();broadcast();refreshTray();}},
 {label:'贴靠显示',submenu:[['capsule','仅胶囊'],['first','胶囊＋首项任务'],['all','全部任务']].map(([value,label])=>({label,type:'radio',checked:state.settings.dockMode===value,click:()=>{changeMode(value);showApp();}}))},
 {label:'设置',click:()=>{showApp({full:true});windows.main.webContents.send('settings:open');}},
 {type:'separator'},{label:'完全退出',click:quitApp}
 ]);}
function refreshTray(){if(tray)tray.setContextMenu(buildTrayMenu());}
function createTray(){
 try{tray=new Tray(path.join(__dirname,'icon.ico'));tray.setToolTip('轻笺 · 任务与提醒');tray.on('double-click',()=>showApp());tray.on('balloon-click',()=>showApp({full:true,taskId:balloonTaskId}));tray.on('balloon-show',()=>notificationEvents.push({event:'balloon-show',time:Date.now()}));refreshTray();}
 catch(e){warning='托盘创建失败，关闭窗口将直接退出：'+e.message;tray=null;}
}
function quitApp(){mcp?.stop();cancelReveal();saveLayoutNow();quitting=true;reminders?.stop();endGesture(false);stopAnimation();clearInterval(visibilityTimer);clearInterval(dayTimer);clearInterval(hoverTimer);clearTimeout(saveTimer);tray?.destroy();app.quit();}
async function deliver(task,test=false){
 if(testing&&!test&&!testConfig.notifications)return;
 if(!Notification.isSupported())throw Error('当前系统不支持通知');
 if(!test){const current=state.tasks.find(t=>t.id===task.id);if(!current||current.done||current.remindedAt)return;persist({...state,tasks:state.tasks.map(t=>t.id===task.id?{...t,remindedAt:new Date().toISOString()}:t)});broadcast();}
 const n=new Notification({title:test?'轻笺 · 测试提醒':'轻笺 · 任务提醒',body:test?'系统通知已接通。驻留托盘时也会继续提醒。':task.title,icon:path.join(__dirname,'icon.png'),silent:false});
 notifications.add(n);n.on('click',()=>showApp({full:true,taskId:test?null:task.id}));
 n.on('show',()=>notificationEvents.push({event:'toast-show',test,taskId:task.id||null,time:Date.now()}));
 n.on('close',()=>notifications.delete(n));n.on('failed',(_,message)=>{notifications.delete(n);notificationEvents.push({event:'toast-failed',message,time:Date.now()});if(tray){try{balloonTaskId=test?null:task.id;tray.displayBalloon({title:test?'轻笺 · 测试提醒':'轻笺 · 任务提醒',content:test?'系统托盘提醒已接通。':task.title,iconType:'info',respectQuietTime:true});return;}catch(e){message+='；'+e.message;}}if(!test){try{persist({...state,tasks:state.tasks.map(t=>t.id===task.id&&t.remindAt===task.remindAt?{...t,remindedAt:null}:t)});}catch(e){errorNotice(e);}}errorNotice(Error('系统通知发送失败：'+message));});
 try{n.show();}catch(e){notifications.delete(n);if(!test)persist({...state,tasks:state.tasks.map(t=>t.id===task.id?{...t,remindedAt:null}:t)});throw e;}
}
function senderRole(event){return Object.keys(windows).find(r=>windows[r].webContents===event.sender);}
function registerHandlers(){
 ipcMain.handle('mcp:settings',()=>mcp.settings());ipcMain.handle('mcp:status',()=>mcp.status());
 ipcMain.handle('mcp:configure',(_,input)=>mcp.configure(input));ipcMain.handle('mcp:rotate',()=>mcp.rotate());
 ipcMain.handle('mcp:copy',()=>{clipboard.writeText(JSON.stringify(mcp.clientConfig(),null,2));return true;});
 ipcMain.handle('mcp:choose-file',async(_,kind)=>{if(!['cert','key'].includes(kind))throw Error('文件类型无效');const result=await dialog.showOpenDialog(windows.main,{title:kind==='cert'?'选择PEM证书链':'选择PEM私钥',filters:[{name:'PEM证书或私钥',extensions:kind==='cert'?['pem','crt','cer']:['pem','key']}],properties:['openFile']});return result.canceled?null:result.filePaths[0];});

 ipcMain.on('interaction:busy',(e,busy)=>{const role=senderRole(e);if(role)busyRoles.report(role,busy===true&&windows[role].isVisible()&&!windows[role].isMinimized());});
 ipcMain.handle('state:load',()=>snapshot());ipcMain.handle('fonts:list',(_,refresh)=>listSystemFonts(refresh===true));
 ipcMain.handle('state:action',(_,action)=>{
  if(!action||typeof action.type!=='string')throw Error('无效操作');
  persist(M.mutate(state,action));warning='';
  if(action.type==='settings'){cancelReveal();
   if(!state.settings.dockEnabled)dockEdge=null;
   if('material'in action.settings)applyMaterial();
   for(const w of Object.values(windows))w.setAlwaysOnTop(state.settings.alwaysOnTop,'pop-up-menu');
   stopAnimation();applyLayout(arranged());reconcileVisibility();refreshTray();saveLayout();
  }
  reminders?.reschedule();return broadcast();
 });
 ipcMain.handle('date:select',(_,date)=>{if(!M.validDate(date))throw Error('无效日期');selectedDate=date;selectedTaskId=null;return broadcast();});
 ipcMain.on('settings:preview',(_,s)=>{const clean={};for(const [k,min,max]of [['tint',15,85],['fontSize',12,30]])if(Number.isFinite(s?.[k]))clean[k]=Math.max(min,Math.min(max,s[k]));for(const w of Object.values(windows))w.webContents.send('settings:preview',clean);});
 ipcMain.on('window:gesture-start',(e,kind)=>{const role=senderRole(e);if(role)beginGesture(role,kind);});
 ipcMain.on('window:gesture-end',()=>endGesture());
 ipcMain.handle('window:control',async(_,cmd)=>{
  if(cmd==='activity-expand')await transition(true);
  else if(cmd==='activity-collapse')await transition(false);
  else if(cmd==='minimize')hideToTray();
  else if(cmd==='close')windows.main.close();
  else if(cmd==='show-all')showApp({full:true});
  else if(cmd.startsWith('dock:'))setDock(cmd.slice(5)==='free'?null:cmd.slice(5));
  else if(cmd==='quit')quitApp();
  else if(cmd==='mode-next'){if(dockEdge)changeMode(({all:'first',first:'capsule',capsule:'all'})[mode()]);else showApp({full:true});}
  else if(cmd==='capsule-menu'){menuOpen=true;buildTrayMenu().popup({window:windows.activity,callback:()=>{menuOpen=false;}});}
  else if(cmd==='notification-test'){await deliver({},true);return true;}
  return true;
 });
 ipcMain.handle('data:export',async()=>{const result=await dialog.showSaveDialog(windows.main,{title:'导出轻笺备份',defaultPath:'QingJian-backup-'+M.dateKey()+'.json',filters:[{name:'JSON 备份',extensions:['json']}]});if(result.canceled)return false;fs.writeFileSync(result.filePath,JSON.stringify(state,null,2),'utf8');return true;});
 ipcMain.handle('data:import',async()=>{
  const result=await dialog.showOpenDialog(windows.main,{title:'导入任务（兼容 TodoDuo 旧备份）',filters:[{name:'JSON 备份',extensions:['json']}],properties:['openFile']});if(result.canceled)return false;
  if(fs.statSync(result.filePaths[0]).size>20*1024*1024)throw Error('备份文件超过 20 MB');const incoming=JSON.parse(fs.readFileSync(result.filePaths[0],'utf8')),next=M.merge(state,incoming);
  fs.copyFileSync(dataFile,dataFile+'.before-import-'+Date.now());persist(next);reminders?.reschedule();return broadcast();
 });
}
function cancelReveal(){if(reveal){clearTimeout(reveal.timer);const resolve=reveal.resolve;reveal=null;visibleMode=null;if(natives.main)natives.main.setOpacity(1);resolve();}}
async function slideHover(open){
 cancelReveal();if(animation)stopAnimation();
 if(state.settings.dockMode==='all'){applyLayout(arranged());reconcileVisibility();broadcast();return;}
 if(!open&&expanded)await transition(false);
 const firstClose=!open&&state.settings.dockMode==='first',old=structuredClone(layout.main);
 visibleMode=firstClose?'first':'all';const target=arranged();
 return new Promise(resolve=>{
  const motion={resolve,timer:null};reveal=motion;
  // Prepare the hidden window before presenting it. Glass and web content share opacity.
  if(open){natives.main.setOpacity(0);const f=revealFrame(target.main,dockEdge,0,true);applyLayout({...target,main:f.rect});}
  broadcast();const start=performance.now()+32;let glassShown=false;
  const tick=()=>{
   if(reveal!==motion||quitting)return;
   try{
   const elapsed=performance.now()-start;if(elapsed<0){motion.timer=setTimeout(tick,Math.ceil(-elapsed));return;}
   const t=Math.min(1,elapsed/260),f=revealFrame(target.main,dockEdge,t,open);
   let rect=f.rect,opacity=f.opacity;
   if(firstClose){const e=t*t*(3-2*t);rect=Object.fromEntries(['x','y','width','height'].map(k=>[k,Math.round(old[k]+(target.main[k]-old[k])*e)]));opacity=1;}
   applyLayout({...target,main:rect});natives.main.setOpacity(opacity);
   if(open&&!windows.main.isVisible())windows.main.showInactive();
   if(opacity>0&&!glassShown){natives.main.syncGlass(true);glassShown=true;}
   if(t===1){reveal=null;visibleMode=null;applyLayout(arranged());reconcileVisibility();natives.main.setOpacity(1);broadcast();resolve();}
   else motion.timer=setTimeout(tick,1000/rate());
   }catch(error){cancelReveal();applyLayout(arranged());reconcileVisibility();errorNotice(error);}
  };tick();
 });
}
function pollHover(){
 if(!ready||quitting||hiddenToTray||!layout)return;
 const p=screen.getCursorScreenPoint(),inside=r=>p.x>=r.x&&p.y>=r.y&&p.x<r.x+r.width&&p.y<r.y+r.height;
 // Include the narrow bridge between panes, so crossing the gap never retracts the list.
 const region=D.bounds(layout,mode()!=='capsule');
 const result=hover.update({now:performance.now(),enabled:state.settings.hoverExpand,docked:!!dockEdge,inside:inside(region),overCapsule:inside(layout.activity),busy:!!gesture||!!animation||!!reveal||busyRoles.isBusy(role=>!!windows[role]&&!windows[role].isDestroyed()&&windows[role].isVisible()&&!windows[role].isMinimized())||menuOpen,openDelay:state.settings.hoverDelay,closeDelay:state.settings.hoverCloseDelay});
 if(result)slideHover(result==='open').catch(error=>{cancelReveal();applyLayout(arranged());reconcileVisibility();errorNotice(error);});
}
function installRecovery(role,w){
 let recovering=false,attempts=[];
 const reload=reason=>{if(quitting||w.isDestroyed()||recovering)return;attempts=attempts.filter(t=>Date.now()-t<60000);diagnostic('renderer-recovery',{role,reason,attempt:attempts.length+1});busyRoles.delete(role);if(attempts.length>=3){warning='界面反复异常，请从托盘完全退出后重开；任务已保留。';return;}attempts.push(Date.now());recovering=true;setTimeout(()=>{if(!quitting&&!w.isDestroyed())w.webContents.reload();},400);};
 w.webContents.on('render-process-gone',(_,detail)=>reload(detail.reason));
 w.webContents.on('did-finish-load',()=>{recovering=false;if(ready){applyLayout(arranged());reconcileVisibility();broadcast();}});
 w.on('unresponsive',()=>diagnostic('window-unresponsive',{role}));
 w.webContents.on('preload-error',(_,file,e)=>diagnostic('preload-error',{role,message:e.message}));
}
function boundedSize(value,fallback,min,area){return{width:Math.round(Math.max(min.width,Math.min(area.width,Number(value?.width)||fallback.width))),height:Math.round(Math.max(min.height,Math.min(area.height-70,Number(value?.height)||fallback.height)))};}
async function createWindows(){
 dataFile=path.join(app.getPath('userData'),'todos.json');loadState();
 const saved=state.qjWindow||{},area=screen.getPrimaryDisplay().workArea;compactSize=boundedSize(saved.compactSize,compactSize,{width:280,height:44},area);compactSize.height=Math.min(72,compactSize.height);expandedSize=boundedSize(saved.expandedSize,expandedSize,{width:280,height:180},area);mainSize=boundedSize(saved.mainSize||state.duoWindow?.main,mainSize,{width:470,height:280},area);
 anchor={x:Number.isFinite(saved.anchor?.x)?saved.anchor.x:Math.round(area.x+(area.width-compactSize.width)/2),y:Number.isFinite(saved.anchor?.y)?saved.anchor.y:Math.round(area.y+area.height*.15)};
 displayId=screen.getAllDisplays().some(d=>d.id===saved.displayId)?saved.displayId:screen.getDisplayMatching({...anchor,...compactSize}).id;dockEdge=state.settings.dockEnabled&&['top','left','right'].includes(saved.dockEdge)?saved.dockEdge:null;layout=arranged();
 const common={icon:path.join(__dirname,'icon.png'),frame:false,thickFrame:false,transparent:true,resizable:true,maximizable:false,fullscreenable:false,hasShadow:false,show:false,backgroundColor:'#00000000',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}};
 windows.main=new BrowserWindow({...common,title:'轻笺',...layout.main,minWidth:100,minHeight:100});
 windows.activity=new BrowserWindow({...common,title:'轻笺 · 胶囊',...layout.activity,minWidth:44,minHeight:44,skipTaskbar:true,minimizable:false});
 for(const [role,w]of Object.entries(windows)){
  natives[role]=attachNativeWindow(w,{radius:role==='main'?32:24,toolWindow:role==='activity',canPresent:()=>want(role),onPresentationChange:()=>setImmediate(reconcileVisibility),onSystemMinimize:()=>setImmediate(hideToTray)});
  if(natives[role].status.error)throw Error(natives[role].status.error);
  let shapePending=false;w.on('resize',()=>{if(shapePending||animation||applying)return;shapePending=true;setImmediate(()=>{shapePending=false;if(!w.isDestroyed())natives[role].updateShape();});});
  w.on('hide',()=>busyRoles.delete(role));
  w.on('blur',()=>{if(gesture?.role===role)endGesture();});
  w.on('focus',()=>{const other=role==='main'?'activity':'main';if(ready&&want(other)&&windows[other]?.isVisible()){natives[other].syncGlass(true);}});
  w.on('minimize',()=>setImmediate(hideToTray));
  w.on('close',e=>{if(quitting)return;e.preventDefault();if(state.settings.closeToTray&&tray){if(!state.trayHintShown&&!testing){const answer=dialog.showMessageBoxSync(w,{type:'info',title:'轻笺仍在后台运行',message:'关闭窗口后，轻笺会驻留系统托盘并继续提醒。',detail:'双击托盘图标恢复；右键选择“完全退出”停止运行。可在设置中更改关闭行为。',buttons:['收起到托盘','取消'],defaultId:0,cancelId:1});if(answer===1)return;persist({...state,trayHintShown:true});}hideToTray();}else quitApp();});
  installRecovery(role,w);
  w.webContents.setWindowOpenHandler(()=>({action:'deny'}));w.webContents.on('will-navigate',e=>e.preventDefault());
 }
 nativeGroup=createNativeGroup();
 mcp=createMcpController({directory:app.getPath('userData'),tools:createTaskTools({getState:()=>state,commit:next=>{persist(next);warning='';setImmediate(()=>{try{reminders?.reschedule();if(ready&&!quitting)broadcast();}catch(e){diagnostic('mcp-ui-refresh-error',{message:e.message});}});}}),onChange:()=>{if(ready&&!quitting)broadcast();}});
 registerHandlers();createTray();applyMaterial();
 await Promise.all(Object.entries(windows).map(([r,w])=>w.loadFile(path.join(__dirname,r==='main'?'index.html':'activity-window.html'))));
 await Promise.all(Object.values(windows).map(w=>w.webContents.executeJavaScript('document.fonts.ready.then(()=>true)')));
 ready=true;applyLayout(layout);reconcileVisibility();broadcast();
 reminders=createReminderService({getState:()=>state,deliver:t=>deliver(t),onError:errorNotice});if(!testing||testConfig.notifications)reminders.start();
 mcp.start().catch(e=>{diagnostic('mcp-start-error',{message:e.message});errorNotice(e);});
 powerMonitor.on('resume',()=>{reminders.check();reconcileVisibility();});
 visibilityTimer=setInterval(()=>{try{reconcileVisibility();}catch(e){diagnostic('visibility-error',{message:e.message});}},1000);
 hoverTimer=setInterval(pollHover,50);
 dayTimer=setInterval(()=>{const today=M.dateKey();if(today!==lastDay){if(selectedDate===lastDay)selectedDate=today;lastDay=today;broadcast();}},30000);
 const displayChanged=()=>{cancelReveal();stopAnimation();endGesture(false);if(!screen.getAllDisplays().some(d=>d.id===displayId))displayId=screen.getPrimaryDisplay().id;applyLayout(arranged());saveLayout();broadcast();};
 screen.on('display-metrics-changed',displayChanged);screen.on('display-removed',displayChanged);screen.on('display-added',displayChanged);
 if(testConfig.selfTest)setImmediate(()=>require('./runtime-check.cjs').run({config:testConfig,state:()=>snapshot(),windows:()=>Object.fromEntries(Object.entries(windows).map(([r,w])=>[r,{visible:w.isVisible(),bounds:w.getContentBounds(),native:natives[r].inspect()}])),view:()=>windows.main.webContents,activity:()=>windows.activity.webContents,setDock,changeMode,transition,hideToTray,showApp,events:notificationEvents,testNotification:()=>deliver({},true),quit:quitApp,tray:()=>!!tray&&!tray.isDestroyed()}).catch(errorNotice));
 if(testing)app.qingJianTest={snapshot,action:a=>{persist(M.mutate(state,a));return broadcast();},layout:()=>layout,transition,beginGesture,endGesture,updateGesture,showApp,hideToTray,changeMode,dock(edge){dockEdge=edge;applyLayout(arranged());reconcileVisibility();return broadcast();},quit:quitApp};
}
app.on('child-process-gone',(_,detail)=>diagnostic('child-process-gone',{type:detail.type,reason:detail.reason,exitCode:detail.exitCode}));
process.on('uncaughtException',e=>{diagnostic('uncaught-exception',{message:e.message,stack:e.stack});if(ready)errorNotice(e);});
process.on('unhandledRejection',e=>diagnostic('unhandled-rejection',{message:String(e)}));
app.on('before-quit',()=>{mcp?.stop();cancelReveal();quitting=true;reminders?.stop();clearInterval(visibilityTimer);clearInterval(dayTimer);clearInterval(hoverTimer);clearTimeout(saveTimer);clearTimeout(gestureTimer);stopAnimation();tray?.destroy();});
if(!app.requestSingleInstanceLock())app.quit();else{
 app.on('second-instance',()=>{if(ready)showApp();});app.whenReady().then(createWindows).catch(e=>{dialog.showErrorBox('轻笺启动失败','原数据未被重置。\n'+e.stack);quitting=true;app.quit();});
 app.on('window-all-closed',()=>{if(!tray)app.quit();});
}
