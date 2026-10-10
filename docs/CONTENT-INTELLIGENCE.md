# Sales Boost — Content Intelligence

> Como o sistema decide O QUE criar. Etapas 2-4 do ciclo (ver
> [ARCHITECTURE.md](ARCHITECTURE.md)).

## Ritmo

Estratégia mensal (direção, ver [ARCHITECTURE.md](ARCHITECTURE.md) etapa 2)
→ **calendário semanal** (unidade de planejamento; dono aprova 1x/semana)
→ execução diária (publicar aprovado, Stories, responder). Imóvel novo
entra nos próximos espaços livres do calendário.

## Pilares (ficha `imoveis_rio`, ponto de partida — o 80/20 ajusta)

| Pilar | Peso |
|---|---|
| Imóveis | 30% |
| Bairro/estilo de vida | 25% |
| Mercado | 20% |
| Educação | 15% |
| Marca pessoal/prova social | 10% |

Ajustes esperados (ainda não automatizados por regra de código — hoje é a
IA quem decide dentro do prompt, não um cálculo determinístico): carteira
pequena → mais bairro/educação; carteira grande → mais imóveis; faixa de
preço muda tom e exemplos.

**Status real:** os pesos vivem em `vertical_playbooks.config.pillars` —
reais, lidos pelo `catalog-package` (`pillarCap`) pra limitar quantas
peças de cada pilar entram por semana. A proporção 80/20
comprovado-vs-experimental **não existe como regra separada** — é um
gap registrado também em [ARCHITECTURE.md](ARCHITECTURE.md) etapa 3.

**Atualização (P2 parte 1):** o cálculo determinístico do 80/20 agora existe
em código (`_shared/learning.ts`, ver [LEARNING.md](LEARNING.md)) e alimenta o
prompt do `refresh` da estratégia; ainda **não** limita o `catalog-package`
nem o calendário — o `pillarCap` por peso da ficha continua sendo o que vale lá.

## Pilar → receita de produção (`production_recipes`)

Hermes decide o MIX da semana; o Content Agent classifica cada ideia pelo
pilar e aplica a receita de produção daquele pilar
(`vertical_playbooks.config.production_recipes`, real, já existe pra
`imoveis_rio`):

- **imovel:** fotos reais do catálogo → criativos (Higgsfield, ver
  [MEDIA-ENGINE.md](MEDIA-ENGINE.md)) + texto via `render-format` + dados
  do cadastro.
- **local (bairro/estilo de vida):** material do corretor OU imagem
  genérica de clima — nunca finge lugar real; sem fotos do Google Maps sem
  licença.
- **mercado:** gráfico/texto, só números COM fonte. **Hoje não há fonte de
  dado de mercado** → tendências sem números inventados (regra ativa:
  nunca inventar métrica).
- **educacao / marca_pessoal:** texto + foto/vídeo real do corretor (avatar
  é futuro, ver [MEDIA-ENGINE.md](MEDIA-ENGINE.md)).
- **prova_social:** só com material e autorização do cliente.

## Pacote por item (`item_package`, 8 peças)

Implementado em `supabase/functions/catalog-package/index.ts` — gera as
peças PRODUZÍVEIS hoje; peças que dependem de material real do
corretor/autorização ficam marcadas como `skipped` com o motivo, nunca
inventadas:

| Peça | Fonte de mídia | Status |
|---|---|---|
| Carrossel-tour | Fotos reais do catálogo | ✅ produz (`carrossel_tour`) |
| "O detalhe que você não viu" | Foto real | ✅ produz |
| Reels "o que R$X compra no bairro" | Imagem genérica de clima (IA) | 🟡 produz como imagem estática — Reels/vídeo de verdade é [MEDIA-ENGINE.md](MEDIA-ENGINE.md) |
| "3 coisas perto" | Imagem genérica (IA) | ✅ produz |
| Stories enquete "pagaria R$X?" | Card `render-format` | ✅ produz |
| Stories caixa de perguntas | Material real do corretor | ❌ skipped — precisa de material/autorização |
| "POV: pegou a chave" | Material real do corretor | ❌ skipped — precisa de material/autorização |
| Reels tour com fotos reais | Higgsfield (vídeo) | ❌ ainda não existe — [MEDIA-ENGINE.md](MEDIA-ENGINE.md) P3 |

## Calendário e ocupação

- Máx. 1-2 peças/dia (regra real em `creative-generate`/`catalog-package`).
- Checagem de ocupação (`getOccupancy`/`pickSlot`) vale pro pacote E pro
  `planWeekForCompany` — não duplicam a mesma data.
