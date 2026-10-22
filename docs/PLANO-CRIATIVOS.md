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

**Ordem atualizada em 2026-10-22** (fase 1 e QUERO no ar): **3 (com A + B) →
2 (com C) → 7 → 6 → 4 → 5**. A fase 3 vem primeiro porque os dados da
estratégia já existem e só não chegam ao post — é o maior ganho pelo menor
risco.

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
