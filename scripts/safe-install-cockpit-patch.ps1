param(
  [string]$InstallDir = (Join-Path $env:LOCALAPPDATA "Cockpit Tools"),
  [string]$BuildDir = "",
  [string]$RollbackRoot = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($BuildDir)) {
  $BuildDir = Join-Path $PSScriptRoot "..\target\release"
}
$BuildDir = [IO.Path]::GetFullPath($BuildDir)
$InstallDir = [IO.Path]::GetFullPath($InstallDir)
if ([string]::IsNullOrWhiteSpace($RollbackRoot)) {
  $RollbackRoot = Join-Path (Join-Path $env:LOCALAPPDATA "Cockpit Tools\update-backups") ("installed-binaries-transaction-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
}
$RollbackRoot = [IO.Path]::GetFullPath($RollbackRoot)
$OriginalDir = Join-Path $RollbackRoot "original"
$StageDir = Join-Path $RollbackRoot "stage"

$MainName = "cockpit-tools.exe"
$SidecarName = "cockpit-cliproxy.exe"
$MainPath = Join-Path $InstallDir $MainName
$SidecarPath = Join-Path $InstallDir $SidecarName
$BuildMain = Join-Path $BuildDir $MainName
$BuildSidecar = Join-Path $BuildDir $SidecarName

function Get-Sha256([string]$Path) {
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToUpperInvariant()
}

function Get-CockpitProcesses {
  $paths = @($MainPath.ToLowerInvariant(), $SidecarPath.ToLowerInvariant())
  @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    $_.ExecutablePath -and $paths -contains $_.ExecutablePath.ToLowerInvariant()
  })
}

function Stop-CockpitProcesses {
  $main = @(Get-CockpitProcesses | Where-Object { $_.ExecutablePath.ToLowerInvariant() -eq $MainPath.ToLowerInvariant() })
  foreach ($item in $main) {
    try {
      $p = Get-Process -Id ([int]$item.ProcessId) -ErrorAction SilentlyContinue
      if ($p -and $p.MainWindowHandle -ne 0) { [void]$p.CloseMainWindow() }
    } catch {}
  }
  $deadline = [DateTime]::UtcNow.AddSeconds(12)
  do {
    $live = @(Get-CockpitProcesses)
    if ($live.Count -eq 0) { return }
    Start-Sleep -Milliseconds 250
  } while ([DateTime]::UtcNow -lt $deadline)

  foreach ($item in @(Get-CockpitProcesses)) {
    try { Stop-Process -Id ([int]$item.ProcessId) -Force -ErrorAction SilentlyContinue } catch {}
  }
  $deadline = [DateTime]::UtcNow.AddSeconds(12)
  while ([DateTime]::UtcNow -lt $deadline -and @(Get-CockpitProcesses).Count -gt 0) {
    Start-Sleep -Milliseconds 250
  }
  if (@(Get-CockpitProcesses).Count -gt 0) {
    throw "无法停止 Cockpit Tools 进程，文件仍被占用"
  }
}

function Wait-ApiPortReleased([int]$Port = 54392) {
  $deadline = [DateTime]::UtcNow.AddSeconds(15)
  while ([DateTime]::UtcNow -lt $deadline) {
    $listener = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
    if ($listener.Count -eq 0) { return }
    Start-Sleep -Milliseconds 250
  }
  throw "API 端口 $Port 未释放"
}

function Start-CockpitAndValidate {
  $started = Start-Process -FilePath $MainPath -WorkingDirectory $InstallDir -PassThru
  $deadline = [DateTime]::UtcNow.AddSeconds(60)
  $main = $null
  $listener = $null
  while ([DateTime]::UtcNow -lt $deadline) {
    Start-Sleep -Milliseconds 500
    $main = @(Get-CockpitProcesses | Where-Object { $_.ExecutablePath.ToLowerInvariant() -eq $MainPath.ToLowerInvariant() }) | Select-Object -First 1
    if ($main) {
      $listener = @(Get-NetTCPConnection -LocalPort 54392 -State Listen -ErrorAction SilentlyContinue) | Select-Object -First 1
      if ($listener) {
        try {
          $p = Get-Process -Id ([int]$main.ProcessId) -ErrorAction Stop
          if ($p.Responding -and $p.MainWindowHandle -ne 0) { break }
        } catch {}
      }
    }
    if ($started.HasExited -and -not $main) { break }
  }
  if (-not $main) { throw "主程序启动后立即退出或未出现" }
  if (-not $listener) { throw "sidecar 未在 54392 端口监听" }
  $p = Get-Process -Id ([int]$main.ProcessId) -ErrorAction Stop
  if (-not $p.Responding -or $p.MainWindowHandle -eq 0) { throw "主窗口未正常响应" }

  $configPath = Join-Path $env:USERPROFILE ".antigravity_cockpit\codex_local_access.json"
  $cfg = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
  if ($cfg.enabled -eq $true) {
    $key = [string]$cfg.apiKey
    if ([string]::IsNullOrWhiteSpace($key)) { throw "API 服务启用但没有 API key" }
    $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:54392/v1/models" -Headers @{ Authorization = "Bearer $key" } -TimeoutSec 15
    if ([int]$response.StatusCode -ne 200) { throw "API /v1/models 返回 HTTP $($response.StatusCode)" }
    $models = @((($response.Content | ConvertFrom-Json).data | ForEach-Object { [string]$_.id }))
    if ($models -notcontains "gpt-image-2") { throw "API 模型列表缺少 gpt-image-2" }
    if (@($models | Where-Object { $_ -match "wm" }).Count -gt 0) { throw "API 模型列表仍暴露 WM 模型" }
  }

  $accountsPath = Join-Path $env:USERPROFILE ".antigravity_cockpit\codex_local_access.json"
  $accountCount = @($cfg.accountIds).Count
  if ($accountCount -lt 1) { throw "API 服务账号池为空" }
  return [pscustomobject]@{
    MainPid = [int]$main.ProcessId
    SidecarPid = [int]$listener.OwningProcess
    AccountCount = $accountCount
  }
}

