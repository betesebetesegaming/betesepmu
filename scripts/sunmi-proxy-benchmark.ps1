param(
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression.FileSystem

function To-Mb {
    param([double]$Bytes)
    return [math]::Round($Bytes / 1MB, 2)
}

function Pct {
    param([double]$Base, [double]$Current)
    if ($Base -le 0) { return $null }
    return [math]::Round((($Base - $Current) / $Base) * 100, 2)
}

function Find-Apk {
    param([string]$Root, [string]$Pattern)
    $files = Get-ChildItem -Path $Root -Recurse -Filter $Pattern -File -ErrorAction SilentlyContinue
    if (-not $files) { return $null }
    return ($files | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
}

function Get-ApkMetrics {
    param([string]$ApkPath)

    $zip = [System.IO.Compression.ZipFile]::OpenRead($ApkPath)
    try {
        $total = [double](Get-Item $ApkPath).Length
        $dex = 0.0
        $assets = 0.0
        $libs = 0.0
        $res = 0.0
        $manifest = 0.0
        $arsc = 0.0

        foreach ($entry in $zip.Entries) {
            $len = [double]$entry.Length
            if ($entry.FullName -match '^classes(\d*)\.dex$') { $dex += $len; continue }
            if ($entry.FullName -like 'assets/*') { $assets += $len; continue }
            if ($entry.FullName -like 'lib/*') { $libs += $len; continue }
            if ($entry.FullName -like 'res/*') { $res += $len; continue }
            if ($entry.FullName -eq 'AndroidManifest.xml') { $manifest += $len; continue }
            if ($entry.FullName -eq 'resources.arsc') { $arsc += $len; continue }
        }

        return [pscustomobject]@{
            Path = $ApkPath
            TotalBytes = $total
            DexBytes = $dex
            AssetsBytes = $assets
            LibBytes = $libs
            ResBytes = $res
            ManifestBytes = $manifest
            ArscBytes = $arsc
        }
    }
    finally {
        $zip.Dispose()
    }
}

function Build-WeightedScore {
    param([pscustomobject]$M)
    # Heuristic for cold-start pressure: dex + assets + total package footprint.
    return (0.6 * $M.DexBytes) + (0.25 * $M.AssetsBytes) + (0.15 * $M.TotalBytes)
}

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$androidDir = Join-Path $repoRoot 'android'
$apkRoot = Join-Path $androidDir 'app\build\outputs\apk'
$reportPath = Join-Path $repoRoot 'docs\sunmi-proxy-benchmark-report.md'

if (-not (Test-Path $androidDir)) {
    throw "Android folder not found at $androidDir"
}

if (-not $SkipBuild) {
    Write-Host 'Building web assets...'
    Push-Location $repoRoot
    try {
        & npm run build
        if ($LASTEXITCODE -ne 0) { throw 'npm run build failed' }
    }
    finally {
        Pop-Location
    }

    Write-Host 'Building Android APKs (full + poslite)...'
    Push-Location $androidDir
    try {
        & .\gradlew.bat assembleDebug assemblePosliteDebug --no-daemon
        if ($LASTEXITCODE -ne 0) { throw 'Gradle build failed' }
    }
    finally {
        Pop-Location
    }
}

$fullApk = Find-Apk -Root $apkRoot -Pattern 'app-debug.apk'
$liteApk = Find-Apk -Root $apkRoot -Pattern 'app-poslite-debug.apk'

if (-not $fullApk) { throw 'Could not find full APK (app-debug.apk).' }
if (-not $liteApk) { throw 'Could not find lite APK (app-poslite-debug.apk).' }

$full = Get-ApkMetrics -ApkPath $fullApk
$lite = Get-ApkMetrics -ApkPath $liteApk

$fullScore = Build-WeightedScore -M $full
$liteScore = Build-WeightedScore -M $lite

$summary = [pscustomobject]@{
    Metric = @(
        'Total APK size (MB)',
        'DEX size (MB)',
        'Assets size (MB)',
        'Native libs size (MB)',
        'Resources (res/) size (MB)',
        'Startup pressure score (heuristic)'
    )
    Full = @(
        (To-Mb $full.TotalBytes),
        (To-Mb $full.DexBytes),
        (To-Mb $full.AssetsBytes),
        (To-Mb $full.LibBytes),
        (To-Mb $full.ResBytes),
        [math]::Round($fullScore, 0)
    )
    Poslite = @(
        (To-Mb $lite.TotalBytes),
        (To-Mb $lite.DexBytes),
        (To-Mb $lite.AssetsBytes),
        (To-Mb $lite.LibBytes),
        (To-Mb $lite.ResBytes),
        [math]::Round($liteScore, 0)
    )
    ImprovementPercent = @(
        (Pct $full.TotalBytes $lite.TotalBytes),
        (Pct $full.DexBytes $lite.DexBytes),
        (Pct $full.AssetsBytes $lite.AssetsBytes),
        (Pct $full.LibBytes $lite.LibBytes),
        (Pct $full.ResBytes $lite.ResBytes),
        (Pct $fullScore $liteScore)
    )
}

$rows = for ($i = 0; $i -lt $summary.Metric.Count; $i++) {
    [pscustomobject]@{
        Metric = $summary.Metric[$i]
        Full = $summary.Full[$i]
        Poslite = $summary.Poslite[$i]
        ImprovementPercent = $summary.ImprovementPercent[$i]
    }
}

Write-Host ''
Write-Host 'Proxy benchmark results'
$rows | Format-Table -AutoSize

$report = @()
$report += '# Sunmi Proxy Benchmark Report'
$report += ''
$report += "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$report += ''
$report += "- Full APK: $fullApk"
$report += "- Poslite APK: $liteApk"
$report += ''
$report += '| Metric | Full | Poslite | Improvement % |'
$report += '|---|---:|---:|---:|'
foreach ($r in $rows) {
    $report += "| $($r.Metric) | $($r.Full) | $($r.Poslite) | $($r.ImprovementPercent) |"
}
$report += ''
$report += '## Interpretation'
$report += ''
$report += '- This is a no-device proxy benchmark, not a real startup-time measurement.'
$report += '- Use this when ADB/device access is unavailable.'
$report += '- For final validation, run real-device ADB benchmark when terminal is available.'

Set-Content -Path $reportPath -Value ($report -join "`r`n") -Encoding UTF8

Write-Host ''
Write-Host "Report saved: $reportPath"
