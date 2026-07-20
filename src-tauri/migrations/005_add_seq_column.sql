-- Add seq column to request_logs for rowid-based sequence numbering
ALTER TABLE request_logs ADD COLUMN seq INTEGER;
-- Backfill seq with rowid for existing rows
UPDATE request_logs SET seq = rowid WHERE seq IS NULL;
