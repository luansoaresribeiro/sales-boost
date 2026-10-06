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
| `criativos_anuncio_tool` | `planned`, `requires_integration:'higgsfield'` |
| `avatar_corretor_tool` | `planned`, `requires_integration:'heygen'` — **divergência:** [DECISIONS.md](DECISIONS.md) fixa Higgsfield como único provedor; HeyGen foi citado antes de essa decisão existir. Corrigir o `requires_integration` quando o avatar for de fato implementado. |
| `voz_corretor_tool` | `planned` |

Tools `planned` mostram "Em breve" + botão "Quero quando lançar" —
registra em `marketing_ai_tool_interest`, contagem visível no painel Owner
(`BusinessTypesPanel.tsx`).
