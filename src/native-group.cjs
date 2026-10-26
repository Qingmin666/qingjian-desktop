const fs=require('node:fs'),path=require('node:path');
function createNativeGroup(){
 const bundled=path.join(process.resourcesPath,'native/node_modules/koffi');
 const koffi=require(fs.existsSync(bundled)?bundled:'koffi'),user=koffi.load('user32.dll');
 const begin=user.func('void * __stdcall BeginDeferWindowPos(int count)');
 const defer=user.func('void * __stdcall DeferWindowPos(void *batch, void *hwnd, void *after, int x, int y, int width, int height, uint32_t flags)');
 const end=user.func('int __stdcall EndDeferWindowPos(void *batch)');
 return{setBounds(records){
   const entries=records.flatMap(({native,rect,moveOnly})=>native.batchEntries(rect,moveOnly));
   if(!entries.length)throw Error('Native group has no windows');
   records.forEach(({native})=>native.beginGroup());
   try{
     let batch=begin(entries.length);if(!batch)throw Error('BeginDeferWindowPos failed');
     for(const {hwnd,after,rect,flags} of entries){batch=defer(batch,hwnd,after,rect.x,rect.y,rect.width,rect.height,flags);if(!batch)throw Error('DeferWindowPos failed');}
     if(!end(batch))throw Error('EndDeferWindowPos failed');
   }finally{records.forEach(({native})=>native.endGroup());}
 }};
}
module.exports={createNativeGroup};
