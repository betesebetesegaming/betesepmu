param(
    [ValidateSet('full','lite')]
    [string]$Target = 'full'
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$androidDir = Join-Path $repoRoot 'android'

$targetPackage = if ($Target -eq 'lite') { 'com.betese.pmu.poslite' } else { 'com.betese.pmu' }
$assembleTask = if ($Target -eq 'lite') { ':app:assemblePosliteDebug' } else { ':app:assembleDebug' }

Push-Location $repoRoot
try {
    & npm run build
    if ($LASTEXITCODE -ne 0) { throw 'npm run build failed' }
}
finally {
    Pop-Location
}

Push-Location $androidDir
try {
    & .\gradlew.bat $assembleTask :benchmark:connectedAndroidTest --no-daemon "-Pandroid.testInstrumentationRunnerArguments.targetPackage=$targetPackage"
    if ($LASTEXITCODE -ne 0) { throw 'Macrobenchmark run failed' }
}
finally {
    Pop-Location
}

Write-Host "Macrobenchmark completed for $targetPackage"
