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

Write-Host "=== 1. Checking Swagger Endpoint ===" -ForegroundColor Cyan
$swagger = Invoke-RestMethod -Uri "$baseUrl/swagger/v1/swagger.json"
Assert-True ($swagger.paths."/api/leave-requests" -ne $null) "Swagger /api/leave-requests root endpoint is registered"
Assert-True ($swagger.paths."/api/leave-requests/preview" -ne $null) "Swagger /api/leave-requests/preview endpoint is registered"
Assert-True ($swagger.paths."/api/leave-requests/my" -ne $null) "Swagger /api/leave-requests/my endpoint is registered"
Assert-True ($swagger.paths."/api/leave-requests/{id}/approve" -ne $null) "Swagger /api/leave-requests/{id}/approve endpoint is registered"
Assert-True ($swagger.paths."/api/leave-requests/{id}/reject" -ne $null) "Swagger /api/leave-requests/{id}/reject endpoint is registered"
Assert-True ($swagger.paths."/api/leave-requests/{id}/cancel" -ne $null) "Swagger /api/leave-requests/{id}/cancel endpoint is registered"

Write-Host "`n=== 2. Authenticating as Admin ===" -ForegroundColor Cyan
$adminLoginBody = @{ email = "admin@company.com"; password = "admin123" } | ConvertTo-Json
$adminLoginRes = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method Post -Body $adminLoginBody -ContentType "application/json"
$adminToken = $adminLoginRes.token
$adminHeaders = @{ Authorization = "Bearer $adminToken" }
Write-Host "Admin logged in successfully." -ForegroundColor Green

Write-Host "`n=== 3. Setting up Test Department, Manager, and Employee ===" -ForegroundColor Cyan
$uniqueId = [System.Guid]::NewGuid().ToString().Substring(0, 8)

# 3.1 Create Department
$deptBody = @{ name = "Ops_$uniqueId"; description = "Operations Department" } | ConvertTo-Json
$deptRes = Invoke-RestMethod -Uri "$baseUrl/api/departments" -Method Post -Body $deptBody -Headers $adminHeaders -ContentType "application/json"
$deptId = $deptRes.id
Write-Host "Created Department ID: $deptId" -ForegroundColor Green

# 3.2 Create Manager User (role 1)
$mgrEmail = "mgr_$uniqueId@company.com"
$mgrPass = "Password@123!"
$mgrUserBody = @{
    email = $mgrEmail
    password = $mgrPass
    role = 1 # MANAGER
    firstName = "Mark"
    lastName = "Manager"
    departmentId = $deptId
    position = "Ops Manager"
} | ConvertTo-Json
$mgrUserRes = Invoke-RestMethod -Uri "$baseUrl/api/users" -Method Post -Body $mgrUserBody -Headers $adminHeaders -ContentType "application/json"
$mgrEmpId = $mgrUserRes.employeeId
Write-Host "Created Manager ID: $mgrEmpId ($mgrEmail)" -ForegroundColor Green

# Assign manager to department
$assignBody = @{ name = "Ops_$uniqueId"; description = "Operations Department"; managerId = $mgrEmpId } | ConvertTo-Json
Invoke-RestMethod -Uri "$baseUrl/api/departments/$deptId" -Method Put -Body $assignBody -Headers $adminHeaders -ContentType "application/json" | Out-Null
Write-Host "Assigned Manager $mgrEmpId to Department $deptId" -ForegroundColor Green

# 3.3 Create Employee User (role 0)
$empEmail = "emp_$uniqueId@company.com"
$empPass = "Password@123!"
$empUserBody = @{
    email = $empEmail
    password = $empPass
    role = 0 # EMPLOYEE
    firstName = "Emma"
    lastName = "Employee"
    departmentId = $deptId
    position = "Ops Specialist"
} | ConvertTo-Json
$empUserRes = Invoke-RestMethod -Uri "$baseUrl/api/users" -Method Post -Body $empUserBody -Headers $adminHeaders -ContentType "application/json"
$empId = $empUserRes.employeeId
Write-Host "Created Employee ID: $empId ($empEmail)" -ForegroundColor Green

