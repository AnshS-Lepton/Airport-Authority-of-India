-- GIS Demo Database Schema
-- PostgreSQL with PostGIS extension

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('PILOT', 'APPROVER', 'ADMIN')),
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Zones table
CREATE TABLE IF NOT EXISTS zones (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('RED', 'YELLOW', 'GREEN')),
    geometry GEOMETRY NOT NULL,
    min_altitude INTEGER DEFAULT 0,
    max_altitude INTEGER DEFAULT 1000,
    start_date DATE,
    end_date DATE,
    status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'INACTIVE')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create spatial index on zones geometry
CREATE INDEX IF NOT EXISTS zones_geometry_idx ON zones USING GIST (geometry);

-- Flight plans table
CREATE TABLE IF NOT EXISTS flight_plans (
    id SERIAL PRIMARY KEY,
    reference_id VARCHAR(100) UNIQUE NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    geometry GEOMETRY NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    min_altitude INTEGER NOT NULL,
    max_altitude INTEGER NOT NULL,
    drone_type VARCHAR(50) NOT NULL,
    operation_type VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED')),
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (start_time < end_time),
    CHECK (min_altitude >= 0 AND max_altitude >= min_altitude)
);

-- Create spatial index on flight plans geometry
CREATE INDEX IF NOT EXISTS flight_plans_geometry_idx ON flight_plans USING GIST (geometry);

-- Create index on flight plan status for faster queries
CREATE INDEX IF NOT EXISTS flight_plans_status_idx ON flight_plans(status);
CREATE INDEX IF NOT EXISTS flight_plans_user_id_idx ON flight_plans(user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to auto-update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_zones_updated_at BEFORE UPDATE ON zones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_flight_plans_updated_at BEFORE UPDATE ON flight_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

