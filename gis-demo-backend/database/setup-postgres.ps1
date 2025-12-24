# PostgreSQL with PostGIS Setup Script for Windows
# This script helps set up PostgreSQL with PostGIS extension

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "PostgreSQL with PostGIS Setup Script" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Check if PostgreSQL is installed
Write-Host "Checking PostgreSQL installation..." -ForegroundColor Yellow
$pgPath = Get-Command psql -ErrorAction SilentlyContinue

if (-not $pgPath) {
    Write-Host "PostgreSQL is not installed or not in PATH." -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install PostgreSQL with PostGIS:" -ForegroundColor Yellow
    Write-Host "1. Download PostgreSQL from: https://www.postgresql.org/download/windows/" -ForegroundColor White
    Write-Host "2. During installation, make sure to include PostGIS extension" -ForegroundColor White
    Write-Host "   OR install PostGIS separately from: https://postgis.net/install/" -ForegroundColor White
    Write-Host "3. Add PostgreSQL bin directory to your PATH" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "PostgreSQL found at: $($pgPath.Source)" -ForegroundColor Green
Write-Host ""

# Get PostgreSQL version
$pgVersion = & psql --version
Write-Host "PostgreSQL Version: $pgVersion" -ForegroundColor Green
Write-Host ""

# Prompt for database connection details
Write-Host "Enter PostgreSQL connection details:" -ForegroundColor Yellow
$dbHost = Read-Host "Host (default: localhost)"
if ([string]::IsNullOrWhiteSpace($dbHost)) { $dbHost = "localhost" }

$dbPort = Read-Host "Port (default: 5432)"
if ([string]::IsNullOrWhiteSpace($dbPort)) { $dbPort = "5432" }

$dbUser = Read-Host "Username (default: postgres)"
if ([string]::IsNullOrWhiteSpace($dbUser)) { $dbUser = "postgres" }

$dbPassword = Read-Host "Password" -AsSecureString
$dbPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPassword)
)

$dbName = Read-Host "Database name (default: gis_demo)"
if ([string]::IsNullOrWhiteSpace($dbName)) { $dbName = "gis_demo" }

Write-Host ""
Write-Host "Creating database and setting up PostGIS..." -ForegroundColor Yellow

# Set PGPASSWORD environment variable
$env:PGPASSWORD = $dbPasswordPlain

# Create database if it doesn't exist
Write-Host "Creating database '$dbName'..." -ForegroundColor Yellow
& psql -h $dbHost -p $dbPort -U $dbUser -d postgres -c "SELECT 1 FROM pg_database WHERE datname = '$dbName'" | Out-Null
if ($LASTEXITCODE -ne 0) {
    & psql -h $dbHost -p $dbPort -U $dbUser -d postgres -c "CREATE DATABASE $dbName;"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Database '$dbName' created successfully!" -ForegroundColor Green
    } else {
        Write-Host "Failed to create database." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Database '$dbName' already exists." -ForegroundColor Yellow
}

# Enable PostGIS extension
Write-Host "Enabling PostGIS extension..." -ForegroundColor Yellow
& psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -c "CREATE EXTENSION IF NOT EXISTS postgis;"
if ($LASTEXITCODE -eq 0) {
    Write-Host "PostGIS extension enabled successfully!" -ForegroundColor Green
} else {
    Write-Host "Failed to enable PostGIS extension. Make sure PostGIS is installed." -ForegroundColor Red
    exit 1
}

# Verify PostGIS installation
Write-Host "Verifying PostGIS installation..." -ForegroundColor Yellow
$postgisVersion = & psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -t -c "SELECT PostGIS_Version();"
if ($postgisVersion) {
    Write-Host "PostGIS Version: $postgisVersion" -ForegroundColor Green
} else {
    Write-Host "PostGIS verification failed." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Setup completed successfully!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Run the schema.sql script to create tables:" -ForegroundColor White
Write-Host "   psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f src/database/schema.sql" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Update your .env file with these credentials:" -ForegroundColor White
Write-Host "   DB_HOST=$dbHost" -ForegroundColor Gray
Write-Host "   DB_PORT=$dbPort" -ForegroundColor Gray
Write-Host "   DB_USER=$dbUser" -ForegroundColor Gray
Write-Host "   DB_PASSWORD=<your_password>" -ForegroundColor Gray
Write-Host "   DB_NAME=$dbName" -ForegroundColor Gray
Write-Host ""

# Clear password from memory
$dbPasswordPlain = $null
$env:PGPASSWORD = $null





