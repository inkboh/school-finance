#Requires -Version 5.1
# ── Riverdale Academy School Finance — AWS Deployment Script ──────────────────
#
# Prerequisites:
#   - AWS CLI configured (aws configure) with account 705285596598
#   - Docker Desktop running (needed to build the Lambda image)
#   - Node.js 20+ installed
#
# Run from the project root:  .\deploy.ps1
# ─────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = 'Stop'
$Root = $PSScriptRoot

function Write-Step([string]$msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok([string]$msg)   { Write-Host "    OK: $msg" -ForegroundColor Green }
function Fail([string]$msg)       { Write-Host "ERROR: $msg" -ForegroundColor Red; exit 1 }

# ── 1. Verify prerequisites ───────────────────────────────────────────────────
Write-Step "Checking prerequisites"

if (-not (Get-Command aws -ErrorAction SilentlyContinue))   { Fail "AWS CLI not found. Install from https://aws.amazon.com/cli/" }
if (-not (Get-Command docker -ErrorAction SilentlyContinue)){ Fail "Docker not found. Start Docker Desktop." }
if (-not (Get-Command node -ErrorAction SilentlyContinue))  { Fail "Node.js not found." }
if (-not (Get-Command cdk -ErrorAction SilentlyContinue))   { Fail "CDK not found. Run: npm install -g aws-cdk" }

$account = (aws sts get-caller-identity --query Account --output text 2>$null)
if (-not $account) { Fail "AWS credentials not configured. Run: aws configure" }
Write-Ok "AWS account: $account"

$dockerOk = (docker info 2>$null)
if ($LASTEXITCODE -ne 0) { Fail "Docker daemon is not running. Start Docker Desktop." }
Write-Ok "Docker is running"

# ── 2. Install CDK dependencies ───────────────────────────────────────────────
Write-Step "Installing CDK dependencies"
Set-Location "$Root\infra"
npm install
if ($LASTEXITCODE -ne 0) { Fail "npm install failed in infra/" }
Write-Ok "CDK deps installed"

# ── 3. Bootstrap CDK (safe to run multiple times) ────────────────────────────
Write-Step "Bootstrapping CDK (account $account / us-east-1)"
cdk bootstrap "aws://$account/us-east-1"
if ($LASTEXITCODE -ne 0) { Fail "CDK bootstrap failed" }
Write-Ok "CDK bootstrapped"

# ── 4. Build frontend ─────────────────────────────────────────────────────────
Write-Step "Building React frontend"
Set-Location "$Root\client"
npm install
if ($LASTEXITCODE -ne 0) { Fail "npm install failed in client/" }
npm run build
if ($LASTEXITCODE -ne 0) { Fail "Frontend build failed" }
Write-Ok "Frontend built to client/dist/"

# ── 5. Install server dependencies ────────────────────────────────────────────
Write-Step "Installing server dependencies (for local Prisma generate)"
Set-Location "$Root\server"
npm install
if ($LASTEXITCODE -ne 0) { Fail "npm install failed in server/" }
Write-Ok "Server deps installed"

# ── 6. Deploy via CDK ─────────────────────────────────────────────────────────
Write-Step "Deploying to AWS (this builds the Docker image and may take 10-15 minutes)"
Set-Location "$Root\infra"
cdk deploy --require-approval never --outputs-file "$Root\cdk-outputs.json"
if ($LASTEXITCODE -ne 0) { Fail "CDK deploy failed" }
Write-Ok "Stack deployed"

# ── 7. Show outputs ───────────────────────────────────────────────────────────
Write-Step "Deployment complete"
$outputs = Get-Content "$Root\cdk-outputs.json" | ConvertFrom-Json
$stack = $outputs.SchoolFinanceStack
Write-Host ""
Write-Host "  App URL   : $($stack.AppUrl)" -ForegroundColor Yellow
Write-Host "  API URL   : $($stack.ApiUrl)"
Write-Host "  DB Endpoint: $($stack.DbEndpoint)"
Write-Host "  DB Secret  : $($stack.DbSecretArn)"
Write-Host ""

# ── 8. Push Prisma schema to RDS ─────────────────────────────────────────────
Write-Step "Pushing Prisma schema to RDS via Lambda"
Write-Host "  Invoking SchoolFinanceApi Lambda with dbpush action..."
$payload = '{"action":"dbpush"}'
$payloadB64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($payload))

aws lambda invoke `
  --function-name SchoolFinanceApi `
  --cli-binary-format raw-in-base64-out `
  --payload $payload `
  "$Root\dbpush-response.json"

$response = Get-Content "$Root\dbpush-response.json" | ConvertFrom-Json
if ($response.success) {
  Write-Ok "Database schema pushed successfully"
} else {
  Write-Host "  WARNING: DB push may have failed. Check dbpush-response.json" -ForegroundColor Yellow
  Write-Host "  Error: $($response.error)" -ForegroundColor Yellow
  Write-Host "  You can retry manually:"
  Write-Host "    aws lambda invoke --function-name SchoolFinanceApi --payload '{`"action`":`"dbpush`"}' out.json"
}

Write-Host ""
Write-Host "Done! Open $($stack.AppUrl) in your browser." -ForegroundColor Green
Write-Host "(CloudFront may take 5-10 minutes to propagate globally)"
