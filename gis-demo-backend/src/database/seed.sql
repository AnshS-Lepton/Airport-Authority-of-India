-- Seed data for GIS Demo
-- Note: Passwords are hashed with bcrypt (10 rounds)
-- Default password for all users: "password123"

-- Insert sample users
INSERT INTO users (email, password, first_name, last_name, role, status) VALUES
-- Password: password123
('pilot1@demo.com', '$2b$10$rQZ8vK5J5Z5Z5Z5Z5Z5Z5OeZ5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z', 'John', 'Pilot', 'PILOT', 'ACTIVE'),
-- Password: password123
('pilot2@demo.com', '$2b$10$rQZ8vK5J5Z5Z5Z5Z5Z5Z5OeZ5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z', 'Jane', 'Aviator', 'PILOT', 'ACTIVE'),
-- Password: password123
('approver@demo.com', '$2b$10$rQZ8vK5J5Z5Z5Z5Z5Z5Z5OeZ5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z', 'Robert', 'Approver', 'APPROVER', 'ACTIVE'),
-- Password: password123
('admin@demo.com', '$2b$10$rQZ8vK5J5Z5Z5Z5Z5Z5Z5OeZ5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z', 'Admin', 'User', 'ADMIN', 'ACTIVE')
ON CONFLICT (email) DO NOTHING;

-- Insert sample zones (around Delhi, India)
-- RED Zone (Prohibited) - Airport area
INSERT INTO zones (name, type, geometry, min_altitude, max_altitude, status) VALUES
('Delhi Airport - Prohibited Zone', 'RED', 
 ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[77.08,28.55],[77.12,28.55],[77.12,28.58],[77.08,28.58],[77.08,28.55]]]}'),
 0, 1000, 'ACTIVE')
ON CONFLICT (name) DO NOTHING;

-- YELLOW Zone (Restricted) - Government area
INSERT INTO zones (name, type, geometry, min_altitude, max_altitude, status) VALUES
('Central Delhi - Restricted Zone', 'YELLOW',
 ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[77.20,28.60],[77.25,28.60],[77.25,28.65],[77.20,28.65],[77.20,28.60]]]}'),
 0, 500, 'ACTIVE')
ON CONFLICT (name) DO NOTHING;

-- GREEN Zone (Permitted) - Open area
INSERT INTO zones (name, type, geometry, min_altitude, max_altitude, status) VALUES
('Noida - Permitted Zone', 'GREEN',
 ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[77.30,28.50],[77.35,28.50],[77.35,28.55],[77.30,28.55],[77.30,28.50]]]}'),
 0, 200, 'ACTIVE')
ON CONFLICT (name) DO NOTHING;

-- Note: To generate proper bcrypt hashes, use Node.js:
-- const bcrypt = require('bcrypt');
-- const hash = await bcrypt.hash('password123', 10);
-- Then replace the password hashes above

