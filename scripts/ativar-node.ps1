# Execute na raiz: . .\scripts\ativar-node.ps1
$nodeDirectory = Join-Path $PSScriptRoot '..\.tools\node-v24.22.2-win-x64'
if (-not (Test-Path (Join-Path $nodeDirectory 'node.exe'))) {
  throw 'Node portátil não encontrado. Instale Node.js LTS ou prepare .tools.'
}
$env:Path = (Resolve-Path $nodeDirectory).Path + ';' + $env:Path
Write-Output 'Node portátil ativado neste terminal. Use npm.cmd para executar comandos npm.'
