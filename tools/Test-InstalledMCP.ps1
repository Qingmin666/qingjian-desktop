param([string]$AppDir='',[switch]$WriteTest)
$ErrorActionPreference='Stop'
$report=@{success=$false;checks=@();cleanup=$true}
$script:session=$null
$script:seq=0
$id=$null
$marker='MCP-self-test-'+[guid]::NewGuid().ToString()
function Rpc($method,$parameters){
 $script:seq++
 $h=@{Authorization=('Bearer '+$config.token);Accept='application/json, text/event-stream';'MCP-Protocol-Version'='2025-11-25'}
 if($script:session){$h['MCP-Session-Id']=$script:session}
 $b=@{jsonrpc='2.0';id=$script:seq;method=$method;params=$parameters}|ConvertTo-Json -Depth 25 -Compress
 $r=Invoke-WebRequest -UseBasicParsing -Uri $endpoint -Method Post -Headers $h -ContentType 'application/json' -Body ([Text.Encoding]::UTF8.GetBytes($b)) -TimeoutSec 12
 if($r.Headers['MCP-Session-Id']){$script:session=[string]$r.Headers['MCP-Session-Id']}
 $v=$r.Content|ConvertFrom-Json
 if($v.error){throw 'RPC_ERROR'}
 return $v.result
}
function Tool($name,$arguments){
 $r=Rpc 'tools/call' @{name=$name;arguments=$arguments}
 if($r.isError){throw 'TOOL_ERROR'}
 return $r.structuredContent
}
function Mutate($name,$arguments){
 $arguments.requestId=[guid]::NewGuid().ToString()
 $arguments.expectedRevision=(Tool 'qingjian_info' @{}).revision
 return Tool $name $arguments
}
try{
 if(!$AppDir){throw 'APPDIR_REQUIRED'}
 $config=Get-Content -Raw -LiteralPath (Join-Path $AppDir 'data\mcp-config.json')|ConvertFrom-Json
 if(!$config.enabled -or !$config.token){throw 'NOT_ENABLED'}
 $endpoint=if($config.remote){$config.publicUrl}else{'http://127.0.0.1:'+$config.port+'/mcp'}
 $null=Rpc 'initialize' @{protocolVersion='2025-11-25';capabilities=@{};clientInfo=@{name='qingjian-acceptance';version='1.0'}}
 $h=@{Authorization=('Bearer '+$config.token);Accept='application/json, text/event-stream';'MCP-Protocol-Version'='2025-11-25';'MCP-Session-Id'=$script:session}
 $null=Invoke-WebRequest -UseBasicParsing -Uri $endpoint -Method Post -Headers $h -ContentType 'application/json' -Body '{"jsonrpc":"2.0","method":"notifications/initialized"}' -TimeoutSec 12
 $report.checks+='initialize'
 if(@((Rpc 'tools/list' @{}).tools).Count -ne 10){throw 'TOOL_COUNT'}
 $report.checks+='tools/list:10'
 $null=Tool 'qingjian_info' @{}
 $report.checks+='qingjian_info'
 if($WriteTest){
  $id=(Mutate 'qingjian_add_task' @{title=$marker}).task.id
  $null=Mutate 'qingjian_update_task' @{id=$id;title=($marker+'-updated')}
  $null=Mutate 'qingjian_set_completed' @{id=$id;done=$true}
  $report.checks+='create/update/complete'
 }
 $report.success=$true
}catch{$report.error='Connection or protocol check failed. Verify MCP is enabled and app is running.'}
finally{
 if($id){
  try{
   $own=Tool 'qingjian_get_task' @{id=$id}
   if(!$own.task.title.StartsWith($marker) -or @($own.children).Count -gt 0){throw 'CHANGED'}
   $null=Mutate 'qingjian_delete_task' @{id=$id}
   $report.checks+='delete-own-test-task'
  }catch{$report.success=$false;$report.cleanup=$false;$report.remainingTestTaskId=$id}
 }
 $report.timestamp=[DateTime]::UtcNow.ToString('o')
 $out=Join-Path $PSScriptRoot 'QingJian-MCP-result.json'
 $report|ConvertTo-Json -Depth 10|Set-Content -Encoding UTF8 -LiteralPath $out
}
if($report.success){Write-Host 'PASS'}else{Write-Host 'FAIL'}
Write-Host ('Report: '+$out)
if(!$report.success){exit 1}
