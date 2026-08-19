param(
  [string]$InstallDir = (Join-Path $env:LOCALAPPDATA "Cockpit Tools"),
  [string]$BuildDir = "",
  [string]$RollbackRoot = "",
  [string]$StatusPath = (Join-Path $env:LOCALAPPDATA "Cockpit Tools\codex-patch-update-status.json"),
  [string]$LogPath = (Join-Path $env:LOCALAPPDATA "Cockpit Tools\codex-patch-update.log"),
  [int]$InitialDelaySeconds = 6
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
$StatusPath = [IO.Path]::GetFullPath($StatusPath)
$LogPath = [IO.Path]::GetFullPath($LogPath)
$OriginalDir = Join-Path $RollbackRoot "original"
$StageDir = Join-Path $RollbackRoot "stage"

$MainName = "cockpit-tools.exe"
$SidecarName = "cockpit-cliproxy.exe"
$MainPath = Join-Path $InstallDir $MainName
$SidecarPath = Join-Path $InstallDir $SidecarName
$BuildMain = Join-Path $BuildDir $MainName
$BuildSidecar = Join-Path $BuildDir $SidecarName
$script:NewMainHash = ""
$script:NewSideHash = ""

function Write-UpdateLog([string]$Level, [string]$Message) {
  $parent = Split-Path -Parent $LogPath
  if ($parent) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
  $line = "$(Get-Date -Format o) [$Level] $Message"
  Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8
}

function Write-UpdateStatus(
  [string]$Phase,
  [string]$Message,
  [Nullable[int]]$MainPid = $null,
  [Nullable[int]]$SidecarPid = $null,
  [Nullable[int]]$AccountCount = $null
) {
  $parent = Split-Path -Parent $StatusPath
  if ($parent) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
  $payload = [ordered]@{
    phase = $Phase
    message = $Message
    updatedAt = (Get-Date).ToString("o")
    rollbackRoot = $RollbackRoot
    mainPid = $MainPid
    sidecarPid = $SidecarPid
    accountCount = $AccountCount
    newMainSha256 = $script:NewMainHash
    newSidecarSha256 = $script:NewSideHash
  }
  $temporary = "$StatusPath.tmp"
  $payload | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $temporary -Encoding UTF8
  Move-Item -LiteralPath $temporary -Destination $StatusPath -Force
  Write-UpdateLog "INFO" "$Phase - $Message"
}

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
      $process = Get-Process -Id ([int]$item.ProcessId) -ErrorAction SilentlyContinue
      if ($process -and $process.MainWindowHandle -ne 0) { [void]$process.CloseMainWindow() }
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

function Test-AuthenticatedModels([string]$ApiKey) {
  $deadline = [DateTime]::UtcNow.AddSeconds(35)
  $lastFailure = "接口尚未响应"
  while ([DateTime]::UtcNow -lt $deadline) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:54392/v1/models" -Headers @{ Authorization = "Bearer $ApiKey" } -TimeoutSec 10
      if ([int]$response.StatusCode -eq 200) {
        $models = @((($response.Content | ConvertFrom-Json).data | ForEach-Object { [string]$_.id }))
        if ($models -notcontains "gpt-image-2") { throw "API 模型列表缺少 gpt-image-2" }
        if (@($models | Where-Object { $_ -match "wm" }).Count -gt 0) { throw "API 模型列表仍暴露 WM 模型" }
        return
      }
      $lastFailure = "HTTP $($response.StatusCode)"
    } catch {
      $lastFailure = $_.Exception.Message
    }
    Start-Sleep -Milliseconds 750
  }
  throw "API /v1/models 验证超时: $lastFailure"
}

function Initialize-UiAutomation {
  # PowerShell 7 does not preload the desktop UI Automation assemblies.
  # Load both explicitly so the detached updater can inspect WebView2 content.
  if (-not ("System.Windows.Automation.AutomationElement" -as [type])) {
    Add-Type -AssemblyName UIAutomationClient -ErrorAction Stop
    Add-Type -AssemblyName UIAutomationTypes -ErrorAction Stop
  }
}

