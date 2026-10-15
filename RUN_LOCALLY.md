# 🚀 Running TeamTime HR System on Localhost

Complete guide to running the **TeamTime Employee Leave & Attendance Management System** (Database, Backend API, and Frontend Web) together on your local machine.

---

## 📋 Architecture & Local Port Map

| Component | Technology | Default Local Port | Container Port | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend** | React 19 + Vite + TypeScript + Tailwind CSS | `http://localhost:3000` (or `3001`) | `80` | Web application with role-based UI |
| **Backend API** | ASP.NET Core (.NET 10 Web API) | `http://localhost:5076` (or `5000`) | `5000` | REST API, JWT auth, Swagger UI, Business logic |
| **Database** | PostgreSQL 16 | `localhost:5432` | `5432` | Relational database with EF Core migrations |

> **Port Conflict Protection:** The system automatically checks ports. If port `5000` or `3000` is already in use by another project, the launcher automatically selects `5076` for the backend and `3001` for the frontend.

---

## 🛠️ Prerequisites

Ensure you have the following installed on your machine:

1. **.NET SDK**: Version `10.0` or higher ([Download .NET](https://dotnet.microsoft.com/download))
   - Verify: `dotnet --version`
2. **Node.js**: Version `18.0` or higher ([Download Node.js](https://nodejs.org/))
   - Verify: `node -v`
3. **Database Option A (Native)**: Local PostgreSQL 14+ running on port `5432` ([Download PostgreSQL](https://www.postgresql.org/download/))
   - **OR Database Option B (Docker)**: Docker Desktop running ([Download Docker Desktop](https://www.docker.com/products/docker-desktop/))

---

## ⚡ Method 1: Instant 1-Click Startup (Recommended)

We provide automatic startup scripts that launch the Database, Backend, and Frontend together with a single action:

### On Windows:
- **Option A (Double-click):** Double-click [`start-dev.bat`](file:///start-dev.bat) in the project root.
- **Option B (PowerShell):** Open PowerShell in the project root and run:
  ```powershell
  .\start-dev.ps1
  ```
- **Option C (npm):**
  ```bash
  npm run dev
  ```

### On Linux / macOS / WSL:
```bash
chmod +x ./start-dev.sh
./start-dev.sh
```

**What the script does automatically:**
1. Verifies PostgreSQL connectivity on port `5432`.
2. Automatically detects free ports to prevent collisions.
3. Automatically runs pending EF Core migrations on database startup.
4. Starts the ASP.NET Core Backend in a dedicated window.
5. Waits for the `/health` endpoint to confirm database and API readiness.
6. Starts the Vite React frontend in a dedicated window.
7. Automatically launches your default browser at `http://localhost:3000` (or `3001`).

---

## 🐳 Method 2: Run All 3 with Docker Compose

If you have Docker Desktop running, you can launch the database, backend, and frontend inside isolated Docker containers:

1. Make sure Docker Desktop is started.
2. In the project root, run:
   ```bash
   docker compose up --build
   ```
3. To run in detached (background) mode:
   ```bash
   docker compose up -d --build
   ```
4. Access the applications:
   - **Frontend UI:** [http://localhost:3001](http://localhost:3001)
   - **Backend API & Swagger:** [http://localhost:5076/swagger](http://localhost:5076/swagger)
   - **Health Check:** [http://localhost:5076/health](http://localhost:5076/health)
5. To shut down:
   ```bash
   docker compose down
   ```

---

## 🔨 Method 3: Step-by-Step Manual Startup

If you prefer to start each service manually in separate terminal tabs:

### Step 1: Ensure PostgreSQL Database is Running
- If you have local PostgreSQL installed as a Windows service:
  Ensure the service is started and listening on port `5432`.
- If using Docker just for the database:
  ```bash
  docker compose up -d db
  ```

### Step 2: Seed Demo Data (Optional, One-Time)
Populate realistic demo employees, departments, managers, 6 weeks of attendance records, and leave requests:
```bash
dotnet run --project backend/EmployeeManagement.API -- seed-demo
```

### Step 3: Start the Backend API
```bash
cd backend/EmployeeManagement.API
dotnet run
```
*The backend will automatically apply any pending EF Core migrations and verify the Admin account on launch.*
- Backend Swagger UI: [http://localhost:5076/swagger](http://localhost:5076/swagger)
- Backend Health Check: [http://localhost:5076/health](http://localhost:5076/health)

### Step 4: Start the Frontend Web
Open a second terminal window:
```bash
cd frontend/employee-management-web
npm install
npm run dev
```
- Frontend Web UI: [http://localhost:3000](http://localhost:3000)

---

## 🔑 Pre-Configured Demo Credentials

The database comes pre-seeded with accounts for all 3 roles:

| Role | Email Address | Password | Permissions & Views |
| :--- | :--- | :--- | :--- |
| **System Admin** | `admin@company.com` | `admin123` | Department management, leave approval, full company dashboard, stats & charts |
| **Team Manager** | `manager@company.com` | `Password123!` | Team attendance overview, department leave approvals / rejections, team calendar |
| **Employee** | `employee@company.com` | `Password123!` | Daily check-in/check-out, leave balance rings, submit leave request with live preview |

---

## 🔍 Verifying the System

Once started, test each layer:

1. **Frontend App**: Navigate to [http://localhost:3000](http://localhost:3000) (or `3001`) in your browser.
   - You should see the login screen with dark/light mode toggle.
2. **Login Test**: Enter `admin@company.com` and `admin123`.
   - You will land on the Admin Dashboard displaying employee headcounts, attendance donut charts, and monthly leave charts.
3. **API Swagger Docs**: Open [http://localhost:5076/swagger](http://localhost:5076/swagger)
   - Interactive OpenAPI documentation listing all endpoints (`/api/auth`, `/api/leave-requests`, `/api/attendance`, `/api/dashboard`, `/api/departments`).
4. **Health Check**: Open [http://localhost:5076/health](http://localhost:5076/health)
   - Returns JSON status: `{"status":"Healthy","database":"Connected"}`.

---

## ❓ Troubleshooting & FAQs

### Port 5000 or 3000 is already in use
The launcher scripts automatically detect occupied ports and route backend traffic to `5076` and frontend to `3001`.
You can also manually set custom ports when starting:
```powershell
$env:ASPNETCORE_URLS="http://localhost:5050"
$env:PORT="3005"
$env:VITE_API_URL="http://localhost:5050"
```

### Database connection fails
- Verify your PostgreSQL username and password in `backend/EmployeeManagement.API/appsettings.Development.json` or `.env`.
- Default connection string configured:
  ```
  Host=localhost;Port=5432;Database=employee_management_hr;Username=postgres;Password=postgres
  ```
- If your local Postgres user has a different password, update it with:
  ```powershell
  cd backend/EmployeeManagement.API
  dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Port=5432;Database=employee_management_hr;Username=postgres;Password=YOUR_PASSWORD"
  ```

### Re-seeding Demo Data
To re-run the demo seeder anytime:
```bash
dotnet run --project backend/EmployeeManagement.API -- seed-demo
```
The seeder is idempotent and safe to run multiple times without duplicating data.
