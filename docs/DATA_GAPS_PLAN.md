# SalesBoost — Plano pra fechar os gaps de dados reais

> Continuação de `docs/DATA_AUDIT.md` (seção K). Cobre só o que hoje está
> "trancado" de propósito (sem fonte real) — o que já é real não está aqui.
> Cada item foi conferido no código/banco antes de estimar esforço; nada
> aqui é chute.

---

## Ordem recomendada (maior alavancagem primeiro)

| # | Item | Esforço | Por quê nessa posição |
|---|------|---------|------------------------|
| 1 | Painel-resumo do Growth OS (receita/ROAS/funil agregado) | 🟢 Pequeno | Só agregação — toda a peça já é real em algum lugar |
| 2 | Roteiro/direção de arte (Conteúdo) | 🟢 Pequeno | O dado já existe, só numa tabela diferente da que liguei |
| 3 | Inteligência de Mercado → Tendências/Oportunidades | 🟡 Médio | Reaproveita o padrão Apify+IA que já construí pro Creative Agent |
| 4 | Meta Ads → Públicos/Criativos + Recomendações da IA | 🟡 Médio | Marketing API já dá esse detalhe, é só chamar |
| 5 | Feedback Loop / ICP | 🟡 Médio | Síntese de IA nova, mas em cima de dado 100% real (reviews+leads) |
| 6 | Equilíbrio do funil (Conteúdo) | 🟡 Médio | Precisa classificar cada post por etapa — dá pra fazer, mas é trabalho novo |
| 7 | Saúde da Meta | 🔴 Grande | Integração nova (Business API — Pixel/CAPI/verificação) |
| 8 | Campanhas pagas (funil do Pixel + CTR por criativo) | 🔴 Grande | Depende do cliente ter Pixel/CAPI configurado — pode ficar vazio mesmo real |
| 9 | Stories | 🔴 Grande | Precisa captura em tempo real (a Meta não devolve story expirada) |

---

## 1. Painel-resumo do Growth OS (receita/ROAS/funil)

**O que falta:** um número único de receita/ROAS que já existe espalhado —
Meta Ads (`meta-ads-insights`, real), leads/funil (`leads`, real), WhatsApp
(`whatsapp_conversations`, real) — mas nunca foi somado num só card.

**Plano:**
1. Nova função (ou hook direto no front) que lê os totais já reais de:
   `meta-ads-insights` (spend/revenue), `leads` (valor estimado por etapa),
   conversas WhatsApp fechadas com valor.
2. Soma isso num objeto `{revenue, roas, funnelCounts}` real.
3. Troca `hasReal: false` por esse cálculo no `MarketingAiHubPage`.

**Risco de inventar dado:** baixo — é só soma do que já é real. Onde uma
peça não estiver conectada (ex: sem Meta Ads), aquele componente do total
fica de fora do cálculo (não vira zero fingido).

---

## 2. Roteiro / Direção de arte (Conteúdo → "Conteúdo pronto pra aprovar")

**Descoberta:** o roteiro de vídeo (`video_script`) e o brief criativo já
são gerados de verdade pelo `creative-generate` — só que gravados na tabela
`marketing_ai_test_content` (usada pela Área de Testes), não na
`marketing_ai_content` que liguei no calendário.

**Plano:**
1. Ler `marketing_ai_test_content` (`video_script`, `brief`, `reasoning`)
   pro conteúdo mais recente/aprovado.
2. Mapear pro mesmo formato que a tela já usa (script como lista de linhas,
   blocos de "direção criativa").
3. Paleta/estilo/referência específicos (os 4 campos de "Direção criativa")
   não têm campo próprio ainda — ou extraio do `brief.visual_system` (texto
   livre, menos estruturado) ou deixo só essa sub-parte como exemplo.

**Risco de inventar dado:** baixo pro roteiro (é literalmente real). Médio
pra direção de arte estruturada — decidir se aceita o texto livre do brief
ou mantém só essa parte trancada.

---

## 3. Inteligência de Mercado → Tendências e Oportunidades

**O que falta:** hoje é só IA "imaginando" tendência do segmento, sem
grounding em nada real.

**Plano (reaproveita o que já existe):**
1. Mesma busca de posts virais por hashtag que já uso no Creative Agent
   (`apify~instagram-hashtag-scraper`, mapeado por `business_type`).
2. Cruza com os concorrentes reais já escaneados (`competitor_snapshots`,
   já real).
3. Um Claude call novo (pequeno, tipo o `classifyMove` que já existe) lê
   esse material real e escreve as "tendências" e "oportunidades" — sempre
   citando de onde tirou, nunca inventando fora do que foi lido.
4. Roda no mesmo cron semanal que já existe pro Creative Agent (ou um novo,
   mesmo padrão de custo controlado — 7 dias entre execuções).

**Risco de inventar dado:** baixo, desde que o prompt force "só com base no
que está nos dados abaixo" (mesmo padrão já usado no `classifyMove`).

---

## 4. Meta Ads → Públicos que convertem, Criativos, Recomendações da IA

**O que falta:** a Marketing API real tem esse detalhe, só não foi chamado.

