# SalesBoost — Plano de arquitetura de sincronização de dados

> Auditoria completa (3 investigações paralelas: integrações/sync, tabs
> frontend, consciência de freshness dos agentes) antes de qualquer código —
> como pedido. Tudo abaixo foi verificado no código/banco real, nada é chute.
> Não altera design, navegação, tabs ou fluxo do produto — só a camada de
> dados por trás.

---

## 🚨 Bugs reais encontrados (não é só "arquitetura melhorável" — já causa dano hoje)

Esses quatro eu recomendo corrigir **imediatamente**, independente do resto do
plano — são bugs de verdade, pequenos e isolados, não uma reescrita:

| # | Bug | Onde | Risco |
|---|-----|------|-------|
| B1 | `map-competitors` apaga concorrentes reais do banco quando só PARTE das buscas no Google Places falha (cada busca tem `.catch(() => [])`, e a lista reduzida vira a "verdade" que decide o que apagar) | `supabase/functions/map-competitors/index.ts` | **Perda de dado real por falha parcial de API** |
| B2 | `instagram-performance` trata falha parcial na busca de mídia como "zero mídia" e grava um dia de engajamento **zero** na história permanente — poluindo o gráfico de tendência com um "dia ruim" que nunca existiu | `supabase/functions/instagram-performance/index.ts` | Corrompe histórico real com dado falso |
| B3 | Dois cron jobs diferentes chamam `generate-posts` toda semana (`generate-posts-weekly` às seg 11h E `weekly-generate-posts` às seg 8h) — gera posts em duplicidade | `cron.job` (Supabase) | Desperdício de custo de IA + posts duplicados esperando aprovação |
| B4 | `map-competitors` e `monitor-competitor-social` têm o código de cron **completo e pronto** (throttle de 7 dias, filtro `active=true`) mas **não estão agendados** em lugar nenhum — nunca rodam sozinhos, só quando alguém abre a aba Concorrentes manualmente | `cron.job` (ausente) | Concorrentes nunca atualiza sozinho, apesar do código já existir |

---

## O que já está certo (não mexer)

- **Webhooks (arquitetura ideal, já em uso):** Instagram DM, WhatsApp, Telegram, Stripe — todos event-driven, sem polling.
- **Padrão de cron com throttle por idade do dado (já correto onde existe):** `brand-kit-suggest` (7 dias), `creative-ideas` (7 dias), `insights-collect` (7 dias, "memory-first"), `generate-tab-insight` (hash do conteúdo — mais esperto ainda, só reprocessa se o dado-fonte mudou de verdade).
- **DataVeil / Modo Demonstração** — a convenção de nunca mostrar fake como real já está bem estabelecida e não precisa mudar.
- **`useMarketingAiData`** já é uma camada central parcial (14 tabelas `marketing_ai_*` num hook só, com realtime) — é o modelo a reaproveitar/estender, não substituir.

---

## O problema central, com números concretos

**Nenhuma camada central de dados existe.** Cada tab busca do seu jeito:

- `instagram_content_performance` é lido de forma **independente e diferente** em 3 lugares (`VisualLibrary.tsx`, `PerformanceTab.tsx`→`instagram-performance`, e dentro de `brand-kit-suggest`/`creative-ideas`), cada um com seu próprio filtro/limite/janela de tempo — exatamente o cenário "Performance vê 120, Library vê 97" que você descreveu como risco.
- `reviews` é lido/escrito por **20 arquivos diferentes** (14 edge functions + 6 páginas), sem coluna `updated_at` nenhuma — freshness é impossível de saber de forma confiável hoje.
- Não existe `useInstagramPosts`/`useCompanyData` nem nada parecido — zero abstração compartilhada, zero react-query/swr instalado.
- **`meta-ads-insights` e `gsc-metrics` não têm NENHUMA persistência** — toda vez que uma tela abre, é uma chamada ao vivo pro Meta/Google. Mais lento, mais caro, e impossível de saber "quando foi a última vez que isso atualizou."
- **Nenhum agente (Hermes, Marketing AI) verifica idade do dado antes de decidir.** Os `tools` do Hermes até dizem explicitamente pra IA preferir dado em cache em vez de reprocessar — sem nunca checar se esse cache está velho.
- **Conexão quebrada é invisível pros agentes.** Se o token do Instagram expira, só a aba Performance percebe (quando alguém abre ela) — Hermes continua raciocinando sobre dado velho como se nada tivesse acontecido.
- **`company_integrations`** (a única tabela de "saúde de conexão" que existe) só cobre GBP/GSC, tem 1 linha no banco de produção, e não tem coluna de status/erro — só `token_expires_at`, que ninguém consulta proativamente.
- **`marketing_ai_tool_config`** tem colunas de `health`/`last_sync_at` já desenhadas, está ligado no frontend (`ToolsTab.tsx`), mas **zero linhas no banco e nenhuma função escreve nela** — morta.
- **`integration_catalog`** (a "verdade" sobre o que está conectado) marca WhatsApp, Meta Ads e Instagram DM como `"planned"` — sendo que os três estão 100% implementados e ao vivo.

