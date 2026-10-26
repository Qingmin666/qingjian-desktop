param(
 [string]$RuntimeRoot=$env:QINGJIAN_RUNTIME_ROOT,
 [string]$NodeExe='',
 [string]$OutputName='QingJian'
)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
if($OutputName -notmatch '^[a-zA-Z0-9-]+$'){throw 'Invalid output name'}
if(!$RuntimeRoot){throw '请用 -RuntimeRoot 或 QINGJIAN_RUNTIME_ROOT 指定 TodoDuo 1.5.0 Windows x64 运行时目录'}
if(!$NodeExe){$nodeCommand=Get-Command node -ErrorAction SilentlyContinue;if(!$nodeCommand){throw '未找到 Node.js，请将 node 加入 PATH 或用 -NodeExe 指定'};$NodeExe=$nodeCommand.Source}
if(!(Test-Path -LiteralPath $NodeExe -PathType Leaf)){throw '找不到 Node.js 可执行文件'}
$out=Join-Path $root ('dist\'+$OutputName)
if(Test-Path -LiteralPath $out){throw "输出目录已存在，请先另存或重命名该目录：$out"}
if(!(Test-Path -LiteralPath (Join-Path $RuntimeRoot 'TodoDuo.exe'))){throw '找不到已有 Windows x64 运行时'}
New-Item -ItemType Directory -Force -Path $out,(Join-Path $out 'resources'),(Join-Path $root 'artifacts') | Out-Null
# 仅复制运行时与辅助程序，不复制原数据或原 app.asar。
Get-ChildItem -LiteralPath $RuntimeRoot -File | Where-Object {$_.Name -notin @('TodoDuo.exe','MANIFEST.sha256','README.txt')} | ForEach-Object {Copy-Item -LiteralPath $_.FullName -Destination $out}
Copy-Item -LiteralPath (Join-Path $RuntimeRoot 'TodoDuo.exe') -Destination (Join-Path $out 'QingJian.exe')
Copy-Item -LiteralPath (Join-Path $RuntimeRoot 'locales') -Destination (Join-Path $out 'locales') -Recurse
Copy-Item -LiteralPath (Join-Path $RuntimeRoot 'resources\native') -Destination (Join-Path $out 'resources\native') -Recurse
& (Join-Path $PSScriptRoot 'make-icons.ps1') -OutputDir (Join-Path $root 'artifacts')
& (Join-Path $PSScriptRoot 'brand-runtime.ps1') -ExePath (Join-Path $out 'QingJian.exe') -IconPath (Join-Path $root 'artifacts\icon.ico')
& $NodeExe (Join-Path $PSScriptRoot 'pack.cjs') (Join-Path $root 'src') (Join-Path $out 'resources\app.asar') (Join-Path $root 'artifacts')
if($LASTEXITCODE -ne 0){throw 'app.asar 打包失败'}
Copy-Item -LiteralPath (Join-Path $root 'README.md') -Destination (Join-Path $out 'README.md')
Copy-Item -LiteralPath (Join-Path $root 'UPSTREAM-NOTICE.md') -Destination (Join-Path $out 'UPSTREAM-NOTICE.md')
foreach($docName in @('MCP.md','MCP-tools.json','MCP-client.example.json','VALIDATION-MCP.md')) { $docPath=Join-Path $root ('docs\'+$docName); if(Test-Path -LiteralPath $docPath){Copy-Item -LiteralPath $docPath -Destination (Join-Path $out $docName)} }
Get-ChildItem -LiteralPath $out -Recurse -File | ForEach-Object { '{0}  {1}' -f (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLower(),$_.FullName.Substring($out.Length+1) } | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $out 'MANIFEST.sha256')
Write-Host "已生成：$(Join-Path $out 'QingJian.exe')"
