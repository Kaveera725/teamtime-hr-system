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

## Getting Started (Local Development)

### Prerequisites

- [.NET SDK 10](https://dotnet.microsoft.com/)
- [Docker & Docker Compose](https://www.docker.com/)
- [Node.js (LTS) & npm](https://nodejs.org/)

### 1. Start the Local PostgreSQL Database

Launch the dedicated local PostgreSQL 16 container:

```bash
docker compose -f docker-compose.dev.yml up -d
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