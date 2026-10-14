-- Vídeos toda semana (decisão do dono 2026-10-14: "devemos ter pelo menos uns
-- 3 vídeos na semana e a estratégia, dependendo, pode jogar a quantidade pra
-- cima"). Aditivo e idempotente.

-- 1) Regra na ficha (regra 6): mínimo de vídeos por semana.
update public.vertical_playbooks
set config = jsonb_set(config, '{content_rules}',
  coalesce(config->'content_rules', '{}'::jsonb) || '{"min_videos_per_week": 3}'::jsonb)
where key = 'imoveis_rio'
  and coalesce((config->'content_rules'->>'min_videos_per_week')::int, -1) <> 3;

-- 2) Preço medido dos vídeos na ficha (extrato da Higgsfield 2026-10-14:
--    US$ 0,42 por 5 s; os ~US$ 0,54/0,65 eram estimativas antigas).
update public.vertical_playbooks
set config = jsonb_set(config, '{content_formats}', (
  select jsonb_agg(case
    when f->>'producer' = 'item_video' and f->>'key' = 'video_dois_comodos' then f || '{"cost":"~US$ 0,50 por vídeo (6 s)"}'::jsonb
    when f->>'producer' = 'item_video' and f->>'status' = 'live' then f || '{"cost":"~US$ 0,42 por vídeo (5 s)"}'::jsonb
    else f end order by ord)
  from jsonb_array_elements(config->'content_formats') with ordinality as t(f, ord)))
where key = 'imoveis_rio' and jsonb_typeof(config->'content_formats') = 'array';

-- 3) Estratégias ativas que ainda não têm vídeo no mix: entra o mínimo (3x o
--    primeiro formato de vídeo que funciona hoje). O calendário também
--    completa sozinho (creative-generate), isto é pra tela mostrar igual.
update public.marketing_ai_strategies s
set content_plan = jsonb_set(s.content_plan, '{weekly_mix}',
  (s.content_plan->'weekly_mix') || jsonb_build_array(jsonb_build_object(
    'format', v.f->>'key', 'name', v.f->>'name', 'producer', 'item_video', 'per_week', 3,
    'pillar', coalesce(v.f->>'pillar', 'imoveis'),
    'purpose', 'Mínimo de vídeos por semana (regra do setor): vídeo curto de uma foto real do imóvel.')))
from public.companies c,
  lateral (
    select f from public.vertical_playbooks p, jsonb_array_elements(p.config->'content_formats') f
    where p.key = c.vertical_key and f->>'producer' = 'item_video' and f->>'status' = 'live'
    limit 1
  ) v
where s.company_id = c.id and c.vertical_key = 'imoveis_rio'
  and s.kind = 'main' and s.status = 'active'
  and jsonb_typeof(s.content_plan->'weekly_mix') = 'array'
  and not exists (select 1 from jsonb_array_elements(s.content_plan->'weekly_mix') m where m->>'producer' = 'item_video');

-- 4) A cada 5 min: avança os vídeos em andamento e põe os prontos no
--    calendário (creative-generate → item-videos, ação "tick").
--    Desligar: select cron.unschedule('item-videos-tick-5min');
select cron.unschedule('item-videos-tick-5min') where exists (select 1 from cron.job where jobname = 'item-videos-tick-5min');
select cron.schedule('item-videos-tick-5min', '*/5 * * * *', $$
  SELECT net.http_post(
    url     := 'https://miwcxakzyforbahpnpst.supabase.co/functions/v1/creative-generate',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := json_build_object('action', 'video_tick', 'cron_secret', (SELECT value FROM _app_config WHERE key = 'cron_secret'))::jsonb,
    timeout_milliseconds := 150000
  );
$$);
