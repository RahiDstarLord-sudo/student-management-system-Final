
-- Migration 008: Upgrade Financial Relationships
-- Database: greenfield_college
-- MariaDB 10.11+

-- Step 1: Create fee types

CREATE TABLE IF NOT EXISTS fee_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fee_code VARCHAR(40) NOT NULL,
    fee_name VARCHAR(120) NOT NULL,
    description TEXT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY unique_fee_type_code (fee_code),
    UNIQUE KEY unique_fee_type_name (fee_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- Step 2: Add nullable fee type relationship to invoices

ALTER TABLE fee_invoices
    ADD COLUMN fee_type_id INT NULL AFTER student_id,
    ADD INDEX idx_fee_invoices_fee_type (fee_type_id);


-- Step 3: Add fee type foreign key

ALTER TABLE fee_invoices
    ADD CONSTRAINT fk_fee_invoices_fee_type
        FOREIGN KEY (fee_type_id)
        REFERENCES fee_types(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE;
