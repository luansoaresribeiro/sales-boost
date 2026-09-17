-- Access Control / Subscription Control — camada central.
-- Reaproveita o que já existe (trial_started_at/trial_expires_at/
-- trial_cancelled_at, plan, stripe_customer_id, stripe_subscription_id) e
-- adiciona só o que falta: status real da assinatura (espelhado do Stripe),
-- override manual do Owner (liberar/bloquear) e um log de auditoria.

alter table companies add column if not exists subscription_status text;
alter table companies add column if not exists current_period_start timestamptz;
alter table companies add column if not exists current_period_end timestamptz;
alter table companies add column if not exists subscription_cancelled_at timestamptz;

alter table companies add column if not exists manual_access boolean not null default false;
alter table companies add column if not exists manual_access_granted_at timestamptz;
alter table companies add column if not exists manual_access_granted_by text; -- email do owner que liberou
alter table companies add column if not exists manual_access_reason text;

alter table companies add column if not exists access_blocked_at timestamptz;
alter table companies add column if not exists access_blocked_by text; -- email do owner que bloqueou
alter table companies add column if not exists access_blocked_reason text;

-- Histórico de mudanças de acesso — só a service role escreve/lê (nenhuma
-- policy de authenticated/anon; edge functions usam service role).
create table if not exists access_audit_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  event text not null,               -- ex: 'manual_access_granted', 'trial_expired', 'payment_confirmed'
  actor text not null,               -- 'system' | 'owner' | 'stripe'
  actor_email text,
  detail text,
  created_at timestamptz not null default now()
);
alter table access_audit_log enable row level security;
create index if not exists idx_access_audit_log_company on access_audit_log(company_id, created_at desc);

-- Função central: "esta empresa pode usar o Sales Boost agora?"
-- Prioridade: bloqueio manual do Owner (sempre vence) > assinatura paga
-- válida > trial válido > liberação manual do Owner > nada.
-- security invoker (padrão) — respeita a RLS de quem chama: o cliente só
-- consegue ler o status da PRÓPRIA empresa; edge functions usam service
-- role e conseguem consultar qualquer empresa.
create or replace function company_access_status(p_company_id uuid)
returns table (granted boolean, source text, status_label text)
language sql
stable
as $$
  select
    (access_blocked_at is null) and (
      subscription_status in ('active', 'trialing')
      or (trial_cancelled_at is null and trial_expires_at is not null and trial_expires_at > now())
      or manual_access
    ) as granted,
    case
      when access_blocked_at is not null then 'blocked'
      when subscription_status in ('active', 'trialing') then 'paid'
      when trial_cancelled_at is null and trial_expires_at is not null and trial_expires_at > now() then 'trial'
      when manual_access then 'manual'
      else 'none'
    end as source,
    case
      when access_blocked_at is not null then 'Suspended'
      when subscription_status in ('active', 'trialing') then 'Active'
      when trial_cancelled_at is null and trial_expires_at is not null and trial_expires_at > now() then 'Trial'
      when manual_access then 'Active'
      when trial_cancelled_at is not null then 'Cancelled'
      when subscription_status = 'canceled' then 'Cancelled'
      else 'Expired'
    end as status_label
  from companies
  where id = p_company_id
$$;
grant execute on function company_access_status(uuid) to authenticated;

-- Backfill best-effort pros registros existentes: se já tem assinatura paga
-- ativa no Stripe (plan != 'free' e stripe_subscription_id setado), assume
-- 'active' até o próximo evento do webhook corrigir com o status real.
update companies
set subscription_status = 'active'
where subscription_status is null and stripe_subscription_id is not null and plan <> 'free';
