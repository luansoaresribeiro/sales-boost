-- Validação 2026-11-03 (Teste Zero): a legenda de um tour disse "Este é o tipo de imóvel que chega com pouca divulgação e sai
-- rápido. Leads que já estão no radar têm vantagem" — afirmação de mercado/urgência sem fonte que a trava não pegou.
-- Só a ficha do setor (regra 6). ACRESCENTA termos a opportunity_texts.market_claims.pt (mescla, não duplica, não apaga
-- ajuste do dono; a ordem antiga fica e os novos entram no fim). Rodar 2x dá o mesmo resultado. A trava (_shared/claimLock.ts)
-- só barra o termo se ele NÃO aparece no cadastro do imóvel citado.
--
-- REVERTER (tira só os termos acrescentados aqui):
--   update public.vertical_playbooks vp
--   set config = jsonb_set(vp.config, '{opportunity_texts,market_claims,pt}',
--       coalesce((select jsonb_agg(e.value) from jsonb_array_elements(vp.config->'opportunity_texts'->'market_claims'->'pt') e
--                 where (e.value #>> '{}') not in ('sai rapido','saem rapido','vende rapido','vendem rapido','vendido rapido','vendida rapido','pouca divulgacao','tem vantagem','antes que acabe','ultimas unidades','nao vai durar','nao fica muito tempo')), '[]'::jsonb), true)
--   where key = 'imoveis_rio' and jsonb_typeof(config->'opportunity_texts'->'market_claims'->'pt') = 'array';

begin;

update public.vertical_playbooks vp
set config = jsonb_set(vp.config, '{opportunity_texts,market_claims,pt}', (
    select coalesce(jsonb_agg(to_jsonb(x.t) order by x.o), '[]'::jsonb) from (
      select u.t, min(u.o) as o from (
        select e.value #>> '{}' as t, e.ordinality as o
          from jsonb_array_elements(coalesce(vp.config->'opportunity_texts'->'market_claims'->'pt', '[]'::jsonb)) with ordinality e
        union all
        select n.value as t, 100000 + n.ordinality as o
          from jsonb_array_elements_text($json$["sai rapido","saem rapido","vende rapido","vendem rapido","vendido rapido","vendida rapido","pouca divulgacao","tem vantagem","antes que acabe","ultimas unidades","nao vai durar","nao fica muito tempo"]$json$::jsonb) with ordinality n
      ) u where u.t is not null and btrim(u.t) <> '' group by u.t
    ) x
  ), true)
where vp.key = 'imoveis_rio'
  and jsonb_typeof(vp.config->'opportunity_texts'->'market_claims'->'pt') = 'array';

commit;
