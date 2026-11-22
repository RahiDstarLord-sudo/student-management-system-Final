-- Migration 009: Communication and System Security
-- Database: greenfield_college
-- MariaDB 10.11+

-- Step 1: University notices

CREATE TABLE IF NOT EXISTS notices (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(180) NOT NULL,
    content TEXT NOT NULL,
    audience ENUM(
        'All',
        'Students',
        'Teachers',
        'Staff'
    ) NOT NULL DEFAULT 'All',
    status ENUM(
        'Draft',
        'Published',
        'Archived'
    ) NOT NULL DEFAULT 'Draft',
    published_at DATETIME NULL,
    expires_at DATETIME NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_notices_status_published (status, published_at),
    INDEX idx_notices_audience (audience),

    CONSTRAINT fk_notices_creator
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- Step 2: User notifications

CREATE TABLE IF NOT EXISTS notifications (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    notice_id BIGINT NULL,
    title VARCHAR(180) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(40) NOT NULL DEFAULT 'General',
    action_url VARCHAR(500) NULL,
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    read_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_notifications_user_read (user_id, is_read, created_at),
    INDEX idx_notifications_notice (notice_id),

    CONSTRAINT fk_notifications_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    CONSTRAINT fk_notifications_notice
        FOREIGN KEY (notice_id)
        REFERENCES notices(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- Step 3: System settings

CREATE TABLE IF NOT EXISTS system_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT NULL,
    setting_type VARCHAR(30) NOT NULL DEFAULT 'string',
    setting_group VARCHAR(60) NOT NULL DEFAULT 'general',
    description VARCHAR(255) NULL,
    is_public TINYINT(1) NOT NULL DEFAULT 0,
    updated_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY unique_system_setting_key (setting_key),
    INDEX idx_system_settings_group (setting_group),

    CONSTRAINT fk_system_settings_updater
        FOREIGN KEY (updated_by)
        REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