if (-not (Test-Path -LiteralPath $BuildMain) -or -not (Test-Path -LiteralPath $BuildSidecar)) {
  throw "找不到构建产物: $BuildDir"
}
if (-not (Test-Path -LiteralPath $MainPath) -or -not (Test-Path -LiteralPath $SidecarPath)) {
  throw "找不到安装文件: $InstallDir"
}

New-Item -ItemType Directory -Path $OriginalDir,$StageDir -Force | Out-Null
Copy-Item -LiteralPath $MainPath -Destination (Join-Path $OriginalDir $MainName) -Force
Copy-Item -LiteralPath $SidecarPath -Destination (Join-Path $OriginalDir $SidecarName) -Force
$oldMainHash = Get-Sha256 $MainPath
$oldSideHash = Get-Sha256 $SidecarPath
$newMainHash = Get-Sha256 $BuildMain
$newSideHash = Get-Sha256 $BuildSidecar
Write-Output "原版已备份: $RollbackRoot"
Write-Output "目标哈希: main=$newMainHash sidecar=$newSideHash"

$success = $false
try {
  Stop-CockpitProcesses
  Wait-ApiPortReleased

  $stagedMain = Join-Path $StageDir $MainName
  $stagedSide = Join-Path $StageDir $SidecarName
  Copy-Item -LiteralPath $BuildMain -Destination $stagedMain -Force
  Copy-Item -LiteralPath $BuildSidecar -Destination $stagedSide -Force
  if ((Get-Sha256 $stagedMain) -ne $newMainHash -or (Get-Sha256 $stagedSide) -ne $newSideHash) {
    throw "暂存文件哈希校验失败"
  }

  # File.Replace performs a single-file atomic replacement while retaining a
  # second independent copy in $OriginalDir for deterministic rollback.
  [IO.File]::Replace($stagedMain, $MainPath, (Join-Path $RollbackRoot "replaced-main.exe"), $true)
  [IO.File]::Replace($stagedSide, $SidecarPath, (Join-Path $RollbackRoot "replaced-sidecar.exe"), $true)

  $result = Start-CockpitAndValidate
  if ((Get-Sha256 $MainPath) -ne $newMainHash -or (Get-Sha256 $SidecarPath) -ne $newSideHash) {
    throw "启动后安装文件哈希不匹配"
  }
  $success = $true
  Write-Output "补丁启动验证成功: mainPid=$($result.MainPid) sidecarPid=$($result.SidecarPid) accounts=$($result.AccountCount)"
} catch {
  $failure = $_.Exception.Message
  Write-Warning "补丁启动验证失败，开始恢复原版: $failure"
  try { Stop-CockpitProcesses } catch {}
  try { Wait-ApiPortReleased } catch {}
  Copy-Item -LiteralPath (Join-Path $OriginalDir $MainName) -Destination $MainPath -Force
  Copy-Item -LiteralPath (Join-Path $OriginalDir $SidecarName) -Destination $SidecarPath -Force
  try {
    $rollbackResult = Start-CockpitAndValidate
    Write-Output "原版已恢复并验证: mainPid=$($rollbackResult.MainPid) sidecarPid=$($rollbackResult.SidecarPid)"
  } catch {
    throw "补丁失败且原版恢复验证失败: $failure; $($_.Exception.Message)"
  }
  throw "补丁未安装，已自动恢复原版: $failure"
} finally {
  if ($success) {
    Remove-Item -LiteralPath $StageDir -Recurse -Force -ErrorAction SilentlyContinue
  }
}