# Login as Manager & Employee
$mgrLoginBody = @{ email = $mgrEmail; password = $mgrPass } | ConvertTo-Json
$mgrToken = (Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method Post -Body $mgrLoginBody -ContentType "application/json").token
$mgrHeaders = @{ Authorization = "Bearer $mgrToken" }

$empLoginBody = @{ email = $empEmail; password = $empPass } | ConvertTo-Json
$empToken = (Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method Post -Body $empLoginBody -ContentType "application/json").token
$empHeaders = @{ Authorization = "Bearer $empToken" }

# Get Leave Types
$leaveTypes = Invoke-RestMethod -Uri "$baseUrl/api/leave-types" -Headers $adminHeaders
$annualType = $leaveTypes | Where-Object { $_.name -eq "Annual Leave" } | Select-Object -First 1
$medicalType = $leaveTypes | Where-Object { $_.name -eq "Medical Leave" } | Select-Object -First 1
Write-Host "Annual Leave ID: $($annualType.id), Medical Leave ID: $($medicalType.id)" -ForegroundColor Green

Write-Host "`n=== 4. Testing POST /api/leave-requests/preview (Live Estimate) ===" -ForegroundColor Cyan
$today = [DateTime]::UtcNow.Date
$daysUntilMon = (8 - [int]$today.DayOfWeek) % 7
if ($daysUntilMon -le 0) { $daysUntilMon += 7 }
$mon = $today.AddDays($daysUntilMon)
$wed = $mon.AddDays(2)
$sat = $mon.AddDays(5)
$sun = $mon.AddDays(6)

# Valid Preview (Mon-Wed = 3 working days)
$prevValidBody = @{
    leaveTypeId = $annualType.id
    startDate = $mon.ToString("yyyy-MM-dd")
    endDate = $wed.ToString("yyyy-MM-dd")
    isHalfDay = $false
} | ConvertTo-Json
$prevValidRes = Invoke-RestMethod -Uri "$baseUrl/api/leave-requests/preview" -Method Post -Body $prevValidBody -Headers $empHeaders -ContentType "application/json"
Assert-True ($prevValidRes.isValid -eq $true) "Valid preview reports isValid = true"
Assert-True ($prevValidRes.workingDays -eq 3.0) "Valid preview calculates 3.0 working days"
Assert-True ($prevValidRes.balanceAfter -eq ($prevValidRes.availableBalance - 3.0)) "Preview accurately computes balanceAfter"

# Weekend only Preview (Zero working days)
$prevWeekendBody = @{
    leaveTypeId = $annualType.id
    startDate = $sat.ToString("yyyy-MM-dd")
    endDate = $sun.ToString("yyyy-MM-dd")
} | ConvertTo-Json
$prevWeekendRes = Invoke-RestMethod -Uri "$baseUrl/api/leave-requests/preview" -Method Post -Body $prevWeekendBody -Headers $empHeaders -ContentType "application/json"
Assert-True ($prevWeekendRes.isValid -eq $false) "Weekend-only preview reports isValid = false"
Assert-True ($prevWeekendRes.validationErrors.Count -gt 0) "Zero working days error reported in validationErrors"

# Year boundary preview (BR-08)
$prevYearBody = @{
    leaveTypeId = $annualType.id
    startDate = "2026-12-30"
    endDate = "2027-01-04"
} | ConvertTo-Json
$prevYearRes = Invoke-RestMethod -Uri "$baseUrl/api/leave-requests/preview" -Method Post -Body $prevYearBody -Headers $empHeaders -ContentType "application/json"
Assert-True ($prevYearRes.isValid -eq $false) "Cross-year preview reports isValid = false"

