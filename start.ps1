# School Finance Manager — One-click startup
# Double-click start.bat to run this

$ROOT        = Split-Path -Parent $MyInvocation.MyCommand.Path
$DOCKER      = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
$DOCKER_APP  = "C:\Program Files\Docker\Docker\Docker Desktop.exe"

function Write-Step($msg) { Write-Host "`n>>> $msg" -ForegroundColor Cyan }
function Write-OK($msg)   { Write-Host "    OK  $msg" -ForegroundColor Green }
function Write-Fail($msg) { Write-Host "    ERR $msg" -ForegroundColor Red }

# ── 1. Docker Desktop ─────────────────────────────────────────────────────────
Write-Step "Checking Docker..."

$dockerRunning = & $DOCKER ps 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "    Docker daemon not running. Starting Docker Desktop..." -ForegroundColor Yellow
    if (-not (Test-Path $DOCKER_APP)) {
        Write-Fail "Docker Desktop not found at $DOCKER_APP. Please install it."
        Read-Host "Press Enter to exit"
        exit 1
    }
    Start-Process $DOCKER_APP
    Write-Host "    Waiting for daemon" -NoNewline -ForegroundColor Yellow
    $waited = 0
    do {
        Start-Sleep -Seconds 3
        $waited += 3
        Write-Host "." -NoNewline -ForegroundColor Yellow
        & $DOCKER ps 2>$null | Out-Null
        if ($waited -gt 90) {
            Write-Host ""
            Write-Fail "Docker took too long to start. Open Docker Desktop manually and retry."
            Read-Host "Press Enter to exit"
            exit 1
        }
    } while ($LASTEXITCODE -ne 0)
    Write-Host ""
}
Write-OK "Docker is running"

# ── 2. Start database containers ──────────────────────────────────────────────
Write-Step "Starting database (PostgreSQL + pgAdmin)..."

Set-Location $ROOT
& $DOCKER compose up -d 2>&1 | ForEach-Object {
    if ($_ -match "Started|Running|Healthy") { Write-OK $_ }
}
if ($LASTEXITCODE -ne 0) {
    Write-Fail "docker compose up failed. Check docker-compose.yml"
    Read-Host "Press Enter to exit"
    exit 1
}

# ── 3. Wait for PostgreSQL to accept connections ───────────────────────────────
Write-Host "    Waiting for PostgreSQL" -NoNewline -ForegroundColor Yellow
$pgReady = $false
for ($i = 0; $i -lt 20; $i++) {
    $check = & $DOCKER exec school_finance_db pg_isready -U sfadmin 2>$null
    if ($LASTEXITCODE -eq 0) { $pgReady = $true; break }
    Write-Host "." -NoNewline -ForegroundColor Yellow
    Start-Sleep -Seconds 2
}
Write-Host ""
if (-not $pgReady) {
    Write-Fail "PostgreSQL did not become ready in time."
    Read-Host "Press Enter to exit"
    exit 1
}
Write-OK "PostgreSQL is ready"

# ── 4. Backend server ─────────────────────────────────────────────────────────
Write-Step "Starting backend (Express API on port 4000)..."

Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$ROOT\server'; `$host.UI.RawUI.WindowTitle = 'SF Backend :4000'; Write-Host '=== SCHOOL FINANCE — BACKEND ===' -ForegroundColor Green; npm run dev"
)

# Give the server a moment to bind the port
$backendReady = $false
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 2
    try {
        $r = Invoke-WebRequest "http://localhost:4000/api/auth/me" -UseBasicParsing -ErrorAction Stop
    } catch {
        # 401 means the server is up (unauthenticated request)
        if ($_.Exception.Response.StatusCode.value__ -eq 401) {
            $backendReady = $true; break
        }
    }
}
if ($backendReady) { Write-OK "Backend is up at http://localhost:4000" }
else { Write-Host "    Backend may still be starting — check its window" -ForegroundColor Yellow }

# ── 5. Frontend (Vite) ────────────────────────────────────────────────────────
Write-Step "Starting frontend (Vite on port 5173)..."

Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$ROOT\client'; `$host.UI.RawUI.WindowTitle = 'SF Frontend :5173'; Write-Host '=== SCHOOL FINANCE — FRONTEND ===' -ForegroundColor Magenta; npm run dev"
)

$frontendReady = $false
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 2
    try {
        $r = Invoke-WebRequest "http://localhost:5173" -UseBasicParsing -ErrorAction Stop
        if ($r.StatusCode -eq 200) { $frontendReady = $true; break }
    } catch {}
}
if ($frontendReady) { Write-OK "Frontend is up at http://localhost:5173" }
else { Write-Host "    Frontend may still be compiling — check its window" -ForegroundColor Yellow }

# ── 6. Open browser ───────────────────────────────────────────────────────────
Write-Step "Opening browser..."
Start-Process "http://localhost:5173"

# ── Summary ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "   School Finance Manager is running!" -ForegroundColor Green
Write-Host "------------------------------------------------" -ForegroundColor DarkGreen
Write-Host "   App      http://localhost:5173" -ForegroundColor White
Write-Host "   API      http://localhost:4000/api" -ForegroundColor White
Write-Host "   pgAdmin  http://localhost:5050" -ForegroundColor White
Write-Host "            (admin@school.local / admin)" -ForegroundColor DarkGray
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Close the two terminal windows to stop the servers." -ForegroundColor DarkGray
Write-Host "Run stop.bat to also shut down the database." -ForegroundColor DarkGray
Write-Host ""
Read-Host "Press Enter to close this window"
