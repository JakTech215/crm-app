-- Add recurrence_source_task_id to tasks table
-- Links all tasks in a recurring series to the source (first) task
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS recurrence_source_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;

-- Index for efficient series lookups
CREATE INDEX IF NOT EXISTS idx_tasks_recurrence_source
  ON tasks(recurrence_source_task_id)
  WHERE recurrence_source_task_id IS NOT NULL;
