# ==============================================================================
# TeamTime HR System - Local Host Startup Script (Windows PowerShell)
# Starts Database, Backend API, and Frontend Web together in separate windows
# ==============================================================================

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "          TeamTime HR System - Localhost Startup                  " -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

$rootPath = $PSScriptRoot
if (-not $rootPath) { $rootPath = Get-Location }

# ── 1. Check PostgreSQL Database ─────────────────────────────
Write-Host "[1/4] Checking PostgreSQL database on localhost:5432..." -ForegroundColor Yellow
$pgReachable = $false
try {
    $tcp = Test-NetConnection -ComputerName localhost -Port 5432 -InformationLevel Quiet -WarningAction SilentlyContinue
    if ($tcp) { $pgReachable = $true }
} catch { }

if (-not $pgReachable) {
    Write-Host "  (!) PostgreSQL is not responding on localhost:5432." -ForegroundColor Yellow
    Write-Host "  Attempting to start database via docker compose..." -ForegroundColor Yellow
    try {
        docker compose up -d db
        Start-Sleep -Seconds 4
        $pgReachable = Test-NetConnection -ComputerName localhost -Port 5432 -InformationLevel Quiet -WarningAction SilentlyContinue
    } catch { }
}

if ($pgReachable) {
    Write-Host "  [OK] PostgreSQL database is active and accepting connections." -ForegroundColor Green
} else {
    Write-Host "  [WARNING] PostgreSQL port 5432 could not be verified." -ForegroundColor Magenta
    Write-Host "  Ensure PostgreSQL is running locally or run: docker compose up -d db" -ForegroundColor Gray
}

# ── 2. Determine Available Ports ──────────────────────────────
Write-Host "`n[2/4] Detecting ports..." -ForegroundColor Yellow

# Backend Port (5076 default, fallback if occupied)
$backendPort = 5076
$port5000InUse = Test-NetConnection -ComputerName localhost -Port 5000 -InformationLevel Quiet -WarningAction SilentlyContinue
if (-not $port5000InUse) {
    $backendPort = 5000
}
Write-Host "  Backend API will bind to: http://localhost:$backendPort" -ForegroundColor Cyan

# Frontend Port (3000 default, or 3001 if occupied)
$frontendPort = 3000
$port3000InUse = Test-NetConnection -ComputerName localhost -Port 3000 -InformationLevel Quiet -WarningAction SilentlyContinue
if ($port3000InUse) {
    $frontendPort = 3001
}
Write-Host "  Frontend Web will run on: http://localhost:$frontendPort" -ForegroundColor Cyan

# ── 3. Start Backend API ───────────────────────────────────────
Write-Host "`n[3/4] Starting ASP.NET Core Backend API..." -ForegroundColor Yellow
$backendCmd = "cd '$rootPath/backend/EmployeeManagement.API'; `$env:ASPNETCORE_URLS='http://localhost:$backendPort'; `$env:ASPNETCORE_ENVIRONMENT='Development'; Write-Host 'Starting Backend API on http://localhost:$backendPort...' -ForegroundColor Green; dotnet run"

Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd -WorkingDirectory "$rootPath"

Write-Host "  Waiting for Backend to initialize and become healthy..." -ForegroundColor Gray
$backendHealthy = $false
$retries = 25
while ($retries -gt 0 -and -not $backendHealthy) {
    Start-Sleep -Seconds 2
    try {
        $health = Invoke-RestMethod -Uri "http://localhost:$backendPort/health" -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($health.status -eq "Healthy") {
            $backendHealthy = $true
        }
    } catch { }
    $retries--
    Write-Host -NoNewline "."
}
Write-Host ""

if ($backendHealthy) {
    Write-Host "  [OK] Backend API is Healthy at http://localhost:$backendPort" -ForegroundColor Green
    Write-Host "  [OK] Swagger Docs: http://localhost:$backendPort/swagger" -ForegroundColor Green
} else {
    Write-Host "  [INFO] Backend is still starting up in its dedicated window." -ForegroundColor Yellow
}

# ── 4. Start Frontend Web ─────────────────────────────────────
Write-Host "`n[4/4] Starting Vite + React Frontend..." -ForegroundColor Yellow
$frontendCmd = "cd '$rootPath/frontend/employee-management-web'; `$env:PORT='$frontendPort'; `$env:VITE_API_URL='http://localhost:$backendPort'; Write-Host 'Starting Frontend dev server on http://localhost:$frontendPort...' -ForegroundColor Green; npm run dev"

Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd -WorkingDirectory "$rootPath"

# Wait a few seconds for Vite to start
Start-Sleep -Seconds 3

# Launch default browser
try {
    Start-Process "http://localhost:$frontendPort"
} catch { }

# ── Summary & Login Info ──────────────────────────────────────
Write-Host "`n==================================================================" -ForegroundColor Green
Write-Host "            TEAMTIME HR SYSTEM IS RUNNING LOCALLY!                " -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend UI:    http://localhost:$frontendPort" -ForegroundColor Cyan
Write-Host "  Backend API:    http://localhost:$backendPort" -ForegroundColor Cyan
Write-Host "  Swagger UI:     http://localhost:$backendPort/swagger" -ForegroundColor Cyan
Write-Host "  Health Status:  http://localhost:$backendPort/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "------------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "  Demo Login Credentials (Ready to use):" -ForegroundColor White
Write-Host "  [ADMIN]    Email: admin@company.com    | Password: admin123" -ForegroundColor Yellow
Write-Host "  [MANAGER]  Email: manager@company.com  | Password: Password123!" -ForegroundColor Yellow
Write-Host "  [EMPLOYEE] Email: employee@company.com | Password: Password123!" -ForegroundColor Yellow
Write-Host "------------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "To shut down: Simply close the two spawned PowerShell windows." -ForegroundColor Gray
Write-Host ""