function Add-FrontendFailureMarkers([AllowEmptyString()][string]$Text, [hashtable]$Markers) {
  if ([string]::IsNullOrWhiteSpace($Text)) { return }

  $value = $Text.ToLowerInvariant()
  if ($value.Contains("err_connection_refused")) {
    $Markers.ConnectionRefusedCode = $true
  }
  if ($value.Contains("localhost") -or $value.Contains("127.0.0.1")) {
    $Markers.LocalAddress = $true
  }
  if (
    $value.Contains("拒绝连接") -or
    $value.Contains("拒絕連線") -or
    $value.Contains("refused to connect") -or
    $value.Contains("connection refused")
  ) {
    $Markers.RefusalMessage = $true
  }
  if (
    $value.Contains("无法访问此页面") -or
    $value.Contains("無法連上這個頁面") -or
    $value.Contains("无法连接到此页面") -or
    $value.Contains("can't reach this page") -or
    $value.Contains("cannot reach this page") -or
    $value.Contains("site can't be reached") -or
    $value.Contains("site cannot be reached")
  ) {
    $Markers.ErrorPageTitle = $true
  }
}

function Get-CockpitFrontendSnapshot([int]$MainPid) {
  Initialize-UiAutomation

  $process = Get-Process -Id $MainPid -ErrorAction Stop
  if ($process.MainWindowHandle -eq 0) {
    return [pscustomobject]@{
      Inspectable = $false
      DescendantCount = 0
      ErrorDetected = $false
      Reason = "window-not-ready"
    }
  }

  $root = [System.Windows.Automation.AutomationElement]::FromHandle($process.MainWindowHandle)
  if ($null -eq $root) {
    return [pscustomobject]@{
      Inspectable = $false
      DescendantCount = 0
      ErrorDetected = $false
      Reason = "automation-root-unavailable"
    }
  }

  $markers = @{
    ConnectionRefusedCode = $false
    LocalAddress = $false
    RefusalMessage = $false
    ErrorPageTitle = $false
  }
  $elements = $root.FindAll(
    [System.Windows.Automation.TreeScope]::Descendants,
    [System.Windows.Automation.Condition]::TrueCondition
  )

  # Never retain or log UI text. Only four non-sensitive boolean markers leave
  # this loop, so account names and other page contents cannot leak to logs.
  $items = @($root)
  foreach ($element in $elements) { $items += $element }
  foreach ($element in $items) {
    try {
      Add-FrontendFailureMarkers ([string]$element.Current.Name) $markers
      Add-FrontendFailureMarkers ([string]$element.Current.HelpText) $markers

      $pattern = $null
      if ($element.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$pattern)) {
        Add-FrontendFailureMarkers ([string]([System.Windows.Automation.ValuePattern]$pattern).Current.Value) $markers
      }

      $pattern = $null
      if ($element.TryGetCurrentPattern([System.Windows.Automation.TextPattern]::Pattern, [ref]$pattern)) {
        # WebView2 often exposes the whole browser error document only through
        # TextPattern. A bounded read avoids pulling an unbounded page into memory.
        Add-FrontendFailureMarkers ([string]([System.Windows.Automation.TextPattern]$pattern).DocumentRange.GetText(16384)) $markers
      }
    } catch {
      # WebView2 can replace nodes while navigating, and a provider can reject
      # an optional pattern on one child. Other nodes still contain the browser
      # error markers, so skip only that stale/inaccessible child.
    }
  }

  $errorDetected =
    $markers.ConnectionRefusedCode -or
    ($markers.LocalAddress -and $markers.RefusalMessage) -or
    ($markers.LocalAddress -and $markers.ErrorPageTitle)
  $reason = if ($markers.ConnectionRefusedCode) {
    "webview-err-connection-refused"
  } elseif ($errorDetected) {
    "webview-localhost-refused"
  } else {
    "healthy"
  }

  return [pscustomobject]@{
    Inspectable = $true
    DescendantCount = [int]$elements.Count
    ErrorDetected = [bool]$errorDetected
    Reason = $reason
  }
}

