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
| `objetivo` | atrair · educar · converter |
| `publico` | "primeiro imóvel, família, Barra" |
| `angulo` | "medo de errar na documentação" |
| `tema` (educativo) | categoria do `dica_faq` (ex.: `documentacao`) |
| `item_id` (tour/oferta) | qual imóvel do catálogo |
| `cta` | da lista da ficha (`ctas`): "Comente QUERO", "Me chama no direct"… |

O gerador **preenche os campos do formato a partir da intenção**, sem trocar
o formato. Validação em código: intenção sem `objetivo` ou com formato fora
do catálogo é rejeitada (mesmo padrão de `formatCatalog.ts`).

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

## Fases (com critério de pronto)

| Fase | O que entrega | Pronto quando | Alteração arriscada? |
|---|---|---|---|
| **1. Sistema de slides + medir texto** | Novo `svgSlide` com os layouts, logo, destaque, fonte do kit; medição real de texto | Carrossel de teste (5 slides) renderizado sem texto cortado, com logo e cor do kit de 2 empresas de teste diferentes; prints no PR | Não (função nova/ajustada, testada no ensaio) |
| **2. Carrossel educativo de verdade** | `carrossel_educativo` passa a `live`; conteúdo vem das dicas liberadas do `dica_faq`; `allow_carrossel` ligado para esse formato | A estratégia de uma empresa de teste coloca 2 educativos na semana e eles chegam em Aprovações | **Sim:** SQL na ficha de produção (vai no PR; o merge aprova) e deploy de `creative-generate` (função de cliente real) |
| **3. Intenção estruturada** | `weekly_mix`/`WeekSlot` com `objetivo/publico/angulo/tema/item_id/cta`; gerador obedece | Cada peça do calendário mostra a intenção na tela e a peça gerada usa o CTA e o tema pedidos | Sim: deploy de `strategy-generate` e `creative-generate` |
| **4. Fonte e estilo no Kit da Marca** | Campos novos + escolha na tela Padrão visual + sugestão automática | Trocar a fonte no kit muda os próximos criativos | Não (aditivo), salvo migration em produção (vai no PR) |
| **5. Calendário em 4 famílias** | Tela do calendário agrupa/rotula por família (ícone + cor) | Dono reconhece as 4 famílias na semana sem ler o nome do formato | Não |

Ordem recomendada: **1 → 2 → 3**, depois 4 e 5. A fase 1 sozinha já melhora
todos os carrosséis que existem hoje.

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

## Perguntas em aberto para o dono

1. O mix padrão (3 tour · 2 oferta · 2 educativo · 1 bairro) está bom?
2. A família 5 (prova social/bastidores) fica só como eventual, como proposto?
3. Na capa do educativo, preferimos foto real do corretor (precisa enviar) ou
   só design da marca?
