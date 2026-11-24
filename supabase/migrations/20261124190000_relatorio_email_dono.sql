-- Relatório do cliente por e-mail ao dono (dono, 24/11: "sim, para os clientes, começa pelo passo 1").
-- Só acrescenta: lista das contas cujo relatório chega ao e-mail do dono, pronto para encaminhar (opt-in; a Liga dos
-- Sonhos nunca entra). O cliente não recebe nada direto.
-- Desfazer: update public.report_config set email_owner_companies = '{}' where id = true;
alter table public.report_config add column if not exists email_owner_companies uuid[] not null default '{}';
-- A3 Imóveis.
update public.report_config set email_owner_companies = array['d1987797-2ec0-49ed-ab40-09abaf586301']::uuid[] where id = true;
