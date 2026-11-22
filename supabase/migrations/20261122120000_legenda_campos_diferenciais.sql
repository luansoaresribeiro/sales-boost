-- Pontos fortes, item 1 (dono, 22/11 — docs/PONTOS-FORTES.md §5): campos do cadastro que entram na legenda do pacote do
-- imóvel. Só acrescenta a chave config.caption_fields (lista de chaves de catalog_fields). Lido por _shared/captionFields.ts.
-- Desfazer: update public.vertical_playbooks set config = config - 'caption_fields' where key in ('imoveis_rio','imoveis_us');
update public.vertical_playbooks
set config = config || jsonb_build_object('caption_fields', '["vista","lazer","andar","vagas","detalhe_que_ninguem_percebe"]'::jsonb)
where key in ('imoveis_rio', 'imoveis_us') and not (config ? 'caption_fields');
