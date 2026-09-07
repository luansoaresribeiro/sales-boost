-- ─────────────────────────────────────────────────────────────────────────
-- Performance — camada de dados histórica do Instagram (isolada por empresa).
--
-- Guarda snapshots com carimbo de tempo pra comparar hoje vs 7d vs 30d vs 90d
-- sem depender só da resposta atual da API. Tudo com company_id + RLS: uma
-- empresa NUNCA enxerga o Instagram de outra.
-- ─────────────────────────────────────────────────────────────────────────

-- Snapshot diário da conta (seguidores, alcance, impressões, visitas etc.).
create table if not exists instagram_performance_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  captured_for date not null,                 -- dia a que o snapshot se refere
  followers integer,
  reach integer,
  impressions integer,
  profile_visits integer,
  website_clicks integer,
  engagement integer,
  engagement_rate numeric,
  published integer,                          -- publicações no dia
  raw jsonb default '{}'::jsonb,              -- resposta bruta da API (auditoria)
  created_at timestamptz not null default now(),
  unique (company_id, captured_for)
);
create index if not exists idx_igperf_snap_company_date on instagram_performance_snapshots (company_id, captured_for desc);

-- Performance por conteúdo (post/reel/carrossel/story).
create table if not exists instagram_content_performance (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  media_id text not null,                     -- id do Instagram
  media_type text,                            -- reel | post | carousel | story
  caption text,
  thumbnail_url text,
  permalink text,
  posted_at timestamptz,
  reach integer, impressions integer,
  likes integer, comments integer, shares integer, saves integer,
  engagement_rate numeric, followers_gained integer,
  pillar text, funnel_stage text,             -- tof | mof | bof
  raw jsonb default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (company_id, media_id)
);
create index if not exists idx_igperf_content_company on instagram_content_performance (company_id, posted_at desc);

-- Métricas de audiência (crescimento, ganhos/perdas, demografia quando houver).
create table if not exists instagram_audience_metrics (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  captured_for date not null,
  followers integer,
  followers_gained integer,
  followers_lost integer,
  reach_followers integer,
  reach_non_followers integer,
  demographics jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (company_id, captured_for)
);
create index if not exists idx_igperf_aud_company_date on instagram_audience_metrics (company_id, captured_for desc);

-- Insights/anomalias detectadas (oportunidade, atenção, viral etc.).
create table if not exists instagram_performance_insights (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  kind text not null,                         -- opportunity | attention | breakout
  title text not null,
  body text,
  metric text,
  created_at timestamptz not null default now()
);
create index if not exists idx_igperf_ins_company on instagram_performance_insights (company_id, created_at desc);

-- Score de performance (0-100) com o breakdown por componente, historizado.
create table if not exists instagram_performance_scores (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  captured_for date not null,
  total integer not null,
  growth integer, reach integer, engagement integer, content integer, consistency integer,
  created_at timestamptz not null default now(),
  unique (company_id, captured_for)
);
create index if not exists idx_igperf_score_company_date on instagram_performance_scores (company_id, captured_for desc);

-- ── RLS — isolamento total por empresa ────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'instagram_performance_snapshots','instagram_content_performance',
    'instagram_audience_metrics','instagram_performance_insights','instagram_performance_scores'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format($p$create policy "users read own company %1$s" on %1$I for select
      using (company_id in (select id from companies where user_id = auth.uid()))$p$, t);
    -- Escrita é feita pela edge function com service role (bypassa RLS);
    -- não abrimos insert/update pro cliente pra ninguém forjar métrica.
  end loop;
end $$;
