# Roadmap — ordens e seções antigas (histórico até 12/11/2026)

> Movido de `docs/ROADMAP.md` em 2026-11-13 (reorganização pedida pelo dono), sem alteração de texto. O estado atual está em [ROADMAP.md](../ROADMAP.md).

## Ordem aprovada (dono, 2026-11-11 noite) — HISTÓRICO, substituída pela direção de 13/11 acima

| Prioridade | Trabalho | Situação |
|---|---|---|
| 1 | Finalizar o Tour virtual | conferência v4 publicada e testada (7/7, 11/11); tour contínuo da área social feito em 13/11. **Agora é a Frente 1 (imóvel inteiro).** |
| 2 | Validar tecnicamente o Tour (gate técnico) | **13/11 (atualizado pelo critério novo do dono): o trecho social passou, mas o tour NÃO está pronto para clientes** — a regra agora é cobrir o imóvel INTEIRO e o vídeo cobriu 8 de 22 ambientes; plano e pendências em [PLANO-TOUR-COMPLETO.md](../PLANO-TOUR-COMPLETO.md) e [PENDENCIAS.md](../PENDENCIAS.md). Registro original: tour do imóvel inteiro na Tespon (8 fotos, 7 caminhadas, 41 s, US$ 3,53), nenhum corte, nenhuma passagem inventada (todas "sim" na conferência v4); detalhe em MEDIA-ENGINE. Achado: a legenda descrevia fachada/varanda que não aparecem — corrigido (a legenda recebe os ambientes na ordem do vídeo). Histórico de 11/11: conferência v4 7/7 ✅; par terraço → sala de baixo travou por falta de saldo no Higgsfield |
| 3 | Painel novo (funil comercial) | 12–13/11: 1ª parte feita — bloco "Resultado comercial" no topo do painel (visualizações → interessados → leads recebidos → visitas, funil e "de onde veio" por imóvel e por publicação, 30 dias, só dado real). "Leads qualificados" só quando a qualificação for aprovada. Próximo: revisar o resto do painel junto com a simplificação (prioridade 4) |
| 4 | Revisar abas e fluxos | depois da 3 |
| 5 | Telegram com dado real e aprovações | depois da 4 |
| 6 | Remover o "Painel-resumo" | ✅ feito em 13/11 a pedido do dono (antecipado): saiu do topo do painel; o "Resultado comercial" mostra o funil com dado real |
| 7 | Mobiliamento virtual em vídeo (dentro da aba Tour virtual) | só especificação ([MEDIA-ENGINE.md](../MEDIA-ENGINE.md)); começa depois do tour e da simplificação |

**Regras:**
- Uma frente de código por vez; nenhuma frente nova antes de fechar a atual, salvo dependência real.
- O painel **não** espera imobiliária. Espera só:
  - a definição de lead qualificado (proposta em [CONVERSION.md](../CONVERSION.md));
  - a decisão de privacidade (marcar ou não o navegador do visitante para saber o 1º e o último contato).
- Boosts e cobrança continuam esperando a validação comercial (seção abaixo).
- Em paralelo e sem abrir frente nova: o dono resolve as duas decisões e as conversas comerciais.

**Painel novo, critério de pronto:** o topo mostra o resultado comercial, e não quantos posts saíram:
- os números: visualizações dos imóveis → interessados → leads qualificados → visitas agendadas;
- logo abaixo, o funil;
- depois, a origem: por imóvel e por publicação.

O que não tem medição aparece como "ainda sem dados", nunca como número inventado. Os gráficos que já existem são reaproveitados; o que não ajuda a decidir sai do topo.

**Direção** (dono): o Sales Boost passa de ferramenta de marketing para sistema de inteligência e geração de demanda comercial. O painel tem que refletir isso, e não ser só uma tela mais bonita.

## Plataforma internacional — segurança, depois idioma/país, depois expansão (dono, 2026-11-07)

