#!/usr/bin/env bash
# ==============================================================================
# TeamTime HR System - Startup Script (Linux / macOS / WSL)
# ==============================================================================
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=================================================================="
echo "          TeamTime HR System - Localhost Startup                  "
echo "=================================================================="

# Check Docker / PostgreSQL
if ! nc -z localhost 5432 2>/dev/null; then
  echo "PostgreSQL not detected on localhost:5432. Starting via Docker..."
  docker compose up -d db
fi

# Set default ports
BACKEND_PORT=5076
FRONTEND_PORT=3000

echo "Starting Backend API on port $BACKEND_PORT..."
export ASPNETCORE_URLS="http://localhost:$BACKEND_PORT"
export ASPNETCORE_ENVIRONMENT="Development"
(cd "$ROOT_DIR/backend/EmployeeManagement.API" && dotnet run) &
BACKEND_PID=$!

echo "Starting Frontend Web on port $FRONTEND_PORT..."
export PORT="$FRONTEND_PORT"
export VITE_API_URL="http://localhost:$BACKEND_PORT"
(cd "$ROOT_DIR/frontend/employee-management-web" && npm run dev) &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true" EXIT

echo ""
echo "=================================================================="
echo "TeamTime HR System is running!"
echo "Frontend: http://localhost:$FRONTEND_PORT"
echo "Backend:  http://localhost:$BACKEND_PORT/swagger"
echo "Press Ctrl+C to stop all services."
echo "=================================================================="

wait
