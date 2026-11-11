-- Tour do IMÓVEL INTEIRO (dono, 2026-11-11): 1 foto de cada cômodo + extras, num vídeo só sem cortes. Mais fotos por
-- tour (era 10). A instrução de câmera da caminhada (pair / pair_in) fica no padrão do código (_shared/tourEngine.ts).
update vertical_playbooks
set config = jsonb_set(config, '{tour,tour_max_photos}', '15'::jsonb, true)
where key = 'imoveis_rio';

-- Rollback:
-- update vertical_playbooks set config = jsonb_set(config, '{tour,tour_max_photos}', '10'::jsonb, true) where key = 'imoveis_rio';
