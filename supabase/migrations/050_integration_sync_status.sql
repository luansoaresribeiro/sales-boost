-- Fase 1 do plano de arquitetura de sincronização (docs/DATA_SYNC_ARCHITECTURE_PLAN.md):
-- tabela central de saúde/freshness, reaproveitável por QUALQUER conector
-- atual ou futuro. Implementa de uma vez: last_synced_at/last_success_at
-- (princípio 2), status de saúde da conexão (princípio 14) e observabilidade
-- (princípio 18) — hoje espalhados e inconsistentes entre as funções.
create table if not exists integration_sync_status (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  integration text not null,               -- 'instagram' | 'meta_ads' | 'gsc' | 'gbp' | 'competitors' | ...
  last_synced_at timestamptz,              -- última tentativa (sucesso ou não)
  last_success_at timestamptz,             -- última sincronização que funcionou de verdade
  last_error text,
  status text not null default 'unknown',  -- 'healthy' | 'stale' | 'error' | 'disconnected'
  records_synced int,
  updated_at timestamptz not null default now(),
  unique (company_id, integration)
);
alter table integration_sync_status enable row level security;
-- Só a service role escreve/lê (edge functions) — mesma convenção de
-- access_audit_log: nenhuma policy de authenticated/anon.
create index if not exists idx_integration_sync_status_company on integration_sync_status(company_id);

-- Função central: "esse conector está saudável, obsoleto, com erro, ou
-- desconectado?" — usada tanto pela UI (badge de conexão) quanto por
-- helpers futuros dos agentes (Fase 4, checkFreshness). security invoker
-- (padrão): respeita a RLS de quem chama, mesmo padrão de company_access_status.
create or replace function integration_health(p_company_id uuid, p_integration text, p_stale_after_hours int default 24)
returns table (status text, last_synced_at timestamptz, last_success_at timestamptz, last_error text, hours_since_success numeric)
language sql
stable
as $$
  select
    -- "stale" é relativo a quem pergunta (princípio 16 — cada finalidade tem
    -- seu próprio limiar de "atual o suficiente"): mesmo com status='healthy'
    -- gravado pela última sync, se já passou do limiar informado, reportamos
    -- 'stale' em vez de deixar o chamador confiar num "healthy" desatualizado.
    case
      when s.status is null then 'unknown'
      when s.status in ('error', 'disconnected') then s.status
      when s.last_success_at is null then 'unknown'
      when extract(epoch from (now() - s.last_success_at)) / 3600.0 > p_stale_after_hours then 'stale'
      else s.status
    end as status,
    s.last_synced_at,
    s.last_success_at,
    s.last_error,
    extract(epoch from (now() - s.last_success_at)) / 3600.0 as hours_since_success
  from integration_sync_status s
  where s.company_id = p_company_id and s.integration = p_integration
$$;
grant execute on function integration_health(uuid, text, int) to authenticated;
