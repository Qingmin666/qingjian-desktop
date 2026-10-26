const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const {presentationReason}=require('./presentation.cjs');

function attachNativeWindow(win, { radius = 38, onSystemMinimize = () => {}, toolWindow = false, groupRoot = null, canPresent = () => true, onPresentationChange = () => {} } = {}) {
  const status = { shape: true, blur: false, error: null, scale: 1, clip: 'antialiased-css-and-composition', hardRegion: false };
  const fallback = { status, updateShape() {}, applyBlur() {}, syncGlass() {}, hideGlass() {}, setOpacity() {}, leftDown: () => true, inspect: () => ({ ...status }) };
  if (process.platform !== 'win32') return fallback;
  try {
    const bundled = path.join(process.resourcesPath, 'native/node_modules/koffi');
    const koffi = require(fs.existsSync(bundled) ? bundled : 'koffi');
    const user = koffi.load('user32.dll'), dwm = koffi.load('dwmapi.dll');
    const rectType='TodoDuoRect'+win.id;
    koffi.struct(rectType, { left: 'long', top: 'long', right: 'long', bottom: 'long' });
    const getRect = user.func(`int __stdcall GetWindowRect(void *hwnd, _Out_ ${rectType} *rect)`);
    const getKey = user.func('int16_t __stdcall GetAsyncKeyState(int key)');
    const setPosition = user.func('int __stdcall SetWindowPos(void *hwnd, void *after, int x, int y, int width, int height, uint32_t flags)');
    const showWindow = user.func('int __stdcall ShowWindow(void *hwnd, int command)');
    const isVisible = user.func('int __stdcall IsWindowVisible(void *hwnd)');
    const isWindow = user.func('int __stdcall IsWindow(void *hwnd)');
    const getMetric = user.func('int __stdcall GetSystemMetrics(int index)');
    const setAlpha = user.func('int __stdcall SetLayeredWindowAttributes(void *hwnd, uint32_t key, uint8_t alpha, uint32_t flags)');
    const getAlpha = user.func('int __stdcall GetLayeredWindowAttributes(void *hwnd, _Out_ uint32_t *key, _Out_ uint8_t *alpha, _Out_ uint32_t *flags)');
    const isIconic = user.func('int __stdcall IsIconic(void *hwnd)');
    const getStyle = user.func('intptr_t __stdcall GetWindowLongPtrW(void *hwnd, int index)');
    const setStyle = user.func('intptr_t __stdcall SetWindowLongPtrW(void *hwnd, int index, intptr_t value)');
    const beginBatch = user.func('void * __stdcall BeginDeferWindowPos(int count)');
    const deferPosition = user.func('void * __stdcall DeferWindowPos(void *batch, void *hwnd, void *after, int x, int y, int width, int height, uint32_t flags)');
    const endBatch = user.func('int __stdcall EndDeferWindowPos(void *batch)');
    const sendTimeout = user.func('intptr_t __stdcall SendMessageTimeoutW(void *hwnd, uint32_t message, uintptr_t wparam, intptr_t lparam, uint32_t flags, uint32_t timeout, void *result)');
    const send = (hwnd,message,wparam,lparam) => sendTimeout(hwnd,message,wparam,lparam,2,100,null);
    const setDwmAttribute = dwm.func('long __stdcall DwmSetWindowAttribute(void *hwnd, uint32_t attribute, uint32_t *value, uint32_t size)');
    const getDwmAttribute = dwm.func('long __stdcall DwmGetWindowAttribute(void *hwnd, uint32_t attribute, _Out_ uint32_t *value, uint32_t size)');
    const handle = win.getNativeWindowHandle();
    const hwnd = handle.length === 8 ? handle.readBigUInt64LE() : BigInt(handle.readUInt32LE());
    if(toolWindow){const markTool=()=>{if(!win.isDestroyed())setStyle(hwnd,-20,(Number(getStyle(hwnd,-20))|0x80)&~0x40000);};markTool();win.on('show',()=>setImmediate(markTool));}
    let glassHost = null, suspended = false, syncing = false, sizeKey = '', desiredMode=null,restartTimer=null,restarts=[],opacity=1;
    const glassHwnd = () => status.glassHwnd ? BigInt(status.glassHwnd) : null;
    function setOpacity(value){
      opacity=Math.max(0,Math.min(1,value));if(!win.isDestroyed())win.setOpacity(opacity);
      const glass=glassHwnd();if(glass){const style=Number(getStyle(glass,-20));if(opacity===1&&!(style&0x80000))return;if(!(style&0x80000))setStyle(glass,-20,style|0x80000);if(!setAlpha(glass,0,Math.round(opacity*255),2)){status.opacityError='Glass opacity update failed';}else delete status.opacityError;}
    }
    function rect() {
      const r = {};
      if (!getRect(hwnd, r)) throw Error('GetWindowRect failed');
      return { x: r.left, y: r.top, width: r.right - r.left, height: r.bottom - r.top };
    }
    function presentation(){
      const exists=!!isWindow(hwnd),cloaked=[0],alpha=[255],key=[0],flags=[0];
      if(exists)getDwmAttribute(hwnd,14,cloaked,4);
      const hasAlpha=exists&&getAlpha(hwnd,key,alpha,flags),r=exists?rect():{x:0,y:0,width:0,height:0};
      const virtual={x:getMetric(76),y:getMetric(77),width:getMetric(78),height:getMetric(79)};
      const info={exists,visible:exists&&!!isVisible(hwnd),minimized:exists&&!!isIconic(hwnd),cloaked:cloaked[0],alpha:hasAlpha&&(flags[0]&2)?alpha[0]:255,onScreen:r.width>0&&r.height>0&&r.x+r.width>virtual.x&&r.y+r.height>virtual.y&&r.x<virtual.x+virtual.width&&r.y<virtual.y+virtual.height};
      const reason=presentationReason(info);return{...info,presented:!reason,reason};
    }
    status.lifecycle = [];
    const record = name => { status.lifecycle.push({name,time:Date.now(),minimized:win.isDestroyed()?null:win.isMinimized()}); if(status.lifecycle.length>30)status.lifecycle.shift(); };
    function hideGlass(reason='manual') { record('hide:'+reason); suspended = true; if (glassHwnd()) showWindow(glassHwnd(), 0); }
    function prepareSize(r) {
      const content = win.getContentBounds();
      if (r.width > 0 && content.width > 0 && !win.isMinimized()) status.scale = r.width / content.width;
      status.physicalSize = { width: r.width, height: r.height };
      const key = `${r.width}/${r.height}/${status.scale}`;
      if (glassHwnd() && key !== sizeKey) {
        send(glassHwnd(), 0x8002, Math.round(status.scale * 10000), 0);
        send(glassHwnd(), 0x8003, Math.round(radius * 10000), 0);
        send(glassHwnd(), 0x8001, r.width, r.height);
        sizeKey = key;
      }
    }
    function syncGlass(resume = false) {
      if (win.isDestroyed() || syncing) return;
      if (resume) { record('resume'); suspended = false; }
      if (suspended || !presentation().presented || !canPresent()) { if (glassHwnd()) showWindow(glassHwnd(), 0); return; }
      syncing = true;
      try {
        const r = rect(); prepareSize(r);
        if (glassHwnd()) setPosition(glassHwnd(), hwnd, r.x, r.y, r.width, r.height, 0x0010 | 0x0040);
      } finally { syncing = false; }
    }
    function updateShape() {
      if (win.isDestroyed() || win.isMinimized()) return;
      // GDI regions only have binary coverage and cut off smooth CSS corners.
      prepareSize(rect()); syncGlass();
    }
    function setBounds(r, moveOnly = false) {
      const old = rect();
      const next = moveOnly ? { ...old, x: r.x, y: r.y } : r;
      const glass = glassHwnd();
      if (!glass || suspended) return !!setPosition(hwnd, null, next.x, next.y, next.width, next.height, 0x0014 | (moveOnly ? 1 : 0));
      // Position both top-level HWNDs in one transaction, without a delayed
      // companion-window update. The glass renderer never moves itself.
      let batch = beginBatch(2);
      if (!batch) throw Error('BeginDeferWindowPos failed');
      syncing = true;
      try {
        batch = deferPosition(batch, hwnd, null, next.x, next.y, next.width, next.height, 0x0014 | (moveOnly ? 1 : 0));
        if (batch) batch = deferPosition(batch, glass, hwnd, next.x, next.y, next.width, next.height, 0x0010);
        if (!batch || !endBatch(batch)) throw Error('Window position transaction failed');
        prepareSize(rect());
      } finally { syncing = false; }
      return true;
    }
    function stopGlass() {
      clearTimeout(restartTimer);
      if (glassHwnd()) showWindow(glassHwnd(), 0);
      if (glassHost) { glassHost.kill(); glassHost = null; }
      status.blur = false; status.glassHwnd = null; sizeKey = '';
    }
    function applyBlur(mode) {
      desiredMode=mode;
      stopGlass(); setDwmAttribute(hwnd, 33, [1], 4); updateShape();
      if (mode !== 'glass') return;
      const packaged = path.join(process.resourcesPath, 'native/GlassHost.exe');
      const helper = fs.existsSync(packaged) ? packaged : path.join(__dirname, '../artifacts/GlassHost.exe');
      const child = spawn(helper, [hwnd.toString(), String(status.scale), String(radius), String(groupRoot||hwnd)], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      glassHost = child;
      child.stdout.on('data', buffer => {
        if (glassHost !== child) return;
        const match = buffer.toString().match(/READY (\d+)/);
        if (match) { status.blur = true; status.glassHwnd = match[1]; status.renderer = 'synchronized-rounded-host-backdrop'; status.error = null;setOpacity(opacity); syncGlass(); }
      });
      child.stderr.on('data', buffer => { if (glassHost === child) status.error = buffer.toString().trim(); });
      child.on('error', error => { if (glassHost === child) { status.blur = false; status.error = error.message; } });
      child.on('exit', code => { if (glassHost === child) { status.blur = false;status.glassHwnd=null;sizeKey='';glassHost = null; if (code) status.error ||= 'Glass host exited: ' + code;restarts=restarts.filter(t=>Date.now()-t<60000);if(desiredMode==='glass'&&!win.isDestroyed()&&restarts.length<3){restarts.push(Date.now());restartTimer=setTimeout(()=>{if(!win.isDestroyed())applyBlur(desiredMode);},600);} } });
    }
    win.hookWindowMessage(0x0112, wparam => { if ((wparam.readUInt32LE() & 0xfff0) === 0xf020) {hideGlass('syscommand');onSystemMinimize();} });
    if(!groupRoot)win.hookWindowMessage(0x805a,()=>setImmediate(onPresentationChange));
    win.on('minimize', () => hideGlass('minimize')); win.on('hide', () => hideGlass('hide'));
    win.on('restore', () => {record('restore');syncGlass(true)}); win.on('show', () => {record('show');syncGlass(true)});
    win.on('close', () => hideGlass('close')); win.once('closed', stopGlass);
    return { status, updateShape, applyBlur, syncGlass, hideGlass, setBounds, presentation,setOpacity,
      testSetCloak(value){const result=setDwmAttribute(hwnd,13,[value?1:0],4);if(result<0)throw Error('DWM cloak failed: '+result);},
      setRadius(value){if(radius!==value){radius=value;sizeKey='';}},
      beginGroup(){syncing=true;},endGroup(){syncing=false;prepareSize(rect());},
      batchEntries(target,moveOnly=false){const next=moveOnly?{...rect(),x:target.x,y:target.y}:target;const entries=[{hwnd,after:null,rect:next,flags:0x0014|(moveOnly?1:0)}];if(glassHwnd()&&!suspended)entries.push({hwnd:glassHwnd(),after:hwnd,rect:next,flags:0x0010|(moveOnly?1:0)});return entries;},
      moveTo: point => setBounds(point, true), leftDown: () => (getKey(1) & 0x8000) !== 0,
      inspect: () => ({ ...status, physicalRect: rect(), actualPhysicalSize: { width: rect().width, height: rect().height },
        glassVisible: !!(glassHwnd() && isVisible(glassHwnd())),
        glassRect: glassHwnd() ? (() => { const r = {}; getRect(glassHwnd(), r); return { x: r.left, y: r.top, width: r.right-r.left, height: r.bottom-r.top }; })() : null,
        minimized: !!isIconic(hwnd), suspended, radius, exStyle: Number(getStyle(hwnd,-20)), presentation:presentation() }) };
  } catch (error) { status.error = error.message; return fallback; }
}
module.exports = { attachNativeWindow };
