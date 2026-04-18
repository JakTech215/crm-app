-- Add an is_private flag to the entities that the UI lets users create:
-- projects, tasks, notes_standalone (Quick Capture + linked notes),
-- meeting_notes, and events. When true, only the creator (created_by)
-- can read the row; fetches filter with
--   (is_private = false OR created_by = <session user>).
ALTER TABLE projects         ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE tasks            ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE notes_standalone ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE meeting_notes    ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE events           ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;
