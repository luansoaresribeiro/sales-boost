-- ─────────────────────────────────────────────────────────────────────────
-- Central de Approvals — camada UNIVERSAL de ação/aprovação/execução.
--
-- Toda ação de QUALQUER agente (marketing, ceo, sales, customer, data,
-- research, hermes, automações, integrações) vira uma linha aqui ANTES de
-- executar. Separa claramente aprovação (approval_status) de execução
-- (execution_status), guarda a interpretação do agente e o resultado — pra
-- ter histórico, auditoria e rastreabilidade. Isolada por company_id (RLS).
--
-- Não substitui o fluxo de conteúdo atual (marketing_ai_content); é aditiva.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists agent_actions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,

  -- quem propôs
  agent_key text not null,              -- 'marketing' | 'ceo' | 'sales' | 'customer' | 'data' | 'research' | 'hermes'
  agent_name text,

  -- o que / onde
  action_type text not null,            -- ex.: 'publish_instagram_post' | 'send_whatsapp' | 'reply_review' | 'create_content'
  channel text,                         -- 'instagram' | 'whatsapp' | 'google' | 'email' | 'facebook' | 'hubspot' | 'website' | 'internal'
  integration text,                     -- provider/edge function alvo (opcional)
  target text,                          -- lead/review id, @handle, etc.

  -- o porquê (interpretação do agente)
  title text not null,
  description text,
  agent_interpretation text,
  reason text,
  expected_outcome text,
  payload jsonb not null default '{}'::jsonb,
  risk_level text not null default 'low',   -- low | medium | high
  priority text not null default 'normal',  -- low | normal | high
  source text,                          -- 'chat' | 'autonomous' | 'vault' | 'performance' | 'manual'
  ref_type text,                        -- ligação a linha existente ('marketing_ai_content'|'post'|'opportunity'|'lead')
  ref_id text,

  -- estado (aprovação × execução, SEMPRE separados)
  automation_enabled boolean not null default false,
  approval_status text not null default 'PENDING'
    check (approval_status in ('PENDING','AUTO_APPROVED','APPROVED','REJECTED','EDITED','CANCELLED')),
  execution_status text not null default 'NOT_READY'
    check (execution_status in ('NOT_READY','QUEUED','EXECUTING','EXECUTED','FAILED')),

  -- auditoria / resultado
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid,
  executed_at timestamptz,
  execution_result jsonb,
  execution_error text,
  external_id text,                     -- id retornado pela integração (ex.: id do post publicado)
  updated_at timestamptz not null default now()
);
create index if not exists idx_agent_actions_company on agent_actions (company_id, created_at desc);
create index if not exists idx_agent_actions_pending on agent_actions (company_id, approval_status, execution_status);

-- RLS: o dono LÊ as ações da própria empresa. Escrita (propor/aprovar/executar)
-- passa pela edge function `agent-actions` com service role — assim ninguém
-- forja aprovação/execução direto no banco.
alter table agent_actions enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename='agent_actions' and policyname='users read own company agent_actions') then
    create policy "users read own company agent_actions" on agent_actions for select
      using (company_id in (select id from companies where user_id = auth.uid()));
  end if;
end $$;
