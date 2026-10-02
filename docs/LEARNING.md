# Sales Boost — Medição e Aprendizado

> Etapa 10 do ciclo (ver [ARCHITECTURE.md](ARCHITECTURE.md)). O que medir,
> e como isso realimenta as etapas 1-4.

## O que medir

- **Métrica principal:** DMs + comentários-palavra-chave por
  item/pilar/formato/receita de produção (ver
  [CONTENT-INTELLIGENCE.md](CONTENT-INTELLIGENCE.md)).
- **Intenção:** salvamentos, compartilhamentos, respostas de Stories.
- **Resultado:** visitas agendadas, negócios fechados (informados pelo
  corretor — não existe fonte automática disso ainda).
- **Nunca otimizar por curtidas/seguidores** — são vaidade, não o que o
  produto vende.

## Loop real hoje

`supabase/functions/instagram-performance/index.ts` grava
`instagram_performance_snapshots`. `data-agent` (domínios
`performance`/`history`) lê de volta. `strategy-generate` lê via
`fetchDataAgentState` a cada rodada (`reanalyze`/`refresh`/`generate`) —
isso já funciona de verdade pra engajamento/alcance/leads: cada geração de
estratégia realmente lê o que aconteceu antes, não começa do zero (ver
"Estratégia automática" em [ARCHITECTURE.md](ARCHITECTURE.md)).

## Gap honesto: não fecha pra receita

`gatherPerformance` (em `creative-generate`) deixa `revenue`, `cac`,
`roas` explicitamente nulos — comentário no próprio código admite que não
existe fonte de dado comercial ainda. Isso é o MESMO gap que
[PRODUCT.md](PRODUCT.md) documenta no "Modelo de cobrança" (a hipótese (b)
de % de performance depende de medir receita de verdade, o que ainda não
existe). Não fabricar esse número em nenhuma camada — reportar como
"desconhecido" é sempre melhor que inventar.

## Semana a semana (alvo, ver status real por etapa nos outros docs)

Toda semana: memória estratégica (o que funcionou por pilar, formato,
receita, gancho, item, horário) deveria alimentar automaticamente:

1. O 80/20 do próximo calendário (ver gap em
   [CONTENT-INTELLIGENCE.md](CONTENT-INTELLIGENCE.md) — regra 80/20 ainda
   não existe como cálculo determinístico).
2. Os próximos briefs de criativos (ver
   [MEDIA-ENGINE.md](MEDIA-ENGINE.md) — motor de mídia ainda não
   construído).
3. O `refresh` mensal da estratégia (**isso já funciona** — ver
   [ARCHITECTURE.md](ARCHITECTURE.md) etapa 2, o prompt de `refresh`
   injeta explicitamente a regra 80/20 "manter o que já funciona" no
   raciocínio da IA, mesmo sem uma tabela estruturada de
   pilar→performance ainda).

## 80/20 determinístico (P2 parte 1 — implementado no código, ainda não ativo em produção)

`supabase/functions/_shared/learning.ts`: `computeEightyTwenty` (função
pura, testável: `node --experimental-strip-types scripts/test-learning.mjs`)
e `fetchLearning` (lê `posts` com pilar/receita/formato,
`instagram_content_performance` por `media_id` e `engagement_events` por
`media_ref`). Regras decididas pelo dono:

- Janela de 56 dias (8 semanas). Grupo (pilar, receita ou formato) só é
  classificado com **≥3 posts em ≥2 dias distintos**; senão
  `insufficient_data`.
- Score = conversas × 3 + (saves + shares) × 1. **Conversa** = comentário
  com palavra-chave/intenção detectada (`engagement_events.intent_detected`),
  deduplicada por usuário do IG em cada post. Curtidas e alcance **nunca**
  entram. Null = desconhecido, nunca 0 (grupo sem medição de saves/shares
  mostra `null`, não 0).
- Saída por grupo: `posts, conversas, saves, shares, score, rank, status
  (maintain|test|insufficient_data), suggested_share_pct` + `basis` (janela,
  nº de posts, avisos). Maintain = grupos que somam até 80% do score
  (fatia sugerida proporcional ao score, total 80); test = resto (20%
  divididos igualmente). Se <2 grupos elegíveis ou zero conversas → status
  geral `insufficient_data`.
- Origem do pilar: coluna nova `posts.pillar/recipe/format/item_id`
  (migration `20261002100000_posts_pillar_recipe.sql`), gravada por
  `agent-actions` ao criar o post a partir de `marketing_ai_test_content`
  (antes essa informação era perdida quando a linha de teste era apagada).
  **Não** usar `instagram_content_performance.pillar` — é palpite por
  legenda (`pillarOf`). Posts anteriores à migration ficam sem pilar e entram
  só como aviso em `basis.warnings`.
- Consumidor hoje: o prompt do `refresh` do `strategy-generate` (bloco
  aditivo "use estes números exatos"; se o cálculo falhar, o prompt fica
  como era). Calendário/briefs ainda não consomem (próximas partes do P2).
- Limite conhecido: "DMs" ainda não têm fonte — só existem comentários
  com intenção em `engagement_events`; DMs recebidas não são gravadas.

## Relatório semanal (alvo, não construído)

Relatório simples pro corretor no formato "seus posts geraram X
conversas; campeão: …" — ainda não existe uma function dedicada a isso.
`generate-tab-insight` (1x/dia, por aba do dashboard) é o parente mais
próximo que já existe, mas não é esse relatório semanal específico.
