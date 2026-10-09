-- Vídeos curtos do imóvel + "Comente QUERO" automático (decisões do dono
-- 2026-10-09, docs/DECISIONS.md): o vídeo é ISCA (1 cômodo, 2 cômodos vizinhos
-- ou abertura de fora com a vista), nunca o imóvel inteiro; quem comentar
-- QUERO em qualquer post do imóvel recebe na DM a mensagem que o dono aprovou
-- uma vez (modelo da ficha + dados cadastrados).
-- Aditiva. Substitui a versão "tour completo" desta migration, que só chegou a
-- ser aplicada no ensaio.
-- DESFAZER: alter table video_tours drop column if exists item_id, drop column if exists plan,
--   drop column if exists cost_usd, drop column if exists assembly;
--   alter table engagement_automations drop column if exists item_id;
--   update vertical_playbooks set config = config - 'dm_reply' where key = 'imoveis_rio';

alter table video_tours
  add column if not exists item_id uuid references marketing_ai_knowledge(id) on delete set null,
  add column if not exists plan jsonb,                 -- {kind: room|pair|opening, label}
  add column if not exists cost_usd numeric not null default 0, -- base do teto mensal de US$ 40 por cliente
  add column if not exists assembly jsonb;             -- estado da gravação em partes (envio retomável)

create index if not exists video_tours_item_idx on video_tours (item_id, created_at desc);

alter table engagement_automations
  add column if not exists item_id uuid references marketing_ai_knowledge(id) on delete cascade;
create unique index if not exists engagement_automations_item_uniq on engagement_automations (company_id, item_id) where item_id is not null;

update vertical_playbooks
set config = config || jsonb_build_object(
  'dm_reply', jsonb_build_object(
    'keyword', 'QUERO',
    'template', E'Oi! Que bom que você gostou 😊\n\n{tipo} em {bairro} · {venda_ou_aluguel}\n• {quartos} quartos\n• {m2} m²\n• {vagas} vaga(s) de garagem\n• Vista: {vista}\n• Valor: R$ {preco}\n• Condomínio: R$ {condominio}\n\nQuer conhecer pessoalmente? Me diz o melhor dia e horário que eu agendo sua visita 🙂'
  )
)
where key = 'imoveis_rio' and not (config ? 'dm_reply');
