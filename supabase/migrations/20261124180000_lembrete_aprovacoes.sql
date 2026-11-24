-- Lembrete diário das aprovações paradas (dono, 24/11: "pode preparar o lembrete por e-mail da A3").
-- Só acrescenta: a lista de contas acompanhadas (opt-in explícito; a Liga dos Sonhos nunca entra) e o dia do último envio.
-- O e-mail vai só para o dono (mesmo canal dos alertas do monitor), nunca para o cliente.
-- Desfazer: update public.monitor_config set approval_digest_companies = '{}' where id = true;
alter table public.monitor_config add column if not exists approval_digest_companies uuid[] not null default '{}';
alter table public.monitor_config add column if not exists approval_digest_sent_on date;
-- A3 Imóveis (único cliente real acompanhado hoje).
update public.monitor_config set approval_digest_companies = array['d1987797-2ec0-49ed-ab40-09abaf586301']::uuid[] where id = true;
