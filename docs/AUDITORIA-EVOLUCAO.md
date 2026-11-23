# Auditoria para a evolução inteligente da plataforma (7 áreas)

> **Status: FASE 1 — auditoria, para o dono aprovar** (pedido de 22/11). Nada foi mudado no produto. Custo: US$ 0.
> Verba aprovada para os testes desta evolução: US$ 5. A execução começa só com o OK do dono, 1 PR por item.
> Fontes: código (arquivo:linha) e SQL só leitura de 22/11, com as contas de teste e a A3 nos últimos 7 dias.

## Resumo (6 linhas)
1. **A base já existe** em quase tudo: trava de tema, lições, receita por imóvel, funil por pilar, funil comercial
   real, custo gravado em parte das chamadas. O que falta é **ligar e completar**, não reconstruir.
2. **O maior buraco é o custo:** cerca de 30 funções chamam IA ou serviço pago e **não registram custo**. O custo por
   cliente no Owner é **estimado** e pode estar **contado duas vezes**.
3. **2 posts por dia: não agora.** Você disse "só se não tiver custo", e tem: ~US$ 0,07 por post, medido.
   Alternativa sem custo de IA no item F.
4. **Dashboard do cliente:** o número fictício fica **desligado por padrão** e com etiqueta. Falta mostrar de onde vem
   cada número e separar gerado, aprovado, publicado, alcance, lead e conversão.
5. **Memória por imóvel:** existe só "receita × imóvel × semana". Falta guardar ângulo, objetivo e público de cada
   peça e usar isso antes de gerar.
6. **Ordem proposta:** A custos → B dashboard honesto → C memória por imóvel → D funil → E formatos → F 2º post sem IA →
   G upsell e portfólio.

## Área 1 — Frequência de publicação
| | |
|---|---|
| **Existe** | Plano semanal no `creative-generate` (`planWeekFromStrategy`), com **1 post por dia fixo no código** (`creative-generate/index.ts:1265`, `postsCount = 1`, decisão de 13/11). O pacote do imóvel (`catalog-package`) também marca a ocupação por dia (`:106-139`). |
| **Funciona** | Semana com 1 peça por dia (C1, conferência no domingo 22/11). Imóvel e receita não repetem na janela (`recipeBlocked`). |
| **Custo medido** | Gerar um post custa **~US$ 0,068** (`agent_performance.ai_text_content`: 25 posts, US$ 1,70, 7 dias). Uma conta grátis com 7 posts/semana gasta ~US$ 2/mês; com 14 posts/semana, ~US$ 4/mês. |
| **Decisão** | **Fica 1 por dia.** Sua condição era "só se não tiver custo" ([DECISIONS 22/11](DECISIONS.md)). |
| **Melhor caminho** | Item F: um 2º post **montado sem IA**, só com dado real (mapa + texto do cadastro + modelo da ficha). Custo de IA perto de zero; só a imagem do `render-format`, que não usa IA. Fica para você decidir depois do item A, quando o custo por cliente estiver medido. |

## Área 2 — Memória e variedade (as 5 memórias)
| Memória | Existe hoje | Falta |
|---|---|---|
| **Do imóvel** | `recipeBlocked`: mesma receita no mesmo imóvel bloqueada por N semanas (`weekThemes.ts`). Abertura de legenda repetida no imóvel (`captionGuard`). Pontos fortes marcados (22/11). | Gravar em cada peça o **ângulo** (localização, estilo de vida, distribuição, investimento, arquitetura, público, oportunidade), o **objetivo** e o **público**, e escolher um ângulo ainda não usado. A IA ainda não "vê" a última peça do imóvel. |
| **Editorial da imobiliária** | Tema repetido na janela de 4 semanas e na mesma semana com assuntos-chave (C1b, 21/11, `themeDedupe.ts`). Lições do dono (`contentLessons.ts`). | Painel de equilíbrio: excesso de um formato, falta de imóveis, peso comercial × educativo. |
| **Formatos e abordagens** | Rodízio de formato sem repetir em dias seguidos (`formatCatalog.ts:285-293`). | Usar o histórico do imóvel na escolha (item C). |
| **Desempenho** | `instagram_content_performance` / `instagram_posts` quando o Instagram está conectado. | Quase nenhuma conta conectada. Sem dado não há aprendizado, e isso precisa ficar claro. |
| **Oportunidades** | `growth_opportunities` + `market_signals` com trava de evidência. | Ligar a oportunidade aprovada ao ângulo escolhido do imóvel (item C). |

**Qualidade ≠ variedade:** a nota de qualidade de cada peça (`scoreTestContent`) e as travas (número, afirmação, texto
público) continuam valendo para qualquer ângulo novo.

