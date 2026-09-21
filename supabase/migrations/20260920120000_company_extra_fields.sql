-- Resumo do site (a IA lê o site e resume pra ter repertório real sobre o
-- negócio) e orçamento de marketing mensal (informado pelo dono, aparece em
-- Infos da Empresa) — pedido do dono, 2026-09.
alter table companies
  add column if not exists website_summary text,
  add column if not exists website_summary_updated_at timestamptz,
  add column if not exists marketing_monthly_budget numeric;
