$BASE = 'http://localhost:5000/api/v1'
$pass = 0
$fail = 0

function Check($label, $cond) {
    if ($cond) {
        Write-Host "  [PASS] $label" -ForegroundColor Green
        $script:pass++
    } else {
        Write-Host "  [FAIL] $label" -ForegroundColor Red
        $script:fail++
    }
}

function Hit($method, $url, $body=$null, $headers=$null) {
    $params = @{ Uri=$url; Method=$method; ContentType='application/json'; ErrorAction='Stop' }
    if ($body)    { $params.Body    = ($body | ConvertTo-Json -Depth 5) }
    if ($headers) { $params.Headers = $headers }
    try { return Invoke-RestMethod @params }
    catch {
        $status = $_.Exception.Response.StatusCode.value__
        Write-Host "    HTTP $status on $method $url" -ForegroundColor DarkYellow
        return $null
    }
}

# ── 0. Health ──────────────────────────────────────────────────────────────────
Write-Host "`n[ Health ]" -ForegroundColor Cyan
$h = Invoke-RestMethod -Uri 'http://localhost:5000/health' -ErrorAction SilentlyContinue
Check "GET /health returns ok" ($h.status -eq 'ok')

# ── 1. Auth ────────────────────────────────────────────────────────────────────
Write-Host "`n[ Auth ]" -ForegroundColor Cyan

$bad = Hit POST "$BASE/auth/login" @{email='admin@acadai.edu'; password='wrong'}
Check "Login bad password blocked"         ($bad -eq $null)

$login = Hit POST "$BASE/auth/login" @{email='admin@acadai.edu'; password='Admin@1234'}
Check "Login success returns token"        ($login.data.token.Length -gt 10)
Check "Login returns user role=admin"      ($login.data.user.role -eq 'admin')

$token = $login.data.token
$H = @{Authorization="Bearer $token"}

$me = Hit GET "$BASE/auth/me" -headers $H
Check "GET /auth/me returns current user"  ($me.data.email -eq 'admin@acadai.edu')

$ref = Hit POST "$BASE/auth/refresh" -headers $H
Check "POST /auth/refresh returns token"   ($ref.data.token.Length -gt 10)

$noauth = Hit GET "$BASE/students"
Check "No token → 401 blocked"            ($noauth -eq $null)

# ── 2. Lookups ─────────────────────────────────────────────────────────────────
Write-Host "`n[ Lookups ]" -ForegroundColor Cyan
$lk = Hit GET "$BASE/students/lookups" -headers $H
Check "GET /students/lookups success"     ($lk.success -eq $true)
Check "Majors list populated"             ($lk.data.majors.Count -ge 4)
Check "Grades list populated"             ($lk.data.grades.Count -ge 4)
Check "Semesters list populated"          ($lk.data.semesters.Count -ge 4)

# ── 3. Students List & Filters ─────────────────────────────────────────────────
Write-Host "`n[ Students - List and Filters ]" -ForegroundColor Cyan

$list = Hit GET "$BASE/students" -headers $H
Check "GET /students returns list"        ($list.success -eq $true)
Check "Total students = 8 (seeded)"       ($list.total -eq 8)
Check "Students have riskLevel field"     ($list.students[0].riskLevel -ne $null)
Check "Students have aiPrediction field"  ($null -ne $list.students[0].PSObject.Properties['aiPrediction'])
Check "Students have grade (joined)"      ($list.students[0].grade.Length -gt 0)
Check "Students have major (joined)"      ($list.students[0].major.Length -gt 0)
Check "Students have studentCode"         ($list.students[0].studentCode -like 'STU-*')

$highRisk = Hit GET "$BASE/students?risk=high" -headers $H
$hasNonHigh = ($highRisk.students | Where-Object { $_.riskLevel -ne 'high' }).Count
Check "Filter risk=high: all returned are high" ($hasNonHigh -eq 0)
Check "Filter risk=high returns results"  ($highRisk.total -ge 1)

$search = Hit GET "$BASE/students?search=Elena" -headers $H
Check "Search by name works"              ($search.total -ge 1)
Check "Search result matches name"        ($search.students[0].name -like '*Elena*')

$page2 = Hit GET "$BASE/students?limit=3`&page=2" -headers $H
Check "Pagination page=2 limit=3"        ($page2.students.Count -le 3)

$sorted = Hit GET "$BASE/students?sort=score`&order=ASC" -headers $H
$scores  = $sorted.students | ForEach-Object { [decimal]$_.score }
$prev = -1; $sortOk = $true
foreach ($s in $scores) { if ($s -lt $prev) { $sortOk = $false; break }; $prev = $s }
Check "Sort by score ASC is ordered"     $sortOk

# ── 4. Students CRUD ───────────────────────────────────────────────────────────
Write-Host "`n[ Students - CRUD ]" -ForegroundColor Cyan

$ts = [int][double]::Parse((Get-Date -UFormat %s))
$testEmail = "test.stability.$ts@test.edu"
$newStudent = Hit POST "$BASE/students" @{
    name='Test Student'; email=$testEmail
    grade='Grade 11-A'; major='Computer Science'; semester='2nd / Spring'
    attendance=75.0; score=6.5
} -headers $H
Check "POST /students creates student"    ($newStudent.success -eq $true)
Check "New student has studentCode"       ($newStudent.data.studentCode -like 'STU-*')
Check "New student has numeric id"        ([int]$newStudent.data.id -gt 0)

$newId   = $newStudent.data.id
$newCode = $newStudent.data.studentCode

$got = Hit GET "$BASE/students/$newId" -headers $H
Check "GET /students/:id by numeric id"   ($got.data.name -eq 'Test Student')

$gotByCode = Hit GET "$BASE/students/$newCode" -headers $H
Check "GET /students/:id by student_code" ($gotByCode.data.name -eq 'Test Student')

