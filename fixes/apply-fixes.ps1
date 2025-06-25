# WhatsApp MCP Fix Script for Windows

Write-Host "WhatsApp MCP Fix Script" -ForegroundColor Green
Write-Host "======================" -ForegroundColor Green
Write-Host ""

# Check if PostgreSQL is running
Write-Host "Checking PostgreSQL service..." -ForegroundColor Yellow
$pgService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
if ($pgService -and $pgService.Status -eq "Running") {
    Write-Host "✓ PostgreSQL is running" -ForegroundColor Green
} else {
    Write-Host "✗ PostgreSQL is not running. Please start it first." -ForegroundColor Red
    exit 1
}

# Apply database fix
Write-Host ""
Write-Host "Applying database fix..." -ForegroundColor Yellow
$fixPath = Join-Path $PSScriptRoot "fix-campaigns-constraint.sql"

if (Test-Path $fixPath) {
    # Try to apply the fix
    $password = Read-Host "Enter PostgreSQL password for user 'postgres'" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
    $plainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
    
    $env:PGPASSWORD = $plainPassword
    psql -U postgres -d whatsapp_mcp -f $fixPath
    $env:PGPASSWORD = ""
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Database fix applied successfully" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed to apply database fix" -ForegroundColor Red
    }
} else {
    Write-Host "✗ Fix file not found: $fixPath" -ForegroundColor Red
}

# Clear sessions directory
Write-Host ""
$sessionsPath = Join-Path (Split-Path $PSScriptRoot) "sessions"
if (Test-Path $sessionsPath) {
    Write-Host "Clearing sessions directory..." -ForegroundColor Yellow
    Remove-Item "$sessionsPath\*" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "✓ Sessions directory cleared" -ForegroundColor Green
} else {
    Write-Host "Creating sessions directory..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $sessionsPath -Force | Out-Null
    Write-Host "✓ Sessions directory created" -ForegroundColor Green
}

# Run test script
Write-Host ""
Write-Host "Running verification tests..." -ForegroundColor Yellow
Write-Host ""
$testPath = Join-Path $PSScriptRoot "test-fixes.js"
if (Test-Path $testPath) {
    node $testPath
} else {
    Write-Host "✗ Test file not found" -ForegroundColor Red
}

Write-Host ""
Write-Host "Fix process completed!" -ForegroundColor Green
Write-Host "Now restart your server with: npm start" -ForegroundColor Cyan
