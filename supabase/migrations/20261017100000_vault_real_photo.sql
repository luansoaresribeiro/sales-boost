-- Vault com foto REAL + Higgsfield (pedido do dono, 2026-10-14: "o vault deve
-- ser ligado ao Higgsfield"). Setor com esta chave na ficha: o post genérico
-- do Vault usa uma foto real do catálogo tratada pela Higgsfield (só luz, cor
-- e nitidez) em vez de imagem inventada. Sem foto no catálogo → fluxo antigo.
-- Aditivo: só acrescenta a chave real_photo_first na ficha imoveis_rio.
update public.vertical_playbooks
set config = jsonb_set(coalesce(config, '{}'::jsonb), '{real_photo_first}', 'true'::jsonb)
where key = 'imoveis_rio';
