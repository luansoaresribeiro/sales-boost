-- Posts de bairro (decisão do dono 2026-10-08, docs/DECISIONS.md):
-- 1. nearby_places na ficha imoveis_rio — tipos de lugar buscados no
--    OpenStreetMap pela edge function nearby-places (regra 6: o que é de
--    setor vive na ficha, não no código). osm = filtros "chave=valor".
-- 2. Campo opcional "endereco" no catálogo — só pra calcular distância real
--    do imóvel; nunca entra em post. Sem ele, a busca usa o centro do
--    bairro e NÃO mostra distância.
-- Só mexe no jsonb config; sem coluna nova, sem RLS. Idempotente.

begin;

update vertical_playbooks
set config = jsonb_set(
  config,
  '{nearby_places}',
  '{
    "radius_m": 1500,
    "radius_bairro_m": 2500,
    "types": [
      {"key": "praia", "label": {"pt": "Praia", "en": "Beach"}, "osm": ["natural=beach"]},
      {"key": "metro", "label": {"pt": "Metrô", "en": "Subway"}, "osm": ["station=subway"]},
      {"key": "parque", "label": {"pt": "Parque", "en": "Park"}, "osm": ["leisure=park"]},
      {"key": "shopping", "label": {"pt": "Shopping", "en": "Mall"}, "osm": ["shop=mall"]},
      {"key": "escola", "label": {"pt": "Escola", "en": "School"}, "osm": ["amenity=school"]},
      {"key": "mercado", "label": {"pt": "Mercado", "en": "Supermarket"}, "osm": ["shop=supermarket"]}
    ]
  }'::jsonb
),
updated_at = now()
where key = 'imoveis_rio';

update vertical_playbooks
set config = jsonb_set(
  config,
  '{catalog_fields,optional}',
  (config->'catalog_fields'->'optional') || '[{"key": "endereco", "type": "text", "label": {"pt": "Endereço (rua e número) — só para calcular distâncias, não aparece nos posts", "en": "Address (street and number) — only to calculate distances, never shown in posts"}}]'::jsonb
),
updated_at = now()
where key = 'imoveis_rio'
  and jsonb_typeof(config->'catalog_fields'->'optional') = 'array'
  and not (config->'catalog_fields'->'optional' @> '[{"key": "endereco"}]'::jsonb);

commit;