function Assert-CockpitFrontendHealthy([int]$MainPid, [int]$TimeoutSeconds = 15) {
  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
  $healthySamples = 0
  $lastFailure = "窗口尚未就绪"

  while ([DateTime]::UtcNow -lt $deadline) {
    $snapshot = $null
    try {
      $snapshot = Get-CockpitFrontendSnapshot $MainPid
    } catch [System.Windows.Automation.ElementNotAvailableException] {
      $lastFailure = "前端正在重新加载"
    } catch {
      # Keep the logged error generic: UI Automation exception details can
      # include window text supplied by the inspected application.
      $lastFailure = "无法读取前端窗口"
    }

    if ($snapshot) {
      if ($snapshot.ErrorDetected) {
        throw "前端 WebView2 显示 localhost 连接失败页"
      }
      if ($snapshot.Inspectable -and $snapshot.DescendantCount -gt 0) {
        $healthySamples++
        # Require several consecutive samples so the updater cannot accept the
        # short blank interval before WebView2 finishes navigating to an error.
        if ($healthySamples -ge 8) { return }
      } else {
        $healthySamples = 0
        $lastFailure = "前端内容尚未出现"
      }
    } else {
      $healthySamples = 0
    }
    Start-Sleep -Milliseconds 500
  }

  throw "前端 UI Automation 验证超时: $lastFailure"
}

function Start-CockpitAndValidate {
  $started = Start-Process -FilePath $MainPath -WorkingDirectory $InstallDir -PassThru
  $deadline = [DateTime]::UtcNow.AddSeconds(60)
  $main = $null
  $sidecar = $null
  $listener = $null
  while ([DateTime]::UtcNow -lt $deadline) {
    Start-Sleep -Milliseconds 500
    $main = @(Get-CockpitProcesses | Where-Object { $_.ExecutablePath.ToLowerInvariant() -eq $MainPath.ToLowerInvariant() }) | Select-Object -First 1
    $sidecar = @(Get-CockpitProcesses | Where-Object { $_.ExecutablePath.ToLowerInvariant() -eq $SidecarPath.ToLowerInvariant() }) | Select-Object -First 1
    if ($main -and $sidecar) {
      $listener = @(Get-NetTCPConnection -LocalPort 54392 -State Listen -ErrorAction SilentlyContinue | Where-Object { [int]$_.OwningProcess -eq [int]$sidecar.ProcessId }) | Select-Object -First 1
      if ($listener) {
        try {
          $process = Get-Process -Id ([int]$main.ProcessId) -ErrorAction Stop
          if ($process.Responding -and $process.MainWindowHandle -ne 0) { break }
        } catch {}
      }
    }
    if ($started.HasExited -and -not $main) { break }
  }
  if (-not $main) { throw "主程序启动后立即退出或未出现" }
  if (-not $sidecar -or -not $listener) { throw "sidecar 未在 54392 端口监听" }
  $process = Get-Process -Id ([int]$main.ProcessId) -ErrorAction Stop
  if (-not $process.Responding -or $process.MainWindowHandle -eq 0) { throw "主窗口未正常响应" }

  $configPath = Join-Path $env:USERPROFILE ".antigravity_cockpit\codex_local_access.json"
  $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
  if ($config.enabled -eq $true) {
    $apiKey = [string]$config.apiKey
    if ([string]::IsNullOrWhiteSpace($apiKey)) { throw "API 服务启用但没有 API key" }
    Test-AuthenticatedModels $apiKey
  }
  Assert-CockpitFrontendHealthy ([int]$main.ProcessId)
  $accountCount = @($config.accountIds).Count
  if ($accountCount -lt 1) { throw "API 服务账号池为空" }
  return [pscustomobject]@{
    MainPid = [int]$main.ProcessId
    SidecarPid = [int]$sidecar.ProcessId
    AccountCount = $accountCount
  }
}

