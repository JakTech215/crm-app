-- Project statuses lookup table used by the Settings > Project Statuses
-- editor and the project create/edit status dropdowns. projects.status
-- stores the status name as free text, not a FK, so this table is purely
-- a configurable source of options + colors.
CREATE TABLE IF NOT EXISTS project_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT 'gray',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE project_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage project_statuses"
  ON project_statuses FOR ALL
  USING (true)
  WITH CHECK (true);

-- Seed the defaults referenced by the UI so the dropdown is populated
-- even before anyone visits Settings. ON CONFLICT lets this migration
-- be safely re-applied.
INSERT INTO project_statuses (name, color) VALUES
  ('planning', 'blue'),
  ('active', 'green'),
  ('on_hold', 'yellow'),
  ('completed', 'gray'),
  ('cancelled', 'red')
ON CONFLICT (name) DO NOTHING;