- Pacote espalhado em 2-3 semanas (`candidateDates(21)`), respeitando o
  cap por pilar (`pillarCap`).
- **Divergência tela × código (achada em 2026-10-06):** a tela Calendário
  da Semana (`WeeklyCalendarTab.tsx`) diz que o agente "escolhe as melhores
  Ideias do backlog… nunca inventa do zero", mas `planWeekForCompany`
  gera cada peça **sem** seed/ideia, de propósito (comentário no código). A
  cadência (1-2/dia, 7-14 por semana) não olha fotos disponíveis nem ritmo
  de aprovação do dono, e o motivo de cada dia (`note`) é devolvido mas a
  tela não mostra. Plano: "Plano da semana" (ver ROADMAP) alinha os dois.

## Tom e ganchos

Ganchos/CTAs por pilar vêm da ficha (`vertical_playbooks.config`) —
exemplos: "Comente VISITA", "Comente SIMULAÇÃO", "Salva/Manda". Tom:
próximo, carioca, direto nos números, sem "oportunidade imperdível" (regra
de voz da ficha, não hardcoded no código).

## Rastreabilidade

Todo post gerado por este caminho guarda: `item_id`, `pillar`, `recipe`,
`format`, `provider` (`marketing_ai_test_content` — colunas reais,
adicionadas em 2026-09-30). **Falta:** qual gancho específico e qual
objetivo da estratégia a peça serve, de forma estruturada pra reler depois
— hoje isso só existe implícito no texto gerado, não como coluna. Ver
[LEARNING.md](LEARNING.md) pra como isso deveria alimentar a memória.

## Ferramentas visuais por setor (`creation_tools`)

`vertical_playbooks.config.creation_tools` + `marketing_ai_tool_registry`
(coluna `vertical_key`, nullable — tools globais continuam sem setor).
Pra `imoveis_rio`:

| Tool | Status |
|---|---|
| `tour_virtual_tool` | `live` — funciona de verdade via `catalog-package` (`only_recipe:'carrossel_tour'`) |

**Divergência de nome (2026-10-09):** `tour_virtual_tool` ("Tour virtual do imóvel — Criar" no card) gera o **carrossel de fotos**, não o vídeo. O vídeo-tour em caminhada é o botão novo "🎬 Tour em vídeo" do mesmo card (`ItemTour.tsx` → `tour-plan`). Renomear a ferramenta antiga pra "Carrossel do imóvel" fica pra etapa 2 (mexe no registro de ferramentas).
| `criativos_anuncio_tool` | `planned`, `requires_integration:'higgsfield'` |
| `avatar_corretor_tool` | `planned`, `requires_integration:'heygen'` — **divergência:** [DECISIONS.md](DECISIONS.md) fixa Higgsfield como único provedor; HeyGen foi citado antes de essa decisão existir. Corrigir o `requires_integration` quando o avatar for de fato implementado. |
| `voz_corretor_tool` | `planned` |

Tools `planned` mostram "Em breve" + botão "Quero quando lançar" —
registra em `marketing_ai_tool_interest`, contagem visível no painel Owner
(`BusinessTypesPanel.tsx`).

## Mapa de formatos (aprovado 2026-10-09 — plano, ainda não implementado)

> **Atualização 2:** a lista de formatos agora vive na ficha
> (`content_formats`) e a estratégia escolhe dela — ver "Catálogo de
> formatos → estratégia → calendário" no fim deste doc.

