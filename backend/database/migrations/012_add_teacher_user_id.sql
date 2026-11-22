USE greenfield_college;

ALTER TABLE teachers
  ADD COLUMN user_id INT NULL AFTER teacher_id,
  ADD UNIQUE KEY uq_teachers_user_id (user_id),
  ADD CONSTRAINT fk_teachers_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE;