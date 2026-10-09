-- Tour virtual (decisão do dono 2026-10-08): N fotos reais → N trechos de
-- vídeo (Kling via Higgsfield, um por foto) → colados num Reel único.
-- Serve o tour grátis (kind 'trial', trava em trial_video_claims) e, depois,
-- os 12 tours/mês do plano (kind 'plan').
-- Aditiva. Leitura só da própria empresa; escrita só service role (edge function).
-- DESFAZER: drop table if exists video_tours;

create table if not exists video_tours (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  kind text not null default 'trial' check (kind in ('trial', 'plan')),
  status text not null default 'generating' check (status in ('generating', 'assembling', 'completed', 'failed')),
  photos jsonb not null default '[]'::jsonb,  -- URLs das fotos, na ordem da visita
  clips jsonb not null default '[]'::jsonb,   -- [{job_ref, status, attempts}] na mesma ordem
  video_path text,                           -- caminho no bucket 'videos' quando pronto
  error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists video_tours_company_idx on video_tours (company_id, created_at desc);

alter table video_tours enable row level security;
drop policy if exists "users see own company video_tours" on video_tours;
create policy "users see own company video_tours" on video_tours for select
  using (company_id in (select id from companies where user_id = auth.uid()));
-- Sem policy de insert/update/delete: só o service role escreve.
