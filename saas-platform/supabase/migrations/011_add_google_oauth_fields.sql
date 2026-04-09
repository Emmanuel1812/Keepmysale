-- Migration 011: Add Google OAuth fields to merchants table
ALTER TABLE merchants ADD COLUMN google_access_token_encrypted text;
ALTER TABLE merchants ADD COLUMN google_refresh_token_encrypted text;
ALTER TABLE merchants ADD COLUMN google_email varchar;
