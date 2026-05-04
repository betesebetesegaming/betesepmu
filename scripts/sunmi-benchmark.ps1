param(
    [string]$PackageName = "com.betese.pmu",
    [string]$ActivityName = ".MainActivity",
    [int]$Runs = 5,
    [switch]$ClearData
)

$ErrorActionPreference = "Stop"

function Require-Adb {
    $adb = Get-Command adb -ErrorAction SilentlyContinue
    if (-not $adb) {
        throw "adb command not found. Install Android platform-tools and ensure adb is in PATH."
    }
}

function Get-ConnectedDevices {
    $lines = adb devices | Select-Object -Skip 1
    $devices = @()
    foreach ($line in $lines) {
        if ($line -match "^([A-Za-z0-9:_-]+)\s+device$") {
            $devices += $Matches[1]
        }
    }
    return $devices
}

function Parse-StartTimings {
    param([string[]]$Output)

    $result = [ordered]@{
        ThisTime = $null
        TotalTime = $null
        WaitTime = $null
    }

    foreach ($line in $Output) {
        if ($line -match "^ThisTime:\s+(\d+)") { $result.ThisTime = [int]$Matches[1] }
        if ($line -match "^TotalTime:\s+(\d+)") { $result.TotalTime = [int]$Matches[1] }
        if ($line -match "^WaitTime:\s+(\d+)") { $result.WaitTime = [int]$Matches[1] }
    }

    return [pscustomobject]$result
}

function Get-PssKb {
    param([string]$Pkg)

    $mem = adb shell dumpsys meminfo $Pkg
    foreach ($line in $mem) {
        if ($line -match "^\s*TOTAL\s+(\d+)") {
            return [int]$Matches[1]
        }
    }
    return $null
}

function Average {
    param([int[]]$Values)
    if (-not $Values -or $Values.Count -eq 0) { return $null }
    return [math]::Round(($Values | Measure-Object -Average).Average, 2)
}

Require-Adb

$devices = Get-ConnectedDevices
if ($devices.Count -eq 0) {
    throw "No connected Android device found. Connect Sunmi via USB and run 'adb devices'."
}

if ($devices.Count -gt 1) {
    throw "Multiple devices detected. Keep one device connected for consistent benchmark."
}

$component = "$PackageName/$ActivityName"

Write-Host "Running benchmark"
Write-Host "Package   : $PackageName"
Write-Host "Component : $component"
Write-Host "Runs      : $Runs"
Write-Host ""

if ($ClearData) {
    Write-Host "Clearing app data..."
    adb shell pm clear $PackageName | Out-Null
}

$rows = @()

for ($i = 1; $i -le $Runs; $i++) {
    Write-Host "Run $i/$Runs"
    adb shell am force-stop $PackageName | Out-Null

    $startOut = adb shell am start -W -n $component
    $timings = Parse-StartTimings -Output $startOut
    $pssKb = Get-PssKb -Pkg $PackageName

    $rows += [pscustomobject]@{
        Run = $i
        ThisTimeMs = $timings.ThisTime
        TotalTimeMs = $timings.TotalTime
        WaitTimeMs = $timings.WaitTime
        PssKb = $pssKb
    }

    Start-Sleep -Milliseconds 500
}

$thisVals = $rows | ForEach-Object { $_.ThisTimeMs } | Where-Object { $_ -ne $null }
$totalVals = $rows | ForEach-Object { $_.TotalTimeMs } | Where-Object { $_ -ne $null }
$waitVals = $rows | ForEach-Object { $_.WaitTimeMs } | Where-Object { $_ -ne $null }
$pssVals = $rows | ForEach-Object { $_.PssKb } | Where-Object { $_ -ne $null }

Write-Host ""
Write-Host "Per-run results"
$rows | Format-Table -AutoSize

Write-Host ""
Write-Host "Summary"
Write-Host ("Average ThisTime : {0} ms" -f (Average -Values $thisVals))
Write-Host ("Average TotalTime: {0} ms" -f (Average -Values $totalVals))
Write-Host ("Average WaitTime : {0} ms" -f (Average -Values $waitVals))

if ($pssVals.Count -gt 0) {
    Write-Host ("Average PSS      : {0} KB" -f (Average -Values $pssVals))
}