**Plano:**
1. Estender `meta-ads-insights` (ou nova função) pra chamar:
   - `/act_{id}/insights?breakdowns=age,gender` (ou públicos salvos) →
     "Públicos que convertem" real.
   - `/act_{id}/ads` com `insights` por anúncio → "Criativos" real (CTR,
     ROAS por criativo).
2. "Recomendações da IA": um Claude call lendo esses números reais e
   sugerindo ação — real na leitura, mas é uma sugestão gerada (deixar
   claro na tela que é leitura da IA sobre dado real, não um dado bruto).

**Risco de inventar dado:** baixo pros números (API real). Médio nas
recomendações — mitigar deixando explícito "sugestão da IA baseada nesses
números", igual já faço em outros lugares.

---

## 5. Feedback Loop / ICP

**O que falta:** perfil de cliente ideal — hoje 100% demo.

**Plano:**
1. Nova função (mesmo molde do `brand-kit-suggest` que já construí): lê
   `reviews` (sentimento/temas reais) + `leads` (estágio/valor reais).
2. Um Claude call sintetiza um ICP a partir SÓ desses dados reais — se não
   houver reviews/leads suficientes, recusa em vez de inventar (mesmo
   padrão do `brand-kit-suggest`: mínimo de 2 antes de tentar).
3. Salva num lugar novo (`marketing_ai_icp` ou similar) pra não precisar
   rodar de novo toda hora.

**Risco de inventar dado:** baixo — mesma barreira "recusa com poucos
dados" que já uso em outros lugares.

---

## 6. Equilíbrio do funil (Conteúdo)

**O que falta:** cada post em `marketing_ai_content` não tem uma "etapa do
funil" (topo/meio/fundo) salva.

**Plano:**
1. Adicionar coluna `funnel_stage` em `marketing_ai_content`.
2. Quando o `creative-generate` cria um post, já pedir pra IA classificar a
   etapa (ela já decide isso implicitamente ao escrever — só faltou
   guardar).
3. Pra posts antigos sem essa coluna: rodar uma classificação em lote uma
   vez (Claude lendo a legenda real, mesmo padrão de "só classifica com
   dado real disponível").
4. O gráfico de equilíbrio passa a somar esses valores reais.

**Risco de inventar dado:** baixo — é classificação sobre conteúdo que já
existe de verdade, não um número novo.

---

## 7. Saúde da Meta

**O que falta:** status de Pixel, CAPI (Conversions API) e verificação do
negócio — nada disso vem da integração atual (que só lê Ads).

**Plano:**
1. Checar se o token que já temos (Meta Business Suite) tem escopo pra ler
   `/act_{id}` com campos de pixel/dataset, e `/{business_id}` pra
   verificação.
2. Se sim: nova função lendo esses campos reais e montando o score com a
   mesma fórmula que já existe no demo (adaptada pros campos reais
   disponíveis).
3. Se algum componente do score não tiver leitura real possível (ex: "taxa
   de resposta a mensagens" pode não ter endpoint direto), esse componente
   específico fica de fora do score real, não vira número inventado.

**Risco de inventar dado:** médio — a fórmula do score combina várias
coisas; garantir que cada componente só entra se tiver leitura real por
trás.

---

## 8. Campanhas pagas (funil do Pixel, CTR por criativo)

**O que falta:** o mesmo nível de detalhe do item 4, mas track completo
Impressão → Clique → Lead → Compra, que depende do Pixel/CAPI do cliente
estar configurado.

**Plano:**
1. Depende do item 7 ter descoberto que Pixel existe.
2. Se existir: puxar eventos do Pixel via `/act_{id}/insights` com
   breakdown por ação (`actions`), que já vem por padrão na Marketing API.
3. Se não existir Pixel: a tela mostra honestamente "sem Pixel configurado"
   em vez de funil fictício — não dá pra fingir.

**Risco de inventar dado:** baixo se seguir a regra acima — mas real risco
de "ficar vazio pra maioria dos clientes pequenos" (muitos nunca configuram
Pixel). Vale considerar isso antes de investir esforço aqui.

---

## 9. Stories

**O que falta:** a Graph API não devolve stories depois de expiradas (24h)
— confirmado: zero linhas reais hoje.

**Plano (arquitetura diferente das outras — captura em tempo real, não
busca sob demanda):**
1. Assinar o campo de webhook do Instagram pra `story_insights` (ou rodar
   um cron a cada poucas horas puxando `/me/stories` enquanto ainda estão
   no ar).
2. Guardar o snapshot (visualizações, respostas, stickers) antes de expirar.
3. A partir daí, toda story nova vira real; stories antigas (antes dessa
   captura existir) continuam sem dado — honesto, não retroativo.

**Risco de inventar dado:** baixo — mas é o único item que exige mudança de
arquitetura (captura proativa, não just-in-time), não só uma chamada nova.

---

## Como eu sugiro tocar isso

Dado o tamanho, recomendo fazer **um item por vez**, sempre: implementar →
`tsc`/build limpo → testar no seu ambiente → você confirma → próximo item.
Não vou empacotar vários de uma vez pra não repetir o problema de escopo
grande que já tivemos nesta sessão.

Itens 1–2 são rápidos e eu começaria por eles. A partir do item 3 pra
frente, cada um é uma decisão própria de prioridade — me diga qual você
quer primeiro, ou eu sigo a ordem da tabela.
