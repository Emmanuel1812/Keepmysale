alter table negotiations add column if not exists is_manual_refund_required boolean default false;
alter table negotiations add column if not exists refund_rejection_reason text;

-- Add a new status for the workflow if needed, or we use existing ones.
-- The current enum is: 'initiated', 'offer_sent', 'offer_accepted', 'offer_rejected', 'escalated', 'return_initiated', 'completed', 'expired'
-- Let's stick with 'offer_accepted' as the trigger for manual refund if is_manual_refund_required is true.