Write-Host "`n=== 5. Testing POST /api/leave-requests & Overlap Rejection (BR-03) ===" -ForegroundColor Cyan
$createBody = @{
    leaveTypeId = $annualType.id
    startDate = $mon.ToString("yyyy-MM-dd")
    endDate = $wed.ToString("yyyy-MM-dd")
    reason = "Trip to mountains"
} | ConvertTo-Json
$createdReq = Invoke-RestMethod -Uri "$baseUrl/api/leave-requests" -Method Post -Body $createBody -Headers $empHeaders -ContentType "application/json"
$reqId = $createdReq.id
Assert-True ($createdReq.status -eq "PENDING") "Created request has status PENDING"
Assert-True ($createdReq.totalDays -eq 3.0) "Created request has 3.0 total days"
Assert-True ($createdReq.employeeName -eq "Emma Employee") "Response includes employee name"
Assert-True ($createdReq.leaveTypeName -eq "Annual Leave") "Response includes leave type name"

# Overlap attempt (Tue - Thu) -> Must return 409 Conflict per Section 8.8
$overlapBody = @{
    leaveTypeId = $annualType.id
    startDate = $mon.AddDays(1).ToString("yyyy-MM-dd")
    endDate = $mon.AddDays(3).ToString("yyyy-MM-dd")
    reason = "Overlap"
} | ConvertTo-Json

$overlapStatus = 0
try {
    Invoke-RestMethod -Uri "$baseUrl/api/leave-requests" -Method Post -Body $overlapBody -Headers $empHeaders -ContentType "application/json"
} catch {
    $overlapStatus = $_.Exception.Response.StatusCode.value__
}
Assert-True ($overlapStatus -eq 409) "Overlapping request correctly rejected with 409 Conflict (BR-03)"

Write-Host "`n=== 6. Testing GET /api/leave-requests/my and GET /api/leave-requests ===" -ForegroundColor Cyan
$myRequests = Invoke-RestMethod -Uri "$baseUrl/api/leave-requests/my" -Headers $empHeaders
Assert-True ($myRequests.totalCount -ge 1) "Employee can view own leave requests"
Assert-True ($myRequests.items[0].id -eq $reqId) "Own request matches submitted ID"

# Manager scoped view
$mgrRequests = Invoke-RestMethod -Uri "$baseUrl/api/leave-requests" -Headers $mgrHeaders
Assert-True ($mgrRequests.items.Count -ge 1) "Manager can view requests for their team"
Assert-True ($mgrRequests.items[0].departmentName -eq "Ops_$uniqueId") "Manager view scoped to team"

# Employee forbidden from viewing all requests
$empForbiddenStatus = 0
try {
    Invoke-RestMethod -Uri "$baseUrl/api/leave-requests" -Headers $empHeaders
} catch {
    $empForbiddenStatus = $_.Exception.Response.StatusCode.value__
}
Assert-True ($empForbiddenStatus -eq 403) "Employee correctly forbidden (403) from accessing all/team leave requests"

Write-Host "`n=== 7. Testing Approval Authority (BR-07) and Balance Deduction (BR-05) ===" -ForegroundColor Cyan
# Self-approval attempt
$selfApproveStatus = 0
try {
    Invoke-RestMethod -Uri "$baseUrl/api/leave-requests/$reqId/approve" -Method Put -Headers $empHeaders
} catch {
    $selfApproveStatus = $_.Exception.Response.StatusCode.value__
}
Assert-True ($selfApproveStatus -eq 403) "Employee cannot approve own request (403 Forbidden per BR-07)"

# Manager approves team member's request
$approvedReq = Invoke-RestMethod -Uri "$baseUrl/api/leave-requests/$reqId/approve" -Method Put -Headers $mgrHeaders
Assert-True ($approvedReq.status -eq "APPROVED") "Request status updated to APPROVED"
Assert-True ($approvedReq.approvedByName -eq "Mark Manager") "ApprovedByName recorded in timeline"
Assert-True ($approvedReq.approvedAt -ne $null) "ApprovedAt timestamp recorded"

