"use strict";
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('MCP设置界面：仅保存按钮应用配置，文件选择、复制与重置由独立动作触发',async()=>{
 const nodes=new Map(),listeners={};let configured=null,copied=0,rotated=0;
 const get=s=>{if(!nodes.has(s))nodes.set(s,{value:'',checked:false,hidden:true,disabled:false});return nodes.get(s);};
 const config={enabled:false,remote:false,port:49321,publicUrl:'',certPath:'',keyPath:'',origins:[],token:'TEST_ONLY_TOKEN',status:{enabled:false,remote:false,running:false,endpoint:'http://127.0.0.1:49321/mcp'}};
 const api={settings:async()=>config,status:async()=>config.status,configure:async v=>{configured=v;Object.assign(config,v);return config.status;},chooseFile:async kind=>'isolated/'+kind+'.pem',copy:async()=>copied++,rotate:async()=>{rotated++;config.token='NEW_TEST_ONLY_TOKEN';}};
 const context=vm.createContext({window:{todo:{mcp:api,onSettings:f=>listeners.open=f}},document:{querySelector:get,addEventListener:(type,f)=>listeners[type]=f},setInterval:()=>0});vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/mcp-settings.js'),'utf8'),context);
 await listeners.open();assert.equal(get('#mcp-token').value,'TEST_ONLY_TOKEN');get('#mcp-remote').checked=true;get('#mcp-remote').onchange({target:get('#mcp-remote')});assert.equal(configured,null);assert.equal(get('#mcp-remote-fields').hidden,false);
 await get('#mcp-cert-select').onclick();await get('#mcp-key-select').onclick();get('#mcp-enabled').checked=true;get('#mcp-url').value='https://example.test:49321/mcp';get('#mcp-origins').value='https://client.test';await get('#mcp-apply').onclick();assert.equal(configured.remote,true);assert.equal(configured.certPath,'isolated/cert.pem');assert.equal(configured.keyPath,'isolated/key.pem');assert.equal(configured.origins[0],'https://client.test');assert.equal(copied,0);await get('#mcp-copy').onclick();assert.equal(copied,1);await get('#mcp-rotate').onclick();assert.equal(rotated,1);assert.equal(get('#mcp-token').value,'NEW_TEST_ONLY_TOKEN');
});
