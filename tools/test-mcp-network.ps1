$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$previous=$env:QJ_REAL_NETWORK
try {
 $env:QJ_REAL_NETWORK='1'
 Push-Location -LiteralPath $root
 try { & node --test test/mcp.test.cjs; if($LASTEXITCODE -ne 0){throw 'MCP TCP/HTTPS acceptance failed'} } finally { Pop-Location }
} finally {
 if($null -eq $previous){Remove-Item Env:QJ_REAL_NETWORK -ErrorAction SilentlyContinue}else{$env:QJ_REAL_NETWORK=$previous}
}
