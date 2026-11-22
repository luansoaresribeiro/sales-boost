-- Pontos fortes, item 2 (dono aprovou a lista em 22/11 — docs/PONTOS-FORTES.md §3): três campos de marcar no cadastro do
-- imóvel (tipo multi_select da ficha, regra 6). Só acrescenta. "Para quem é" muda só tom/assunto: NÃO entra na legenda
-- (caption_fields), para nunca virar rótulo de público (trava de texto público / Fair Housing).
-- Desfazer: tirar os 3 objetos de catalog_fields.optional (chaves pontos_localizacao, pontos_imovel, pontos_para_quem)
--           e as 2 chaves de caption_fields.

update public.vertical_playbooks
set config = jsonb_set(config, '{catalog_fields,optional}', coalesce(config->'catalog_fields'->'optional', '[]'::jsonb) || $json$[
  {"key": "pontos_localizacao", "type": "multi_select", "label": {"pt": "Pontos fortes: localização", "en": "Strengths: location"}, "options": [
    {"pt": "Perto da praia", "en": "Near the beach"}, {"pt": "Perto do metrô", "en": "Near the subway"},
    {"pt": "Rua tranquila / perto da natureza", "en": "Quiet street / close to nature"}, {"pt": "Vida noturna e restaurantes", "en": "Nightlife and restaurants"},
    {"pt": "Escolas perto", "en": "Schools nearby"}, {"pt": "Tudo a pé (mercado, padaria, farmácia)", "en": "Everything within walking distance"}]},
  {"key": "pontos_imovel", "type": "multi_select", "label": {"pt": "Pontos fortes: imóvel", "en": "Strengths: property"}, "options": [
    {"pt": "Vista para o mar", "en": "Ocean view"}, {"pt": "Vista verde", "en": "Green view"}, {"pt": "Vista da cidade", "en": "City view"},
    {"pt": "Varanda", "en": "Balcony"}, {"pt": "Lazer completo", "en": "Full amenities"}, {"pt": "Andar alto", "en": "High floor"},
    {"pt": "Reformado", "en": "Renovated"}, {"pt": "Vaga de garagem", "en": "Parking"}, {"pt": "Aceita pet", "en": "Pet friendly"},
    {"pt": "Sol da manhã", "en": "Morning sun"}]},
  {"key": "pontos_para_quem", "type": "multi_select", "label": {"pt": "Para quem é (só muda o tom dos posts)", "en": "Who it suits (only changes the tone)"}, "options": [
    {"pt": "Morar", "en": "To live in"}, {"pt": "Primeiro imóvel", "en": "First home"}, {"pt": "Investir / alugar", "en": "Invest / rent out"},
    {"pt": "Temporada", "en": "Vacation rental"}, {"pt": "Quem vem de fora", "en": "Out-of-town buyers"}]}
]$json$::jsonb, true)
where key in ('imoveis_rio', 'imoveis_us')
  and not exists (select 1 from jsonb_array_elements(coalesce(config->'catalog_fields'->'optional', '[]'::jsonb)) f where f->>'key' = 'pontos_imovel');

update public.vertical_playbooks
set config = jsonb_set(config, '{caption_fields}', coalesce(config->'caption_fields', '[]'::jsonb) || '["pontos_localizacao","pontos_imovel"]'::jsonb, true)
where key in ('imoveis_rio', 'imoveis_us') and not coalesce(config->'caption_fields', '[]'::jsonb) ? 'pontos_imovel';
