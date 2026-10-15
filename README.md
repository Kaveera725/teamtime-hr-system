# Employee Leave & Attendance Management System

A full-stack enterprise HR application for employee leave and attendance management, designed according to strict domain-driven layered architecture standards.

## Tech Stack

- **Backend**: ASP.NET Core Web API (.NET 10), C#
- **ORM / Persistence**: Entity Framework Core with Npgsql (PostgreSQL 16)
- **Authentication**: JWT Bearer Tokens
- **Logging**: Serilog (structured console logging)
- **API Documentation**: OpenAPI / Swagger (Swashbuckle)
- **Testing**: xUnit with integration & unit test suites
- **Frontend**: React + TypeScript (Vite) *(in progress)*
- **Local Database**: Docker Compose (PostgreSQL 16)

---

## Repository Structure

```
├── .env.example                          # Environment variables template
├── .gitignore                            # Standard .NET / Node / Secret ignore rules
├── docker-compose.dev.yml                # Local PostgreSQL 16 container with healthcheck
├── README.md
├── docs/
│   └── PROJECT_DOCUMENTATION.md          # Comprehensive specification & architecture guide
├── backend/
│   ├── EmployeeManagement.slnx           # Solution file
│   ├── EmployeeManagement.API/           # ASP.NET Core Web API
│   │   ├── Controllers/                  # API Controllers (HTTP routing, DTO contracts)
│   │   ├── Data/                         # EF Core DbContext, entity configurations, seed data
│   │   ├── Models/                       # Domain Entities
│   │   ├── DTOs/                         # Request & Response Data Transfer Objects
│   │   ├── Interfaces/                   # Service interfaces
│   │   ├── Services/                     # Business logic and domain validation
│   │   ├── Middleware/                   # Global exception handler & middleware
│   │   ├── Migrations/                   # EF Core database migrations
│   │   ├── Program.cs                    # Application bootstrapping & DI configuration
│   │   └── appsettings.json
│   └── EmployeeManagement.Tests/         # xUnit unit and integration tests
└── frontend/                             # React + TypeScript client (Vite)
```

---

## 🚀 Quick Start (Run Locally)

For complete instructions, refer to **[RUN_LOCALLY.md](file:///RUN_LOCALLY.md)**.

### Option 1: Instant 1-Click Launch (Windows)
Double-click [`start-dev.bat`](file:///start-dev.bat) or run in PowerShell:
```powershell
.\start-dev.ps1
```
*(Starts Database verification, Backend API on port 5076/5000, Frontend on port 3000/3001, and launches your browser)*

### Option 2: Docker Compose (All 3 in Containers)
```bash
docker compose up --build
```
- **Frontend App:** [http://localhost:3001](http://localhost:3001)
- **Backend Swagger:** [http://localhost:5076/swagger](http://localhost:5076/swagger)
- **Health Check:** [http://localhost:5076/health](http://localhost:5076/health)

### 🔑 Demo Login Accounts

| Role | Email | Password |
| :--- | :--- | :--- |
| **Admin** | `admin@company.com` | `admin123` |
| **Manager** | `manager@company.com` | `Password123!` |
| **Employee** | `employee@company.com` | `Password123!` |

---

## 🛠️ Step-by-Step Manual Startup

### 1. Start the PostgreSQL Database

If using Docker:
```bash
docker compose up -d db
```

Verify that the container is healthy:

```bash
docker compose -f docker-compose.dev.yml ps
```

### 2. Configure Environment Secrets

Copy `.env.example` to `.env` or configure user-secrets for local development:

```bash
cd backend/EmployeeManagement.API
dotnet user-secrets init
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Port=5432;Database=employee_management;Username=postgres;Password=postgres_dev_password_change_me"
dotnet user-secrets set "Jwt:Key" "super_secret_jwt_key_that_is_at_least_32_characters_long_for_security"
```

### 3. Build & Run the Backend API

From the repository root:

```bash
dotnet build backend/EmployeeManagement.slnx
dotnet run --project backend/EmployeeManagement.API
```

Access Swagger UI:
- Interactive API Docs: [http://localhost:5076/swagger](http://localhost:5076/swagger)
- Health Check: [http://localhost:5076/health](http://localhost:5076/health)

### 4. Run Automated Tests

Execute unit and integration tests:

```bash
dotnet test backend/EmployeeManagement.slnx
```