-- Agente de Estratégia: estratégia principal (kind='main') + iniciativas
-- estratégicas (kind='initiative', apontam pra uma main via parent_strategy_id).
-- Pedido do dono, 2026-09: camada entre Agente de Dados e Agente de Conteúdo.
create table marketing_ai_strategies (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  kind text not null default 'main' check (kind in ('main','initiative')),
  parent_strategy_id uuid references marketing_ai_strategies(id) on delete cascade,
  name text not null,
  status text not null default 'draft' check (status in ('draft','active','paused','completed','needs_review')),
  primary_business_objective text,
  primary_marketing_objective text,
  strategic_focus text,
  horizon text,
  assumptions jsonb not null default '[]',
  constraints jsonb not null default '[]',
  reasoning text,
  funnel_plan jsonb not null default '[]',
  budget jsonb not null default '{}',
  estimates jsonb not null default '{}',
  data_provenance jsonb not null default '{}',
  created_by text not null default 'ai' check (created_by in ('ai','user')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_mai_strategies_company on marketing_ai_strategies(company_id, kind, status);
alter table marketing_ai_strategies enable row level security;
create policy "owner all strategies" on marketing_ai_strategies for all
  using (company_id in (select id from companies where user_id = auth.uid()))
  with check (company_id in (select id from companies where user_id = auth.uid()));

create table marketing_ai_strategy_goals (
  id uuid primary key default gen_random_uuid(),
  strategy_id uuid not null references marketing_ai_strategies(id) on delete cascade,
  name text not null,
  goal_type text not null,
  baseline_value numeric,
  baseline_verified boolean not null default false,
  target_value numeric,
  period text,
  deadline date,
  priority text default 'medium' check (priority in ('high','medium','low')),
  data_source text,
  measurement_method text,
  current_progress numeric,
  status text not null default 'active' check (status in ('active','achieved','at_risk','abandoned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_mai_strategy_goals_strategy on marketing_ai_strategy_goals(strategy_id);
alter table marketing_ai_strategy_goals enable row level security;
create policy "owner all strategy goals" on marketing_ai_strategy_goals for all
  using (strategy_id in (select id from marketing_ai_strategies where company_id in (select id from companies where user_id = auth.uid())))
  with check (strategy_id in (select id from marketing_ai_strategies where company_id in (select id from companies where user_id = auth.uid())));

-- Reaproveita o log de recomendações que já existe (BrainTab.tsx já lê isso)
-- como o feed de "Acompanhamento" da estratégia — nunca cria log paralelo.
alter table marketing_ai_strategy_log add column if not exists strategy_id uuid references marketing_ai_strategies(id) on delete set null;
