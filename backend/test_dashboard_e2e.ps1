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

Write-Host "=== 1. Checking Swagger Endpoint for /api/dashboard ===" -ForegroundColor Cyan
$swagger = Invoke-RestMethod -Uri "$baseUrl/swagger/v1/swagger.json"
Assert-True ($swagger.paths."/api/dashboard" -ne $null) "Swagger /api/dashboard endpoint is registered"
Assert-True ($swagger.paths."/api/dashboard".get -ne $null) "Swagger GET /api/dashboard operation is defined"

Write-Host "`n=== 2. Authenticating as Admin ===" -ForegroundColor Cyan
$adminLoginBody = @{ email = "admin@company.com"; password = "admin123" } | ConvertTo-Json
$adminToken = (Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method Post -Body $adminLoginBody -ContentType "application/json").token
$adminHeaders = @{ Authorization = "Bearer $adminToken" }
Write-Host "Admin logged in successfully." -ForegroundColor Green

Write-Host "`n=== 3. Setting up Test Department, Manager, and Employee ===" -ForegroundColor Cyan
$uniqueId = [System.Guid]::NewGuid().ToString().Substring(0, 8)

# Create Department
$deptBody = @{ name = "Dashboard_$uniqueId"; description = "Dashboard Test Dept" } | ConvertTo-Json
$dept = Invoke-RestMethod -Uri "$baseUrl/api/departments" -Method Post -Body $deptBody -Headers $adminHeaders -ContentType "application/json"
$deptId = $dept.id

# Create Manager
$mgrEmail = "dash_mgr_$uniqueId@company.com"
$mgrPass = "Password@123!"
$mgrUserBody = @{
    email = $mgrEmail
    password = $mgrPass
    role = 1 # MANAGER
    firstName = "Diana"
    lastName = "Director"
    departmentId = $deptId
    position = "Director"
} | ConvertTo-Json
$mgrUser = Invoke-RestMethod -Uri "$baseUrl/api/users" -Method Post -Body $mgrUserBody -Headers $adminHeaders -ContentType "application/json"
$mgrEmpId = $mgrUser.employeeId

# Assign Manager
$assignBody = @{ name = "Dashboard_$uniqueId"; description = "Dashboard Test Dept"; managerId = $mgrEmpId } | ConvertTo-Json
Invoke-RestMethod -Uri "$baseUrl/api/departments/$deptId" -Method Put -Body $assignBody -Headers $adminHeaders -ContentType "application/json" | Out-Null

# Create Employee
$empEmail = "dash_emp_$uniqueId@company.com"
$empPass = "Password@123!"
$empUserBody = @{
    email = $empEmail
    password = $empPass
    role = 0 # EMPLOYEE
    firstName = "Evan"
    lastName = "Engineer"
    departmentId = $deptId
    position = "Developer"
} | ConvertTo-Json
$empUser = Invoke-RestMethod -Uri "$baseUrl/api/users" -Method Post -Body $empUserBody -Headers $adminHeaders -ContentType "application/json"
$empId = $empUser.employeeId

# Logins
$mgrLoginBody = @{ email = $mgrEmail; password = $mgrPass } | ConvertTo-Json
$mgrToken = (Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method Post -Body $mgrLoginBody -ContentType "application/json").token
$mgrHeaders = @{ Authorization = "Bearer $mgrToken" }

$empLoginBody = @{ email = $empEmail; password = $empPass } | ConvertTo-Json
$empToken = (Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method Post -Body $empLoginBody -ContentType "application/json").token
$empHeaders = @{ Authorization = "Bearer $empToken" }

Write-Host "Created and authenticated Admin, Manager, and Employee." -ForegroundColor Green

Write-Host "`n=== 4. Testing GET /api/dashboard as EMPLOYEE ===" -ForegroundColor Cyan
$empDashboard = Invoke-RestMethod -Uri "$baseUrl/api/dashboard" -Headers $empHeaders

# Verify Employee Shape
Assert-True ($empDashboard.employeeId -eq $empId) "Employee ID matches current user"
Assert-True ($empDashboard.employeeName -eq "Evan Engineer") "Employee name matches"
Assert-True ($null -ne $empDashboard.PSObject.Properties['leaveBalances']) "Contains leaveBalances"
Assert-True ($null -ne $empDashboard.PSObject.Properties['todayAttendance']) "Contains todayAttendance"
Assert-True ($null -ne $empDashboard.PSObject.Properties['last5LeaveRequests']) "Contains last5LeaveRequests"
Assert-True ($null -ne $empDashboard.PSObject.Properties['upcomingApprovedLeave']) "Contains upcomingApprovedLeave"

