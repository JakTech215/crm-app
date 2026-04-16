-- Recurring series members were previously given parent_task_id = recurrence_source_task_id,
-- which made the task-delete guard falsely treat them as true subtask dependents.
-- The series membership is already tracked by recurrence_source_task_id, so clear the
-- redundant parent_task_id link on those rows.
UPDATE tasks
SET parent_task_id = NULL
WHERE parent_task_id IS NOT NULL
  AND parent_task_id = recurrence_source_task_id;