try {
  Write-UpdateStatus "preflight" "正在核对增强版文件"
  if (-not (Test-Path -LiteralPath $BuildMain) -or -not (Test-Path -LiteralPath $BuildSidecar)) {
    throw "找不到构建产物: $BuildDir"
  }
  if (-not (Test-Path -LiteralPath $MainPath) -or -not (Test-Path -LiteralPath $SidecarPath)) {
    throw "找不到安装文件: $InstallDir"
  }

  New-Item -ItemType Directory -Path $OriginalDir,$StageDir -Force | Out-Null
  $oldMainHash = Get-Sha256 $MainPath
  $oldSideHash = Get-Sha256 $SidecarPath
  $script:NewMainHash = Get-Sha256 $BuildMain
  $script:NewSideHash = Get-Sha256 $BuildSidecar
  if ($oldMainHash -eq $script:NewMainHash -and $oldSideHash -eq $script:NewSideHash) {
    Write-UpdateStatus "already-installed" "增强版已经安装，无需重复替换"
    exit 0
  }

  Copy-Item -LiteralPath $MainPath -Destination (Join-Path $OriginalDir $MainName) -Force
  Copy-Item -LiteralPath $SidecarPath -Destination (Join-Path $OriginalDir $SidecarName) -Force
  if ((Get-Sha256 (Join-Path $OriginalDir $MainName)) -ne $oldMainHash -or (Get-Sha256 (Join-Path $OriginalDir $SidecarName)) -ne $oldSideHash) {
    throw "原版备份哈希校验失败"
  }

  $stagedMain = Join-Path $StageDir $MainName
  $stagedSide = Join-Path $StageDir $SidecarName
  Copy-Item -LiteralPath $BuildMain -Destination $stagedMain -Force
  Copy-Item -LiteralPath $BuildSidecar -Destination $stagedSide -Force
  if ((Get-Sha256 $stagedMain) -ne $script:NewMainHash -or (Get-Sha256 $stagedSide) -ne $script:NewSideHash) {
    throw "增强版暂存文件哈希校验失败"
  }

  Write-UpdateStatus "ready" "文件和回滚备份已就绪，等待自动重启"
  if ($InitialDelaySeconds -gt 0) { Start-Sleep -Seconds $InitialDelaySeconds }

  $replacementStarted = $false
  try {
    $replacementStarted = $true
    Write-UpdateStatus "restarting" "正在关闭旧版并替换文件"
    Stop-CockpitProcesses
    Wait-ApiPortReleased

    [IO.File]::Replace($stagedMain, $MainPath, (Join-Path $RollbackRoot "replaced-main.exe"), $true)
    [IO.File]::Replace($stagedSide, $SidecarPath, (Join-Path $RollbackRoot "replaced-sidecar.exe"), $true)

    Write-UpdateStatus "validating" "增强版已替换，正在启动并验证"
    $result = Start-CockpitAndValidate
    if ((Get-Sha256 $MainPath) -ne $script:NewMainHash -or (Get-Sha256 $SidecarPath) -ne $script:NewSideHash) {
      throw "启动后安装文件哈希不匹配"
    }

    Remove-Item -LiteralPath $StageDir -Recurse -Force -ErrorAction SilentlyContinue
    Write-UpdateStatus "success" "增强版安装并启动成功" $result.MainPid $result.SidecarPid $result.AccountCount
    exit 0
  } catch {
    $failure = $_.Exception.Message
    Write-UpdateLog "WARN" "增强版验证失败，准备回滚: $failure"
    if (-not $replacementStarted) { throw }
    try { Stop-CockpitProcesses } catch {}
    try { Wait-ApiPortReleased } catch {}
    Copy-Item -LiteralPath (Join-Path $OriginalDir $MainName) -Destination $MainPath -Force
    Copy-Item -LiteralPath (Join-Path $OriginalDir $SidecarName) -Destination $SidecarPath -Force
    $rollbackResult = Start-CockpitAndValidate
    Write-UpdateStatus "rolled-back" "增强版验证失败，原版已自动恢复并启动" $rollbackResult.MainPid $rollbackResult.SidecarPid $rollbackResult.AccountCount
    exit 2
  }
} catch {
  $fatal = $_.Exception.Message
  try { Write-UpdateStatus "failed" "更新器执行失败，未完成替换: $fatal" } catch {}
  exit 1
}
