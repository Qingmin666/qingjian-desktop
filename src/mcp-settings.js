(function(){
'use strict';const $=s=>document.querySelector(s),api=window.todo.mcp;let busy=false,loaded=false;
function status(s){$('#mcp-status').textContent=s.error?'未运行：'+s.error:s.running?'运行中 · '+s.requests+' 次调用 · '+s.sessions+' 个会话':s.enabled?'服务未运行':'已关闭';$('#mcp-endpoint').textContent=s.endpoint||'';}
function view(c){$('#mcp-enabled').checked=c.enabled;$('#mcp-remote').checked=c.remote;$('#mcp-port').value=c.port;$('#mcp-url').value=c.publicUrl;$('#mcp-cert').value=c.certPath;$('#mcp-key').value=c.keyPath;$('#mcp-origins').value=c.origins.join('\n');$('#mcp-token').value=c.token;$('#mcp-remote-fields').hidden=!c.remote;status(c.status);loaded=true;}
async function refresh(){try{view(await api.settings());}catch(e){$('#mcp-status').textContent=e.message;}}
$('#mcp-remote').onchange=e=>$('#mcp-remote-fields').hidden=!e.target.checked;
$('#mcp-apply').onclick=async()=>{if(busy)return;busy=true;$('#mcp-apply').disabled=true;try{const s=await api.configure({enabled:$('#mcp-enabled').checked,remote:$('#mcp-remote').checked,port:Number($('#mcp-port').value),publicUrl:$('#mcp-url').value,certPath:$('#mcp-cert').value,keyPath:$('#mcp-key').value,origins:$('#mcp-origins').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean)});status(s);await refresh();}catch(e){$('#mcp-status').textContent=e.message;}finally{busy=false;$('#mcp-apply').disabled=false;}};
$('#mcp-copy').onclick=async()=>{try{await api.copy();$('#mcp-status').textContent='已复制 HTTP 客户端配置示例（含访问令牌，请按客户端格式使用）';}catch(e){$('#mcp-status').textContent=e.message;}};
$('#mcp-rotate').onclick=async()=>{if(busy)return;busy=true;try{await api.rotate();await refresh();$('#mcp-status').textContent+='；旧令牌已失效，请重新复制配置';}catch(e){$('#mcp-status').textContent=e.message;}finally{busy=false;}};
for(const [id,kind,input]of [['mcp-cert-select','cert','mcp-cert'],['mcp-key-select','key','mcp-key']])$('#'+id).onclick=async()=>{try{const p=await api.chooseFile(kind);if(p)$('#'+input).value=p;}catch(e){$('#mcp-status').textContent=e.message;}};
document.addEventListener('click',e=>{if(e.target.closest('#settings-button'))refresh();});window.todo.onSettings(refresh);
setInterval(()=>{if(!$('#settings').hidden&&!busy){if(!loaded)refresh();else api.status().then(status).catch(()=>{});}},2000);
})();
