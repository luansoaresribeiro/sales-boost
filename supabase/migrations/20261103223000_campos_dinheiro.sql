-- Validação 2026-11-03 (Teste Zero): legenda de tour com "Condomínio R$ 3.500 · IPTU R$ 1.200" — valores CADASTRADOS — era cortada
-- como "valor sem fonte" (a trava só conhecia o preço como dinheiro) e a nota caía. Só a ficha (regra 6): opportunity_fields.money
-- lista os outros campos em dinheiro do cadastro. Só entra se a chave ainda não existe (não pisa ajuste do dono). Idempotente.
-- REVERTER: update public.vertical_playbooks set config = jsonb_set(config, '{opportunity_fields}', (config->'opportunity_fields') - 'money') where key = 'imoveis_rio';
update public.vertical_playbooks
set config = jsonb_set(config, '{opportunity_fields,money}', '["condominio","iptu"]'::jsonb, true)
where key = 'imoveis_rio' and jsonb_typeof(config->'opportunity_fields') = 'object' and (config->'opportunity_fields'->'money') is null;
