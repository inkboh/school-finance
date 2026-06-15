#Requires -Version 5.1
# ---- Riverdale Academy School Finance -- AWS Deployment Script ---------------
#
# Usage (run from project root):
#   .\deploy.ps1          -- build + CDK deploy + schema push
#   .\deploy.ps1 -Setup   -- above + seed DB + import data + Cognito bootstrap
# -----------------------------------------------------------------------------

param([switch]$Setup)

$ErrorActionPreference = 'Stop'
$Root         = $PSScriptRoot
$FunctionName = 'SchoolFinanceApi'
$Region       = 'us-east-1'

function Write-Step { param([string]$msg) Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok   { param([string]$msg) Write-Host "    OK  $msg" -ForegroundColor Green }
function Fail       { param([string]$msg) Write-Host "`nERROR: $msg" -ForegroundColor Red; exit 1 }

function Invoke-LambdaAction {
    param([string]$Action)
    Write-Host "    Invoking: $Action ..." -ForegroundColor DarkCyan

    $payloadFile  = "$env:TEMP\sf-lambda-payload.json"
    $responseFile = "$env:TEMP\sf-lambda-response.json"
    $payloadJson  = '{"action":"' + $Action + '"}'

    [System.IO.File]::WriteAllText($payloadFile, $payloadJson, [System.Text.Encoding]::UTF8)

    aws lambda invoke `
        --function-name $FunctionName `
        --region $Region `
        --payload "file://$payloadFile" `
        $responseFile | Out-Null

    if (-not (Test-Path $responseFile)) {
        Write-Host "    FAILED (no response file)" -ForegroundColor Red
        return
    }

    $raw = Get-Content $responseFile -Raw
    Remove-Item $responseFile -ErrorAction SilentlyContinue

    try {
        $res = $raw | ConvertFrom-Json

        if ($res.success -eq $false) {
            Write-Host "    FAILED: $($res.error)" -ForegroundColor Red
        } elseif ($res.seeded) {
            $seededList = $res.seeded -join ', '
            Write-Host "    Done: $seededList" -ForegroundColor Green
        } elseif ($res.result) {
            $resultJson = $res.result | ConvertTo-Json -Compress
            Write-Host "    Done: $resultJson" -ForegroundColor Green
        } elseif ($res.users) {
            Write-Host "    Done:" -ForegroundColor Green
            foreach ($u in $res.users) {
                Write-Host "      $($u.email) - $($u.status)" -ForegroundColor DarkGray
            }
        } else {
            Write-Host "    Done." -ForegroundColor Green
        }
    }
    catch {
        Write-Host "    Done (raw): $raw" -ForegroundColor Green
    }
}

# ---- 1. Prerequisites --------------------------------------------------------
Write-Step "Checking prerequisites"

if (-not (Get-Command aws    -ErrorAction SilentlyContinue)) { Fail "AWS CLI not found. Install from https://aws.amazon.com/cli/" }
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { Fail "Docker not found. Start Docker Desktop." }
if (-not (Get-Command node   -ErrorAction SilentlyContinue)) { Fail "Node.js not found." }
if (-not (Get-Command cdk    -ErrorAction SilentlyContinue)) { Fail "CDK not found. Run: npm install -g aws-cdk" }

$account = aws sts get-caller-identity --query Account --output text 2>$null
if (-not $account) { Fail "AWS credentials not configured. Run: aws configure" }
Write-Ok "AWS account: $account"

docker info 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { Fail "Docker daemon is not running. Start Docker Desktop." }
Write-Ok "Docker is running"

# ---- 2. Install dependencies -------------------------------------------------
Write-Step "Installing dependencies"
Set-Location "$Root\infra";  npm install --silent; if ($LASTEXITCODE -ne 0) { Fail "npm install failed in infra/" }
Set-Location "$Root\client"; npm install --silent; if ($LASTEXITCODE -ne 0) { Fail "npm install failed in client/" }
Set-Location "$Root\server"; npm install --silent; if ($LASTEXITCODE -ne 0) { Fail "npm install failed in server/" }
Write-Ok "All dependencies installed"

# ---- 3. Build frontend -------------------------------------------------------
Write-Step "Building React frontend"
Set-Location "$Root\client"
npm run build
if ($LASTEXITCODE -ne 0) { Fail "Frontend build failed" }
Write-Ok "Built to client/dist/"

# ---- 4. CDK bootstrap (safe to re-run) --------------------------------------
Write-Step "Bootstrapping CDK (account $account / $Region)"
Set-Location "$Root\infra"
cdk bootstrap "aws://$account/$Region"
if ($LASTEXITCODE -ne 0) { Fail "CDK bootstrap failed" }
Write-Ok "CDK bootstrapped"

# ---- 5. CDK deploy -----------------------------------------------------------
Write-Step "Deploying to AWS (builds Docker image + uploads assets)"
Write-Host "    This takes 10-15 minutes on first run, faster afterwards." -ForegroundColor DarkGray
Set-Location "$Root\infra"
cdk deploy --require-approval never --outputs-file "$Root\cdk-outputs.json"
if ($LASTEXITCODE -ne 0) { Fail "CDK deploy failed" }
Write-Ok "Stack deployed"

# ---- 6. Always: push Prisma schema ------------------------------------------
Write-Step "Applying database schema"
Invoke-LambdaAction "dbpush"

# ---- 7. Setup mode: seed + import + Cognito ---------------------------------
if ($Setup) {
    Write-Step "Running setup actions (-Setup flag)"
    Write-Host "  [1/4] Seeding reference data (currencies, categories, users)"
    Invoke-LambdaAction "seed"
    Write-Host "  [2/4] Importing student data from spreadsheet"
    Invoke-LambdaAction "import"
    Write-Host "  [3/4] Importing historical receipts and expenses"
    Invoke-LambdaAction "importHistorical"
    Write-Host "  [4/4] Creating Cognito users"
    Invoke-LambdaAction "cognitoBootstrap"
}

# ---- 8. Summary --------------------------------------------------------------
Write-Step "Deployment complete"

if (Test-Path "$Root\cdk-outputs.json") {
    $outputs = Get-Content "$Root\cdk-outputs.json" -Raw | ConvertFrom-Json
    $stack   = $outputs.SchoolFinanceStack
    Write-Host ""
    Write-Host "  App URL : $($stack.AppUrl)" -ForegroundColor Yellow
    Write-Host "  API URL : $($stack.ApiUrl)"  -ForegroundColor DarkGray
    Write-Host ""
}

if ($Setup) {
    Write-Host "  Temp password for all users: School.Finance2025!" -ForegroundColor Cyan
    Write-Host "  Users will be prompted to set a new password on first login." -ForegroundColor DarkGray
}

Write-Host "  CloudFront can take 5-10 minutes to propagate globally." -ForegroundColor DarkGray
