-- Estúdio de vídeo na VPS da Hostinger (decisão do dono 2026-10-12, ver
-- docs/DECISIONS.md). Um "trabalhador" na VPS pede trabalho de vídeo pra
-- função vps-worker, monta com ffmpeg e devolve. Ele nunca recebe as chaves
-- mestras: entra com um código de 15 min (gerado pelo dono na tela) e
-- recebe um token próprio, guardado aqui só como hash.
-- Todas as tabelas: RLS ligado e sem policy — só a service role (funções) mexe.

create table if not exists worker_nodes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  token_hash text not null unique,
  status text not null default 'active' check (status in ('active', 'revoked')),
  info jsonb not null default '{}'::jsonb, -- cpu, memória, disco, versão do ffmpeg/worker
  enrolled_at timestamptz not null default now(),
  last_seen_at timestamptz
);
alter table worker_nodes enable row level security;

create table if not exists worker_enrollments (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  created_by text,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table worker_enrollments enable row level security;

create table if not exists media_jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('reel_finish')),
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  video_tour_id uuid references video_tours(id) on delete cascade,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  attempts int not null default 0,
  worker_id uuid references worker_nodes(id) on delete set null,
  locked_until timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table media_jobs enable row level security;
create index if not exists media_jobs_status_idx on media_jobs (status, created_at);
create index if not exists media_jobs_tour_idx on media_jobs (video_tour_id);

-- Pega o próximo trabalho sem dois trabalhadores pegarem o mesmo. Um
-- trabalho "running" cujo prazo venceu (trabalhador caiu) volta pra fila;
-- depois de 3 tentativas vira "failed" e o tour volta pro jeito antigo.
create or replace function claim_media_job(p_worker uuid)
returns setof media_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  update media_jobs set status = 'failed', error = coalesce(error, 'trabalhador não terminou em 3 tentativas'), updated_at = now()
   where status = 'running' and locked_until < now() and attempts >= 3;
  return query
  update media_jobs j set status = 'running', worker_id = p_worker, attempts = j.attempts + 1,
         locked_until = now() + interval '15 minutes', updated_at = now()
   where j.id = (
     select id from media_jobs
      where status = 'queued' or (status = 'running' and locked_until < now())
      order by created_at
      limit 1
      for update skip locked)
  returning j.*;
end $$;
revoke all on function claim_media_job(uuid) from public, anon, authenticated;

-- Interruptor geral (Configurações → Servidor). Desligado = tudo como antes.
insert into feature_flags (key, label, enabled)
values ('vps_reel_finish', 'Acabamento de vídeo no servidor (VPS)', false)
on conflict (key) do nothing;

-- Monitor da plataforma (a cada 10 min, alerta crítico no Telegram do dono):
-- avisa se o estúdio parar de dar sinal enquanto o acabamento está ligado, e
-- avisa de novo quando voltar. Com o acabamento desligado, fica sempre "ok".
insert into platform_services (key, name, category, critical, check_type, target, enabled)
values ('vps_studio', 'Estúdio de vídeo (VPS Hostinger)', 'integration', true, 'vps_worker', null, true)
on conflict (key) do nothing;
