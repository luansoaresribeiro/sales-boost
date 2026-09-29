-- Corrige um erro real encontrado no teste de "prompt idêntico": a ficha
-- 'generico' tinha vocabulary preenchido (Produto/Meus produtos/Lead/
-- Conversão/Venda) em vez de vazio. Isso quebrava a garantia central do
-- sistema (generico = todo campo vazio = fetchPlaybookBlock devolve '').
-- catalog_fields não é lido pela injeção de prompt (é pra uma feature de
-- catálogo futura), então fica como está.

begin;

update vertical_playbooks
set config = jsonb_set(config, '{vocabulary}', '{}'::jsonb), updated_at = now()
where key = 'generico';

commit;