# Check employee balance deducted in same transaction (BR-05)
$myBal = Invoke-RestMethod -Uri "$baseUrl/api/leave-balances/my" -Headers $empHeaders
$annualBal = $myBal | Where-Object { $_.leaveTypeId -eq $annualType.id }
Assert-True ($annualBal.usedDays -eq 3.0) "Used days deducted to 3.0 in same transaction"

# Double approval rejected (cannot approve already APPROVED request)
$doubleApproveStatus = 0
try {
    Invoke-RestMethod -Uri "$baseUrl/api/leave-requests/$reqId/approve" -Method Put -Headers $mgrHeaders
} catch {
    $doubleApproveStatus = $_.Exception.Response.StatusCode.value__
}
Assert-True ($doubleApproveStatus -eq 400 -or $doubleApproveStatus -eq 409) "Double approval rejected with 400/409"

Write-Host "`n=== 8. Testing Cancel Approved (BR-06) and Restoring Days ===" -ForegroundColor Cyan
$cancelledReq = Invoke-RestMethod -Uri "$baseUrl/api/leave-requests/$reqId/cancel" -Method Put -Headers $empHeaders
Assert-True ($cancelledReq.status -eq "CANCELLED") "Approved leave cancelled before start date"

# Check balance restored (BR-06)
$myBalAfterCancel = Invoke-RestMethod -Uri "$baseUrl/api/leave-balances/my" -Headers $empHeaders
$annualBalAfterCancel = $myBalAfterCancel | Where-Object { $_.leaveTypeId -eq $annualType.id }
Assert-True ($annualBalAfterCancel.usedDays -eq 0.0) "Balance restored to 0.0 used days upon cancellation"

Write-Host "`n=== 9. Testing Reject with Mandatory Reason ===" -ForegroundColor Cyan
# Create second request (Thu-Fri = 2 working days)
$thu = $mon.AddDays(3)
$fri = $mon.AddDays(4)
$req2Body = @{
    leaveTypeId = $annualType.id
    startDate = $thu.ToString("yyyy-MM-dd")
    endDate = $fri.ToString("yyyy-MM-dd")
    reason = "Training workshop"
} | ConvertTo-Json
$req2 = Invoke-RestMethod -Uri "$baseUrl/api/leave-requests" -Method Post -Body $req2Body -Headers $empHeaders -ContentType "application/json"
$req2Id = $req2.id
Write-Host "Created Request 2: ID $req2Id" -ForegroundColor Green

# Reject without reason -> 400 Bad Request
$rejectNoReasonStatus = 0
try {
    $badRejectBody = @{ rejectionReason = "" } | ConvertTo-Json
    Invoke-RestMethod -Uri "$baseUrl/api/leave-requests/$req2Id/reject" -Method Put -Body $badRejectBody -Headers $mgrHeaders -ContentType "application/json"
} catch {
    $rejectNoReasonStatus = $_.Exception.Response.StatusCode.value__
}
Assert-True ($rejectNoReasonStatus -eq 400) "Rejection without reason rejected with 400 Bad Request"

# Reject with reason -> 200 OK
$goodRejectBody = @{ rejectionReason = "Critical deployment scheduled on those dates" } | ConvertTo-Json
$rejectedReq = Invoke-RestMethod -Uri "$baseUrl/api/leave-requests/$req2Id/reject" -Method Put -Body $goodRejectBody -Headers $mgrHeaders -ContentType "application/json"
Assert-True ($rejectedReq.status -eq "REJECTED") "Request status updated to REJECTED"
Assert-True ($rejectedReq.rejectionReason -eq "Critical deployment scheduled on those dates") "Rejection reason saved"
Assert-True ($rejectedReq.approvedByName -eq "Mark Manager") "Decision maker recorded on rejection"

Write-Host "`n=======================================================" -ForegroundColor Green
Write-Host "ALL 9 LEAVE WORKFLOW SUITES DEMONSTRATED & PASSED!" -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green
