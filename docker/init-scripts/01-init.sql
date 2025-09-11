-- File: init-scripts/01-init.sql

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE statuspages TO postgres;

-- Connect to the new database
\c statuspages;

-- Create the pages table WITH user_id column
CREATE TABLE pages (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL, 
    api TEXT NOT NULL,
    secret VARCHAR(255) NOT NULL,
    report VARCHAR(50) NOT NULL,
    groups JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE pages ADD CONSTRAINT unique_slug UNIQUE (slug);

-- Create indexes for better performance
CREATE INDEX idx_pages_slug ON pages (slug);  
CREATE INDEX idx_pages_user_id ON pages (user_id);     
CREATE INDEX idx_pages_name ON pages (name);
CREATE INDEX idx_pages_created_at ON pages (created_at);