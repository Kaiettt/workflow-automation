$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'install-hooks.ps1')
& (Join-Path $PSScriptRoot 'manage.ps1') -Install