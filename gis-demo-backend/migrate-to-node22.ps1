# PowerShell script to migrate to Node.js 22.17
# This script helps rebuild native dependencies for Node.js 22.17

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Node.js 22.17 Migration Script" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Check current Node version
$currentVersion = node --version
Write-Host "Current Node.js version: $currentVersion" -ForegroundColor Yellow
Write-Host "Target Node.js version: v22.17.0" -ForegroundColor Yellow
Write-Host ""

# Check if we're on the correct version
if ($currentVersion -notmatch "^v22\.(1[7-9]|2[0-9]|[3-9]\d)\.\d+|^v2[3-9]\.\d+\.\d+") {
    Write-Host "Warning: You are not on Node.js 22.17 or higher." -ForegroundColor Red
    Write-Host "Please switch to Node.js 22.17.0 using one of these methods:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Using nvm (if installed):" -ForegroundColor Cyan
    Write-Host "  nvm install 22.17.0" -ForegroundColor White
    Write-Host "  nvm use 22.17.0" -ForegroundColor White
    Write-Host ""
    Write-Host "Or download from: https://nodejs.org/" -ForegroundColor Cyan
    Write-Host ""
    $continue = Read-Host "Do you want to continue anyway? (y/n)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        Write-Host "Migration cancelled." -ForegroundColor Red
        exit 1
    }
}

Write-Host "Step 1: Removing old node_modules and package-lock.json..." -ForegroundColor Green
if (Test-Path "node_modules") {
    Remove-Item -Recurse -Force node_modules
    Write-Host "  ✓ Removed node_modules" -ForegroundColor Green
}
if (Test-Path "package-lock.json") {
    Remove-Item -Force package-lock.json
    Write-Host "  ✓ Removed package-lock.json" -ForegroundColor Green
}

Write-Host ""
Write-Host "Step 2: Installing dependencies for Node.js 22.17..." -ForegroundColor Green
npm install

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "=========================================" -ForegroundColor Cyan
    Write-Host "Migration completed successfully!" -ForegroundColor Green
    Write-Host "=========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "You can now start the development server with:" -ForegroundColor Yellow
    Write-Host "  npm run dev" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "=========================================" -ForegroundColor Red
    Write-Host "Migration failed!" -ForegroundColor Red
    Write-Host "=========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please check the error messages above and ensure:" -ForegroundColor Yellow
    Write-Host "  1. You are using Node.js 22.17.0 or higher" -ForegroundColor White
    Write-Host "  2. You have npm 10.0.0 or higher" -ForegroundColor White
    Write-Host "  3. Your system has build tools for native modules" -ForegroundColor White
    Write-Host ""
    exit 1
}

