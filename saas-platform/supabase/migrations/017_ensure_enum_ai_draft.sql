-- Migration 017: Ensure AI Draft Enum
-- NOTE: If this fails in a migration tool, run the ALTER TYPE command manually in the SQL Editor.

-- Attempting to add ai_draft if it doesn't exist
-- We wrap in a block but PostgreSQL still might complain about transactions.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
        WHERE typname = 'message_sender' AND enumlabel = 'ai_draft'
    ) THEN
        -- We cannot use ALTER TYPE ADD VALUE in a transaction block (DO block).
        -- So this SQL file serves primarily as documentation for the manual fix
        -- if the standard migration tool wraps it.
        RAISE NOTICE 'Please run: ALTER TYPE message_sender ADD VALUE ''ai_draft''; manually in the SQL Editor if it is missing.';
    END IF;
END $$;