Decisão completa em [DECISIONS.md](DECISIONS-2026-11-01-a-09.md#2026-11-07--plataforma-internacional-idioma--país--regras-dono).

| # | Entrega | Prioridade | Pronto quando | Situação |
|---|---|---|---|---|
| 0 | Desligar publicação sem aprovação | Imediata | Nenhum caminho publica sem aprovação humana, com trava no servidor e teste | ✅ função antiga desligada (07/11); trava do `agent-actions` em PR, publicar depois do merge |
| 1 | CRECI (PF/PJ, formato, conferência, inclusão automática, bloqueio só da publicação comercial) + proteção contra discriminação, promessa e informação inventada em legendas, DMs, WhatsApp e respostas automáticas | Alta | Peça sem CRECI válido não publica; filtro em todas as saídas públicas, sem bloquear afirmação comprovável; testes com casos reais | autorizada 07/11 · **1A (CRECI) e 1B (proteção) em PR (09/11)** |
| 2 | País do negócio no cadastro (separado do idioma) + estrutura de regras por país na ficha; contas atuais = Brasil; ficha EUA desligada para venda | Alta | Cadastro pergunta o país; idioma escolhido não é sobrescrito pela ficha; ficha por país lida pelo código genérico | planejamento aprovado |
| 3 | IA respeitando o idioma (~30 functions, WhatsApp, Telegram, título do imóvel, "QUERO", textos da ficha em pt/en) | Alta | Com idioma EN, nada gerado sai em português | planejamento aprovado |
| 4 | Moeda, medidas (m²/sq ft), telefone (DDI), fuso, busca de endereço | Média | Formatos vêm do país da empresa | roadmap |
| 5 | LGPD, CCPA e privacidade: base legal do lead por DM/comentário, apagar lead, prazo de guarda, Política com Telegram e endereço/foro reais, versão EUA | Revisão especializada | Definido com advogado; LGPD e CCPA tratados separadamente | roadmap |
| 6 | Erros do servidor traduzidos | Acabamento | Erros por código, texto no idioma da tela | roadmap |

- **Ficha EUA:** sem comercialização antes da revisão de advogado nos EUA (Fair Housing no desenho, não só lista de palavras).
- **A.6** (2 funções do agente de conteúdo) segue separada, só contas de teste.

## Ordem aprovada (dono, 2026-11-06) — o núcleo funcionando de verdade, depois telas, depois Telegram

> **Esta seção manda.** As seções abaixo ("Foco atual" de 01/11, P0–P4 etc.) ficam como histórico e contexto.
> Onde divergirem desta ordem, vale esta. O motivo e o restante estão em [DECISIONS.md](../DECISIONS.md).

**Regras de trabalho (dono):**
- Etapas pequenas, cada uma com uma entrega verificável.
- Antes de cada etapa: objetivo, escopo, riscos e critério de pronto. **Autorização do dono antes de começar.**
- Não misturar correção necessária com melhoria opcional. Nenhuma frente nova sem mostrar por que é necessária.
- Preservar os dados e o comportamento atual.
- Registrar nos docs as decisões, os testes, os custos, as falhas e os resultados.
- Bloqueio = explicar e propor solução. Nunca contornar uma proteção.
- **Etapa só conta como concluída com o critério de pronto comprovado.** Código juntado ou publicado não basta.
- A tela mostra só o estado real do sistema, nunca estado fictício.
- Nada vai ao público sem o clique do dono, nem em conta de teste.
- **@getsaleboost não pode ser usado em teste de publicação sem autorização específica do dono.**

### 0. Diagnóstico com mais de uma resposta — ✅ concluído em 06/11
- **Entrega:** PR #117 juntado; site publicado (automático no merge, ver PITFALLS "Juntar o PR é publicar"); ficha `imoveis_rio` aplicada (`20261106130000_diagnostico_multipla.sql`).
- **Comprovado no site real** (getsaleboost.com), no celular e no computador:
  - marcar e desmarcar;
  - limite de 3, com o aviso;
  - "E depois disso?" sem a prioridade principal;
  - em Configurações da Teste Zero, com as gravações bloqueadas: resposta antiga preservada, salvar, editar e remover.
- **Banco:** conferido que a Teste Zero não mudou.

### Frente B — Piloto com imobiliária (em paralelo ao bloco 1; dono, 2026-11-07)
| # | Etapa | Pronto quando (comprovado) | Depende de |
|---|---|---|---|
| B.1 | Kit do piloto ([PILOTO.md](../PILOTO.md)) | Kit revisado pelo dono | — |
| B.2 | Imobiliária parceira conquistada | Nome, bairros, imóveis com foto real e quem atende | **dono** |
| B.3 | Configuração: cadastro normal, imóveis, Instagram como testador da Meta | Conta pronta e 1ª rodada de mercado e oportunidades conferida | B.2 e 1.3 publicada |
| B.4 | 4 semanas de acompanhamento | **1 oportunidade real seguida do início ao fim** (com resultado registrado, mesmo que "nada") e o registro semanal em `docs/relatorios/` | B.3 |

> 1.2 (relatório da fila antiga): ✅ entregue em 07/11 ([relatorios/fila-antiga-2026-11-07.md](../relatorios/fila-antiga-2026-11-07.md)). A limpeza espera a 2ª autorização do dono.

### 1. Núcleo: fases e testes
| # | Etapa | Pronto quando (comprovado) | Depende de |
|---|---|---|---|
| 1.1 | **Correção 3 do Opportunity Engine** (PR isolado, sem deploy, sem migration, sem dado): oportunidade aberta equivalente é atualizada, nunca duplicada (tipo + imóveis + sinal, **nunca o título**; evidência nova não apaga evidência antiga mais forte); tarefa única para vários imóveis com a mesma ação, acompanhável por imóvel; trava de "sem presença nas redes / invisíveis / parados / sem divulgação" (com Instagram desconectado, nunca afirmar ausência de posts). | Testes dos 6 casos do dono passam, inclusive "duas oportunidades diferentes continuam separadas"; build ok; PR aberto. | — |
| 1.2 | **Relatório da fila antiga** (só leitura, Teste Zero e Tespon): total, duplicadas, inválidas pelas regras antigas, as que ficam, id e motivo de cada uma. | Relatório entregue. **Limpeza só com a 2ª autorização do dono.** | 1.1 |
| 1.3 | **Fechar a Fase 2:** publicar a `marketing-ai` com a Correção 3 e rodar as contas de teste. | Todas as oportunidades passam nos 5 critérios (evidência, relevância, conexão, ação, diferenciação); nenhuma duplicada; nenhuma frase sem prova; custo registrado. | 1.1 (1.2 se a fila for limpa) |
| 1.4 | **Processo completo, do início ao fim, na Teste Zero e na Tespon:** coleta → oportunidade → plano → peças → aprovação → publicação → medição. | Cada passo com prova (ids, prints, logs), custo e falhas registrados. Publicação real **só com conta de Instagram de teste** ligada à Teste Zero e o clique do dono. Se não houver conta de teste: parar, documentar e propor alternativa. | 1.3; conta de IG de teste (dono) |
| 1.5 | **Serviços de IA depois da recarga:** estratégia, geração de peças e respostas do Telegram, nas contas de teste. | Uma execução bem-sucedida de cada, com prova e custo; falhas registradas. | — (pode andar junto com 1.4) |
| 1.6 | **Teste final** (`docs/TESTE-FINAL.md`). | Relatório objetivo entregue ao dono. | 1.4, 1.5 |

### 2. Telas (só depois do bloco 1)
| # | Etapa | Pronto quando (comprovado) | Depende de |
|---|---|---|---|
| 2.1 | **PR B — Atividade dentro do sino** (canal único, deduplicação por id, recuperação depois de reconexão, limpeza ao fechar). | QA B com prova: sem duplicadas, 1 canal, canal some ao fechar, evento durante a queda aparece 1 vez. **O PR A já está no ar desde 05/11** (o merge publica). Falta o dono aprovar formalmente o QA A. | Aprovação do QA A |
| 2.2 | **Painel do Marketing AI em Bento** (só reorganiza dados reais, nenhuma métrica nova). | Números batem com o SQL nas 2 contas; carregando, erro e ausência certos; prints de celular e computador. | 2.1 |
| 2.3 | **Fábrica 3D:** parada com estados reais (2.3a — ✅ implementada na C.2, 07/11; C.2.1 (cortina, câmera livre, robôs que mostram a verdade) implementada em 07/11, aguardando QA/merge), depois movimento por evento real (2.3b). Critérios em DECISIONS (seções C a H do plano de 04/11). | 2.3a: estados e selo de maturidade reais, versão 2D, sem desenho contínuo parado. 2.3b: cada evento anima 1 vez, inclusive depois de reconexão. | 2.2 |
| 2.3c | **C.3 da Fábrica: pacotes na esteira por evento real + releitura/tempo real** (conforme a entrada C.2.1 do DECISIONS). | **A FAZER — depois que o dono testar e aprovar a C.2.1 no notebook e no Galaxy A54 (pendente).** | 2.3 |
| 2.3d | **Menu lateral: abas "Imóveis" e "Relatórios" (07/11)** — a aba do catálogo (rótulo vem da ficha: `vocabulary.catalog`, fallback "Catálogo"/"Catalog") abre a mesma página do "+" → Adicionar item (`/dashboard/catalogo`); "Relatórios" (`/dashboard/relatorios`) substitui "Atividades" (relatórios semanal/mensal/anual em destaque + histórico de atividades); `/dashboard/atividades` redireciona. | Implementado em 07/11, aguardando QA/merge. Prints de computador e celular nas contas de teste. | — |
| 2.4 | **Cadastro → Instagram → planos → pagamento.** Começa pelo N1: segurança da conexão do Instagram (`state` assinado e preso ao usuário logado). | N1: teste de ataque com o id de outra empresa recusado. N2 a N5: os 4 casos de QA (sem pagamento, pago, cancelado, chamada direta). **N1 em PR (11/11)**: Instagram, WhatsApp, Anúncios da Meta e Google; falta o teste de ataque no ar depois de publicar. | Decisões do dono: preços, contas antigas, tolerância de atraso |

### 3. Telegram (por último: usa as mesmas regras, estados, filas e permissões das telas)
| # | Etapa | Pronto quando (comprovado) | Depende de |
|---|---|---|---|
| 3.1 | **Corrigir as 6 divergências já documentadas** (ARCHITECTURE, Telegram). | Cada divergência corrigida ou registrada com motivo, com teste. | Bloco 2 |
| 3.2 | **Central de Comando T0:** a matriz de paridade painel × Telegram. | Matriz entregue e aprovada. | 3.1 |
| 3.3 | **T1 em diante:** consultar e aprovar com botão assinado ("aprova o 2" → cartão → ✅). Texto livre nunca aprova. | Por etapa (ver o plano T0–T6). | 3.2 |

### 4. Pedidos do dono para DEPOIS do plano atual (11/11, "não comece ainda")
Ordem do plano atual: Tour virtual (etapas 1–3) → N1 → Boosts. Só depois:

| # | Pedido | Pronto quando |
|---|---|---|
| 4.1 | **Painel principal igual ao print de referência** que o dono vai mandar | Tela igual ao print, só com dado real; prints de celular e computador |
| | *2026-11-11: o print chegou (funil visualizações → interessados → leads qualificados → visitas). Critério atualizado na "Ordem aprovada (2026-11-11 noite)" no topo.* | |
| 4.2 | **Revisão de todas as abas e menus:** cada um ligado ao dado real e ao próximo passo; relatório do fluxo e do que melhorar | Mapa aba → dado → próximo passo, com as divergências corrigidas ou registradas |
| 4.3 | **Telegram ligado de verdade ao painel:** perguntar "como está tudo" e receber só dado real (nada inventado); aprovar posts por lá | Respostas conferidas contra o painel nas contas de teste; aprovação só por botão assinado (texto nunca aprova — regra do plano T0–T6) |
| 4.4 | **Tirar do painel principal o bloco "Painel-resumo ainda sem dado real"** (receita, ROAS e funil, com cadeado e "Ver exemplo") | Bloco fora do Marketing AI; nada mais quebra; prints |

**Pendências do dono que destravam etapas:**
- conta de Instagram de teste profissional, cadastrada como testadora no app da Meta (1.4);
- aprovação formal do QA A (2.1);
- preços e planos, contas antigas e tolerância de atraso (2.4);
- trocar as senhas da Teste Zero e da Tespon depois dos testes.

## Foco atual (dono, 2026-11-01) — qualidade antes do 1º cliente

> **Histórico (substituído pela "Ordem aprovada" de 2026-11-06, acima).**

> As prioridades P0–P4 abaixo continuam valendo; este é o trabalho em andamento agora.

- [ ] **PR A — tour virtual:** foto por nota (não sorteio), tipos 1 cômodo / 2 cômodos / abertura, 9:16 com
  encerramento de marca por código, legenda que diz que é animação de foto real, 1 tour por imóvel por semana.
  Em teste/correção (2026-11-02).
- [ ] **PR B — carrosséis:** trava de afirmação de mercado em toda peça do calendário, capa-gancho (nunca índice),
  oferta com capa de foto + faixa de dados (até 7 slides), "3 coisas perto" no sistema de slides, sem tema repetido.
  Em teste (2026-11-02).
- [ ] **PR C — validação do zero:** conta "Teste Zero Imóveis" criada pelo cadastro normal (2 imóveis do Leblon,
  5 fotos cada, sem logo). Depois do deploy de A e B: gerar a 1ª semana, dar nota 1–5 a cada peça com prints.
  *Pronto quando:* todas as peças 4+.
- [ ] **Primeira impressão do cliente novo** — achados do cadastro do zero (ver o item no fim deste arquivo).
- [ ] **Preço e pitch** — ideia de 3 planos em dólar, não decidida ([pitch/PITCH.md](../../pitch/PITCH.md)).
- **Adiado pelo dono:** fechar o ciclo publicar → medir → aprender; juntar estratégia com notícias/oportunidades;
  fluxo de Resultados (código parado na branch `results-flow`, sem QA).

## P0 — Instagram certo conectado

- **Objetivo:** o @ certo conectado, sem duplicidade entre empresas, e um
  carrossel real publicado como prova de que o caminho inteiro funciona.
- **Critério de pronto:** `instagram_username` visível e correto na tela
  de Conexões + 1 carrossel publicado de verdade e gravado em
  `instagram_posts`.
- **Arquivos:** `instagram-oauth-callback`, `agent-actions`,
  `IntegrationsTab.tsx`.
- **Riscos:** publicar em conta errada (mitigado pela proteção contra
  conta duplicada, ver [INSTAGRAM.md](../INSTAGRAM.md)).
- **Alteração arriscada?** Não (publicação já passa por aprovação humana).
- **Status:** código pronto (carrossel + proteção contra duplicidade);
  **depende do dono reconectar** o Instagram de teste — ver
  [INSTAGRAM.md](../INSTAGRAM.md) pro pitfall que já aconteceu 2x. Plano de
  "o que fazer antes da reconexão" rodado pelo agente `product` em
  2026-10-01 (teste do time de agentes) — achou um risco não confirmado
  no formato do carrossel, registrado em
  [PITFALLS.md](../PITFALLS.md#children-do-carrossel-do-instagram--risco-não-confirmado-watch-no-1º-teste-real).

## P1 — Conversão

- **Objetivo:** comentário/DM vira rascunho de resposta pela IA lendo a
  ficha, aprovado pelo dono, vira lead com origem rastreada.
- **Critério de pronto:** um comentário "VISITA" de teste vira rascunho
  (lendo `dm_qualification` da ficha) → aprovado → enviado → lead criado
  com `source_post_id`/`source_item_id`/`source_pillar` preenchidos.
- **Arquivos:** `instagram-webhook`, `leads`, `lead_messages`,
  `engagement_automations`.
- **Riscos:** responder fora da janela de tempo da Meta (mitigado — ver
  [CONVERSION.md](../CONVERSION.md)); IA inventar dado do imóvel (mitigado —
  regra explícita de nunca inventar, cair pra "vou confirmar e te
  retorno").
- **Alteração arriscada?** Não diretamente (sempre `PENDING`), mas toca
  `instagram-webhook`, que está na lista de functions sensíveis — testar
  só em empresa de teste antes de qualquer deploy.
- **Status:** ver [CONVERSION.md](../CONVERSION.md) pro estado real,
  atualizado com mais frequência que este roadmap.

## P2 — Medição + aprendizado

- **Objetivo:** 80/20 de verdade alimentando o calendário e os briefs, +
  relatório semanal simples pro corretor.
- **Critério de pronto:** ver [LEARNING.md](../LEARNING.md).
- **Status:** 🟡 parcial — o loop de engajamento/alcance já realimenta a
  estratégia; 80/20 determinístico e relatório semanal não existem ainda.
- **P2 parte 1 (em código, aguardando migration + deploy):** cálculo 80/20
  determinístico (`_shared/learning.ts`) + `posts.pillar/recipe/format/item_id`.
  Falta: ligar ao calendário/briefs (parte 2) e relatório semanal.

## P3 — Higgsfield (Motor de Mídia)

- **Objetivo:** fotos do catálogo + brief da estratégia → tour virtual
  (carrossel de vídeos) + criativos de anúncio → rascunho → aprovação →
  Instagram.
- **Critério de pronto:** ver [MEDIA-ENGINE.md](../MEDIA-ENGINE.md).
- **Alteração arriscada?** Sim — gasto novo com provedor pago
  (`HIGGSFIELD_API_KEY`), precisa de aprovação prévia do dono antes de
  qualquer chamada real que gaste crédito.
- **Status:** ❌ não começado. (Atualização 2026-10-08: 🟡 o tour grátis de 6
  fotos — Kling + Reel único — funciona no ensaio; os 12 tours/mês do plano
  ainda não existem. Ver [DECISIONS.md](../DECISIONS.md).) (Atualização
  2026-10-12: 🟡 acabamento dos vídeos na VPS (vídeo em pé, fusão, capa)
  pronto e testado no ensaio, aguardando aprovação do dono; ver
  [MEDIA-ENGINE.md](../MEDIA-ENGINE.md#estúdio-de-vídeo-na-vps-2026-10-12).)
- **Ordem de construção dos formatos (aprovada 2026-10-09, mapa em
  [CONTENT-INTELLIGENCE.md](../CONTENT-INTELLIGENCE.md)):**
  1. **Base do tour:** tour do plano (todos os ambientes, sem repetidas) +
     ordem automática + tela do corretor aprovar a ordem + recortes. Pronto
     quando: imóvel com ~20 ambientes vira tour completo e 3+ recortes, sem
     passagem que o corretor reprove.
  2. **Pacote e semana:** ficha nova (receitas acima), kit amostra do
     grátis, close de 5 s, "isso ou aquilo", educativo/trend, Stories com
     recorte.
  3. **Conversa:** "Comente TOUR" → DM com o tour (mexe em
     `instagram-webhook`, função de cliente — pede aprovação) +
     cartões-postais do bairro.
  4. **Rosto e prova:** avatar do corretor (fornecedor + autorização) e
     "Vendido!".
- **Próximo (decisão do dono 2026-10-08): ordem automática do tour.** O
  sistema olha as fotos, reconhece o cômodo de cada uma e o que aparece
  pelas portas (ex.: a sala vista da entrada) e monta a ordem de caminhada
  que passa só entre cômodos vizinhos; a sequência típica do setor fica na
  ficha (regra 6). Critério de pronto: com as 6 fotos do teste, a ordem
  escolhida não gera nenhuma passagem inventada que o dono reprove.
- **Decisões de volume (2026-10-08, ver [DECISIONS.md](../DECISIONS.md)):**
  12 vídeos/mês por cliente pago, espalhados pela estratégia; extra só com
  aprovação do cliente e dado real; 30 vídeos grátis/mês no diagnóstico.
- **Depois do vídeo grátis — posts de bairro:** OpenStreetMap (lugares
  perto + distância real) → foto da Wikimedia Commons (licença livre,
  crédito) → post de FOTO (sem vídeo) → corretor aprova; pode subir fotos
  próprias do bairro. Critério de pronto: imóvel com endereço gera ao
  menos 1 sugestão de post de bairro com distância real e foto com
  crédito, sem nenhuma imagem gerada por IA do lugar.

## P4 — Infra de autonomia

- **Objetivo:** ambiente de ensaio (banco de teste + prévia do site), PR +
  checagens automáticas (GitHub Actions), deploy automático depois da
  aprovação do dono.
- **Critério de pronto:** um agente consegue propor uma mudança, ela roda
  num ambiente isolado, o dono aprova o PR, e o deploy acontece sozinho.
- ~~**Até este item existir, agentes NÃO rodam sozinhos sem o dono
  acompanhar**~~ — substituído em 2026-10-02 pelo modo autônomo (só PR,
  nunca merge), ver [ORCHESTRATION.md](ORCHESTRATION-ate-2026-11-12.md#modo-autônomo-rotina-agendada)
  e [DECISIONS.md](../DECISIONS.md).
- **Status:** 🟡 em andamento.
  - [x] Deploy automático depois do merge — já existia
        (`.github/workflows/deploy.yml`). **Mudou em 2026-10-02:** o
        `deploy.yml` falhava em todo merge desde pelo menos 30/09 (token
        da Cloudflare restrito por IP) e foi removido por decisão do dono;
        quem publica o site é a integração Git da própria Cloudflare
        (Workers Builds, worker `sales-boost-restaurants`) — ver
        [PITFALLS.md](../PITFALLS.md#deploy-do-site-é-a-cloudflare-não-o-github).
  - [x] Checagem automática em todo PR (`.github/workflows/pr-checks.yml`,
        roda `npm run build` e, desde 2026-10-02, `npm run lint`).
  - [x] **Dono:** proteger o `main` no GitHub (exigir PR + checagem verde
        + aprovação do dono antes do merge).
  - [x] Projeto Supabase de ensaio criado (`salesboost-ensaio`, ref
        `ybmevrsijsayllgcxxeb`, plano grátis, 2026-10-02).
  - [x] **Schema** de produção copiado pro ensaio (só estrutura, zero
        dados) — 2026-10-02, sessão supervisionada. Lido direto do banco
        real (não de `supabase/migrations/`, ver
        [PITFALLS.md](../PITFALLS.md#deriva-de-migrations-vs-banco-real)):
        120 tabelas, 326 constraints, 221 índices, 171 policies de RLS (RLS
        ligado nas 120), 5 funções, 3 triggers, bucket `post-images` + 6
        policies de storage. Conferido por "impressão digital" (md5 da
        estrutura) — idêntico à produção. **Diferenças de propósito:** sem
        `pg_cron` e sem nenhum cron (produção tem 21), e
        `notify_hermes_new_lead()` virou função vazia — ver
        [PITFALLS.md](../PITFALLS.md#migrations-com-cron-apontam-pra-produção).
        Tabelas de catálogo/configuração copiadas em seguida (mesmo dia,
        conferidas por md5 linha a linha — idênticas): `vertical_playbooks`,
        `business_types`, `capability_registry`, `marketing_ai_tool_registry`,
        `agent_roles`, `hermes_config`, `feature_flags`, `api_providers`,
        `insight_sources`, `integration_catalog`, `plan_ai_defaults`,
        `platform_services`, `progress_gp_rules/levels/pins/rewards`,
        `report_config`, `telegram_agent_config`, `telegram_bots`,
        `prospect_search_keywords` e a base global de
        `marketing_ai_knowledge` (`company_id IS NULL`, 100 itens).
        `monitor_config` copiada **sem** o chat do Telegram do admin
        (alertas desligados). **Não copiadas de propósito:** `app_config` e
        `_app_config` (guardam segredos: `cron_secret`, chaves de API) e
        qualquer tabela com dado de cliente.
  - [ ] Quando o schema de produção mudar, repetir a cópia/ajuste no
        ensaio (hoje é manual). Conferência de sincronia em 2026-10-02:
        **idêntico** (120 tabelas, 171 policies; md5 de colunas,
        constraints, índices e policies iguais nos dois). Regra: todo PR
        que muda a estrutura do banco aplica a mesma mudança no ensaio no
        mesmo PR; depois do merge, o agente aplica o mesmo SQL em
        produção (ver [ORCHESTRATION.md](ORCHESTRATION-ate-2026-11-12.md#banco-de-produção-depois-do-pr-aprovado));
        a conferência por md5 (consulta abaixo) roda antes e depois de
        aplicar cada mudança de schema (fora disso, a rotina autônoma não
        lê produção). Custo: só leitura de estrutura, de graça
        no Supabase e poucos tokens.
        ```sql
        select
         (select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE') as tabelas,
         (select md5(string_agg(table_name||'.'||column_name||':'||data_type||':'||is_nullable||':'||coalesce(column_default,''), '|' order by table_name,column_name)) from information_schema.columns where table_schema='public') as colunas,
         (select md5(string_agg(conrelid::regclass||':'||conname||':'||pg_get_constraintdef(oid), '|' order by conrelid::regclass::text,conname)) from pg_constraint where connamespace='public'::regnamespace) as constraints,
         (select md5(string_agg(indexdef, '|' order by indexname)) from pg_indexes where schemaname='public') as indices,
         (select md5(string_agg(tablename||':'||policyname||':'||cmd||':'||coalesce(qual,'')||':'||coalesce(with_check,''), '|' order by tablename,policyname)) from pg_policies where schemaname='public') as policies;
        ```
  - [x] Chaves do **ensaio** no ambiente do Claude Code (2026-10-02):
        `SUPABASE_ENSAIO_URL`, `SUPABASE_ENSAIO_ANON_KEY` (role `anon`),
        `SUPABASE_ENSAIO_SERVICE_ROLE_KEY` (role `service_role`) — todas
        com ref `ybmevrsijsayllgcxxeb`, nenhuma de produção. Testadas: as
        duas leem `vertical_playbooks` (2 fichas).
  - [x] Rotinas agendadas (seg/qua/sex de manhã + relatório sexta 18h).
  - [x] Consertar o `npm run lint` e incluir no `pr-checks.yml`
        (2026-10-02): `tsconfigRootDir` definido, `frontend/` (projeto
        antigo separado) ignorado. Sobraram 172 achados antigos, rebaixados
        pra aviso em `eslint.config.js` (só erro trava o PR).
  - [ ] Pagar a dívida de lint aos poucos e voltar as regras pra erro —
        principalmente `react-hooks/*` e as edge functions
        (`supabase/functions`, mexer = deploy arriscado).

## Próximas etapas pedidas pelo dono (2026-10-06, nesta ordem)

1. **Pendências com bolinha vermelha** — ícone com contador de pendências
   reais (aprovações, Instagram desconectado, item sem foto, dado da ficha
   faltando); cada item leva direto à tela/campo certo e some quando
   resolvido. Só tela + leitura.
   **FEITO (2026-10-06, só no branch local, sem deploy):** sino no layout
   (`src/lib/usePendencias.ts` + `PendenciasBell.tsx`). Fontes: aprovações
   (agent_actions PENDING + marketing_ai_content idea/draft, mesma fila da
   ApprovalsPage), Instagram (não conectado / vencido / vence em ≤7 dias),
   fotos abaixo do mínimo por item do catálogo, perguntas da ficha sem
   resposta, Telegram não conectado (baixa prioridade, não conta na
   bolinha). Vault ficou de fora por decisão do dono. Tela e código andam
   juntos: ainda falta publicar o site e conferir no celular/desktop.
2. **Fim do onboarding com dados e conectores** — frase "Esse é o momento
   importante de alimentar os dados reais — depois é só relaxar!".
   Obrigatório: dados do negócio, perguntas da ficha e 1 item com fotos.
   Instagram em destaque, mas com "conectar depois" (vira pendência do
   item 1) até o App Review da Meta sair; depois passa a obrigatório.
   **FEITO (2026-10-06, em PR, só frontend, sem migration/deploy de
   function):** tela `/setup` (`src/pages/setup/`), hook
   `src/lib/useSetupStatus.ts`, regras compartilhadas com o sino em
   `src/lib/setupRules.ts`, gate em `ClientRoute` (`src/lib/setupGate.ts`).
   Ainda falta: publicar o site e conferir no celular. Ver
   [DECISIONS.md](../DECISIONS.md).
2b. **Growth Qualification** (próxima, antes do Plano da semana) —
   diagnóstico com score (Growth Score), acesso grátis (1 vídeo + 1
   estratégia, sem prazo em dias), popup "seu acesso grátis começou",
   popup do cupom depois do 1º vídeo (cupom com prazo real de 7 dias a
   partir da entrega da estratégia — ajustado em 10-07: conta de quando o cliente VÊ o popup), preço novo (R$2.449 mensal; R$1.449
   anual/cupom de 1º mês — Stripe precisa de 3 itens novos, aprovação do
   dono) e Business Game pra retenção. Decisão registrada em
   [DECISIONS.md](../DECISIONS.md) (2026-10-06, 2026-10-07 e **2026-10-08**).
   **Ajuste de 2026-10-08:** o acesso grátis é **diagnóstico + 1 vídeo**
   (NÃO inclui estratégia — onde este item diz "1 estratégia", leia como
   histórico); a estratégia só nasce depois do pagamento. A landing agora
   tem a seção final `#diagnostico` com perguntas e resultado inline
   (`DiagnosticFlow` em `OnboardingPage.tsx`, `DiagnosticResult` em
   `DiagnosticoPage.tsx`; rotas `/onboarding` e `/diagnostico/:id`
   continuam). **Pendências:** (1) `claim-diagnostic` foi alterado no
   código (parou de disparar `strategy-generate`) e **precisa de deploy
   aprovado pelo dono** (function de cliente real); (2) o `stripe-webhook`
   (PR do pagamento) deve **disparar a 1ª estratégia ao confirmar o
   pagamento** — até isso entrar, conta nova não recebe estratégia sozinha;
   (3) publicar o site e conferir a landing no celular (375px). Fatias:
   - **Fatia 1 — Growth Score (código pronto, falta aplicar migration
     `20261007120000_diagnostics_instagram_data.sql` e deployar
     `run-diagnosis`):** nota centrada no Instagram via scraper, site/Google
     como adendo, "Análise parcial", tela do diagnóstico nova, onboarding
     exigindo Instagram e site opcional.
   - **Fatia 2 — Acesso grátis na tela:** textos/popup "seu acesso grátis
     começou", remover o `TrialStartModal` (mostra R$14,49, preço errado) e
     travar os botões de IA só pra contas novas grátis que já usaram a
     estratégia.
   - **Fatia 3 — Corte de IA no servidor (ARRISCADA):** functions de IA
     recusam conta grátis que já gastou a cota. Mexe em functions de
     cliente real; exige aprovação antes do deploy.
     **Status 2026-10-13: código pronto (PR do modo vitrine), SEM deploy.** Virou
     `_shared/access.ts` (`requirePaidAccess`): conta nova sem plano toma 402
     `plan_required` — em vez de "cota gasta", é "não pagou". Falta: aprovar e
     deployar as functions listadas em PITFALLS.md (as de cliente real
     `agent-actions`, `strategy-generate`, `creative-generate` pedem aprovação).
   - **Fatia 4 — Stripe:** preço mensal R$2.449, anual R$1.449 (fidelidade
     12 meses, cláusula no checkout, validar com advogado), cupom de 1º mês.
     Exige aprovação do dono. **Status 2026-10-08: código pronto em PR
     (branch `stripe-4`), NADA deployado nem aplicado.** Falta: aprovar/mesclar,
     aplicar a migration `20261008100000_billing_plans.sql` ANTES de publicar o
     site e as functions `create-checkout`, `stripe-webhook`,
     `owner-company-activity`, e criar os itens no Stripe de PRODUÇÃO (hoje só
     existem no sandbox). Popup que grava `coupon_offer_shown_at` = fatia 5.
   - **Fatia 5 — Vídeo/Higgsfield + popup do cupom:** 1 vídeo real no
     acesso grátis; popup do cupom, com prazo de 7 dias contado de quando o
     cliente vê o popup. Só então a promessa pública inclui "+1 vídeo".
3. **Plano da semana** — no Calendário da Semana existente: quantos posts,
   de que tipo (vídeo/carrossel/bastidor), sobre qual item e por quê,
   calculado por fotos disponíveis, ritmo de aprovação do dono, 80/20,
   regras da ficha e teto de vídeos. Corrige a divergência tela × código
   registrada em [CONTENT-INTELLIGENCE.md](../CONTENT-INTELLIGENCE.md).
   Mexe em `creative-generate` (deploy precisa de aprovação). Decisão do
   dono pendente: teto de vídeos por semana no plano de R$1.449.

## Fora do código (depende do dono, nenhum agente resolve sozinho)

- App Review / verificação da Meta (desbloqueia contas não-testadoras no
  Instagram).
- 2-3 corretores piloto reais.
- Conta Higgsfield (credenciais + orçamento aprovado).
- Decisão final do modelo de cobrança (ver [PRODUCT.md](../PRODUCT.md)).

## Itens do roadmap anterior (pré-reorganização dos docs, 2026-10-01)

Preservados aqui pra não perder nada — reconciliar com P0-P4 acima
conforme forem retomados:

- [x] Agente-chat MVP, Fase 2 (rate limiting), Fase 3 (Revenue
      Opportunities), Jarvis MVP, Stripe checkout+webhook — todos
      concluídos antes desta reorganização.
- [ ] **Fase 4 (antiga):** Integrações de canal reais — GBP e Instagram já
      funcionam; falta WhatsApp e E-mail. Mapeia pra fora do escopo atual
      (ficha `imoveis_rio` é só Instagram, ver
      [DECISIONS.md](../DECISIONS.md)) — retomar quando um setor/cliente
      precisar de WhatsApp/E-mail de verdade.
- [ ] **Fase 5 (antiga):** Botão "Resolver tudo" (fila de ações em lote
      com aprovação) — ainda não construído, relacionado mas não
      idêntico ao P1 (Conversão) acima.
- [x] ~~Jarvis Fase 2 (multi-agente, 7 papéis)~~ — revertido, hoje 1
      agente só (ver [ARCHITECTURE.md](../ARCHITECTURE.md), seção Jarvis).
- [ ] Jarvis Fase 3 (modo "reunião", CEO orquestra vários agentes) —
      avaliar se ainda faz sentido dado que o produto caiu pra 1 agente.
- [ ] Jarvis 24/7 (crons/webhooks pros agentes rodarem sozinhos) —
      parcialmente coberto pelo "Ciclo autônomo" já existente (ver
      [ARCHITECTURE.md](../ARCHITECTURE.md)).
- [ ] Onboarding self-service com relatório demo em 24h.
- [ ] Definir e instrumentar modelo de cobrança final — ver
      [PRODUCT.md](../PRODUCT.md).
- [ ] Automação de deploy (GitHub Actions) — isso É o P4 acima, mantido
      também aqui pra cross-reference.

## Divergências registradas (etapa 1, pendências)

- **HermesGapsPanel × `usePendencias`:** `HermesGapsPanel.tsx` calcula
  "lacunas" com condições mais fracas (ex.: só checa se há alguma resposta/
  foto). O sino usa condições exatas e independentes: foto abaixo do
  mínimo da ficha por item, cada pergunta da ficha sem resposta, validade
  do token do Instagram. Os dois podem discordar; o sino é a fonte de
  verdade pro dono. Unificar é trabalho futuro.
- **`CatalogItems` agora adiciona fotos a item já existente** (botão
  "＋ Adicionar fotos" no card; antes só dava pra subir fotos na criação).
  Atualiza `meta.photos` e `image_url` (se vazio). O card mostra "N/min
  fotos". Aceita `focusItemId` (vindo do sino via evento global
  `sb:open-add`, ouvido por `BusinessContextButton`).
- `useRealtime` ganhou opções `key` (evita colisão de canal com a
  ApprovalsPage na mesma tabela) e `column` (em `companies` a chave é `id`).

## Pedidos do dono (2026-10-12) — próximas frentes

Ainda sem ordem de prioridade fechada. Cada item vira um plano com critério
de pronto antes de começar.

1. **App Review da Meta:** pedir a aprovação do app (roteiro em
   [META-APP-REVIEW.md](../META-APP-REVIEW.md)). Destrava Instagram obrigatório
   no onboarding e publicação em conta de cliente sem modo de teste.
2. **TikTok:** canal novo com **estratégia própria pra esse canal**, não um
   repost do Instagram (formato, gancho, frequência e métricas do TikTok).
   Precisa de conexão oficial (API do TikTok) e de aprovação do app deles.
3. **Novos setores:** e-commerces e lojas de casa (housing/decor stores).
   Pela regra 6, entram como **ficha nova** em `vertical_playbooks`, nunca
   como código de setor. O site já mostra "Em breve" pra eles.
4. **Modelo de negócio (ideias do dono):**
   - **Desconto por divulgação:** o cliente faz 1 post do Sales Boost no
     feed da empresa e ganha desconto. A regra 1 vale: o post só sai com a
     aprovação do cliente.
   - **Comunidade de influenciadores** do setor.
   - **Ofertas dentro do território:** workshops, comunidade e conteúdo
     gratuito.
5. **UGC pela Higgsfield (em breve):** vídeos no estilo "gente de verdade
   falando", de preferência o **próprio corretor** (com autorização
   explícita, ver "Avatar do corretor" em [MEDIA-ENGINE.md](../MEDIA-ENGINE.md))
   ou um criador de UGC. Gasto novo com provedor: precisa de aprovação.
6. **Vídeo institucional do Sales Boost:** vídeo curto feito com IA
   (estilo apresentação animada) explicando quem somos, porque confiança
   pesa muito nesse setor. Pode ir na landing, no diagnóstico e no
   Instagram do Sales Boost. Regra 4: texto só pelo `render-format`/legenda,
   nunca escrito pela IA de vídeo.
7. **Telegram como "amigo":** avisos quando acontece algo importante
   (lead novo, post que foi bem, algo esperando aprovação) e, se o dono
   aprovar o plano, **aprovar pelo Telegram** com botão. Mexe em função que
   publica, então precisa de aprovação antes.
   - *Feito (2026-10-12, PR próprio):* aprovação pendente (com botão),
     post novo no Vault (com botão Publicar) e lead novo. Opt-in em
     Configurações → Notificações → "Telegram amigo".
   - *Falta:* "post que foi bem" — depende de comparar métricas reais do
     Instagram com a média da própria conta (nunca número inventado);
     entra quando o aprendizado ([LEARNING.md](../LEARNING.md)) tiver essa média pronta.

## Agente de Dados ampliado (pedido do dono 2026-10-14) — em etapas

Cada etapa vira um PR próprio, com plano aprovado antes. Tudo que é de setor
(categorias, perguntas, temas) vive na ficha (`vertical_playbooks`, regra 6).
Os posts que nascem daqui seguem a regra 1: só saem com aprovação do dono.

1. **Lugares e Programas Próximos.** Busca uma vez por imóvel no
   OpenStreetMap (grátis), guarda o resultado; distância calculada em linha
   reta a partir das coordenadas (nunca inventada, regra 5). Vira assunto de
   post ("o que tem a 5 min deste imóvel").
   - *Feito (2026-10-14, PR próprio):* sub-aba "📍 Lugares perto" no Agente
     de Dados (`NearbyPlaces.tsx` → function `nearby-places` →
     `_shared/nearbyPlaces.ts`); campo opcional "Endereço" (marcado
     `private` na ficha, nunca vai pra legenda); o "3 coisas perto" do
     calendário vira carrossel com card dos lugares reais + capa real. Sem
     endereço, a busca parte do centro do bairro e o post não cita distância.
2. **Dicas e FAQ** (jurídico, financiamento, documentação). Aprovação pela
   IA, como decidido em [DECISIONS.md](../DECISIONS.md) (2026-10-14):
   - dica geral, sem número nem regra → aprovada sozinha;
   - dica com número, prazo, taxa ou regra → a IA confere na web (Tavily)
     só em fonte oficial (gov.br, Receita, Banco Central, Caixa, cartórios,
     leis). Confirmou ou corrigiu → selo "✓ Conferida pela IA em [data],
     fonte: [link]". Não achou fonte oficial → fica "precisa revisar" e só
     entra com aprovação de uma pessoa;
   - reconfere a cada 60 dias (lei e taxa mudam);
   - critério de pronto: nenhuma dica com número aparece em post sem selo
     ou aprovação humana; o selo mostra data e link de verdade.
   - *Feito (2026-10-15, mesmo PR da etapa 1):* sub-aba "❓ Dicas e FAQ"
     (`FaqTips.tsx` → function `nearby-places` com `area: 'faq'` →
     `_shared/faqHandler.ts` + `_shared/faqCheck.ts`; a function `faq-agent`
     do PR original não pôde ser criada, ver PITFALLS), dados em
     `marketing_ai_knowledge` (module `dados`, kind `faq`). Vaga semanal
     `dica_faq` no calendário (card de pergunta e resposta do render-format)
     usa só dica liberada; sem dica liberada, vira carrossel de slides com
     dica geral sem número. Reconferência sem agendamento novo: quando o dono
     abre a aba e antes de a dica ir pro calendário.
3. **Prova Social + Histórias de sucesso.** Entrada manual (depoimento,
   imóvel vendido) até o app da Meta ser aprovado; cada item com status de
   autorização do cliente antes de virar post.

## Criativos — fase 3 (rótulo + intenção da estratégia nas peças) — 2026-10-22

- **Status:** 🟡 em código no branch `claude/nifty-shannon-ysp818`, aguardando
  aprovação do dono pra aplicar a migration
  `20261022150000_rotulos_familia_pilar_ss.sql` e deployar `strategy-generate`,
  `creative-generate` e `catalog-package` (alteração arriscada). Depois, rodar a
  semana de teste no banco de ensaio. Detalhes: [PLANO-CRIATIVOS.md](../PLANO-CRIATIVOS.md).
- **Falta fora deste PR:** `agent-actions` copiar `familia`/`pilar_ss` para
  `posts` na publicação (sem isso o rótulo se perde ao publicar).
  - **Atualização 2026-10-23:** o código do `agent-actions` já copia (bloco à parte,
    tolerante) — falta o deploy (função de cliente real: pede "pode"). Ainda falta o
    `learning.ts` agrupar por `familia`/`pilar_ss`.
- **Correções pós-fase 3 (2026-10-23):** 🟡 em código, sem deploy: logo em PNG transparente
  (migration `20261023120000_brand_dna_logo_meta.sql`, `brand-kit-suggest`, `render-format`, tela do
  Kit), rótulos na publicação (`agent-actions`) e legenda sem recado pro corretor (`catalog-package`).
  Detalhes e o que depende de aprovação: [PLANO-CRIATIVOS.md](../PLANO-CRIATIVOS.md#correções-pós-fase-3-2026-10-23).
- **Próximas:** fase 2 (carrossel educativo com fonte, decisão C), 7, 6, 4, 5.
- **Fase 2 (decisão C) — 🟡 em código, sem deploy nem migration (2026-10-26):** `carrossel_slides` e
  `carrossel_educativo` viram um formato só. Tema regulado (jurídico, financiamento, documentação,
  impostos) usa só dica liberada do `dica_faq`; sem dica liberada sai como dica geral sem número, prazo,
  taxa nem lei; tema leve segue livre com a trava de números. Depende da migration
  `20261026120000_carrossel_educativo_unico.sql` (o merge aprova) e do deploy do `creative-generate`
  (`--no-verify-jwt`). Detalhes: [PLANO-CRIATIVOS.md](../PLANO-CRIATIVOS.md#fase-2-decisão-c--em-código-2026-10-26).
- **Próximas:** 7, 6, 4, 5 (a fase 2 está em código, aguardando migration e deploy).

## Pedidos do dono (2026-10-20) — próximas frentes

1. **Business Game por imobiliária.** Regra do dono: "todos que estiverem
   atrelados à mesma imobiliária jogarão" o jogo juntos.
   - **Já feito:** a pergunta "A que imobiliária ou grupo imobiliário você
     está ligado(a)?" entrou no diagnóstico, só pra corretor associado
     (migration `20261020090000_onboarding_custos_grupo.sql`).
   - **Falta:**
     - **Ligação confirmada:** a imobiliária tem um código de convite e o
       corretor entra com ele. O texto livre não basta, porque qualquer um
       poderia dizer que é de qualquer imobiliária.
     - **Placar da equipe:** montado no servidor a partir de
       `progress_events`. Mostra só nome, nível e pontos, nunca leads ou
       vendas de outro corretor, e não abre o acesso (RLS) entre contas.
     - **Na tela:** um bloco "Sua equipe" no Business Game.
     - **Aprovação:** é tabela nova e regra de acesso nova, então precisa
       do aviso e do "Posso seguir?".
   - **Critério de pronto:** dois corretores ligados à mesma imobiliária
     se veem no placar, e um corretor de fora não vê.
2. **Inteligência de mercado mais forte.** Melhorar `diagnosis-market` e
   `map-competitors`:
   - ferramentas melhores;
   - mais ângulos de análise de cada concorrente;
   - garantir que os concorrentes encontrados são os reais.

   Ganha um plano próprio.

## Inglês como idioma principal / mercado EUA (decisão do dono 2026-10-27)

Ver [DECISIONS.md](DECISIONS-2026-09-a-10.md#2026-10-27--inglês-como-idioma-principal-mercado-eua-inteiro).

- [x] **Fase 1 — tela e padrão:** inglês como padrão da tela, regra tela por usuário × conteúdo por empresa,
  seletor "Língua da empresa" em Configurações, textos fixos traduzidos, migration `20261027120000_ingles_padrao.sql`
  (aplicar em produção só depois do merge, é aditiva).
- [ ] **Fase 2 — conteúdo gerado em inglês + travas em inglês:** prompts das functions por `companies.language`;
  travas de honestidade (número inventado, "Comente QUERO", recado da IA, carrossel educativo/dicas) funcionando
  em inglês. Critério de pronto: empresa de teste em `'en'` gera legenda, carrossel e vídeo sem uma palavra em PT.
- [ ] **Fase 3 — ficha `real_estate_us`:** vocabulário, perguntas do cadastro, campos do catálogo e regras do
  setor para os EUA (tudo na ficha, nunca em código — regra 6). Depende da revisão jurídica EUA/Fair Housing.
- [ ] **Fase 4 — dólar, fuso, ZIP e termos:** preço em USD (decisão do dono), horário de publicação local (hoje
  18h de Brasília), endereço com ZIP, termos do mercado americano.
- [ ] **Decisões do dono pendentes:** preço em USD; só imóveis ou outros setores; horário local; revisão jurídica
  EUA/Fair Housing; se o Brasil continua como mercado.

## Inteligência comercial (visão 2026-10-28)

Ver [DECISIONS.md](DECISIONS-2026-09-a-10.md#2026-10-28--inteligência-comercial-para-imobiliárias-opportunity-engine) e o bloco
"Opportunity Engine" em [ARCHITECTURE.md](../ARCHITECTURE.md). Regra de evidência em todas as etapas: fato/dado/
hipótese, fonte + data, "precisa validar", nunca número inventado, nada publicado sem aprovação.

- [ ] **Etapa 1 — motor + tela de oportunidades (este PR; 🟡 até teste em produção).** `run_opportunities` no
  `marketing-ai`, tabelas `market_signals`/`growth_opportunities`, tela `/dashboard/opportunities`. *Pronto
  quando:* migration aplicada, `marketing-ai` deployado, e na Tespon (1 imóvel, 8 concorrentes, 0 posts) o botão
  devolve ≥1 oportunidade com evidência rotulada e fonte/data, ou diz o que falta — sem número inventado e sem
  nada publicado; aprovar/descartar grava o status.
- [ ] **Etapa 2 — colar sinal de mercado à mão (🟡 código pronto no PR; falta teste em produção).** Tela para o cliente colar notícia/lançamento/obra (título,
  região, fonte, link, data) em `market_signals` (`collected_by='manual'`). *Pronto quando:* um sinal colado com
  fonte aparece como "Dado" numa oportunidade `market_change` do bairro certo; sem fonte, não entra.
- [ ] **Inteligência de Mercado ampla, estágios 1-3 (🟡 código pronto no branch `mi-stage1-3`, 2026-11-01):** teto US$ 5/cliente/mês (Apify+Tavily) dentro dos US$ 40, notícias diárias por tópicos da ficha (`cron_market_intel`), aba "Mercado" em Dados. Falta: migration `20261101100000_inteligencia_mercado_ficha.sql`, deploy do `marketing-ai`, cron `market-intel-daily`, confirmar `TAVILY_COST_USD`. Estágio 4+ (Instagram semanal) não iniciado. Substitui a coleta semanal da Etapa 3 abaixo.
- [ ] **Etapa 3 — notícias automáticas (🟡 pronta em código, 2026-10-30; falta migration + deploy do `marketing-ai` e teste em produção).**
  Coleta sozinha (Tavily, `topic:'news'`, sem botão) as notícias da região dos imóveis e grava em `market_signals` com
  `collected_by='system'`, fonte e data. Limites: 3 buscas e 5 sinais novos por empresa por 7 dias; teto global
  `MARKET_NEWS_MONTHLY_CAP` (padrão 120 buscas/30 dias). *Pronto quando:* a coleta respeita o teto, cada sinal tem fonte
  + data, e o sinal novo faz aparecer a oportunidade `market_change`. **Divergência:** o critério original dizia "o dono
  aprova/descarta antes de virar evidência" — o sinal entra direto como "Dado" (selo "Automático", o dono pode apagar) e a
  aprovação humana fica na **oportunidade** (ver [DECISIONS.md](../DECISIONS.md)).
- [ ] **Etapa 4 — oportunidade aprovada → estratégia → peças.** Ligar `growth_opportunities.strategy_id` ao
  `strategy-generate` e às peças do calendário. **Alteração arriscada** (function de cliente real: aprovação do
  dono antes do deploy). *Pronto quando:* aprovar uma oportunidade gera uma iniciativa de estratégia citando a
  evidência, e as peças continuam passando pela Central de Aprovações.
  - **Divergência (2026-10-29, ver [DECISIONS.md](../DECISIONS.md)):** a Etapa 4 foi dividida e o caminho mudou — o
    texto acima (iniciativa de estratégia ligada ao `strategy_id`, via `strategy-generate`) **não vai ser seguido
    por enquanto**. **4A — plano da oportunidade (🟡 código pronto no PR; falta migration, deploy e teste em
    produção):** aprovar a oportunidade cria sozinho um mini-plano no `marketing-ai` (formato sugerido como
    consequência do objetivo, limite de 5 planos/dia/empresa); o dono aprova o plano. *Pronto quando:* na Tespon,
    aprovar uma oportunidade gera um plano com evidências citadas, sem número inventado e sem "Comente QUERO". **4B —
    gerar as peças a partir do plano aprovado (🟡 pronta em código, 2026-10-29; falta migration `20261029130000`,
    deploy de `marketing-ai`/`creative-generate`/`catalog-package`/`agent-actions` e teste na Tespon):** automático, 1–3
    rascunhos por plano aprovado, só formatos sem custo de vídeo (reel → carrossel; **vídeo fica para quando o dono
    liberar custo de vídeo**), limites 3/plano e 6/empresa/dia, `opportunity_id` na peça e no post. *Pronto quando:* na
    Tespon, aprovar o plano gera as peças na Central de Aprovações com o selo "Da oportunidade", sem repetir ao aprovar
    de novo. As peças continuam passando pela Central de Aprovações. **Etapa 6 poderá medir por `opportunity_id`.**
  - **Tudo automático (2026-10-29):** a Etapa 1 **deixou de ter botão manual** "Encontrar oportunidades": a busca roda
    sozinha (`cron_opportunities`, semanal ou com sinal novo). O agendamento ainda **não foi criado** (pendente de
    aprovação do dono).
- [ ] **Etapa 5 — link rastreável, página do imóvel e lead com origem (🟡 código pronto, 2026-10-30; falta migration + deploy do
  `marketing-ai`/`item-videos` + site + teste em produção + o dono aprovar a 1ª página).** Direção decidida: página **só destino de
  link** (sem listagem/busca, `noindex`), só no ar com aprovação do dono; lead da página entra com `item_id`/`opportunity_id`/`link_id`
  e consentimento. **Divergência (registrada, não apagada):** o texto original previa "repasse ao corretor" e mexer no
  `instagram-webhook` — nada disso foi feito (corretor = Etapa 7; DM/comentário seguem sem atribuição). *Pronto quando:* uma visita
  pedida pela página aparece no Funil com a origem (imóvel/oportunidade), o link aparece na legenda de um rascunho de oportunidade e
  nada é enviado ao visitante sem o dono. Ver [ARCHITECTURE.md](../ARCHITECTURE.md) e [CONVERSION.md](../CONVERSION.md).
- [ ] **Etapa 6 — resultados (visitas, propostas, vendas) — 🟡 versão mínima pronta em código (2026-10-30); falta migration + deploy do
  `marketing-ai` + site.** Só com atribuição comprovada (origem registrada); sem atribuição, "sem dado" — nunca estimativa. Feito:
  bloco "Resultados" no card da oportunidade aprovada, datas carimbadas pelo Funil, valor opcional informado pelo dono. *Pronto quando:*
  cada número na tela tem origem rastreável e o que não tem fica "sem dado" (conferir em produção). **Fica para o futuro:** atribuir
  lead de DM/comentário (exige tocar o `instagram-webhook`); receita/CAC/ROAS; mapa de estágios com etapa própria de "visita".
- [ ] **Etapa 7 — equipe de corretores — 🟡 versão mínima pronta em código (2026-10-30): corretor = contato SEM login, rodízio de leads,
  encaminhamento por WhatsApp.** Falta migration + deploy + site. **Fica para o futuro (projeto à parte):** convite, papéis
  (dono/gestor/corretor) e RLS por papel — **arriscado** (autenticação e RLS) — junto com o preço para imobiliária com equipe e o
  domínio de e-mail verificado. *Pronto quando (versão completa):* um corretor convidado vê só o que o papel permite, testado com conta
  sintética, sem tocar dados de cliente real.
- **Etapas 5–7 no ar (2026-10-30):** migrations aplicadas, `marketing-ai` v39 e `item-videos` v9 publicados, teste de ponta a
  ponta na Tespon (dados de teste apagados depois): página do imóvel abriu no celular com 10 fotos reais e só os campos da ficha;
  código inválido → 404 igual; visita contada 1×; clique no WhatsApp foi para a empresa (sem corretor) e, depois do 1º lead, para o
  corretor da vez; 2 leads → 2 corretores diferentes (rodízio); lead repetido não gravou 2×; consentimento e origem gravados. Achado e
  corrigido: o aviso de cookies saía em inglês na página em português (agora segue o idioma da página). **Falta:** o dono aprovar a
  1ª página de um imóvel real dele.
- **Pendentes do dono (não decididos):** preço para imobiliária com equipe (R$ e US$); custo de provedor de
  notícias (Etapa 3); revisão jurídica EUA/Fair Housing.
- [ ] **Faixa de fluxo dos agentes (pedido do dono 2026-11-01)** — 🟡 feita para **Inteligência de Mercado** e **Motor de Oportunidades**
  (código pronto; falta aplicar a migration `20261101200000_company_flow_status.sql` e publicar o site). **Faltam 3 agentes, no mesmo
  formato** (`FlowStrip` + um hook + `flowStripSteps`): Estratégia, Ativação, Resultados e Aprendizado. *Pronto quando:* cada agente mostra
  os passos reais com status/última vez/contagens vindos de dado real, conferidos contra o código da área.
- [ ] **Primeira impressão do cliente novo (achados do cadastro do zero, 2026-11-02)** — conta "Teste Zero Imóveis"
  (`luan26ribeiro+teste3`, Instagram não conectado). ✅ Idioma do conteúdo pelo setor (ver DECISIONS 2026-11-02). **Falta:**
  1. Telas de cadastro sempre em inglês, sem seletor PT/EN (só a home tem); aviso de cookies em inglês; mockup da home com "UNITED STATES".
  2. Palavras em inglês nas telas em PT: "Growth Potential", "Growth Ready", "Social Selling", "GROWTH OS", "Business Progress",
     "Trial de Crescimento", "SDR".
  3. "Hermes" aparece sem explicação (onboarding passo 3, painel, sino, Telegram).
  4. Status do plano contraditório: "Plano Free" + "modo demonstração" + "Trial dia 1 de 7" + "Gratuito — 5 posts/mês" + pop-up de cupom.
  5. **Diagnóstico inventa número** ("ficou 30 dias no mercado e saiu pelo valor pedido") — quebra a regra 5; e "concorrentes fortes"
     com 13/40 seguidores, "7.4%" ao lado de "1.380", "em Rio de Janeiro", tempo estimado diferente em cada tela.
  6. Cadastro de imóvel: sem campo de título; "em Leblon" (deveria "no Leblon"); preço sem separador ("R$ 3000000"); a 1ª foto vira
     capa sem perguntar (a cobertura ficou com a pia do banheiro); campos estreitos cortam o texto.
  7. Respostas do onboarding não aparecem em Configurações (e-mail, objetivo); opções genéricas que não servem pra imóveis ("ticket médio").
  8. Sino: contador 2 com 3 itens; pisca "Tudo em dia"; CRECI "preencher depois" conta como pendente; frequência lida do Instagram some
     com um toque. Perguntas: "(até 3) (até 3)"; caixa de bairros salva texto não adicionado.
  Prints: pasta do teste (sessão de 2026-11-02). *Pronto quando:* um cadastro novo de corretor do Rio passa pelo fluxo todo em português,
  sem número inventado e sem informação contraditória sobre o plano.

## Pós-validação — Marketing AI da informação à decisão (plano de 2026-11-03)

> Só começa **depois** da validação (teste final com a Tespon / "Teste Zero") — **exceção aprovada pelo dono em 2026-11-03: a Fase 1
> (só tela, custo zero) foi adiantada**. O plano transforma a Marketing AI de "mostra informação"
> em "ajuda a decidir". Só a Fase 1 foi implementada (PR #93, no ar em 2026-11-03); a PR de telas #92 só mostra o que já existe (ver
> [DECISIONS.md](../DECISIONS.md)).
>
> **Ordem atual (revisão do dono de 2026-11-03):** **validação → Pacote A → Pacote B1 → Pacote B2 → Fase 2 → Fase 3 → Fase 4 → Fase 5.**
> A validação (Tespon + "Teste Zero") é gate do dono: o Pacote A só começa depois dela. A Fase 2 só começa com A, B1 e B2 concluídos.
> Os pacotes **não são fases novas**: são uma camada de conexão/usabilidade sobre o que já existe, sem IA e sem criar fonte de verdade nova
> (as 4 regras estão em [DECISIONS.md](../DECISIONS.md), 2026-11-03 "Pacotes A e B").
>
> **Status 2026-11-04:** A, B1, B2 concluídos e no ar (PRs #98, #99, #100). Fase 2 juntada (PR #101), site no ar, `marketing-ai` v43
> publicada. **Gate medido** (67 sinais, 0 notícia boa barrada): filtro passou para `enforce` com a ficha v2. Oportunidades ainda reprovam nas
> 5 perguntas, e o custo da coleta passa a ser medido a partir de 05/11: a Fase 2 segue aberta (detalhe em DECISIONS, "Gate da Fase 2").
> **Reconciliação (dono, 04/11):** a Fase 3 (PR #104) foi implementada antes do gate completo da Fase 2; a saída das Fases 2 e 3
> NÃO está aprovada. Trabalho antecipado nas Fases 4 e 5 não amplia escopo nem fecha fase (DECISIONS, "Reconciliação dos gates"). **Princípio orientador e critérios formais de aceite:** [DECISIONS.md](../DECISIONS.md), 2026-11-04 "Critérios de decisão".

### Gate e critérios de saída (dono, 2026-11-04 — detalhe em DECISIONS)
- **Não abrir novas frentes** antes de provar valor comercial. Ordem: publicar `marketing-ai` → conferir bundle e versão → analisar dados reais
  (Tespon + Teste Zero) → medir a qualidade da classificação → decidir audit → enforce → só então Fase 3.
- **Gate audit → enforce:** precisão dos sinais comercialmente relevantes, falsos positivos, duplicados/sem mudança, custo por rodada e acumulado,
  oportunidades que merecem atenção. Não basta a coleta funcionar tecnicamente.
- **Saída por fase:** Fase 2 = informação relevante com custo e qualidade controlados · Fase 3 = a inteligência influencia o direcionamento sem mudar o
  posicionamento sozinha (e o plano semanal funciona sem oportunidade) · Fase 4 = estratégia ligada a imóvel real, sem divulgar indisponível ·
  Fase 5 = ação de marketing ligada a resultado comercial verificável.

### Pacotes de conexão (antes da Fase 2)
**Pacote A — orientação (só tela, sem IA).** **Status (2026-11-03): implementado no branch `claude/nifty-shannon-ysp818-pacote-a`; aguardando aprovação do dono (QA + PR + publicação do site ainda por fazer).** Regra do Tipo de ativação, do Objetivo e a medição em SQL: [DECISIONS.md](../DECISIONS.md), 2026-11-03 "Pacote A". Divergências do texto abaixo: o Tipo ganhou "Tipo não identificado" para tour/oferta/bairro sem imóvel e "Não foi possível verificar"; o "motivo" da peça segue sem campo (o modal avisa que não é registrado).
1. Hub, bloco **"O que merece sua atenção"** com 4 linhas separadas:
   - **Último sinal**: o mais recente com fonte e data, não ignorado e completo (não o sinal bruto).
   - **Oportunidade**: só as que estão de fato aguardando avaliação.
   - **Direcionamento**: o tema central da estratégia ativa. Sem tema, não inventa.
   - **Próxima ação**, por regra fixa nesta ordem: sem estratégia → oportunidade esperando → peça para aprovar → semana sem peças → "Tudo em dia".
     - Se uma consulta necessária falhar ou não carregar, aparece **"Não foi possível verificar"**. Nunca "não existe" nem "tudo em dia" nesse caso.
     - "Tudo em dia" só aparece quando todas as verificações foram concluídas e não há nada pendente.
   - Os 5 cards de agente ficam menores: estado, uma informação útil e a próxima ação.
2. Estratégia, no topo, **3 blocos que não se misturam**:
   - **Direcionamento ativo**: o que a estratégia define (objetivo, público, temas).
   - **Plano da semana**: como isso foi distribuído (`weekly_mix`).
   - **Próxima ação**: a próxima vaga do calendário, ou "Nenhuma peça planejada".
   - "Por que essa direção" só cita oportunidade quando ela está ligada de verdade.
3. Calendário (célula e modal):
   - **Objetivo**: `intent.funnel.objective`, ou "Sem objetivo registrado".
   - **Tipo de ativação** por regra explícita (conferir a semântica dos campos no banco antes de fechar):

     | Condição | Tipo |
     |---|---|
     | Sem imóvel e sem oportunidade | Educativo sem imóvel |
     | Com imóvel, família educativo | Educativo com imóvel |
     | Com imóvel, família tour/oferta | Apresentação de imóvel |
     | Oportunidade válida | Oportunidade |
     | Dado incompleto ou contraditório | "Tipo não identificado" |

   - O modal mostra objetivo, tipo, imóvel e oportunidade (se houver). O motivo da escolha só aparece quando estiver registrado.

**Pacote B1 — relações que já existem no banco (só mostrar).** — **Estado (2026-11-04): implementado na branch `claude/nifty-shannon-ysp818-pacote-b1`, aguardando aprovação do dono** (ver [DECISIONS.md](DECISIONS-2026-11-01-a-09.md#2026-11-04--pacote-b1-relações-existentes-só-tela-atividade-do-imóvel-origem-do-lead-tela-de-oportunidades)).
4. Catálogo, **"Atividade do imóvel"**: dados e página pública; peças planejadas e publicadas, com o estado de cada uma; oportunidades
   ligadas (`item_ids`); leads (`leads.item_id`). Bloco vazio diz que está vazio, e isso não é erro.
5. Funil, **origem do lead**:
   - Conteúdo de origem só quando o `link_id` leva a uma única peça, sem ambiguidade (conferir antes o que `tracked_links` guarda).
     **Divergência (2026-11-04):** conferido — `tracked_links` NÃO leva a uma peça (único por imóvel+oportunidade+canal; `content_id` = só a 1ª peça). Logo o funil mostra imóvel + canal da página pública e a oportunidade, e **não** a peça de origem.
   - Oportunidade quando `opportunity_id` estiver gravado.
   - Senão, "Origem não registrada".
6. Oportunidades: formulário de sinal manual recolhido; corrigir o texto que manda clicar num botão que não existe; "O que falta pra
   achar mais" fica discreto.

**Pacote B2 — ações novas.** — **Estado (2026-11-04): implementado na branch `claude/nifty-shannon-ysp818-pacote-b2`, aguardando aprovação do dono** (ver [DECISIONS.md](DECISIONS-2026-11-01-a-09.md#2026-11-04--pacote-b2-ações-novas-menu-do--ignorar-sinal-ignorar-tendência-ver-evidência)). Migration `20261104100000_trends_ignore.sql` vem antes do merge; deploy de `creative-ideas`, `data-agent`, `marketing-ai` (e quem usa `_shared/opportunityRun.ts`/`opportunityCron.ts`) e o site só depois dela.
7. Botão **"+" vira menu**: Adicionar imóvel · Gerar peça agora · Adicionar sinal de mercado. Cada opção só entra se funcionar de ponta a ponta.
8. **Ignorar sinal**: `market_signals.meta.ignored` + `meta.ignored_at`, sem migration. A evidência fica preservada.
9. **Ignorar tendência**: migration mínima com `status` (`active`/`ignored`, respeitando estados que já existam) e a data, se couber.
   Sai das sugestões ativas sem apagar nada.
10. **"Ver evidência"** no card de tendência; "Fazer carrossel" vira ação secundária.

**Critérios de aceite (QA de cada pacote).**

| Caso | Esperado |
|---|---|
| Imóvel sem peças | "Nenhuma peça relacionada" |
| Imóvel com peça planejada ou publicada | Mostra a peça e o estado |
| Imóvel sem oportunidade | Mostra a ausência, não erro |
| Lead sem origem | "Origem não registrada" |
| Oportunidade ou tendência ignorada | Sai das sugestões ativas |
| Sinal ignorado | Evidência preservada |
| Estratégia sem tema central | Não inventa direcionamento |
| Peça sem objetivo | "Sem objetivo registrado" |
| Consulta com erro | Nunca "Tudo em dia" |
| Demo | Etiqueta visível |

- As contagens batem com a tela de destino (3 peças para aprovar levam a 3 peças reais, sem duplicata).
- Conferência por SQL de leitura na Tespon e na "Teste Zero".
- Depois do merge, "Site publicado em getsaleboost.com ✅".

**Fora dos pacotes, de propósito:**
- "Relacionar imóvel" (Fase 4) e "Adicionar ao direcionamento" (Fase 3) não entram como botão vazio.
- Demonstração nas outras telas fica segurada, para não espalhar dado fictício.
- Campanha continua "em breve".

### As 5 fases
1. **Tela de decisão (hub).** ✅ *Feita e no ar (PR #93, 2026-11-03; ver [DECISIONS.md](../DECISIONS.md)).* 4 indicadores de decisão numa **janela de 7 dias**, com regras fixas e visíveis (cada indicador diz de
   onde vem e como é calculado; sem dado = "sem dado ainda", nunca 0 fingido).
2. **Inteligência.** 🟡 **Código pronto (2026-11-04), aguardando aprovação do dono** — branch `claude/nifty-shannon-ysp818-fase2`: filtro de qualidade na ficha (começa em `audit`), registro por rodada (`market_intel_runs`), análise que não repete quando nada mudou e bloco "O que mudou" (ver [DECISIONS.md](DECISIONS-2026-11-01-a-09.md#2026-11-04--fase-2-inteligência-de-mercado-qualidade-registro-por-rodada-e-sem-reinterpretar)). **Falta:** 2 migrations, deploy de `marketing-ai`, site, e depois trocar a ficha de `audit` para `enforce`. Fica de fora desta entrega: "semana vs. semana anterior" com "cresceu" só com evidência dos dois lados (a tela mostra o que mudou desde a última rodada, não a comparação semanal). Interpretação de sinais **só dos novos, deduplicados**, com **limite de chamadas de IA e custo registrado**
   (livro-caixa). "O que mudou" compara **semana vs. semana anterior** e só diz "cresceu" quando há evidência (número real dos dois lados).
3. **Direcionamento da estratégia.** 🟡 **Código pronto (2026-11-04), aguardando aprovação do dono** — branch `claude/nifty-shannon-ysp818-fase3`: trava de aprovação (refresh só mexe no plano de conteúdo/metas; pivô vira *proposta* que o dono aprova ou descarta) e contexto de mercado nos temas da semana (`intent.market_context`). Ver [DECISIONS.md](../DECISIONS.md) 2026-11-04 — Fase 3. Os sinais influenciam os **temas da semana**, mas **nunca** a tese, o público ou o posicionamento
   sem aprovação do dono. Mudança de estratégia nunca é automática.
4. **Property matching.** Escolher o imóvel por **tema, região, características e disponibilidade**, com **mínimo de fotos por
   formato** e o **motivo gravado** na peça (hoje é só o rodízio do `pickItem`, e o motivo não é gravado). Integração com CRM (VRSync):
   **id externo, última sincronização, status, preço, removidos e falhas**, e **revalidar a disponibilidade antes de publicar**.
5. **Resultados.** Resultados **comerciais** (CRM/leads: visita, proposta, venda) **separados** do engajamento (Instagram: curtida,
   comentário) — nunca misturar os dois numa nota só.

### Os 7 ajustes do dono (incorporados nas fases acima)
1. Hub com 4 indicadores de decisão, janela de 7 dias, regras fixas (Fase 1).
2. Interpretar só sinais novos, sem repetir, com limite de chamadas e custo registrado (Fase 2).
3. "O que mudou": semana vs. anterior, só "cresceu" com evidência (Fase 2).
4. Sinais influenciam temas da semana, nunca tese/público/posicionamento sem aprovação (Fase 3).
5. Property matching com mínimo de fotos por formato e motivo gravado (Fase 4).
6. CRM VRSync com id externo, última sync, status, preço, removidos, falhas; revalidar antes de publicar (Fase 4).
7. Resultado comercial (CRM/leads) separado de engajamento (Instagram) (Fase 5).

### Ajustes do dono para as Fases 2–5 (revisão de 2026-11-03)
- **Fase 2:**
  - Controlar o **volume**, não só o gasto. Registrar por rodada: sinais coletados, que passaram no filtro, interpretados e
    descartados, custo da rodada e custo acumulado.
  - Não reinterpretar sinal que não mudou.
  - Entrega um resumo "o que mudou" com evidência, interpretação e possível impacto, sem dashboard novo.
  - Plano com teto de custo é mostrado ao dono antes de começar.
- **Fase 3:** o sinal sugere um tema → o tema entra como contexto → o plano da semana pode usar. Posicionamento, público e objetivo
  principal só mudam com aprovação.
- **Fase 4:**
  - O motivo da escolha do imóvel precisa ser **verificável**: os atributos que de fato decidiram (região, perfil, característica,
    disponibilidade), não uma justificativa genérica.
  - Revalidar o imóvel antes de publicar, e criar o serviço comum de imóveis.
  - Critério de aceite: imóvel indisponível não publica.
  - **Status (2026-11-04): implementado na branch `claude/nifty-shannon-ysp818-fase4`, aguardando aprovação/merge do dono** (migrations + deploy pela sessão principal). Relacionar imóvel por tema/região ficou fora (decisão do dono).
- **Fase 5:**
  - Separar marketing (alcance, engajamento, salvamentos, cliques) de comercial (conversas, leads, visitas, conversões).
  - A branch `results-flow` é dependência própria.
  - **Status 2026-11-04: implementada no branch `claude/nifty-shannon-ysp818-fase5` (só front, sem migration/function; aguardando QA e PR).** Feita do zero
    sobre a `main`; `results-flow` ficou de fora (decisão do dono) e a "ideia vencedora" não entrou. Detalhe e regra de ligação (por imóvel/oportunidade,
    não por peça): [DECISIONS.md](../DECISIONS.md), 2026-11-04 "Fase 5". Divergência: "visitas" = leads com `visit_at` (convenção Qualificado) e
    "conversas" = comentários com intenção; DMs continuam sem fonte.
  - Não conta como concluída só com métricas do Instagram. O que não existe aparece como ausente, nunca estimado.

### Rastreabilidade ponta a ponta
Cada passo guarda **ids**, para dar pra perguntar "de onde veio isto?" e "deu resultado?":
`sinal (market_signals.id) → insight → tema da semana → peça + imóvel (marketing_ai_test_content.id + item_id) → resultado`
(`posts`/`tracked_links`/`leads` para o resultado comercial; snapshots do Instagram para engajamento). Hoje já existem `item_id`,
`opportunity_id` e `tracked_links`; faltam os elos sinal→insight→tema e o motivo da escolha do imóvel.

### Não fazer agora
Mais agentes sem função clara · mais dashboards · fontes de dados sem critério · fontes pagas sem validar o valor antes · automação de
WhatsApp · embeddings · mudança automática de estratégia.

### Conectores (ordem)
CRM (VRSync) → Google News RSS → Google Trends (**só com aprovação de custo do dono**) → WhatsApp e Ads por último.

## Direção atual (versão de 13/11 antes do D1) — substituída em 13/11 pela versão com D1 aprovado

**4 frentes, uma por vez:**
1. **Tour Virtual do imóvel inteiro.**
2. **Motor próprio de vídeo.**
3. **Infraestrutura:** substituir e só então desligar VPS e Telegram.
4. **Experiência do usuário.**

**Etapas, critérios de pronto e decisões pendentes (D1–D7):** [PLANO-TOUR-COMPLETO.md](../PLANO-TOUR-COMPLETO.md) e
[PENDENCIAS.md](../PENDENCIAS.md). O roadmap detalhado **aguarda a aprovação do dono (D1)**. Nenhuma implementação começa antes.

**O que muda na tabela de 11/11 abaixo** (fica como histórico):
- **Itens 1 e 2:** viram a Frente 1. O tour só fica pronto quando cobre o imóvel inteiro.
- **Item 3 (painel novo):** a 1ª parte já está no ar. O resto entra na Frente 4.
- **Item 4 (abas e fluxos):** é a Frente 4.
- **Item 5 ("Telegram com dado real e aprovações"):** **divergência.** A direção nova é deixar de depender do Telegram,
  com as funções essenciais dentro do próprio Sales Boost. Nada é desligado antes do substituto (Frente 3).
- **Item 7 (mobiliamento em vídeo):** continua depois das 4 frentes.

## Foco e gates do Tour virtual e dos Boosts (dono, 2026-11-11)

**Regra de foco:** no máximo **1 frente de produto com código em execução por vez**.
- **Frente atual:** o tour do imóvel inteiro, sem cortes.
- **As outras frentes** (Bento/fábrica 3D, Telegram, dashboard igual ao print, assinatura, Boosts) avançam só em documento, pesquisa e validação comercial, sem código nem produção sem autorização específica.
- **A fábrica 3D** continua sendo só uma camada visual.

**Ordem:**
1. validar o tour contínuo;
2. medir o custo real;
3. conversar com imobiliárias;
4. definir o modelo de Boosts;
5. experiência visual;
6. Telegram e outras expansões.

**Gate técnico (o tour):**
- tour completo e visualmente contínuo;
- fiel às fotos reais;
- todos os cômodos escolhidos aparecem;
- nenhuma arquitetura inventada;
- custo real registrado por tour e por trecho;
- limite de gasto respeitado.

Critérios por trecho em [MEDIA-ENGINE.md](../MEDIA-ENGINE.md).

**Situação do gate técnico — trecho social PASSOU em 13/11; imóvel inteiro NÃO (8 de 22 ambientes; critério novo do dono, ver [PLANO-TOUR-COMPLETO.md](../PLANO-TOUR-COMPLETO.md))** (tour do imóvel inteiro, Tespon: terraço → sala de baixo → jantar → despensa/serviço → hall → corredor → quarto → banheiro; 0 cortes; fidelidade conferida trecho a trecho; US$ 3,528 gravado em `video_tours.cost_usd`). Andar de cima (salão, jogos, piscina) ficou de fora por falta de foto da escada — a conferência v4 bloqueia esse caminho, como deve.

**Histórico — NÃO passou (5/7), teste de 11/11 na Tespon:**
- 8 fotos, 7 caminhadas, nenhum corte, US$ 3,53;
- 5 passagens fiéis;
- 2 com problema: a piscina → salão dissolveu, porque a foto não mostra porta; e a sala de jogos → sala de baixo inventou o caminho entre andares, porque faltava a foto da escada.
- **Aprendizado:** a caminhada só fica fiel quando as duas fotos mostram uma ligação real (porta, abertura, escada).

**Próxima melhoria do tour — EM ANDAMENTO (dono, 11/11 noite: "vamos sim trabalhar nisso agora"). Parte 1 feita no #147: checagem das fotos de ligação (`_shared/passageCheck.ts`, ação `item-videos check_passages`, tela com ✅/⚠️ e "gerar mesmo assim"); falta o reteste:**
1. **Fotos de ligação.** A tela avisa quando uma passagem não tem conexão visível ("falta foto da escada", "falta foto da porta de entrada") e pede essa foto, em vez de deixar a IA inventar.
   - **Pronto quando:** a passagem sem ligação não é gerada sem o dono confirmar, e a tela indica qual foto falta.
2. **Reteste só das 2 passagens que falharam,** com a foto da piscina mostrando as portas do salão e a foto da escada. Custa cerca de US$ 1,00 dos US$ 1,47 que sobraram da verba de teste, só com a liberação do dono.
   - **Pronto quando:** as 7 passagens passam nos critérios do MEDIA-ENGINE.

**Gate comercial (antes de qualquer código de Boosts ou cobrança por tour):**
- pelo menos 3 imobiliárias ouvidas, ou 1 piloto real ([PILOTO.md](../PILOTO.md));
- quantos tours por mês usariam;
- quem paga: imobiliária ou corretor;
- disposição de pagar por tour avulso, e quanto;
- objeções;
- "disse que usaria" separado de "pagou".

**Decisão depois dos dois gates:**

| Gate técnico | Gate comercial | O que fazer |
|---|---|---|
| passa | passa | proposta final de monetização ao dono |
| passa | não passa | revisar oferta e preço, sem infraestrutura nova |
| não passa | — | corrigir o tour antes de expandir |

Nenhuma implementação de Boosts nem cobrança começa sem aprovação do dono depois dos dois gates.

**Conta dos Boosts (só documento).** Usa o custo real **médio** dos tours concluídos, com falhas e montagem, nunca o
custo teórico de 1 trecho. Separa markup de margem:

| Base (custo US$ 5) | Preço |
|---|---|
| +50% de markup | US$ 7,50 |
| 50% de margem bruta | US$ 10,00 |

A tabela de custos traz, item a item: geração, VPS/estúdio, Stripe, câmbio/IOF, falhas, preço em R$/US$ e margem
líquida.

## Cabeçalho e linha do modelo antes da reorganização de 13/11 (substituídos)

> Prioridades com critério de "pronto". Cada item: objetivo, critério de
> pronto, arquivos envolvidos, riscos, e se envolve ALTERAÇÃO ARRISCADA
> (ver CLAUDE.md).

Título antigo da direção: "## Direção atual (dono, 2026-11-13) — vale acima da ordem de 11/11".

**O modelo:** plataforma grátis; tour virtual pago (US$ 15); lead qualificado pago, com preço a definir depois de medir.
