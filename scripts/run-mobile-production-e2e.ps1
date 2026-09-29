$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$AccountId = '860970f755498a4fe10e16c2fa99ce55'
$Origin = 'https://sewak-final.nischalbachhar9.workers.dev'
$Validation = '.local-tools/d1-migration/final-validation.json'
$AuthQa = '.local-tools/cloudflare-auth/sewak-final-qa-3fb2cbe2-6175-4ad0-b0f0-7c49125901c8.json'
$PreviousSmoke = '.local-tools/cloudflare-auth/production-write-smoke-fce37aca-6d70-4705-a0fa-31b2f987471b.json'
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

function Read-Health {
  return Invoke-RestMethod -Uri "$Origin/api/health" -Method Get -TimeoutSec 20
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

# package-lock.json is intentionally allowed to differ on this mobile branch:
# it contains only the npm-10 lock-placement repair already verified by a
# clean Node 22 npm ci. package.json and all production runtime/deploy files
# above must still match origin/main exactly.

$ValidationReport = Require-PassingReport $Validation 'Final D1 validation'
$AuthReport = Require-PassingReport $AuthQa 'Production Cloudflare Auth QA'
$SmokeReport = Require-PassingReport $PreviousSmoke 'Previous controlled production write smoke'

$AuthName = Get-JsonPropertyValue $AuthReport 'auth'
$WorkerName = Get-JsonPropertyValue $AuthReport 'worker'
if ($AuthName -ne 'cloudflare-d1' -or $WorkerName -ne 'sewak-final') {
  throw 'The preserved Auth QA report is not for Cloudflare-D1 production sewak-final.'
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
  throw "Wrangler is not authenticated. Run the Wrangler login command, then rerun this script."
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
