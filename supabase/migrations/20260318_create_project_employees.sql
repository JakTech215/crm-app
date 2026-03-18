-- Junction table linking projects to employees
CREATE TABLE IF NOT EXISTS project_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, employee_id)
);

-- Enable RLS
ALTER TABLE project_employees ENABLE ROW LEVEL SECURITY;

-- RLS policies (match pattern used by project_tasks)
CREATE POLICY "Users can manage project_employees"
  ON project_employees FOR ALL
  USING (true)
  WITH CHECK (true);
