USE greenfield_college;

-- Allow teacher and superadmin accounts
ALTER TABLE users
  MODIFY COLUMN role ENUM('admin','student','teacher','superadmin') NOT NULL;