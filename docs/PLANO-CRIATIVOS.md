# Sales Boost — Plano: criativos com identidade visual + famílias de conteúdo

> Plano escrito em 2026-10-21 a pedido do dono. **Nada aqui está
> implementado ainda.** Estado real das peças que já existem em
> [CONTENT-INTELLIGENCE.md](CONTENT-INTELLIGENCE.md) e
> [MEDIA-ENGINE.md](MEDIA-ENGINE.md).

## O pedido do dono

1. Melhorar o fluxo de criativos para sair **com a identidade visual do
   cliente** (hoje sai com cara genérica).
2. Ter **carrosséis educativos** de verdade.
3. Considerar o **Higgsfield**, que é quem trata e gera as imagens e vídeos.
4. Poucas famílias de conteúdo, para o **calendário da semana não confundir**.
5. **O formato é pré-definido. A intenção do post vem da estratégia.**

## Como está hoje (diagnóstico, conferido no código em 2026-10-21)

| Ponto | Situação |
|---|---|
| Carrossel educativo | Está na ficha `imoveis_rio` (`content_formats`) como `carrossel_educativo`, **status `planned`**. A estratégia só escolhe formato que "funciona hoje" → **nunca entra no calendário**. |
| Chave "considerar carrossel" | `marketing_ai_config.allow_carrossel` vem **desligada** por padrão (TestingArea). |
| Slide de carrossel | `render-format` → `svgSlide`: fundo da marca + **uma frase por slide**, fonte única Poppins para todo cliente, **sem logo**, sem título/explicação, sem destaque de palavra, capa e fim iguais aos do meio. |
| *(2026-10-23)* | **Desatualizado:** a coluna acima descreve o slide ANTES da fase 1. Desde a fase 1 (no ar 2026-10-22) o slide tem logo + @, título/texto, destaque de palavra e capa/fecho próprios (`_shared/slideSystem.ts`); "sem logo" não é mais verdade. O texto original foi mantido como histórico do diagnóstico. |
| Kit da Marca | `brand_dna` guarda cores (tiradas das fotos reais do Instagram por `brand-kit-suggest`), logo e notas de direção. **Não guarda fonte nem estilo.** |
| Quebra de texto | `render-format` estima a largura contando caracteres ("Poppins ~0.55·fontSize") → risco de texto cortado/apertado. |
| Higgsfield | Já em uso: tour em vídeo (`item-videos`, Kling, US$ 0,42 por 5 s medido), tratamento da foto real (`/alibaba/qwen-image-3/edit`, Vault com foto real), mobiliar virtualmente (`virtual-staging`). |
| Fonte confiável para educativo | **Já existe:** formato `dica_faq` (`live`), com dicas conferidas em fonte oficial e categorias na ficha (jurídico, financiamento, documentação, impostos, aluguel, geral). |
| Intenção do post | `content_plan.weekly_mix[].purpose` é **texto livre** — o gerador lê, mas nada obriga a peça a seguir. |

## As famílias de conteúdo (decisão proposta: 4 fixas + 1 eventual)

Cada família é um **formato pré-definido** (layout, tamanhos, marca, regras de
mídia). A estratégia nunca inventa formato novo: ela escolhe a família e
preenche a **intenção**.

| # | Família | Para que serve no funil | Mídia (e papel do Higgsfield) | Formatos da ficha que entram nela |
|---|---|---|---|---|
| 1 | **Tour virtual** (vídeo) | Atrair e gerar desejo pelo imóvel | Fotos reais → vídeo em caminhada/cômodo (**Higgsfield**, Kling). Só movimento de câmera, nunca altera o imóvel. | `video_comodo`, `video_dois_comodos`, `video_abertura_vista` |
| 2 | **Criativo de oferta** (foto/carrossel do imóvel) | Converter: levar pra DM/visita | Foto real **tratada pelo Higgsfield** (luz/cor/alinhamento; staging só com aviso) + texto e marca pelo `render-format` | `carrossel_imovel`, `detalhe_imovel`, `o_que_rs_compra`, `comente_quero` (DM) |
| 3 | **Carrossel educativo** | Gerar confiança e autoridade | **Só design da marca** (texto pelo `render-format`). Capa pode ter foto real do corretor ou do catálogo tratada pelo Higgsfield. Conteúdo vem das dicas **conferidas** do `dica_faq`. | `carrossel_educativo` (novo, sai de `planned`), `dica_faq` |
| 4 | **Bairro e estilo de vida** | Mostrar que o corretor conhece a região ("estuda seu bairro") | Lugares reais (OpenStreetMap) + foto com licença (Wikimedia) ou do corretor. **Higgsfield não gera lugar real** (regra já em vigor). | `tres_coisas_perto`, `cartao_postal_bairro` |
| 5 | **Eventual: prova social / bastidores** | Confiança — só quando houver material real e autorização | Material do corretor; nunca inventado | `post_vendido`, `pov_pegou_a_chave`, `stories_caixa_perguntas` |

**Por que não mais famílias:** com 4 fixas o dono reconhece cada peça do
calendário de bater o olho (vídeo, oferta, educativo, bairro). "Isso ou
aquilo", enquete e Stories viram **variações dentro da família** (ex.:
enquete "pagaria R$ X?" é Stories da família Oferta), não famílias novas.
A família 5 só aparece quando existe material; nunca ocupa vaga vazia.

**Mix padrão sugerido** (a estratégia ajusta, respeitando o teto atual de
14 peças/semana e o mínimo de 3 vídeos):

- 3 Tour virtual · 2 Oferta · 2 Educativo · 1 Bairro → **8 peças** no feed
  + Stories de conversa (enquete/caixa) dentro das famílias.

## Formato fixo × intenção da estratégia

**Formato (fixo, na ficha — regra 6):** layout, proporção, quantidade de
slides, onde vão logo/título/CTA, tipo de mídia permitido, regras de
segurança (sem número sem fonte, IA nunca escreve texto).

**Intenção (vem da estratégia, por vaga do calendário):** substitui o
`purpose` livre por um bloco estruturado em `weekly_mix[]` e em cada
`WeekSlot`:

| Campo | Exemplo |
|---|---|
| `pilar_ss` | pilar de Social Selling da ficha (`onboarding_v2.social_selling.pillars`), ex.: `confianca` — **pra que** a peça serve (ver "Um rótulo só por peça") |
| `etapa_funil` | etapa do `funnel_plan` que a peça executa (awareness · consideration · conversion · retention) |
| `objetivo` | atrair · educar · converter |
| `publico` | "primeiro imóvel, família, Barra" |
| `angulo` | "medo de errar na documentação" |
| `tema` (educativo) | categoria do `dica_faq` (ex.: `documentacao`) |
| `item_id` (tour/oferta) | qual imóvel do catálogo |
| `cta` | da lista da ficha (`ctas`): "Comente QUERO", "Me chama no direct"… |
| `gancho_atual` (opcional) | trend/notícia do momento que dá o ângulo, com `trend_id` → ver "Trends e notícias na intenção" |

O gerador **preenche os campos do formato a partir da intenção**, sem trocar
o formato. Validação em código: intenção sem `objetivo` ou com formato fora
do catálogo é rejeitada (mesmo padrão de `formatCatalog.ts`).

**Quem melhora os ângulos:** as famílias e o mix ficam fixos (decisão do
dono 2026-10-21: "devemos sempre postar estas mesmas coisas"). O que muda
semana a semana é a intenção — o agente de Estratégia lê o desempenho por
família × ângulo (base em [LEARNING.md](LEARNING.md)) e troca ângulo, público
e gancho do que rendeu menos, nunca a família.

## Trends e notícias na intenção

Pedido do dono (2026-10-21): o dado de trend/notícia que o Agente de Dados
pega entra na intenção do post. Exemplo dado: *"como a alta dos juros afeta
você, comprador?"* vira o `gancho_atual` de um **carrossel educativo** (ou o
ângulo de um criativo de oferta), sem criar família nova.