**Feito (C, 23/11, memória do imóvel):** ângulos na ficha (`content_rules.item_angles`: vista, localização, rotina,
espaço, detalhe, investimento; cada um habilitado por marca ou campo do cadastro), receitas com ângulo fixo
(`item_angle_recipes`). O pacote do imóvel escolhe o ângulo menos usado nas últimas peças do imóvel, nunca o da anterior, no
mesmo pedido à IA (custo extra ~0), e grava `brief.memory = {angle, objective, audience, source}` + o motivo no `reasoning`.
Público ("para quem é") só no tom. Limite conhecido: duas vagas do MESMO imóvel no mesmo despacho paralelo podem escolher o
mesmo ângulo (o plano já evita o mesmo imóvel/receita na semana). Memórias editorial, de formatos, de desempenho e de
oportunidades: sem mudança nesta etapa.

## Área 3 — Formatos e carrosséis
| | |
|---|---|
| **Existe** | Catálogo de formatos na ficha (`content_formats`) e receitas do imóvel no `catalog-package`: carrossel do imóvel (slides de oferta), "O detalhe que você não viu", "3 coisas perto", "O que compra no bairro", enquete. Catálogo editorial com 10 formatos **aprovado** (C2), com a construção pendente (C3). |
| **Falta** | Os formatos novos do C3 (A pé daqui, Guia do bairro, Isso ou aquilo, O que mudou no bairro, Antes da visita). Uma estrutura de carrossel **por objetivo** (tour visual, 5 motivos, diferenciais, morar aqui, investimento, conversão direta). Escolha **justificada**, não rodízio. |
| **Melhor caminho** | Item E = C3 + escolha do formato pelo ângulo e pelo funil (C e D). Reaproveita o sistema de slides (`carouselOffer.ts`, `render-format`). Nenhum catálogo novo. |

## Área 4 — Funil (topo, meio e fundo)
| | |
|---|---|
| **Existe** | Pilares de Social Selling com etapa do funil vinda do diagnóstico (`formatCatalog.ts:189-239`: `funnel`, `familia`, `pilar_ss`). Cada peça grava `familia` e `pilar_ss`. |
| **Falta** | Medir e mostrar a distribuição real da semana (topo / meio / fundo). Ajustar a distribuição pelo tamanho do portfólio, pelas oportunidades e pelos resultados, em vez de uma proporção fixa. |
| **Melhor caminho** | Item D: regra determinística, sem IA nova. Mapear `familia`/`pilar_ss` para topo, meio e fundo na ficha, calcular a distribuição da semana e corrigir no plano. Exemplos: portfólio pequeno → mais topo e meio; oportunidade aprovada → 1 de fundo. |

## Área 5 — Frontend e upsell contextual
| | |
|---|---|
| **Existe** | Modo vitrine: conta sem pagar vê tudo e não executa, com a janela "Disponível no plano" (`ShowcaseContext`). Menu Pro: Tour virtual, Campanha, Business Progress. Link do card do imóvel para o Tour virtual (`CatalogItems.tsx:390-393`). Jornada do cliente com o upsell contextual **aprovado** (J5, pendente). |
| **Falta** | O upsell no momento certo (J5), medido como mostrado / clicado / convertido. Simplificar o card do imóvel: hoje tem editar, fotos, "O que criar com este imóvel", "Avatar do corretor — em breve", vídeo → Tour virtual, página pública e pontos fortes. |
| **Melhor caminho** | Item G = J5 da Jornada, com os gatilhos do documento aprovado. O tour aparece **no card do imóvel com fotos suficientes** e depois de um post desse imóvel ser aprovado. O grátis não é bloqueado. Auditoria de cada botão do card com print, propondo o que agrupar ou tirar antes de mexer. |

## Área 6 — Dashboard de resultados (cliente)
| Número | Fonte | Real? |
|---|---|---|
| Sinais, oportunidades, estratégia ativa, ações prontas (`useDecisionKpis.ts:32-41`) | `market_signals`, `growth_opportunities`, `marketing_ai_strategies`, peças e ações | **Real**, por empresa |
| Funil comercial (`useCommercialFunnel.ts:33-61`) | `tracked_links`, `link_events`, `leads`, automações | **Real**, por empresa |
| Receita / ROAS (`MarketingAiHubPage.tsx:70-123`) | Meta Ads só quando conectado; senão **borrado** (DataVeil) | Real ou "sem dado" |
| Modo demonstração (`growthDemo.ts:332-340`) | Números de exemplo | **Desligado por padrão**, com etiqueta "exemplo" |

**Falta:** separar na tela **gerado → aprovado → publicado → alcance → lead → conversão**, cada um com a fonte e "não
medido" quando não houver integração. Item B: só tela e consulta, sem IA.

