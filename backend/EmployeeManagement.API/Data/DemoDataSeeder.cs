using EmployeeManagement.API.Models;
using EmployeeManagement.API.Services;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace EmployeeManagement.API.Data;

/// <summary>
/// Development-only demo data seeder.
/// Seeds ~20 employees across 4 departments with 1 manager per department,
/// 6 weeks of attendance history with realistic status variations,
/// and consistent leave requests across all 4 statuses.
/// Idempotent and strictly blocked outside of the Development environment.
/// </summary>
public static class DemoDataSeeder
{
    public static async Task<bool> SeedDemoDataAsync(
        IServiceProvider serviceProvider,
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        // 1. Strict environment check - never active outside Development
        if (!environment.IsDevelopment())
        {
            Log.Error("Demo data seeding is strictly restricted to the Development environment. Current environment: {Env}", environment.EnvironmentName);
            return false;
        }

        Log.Information("Starting demo data seeding in {Env} environment...", environment.EnvironmentName);

        using var scope = serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        // 2. Seed / Ensure the 4 standard departments exist
        var deptNames = new[] { "IT", "HR", "Finance", "Marketing" };
        var depts = new Dictionary<string, Department>();

        foreach (var name in deptNames)
        {
            var dept = await context.Departments.FirstOrDefaultAsync(d => d.Name == name);
            if (dept == null)
            {
                dept = new Department
                {
                    Name = name,
                    Description = $"{name} Department",
                    CreatedAt = DateTime.UtcNow
                };
                context.Departments.Add(dept);
                await context.SaveChangesAsync();
                Log.Information("Created department: {Department}", name);
            }
            depts[name] = dept;
        }

        // 3. Seed / Ensure the 4 standard leave types exist
        var leaveTypeDefs = new (string Name, int DefaultDays, string Description)[]
        {
            ("Annual Leave", 14, "Paid time off for holidays and vacation"),
            ("Casual Leave", 7, "Short-notice personal time off"),
            ("Medical Leave", 14, "Leave for illness and medical recovery"),
            ("No Pay Leave", 0, "Unpaid approved leave of absence")
        };

        var leaveTypes = new Dictionary<string, LeaveType>();
        foreach (var def in leaveTypeDefs)
        {
            var lt = await context.LeaveTypes.FirstOrDefaultAsync(l => l.Name == def.Name);
            if (lt == null)
            {
                lt = new LeaveType
                {
                    Name = def.Name,
                    DefaultDays = def.DefaultDays,
                    Description = def.Description,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                };
                context.LeaveTypes.Add(lt);
                await context.SaveChangesAsync();
                Log.Information("Created leave type: {LeaveType}", def.Name);
            }
            leaveTypes[def.Name] = lt;
        }

        // 4. Retrieve documented credentials from configuration
        var adminEmail = configuration["Seed:AdminEmail"] ?? "admin@company.com";
        var adminPassword = configuration["Seed:AdminPassword"] ?? "admin123";
        var managerEmail = configuration["Seed:ManagerEmail"] ?? "manager@company.com";
        var managerPassword = configuration["Seed:ManagerPassword"] ?? "Password123!";
        var employeeEmail = configuration["Seed:EmployeeEmail"] ?? "employee@company.com";
        var employeePassword = configuration["Seed:EmployeePassword"] ?? "Password123!";
        var defaultPassword = configuration["Seed:DefaultPassword"] ?? "Password123!";

        // Ensure Admin user exists
        var adminUser = await context.Users.Include(u => u.Employee).FirstOrDefaultAsync(u => u.Email == adminEmail);
        if (adminUser == null)
        {
            adminUser = new User
            {
                Email = adminEmail.ToLowerInvariant(),
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(adminPassword),
                Role = UserRole.ADMIN,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            context.Users.Add(adminUser);
            await context.SaveChangesAsync();

            var adminEmp = new Employee
            {
                UserId = adminUser.Id,
                DepartmentId = depts["IT"].Id,
                EmployeeCode = "EMP000",
                FirstName = "System",
                LastName = "Administrator",
                Position = "System Administrator",
                JoinedDate = new DateOnly(2022, 1, 1),
                Status = EmployeeStatus.ACTIVE,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            context.Employees.Add(adminEmp);
            await context.SaveChangesAsync();
            Log.Information("Seeded Admin account: {Email}", adminEmail);
        }

        // 5. Define ~20 employees across the 4 departments (5 per department, 1 manager each)
        var employeeDefs = new[]
        {
            // IT Department (Manager = Marcus Vance / manager@company.com, Demo Employee = Alex Rivera / employee@company.com)
            (Code: "EMP001", First: "Marcus", Last: "Vance", Email: managerEmail, Dept: "IT", Pos: "Engineering Director", Joined: new DateOnly(2023, 1, 15), Role: UserRole.MANAGER, Pass: managerPassword, IsMgr: true),
            (Code: "EMP002", First: "Alex", Last: "Rivera", Email: employeeEmail, Dept: "IT", Pos: "Senior Software Engineer", Joined: new DateOnly(2023, 6, 1), Role: UserRole.EMPLOYEE, Pass: employeePassword, IsMgr: false),
            (Code: "EMP003", First: "Priya", Last: "Patel", Email: "priya.patel@company.com", Dept: "IT", Pos: "DevOps Engineer", Joined: new DateOnly(2024, 2, 15), Role: UserRole.EMPLOYEE, Pass: defaultPassword, IsMgr: false),
            (Code: "EMP004", First: "Ethan", Last: "Wright", Email: "ethan.wright@company.com", Dept: "IT", Pos: "Frontend Developer", Joined: new DateOnly(2024, 8, 1), Role: UserRole.EMPLOYEE, Pass: defaultPassword, IsMgr: false),
            (Code: "EMP005", First: "Liam", Last: "O'Connor", Email: "liam.oconnor@company.com", Dept: "IT", Pos: "QA Automation Engineer", Joined: new DateOnly(2025, 1, 10), Role: UserRole.EMPLOYEE, Pass: defaultPassword, IsMgr: false),

            // HR Department (Manager = Elena Rostova)
            (Code: "EMP006", First: "Elena", Last: "Rostova", Email: "elena.rostova@company.com", Dept: "HR", Pos: "Head of People & Culture", Joined: new DateOnly(2023, 2, 1), Role: UserRole.MANAGER, Pass: defaultPassword, IsMgr: true),
            (Code: "EMP007", First: "Chloe", Last: "Bennett", Email: "chloe.bennett@company.com", Dept: "HR", Pos: "Talent Acquisition Specialist", Joined: new DateOnly(2023, 9, 15), Role: UserRole.EMPLOYEE, Pass: defaultPassword, IsMgr: false),
            (Code: "EMP008", First: "James", Last: "Wilson", Email: "james.wilson@company.com", Dept: "HR", Pos: "HR Operations Generalist", Joined: new DateOnly(2024, 4, 10), Role: UserRole.EMPLOYEE, Pass: defaultPassword, IsMgr: false),
            (Code: "EMP009", First: "Maya", Last: "Lin", Email: "maya.lin@company.com", Dept: "HR", Pos: "Learning & Development Lead", Joined: new DateOnly(2024, 11, 1), Role: UserRole.EMPLOYEE, Pass: defaultPassword, IsMgr: false),
            (Code: "EMP010", First: "Noah", Last: "Davis", Email: "noah.davis@company.com", Dept: "HR", Pos: "HR Coordinator", Joined: new DateOnly(2025, 3, 1), Role: UserRole.EMPLOYEE, Pass: defaultPassword, IsMgr: false),

            // Finance Department (Manager = Robert Chen)
            (Code: "EMP011", First: "Robert", Last: "Chen", Email: "robert.chen@company.com", Dept: "Finance", Pos: "Financial Controller", Joined: new DateOnly(2023, 3, 1), Role: UserRole.MANAGER, Pass: defaultPassword, IsMgr: true),
            (Code: "EMP012", First: "Grace", Last: "Hopper", Email: "grace.hopper@company.com", Dept: "Finance", Pos: "Senior Financial Analyst", Joined: new DateOnly(2023, 8, 20), Role: UserRole.EMPLOYEE, Pass: defaultPassword, IsMgr: false),
            (Code: "EMP013", First: "Samuel", Last: "Kim", Email: "samuel.kim@company.com", Dept: "Finance", Pos: "Accountant", Joined: new DateOnly(2024, 5, 15), Role: UserRole.EMPLOYEE, Pass: defaultPassword, IsMgr: false),
            (Code: "EMP014", First: "Olivia", Last: "Martin", Email: "olivia.martin@company.com", Dept: "Finance", Pos: "Payroll Specialist", Joined: new DateOnly(2024, 9, 1), Role: UserRole.EMPLOYEE, Pass: defaultPassword, IsMgr: false),
            (Code: "EMP015", First: "Lucas", Last: "Scott", Email: "lucas.scott@company.com", Dept: "Finance", Pos: "Billing Analyst", Joined: new DateOnly(2025, 2, 15), Role: UserRole.EMPLOYEE, Pass: defaultPassword, IsMgr: false),

            // Marketing Department (Manager = Sophia Taylor)
            (Code: "EMP016", First: "Sophia", Last: "Taylor", Email: "sophia.taylor@company.com", Dept: "Marketing", Pos: "VP of Marketing", Joined: new DateOnly(2023, 4, 1), Role: UserRole.MANAGER, Pass: defaultPassword, IsMgr: true),
            (Code: "EMP017", First: "Emily", Last: "Watson", Email: "emily.watson@company.com", Dept: "Marketing", Pos: "Digital Marketing Manager", Joined: new DateOnly(2023, 10, 1), Role: UserRole.EMPLOYEE, Pass: defaultPassword, IsMgr: false),
            (Code: "EMP018", First: "Daniel", Last: "Brown", Email: "daniel.brown@company.com", Dept: "Marketing", Pos: "Content Strategist", Joined: new DateOnly(2024, 6, 15), Role: UserRole.EMPLOYEE, Pass: defaultPassword, IsMgr: false),
            (Code: "EMP019", First: "Isabella", Last: "Garcia", Email: "isabella.garcia@company.com", Dept: "Marketing", Pos: "Brand & UI Designer", Joined: new DateOnly(2024, 10, 20), Role: UserRole.EMPLOYEE, Pass: defaultPassword, IsMgr: false),
            (Code: "EMP020", First: "Jack", Last: "Anderson", Email: "jack.anderson@company.com", Dept: "Marketing", Pos: "SEO & Growth Specialist", Joined: new DateOnly(2025, 4, 1), Role: UserRole.EMPLOYEE, Pass: defaultPassword, IsMgr: false)
        };

        var seededEmployees = new Dictionary<string, Employee>();
        var managerEmployeesByDept = new Dictionary<string, Employee>();

        foreach (var def in employeeDefs)
        {
            var user = await context.Users.Include(u => u.Employee).FirstOrDefaultAsync(u => u.Email == def.Email);
            if (user == null)
            {
                user = new User
                {
                    Email = def.Email.ToLowerInvariant(),
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(def.Pass),
                    Role = def.Role,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                context.Users.Add(user);
                await context.SaveChangesAsync();
            }

            var employee = await context.Employees.FirstOrDefaultAsync(e => e.UserId == user.Id || e.EmployeeCode == def.Code);
            if (employee == null)
            {
                employee = new Employee
                {
                    UserId = user.Id,
                    DepartmentId = depts[def.Dept].Id,
                    EmployeeCode = def.Code,
                    FirstName = def.First,
                    LastName = def.Last,
                    Position = def.Pos,
                    JoinedDate = def.Joined,
                    Status = EmployeeStatus.ACTIVE,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                context.Employees.Add(employee);
                await context.SaveChangesAsync();
            }
            else
            {
                // Ensure correct department assignment and position
                employee.DepartmentId = depts[def.Dept].Id;
                employee.Position = def.Pos;
                employee.FirstName = def.First;
                employee.LastName = def.Last;
            }

            seededEmployees[def.Code] = employee;
            if (def.IsMgr)
            {
                managerEmployeesByDept[def.Dept] = employee;
            }
        }
        await context.SaveChangesAsync();

        // 6. Assign Managers to each of the 4 departments (FR-DEP-02)
        foreach (var kvp in managerEmployeesByDept)
        {
            var dept = depts[kvp.Key];
            if (dept.ManagerId != kvp.Value.Id)
            {
                dept.ManagerId = kvp.Value.Id;
                Log.Information("Assigned {ManagerName} as Manager of {Department}", kvp.Value.FullName, dept.Name);
            }
        }
        await context.SaveChangesAsync();

        // 7. Seed Leave Balances for Current Year (BR-15)
        var currentYear = DateTime.UtcNow.Year;
        var allEmployees = await context.Employees.Where(e => e.Status == EmployeeStatus.ACTIVE).ToListAsync();
        var allActiveTypes = leaveTypes.Values.ToList();

        var existingBalances = await context.LeaveBalances
            .Where(b => b.Year == currentYear)
            .Select(b => new { b.EmployeeId, b.LeaveTypeId })
            .ToListAsync();

        var balanceLookup = new HashSet<(long, long)>(existingBalances.Select(b => (b.EmployeeId, b.LeaveTypeId)));

        foreach (var emp in allEmployees)
        {
            foreach (var lt in allActiveTypes)
            {
                if (!balanceLookup.Contains((emp.Id, lt.Id)))
                {
                    context.LeaveBalances.Add(new LeaveBalance
                    {
                        EmployeeId = emp.Id,
                        LeaveTypeId = lt.Id,
                        Year = currentYear,
                        AllocatedDays = lt.DefaultDays,
                        UsedDays = 0,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    });
                }
            }
        }
        await context.SaveChangesAsync();

        // 8. Seed 6 Weeks of Attendance History (30 working days leading up to today)
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var workingDaysHistory = new List<DateOnly>();
        var checkDay = today.AddDays(-1);

        while (workingDaysHistory.Count < 30)
        {
            if (checkDay.DayOfWeek != DayOfWeek.Saturday && checkDay.DayOfWeek != DayOfWeek.Sunday)
            {
                workingDaysHistory.Add(checkDay);
            }
            checkDay = checkDay.AddDays(-1);
        }

        // Fetch existing attendance to ensure idempotency
        var existingAttendanceDates = await context.Attendances
            .Select(a => new { a.EmployeeId, a.AttendanceDate })
            .ToListAsync();
        var attendanceLookup = new HashSet<(long, DateOnly)>(existingAttendanceDates.Select(a => (a.EmployeeId, a.AttendanceDate)));

        var attendancesToAdd = new List<Attendance>();

        foreach (var emp in allEmployees)
        {
            for (int i = 0; i < workingDaysHistory.Count; i++)
            {
                var day = workingDaysHistory[i];
                if (attendanceLookup.Contains((emp.Id, day)))
                {
                    continue;
                }

                // Deterministic pseudo-random generation based on employee code hash and day
                int seedVal = Math.Abs((emp.EmployeeCode.GetHashCode() ^ day.GetHashCode()) % 100);

                if (seedVal < 76)
                {
                    // ~76% PRESENT (on-time: 08:20 to 08:55 check-in, 17:15 to 18:00 check-out)
                    int inMinute = (seedVal * 7) % 35 + 20; // 08:20 - 08:55
                    int outMinute = (seedVal * 11) % 45 + 15; // 17:15 - 18:00
                    var checkIn = day.ToDateTime(new TimeOnly(8, inMinute), DateTimeKind.Utc);
                    var checkOut = day.ToDateTime(new TimeOnly(17, outMinute), DateTimeKind.Utc);

                    attendancesToAdd.Add(new Attendance
                    {
                        EmployeeId = emp.Id,
                        AttendanceDate = day,
                        CheckIn = checkIn,
                        CheckOut = checkOut,
                        Status = AttendanceStatus.PRESENT,
                        CreatedAt = checkIn
                    });
                }
                else if (seedVal < 88)
                {
                    // ~12% LATE (after 09:00: 09:05 to 09:40 check-in, 17:30 to 18:30 check-out)
                    int inMinute = (seedVal * 3) % 35 + 5; // 09:05 - 09:40
                    int outMinute = (seedVal * 5) % 60;    // 17:30 - 18:30
                    var checkIn = day.ToDateTime(new TimeOnly(9, inMinute), DateTimeKind.Utc);
                    var checkOut = day.ToDateTime(new TimeOnly(17, 30), DateTimeKind.Utc).AddMinutes(outMinute);

                    attendancesToAdd.Add(new Attendance
                    {
                        EmployeeId = emp.Id,
                        AttendanceDate = day,
                        CheckIn = checkIn,
                        CheckOut = checkOut,
                        Status = AttendanceStatus.LATE,
                        CreatedAt = checkIn
                    });
                }
                else if (seedVal < 94)
                {
                    // ~6% HALF_DAY (< 4 hours worked per BR-12: 08:30 check-in, 11:45 check-out)
                    var checkIn = day.ToDateTime(new TimeOnly(8, 30), DateTimeKind.Utc);
                    var checkOut = day.ToDateTime(new TimeOnly(11, 45), DateTimeKind.Utc);

                    attendancesToAdd.Add(new Attendance
                    {
                        EmployeeId = emp.Id,
                        AttendanceDate = day,
                        CheckIn = checkIn,
                        CheckOut = checkOut,
                        Status = AttendanceStatus.HALF_DAY,
                        CreatedAt = checkIn
                    });
                }
                // Remaining ~6% are Gaps (no record = absent gap per BR-13)
            }
        }

        // Today's attendance (if weekday) to give live, believable screens
        if (today.DayOfWeek != DayOfWeek.Saturday && today.DayOfWeek != DayOfWeek.Sunday)
        {
            var itManager = managerEmployeesByDept["IT"];
            var devEmployee = seededEmployees["EMP002"]; // Demo Employee (leave without check-in so UI Check-In button is active)
            var devOpsEmp = seededEmployees["EMP003"];
            var feEmp = seededEmployees["EMP004"];

            if (!attendanceLookup.Contains((itManager.Id, today)))
            {
                // IT Manager checked in on time today (still open)
                attendancesToAdd.Add(new Attendance
                {
                    EmployeeId = itManager.Id,
                    AttendanceDate = today,
                    CheckIn = today.ToDateTime(new TimeOnly(8, 42), DateTimeKind.Utc),
                    Status = AttendanceStatus.PRESENT,
                    CreatedAt = DateTime.UtcNow
                });
            }

            if (!attendanceLookup.Contains((devOpsEmp.Id, today)))
            {
                // Priya Patel checked in on time
                attendancesToAdd.Add(new Attendance
                {
                    EmployeeId = devOpsEmp.Id,
                    AttendanceDate = today,
                    CheckIn = today.ToDateTime(new TimeOnly(8, 35), DateTimeKind.Utc),
                    Status = AttendanceStatus.PRESENT,
                    CreatedAt = DateTime.UtcNow
                });
            }

            if (!attendanceLookup.Contains((feEmp.Id, today)))
            {
                // Ethan Wright checked in LATE today
                attendancesToAdd.Add(new Attendance
                {
                    EmployeeId = feEmp.Id,
                    AttendanceDate = today,
                    CheckIn = today.ToDateTime(new TimeOnly(9, 14), DateTimeKind.Utc),
                    Status = AttendanceStatus.LATE,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        if (attendancesToAdd.Count > 0)
        {
            await context.Attendances.AddRangeAsync(attendancesToAdd);
            await context.SaveChangesAsync();
            Log.Information("Seeded {Count} attendance history records across 6 weeks.", attendancesToAdd.Count);
        }

        // 9. Seed Leave Requests in every status (PENDING, APPROVED, REJECTED, CANCELLED)
        var alex = seededEmployees["EMP002"]; // Demo employee
        var priya = seededEmployees["EMP003"];
        var ethan = seededEmployees["EMP004"];
        var liam = seededEmployees["EMP005"];
        var marcus = seededEmployees["EMP001"]; // IT Manager
        var daniel = seededEmployees["EMP018"]; // Marketing employee
        var sophia = seededEmployees["EMP016"]; // Marketing Manager
        var grace = seededEmployees["EMP012"]; // Finance employee
        var robert = seededEmployees["EMP011"]; // Finance Manager

        var existingLeaveRequests = await context.LeaveRequests
            .Select(lr => new { lr.EmployeeId, lr.StartDate, lr.EndDate })
            .ToListAsync();
        var leaveLookup = new HashSet<(long, DateOnly, DateOnly)>(
            existingLeaveRequests.Select(lr => (lr.EmployeeId, lr.StartDate, lr.EndDate)));

        var leavesToAdd = new List<LeaveRequest>();

        // Find upcoming and past Mon-Wed dates
        var nextMonday = today.AddDays((8 - (int)today.DayOfWeek) % 7);
        if (nextMonday <= today) nextMonday = nextMonday.AddDays(7);
        var pastMonday = today.AddDays(-((int)today.DayOfWeek - 1 + 14)); // 2 weeks ago Monday

        // 1. APPROVED (Past) - Alex Rivera (EMP002) took 3 days Annual Leave 2 weeks ago
        var lr1Start = pastMonday;
        var lr1End = pastMonday.AddDays(2);
        if (!leaveLookup.Contains((alex.Id, lr1Start, lr1End)))
        {
            leavesToAdd.Add(new LeaveRequest
            {
                EmployeeId = alex.Id,
                LeaveTypeId = leaveTypes["Annual Leave"].Id,
                StartDate = lr1Start,
                EndDate = lr1End,
                TotalDays = 3m,
                Reason = "Family visit and personal travel",
                Status = LeaveStatus.APPROVED,
                ApprovedById = marcus.Id,
                ApprovedAt = DateTime.UtcNow.AddDays(-20),
                CreatedAt = DateTime.UtcNow.AddDays(-25)
            });
        }

        // 2. APPROVED (Upcoming) - Alex Rivera (EMP002) has 2 days Annual Leave next week (so Employee Dashboard sees upcomingApprovedLeave)
        var lr2Start = nextMonday.AddDays(3); // Thu
        var lr2End = nextMonday.AddDays(4);   // Fri
        if (!leaveLookup.Contains((alex.Id, lr2Start, lr2End)))
        {
            leavesToAdd.Add(new LeaveRequest
            {
                EmployeeId = alex.Id,
                LeaveTypeId = leaveTypes["Annual Leave"].Id,
                StartDate = lr2Start,
                EndDate = lr2End,
                TotalDays = 2m,
                Reason = "Long weekend trip",
                Status = LeaveStatus.APPROVED,
                ApprovedById = marcus.Id,
                ApprovedAt = DateTime.UtcNow.AddDays(-2),
                CreatedAt = DateTime.UtcNow.AddDays(-5)
            });
        }

        // 3. PENDING (Team member to IT Manager) - Priya Patel (EMP003) requests 3 days Casual Leave
        var lr3Start = nextMonday.AddDays(7);
        var lr3End = lr3Start.AddDays(2);
        if (!leaveLookup.Contains((priya.Id, lr3Start, lr3End)))
        {
            leavesToAdd.Add(new LeaveRequest
            {
                EmployeeId = priya.Id,
                LeaveTypeId = leaveTypes["Casual Leave"].Id,
                StartDate = lr3Start,
                EndDate = lr3End,
                TotalDays = 3m,
                Reason = "Attending family wedding ceremony",
                Status = LeaveStatus.PENDING,
                CreatedAt = DateTime.UtcNow.AddHours(-10)
            });
        }

        // 4. PENDING (Manager request to Admin per BR-07) - Marcus Vance (EMP001) requests 4 days Annual Leave
        var lr4Start = nextMonday.AddDays(14);
        var lr4End = lr4Start.AddDays(3);
        if (!leaveLookup.Contains((marcus.Id, lr4Start, lr4End)))
        {
            leavesToAdd.Add(new LeaveRequest
            {
                EmployeeId = marcus.Id,
                LeaveTypeId = leaveTypes["Annual Leave"].Id,
                StartDate = lr4Start,
                EndDate = lr4End,
                TotalDays = 4m,
                Reason = "Tech Leadership summit and annual leave",
                Status = LeaveStatus.PENDING,
                CreatedAt = DateTime.UtcNow.AddHours(-18)
            });
        }

        // 5. APPROVED (This week) - Daniel Brown (EMP018) on Leave this week
        var currentMon = today.AddDays(-(((int)today.DayOfWeek - 1 + 7) % 7));
        var lr5Start = currentMon;
        var lr5End = currentMon.AddDays(1);
        if (!leaveLookup.Contains((daniel.Id, lr5Start, lr5End)))
        {
            leavesToAdd.Add(new LeaveRequest
            {
                EmployeeId = daniel.Id,
                LeaveTypeId = leaveTypes["Casual Leave"].Id,
                StartDate = lr5Start,
                EndDate = lr5End,
                TotalDays = 2m,
                Reason = "Home relocation and utilities setup",
                Status = LeaveStatus.APPROVED,
                ApprovedById = sophia.Id,
                ApprovedAt = DateTime.UtcNow.AddDays(-6),
                CreatedAt = DateTime.UtcNow.AddDays(-10)
            });
        }

        // 6. REJECTED - Ethan Wright (EMP004) requested leave during critical release freeze
        var lr6Start = nextMonday;
        var lr6End = nextMonday.AddDays(1);
        if (!leaveLookup.Contains((ethan.Id, lr6Start, lr6End)))
        {
            leavesToAdd.Add(new LeaveRequest
            {
                EmployeeId = ethan.Id,
                LeaveTypeId = leaveTypes["Annual Leave"].Id,
                StartDate = lr6Start,
                EndDate = lr6End,
                TotalDays = 2m,
                Reason = "Short getaway",
                Status = LeaveStatus.REJECTED,
                RejectionReason = "Major sprint release scheduled on these dates. All hands required on deck.",
                ApprovedById = marcus.Id,
                ApprovedAt = DateTime.UtcNow.AddDays(-1),
                CreatedAt = DateTime.UtcNow.AddDays(-3)
            });
        }

        // 7. CANCELLED - Liam O'Connor (EMP005) cancelled request before start date (BR-06)
        var lr7Start = nextMonday.AddDays(21);
        var lr7End = lr7Start.AddDays(1);
        if (!leaveLookup.Contains((liam.Id, lr7Start, lr7End)))
        {
            leavesToAdd.Add(new LeaveRequest
            {
                EmployeeId = liam.Id,
                LeaveTypeId = leaveTypes["Medical Leave"].Id,
                StartDate = lr7Start,
                EndDate = lr7End,
                TotalDays = 2m,
                Reason = "Routine medical checkup (rescheduled)",
                Status = LeaveStatus.CANCELLED,
                CreatedAt = DateTime.UtcNow.AddDays(-4),
                UpdatedAt = DateTime.UtcNow.AddDays(-2)
            });
        }

        // 8. Past APPROVED leaves in previous months for the Admin 6-month chart
        var threeMonthsAgoMon = today.AddMonths(-3);
        var lr8Start = new DateOnly(threeMonthsAgoMon.Year, threeMonthsAgoMon.Month, 10);
        while (lr8Start.DayOfWeek == DayOfWeek.Saturday || lr8Start.DayOfWeek == DayOfWeek.Sunday) lr8Start = lr8Start.AddDays(1);
        var lr8End = lr8Start.AddDays(2);
        if (!leaveLookup.Contains((grace.Id, lr8Start, lr8End)))
        {
            leavesToAdd.Add(new LeaveRequest
            {
                EmployeeId = grace.Id,
                LeaveTypeId = leaveTypes["Annual Leave"].Id,
                StartDate = lr8Start,
                EndDate = lr8End,
                TotalDays = 3m,
                Reason = "Mid-year holiday",
                Status = LeaveStatus.APPROVED,
                ApprovedById = robert.Id,
                ApprovedAt = DateTime.UtcNow.AddMonths(-3).AddDays(-5),
                CreatedAt = DateTime.UtcNow.AddMonths(-3).AddDays(-10)
            });
        }

        if (leavesToAdd.Count > 0)
        {
            await context.LeaveRequests.AddRangeAsync(leavesToAdd);
            await context.SaveChangesAsync();
            Log.Information("Seeded {Count} realistic leave requests across all statuses.", leavesToAdd.Count);

            // Deduct used_days for APPROVED requests to maintain balance consistency (BR-05)
            foreach (var approved in leavesToAdd.Where(l => l.Status == LeaveStatus.APPROVED && l.StartDate.Year == currentYear))
            {
                var bal = await context.LeaveBalances.FirstOrDefaultAsync(b =>
                    b.EmployeeId == approved.EmployeeId &&
                    b.LeaveTypeId == approved.LeaveTypeId &&
                    b.Year == currentYear);

                if (bal != null)
                {
                    bal.UsedDays += approved.TotalDays;
                }
            }
            await context.SaveChangesAsync();
        }

        Log.Information("=================================================================");
        Log.Information("DEMO DATA SEEDING COMPLETE!");
        Log.Information("Demo Accounts & Documented Credentials:");
        Log.Information("  [ADMIN]    Email: {Email} | Password: {Pass}", adminEmail, adminPassword);
        Log.Information("  [MANAGER]  Email: {Email} | Password: {Pass}", managerEmail, managerPassword);
        Log.Information("  [EMPLOYEE] Email: {Email} | Password: {Pass}", employeeEmail, employeePassword);
        Log.Information("Total Employees: {EmpCount} across 4 departments (IT, HR, Finance, Marketing)", allEmployees.Count);
        Log.Information("=================================================================");

        return true;
    }
}
