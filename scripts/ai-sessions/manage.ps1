param([switch]$Install, [switch]$Start, [switch]$Run, [switch]$Stop, [switch]$Status, [switch]$Uninstall, [string]$Workspace = '')
$ErrorActionPreference = 'Stop'
if (-not $Workspace) { $Workspace = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..')) }
$taskRoot = (Resolve-Path -LiteralPath $Workspace).Path
$taskNode = (Get-Command node -CommandType Application -ErrorAction Stop).Source
$taskCli = Join-Path $taskRoot 'scripts/ai-sessions/cli.cjs'
$taskState = Join-Path $taskRoot 'logs/ai-sessions/.state'
$taskProfile = [Environment]::GetFolderPath('UserProfile')
$taskDigest = [Security.Cryptography.SHA256]::Create()
try { $taskHash = ([BitConverter]::ToString($taskDigest.ComputeHash([Text.Encoding]::UTF8.GetBytes($taskRoot.ToLowerInvariant())))).Replace('-', '').Substring(0, 12) }
finally { $taskDigest.Dispose() }
$taskName = 'Workflow AI Logs - ' + $taskHash
$taskManageFile = Join-Path $taskRoot 'scripts/ai-sessions/manage.ps1'
function Get-CollectorStatus {
  $taskRawStatus = & $taskNode $taskCli --workspace $taskRoot --status
  if ($LASTEXITCODE -ne 0) { throw 'Unable to read collector status' }
  return ($taskRawStatus | ConvertFrom-Json)
}
function Start-Collector([bool]$Wait) {
  $taskCurrent = Get-CollectorStatus
  if ($taskCurrent.running) { $taskCurrent | ConvertTo-Json -Depth 20; return }
  $taskNodeVersion = & $taskNode --version
  if ($taskNodeVersion -notmatch '^v(\d+)\.' -or [int]$Matches[1] -lt 24) { throw 'AI logging requires Node 24 or newer' }
  New-Item -ItemType Directory -Path $taskState -Force | Out-Null
  $taskArguments = '"' + $taskCli + '" --watch --workspace "' + $taskRoot + '"'
  $taskProcess = Start-Process -FilePath $taskNode -ArgumentList $taskArguments -WorkingDirectory $taskRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskState 'collector.stdout.log') -RedirectStandardError (Join-Path $taskState 'collector.stderr.log')
  if ($Wait) { $taskProcess.WaitForExit(); exit $taskProcess.ExitCode }
  for ($taskAttempt = 0; $taskAttempt -lt 50; $taskAttempt++) {
    Start-Sleep -Milliseconds 100
    $taskCurrent = Get-CollectorStatus
    if ($taskCurrent.running) { $taskCurrent | ConvertTo-Json -Depth 20; return }
    if ($taskProcess.HasExited) { throw 'Collector exited; inspect logs/ai-sessions/.state/collector.stderr.log' }
  }
  throw 'Collector startup timed out; inspect local diagnostics'
}
function Assert-OwnedTask($Candidate) {
  if ($Candidate -and -not ($Candidate.Actions | Where-Object { $_.Arguments -and $_.Arguments.Contains($taskManageFile) })) {
    throw 'An unrelated task uses this name; it will not be replaced'
  }
}
if ($Status) { Get-CollectorStatus | ConvertTo-Json -Depth 20; return }
if ($Stop) { & $taskNode $taskCli --workspace $taskRoot --stop; exit $LASTEXITCODE }
if ($Uninstall) {
  & $taskNode $taskCli --workspace $taskRoot --stop
  $taskExisting = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  Assert-OwnedTask $taskExisting
  if ($taskExisting) { Unregister-ScheduledTask -TaskName $taskName -Confirm:$false }
  return
}
if ($Install) {
  $taskExisting = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  Assert-OwnedTask $taskExisting
  $taskUser = [Security.Principal.WindowsIdentity]::GetCurrent().Name
  $taskPowerShell = Join-Path $env:WINDIR 'System32/WindowsPowerShell/v1.0/powershell.exe'
  $taskArguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $taskManageFile + '" -Run -Workspace "' + $taskRoot + '"'
  $taskAction = New-ScheduledTaskAction -Execute $taskPowerShell -Argument $taskArguments -WorkingDirectory $taskRoot
  $taskTrigger = New-ScheduledTaskTrigger -AtLogOn -User $taskUser
  $taskPrincipal = New-ScheduledTaskPrincipal -UserId $taskUser -LogonType Interactive -RunLevel Limited
  $taskSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
  Register-ScheduledTask -TaskName $taskName -Action $taskAction -Trigger $taskTrigger -Principal $taskPrincipal -Settings $taskSettings -Description ('Local AI session logs for ' + $taskRoot) -Force | Out-Null
  Start-Collector $false
  return
}
Start-Collector ([bool]$Run)