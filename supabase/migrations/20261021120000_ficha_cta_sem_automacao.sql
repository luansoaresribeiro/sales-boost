-- CTA alternativo da ficha de imóveis, usado quando o imóvel NÃO tem a resposta
-- do QUERO aprovada (creative-generate → runVideoSlot não pode pedir "Comente QUERO").
-- Só JSON, aditivo: não apaga nem muda nenhuma outra chave da ficha.
--
-- DESFAZER:
--   update vertical_playbooks set config = config #- '{ctas,sem_automacao}' where key = 'imoveis_rio';
-- (sem a chave, o código cai no padrão "Me chama no direct" — nada quebra.)
update vertical_playbooks
set config = jsonb_set(config, '{ctas,sem_automacao}', '"Me chama no direct"', true)
where key = 'imoveis_rio' and config ? 'ctas';
