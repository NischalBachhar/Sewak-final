$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$AccountId = '860970f755498a4fe10e16c2fa99ce55'
$Origin = 'https://sewak-final.nischalbachhar9.workers.dev'
$Validation = '.local-tools/d1-migration/final-validation.json'
$AuthQa = '.local-tools/cloudflare-auth/sewak-final-qa-3fb2cbe2-6175-4ad0-b0f0-7c49125901c8.json'
$PreviousSmoke = '.local-tools/cloudflare-auth/production-write-smoke-fce37aca-6d70-4705-a0fa-31b2f987471b.json'

function Require-PassingReport([string]$Path, [string]$Label) {
  if (-not (Test-Path $Path)) {
    throw "$Label evidence is missing: $Path. Do not reconstruct or bypass it."
  }
  $Report = Get-Content $Path -Raw | ConvertFrom-Json
  if ($Report.pass -ne $true) {
    throw "$Label evidence is not a recorded PASS: $Path"
  }
  if ($null -ne $Report.cleanupVerified -and $Report.cleanupVerified -ne $true) {
    throw "$Label cleanup was not verified: $Path"
  }
  return $Report
}

function Read-Health {
  return Invoke-RestMethod -Uri "$Origin/api/health" -Method Get -TimeoutSec 20
}

Write-Host 'Sewak production activation + mobile E2E'
Write-Host '----------------------------------------'

# Never deploy unrelated local changes.
$Dirty = git status --porcelain --untracked-files=no
if ($LASTEXITCODE -ne 0) { throw 'Git status failed.' }
if ($Dirty) {
  throw 'Tracked working-tree changes are present. Commit/stash them before production activation.'
}

git rev-parse --verify main *> $null
if ($LASTEXITCODE -ne 0) { throw 'Local main branch is unavailable. Fetch origin/main first.' }

# The mobile PR may change mobile/, CI and operator scripts, but production
# web/Worker/runtime source must still match main exactly before activation.
git diff --quiet main...HEAD -- src worker public package.json package-lock.json wrangler.production.toml
if ($LASTEXITCODE -ne 0) {
  throw 'This branch changes production web/Worker runtime relative to main. Stop and review before deploying.'
}

$ValidationReport = Require-PassingReport $Validation 'Final D1 validation'
$AuthReport = Require-PassingReport $AuthQa 'Production Cloudflare Auth QA'
$SmokeReport = Require-PassingReport $PreviousSmoke 'Previous controlled production write smoke'

if ($AuthReport.auth -ne 'cloudflare-d1' -or $AuthReport.worker -ne 'sewak-final') {
  throw 'The preserved Auth QA report is not for Cloudflare-D1 production sewak-final.'
}

$env:CLOUDFLARE_ACCOUNT_ID = $AccountId

if (-not (Test-Path 'worker/node_modules/wrangler/bin/wrangler.js')) {
  Write-Host 'Installing Worker dependencies...'
  npm.cmd --prefix worker ci
  if ($LASTEXITCODE -ne 0) { throw 'Worker dependency install failed.' }
}

Write-Host 'Checking Wrangler identity...'
& .worker
ode_modules.binwrangler.cmd whoami
if ($LASTEXITCODE -ne 0) {
  throw 'Wrangler is not authenticated. Run: .worker
ode_modules.binwrangler.cmd login'
}

$Before = Read-Health
Write-Host ("Live before: auth={0}, writesEnabled={1}" -f $Before.auth, $Before.writesEnabled)

if ($Before.auth -ne 'cloudflare-d1') {
  throw 'Production is not reporting Cloudflare-only authentication. Stop before deployment.'
}

if ($Before.writesEnabled -ne $true) {
  Write-Host 'Production is read-only; rebuilding the reviewed release...'
  npm.cmd run build:release
  if ($LASTEXITCODE -ne 0) { throw 'Release build failed.' }

  Write-Host 'Deploying sewak-final through the guarded deployment script...'
  npm.cmd run deploy:cloudflare -- --worker sewak-final --free-plan-confirmed --source-frozen --validation $Validation --auth-qa $AuthQa
  if ($LASTEXITCODE -ne 0) { throw 'Guarded production deployment failed. E2E was not started.' }

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
  throw 'Controlled mobile lifecycle E2E failed. Inspect its .local-tools/mobile-e2e report before retrying.'
}

$Final = Read-Health
if ($Final.auth -ne 'cloudflare-d1' -or $Final.writesEnabled -ne $true) {
  throw 'Production health changed after E2E. Investigate before further testing.'
}

Write-Host ''
Write-Host 'PASS: production writes are enabled and the controlled mobile lifecycle completed with cleanup verification.'