> **Atualização (mesmo dia):** o dono tirou o tour completo e os recortes —
> o vídeo é ISCA: 1 cômodo, 2 cômodos vizinhos ou abertura de fora com a
> vista (já implementado: `item-videos`, botão "🎬 Vídeos e resposta do
> QUERO"). A palavra é QUERO (não TOUR) e a DM leva os dados cadastrados +
> convite pra visita, não o vídeo inteiro. As linhas "Tour completo",
> "Recorte do tour" e "Tour como isca na DM" da tabela abaixo ficam como
> histórico. Ver [DECISIONS.md](DECISIONS.md).

Cada formato novo entra numa peça que já existe; nada de código específico
de setor (regra 6) — receitas, ganchos e CTAs ficam na ficha
(`vertical_playbooks.config`). Decisão em [DECISIONS.md](DECISIONS.md).

| Formato | Pilar | Onde nasce | Mídia | Custo de geração |
|---|---|---|---|---|
| Tour completo em caminhada | imoveis | pacote do imóvel (1x por imóvel) | `video_tours` kind `plan` | ~US$ 0,65 por passagem (estimativa) |
| Recorte do tour (Reels 15-30 s) | imoveis | pacote do imóvel, espalhado nas semanas | trecho do tour | zero |
| Stories com recorte + enquete/caixa (ideia 3) | imoveis | planejador da semana | trecho do tour | zero |
| Tour como isca na DM (ideia 1) | imoveis | CTA "Comente TOUR" no Reels → DM com o tour inteiro | tour completo | zero (DM com aprovação do modelo de mensagem, regra 1) |
| Close de 5 s de um detalhe (ideia 4) | imoveis | pacote do imóvel | 1 trecho Kling (modo `per_photo`) | ~US$ 0,54 |
| Criativo bonito com foto | imoveis | pacote do imóvel (já existe: carrossel, "detalhe") | foto real + `render-format` | centavos |
| "Isso ou aquilo" (ideia 2) | imoveis | planejador da semana (precisa de 2 imóveis) | 2 fotos reais | centavos |
| Post educativo / trend | educacao | planejador da semana (receitas novas na ficha; hoje a lista está vazia) | foto real + texto | centavos |
| Cartão-postal do bairro (ideia 5) | bairro_estilo_vida | pacote do imóvel (endereço) | Wikimedia (licença + crédito) | zero |
| Avatar do corretor abrindo o tour (ideia 6) | marca_pessoal_prova_social | junto do tour | foto + autorização do corretor | a confirmar (fornecedor) |
| "Vendido!" (ideia 7) | marca_pessoal_prova_social | quando o imóvel sai do catálogo | foto real + autorização | centavos |

Na ficha `imoveis_rio`: `item_package` troca `reels_tour_fotos_reais` por
`tour_completo` + `reels_recorte_tour` + `stories_close_detalhe` +
`post_cartao_postal`; `production_recipes.educacao` ganha
`carrossel_educativo` e `post_trend`; `marca_pessoal_prova_social` ganha
`intro_avatar` e `post_vendido`; `ctas`/`hooks_by_pillar` ganham "Comente
TOUR". Mudar a ficha em produção é SQL de produção (vai num PR).

## Catálogo de formatos → estratégia → calendário (2026-10-09)

Implementado. A estratégia (Hermes, `strategy-generate`) agora enxerga
**todos os formatos** que o sistema sabe produzir e decide:

1. **Linha central de conteúdo** + 2-4 **formatos-âncora** (parte 1, junto
   com a tese);
2. **Mix da semana** — quantas peças de cada formato por semana, cada uma
   ligada a um objetivo da tese (parte 2 e no refresh mensal).

Fica em `marketing_ai_strategies.content_plan` e aparece na tela da
Estratégia (bloco "Conteúdo & Campanha").

- **Catálogo** (`_shared/formatCatalog.ts`): ficha do setor
  (`vertical_playbooks.config.content_formats` — chave, nome, pilar, quem
  produz, status, custo) + formatos da aba Formatos da empresa + o post
  genérico com template da marca. Sem código de setor.
- **Validação em código:** só entra no mix formato que existe no catálogo e
  "funciona hoje"; máximo 14 peças/semana (regra 1-2/dia).
- **Calendário da semana** (`planWeekForCompany`): segue o mix — o total de
  peças geradas mira o pedido pela estratégia e cada post leva o formato e o
  objetivo da vez (seed). O que não dá pra gerar sozinho (vídeo do imóvel,
  pacote do item, resposta QUERO) volta como lista "a estratégia também
  pede nesta semana" na tela do Calendário — nada que custe dinheiro é
  gerado sem o dono pedir.
- **Stories separado não entra** (regra do dono, 2026-09): o calendário só
  tem post orgânico.
- **Não testado ponta a ponta no ensaio:** o ensaio não tem
  `ANTHROPIC_API_KEY`, então a geração real da estratégia não rodou lá.
  Testado: validação do catálogo/mix (casos de chave inventada, "em breve",
  repetida, acima do teto), compilação das duas functions e a tela com um
  plano montado a partir do catálogo real (desktop e 390 px, sem erro).

## Trends de verdade (2026-10-09)

Primeira fonte externa real de "o que está em alta": o diagnóstico grátis
(`diagnosis-market`, ver [DECISIONS.md](DECISIONS.md)) lê os posts que mais
engajam nas hashtags da região nos últimos 30 dias e grava os 5 melhores em
`marketing_ai_trends` (`source='diagnostico'`) quando a conta é criada.
**Divergência registrada:** o planejador da semana ainda não lê essa tabela
pra decidir os posts — próximo passo é ligar `post_trend` a ela.
