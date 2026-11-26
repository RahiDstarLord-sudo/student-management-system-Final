USE greenfield_college;

-- Additive registration workflow migration. Existing records are preserved.
-- Run once after migrations 010 and 012.

ALTER TABLE student_activation_codes
  ADD COLUMN IF NOT EXISTS status ENUM('issued','pending','approved','rejected','revoked') NOT NULL DEFAULT 'issued' AFTER used_at,
  ADD COLUMN IF NOT EXISTS revoked_at DATETIME NULL AFTER status,
  ADD COLUMN IF NOT EXISTS created_by INT NULL AFTER revoked_at;

UPDATE student_activation_codes a
INNER JOIN students s ON s.student_id = a.student_id
SET a.status = CASE
  WHEN a.revoked_at IS NOT NULL THEN 'revoked'
  WHEN s.registration_status = 'approved' THEN 'approved'
  WHEN s.registration_status = 'rejected' THEN 'rejected'
  WHEN s.name IS NOT NULL THEN 'pending'
  ELSE 'issued'
END;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_change_password TINYINT(1) NOT NULL DEFAULT 0 AFTER status;

-- Enforce one student login account per student ID. The existing SQL snapshot has no duplicates.
-- Before running against a live database, verify: SELECT student_id, COUNT(*) FROM users WHERE student_id IS NOT NULL GROUP BY student_id HAVING COUNT(*) > 1;
ALTER TABLE users
  ADD UNIQUE KEY IF NOT EXISTS uq_users_student_id (student_id);

ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS department_id INT NULL AFTER department;

UPDATE teachers t
INNER JOIN departments d
  ON d.department_name = t.department OR d.department_code = t.department
SET t.department_id = d.id
WHERE t.department_id IS NULL;

ALTER TABLE teachers
  ADD KEY IF NOT EXISTS idx_teachers_department_id (department_id);

ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS registration_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved' AFTER status,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP NULL DEFAULT NULL AFTER registration_status,
  ADD COLUMN IF NOT EXISTS approved_by INT NULL DEFAULT NULL AFTER approved_at;


CREATE TABLE IF NOT EXISTS teacher_activation_codes (
  id INT NOT NULL AUTO_INCREMENT,
  teacher_id VARCHAR(40) NOT NULL,
  code_hash VARCHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL DEFAULT NULL,
  status ENUM('issued','pending','approved','rejected','revoked') NOT NULL DEFAULT 'issued',
  revoked_at DATETIME NULL DEFAULT NULL,
  created_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_teacher_activation_teacher (teacher_id),
  KEY idx_teacher_activation_status (status, created_at),
  CONSTRAINT fk_teacher_activation_creator
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

SET @teacher_department_fk_exists = (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'teachers'
    AND CONSTRAINT_NAME = 'fk_teachers_department_registration'
);
SET @teacher_department_fk_sql = IF(
  @teacher_department_fk_exists = 0,
  'ALTER TABLE teachers ADD CONSTRAINT fk_teachers_department_registration FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE teacher_department_fk_stmt FROM @teacher_department_fk_sql;
EXECUTE teacher_department_fk_stmt;
DEALLOCATE PREPARE teacher_department_fk_stmt;

-- Existing rows receive the migration default 'approved'; newly registered teachers are inserted as 'pending'.

-- Ensure the existing administrative roles have the permissions required by this workflow.
-- Teacher and student roles receive none of these administrative permissions.
INSERT IGNORE INTO permissions (permission_key, permission_name, description) VALUES
  ('students.view', 'View Students', 'View approved student records'),
  ('students.create', 'Generate Student IDs', 'Issue student registration IDs'),
  ('students.update', 'Update Students', 'Update approved student records'),
  ('students.delete', 'Deactivate Students', 'Deactivate student accounts without deleting records'),
  ('students.registration.review', 'Review Registrations', 'Review, approve and reject student and teacher registrations'),
  ('teachers.manage', 'Manage Teachers', 'View and manage approved teacher records and issue teacher registration IDs');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.permission_key IN (
  'students.view',
  'students.create',
  'students.update',
  'students.delete',
  'students.registration.review',
  'teachers.manage'
)
WHERE r.role_key IN ('superadmin', 'admin');


-- Explicitly keep registration and directory administration out of student/teacher roles.
DELETE rp
FROM role_permissions rp
INNER JOIN roles r ON r.id = rp.role_id
INNER JOIN permissions p ON p.id = rp.permission_id
WHERE r.role_key IN ('teacher', 'student')
  AND p.permission_key IN (
    'students.view',
    'students.create',
    'students.update',
    'students.delete',
    'students.registration.review',
    'teachers.manage'
  );