**Divergência encontrada no código (2026-10-21):**

- `marketing_ai_trends` hoje tem só `title`, `description`, `category`,
  `relevance`, `source` e `detected_at` — **não guarda link, data da
  publicação nem trecho da fonte**.
- As origens atuais são: posts do Instagram nas hashtags da região
  (`marketScan.ts`, `source='diagnostico'`; `creative-ideas`,
  `source='instagram_scan'`) e raciocínio da IA sem dado real
  (`marketing-ai` → `runTrends`, `source=null`, a própria função avisa que
  "não é tendência em tempo real").
- **Não foi achada nenhuma fonte de notícia em tempo real** no código
  (busca por news/RSS/web search/Banco Central em `supabase/functions` e
  `src`). Se o Agente de Dados trouxe uma notícia de juros, ela não ficou
  gravada com fonte que um post possa citar.

**Regra para usar trend/notícia num post (regra 5 — nunca inventar número):**

1. Só entra como `gancho_atual` trend com **fonte gravada**: link, nome do
   veículo/órgão, data e o trecho exato que contém o número.
2. Número no post = **o mesmo número do trecho**, com a fonte citada no
   slide final ou na legenda ("Fonte: Banco Central, 21/10/2026").
3. Trend sem fonte (raciocínio da IA, `source=null`) pode inspirar ângulo,
   **nunca** número nem afirmação de fato.
4. Validade curta: notícia com mais de 14 dias não vira gancho (fica velha).

**Fonte proposta para começar (grátis e oficial):** séries do Banco Central
(API SGS — taxa Selic e juros de financiamento imobiliário). A lista de
fontes oficiais fica na ficha, junto da que o `dica_faq` já usa (regra 6).
Mudar a tabela de trends é migration em produção → vai no PR.

**Ressalva:** "juros subiram 15%" e "juros chegaram a 15% ao ano" são coisas
diferentes. O post só repete a forma exata que está na fonte.

## Família Tour virtual — como decide hoje e o que melhora

**Como está hoje (conferido no código em 2026-10-21):**

- **Manual** (`item-videos` + `ItemVideos.tsx`, botão "🎬 Vídeos e resposta
  do QUERO"): o corretor escolhe o tipo (`room` 1 cômodo · `pair` 2 cômodos
  vizinhos · `opening` abertura de fora com a vista), as fotos, vê custo e
  gasto do mês (teto único US$ 40/mês, `_shared/spendCap.ts`) e aprova uma
  vez a DM do "Comente QUERO" daquele imóvel.
- **Automático** (`creative-generate` → `planWeekFromStrategy` /
  `runVideoSlot`, mínimo de 3 vídeos/semana):
  - **imóvel:** o menos usado nas últimas 3 semanas, entre os com ≥5 fotos
    reais (rodízio — `pickItem`);
  - **foto:** **sorteada** entre as ainda não usadas em vídeo daquele imóvel;
  - **tipo:** **sempre `room`** (5 s, US$ 0,42);
  - **legenda:** IA com os dados cadastrados + `purpose` da vaga;
  - o vídeo entra na peça quando fica pronto (tick a cada 5 min) → nota →
    Aprovações. Sem imóvel com 5 fotos → vira "pra fazer".

**Problemas achados:**

1. Foto sorteada pode ser corredor, banheiro ou área de serviço.
2. O automático nunca usa `pair` nem `opening`.
3. A estratégia não escolhe o imóvel — é só rodízio.
4. **Risco confirmado:** `runVideoSlot` não confere se a DM do QUERO daquele
   imóvel foi aprovada (`engagement_automations.item_id`) antes de escrever a
   legenda. A IA pode pôr "Comente QUERO" (está na biblioteca de CTAs) e
   ninguém responder na DM.
   **NO AR (2026-10-22: `creative-generate` v72, `item-videos` v7, migration
   `20261021120000_ficha_cta_sem_automacao.sql` aplicada):**
   `_shared/videoCta.ts` decide o CTA (automação ativa com mensagem e palavra
   = "Comente {palavra}"; senão `config.ctas.sem_automacao` da ficha, padrão
   "Me chama no direct"), o prompt recebe a regra pronta e uma trava em código
   remove "Comente PALAVRA" da legenda/CTA quando não há resposta aprovada. A
   peça ganha o aviso "Sem resposta do QUERO aprovada…" em `reasoning` (o
   `item-videos` preserva o aviso ao pôr o vídeo ou ao falhar).
5. [MEDIA-ENGINE.md](MEDIA-ENGINE.md) ainda descreve o "tour completo em
   caminhada", substituído pelo vídeo-isca em 2026-10-09 (divergência
   registrada lá).

**Melhorias propostas:**

| Melhoria | Como | Custo |
|---|---|---|
| **Escolher a melhor foto** | Uma chamada de visão (modelo barato, ex. Haiku) dá nota a cada foto real do imóvel uma vez só e guarda em `meta.photos[].video_score` + cômodo detectado (sala, varanda, vista, cozinha, quarto, banheiro, fachada). O automático usa a melhor ainda não usada; banheiro/área de serviço/corredor ficam por último. | 1 chamada por foto, uma vez (centavos) |
| **Variar os 3 tipos** | Na semana: 2 `room` + 1 `pair` (duas fotos de cômodos vizinhos pela etiqueta de cômodo) ou `opening` **só se houver foto real de fachada/vista** (regra 4). Sem par confiável → volta pra `room`. | `pair` = 2 trechos (≈ US$ 0,84); dentro do teto de US$ 40 |
| **Estratégia escolhe o imóvel** | O `item_id` da intenção (seção acima) manda; rodízio vira plano B. A estratégia pode pedir "empurrar imóvel X" (ex.: imóvel novo, com mais leads, ou parado há tempo). | zero |
| **QUERO só com DM aprovada** | Antes da legenda, conferir se há automação ativa do QUERO pro imóvel. **Sem** → CTA alternativo da ficha ("Me chama no direct") e um aviso na peça: "aprove a resposta do QUERO deste imóvel pra usar essa chamada". **Com** → "Comente QUERO". | zero |
| **Ordem natural na semana** | Não repetir o mesmo cômodo do mesmo imóvel em semanas seguidas; alternar imóveis quando houver mais de um. | zero |

Tudo continua: vídeo só com foto real, Higgsfield só move a câmera, nada vai
ao ar sem aprovação, teto de custo por cliente.

## Identidade visual — o "sistema de slides"

Um único sistema de design no `render-format`, usado por todas as famílias
(capa, miolo, fecho), alimentado pelo Kit da Marca:

1. **Kit da Marca ganha `font` e `style`** (`brand_dna.kit`): 5-6 pares de
   fontes curados (moderna, elegante/serifa, clássica, forte…), tema
   escuro/claro. Sugerido por `brand-kit-suggest`; o dono pode trocar.
   Fontes carregadas por URL fixa e versionada (mesmo jeito do Poppins hoje).
2. **Logo e @ em toda peça** (canto superior) + contador e barra de
   progresso nos carrosséis.
3. **Layouts do carrossel educativo** (o gerador escolhe 1 por slide, todos
   pré-definidos): capa com gancho + palavra em destaque na cor da marca ·
   lista numerada · passo a passo · comparação lado a lado · frase de
   destaque · fecho com CTA em botão.
4. **Medir o texto de verdade** (largura real da fonte) antes de quebrar a
   linha; se não couber, reduz a letra até um mínimo e, abaixo disso, encurta
   o texto pelo gerador — nunca corta no meio.
5. **Prévia** do carrossel inteiro em Aprovações (deslizar) antes de aprovar.
6. **Capa do educativo varia** (decisão do dono 2026-10-21): rodízio entre
   layouts de capa (gancho grande, pergunta, número com fonte, lista) para
   não repetir a mesma cara toda semana. **Com foto do corretor no sistema**
   → algumas capas usam a foto real dele (tratada pelo Higgsfield só em
   luz/cor). **Sem foto** → capa só com o design da marca.