$upd = Hit PUT "$BASE/students/$newId" @{score=8.0; attendance=90.0} -headers $H
Check "PUT /students/:id updates fields"  ($upd.success -eq $true)
Check "PUT updated score reflected"       ([decimal]$upd.data.score -eq 8.0)

$dup = Hit POST "$BASE/students" @{
    name='Dup'; email=$testEmail
    grade='Grade 10-A'; major='Physics'; attendance=80; score=7
} -headers $H
Check "Duplicate email → 409 blocked"    ($dup -eq $null)

# ── 5. Prediction ──────────────────────────────────────────────────────────────
Write-Host "`n[ Prediction ]" -ForegroundColor Cyan

$pred = Hit POST "$BASE/predict" @{
    attendance=80.0; score=7.5; grade='Grade 11-A'; major='Computer Science'
} -headers $H
Check "POST /predict (anon) works"         ($pred.success -eq $true)
Check "Prediction value is numeric"        ($pred.data.prediction -is [double] -or $pred.data.prediction -is [int])
Check "RiskLevel returned"                 ($pred.data.riskLevel -ne $null)
Check "Confidence returned"                ($pred.data.confidence -ne $null)

$pred2 = Hit POST "$BASE/predict" @{
    studentId=[int]$newId; attendance=55.0; score=4.0
    grade='Grade 11-A'; major='Computer Science'
} -headers $H
Check "POST /predict with studentId works"  ($pred2.success -eq $true)
Check "High-risk prediction correct"        ($pred2.data.riskLevel -eq 'high')

Start-Sleep -Milliseconds 1200   # allow async view refresh
$hist = Hit GET "$BASE/predict/student/$newId/history" -headers $H
Check "GET prediction history returns data" ($hist.data.Count -ge 1)
Check "History has confidence field"        ($hist.data[0].confidence -ne $null)
Check "History has model_version"           ($hist.data[0].model_version -ne $null)

# Batch: 3 real + 1 fake
$realIds = ($list.students | Select-Object -First 3).id | ForEach-Object { [int]$_ }
$fakeId  = 999999
$batchIds = @($realIds[0], $realIds[1], $realIds[2], $fakeId)
$batch = Hit POST "$BASE/predict/batch" @{studentIds=$batchIds} -headers $H
Check "POST /predict/batch works"           ($batch.success -eq $true)
Check "Batch processed 3 real students"     ($batch.count -eq 3)
Check "Batch skipped 1 invalid id"          ($batch.skipped -eq 1)
Check "Batch results have riskLevel"        ($batch.data[0].riskLevel -ne $null)

# ── 6. Dashboard ───────────────────────────────────────────────────────────────
Write-Host "`n[ Dashboard ]" -ForegroundColor Cyan

$stats = Hit GET "$BASE/dashboard/stats" -headers $H
Check "GET /dashboard/stats works"             ($stats.success -eq $true)
Check "totalStudents >= 8"                     ($stats.data.totalStudents -ge 8)
Check "averageScore > 0"                       ($stats.data.averageScore -gt 0)
Check "atRiskStudents present"                 ($null -ne $stats.data.PSObject.Properties['atRiskStudents'])
Check "avgAttendance > 0"                      ($stats.data.avgAttendance -gt 0)
Check "unscoredStudents field present"         ($null -ne $stats.data.PSObject.Properties['unscoredStudents'])

$dist = Hit GET "$BASE/dashboard/class-distribution" -headers $H
Check "GET /class-distribution works"          ($dist.success -eq $true)
Check "Distribution entries present"           ($dist.data.Count -gt 0)
Check "Distribution has percent field"         ($dist.data[0].percent -ne $null)

$riskDist = Hit GET "$BASE/dashboard/risk-distribution" -headers $H
Check "GET /risk-distribution works"           ($riskDist.success -eq $true)
Check "Risk distribution has entries"          ($riskDist.data.Count -gt 0)

$cacheRefresh = Hit POST "$BASE/dashboard/refresh-cache" -headers $H
Check "POST /refresh-cache (admin) works"      ($cacheRefresh.success -eq $true)

# ── 7. Soft Delete ─────────────────────────────────────────────────────────────
Write-Host "`n[ Soft Delete ]" -ForegroundColor Cyan

$del = Hit DELETE "$BASE/students/$newId" -headers $H
Check "DELETE /students/:id soft-deletes"      ($del.success -eq $true)

# After soft-delete, student hidden from list (is_active=FALSE filter)
Start-Sleep -Milliseconds 500
$afterDel = Hit GET "$BASE/students?search=$testEmail" -headers $H
Check "Soft-deleted student hidden from list"  ($afterDel.total -eq 0)

# ── 8. Edge Cases ──────────────────────────────────────────────────────────────
Write-Host "`n[ Edge Cases ]" -ForegroundColor Cyan

$missing = Hit GET "$BASE/students/999999" -headers $H
Check "Non-existent student → 404"          ($missing -eq $null)

$badRoute = Hit GET "$BASE/nonexistent" -headers $H
Check "Unknown route → 404"                ($badRoute -eq $null)

$badBatch = Hit POST "$BASE/predict/batch" @{studentIds=@()} -headers $H
Check "Empty batch → 400 blocked"          ($badBatch -eq $null)

# ── Summary ────────────────────────────────────────────────────────────────────
Write-Host ""
$total = $pass + $fail
$color = if ($fail -eq 0) { 'Green' } else { 'Yellow' }
Write-Host "-----------------------------------------" -ForegroundColor White
Write-Host "  Results: $pass/$total passed  |  $fail failed" -ForegroundColor $color
Write-Host "-----------------------------------------" -ForegroundColor White
if ($fail -gt 0) { exit 1 }
