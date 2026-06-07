
CREATE DATABASE FindIt;
GO

-- Use the database
USE FindIt;
GO

-- Create Users table
CREATE TABLE Users (
    user_id INT IDENTITY(1,1) PRIMARY KEY,
    username NVARCHAR(50) UNIQUE NOT NULL,
    email NVARCHAR(100) UNIQUE NOT NULL,
    password_hash NVARCHAR(255) NOT NULL,  -- Store hashed passwords
    phone NVARCHAR(20),
    full_name NVARCHAR(100),
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE()
);
GO



-- Create Lost_Items table
CREATE TABLE Lost_Items (
    item_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    item_name NVARCHAR(100) NOT NULL,
    description NVARCHAR(500),
    location NVARCHAR(200),
    date_lost DATE,
    contact_info NVARCHAR(200),
    status NVARCHAR(20) DEFAULT 'lost',  -- lost, claimed, recovered
    image_url NVARCHAR(500),  -- Optional image path
    created_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES Users(user_id)
);
GO

-- Create Found_Items table
CREATE TABLE Found_Items (
    item_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    item_name NVARCHAR(100) NOT NULL,
    description NVARCHAR(500),
    location NVARCHAR(200),
    date_found DATE,
    contact_info NVARCHAR(200),
    status NVARCHAR(20) DEFAULT 'found',  -- found, claimed, returned
    image_url NVARCHAR(500),  -- Optional image path
    created_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES Users(user_id)
);
GO

-- Create Claims table
CREATE TABLE Claims (
    claim_id INT IDENTITY(1,1) PRIMARY KEY,
    found_item_id INT NOT NULL,
    claimant_user_id INT NOT NULL,
    claim_description NVARCHAR(500),
    proof_details NVARCHAR(500),  -- Optional proof info
    status NVARCHAR(20) DEFAULT 'pending',  -- pending, approved, rejected
    submitted_at DATETIME DEFAULT GETDATE(),
    reviewed_at DATETIME,
    FOREIGN KEY (found_item_id) REFERENCES Found_Items(item_id),
    FOREIGN KEY (claimant_user_id) REFERENCES Users(user_id)
);
GO

-- Create Admins table (for admin panel)
CREATE TABLE Admins (
    admin_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT UNIQUE NOT NULL,
    role NVARCHAR(20) DEFAULT 'admin',
    FOREIGN KEY (user_id) REFERENCES Users(user_id)
);
GO

-- Optional: Create indexes for better performance
CREATE INDEX idx_lost_items_user ON Lost_Items(user_id);
CREATE INDEX idx_lost_items_status ON Lost_Items(status);
CREATE INDEX idx_found_items_user ON Found_Items(user_id);
CREATE INDEX idx_found_items_status ON Found_Items(status);
CREATE INDEX idx_claims_status ON Claims(status);
GO