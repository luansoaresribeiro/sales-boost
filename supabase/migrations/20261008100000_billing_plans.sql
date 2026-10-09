-- Fatia 4 (pagamento): plano mensal x anual com fidelidade, multa registrada e cupom do 1º mês.
-- Aditiva (colunas nullable); não muda RLS. NÃO aplicada em produção — o merge do PR é a aprovação.
alter table public.companies add column if not exists billing_plan text;
alter table public.companies drop constraint if exists companies_billing_plan_check;
alter table public.companies add constraint companies_billing_plan_check
  check (billing_plan is null or billing_plan in ('monthly', 'annual_commit'));
alter table public.companies add column if not exists commitment_end_at timestamptz;
alter table public.companies add column if not exists early_termination_fee_cents integer;
alter table public.companies add column if not exists coupon_offer_shown_at timestamptz;
