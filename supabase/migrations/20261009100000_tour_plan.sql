-- Tour do plano pago (decisão do dono 2026-10-09): um tour completo por imóvel,
-- com ordem automática que o corretor aprova antes de gerar, e recortes.
-- Aditiva. Estende video_tours (migration 20261008220000) e põe na ficha de
-- imóveis o vocabulário do tour (regra 6: nada de setor no código).
-- DESFAZER: alter table video_tours drop column if exists item_id, drop column if exists plan,
--   drop column if exists cost_usd, drop column if exists cuts, drop column if exists assembly;
--   volte o check de status pro da migration 20261008220000;
--   update vertical_playbooks set config = config - 'tour' where key = 'imoveis_rio';

alter table video_tours
  add column if not exists item_id uuid references marketing_ai_knowledge(id) on delete set null,
  add column if not exists plan jsonb,                 -- análise da IA + passos + ligações (o corretor edita a ordem)
  add column if not exists cost_usd numeric not null default 0, -- análise + geração; base do teto mensal de US$ 40
  add column if not exists cuts jsonb not null default '[]'::jsonb, -- recortes: [{nome, from, to, video_path}]
  add column if not exists assembly jsonb;             -- estado da colagem em partes (envio retomável)

alter table video_tours drop constraint if exists video_tours_status_check;
alter table video_tours add constraint video_tours_status_check
  check (status in ('analyzing', 'awaiting_approval', 'generating', 'assembling', 'completed', 'failed'));

create index if not exists video_tours_item_idx on video_tours (item_id, created_at desc);

update vertical_playbooks
set config = jsonb_set(config, '{tour}', jsonb_build_object(
  'room_types', jsonb_build_array('fachada', 'entrada', 'sala', 'sala de jantar', 'cozinha', 'escritório', 'quarto', 'suíte',
    'banheiro', 'lavabo', 'closet', 'corredor', 'escada', 'varanda', 'área gourmet', 'churrasqueira', 'piscina',
    'área de lazer', 'quadra', 'área de serviço', 'garagem', 'vista'),
  'zones', jsonb_build_array('social', 'íntima', 'lazer', 'serviço'),
  'sequence_hint', 'fachada ou entrada → sala → jantar → cozinha → escritório → quartos e suítes (com banheiro e closet logo depois do quarto deles) → varanda → área gourmet e churrasqueira → lazer → piscina ou vista no final',
  'max_rooms', 25,
  'cut_seconds', jsonb_build_array(15, 30)
))
where key = 'imoveis_rio' and not (config ? 'tour');
