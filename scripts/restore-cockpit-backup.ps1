param(
  [Parameter(Mandatory = $true)][string]$BackupDir,
  [string]$InstallDir = (Join-Path $env:LOCALAPPDATA "Cockpit Tools"),
  [string]$StatusPath = (Join-Path $env:LOCALAPPDATA "Cockpit Tools\codex-patch-recovery-status.json")
)

$ErrorActionPreference = "Stop"
$mainName = "cockpit-tools.exe"
$sidecarName = "cockpit-cliproxy.exe"
$mainPath = Join-Path $InstallDir $mainName
$sidecarPath = Join-Path $InstallDir $sidecarName
$backupMain = Join-Path $BackupDir $mainName
$backupSidecar = Join-Path $BackupDir $sidecarName

function Write-Status([string]$Phase, [string]$Message) {
  [ordered]@{
    phase = $Phase
    message = $Message
    updatedAt = (Get-Date).ToString("o")
  } | ConvertTo-Json | Set-Content -LiteralPath $StatusPath -Encoding UTF8
}

function Get-InstalledProcesses {
  $paths = @($mainPath.ToLowerInvariant(), $sidecarPath.ToLowerInvariant())
  @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    $_.ExecutablePath -and $paths -contains $_.ExecutablePath.ToLowerInvariant()
  })
}

try {
  if (-not (Test-Path -LiteralPath $backupMain) -or -not (Test-Path -LiteralPath $backupSidecar)) {
    throw "Backup binaries are missing"
  }
  Write-Status "restoring" "Restoring the known-good Cockpit Tools binaries"

  foreach ($item in @(Get-InstalledProcesses)) {
    Stop-Process -Id ([int]$item.ProcessId) -Force -ErrorAction SilentlyContinue
  }
  $deadline = [DateTime]::UtcNow.AddSeconds(15)
  while (@(Get-InstalledProcesses).Count -gt 0 -and [DateTime]::UtcNow -lt $deadline) {
    Start-Sleep -Milliseconds 250
  }
  if (@(Get-InstalledProcesses).Count -gt 0) { throw "Cockpit Tools processes did not stop" }

  Copy-Item -LiteralPath $backupMain -Destination $mainPath -Force
  Copy-Item -LiteralPath $backupSidecar -Destination $sidecarPath -Force
  if ((Get-FileHash -LiteralPath $mainPath -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $backupMain -Algorithm SHA256).Hash) {
    throw "Main executable restore hash mismatch"
  }
  if ((Get-FileHash -LiteralPath $sidecarPath -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $backupSidecar -Algorithm SHA256).Hash) {
    throw "Sidecar restore hash mismatch"
  }

  $started = Start-Process -FilePath $mainPath -WorkingDirectory $InstallDir -PassThru
  $deadline = [DateTime]::UtcNow.AddSeconds(60)
  $main = $null
  while ([DateTime]::UtcNow -lt $deadline) {
    Start-Sleep -Milliseconds 500
    $main = @(Get-InstalledProcesses | Where-Object { $_.ExecutablePath.ToLowerInvariant() -eq $mainPath.ToLowerInvariant() }) | Select-Object -First 1
    if ($main) {
      $process = Get-Process -Id ([int]$main.ProcessId) -ErrorAction SilentlyContinue
      if ($process -and $process.Responding -and $process.MainWindowHandle -ne 0) { break }
    }
    if ($started.HasExited -and -not $main) { break }
  }
  if (-not $main) { throw "Known-good Cockpit Tools did not restart"
  }
  Write-Status "restored" "Known-good Cockpit Tools was restored and restarted"
  exit 0
} catch {
  Write-Status "failed" $_.Exception.Message
  exit 1
}
