$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$AccountId = '860970f755498a4fe10e16c2fa99ce55'
$Origin = 'https://sewak-final.nischalbachhar9.workers.dev'
$Validation = '.local-tools/d1-migration/final-validation.json'
$AuthQa = '.local-tools/cloudflare-auth/sewak-final-qa-b3725c93-56ea-4cea-846b-cf8b3b25c310.json'
$Restoration = '.local-tools/cloudflare-auth/readonly-restoration.json'
$ProductionConfig = 'wrangler.production.toml'
$WranglerCmd = Join-Path $PSScriptRoot '..\worker\node_modules\.bin\wrangler.cmd'

function Get-JsonPropertyValue([object]$Object, [string]$Name) {
  $Property = $Object.PSObject.Properties[$Name]
  if ($null -eq $Property) { return $null }
  return $Property.Value
}

function Require-PassingReport([string]$Path, [string]$Label) {
  if (-not (Test-Path $Path)) {
    throw "$Label evidence is missing: $Path. Do not reconstruct or bypass it."
  }
  $Report = Get-Content $Path -Raw | ConvertFrom-Json
  $PassValue = Get-JsonPropertyValue $Report 'pass'
  if ($PassValue -ne $true) {
    throw "$Label evidence is not a recorded PASS: $Path"
  }
  $CleanupProperty = $Report.PSObject.Properties['cleanupVerified']
  if ($null -ne $CleanupProperty -and $CleanupProperty.Value -ne $true) {
    throw "$Label cleanup was not verified: $Path"
  }
  return $Report
}

function Require-CurrentRestoration([string]$Path) {
  if (-not (Test-Path $Path)) {
    throw "Current read-only restoration evidence is missing: $Path"
  }
  $Report = Get-Content $Path -Raw | ConvertFrom-Json
  $PassProperty = $Report.PSObject.Properties['pass']
  if ($null -ne $PassProperty -and $PassProperty.Value -ne $true) {
    throw "Current read-only restoration evidence is not passing: $Path"
  }
  return $Report
}

function Read-Health {
  return Invoke-RestMethod -Uri "$Origin/api/health" -Method Get -TimeoutSec 20
}

function Write-Utf8NoBom([string]$Path, [string]$Text) {
  $Utf8 = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText((Resolve-Path $Path), $Text, $Utf8)
}

function Deploy-ReadOnly([string]$ValidationPath, [string]$AuthQaPath) {
  Write-Host 'Safety rollback: redeploying verified production read-only configuration...'
  npm.cmd run deploy:cloudflare -- --worker sewak-final --cutover-maintenance --free-plan-confirmed --source-frozen --validation $ValidationPath --auth-qa $AuthQaPath
  if ($LASTEXITCODE -ne 0) {
    throw 'CRITICAL: automatic read-only rollback deployment failed. Do not continue using production until manually verified.'
  }
  Start-Sleep -Seconds 3
  $Health = Read-Health
  if ($Health.auth -ne 'cloudflare-d1' -or $Health.writesEnabled -ne $false) {
    throw 'CRITICAL: read-only rollback could not be verified. Stop all testing and inspect production.'
  }
  Write-Host 'Safety rollback verified: production writes are disabled.'
}

Write-Host 'Sewak production activation + mobile E2E'
Write-Host '----------------------------------------'

$NodeVersion = (& node -p "process.versions.node").Trim()
$NodeMajor = [int]($NodeVersion.Split('.')[0])
if ($NodeMajor -ne 22) {
  throw "Node 22 LTS is required for this production run. Current Node is $NodeVersion. Switch to Node 22, then rerun."
}
Write-Host ("Node runtime: {0}" -f $NodeVersion)

$Dirty = git status --porcelain --untracked-files=no
if ($LASTEXITCODE -ne 0) { throw 'Git status failed.' }
if ($Dirty) {
  throw 'Tracked working-tree changes are present. Commit/stash them before production activation.'
}

git fetch origin main
if ($LASTEXITCODE -ne 0) { throw 'Could not refresh origin/main.' }

git diff --quiet origin/main HEAD -- src worker public package.json wrangler.production.toml wrangler.toml scripts/deploy-worker.mjs scripts/deployment-policy.mjs scripts/release-build.cjs scripts/worker-command.mjs scripts/check-build-ci.cjs scripts/check-worker-entry.mjs
if ($LASTEXITCODE -ne 0) {
  throw 'This branch does not match the latest production web/Worker/deployment runtime from main. Stop and review before deploying.'
}

$ValidationReport = Require-PassingReport $Validation 'Final D1 validation'
$AuthReport = Require-PassingReport $AuthQa 'Current production Cloudflare Auth QA'
$RestorationReport = Require-CurrentRestoration $Restoration

$AuthName = Get-JsonPropertyValue $AuthReport 'auth'
$WorkerName = Get-JsonPropertyValue $AuthReport 'worker'
if ($AuthName -ne 'cloudflare-d1' -or $WorkerName -ne 'sewak-final') {
  throw 'The current Auth QA report is not for Cloudflare-D1 production sewak-final.'
}

