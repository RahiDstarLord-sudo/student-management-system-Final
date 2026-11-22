
-- Migration 004: Teacher Profile Tables
-- Database: greenfield_college
-- MariaDB 10.11+

CREATE TABLE IF NOT EXISTS teacher_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    teacher_id VARCHAR(40) NOT NULL UNIQUE,
    date_of_birth DATE NULL,
    gender VARCHAR(30) NULL,
    phone VARCHAR(30) NULL,
    alternate_phone VARCHAR(30) NULL,
    address TEXT NULL,
    emergency_contact_name VARCHAR(150) NULL,
    emergency_contact_phone VARCHAR(30) NULL,
    profile_photo VARCHAR(500) NULL,
    joining_date DATE NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_teacher_profiles_teacher
        FOREIGN KEY (teacher_id)
        REFERENCES teachers(teacher_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE IF NOT EXISTS teacher_documents (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    teacher_id VARCHAR(40) NOT NULL,
    document_type VARCHAR(80) NOT NULL,
    document_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100) NULL,
    file_size BIGINT UNSIGNED NULL,
    uploaded_by INT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_teacher_documents_teacher (teacher_id),

    CONSTRAINT fk_teacher_documents_teacher
        FOREIGN KEY (teacher_id)
        REFERENCES teachers(teacher_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_teacher_documents_uploader
        FOREIGN KEY (uploaded_by)
        REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE IF NOT EXISTS teacher_qualifications (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    teacher_id VARCHAR(40) NOT NULL,
    qualification VARCHAR(150) NOT NULL,
    institution_name VARCHAR(200) NULL,
    subject_or_major VARCHAR(150) NULL,
    passing_year YEAR NULL,
    grade_or_result VARCHAR(50) NULL,
    experience_years DECIMAL(4,1) NULL,
    remarks TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_teacher_qualifications_teacher (teacher_id),

    CONSTRAINT fk_teacher_qualifications_teacher
        FOREIGN KEY (teacher_id)
        REFERENCES teachers(teacher_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
