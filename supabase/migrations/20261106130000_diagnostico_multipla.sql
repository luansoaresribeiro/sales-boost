-- Diagnóstico com mais de uma resposta (pedido do dono a partir do feedback de um cliente, 2026-11-06).
-- Só a ficha `imoveis_rio` (config.onboarding_v2.questions). Nenhum dado de cliente é tocado:
-- respostas antigas em texto continuam valendo como estão (o código só as lê como 1 item; nada é convertido).
--
-- O que muda:
--   faixa_preco   : escolha única -> várias respostas (até 3); texto no plural ("Faixas ... mais comuns").
--   faixa_aluguel : escolha única -> várias respostas (até 3) — fica em Configurações.
--   prioridades_secundarias ("E depois disso?") : entra no diagnóstico; não repete a prioridade principal
--                   (exclude_from = prioridade_principal); o "(até 3)" sai do texto porque a tela já mostra "marque até 3".
--
-- QUANDO APLICAR: só depois do merge do PR e da publicação do site (o site novo é quem sabe mostrar isso direito).
--
-- ROLLBACK (comentado) — volta as 3 perguntas exatamente como estavam:
-- update public.vertical_playbooks v set config = jsonb_set(v.config, '{onboarding_v2,questions}', (
--   select jsonb_agg(case q->>'key'
--     when 'faixa_preco' then (q - 'max') || '{"type":"select","label":{"pt":"Faixa de preço de venda mais comum"}}'::jsonb
--     when 'faixa_aluguel' then (q - 'max') || '{"type":"select","label":{"pt":"Faixa de aluguel mais comum"}}'::jsonb
--     when 'prioridades_secundarias' then (q - 'diagnostic' - 'exclude_from') || '{"label":{"pt":"E depois disso? (até 3)"}}'::jsonb
--     else q end order by ord)
--   from jsonb_array_elements(v.config->'onboarding_v2'->'questions') with ordinality as t(q, ord))), updated_at = now()
-- where v.key = 'imoveis_rio';

update public.vertical_playbooks v
set config = jsonb_set(v.config, '{onboarding_v2,questions}', (
  select jsonb_agg(case q->>'key'
    when 'faixa_preco' then q || '{"type":"multi_select","max":3,"label":{"pt":"Faixas de preço de venda mais comuns","en":"Most common sale price ranges"}}'::jsonb
    when 'faixa_aluguel' then q || '{"type":"multi_select","max":3,"label":{"pt":"Faixas de aluguel mais comuns","en":"Most common rent ranges"}}'::jsonb
    when 'prioridades_secundarias' then q || '{"diagnostic":true,"exclude_from":"prioridade_principal","label":{"pt":"E depois disso?","en":"And after that?"}}'::jsonb
    else q end order by ord)
  from jsonb_array_elements(v.config->'onboarding_v2'->'questions') with ordinality as t(q, ord))),
  updated_at = now()
where v.key = 'imoveis_rio';