$OriginalConfig = Get-Content $ProductionConfig -Raw
$FalsePattern = 'APP_WRITES_ENABLED\s*=\s*"false"'
$FalseMatches = [regex]::Matches($OriginalConfig, $FalsePattern)
if ($FalseMatches.Count -ne 1) {
  throw 'Committed production config must contain exactly one APP_WRITES_ENABLED="false" safety default.'
}
if ($OriginalConfig -notmatch 'name\s*=\s*"sewak-final"' -or
    $OriginalConfig -notmatch 'AUTH_AUDIENCE\s*=\s*"sewak-production"' -or
    $OriginalConfig -notmatch '36fa1df1-aa5d-43a1-ad0e-a4e310c513c3' -or
    $OriginalConfig -notmatch 'c3721e25-4fb2-4a0d-b350-518ec9abbea2') {
  throw 'Production config is not pinned to the reviewed Sewak production target.'
}

$env:CLOUDFLARE_ACCOUNT_ID = $AccountId

if (-not (Test-Path $WranglerCmd)) {
  Write-Host 'Installing Worker dependencies...'
  npm.cmd --prefix worker ci
  if ($LASTEXITCODE -ne 0) { throw 'Worker dependency install failed.' }
}
if (-not (Test-Path $WranglerCmd)) {
  throw "Wrangler executable was not found at: $WranglerCmd"
}

Write-Host 'Checking Wrangler identity...'
& $WranglerCmd whoami
if ($LASTEXITCODE -ne 0) {
  throw 'Wrangler is not authenticated. Run Wrangler login, then rerun this script.'
}

$Before = Read-Health
Write-Host ("Live before: auth={0}, writesEnabled={1}" -f $Before.auth, $Before.writesEnabled)
if ($Before.auth -ne 'cloudflare-d1') {
  throw 'Production is not reporting Cloudflare-only authentication. Stop before deployment.'
}

Write-Host 'Running read-only production E2E preflight before enabling writes...'
node scripts/smoke-mobile-e2e-production.mjs --preflight
if ($LASTEXITCODE -ne 0) {
  throw 'Production E2E preflight failed while production was still read-only. No write activation was attempted.'
}
Write-Host 'Read-only E2E preflight passed.'

$ActivatedByThisRun = $false
$LifecyclePassed = $false

try {
  if ($Before.writesEnabled -ne $true) {
    Write-Host 'Production is verified read-only. Preparing a temporary write-enabled production config for this authorized cutover...'

    $WriteConfig = [regex]::Replace(
      $OriginalConfig,
      $FalsePattern,
      'APP_WRITES_ENABLED = "true"',
      1
    )

    Write-Utf8NoBom $ProductionConfig $WriteConfig

    $ChangedFiles = @(git diff --name-only -- $ProductionConfig)
    if ($LASTEXITCODE -ne 0 -or $ChangedFiles.Count -ne 1 -or $ChangedFiles[0] -ne $ProductionConfig) {
      throw 'Unexpected production-config mutation while preparing write enablement.'
    }

    $env:REACT_APP_CANONICAL_ORIGIN = $Origin
    Write-Host 'Rebuilding the reviewed release with the canonical production origin...'
    npm.cmd run build:release
    if ($LASTEXITCODE -ne 0) { throw 'Release build failed.' }

    Write-Host 'Deploying write-enabled sewak-final through the guarded deployment operator...'
    npm.cmd run deploy:cloudflare -- --worker sewak-final --free-plan-confirmed --source-frozen --validation $Validation --auth-qa $AuthQa
    if ($LASTEXITCODE -ne 0) { throw 'Guarded write-enabled production deployment failed. E2E was not started.' }

    $ActivatedByThisRun = $true
    Start-Sleep -Seconds 3
  }

  $Enabled = Read-Health
  Write-Host ("Live after activation: auth={0}, writesEnabled={1}" -f $Enabled.auth, $Enabled.writesEnabled)
  if ($Enabled.auth -ne 'cloudflare-d1' -or $Enabled.writesEnabled -ne $true) {
    throw 'Production did not reach the required Cloudflare-D1 + writes-enabled state. E2E was not started.'
  }

  Write-Host 'Running controlled customer -> caregiver -> care session -> review lifecycle...'
  node scripts/smoke-mobile-e2e-production.mjs --apply-controlled-mobile-e2e
  if ($LASTEXITCODE -ne 0) {
    throw 'Controlled mobile lifecycle E2E failed. Its runner attempted deterministic fixture cleanup.'
  }

  $Final = Read-Health
  if ($Final.auth -ne 'cloudflare-d1' -or $Final.writesEnabled -ne $true) {
    throw 'Production health changed after E2E.'
  }

  $LifecyclePassed = $true
}
finally {
  # The repository keeps a read-only safety default. Restore the working copy
  # regardless of success; production state is verified separately above.
  Write-Utf8NoBom $ProductionConfig $OriginalConfig

  if (-not $LifecyclePassed -and $ActivatedByThisRun) {
    Deploy-ReadOnly $Validation $AuthQa
  }
}

if (-not $LifecyclePassed) {
  throw 'Production activation/E2E did not complete successfully.'
}

$DirtyAfter = git status --porcelain --untracked-files=no
if ($DirtyAfter) {
  throw 'E2E passed, but the tracked working tree did not return to its original clean state.'
}

Write-Host ''
Write-Host 'PASS: production writes are enabled and the controlled mobile lifecycle completed with cleanup verification.'
Write-Host 'The committed production config remains read-only-by-default; update the reviewed repository state only after recording this successful cutover.'
