const {contextBridge,ipcRenderer}=require('electron');
const listen=(channel,callback)=>{const fn=(_,value)=>callback(value);ipcRenderer.on(channel,fn);return()=>ipcRenderer.removeListener(channel,fn);};
contextBridge.exposeInMainWorld('todo',{
 mcp:{settings:()=>ipcRenderer.invoke('mcp:settings'),status:()=>ipcRenderer.invoke('mcp:status'),configure:config=>ipcRenderer.invoke('mcp:configure',config),rotate:()=>ipcRenderer.invoke('mcp:rotate'),copy:()=>ipcRenderer.invoke('mcp:copy'),chooseFile:kind=>ipcRenderer.invoke('mcp:choose-file',kind)},
 busy:value=>ipcRenderer.send('interaction:busy',!!value),
 load:()=>ipcRenderer.invoke('state:load'),onState:fn=>listen('state:changed',fn),onPreview:fn=>listen('settings:preview',fn),
 onCompose:fn=>listen('compose:open',fn),onSettings:fn=>listen('settings:open',fn),
 selectDate:date=>ipcRenderer.invoke('date:select',date),previewSettings:s=>ipcRenderer.send('settings:preview',s),
 listFonts:refresh=>ipcRenderer.invoke('fonts:list',refresh===true),action:a=>ipcRenderer.invoke('state:action',a),
 control:cmd=>ipcRenderer.invoke('window:control',cmd),beginGesture:kind=>ipcRenderer.send('window:gesture-start',kind),endGesture:()=>ipcRenderer.send('window:gesture-end'),
 exportData:()=>ipcRenderer.invoke('data:export'),importData:()=>ipcRenderer.invoke('data:import')
});