# Verify Manager/Admin fields are NOT present
Assert-True ($null -eq $empDashboard.PSObject.Properties['pendingApprovals']) "Employee dashboard does NOT contain pendingApprovals"
Assert-True ($null -eq $empDashboard.PSObject.Properties['employeesPerDepartment']) "Employee dashboard does NOT contain employeesPerDepartment"
Assert-True ($null -eq $empDashboard.PSObject.Properties['leaveDaysPerMonthLast6Months']) "Employee dashboard does NOT contain leaveDaysPerMonthLast6Months"

Write-Host "`n=== 5. Testing GET /api/dashboard as MANAGER ===" -ForegroundColor Cyan
$mgrDashboard = Invoke-RestMethod -Uri "$baseUrl/api/dashboard" -Headers $mgrHeaders

# Verify Manager Shape
Assert-True ($mgrDashboard.departmentId -eq $deptId) "Manager department ID matches"
Assert-True ($null -ne $mgrDashboard.PSObject.Properties['pendingApprovals']) "Contains pendingApprovals list"
Assert-True ($null -ne $mgrDashboard.PSObject.Properties['pendingApprovalsCount']) "Contains pendingApprovalsCount"
Assert-True ($null -ne $mgrDashboard.PSObject.Properties['teamStatusToday']) "Contains teamStatusToday"
Assert-True ($null -ne $mgrDashboard.teamStatusToday.PSObject.Properties['present']) "Contains present team members list"
Assert-True ($null -ne $mgrDashboard.teamStatusToday.PSObject.Properties['absent']) "Contains absent team members list"
Assert-True ($null -ne $mgrDashboard.PSObject.Properties['teamMembersOnLeaveThisWeek']) "Contains teamMembersOnLeaveThisWeek"

# Verify Employee/Admin fields are NOT present
Assert-True ($null -eq $mgrDashboard.PSObject.Properties['leaveBalances']) "Manager dashboard does NOT contain leaveBalances"
Assert-True ($null -eq $mgrDashboard.PSObject.Properties['last5LeaveRequests']) "Manager dashboard does NOT contain last5LeaveRequests"
Assert-True ($null -eq $mgrDashboard.PSObject.Properties['employeesPerDepartment']) "Manager dashboard does NOT contain employeesPerDepartment"
Assert-True ($null -eq $mgrDashboard.PSObject.Properties['leaveDaysPerMonthLast6Months']) "Manager dashboard does NOT contain leaveDaysPerMonthLast6Months"

Write-Host "`n=== 6. Testing GET /api/dashboard as ADMIN ===" -ForegroundColor Cyan
$adminDashboard = Invoke-RestMethod -Uri "$baseUrl/api/dashboard" -Headers $adminHeaders

# Verify Admin Shape
Assert-True ($adminDashboard.totalEmployees -ge 2) "Contains totalEmployees count"
Assert-True ($adminDashboard.activeEmployees -ge 2) "Contains activeEmployees count"
Assert-True ($null -ne $adminDashboard.PSObject.Properties['employeesPerDepartment']) "Contains employeesPerDepartment list"
Assert-True ($null -ne $adminDashboard.PSObject.Properties['todayAttendanceSummary']) "Contains todayAttendanceSummary"
Assert-True ($null -ne $adminDashboard.PSObject.Properties['pendingLeaveCount']) "Contains pendingLeaveCount"
Assert-True ($null -ne $adminDashboard.PSObject.Properties['leaveDaysUsedThisMonth']) "Contains leaveDaysUsedThisMonth"
Assert-True ($adminDashboard.leaveDaysPerMonthLast6Months.Count -eq 6) "Contains 6-month historical leave usage chart data"

# Verify Employee/Manager fields are NOT present
Assert-True ($null -eq $adminDashboard.PSObject.Properties['leaveBalances']) "Admin dashboard does NOT contain leaveBalances"
Assert-True ($null -eq $adminDashboard.PSObject.Properties['last5LeaveRequests']) "Admin dashboard does NOT contain last5LeaveRequests"
Assert-True ($null -eq $adminDashboard.PSObject.Properties['pendingApprovals']) "Admin dashboard does NOT contain pendingApprovals"
Assert-True ($null -eq $adminDashboard.PSObject.Properties['teamMembersOnLeaveThisWeek']) "Admin dashboard does NOT contain teamMembersOnLeaveThisWeek"

Write-Host "`n=======================================================" -ForegroundColor Green
Write-Host "ALL ROLE-SPECIFIC DASHBOARD TESTS DEMONSTRATED & PASSED!" -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green