## Análise 2026-10-22 — da estratégia até o post (depois do sistema de slides e do QUERO no ar)

Conferido no código da `main` em 2026-10-22 (`strategy-generate`,
`_shared/formatCatalog.ts`, `creative-generate`).

### 1. A estratégia é rica, mas o post recebe só "um bilhete"

A estratégia grava em `marketing_ai_strategies`: tese, `content_plan`
(`central_line`, `hero_formats`, `why`, **`pillars[]`** = como a tese trabalha
cada pilar de Social Selling, `weekly_mix[]`) e **`funnel_plan[]`** (por etapa:
`pillar`, `objective`, `audience`, `message`, `format`, `cta`, `destination`).

O `creative-generate` lê **só** `content_plan.weekly_mix` (via `weekSlots`) e
monta o seed de cada vaga como
`angle: "Pilar ${pillar}: ${purpose}"` (`runPlanSlot` / `planWeekForCompany`).
`runVideoSlot` usa só `purpose`. **Não chegam ao post:** tese, `central_line`,
`content_plan.pillars`, nada do `funnel_plan` (público, mensagem, CTA,
etapa). E `WEEKLY_MIX_SHAPE` pede `"pillar": ""` sem dizer qual taxonomia —
às vezes vem vazio.

**Consequência:** o trabalho de Social Selling feito na estratégia (e
continuado do diagnóstico) não guia de verdade a peça; a peça só sabe o
formato e uma frase.

### 2. Três "pilares" diferentes convivendo

| Nome | Exemplos | Onde é usado |
|---|---|---|
| Pilares de conteúdo da ficha (`config.pillars` + `production_recipes`) | imovel, local, mercado, educacao, marca_pessoal, prova_social | Peso do calendário (`fetchWeekPillarOccupancy`), receita de produção |
| Pilares de Social Selling (`onboarding_v2.social_selling.pillars`) | autoridade, educação, confiança, relacionamento, conversão | Diagnóstico, estratégia, `funnel_plan[].pillar` |
| `weekly_mix[].pillar` | texto livre, às vezes vazio | Seed da vaga ("Pilar X: …") |
| Famílias (este plano) | Tour, Oferta, Educativo, Bairro | ainda não implementadas |

O aprendizado (família × ângulo) fica impossível de medir se cada peça é
rotulada de um jeito.

### 3. Carrossel educativo duplicado e sem trava de fonte oficial

- `carrossel_slides` (genérico, `formatCatalog.ts` GENERIC) está **`live`** e
  é o que o calendário usa pra toda vaga `post` que não é `post_card` →
  na prática os "educativos" saem por ele.
- `carrossel_educativo` (ficha) continua **`planned`**.
- O genérico tem a trava de **número** (`inventedNumbers`), mas **não** a de
  **afirmação**: uma regra de ITBI/documentação/financiamento errada, sem
  algarismo, passa. O `dica_faq` (dicas conferidas em fonte oficial) não é
  usado pelo carrossel.

### 4. Tour/oferta ainda por rodízio

Imóvel por rodízio (`pickItem`), foto sorteada, vídeo sempre `room` — fase 7,
não feita. O QUERO já foi corrigido (no ar).

### Decisões propostas a partir desta análise

**A. Um rótulo só por peça:** cada vaga e cada peça levam três campos, sempre
iguais em todo o sistema:

- `familia` — **o que é** (tour · oferta · educativo · bairro · eventual);
- `pilar_ss` — **pra que serve** (chave do pilar de Social Selling da ficha);
- `tema` — **sobre o quê** (os antigos pilares de conteúdo da ficha viram
  tema: imovel, local, mercado, educacao… + categoria do `dica_faq`).

`WEEKLY_MIX_SHAPE` passa a pedir `pilar_ss` (validado contra a ficha) no lugar
de `pillar` livre; a `familia` vem do formato (campo novo `family` em
`content_formats` da ficha, regra 6). O aprendizado mede `familia × pilar_ss ×
ângulo`.

**B. Intenção completa chega no post:** cada `WeekSlot` carrega, além de
`format/purpose`: `pilar_ss` + o `content_plan.pillars[pilar_ss].plan`, a etapa
do `funnel_plan` ligada (mesmo `pilar_ss` ou mesmo `format`) com
`audience/message/cta`, e a `central_line`. O seed do `creative-generate`
(post, carrossel, vídeo, pacote do item) usa esses campos em vez de
"Pilar X: purpose". CTA da intenção continua passando pela trava do QUERO.

**C. Educativo com fonte:** juntar `carrossel_slides` e `carrossel_educativo`:
tema regulado (jurídico, financiamento, documentação, impostos — categorias
do `dica_faq`) → o carrossel **só** usa dica liberada do `dica_faq` (sem dica
liberada daquele tema → vira dica geral sem número/lei, como o `runFaqSlot`
já faz). Tema leve (bairro, estilo de vida, bastidores, mercado sem número)
→ carrossel livre com a trava de número.

## Fases (com critério de pronto)

| Fase | O que entrega | Pronto quando | Alteração arriscada? |
|---|---|---|---|
| **1. Sistema de slides + medir texto** | Novo `svgSlide` com os layouts, logo, destaque, fonte do kit; medição real de texto | Carrossel de teste (5 slides) renderizado sem texto cortado, com logo e cor do kit de 2 empresas de teste diferentes; prints no PR | Não (função nova/ajustada, testada no ensaio) |
|  | **NO AR (2026-10-22: `render-format` v43, `creative-generate` v72)** | `_shared/slideSystem.ts` (layouts capa · lista · passos · comparação · destaque · fecho, + `texto` pros slides antigos), `_shared/deckSlides.ts` (validação + regras do prompt), medição real via opentype.js no `render-format` (devolve `overflow`), retry de 1 texto mais curto por slide no `creative-generate`. Teste local: 2 marcas de teste × 5 slides com texto longo, 0 texto fora da área útil. Fica de fora desta fase: fonte/estilo do Kit (fase 4), prévia em Aprovações (item 5), capa com número/foto do corretor (item 6, regra 5), `carrossel_educativo` ainda `planned` (fase 2). | |
| **2. Carrossel educativo de verdade** | `carrossel_educativo` passa a `live`; conteúdo vem das dicas liberadas do `dica_faq`; `allow_carrossel` ligado para esse formato | A estratégia de uma empresa de teste coloca 2 educativos na semana e eles chegam em Aprovações | **Sim:** SQL na ficha de produção (vai no PR; o merge aprova) e deploy de `creative-generate` (função de cliente real) |
| **3. Intenção estruturada** | `weekly_mix`/`WeekSlot` com `objetivo/publico/angulo/tema/item_id/cta`; gerador obedece | Cada peça do calendário mostra a intenção na tela e a peça gerada usa o CTA e o tema pedidos | Sim: deploy de `strategy-generate` e `creative-generate` |
|  | **Atualização 2026-10-22 (ver "Análise 2026-10-22"):** a fase 3 passa a incluir as decisões **A** (rótulo único `familia × pilar_ss × tema`) e **B** (pilar de Social Selling + plano do pilar + etapa do funil com público/mensagem/CTA + linha central chegando no seed de toda vaga). A decisão **C** entra na fase 2. | Além do de cima: numa empresa de teste com diagnóstico, cada peça da semana mostra família, pilar de Social Selling e tema; o texto gerado usa o público/mensagem/CTA da etapa do funil ligada; nenhuma vaga sai com pilar vazio | Sim: deploy de `strategy-generate` e `creative-generate`; se `content_formats` ganhar `family`, SQL na ficha de produção (vai no PR) |
| **4. Fonte e estilo no Kit da Marca** | Campos novos + escolha na tela Padrão visual + sugestão automática | Trocar a fonte no kit muda os próximos criativos | Não (aditivo), salvo migration em produção (vai no PR) |
| **5. Calendário em 4 famílias** | Tela do calendário agrupa/rotula por família (ícone + cor) | Dono reconhece as 4 famílias na semana sem ler o nome do formato | Não |
| **6. Trends e notícias com fonte** | `marketing_ai_trends` ganha link/veículo/data/trecho; coleta das séries do Banco Central; `gancho_atual` na intenção | Um educativo de teste usa um número real do Banco Central, com a fonte no último slide, e o sistema recusa trend sem fonte | Sim: migration em produção (vai no PR) e deploy de `strategy-generate`/`creative-generate` |
| **7. Tour virtual inteligente** | Nota das fotos + cômodo detectado; mistura `room`/`pair`/`opening`; imóvel pela intenção; QUERO só com DM aprovada | Numa empresa de teste, a semana sai com 3 vídeos de fotos boas (nenhum banheiro/corredor), pelo menos 1 que não é `room` quando há par/fachada, e nenhum "Comente QUERO" sem DM aprovada | Sim: deploy de `creative-generate` (função de cliente real) |

