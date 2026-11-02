-- PR B (qualidade dos carrosséis) — só a ficha do setor. Aditiva e idempotente: não cria coluna, não muda RLS, sem cron.
--
-- 1) opportunity_texts.market_claims (pt/en): ACRESCENTA os termos de afirmação de mercado que passavam (frases específicas, não palavras soltas: "o melhor"/"único"/"exclusivo" sozinhos pegavam texto legítimo) e TIRA "em alta" (pegava "temporada em alta"; entra "mercado/bairro/região em alta")
--    ("endereços mais desejados", "vale cada centavo", "imperdível", "exclusivo"…). Mescla com o que já está na ficha:
--    não duplica e não apaga ajuste do dono (a ordem antiga fica; os novos entram no fim). Rodar 2x dá o mesmo resultado.
--    A trava (supabase/functions/_shared/claimLock.ts) barra o termo SÓ se ele não aparece no cadastro do imóvel citado:
--    "luxo", "nobre", "premium", "exclusivo" continuam liberados quando o cadastro traz a palavra (decisão do dono, 2026-11-02).
-- 2) carousel_cover.educativo.photo_when_item: o carrossel educativo só usa foto real do catálogo na capa/fecho
--    quando a vaga cita um imóvel (item_id). Só entra se ainda não existe.
--
-- REVERTER (tira só os termos acrescentados aqui, devolve "em alta" e remove as chaves novas; o resto da ficha fica como está):
--   update public.vertical_playbooks vp
--   set config = jsonb_set(jsonb_set(vp.config, '{opportunity_texts,market_claims,pt}',
--       coalesce((select jsonb_agg(e.value) from jsonb_array_elements(vp.config->'opportunity_texts'->'market_claims'->'pt') e
--                 where (e.value #>> '{}') not in ('mais desejado','mais desejada','mais desejados','mais desejadas','um dos mais caros','um dos mais procurados','um dos bairros mais','vale cada centavo','cada centavo','imperdivel','imperdiveis','o melhor bairro','o melhor endereco','a melhor localizacao','o melhor investimento','o melhor negocio','o melhor preco','unico no bairro','unica no bairro','unico na regiao','unica na regiao','oportunidade unica','bairro exclusivo','endereco exclusivo','enderecos exclusivos','localizacao exclusiva','regiao exclusiva','raridade','premium','luxuoso','luxuosa','mais cobicado','mais cobicada','mercado em alta','bairro em alta','regiao em alta','preco em alta')), '[]'::jsonb) || '["em alta"]'::jsonb, true),
--     '{opportunity_texts,market_claims,en}',
--       coalesce((select jsonb_agg(e.value) from jsonb_array_elements(vp.config->'opportunity_texts'->'market_claims'->'en') e
--                 where (e.value #>> '{}') not in ('most desired','most coveted','worth every penny','unmissable','the best neighborhood','the best location','the best investment','one of a kind','unique opportunity','exclusive neighborhood','exclusive address','rare find','once in a lifetime','luxurious','most sought-after')), '[]'::jsonb), true)
--   where key = 'imoveis_rio' and jsonb_typeof(config->'opportunity_texts'->'market_claims') = 'object';
--   update public.vertical_playbooks set config = (config - 'carousel_cover') #- '{opportunity_texts,market_claims_ctx}' where key = 'imoveis_rio';

begin;

update public.vertical_playbooks vp
set config = jsonb_set(
  jsonb_set(vp.config, '{opportunity_texts,market_claims,pt}', (
    select coalesce(jsonb_agg(to_jsonb(x.t) order by x.o), '[]'::jsonb) from (
      select u.t, min(u.o) as o from (
        select e.value #>> '{}' as t, e.ordinality as o
          from jsonb_array_elements(coalesce(vp.config->'opportunity_texts'->'market_claims'->'pt', '[]'::jsonb)) with ordinality e
        union all
        select n.value as t, 100000 + n.ordinality as o
          from jsonb_array_elements_text($json$["mais desejado","mais desejada","mais desejados","mais desejadas","um dos mais caros","um dos mais procurados","um dos bairros mais","vale cada centavo","cada centavo","imperdivel","imperdiveis","o melhor bairro","o melhor endereco","a melhor localizacao","o melhor investimento","o melhor negocio","o melhor preco","unico no bairro","unica no bairro","unico na regiao","unica na regiao","oportunidade unica","bairro exclusivo","endereco exclusivo","enderecos exclusivos","localizacao exclusiva","regiao exclusiva","raridade","premium","luxuoso","luxuosa","mais cobicado","mais cobicada","mercado em alta","bairro em alta","regiao em alta","preco em alta"]$json$::jsonb) with ordinality n
      ) u where u.t is not null and btrim(u.t) <> '' and u.t not in (select jsonb_array_elements_text($json$["em alta","mais procurado","mais procurada","mais procurados","mais procuradas","mais caro","mais cara","mais caros","mais caras","mais barato","mais barata","mais baratos","mais baratas"]$json$::jsonb)) group by u.t
    ) x
  ), true),
  '{opportunity_texts,market_claims,en}', (
    select coalesce(jsonb_agg(to_jsonb(x.t) order by x.o), '[]'::jsonb) from (
      select u.t, min(u.o) as o from (
        select e.value #>> '{}' as t, e.ordinality as o
          from jsonb_array_elements(coalesce(vp.config->'opportunity_texts'->'market_claims'->'en', '[]'::jsonb)) with ordinality e
        union all
        select n.value as t, 100000 + n.ordinality as o
          from jsonb_array_elements_text($json$["most desired","most coveted","worth every penny","unmissable","the best neighborhood","the best location","the best investment","one of a kind","unique opportunity","exclusive neighborhood","exclusive address","rare find","once in a lifetime","luxurious","most sought-after"]$json$::jsonb) with ordinality n
      ) u where u.t is not null and btrim(u.t) <> '' and u.t not in (select jsonb_array_elements_text($json$["most expensive","cheaper than"]$json$::jsonb)) group by u.t
    ) x
  ), true)
)
where vp.key = 'imoveis_rio'
  and jsonb_typeof(vp.config->'opportunity_texts'->'market_claims') = 'object';

-- Comparativos que só são afirmação de mercado COM complemento de lugar/mercado na frase (ou "mais caro QUE <X>"): "financiamento mais barato"
-- e "O mais caro é errar o prazo" passam; "bairro mais procurado" e "mais barato que Ipanema" são barrados. Só entra se ainda não existe.
update public.vertical_playbooks
set config = jsonb_set(config, '{opportunity_texts,market_claims_ctx}', $json${"pt": {"terms": ["mais procurado", "mais procurada", "mais procurados", "mais procuradas", "mais caro", "mais cara", "mais caros", "mais caras", "mais barato", "mais barata", "mais baratos", "mais baratas"], "context": ["bairro", "rua", "regiao", "cidade", "endereco", "m²", "m2", "metro quadrado", "zona sul", "zona norte", "zona oeste", "orla"]}, "en": {"terms": ["most expensive", "more expensive", "cheaper", "most popular"], "context": ["neighborhood", "street", "area", "city", "address", "square foot", "square meter", "sq ft", "district"]}}$json$::jsonb, true)
where key = 'imoveis_rio'
  and jsonb_typeof(config->'opportunity_texts') = 'object'
  and (config->'opportunity_texts'->'market_claims_ctx') is null;

update public.vertical_playbooks
set config = jsonb_set(config, '{carousel_cover}', $json${ "educativo": { "photo_when_item": true } }$json$::jsonb, true)
where key = 'imoveis_rio'
  and (config->'carousel_cover') is null;

commit;
