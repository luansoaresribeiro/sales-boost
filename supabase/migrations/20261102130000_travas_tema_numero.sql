-- Travas pós-relatório da Tespon (2/11) — só a ficha do setor. Aditiva e idempotente: não cria coluna, não muda RLS, sem cron.
--
-- 1) opportunity_texts.market_claims.pt: ACRESCENTA as frases de mercado que ainda passavam nas legendas de vídeo/catálogo e nos slides
--    ("Demanda alta e imóvel que costuma ter liquidez", "dois dos endereços mais disputados do Rio", "o bairro mais desejado do Rio").
--    Mescla com o que já está na ficha: não duplica e não apaga ajuste do dono (a ordem antiga fica; os novos entram no fim).
--    Rodar 2x dá o mesmo resultado. A trava (_shared/claimLock.ts) só barra o termo se ele NÃO aparece no cadastro do imóvel citado.
-- 2) content_rules.theme_cooldown_weeks (4), theme_similarity (0.8) e theme_places (bairros: tema com bairros diferentes não é o mesmo tema) e theme_alternatives (temas educativos sem número): a trava de TEMA
--    REPETIDO em código (_shared/themeDedupe.ts + weekThemes.ts) lê daqui. Cada chave só entra se ainda não existe (não pisa ajuste do dono).
--
-- REVERTER (tira só os termos acrescentados aqui e as chaves novas; o resto da ficha fica como está):
--   update public.vertical_playbooks vp
--   set config = jsonb_set(vp.config, '{opportunity_texts,market_claims,pt}',
--       coalesce((select jsonb_agg(e.value) from jsonb_array_elements(vp.config->'opportunity_texts'->'market_claims'->'pt') e
--                 where (e.value #>> '{}') not in ('mais disputado','mais disputada','mais disputados','mais disputadas','endereco mais disputado','enderecos mais disputados','demanda alta','costuma ter liquidez','tem liquidez','boa liquidez','liquidez alta','valorizacao garantida','valorização garantida','bairro mais desejado','enderecos mais desejados')), '[]'::jsonb), true)
--   where key = 'imoveis_rio' and jsonb_typeof(config->'opportunity_texts'->'market_claims'->'pt') = 'array';
--   update public.vertical_playbooks set config = jsonb_set(config, '{content_rules}', (config->'content_rules') - 'theme_cooldown_weeks' - 'theme_similarity' - 'theme_places' - 'theme_alternatives') where key = 'imoveis_rio' and jsonb_typeof(config->'content_rules') = 'object';

begin;

update public.vertical_playbooks vp
set config = jsonb_set(vp.config, '{opportunity_texts,market_claims,pt}', (
    select coalesce(jsonb_agg(to_jsonb(x.t) order by x.o), '[]'::jsonb) from (
      select u.t, min(u.o) as o from (
        select e.value #>> '{}' as t, e.ordinality as o
          from jsonb_array_elements(coalesce(vp.config->'opportunity_texts'->'market_claims'->'pt', '[]'::jsonb)) with ordinality e
        union all
        select n.value as t, 100000 + n.ordinality as o
          from jsonb_array_elements_text($json$["mais disputado","mais disputada","mais disputados","mais disputadas","endereco mais disputado","enderecos mais disputados","demanda alta","costuma ter liquidez","tem liquidez","boa liquidez","liquidez alta","valorizacao garantida","bairro mais desejado","enderecos mais desejados"]$json$::jsonb) with ordinality n
      ) u where u.t is not null and btrim(u.t) <> '' group by u.t
    ) x
  ), true)
where vp.key = 'imoveis_rio'
  and jsonb_typeof(vp.config->'opportunity_texts'->'market_claims'->'pt') = 'array';

-- Tema repetido: janela em semanas, limiar de semelhança e temas alternativos (setor = ficha, regra 6). Só entra o que ainda não existe.
update public.vertical_playbooks
set config = jsonb_set(config, '{content_rules}', coalesce(config->'content_rules', '{}'::jsonb) || '{"theme_cooldown_weeks": 4}'::jsonb, true)
where key = 'imoveis_rio' and (config->'content_rules'->'theme_cooldown_weeks') is null;

update public.vertical_playbooks
set config = jsonb_set(config, '{content_rules}', coalesce(config->'content_rules', '{}'::jsonb) || '{"theme_similarity": 0.8}'::jsonb, true)
where key = 'imoveis_rio' and (config->'content_rules'->'theme_similarity') is null;

-- Bairros (sem acento): dois temas que citam bairros DIFERENTES não contam como repetidos só pelo molde parecido.
update public.vertical_playbooks
set config = jsonb_set(config, '{content_rules}', coalesce(config->'content_rules', '{}'::jsonb) || jsonb_build_object('theme_places', $json$["leblon","ipanema","copacabana","barra da tijuca","barra","recreio","botafogo","flamengo","gavea","jardim botanico","lagoa","urca","leme","sao conrado","laranjeiras","humaita","santa teresa","lapa","centro","jacarepagua","itanhanga","vargem grande","niteroi","arpoador","catete","gloria","cosme velho","joa"]$json$::jsonb), true)
where key = 'imoveis_rio' and (config->'content_rules'->'theme_places') is null;

update public.vertical_playbooks
set config = jsonb_set(config, '{content_rules}', coalesce(config->'content_rules', '{}'::jsonb) || jsonb_build_object('theme_alternatives', $json$[
  "Como funciona o financiamento imobiliário, passo a passo",
  "Documentos que o comprador precisa reunir antes de fechar negócio",
  "O que conferir na visita ao imóvel antes de decidir",
  "ITBI e escritura: o que são e quando entram na compra",
  "Como avaliar o condomínio antes de comprar",
  "Comprar na planta ou imóvel pronto: o que muda",
  "Erros comuns de quem compra o primeiro imóvel",
  "Como se preparar para vender o imóvel com mais segurança",
  "Como a localização influencia o dia a dia de quem mora"
]$json$::jsonb), true)
where key = 'imoveis_rio' and (config->'content_rules'->'theme_alternatives') is null;

commit;