---

## Plano por fases

Mantendo o princípio 21 (não reconstruir, reaproveitar o máximo possível). Cada
fase é testável e reversível antes de passar pra próxima.

### Fase 0 — Corrigir os 4 bugs (🟢 Pequeno, ~1 sessão)
B1, B2, B3, B4 acima. Isolado, sem risco pro resto do produto, resultado imediato.

### Fase 1 — Tabela central de saúde/freshness por integração (🟡 Médio)
Uma tabela nova, reaproveitável por **qualquer** conector atual ou futuro:

```sql
create table integration_sync_status (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  integration text not null,        -- 'instagram' | 'meta_ads' | 'gsc' | 'gbp' | 'whatsapp' | ...
  last_synced_at timestamptz,       -- última tentativa (sucesso ou não)
  last_success_at timestamptz,      -- última sincronização que funcionou
  last_error text,
  status text not null default 'unknown',  -- 'healthy' | 'stale' | 'error' | 'disconnected'
  records_synced int,
  updated_at timestamptz not null default now(),
  unique (company_id, integration)
);
```

Isso implementa de uma vez os princípios 2 (`last_synced_at`), 14 (saúde da
conexão) e 18 (observabilidade) — hoje espalhados e inconsistentes (campo
`sync` hardcoded no `instagram-performance`, `last_sync_at` morto no
`marketing_ai_tool_config`, nada em `meta-ads-insights`/`gsc-metrics`).

Toda função de sync passa a escrever aqui no início e no fim (sucesso ou
erro) — um helper pequeno e reutilizável, não uma reescrita de cada função.

### Fase 2 — Dar persistência ao que hoje é só chamada ao vivo (🟡 Médio)
- `meta-ads-insights`: nova tabela `meta_ads_snapshots` (mesmo padrão de
  `instagram_performance_snapshots`), sync com cron + throttle, frontend
  passa a ler a tabela em vez de chamar a Graph API toda vez que abre a tela.
- `gsc-metrics`: mesma ideia, tabela própria.
- Ativar cron mode em `instagram-performance` (hoje só roda quando alguém
  abre a aba) — assim os dados continuam frescos mesmo sem ninguém olhar.
- Agendar os crons do B4 (`map-competitors`, `monitor-competitor-social`) —
  o código já existe, só falta ligar.

### Fase 3 — Camada central de leitura no frontend (🟡 Médio)
Um hook por família de dado (ex: `useInstagramContent(companyId)`),
substituindo as 3+ leituras independentes de `instagram_content_performance`
por uma só, com uma realtime subscription só. `VisualLibrary`, `PerformanceTab`,
`ContentAgentTab`, `MarketingAiHubPage` passam a consumir o mesmo hook — sem
mudar o que cada tela mostra, só de onde ela puxa o dado.

Fora de escopo nesta fase (grande demais pra fazer de uma vez):
unificar os 20 consumidores de `reviews` — fica pra uma rodada futura,
documentado aqui pra não esquecer.

### Fase 4 — Agentes conscientes de freshness (🟡 Médio → 🔴 mexe em Hermes)
- Helper `checkFreshness(companyId, integration, maxAgeMs)` consultando a
  tabela da Fase 1 — Hermes/Marketing AI chamam antes de decisões
  importantes; se o dado estiver velho, disparam o sync correspondente antes
  de raciocinar (em vez de silenciosamente usar cache velho).
- `hermes-proxy`'s `getConnectedIntegrations()` passa a checar
  `integration_sync_status.status` em vez de só "existe um user_id salvo" —
  uma conexão quebrada fica visível pro agente, não só pra aba Performance.

---

## Como sugiro tocar isso

Mesmo ritmo que já usamos: **um item por vez, implementar → build limpo →
testar contra dado real → você confirma → próximo.** Dado o tamanho, sugiro:

1. Fase 0 primeiro (rápido, resultado imediato, bugs reais corrigidos).
2. Depois você decide se quer a Fase 1 (fundação) antes das Fases 2-4, ou se
   prefere atacar uma integração específica de ponta a ponta primeiro (ex:
   só Instagram, fases 1+2+3 aplicadas só a ele, como prova de conceito).
