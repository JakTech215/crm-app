-- 20260212_enable_tasks_rls.sql
-- Enable row level security for tasks and create policy allowing owners (and admins)

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- policies are idempotent; drop if they exist first so re-running this
-- script (or executing after manual changes) will succeed.

DROP POLICY IF EXISTS "Authenticated users can read tasks" ON tasks;
CREATE POLICY "Authenticated users can read tasks" ON tasks
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Owners can insert tasks" ON tasks;
CREATE POLICY "Owners can insert tasks" ON tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Owners can update tasks" ON tasks;
CREATE POLICY "Owners can update tasks" ON tasks
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Owners can delete tasks" ON tasks;
CREATE POLICY "Owners can delete tasks" ON tasks
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS(
      SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- optionally allow admins to bypass checks on write

