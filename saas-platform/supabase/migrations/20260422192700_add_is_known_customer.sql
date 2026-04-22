ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_known_customer BOOLEAN DEFAULT false;
