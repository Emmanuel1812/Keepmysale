-- Migration: Add generated_discount_code to negotiations table
alter table negotiations add column if not exists generated_discount_code text;

comment on column negotiations.generated_discount_code is 'The Shopify discount code generated automatically for store credit offers';
