-- Diagnóstico grátis v2 (2026-10-09): concorrentes da região + o que está em
-- alta, lidos do Instagram em etapas pela função diagnosis-market.
-- Aditiva. DESFAZER: alter table public.diagnostics drop column if exists market_data;
--   update vertical_playbooks set config = config - 'market_hashtags' where key = 'imoveis_rio';
alter table public.diagnostics add column if not exists market_data jsonb;

-- Hashtags da região por setor ({local} = bairro ou cidade, sem acento/espaço).
update public.vertical_playbooks
set config = config || jsonb_build_object('market_hashtags', jsonb_build_array('imoveis{local}', 'apartamento{local}', 'corretordeimoveis{local}'))
where key = 'imoveis_rio';
