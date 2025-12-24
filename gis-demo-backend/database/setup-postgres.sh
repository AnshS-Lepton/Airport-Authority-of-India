#!/bin/bash
# PostgreSQL with PostGIS Setup Script for Linux/Mac
# This script helps set up PostgreSQL with PostGIS extension

echo "========================================="
echo "PostgreSQL with PostGIS Setup Script"
echo "========================================="
echo ""

# Check if PostgreSQL is installed
echo "Checking PostgreSQL installation..."
if ! command -v psql &> /dev/null; then
    echo "PostgreSQL is not installed or not in PATH."
    echo ""
    echo "Please install PostgreSQL with PostGIS:"
    echo "  Ubuntu/Debian: sudo apt-get install postgresql postgresql-contrib postgis"
    echo "  macOS: brew install postgresql postgis"
    echo "  Or visit: https://www.postgresql.org/download/"
    echo ""
    exit 1
fi

echo "PostgreSQL found!"
echo ""

# Get PostgreSQL version
PG_VERSION=$(psql --version)
echo "PostgreSQL Version: $PG_VERSION"
echo ""

# Prompt for database connection details
read -p "Host (default: localhost): " DB_HOST
DB_HOST=${DB_HOST:-localhost}

read -p "Port (default: 5432): " DB_PORT
DB_PORT=${DB_PORT:-5432}

read -p "Username (default: postgres): " DB_USER
DB_USER=${DB_USER:-postgres}

read -sp "Password: " DB_PASSWORD
echo ""

read -p "Database name (default: gis_demo): " DB_NAME
DB_NAME=${DB_NAME:-gis_demo}

echo ""
echo "Creating database and setting up PostGIS..."

# Export password for psql
export PGPASSWORD=$DB_PASSWORD

# Create database if it doesn't exist
echo "Creating database '$DB_NAME'..."
if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1; then
    echo "Database '$DB_NAME' already exists."
else
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME;"
    if [ $? -eq 0 ]; then
        echo "Database '$DB_NAME' created successfully!"
    else
        echo "Failed to create database."
        exit 1
    fi
fi

# Enable PostGIS extension
echo "Enabling PostGIS extension..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS postgis;"
if [ $? -eq 0 ]; then
    echo "PostGIS extension enabled successfully!"
else
    echo "Failed to enable PostGIS extension. Make sure PostGIS is installed."
    echo "  Ubuntu/Debian: sudo apt-get install postgis"
    echo "  macOS: brew install postgis"
    exit 1
fi

# Verify PostGIS installation
echo "Verifying PostGIS installation..."
POSTGIS_VERSION=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT PostGIS_Version();")
if [ ! -z "$POSTGIS_VERSION" ]; then
    echo "PostGIS Version: $POSTGIS_VERSION"
else
    echo "PostGIS verification failed."
    exit 1
fi

echo ""
echo "========================================="
echo "Setup completed successfully!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Run the schema.sql script to create tables:"
echo "   psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f src/database/schema.sql"
echo ""
echo "2. Update your .env file with these credentials:"
echo "   DB_HOST=$DB_HOST"
echo "   DB_PORT=$DB_PORT"
echo "   DB_USER=$DB_USER"
echo "   DB_PASSWORD=<your_password>"
echo "   DB_NAME=$DB_NAME"
echo ""

# Clear password
unset PGPASSWORD





