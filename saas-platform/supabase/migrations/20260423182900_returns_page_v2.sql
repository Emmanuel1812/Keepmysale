ALTER TABLE negotiations ADD COLUMN IF NOT EXISTS refund_processed BOOLEAN DEFAULT false;
ALTER TABLE negotiations ADD COLUMN IF NOT EXISTS refund_processed_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE negotiations ADD COLUMN IF NOT EXISTS return_status VARCHAR(50) DEFAULT 'awaiting_processing';