Ordem recomendada: **1 → 2 → 3**, depois **7** (a correção do QUERO pode ir
antes, sozinha, por ser pequena), 6, 4 e 5. A fase 1 sozinha já melhora todos
os carrosséis que existem hoje.


### Fase 3 (A + B) — em código, aguardando migration e deploy (2026-10-22)

Aprovada pelo dono em 2026-10-22. Branch `claude/nifty-shannon-ysp818`; **nada
foi aplicado nem deployado** (migration e functions dependem de aprovação).

**O que entrou**

- **Rótulo único (A):** `familia` · `pilar_ss` · `tema` em toda vaga e peça.
  `family` vem do formato na ficha (`content_formats[].family`, migration);
  sem ela: vídeo de item = tour, resto = eventual. `pilar_ss` é pedido à IA
  (`WEEKLY_MIX_SHAPE` lista as chaves da ficha) e **validado no código**
  (`sanitizeContentPlan` com `ssKeys`); inválido/vazio vira uma chave válida
  por regra fixa: pilar da etapa do funil com o mesmo formato → rodízio entre
  pilares ausentes/parciais do diagnóstico → 1º da ficha. Roda depois do
  mínimo de vídeos. `familia` e `tema` nunca vêm da IA.
- **Intenção (B):** `_shared/slotIntent.ts` (funções puras): `buildSlotIntent`
  liga a vaga à etapa do funil (mesmo pilar + formato → só pilar → só formato
  → nenhuma) e `intentBlock` monta o texto (≤ 900 caracteres: pra que serve,
  plano do pilar, público/mensagem/CTA sugerido, linha central; "use como
  direção, não copie"; "não repita número que não esteja nos dados").
  Chega ao post/carrossel (Diretor e Copywriter), à legenda do vídeo e à
  legenda do pacote do imóvel (`catalog-package`). A dica FAQ **não** recebe
  a intenção (decisão C é da fase 2).
- **Trava do QUERO em toda peça (decisão do dono):** `applyQueroLock`
  (`slotIntent.ts`) roda depois da IA em post/carrossel (sem imóvel = "não
  aprovado", CTA alternativo da ficha), vídeo e todas as receitas do pacote
  (imóvel: `engagement_automations`). O CTA da etapa do funil é só sugestão.
- **Telas:** chips "Família · Pilar SS · Tema" na vaga e na peça do
  Calendário, no modal da peça e no cartão de Aprovações
  (`marketingAi/PieceLabels.tsx`; nome do pilar vem da ficha).

**Divergências registradas**

- **`pillar` já era o tema na prática:** `marketing_ai_test_content.pillar` já
  guardava o pilar de conteúdo da ficha (imovel, local, educacao…). Por isso o
  `tema` **não ganhou coluna**: continua em `pillar` (ver DECISIONS).
- **`catalog-package` não tinha a trava do QUERO** (só o vídeo tinha): os
  pacotes do imóvel podiam sair com "Comente QUERO" sem resposta aprovada.
  Corrigido nesta fase.
- **(Corrigido em 2026-10-23, ver "Correções pós-fase 3")** **O rótulo se perde na publicação:** `agent-actions` não copia
  `familia`/`pilar_ss` para `posts` (fora deste PR de propósito — é função de
  cliente real). As colunas existem em `posts`, mas ficam vazias até o
  `agent-actions` copiar; o aprendizado (família × pilar × ângulo) só mede a
  partir daí. Também não há `intent` em `posts`.
- **Intenção fora da lista de "dados" do carrossel:** o `intentBlock` não entra
  no `numbersOf` (que libera números no carrossel), porque vem de texto da IA
  da estratégia, não de dado cadastrado (regra 5).
- **Slides e QUERO:** a trava confere legenda e CTA; texto dentro dos slides do
  carrossel não é conferido (o prompt do deck já não pede QUERO).
  **Corrigido (QA rodada 1, 2026-10-22):** isso era falso — o prompt do deck
  recebia o `brief.cta` cru do Diretor (podia ser "Comente QUERO") e o `cta`
  desenhado no fecho vinha da IA. Agora a decisão do QUERO (`decideVideoCta`)
  é tomada em código ANTES do prompt (o deck recebe o CTA seguro) e todo slide
  (título, texto, itens, destaque) passa por `lockSlide`/`lockDeck`
  (`_shared/deckSlides.ts`); o fecho sempre usa o CTA decidido pelo código,
  também nos slides reescritos pelo retry de overflow.
- **Chip "Tema" sozinho (QA rodada 1):** peças antigas (vídeo/pacote/FAQ) já
  tinham `pillar` preenchido, então mostravam só "Tema". Agora o Tema só
  aparece junto de Família ou Pilar SS. O nome do tema vem de um mapa genérico
  (com acento) em `PieceLabels.tsx`, porque a ficha guarda `config.pillars`
  só como chave → peso, sem nome; chave fora do mapa vira texto legível.
- **`pilar_ss` validado nas bordas (QA rodada 1):** `plan_slot` e
  `catalog-package` descartam `pilar_ss` que não existe na ficha
  (`dropUnknownPilar` + `fetchSSPillars`); a intenção da vaga cai junto.
- **Vaga vazia de estratégia antiga (QA rodada 1):** o front completa
  família/tema a partir do catálogo de formatos da ficha já carregado no
  Calendário (`WeeklyCalendarTab.tsx`); `pilar_ss` continua sem chip (só a
  estratégia nova sabe).
- **Peça nasce sem rótulo se a migration faltar:** os rótulos são gravados num
  UPDATE à parte, tolerante a falha (ver PITFALLS).

**Ainda falta pro critério de pronto:** rodar a semana de teste no banco de
**ensaio** (decisão do dono) depois da migration e do deploy de
`strategy-generate`, `creative-generate` e `catalog-package`, e conferir que
cada peça mostra família, pilar e tema e que o texto usa público/mensagem/CTA
da etapa do funil.

**No ar em 2026-10-23 (aprovação do dono: "Pode continuar"):** migration
`20261022150000_rotulos_familia_pilar_ss` aplicada na produção (as 18 linhas
de `content_formats` de `imoveis_rio` com `family`); `catalog-package` v20,
`strategy-generate` v30, `creative-generate` v73. Versões de volta, se
precisar: v19 / v29 / v72. As telas (chips) só vão ao ar quando o PR entrar na
main.

**Divergência: a semana de teste rodou na produção, na Tespon, não no
ensaio.** O banco de ensaio travou em "ligando" por mais de 25 min e o proxy
recusou o endereço dele. O dono aprovou testar na Tespon (empresa de teste).
Resultado (2026-10-23):

- A estratégia (refresh) saiu com as 8 linhas do mix com `familia`,
  `pilar_ss` e `tema`, nenhuma com pilar vazio.
- As vagas foram montadas com o código real (`weekSlots` + `buildSlotIntent`)
  e mandadas uma a uma por `plan_slot`, **só para a Tespon**, sem o
  `run_weekly_plan` (esse roda para todas as empresas). As 3 vagas de vídeo
  ficaram de fora para não gastar Higgsfield (~US$ 0,42 cada).
- 8 peças nasceram, todas com família e pilar de SS. O funil chegou ao texto:
  o carrossel de slides usou a mensagem "o que R$X compra na Barra vs. no
  Leblon" e o CTA "Salva / Manda"; o "3 coisas perto" fechou com a pergunta
  da enquete do funil ("Você pagaria R$ 3.000.000…? Sem julgamento"), com o
  preço real do imóvel. No carrossel do imóvel, o CTA do funil "Comente
  VISITA" foi trocado pela trava por "Me chama no direct" (não há resposta
  aprovada).

**Divergências achadas no teste (registradas, não corrigidas nesta fase):**

- **A coluna `intent` só fica preenchida nas peças de post/carrossel e
  vídeo.** O `catalog-package` recebe a intenção já como texto (`intentBlock`)
  e usa no prompt, mas não grava o objeto. A dica FAQ não recebe intenção (já
  previsto acima). Nada na tela lê `intent` hoje.
- **Carrossel de slides sem chip de Tema:** o formato `carrossel_slides` tem
  `pillar: "qualquer"` na ficha, e "qualquer" não vira tema. Mostra só Família
  e Pilar de SS.
- **Legenda falando com o corretor:** no carrossel do imóvel da Tespon, a IA
  escreveu "⚠️ Sobre a metragem: os dados que recebi precisam de confirmação…".
  A causa é o dado de teste do imóvel (7.373 m² para 4 quartos), mas o prompt
  do `catalog-package` não proíbe recado ao corretor, como o do vídeo proíbe.
  O dono pega isso na aprovação; vale uma correção pequena depois.
  **Correção (2026-10-23): isso estava impreciso.** A regra já existia no prompt
  ("nunca uma mensagem pro corretor pedindo dado"), mas só cobria *pedido de dado*,
  não **aviso/alerta/ressalva** ("os dados que recebi precisam de confirmação"). O
  prompt foi reforçado e entrou uma trava em código — ver "Correções pós-fase 3".

**Ordem atualizada em 2026-10-22** (fase 1 e QUERO no ar): **3 (com A + B) →
2 (com C) → 7 → 6 → 4 → 5**. A fase 3 vem primeiro porque os dados da
estratégia já existem e só não chegam ao post — é o maior ganho pelo menor
risco.

## Correções pós-fase 3 (2026-10-23)

Três pedidos do dono depois do teste da fase 3. Branch `claude/nifty-shannon-ysp818`;
**nada foi aplicado nem deployado** (migration e functions dependem de "pode").

**No ar em 2026-10-25** (PR #64 juntado; "pode" do dono para as functions):
migration `20261023120000_brand_dna_logo_meta` aplicada; `agent-actions` v21,
`catalog-package` v21, `brand-kit-suggest` v17, `render-format` v44 (voltar, se
precisar: v20 / v20 / v16 / v43). Conferido na Tespon: slide com logo sem
`logo_meta` sai como antes; pacote do imóvel (`carrossel_tour`) saiu sem recado ao
corretor e com família/pilar gravados. **Ainda não conferido em produção:**
`process_logo` (o botão "Preparar logo" precisa do login do dono — o import do
imagescript via deno.land só roda de verdade aí) e a cópia dos rótulos para `posts`
(precisa aprovar uma peça logado).

### 1. Logo em PNG transparente nos criativos

**Problema:** o logo entrava como estava: JPG com fundo branco virava um quadrado branco
em cima do slide escuro; foto de perfil do Instagram (rosto, fachada) virava "logo"; o
avatar do Print de Tweet cortava o logo (`slice` + círculo).

**O que entrou**

- `_shared/logoPng.ts` (função PURA sobre `{width,height,data RGBA}`, testada em Node):
  reduz pra ≤ 1024 px; `removeFlatBackground` amostra 4 cantos (blocos 8×8): cantos já
  transparentes → só reencoda (`bg_removed:false`); mesma cor (diferença ≤ 18 por canal) →
  flood-fill **a partir das bordas** (letra branca no miolo do logo fica; o "O" com miolo
  branco não vira buraco), com anel de 2 px de alpha parcial e correção de franja; cantos
  diferentes / não lisos → `null` (não mexe). `meanLuma` dos pixels opacos.
- `_shared/logoCodec.ts` (Deno): decodifica PNG/JPEG e codifica PNG com **imagescript@1.3.0**
  (sem custo; spike OK: o mesmo código decodifica JPEG/PNG e codifica PNG no Deno; WebP **não**
  decodifica); SVG → PNG com o **mesmo resvg-wasm@2.6.2** do `render-format`; download de link
  colado só `https`, sem IP/localhost/rede interna, até 5 MB (SVG 500 KB), 15 s, redirecionamento
  revalidado. Tudo com `import()` dinâmico: se a lib não carregar, o logo fica como estava.
- Migration aditiva `20261023120000_brand_dna_logo_meta.sql`: `brand_dna.logo_meta jsonb`
  = `{ src, png_url, kind: 'logo'|'foto', luma, bg_removed, w, h }`. **Quem lê só usa o PNG se
  `logo_meta.src === logo_url`** (logo trocada depois → meta velha ignorada). Todo `select` de
  `logo_meta` é separado e tolerante (sem a coluna cai no logo de sempre).
- `brand-kit-suggest`: `colorsFromLogo` virou `analyzeLogo` — **a mesma chamada do Haiku**, agora
  devolvendo `kind` (`logo` | `foto`) junto das cores; se for `foto`, as cores **não** são usadas.
  No `on_connect` com kit já assumido pelo dono a classificação roda mesmo assim (cores só
  quando permitido). Nova ação `process_logo` (auth do dono + plano): entrada = logo atual, link
  colado ou **texto de um SVG** (≤ 500 KB). Sobe o PNG em `post-images`
  `renders/<empresa>/logo-png-<uuid>.png` e grava `logo_meta`. Foto → `{kind:'foto'}`; fundo
  não liso → `{kind:'logo', png_url:null}` (aviso); WebP/outro formato → mantém o original, sem
  PNG, com aviso. `generateAndSave` e `on_connect` rodam o mesmo pipeline depois de
  `fetchInstagramLogo`. Logo enviado pelo dono (arquivo que não é `logo-ig-*`) nunca é trocado
  sozinho. **Sem backfill automático** — logo antigo só é preparado quando o dono aperta o botão.
- `render-format`: `resolveLogo()` (em try/catch): `foto` → sem logo (nome da marca em texto);
  `src === logo atual` e `png_url` → usa o PNG; senão **o logo de sempre**. Contraste: a
  luminância do logo (`logo_meta.luma`) contra a do fundo do card; contraste baixo → pílula
  discreta (branca ou quase preta) **atrás**, com folga, sem distorcer nem cortar. Só vale
  pra logo preparado; logo sem `logo_meta` sai idêntico a antes. Tweet (logo preparado): caixa
  sem corte (`meet`), nunca círculo/`slice`. Card de foto sem logo: nome da marca em texto no
  canto (só quando quem chamou mandou o nome de verdade, não o "Marca" padrão).
- Tela do Kit (`BrandKit.tsx`): aceita PNG e SVG, pede "PNG com fundo transparente" (PT/EN),
  **duas prévias** (fundo escuro e claro, `contain`), aviso amarelo quando é foto, aviso quando o
  fundo não pôde ser removido, botão "Preparar logo para criativos". `BrandCard` e `AdaptModal`
  preferem o PNG (`shared.ts` → `preferredLogo`, tolerante). Avatar do tweet na pré-visualização
  (`formatTemplates.tsx`): `contain`, sem corte.

**Divergências / decisões registradas**

- **Pílula no "photo" com foto de fundo:** não dá pra medir a luminância da foto no servidor, então a
  pílula só entra quando o logo é muito claro (> 0,75) ou muito escuro (< 0,15). Em fundo liso do
  kit a regra é a mesma dos slides.
- **Tweet com logo antigo (sem `logo_meta`):** *(ajuste do dono, 2026-10-23: "nunca corta nem distorce a logo")* também
  sai com `meet` numa caixa sem círculo/corte, igual ao preparado (sem pílula, pois falta a luminância). É a ÚNICA
  mudança pra logos antigas: slide e card de foto continuam idênticos a antes. (Antes do ajuste o tweet legado
  mantinha o círculo com `slice`.) Um JPG com fundo branco aparece como quadrado branco no tweet escuro até o logo ser preparado.
- **`AdaptModal`** manda o PNG preparado como `logoUrl` (o servidor o trata como logo comum, sem
  pílula); logo-foto vira "sem logo".
- **Logo = quadrado de cor lisa com letra branca** (ex.: ícone de app): os 4 cantos têm a mesma cor, então o
  fundo "liso" é o próprio quadrado e some, ficando só a letra branca. A pílula atrás cobre o caso de a
  letra sumir no fundo do card, mas vale o dono conferir na prévia. Se o fundo removido passar de 97% da
  imagem, o código desiste (não mexe).
- **SVG com texto:** o resvg do servidor não tem fonte instalada; texto que não foi convertido em curvas
  não aparece no PNG.
- **Download de link colado:** a trava contra IP/rede interna olha o endereço escrito; não resolve o DNS
  (o Edge não expõe isso). Risco residual: um domínio público apontando pra IP interno.
- **`brand-compose`:** não foi alterado (opcional no pedido). Ele ainda lê `logo_url` direto.
- **Ainda não validado em produção:** o import `https://deno.land/x/imagescript@1.3.0/mod.ts` e o resvg
  só foram exercitados com o equivalente do npm (mesmo código) — o ambiente de trabalho bloqueia
  deno.land/esm.sh. Conferir no primeiro `process_logo` real (a função devolve erro tratável).

**QA rodada 1 (2026-10-23) — correções** (ver as reversões/ajustes da rodada 2 dentro dos itens e no fim do bloco)

- `internalNotes.ts` refeito por **contexto**, não por palavra solta: o sinal de recado é a IA falando com quem publica
  (1ª pessoa sobre os dados, vocativo, ordem de revisão, dado que "precisa ser conferido", rótulo "Obs.:/Nota:/PS:" +
  estranheza de dado). Saíram as regras "antes de publicar" solta, "para o dono/corretor" solto, "precisa de revisão" solto
  e "me passa + dado" (apagavam legenda boa: "Antes de publicar seu anúncio, tire fotos…", "Para o dono do primeiro imóvel…",
  "Me passa seu WhatsApp que te mando o preço"). Todas as frases do QA estão em `scripts/test-internal-notes.mjs`.
  Limitação: "Pode me passar a metragem exata?" sozinho (sem vocativo) agora passa.
- **`item-videos` × recado da IA (divergência conhecida):** o `keepQueroNotice` mantém só do prefixo do QUERO em diante.
  O `catalog-package` põe o recado DEPOIS do aviso do QUERO (então sobrevive). Mas o `item-videos` só reescreve `reasoning`
  de peças de **vídeo** do `creative-generate` (`plan.piece_id`); o `catalog-package` não gera vídeo nem peça ligada a
  `video_tours`, então o caso não ocorre. Se um dia o pacote passar a ter vídeo, o recado se perde ali.
- `render-format`: o nome padrão **"Marca"** (qualquer caixa) nunca é impresso; o `AdaptModal` agora manda o nome real da
  empresa (`companies.business_name`, tolerante). O nome no canto desconta selo/sticker e encolhe/encurta com "…" (sem sobrepor).
- `svgToPng`: lê o tamanho do SVG antes e limita pelo MAIOR lado (1024); proporção > 20:1 ou tamanho inválido → recusa
  (SVG 1x100000 não estoura memória). `decodeImage`: tamanho lido do cabeçalho PNG/JPEG antes de decodificar; recusa
  > 8000 px de lado ou > 40 MP (PNG 12000x12000 decodificava em 7 s e 2 GB).
- `isSafeLogoUrl` ignora ponto final no host (`localhost.`, `x.internal.`).
- Tela do Kit: com WebP aparece só o aviso de formato (não o de "fundo não liso").
- **Furo de letra:** ilhas pequenas (< 2% da imagem, caixa < 35% do lado maior) de cor-de-fundo cercadas por desenho
  saem junto com o fundo (miolo do "O"/"P"); preenchimento grande (letra/barra branca) fica. Heurística: um preenchimento
  branco pequeno e fechado (ex.: ponto do "i") também some.
  **REVERTIDO na rodada 2 do QA (2026-10-23):** a remoção de furos apagava texto branco dentro de forma colorida (selo azul
  "CRECI 1234", retângulo vermelho "IMOBILIARIA": 100% das letras viravam buraco). Decisão: segurança da logo do cliente >
  cosmético; o código voltou ao flood-fill só das bordas. **Limitação conhecida:** o miolo de uma letra fica com a cor do fundo
  original (branco); aparece em logo colorida de contraste médio sobre slide escuro quando a pílula não entra. No caso que
  motivou (letras escuras no fundo escuro) a pílula clara já esconde o miolo. Testes: selo e retângulo com texto branco
  ficam 100% opacos (`scripts/test-logo-png.mjs`).
- **Contraste por percentil:** `logo_meta` ganha `luma_lo`/`luma_hi` (p20/p80 dos pixels opacos; `luma` média continua).
  A pílula usa o pior dos dois extremos contra o fundo e escolhe branco ou quase preta pelo que mais contrasta. Meta
  antigo (só `luma`) segue a regra de antes. Casinha laranja + letras azul-escuras no slide escuro ganha pílula clara.
- **Rodada 2 (2026-10-23):** (a) furos revertidos (acima); (b) `internalNotes` cobre também 1ª pessoa de dado que falta ("não encontrei o valor…", "deixei de fora", "dados faltando"), "dica pro corretor" com instrução, "Corretor:" + verbo, "aviso/nota interno", colchetes/parênteses com "confirmar + dado"; "revise" saiu da regra fraca do ⚠️ (só conta com dado do imóvel como objeto: "⚠️ Revise seu orçamento…" passa); (c) `svgToPng` só zera o cache do resvg se o `initWasm` falhou (SVG inválido seguido de válido funciona); (d) slide também ignora o nome padrão "Marca".
- Conhecido: SVG com filtro pesado (feTurbulence) leva ~1,8 s no resvg (sem timeout possível no wasm síncrono).

### 2. Rótulos chegam em `posts` na publicação

`agent-actions` (insert em `posts` a partir da peça aprovada, ~linha 365): um **segundo** bloco
`try/catch`, separado do que copia `pillar/recipe/format/item_id`, lê `familia, pilar_ss` da peça e
faz `update` em `posts` só se houver valor, **antes** de apagar a peça. Erro é logado, nunca derruba
a publicação; se a migration das colunas faltar, só esse bloco falha. O `select` antigo não foi
ampliado (de propósito, mesma razão da regra de nunca pôr coluna nova no insert). **`pillar` já
era copiado** (é o `tema`); só `familia` e `pilar_ss` faltavam.

**Ainda falta:** `_shared/learning.ts` **não agrupa** por `familia`/`pilar_ss` — `GroupKind` é
`pillar | recipe | format`. Os rótulos agora chegam em `posts`, mas o aprendizado "família × pilar × ângulo"
ainda precisa dessa mudança (e de `select` com as colunas, tolerante).

### 3. A legenda nunca fala com o corretor

Testes (sem biblioteca externa): `node --experimental-strip-types scripts/test-internal-notes.mjs` e `scripts/test-logo-png.mjs`.

- `_shared/internalNotes.ts` — `stripInternalNotes(text) → { text, notes[] }`, por bloco/linha/frase.
  Regras fortes (dados que recebi + precisa/confirm/revis; "precisa de confirmação"; "ser confirmado";
  "antes de publicar"; "nota/aviso interna"; "para o corretor/dono"; fala dirigida "Corretor,";
  pedido de dado "me passe/envie/confirme … metragem/preço/dado") e fracas (só com ⚠/🚨/❗ no
  começo: "sobre a metragem:", "inconsistência", "parece erro", "valor estranho", "não bate",
  "verifique"). Nunca remove só por "corretor" nem só por ⚠️ ("Fale com o corretor João",
  "⚠️ Últimas unidades" passam). Bloco que começa com ⚠ ou "Corretor," e casa com qualquer regra sai
  inteiro; num bloco normal sai só a linha/frase marcada.
  - **Divergência do pedido:** "me passe/envie/confirme" só marca quando seguido de dado (metragem,
    preço, área, valor, endereço…), pra não apagar chamada pública como "Me passa seu contato…". O
    caso real e "Ops! Corretor, me passa…" saem (este último pela fala dirigida).
- `catalog-package`: aplicado no wrapper `copy()` em `caption` e `cta`, **antes** de anexar o aviso de
  mobiliado do `carrossel_tour`. O que saiu vai pro `reasoning` com o prefixo fixo
  "Recado da IA que saiu da legenda: …", **depois** do aviso do QUERO (o prefixo do QUERO fica intacto,
  então `keepQueroNotice` continua achando). Legenda que esvaziou fica vazia + aviso "a legenda não saiu
  … gere de novo". Prompt do `writeCopy` reforçado ("nunca um recado, aviso, alerta ou ressalva pro
  corretor, nem pedido de dado… se um dado parecer estranho ou faltar, simplesmente não o cite").
- **Não mexido:** `creative-generate` (legenda de post/vídeo) — a mesma trava pode ser reutilizada lá
  num próximo PR.

## Pontas soltas pós-fase 3 (2026-10-25)

Fecha o que a seção "Correções pós-fase 3 (2026-10-23)" deixou de fora. Tudo em branch, nada publicado ainda.

**Divergência (2026-10-26):** o `brand-kit-suggest` com o `backfill_logos` foi publicado antes do PR (v18;
voltar = v17), a pedido do dono ("faça por mim" o primeiro "Preparar logo"). Rodado **só na Tespon**:
`dry_run` → `libs: {imagescript: true, resvg: true}` (as duas bibliotecas carregam no servidor de verdade);
depois `dry_run:false` → logo classificado `logo`, fundo branco removido, `png_url` gravado,
`logo_url` intacto, custo ~US$ 0,003. Slides antes/depois (fundo escuro e claro) renderizados em produção:
no claro o círculo azul fica limpo; no escuro ganha a pílula clara (logo escuro, contraste baixo).
Contagem para o backfill do resto (26/10): **só 1 empresa** com logo e sem `logo_meta` — a do próprio
Sales Boost. A Liga dos Sonhos não tem logo cadastrado, então não entra.

- **Backfill do logo (`brand-kit-suggest`, ação `backfill_logos`).** Empresas que já tinham logo antes do PNG
  transparente ficam com `brand_dna.logo_meta` nulo (e o criativo cai no logo de sempre). A ação, só com
  `cron_secret`, preenche isso: `dry_run` (padrão `true`: não chama IA nem grava, só lista e estima custo),
  `limit` (padrão 5, máx. 10), `only_company_ids[]`, `exclude_company_ids[]`; sequencial, prazo ~90 s; pula
  empresa sem acesso pago (exceto nomeada em `only_company_ids`). Grava com `update … is('logo_meta', null)`
  (nunca cria linha), `logo_url` nunca muda, o meta ganha `backfilled_at`. Não grava se a IA falhar, se a
  biblioteca de imagem não carregou, nem se um logo **do dono** (que não é `logo-ig-*`) for classificado como
  foto (só lista em `skipped`). Devolve `libs` (imagescript/resvg carregaram?). **Divergência do doc de
  2026-10-23/DECISIONS** ("sem backfill automático"): continua sem cron — é uma chamada manual, a pedido.
- **Aprendizado por família e pilar (`_shared/learning.ts`).** Além de pilar/receita/formato, agrupa por
  `familia`, `pilar_ss` e `familia × pilar_ss` (só posts com os dois). Os 3 grupos novos só **medem** (sem
  `suggested_share_pct`). Rótulos lidos num `select` à parte e tolerante (sem a coluna: os 3 ficam
  `insufficient_data` + aviso). `learningHighlights` monta, **por código e sem IA**, uma frase só quando a
  combinação família × pilar está `ok` e há **um único** 1º lugar (empate = sem frase). O refresh do
  `strategy-generate` cita só essa frase; se o `what_changed` da IA não a trouxer, o código anexa
  "Medido: …" em `reasoning` e `recommendation` do log da estratégia.
- **Legenda sem recado pro corretor nas peças de foto, deck e vídeo.** `stripPieceTexts` (em
  `_shared/internalNotes.ts`) roda no `creative-generate` (`generateForCompany` e `runVideoSlot`) **antes** da
  trava do QUERO, em legenda e CTA; CTA que era só recado volta ao do briefing; `post.cta` limpo (o deck lê
  ele). `reasoning` = Diretor · aviso do QUERO · recado que saiu · "legenda não saiu". O `keepQueroNotice`
  passou a manter os 3 avisos no vídeo. **Fora:** `runFaqSlot` (texto vem de dica conferida; só ganhou a
  linha "a legenda é pro público" no prompt). **Limite:** texto **impresso na imagem** (cards `card_*`, slides)
  não passa por essa trava (ver PITFALLS).
- **`brand-compose` usa o logo preparado.** `_shared/logoResolve.ts` (`resolveLogo`) tem a mesma lógica do
  `render-format` (foto → sem logo; PNG preparado só se `src === logo_url`; erro → logo de sempre). O
  `render-format` **não foi movido** (produção): a lógica existe em dois lugares, com comentário nos dois.
  A resposta do `brand-compose` ganhou `logo: 'prepared' | 'legacy' | 'foto' | 'none'`.

## Fase 2 (decisão C) — em código (2026-10-26)

Pedido do dono: juntar `carrossel_slides` e `carrossel_educativo`; tema regulado usa só dica liberada do
`dica_faq`; sem dica liberada vira dica geral sem número, prazo, taxa nem lei; tema leve livre com a trava de
números. Branch `claude/nifty-shannon-ysp818`; **nada foi aplicado nem deployado** (migration e deploy do
`creative-generate`, função de cliente real, dependem de "pode").

**O que entrou**

- **`_shared/deckTopic.ts` (puro, testado em Node):** classificação por termos da ficha
  (`category_terms`; mais acertos distintos vence, empate fica com a categoria regulada, nada = a IA decide);
  escolha das dicas (até 4 `isPublishable` da categoria, as menos usadas); números permitidos = só os das dicas;
  validadores dos 3 modos (regulado: números e `regulated_terms` presentes nas dicas, sem acento/maiúscula;
  geral: barra dígito, %, R$, "reais", "por cento", número por extenso + dias/meses/anos/semanas/horas,
  "art."/"artigo", "alíquota", "Lei <nome|número>" e qualquer termo regulado, mas deixa "três erros comuns";
  leve: só avisa termo regulado); textos de reserva determinísticos (regulado: resposta da dica cortada em fim
  de frase + "Fonte: <site>"; geral: texto fixo sem fato); `resolveAlias`.
- **`_shared/deckGuard.ts`:** `decideTopic` (termos → pergunta barata ao Haiku, validada → tema regulado busca as
  dicas `kind='faq'` da categoria, reconfere até 2 vencidas, usa até 4) e `guardDeck` (valida slides e legenda
  depois da IA; reescreve 1x em paralelo; falhou → texto de reserva; no regulado, um verificador barato de
  afirmações → reescrita 1x → reserva). `topicBlock` põe as dicas no prompt como ÚNICA fonte de fatos.
- **`creative-generate`:** classifica dentro de `generateForCompany` quando `opts.deck` e a ficha tem faq (cobre a
  ideia do dono e o "Gerar agora"); regulado/geral tiram intenção e oferta do prompt e usam como números
  permitidos só os das dicas (geral: nenhum); 1 slide por dica entre capa e fecho; "Fonte: <site>" no fecho e na
  legenda quando a dica tem fonte oficial; `used_count` das dicas sobe; `brief.deck_source = {mode, category,
  tip_ids}` + linha em `reasoning`. O retry de overflow só aceita o slide reescrito se ele ainda passa no
  validador do modo. Mantidos: `saveLabels`, `intent`, `decideVideoCta`/`lockSlide` (a validação nova roda DEPOIS),
  `stripPieceTexts`. A vaga `dica_faq` sem dica liberada manda `forceGeneral`.
- **Apelido de formato:** `faqCheck.fetchFaqConfig` lê `regulated_categories`, `category_terms`,
  `regulated_terms` (tolerante); `formatCatalog.fetchFormatAliases` lê `content_rules.format_aliases` (só vale com
  destino `live` e não desligado). `planWeekFromStrategy`, `makeNowJob` e `runPlanSlot` resolvem o apelido.
- **Ficha (migration `20261026120000_carrossel_educativo_unico.sql`):** `carrossel_educativo` → `live`, família
  `educativo`, nome "Carrossel educativo (dicas conferidas; tema leve livre)"; `disabled_formats` += `carrossel_slides`
  (sem perder `post_card`); `format_aliases`; `config.faq` ganha `regulated_categories`
  (`juridico`, `financiamento`, `documentacao`, `impostos`), `category_terms` e `regulated_terms`. Testada num
  Postgres local: roda 2x sem mudar nada, preserva `post_card`, e o bloco REVERTER volta ao estado anterior.
- **Tela:** o texto de `FaqTips.tsx` (PT/EN) diz que o carrossel educativo desses temas usa só dicas liberadas.
- **Testes:** `node --experimental-strip-types scripts/test-deck-topic.mjs` (lê os termos da própria migration).

**Divergências registradas**

- **`allow_carrossel` não precisa ligar** (o plano da fase 2 dizia "ligado para esse formato"): o educativo é
  sempre carrossel de slides (`opts.deck`), não passa pelo botão "considerar carrossel" da Área de Testes.
- **A "dica geral" do `runFaqSlot` era só prompt:** o texto "dica GERAL: sem número…" ia no ângulo da vaga e nada
  conferia. Agora é o modo geral validado por código (a vaga `dica_faq` sem dica liberada usa `forceGeneral`).
- **Aluguel e geral ficaram LEVES** (decisão do dono pendente): estão em `category_terms`, mas fora de
  `regulated_categories`. Peça de aluguel que cite "Lei do Inquilinato" ou "Código Civil" cai na rede de segurança
  (reescreve 1x; se continuar, avisa em `reasoning`).
  - **Atualização 2026-10-26:** o dono decidiu que **aluguel é regulado** (migration
    `20261026130000_aluguel_regulado.sql`). O texto acima vale só para **geral**, que segue leve.
- **Estratégia antiga com `carrossel_slides` no `weekly_mix`:** não foi editada (regra do pedido); o apelido faz a
  vaga sair como educativo. Na próxima atualização da estratégia o catálogo já não lista `carrossel_slides`.
- **Tema pelo Diretor:** como o "Gerar agora" e as vagas sem assunto não têm tema no título, a classificação
  também lê o gancho e a oferta que o Diretor Criativo escolhe (uma chamada que já existia).
- **Custo/tempo:** +1 chamada Haiku (classificação, só se os termos não decidem) e, no regulado, +1 ou +2 do
  verificador; reescritas só quando o código acha problema. Sem custo de imagem novo.

**Correções pós-QA (2026-10-26, mesmo branch; nada aplicado nem deployado)**

1. **Tema não lê mais o nome do formato.** A classificação usava `seed.title`, que numa vaga do calendário é
   "Carrossel educativo (dicas conferidas; tema leve livre)" — "dica/dicas" eram termos de `geral`, então ITBI/FGTS
   (1 acerto) virava geral/leve. Agora `deckTopic.topicText` monta o texto (ângulo/pilar/propósito, gancho, ideia do
   dono, gancho e oferta do Diretor) e deixa o título de fora quando `seed.titleIsFormat` (vagas do calendário e
   caminho antigo da semana). "dica" e "dicas" saíram dos termos de `geral` na migration. Teste com o nome real do
   formato: ITBI, FGTS e matrícula → regulado.
2. **Guarda desligado = fluxo antigo idêntico.** Sem `regulated_categories` na ficha (deploy antes da migration), a
   vaga `dica_faq` sem dica liberada volta a levar no ângulo "dica GERAL: sem número, prazo, taxa, valor nem nome de
   lei". Com o guarda ligado, quem confere é o código (`forceGeneral`).
3. **Números por valor + unidade** (`faqCheck.numberFacts`, usado também pelo card do `runFaqSlot`): formato BR
   (`1.500,00` = `1500`; `3,0` = `3`; `150 mil` = `150000`) e unidade (%, R$, dia, mês, ano, semana, m²). Número com
   unidade diferente da dica não casa (`30%` ≠ `3%` ≠ `30 dias`; `150.000` ≠ `1.500`).
4. **Modo geral mais firme:** barra fração de valor ("metade/dobro/triplo/um terço… do valor/da entrada/do preço"),
   "porcento", "Lei federal/estadual/municipal" e siglas pontuadas ou espaçadas (I.T.B.I., F.G.T.S., I P T U) antes de
   casar `regulated_terms` (vale também no regulado e no leve). Continuam passando "Peça a matrícula atualizada",
   "três erros comuns", "segunda via", "o primeiro passo".
5. **Reverter da migration** agora também tira `family` do `carrossel_educativo` (volta idêntico ao original;
   conferido num Postgres local: migration 2x sem mudança e REVERTER = estado inicial).
6. **Prompt do modo regulado** diz "dicas liberadas pelo dono" e só cita fonte oficial na dica que tem uma (cada dica
   mostra a própria fonte); a reescrita também diz "dicas liberadas".

**Falta pro critério de pronto:** migration + deploy (`creative-generate` com `--no-verify-jwt`) e uma semana de
teste numa empresa de teste com 2 educativos (um de tema regulado com dica liberada, um sem dica, um leve).

## Custos e Higgsfield

- Educativo e Bairro: **custo de imagem ~zero** (montagem no servidor);
  Higgsfield só se a capa usar foto real tratada.
- Oferta: 1 tratamento de foto por peça (mesmo modelo do Vault).
- Tour: US$ 0,42 por 5 s (medido), dentro do volume já decidido por plano.
- Nenhum gasto novo sem o teto mensal por empresa já usado
  (`VIRTUAL_STAGING_MONTHLY_CAP`, teto de vídeos) — regra 7.

## Regras que continuam valendo

- Nada vai ao público sem aprovação (Aprovações ou Telegram).
- Foto de imóvel sempre real; IA de imagem/vídeo nunca escreve texto.
- Número só com fonte (educativo usa só dica conferida em fonte oficial).
- Tudo que é do setor fica na ficha (`vertical_playbooks`), nunca no código.

## Decisões do dono (2026-10-21)

1. **Mix aprovado:** 3 tour · 2 oferta · 2 educativo · 1 bairro por semana,
   sempre as mesmas famílias; a Estratégia aprende e melhora os **ângulos**.
2. **Família 5** (prova social/bastidores) fica **só como eventual**.
3. **Capa do educativo varia**; com foto do corretor no sistema, usa às vezes;
   sem foto, só design da marca.
4. **Calendário rotulado pelas 4 famílias.**
5. **Trends/notícias entram na intenção** — com fonte gravada (ver seção
   própria).
