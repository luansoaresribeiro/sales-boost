-- Preço por tipo de negócio (decisão do dono 2026-10-11, docs/DECISIONS.md):
-- imobiliária paga a tabela padrão (R$2.449 mensal / R$1.449 anual) e o
-- corretor(a) autônomo paga menos (R$797 mensal / R$597 anual). O tipo
-- "Imobiliária / Corretor" vira duas opções no cadastro; quem já escolheu a
-- opção antiga continua na tabela padrão.

alter table business_types add column if not exists plan_tier text not null default 'padrao';
alter table business_types drop constraint if exists business_types_plan_tier_check;
alter table business_types add constraint business_types_plan_tier_check check (plan_tier in ('padrao', 'corretor'));

insert into business_types (label, sort, enabled, vertical_key, plan_tier)
select v.label, v.sort, true, 'imoveis_rio', v.tier
from (values ('Imobiliária', 80, 'padrao'), ('Corretor(a) de imóveis', 81, 'corretor')) as v(label, sort, tier)
where not exists (select 1 from business_types b where b.label = v.label);

-- A opção antiga sai do cadastro, mas continua existindo pras contas que já a usam.
update business_types set enabled = false where label = 'Imobiliária / Corretor';
