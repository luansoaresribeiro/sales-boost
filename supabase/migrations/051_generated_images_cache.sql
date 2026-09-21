-- Cache central de imagens geradas — evita pagar duas vezes pela mesma
-- imagem (mesmo prompt exato, mesma empresa). Compartilhada por todas as
-- funções que geram imagem (creative-generate, content-test, content-image,
-- generate-posts, render-format), via a função central generate-image.
create table if not exists generated_images (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  cache_key text not null,          -- hash do prompt+tamanho que gerou essa imagem
  prompt text not null,             -- prompt completo, pra debug/auditoria
  image_url text not null,
  model text not null,
  reused_count int not null default 0,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  unique (company_id, cache_key)
);
alter table generated_images enable row level security;
create index if not exists idx_generated_images_company on generated_images(company_id);

-- Custo real (não-tokens) — hoje só imagem, mas serve pra qualquer custo
-- futuro que não seja medido em tokens de LLM. NULL continua significando
-- "custo vem só de tokens_used", como já era.
alter table agent_performance add column if not exists cost_usd numeric;
