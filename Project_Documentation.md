# Employee Leave & Attendance Management System

*Project Documentation: Requirements, Architecture, Design and Operations*

| Item | Detail |
| --- | --- |
| Document version | 1.0 (Draft) |
| Date | 7 October 2026 |
| Prepared by | Anushad Kaveera |
| Technology stack | React + TypeScript, ASP.NET Core Web API, Entity Framework Core, PostgreSQL, JWT, Docker |
| Status | Planned project, pre-implementation |

## Contents

1. [Introduction](#1-introduction)
2. [System Overview](#2-system-overview)
3. [Functional Requirements](#3-functional-requirements)
4. [Non-Functional Requirements](#4-non-functional-requirements)
5. [Business Rules](#5-business-rules)
6. [System Architecture](#6-system-architecture)
7. [Database Design](#7-database-design)
8. [API Specification](#8-api-specification)
9. [Security Design](#9-security-design)
10. [Frontend Design](#10-frontend-design)
11. [Deployment and DevOps](#11-deployment-and-devops)
12. [Testing Strategy](#12-testing-strategy)
13. [Project Plan and Milestones](#13-project-plan-and-milestones)
14. [Risk Register](#14-risk-register)
15. [Future Enhancements](#15-future-enhancements)
16. [Appendix A: Local Setup Guide](#appendix-a-local-setup-guide)
17. [Appendix B: Glossary](#appendix-b-glossary)

## 1. Introduction

### 1.1 Purpose

This document describes the requirements, design and operation of the Employee Leave & Attendance Management System. It is the single reference for what the system does, how it is built, and how it is deployed and tested.

### 1.2 Scope

The system lets employees record daily attendance and apply for leave, lets managers review leave requests and monitor their teams, and lets administrators manage employees, departments and leave policy. Version 1 covers authentication, employee and department management, attendance, leave requests and balances, and a role-based dashboard.

#### Out of scope for version 1

- Payroll and salary processing
- Email and push notifications
- Refresh tokens and two-factor authentication
- Public holiday management and calendar view
- Shift scheduling and overtime
- Multi-company (multi-tenant) support

### 1.3 Intended audience

| Audience | Use of this document |
| --- | --- |
| Developers | Implementation reference for API, data model and business rules |
| DevOps / operators | Deployment, configuration and monitoring guidance |
| Testers | Requirements and rules to derive test cases |
| Reviewers and recruiters | Overview of architecture and engineering decisions |

### 1.4 Conventions

Requirement identifiers follow the pattern FR-MODULE-NN for functional requirements, NFR-NN for non-functional requirements and BR-NN for business rules. Business rules marked as proposed defaults should be confirmed before implementation.

## 2. System Overview

### 2.1 Product description

A web application with a React single-page frontend that communicates over HTTPS and JSON with an ASP.NET Core Web API. The API applies business rules in a service layer and persists data in PostgreSQL through Entity Framework Core.

### 2.2 User roles

| Role | Description | Key capabilities |
| --- | --- | --- |
| Employee | Any staff member | View profile, check in/out, view attendance, apply for and cancel leave, view leave balance |
| Manager | Leads a department | All employee capabilities, plus view team, view team attendance, approve or reject team leave, view team statistics |
| Admin | System administrator / HR | All manager capabilities, plus manage users, employees, departments and leave types, view system statistics |

### 2.3 Assumptions and constraints

- Each user account is linked to exactly one employee record.
- A team is defined as the employees in the department a manager manages.
- The standard working week is Monday to Friday.
- All timestamps are stored in UTC; calendar dates (leave and attendance dates) are stored as dates without time.
- Self-registration is not available. Accounts are created by an administrator.
- The system is deployed as a containerised monolith for version 1.

## 3. Functional Requirements

### 3.1 Authentication and accounts

| ID | Requirement | Roles |
| --- | --- | --- |
| FR-AUTH-01 | A user can log in with email and password and receives a JWT access token. | All |
| FR-AUTH-02 | An administrator can create user accounts and assign a role. Public registration is disabled. | Admin |
| FR-AUTH-03 | A logged-in user can retrieve their own identity, role and employee profile. | All |
| FR-AUTH-04 | A user can change their own password. | All |
| FR-AUTH-05 | Deactivated accounts cannot log in and existing tokens stop working at expiry. | System |

### 3.2 Employee management

| ID | Requirement | Roles |
| --- | --- | --- |
| FR-EMP-01 | An administrator can create an employee linked to a user account and a department. | Admin |
| FR-EMP-02 | An administrator can update employee details. | Admin |
| FR-EMP-03 | An administrator can deactivate an employee. Records are never hard-deleted. | Admin |
| FR-EMP-04 | Employee lists support search, filtering by department and status, and pagination. Admin sees all; manager sees own team. | Admin, Manager |
| FR-EMP-05 | A user can view their own profile; managers and admins can view profiles within their scope. | All |

### 3.3 Department management

| ID | Requirement | Roles |
| --- | --- | --- |
| FR-DEP-01 | An administrator can create, update and list departments. | Admin |
| FR-DEP-02 | An administrator can assign a manager to a department. | Admin |

### 3.4 Attendance

| ID | Requirement | Roles |
| --- | --- | --- |
| FR-ATT-01 | An employee can check in once per working day. | All |
| FR-ATT-02 | An employee can check out only after checking in on the same day. | All |
| FR-ATT-03 | The system sets the attendance status (PRESENT, LATE, HALF_DAY, ABSENT) from the configured rules. | System |
| FR-ATT-04 | An employee can view their own attendance history for a date range. | All |
| FR-ATT-05 | A manager can view attendance for their team; an admin can view all attendance. | Manager, Admin |
| FR-ATT-06 | Today's attendance summary is available for teams and the whole organisation. | Manager, Admin |

### 3.5 Leave management

| ID | Requirement | Roles |
| --- | --- | --- |
| FR-LEV-01 | An employee can submit a leave request with leave type, dates and reason. | All |
| FR-LEV-02 | The system validates dates, overlap, and leave balance before accepting a request. | System |
| FR-LEV-03 | An employee can view their own leave requests and current leave balances. | All |
| FR-LEV-04 | An employee can cancel a pending request, or an approved request that has not started. | All |
| FR-LEV-05 | A manager can approve or reject pending requests from their team. A rejection requires a reason. | Manager |
| FR-LEV-06 | An administrator can approve or reject requests from managers. | Admin |
| FR-LEV-07 | Approving a request deducts the days from the employee's balance in the same transaction. | System |
| FR-LEV-08 | An administrator can create, update and deactivate leave types and their default allocation. | Admin |
| FR-LEV-09 | Leave balances are created for each employee and leave type at the start of each year or on joining. | System |

### 3.6 Dashboard

| ID | Requirement | Roles |
| --- | --- | --- |
| FR-DSH-01 | Employee dashboard: leave balances, today's attendance status and recent requests. | All |
| FR-DSH-02 | Manager dashboard: pending approvals, who is present, absent or on leave today. | Manager |
| FR-DSH-03 | Admin dashboard: headcount, department breakdown, attendance and leave summary. | Admin |

## 4. Non-Functional Requirements

| ID | Category | Requirement |
| --- | --- | --- |
| NFR-01 | Performance | Standard API calls respond within 500 ms at the 95th percentile with 100 concurrent users (target). |
| NFR-02 | Security | All traffic uses HTTPS. Passwords are hashed. Every endpoint enforces authentication and role-based authorization, with resource-level checks. |
| NFR-03 | Data integrity | Leave approval and balance updates are atomic. Unique constraints prevent duplicate attendance and balance rows. Concurrent approvals cannot corrupt balances. |
| NFR-04 | Availability | The system exposes a health endpoint and restarts automatically on failure. Target availability of 99% for a single-instance deployment. |
| NFR-05 | Maintainability | Layered code structure, dependency injection, interface-based services, and automated tests for business rules. |
| NFR-06 | Usability | Responsive interface that works on desktop and mobile browsers. Clear validation messages. |
| NFR-07 | Portability | The full stack runs from one docker-compose file locally and in deployment. |
| NFR-08 | Observability | Structured application logs, health checks, and basic request metrics. |
| NFR-09 | Auditability | Leave decisions record the approver and timestamp. A full audit log is a planned enhancement. |

## 5. Business Rules

> **Note:** The rules below are proposed defaults. Confirm or adjust them before implementing LeaveService and AttendanceService, because most business logic depends on them.

| ID | Area | Rule |
| --- | --- | --- |
| BR-01 | Day counting | Leave days count Monday to Friday only. Weekends are excluded. Public holidays are excluded once holiday support is added. |
| BR-02 | Half-day | A half-day request is allowed only when start date equals end date, giving 0.5 days. |
| BR-03 | Overlap | A request is rejected if it overlaps any PENDING or APPROVED request of the same employee. |
| BR-04 | Balance check | Requested days must not exceed remaining days minus days in pending requests for that type and year. No Pay Leave is exempt. |
| BR-05 | Deduction | Pending requests do not change used_days. Days are deducted when the request is approved. |
| BR-06 | Cancellation | An employee can cancel a PENDING request. An APPROVED request can be cancelled before its start date, and the days are restored. |
| BR-07 | Approval authority | A manager approves only requests from employees in their own department and never their own request. Manager requests are approved by an admin. |
| BR-08 | Year boundary | A request cannot span two calendar years. It must be submitted as two requests. |
| BR-09 | Past dates | The start date must be today or later, except Medical Leave, which may be backdated up to 3 days. |
| BR-10 | Check-in | One attendance record per employee per day. Check-in is allowed on working days only. |
| BR-11 | Late | A check-in after 09:00 local time is marked LATE. The threshold is configurable. |
| BR-12 | Half-day attendance | A worked duration under 4 hours is marked HALF_DAY. |
| BR-13 | Absent | A working day with no attendance record and no approved leave is reported as ABSENT. |
| BR-14 | Missed check-out | A record without check-out at end of day stays open and is flagged for correction. |
| BR-15 | Balances | Balances are per employee, leave type and calendar year. No carry-forward in version 1. |

### 5.1 Leave request status flow

```
PENDING --> APPROVED --> CANCELLED (before start date)
   |
   +-----> REJECTED
   |
   +-----> CANCELLED (by employee)
```

REJECTED and CANCELLED are terminal states. Only the transitions shown are allowed, and the service layer must reject any other transition.

### 5.2 Leave request validation sequence

1. Employee exists and is active.
2. Leave type exists and is active.
3. Start date is on or before end date, within one calendar year, and satisfies the past-date rule.
4. Calculate total days using BR-01 and BR-02. Reject requests that contain zero working days.
5. No overlap with existing PENDING or APPROVED requests.
6. Sufficient balance (BR-04).
7. Create the request with status PENDING.

## 6. System Architecture

### 6.1 Architectural style

The system uses a three-tier layered architecture: a React presentation tier, an ASP.NET Core application tier (controllers, services, data access), and a PostgreSQL data tier. The backend is a single deployable unit (modular monolith).

```
User
  |  HTTPS
  v
React + TypeScript (SPA)
  |  REST / JSON
  v
ASP.NET Core Web API
  Controllers  -> HTTP, validation, auth attributes
  Services     -> business rules, transactions
  EF Core      -> DbContext, entities, migrations
  |  SQL (Npgsql)
  v
PostgreSQL
```

### 6.2 Layer responsibilities

| Layer | Responsibility | Must not |
| --- | --- | --- |
| Controllers | Receive requests, bind and validate DTOs, call services, return HTTP responses | Contain business logic or database queries |
| Services | Enforce business rules, coordinate transactions, map entities to DTOs | Know about HTTP concepts |
| Data (EF Core) | Entities, DbContext, relationships, migrations, queries | Contain business decisions |
| DTOs | Define exactly what enters and leaves the API | Expose sensitive fields such as password_hash |
| Middleware | Global exception handling, logging, authentication pipeline | Contain feature logic |

### 6.3 Technology stack

| Concern | Technology |
| --- | --- |
| Frontend | React, TypeScript, React Router, an HTTP client (Axios or fetch), a component library of choice |
| Backend | ASP.NET Core Web API on the current supported .NET SDK, C# |
| ORM | Entity Framework Core with Npgsql provider |
| Database | PostgreSQL |
| Authentication | JWT bearer tokens (Microsoft.AspNetCore.Authentication.JwtBearer) |
| API docs | Swagger / OpenAPI |
| Validation | DataAnnotations or FluentValidation |
| Logging | Serilog (structured logs) |
| Testing | xUnit, WebApplicationFactory, Testcontainers, React Testing Library |
| Containers | Docker and Docker Compose |
| CI/CD | GitHub Actions |
| Hosting | AWS (EC2 or ECS, RDS PostgreSQL, ECR, Secrets Manager) |

### 6.4 Request flow example: apply for leave

```
POST /api/leave-requests
  -> LeaveRequestsController (authenticated, any role)
  -> LeaveService.CreateAsync(employeeId, dto)
       check employee, leave type, dates
       calculate working days
       check overlap and balance
       insert leave_requests (PENDING)
  -> EF Core SaveChangesAsync
  -> PostgreSQL INSERT
  -> 201 Created + LeaveRequestResponseDto
```

### 6.5 Backend project structure

```
EmployeeManagement.API/
  Controllers/    Auth, Employees, Departments,
                  Attendance, LeaveRequests, LeaveTypes
  Data/           ApplicationDbContext.cs, configurations, seed data
  Models/         User, Employee, Department, Attendance,
                  LeaveType, LeaveRequest, LeaveBalance
  DTOs/           Auth, Employee, Attendance, Leave
  Interfaces/     IAuthService, IEmployeeService,
                  IAttendanceService, ILeaveService
  Services/       AuthService, EmployeeService,
                  AttendanceService, LeaveService
  Middleware/     ExceptionMiddleware.cs
  Migrations/
  Program.cs
  appsettings.json / appsettings.Development.json
```

### 6.6 Repository structure

```
employee-leave-attendance/
  backend/EmployeeManagement.API/
  backend/EmployeeManagement.Tests/
  frontend/employee-management-web/
  docker-compose.yml
  .github/workflows/
  README.md
  .gitignore
```

## 7. Database Design

### 7.1 Entity relationships

```
users 1 --- 1 employees
departments 1 --- N employees
departments N --- 1 employees (manager, nullable)
employees 1 --- N attendance
employees 1 --- N leave_requests
employees 1 --- N leave_balances
leave_types 1 --- N leave_requests
leave_types 1 --- N leave_balances
```

> **Note:** Changes from the initial plan: remaining_days is removed from leave_balances and computed as allocated_days minus used_days; approved_by references employees (not users) for consistency; unique constraints and a concurrency token are added.

### 7.2 users

Authentication identity and system role.

| Column | Type | Constraints / notes |
| --- | --- | --- |
| `id` | BIGINT identity | Primary key |
| `email` | VARCHAR(255) | Unique, not null |
| `password_hash` | TEXT | Not null. Never returned by the API |
| `role` | VARCHAR(30) | ADMIN, MANAGER or EMPLOYEE (enum stored as string) |
| `is_active` | BOOLEAN | Default true |
| `created_at, updated_at` | TIMESTAMPTZ | UTC |

### 7.3 employees

Personal and job information for each staff member.

| Column | Type | Constraints / notes |
| --- | --- | --- |
| `id` | BIGINT identity | Primary key |
| `user_id` | BIGINT | FK to users, unique (one-to-one) |
| `employee_code` | VARCHAR(20) | Unique, for example EMP001 |
| `first_name, last_name` | VARCHAR(100) | Not null |
| `phone` | VARCHAR(20) | Nullable |
| `department_id` | BIGINT | FK to departments |
| `position` | VARCHAR(100) | Job title |
| `joined_date` | DATE | Not null |
| `status` | VARCHAR(30) | ACTIVE or INACTIVE |
| `created_at, updated_at` | TIMESTAMPTZ | UTC |

### 7.4 departments

Organisational units.

| Column | Type | Constraints / notes |
| --- | --- | --- |
| `id` | BIGINT identity | Primary key |
| `name` | VARCHAR(100) | Unique, not null |
| `description` | TEXT | Nullable |
| `manager_id` | BIGINT | Nullable FK to employees. Circular reference with employees.department_id, so configure explicitly in EF Core |
| `created_at` | TIMESTAMPTZ | UTC |

### 7.5 attendance

One row per employee per working day.

| Column | Type | Constraints / notes |
| --- | --- | --- |
| `id` | BIGINT identity | Primary key |
| `employee_id` | BIGINT | FK to employees |
| `attendance_date` | DATE | Unique together with employee_id |
| `check_in` | TIMESTAMPTZ | UTC |
| `check_out` | TIMESTAMPTZ | Nullable until check-out |
| `status` | VARCHAR(30) | PRESENT, LATE, HALF_DAY or ABSENT |
| `notes` | TEXT | Optional |
| `created_at` | TIMESTAMPTZ | UTC |

### 7.6 leave_types

Configurable leave categories.

| Column | Type | Constraints / notes |
| --- | --- | --- |
| `id` | BIGINT identity | Primary key |
| `name` | VARCHAR(50) | Unique. Seed: Annual, Casual, Medical, No Pay |
| `description` | TEXT | Nullable |
| `default_days` | INTEGER | Annual allocation, for example 14, 7, 14, 0 |
| `is_active` | BOOLEAN | Default true |
| `created_at` | TIMESTAMPTZ | UTC |

### 7.7 leave_requests

Leave applications and their decisions.

| Column | Type | Constraints / notes |
| --- | --- | --- |
| `id` | BIGINT identity | Primary key |
| `employee_id` | BIGINT | FK to employees |
| `leave_type_id` | BIGINT | FK to leave_types |
| `start_date, end_date` | DATE | Check: end_date \>= start_date |
| `total_days` | NUMERIC(4,1) | Working days per BR-01, BR-02 |
| `reason` | TEXT | Employee reason |
| `status` | VARCHAR(30) | PENDING, APPROVED, REJECTED or CANCELLED |
| `approved_by` | BIGINT | Nullable FK to employees (the decision maker) |
| `approved_at` | TIMESTAMPTZ | Nullable |
| `rejection_reason` | TEXT | Required when status is REJECTED |
| `created_at, updated_at` | TIMESTAMPTZ | UTC |
| `xmin (system column)` | xid | Mapped as concurrency token to prevent double approval |

### 7.8 leave_balances

Yearly allocation and usage per employee and leave type.

| Column | Type | Constraints / notes |
| --- | --- | --- |
| `id` | BIGINT identity | Primary key |
| `employee_id` | BIGINT | FK to employees |
| `leave_type_id` | BIGINT | FK to leave_types |
| `year` | INTEGER | Calendar year. Unique with employee_id and leave_type_id |
| `allocated_days` | NUMERIC(4,1) | Allocation for the year |
| `used_days` | NUMERIC(4,1) | Increased on approval, restored on cancellation |
| `created_at, updated_at` | TIMESTAMPTZ | UTC |

### 7.9 Indexes and constraints

- Unique: users(email), employees(employee_code), employees(user_id), departments(name), leave_types(name).
- Unique: attendance(employee_id, attendance_date).
- Unique: leave_balances(employee_id, leave_type_id, year).
- Index: leave_requests(employee_id, status), leave_requests(start_date, end_date), attendance(attendance_date).
- Check: leave_requests end_date \>= start_date; leave_balances used_days \>= 0 and used_days \<= allocated_days (except No Pay Leave).
- Foreign keys use restrictive delete behaviour. Employees are deactivated, not deleted.

### 7.10 Seed data

- Leave types: Annual Leave (14), Casual Leave (7), Medical Leave (14), No Pay Leave (0).
- Departments: IT, HR, Finance, Marketing.
- One administrator account created on first run from environment configuration, never from a hard-coded password.

## 8. API Specification

Base path: /api. All endpoints except POST /api/auth/login require an Authorization: Bearer \<token\> header. Request and response bodies are JSON. Interactive documentation is served by Swagger at /swagger in development.

### 8.1 Authentication

| Method | Endpoint | Purpose | Access |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | Authenticate and receive a JWT | Public |
| GET | `/api/auth/me` | Current user and employee profile | Authenticated |
| POST | `/api/auth/change-password` | Change own password | Authenticated |
| POST | `/api/users` | Create a user account | Admin |

### 8.2 Employees

| Method | Endpoint | Purpose | Access |
| --- | --- | --- | --- |
| GET | `/api/employees` | List with search, filter, pagination | Admin, Manager (team) |
| GET | `/api/employees/{id}` | Get one employee | Own, Manager (team), Admin |
| POST | `/api/employees` | Create employee | Admin |
| PUT | `/api/employees/{id}` | Update employee | Admin |
| DELETE | `/api/employees/{id}` | Deactivate employee (soft delete) | Admin |

### 8.3 Departments

| Method | Endpoint | Purpose | Access |
| --- | --- | --- | --- |
| GET | `/api/departments` | List departments | Authenticated |
| POST | `/api/departments` | Create department | Admin |
| PUT | `/api/departments/{id}` | Update department, assign manager | Admin |

### 8.4 Attendance

| Method | Endpoint | Purpose | Access |
| --- | --- | --- | --- |
| POST | `/api/attendance/check-in` | Check in for today | Authenticated |
| POST | `/api/attendance/check-out` | Check out for today | Authenticated |
| GET | `/api/attendance/my` | Own history (from, to) | Authenticated |
| GET | `/api/attendance/employee/{employeeId}` | History for an employee | Manager (team), Admin |
| GET | `/api/attendance/today` | Today's summary | Manager, Admin |

### 8.5 Leave requests and types

| Method | Endpoint | Purpose | Access |
| --- | --- | --- | --- |
| POST | `/api/leave-requests` | Submit a request | Authenticated |
| GET | `/api/leave-requests/my` | Own requests | Authenticated |
| GET | `/api/leave-requests` | All requests, filter by status/team | Manager (team), Admin |
| GET | `/api/leave-requests/{id}` | One request | Owner, Manager (team), Admin |
| PUT | `/api/leave-requests/{id}/approve` | Approve | Manager (team), Admin |
| PUT | `/api/leave-requests/{id}/reject` | Reject with reason | Manager (team), Admin |
| PUT | `/api/leave-requests/{id}/cancel` | Cancel | Owner |
| GET | `/api/leave-balances/my` | Own balances for a year | Authenticated |
| GET | `/api/leave-types` | List leave types | Authenticated |
| POST / PUT | `/api/leave-types, /api/leave-types/{id}` | Create or update leave type | Admin |

### 8.6 Example: login

```
POST /api/auth/login
{ "email": "employee@company.com", "password": "********" }

200 OK
{ "token": "<jwt>", "expiresAt": "2026-10-07T10:30:00Z",
  "user": { "id": 3, "email": "employee@company.com", "role": "EMPLOYEE" } }
```

### 8.7 Example: apply for leave

```
POST /api/leave-requests
{ "leaveTypeId": 1, "startDate": "2026-10-10", "endDate": "2026-10-12",
  "reason": "Personal work" }

201 Created
{ "id": 42, "leaveType": "Annual Leave", "startDate": "2026-10-10",
  "endDate": "2026-10-12", "totalDays": 1.0, "status": "PENDING" }
```

### 8.8 Status codes and error format

| Code | Use |
| --- | --- |
| 200 / 201 / 204 | Success, created, success with no body |
| 400 | Validation failure or rule violation (for example insufficient balance) |
| 401 | Missing or invalid token |
| 403 | Authenticated but not allowed (role or resource check) |
| 404 | Resource not found |
| 409 | Conflict (overlapping leave, duplicate check-in, concurrent modification) |
| 500 | Unhandled error, logged and returned as a generic message |

Errors are returned as RFC 7807 ProblemDetails with title, status, detail and, for validation errors, a field-level errors object.

## 9. Security Design

| Area | Design |
| --- | --- |
| Passwords | Hashed with BCrypt or ASP.NET Core PasswordHasher. Minimum length and complexity enforced. Plain text is never stored or logged. |
| JWT | Signed with a strong secret from configuration. Claims: user id, employee id, role. Lifetime 15 to 60 minutes. Issuer, audience, lifetime and signature are validated. |
| Authorization | Role policies (Admin, Manager, Employee) on controllers plus resource checks in services: employees access only their own data, managers only their department. |
| Account creation | Admin-only. First administrator is seeded from environment variables. |
| Secrets | dotnet user-secrets in development, environment variables in containers, AWS Secrets Manager in production. Nothing sensitive in Git. |
| Transport | HTTPS everywhere, HSTS enabled, TLS terminated at the reverse proxy or load balancer. |
| CORS | Only the configured frontend origin is allowed. |
| Input handling | DTO validation on every request. EF Core uses parameterised queries. Responses never include entity fields that are not in a DTO. |
| Brute force | Rate limiting on the login endpoint using the built-in ASP.NET Core rate limiter. |
| Token storage | For version 1 the token is kept in memory or localStorage on the client; an httpOnly cookie is the stronger option and is a planned improvement. |
| Dependencies | Vulnerability scans for NuGet and npm packages and container images in CI. |

### 9.1 Authorization matrix

| Action | Employee | Manager | Admin |
| --- | --- | --- | --- |
| View own profile, attendance, leave | Yes | Yes | Yes |
| Check in / check out | Yes | Yes | Yes |
| Apply for / cancel own leave | Yes | Yes | Yes |
| View team attendance and leave | No | Own team | All |
| Approve / reject leave | No | Own team, not own | All, including managers |
| Manage employees and departments | No | No | Yes |
| Manage leave types and users | No | No | Yes |

## 10. Frontend Design

### 10.1 Pages and routes

| Route | Page | Roles |
| --- | --- | --- |
| `/login` | Login | Public |
| `/` | Dashboard (content varies by role) | All |
| `/attendance` | Check in/out and attendance history | All |
| `/leave` | My leave requests, apply form, balances | All |
| `/team` | Team attendance and members | Manager, Admin |
| `/approvals` | Pending leave approvals | Manager, Admin |
| `/employees` | Employee list and create/edit forms | Admin |
| `/departments` | Department management | Admin |
| `/leave-types` | Leave type management | Admin |
| `/profile` | Own profile and change password | All |

### 10.2 Structure

```
src/
  components/   reusable UI (tables, forms, modals, status badges)
  pages/        Login, Dashboard, Attendance, LeaveRequests, Employees, ...
  services/     api.ts (HTTP client with token interceptor), per-resource calls
  hooks/        useAuth, data-fetching hooks
  types/        TypeScript interfaces matching API DTOs
  routes/       route table and ProtectedRoute (role-aware)
  App.tsx
```

### 10.3 Behaviour

- Protected routes redirect unauthenticated users to /login and hide pages the role cannot access. The backend remains the real enforcement point.
- An HTTP interceptor attaches the token and handles 401 by returning the user to the login page.
- Forms validate input client-side and display server validation messages from ProblemDetails.
- Loading, empty and error states are shown for every data view.

## 11. Deployment and DevOps

### 11.1 Containers

| Service | Image / build | Notes |
| --- | --- | --- |
| db | postgres (official image) | Named volume for data, health check with pg_isready |
| api | Multi-stage .NET build, runtime image | Depends on db, exposes port 8080, /health endpoint |
| web | Node build stage, nginx serving static files | Proxies /api to the api service |

```
services:
  db:
    image: postgres:16
    environment: [POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD]
    volumes: [pgdata:/var/lib/postgresql/data]
  api:
    build: ./backend/EmployeeManagement.API
    environment: [ConnectionStrings__DefaultConnection, Jwt__Key, Jwt__Issuer, Jwt__Audience]
    depends_on: [db]
  web:
    build: ./frontend/employee-management-web
    ports: ["80:80"]
    depends_on: [api]
volumes:
  pgdata:
```

### 11.2 Configuration

| Variable | Purpose |
| --- | --- |
| `ConnectionStrings__DefaultConnection` | PostgreSQL connection string |
| `Jwt__Key / Jwt__Issuer / Jwt__Audience / Jwt__ExpiryMinutes` | Token signing and validation |
| `Cors__AllowedOrigins` | Permitted frontend origin(s) |
| `Seed__AdminEmail / Seed__AdminPassword` | First administrator, used on initial start only |
| `Attendance__LateAfter` | Late threshold, default 09:00 |
| `ASPNETCORE_ENVIRONMENT` | Development, Staging or Production |

### 11.3 CI/CD pipeline (GitHub Actions)

1. Trigger on pull request and on push to main.
2. Backend: restore, build, run unit and integration tests.
3. Frontend: install, lint, test, build.
4. Security: dependency vulnerability check, CodeQL, container image scan.
5. Build Docker images and tag with the commit SHA.
6. On main: push images to Amazon ECR.
7. Deploy to the target environment, run EF Core migrations as a separate controlled step, then verify the /health endpoint.
8. Roll back to the previous image tag if the health check fails.

### 11.4 AWS deployment

- **Compute:** EC2 with Docker Compose for the simplest option, or ECS for managed containers.
- **Database:** RDS PostgreSQL in private subnets, automated backups, security group allowing only the application.
- **Images:** ECR repositories for api and web.
- **Secrets:** AWS Secrets Manager for the JWT key and database credentials, accessed through an IAM role.
- **Network and TLS:** Reverse proxy or load balancer with an HTTPS certificate and HTTP to HTTPS redirect.
- **Infrastructure as code:** Terraform for VPC, security groups, RDS, ECR, IAM and compute (recommended).

### 11.5 Monitoring and operations

- Health endpoint at /health (database connectivity included).
- Serilog structured logs to the console, collected by the container platform.
- Optional Prometheus metrics and Grafana dashboards for request rate, latency and failed logins.
- Daily database backups with a tested restore procedure.

## 12. Testing Strategy

| Level | Tooling | Focus |
| --- | --- | --- |
| Unit | xUnit, Moq or NSubstitute | Day calculation, overlap detection, balance checks, status transitions, attendance status rules |
| Integration | WebApplicationFactory, Testcontainers PostgreSQL | Login, role enforcement, apply and approve leave end to end, unique constraints |
| Security | Integration tests | Broken object-level authorization: employees cannot read others' records, managers cannot approve outside their team or their own request |
| Concurrency | Integration tests | Two simultaneous approvals produce one success and one conflict |
| Frontend | React Testing Library | Login and leave application forms, protected routes |
| Manual / UAT | Swagger, Postman, browser | Complete workflows for each role before release |

### 12.1 Key acceptance scenarios

1. An employee logs in, checks in at 08:30 and out at 17:15, and sees a PRESENT record.
2. A check-in after 09:00 is recorded as LATE.
3. A second check-in on the same day is rejected with 409.
4. An employee applies for 3 days of Annual Leave with sufficient balance; the request is PENDING and the balance is unchanged.
5. An overlapping request is rejected.
6. A request exceeding the available balance is rejected.
7. The manager approves the request; status becomes APPROVED and used_days increases in the same transaction.
8. A manager attempting to approve their own request receives 403.
9. An employee calling another employee's attendance endpoint receives 403.

## 13. Project Plan and Milestones

Estimates assume part-time work of about 10 to 12 hours per week.

| # | Milestone | Deliverable | Estimate |
| --- | --- | --- | --- |
| 1 | Foundations | C# and ASP.NET Core basics, solution created, Swagger running, PostgreSQL in Docker | 1-2 weeks |
| 2 | Data layer | Entities, DbContext, relationships, InitialCreate migration, seed data | 1 week |
| 3 | Authentication | Login, JWT, role policies, admin user creation | 1 week |
| 4 | Core modules | Employee, department and attendance endpoints with tests | 1.5-2 weeks |
| 5 | Leave module | Leave types, balances, requests, approval workflow, concurrency control, unit and integration tests | 2-3 weeks |
| 6 | Frontend | Login, dashboards, attendance, leave and admin pages | 3-4 weeks |
| 7 | DevOps | Docker Compose, CI pipeline, AWS deployment, HTTPS | 1 week |
| 8 | Polish | README, architecture diagram, demo accounts, documentation review | 1 week |

A backend-only release (milestones 1 to 5) with Swagger is a sensible first checkpoint at roughly 6 to 8 weeks.

## 14. Risk Register

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Learning C# and ASP.NET Core while building | High | Medium | Build one thin vertical slice first, then expand |
| Leave logic defects (overlaps, balance drift) | High | High | Write rules down (Section 5), unit test thoroughly, use transactions |
| Time zone and date errors | Medium | Medium | UTC timestamps, DateOnly for calendar dates |
| Scope creep | High | Medium | Freeze version 1 scope, track ideas in Future Enhancements |
| Migration mistakes on production data | Medium | High | Small migrations, review generated SQL, run as a separate pipeline step with backups |
| Secrets committed to Git | Low | High | User-secrets, environment variables, secret scanning in CI |
| Broken object-level authorization | Medium | High | Resource checks in services and dedicated tests |

## 15. Future Enhancements

- **Product features:** leave calendar and team availability, public holidays, notifications, audit log, reports and CSV/PDF export.
- **Deeper logic:** multi-level approval, flexible leave policies, attendance corrections, shifts and overtime, geofenced check-in.
- **Security and quality:** refresh tokens with rotation, two-factor authentication, API versioning, coverage gates, optimistic concurrency everywhere.
- **DevOps:** Terraform for the full stack, security scanning, Prometheus and Grafana, OpenTelemetry, blue/green deployments, separate environments.
- **Differentiators:** AI assistant using the Claude API with role-aware tool calling, smart coverage warnings, multi-tenancy, installable PWA.

## Appendix A: Local Setup Guide

### A.1 Prerequisites

- .NET SDK (current supported version) and the dotnet-ef tool
- Node.js (LTS) and npm
- Docker and Docker Compose
- Git
- VS Code with C# Dev Kit, or Visual Studio Community
- Postman or the built-in Swagger UI

### A.2 Create the backend

```
mkdir employee-leave-attendance && cd employee-leave-attendance
mkdir backend && cd backend
dotnet new webapi -n EmployeeManagement.API
cd EmployeeManagement.API
dotnet add package Microsoft.EntityFrameworkCore
dotnet add package Microsoft.EntityFrameworkCore.Design
dotnet add package Npgsql.EntityFrameworkCore.PostgreSQL
dotnet add package Microsoft.AspNetCore.Authentication.JwtBearer
dotnet tool install --global dotnet-ef
```

### A.3 Start PostgreSQL

```
docker run -d --name employee_db -p 5432:5432 \
  -e POSTGRES_DB=employee_management \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=<choose-a-password> \
  postgres:16
```

### A.4 Configure secrets and run migrations

```
dotnet user-secrets init
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Port=5432;Database=employee_management;Username=postgres;Password=<password>"
dotnet user-secrets set "Jwt:Key" "<long-random-secret>"
dotnet ef migrations add InitialCreate
dotnet ef database update
dotnet run
```

Open http://localhost:\<port\>/swagger to test the API. The port is shown in the console output.

### A.5 Create the frontend

```
cd ../../ && mkdir frontend && cd frontend
npm create vite@latest employee-management-web -- --template react-ts
cd employee-management-web && npm install && npm run dev
```

## Appendix B: Glossary

| Term | Meaning |
| --- | --- |
| API | Application Programming Interface; the HTTP endpoints the frontend calls |
| DTO | Data Transfer Object; a class defining the data entering or leaving the API |
| EF Core | Entity Framework Core; the object-relational mapper used for database access |
| DbContext | The EF Core class that represents a database session and its tables |
| Migration | A versioned change to the database schema generated by EF Core |
| JWT | JSON Web Token; a signed token carrying the user identity and role |
| Dependency injection | A pattern where classes receive their dependencies from the framework rather than creating them |
| ProblemDetails | Standard JSON error format (RFC 7807) |
| Soft delete | Marking a record inactive instead of removing it |
| Concurrency token | A column used to detect that a row changed between read and update |
| UTC | Coordinated Universal Time, used for all stored timestamps |