**Feito (B, 23/11):** faixa "Da produção ao resultado" acima do "Resultado comercial" (`ContentPipeline.tsx`,
`useContentPipeline.ts`, regra pura `src/lib/contentPipeline.ts`, teste `scripts/test-content-pipeline.mjs`): gerado →
aprovado (por uma pessoa, sem arquivadas) → publicado (Instagram) → alcance (só das nossas publicações, com o que o
Instagram mandou; senão "não medido") → leads → visitas, cada um com a fonte. Fora do modo demonstração. A dica de
"Visualizações" agora diz que é a abertura da página do imóvel, não o alcance do Instagram.

## Área 7 — Custos no Owner (o maior buraco)
| | |
|---|---|
| **Existe** | `logAiCost` (`_shared/aiCost.ts`) grava custo real em `agent_performance` na estratégia, conteúdo, mercado, oportunidades, tour, mobiliado e imagem. Painéis no Owner: `ApiUsagePanel`, `CompanyAiUsage`, `PlatformHealthPage`. Teto de vídeo por cliente (`spendCap`). |
| **Errado ou incompleto** | O custo por cliente (`CompanyAiUsage.tsx:19`) soma **tokens × preço médio + `cost_usd` real**, o que **conta duas vezes** desde o #127. O total da plataforma (`api-usage/index.ts:73`) é **estimado** (US$ 6 por milhão de tokens). |
| **Não registra custo** | Cerca de 30 funções que chamam IA ou serviço pago. Exemplos: `catalog-package` (posts do imóvel; confirmado: 0 linhas em `agent_performance` nos testes de 22/11), `agent-chat`, `draft-reply`, `content-test`, `creative-ideas`, `analyze-reviews`, `generate-report`, `generate-tab-insight`, `virtual-staging` (Higgsfield), `apify-sync`, `scrape-social`, `run-diagnosis`, `telegram-chat`. Custos fixos (VPS, Supabase, Cloudflare) não aparecem. |
| **Melhor caminho** | Item A, em 2 PRs. (1) `logAiCost` em toda chamada paga, com `provider` e "estimado/real", sem tabela nova. (2) Tela central no Owner: total, por cliente, por operação, por agente e por provedor, com período, e a separação **real × estimado × não medido**. Os custos fixos entram por um campo do Owner (valor mensal informado por você). |

## Plano por prioridade
| # | Item | Decisão que melhora | Reaproveita | Custo incremental | Risco | Pronto quando | Desfazer |
|---|---|---|---|---|---|---|---|
| A | Custos centralizados (2 PRs) | quanto custa servir cada cliente | `logAiCost`, `agent_performance`, telas do Owner | US$ 0 (só registro) | baixo | toda chamada paga aparece com valor real; tela mostra total por cliente/operação/provedor/período; a conta dupla some (SQL bate com a tela) | reverter o PR |
| B | Dashboard honesto | o cliente confia no número | hooks atuais | US$ 0 | baixo | cada número com fonte; gerado ≠ aprovado ≠ publicado; "não medido" onde falta integração | reverter |
| C | Memória por imóvel (ângulo/objetivo/público) | qual ângulo usar no imóvel | `reasoning`/`brief`, `recipeBlocked`, pontos fortes | ~US$ 0 (o ângulo entra no mesmo pedido à IA) | médio | 2 peças seguidas do mesmo imóvel com ângulos diferentes, gravados e testados | reverter |
| D | Funil da semana | equilíbrio topo/meio/fundo | `familia`, `pilar_ss`, ficha | US$ 0 (regra) | baixo | semana da Teste Zero com a distribuição calculada e anotada | reverter |
| E | Formatos (C3) | formato certo para o ângulo e o funil | catálogo aprovado, slides | ~US$ 0,02 por formato testado | médio | cada formato novo gera peça real na Teste Zero | reverter |
| F | 2º post do dia sem IA (opcional) | mais presença sem custo | mapa, cadastro, modelos | ~US$ 0 de IA | médio | você decide, depois do A medir o custo | desligar na ficha |
| G | Upsell contextual + card do imóvel | oferecer o tour na hora certa | J5 aprovado, `ShowcaseContext` | US$ 0 | médio | gatilho aparece só com dado real e grava mostrado / clicado / convertido | reverter |

**Métricas de sucesso (para todos):** qualidade e variedade (nota + ângulos diferentes), frequência **publicada**,
alcance e engajamento, leads, conversão dos recursos Pro e custo de servir cada cliente. Nunca só "posts gerados".

## O que depende de você
1. Aprovar este plano e a ordem (recomendo começar pelo **A**: sem custo medido não dá para decidir o resto com segurança).
2. Os valores mensais dos custos fixos (VPS, Supabase, Cloudflare, Higgsfield) para o item A. Sem eles, a tela mostra
   "não informado".
3. Item F: decidir depois do item A.
