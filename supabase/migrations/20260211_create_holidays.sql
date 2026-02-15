-- Holidays table (federal + user-defined)
CREATE TABLE IF NOT EXISTS holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  holiday_date DATE NOT NULL,
  holiday_type TEXT NOT NULL DEFAULT 'custom',  -- 'federal' or 'custom'
  description TEXT,
  recurring BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(holiday_date, name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(holiday_date);
CREATE INDEX IF NOT EXISTS idx_holidays_type ON holidays(holiday_type);

-- RLS policies
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON holidays FOR ALL TO authenticated USING (true) WITH CHECK (true);
