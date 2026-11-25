param([switch]$ClaudeOnly, [string]$Workspace = '')
$ErrorActionPreference = 'Stop'
if (-not $Workspace) { $Workspace = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..')) }
$taskRoot = (Resolve-Path -LiteralPath $Workspace).Path
$taskBackups = Join-Path $taskRoot 'logs/ai-sessions/.state/backups'
New-Item -ItemType Directory -Path $taskBackups -Force | Out-Null
function Save-Config([string]$Target, $Value) {
  $taskResolved = [System.IO.Path]::GetFullPath($Target)
  if (-not $taskResolved.StartsWith($taskRoot + [System.IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Hook target is outside this workspace' }
  [System.IO.File]::WriteAllText($taskResolved, ($Value | ConvertTo-Json -Depth 100), (New-Object Text.UTF8Encoding($false)))
}
function Backup-Config([string]$File, [string]$Name) {
  $taskBackup = Join-Path $taskBackups $Name
  if ((Test-Path -LiteralPath $File) -and -not (Test-Path -LiteralPath $taskBackup)) { Copy-Item -LiteralPath $File -Destination $taskBackup }
}
$taskHookFile = Join-Path $taskRoot 'scripts/ai-sessions/hook.cjs'
$taskCommand = 'node "' + $taskHookFile.Replace('\', '/') + '" --provider claude --workspace "' + $taskRoot.Replace('\', '/') + '"'
$taskClaudeDir = Join-Path $taskRoot '.claude'
New-Item -ItemType Directory -Path $taskClaudeDir -Force | Out-Null
$taskClaudeFile = Join-Path $taskClaudeDir 'settings.json'
Backup-Config $taskClaudeFile 'claude-settings.json'
$taskClaude = if (Test-Path -LiteralPath $taskClaudeFile) { Get-Content -LiteralPath $taskClaudeFile -Raw -Encoding UTF8 | ConvertFrom-Json } else { [PSCustomObject]@{} }
if (-not $taskClaude.PSObject.Properties['hooks']) { $taskClaude | Add-Member -NotePropertyName hooks -NotePropertyValue ([PSCustomObject]@{}) }
foreach ($taskEvent in @('PostToolUse', 'Stop')) {
  $taskEntries = if ($taskClaude.hooks.PSObject.Properties[$taskEvent]) { @($taskClaude.hooks.$taskEvent) } else { @() }
  $taskPresent = $false
  foreach ($taskEntry in $taskEntries) { foreach ($taskHandler in $taskEntry.hooks) { if ($taskHandler.command -eq $taskCommand) { $taskPresent = $true } } }
  if (-not $taskPresent) {
    $taskEntries += [PSCustomObject]@{ matcher = '*'; hooks = @([PSCustomObject]@{ type = 'command'; command = $taskCommand; timeout = 15 }) }
    $taskClaude.hooks | Add-Member -NotePropertyName $taskEvent -NotePropertyValue $taskEntries -Force
  }
}
Save-Config $taskClaudeFile $taskClaude
if ($ClaudeOnly) { return }
$taskAntigravityFile = Join-Path $taskRoot '.agents/hooks.json'
$taskLegacyFile = Join-Path $taskRoot '.agents/scripts/log-ai-session.cjs'
Backup-Config $taskAntigravityFile 'antigravity-hooks.json'
Backup-Config $taskLegacyFile 'legacy-log-ai-session.cjs'
$taskAntigravity = Get-Content -LiteralPath $taskAntigravityFile -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $taskAntigravity.PSObject.Properties['ai-session-logger']) { throw 'Expected AI session logger hook is missing' }
$taskLogger = $taskAntigravity.'ai-session-logger'
if (-not $taskLogger.PSObject.Properties['PostToolUse']) {
  $taskLogger | Add-Member -NotePropertyName PostToolUse -NotePropertyValue @([PSCustomObject]@{
    matcher = '*'; hooks = @([PSCustomObject]@{ type = 'command'; command = 'node scripts/log-ai-session.cjs'; timeout = 15 })
  })
}
Save-Config $taskAntigravityFile $taskAntigravity
$taskResolvedLegacy = [System.IO.Path]::GetFullPath($taskLegacyFile)
if (-not $taskResolvedLegacy.StartsWith($taskRoot + [System.IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Legacy hook is outside this workspace' }
$taskShim = "// Delegate to the shared logger; preserve the existing hook command." + [Environment]::NewLine + "require('../../scripts/ai-sessions/hook.cjs');" + [Environment]::NewLine
[System.IO.File]::WriteAllText($taskResolvedLegacy, $taskShim, (New-Object Text.UTF8Encoding($false)))