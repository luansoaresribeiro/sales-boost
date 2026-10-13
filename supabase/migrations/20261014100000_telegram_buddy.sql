-- "Telegram amigo": avisos com botão de aprovar (ver telegram-buddy,
-- telegram-webhook e agent-actions 'telegram_decide').
--
-- Cada aviso sai uma vez só: a function reserva (company_id, kind, ref_id)
-- aqui antes de mandar. Só o service role escreve/lê (RLS ligado, sem policy).
create table if not exists telegram_buddy_sent (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  kind text not null,           -- 'a' (aprovação) | 'v' (post do Vault) | 'lead'
  ref_id text not null,
  sent_at timestamptz not null default now(),
  unique (company_id, kind, ref_id)
);
alter table telegram_buddy_sent enable row level security;

-- Interruptor GERAL (o dono da plataforma desliga pra todo mundo de uma vez).
-- Ligado, mas cada empresa só recebe se ligar "Telegram amigo" na própria
-- tela de Notificações (notification_prefs.telegram_buddy = true, padrão
-- desligado).
insert into feature_flags (key, label, enabled)
values ('telegram_buddy', 'Telegram amigo: avisos e aprovação pelo Telegram', true)
on conflict (key) do nothing;

-- A cada 10 min. URL de PRODUÇÃO fixa — NÃO aplicar este bloco no ensaio
-- (ver docs/PITFALLS.md "Migrations com cron apontam pra produção").
select cron.schedule(
  'telegram-buddy-10min',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://miwcxakzyforbahpnpst.supabase.co/functions/v1/telegram-buddy',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := json_build_object('cron_secret', (SELECT value FROM _app_config WHERE key = 'cron_secret'))::jsonb
  );
  $$
);
