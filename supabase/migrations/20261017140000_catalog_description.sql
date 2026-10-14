-- Descrição do imóvel (pedido do dono 2026-10-14: "editar detalhes, descrição
-- e fotos"). Campo opcional na ficha (regra 6: o que é de setor vive na
-- ficha). Texto longo (max 1500): a tela mostra caixa grande. A importação do
-- portal já lê <Description> do XML — passa a preencher este campo. A
-- descrição real do corretor também vai pro texto da IA no pacote do imóvel
-- (menos chance de inventar). Aditivo e idempotente.
update public.vertical_playbooks
set config = jsonb_set(
  jsonb_set(config, '{catalog_fields,optional}',
    jsonb_build_array(jsonb_build_object(
      'key', 'descricao', 'type', 'text', 'max', 1500,
      'label', jsonb_build_object('pt', 'Descrição do imóvel', 'en', 'Property description')
    )) || coalesce(config->'catalog_fields'->'optional', '[]'::jsonb)),
  '{catalog_import,fields,descricao}', '"description"')
where key = 'imoveis_rio'
  and config ? 'catalog_fields'
  and config ? 'catalog_import'
  and not exists (
    select 1 from jsonb_array_elements(coalesce(config->'catalog_fields'->'optional', '[]'::jsonb)) f
    where f->>'key' = 'descricao'
  );
