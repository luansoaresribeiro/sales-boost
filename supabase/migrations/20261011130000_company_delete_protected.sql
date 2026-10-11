-- Proteção contra exclusão (pedido do dono 2026-10-11, exclusão em lote no
-- painel do Owner): empresa marcada aqui nunca é excluída pelo painel — nem uma
-- por uma, nem em lote. Cliente real (Liga dos Sonhos — regra 2) e a conta do
-- próprio Sales Boost já nascem protegidas.
alter table companies add column if not exists delete_protected boolean not null default false;
update companies set delete_protected = true where business_name in ('Liga dos Sonhos', 'Sales Boost');
