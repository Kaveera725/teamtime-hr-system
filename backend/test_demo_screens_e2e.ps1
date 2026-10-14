$baseUrl = "http://localhost:5000"
$ErrorActionPreference = "Stop"

function Assert-True($condition, $message) {
    if (-not $condition) {
        Write-Host "FAIL: $message" -ForegroundColor Red
        throw "Assertion failed: $message"
    } else {
        Write-Host "PASS: $message" -ForegroundColor Green
    }
}

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "VERIFYING DEMO SCREENS FOR ALL THREE ROLES" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan

# 1. Employee Role (employee@company.com)
Write-Host "`n=== 1. Checking Employee Screen (employee@company.com) ===" -ForegroundColor Cyan
$empLogin = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method Post -Body (@{
    email = "employee@company.com"
    password = "Password123!"
} | ConvertTo-Json) -ContentType "application/json"
$empToken = $empLogin.token
$empHeaders = @{ Authorization = "Bearer $empToken" }

$empDash = Invoke-RestMethod -Uri "$baseUrl/api/dashboard" -Headers $empHeaders
Write-Host "Employee: $($empDash.employeeName) ($($empDash.departmentName))" -ForegroundColor Green
Assert-True ($empDash.leaveBalances.Count -ge 4) "Employee has all 4 leave balances"
foreach ($b in $empDash.leaveBalances) {
    Write-Host "  - $($b.leaveTypeName): Allocated=$($b.allocatedDays), Used=$($b.usedDays), Remaining=$($b.remainingDays)" -ForegroundColor Gray
}

Assert-True ($empDash.todayAttendance.state -ne $null) "Today's attendance state is populated: $($empDash.todayAttendance.state)"
Assert-True ($empDash.last5LeaveRequests.Count -gt 0) "Employee sees recent leave requests ($($empDash.last5LeaveRequests.Count) items)"
foreach ($lr in $empDash.last5LeaveRequests) {
    Write-Host "  - Request #$($lr.id): $($lr.leaveTypeName) ($($lr.totalDays) days) [Status: $($lr.status)]" -ForegroundColor Gray
}

Assert-True ($empDash.upcomingApprovedLeave.Count -gt 0) "Employee sees upcoming approved leave ($($empDash.upcomingApprovedLeave.Count) items)"
foreach ($ul in $empDash.upcomingApprovedLeave) {
    Write-Host "  - Upcoming: $($ul.leaveTypeName) from $($ul.startDate) to $($ul.endDate) [Total: $($ul.totalDays) days]" -ForegroundColor Gray
}

# 2. Manager Role (manager@company.com)
Write-Host "`n=== 2. Checking Manager Screen (manager@company.com) ===" -ForegroundColor Cyan
$mgrLogin = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method Post -Body (@{
    email = "manager@company.com"
    password = "Password123!"
} | ConvertTo-Json) -ContentType "application/json"
$mgrToken = $mgrLogin.token
$mgrHeaders = @{ Authorization = "Bearer $mgrToken" }

$mgrDash = Invoke-RestMethod -Uri "$baseUrl/api/dashboard" -Headers $mgrHeaders
Write-Host "Manager Department: $($mgrDash.departmentName)" -ForegroundColor Green
Assert-True ($mgrDash.pendingApprovalsCount -gt 0) "Manager has pending approvals ($($mgrDash.pendingApprovalsCount) pending)"
foreach ($pa in $mgrDash.pendingApprovals) {
    Write-Host "  - Pending #$($pa.id): $($pa.employeeName) ($($pa.leaveTypeName), $($pa.totalDays) days) - Reason: $($pa.reason)" -ForegroundColor Gray
}

Assert-True ($mgrDash.teamStatusToday.totalTeamMembers -ge 5) "Manager sees team status today (Total: $($mgrDash.teamStatusToday.totalTeamMembers))"
Write-Host "  - Present ($($mgrDash.teamStatusToday.presentCount)): $(($mgrDash.teamStatusToday.present | ForEach-Object { $_.employeeName }) -join ', ')" -ForegroundColor Gray
Write-Host "  - Late ($($mgrDash.teamStatusToday.lateCount)): $(($mgrDash.teamStatusToday.late | ForEach-Object { $_.employeeName }) -join ', ')" -ForegroundColor Gray
Write-Host "  - Absent ($($mgrDash.teamStatusToday.absentCount)): $(($mgrDash.teamStatusToday.absent | ForEach-Object { $_.employeeName }) -join ', ')" -ForegroundColor Gray

Assert-True ($mgrDash.teamStatusToday.present.Count -gt 0 -or $mgrDash.teamStatusToday.late.Count -gt 0) "Team has live attendance activity today"

# 3. Admin Role (admin@company.com)
Write-Host "`n=== 3. Checking Admin Screen (admin@company.com) ===" -ForegroundColor Cyan
$adminLogin = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method Post -Body (@{
    email = "admin@company.com"
    password = "admin123"
} | ConvertTo-Json) -ContentType "application/json"
$adminToken = $adminLogin.token
$adminHeaders = @{ Authorization = "Bearer $adminToken" }

$adminDash = Invoke-RestMethod -Uri "$baseUrl/api/dashboard" -Headers $adminHeaders
Write-Host "Organization Headcount: Total=$($adminDash.totalEmployees), Active=$($adminDash.activeEmployees)" -ForegroundColor Green
Assert-True ($adminDash.totalEmployees -ge 20) "Admin sees >= 20 total employees"
Assert-True ($adminDash.employeesPerDepartment.Count -ge 4) "At least 4 departments present in breakdown"
$deptNames = $adminDash.employeesPerDepartment | ForEach-Object { $_.departmentName }
Assert-True ($deptNames -contains "IT" -and $deptNames -contains "HR" -and $deptNames -contains "Finance" -and $deptNames -contains "Marketing") "All 4 core departments (IT, HR, Finance, Marketing) present"
foreach ($d in $adminDash.employeesPerDepartment) {
    Write-Host "  - Department $($d.departmentName): Total=$($d.totalEmployees), Active=$($d.activeEmployees)" -ForegroundColor Gray
}

Assert-True ($adminDash.todayAttendanceSummary -ne $null) "Today's org attendance summary populated"
Assert-True ($adminDash.pendingLeaveCount -gt 0) "Admin sees pending leaves across org ($($adminDash.pendingLeaveCount) pending)"
Assert-True ($adminDash.leaveDaysPerMonthLast6Months.Count -eq 6) "Historical 6-month leave chart populated with 6 months"
Write-Host "6-Month Leave Usage Chart:" -ForegroundColor Gray
foreach ($m in $adminDash.leaveDaysPerMonthLast6Months) {
    Write-Host "  - $($m.monthName): $($m.totalDays) working days used" -ForegroundColor Gray
}

Write-Host "`n=======================================================" -ForegroundColor Green
Write-Host "ALL THREE ROLES DISPLAY POPULATED, BELIEVABLE SCREENS!" -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green
