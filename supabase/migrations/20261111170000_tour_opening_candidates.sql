-- Etapa 3 do Tour virtual (2026-11-11): o dono pode escolher abrir de fora com a 1ª foto quando ela for de um
-- ambiente externo que a IA não chamou de fachada/vista (ex.: varanda da cobertura com a piscina e a vista).
-- Só os ambientes desta lista; um quarto nunca vira "cena de drone". Só a ficha imoveis_rio (regra 6).
update vertical_playbooks
set config = jsonb_set(config, '{tour,opening_candidates}', '["varanda"]'::jsonb, true)
where key = 'imoveis_rio';

-- Rollback:
-- update vertical_playbooks set config = config #- '{tour,opening_candidates}' where key = 'imoveis_rio';
