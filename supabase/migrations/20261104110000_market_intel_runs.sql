-- Inteligência de Mercado, Fase 2 (2026-11-04) — registro por rodada. Aditiva e idempotente: SÓ uma tabela nova.
-- Sem cron, sem mexer em outra tabela, sem apagar nada. Quem escreve é a edge function (service role, que ignora RLS);
-- o dono da empresa só LÊ (mesmo padrão de market_signals_select). Contador nulo = "não medido" (a tela nunca mostra 0 no lugar).
--
--   phase 'collect'     coleta diária de notícias (searched, collected, filtered, accepted, cost_usd, month_cost_usd)
--   phase 'reclassify'  filtro de qualidade aplicado aos sinais já gravados (ignored_by_system, details.reasons)
--   phase 'interpret'   análise de oportunidades (interpreted, accepted, discarded, tokens, fingerprint, unchanged)
--
-- Como reverter (comentado; só rodar se o dono pedir — a tela mostra "Não foi possível verificar" sem a tabela):
--   -- remover a tabela e tudo o que ela guarda:  drop table if exists public.market_intel_runs;

begin;

create table if not exists public.market_intel_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  phase text not null check (phase in ('collect', 'reclassify', 'interpret')),
  searched integer,
  collected integer,
  filtered integer,
  accepted integer,
  interpreted integer,
  discarded integer,
  ignored_by_system integer,
  unchanged boolean not null default false,
  fingerprint text,
  cost_usd numeric,
  month_cost_usd numeric,
  tokens integer,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists market_intel_runs_company_created on public.market_intel_runs (company_id, created_at desc);

alter table public.market_intel_runs enable row level security;

-- Só leitura para quem está logado; nada de escrita para anon/authenticated (a function usa a service role).
revoke all on public.market_intel_runs from anon;
revoke all on public.market_intel_runs from authenticated;
grant select on public.market_intel_runs to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'market_intel_runs' and policyname = 'market_intel_runs_select') then
    create policy market_intel_runs_select on public.market_intel_runs
      for select to authenticated
      using (
        company_id in (select id from public.companies where user_id = auth.uid())
        or exists (select 1 from public.user_roles where email = auth.jwt()->>'email' and role = 'owner')
      );
  end if;
end
$$;

commit;
