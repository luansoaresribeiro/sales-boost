-- Lista de APIs do painel do Owner (Configurações → APIs) atualizada pro que o
-- código usa hoje (pedido do dono 2026-10-11). Conferido com
-- Deno.env.get(...) em supabase/functions:
--  - entram: Higgsfield (vídeos do kit grátis e criativo — HF_CREDENTIALS),
--    Google Places (busca de leads do Owner), Meta/Instagram (login e
--    publicação), Telegram (avisos e bot), Hermes (agente);
--  - voltam a aparecer: PageSpeed (diagnóstico grátis), Replicate (imagens);
--  - sai da lista: DataForSEO (nenhuma função usa).
insert into api_providers (key, name, category, secret_name, usage_type, billing_url, enabled, sort) values
  ('higgsfield', 'Higgsfield (vídeos e criativos)', 'ia', 'HF_CREDENTIALS', 'manual', null, true, 25),
  ('google_places', 'Google Places (busca de leads)', 'dados', 'GOOGLE_PLACES_API_KEY', 'status', 'https://console.cloud.google.com', true, 65),
  ('meta', 'Meta / Instagram (login e publicação)', 'infra', 'INSTAGRAM_APP_SECRET', 'status', 'https://developers.facebook.com/apps', true, 85),
  ('telegram', 'Telegram (avisos e bot)', 'infra', 'TELEGRAM_BOT_TOKEN', 'status', null, true, 95),
  ('hermes', 'Hermes (agente)', 'infra', 'HERMES_API_KEY', 'status', null, true, 97)
on conflict (key) do update set name = excluded.name, category = excluded.category, secret_name = excluded.secret_name,
  usage_type = excluded.usage_type, billing_url = excluded.billing_url, enabled = true, sort = excluded.sort, updated_at = now();
update api_providers set enabled = true, updated_at = now() where key in ('pagespeed', 'replicate');
update api_providers set enabled = false, updated_at = now() where key = 'dataforseo';
