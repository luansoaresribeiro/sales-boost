-- Tour virtual completo (menu próprio, decisão do dono 2026-11-10): ordem dos cômodos na ficha do setor (regra 6).
-- walk_order = caminho da câmera (de fora pra dentro, áreas sociais, depois íntimas); tour_max_photos/tour_per_room =
-- limites do tour. Só a ficha imoveis_rio; não mexe em nada que já existe em config.tour.
-- Aplicar depois do merge (ORCHESTRATION). Rollback:
--   update public.vertical_playbooks set config = config #- '{tour,walk_order}' #- '{tour,tour_max_photos}' #- '{tour,tour_per_room}' where key = 'imoveis_rio';
update public.vertical_playbooks
set config = jsonb_set(
  jsonb_set(
    jsonb_set(config, '{tour,walk_order}', '["fachada","vista","hall","sala","sala_jantar","varanda","cozinha","area_servico","corredor","quarto","banheiro"]'::jsonb, true),
    '{tour,tour_max_photos}', '10'::jsonb, true),
  '{tour,tour_per_room}', '2'::jsonb, true)
where key = 'imoveis_rio'
  and jsonb_typeof(config->'tour') = 'object'
  and (config->'tour'->'walk_order') is null;
