-- Etapa A (dono, 22/11): custo por operação SEM duplicar + custos fixos separados. Só ACRESCENTA (nenhuma linha antiga é
-- alterada ou apagada; o histórico fica como está e é classificado na leitura por _shared/costLedger.ts).
--  * operation_id: identificador único da operação (1 linha por operação, mesmo com várias chamadas à Anthropic).
--    Índice único parcial: gravar a mesma operação 2x é recusado pelo banco. Linhas antigas ficam com NULL.
--  * ref_id: a peça/estratégia a que o custo pertence (para somar o custo de 1 post entre funções: texto + nota).
--  * cost_kind: medido | preco_por_uso | estimado (NULL nas linhas antigas = classificadas por regra na leitura).
--  * provider: anthropic | tavily | higgsfield | apify | … (NULL nas antigas = deduzido pelo task_key na leitura).
--  * platform_fixed_costs: custos FIXOS mensais informados pelo dono (VPS, Supabase, Cloudflare…). Só o Owner lê,
--    pela função api-usage (chave de serviço): RLS ligada e nenhuma política = cliente nenhum enxerga.
-- Desfazer (rollback independente deste PR):
--   drop index if exists agent_performance_operation_uq;
--   alter table public.agent_performance drop column if exists operation_id, drop column if exists ref_id,
--     drop column if exists cost_kind, drop column if exists provider, drop column if exists calls;
--   drop table if exists public.platform_fixed_costs;
alter table public.agent_performance
  add column if not exists operation_id uuid,
  add column if not exists ref_id text,
  add column if not exists cost_kind text,
  add column if not exists provider text,
  add column if not exists calls integer;
create unique index if not exists agent_performance_operation_uq on public.agent_performance (operation_id) where operation_id is not null;
create index if not exists agent_performance_ref_idx on public.agent_performance (ref_id) where ref_id is not null;

create table if not exists public.platform_fixed_costs (
  id uuid primary key default gen_random_uuid(),
  month date not null,              -- 1º dia do mês
  item text not null,               -- ex.: "VPS (estúdio de vídeo)", "Supabase Pro"
  provider text,
  amount_usd numeric(12,2) not null check (amount_usd >= 0),
  source text not null default 'informado pelo dono',
  note text,
  created_at timestamptz not null default now(),
  unique (month, item)
);
alter table public.platform_fixed_costs enable row level security;
revoke all on public.platform_fixed_costs from anon, authenticated;
