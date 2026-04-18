-- Extend the privacy model to Contacts and Employees.
-- Both tables already have created_by. When is_private = true, reads should
-- be filtered by (is_private = false OR created_by = <session user>).
ALTER TABLE contacts  ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;
