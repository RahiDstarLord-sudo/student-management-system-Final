
USE greenfield_college;

-- 1. Allow students to complete their information during registration
ALTER TABLE students
    MODIFY COLUMN name VARCHAR(100) NULL,
    MODIFY COLUMN email VARCHAR(100) NULL,
    MODIFY COLUMN course VARCHAR(100) NULL,
    ADD COLUMN registration_status
        ENUM('pending', 'approved', 'rejected')
        NOT NULL DEFAULT 'pending',
    ADD COLUMN approved_at TIMESTAMP NULL DEFAULT NULL,
    ADD COLUMN approved_by INT NULL DEFAULT NULL;

-- 2. Preserve existing records and map their old status
UPDATE students
SET registration_status = CASE
    WHEN LOWER(status) = 'pending' THEN 'pending'
    ELSE 'approved'
END;

-- 3. Add NID to student profiles
ALTER TABLE student_profiles
    ADD COLUMN nid VARCHAR(30) NULL,
    ADD UNIQUE KEY uq_student_profiles_nid (nid);

-- 4. Create activation code storage
CREATE TABLE IF NOT EXISTS student_activation_codes (
    id INT NOT NULL AUTO_INCREMENT,
    student_id VARCHAR(20) NOT NULL,
    code_hash VARCHAR(255) NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_student_activation_student (student_id),
    CONSTRAINT fk_student_activation_student
        FOREIGN KEY (student_id)
        REFERENCES students (student_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci;

