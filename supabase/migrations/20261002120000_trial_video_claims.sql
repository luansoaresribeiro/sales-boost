-- 7-Day Growth Preview, passo 3 (trava do 1 vídeo grátis por teste).
-- Aditiva. Só o service role escreve (edge function da Parte B).
-- DESFAZER: drop table if exists trial_video_claims;

create table if not exists trial_video_claims (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  status text not null default 'claimed' check (status in ('claimed','completed','failed')),
  item_id uuid,
  job_ref text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint trial_video_one_per_company unique (company_id)
);

alter table trial_video_claims enable row level security;
drop policy if exists "users see own company trial_video_claims" on trial_video_claims;
create policy "users see own company trial_video_claims" on trial_video_claims for select
  using (company_id in (select id from companies where user_id = auth.uid()));
-- Sem policy de insert/update/delete: só o service role escreve.
