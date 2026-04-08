create table if not exists knowledge_base (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references merchants(id) on delete cascade not null,
  title text not null,
  content text not null,
  content_embedding vector(1536),
  category text,
  language text default 'nl',
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_kb_merchant on knowledge_base(merchant_id);
create index if not exists idx_kb_embedding on knowledge_base
  using ivfflat (content_embedding vector_cosine_ops);
