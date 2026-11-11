# Sales Boost — Decisões

> Cada decisão com data e motivo. Quando o código real divergir de uma
> decisão aqui, registrar a divergência no doc técnico correspondente
> ([ARCHITECTURE.md](ARCHITECTURE.md),
> [CONTENT-INTELLIGENCE.md](CONTENT-INTELLIGENCE.md) etc.) em vez de
> apagar a decisão daqui.

## 2026-11-11 — Tour virtual em caminhada CONTÍNUA (dono: "a câmera fez movimentos contínuos… cinematográfico")

**Por que mudou.** O 1º tour completo (Teste Zero, 11/11) saiu com cortes e movimentos estranhos. As causas:
- corte entre cômodos não vizinhos e entre 2 fotos do mesmo tipo;
- trecho de foto sozinha no começo.

O tour antigo de que o dono gostou era em caminhada: cada trecho começa numa foto e termina na seguinte.

**Agora:**
- **Padrão:** caminhada contínua da foto 1 até a última, sem corte (`tourSegments` em `_shared/tourOrder.ts` e
  cópia em `src/lib/tourOrder.ts`). Substitui a regra de 10/11 de "corte entre cômodos não vizinhos", que fica
  como histórico acima.
- **Passagem que a ficha não confirma** (cômodos não vizinhos em `adjacent_rooms`, ou o mesmo tipo de cômodo) =
  `walk_unconfirmed`:
  - a tela pinta de amarelo;
  - o post avisa quantas são, para conferir no vídeo se a câmera não mostrou um espaço que não existe;
  - o dono assiste antes de aprovar.
- **Corte só quando o dono pede** (✂️ na passagem). Foto que fica sozinha vira trecho próprio: abertura se for
  fachada ou vista, senão cômodo.
- **A ordem continua vindo da ficha** (`walk_order`), com cômodos vizinhos em sequência, o que reduz as
  passagens não confirmadas.
- **Custo:** N fotos = N−1 caminhadas de 6 s (5 fotos ≈ US$ 2,02).
## 2026-11-11 — Tour virtual, Etapa 1: teste real comprovado (Teste Zero)

- **Imóvel:** "Cobertura em Leblon", 5 fotos reais, nenhuma de fora (então sem abertura de fora, como manda a
  regra).
- **Ordem da ficha:** hall → quarto → quarto → banheiro → banheiro.
- **Trechos:** 4, sendo 1 caminhada (quarto → banheiro) e 3 cortes. Nenhuma nova tentativa.
- **Vídeo:** 21,7 s, 1080×1920, com encerramento da marca (bairro + preço do cadastro + "Me chama no direct").
- **Quadros conferidos:** nenhum cômodo inventado. O corte entre os 2 quartos e entre os 2 banheiros funcionou.
- **Custo medido:** US$ 1,764 (`video_tours.cost_usd`), dentro do limite de teste de US$ 5. É o 1º custo real
  de um tour completo e alimenta a Etapa 4 (Boosts).
- **Post:** criado em Aprovações, sem dia, com a legenda pelas travas (tirou 1 hashtag sem base) e os avisos do
  tour. Nada foi publicado (a Teste Zero não tem Instagram).

## 2026-11-11 — Tour virtual, Etapa 2: mobiliar cômodo vazio no menu + aviso garantido ao publicar

**O que já existia** (conferido no código em 11/11):
- `virtual-staging` + `VirtualStaging.tsx` mobiliam a foto real com IA. A instrução proíbe mexer em parede,
  janela, piso e vista.
- A foto mobiliada fica separada (`meta.staged_photos`).
- O carrossel de oferta usa até 2 fotos mobiliadas, junto das reais e com o aviso da ficha.

**O que mudou:**
1. **No menu Tour virtual,** "Mobiliar cômodo vazio" abre a mesma ferramenta, já na escolha da foto
   (`startOpen`). A tela explica as regras.
2. **Aviso garantido na hora de publicar** (`agent-actions` → `execute`, `_shared/stagingDisclosure.ts`).
   - Se alguma mídia do post é foto mobiliada do imóvel, o aviso da ficha entra na legenda uma vez só, mesmo
     que a legenda tenha sido editada.
   - Se o texto passar do limite, corta o texto da legenda e nunca o aviso.
   - É o mesmo padrão do rodapé do CRECI.
   - **Falha fechada:** erro ao conferir, ou ficha sem aviso, recusa a publicação.
3. **Não muda:** custo, teto mensal (10 fotos e o limite de US$ 40) e a regra de que foto mobiliada nunca entra
   no tour nem na página pública.

## 2026-11-10 — Tour virtual com menu próprio (Etapa 1): tour completo e plano da semana sem tour

**Pedido do dono.** O tour vira um menu próprio, "Tour virtual". O dono escolhe o imóvel e gera um tour completo, com a
câmera vindo de fora e passando pelos cômodos na ordem certa. A geração da semana para de fazer tour e fica com os
outros formatos. Depois vêm, cada um num PR: mobiliar cômodo vazio (Etapa 2), abertura aérea melhorada (Etapa 3) e a
moeda Boosts (Etapa 4).

1. **Tour fora do plano da semana.**
   - Vale para a estratégia, o calendário de domingo, o "resto da semana" e a tela do calendário.
   - É uma regra de produto em código (`OUT_OF_WEEKLY_PLAN = ['item_video']` em `_shared/formatCatalog.ts`, com
     cópia em `src/lib/weekSlots.ts`). Não depende de setor.
   - **Substitui a decisão de 14/10** ("mínimo de 3 vídeos por semana"). O mínimo passa a valer 0, e plano antigo
     com tour perde o tour na hora de planejar.
   - Os vídeos curtos no card do imóvel continuam. As peças de vídeo já planejadas também.
2. **Volta o tour completo** (estava suspenso desde 09/10, quando o vídeo virou "isca").
   - A IA de visão já dá o cômodo de cada foto (`photoScore`).
   - A ordem segue a ficha: `config.tour.walk_order`, até `tour_per_room` fotos por cômodo e `tour_max_photos` por
     tour (padrões 2 e 10).
   - O dono confere e pode mudar a ordem antes de gerar.
   - O tour pronto vira um post **sem dia** em Aprovações. Nada sai sem o dono.
3. **Caminhada só entre cômodos vizinhos** (pela ficha, `adjacent_rooms`). Entre os outros, o vídeo faz **corte**: se a
   câmera "andasse" entre cômodos que não se ligam, a IA inventaria o corredor (regra 4).
   - Duas fotos do **mesmo tipo** (ex.: 2 quartos) também levam corte, porque podem ser cômodos diferentes.
4. **De fora só com foto real.** A abertura existe só com foto real de fachada ou vista. Sem ela, o tour começa
   dentro e a tela explica o porquê. A IA nunca cria o prédio nem a vista (dono, 10/11: "sim").
5. **Custo:** até a Etapa 4, o tour conta no teto atual de US$ 40 por mês por cliente. O teste da Etapa 1 tem
   teto de US$ 5, só na Teste Zero (autorizado pelo dono).
6. **Achado, para a Etapa 2:** o "Mobiliar virtualmente" que já existe (`VirtualStaging`, "usar no imóvel") troca a
   foto do imóvel **sem** o aviso "Imagem ilustrativa – mobiliado virtualmente". As regras do projeto
   ([MEDIA-ENGINE.md](MEDIA-ENGINE.md#regras)) exigem esse aviso. A correção entra na Etapa 2.
   - **Correção (11/11):** esse achado estava **errado**.
     - "Usar no imóvel" grava a foto em `meta.staged_photos` e **nunca** troca `meta.photos`.
     - O carrossel de oferta (`catalog-package`) já põe a foto mobiliada junto das reais e acrescenta o aviso da
       ficha (`virtual_staging.disclosure`) na legenda.
     - A página pública e o tour nunca usam foto mobiliada.
     - O que faltava de verdade está na entrada de 11/11 abaixo.
## 2026-11-10 — Aba Agentes só com os robôs (sem cortina, sem cartões) e site mais leve com o logo nos carregamentos (dono)
Pedido do dono: "todo o fluxo deve ser leve, responsivo e a logo deve aparecer em momentos de carregar" + "na tab de agentes não devem existir mais os cards, só os robozinhos sem cortina".
- **Aba Agentes:** a cortina (C.2.1, 07/11) e os 5 cartões saíram. A cena 3D abre direto ao entrar na aba (`FactorySection.tsx`), ocupa a tela abaixo do título (`OPEN_H = clamp(340px, calc(100svh - 230px), 820px)` — nunca maior que a tela, porque no celular o dedo na cena gira a câmera) e tocar num robô abre o painel da estação, cujo "Abrir" leva à aba do agente (as mesmas de antes). Continuam: checagem do aparelho → versão leve 2D com "tentar o 3D mesmo assim", escada de desempenho, "Visão inicial". Enquanto o 3D baixa aparece a prévia estática + o logo. Substitui os itens "Cortina" e "Cartões dos agentes" da decisão de 07/11 abaixo (o texto antigo ficou como histórico).
- **Leveza:** cada página do site virou um pedaço à parte (`src/lib/lazyPage.ts` + `main.tsx`). O JS baixado ao abrir caiu de ~2,4 MB (707 kB comprimido) para ~0,7 MB (215 kB). Com o painel aberto, as outras páginas do painel são pré-baixadas quando o navegador fica ocioso (não com economia de dados), então trocar de aba continua instantâneo. Pedaço antigo sumido depois de deploy → a página recarrega uma vez sozinha (ver PITFALLS).
- **Logo nos carregamentos:** `src/components/BrandLoader.tsx` (logo pulsando + barrinha, só CSS, parado com movimento reduzido). Usado na tela cheia (entrar, checar login/conta) e na área de conteúdo do painel ao trocar de página (o menu lateral fica). Os textos "Carregando…" de dentro das páginas (~45 arquivos) ainda não foram trocados.
- **Rollback:** reverter o commit (não há banco nem function envolvidos).

## 2026-11-10 — Central do dono e "Aprovar a semana"

**Pedido do dono.** Aprovações e Relatórios ficam num menu só, e dá para aprovar no domingo os posts da semana
inteira, para que saiam sozinhos sem um clique por post.

1. **Menu "Central do dono"** (nome escolhido pelo dono) com **Aprovações** e **Relatórios**.
   - "Relatórios" saiu do topo do menu.
   - "Business Progress" continua na seção Progresso.
   - Nenhum endereço de página mudou.
2. **Aprovar a semana = ver e aprovar** (o dono escolheu isso, e não "liberar sem ver").
   - O dono vê os posts planejados de hoje até +7 dias, tira os que não quiser e aprova todos com 1 clique.
   - Cada post fica **aprovado por ele** e **agendado para o seu dia, às 18h**.
   - Na hora de sair valem as travas de sempre: imóvel disponível, CRECI e texto público.
   - Dá para cancelar um ou a semana inteira até a hora de sair.
   - A regra nº 1 continua: nada vai ao ar sem o dono ver.
   - Post de hoje só entra se ainda faltarem 15 min para as 18h.
   - Vídeo ainda sem arquivo fica de fora.
3. **Aviso de domingo.** O plano semanal passa a avisar "Sua semana está pronta", com o link para a Central do dono.
   Antes o aviso dizia "Aprove em Posts".
4. **Exceção ao foco até 17/11.** Até 17/11 a regra é trabalhar só na validação comercial. Esta implementação é
   uma exceção, porque o dono pediu diretamente. O resto do foco não muda.

## 2026-11-10 — Fase 4: direcionamentos do dono (preparação aprovada, implementação não)

A preparação documental (#135) foi aprovada. **A Fase 4 não é implementada agora.**

1. **Lead qualificado.**
   - Os 7 critérios ficam como **proposta**.
   - Os prazos de **30 dias** (duplicidade) e **7 dias** (contestação) são **hipóteses a validar com imobiliárias**.
2. **Estados separados:**
   - **lead válido** (contato + consentimento, sem spam);
   - **lead qualificado** (critérios objetivos, a única base de cobrança futura);
   - **em conversa**;
   - **visita realizada**, além de visita agendada e contestado.

   A etapa manual **"Qualificado" do Funil nunca conta para cobrança** e não pode ser confundida com a qualificação objetiva.
3. **Sem rastreamento persistente no celular na 1ª versão.** Vale:
   - a origem rastreável (link, conteúdo e canal);
   - o identificador do lead;
   - o imóvel, quando houver;
   - o acompanhamento do estado.
4. **Sem preço de lead** antes dos dados reais do piloto.
5. **Tours e leads continuam como receitas separadas** no simulador.

**Até 17/11:** foco na **validação comercial**.
- Conversar com imobiliárias sobre volume de imóveis, frequência de compra de tours e o que é um bom lead (ficha em [PILOTO.md](PILOTO.md), seção 2.2).
- Sem implementação e sem escopo novo.
- Depois da medição de custos e das conversas, voltam os 3 portões da Fase 4.
## 2026-11-10 — Slogan "gerando mais visitas" e aviso de visita no Telegram (dono)

**Slogan.**
- O novo slogan é **"Sales Boost — gerando mais visitas para o seu imóvel"**, em inglês "more viewings for your property".
- **Onde aparece:**
  - no topo do site: selo, título "Você cuida dos imóveis. Nós geramos mais visitas.", texto de apoio e rodapé;
  - em `CLAUDE.md`;
  - em `PRODUCT.md`.
- **Regra que continua valendo:** não prometer visita garantida.
- **O texto de apoio diz só o que existe hoje:** leitura do mercado, estratégia, conteúdo e a página de cada imóvel. **O agendamento ainda não é citado**, porque ainda não existe.

**Telegram avisa cada visita agendada pelo link.**
- **O que é:** um requisito do agendamento de visita da Fase 4, registrado em [CONVERSION.md](CONVERSION.md).
- **Quando entra:** junto com o agendamento. Até lá, nenhum código.

## 2026-11-10 — Novo modelo: cenários de tour, lead sem preço e portões da Fase 4 (dono)

**Tours.**
- São 3 cenários: **1, 3 e 5** tours por imobiliária por mês.
- A **hipótese-base é 3**, mas ela é **hipótese a validar** com conversas e pilotos, não demanda comprovada.

**Leads.**
- **Sem preço por enquanto.**
- **Ordem:**
  1. a definição objetiva de lead qualificado;
  2. o acompanhamento da origem até a conversa e a visita;
  3. o preço, com os dados medidos.
- A proposta da definição e o que falta medir estão em [CONVERSION.md](CONVERSION.md).

**Simulador.**
- Tours e leads são **duas linhas de receita separadas**. O resultado do mês considera só os tours até haver preço de lead.
- Fica em um artifact privado do dono ("Simulador Sales Boost").

**Conferência pedida pelo dono (10 imobiliárias, 1 tour).**
- O resultado de **US$ 49,60** está certo com os custos informados:
  - custos: 65 + 19,20 − 8,00 (créditos grátis da Tavily) + 20 = **96,20**;
  - margem dos tours: 150 − 4,20 = **145,80**.
- **De onde vem a diferença.** O cartão "custo por imobiliária" (US$ 8,42) não desconta os créditos grátis; a tabela desconta. Daí os US$ 8,00 de diferença para quem multiplica 10 × 8,42.
- **Correção no simulador v2:** o desconto aparece numa linha própria e o cartão diz que não o inclui.
- **Ressalva:** os créditos grátis são da conta inteira (todas as imobiliárias dividem), então quase somem em escala.

**Fase 4.**
- **Preparada, não implementada.**
- Só começa depois de **3 portões**:
  1. custos medidos (17/11);
  2. demanda validada (perguntas no [PILOTO.md](PILOTO.md); 1 piloto ou 3 conversas);
  3. critérios de qualificação aprovados.

**Objetivo (dono).** Descobrir se o Sales Boost gera demanda comercial de forma consistente e se as imobiliárias pagam por esse resultado.

## 2026-11-10 — Reaproveitamento de prompt sem mudar o texto (passo 3 da economia de custos; dono)

**Regra.** O texto enviado à IA continua **idêntico, palavra por palavra**. Só passa a ser enviado em 2 pedaços:
1. o começo que se repete entre chamadas, marcado para a Anthropic reaproveitar por 5 minutos;
2. o resto.

Como o texto não muda, a qualidade não muda por construção. Por isso **não houve reorganização de prompt**: as oportunidades, cujo texto começa por dados variáveis, ficaram como estavam.

**Onde se aplica.**
- **Peças** (`creative-generate`): a apresentação da empresa + ficha (`preamble`) é o mesmo começo do Diretor, da execução, da refação e do plano B de cada peça, e das peças seguintes da mesma conta.
- **Estratégia, partes 2 e 3** (`strategy-generate`): o contexto da empresa + a tese (`tacticalCtx.stable`).

**Regras de uso** (`_shared/aiCost.ts` → `cachedContent`).
- **Começo curto:** abaixo de cerca de 3.000 caracteres (aproximadamente o mínimo de 1.024 tokens do Sonnet), nada é marcado.
- **Começo que não bate:** se o começo não for igual ao início do prompt, o pedido vai como antes.

**Custo do reaproveitamento.**
- **1ª chamada:** paga 1,25× pelo começo.
- **Chamadas seguintes, dentro de 5 minutos:** pagam 0,1× por ele.

**Como conferir.** Depois de publicar, as colunas `cache_read_tokens` / `cache_write_tokens` (passo 1) mostram se o reaproveitamento aconteceu.

## 2026-11-10 — Pesquisa de mercado compartilhada por bairro (passo 2 da economia de custos; dono)

**Ponto de partida.** As buscas de notícias (Tavily) são montadas só com tema × bairro × cidade da ficha, sem nada de uma imobiliária específica. Duas imobiliárias com imóveis no Leblon faziam a mesma busca duas vezes.

**O que muda.**
- **Reaproveitamento no mesmo dia.** O resultado de cada busca fica guardado por dia em `market_search_cache`, sem `company_id` (é notícia pública). A 2ª imobiliária que fizer a mesma busca no mesmo dia reaproveita o resultado: não gasta crédito e grava custo 0, marcado "reaproveitada" em `agent_performance`.
- **Cada imobiliária continua com o seu.** O filtro de qualidade, a deduplicação e os próprios sinais (`market_signals`) continuam por empresa. Nada de uma imobiliária passa para outra.
- **Falha do cache = busca normal.** Se o cache der erro, a busca acontece como antes: nunca fica sem notícia.
- **No dia seguinte busca de novo**, para trazer notícia nova.

**Arquivos.**
- Código: `_shared/marketNewsRun.ts` (`searchCacheKey`, `dbSearchCache`).
- Migration: `20261110130000_pesquisa_mercado_compartilhada.sql` (tabela nova, RLS ligado e só o servidor acessa).

## 2026-11-10 — Medição completa do custo da IA (passo 1 da economia de custos; dono)

**Contexto.** O dono aprovou os passos 1 a 3 da auditoria de custos (`docs/AUDITORIA-CUSTOS.md`):
1. medição completa;
2. pesquisa de mercado compartilhada por bairro;
3. reaproveitamento de prompt (prompt caching).

**O que este passo grava em `agent_performance`:**
- **Tokens separados:** `input_tokens`, `output_tokens`, `cache_write_tokens`, `cache_read_tokens`.
- **Origem da chamada:** `call_origin` = `cron` (agendamento) ou `manual` (clique de uma pessoa). Serve para separar operação de teste e uso manual.
  - Vale para as oportunidades, os planos de oportunidade e as peças.
  - Na estratégia fica vazio, porque as etapas 2 e 3 são encadeadas pelo próprio sistema e não carregam essa informação.
- **Dólares das oportunidades e dos planos:** antes só gravavam tokens.
- **Preço do cache** (`_shared/aiCost.ts`): escrita a 1,25× a entrada (5 min) ou 2× (1 h); leitura a 0,1×. Sem cache, o valor é igual ao de antes.

**Migration** `20261110120000_agent_performance_custo_detalhado.sql`: só acrescenta colunas. Se ainda não estiver aplicada, o código grava sem as colunas novas (`insertPerf`).

## 2026-11-09 — Etapa 1 · parte B: proteção do texto que vai ao público (dono, autorizada em 07/11)

- **Onde vive:** na ficha (`config.compliance.public_text`, migration `20261109130000_compliance_texto_publico_ficha.sql`).
  Sem esse bloco, nada muda.
- **O que barra** (em pt e en):
  - **frases discriminatórias**, que rotulam quem pode ou não comprar ou alugar: "ideal para famílias", "perfeito para casal", "não aceitamos crianças", "pertinho da igreja", "gente de bem";
  - **promessas sem prova:** "valorização garantida", "retorno certo", "vai valorizar", "investimento sem risco", "financiamento aprovado na hora".
- **O que não barra:**
  - frases legítimas, mesmo que citem família, criança ou praia: "sala ampla para receber a família", "600 m da praia", "condomínio com playground";
  - afirmação comercial comprovável: "garantia locatícia", "seguro-fiança", "garantia da construtora".
- **Por que frases com contexto e não palavras soltas:** palavra solta pega texto bom.
  - Conferi com as legendas reais da Teste Zero e da Tespon (só leitura) e nenhuma frase legítima foi pega.
- **Onde age:**
  - **Legenda gerada** (`creative-generate`, inclusive vídeo, e `catalog-package`): corta só a frase, anota "Ajuste de conformidade: …" e a peça continua.
  - **Pedido à IA:** a regra também entra no prompt ("descreva o imóvel e o estilo de vida sem dizer para quem ele é ou não é…").
  - **Ao publicar** (`agent-actions`): se ainda sobrar frase proibida, recusa com motivo claro e devolve a peça ao Vault. Não edita o texto que o dono aprovou.
  - **Resposta automática do WhatsApp e DM de automação do Instagram:** a mensagem com problema não sai. Vai a resposta neutra da ficha.
- **Divergências do plano:**
  - **Listas das oportunidades:** as listas antigas das oportunidades (`PROTECTED_TERMS` em `opportunityOutput.ts`, `PROMISE` em `opportunityPlan.ts`) **não foram movidas**. São palavras soltas, boas para o texto interno das oportunidades, mas largas demais para legendas.
  - **Número e característica inventados:** continuam com as travas que já existiam (`claimLock`, `pieceGuard`).
- **Testes:** `scripts/test-compliance.mjs`, agora com 29 verificações (1A + 1B).

## 2026-11-09 — Etapa 1 · parte A: CRECI obrigatório para publicar (dono, autorizada em 07/11)

A Etapa 1 foi dividida em 2 PRs (decisão do dono em 09/11): **1A CRECI** (este) e **1B proteção de conteúdo**.

- **Onde vive:** a regra fica na ficha (`config.compliance.license`, migration
  `20261109120000_compliance_creci_ficha.sql`), não no código (regra 6). Sem esse bloco, nada muda.
- **Onde a resposta fica:** na mesma pergunta que já existia (`playbook_answers.creci`). O tipo fica como sufixo:
  `12345-F` (pessoa física, corretor) ou `12345-J` (pessoa jurídica, imobiliária). Não criei coluna nem chave nova.
  - **Divergência do plano:** o plano previa `creci_tipo` à parte. Usei um campo só por dois motivos:
    o exemplo da própria pergunta já pede esse formato ("Ex.: 12345-F ou 1234-J"), e assim número e tipo nunca ficam desencontrados.
- **Formato:** aceita "CRECI-RJ 12345-F", "12345-J", "creci/rj nº 12.345-f" e "1234 PJ". Recusa texto solto, outro estado e
  tipo inexistente.
- **Conferência junto ao conselho:** o sistema **não consulta o registro sozinho**. O CRECI-RJ não tem uma API
  pública confirmada. A tela dá o link do site do CRECI-RJ para o dono conferir.
- **Publicação:** sem CRECI válido (com PF/PJ), o `agent-actions → execute` recusa a ação com o motivo
  "Para publicar, informe seu CRECI…" e devolve a peça ao Vault.
  - Se o banco falhar, a publicação também é recusada (falha fechada, porque publicar é irreversível).
  - **A geração de peças e os testes internos (A.6) não são bloqueados.**
- **Rodapé:** "CRECI-RJ 12345-F" entra no fim da legenda **na hora de publicar**, uma vez só. Não repete se a legenda já cita o
  número. Legenda longa é cortada, nunca o rodapé (limite de 2.200 caracteres do Instagram).
- **Tela:**
  - **Campo do CRECI (Configurações e cadastro):** botões PF/PJ, aviso de formato, a prévia exata do rodapé e o link do conselho.
  - **Aprovações:** aviso "Para publicar, informe seu CRECI".
  - **Página pública do imóvel:** mostra o CRECI quando ele é válido.
- **Testes:** `scripts/test-compliance.mjs` (17 verificações).

## 2026-11-07 — Plataforma internacional: idioma ≠ país ≠ regras (dono)

**Visão do dono:** "não quero que o SalesBoost seja um software brasileiro traduzido para inglês. Quero que seja uma
plataforma internacional, capaz de entender o mercado, as regras e a linguagem comercial de cada país."

- **Três coisas separadas, sem depender uma da outra automaticamente:** idioma de uso (em que língua a pessoa lê e as
  peças são escritas) · país onde a imobiliária opera (escolhido no cadastro, junto da cidade) · regras comerciais e
  legais daquele país (vivem na ficha do país — regra 6). Ex.: brasileiro com imobiliária em Miami usa em português,
  com regras e formatos dos EUA; e o contrário.
- **Ordem:** segurança primeiro, internacionalização depois, expansão comercial por último.
  | Ordem | Entrega | Situação |
  |---|---|---|
  | 0 | Desligar publicação sem aprovação | **feita 07/11** (ver abaixo) |
  | 1 | CRECI e proteção de conteúdo (Brasil) | autorizada, com os ajustes abaixo |
  | 2 | País no cadastro e estrutura internacional | planejamento aprovado |
  | 3 | IA respeitando o idioma | planejamento aprovado |
  | 4 | Moeda, medidas, telefone e fuso | roadmap, sem execução agora |
  | 5 | LGPD, CCPA e privacidade | revisão especializada (LGPD e CCPA não são a mesma lei) |
  | 6 | Tradução dos erros | acabamento |
- **Ficha imobiliária dos EUA:** sem comercialização antes de revisão de advogado nos EUA. O Fair Housing entra no
  desenho da ficha desde o início, não só como lista de palavras proibidas. Revisão jurídica dos Termos e da Política
  também é requisito antes de vender nos EUA.
- **Etapa 1 — ajustes do dono:**
  - CRECI da pessoa física ou jurídica, identificado conforme o tipo de registro; incluído automaticamente nas peças
    publicitárias; publicação bloqueada quando faltar o registro exigido; validação de formato e possibilidade de
    conferência do registro (o número precisa pertencer ao anunciante certo, não basta "qualquer número"). Base citada
    pelo dono: Resoluções COFECI 458/95 e 1.065/07 (a confirmar com advogado o texto exato exigido).
  - A exigência de CRECI bloqueia a **publicação comercial**, não os testes internos de geração e qualidade (A.6).
  - Proteção contra discriminação de compradores/locatários, promessa de valorização ou retorno garantido, informação
    falsa sobre o imóvel e características inventadas — em legendas, DMs, WhatsApp, respostas automáticas e peças.
    Deve distinguir afirmação comercial comprovável de promessa sem fundamento: não bloquear comunicação legítima à toa.
- **WhatsApp:** consulta da configuração de resposta automática autorizada em todas as contas **exceto a Liga dos
  Sonhos** (que fica completamente fora: não consultar, não modificar, não enviar, não testar). Desligar só nas contas
  de teste; qualquer outra conta real é apresentada ao dono antes de mudar. **Resultado (07/11):** nenhuma conta
  consultada estava com a resposta automática ligada — nada a desligar.
- **A.6** continua separada (publicação das 2 funções do agente de conteúdo), só em contas de teste, sem Instagram.

## 2026-11-07 — Etapa 0: nenhuma publicação no Instagram sem aprovação humana (dono)

- **Regra:** nenhuma publicação no Instagram sem aprovação humana; nenhuma função antiga pode contornar; o padrão
  continua "Pedir aprovação"; publicação automática só no futuro, com decisão explícita do dono e controles claros.
  É proteção **no servidor**, não botão escondido.
- **Feito:**
  1. `publish-instagram` (antiga, sem chamadores, aceitava `company_id` sem conferir quem chamava e publicava com
     legenda/imagem de IA) foi **substituída por uma versão que só responde 410 "Função desativada"** e passou a exigir
     JWT (v73, publicada em 07/11). Conferido: sem login → 401; com chave pública → 410.
  2. `agent-actions` → `execute`: trava `_shared/publishGuard.ts`. Ação ligada a uma peça (`marketing_ai_content` /
     `marketing_ai_test_content`) só executa com `approval_status = 'APPROVED'` **e** `approved_by` preenchido
     (clique no painel, agendamento do dono, botão assinado do Telegram). `AUTO_APPROVED` nunca publica — vira FAILED
     com o motivo. Teste: `scripts/test-publish-guard.mjs`.
- **Rollback:** republicar `agent-actions` a partir do commit anterior a esta entrada. A versão antiga de
  `publish-instagram` está no git (não recomendado reativar).

## 2026-11-07 — Qualidade do agente de conteúdo (A.6): 4 correções
Origem: teste A.6 nas contas de teste (Teste Zero e Tespon; Liga dos Sonhos não tocada). Autorizado pelo dono. Branch `claude/nifty-shannon-ysp818-conteudo-qualidade` (a partir de `db03ea8`).
- **1. Peça sem imagem não entra na fila.** Causa: `creative-generate` (educativo = `opts.deck`) força `format: carrossel` e `template: livre` e IGNORAVA o modelo do Diretor sem avisar (o `reasoning` justificava "faq"); quando os slides não saíam (`slides` vazio, `image_url` null) o fallback de card só valia para `fmt !== 'carrossel'`, e a peça seguia para a nota e para o Vault (82). Agora: (a) `pieceGuard.resolveTemplate` grava a escolha do Diretor em `brief.director_template`, explica toda troca no `reasoning` e o prompt do Diretor avisa que no carrossel de slides o modelo não se aplica; (b) carrossel sem nenhuma imagem cai num card renderizado pelo `render-format` (faq se o Diretor escolheu faq e a peça trouxe pergunta/resposta; senão card "photo"), o formato vira `foto` e o `reasoning` ganha "Troquei o carrossel por um card único" (baixa a nota); (c) trava final: foto/carrossel sem imagem utilizável **apaga a peça**, registra `agent_performance.task_key = 'content_no_image'` (success false, com o motivo) e a chamada falha com mensagem clara — nunca chega ao score/Vault. Exceção: `skipImage` (imagem desligada de propósito). A rotação automática de modelo em `foto` continua mandando (decisão antiga do dono) e continua explicada no `reasoning`.
- **2. Afirmação de tendência de mercado sem fonte.** A trava de termos/números não pega frase comum ("estão escolhendo contratos mais longos"). Agora, **na ficha** (`opportunity_texts.market_trends[lang] = {terms, opinion}`, migration `20261107120000_tendencia_mercado_ficha.sql`, regra 6): (a) prompt — tendência/comportamento de mercado só com sinal real **com fonte** ligado à vaga (`intent.market_context.evidence` com nome ou link de fonte) ou, no modo regulado, as dicas conferidas; sem sinal o texto sai como orientação/opinião do corretor; (b) checagem em código depois da geração (legenda, slides, campos de card): frase de tendência sem fonte **não é cortada** (cortar esvazia o carrossel) — a peça recebe "Precisa de fonte: …" no `reasoning`, nota −25 (`claimLock.qualityFlags`) e não vai sozinha ao Vault. Frase em tom de opinião ("na minha experiência", "recomendo") passa. Ficha sem a lista = trava desligada e prompt idêntico.
- **3. Estratégia sem custo interno do Sales Boost.** A fonte: `weeklyMixRules` (strategy-generate) mandava a IA dizer "cada vídeo de 5 s custa ~US$ 0,42 do teto mensal de US$ 40" e "no MÍNIMO 3 vídeos (regra do setor)", mais `PRODUCER_LABEL.item_video` e o campo `custo` da ficha no catálogo de formatos (`formatCatalogBlock`) e o `purpose` do vídeo de mínimo (`ensureMinVideos`). Removido tudo isso do que a IA vê; regra explícita no `SCOPE_BLOCK` ("NUNCA cite o custo interno…"); e trava em código (`stripInternalCost`/`cleanBudgetText`) tira a frase com US$/teto/débito/"mínimo de N vídeos"/"regra do setor" de `budget.allocation[].reason`, `budget_reasoning`, `why` e `purpose` do mix. **A política de vídeos NÃO mudou:** `content_rules.min_videos_per_week = 3` (ficha `imoveis_rio`, migration `20261017150000_weekly_videos.sql`) continua valendo em `sanitizeContentPlan`/`ensureMinVideos` e na leitura do calendário; teto de US$ 40 do `item-videos` intocado. Estratégias já gravadas continuam com o texto antigo (não reescrevi dados).
- **4. Custo real medido.** Novo `_shared/aiCost.ts`: tokens da resposta da Anthropic × tabela de preço (Sonnet 4.6 US$ 3/15, Haiku 4.5 US$ 1/5 por milhão; desconhecido = preço do Sonnet). `strategy-generate` grava **uma linha por chamada** (`agent_role 'estrategia_ia'`, `task_key 'ai_text_strategy'`, tokens + dólares reais; as 3 partes rodam em execuções separadas) e a linha antiga `estrategia` virou só marcador da execução com `cost_usd 0` (o teto mensal de chamadas automáticas conta essas linhas; não foi alterado). `creative-generate` grava **uma linha por peça** (`agent_role 'conteudo'`, `task_key 'ai_text_content'`) somando Diretor, legenda, refações, guarda do carrossel e trava de afirmação. Não entram: score e refação automática (rodam no `content-test`), planejamento de temas/semana e slots de vídeo/dica (chamadas fora de `generateForCompany`). Imagens de IA já tinham registro próprio (`generate-image`, `image_generation`, OpenAI — não há Replicate no fluxo). Texto da IA continua fora do teto de US$ 40 (`spendCap` só soma imagem/vídeo/mercado por `task_key`). Falha ao gravar nunca derruba o fluxo.
- **Rollback:** republicar `creative-generate` e `strategy-generate` a partir de `db03ea8` (`git checkout db03ea8 -- supabase/functions/creative-generate supabase/functions/strategy-generate` e as `_shared` tocadas: `claimLock`, `faqCheck`, `formatCatalog`). A migration da ficha tem rollback comentado no próprio arquivo. As linhas novas de `agent_performance` são só registro (pode apagar por `task_key`).

## 2026-11-07 — Fábrica C.2.1: cortina, câmera livre e robôs que mostram a verdade
- **Princípio (dono):** "A fábrica deve ser a identidade visual do SalesBoost. Mas o que faz alguém confiar nela é saber que tudo o que está vendo corresponde ao que o sistema realmente está fazendo."
- **Robôs mostram a verdade — 4 estados aprovados:** **Trabalhando** (movimento de trabalho + luz acesa, SOMENTE durante execução real); **Esperando você** (parado, olhando para o anel laranja, quando há algo para o dono aprovar); **Descansando** (pequeno movimento de respiração, nada a fazer); **Com problema** (luz vermelha, cabeça baixa, falha real).
  - **Regra 1:** NÃO mostrar "Trabalhando" só porque existe tarefa na fila (QUEUED/agendada não é trabalho). Trabalho = execução real. Hoje só existe sinal de execução ao vivo na **estação 4** (`agent_actions.execution_status = 'EXECUTING'`); as estações **1, 2, 3 e 5 só gravam depois que terminam**, então nesta etapa os robôs delas **NUNCA** aparecem "Trabalhando" (constante `LIVE_SIGNAL_STATIONS` em `robotState.ts`; quando uma delas ganhar sinal ao vivo, entra na lista).
  - **Regra 2:** falha de conexão/consulta (estado desconhecido) NÃO pode parecer "Descansando": robô **desligado/acinzentado** com rótulo "Não foi possível verificar" ("Verificando…" enquanto carrega). Pré-requisito ausente (ex.: estação 5 sem Instagram) → desligado com rótulo "Indisponível". Os dois são visualmente distintos de Descansando.
  - **Mapa estado → pose** (`ROBOT_POSE`, função pura, testada em `scripts/test-robot-state.mjs`): processing → Trabalhando; approval → Esperando você; standby/recent/scheduled/queued/late → Descansando (Atrasada mantém o aviso "⏱" no painel, mas não é trabalho); failed → Com problema; unknown/unavailable → Desligado.
- **3 condições essenciais:** (1) **Desempenho** — a aba Agentes rápida mesmo em aparelho modesto; o 3D não prejudica o resto do dashboard. (2) **Alternativa** — a versão leve é plenamente funcional, não quebrada. (3) **Verdade operacional** — nenhuma animação comunica atividade que não aconteceu.
- **C.3** (pacotes na esteira por evento real) fica para **DEPOIS** de a C.2.1 estar integrada e validada.
- **Cortina (substitui o botão "Ver fábrica 3D" e os controles Visão geral/Lateral/Foco/Versão simples):** no topo da aba Agentes, igual no celular e no computador. Fechada é só HTML/CSS (prévia estática `public/factory-preview.webp`, 17 kB, gerada com Playwright da própria cena, sem dado de cliente; carregada `lazy`) com as 5 luzes de estado e a frase do que precisa do dono, só de dado real ("1 oportunidade aguardando você · 4 peças para aprovar"; sem pendência → "Nada aguardando você agora."; dado desconhecido → "não foi possível verificar …", nunca "nada pendente"). Tocar/Enter/espaço abre com animação CSS (sem animação se `prefers-reduced-motion`) e **só então** baixa o chunk 3D (o mouse pré-carrega no `pointerdown`; toque não, pra rolar a página não gastar dados). "Fechar cortina" descarta a cena (dispose). Aparelho fraco/sem WebGL/movimento reduzido/economia de dados abre a versão leve com aviso e o link "tentar o 3D mesmo assim".
- **Câmera livre:** arrastar gira, pinça/rodinha aproxima, dois dedos/botão direito desloca. Limites: não atravessa o chão (`maxPolarAngle` 0,47π), zoom 4,5–60, alvo preso na área da fábrica. Amortecimento mantém o desenho sob demanda. **Celular:** o dedo dentro do canvas gira a câmera (não rola a página); por isso a cortina aberta ocupa no máximo ~70% da altura da tela (`clamp(340px, 70vh, 560px)`), ao terminar de abrir a página alinha a cortina no topo e sobra uma faixa de cartões embaixo (e o título em cima) onde o dedo rola. Tocar numa estação: a câmera voa até ela (tween 650 ms) e abre o painel (computador: lateral; celular: folha que sobe de baixo, estação deslocada pra cima da folha); tocar fora fecha. Um único botão "Visão inicial".
- **Robôs:** procedurais e low-poly (~120 triângulos cada), um gesto de trabalho por estação (Mercado gira a antena, Oportunidades separa peças, Estratégia mexe na mesa, Ativação puxa a alavanca da prensa, Resultados olha os medidores).
- **Animação e desempenho:** o laço de animação dos robôs só roda com cortina aberta E fábrica visível (IntersectionObserver) E aba visível, limitado a ~30 fps (timer + rAF); fora disso, zero `requestAnimationFrame`; sem robô que se mexa (só problema/esperando/desligado) também zero. **Escada automática** (cada degrau após 1,5 s de fps ruim: <40 fps em interação, <20 fps no movimento ambiente): 1) sem sombras e pixelRatio 1; 2) robôs congelados na pose estática do estado (continua mostrando a verdade: luz de "Trabalhando" acesa, cabeça baixa de "Com problema"); 3) versão leve, lembrada no aparelho (`localStorage.sb_factory_view`).
- **Versão leve:** as 5 estações em 2D com o mesmo conteúdo do painel 3D (rótulo do robô, estado, números reais, selo, último evento, "Abrir").
- **Cartões dos agentes:** tocar no cartão (não só focar) abre a cortina se preciso, rola até a fábrica e voa até a estação; foco de teclado só destaca. O botão "Abrir" do cartão continua indo pra tela do agente.
- **Desvios/limites registrados:** `prefers-reduced-motion` continua mandando pra versão leve (decisão da C.2), com o link pra tentar o 3D (aí os robôs ficam na pose estática). Rodinha do mouse sobre o 3D aproxima em vez de rolar a página (padrão de câmera livre).

## 2026-11-07 — Aba Agentes + Fábrica 3D parada (C.2)
- **Organização das telas:**
  - **Menu:** item novo "Agentes" (en "Agents") logo abaixo do hub, rota `/dashboard/agentes` (`AgentsPage.tsx`).
  - **Aba Agentes:** no topo a fábrica 3D (desktop; painel lateral de 320 px com a estação selecionada), embaixo os 5 cartões que antes ficavam no hub (mesmo componente `HeroAgentCard`, mesmos dados `cardModels`; textos em `agentModules.ts`).
  - **Estação ↔ cartão:** clicar numa estação destaca e rola até o cartão; focar num cartão seleciona a estação. No celular (< 768 px) vêm os cartões primeiro e o botão "Ver fábrica 3D" (cena de 380 px).
  - **Hub (`/dashboard/marketing-ai`):** a seção "Sua equipe de agentes" virou uma linha fina com 5 luzes 2D (cor = tom do mesmo `cardModels`: verde ok, laranja precisa de você, cinza sem dado) + "Ver agentes →". O hub **não importa nada da fábrica**: no build, `three` só existe no chunk `FactoryScene-*.js`.
- **Estados (`useFactoryState` + `factoryState.ts`):** reaproveita `useStrategySummary`, `useFlowSummary`, `useDecisionKpis` e a leitura de `marketing_ai_trends` do hub; a única leitura nova é de `agent_actions` (só leitura: EXECUTING, QUEUED com horário, FAILED dos últimos 7 dias, último EXECUTED).
  - Estados: Desconhecido (carregando/erro, "Não foi possível verificar"), Indisponível (estação 5 sem Instagram conectado = `companies.instagram_user_id` vazio), Em espera, Requer aprovação (com o número), Processando (**só** `execution_status = EXECUTING`), Agendada / Na fila / Atrasada (QUEUED; horário futuro = Agendada; passou até 10 min = Na fila; mais que isso = Atrasada; constante `QUEUE_LATE_AFTER_MIN`), Concluído recentemente (< 24 h), Falhou (com o motivo gravado; só acende se nenhuma ação terminou com sucesso depois da falha, e "Processando" vem antes).
  - Estações 1, 2, 3 e 5 nunca mostram "Processando"; mostram "última rodada" e "atualizado às HH:MM".
  - **Selos de maturidade (constante `MATURITY`):** 1 e 3 Operacional; 2 e 4 Em validação; 5 Aguardando dados. Mudam só quando o gate respectivo for aprovado aqui.
- **Cena (`marketingAi/factory/`):** `sceneCore.ts` (renderizador, luzes, câmera, desenho sob demanda, fps, descarte), `stations.ts` (5 estações + luzes/placas/anéis), `conveyor.ts` (esteira 1→5 e duto de retorno 5→3), `FactoryScene.tsx`, `FactorySection.tsx` (as travas), `StationUi.tsx` (painel + versão simples), `useFactoryState.ts`/`factoryState.ts`. Origem da ideia: template `agentic-factory-3d` (condições de 04/11: uso interno permitido; a reconferência do README prevista antes do PR 2 **não foi feita nesta sessão (sem acesso à web) — o dono/QA deve conferir os termos antes de juntar**). Todo conteúdo do original (nomes, "$29", fila de vídeo, estações Engine/Admin/..., assinatura) foi removido; nada em `window`, sem ids fixos.
  - Visual: fundo `#0E0B0A`, corpo grafite, aço escuro; laranja `#FF6D29` só na luz de estado e no anel de aprovação; vermelho fosco só na falha; sem neon nem partículas; placas só com número + nome real. Modos de câmera: Visão geral, Lateral, Foco na estação.
- **As 5 travas de desempenho (pedido do dono: "não pode travar"):**
  1. Página e cartões funcionam sem o 3D; a cena é `React.lazy` + `import()` (chunk à parte), só carrega quando a área entra na tela (IntersectionObserver); erro de qualquer tipo no 3D cai pra versão simples sem derrubar a página (error boundary local).
  2. Checagem do aparelho antes de carregar: sem WebGL, `deviceMemory < 4`, `hardwareConcurrency < 4` (4 núcleos tenta o 3D e a automedição recua se ficar lento), reduzir movimento ou economia de dados → começa na versão simples com o botão "Ver fábrica 3D".
  3. Automedição: nos primeiros ~3 s de interação (2 janelas de 1,5 s de quadros contínuos) mede fps; < 40 → qualidade baixa (sem sombra, pixelRatio 1); continua < 30 → troca sozinho para a versão simples com o aviso "Mostrando a versão leve neste aparelho" e grava `sb_factory_view=simple` no `localStorage` (try/catch).
  4. Desenho sob demanda: nenhum `requestAnimationFrame` com a cena parada; pausa fora da tela e com a aba oculta; `webglcontextlost` → versão simples; descarte completo ao desmontar (geometrias, materiais, texturas, controles, renderizador). Sombra 1024, pixelRatio ≤ 1,5, peças fixas fundidas por material (34 malhas, ~24 mil triângulos), sem luz pontual.
  5. Botão "Versão simples" sempre visível ao lado do 3D, escolha lembrada (`sb_factory_view`: `simple` | `3d`). Sem botão de emergência remoto (não pedido).
- **Para a C.3 (não feito aqui):** movimento por evento real (id único `tabela:id:estado`, anima 1 vez, recuperação após reconexão), releitura automática (aba volta a ficar visível e a cada 10 min), dado "desatualizado" quando a releitura falha, teste de falha com linha descartável. A cena de hoje é parada e só lê uma vez ao abrir.
- **Limites conhecidos:** a aba Agentes não tem Modo demonstração (só dados reais); as luzes do hub usam o tom do cartão (3 cores), não os 10 estados da fábrica (esses precisam da leitura de `agent_actions`, que o hub não faz de propósito).

## 2026-11-07 — Gráficos no Bento
- **O que mudou:** 4 visuais dentro dos cartões do `HubBento` (SVG/HTML à mão, sem biblioteca; `BentoCharts.tsx` + `useBentoSeries.ts`). Só leitura, 1 consulta por série, filtro por `company_id`, sem realtime novo. Animação de ~600 ms (some com `prefers-reduced-motion`), valor exato ao passar o mouse/tocar. Demo: dados de exemplo com a etiqueta "exemplo" (só vale onde o Modo demonstração é permitido, ou seja, fora do teste grátis).
- **Mercado:** notícias aceitas (`market_intel_runs.accepted`) × descartadas pelo filtro (`.filtered`), por dia, `phase = 'collect'`, últimos 30 dias, soma por dia local (mesmos campos do texto "Última coleta"). Dia sem coleta fica em branco e a linha só liga dias vizinhos (nunca interpola); com menos de 3 dias aparece "ainda sem histórico suficiente".
- **Oportunidades:** barra empilhada aguardando/aprovadas/descartadas = `growth_opportunities.status` (`suggested`/`approved`/`dismissed`), **todas** da empresa (sem janela; legenda diz isso). Leitura cortada em 1000 linhas vira "Não foi possível verificar".
- **Aprovações:** prontas = `actionsReady` e em revisão = `actionsVault` (`useDecisionKpis`, sem mudança); agendadas = peças originais vault/draft com ação `QUEUED` e `scheduled_at` (mesma definição da `ApprovalsPage`), campo novo `actionsScheduled` no mesmo hook (mesmas duas consultas, nenhuma a mais).
- **Instagram (cartão novo, 12 colunas, entre Direcionamento e Receita):** conectado = `companies.instagram_user_id` preenchido. Barras dos últimos 12 posts de `instagram_content_performance` (alcance ou interações = curtidas + comentários + compartilhamentos + salvamentos; o que não vem da API fica "não disponível") com linha tracejada da **média da própria conta** (nunca meta inventada). Lê a tabela já sincronizada pela aba Desempenho; não chama a Meta. Não conectado: convite para Configurações → Conexões.
- **Limite conhecido:** o cartão não sabe se o token do Instagram expirou (o token não vai pro navegador); nesse caso mostra o que já foi sincronizado.

## 2026-11-07 — Bento no topo do Marketing AI (C.1)
- **O que mudou:** o topo do hub virou uma grade Bento (12 colunas): Próxima ação (8) + Aprovações pendentes (4); 4 indicadores (3 cada); "O que mudou no mercado" (6) + Oportunidades (6); Direcionamento (12); Receita · ROAS · funil (12, ainda em DataVeil). Componente novo: `marketingAi/HubBento.tsx`. Cada cartão leva à tela de origem (nada duplicado).
- **Nenhuma métrica nova, nenhuma consulta nova:** mesmos hooks de antes (`useAttention`, `useDecisionKpis`, `useMarketChanges`, `useStrategySummary`, `useFlowSummary`). Os 4 indicadores usam `decisionTiles()` (extraída de `DecisionKpis.tsx`), então os números são idênticos. Estados de carregando/erro/vazio mantidos; "Status da coleta" segue recolhível dentro do cartão de mercado.
- **Efeito visual:** estrutura do GlowCard da referência TechStackBento (21st.dev): borda acesa + spotlight + grade fraca que seguem o cursor/dedo, em laranja #FF6D29; desligado com `prefers-reduced-motion`.
- **Celular (< 768px), uma coluna na ordem:** Próxima ação → Aprovações → indicadores (2×2) → Mercado → Oportunidades → Direcionamento → Receita.
- **Sem uso no hub agora (mantidos no código):** `AttentionBlock` (só seus textos/rotas são reaproveitados) e o corpo visual de `DecisionKpis`.

## 2026-11-07 — Qualidade e mercado em paralelo (dono)
- **Mudança de mentalidade:** não esperar o processo completo ficar perfeito para validar comercialmente. Colocar o Sales Boost diante de uma imobiliária real o quanto antes, sem prometer o que ele ainda não entrega.
- **Frente A (núcleo, agente):**
  - Correção 3 (juntada no #119);
  - relatório da fila antiga ([relatorios/fila-antiga-2026-11-07.md](relatorios/fila-antiga-2026-11-07.md));
  - publicar a função com autorização;
  - validar uma oportunidade real até a ação comercial.
- **Frente B (piloto, em paralelo):** uma **imobiliária pequena** no Rio, que o dono conquista e o agente configura e acompanha. Kit em [PILOTO.md](PILOTO.md).
- **Depois:** Bento, Fábrica 3D, Telegram, cadastro, planos e pagamento.
- **Primeiro marco comercial:** demonstrar o ciclo **mercado → inteligência → oportunidade → execução → resultado** para uma imobiliária. Não conta ter todas as telas prontas.
- **Situação em 07/11:** nenhuma imobiliária parceira registrada no projeto. As contas são só de teste (Teste Zero, Tespon) ou vitrine (Ana Souza).

## 2026-11-06 — Ordem de trabalho: núcleo → telas → Telegram (dono)
- **Ordem:**
  1. O núcleo funcionando de verdade: Correção 3, relatório da fila, fechar a Fase 2, processo completo nas contas de teste, IA depois da recarga e teste final.
  2. As telas: PR B, Bento, Fábrica 3D, cadastro e pagamento.
  3. O Telegram.
- **Detalhes, critérios e dependências:** [ROADMAP.md](ROADMAP.md), seção "Ordem aprovada".
- **Motivo:** o dono quer um Sales Boost que encontre oportunidades comerciais relevantes e ajude a transformá-las em ações e demanda, e não mais funcionalidades, telas ou conteúdo de IA.
  - O Telegram vem por último porque usa as mesmas regras, filas e permissões das telas.
- **Etapa concluída:** só com o critério de pronto comprovado. Código juntado ou publicado não conta.
- **Instagram:**
  - @getsaleboost **não** pode ser usado em teste de publicação sem uma autorização específica do dono;
  - o caminho é uma conta de teste ligada à Teste Zero;
  - sem conta de teste, a etapa para, a limitação é documentada e uma alternativa é proposta;
  - nem em teste algo é publicado sem o clique do dono.
- **Toda etapa precisa de autorização antes de começar.** Isso vem depois de apresentar o objetivo, o escopo, os riscos e o critério de pronto.

## 2026-11-06 — Correção 3 do Opportunity Engine (fila sem repetição, tarefa única, Instagram desconectado)
- **Motivo:** na Tespon a fila chegou a 19 oportunidades abertas, muitas repetindo o mesmo tipo e os mesmos itens (cada rodada só inseria). Três oportunidades pediam a MESMA ação ("adicionar fotos reais") para itens diferentes. Na Teste Zero o texto dizia "sem presença nas redes" / "invisíveis" / "imóveis parados" com o Instagram NÃO conectado: o sistema não sabe o que existe fora dele.
- **Regras do dono (valem no código):**
  - Repetida = mesmo tipo + mesmos itens (em qualquer ordem). Para `market_change`, também precisa ter ao menos um sinal externo em comum (mesma URL da fonte). **Nunca** se compara título nem texto da descrição.
  - Só linha `suggested`, sem plano e sem decisão é atualizada. Aprovada, descartada ou com plano nunca é tocada.
  - Evidência mais forte não se perde: as evidências antigas e novas são unidas (até 12, fatos antes de hipóteses). O texto e a confiança vêm sempre da leitura nova, que já passou pelas travas atuais (decisão do dono em 07/11: um texto antigo pode ter frase que hoje seria barrada). As evidências antigas nunca saem.
  - Mesma ação para itens diferentes vira UMA tarefa, com todos os itens listados (dá pra acompanhar item por item). Confiança = a mais baixa do grupo; "precisa validar" se qualquer um precisa. Não junta ações diferentes, nem as sem item.
  - Instagram desconectado NÃO é "sem posts": o sistema só pode dizer "não dá pra saber". Frase de presença externa sem dado vira hipótese rotulada (ou cai no texto do código). "Sem post no Sales Boost" continua valendo quando um fato diz isso. `OPP_PROMPT_VERSION` 4 → 5.
- **Nada é descartado automaticamente:** as oportunidades velhas que já estão na fila continuam lá. Limpeza só com uma 2ª autorização do dono.
- **Não publicado:** só código e testes (`scripts/test-opportunity-merge.mjs`, `scripts/test-opportunity-engine.mjs`). Sem migration, sem deploy.
- **Divergência registrada:** a frase convertida em hipótese põe só a 1ª letra em minúscula (não a frase toda), para não estragar nomes de bairro.

## 2026-11-06 — Diagnóstico: perguntas com mais de uma resposta (dono, feedback de cliente)
- **Motivo:** um cliente disse que algumas perguntas deveriam aceitar 2 ou mais respostas.
- **Divergência que foi encontrada:**
  - 3 perguntas já aceitavam várias respostas (tipos de imóvel, padrão, serviços), mas a tela não avisava.
  - O aviso "(até N)" só aparecia quando havia limite.
- **Tela** (`QuestionField`, que vale no diagnóstico, no /setup e em Configurações):
  - pergunta de várias respostas mostra "(pode marcar mais de uma)" ou "(marque até N)";
  - o limite é de verdade: as outras opções ficam apagadas e aparece "Você já marcou N. Para trocar, desmarque uma.";
  - a gravação também corta no limite.
- **Ficha `imoveis_rio`** (migration `20261106130000_diagnostico_multipla.sql`, aplicada só depois do merge e da publicação do site):
  - **faixa de preço e faixa de aluguel:** até 3 respostas;
  - **"E depois disso?"** (`prioridades_secundarias`) entra no diagnóstico e não repete a prioridade principal (`exclude_from`);
  - **papel e gasto por mês:** continuam com 1 resposta.
- **Respostas antigas:** nunca são apagadas nem convertidas.
  - Uma resposta em texto (de quando a pergunta era de escolha única) continua gravada como está e aparece marcada na tela.
  - Ela só vira lista quando a própria pessoa mexe na pergunta.

## 2026-11-05 — Gate da Fase 2 — resultado: APROVADA PARCIALMENTE
- **Cobertura:** só Tespon e Teste Zero foram processadas. Ana Souza é conta vitrine e não foi processada.
- **Coleta: OK.**
  - Teste Zero: 15 achados, 2 aceitos, US$ 0,032.
  - Tespon: 31 achados, 8 aceitos, US$ 0,064.
  - Mês: US$ 0,128 de US$ 0,32; teto US$ 5.
- **Qualidade do sinal:** dos 10 aceitos, 2 úteis (lançamento Claris da Tegra; turismo Riotur), 1 duplicado de tema, 1 insuficiente e 6 irrelevantes (páginas de agência, listagem, guia e metrô). A história do quiosque apareceu duplicada em 2 sites.
- **Falsos negativos:** só dá pra auditar em parte (5 amostras por empresa).
- **Motor de oportunidades: REPROVADO.**
  - Inventou o período de 60 dias ("no catálogo há mais de 60 dias", item de 3 dias, com 7 peças prontas ignoradas).
  - Ainda não saiu oportunidade a partir dos sinais novos. Em 05/11 às 18:17 UTC a Tespon recebeu 502 da IA, e a Teste Zero foi barrada pela regra de 24h por 18 segundos.
- **Bloqueios, em ordem:**
  1. Porta de evidência (este PR; ver PITFALLS "Opportunity Engine inventou período").
  2. Regras de filtro por setor: bloquear página de listagem, catálogo e institucional, mantendo lançamento e expansão de concorrente. É mudança de configuração em `vertical_playbooks` por migration de dados, aguardando as regras do dono.
  3. Deduplicação semântica entre sites.
  4. Guardar o motivo do descarte e ampliar a amostra auditável.
- **À parte:** investigar o 502 da IA (Tespon).
- **Decisões deste PR:** peça pronta não publicada NÃO vira oportunidade de lacuna (a fila de aprovação já mostra); item com menos de 7 dias não é lacuna; oportunidade não validada não entra na fila (fica em `market_intel_runs.details.not_validated`, no log e no retorno).
- **05/11 noite — oportunidade de mercado não vira "aprove as peças prontas" (dono autorizou):** na rodada da Teste Zero (22:08 UTC, v47) a oportunidade de `market_change` saiu centrada em aprovar/publicar as 7 peças prontas, que já estão na fila de Aprovações. Correção: regra 9 no prompt (`OPP_PROMPT_VERSION` 3) + trava no código (`isBacklogCentric`/`mentionsBacklog` em `opportunityOutput.ts`): se título, problema ou ação de um `market_change` girar em torno das peças prontas, o texto cai no padrão do código, que parte do sinal de mercado. Sem migration, sem dado alterado; vale depois de publicar a `marketing-ai`. Rollback: republicar a `marketing-ai` a partir de `5eb30a0`.
- **Correção 2 (05/11 noite, dono autorizou) — oportunidade de mercado só com sinal forte.** Na rodada real das 22:29 UTC (prompt v3) a Tespon e a Teste Zero geraram oportunidade de mercado a partir de aviso de serviço do metrô, conteúdo patrocinado do O Globo, guia genérico de bairro e uma obra de quiosque embargada contada como 2 fontes. Os 5 critérios do dono: **evidência** (a oportunidade parte de um fato com fonte, não de contexto), **relevância** (tem que mexer com o mercado de imóveis), **conexão** (ligada a itens do catálogo na mesma região), **ação** (uma tarefa concreta, sem repetir a de outra oportunidade) e **diferenciação** (a mesma notícia em dois sites é um evento só). O que mudou:
  - **Forte × fraco** (`signalStrength` em `marketNews.ts`, regras na ficha): fraco = link patrocinado ou guia genérico, título de aviso de serviço/embargo/acidente, ou obra/transporte sem nenhum termo de impacto no texto. Vale até para domínio de confiança (antes ele pulava todas as regras). Fraco nunca é apagado nem reprovado: fica gravado (`meta.strength`, `meta.weak_reason`) e contado em `flagged` (`weak_*`). O motor recalcula a força com a ficha de hoje, então vale também para sinal já coletado.
  - **Só vira oportunidade de mercado com pelo menos 1 evento forte** na região. Sinal fraco entra como contexto rotulado ("evidência fraca"), não conta como evidência nem como fonte independente.
  - **Evento único** (`groupEvents`): títulos com palavras em comum (Jaccard >= 0,5 ou >= 3 palavras) viram um fato só, "<site> (+ também publicado em <site2>)", uma origem.
  - **Fonte independente** no `market_change` = eventos externos fortes (catálogo, peças e posts nunca contam); confiança "alta" exige >= 2 eventos fortes. Os outros tipos mantêm a contagem antiga.
  - **Tarefa repetida:** mesmos itens + mesma ação (ex.: "Adicionar fotos reais...") = fica a de melhor posição, a outra vai para `not_validated` ("Mesma tarefa da oportunidade #N"), e o ranking é refeito.
  - **Descrição** do `market_change` sem frase sobre peças preparadas/aguardando publicação (pode ficar vazia).
  - **Prompt v4:** fato fraco marcado `[fraca]` e proibido como base; a IA responde 5 perguntas (`answers`: o que mudou, por que importa, quem é afetado, o que fazer, qual evidência). `market_change` sem as 5 respostas vai para `not_validated`. As respostas não são gravadas no banco (sem mudança de tabela).
  - **Ficha v3** em `supabase/migrations/20261106120000_market_intel_quality_v3.sql`: **NÃO aplicada**; só roda depois do merge do PR (o merge é a aprovação). Sem ela o código novo trata tudo como forte. Rollback (volta à v2) está comentado no próprio arquivo.

## 2026-11-04 — Escolha de aprovação passa a morar na página Aprovações (dono)
- **Mudança:** "Pedir aprovação / Executar automaticamente" saiu de Configurações e foi para o topo da página **Aprovações** do menu.
- **O que não muda:**
  - é o mesmo componente (`AgentConfigTab`, modo `compact`) e grava a mesma coluna (`companies.agent_automatic_mode`);
  - os links antigos `?tab=agentes` e `?tab=aprovacoes` redirecionam para `/dashboard/aprovacoes`.
- **Texto corrigido para dizer o que o código faz:**
  - publicar no Instagram sempre espera o clique do dono;
  - as respostas automáticas a comentários e DMs seguem a regra de cada automação, não esta opção.
  - O texto antigo dizia que "enviar mensagem" também confirmava com o dono, o que não é verdade quando a automação está como automática.
- **Risco técnico registrado** em [PITFALLS.md](PITFALLS.md): não há trava independente de publicação dentro da function.
- **Ordem combinada:** PR A (este) → QA A → aprovação do dono → PR B (Atividade dentro do sino) → QA B → um único deploy do site.

## 2026-11-04 — Marketing AI profissional + Fábrica de Agentes 3D: arquitetura aprovada, execução condicionada ao gate da Fase 2 (dono)

**Decisão (texto do dono):**
> O plano de profissionalização do Marketing AI e da Fábrica de Agentes 3D está aprovado como camada de visualização do sistema existente. A preparação de design, documentação e critérios de aceite pode avançar imediatamente, sem alterações no código de produção.
>
> A execução começa somente após a avaliação do gate da Fase 2. Se aprovado, inicia-se pelo PR 1 (Bento), seguido do PR 2 (fábrica estática com estados reais) e do PR 3 (movimento orientado por eventos reais).
>
> Nenhuma etapa poderá criar funcionalidades comerciais, agentes, tabelas ou complexidade adicional fora do escopo aprovado.
>
> A prioridade central do Sales Boost continua sendo identificar oportunidades comerciais relevantes e ajudar a imobiliária a transformá-las em ações e demanda.

**O resultado do gate da Fase 2 decide a ordem:**

| Resultado do gate | O que fazer |
|---|---|
| Passou | Começar o PR 1 (Bento). |
| Passou em parte | Corrigir primeiro o que impede a validação. |
| Falhou | Concentrar na qualidade da inteligência de mercado. |

Em qualquer um dos casos:
- O PR 2 só começa com as condições de uso (abaixo) registradas.
- O PR 3 só começa com o PR 2 juntado e validado.

**Hierarquia da tela:**
- **A. Inteligência do negócio (Bento):** o valor comercial, a parte mais importante.
- **B. Fábrica 3D:** a operação dos agentes.
- **C. Cards de cada agente:** continuam como estão.

**Regras da fábrica (resumo; o plano completo foi aprovado na sessão de 04/11):**
- **Estações:** são as 5 que já existem — Inteligência de Mercado, Motor de Oportunidades, Agente de Estratégia, Ativação, Resultados e Aprendizado. Nenhum agente novo.
- **"Processando" só com execução real gravada.** Hoje isso existe só em `agent_actions.execution_status = EXECUTING`.
  - As outras estações mostram a última rodada e "atualizado às HH:MM".
  - `QUEUED` aparece como "Agendada", "Na fila" (até 10 min depois do horário) ou "Atrasada" (passou de 10 min), nunca como "Processando".
- **Selo de maturidade em cada estação,** que só muda quando o gate correspondente for aprovado aqui:

  | Selo | Estações |
  |---|---|
  | Operacional | Mercado e Estratégia |
  | Em validação | Oportunidades e Ativação |
  | Aguardando dados | Resultados |

- **Movimento só com evento real.**
  - Cada evento tem uma identificação única (`tabela:id:estado`) e anima uma vez só, mesmo depois de recarregar a página ou de o tempo real reconectar.
  - Um evento que acontecer durante a queda da conexão precisa aparecer depois que ela voltar.
- **Releitura que falha mantém o último dado bom,** marcado como "desatualizado". Nunca é mostrado como dado atual.
- **Teste de falha:**
  - É uma linha descartável em `agent_actions`, na Teste Zero, já gravada como `FAILED`, com `source='test_factory'`. Não pode ser executada nem publicar nada.
  - A evidência vai para `qa-relatorios/`. A linha é apagada depois do teste, e nenhum registro real é alterado.
- **Sem backend novo, sem migration e sem tabela nova.**
  - As tabelas fora do tempo real (`growth_opportunities`, `market_signals`, `market_intel_runs`, `marketing_ai_strategies`) são relidas quando a aba volta a ficar visível e a cada 10 min.
- **Desempenho é meta, não garantia:**
  - 50 quadros por segundo ou mais medidos em aparelhos de referência;
  - nenhum laço de desenho com a cena parada;
  - three.js carregado à parte;
  - versão 2D no celular e quando não houver WebGL.

**Condições de uso da referência 3D** (`agentic-factory-3d.tsx`, repositório `github.com/eugeneshilow/agentic-3d-templates`, conferido em 04/11/2026):
- **Origem da permissão:** está no README do repositório. Trechos:
  - "Licensed for use in your own projects, personal or commercial, including sites you build for clients."
  - "Redistributing or reselling the templates themselves, as templates or starters, is not permitted."
- **Sem licença formal identificada:** o repositório não tem arquivo LICENSE. Não é licença open source (nem MIT nem Apache).
- **O que é permitido:** uso interno no Sales Boost, nos termos publicados. O README não exige atribuição.
- **O que é proibido:** redistribuir ou revender o template.
- **Antes do PR 2:** conferir de novo o README. Se os termos mudarem e deixarem de permitir o uso, a cena é escrita do zero, só inspirada na ideia.
- **No código:** o PR 2 terá um comentário com a origem.
- **Conteúdo fictício do original:** nomes, valores como "$29" e filas inventadas não entram na tela, pela regra 5 (nunca inventar números).

## 2026-11-04 — Reconciliação dos gates: Fase 3 implementada antes do gate completo da Fase 2 (dono)

**O que de fato foi aprovado em 04/11:**
- **Só a troca do filtro de `audit` para `enforce`** (decisão "Ativar e apertar", PR #103). Ela se apoia na medição de qualidade da
  classificação descrita na entrada seguinte ("Gate da Fase 2"): 67 sinais, 0 falso positivo.
- **A saída da Fase 2 NÃO foi aprovada.** Ainda faltam:
  - o custo medido numa coleta real (`market_intel_runs`, fase `collect`, a partir de 05/11);
  - oportunidades que passem nas 5 perguntas. As 12 mais recentes reprovaram.

**A Fase 3 foi implementada antecipadamente** (PR #104), por decisão do dono de construir no mesmo dia.
- **O que está provado:**
  - a trava de aprovação na Teste Zero (proposta em `needs_review`, com a estratégia ativa idêntica à de antes do teste);
  - os testes de código.
- **A saída da Fase 3 continua NÃO aprovada.** Ela depende:
  - do gate completo da Fase 2;
  - do plano semanal de domingo (temas com `market_context` apontando para sinais reais);
  - da avaliação comercial do dono sobre os temas.

**Regra operacional (dono):**
- Trabalho antecipado em fases futuras (3, 4 e 5) não autoriza expandir o escopo nem considerar a fase concluída.
- A prioridade de execução continua sendo a ordem oficial (Fase 2 → 3 → 4 → 5).
- Nenhuma funcionalidade nova além dos planos já aprovados enquanto os gates anteriores não estiverem comprovados.
- O que já foi construído é só terminado e revisado.

**Interpretação do teste de valor comercial (dono):**
- Não concluir que uma oportunidade não gera resultado só porque não apareceu lead.
- Para cada ação, registrar:
  - volume de distribuição (posts publicados, alcance);
  - período de exposição;
  - ações realizadas;
  - feedback dos corretores.
- Distinguir três situações:
  - **falta de distribuição:** pouco alcance ou pouco tempo no ar;
  - **falta de execução:** a ação não foi feita, ou o corretor não respondeu;
  - **falta de interesse comercial:** houve distribuição e execução, mas não houve resposta.

## 2026-11-04 — Gate da Fase 2: medição e troca do filtro para `enforce` (dono: "Ativar e apertar")

**Como foi medido.** A reclassificação (`cron_market_intel`, sem custo: não busca nem usa IA) rodou à mão às 14:49 UTC nos 67 sinais
automáticos já gravados (Tespon 39, Teste Zero 28). Cada sinal foi classificado à mão como útil, duvidoso ou lixo. O veredito do filtro foi
reproduzido localmente com o próprio `classifySignalQuality` e bateu exatamente com o que ficou gravado em `market_intel_runs`.

| | v1 (audit) | v2 (enforce) |
|---|---|---|
| Lixo barrado | 33 de 46 | **46 de 46** |
| Notícia útil ou duvidosa barrada (falso positivo) | 0 de 21 | **0 de 21** |
| Lixo que ainda passa | 13 (anúncio de lançamento sem "venda", Booking, Skyscanner, app de shopping, depósito de bagagem, vale-transporte, Threads) | 0 |

- **Precisão do que passa:** v1 = 14 úteis + 7 duvidosos + 13 lixos em 34; v2 = 14 úteis + 7 duvidosos em 21.
- **Duplicados:** o recorde de turistas estrangeiros veio de 4 sites, e o "Oscar do Turismo" de 2. O filtro não junta a mesma notícia em
  portais diferentes; fica como limitação conhecida (sem regra nova agora).
- **Custo:** reclassificação = US$ 0. O custo por rodada de coleta passa a ser gravado em `market_intel_runs` a partir de 05/11, porque a
  coleta de 04/11 rodou antes da `marketing-ai` v43.
- **Oportunidades contra as 5 perguntas: reprovadas.** Das 12 mais recentes, 8 são "imóvel sem post há 60 dias" (lembrete interno, repetido
  quase todo dia), e 4 usam o mercado de forma vaga. Uma delas foi montada a partir de anúncios-lixo ("Concorrência visível no Leblon").
  Nenhuma usou as notícias boas que existiam (aluguel acima da inflação, recorde de turismo, metrô da Gávea, estúdios no alto padrão). O filtro
  em `enforce` tira o lixo da entrada do motor; a qualidade das oportunidades é medida de novo depois das próximas rodadas.
- **Decisão:** ficha v2 em `enforce` (migration `20261104150000_market_intel_quality_v2.sql`; regras e reversão no cabeçalho). As amostras
  ficam travadas em `scripts/test-market-news.mjs`. **A Fase 2 não fecha aqui:** o critério de saída pede custo medido na coleta e oportunidades
  que passem nas 5 perguntas.

## 2026-11-04 — Critérios de decisão (dono): princípio orientador, gate da Fase 2 e critérios de saída

**Princípio orientador do roadmap:** o diferencial do SalesBoost não será ter mais agentes, telas ou funcionalidades — será identificar algo
relevante no mercado, entender por que aquilo importa para uma imobiliária e transformar essa informação numa ação comercial que gere
resultado. **Não adicionar funcionalidade nova** antes de provar que a inteligência gera valor comercial. A arquitetura aprovada não muda.

1. **Gate de qualidade da Fase 2 (audit → enforce).** Só passar a `enforce` com critérios objetivos, medidos com SQL de leitura na Tespon e
   Teste Zero (`market_intel_runs`, `market_signals`) e registrados aqui: precisão dos sinais comercialmente relevantes; falsos positivos
   (notícia boa barrada); duplicados/sem mudança; custo por rodada e acumulado; se surgem oportunidades que merecem a atenção de uma
   imobiliária. Coleta funcionando tecnicamente não basta.
2. **Sinal ≠ tendência ≠ oportunidade.** Sinal = informação coletada de uma fonte. Tendência = padrão identificado a partir de um ou mais
   sinais. Oportunidade = possibilidade comercial concreta para **esta** imobiliária. Ex.: sinal "mais notícias de investimento na região X";
   tendência "interesse comercial crescendo em X"; oportunidade "a imobiliária tem imóveis adequados em X e pode fazer campanha para o público Y".
   Notícia interessante sem ação comercial plausível é informação de mercado, não oportunidade.
3. **Relevância comercial.** Toda oportunidade responde: por que importa para esta imobiliária; qual público é afetado; qual região ou tipo de
   imóvel; qual ação comercial é possível; qual evidência sustenta. Sem isso, não é oportunidade. (Na Fase 2 isso é conferido nas oportunidades
   geradas, sem código novo.)
4. **A Fase 3 não depende de oportunidades.** A estratégia define posicionamento, público e objetivos; a inteligência alimenta o contexto; a
   oportunidade só acelera ou modifica ações específicas, quando justificada; o plano semanal funciona mesmo sem nenhuma oportunidade.
5. **Teste de valor comercial já nas Fases 2–4** (avaliação controlada com Tespon e Teste Zero, manual, sem dashboard nem banco novo):
   oportunidades que a imobiliária considera relevantes; oportunidades que viraram ação; ações que geraram conversa ou lead; feedback de
   corretores e gestores.
6. **Critérios de saída por fase** (uma fase não fecha só porque o código foi implementado):
   | Fase | O que precisa estar comprovado |
   |---|---|
   | 2 | A inteligência coleta informação relevante, com custo e qualidade controlados. |
   | 3 | A inteligência influencia o direcionamento sem alterar o posicionamento automaticamente. |
   | 4 | O sistema conecta estratégia a imóveis reais e executa sem divulgar imóvel indisponível. |
   | 5 | É possível relacionar ações de marketing a resultados comerciais verificáveis. |

**Forma de reportar ao dono:** mudança de status → só o que mudou (PR, deploy, testes, resultados); mudança de arquitetura ou prioridade → só a
seção atualizada; revisão geral → o roadmap completo.

## 2026-11-04 — Pacote B2 (ações novas): menu do "+", ignorar sinal, ignorar tendência, "Ver evidência"

**O que mudou:**
1. **Botão "+" vira menu** (`PlusMenu.tsx`, `plusOptions.ts`, `usePlusOptions.ts`): Adicionar `<item>` (rótulo vem da ficha) · Gerar peça agora · Adicionar sinal.
   Cada opção só aparece se funciona de ponta a ponta, checado **ao abrir o menu** (não no carregamento): "Gerar peça" chama `make_now_options` (cache ~60 s); vitrine
   não chama; 402 e zero formatos usáveis somem; falha de rede mostra "Não foi possível verificar"; formato de imóvel sem imóvel com ≥ 5 fotos não conta (o servidor
   devolveria 400) — `MakeNowPicker` usa a mesma regra. "Adicionar sinal" só com `opportunity_fields.location` na ficha (nada de setor fixo no código). "Gerar peça agora" mantém
   o aviso de custo e o teto de sempre, sem confirmação extra (decisão da sessão principal). O atalho `sb:open-add` (sino/estratégia) continua direto no Catálogo.
2. **Ignorar sinal** (sem migration): `market_signals.meta.ignored/ignored_at`, mesclando a meta; ignorados saem da lista, do motor de oportunidades, do gatilho do cron e das
   contagens, e ficam num bloco "Ignorados (N)" com a evidência completa e "Restaurar". "Apagar" continua existindo.
3. **Ignorar tendência**: migration aditiva `20261104100000_trends_ignore.sql` (`status` active|ignored + `ignored_at`; o dono só atualiza essas 2 colunas). A varredura semanal
   (`creative-ideas`) não apaga a ignorada e não recria título igual (normalizado). Bloco "Tendências ignoradas (N)" com "Restaurar".
4. **Card de tendência** (`marketingAi/TrendCard.tsx`, extraído de `CreativeAgent`): "Ver evidência" é a ação principal e mostra só o que existe (origem pelo `source`, data,
   categoria, relevância, descrição completa; link só se a descrição trouxer http(s) válido) e a linha honesta "Os posts lidos nesta varredura não ficaram guardados". "Fazer carrossel"
   virou secundária (mesma ação) e "Ignorar", terciária. A `TrendCard` de `MarketIntelTab.tsx` (outra coisa) não mudou.

**Divergências com o plano:** a função pura do menu mora em `plusOptions.ts` (e não em `usePlusOptions.ts`) para o teste em Node importá-la sem o supabase; "Peças avulsas" não tem rota
própria — o link leva a `/dashboard/marketing-ai/content` (Calendário, bloco "Peças avulsas"). Em vitrine, "Ignorar" mostra cadeado e abre o modal de plano.

**Migration aplicada em produção em 2026-11-04** (conferido por SQL: colunas `status` default 'active' e `ignored_at`; UPDATE de `authenticated` só nessas 2 colunas; policy de UPDATE criada; 24 tendências existentes ficaram 'active').

**Pendente (sessão principal/dono):** depois do merge, deploy de `creative-ideas`, `data-agent`, `marketing-ai`/`cron_opportunities` (quem importa `opportunityRun`/`opportunityCron`) e
publicar o site (ordem e motivo em PITFALLS). Conferir por SQL de leitura que o filtro `.or` duplo do `useDecisionKpis` devolve a mesma contagem de antes quando nada está ignorado.

## 2026-11-04 — Pacote B1 (relações existentes, só tela): atividade do imóvel, origem do lead, tela de oportunidades

**O que mudou (tudo na tela; sem migration, sem function, sem cron):**
1. **Catálogo, "Ver atividade"** no card do imóvel (`ItemActivity.tsx` + `useItemActivity.ts`). Só consulta quando o dono abre. Mostra peças (em teste e já
   aprovadas, com data e estado; a peça em teste abre o mesmo modal do calendário), oportunidades (`growth_opportunities.item_ids`) e leads
   (`leads.item_id`). Cada bloco tem o seu estado: carregando / "Nenhuma … ligada" (ausência, não é erro) / "Não foi possível verificar". Os rótulos de estado da
   peça em teste (`STATUS_META`) saíram do calendário para `shared.ts` e são a fonte única. A página pública continua no botão "Página pública".
2. **Funil, "Origem"** no card do lead (`leadOrigin.ts`): imóvel + canal do link da página pública (legenda/DM/bio) quando há `link_id`; oportunidade só
   com `opportunity_id`; nada disso → "Origem não registrada". Consulta auxiliar que falha (ou colunas novas ausentes) → "Não foi possível verificar", nunca "não registrada".
3. **Oportunidades:** formulário de sinal manual recolhido ("Adicionar sinal manual"; a lista de sinais salvos continua visível). O texto de "sinal
   salvo" citava o botão inexistente "Encontrar oportunidades" e um intervalo de 90 s; agora descreve o que o código faz (`opportunityCron.ts`: o
   agendamento roda a cada 6 h; faz nova rodada se entrou sinal depois da última, com no mínimo 24 h entre rodadas, e de qualquer forma após 7 dias).
   O texto avisa que isso vale quando a análise automática está ligada na conta (o cron só roda p/ empresas com `auto_strategy=true`, plano ativo e ficha com o motor de oportunidades).
   "O que falta pra achar mais" ficou recolhível e apagado.
4. **Origem no funil:** com o select novo em fallback (colunas não lidas) a origem é sempre "Não foi possível verificar"; enquanto as consultas auxiliares não voltam, "Verificando…". Teste: `scripts/test-lead-origin.mjs`.

**Limitação registrada (não resolvida de propósito):** o funil **não mostra a peça de origem** do lead. `tracked_links` é único por (imóvel, oportunidade,
canal) e `content_id` guarda só a primeira peça que criou o link; vários posts com o mesmo imóvel/canal compartilham o mesmo link. Por isso **não se
atribui peça ao lead por inferência a partir de `tracked_links.content_id`**. Só entra "peça de origem" quando existir uma relação confiável (ex.: link por
peça), o que seria mudança de modelo — fora do B1.

**Conferências pendentes (dono/QA):** contagens do bloco = SQL só leitura na Tespon e na "Teste Zero"; depois do merge, verificar o bundle publicado antes do "Site publicado ✅".

## 2026-11-03 — Pacote A (orientação, só tela): regras do Tipo de ativação e do Objetivo

**O que entrou:** hub "O que merece sua atenção" (4 linhas com estado próprio) e cards de agente enxutos; topo da Estratégia em 4 blocos; Objetivo + Tipo na célula e no modal do calendário. Sem migration, sem function, sem cron.

**Medição (SQL somente leitura, Tespon + Teste Zero, peças do calendário, 03/11):** `familia` educativo nunca tem `item_id`; tour/oferta/bairro sempre têm `item_id` (bairro = a receita "3 coisas perto"); `eventual` não aparece; existem peças antigas com `familia` nula; 1 peça de oportunidade (educativo + `opportunity_id`, `intent` sem `funnel.objective`). Produtores com imóvel (`catalog-package`, `item_video`) sempre gravam `item_id`.

**Tipo de ativação (ordem de precedência; `activationType.ts`, testado em `scripts/test-activation-type.mjs`):**

| # | Condição | Tipo |
|---|---|---|
| 1 | `opportunity_id` e a oportunidade existe na empresa com `status='approved'` (mesmo com imóvel) | Oportunidade |
| 2 | `opportunity_id`, mas oportunidade não achada ou não aprovada | Tipo não identificado |
| 3 | consulta de oportunidade falhou (e a peça tem `opportunity_id`) | Não foi possível verificar |
| 4 | `familia` nula ou fora da lista | Tipo não identificado |
| 5 | tour / oferta / bairro com `item_id` (sem `item_id` = não identificado) | Apresentação de imóvel |
| 6 | educativo com `item_id` / sem `item_id` | Educativo com imóvel / Educativo sem imóvel |
| 7 | eventual | Tipo não identificado |

Sem nome de receita nem de setor no código (regra 6). **Objetivo:** `intent.funnel.objective` (rótulo "Objetivo da etapa do funil"); senão `intent.opportunity.objective` ("Objetivo da oportunidade"); senão "Sem objetivo registrado".

**Próxima ação do hub (sim / não / desconhecido por verificação):** sem estratégia ativa → oportunidade `suggested` → peça para aprovar (`kpis.actionsReady`) → semana sem peças (estratégia ativa e 0 peças com `planned_for` de hoje a hoje+6, `source_id` nulo) → "Tudo em dia". Verificação desconhecida antes de achar um "sim" = "Não foi possível verificar"; "Tudo em dia" só com as 4 em "não".

**Motivo da escolha do imóvel:** não existe campo por peça; a tela diz que não é registrado (nunca inventa "rodízio"). Isso é da Fase 4.

- **Setor piloto: imóveis, Rio de Janeiro** — ICP corretor autônomo/
  imobiliária pequena. Motivo: mercado concentrado, decisor único, ticket
  que justifica o setup, e já existia relação (Liga dos Sonhos como
  cliente real adjacente).
- **Só Instagram por enquanto** — WhatsApp/E-mail ficam pra depois (ver
  Fase 4 em [ROADMAP.md](ROADMAP.md)). Motivo: foco — um canal bem feito
  antes de espalhar.
- **Fichas de setor como dado (`vertical_playbooks`), nunca código
  específico de setor** — 2026-09-29. Motivo: qualquer setor novo (de
  imóveis pra procedimento estético, por exemplo) precisa ser só uma ficha
  nova, nunca um sistema novo. Teste de sanidade registrado em
  [PRODUCT.md](PRODUCT.md).
- **O corretor responde o onboarding** (faixa de preço, bairros, cliente
  típico, CRECI) — pular pergunta usa padrão médio, nunca trava o fluxo.
- **Único provedor de criativos: Higgsfield** — 2026-10-01. Motivo:
  cobre image-to-video, text-to-video e speech-to-video numa API só; fica
  atrás de um roteador pra trocar/somar provedor sem refazer o resto do
  pipeline.
- **Criativos sempre a partir de fotos reais do cliente + brief da
  estratégia** — nunca o Higgsfield decide sozinho o que criar; o Content
  Agent sempre escreve o brief antes.
- **Tour virtual como carrossel de vídeos** (não um vídeo montado único,
  salvo se a API permitir como opção) — mais simples de publicar com o
  publicador de carrossel que já existe.
- **Avatar e voz do corretor ficam pra depois** — não fazer agora (ver
  Futuro em [MEDIA-ENGINE.md](MEDIA-ENGINE.md)).
- **Foto do imóvel é sempre real** — regra inviolável (ver CLAUDE.md).
  Nunca a IA desenha o item de verdade; imagem gerada por IA só pra
  cena de bairro/marca.
- **Estratégia automática com tese estável** — 2026-09-30. Reavaliação
  semanal pode AJUSTAR o plano tático (`refresh`), mas a tese só muda
  (`generate`, estratégia nova) em PIVOT/TERMINATE real ou pedido
  explícito do dono. Motivo: evitar que o produto fique "mudando de
  ideia" toda semana — a tese precisa de tempo pra provar se funciona.
- **Liga dos Sonhos fora do automático** — `companies.auto_strategy =
  false` pra essa empresa até o dono decidir ligar. Motivo: é cliente real
  em produção, qualquer automação nova entra com cautela extra ali.
- **@getsaleboost usado em testes, só com conteúdo real sobre o próprio
  Sales Boost** — 2026-10-01. Contexto: a conta oficial pública do Sales
  Boost foi conectada por acidente numa empresa de teste durante a
  investigação de um bug de domínio; o agente de desenvolvimento
  desconectou automaticamente (seguindo a regra geral "desconecte se não
  for conta de teste"), o que gerou confusão quando o dono reconectou de
  propósito pra testar o carrossel. **Decisão:** usar @getsaleboost é
  aprovado para teste, mas só com conteúdo verdadeiro sobre o próprio
  Sales Boost (nunca um imóvel fictício) — e o agente não deve desconectar
  essa conta sozinho enquanto esse uso estiver em andamento.
- **Calendário semanal** como unidade de planejamento (dono aprova 1x/
  semana), não diário nem mensal.
- **Deploy sempre confirmado** — depois de mudar telas, publicar o site
  (`npm run build && npx wrangler deploy`) e confirmar "Site publicado em
  getsaleboost.com ✅" no relatório. Regra inviolável (ver CLAUDE.md).
- **Alterações arriscadas exigem aprovação prévia do dono** — lista
  completa em CLAUDE.md. Nenhum agente pula essa parada pra "economizar
  tempo".
- **Modo autônomo pausado; trabalho por etapas comandadas pelo dono** —
  2026-10-06. A rodada seg/qua/sex foi desligada automaticamente em
  05/10 (`auto_disabled_org_disabled`: a organização não permitiu a rotina
  com o conector Supabase) e o relatório de sexta foi desligado a pedido do
  dono. Daqui em diante o dono escolhe qual etapa do
  [ROADMAP.md](ROADMAP.md) seguir e a sessão executa (product → engineer →
  qa), um PR por assunto. As regras de segurança do modo autônomo continuam
  valendo pra qualquer agente. **Isto suspende** o item abaixo; as rotinas
  ficam guardadas (desligadas) pra religar se o dono quiser.
- **Agentes de desenvolvimento trabalham sozinhos, mas nunca publicam** —
  2026-10-02. O dono pediu que `product` → `engineer` → `qa` evoluam o
  projeto sem precisar de prompt. Princípio: **autonomia pra trabalhar ≠
  autonomia pra publicar.** Rotina automática seg/qua/sex de manhã (1
  tarefa por rodada) + relatório semanal sexta 18h. O agente só abre PR;
  merge (e o deploy que vem com ele) é sempre do dono. Se não houver
  tarefa claramente segura e bem definida, o agente não inventa trabalho
  — não faz nada e diz isso no relatório. Regras operacionais completas
  em [ORCHESTRATION.md](ORCHESTRATION.md#modo-autônomo-rotina-agendada).
  **Isto substitui** a regra anterior "agentes não rodam sozinhos até o
  P4 existir" — o P4 passa a ser construído junto (ver
  [ROADMAP.md](ROADMAP.md#p4--infra-de-autonomia)). Banco de ensaio:
  segundo projeto grátis do Supabase (`salesboost-ensaio`), não o recurso
  pago de cópia — reavaliar depois que o fluxo provar que funciona.
- **Teste grátis de 7 dias + plano único de R$1.449/mês** — 2026-10-02
  (**SUBSTITUÍDA em 2026-10-06 pelo modelo de acesso grátis + preço novo,
  ver entrada "Preço e acesso grátis" no fim deste arquivo — mantida aqui
  como histórico; o código ainda reflete esta até a nova ser construída**),
  decisão do dono. Substitui o teste de 3 dias (`TRIAL_DAYS = 3` em
  `src/lib/trialState.ts`) e as faixas R$197–697 de
  [PRODUCT.md](PRODUCT.md). Público-alvo por agora: corretores e
  imobiliárias. No teste, 1 vídeo real (o único que chama a API de vídeo);
  os demais aparecem como prévias travadas, sem custo de API. Detalhes em
  [PRODUCT.md](PRODUCT.md#modelo-de-cobrança--decidido-2026-10-02). Motivo:
  o cliente precisa ver a inteligência real e uma prova de execução, não
  uma demo limitada; o preço posiciona como departamento de crescimento,
  não como créditos de IA. Ordem de construção: (1) testar Higgsfield com
  fotos reais, (2) teste de 7 dias, (3) fluxo do vídeo + prévias, (4)
  relatório e tela de assinatura.
  **Status do passo 2 (tela, 2026-10-02):** `src/lib/trialState.ts` agora
  deriva o total de dias de `trial_started_at`/`trial_expires_at`
  (`TRIAL_DAYS = 7` só como padrão); estados `trial_day_1/2/3` viraram
  `trial_active` e `TrialInfo` ganhou `totalDays`. Trials antigos de 3
  dias seguem mostrando "Dia X de 3". **Divergência conhecida:** a edge
  function `claim-diagnostic` ainda grava 3 dias ao criar trial novo até
  ser deployada com a mudança (precisa de aprovação do dono); o worker
  `vendas-bot` e o preço (`PLAN_PRICE` em `TrialSummaryPage`, passo 4) não
  foram tocados.
- **PR aprovado libera o agente a alterar o banco real** — 2026-10-02,
  pedido do dono. A aprovação do PR (merge feito pelo dono) **é** a
  aprovação da mudança no banco de produção (`miwcxakzyforbahpnpst`) que
  está nele. Depois do merge, o agente aplica em produção exatamente o
  SQL do PR — nada além. Antes disso, nunca. Condições e passo a passo em
  [ORCHESTRATION.md](ORCHESTRATION.md#banco-de-produção-depois-do-pr-aprovado).
  Motivo: o dono não é desenvolvedor e não deveria ter que rodar SQL à
  mão; a revisão dele acontece no PR. **Isto ajusta** a regra anterior
  "mudança de estrutura fica marcada 'precisa de você' pro dono aplicar
  em produção".
- **7-Day Growth Preview, passo 3 (vídeo grátis) — gatilho provisório e
  trava** — 2026-10-02. Parte A (só tela + tabela): "Seu vídeo grátis — em
  breve" e até 3 prévias borradas/travadas no resumo do trial, sem chamar
  nenhuma API de vídeo. A prévia **não cita preço** ("Disponível no plano
  completo") até o passo 4, pra não conflitar com o preço antigo
  (R$14,49) ainda na tela. O gatilho de quando o vídeo grátis é gerado é
  **provisório** (a definir na Parte B). A trava de 1 vídeo por teste vive
  na tabela `trial_video_claims` (unique por empresa; só service role
  escreve). Motivo: garantir 1 vídeo por teste sem gastar à toa.

- **/setup obrigatório no fim do cadastro (contas novas sem assinatura)** —
  2026-10-06, plano aprovado pelo dono. Contas criadas a partir de
  `SETUP_GATE_FROM` (2026-10-06, `src/lib/setupGate.ts`) e sem
  `stripe_subscription_id` só entram no painel depois de: (1) dados do
  negócio (nome, cidade, telefone), (2) todas as perguntas da ficha
  (`onboarding_questions`) e (3) o mínimo de itens do catálogo com o mínimo
  de fotos reais (mesma regra do sino de pendências). Instagram vem em
  destaque, mas **opcional** ("Conectar depois") até o App Review da Meta
  sair; vira obrigatório ligando `vertical_playbooks.config.setup.
  instagram_required = true` (padrão `{ instagram_required: false,
  min_items: 1 }`; a ficha no banco NÃO foi alterada, só lida com padrão).
  O onboarding anônimo (antes da conta) continua opcional/pulável: isto
  muda só o **pós-cadastro**. As 4 empresas de produção são anteriores à
  data, então nenhum cliente atual é trancado. Se der erro ao calcular o
  status, o gate deixa passar (falha aberta). Motivo: sem dado real o
  sistema não decide bem; melhor pedir tudo uma vez, no começo.
- **Preço e acesso grátis (DECIDIDA 2026-10-06, AINDA NÃO IMPLEMENTADA)** —
  substitui o "teste grátis de 7 dias" de 2026-10-02. Em vez de prazo em
  dias: **diagnóstico grátis (Growth Score)** + **acesso grátis sem prazo
  de dias, limitado a 1 vídeo + 1 estratégia**; depois disso a conta grátis
  não gasta mais IA até pagar. Preços: mensal sem fidelidade **R$2.449/mês**;
  cupom de 1º mês **R$1.449** (depois R$2.449); anual **R$1.449/mês**. O
  cupom tem **prazo REAL de 7 dias a partir da entrega da estratégia** —
  vencido, o desconto sai de fato (prazo falso é proibido). O preço de
  referência R$2.449 é real (existe o plano mensal), então "de R$2.449 por
  R$1.449" é honesto. Pendência: a Stripe ainda precisa dos 3 itens (preço
  mensal, preço anual, cupom) — criar exige aprovação do dono. Próxima
  etapa do [ROADMAP.md](ROADMAP.md) (Growth Qualification).
  **Ajuste 2026-10-08:** o acesso grátis passou a ser diagnóstico + 1
  vídeo, SEM estratégia (só após pagar) — ver entrada de 2026-10-08.

## 2026-10-07 — Growth Score centrado no Instagram, acesso grátis e preço anual

- **(a) Growth Score centrado no Instagram (fatia 1 da etapa 2b,
  implementada em código, ainda não publicada).** A nota vem do Instagram
  coletado por scraper (Apify, actor `apify/instagram-profile-scraper`).
  Site (PageSpeed) e Google são **adendo**: se existirem somam, se não
  existirem ficam "não avaliado" e **não penalizam** (muitos corretores não
  têm site nem Google). Regra 5: critério sem dado = "não avaliado" e sai
  da conta. Pesos: frequência de posts 25 (0 posts=0, 8 ou mais=cheio),
  engajamento 25 (0%=0, 3% ou mais=cheio), formato vídeo/Reels 15 (0=0, 50%
  ou mais=cheio), perfil pronto pra vender 15, adendo site+Google 10, dados
  preenchidos 10 (só depois do cadastro). Nota = pontos avaliados ÷ pesos
  avaliados × 100. Faixas: 70+ Growth Ready, 40–69 Growth Potential, abaixo
  de 40 Growth Blocked; cobertura abaixo de 40% ou Instagram não avaliado =
  "Análise parcial", sem veredito. **Nunca projetar ganho** (nada de "você
  pode vender X% mais"). Código: `src/lib/growthScore.ts` (função pura),
  coleta em `supabase/functions/run-diagnosis`, coluna nova
  `diagnostics.instagram_data` (migration escrita, não aplicada).
- **(b) Diagnóstico exige Instagram; site é opcional.** O formulário do
  onboarding e o `run-diagnosis` pedem o Instagram (@ ou link). PageSpeed só
  roda se houver site. Proteção de custo: 1 coleta por perfil a cada 24h
  (reusa a anterior) e no máximo 3 diagnósticos por e-mail por dia.
- **(c) Plano anual: R$1.449/mês com fidelidade de 12 meses.** Cancelar
  antes do fim = multa de 30% das mensalidades restantes. A cláusula precisa
  aparecer clara no checkout. **Validar com advogado (CDC) antes de
  cobrar.**
- **(d) Cupom: o prazo de 7 dias conta de quando o cliente VÊ o popup do
  cupom**, não da entrega da estratégia — assim o desconto não vence antes
  de o cliente vê-lo se o vídeo atrasar. Ajusta a entrada de 2026-10-06 (que
  dizia "a partir da entrega da estratégia"); a anterior fica como
  histórico. O prazo continua REAL: vencido, o desconto sai de verdade.
- **(e) Promessa pública por enquanto: "diagnóstico grátis + 1
  estratégia".** "+1 vídeo" só entra no texto quando a geração de vídeo
  existir (fatia 5).
  **Ajuste 2026-10-08:** a promessa passa a ser "diagnóstico grátis + 1
  vídeo"; estratégia só após pagar (ver entrada de 2026-10-08).

**Divergências registradas nesta data:** `TrialStartModal` ainda mostra
"R$14,49" (preço errado no ar; sai na fatia 2). `claim-diagnostic` no
repositório grava trial de **7 dias** (`SignupPage.tsx`, linhas ~104-108)
enquanto parte dos docs diz 3 — conferir o que está deployado. A tela do
diagnóstico já diz "Sem prazo em dias" (decisão nova), mas o cadastro ainda
dá o teste de 7 dias até a fatia 2. O cadastro não pede cartão
(confirmado: `SignupPage` não tem pagamento).

## 2026-10-07 — Coleta do Instagram: sempre Apify com teto grátis

- **Decisão do dono: o diagnóstico usa SEMPRE a Apify, com teto mensal
  dentro do crédito grátis do plano.** Ao bater o teto, os critérios do
  Instagram aparecem como "não avaliado" (sem cobrança extra). Não trocar
  pela Business Discovery da API oficial, mesmo depois do App Review.
  O valor do teto depende do crédito grátis e do uso atual da conta Apify
  (dono vai informar). Não chutar número.
- **Motivo:** custo zero garantido sem depender da Meta. Teste de
  2026-10-07 no Graph API Explorer: a Página "Sales Boost Company" está
  ligada ao @getsaleboost (IG id `17841442836358659`) e o app lê a própria
  conta, mas `business_discovery` de outros perfis volta erro #10 (exige
  App Review).
- **App Review continua necessário** para clientes conectarem o Instagram
  no painel. Material em [META-APP-REVIEW.md](META-APP-REVIEW.md). Pedir
  só as 5 permissões `instagram_business_*` que o código usa.

## 2026-10-07 — Itens do Stripe criados no SANDBOX (modo de teste)

Conta disponível para o agente: só "Luan sandbox" (`acct_1TaTYGDHopb5YvZ5`,
modo de teste, sem dinheiro real). Criados lá:

- Produto `prod_VOnjWp0Zharpbn` "Sales Boost".
- Preço mensal sem fidelidade: `price_1UO08QDHopb5YvZ5zLcqUoJh`, R$2.449/mês,
  lookup_key `sb_monthly`.
- Preço anual com fidelidade (cobrança mensal): `price_1UO08TDHopb5YvZ572CUgxmd`,
  R$1.449/mês, lookup_key `sb_annual_commit`, metadata
  `commitment_months=12`, `early_termination_pct=30`. A fidelidade e a
  multa NÃO são feitas pelo Stripe sozinho: precisam de código nosso.
- Cupom `SB_PRIMEIRO_MES`: R$1.000 de desconto, uma vez, só nesse produto,
  sem data de validade no Stripe (o prazo de 7 dias por cliente é
  conferido no servidor antes de aplicar).

**Produção (modo real):** a conta real do Stripe ainda não está conectada
ao agente. Os mesmos itens precisam ser criados lá (pelo dono ou depois que
ele der acesso), e os IDs reais vão para os secrets do Supabase.
Usar `lookup_key` no código para não depender do ID.

## 2026-10-07 — Fim do cartão "Instagram Auto-post" (aprovado pelo dono)

Configurações → Conexões mostrava "Instagram Auto-post" com botão
Ativo/Pausado e frequência (diário/3x/semanal), prometendo publicar
sozinho todo dia às 10h. A tela não batia com o código: o único leitor
de `instagram_auto_post`/`instagram_post_frequency` é a function
`publish-instagram`, deprecada e sem chamador. Também contradizia a
regra 1 (nada vai ao ar sem aprovação) e apareceria no vídeo do App
Review. O cartão virou "Instagram · Publicação com aprovação": conectar,
reconectar, desconectar e texto dizendo que os posts só vão ao ar depois
de aprovados em Aprovações. As colunas continuam no banco (sem
migration). WhatsApp: o dono pediu para não mexer agora (o texto ainda diz
que o agente responde sozinho).

## 2026-10-07 — Teto mensal da Apify no diagnóstico (opção A do dono)

`run-diagnosis` conta as leituras pagas do Instagram no mês (cada uma
grava `apify_run` em `diagnostics.instagram_data`; cópias do cache de 24h
não contam 2x). Teto padrão **50 por mês** (sugestão aceita pelo dono ao
escolher a opção A; ajustável pelo secret `APIFY_IG_MONTHLY_CAP` sem novo
deploy). Bateu o teto: `instagram_data = {error:'monthly_cap'}` e o Growth
Score mostra o Instagram como "não avaliado". A função continua aceitando
o formulário antigo (só site, sem Instagram) para não quebrar nada entre o
deploy da função e o merge da tela nova. Ensaio não tem `APIFY_TOKEN`: lá
a leitura sempre volta "unavailable" (testado); a leitura real só é
testável em produção.
## 2026-10-08 — Landing vira diagnóstico inline; grátis = diagnóstico + 1 vídeo; estratégia só após pagar

- **Landing:** todos os botões de "7 dias grátis" viram **"Diagnóstico
  grátis"** (EN: "Free diagnosis") e rolam suavemente até a nova seção final
  `#diagnostico` (antes do rodapé): "Descubra seu Real Estate Growth Score"
  + botão "Começar diagnóstico grátis". As perguntas abrem **ali mesmo**
  (sem trocar de página) e o resultado também aparece inline. O modal
  "Seus 7 dias grátis começam agora" (`TrialModal`) e todos os textos de
  "7 dias grátis" da landing (PT e EN) foram removidos. As rotas
  `/onboarding` e `/diagnostico/:id` continuam (links compartilháveis),
  usando os mesmos componentes (`DiagnosticFlow`, `DiagnosticResult`).
- **O que é grátis:** o resultado do diagnóstico + a geração de **1
  vídeo**. A **estratégia só é feita depois que a pessoa PAGA** o plano.
  Ajusta as entradas de 2026-10-06 ("1 vídeo + 1 estratégia") e 2026-10-07
  (item e: "diagnóstico grátis + 1 estratégia"), que ficam como histórico:
  onde dizem "1 estratégia grátis", vale esta entrada.
- **Resultado do diagnóstico:** CTA "Criar conta e receber meu vídeo grátis"
  (vai pra `/signup?claim=<id>`) com texto honesto: o vídeo grátis está
  "em liberação — avisamos quando estiver pronto" (a geração de vídeo ainda
  não existe; sem prazo prometido). Sem menção a "1 estratégia grátis".
- **Servidor (escrito, NÃO deployado):** `claim-diagnostic` parou de
  disparar `strategy-generate` para empresas novas. Precisa de deploy
  aprovado pelo dono (function de cliente real). O `stripe-webhook` (PR do
  pagamento) deve disparar a 1ª estratégia ao confirmar o pagamento — até
  lá, conta nova não ganha estratégia sozinha.
  **Atualização 2026-10-08 (tarde):** deploy aprovado pelo dono ("pode
  seguir com 1 e 2") e feito em produção — `claim-diagnostic` v77.

## 2026-10-08 — Resultado do diagnóstico com foco em POTENCIAL

- Pedido do dono: mostrar os principais problemas, "mas principalmente o
  potencial". Sem custo (nenhuma IA nem API nova).
- Bloco **"Seu potencial"** logo abaixo da nota: "hoje 42 → pode chegar a
  88". O número sai da MESMA fórmula da nota (`growthScore.topGaps` +
  `potentialScore`): é a nota se os gargalos listados ficarem cheios —
  nunca número de mercado/vendas (regra 5). Em "Análise parcial" não há
  número, só a frase.
- **Até 3 problemas** (antes 1 gargalo + 1 oportunidade): critérios do
  Instagram avaliados e incompletos, do mais fraco pro mais forte, cada um
  com "O problema", "Como destravar" e "+N pts". Textos genéricos fixos
  (regra 6). `biggestGap` continua existindo (= 1º de `topGaps`).

## 2026-10-08 — Volume de vídeo, teto do grátis e fotos do entorno

Decisões do dono (conversa de 2026-10-08):

- **Plano pago = 12 vídeos/mês, sempre** (Higgsfield). A estratégia
  ESPALHA esses 12 pelas semanas (com reserva no fim do mês) pra o crédito
  não acabar no meio do mês. O volume extra vem de **fotos e criativos
  estáticos** (custo de centavos), na quantidade que a estratégia pedir.
- **Passar dos 12 só com aprovação do CLIENTE**, como investimento extra
  (pacote pago — preço a definir quando o Stripe real estiver ativo). A
  oferta só aparece com **dado real do próprio cliente** (ex.: Reels dele
  com mais alcance que as fotos), depois de ~4 semanas e ~6 vídeos
  publicados. Nunca automático (regra 7) nem com número inventado
  (regra 5).
- **Vídeos grátis do diagnóstico: teto de 30/mês** (≈ US$ 10), separado
  dos 12 dos pagantes. Passou do teto: "seu vídeo entra na fila do
  próximo mês — ou ative o plano e receba agora".
- **Fotos do entorno do imóvel (posts de bairro)** — direção aprovada,
  construir DEPOIS do vídeo grátis + popup do cupom:
  1. Pelo endereço do imóvel, **OpenStreetMap** (grátis) acha o que está
     perto com **distância real** (praia, metrô, escola, shopping...). Os
     tipos de lugar ficam na ficha (`vertical_playbooks`, regra 6).
  2. Foto do lugar vem da **Wikimedia Commons**, só fotos com localização
     marcada perto do ponto e licença livre (CC0, domínio público, CC BY),
     com crédito do fotógrafo na legenda.
  3. Post de bairro é **FOTO, não vídeo** (não gasta os 12 vídeos). São
     poucos por mês — quantos, a estratégia decide.
  4. Corretor **escolhe/recusa** a foto sugerida (nada vai ao ar sem
     aprovação) e **pode subir fotos próprias do bairro** (opcional).
  5. **Proibido:** IA de imagem/vídeo gerar o lugar do zero (seria lugar
     falso em anúncio de imóvel) e usar Google Earth/Street View/fotos do
     Google Maps (termos do Google proíbem).


## 2026-10-08 — Pagamento (fatia 4): como foi implementado

- **Planos no código:** `create-checkout` recebe `{ plan: 'monthly' | 'annual_commit' }`
  (o contrato antigo `basic/pro/ultra` e a região `us` foram removidos; só a
  `TrialSummaryPage` chamava). O preço é buscado no Stripe pelo `lookup_key`
  (`sb_monthly`, `sb_annual_commit`) — não existem mais `STRIPE_PRICE_*` para
  estes planos. Na coluna `companies.plan` os dois planos gravam `'pro'`
  (plano único com tudo; o resto do app lê `plan !== 'free'`);
  o plano real fica em `companies.billing_plan`.
- **Cupom `SB_PRIMEIRO_MES`:** aplicado no servidor só se plano = mensal,
  `companies.coupon_offer_shown_at` existe e tem no máximo 7 dias, e a
  empresa nunca assinou antes (`billing_plan` nulo — trava contra
  cancelar e reassinar pra repetir o desconto). Nada grava
  `coupon_offer_shown_at` ainda (o popup é a fatia 5): sem popup, não há cupom.
  A tela só mostra a oferta (com o prazo restante real) se a coluna estiver
  dentro dos 7 dias.
- **Fidelidade e multa (anual):** `commitment_end_at` = início da
  assinatura + 12 meses. **Multa = 30% × meses restantes × R$1.449
  (144.900 centavos)**, com meses restantes = meses de calendário
  **arredondados pra cima** entre a data efetiva do fim da assinatura e
  `commitment_end_at` (máx. 12). Calculada no `stripe-webhook` em
  `customer.subscription.updated` (cancelamento agendado: `cancel_at` ou
  `cancel_at_period_end`; se o cliente desfaz, a multa é limpa) e em
  `customer.subscription.deleted`. Gravada em
  `companies.early_termination_fee_cents` e registrada em `access_audit_log`
  (`early_termination_fee_recorded`). Exemplo: fim efetivo 5,2 meses antes
  do fim da fidelidade -> 6 meses -> R$2.608,20.
- **A multa NÃO é cobrada automaticamente.** Cobrar dinheiro depende de
  decisão do dono (e da validação do advogado, CDC). Fica visível no painel
  do Owner (`CompanyDetailPage`: plano, fim da fidelidade e multa devida).
- **Cláusula antes de pagar:** na tela de planos (cartão anual) e no checkout
  do Stripe (`custom_text.submit.message`, em português).
- **Preço falso removido:** sumiu o "R$14,49" da `TrialSummaryPage`, do
  `TrialStartModal`, do modal da landing (`i18n.ts`/`App.tsx`) e do comando
  /preco do `vendas-bot` (código do worker; precisa de deploy próprio).
- **Secrets:** só `STRIPE_SECRET_KEY` (já existe), `STRIPE_WEBHOOK_SECRET`
  (já existe) e `SITE_URL` (opcional). `STRIPE_PRICE_BASIC/PRO/ULTRA` só
  seguem sendo lidos pelo caminho legado do webhook (assinaturas antigas).
- **Divergências:** PRODUCT.md (linhas ~39, 59, 109) ainda cita o plano único
  de R$1.449 de 2026-10-02 — substituído por esta decisão; mantido como
  histórico. Itens do Stripe existem só no sandbox; em produção ainda
  precisam ser criados (com os mesmos `lookup_key` e id de cupom).


## 2026-10-08 — Vídeo grátis vira TOUR VIRTUAL (Kling, Reel único)

Decisões do dono (conversa de 2026-10-08), testadas no ensaio:

- **Modelo: Kling 3.0 Standard via Higgsfield** (`/kling-video/v3.0/std/image-to-video`).
  Teste comparativo: DoP turbo (US$ 0,41/5 s) deixou uma mancha branca;
  Kling (**US$ 0,54 por trecho de 5 s**, medido no painel) saiu limpo, pronto
  em ~3 min.
- **O vídeo é um tour virtual**, não 1 foto animada: o cliente envia fotos
  reais do imóvel **na ordem da visita**; cada foto vira um trecho de 5 s e
  os trechos são **colados num Reel único** de ~30 s (`_shared/mp4concat.ts`,
  sem recodificar — só junta trechos do mesmo modelo/tamanho; se vier
  diferente, recusa em vez de entregar vídeo quebrado). Por isso a tela
  passa todas as fotos pelo mesmo recorte 4:5 antes de enviar.
- **Tour grátis = 6 fotos (~30 s, ~US$ 3,24).** Continua 1 por conta e teto
  de 30/mês. **Correção do custo** da decisão "Volume de vídeo" acima
  (que dizia "≈ US$ 10" pensando em 1 foto por vídeo): 30 tours/mês ≈
  **US$ 97**.
- **Plano pago: 12 tours/mês** (~US$ 39 por cliente), gerados a partir do
  plano de conteúdo semanal (3 por semana). Ainda não construído.
- **Seleção de fotos (pipeline do dono, futuro):** recebe ~50 fotos →
  classifica → agrupa por cômodo → tira duplicadas e ruins → escolhe 6 a 10
  conforme o tamanho do imóvel → cliente aprova ou troca antes de gerar.
  Hoje o cliente escolhe as 6 à mão; no teste a seleção foi feita
  manualmente (6 de 64 fotos).
- **Teste real (ensaio, conta QA, 2026-10-08):** 6 fotos → 6 trechos em
  ~2,5 min → Reel de 30,2 s (1108×828, 25 MB), sem erro de decodificação,
  nenhum cômodo alterado. Fotos do dono ficam só no ensaio (nunca publicar).
- **Formato vertical 9:16** para Reels: decisão adiada (o recorte atual é 4:5).
- Tabela nova `video_tours` (migration `20261008220000`) e bucket `videos`
  (migration `20261008210000`, só mp4, até 50 MB). Aplicadas só no ensaio.


## 2026-10-08 — Tour em modo CAMINHADA (foto de começo + foto de fim)

- Pedido do dono: "parecer que estou andando lá", não fotos se mexendo com
  corte entre elas. Solução: o Kling 3.0 aceita `last_image_url` (doc da
  Higgsfield). Cada trecho começa numa foto e termina na seguinte → 6 fotos
  = **5 caminhadas de 6 s ≈ 30 s**, sem pulo na emenda. Modo novo `walk`
  (padrão); o antigo continua como `per_photo` (ficha:
  `config.free_video.mode`, `walk_prompt`). Pedimos sem som (`sound: off`) —
  o áudio é descartado na colagem.
- **Ressalva honesta (regra 4):** começo e fim de cada trecho são fotos
  reais, mas **o caminho do meio é imaginado pela IA**. Entre cômodos
  vizinhos sai fiel (teste: entrada → sala passou pela porta real); entre
  cômodos que não se tocam a IA inventa passagem (teste: apareceu uma porta
  de madeira vazada entre a suíte e o espaço gourmet que não está nas
  fotos). Por isso a **ordem das fotos** é decisiva.
- **Decisão do dono:** o sistema descobre a melhor ordem sozinho, sempre
  (próxima etapa — ver ROADMAP P3).
- **Bug corrigido no teste:** a colagem de 33 MB estourou a memória da
  função (erro 546) e o tour ficou preso em "montando". `mp4concat` agora
  não copia os quadros (pico medido caiu de ~250 MB pra ~100 MB no teste
  local, com quadros idênticos) e o `status` destrava uma colagem parada há
  mais de 3 min.


## 2026-10-09 — Formatos de conteúdo do setor de imóveis (aprovado pelo dono)

Aprovado:
- **Grátis = "kit amostra":** tour de ~30 s em caminhada (6 fotos) + 2 peças
  paradas feitas com as fotos do próprio cliente (1 criativo bonito + 1 post
  educativo). O popup do cupom diz que isso é o que o plano faz toda semana.
- **Vídeo no plano = 1 tour completo por imóvel + recortes.** O tour usa
  todos os ambientes (sem fotos repetidas), ordem automática aprovada pelo
  corretor. Os recortes (15-30 s) não geram vídeo novo — custo zero — e
  viram Reels e Stories ao longo das semanas.
- **As 7 ideias novas entram todas:** (1) tour como isca na DM ("Comente
  TOUR"), (2) "isso ou aquilo", (3) Stories diários com recortes do tour,
  (4) close de 5 s de um detalhe, (5) cartões-postais do bairro, (6) avatar
  do corretor abrindo o tour, (7) "Vendido!" (prova social).
- Onde cada uma entra na estrutura (ficha, pacote por imóvel, planejador
  da semana, conversa na DM) e a ordem de construção: ver
  [CONTENT-INTELLIGENCE.md](CONTENT-INTELLIGENCE.md) "Mapa de formatos" e
  [ROADMAP.md](ROADMAP.md) P3.
- **Em aberto:** como os "12 vídeos/mês" (decisão de 2026-10-08) se
  traduzem agora que recorte não custa geração — proposta: 12+ Reels
  publicados/mês, com um **teto de custo de geração por cliente em US$**
  (regra 7) no lugar de contar vídeos.


## 2026-10-09 — Etapa 1 do tour do plano: como foi implementado

- **Teto: US$ 40 por cliente por mês** (decisão do dono; confirmado de novo
  em 2026-10-14, ver o fim deste arquivo), somando análise de
  fotos + geração (`video_tours.cost_usd`, `kind = 'plan'`). A geração é
  bloqueada antes de gastar se passar do teto (mensagem diz quanto custa e
  quanto sobra). Preço da passagem é estimado (US$ 0,108/s × 6 s); falta
  confirmar o valor real cobrado pela Higgsfield pelo trecho de 6 s sem som.
- **Ordem automática:** `tour-plan` (`analyze`) manda TODAS as fotos do
  imóvel numa só chamada à IA (Claude Opus 5.5, saída em JSON estruturado):
  ambiente de cada foto, repetidas juntas, foto ruim fora (pessoa, escura,
  só detalhe), melhor foto por ambiente, o que cada ambiente "vê" pelas
  portas e a ordem proposta. O CÓDIGO marca cada passagem como confirmada
  (um ambiente aparece na foto do outro) ou não confirmada. Vocabulário do
  setor na ficha (`config.tour`: tipos de ambiente, zonas, sequência
  típica, máx. 25 ambientes, recortes de 15-30 s) — regra 6.
- **Aprovação do corretor:** botão "🎬 Tour em vídeo" no card do imóvel
  (`ItemTour.tsx`): ordem com fotos, aviso amarelo nas passagens não
  confirmadas (recalcula a cada troca), subir/descer/tirar, devolver
  ambientes que ficaram fora, custo estimado e gasto do mês. Só gera depois
  de "Aprovar e gerar".
- **Recortes:** sequências de 3 a 5 passagens da mesma zona viram vídeos
  separados (custo zero — mesmas passagens).
- **Colagem nova (`_shared/mp4stream.ts` + `tusUpload.ts` + `tourEngine.ts`):**
  substitui o `mp4concat.ts` (mp4box). Lê só a tabela de quadros de cada
  passagem, monta o cabeçalho e envia em pedaços de 6 MB, retomável entre
  chamadas — memória de ~1 passagem por vez, sem limite de tamanho. Testado:
  quadros idênticos aos das passagens originais (comparação quadro a
  quadro), retomada no meio gera arquivo idêntico, colagem na nuvem igual à
  local. O tour grátis usa o mesmo motor.
- **Achados no teste:** (1) a chave de serviço das funções está no formato
  novo e o envio retomável precisa dela no cabeçalho `apikey` também;
  (2) a 1ª colagem (mp4box) "perdia" 1 quadro por emenda — a nova não.
- **Pendente:** a análise das 64 fotos não rodou no ensaio porque falta o
  secret `ANTHROPIC_API_KEY` lá. A conta QA do ensaio está com `plan = 'pro'`
  pra testar o tour do plano (voltar pra `free` pra testar o grátis).


## 2026-10-09 — Sai o tour completo: vídeo vira ISCA (partes do imóvel)

Decisão do dono (substitui "1 tour completo por imóvel + recortes" e o
grátis de 30 s, acima — mantidos como histórico):

- **Corretor não entrega o imóvel de cara.** O vídeo mostra uma PARTE e gera
  vontade, com chamada pra conversa: "Comente QUERO que eu te mando mais na
  DM".
- **Cada vídeo = 1 cômodo, ou no máximo 2 cômodos vizinhos** (caminhada de
  uma foto até a outra). Quem escolhe as fotos é o corretor — **sai a
  análise de ordem por IA** (o código da etapa 1 fica no repositório, sem
  uso, até ser removido ou reaproveitado).
- **Abertura "de fora":** vídeo que começa do lado de fora do prédio/casa já
  mostrando a vista. Só com FOTO REAL da fachada/vista enviada pelo
  corretor (regra 4 — a IA não gera o prédio nem a vista).
- **Grátis = 2 ou 3 vídeos curtos dos melhores cômodos**, cada um já com a
  chamada "Comente QUERO".
- **Resposta na DM:** mensagem pronta montada com os dados CADASTRADOS do
  imóvel no Sales Boost (nunca inventados — regra 5) + convite pra agendar
  visita. Envio pela API oficial do Instagram (resposta privada ao
  comentário): a Meta não cobra por mensagem; limites: 1 mensagem por
  comentário, até 7 dias depois do comentário, 750/hora por conta; depois
  que a pessoa responde, abre a janela de 24 h. Depende da aprovação do app
  na Meta (`instagram_business_manage_messages`, ver META-APP-REVIEW.md).
- **Em aberto:** aprovar cada DM (regra atual) ou aprovar o modelo uma vez
  por post e o envio ser automático.


## 2026-10-09 — "Comente QUERO" automático (opção B) e vídeos curtos: como foi feito

- **Decisão do dono: opção B.** O dono aprova a mensagem do QUERO UMA VEZ
  por imóvel; depois cada "QUERO" num post desse imóvel recebe a DM na hora,
  sem nova aprovação. É uma exceção consciente à regra 1 (a aprovação
  continua existindo, só passa a ser feita antes, sobre o texto fixo). A
  mensagem só tem o texto aprovado — a IA não escreve nada na hora.
- **Como funciona:** `engagement_automations.item_id` (nova coluna) +
  `instagram-webhook` acha o imóvel do post comentado (`posts.item_id` pelo
  `instagram_media_id`) e usa a automação daquele imóvel, que tem
  `execution_mode = 'automatic'` e `allowed_auto_actions = ['send_dm']`
  (mecanismo que já existia). Modelo da mensagem na ficha
  (`config.dm_reply`: palavra QUERO + modelo com {campos}); linha de dado não
  cadastrado some (`_shared/dmReply.ts`). Também cria o lead.
- **Vídeos do imóvel (`item-videos` + `ItemVideos.tsx`):** botão "🎬 Vídeos
  e resposta do QUERO" no card do imóvel: tipo (1 cômodo / 2 cômodos
  vizinhos / abertura de fora), o corretor escolhe a(s) foto(s), custo
  estimado e gasto do mês (teto US$ 40), lista dos vídeos prontos, e a caixa
  da mensagem do QUERO pra revisar/aprovar/desligar.
- **Grátis (`trial-video` + `FreeVideoCard`):** 3 fotos → 3 vídeos curtos.
- **Removido:** `tour-plan`, `_shared/tourPlan.ts`, `ItemTour.tsx` (ordem por
  IA e tour completo) — ficam no histórico do git. A função `tour-plan`
  continua publicada só no ensaio, sem uso.
- **Testado no ensaio (sem gerar vídeo novo — reaproveitando trechos já
  pagos):** grátis com 3 vídeos e vídeo "2 cômodos" do plano, quadros
  idênticos aos trechos originais; QUERO: desligado → nada; ligado +
  comentário com QUERO no post do imóvel → envio automático (falhou só
  porque a conta de teste não tem Instagram conectado, como esperado);
  QUERO em outro post → nada; comentário sem a palavra → nada.
- **Atenção (achado):** o `instagram-webhook` não confere a assinatura da
  Meta (`X-Hub-Signature-256`) — qualquer um que souber o endereço pode
  mandar um comentário falso. Com o envio automático isso pesa mais.
  Correção recomendada (mexe em autenticação → pedir aprovação do dono):
  conferir a assinatura com o segredo do app da Meta.

## 2026-10-09 — Google fica fora do produto (por enquanto)

- **Decisão do dono:** o foco é o digital (Instagram); o que depende do
  Google Cloud sai de cena. Motivo imediato: o projeto Google Cloud
  "SalesBoost" ficou com o faturamento vencido e corre risco de suspensão.
- **Feito:** em Conexões (`settings/IntegrationsTab.tsx`), os cartões
  **Google Search Console** e **Google Business Profile** ficam escondidos
  pela constante `GOOGLE_ENABLED = false` (voltar pra `true` religa). Na
  data, nenhuma empresa em produção tinha conta Google conectada.
- **Diagnóstico grátis:** a nota do site (PageSpeed) funciona **sem chave**
  — o dono disse ter apagado `PAGESPEED_API_KEY` da produção, pra não depender do
  projeto Google suspenso.
- **Continua no código, sem tela que leve até lá:** mapa de concorrentes
  (`map-competitors`), busca do negócio (`find-place`), respostas a
  avaliações Google (`reply-google-review`), métricas GSC. A busca de leads
  do painel do Owner (`find-sales-leads`) usa Google Places e para se o
  projeto for suspenso — só afeta o dono, não clientes.

## 2026-10-09 — Webhook do Instagram confere a assinatura da Meta (aprovado pelo dono)

- `instagram-webhook` confere `X-Hub-Signature-256` (HMAC-SHA256 do corpo)
  com `INSTAGRAM_APP_SECRET` (aceita também `META_APP_SECRET` /
  `FACEBOOK_APP_SECRET`). Fecha o achado acima.
- **Sem assinatura válida o evento NÃO é descartado** (não se perde lead
  real se o segredo estiver trocado): comentário e DM são registrados
  normalmente, mas **nada é enviado sozinho** — a ação vira pedido de
  aprovação (PENDING) e o log mostra "assinatura da Meta ausente ou
  inválida".
- Testado: conta da assinatura comparada com `openssl` (válida → aceita;
  maiúsculas → aceita; falsa/ausente → recusa); no ensaio, comentário QUERO
  sem assinatura e com assinatura falsa → PENDING (antes era envio
  automático).
- **Depois de publicar em produção:** olhar o log no primeiro comentário
  real. Se aparecer o aviso de assinatura inválida em comentário verdadeiro,
  o segredo cadastrado não é o do app que assina — corrigir o secret (o
  QUERO só passa a pedir aprovação; nada quebra).

## 2026-10-09 — Estratégia escolhe os formatos (linha central + mix da semana)

- Pedido do dono: a estratégia precisa ter acesso a todos os formatos de
  conteúdo pra escolher a estratégia central e a semanal.
- Feito: catálogo de formatos (ficha `content_formats` + formatos da
  empresa) entra no prompt da estratégia; ela devolve linha central,
  formatos-âncora e mix semanal (`marketing_ai_strategies.content_plan`),
  validados em código; o Calendário da semana segue o mix. Detalhes em
  [CONTENT-INTELLIGENCE.md](CONTENT-INTELLIGENCE.md).
- Vídeo e pacote do imóvel **não** são gerados sozinhos pelo calendário
  (custam/precisam do imóvel) — aparecem como lista "pra fazer".
- Migration `20261009200000_content_formats.sql` (aplicada no ensaio;
  produção só com aprovação, junto do PR).

## 2026-10-09 — Parte de trás do PR #20 publicada em produção (aprovado pelo dono)

- Banco de produção: `billing_plans`, `videos_bucket`, `video_tours`
  (aplicada sem o `drop policy if exists`, que travava a ferramenta —
  tabela nova, a policy não existia), `item_videos`, `content_formats`.
- Funções publicadas: `create-checkout`, `stripe-webhook`,
  `owner-company-activity`, `trial-video` (nova), `item-videos` (nova),
  `instagram-webhook`, `strategy-generate`, `creative-generate` — mesmo
  `verify_jwt` de antes; todas respondem (teste sem login → 401 do próprio
  código).
- Conferido antes: chave `sk_live` lê os preços reais; cupom
  `SB_PRIMEIRO_MES` existe no Stripe real; chave do Higgsfield aceita.
- Falta: o dono juntar o PR e publicar o site.

## 2026-10-09 — Perfil pessoal x profissional + conta logada não fica mais travada no cadastro

- **Decisão do dono:** o nome da empresa vira opcional. Sem nome, o perfil é
  **pessoal**; com nome, **profissional**. É só um rótulo pra organizar — não
  muda nada no que o produto faz.
- **Como ficou:** `companies.profile_type` (`profissional` padrão |
  `pessoal`, migration `20261010100000_profile_type.sql`). Sem nome, o
  `business_name` vira "Perfil pessoal" (o banco exige um nome). O cadastro
  (`OnboardingPage`) manda `onboarding_context.profile_type`;
  `claim-diagnostic` grava na empresa; `run-diagnosis` aceita nome vazio.
  No `/setup`, apagar o nome volta pra "Perfil pessoal"; escrever um nome
  vira profissional. O painel do Owner mostra o rótulo na lista.
- **Correção junto:** quem já tinha conta (logado, sem empresa) terminava o
  cadastro e o botão mandava criar uma conta NOVA — o diagnóstico não ligava
  à conta e a pessoa ficava travada. Agora o cadastro liga o diagnóstico na
  hora (`claim-diagnostic`) e o botão leva pro `/setup`.
- Testado no ensaio: conta logada, cadastro sem nome → empresa "Perfil
  pessoal", `profile_type=pessoal`, botão final → `/setup`; empresas antigas
  ficaram `profissional`.

## 2026-10-09 — Diagnóstico grátis v2: concorrentes + o que está em alta (aprovado pelo dono)

- **Pedido do dono:** o diagnóstico grátis tem que ser específico e mostrar
  valor na hora — comparar com concorrentes e mostrar o que está em alta.
  "Sempre deve buscar concorrentes e trends" (automático, sem perguntar).
  Custo: o dono pediu o menor possível e aprovou a Apify agora (centavos por
  diagnóstico); depois da aprovação do app na Meta, trocar pelas APIs grátis
  da Meta (Business Discovery + Hashtag Search).
- **Como ficou:** função nova `diagnosis-market` (+ `_shared/marketScan.ts`).
  A página `/diagnostico/:id` chama a cada 5 s e cada chamada avança uma
  etapa: lê até 60 posts recentes das hashtags da região
  (`apidojo~instagram-scraper`), escolhe os 3 perfis que mais postam ali
  (`apify~instagram-profile-scraper`) e o Claude escreve 3 descobertas + 3
  ideias de post usando SÓ os números lidos. Hashtags vêm da ficha
  (`vertical_playbooks.config.market_hashtags`, ex. `imoveis{local}`) +
  bairros do cadastro + cidade — nada de setor no código.
- **Travas de custo:** só começa pra diagnóstico novo (até 30 min);
  teto mensal `MARKET_SCAN_MONTHLY_CAP` (padrão 150); trava contra abas
  duplicadas; sem `APIFY_TOKEN` a seção some e o resto do diagnóstico fica
  igual.
- **Alimenta a conta:** quando o diagnóstico vira conta (`claim-diagnostic`)
  ou já está ligado a uma empresa, os concorrentes entram em
  `marketing_ai_competitors` e os posts em alta em `marketing_ai_trends`
  (`source='diagnostico'`).
- **Teste real em produção (conta de teste, @getsaleboost, Botafogo +
  Copacabana):** pronto em ~1,5 min; achou 3 imobiliárias da região
  (831, 1.176 e 105 seguidores), 5 posts em alta e as descobertas citaram só
  números reais (ex.: último post do perfil foi 08/09 → "0 posts em 30
  dias", conferido no banco). Custo estimado pelos preços da Apify: até
  60 posts × US$0,0005 + 3 perfis × ~US$0,0026 ≈ US$0,04 + 1 chamada do
  Claude.
- **2026-10-10 — descobertas viram "pontos fracos" (pedido do dono):** a
  seção passa a se chamar "O que está te fazendo perder clientes no
  Instagram". O Claude recebe também a bio, o link na bio, os destaques, a
  conta comercial e os dias desde o último post, e aponta os pontos fracos do
  mais grave para o menos grave, comparando com os concorrentes. Não pode
  inventar defeito nem número. Testado em produção (conta de teste): apontou
  "31 dias sem postar", "bio sem região nem contato" e "só 3 posts", todos
  conferidos no banco. Também foi corrigido um erro: a tabela
  `marketing_ai_trends` só aceita `relevance` high|medium|low, e estava indo
  "alta". Agora os posts em alta entram na conta junto com os concorrentes
  (testado: 4 concorrentes e 5 posts em alta gravados).

## 2026-10-10 — Diagnóstico: tela de carregamento, ordem da página e velocidade (pedido do dono)

- **Tela de carregamento:** enquanto a análise não termina, a página mostra
  só a logo do Sales Boost com uma barra de progresso e as 4 etapas (ler o
  Instagram → buscar concorrentes → comparar → escrever a análise). Nada de
  resultado pela metade. Tempo máximo de espera na tela: 3 min. Depois disso,
  ou se a busca não puder rodar, a página aparece sem a parte da concorrência.
- **Ordem:** nota → potencial → análise (concorrentes, pontos fracos, em
  alta, ideias) → "pontos que travam" e "como a nota foi formada".
- **Velocidade:** o `run-diagnosis` dispara a análise (`diagnosis-market`
  com `drive: true`) assim que cria o diagnóstico, em paralelo com a leitura
  do Instagram. O servidor emenda uma etapa na outra (a Apify segura a
  resposta até cada execução terminar). Uma trava (`lease_until`) impede duas
  chamadas de começarem a mesma etapa (custo em dobro). Medido em produção:
  ~30-55 s do envio ao resultado (antes, 2 min ou mais).
- **Modelo da análise:** testamos o Haiku (4x mais rápido), mas ele inventou
  números ("posts com 3-4 curtidas") e citou bio de concorrente que não lemos.
  Isso fere a regra de nunca inventar número, então ficou o Sonnet, com textos
  mais curtos.

## 2026-10-10 — Novo caminho: diagnóstico → criar conta → só vídeos grátis até pagar (decisão do dono)

> **Parcialmente substituída em 2026-10-13:** a conta nova NÃO fica mais presa em `/gratis`; vira "modo vitrine" (painel inteiro em somente visualização). O resto (cadastro pelo diagnóstico, `/setup` só depois de pagar, fim do teste de 7 dias pras contas novas) continua valendo. Ver a decisão de 2026-10-13 no fim deste arquivo.

- **Ordem:** cadastro → diagnóstico (sem a tela intermediária "Seu negócio foi
  entendido") → botão **"Entrar no painel e criar meus vídeos grátis"** →
  **só criar conta** → já entra logado, sem passar pelo login.
  - Se a pessoa já está logada, o botão liga o diagnóstico à conta e entra.
  - Se o Supabase exigir confirmação de e-mail, a pessoa cai no login normal.
    Hoje a produção não exige; o ensaio exige.
- **Antes de pagar ("modo grátis") — substituído em 2026-10-13 (agora "modo vitrine"):** a conta nova só vê a página `/gratis`.
  Qualquer outra rota do painel leva pra lá. A página conduz aos 3 vídeos
  grátis e, quando ficam prontos, mostra o que o plano libera e os planos com o
  cupom do 1º mês.
  - Regra: `isFreeMode` em `src/lib/setupGate.ts`.
  - Vale só pra contas criadas a partir de 2026-10-06. Liga dos Sonhos e a
    conta Sales Boost ficam como estavam.
- **Dados adicionais (`/setup`):** só depois de pagar. Quem paga volta do
  checkout, a página espera a confirmação do pagamento e leva pro `/setup`;
  depois, o painel inteiro.
- **O que deixou de valer pras contas novas:** os 7 dias de teste com o painel
  inteiro. O `claim-diagnostic` ainda grava as datas de teste, mas a tela não
  usa mais. A página de resumo do teste (`/dashboard/trial`) continua só pras
  contas antigas.
- Escolha de plano + checkout + cupom foram pra `PlanOffer.tsx`, usado tanto
  no resumo do teste quanto no `/gratis`.

## 2026-10-11 — Presente no diagnóstico: 2 vídeos drone + 1 criativo (decisão do dono)

> **Substituído em 2026-10-14:** o kit virou **1 foto → 3 artes** (sem
> vídeos). Ver "Kit grátis: 1 foto → 3 artes" no fim deste arquivo. O texto
> abaixo fica como registro; kits antigos com vídeos continuam aparecendo.

- **O que é:** no último passo do cadastro do diagnóstico (onde pede cidade e
  e-mail), um bloco 🎁 pede **2 fotos de cômodos + 1 foto de destaque**.
  Opcional. Junto com o diagnóstico já começa o kit grátis:
  - 1 vídeo por cômodo, câmera "tipo drone" (Kling via Higgsfield, 5 s; a
    instrução de câmera fica na ficha: `config.clip_prompts.drone`);
  - 1 criativo de design: a foto real tratada pela Higgsfield (Qwen Image 3
    Edit — luz, cor, nitidez, sem mudar nada do imóvel) + texto impresso pelo
    nosso `render-format` (regra 4: a IA nunca escreve). O texto vem da ficha
    (`config.gift_creative`: `{cidade}` / "Seu próximo lar pode estar aqui" /
    "Comente QUERO"), sem número nenhum (regra 5).
  - O bloco só aparece pro setor cuja ficha tem `gift_creative` (hoje, imóveis).
- **Depois do resultado ("o resto do painel continua fechado até pagar" — substituído em 2026-10-13: o painel abre em somente visualização):** aviso discreto do andamento ("1 de 2 vídeos
  prontos") e o botão vira **"Entrar no painel e ver meu presente"**. Os
  vídeos e o criativo ficam no painel (`/gratis`), não na página do
  diagnóstico. O resto do painel continua fechado até pagar.
- **Quem não mandou fotos** no cadastro cria o mesmo kit no `/gratis` (2
  cômodos + 1 destaque). Era "3 vídeos"; agora é sempre o kit.
- **Travas:** 1 presente por e-mail e por Instagram; 1 kit por conta; teto de
  30 kits por mês somando diagnóstico e painel (`FREE_VIDEO_MONTHLY_CAP`);
  links de envio das fotos só valem pra diagnóstico com até 30 min; fotos só
  JPG/PNG/WebP, até 15 MB.
- **Como foi feito:**
  - `diagnosis-gift` (nova): `upload_urls` → `start` → `status`. O kit nasce
    preso ao diagnóstico (`video_tours.diagnostic_id`, sem empresa ainda).
  - `trial-video`: na primeira consulta da conta, liga o kit do diagnóstico à
    empresa e imprime o texto do criativo.
  - Motor comum em `supabase/functions/_shared/freeKit.ts`.
  - Banco: `20261011100000_diagnosis_gift.sql` (aplicada no ensaio e em
    produção em 2026-10-11).
- **Custo por kit:** 2 × US$ 0,54 (vídeos) + o tratamento da foto (preço da
  Higgsfield ainda a confirmar no painel deles). Teste real no ensaio: vídeos
  em ~3 min, foto tratada em ~35 s, fiel ao original.
- **Também neste trabalho:** e-mail validado no cadastro e no `run-diagnosis`;
  raspador de hashtags trocado pelo oficial da Apify (ver docs/PITFALLS.md).

## 2026-10-11 — Preço do corretor + cupom em destaque antes de comprar (decisão do dono)

- **Dois tipos no cadastro:** "Imobiliária / Corretor" virou **"Imobiliária"** e
  **"Corretor(a) de imóveis"** (os dois na ficha `imoveis_rio`). A opção antiga
  saiu do cadastro, mas as contas que já a usam continuam na tabela padrão.
- **Preços** (faixa em `business_types.plan_tier`; valores em
  `src/lib/pricing.ts` e no Stripe pelos lookup_keys):

  | | Mensal (sem fidelidade) | Anual (fidelidade 12 meses) | Cupom 1º mês do mensal |
  |---|---|---|---|
  | Imobiliária (`padrao`) | R$ 2.449 | R$ 1.449/mês | R$ 1.000 (`SB_PRIMEIRO_MES`) |
  | Corretor(a) (`corretor`) | R$ 797 (`sb_monthly_corretor`) | R$ 597/mês (`sb_annual_commit_corretor`) | R$ 200 (`SB_PRIMEIRO_MES_CORRETOR`) |

  Nos dois casos, o 1º mês do mensal com cupom sai pelo preço do anual.
- **Cupom em destaque:** com cupom ativo, o cartão do mensal mostra o selo
  "🎁 Cupom de R$X OFF no 1º mês" e o botão "Assinar o mensal" abre antes um
  popup ("Você ganhou R$X de desconto", de/por, "Usar meu cupom e assinar").
  O popup do kit pronto também mostra o valor do cupom.
- **Multa do anual:** 30% × meses restantes × a mensalidade do anual da faixa.
  O `stripe-webhook` lê o valor do preço da assinatura (R$1.449 se não achar).
- Testado em produção com a conta de teste: checkout do corretor saiu R$ 797 −
  R$ 200 = R$ 597 no 1º mês e o anual R$ 597 com o texto da multa certo; o da
  imobiliária saiu R$ 2.449 / R$ 1.449.
- **Erro "No valid payment method types" (2026-10-11):** na hora do erro, a
  conta Stripe (modo real) mostrava todas as formas de pagamento como
  indisponíveis. Pouco depois, sem mudança de código pra isso, o checkout passou
  a abrir com cartão e Link. Se voltar, conferir a ativação da conta e
  Configurações → Formas de pagamento no painel do Stripe.

## 2026-10-11 — Exclusão de empresas em lote no painel do Owner (pedido do dono)

- Na lista "Todas as Empresas" (`/owner`) cada empresa tem uma caixinha, e há
  "selecionar todas" pras visíveis. A barra "🗑️ Excluir selecionadas" abre uma
  janela com a lista e só libera o botão com a frase exata
  **"EXCLUIR N EMPRESAS"**. A frase não pode ser colada.
- **Travas, conferidas no servidor (`owner-delete-company`), não só na tela:**
  - só o dono (`user_roles.role = owner`);
  - no máximo 25 por vez;
  - empresas com `companies.delete_protected` nunca são excluídas, nem uma
    por uma (Liga dos Sonhos e Sales Boost já marcadas — migration
    `20261011130000_company_delete_protected.sql`);
  - quem tem assinatura paga ou acesso manual é pulado no lote (aparece 🔒 na
    lista; pra excluir, usar a página da empresa).
- O que some: tudo da empresa no painel (72 tabelas em cascata). O diagnóstico
  fica guardado sem dono e o login da pessoa continua existindo.
- Testado no ensaio com empresas descartáveis: quem não é dono, frase errada e
  número errado → recusado; frase certa → excluiu só as comuns e pulou a
  protegida e a de acesso manual.

## 2026-10-11 — Exclusão apaga o login, leads de imóveis e lista de APIs (pedido do dono)

- **Excluir cadastro apaga empresa + login.** Antes, excluir a empresa
  deixava o login, e a linha voltava na lista como "sem perfil". Agora
  `owner-delete-company` apaga os dois, uma por uma ou em lote. Logins que já
  estavam sem empresa também podem ser marcados e apagados. A frase do lote
  virou "EXCLUIR N CADASTROS". Nunca apaga login de dono/admin
  (`user_roles` ≠ client) nem o de quem está excluindo. O diagnóstico grátis
  fica guardado sem dono (FK `set null`). Testado no ensaio.
- **Agente de leads do Owner voltado pra imóveis.** Categorias:
  Imobiliárias, Corretores de imóveis, Aluguel por temporada (Airbnb).
  Palavras-chave novas em `prospect_search_keywords`; as antigas (moda,
  beleza, e-commerce, escritórios) ficaram desligadas, não apagadas. Faixas:
  nota 4,0–5,0, de 5 a 1.000 avaliações, Instagram ativo e telefone
  obrigatórios. Pesos: Instagram 30, nota 20, telefone 15 e "sem pedido
  online" 0 (não faz sentido pra imóveis). O texto do perfil ideal de cliente
  (ICP) foi reescrito na configuração e no prompt do `find-sales-leads`.
  Migration `20261012101000_leads_icp_imoveis.sql`, aplicada em produção.
  - **Limite conhecido:** donos de Airbnb pessoa física quase não têm perfil
    no Google Maps. A busca acha principalmente quem administra imóveis por
    temporada.
- **Configurações → APIs.** A lista foi conferida com o que o código usa
  (`Deno.env.get`):
  - entraram Higgsfield, Google Places, Meta/Instagram, Telegram e Hermes;
  - voltaram PageSpeed e Replicate;
  - saiu DataForSEO, que nenhuma função usa.

  Migration `20261012100000_api_providers_refresh.sql`. A aba "Referências
  globais" saiu do painel (a tabela e a função continuam no banco).

## 2026-10-12 — VPS da Hostinger vira "estúdio de vídeo" (decisão do dono)

- **Por quê.** A VPS (KVM 2, `srv1824556`) era usada só como intermediária
  do raciocínio (Hermes) pro Jarvis e o chat, que o dono não usa. O que só um
  servidor próprio faz bem é edição de vídeo com `ffmpeg`, sem o limite de
  ~150 s e de memória das funções da Supabase.
- **O que faz.** O acabamento dos vídeos do imóvel:
  - vídeo em pé 1080×1920 com fundo desfocado (nada cortado nem inventado);
  - entrada e saída suaves, fusão entre trechos;
  - H.264 + trilha de áudio muda AAC (formato que o Instagram prefere);
  - capa (JPG).
- **Como.**
  - Tabelas `worker_nodes`, `worker_enrollments` e `media_jobs`, mais a
    função `claim_media_job` (migration `20261013100000_vps_worker.sql`).
  - Função `vps-worker`.
  - Trabalhador em `public/vps/worker.mjs` (Node 20 + ffmpeg, sem
    dependências) e instalador em `public/vps/install.sh`.
  - Tela: Configurações → Servidor.
  - `tourEngine.advanceTour` manda a colagem pra VPS quando o interruptor
    `feature_flags.vps_reel_finish` está ligado e há servidor online.
- **Segurança.**
  - A VPS nunca recebe a service role. Entra com um código de 15 min, de uso
    único, gerado na tela, e recebe um token próprio que fica guardado só
    como hash.
  - O resultado sobe por URL assinada, gerada por trabalho.
  - Só faz pedidos de saída: não abre porta nem mexe em DNS.
  - O serviço systemd tem limite de 1 CPU e 3 GB, pra não derrubar o Hermes
    que roda na mesma máquina.
- **Nunca trava.** Se a VPS não entregar (fila com servidor offline por
  3 min, falha 3 vezes ou 20 min no total), o tour volta sozinho pra
  colagem antiga (`mp4stream`).
- **Fica pra depois (decisão do dono):**
  - música, que depende de escolher uma biblioteca com licença comercial;
  - cartão final com a marca do corretor (só quando o "Comente QUERO" do
    imóvel estiver ligado, pra tela não prometer o que não existe);
  - desligar o Hermes/Jarvis.
- **Busca de leads não foi pra VPS.** Não precisa: dá pra resolver
  retomando a busca na própria Supabase, e isso fica como proposta separada.

## 2026-10-12 — "Quem somos" e textos do site (pedido do dono)

- **"Quem somos" oficial em [PRODUCT.md](PRODUCT.md):** "AI growth partner"
  que entende, monta a estratégia, executa, aprende e se adapta. Frases da
  marca: parceiro e não ferramenta, não agência; crescimento e não likes;
  transformamos atenção em negócio.
- **Site (só textos, sem mudar o design; a hero ficou igual):**
  - subtítulo da hero e rodapé com o "parceiro de crescimento";
  - seção logo abaixo da hero virou "Quem somos";
  - "O produto" virou "Não somos agência / Transformamos atenção em
    negócio";
  - "Pra quem é" agora fala de imobiliária, corretor e aluguel por
    temporada (antes falava de e-commerce e advocacia);
  - "Também atendemos" virou "Em breve: lojas de casa e e-commerces".
- **Números inventados removidos (regra 5).** A seção mostrava "38% mais
  faturamento", "2.4× mais clientes" e "24h primeiro resultado" com o selo
  "Resultados comprovados", sem dado real por trás. Agora mostra fatos
  verdadeiros:
  - 24/7 trabalhando;
  - 0 férias e pedidos de aumento;
  - 100% do que vai ao ar aprovado pelo dono.

  A animação dos números passou a ler o próprio texto (`src/App.tsx`), pra
  não haver número escondido no código.
- **Divergência que ficou:** o celular de exemplo na hero e o "notebook" da
  vitrine mostram um relatório ilustrativo (nota 87, "+12 pts"). É ilustração
  de tela, não promessa, mas, se o dono preferir, dá pra trocar por algo sem
  número. Não mexi porque é design da hero.
- **Aprovar pelo Telegram, com dupla confirmação e opt-in** — 2026-10-12.
  Pedido do dono ("é possível aprovar pelo telegram?"). Cada empresa liga
  sozinha em Configurações → Notificações (padrão desligado). Aprovar
  sempre exige 2 toques ("✅ Aprovar" → "✅ Sim, publicar agora"), só em
  conversa privada com o bot, e o botão é assinado pelo servidor (o
  webhook do Telegram não tem verificação de origem, então a assinatura é
  o que impede aprovação forjada). Regra 1 continua valendo: nada sai sem o
  dono tocar em "Sim". Silêncio das 22h às 8h pra não incomodar.

## 2026-10-13 — Cadastro direto + "modo vitrine" + kit só pra quem veio do diagnóstico + lembrete de 30 dias (decisão do dono)

> Substitui a decisão de 2026-10-10 ("conta nova só vê `/gratis`") e a parte de
> 2026-10-11 que dizia "o resto do painel continua fechado até pagar". As
> entradas antigas ficam acima como histórico (marcadas "substituída em 2026-10-13").

- **Cadastro direto:** a tela de login ganhou "Não tem conta? Cadastre-se" →
  `/signup` (sem `?claim`). Fluxo: `/signup` → `/dashboard` → (sem empresa)
  `/onboarding` → painel. O onboarding de quem está logado **não oferece o
  presente** (kit) — o bloco de 3 fotos só aparece pra quem faz o diagnóstico
  sem conta. O botão final do diagnóstico, pra quem criou a conta antes, é só
  "Entrar no painel →" (sem prometer vídeos).
  - **Divergência que ficou:** o onboarding continua sendo o próprio
    diagnóstico (é ele que cria a empresa, via `claim-diagnostic`). Quem entra
    direto roda um diagnóstico a mais; só não ganha o kit.
- **Modo vitrine** (`isShowcaseMode` em `src/lib/setupGate.ts`; `isFreeMode` é
  alias): mesma regra de antes — conta criada a partir de 2026-10-06, sem
  pagamento nem liberação manual e não bloqueada. Em vez de ser mandada pra
  `/gratis`, a conta **navega por todo o `/dashboard/*`** em "somente
  visualização". `/gratis` continua existindo (kit + planos). `/setup` continua
  só depois de pagar. Contas antigas, bloqueadas e com acesso manual: igual a
  antes. Voltar do checkout (`?upgrade=success`) ainda cai em `/gratis` pra
  esperar a confirmação do pagamento.
- **O que a tela faz em vitrine:** faixa fixa "Você está vendo o painel em modo
  demonstração — escolha um plano pra usar de verdade" + "Ver planos"
  (→ `/gratis#plano`); modal único "Disponível no plano". O bloqueio é UM ponto
  só (`src/lib/showcaseGuard.ts`, ligado pelo `ShowcaseProvider` no layout do
  painel): embrulha o `fetch`, então vale pra `fetch(.../functions/v1/...)`,
  `supabase.functions.invoke` e escritas diretas do supabase client — sem
  interceptar cliques; abas e links nunca bloqueiam. Chamadas logo depois de
  trocar de tela (a tela abrindo e buscando) bloqueiam em silêncio, sem modal.
  Telas que disparavam IA sozinhas ao abrir (1ª estratégia, ideias do Creative
  Agent, Kit da Marca) não disparam em vitrine.
  - **Liberado em vitrine:** editar dados/ficha da empresa (`companies`,
    `business_context`), catálogo/fotos (`marketing_ai_knowledge`) e Kit da
    Marca (`brand_dna`, `marketing_ai_config`) — preencher não gasta nada —,
    conectar Instagram, kit grátis e pagamento
    (`trial-video`, `diagnosis-gift`, `claim-diagnostic`, `create-checkout`,
    cupom), notificações/Telegram/configurações. Sem teste de 7 dias nem
    boas-vindas do trial em vitrine.
- **Rede de segurança no servidor (o mais importante):** até aqui NENHUMA
  function checava pagamento. `supabase/functions/_shared/access.ts`
  (`requirePaidAccess` / `hasPaidAccess`) usa a mesma regra do banco
  (`company_access_status`) e devolve **402 `{error:'Disponível no plano',
  code:'plan_required'}`**. Empresa criada antes de 2026-10-06 passa sempre;
  consulta com erro libera (falha aberta); conta nova só passa se pagou
  (`paid`/`stripe_subscription_id`) ou foi liberada à mão (`manual_access`
  lido direto da empresa: no `company_access_status` o trial vem antes do
  manual, e a Tespon — liberada à mão com trial gravado — seria trancada) — **o "trial" de 7
  dias que o `claim-diagnostic` ainda grava NÃO libera conta nova** (senão a
  trava ficaria aberta por uma semana), e bloqueada = 402. Os cron que varrem
  empresas pulam conta vitrine. Lista das functions em docs/PITFALLS.md.
- **Kit grátis só pra quem veio do diagnóstico:** "veio do diagnóstico" = o
  diagnóstico ligado à empresa (`diagnostics.company_id`) foi criado ANTES da
  conta (`useKitStatus`, `src/lib/useKitStatus.ts`). **Pop-up do kit:** em
  vitrine + com direito + kit ainda não criado, aparece TODA vez que entra no
  painel (por sessão do navegador), com "Ver meu presente" (→ `/gratis`) e
  "Depois" (fecha só naquela visita). Sem direito: `/gratis` mostra só os planos.
  - **Divergência que ficou:** a trava do direito é só de tela; o `trial-video`
    (`start`) não confere o diagnóstico e não foi alterado.
- **Lembrete "Suas informações ainda estão atualizadas?"** (só no sino, sem
  pop-up): aparece se `profile_confirmed_at ?? created_at` tem mais de 30
  dias, ou se existe estratégia criada depois da última confirmação. Botões
  "Está tudo certo" (grava a data) e "Quero atualizar" (Configurações →
  entendimento do negócio). Salvar a ficha também conta como confirmação. Não
  aparece pra conta bloqueada nem pra conta em vitrine sem ficha preenchida.
  **Nunca refaz a estratégia sozinho (regra 7):** se a ficha foi salva depois da
  estratégia atual (`companies.profile_changed_at`), a tela de Estratégia mostra
  um aviso com o botão "Atualizar estratégia com os novos dados", que usa o
  mesmo fluxo do "Pedir nova estratégia". Migration aditiva
  `20261015100000_profile_confirmed_at.sql` (duas colunas anuláveis).
- **Painel do Owner:** selo "Vitrine" na lista e na ficha da empresa (só
  exibição).
- **Catálogo opcional no /setup** — 2026-10-13. Pedido do dono: "Seu
  primeiro imóvel" não pode ser empecilho pra entrar no painel. O passo
  continua aparecendo no `/setup`, mas marcado "Opcional agora" e fora da
  contagem de obrigatórios (`SetupStep.optional` em `useSetupStatus.ts`).
  Se a conta não tiver nenhum item do catálogo, o sino de pendências mostra
  "Cadastre seu primeiro imóvel" (abre o "+" na aba do catálogo).
  Substitui a parte da decisão anterior que exigia o mínimo de itens com
  fotos antes de liberar o painel.
- **Agentes enxutos: Dados = produto; Conteúdo e Campanha em duas abas** —
  2026-10-14. Pedido do dono (anotações do painel), aprovado com "pode
  seguir".
  - **Botão "+"** deixou de abrir um modal (Contexto do negócio / Catálogo /
    Avatar): agora leva direto ao Agente de Dados → Catálogo, a mesma tela,
    sem duas telas fazendo a mesma coisa. O sino de pendências cai no item
    certo via `?item=<id>`. Contexto do negócio continua em Configurações.
  - **Agente de Dados = só o produto:** Catálogo (fotos reais; nome vem da
    ficha) + Meu avatar (em breve). Saíram da tela Inteligência de Mercado,
    Estilos e Visuais e Insights — a estratégia e o Higgsfield já consomem
    esses dados por trás (as tabelas e os componentes continuam no código,
    só não aparecem). Os links antigos `/insights` e `/saude-meta`
    redirecionam.
  - **Agente de Conteúdo e Campanha** com duas abas de topo:
    *Conteúdo* (Calendário da semana com o resumo/overview embaixo, Vault,
    Padrão visual = Kit da marca + Formatos de feed e stories) e *Campanha*
    (selo "Em breve" pra rodar anúncio pago; já mostra Como os conteúdos
    estão indo, Campanha ideal e pixel, Anúncios e Saúde da Meta).
    Saíram: Biblioteca (virou Vault + Padrão visual), Testes e a sub-aba
    Ideias do calendário (o calendário vem da estratégia).
  - Divergência registrada: a aba Saúde da Meta e a Campanha ideal ainda
    são **exemplo** (modo demonstração) — ver
    [DATA_AUDIT.md](DATA_AUDIT.md); viram dado real quando o Meta Ads for
    conectado.
- **Calendário da semana vem da estratégia, com stories e vídeos** —
  2026-10-14 (aprovado pelo dono: "sim, pode seguir"). Substitui a regra de
  2026-09 "o calendário só tem post orgânico". Cada dia mostra as vagas do
  mix da estratégia (feed, stories, vídeo) e o domingo cria as peças de
  cada vaga — inclusive as que saem de um imóvel do catálogo. Liga sozinho
  quando há estratégia ativa (o dono pode desligar no interruptor). Vídeo
  (custa) e DM continuam dependendo do dono. Detalhes em
  [CONTENT-INTELLIGENCE.md](CONTENT-INTELLIGENCE.md).
- **Portal de imóveis entra pelo XML do CRM (VRSync), não por API do
  portal** — 2026-10-14 (pedido do dono: "vamos puxar o portal também").
  ZAP/VivaReal não têm API pública de leitura; o caminho legítimo e grátis
  é o mesmo link XML que o CRM do corretor já manda pros portais. Foto
  sempre a real do anúncio; campo que o anúncio não traz fica vazio (nunca
  inventa número). O dono escolhe o que importar. Sincronização automática
  fica pra depois.
- **Mobiliar virtualmente (virtual staging)** — 2026-10-14 (aprovado: "sim
  pode seguir" ao teste pago pequeno). Higgsfield Qwen Image 3 Edit sobre a
  FOTO REAL de um cômodo (só de foto que já está no item). A foto real nunca
  é trocada: o dono vê o antes/depois e escolhe "usar no imóvel"; a
  mobiliada vai pra `meta.staged_photos` (vídeos e tour continuam só com as
  reais). Todo carrossel que usar uma delas leva na legenda o aviso da ficha
  ("móveis ilustrativos"). Só com plano e teto mensal por empresa
  (`VIRTUAL_STAGING_MONTHLY_CAP`, padrão 10). Teste no ensaio (1 geração):
  móveis entraram e a arquitetura ficou; **divergência**: o enquadramento
  muda um pouco (sai em 3:4 e a tela recorta em 4:5).
- **Padrão do feed** — 2026-10-14. O analista visual do `content-test`
  ganhou a nota `feed_fit` (encaixe no Kit da marca: cores, fontes, clima)
  na MESMA chamada — sem custo extra e sem mudar a regra do Vault
  automático. Conteúdo → Padrão visual → "Prévia do feed" mostra a grade
  3×3 das próximas peças com essa nota.
- **Liga quando paga** — 2026-10-14 (regra do dono: "vai ligar quando o
  pagamento for feito"). A primeira estratégia é criada sozinha na
  primeira visita ao painel e o calendário automático de domingo liga
  sozinho **só** para conta com assinatura (`stripe_subscription_id`) ou
  acesso liberado à mão (`manual_access`). Conta antiga sem assinatura
  (que o `hasPaidAccess` ainda trata como paga) não entra — o dono liga o
  interruptor se quiser. Objetivo: o cliente que pagou não precisa
  configurar nada.
- **Vault com foto real + Higgsfield** — 2026-10-14 (pedido do dono: "o
  vault deve ser ligado ao Higgsfield"). Setor com `real_photo_first` na
  ficha (imóveis): o post genérico do Vault usa uma foto REAL do catálogo
  tratada pela Higgsfield (mesmo tratamento do criativo do kit: luz, cor,
  nitidez — nada é adicionado ou tirado) em vez de imagem inventada pela
  OpenAI. Slides de carrossel usam a foto real sem tratamento (1 chamada
  paga por slide sairia caro). Sem foto no catálogo ou Higgsfield fora →
  foto real crua → fluxo antigo. Custo: 1 edição Higgsfield por post
  genérico (o mesmo valor do criativo do kit).
- **Celular sem zoom** — 2026-10-14. Toque duplo não dá zoom e campo de
  texto não amplia a tela sozinho (fonte de 16px no celular). O zoom de
  pinça continua liberado (acessibilidade).
- **Kit grátis: 1 foto → 3 artes** — 2026-10-14 (decisão do dono: "caminho
  A, mas precisa chamar atenção… o kit vira só 1 foto → 3 artes").
  Substitui o kit de 2026-10-11 (2 vídeos drone + 1 criativo).
  - O cliente manda **1 foto** (a mais bonita). A Higgsfield trata a foto
    **1 vez** (luz, cor, nitidez — nada é adicionado ou tirado) e o nosso
    `render-format` imprime 3 artes por cima: 2 pro feed (1080×1350) e 1 pro
    stories (1080×1920, texto longe das bordas que o Instagram cobre).
  - Textos, tamanhos e "letra maior" de cada arte ficam na ficha
    (`config.gift_creative.variants`, migration
    `20261017110000_gift_three_arts.sql`), sem número nenhum (regra 5). Pra
    chamar atenção: selo laranja no topo (`tag`), faixa laranja (`offer`),
    letras maiores (`scale`) e sombra mais forte embaixo.
  - Custo por kit: **1 edição Higgsfield** (antes: 2 vídeos × US$ 0,54 + a
    edição). As 3 artes não custam nada.
  - Kits antigos (com vídeos) continuam aparecendo no `/gratis`.
- **Teto de gasto por cliente continua US$ 40/mês** — 2026-10-14. O dono
  chegou a falar em US$ 50 e depois preferiu manter os US$ 40. (Os "US$ 20"
  da mesma conversa são outra coisa: o dinheiro de uma vez só pros testes
  finais, não um teto por cliente.) No código o teto vale hoje para os vídeos
  dos imóveis (`item-videos`, `VIDEO_MONTHLY_CAP_USD`, padrão 40).
  **Divergência registrada:** o tratamento de foto do Vault e o "mobiliar"
  ainda não entram nessa soma em dólar — têm limite próprio (mobiliar: 10
  fotos/mês). Juntar tudo num teto único em dólar fica como próximo passo.
- **Teto único de US$ 40 por cliente por mês** — 2026-10-14 (dono: "o
  próximo passo é juntar tudo num único teto de 40 dólares"). Fecha a
  divergência do item anterior. Tudo que é pago por peça soma no mesmo teto
  (`_shared/spendCap.ts`):
  - vídeos dos imóveis (`video_tours` kind `plan`, `cost_usd`);
  - edições de foto da Higgsfield: "mobiliar" (cada envio, inclusive a nova
    tentativa automática) + tratamento de foto do Vault (registrado em
    `agent_performance`, `task_key = 'photo_retouch'`);
  - imagens da OpenAI (`agent_performance`, `task_key = 'image_generation'`,
    estimativa do `generate-image`).
  Fora da soma: texto da IA (já tem limite diário no `hermes-proxy`) e o kit
  grátis (quem ainda não paga; teto global de 30 kits/mês).
  - **Ao bater o teto:** vídeo e "mobiliar" são bloqueados com aviso; o Vault
    não trava — usa a foto real sem tratamento (grátis).
  - A tela dos vídeos do imóvel mostra "Gasto do mês (vídeos, fotos e
    imagens): US$ X de US$ 40".
  - Variáveis: `CLIENT_MONTHLY_CAP_USD` (padrão 40; aceita o antigo
    `VIDEO_MONTHLY_CAP_USD`) e `HF_EDIT_COST_USD` (preço de 1 edição).
  - **Divergência registrada:** o preço da edição Higgsfield ainda não está
    confirmado (não é publicado numa página legível daqui). Enquanto
    `HF_EDIT_COST_USD` não for configurado, as edições são **contadas** mas
    valem US$ 0 na soma — nunca inventamos o número (regra 5). Medir no
    painel da Higgsfield durante os testes finais e configurar o secret.
- **Preços reais medidos no extrato da Higgsfield** — 2026-10-14 (print do
  dono, conferido com o que o sistema gerou em cada dia):
  - **Edição de foto (Qwen Image 3 Edit, 2k): US$ 0,08.** O teste de
    "mobiliar" de 14/10 saiu US$ 0,08, e o tratamento de cada kit de 11/10
    também. Vira o padrão de `HF_EDIT_COST_USD` no código e fecha a
    divergência do item anterior (as edições agora contam no teto). O Vault
    usa 1k — conta pelo mesmo valor, a favor do teto.
  - **Vídeo de 5 s (Kling 3.0 Std): US$ 0,42**, não os US$ 0,54 anotados em
    2026-10-08 (os 2 vídeos de cada kit de 11/10 saíram US$ 0,42 cada).
    `HF_COST_PER_SECOND` passou de 0,108 pra 0,084 no código. Antes o teto
    contava cada vídeo ~29% mais caro do que é.
  - Kit grátis antigo (2 vídeos + 1 tratamento) custava US$ 0,92; o novo
    (1 foto → 3 artes) custa **US$ 0,08**.
  - Com US$ 40/mês, um cliente cabe, por exemplo, ~95 vídeos de 5 s, ou
    500 edições de foto, ou uma mistura.
- **Máximo de 50 fotos por imóvel** — 2026-10-14 (decisão do dono). Vale no
  cadastro à mão (criar e "+ Adicionar fotos": envia só o que cabe e avisa),
  na importação do portal (antes 15 na tela e 20 no `portal-import`) e no
  banco (constraint `marketing_ai_knowledge_photos_cap`). Constante única na
  tela: `MAX_PHOTOS_PER_ITEM` em `src/lib/setupRules.ts`.
- **Aba Vault removida; a peça abre no calendário** — 2026-10-14 (pedido do
  dono: "para ver o post clico em cima na grade do calendário … pode apagar
  a aba Vault"). Clicar numa peça da grade abre `CalendarPostModal` com a
  imagem, a legenda, a análise e a nota. Passou na análise ("Pronta pra aprovar"):
  🚀 publicar agora ou 📅 agendar (sugere o dia planejado, 18h). Nota baixa
  ("Nota baixa — revisar"): mostra o porquê; o dono pode liberar mesmo assim
  ou excluir. O status `vault` continua existindo no banco (só o nome na
  tela mudou). Peças sem dia (feitas no Padrão visual, ou antigas) aparecem
  em "Peças avulsas", embaixo do calendário, pra não sumirem.
- **1ª estratégia só com os requisitos principais preenchidos** — 2026-10-14
  (decisão do dono: "a estratégia, mesmo após o pagamento, é criada somente
  após os requisitos principais serem preenchidos, de acordo com as
  notificações"). Requisitos = os do `/setup` e do sino: dados do negócio,
  perguntas da ficha, catálogo com o mínimo de itens/fotos da ficha e
  Instagram **só se a ficha pedir** (`config.setup.instagram_required`; hoje
  nenhuma ficha pede — o app da Meta ainda está em revisão). Vale no
  servidor (`_shared/setupReady.ts`, no `strategy-generate` e no cron) e na
  tela (`useSetupStatus.readyForStrategy`): o pagamento continua chamando a
  geração, que recusa com "Falta: …" até completar; o painel dispara sozinho
  assim que o último requisito é preenchido. Quem já tem estratégia segue
  igual.
- **Lembrete "Suas informações ainda estão atualizadas?" não acende na 1ª
  estratégia** — 2026-10-14 (achado no teste da Tespon: o sino mostrava 2 na
  conta recém-paga, um deles este lembrete, logo depois da estratégia nascer
  dos dados que o dono acabou de preencher). Agora "estratégia nova" só
  conta depois de uma confirmação anterior; o lembrete de 30 dias segue.
- **Teste Final gera só o que a estratégia pede** — 2026-10-14 (pedido do
  dono). Ver [TESTE-FINAL.md](TESTE-FINAL.md).
  - **Divergência registrada (2026-10-14, teste final):** a régua real do
    `content-test` é nota **≥50** nos dois analistas (texto e imagem), com o
    pedido "SEJA GENEROSO" no prompt — não 90, como textos antigos da tela
    diziam. A tela agora mostra a regra real; subir a régua é decisão do dono.
- **Imóvel editável depois de cadastrado + descrição** — 2026-10-14 (pedido
  do dono: "abrir as configurações e editar detalhes, descrição e fotos e ver
  todas as fotos"). No catálogo, "✏️ Ver fotos e editar" (ou clicar na capa)
  abre `CatalogItemEditor`: todas as fotos (clique = tela cheia), escolher a
  capa (★), mudar a ordem, tirar foto (apaga do armazenamento só depois de
  salvar) e editar todos os dados da ficha. Novo campo opcional
  `descricao` (texto até 1500, migration `20261017140000`); a importação do
  portal preenche com a descrição do anúncio, e o pacote do imóvel
  (`catalog-package`) passa a usar a descrição real do corretor no texto da IA.
- **Mínimo de 3 vídeos por semana, criados sozinhos pelo calendário** —
  2026-10-14 (decisão do dono: "devemos ter pelo menos uns 3 vídeos na semana
  e a estratégia, dependendo, pode jogar a quantidade pra cima").
  - Regra na ficha: `content_rules.min_videos_per_week = 3`. A estratégia é
    avisada no prompt e o `sanitizeContentPlan`/`ensureMinVideos`
    (`_shared/formatCatalog.ts`) completa o mínimo se ela pedir menos; mais
    que 3 fica como ela pediu. Estratégias antigas ganharam 3 vídeos no mix
    (migration `20261017150000`) e o calendário completa sozinho também.
  - Calendário: cada vaga de vídeo escolhe o imóvel menos usado e uma foto
    real ainda não usada em vídeo, escreve a legenda (sem inventar) e cria a
    peça na hora (receita `video_imovel`, capa = a foto). O `item-videos`
    (caminho do cron) confere o teto de US$ 40 e manda pra Higgsfield (5 s,
    US$ 0,42). O agendamento `item-videos-tick-5min` (creative-generate →
    item-videos `tick`) põe o vídeo na peça quando fica pronto; se falhar,
    não conta no teto e a peça diz o motivo. Nada é publicado sem o dono.
  - Antes era "você pede (custa)" — vídeo nunca saía sozinho.
- **Agente de Dados: "Ideias e trends" + Avatar dentro dos imóveis + excluir
  imóvel** — 2026-10-14 (pedidos do dono: "os posts não vão vir só do imóvel,
  às vezes vai ser criado um post do zero tipo PowerPoint só pela ideia que a
  trend traz… pode ser carrossel"; "meu avatar deve estar dentro de meus
  imóveis"; "deve ser possível excluir imóveis").
  - Sub-abas do Agente de Dados: **Imóveis** (catálogo + o card do Avatar "em
    breve" embaixo) e **Ideias e trends** (o antigo CreativeAgent: trends do
    segmento + ideias da semana). Cada ideia vira **✨ Post** ou **📑
    Carrossel** de slides; cada trend tem "Fazer carrossel desta trend".
  - **Carrossel de slides** (`deck` no `creative-generate`): 4 a 7 slides de
    texto (gancho → um ponto por slide → chamada), cada um um card do
    `render-format` com a marca — custo zero, a IA de imagem não escreve
    texto (regra 4). Também é um formato genérico (`carrossel_slides`) que a
    estratégia pode pôr no mix da semana.
  - Excluir imóvel: botão "🗑 Remover" visível no cartão e "Excluir imóvel"
    na janela de edição, sempre com confirmação. Posts já criados continuam
    no calendário.
- **Dicas jurídicas/financeiras: a IA aprova com fonte oficial** —
  2026-10-14 (pergunta do dono: "sobre as dicas jurídicas, tem como a IA
  aprovar por a gente?").
  - Dica geral (sem número nem regra) é aprovada sozinha.
  - Dica com número, prazo, taxa ou regra: a IA busca na web (Tavily, chave
    já em `_app_config`) e só aceita fonte oficial. Confirmou ou corrigiu →
    selo "✓ Conferida pela IA em [data], fonte: [link]". Sem fonte oficial →
    "precisa revisar", e só uma pessoa libera.
  - Reconferência a cada 60 dias.
  - Isso aprova a **dica** como fato; o **post** feito com ela continua
    precisando da aprovação do dono (regra 1). Implementação na etapa 2 do
    Agente de Dados ([ROADMAP.md](ROADMAP.md)).
- **Lugares perto pelo OpenStreetMap (grátis)** — 2026-10-14 (dono: "o google
  cobra por busca, não tem como utilizar outro sistema de graça?").
  - Nominatim acha o ponto do imóvel; Overpass lista o que tem em volta
    (com 2 servidores reserva, porque o principal às vezes fica ocupado).
    Sem chave e sem custo. Crédito "© colaboradores do OpenStreetMap" na tela.
  - Uma busca por imóvel, guardada em `meta.nearby`; só busca de novo se o
    endereço/bairro mudar ou o dono pedir (no máximo 1x por minuto).
  - Distância calculada em linha reta pelas coordenadas, nunca pela IA
    (regra 5). Sem endereço exato, os posts não citam distância.
  - Categorias, raio (1,5 km) e tags do OSM na ficha
    (`config.nearby_places`, regra 6). O campo "Endereço" é `private`: serve
    só pra busca, nunca vai pro prompt de legenda.
  - O dono pode esconder um lugar; o post usa só os visíveis.
  - "3 coisas perto" pega o lugar mais perto de cada categoria **na ordem da
    ficha** (praia, metrô, parque…), não só o mais perto de todos — senão
    uma cafeteria ganha da praia. Filtro de nome por categoria
    (`name_pattern`) tira lixo do mapa (parquinho marcado como praia).
- **Imóveis sem "post tipo tweet" e sem imagem genérica de IA** —
  2026-10-14 (dono, com print de uma moça andando na calçada: "estamos tendo
  posts que parecem vir do fluxo antigo, como post tweet e post gerado").
  - "3 coisas perto" e "o que R$ compra no bairro" não geram mais cena de IA
    (gente, padaria inventada): usam foto real do imóvel + card com os
    lugares reais (OpenStreetMap). Sem lugares, só foto real e texto sem
    nome de lugar.
  - A ficha de imóveis desliga o card genérico `post_card` (o "tweet") via
    `content_rules.disabled_formats`; as vagas dele na estratégia viraram
    carrossel de slides (migration `20261018110000`). Estratégia antiga que
    ainda tiver um formato desligado sai como carrossel de slides.
  - O carrossel de slides tem template próprio (`slide` no render-format):
    fundo da marca, frase grande, "2/5" e barra de progresso — antes cada
    slide era um "print de tweet".
  - O template tweet imprimia "128 Retuítes · 1.204 Curtidas · 14:22" quando
    o campo vinha vazio — número inventado (regra 5). Agora só aparece se o
    dono preencher (render-format e prévia da tela).
- **Como a IA confere as dicas (implementação)** — 2026-10-15.
  - Fonte oficial = domínio da lista da ficha (`config.faq.official_domains`:
    gov.br, jus.br, leg.br, prefeitura.rio, carioca.rio, Caixa, Banco Central,
    cartórios…). A busca (Tavily, chave que já existia) só pede esses sites e
    o código confere o domínio de novo.
  - A IA tem que copiar um trecho da fonte que sustente o veredito; se o
    trecho não estiver no texto da fonte, a dica fica "precisa revisar"
    (não confia na palavra da IA sem prova).
  - Corrigida: a resposta é trocada pela versão da fonte e a antiga fica
    visível riscada pro dono ver o que mudou.
  - No post: o card resumido e a legenda não podem ter número que a dica
    conferida não tenha (checagem no código); se tiverem, a peça não sai.
  - Reconferir a cada 60 dias **sem agendamento novo** (agendamento é
    alteração arriscada): reconfere ao abrir a aba e antes de usar no
    calendário. Dica vencida não vai pra post até ser reconferida.
  - Custo: ~1 busca Tavily + 2 chamadas de IA por dica conferida (centavos).
- **"Gerar agora" nas Peças avulsas + peças prontas em Aprovações** —
  2026-10-15 (pedido do dono).
  - Botão "⚡ Gerar uma peça agora" embaixo do calendário: o dono escolhe o
    tipo de criativo (só os que funcionam hoje na ficha — status `live`, sem
    DM) e, se for de imóvel, o imóvel (ou "escolher sozinho"). Sai **uma**
    peça sem dia (`planned_for` nulo), pelo mesmo motor das vagas do
    calendário (`creative-generate` ações `make_now_options` / `make_now` →
    `runPlanSlot`; `catalog-package` aceita `loose: true`). Ganha nota igual.
  - A aba Aprovações lia só a tabela antiga (`marketing_ai_content`) — as
    peças do calendário/avulsas (`marketing_ai_test_content`, status `vault`)
    não apareciam lá. Agora aparecem (menos as já agendadas) e o contador do
    menu soma elas. "Ver e aprovar" abre a mesma janela do calendário
    (publicar agora / agendar / excluir). Nada vai ao ar sem o clique do dono.
- **Nada preso ao fluxo antigo + marca a partir do logo + memória do
  conteúdo** — 2026-10-15 (pedido do dono).
  - **Aba Formatos (Padrão visual):**
    - saíram o "motor de imagem" manual (Print de Tweet, Post com Foto com
      fundo de IA…) e o catálogo de formatos próprios (`module='formato'`,
      zero cadastrados) — geravam pelo caminho antigo;
    - agora a aba lista os tipos de criativo da ficha (os mesmos da
      estratégia), com status e "⚡ Gerar agora"; ficou "Formatos &
      Dimensões" (tamanhos, usado no Adaptar).
  - **Portas fechadas no servidor:**
    - `fetchFormatCatalog` não lê mais formatos próprios;
    - `generateForCompany` vira carrossel de slides sempre que a ficha
      desliga `post_card` (cobre botão "✨ Post" das Ideias, cron diário
      antigo, estratégia antiga);
    - vaga de post que não seja `post_card` vira slides;
    - o botão "✨ Post" some das Ideias quando a ficha desliga o card.
  - **Enquete dos Stories ("pagaria R$X?"):** era o card "tipo tweet"; agora
    é a foto real do imóvel com a pergunta por cima (template `photo`).
  - **Cores da empresa nos cards:** os cards do `catalog-package` ("3 coisas
    perto", enquete) saíam no laranja padrão do Sales Boost — agora usam o
    Kit da Marca (cores, nome, logo).
  - **Logo:**
    - ao conectar o Instagram (`instagram-oauth-callback`), a foto de perfil
      vira o logo na hora (`brand-kit-suggest` `on_connect`);
    - nunca troca logo enviado pelo dono (só troca logo que também veio do
      Instagram — arquivo `logo-ig-*`).
  - **Cores a partir do logo:**
    - logo novo (enviado, colado ou do Instagram) → a IA lê o logo e preenche
      as cores (`brand-kit-suggest` `from_logo`), com "Desfazer" na tela;
    - na conexão do Instagram, as cores só mudam sozinhas se o dono nunca
      salvou o kit à mão;
    - custo: 1 chamada Haiku por logo.
  - **Memória do Agente de Conteúdo:** ver
    [LEARNING.md](LEARNING.md#memória-do-agente-de-conteúdo-implementado-2026-10-15).
- **Leads com presença digital fraca entram como oportunidade** —
  2026-10-15 (pedido do dono: "muitos leads que ficaram de fora eram bons;
  empresa sem muita presença digital é ideal pra gente também").
  - Antes: na busca de imóveis, 22 de 28 negócios achados foram rejeitados
    só por isso (18 com Instagram parado há 120+ dias, 4 sem Instagram no
    site).
  - Agora "Só quem já tem Instagram ativo" vem desligado:
    - esses entram marcados (`sales_prospects.digital_presence` =
      `sem_instagram` | `instagram_parado` | `ativa`);
    - ganham o ponto "Presença digital fraca (oportunidade)" (peso 30, o
      mesmo do Instagram ativo — um não vale menos que o outro);
    - o diagnóstico/abordagem da IA trata isso como a oportunidade.
  - Tela de Leads: selo 🌱 e filtro "Presença fraca".
  - Os 22 já rejeitados saem de `prospect_checked_places` e são reavaliados
    na próxima busca.
- **ICP do agente de leads: CORRETOR DE IMÓVEIS com Instagram sem vídeo,
  flopado ou mal produzido + potencial; busca em lotes por bairro** —
  2026-10-15. Primeiro o dono pediu imobiliárias; no mesmo dia trocou: "ao
  invés de imobiliária deveríamos procurar corretores de imóveis, a
  princípio com as mesmas métricas" (`business_types` = só "Corretores de
  imóveis"; com 1 categoria a busca por bairro usa todas as palavras dela;
  Instagram cadastrado como "site" no Google conta como Instagram). (Dono: "nosso ICP
  ideal são imobiliárias que têm contas do Instagram sem vídeo postado faz
  tempo OU flopada OU mal produzido, COM POTENCIAL DE CRESCIMENTO";
  "prospectar todos de uma vez possíveis e, na próxima rodada, mais").
  - **Sinais medidos no perfil real** (Apify, 12 últimos posts):
    - dias desde o último vídeo/Reels;
    - engajamento médio ÷ seguidores;
    - nota de produção 0-10 dada pela IA olhando as capas (Haiku com imagem).
  - **Score = POTENCIAL (até 50) + OPORTUNIDADE (até 50):**
    - potencial = nota/avaliações/avaliação recente/telefone/independente/
      público 300+;
    - oportunidade = sem vídeo 90+ dias (20), engajamento < 1% (15),
      produção ≤ 6/10 (15), ou sem Instagram/parado (25 — fica abaixo de
      quem tem Instagram ruim confirmado: "sem Instagram no site" pode só
      ser link faltando).
  - **"Instagram já forte" é rejeitado** (menos dor): vídeo nos últimos 30
    dias + engajamento ≥ 2% + produção ≥ 7.
  - **Busca:**
    - `prospect_settings.search_areas` (bairros): "palavra em Bairro,
      Cidade", 1 página por busca;
    - fila em `prospect_scan_log.queue`;
    - a função chama a si mesma (`continue_scan`) até acabar a fila ou bater
      `max_per_night` (agora "máximo de leads por busca");
    - sinal de vida em `heartbeat_at`;
    - botão "Parar busca";
    - só 1 varredura viva por vez;
    - a próxima rodada só pega negócio novo (`prospect_checked_places`).
  - **Custo/limite:** a conta do Apify tem teto de US$ 5/mês (visto em
    2026-10-15: US$ 0,93 usados). Prospecção em massa depende de subir esse
    plano — ver medição no PR.
  - **Teste com corretores (2026-10-15) — achado:** buscando "corretor de
    imóveis / corretora / consultor imobiliário" por bairro, o Google Maps
    devolve quase só imobiliárias. Sem filtro, a IA aceitou 10 (9 eram
    imobiliárias). Com a regra "só a PESSOA do corretor", 0 de 45 passaram:
    os poucos corretores individuais que aparecem têm 1-4 avaliações e caem
    no mínimo de avaliações (5). O Google Maps não é boa fonte pra
    corretor autônomo — ele vive no Instagram. Próximo passo em aberto
    (decisão do dono): afrouxar os filtros do Google pra corretor e/ou
    buscar direto no Instagram (bio com "corretor"/CRECI, hashtags).
  - **Correções vistas no teste:**
    - a lista de "já analisados" passou de 1000 e o banco só devolve 1000
      por leitura, então a busca reanalisava (e pagava de novo) gente já
      vista. Agora lê em páginas;
    - "Parar busca" gravava um status que o banco não aceita (`stopped`).
      Agora grava `done` com a nota "Parada por você".
- **Onboarding imobiliário v2 + diagnóstico "pronto pra gerar conversas"** —
  2026-10-16. Pedido do dono (prompt "Refatoração do Onboarding Imobiliário"),
  com as decisões dele na conversa:
  - **Público:** imobiliária é o cliente pagante principal, mas o fluxo do
    corretor (autônomo ou associado) é tão completo quanto. Quatro perfis:
    dono/sócio, gestor comercial, corretor autônomo, corretor associado.
  - **Duas fases:** diagnóstico curto ANTES do cadastro (4 passos, ~2 min:
    você → operação → prioridade → Instagram); as **5 etapas** completas
    DEPOIS, no /setup (operação, imóveis e mercado, prioridade comercial,
    canais e desempenho, inteligência comercial). O que foi respondido no
    diagnóstico já vem preenchido no /setup (lido de `diagnostics` pelo
    `company_id`, sem mexer no claim-diagnostic).
  - **Nunca travar por dado comercial:** todo campo aceita "Não sei",
    "Não se aplica" (quando faz sentido) ou "Preencher depois". "." / espaços
    não viram resposta: o campo fica pendente com aviso amigável. Estados em
    `companies.answer_status` (valor real continua só em `playbook_answers`).
    Obrigatórios de verdade: tipo de negócio, perfil, cidade, Instagram e
    e-mail do diagnóstico (o Instagram é o que é analisado; o e-mail é o
    limite de 3 diagnósticos/dia e do presente). Nome da empresa só pra
    perfil de imobiliária.
  - **Tudo de setor na ficha** (regra 6): perguntas, opções, "por que
    perguntamos", perfis, condicionais, ações por prioridade, hipóteses de
    público e padrões do diagnóstico em `vertical_playbooks.config.onboarding_v2`
    (migration `20261019120000_onboarding_v2.sql`). Ficha sem v2 = fluxo
    antigo, igual (testado com "Airbnb").
  - **Compatível com as 6 perguntas antigas** (`onboarding_questions`, que
    o servidor ainda confere): 5 estão no v2 com as mesmas chaves e opções;
    `transacao` é calculada de "O que você faz hoje?" (`derive`).
  - **Configurações:** o card "Entendimento do negócio" mostra as 5 etapas,
    o resumo e as pendências; o sino e os avisos levam direto pro campo
    (`?section=entendimento&q=<campo>`). A estratégia mostra "Dá pra ficar
    mais certeiro" quando falta um dado que ela usa (`needed_for`).
  - **Agentes:** Hermes e Estratégia recebem um bloco que separa informado /
    lido automaticamente / "não sabe" / não se aplica / pendente
    (`_shared/answerContext.ts`). Equipe da imobiliária (convites,
    corretor pedindo acesso) **fica pra depois** — mexe em banco e
    segurança (alteração arriscada), decisão do dono.
  - **Diagnóstico:** seção nova "Seu Instagram está pronto pra gerar
    conversas?" com três camadas separadas — **dado observado** (posts com
    chamada pra conversa, posts que citam bairro, último vídeo, CRECI /
    WhatsApp / bairro na bio, perguntas nos comentários), **análise** e
    **hipótese a validar** (nunca promessa). O run-diagnosis passa a guardar
    legenda e amostra de comentários dos posts. "Perguntas sem resposta" NÃO
    é afirmado: a amostra de comentários do raspador não garante ver as
    respostas — dizemos só quantas perguntas apareceram. A nota de 0 a 100
    (Growth Score) não mudou.

## 2026-10-17 — Diagnóstico sem kit grátis + tela de carregamento desde o envio (pedido do dono)

- **Kit grátis sai do diagnóstico.** O cadastro do diagnóstico não pede mais
  a foto do presente, e o botão do resultado não promete "artes grátis"
  (agora: "Criar minha conta e entrar no painel"). Motivo: pedido do dono.
  O que continua: o código do kit no servidor (`diagnosis-gift`,
  `trial-video`), o aviso de andamento para diagnósticos antigos que já
  pediram o presente, e o kit pelo painel/`/gratis` — se for pra tirar
  também de lá, é outra decisão do dono.
- **Primeira tela:** "o que descreve você?" em botões grandes, sem a barra
  antiga de 5 passos (parecia que o onboarding novo não tinha sido
  publicado).
- **Carregamento:** a tela com o "S" da logo enchendo + barra aparece desde
  o clique em enviar (antes, a parte mais demorada — ler o Instagram, até
  ~1 min — mostrava só uma bolinha girando com "Analisando seu negócio").
- **Diagnóstico vira página própria** (`/diagnostico`): todos os botões do
  site levam pra lá; a página inicial só tem o convite. A rota antiga
  `/onboarding` continua funcionando (mesma tela).
- **Barra parada:** se a barra não andar por 5 s, aparece "Não travou —
  estamos só garantindo que sua experiência seja a melhor."
- **Kit grátis acabou de vez** (pedido do dono, mesmo dia): sai também do
  painel (cartão do vídeo/artes grátis e pop-up "seu presente está
  esperando") e da página `/gratis`, que vira só a página dos planos. O
  servidor (`trial-video`) recusa kit novo (`KIT_ENDED`); kits antigos
  continuam consultáveis.
- **Pop-up do painel vira o do cupom:** conta nova em modo vitrine vê "Você
  ganhou um cupom de R$X" (R$1.000 imobiliária / R$200 corretor, 1º mês),
  com o prazo que falta; "Usar meu cupom" leva aos planos com o cupom já
  aplicado no mensal. Os 7 dias começam na primeira vez que o pop-up aparece
  (`trial-video` action `coupon_seen`, que antes só valia depois do kit).
  Some quando o cupom vence ou a conta paga.
- **"Disponível no plano"** (modo vitrine) continua igual: a conta nova vê
  todas as ferramentas, mas tudo que cria/publica/gasta abre o aviso.
- **Tela de espera animada** (pedido do dono, mesmo dia): atrás do painel do
  carregamento, fotos reais de imóvel flutuam soltas → se organizam numa
  faixa de tour que desliza → os criativos do Sales Boost passam na frente
  com leve desfoque (dá pra ver o design, não ler tudo). Repete enquanto o
  diagnóstico roda; quem decide quando sai é o andamento real (não atrasa
  nada). Com "reduzir movimento", fica parada. O resultado entra com um
  esmaecimento suave. Imagens em `src/assets/loader/` (240 KB, webp): 8
  fotos e 4 criativos **da conta de teste** (Tespon / QA Kit), escolhidas
  sem objetos pessoais. As 6 artes do Pinterest **não** foram usadas
  (trabalho de outras empresas). Antes de ir ao ar, o dono confirma que
  pode mostrar as fotos desse apartamento.
- **Roteiro da tela de espera ajustado pelo dono:** fotos flutuam → se juntam
  no centro e viram o **tour virtual** (vídeo do mesmo apartamento, enviado
  pelo dono; `tour.webm` pra Chrome/Android e `tour.mp4` pro Safari/iPhone,
  ~700 KB cada, o navegador baixa só um) → enquanto isso, **10 criativos**
  passam ao fundo desfocados, em duas faixas. Os criativos: 4 gerados pelo
  Sales Boost na conta de teste + 6 nos estilos das referências que o dono
  mandou (título fino sobre a foto, empreendimento com painel de números,
  título vertical com condições, carrossel com faixa dourada, mini-cartões
  de diferenciais, "À venda" com cápsulas), **refeitos por nós** com as fotos
  do mesmo apartamento, marca "Sua Imobiliária" e "valores ilustrativos". As
  artes originais (de outras empresas) não entram, nem desfocadas.
- **Tela de espera, 3ª versão (pedido do dono, mesmo dia):**
  - As fotos que flutuam agora são **quadros do próprio tour** (8 cômodos
    tirados do vídeo), pra ficar claro que o tour nasceu delas. Divergência
    registrada: o item acima dizia "fotos e tour do mesmo apartamento"; as
    fotos antigas eram da conta de teste e não do vídeo.
  - Selo do vídeo: "Tour virtual gerado pela IA do Sales Boost" (texto do
    dono).
  - Quando o tour acaba, os 6 criativos refeitos aparecem **um por vez** no
    lugar dele (~2,8 s cada); as faixas desfocadas continuam ao fundo. Ciclo
    completo ≈ 44 s, depois recomeça.
- **Diagnóstico não se perde se fechar o celular:**
  - `run-diagnosis` cria o diagnóstico e **devolve o id na hora**; a leitura
    do Instagram/site continua no servidor em segundo plano
    (`EdgeRuntime.waitUntil`, o mesmo jeito do `diagnosis-market`). Se a
    análise falhar, a linha vira `partial` (a página nunca fica esperando
    pra sempre).
  - O aparelho guarda o último diagnóstico (`src/lib/savedDiagnosis.ts`,
    30 dias). Quem abre `/diagnostico` de novo vê "Seu diagnóstico está
    salvo neste aparelho" → **Ver meu diagnóstico** ou **Começar outro
    diagnóstico** (ideia do dono; o anterior continua salvo).
  - A página do resultado espera a leitura do Instagram por até 3 min (era
    1,5 min, quando a espera acontecia antes de abrir a página). Diagnóstico
    com mais de 6 min ainda "processando" não espera: mostra o que tem.
  - O aviso da tela de espera trocou "Não feche esta página" por "Se fechar
    a tela, o diagnóstico continua e fica salvo neste aparelho".

## 2026-10-19 — Diagnóstico com Social Selling no centro (pedido do dono)

- **Por quê:** o dono trouxe um roteiro novo para o diagnóstico grátis. O
  objetivo é mudar como o corretor enxerga o próprio Instagram: mostrar que
  o perfil pode preparar o comprador para confiar e iniciar uma conversa, não
  só divulgar imóveis. Mais métricas não fazem isso. Detalhes em
  docs/PRODUCT.md, na seção "O diagnóstico grátis".
- **O que mudou:**
  - O `run-diagnosis`, depois de ler o Instagram e ainda em segundo plano,
    faz uma chamada ao Claude (`_shared/socialSelling.ts`).
  - Essa chamada classifica cada post em uma categoria da ficha e escreve:
    o que cada pilar mostra, a resposta à pergunta-guia, a oportunidade
    ignorada (lacuna → consequência → novo jeito de pensar) e um post de
    exemplo com objetivo estratégico.
  - O resultado fica em `diagnostics.social_selling`.
- **Regra 5 (nunca inventar número):**
  - Quem conta é o código: quantos posts há de cada categoria e de cada
    pilar, e qual o nível de cada pilar.
  - A IA não escreve números. Toda frase dela que tiver algarismo é
    descartada.
  - Os trechos citados são as legendas reais.
- **Regra 6 (setor na ficha):** fica em `config.onboarding_v2.social_selling`
  da ficha `imoveis_rio`:
  - as categorias de post;
  - os 5 pilares (pergunta, categorias, limite para "forte" e o "por que
    importa");
  - as dúvidas comuns do comprador.

  Os sinais de Conversão e Relacionamento usam os padrões que já estavam em
  `diagnosis_readiness`.
- **Página:**
  - Ordem nova: nota → mercado → pilares → oportunidade → exemplo → CTA.
  - Potencial, pontos que travam, "como a nota foi formada" e "como
    calculamos" foram para um bloco "Detalhes da nota", fechado. Nada foi
    removido.
  - A fórmula da nota não mudou.
  - Sem `social_selling` (diagnóstico antigo, ficha sem a chave, IA fora do
    ar ou teto do mês atingido), a página continua como antes, com
    "Pronto pra gerar conversas?".
- **Custo (regra 7):**
  - Uma chamada de texto por diagnóstico, cerca de US$ 0,03.
  - Teto mensal `SOCIAL_SELLING_MONTHLY_CAP`, padrão 300.
  - O mesmo Instagram nas últimas 24 h reaproveita a análise.
- **Divergência registrada:** o plano previa um tipo novo em
  `src/lib/onboardingV2.ts`. Não foi preciso, porque a página lê tudo pronto
  de `diagnostics.social_selling` (nomes, pilares e textos) e não lê a ficha.
- **Ajuste do dono, mesmo dia: página em 3 camadas.** Feito no mesmo PR,
  antes do merge.
  - **Camada 1, "O que você está fazendo hoje":** nota, do que falam os
    posts, "o que já funciona como vitrine" (pilares fortes; sem nenhum
    forte, mostra os parciais) e o mercado.
  - **Camada 2, "O que você precisa entender sobre geração de demanda":**
    princípios fixos da ficha (`social_selling.principles`), cada um com
    exemplo imobiliário e ligado a um pilar, sem IA e sem custo. O dono
    pediu 5; acrescentei um 6º ("A confiança começa antes da primeira
    conversa") pra que todo pilar tenha o seu princípio. Fecha com "dá pra
    começar a aplicar hoje".
  - **Camada 3, "Como aplicar isso ao seu perfil":** a resposta à
    pergunta-guia, os pilares (cada um com a linha "Princípio: …"), a
    oportunidade ignorada e o post de exemplo.

## 2026-10-19 — /setup removido; essenciais no diagnóstico (pedido do dono)

- **Por quê:** o dono entrou na conta teste2 (Tespon, liberada à mão) e
  ficou preso no /setup. O pedido dele foi: "pode excluir essa página, e a
  tab de notificações vai notificar a falta de certas informações… na
  criação de cadastro o máximo dessas informações já deve ser respondida".
- **Substitui** a decisão "/setup obrigatório no fim do cadastro" e a parte
  "/setup só depois de pagar" das decisões de 2026-10-13 e 2026-10-16.
- **O que mudou:**
  - **Página e gate:** removidos. Quem paga ou é liberado à mão entra
    direto no painel. Links antigos pra `/setup` caem em Configurações.
  - **Essenciais no diagnóstico** (opção escolhida pelo dono: "só as
    essenciais", cerca de 1 minuto a mais):
    - entram 4 perguntas da ficha: CRECI, tipos de imóvel, faixa de preço
      (a estratégia precisa dela) e quem quer atrair. Feito com a migration
      `20261019200000_onboarding_essenciais.sql`, que só mexe no JSON da
      ficha;
    - as etapas do diagnóstico passam a ser: Você · Sua operação · Mercado e
      prioridade · Instagram e contato;
    - o telefone/WhatsApp sobe de posição, com uma explicação, e continua
      opcional.
  - **As outras perguntas** ficam em Configurações → "Entendimento do
    negócio".
  - **O sino de pendências** cobra o que falta:
    - as perguntas (já cobrava);
    - fotos e Instagram (já cobrava);
    - **novo:** dados do negócio (nome, cidade e telefone, com a mesma regra
      do servidor em `setupReady`).
  - **Respostas do diagnóstico → empresa:** quem fazia isso era o /setup.
    Agora acontece no 1º acesso ao painel, só nos campos vazios.
  - **Botão "Completar agora" da estratégia:** leva direto pro que falta
    (dados, perguntas ou catálogo).


## 2026-10-19 — Estratégia focada no que o Sales Boost faz (pedido do dono)

- **Pedido:** "o agente de estratégia deve estar tailored para o que o Sales
  Boost oferece… eu amo a forma detalhada e a length das estratégias, mas
  elas precisam ser direcionadas ao que a gente faz".
- **O que estava errado** (estratégia ativa da Tespon, conta de teste):
  - planejava coisas que o produto não executa: DM → WhatsApp do
    corretor, videochamada, "registro manual dos leads" e Instagram Ads
    como canal de orçamento;
  - tratava vídeo como "opcional", contra a regra de mínimo semanal;
  - não usava o Social Selling: os 5 pilares e o resultado do diagnóstico
    não chegavam ao Hermes.
- **O que mudou** (`strategy-generate` e `_shared/formatCatalog.ts`):
  - **Escopo do produto no prompt** (`SCOPE_BLOCK`), nas 3 rodadas: tese,
    plano tático e atualização mensal.
    - Executa: conteúdo do calendário no Instagram, "comente PALAVRA",
      respostas aprovadas e lead no funil.
    - Não executa hoje: anúncio pago (em breve), WhatsApp, e-mail,
      site/SEO, Google, TikTok, CRM externo, videochamada.
    - O que está fora do escopo só aparece em "exclusões".
    - É do produto, não de setor, por isso fica no código. Atualizar quando
      o Sales Boost passar a executar algo novo.
  - **Social Selling como espinha:**
    - pilares da ficha mais o nível de cada pilar no diagnóstico da
      empresa;
    - a tese ataca primeiro os pilares ausentes ou parciais;
    - a IA diz como trabalha cada pilar (`content_plan.pillars`) e qual
      pilar cada etapa do funil fortalece (`funnel_plan[].pillar`);
    - nome e nível do pilar vêm da ficha e do diagnóstico, nunca da IA.
  - **Orçamento:** só o que o Sales Boost produz; `paid_ads` fica vazio.
    Vídeo faz parte do mix mínimo.
  - **Opções pedidas ao Hermes:**
    - metas: lead_gen, instagram_growth, engagement, awareness;
    - componentes: positioning, content, acquisition, conversion,
      competitive_response;
    - a gravação continua aceitando as listas completas, pra estratégias
      antigas.
  - **Tela da estratégia:**
    - novo bloco "Como a estratégia trabalha seus 5 pilares";
    - cada etapa do funil mostra o seu pilar;
    - os textos "você gera/pede no imóvel" foram corrigidos pra "o
      calendário cria", que é o que o código faz desde 2026-10-14.
- **Igual:** o tamanho e o detalhe da estratégia (mesmos campos, mesmo
  limite de texto).
- **Estratégias já ativas:** só mudam quando forem geradas de novo. A
  atualização mensal mantém a tese e não cria os pilares.
- **Perguntas novas** (pedido do dono 2026-10-20; migration
  `20261020090000_onboarding_custos_grupo.sql`, só no JSON da ficha):
  - **"Quanto você gasta por mês, hoje, pra conseguir clientes?"**
    (`gasto_aquisicao`): faixas de "Nada / quase nada" até "Mais de R$ 5
    mil". Fica no diagnóstico, etapa "Mercado e prioridade". A estratégia
    usa só a faixa informada e nunca calcula retorno (regra 5). Antes só
    existiam "Você faz anúncios pagos?" (sem valor) e o orçamento de
    marketing em Configurações.
  - **"A que imobiliária ou grupo imobiliário você está ligado(a)?"**
    (`imobiliaria_parceira`, que já existia como "Com qual imobiliária você
    trabalha?" e ficava só em Configurações). Passa a entrar no
    diagnóstico, só pra corretor associado.
- **Business Game por imobiliária** (regra do dono): os corretores da mesma
  imobiliária jogam juntos. A pergunta acima é o primeiro passo. A
  ligação confirmada e o placar ficam pra um PR próprio, porque mexem em
  quem vê dados de quem (ver [ROADMAP.md](ROADMAP.md), 2026-10-20).
- **soul.md:** o dono pediu atualizar, e depois pediu pra esquecer. Não
  existe no repositório.
- **Correção pós-deploy (2026-10-21):** no teste real da Tespon, a parte 1
  da estratégia foi cortada nas duas tentativas (2200 e 3200 tokens),
  porque agora traz os pilares. O limite subiu pra 3600, com nova
  tentativa em 4200, e o texto de cada pilar foi encurtado pra 1 frase.
  Enquanto a correção não entra, uma geração nova falha. A estratégia
  ativa de cada cliente continua no lugar, porque só é trocada quando a
  nova termina.

## 2026-10-21 — Criativos: 4 famílias fixas, formato fixo × intenção da estratégia (decisão do dono)

- **Pedido do dono:** melhorar o fluxo de criativos com a identidade visual do
  cliente e ter carrosséis educativos, sem encher o calendário de tipos novos.
  "Os formatos são pré-definidos, mas a intenção do post vem da estratégia."
- **Decidido:**
  - 4 famílias fixas — Tour virtual · Criativo de oferta · Carrossel educativo ·
    Bairro e estilo de vida — + prova social/bastidores **só eventual**.
  - Mix padrão por semana: 3 tour · 2 oferta · 2 educativo · 1 bairro. Sempre
    as mesmas famílias; a Estratégia aprende e melhora os **ângulos**.
  - Calendário rotulado pelas 4 famílias.
  - Capa do educativo varia; usa a foto real do corretor quando existe no
    sistema, senão só o design da marca.
  - Trends/notícias entram na intenção do post (`gancho_atual`), **só com fonte
    gravada** (link, veículo, data, trecho) — regra 5.
- **Achado:** hoje não há fonte de notícia em tempo real no código e
  `marketing_ai_trends` não guarda link/data da fonte.
- **Plano completo e fases:** [PLANO-CRIATIVOS.md](PLANO-CRIATIVOS.md) (ainda não
  implementado).

## 2026-10-21 — Estrela vermelha = obrigatório; telefone e nome obrigatórios no diagnóstico (pedido do dono)

- **Contradição resolvida:** o diagnóstico dizia "(opcional)" para telefone e
  para o nome do perfil pessoal, mas a estratégia (`_shared/setupReady.ts`)
  exige nome, cidade e telefone — a pessoa fazia o diagnóstico, pagava e só
  então descobria que a estratégia não começava.
- **Decidido:** estrela **vermelha** (`#ef4444`) em qualquer campo = obrigatório,
  em todas as telas (diagnóstico, Configurações, perguntas da ficha que não
  aceitam "Não sei/Depois/Não se aplica"). No diagnóstico: nome (2+ letras),
  cidade (2+ letras) e telefone (10+ dígitos) passam a ser obrigatórios para
  todos os perfis, inclusive pessoa física. Cada etapa com campo obrigatório
  mostra a linha "* obrigatório"; Configurações mostra "* obrigatório pra
  estratégia começar".
- **Regra única no código:** `src/lib/requiredFields.ts` (espelho de
  `setupReady.ts`); o sino de pendências usa a mesma.
- **Só telas** — nenhuma function mudou.

## 2026-10-22 — Rótulo único por peça e trava do QUERO em todas as peças (fase 3 do PLANO-CRIATIVOS)

- **Decidido pelo dono:** (1) a semana de teste da fase 3 roda no banco de
  **ensaio**, antes de qualquer aprovação em produção; (2) a trava do QUERO
  vale em **todas** as peças — post, carrossel, vídeo e pacote do imóvel.
- **Armazenamento do rótulo:** `tema` = coluna **`pillar` que já existia**
  (pilar de conteúdo da ficha; sem renomear, sem coluna nova); `familia` e
  `pilar_ss` são colunas novas (texto) em `marketing_ai_test_content` e
  `posts`; `intent` (jsonb, o "porquê" da peça) só em
  `marketing_ai_test_content`. `weekly_mix[]` guarda `familia`, `pilar_ss` e
  `tema` ao lado do `pillar` legado (que segue valendo pra estratégia antiga).
- **Quem decide o quê:** `familia` (campo `family` do formato, na ficha) e
  `tema` vêm do catálogo; `pilar_ss` a IA sugere e o código valida contra a
  ficha, com fallback fixo. A IA nunca escreve família nem tema.
- **Fora do PR:** `agent-actions` (copiar o rótulo pra `posts` na publicação) —
  é função de cliente real. Até lá o rótulo existe na peça, mas se perde na
  publicação.
- **Migration:** `supabase/migrations/20261022150000_rotulos_familia_pilar_ss.sql`
  (aditiva; bloco DESFAZER no topo).

## 2026-10-23 — Logo em PNG transparente, rótulos na publicação e legenda sem recado pro corretor (pós-fase 3)

- **Pedido do dono:** (1) logo limpa nos criativos (hoje JPG com fundo branco vira quadrado branco; foto de
  perfil vira "logo"); (2) `familia`/`pilar_ss` chegarem em `posts`; (3) a legenda nunca falar com o corretor.
- **Decidido — logo:** o criativo usa um PNG transparente preparado pelo `brand-kit-suggest` (`process_logo`),
  guardado em `brand_dna.logo_meta` (migration aditiva `20261023120000_brand_dna_logo_meta.sql`). Imagem que a
  IA classifica como **foto** não vira logo (criativo usa o nome da marca em texto). Fundo só é removido se
  for liso (flood-fill das bordas); senão a imagem não é mexida e o dono é avisado. Sem backfill automático
  e sem trocar logo enviada pelo dono. Biblioteca: imagescript@1.3.0 (decodifica/codifica) + o resvg-wasm que o
  `render-format` já usa (SVG) — sem custo novo.
- **Decidido — rótulos:** `agent-actions` copia `familia`/`pilar_ss` num bloco à parte, tolerante.
- **Decidido — legenda:** trava em código (`_shared/internalNotes.ts`) no `catalog-package` + prompt reforçado;
  o recado que sai aparece pro dono em `reasoning`. Não remove só por "corretor" nem só por ⚠️.
- **Fora deste trabalho:** `brand-compose`, `creative-generate` (legenda) e o agrupamento do aprendizado por
  família/pilar (`learning.ts`). Detalhes e divergências em PLANO-CRIATIVOS → "Correções pós-fase 3".

## 2026-10-25 — Pontas soltas pós-fase 3: backfill do logo, aprendizado por família e legenda em toda peça

- **Decidido — backfill do logo:** ação manual `backfill_logos` no `brand-kit-suggest` (só `cron_secret`,
  `dry_run` por padrão, lotes de até 10, sem cron novo). Logo do dono que parece foto não é gravado. Isso
  **ajusta** a decisão de 2026-10-23 ("sem backfill automático"): continua sem automático, passa a existir sob
  demanda, e só gasta IA (Haiku, ~US$ 0,003 por logo) quando o dono do produto roda de propósito.
- **Decidido — aprendizado:** medir também por família, pilar de SS e família × pilar, **sem fatia sugerida**.
  A frase "o que funcionou" é montada por código (nunca pela IA) e só aparece com 1º lugar único; o relatório
  semanal ainda não existe, então a frase só aparece na estratégia (log do refresh).
- **Decidido — legenda:** a trava de recado agora vale no `creative-generate` (foto, deck e vídeo), não só no
  `catalog-package`. Texto impresso na imagem fica de fora (PITFALLS).
- **Decidido — `brand-compose`:** usa o logo preparado, com a mesma regra do `render-format`; o
  `render-format` não foi movido pra não mexer em produção.

## 2026-10-26 — Carrossel educativo único com fonte (decisão C, fase 2 do PLANO-CRIATIVOS)

- **Pedido do dono:** juntar `carrossel_slides` e `carrossel_educativo`. Tema regulado (jurídico,
  financiamento, documentação, impostos — categorias do `dica_faq`) usa só dica liberada; sem dica liberada
  daquele tema, sai como dica geral sem número, prazo, taxa nem nome de lei; tema leve continua livre com a
  trava de números. A mudança na ficha de produção vai no PR.
- **Decidido — um formato só:** `carrossel_educativo` (ficha) vira `live`; `carrossel_slides` fica
  desligado na ficha de imóveis (`disabled_formats`) e vira apelido (`content_rules.format_aliases`), então
  estratégia e vaga antigas continuam saindo, agora como educativo. O genérico `carrossel_slides` no código
  não muda (outros setores). `weekly_mix` de estratégia nenhuma é alterado.
- **Decidido — quem decide o tema é código + ficha:** termos da ficha (`config.faq.category_terms`) →
  se não decidiu, uma pergunta barata à IA (resposta validada: fora da lista = leve). Termos regulados
  (`regulated_terms`) e categorias reguladas (`regulated_categories`) também vivem na ficha (regra 6).
- **Decidido — regras duras em código, não no prompt:** modo regulado só aceita números e termos que as dicas
  têm; modo geral barra qualquer número, percentual, valor, prazo por extenso, "art.", "alíquota", nome de lei
  e termo regulado; falhou → 1 reescrita → texto de reserva montado pelo código (resposta da dica / texto fixo
  sem fato). No regulado ainda roda um verificador barato de afirmações.
- **Pendente do dono:** **aluguel** e **geral** ficaram como tema LEVE (fora de `regulated_categories`) para
  não travar o carrossel de aluguel sem dica; os termos sensíveis (Lei do Inquilinato, Código Civil…) estão
  nos `regulated_terms` e acionam só a rede de segurança. Se o dono quiser aluguel como regulado, é acrescentar
  `aluguel` em `config.faq.regulated_categories` (SQL na ficha).
- **Decidido pelo dono (2026-10-26) — aluguel vira tema REGULADO.** Migration
  `20261026130000_aluguel_regulado.sql` acrescenta `aluguel` em `regulated_categories` e ajusta a nota do formato.
  Carrossel de aluguel agora usa só dica liberada da categoria aluguel; sem dica, sai como dica geral. **Geral**
  continua leve.

## 2026-10-26 — "Tudo automático" (princípio do dono) + dicas opção A + horário padrão de publicação

- **Princípio — "Tudo automático".** Nenhum processo pode depender de botão manual. Cada etapa roda sozinha
  (agendamento, gatilho ou passo encadeado). Botão na tela só como atalho opcional ("refazer agora"). A **ÚNICA**
  ação humana é a **aprovação do dono antes de ir ao público** (Telegram/Aprovações) — a regra 1 não muda.
  Aplicado nesta rodada (tudo em código; deploy e migration dependem de "pode"):
  1. **Logo preparado sozinho:** salvar o logo por link já prepara (igual ao upload); logo trocado por qualquer
     caminho é preparado na primeira peça que notar (`kickLogoPrepare` → `brand-kit-suggest` `prepare_logo`,
     em segundo plano, trava de 1 h em `logo_meta.attempted_at/attempt_src/attempt_status`, sem coluna nova).
     Nunca troca o `logo_url` do dono; logo do dono que a IA acha "foto" não vira "foto" sozinho (só marca a
     tentativa). O botão virou "Refazer o preparo do logo".
  2. **Publicar no dia planejado:** aprovar peça com `planned_for` no futuro (dia de Brasília depois de hoje)
     **agenda** pro dia no horário padrão; sem data/hoje/passado publica ao aprovar. "Publicar agora" ficou como atalho.
  3. **Calendário assim que a estratégia nova fica pronta:** `strategy-generate` (2ª etapa, kind main) chama
     `creative-generate` `plan_rest_of_week` — só amanhã até domingo, nada se faltarem < 2 dias; não duplica.
  4. **Peça com nota ruim é refeita sozinha, no máx. 1 vez** (só texto; ver "Escopo" abaixo).
- **Horário padrão de publicação: 18:00 (America/Sao_Paulo, offset fixo -03:00).** Não existe preferência de
  horário por empresa no banco (`best_posting_hour` em `instagram_metrics` é medição, não escolha do dono), então
  o horário é uma constante definida em **um lugar**: `supabase/functions/_shared/publishSlot.ts`
  (`PUBLISH_HOUR_BRT`). A tela tem uma cópia só pra escrever "vai sair dia X às 18h" (`src/lib/publishSlot.ts`);
  `scripts/test-publish-slot.mjs` falha se divergirem. Telegram: a mensagem da peça e os botões dizem
  "Aprovar (sai dia X às 18h)"/"Sim, agendar pro dia X às 18h". O dono pode cancelar o agendamento no painel
  enquanto a hora não chega. Se quiser outro horário (ou um por empresa), é mudar a constante / criar a preferência.
- **Escopo da refação automática (conservador):** só reescreve o TEXTO (ideia, legenda, hashtags, CTA) quando a
  nota de coerência do texto ficou ruim; no máx. 1 vez (`brief.auto_redo=true`, marcado ANTES de reescrever).
  Fora: problema só visual, peça de imóvel/pacote/vídeo (dado real e custo Higgsfield), carrossel de tema
  regulado, `runFaqSlot`/`runVideoSlot`/catalog-package. A reescrita não pode trazer número novo nem recado pro
  corretor (senão é descartada e o original fica). Passou → vai pra aprovação; não passou → fica pra decisão do
  dono. `planned_for` e rótulos não são tocados. Custo: 1 reescrita + 1 nota (Haiku), sem imagem. **Não consulta o teto em US$** (`fitsCap`) porque não gera mídia paga (nem Higgsfield nem imagem de IA); se um dia a refação passar a regerar imagem/vídeo, tem que checar o teto antes. Carrossel (peça com `slides`) também fica de fora: os slides já desenhados não mudam com o texto.
- **Dicas — opção A (decisão do dono, 2026-10-26).** No **modo regulado** do carrossel educativo e na vaga
  `dica_faq` de **categoria regulada**, a dica só é "liberada" sozinha quando conferida em fonte oficial:
  status `conferida`|`corrigida`, `source_url` presente e dentro de `faq.official_domains` da ficha, e não vencida
  (`next_check_at` no futuro; vencida = reconfere antes, como já fazia). `geral`, `revisar` e `aprovada_dono` sem
  fonte oficial **deixam de valer** nesses casos → o carrossel sai no modo geral (sem número/prazo/taxa/lei).
  **Categoria leve** (ou ficha sem `regulated_categories`): a vaga `dica_faq` segue como antes (geral e aprovada
  pelo dono valem) — mínimo coerente, porque leve não carrega fato regulado. Código: `faqCheck.isOfficiallyReleased`
  / `isUsableTip`, `deckTopic.pickTips(rows, categoria, official_domains, …)`. Texto da tela `FaqTips.tsx` (PT/EN) atualizado.
- **Padrão de WhatsApp (migration `20261027120000_whatsapp_auto_reply_default_off.sql`):** resposta automática nasce
  DESLIGADA (regra 1). Só muda o padrão de linhas futuras; os valores atuais o dono ajusta à mão.

## 2026-10-27 — Áudio no Telegram: transcrição pela OpenAI, resposta pelo Claude

- **Decisão do dono:** o bot do Telegram passa a entender áudio. A API da Anthropic não recebe áudio (só texto,
  imagem e documento — conferido na doc da Messages API em 2026-10-27), então a **OpenAI (`whisper-1`) só
  transcreve**; quem entende e responde continua sendo o Claude (`telegram-chat`). O dono preferiu Anthropic e,
  sabendo que não dá, aprovou a OpenAI (chave já existente, usada na geração de imagem).
- **Limites:** só chat privado, só chat ligado a exatamente 1 empresa (sem gastar com quem não conectou), até
  2 minutos por áudio. Custo estimado ~US$ 0,006/min (preço conhecido; a página de preços da OpenAI não abriu do
  ambiente de trabalho — conferir no painel da OpenAI), gravado em `agent_performance` (`task_key`
  `audio_transcription`). O bot mostra "🎤 Entendi: …" antes de responder, pra o dono ver o que foi entendido.
- **Privacidade:** o áudio vai para a OpenAI para virar texto — atualizar `/privacidade` (pendente).
- Foto/vídeo/arquivo no chat privado agora recebem aviso ("por enquanto entendo texto e áudio") em vez de silêncio.

## 2026-10-27 — Inglês como idioma principal; mercado EUA inteiro

- **Decisão do dono:** o Sales Boost passa a vender para os **EUA inteiros**, com o **inglês como idioma
  principal**. Os brasileiros que já usam seguem em português (as 4 empresas atuais têm `companies.language = 'pt'`
  e continuam assim). Esta entrada **não apaga** as decisões antigas (Brasil/Rio, PT-BR, R$) — elas ficam como
  histórico e cada trecho antigo ganhou uma nota de divergência apontando pra cá.
- **Fase 1 (feita nesta entrada) — só a tela e o padrão:**
  - Idioma da **tela** é por usuário: escolha explícita (`localStorage['sb_lang']`) vence; sem escolha, segue
    `companies.language` da empresa logada (`'pt'` → pt, qualquer outro → en); sem empresa (landing, visitante,
    cadastro) → **inglês**. A regra não grava nada sozinha no navegador, pra a troca de idioma/empresa refletir.
  - Idioma do **conteúdo gerado** (legendas, ganchos, CTA) é por empresa: `companies.language`, agora com padrão
    `'en'` pra empresa nova (migration `20261027120000_ingles_padrao.sql`, aditiva: só linhas futuras; antes
    fixa `'pt'` em quem estiver `null`).
  - O seletor "Língua da empresa" saiu de Estilos e Visuais e foi pra **Configurações → Informações da empresa**
    (bilíngue, rótulo diz que vale pro conteúdo gerado, não pra tela).
  - Textos fixos que ainda estavam só em PT no painel do cliente foram traduzidos (CreativeAgent, tela de
    erro de carregamento, mensagens de bloqueio de vitrine, rótulos gravados nas ações do calendário, etc.).
  - `business_types.label` segue em PT como **chave** (liga à ficha e ao plano); só a **exibição** é traduzida
    (`businessTypeLabel` em `src/lib/businessTypes.ts`).
- **Fases pendentes (ver [ROADMAP.md](ROADMAP.md)):**
  - **Fase 2:** conteúdo gerado em inglês de verdade (prompts das functions, travas em inglês — número inventado,
    "Comente QUERO", recado da IA na legenda, carrossel educativo, etc.) e testes.
  - **Fase 3:** ficha `real_estate_us` (vocabulário, perguntas do cadastro, catálogo, regras do setor nos EUA).
  - **Fase 4:** dólar (US$), fuso/horário local, endereço com ZIP e termos do mercado (MLS, realtor, etc.).
- **Decisões pendentes do dono (nada disso foi decidido):**
  - Preço em **USD** (hoje R$ 2.449/mês e R$ 1.449/mês anual, nada convertido).
  - Continuar **só imóveis** ou abrir outros setores nos EUA.
  - **Horário de publicação local** (hoje 18h de Brasília).
  - **Revisão jurídica EUA / Fair Housing** (publicidade imobiliária, termos, privacidade) antes de vender.
  - O **Brasil continua** como mercado ou fica só como legado.
- **Não verificado:** os depoimentos/cartões da landing com `São Paulo, Brasil` (`src/i18n.ts`) são decorativos
  do cartão do herói; não dá pra saber se vêm de cliente real. Não foram alterados.

## 2026-10-28 — Inteligência comercial para imobiliárias (Opportunity Engine)

- **Decisão do dono (aprovou a Etapa 1 com "PODE"):** novo posicionamento — *"Inteligência comercial para
  imobiliárias. Identificamos oportunidades no seu mercado, conectamos essas oportunidades aos imóveis da sua
  imobiliária e ajudamos seus corretores a transformar isso em ações para gerar demanda."* O texto de
  posicionamento antigo (growth engine / parceiro de crescimento) **não foi apagado** — ganhou nota de
  divergência em [PRODUCT.md](PRODUCT.md).
- **Cliente = imobiliária com equipe de corretores.** O corretor autônomo continua podendo usar (é o caso de
  uma equipe de 1). Isso ainda não muda o modelo de conta: hoje é 1 login por empresa; equipe, convite e papéis
  são a Etapa 7 do [ROADMAP.md](ROADMAP.md) (mexe em RLS — alteração arriscada).
- **Mesmo sistema no Brasil e nos EUA, piloto no Rio.** O que é de país ou de setor mora na ficha
  (`vertical_playbooks`, regra 6): a Etapa 1 já lê da ficha quais campos do catálogo são região/preço/tipo/
  quartos/negócio (`config.opportunity_fields`) e os rótulos (`config.catalog_fields`).
- **Convivência com 2026-10-27:** o inglês **continua** o idioma padrão da tela e do conteúdo de empresa nova.
  A tela "Oportunidades" é bilíngue e o motor escreve no idioma de `companies.language`. As empresas atuais
  (todas `'pt'`) seguem em português. Nada da decisão anterior foi revertido.
- **Regra de evidência (vale pra tudo daqui em diante):** toda oportunidade carrega evidências rotuladas —
  **Fato** (contado dos dados da própria empresa), **Dado** (coletado de fora: concorrente, notícia, tendência)
  ou **Hipótese** (o que ninguém verificou) — cada uma com **fonte e data reais** (`null` se não houver data;
  nunca inventada). Pouca evidência = **"Precisa validar"**; o motor pode devolver menos de 3 oportunidades e
  a tela diz o que falta. Sem promessa ("+X% de vendas"), sem número fora dos fatos (trava em código), sem
  público por classe protegida (raça, cor, religião, sexo, deficiência, situação familiar, origem — Fair Housing).
  A IA só **redige** em cima dos fatos; fatos, confiança e prioridade são calculados em código.
- **Por que só 2 tabelas novas (`market_signals`, `growth_opportunities`) e por que não reaproveitar
  `opportunities`/`campaigns`:** `opportunities` já existe com **outro significado** (receita/lead detectada por
  `detect-opportunities`, `hermes-proxy`, `monthly-report`, popup de progresso) e `campaigns` é o objeto de
  campanha do Marketing AI; misturar quebraria essas telas e contaminaria os números. O catálogo, os posts, os
  concorrentes e as tendências **já existem** e são só lidos. Nenhuma function nova (limite de functions do
  Supabase, [PITFALLS.md](PITFALLS.md)): o motor é `action: 'run_opportunities'` no `marketing-ai`.
- **Etapa 1 entregue (este PR):** motor + tela `/dashboard/opportunities` + 2 tabelas + chave na ficha. **Não
  publica nada**, não grava em conta real; só lê e grava em `growth_opportunities`. Plano das Etapas 2–7 no
  [ROADMAP.md](ROADMAP.md).
- **Decisões pendentes do dono (nada disso foi decidido):**
  - **Preço para imobiliária com equipe** (em R$ e em US$) — hoje o preço é por conta/empresa.
  - **Custo de um provedor de notícias** (Etapa 3): qual, quanto, teto mensal.
  - **Revisão jurídica EUA / Fair Housing** antes de vender nos EUA (já pendente em 2026-10-27; agora também
    cobre o texto de "público" das oportunidades).

## 2026-10-29 — Inteligência comercial, Etapa 4: plano (A) e peças (B); tudo automático

- **Etapa 4 dividida em duas partes.** **A — plano da oportunidade** (este trabalho): oportunidade aprovada →
  mini-plano (público, objetivo, problema do comprador, proposta de valor, mensagem principal, canal, formato
  sugerido com motivo, CTA, como medir, imóveis ligados, evidências citadas, hipóteses). **B — gerar as peças**
  (outro PR, depois). O plano nunca publica nada; o dono ainda aprova o plano e, na Parte B, cada peça.
- **Opção escolhida: "mini-plano" dentro do `marketing-ai`**, em vez de o `strategy-generate` ler as oportunidades.
  Motivo: `strategy-generate` é function de cliente real (mexer exige aprovação e deploy arriscado) e, ali, o
  formato já vem decidido pela estratégia; no mini-plano o **formato é consequência** do objetivo e da mensagem.
  Isto **diverge** do texto antigo da Etapa 4 no [ROADMAP.md](ROADMAP.md) ("iniciativa de estratégia ligada ao
  `strategy_id`"), que foi mantido e anotado, não apagado. `growth_opportunities.strategy_id` segue sem uso.
- **Limite de 5 planos por empresa por dia** (decisão do dono; janela móvel de 24 h, contando execuções
  bem-sucedidas em `agent_performance`, `task_key='create_opportunity_plan'`). Falha não gasta o limite, mas o cron
  tenta no máximo 2 vezes por oportunidade a cada 24 h. O **teto mensal de custo de IA hoje não conta texto**: o
  limite diário é o único freio do plano.
- **"Tudo automático" (princípio de 2026-10-26) vale aqui; a ÚNICA ação humana é aprovar/descartar.** Mudanças
  pedidas pelo dono: (1) **sem botão "Criar/Refazer plano"** — aprovar a oportunidade (`decide_opportunity`) cria o
  plano sozinho em segundo plano; (2) **o botão "Encontrar oportunidades" da Etapa 1 foi removido** — a busca roda
  sozinha (`cron_opportunities`: semanal e quando entra sinal de mercado novo); (3) aprovar o **plano** continua
  manual (é aprovação, não geração). A action `run_opportunities` continua existindo no servidor (usada pelo
  cron), só não há mais botão.
- **Quem é tocado pelo cron:** mesmo critério do cron de estratégia — `companies.auto_strategy=true` (a Liga dos
  Sonhos fica de fora), interruptor geral `hermes_config.auto_strategy_enabled`, `hasPaidAccess` (vitrine e
  bloqueados fora) e empresa ativa.
- **Agendamento NÃO foi criado** (alteração arriscada): o SQL sugerido está em [ARCHITECTURE.md](ARCHITECTURE.md),
  bloco do motor, esperando o dono.
- **CTA do plano:** o plano não liga a um imóvel com resposta automática aprovada; por isso "Comente PALAVRA" é
  trocado pelo CTA alternativo da ficha (`ctas.sem_automacao`; em inglês, "Send us a DM").

## 2026-10-29 — Autonomia do agente

- **Regra do dono (2026-10-29):** ele só quer ser consultado em decisões que **mudam a direção do produto**. Deploy de
  function, migration e agendamento (cron) **não precisam mais de aprovação no chat**. A seção "Alterações
  arriscadas" do [CLAUDE.md](../CLAUDE.md) foi mantida (com uma nota apontando para cá): vira lista de **cuidado**.
- **Continuam valendo, sem exceção:** (1) nada vai ao público sem aprovação do dono; (2) nunca tocar dados de clientes
  reais (Liga dos Sonhos) em testes; (3) nunca publicar em Instagram real sem aprovação explícita (inclui o
  @getsaleboost); (4) **não gastar além do teto/combinado** — vídeo/Higgsfield e qualquer fornecedor ou API paga nova
  continuam precisando do OK do dono; (5) nada de setor no código (ficha `vertical_playbooks`); (6) não inventar
  números; (7) foto de item é sempre real e IA de imagem nunca escreve texto.
- **O que o agente faz sozinho, com o mesmo cuidado de antes:** migration (aditiva e idempotente, com como reverter
  escrito no próprio arquivo), deploy de function — **inclusive as usadas por cliente real** (`agent-actions`,
  `instagram-webhook`, `hermes-proxy`, `strategy-generate`, `creative-generate`, `claim-diagnostic`) — e cron.
  Cuidado = testar antes (build, lint, testes de lógica, bundle), **comparar o que foi pro ar** com o que estava
  (contagem de erros de tipo antes/depois; ver [PITFALLS.md](PITFALLS.md)), e deixar o **rollback documentado**
  (migration: bloco "como reverter"; function: o commit anterior para redeploy; cron: `cron.unschedule`).
- **Ainda é decisão do dono:** mudar a direção do produto (algo que contradiga este arquivo), remover funcionalidade,
  gastar mais, publicar/enviar em conta real.

## 2026-10-29 — Inteligência comercial, Etapa 4B: plano aprovado → peças em rascunho (automático)

- **Fluxo:** o dono aprova o **plano** (`approve_opportunity_plan`) e o sistema gera sozinho **1 a 3 rascunhos**
  (padrão 2; a IA do plano sugere `pieces_count`, o código limita a 3). Sem botão de gerar — a única ação humana é
  aprovar (princípio "Tudo automático", 2026-10-26). Cada peça nasce **rascunho na Central de Aprovações**; o cron
  `cron_opportunities` é a rede de segurança (plano aprovado sem peças → gera).
- **Mesmo motor do calendário:** a peça é pedida ao `creative-generate` (`plan_slot` com `opportunity_id`, só por chamada
  interna com `cron_secret`) e herda todas as travas (intenção, QUERO, recados internos, tema do carrossel,
  render-format, fotos reais, nada de texto em imagem de IA). Nenhum caminho novo de criação foi inventado.
- **Só formatos SEM custo extra de vídeo** (decisão de custo pendente do dono): carrossel, post, story de imagem/texto.
  Se o plano sugerir `reel`/vídeo, saem peças de **carrossel** e o plano registra "Vídeo fica para quando o dono liberar
  custo de vídeo". Liberar vídeo nas peças de oportunidade é decisão do dono (gasto Higgsfield).
- **Foto real ou texto (regra 4):** peça de foto exige item do plano com **5+ fotos reais** (exigência do
  `catalog-package`). Sem isso, sai **1 peça de texto** (carrossel educativo da marca) com o motivo no plano — nunca
  duas peças de texto repetidas, nunca imagem de imóvel inventada.
- **Limites:** no máx. **3 peças por plano** e **6 peças de oportunidade por empresa por dia** (janela de 24 h,
  `agent_performance` `task_key='opportunity_pieces'`, uma linha por peça despachada). As peças contam no caminho de
  custo que o calendário já usa (mesma IA/teto do `creative-generate`).
- **Idempotência:** `growth_opportunities.pieces_generated_at` é reservado de forma atômica antes de despachar; plano
  que já tem peça (rascunho ou post) não gera de novo. Despachado há > 30 min e **nenhuma peça jamais existiu** → 1 retentativa única (linha `opportunity_pieces_retry`). Peça que já existiu e foi excluída pelo dono (marca `opportunity_piece_created`) **nunca** é regerada sozinha.
- **Vínculo:** `opportunity_id` em `marketing_ai_test_content` e `posts` (copiado na aprovação, como `item_id`) — a
  Etapa 6 poderá medir por oportunidade.
- **O mapa formato-do-plano → formato-do-catálogo vive na ficha** (`config.opportunity_pieces`, regra 6); setor sem
  mapa usa o carrossel de slides genérico.
- **Qualidade (1ª rodada real, Tespon):** adjetivo de mercado ("disputado", "valorizado", "alto padrão", "nobre",
  "em alta", "ticket elevado") só vale se estiver nos fatos — prompt **e** filtro em código (lista na ficha,
  `opportunity_texts.market_claims`, com fallback genérico); a ação sugerida não manda "publicar com fotos" para item
  sem foto — a primeira ação passa a ser adicionar fotos reais.

## 2026-10-30 — Inteligência comercial, Etapa 3: notícias de mercado automáticas

- **O que é:** o sistema busca sozinho (Tavily, que o projeto já usa; sem botão — princípio "Tudo automático") notícias da
  região dos imóveis do catálogo e grava em `market_signals` com `collected_by='system'`, com fonte (domínio + link) e a
  data da própria fonte. Roda dentro do cron `cron_opportunities`, antes de decidir a rodada: sinal novo dispara a
  rodada e a oportunidade `market_change` aparece sozinha.
- **Divergência do ROADMAP (registrada, não apagada):** o ROADMAP previa que o dono aprovasse cada sinal antes de virar
  evidência. Decidido: o sinal automático entra como **"Dado" com fonte e data**, a tela mostra o selo "Automático" e o dono
  pode **apagar**; a aprovação humana continua na **oportunidade** (e no plano e nas peças), nada vai ao público sem ela.
- **Sem número inventado:** filtros em código — sem data válida, data futura ou > 30 dias, região fora do título/trecho,
  portal de anúncio (lista na ficha), link não-https: descartado. O resumo é um trecho da fonte, saneado.
- **Custo:** 1 busca Tavily básica por região; no máx. 3 buscas e 5 sinais novos por empresa a cada 7 dias e teto global
  mensal `MARKET_NEWS_MONTHLY_CAP` (padrão 120). Erro/429/sem chave: registra e para, sem nova tentativa em laço. O
  interruptor `insight_sources` (tavily) desligado no painel Owner também desliga esta coleta.

## 2026-10-30 — Inteligência comercial, Etapa 5: página pública do imóvel + link rastreável + lead com origem

- **Decisão do dono (direção):** a página do imóvel é **só destino de link** — o link vai no post, na DM ou na bio. **Sem listagem,
  sem busca, sem portal, `noindex`** (meta robots + `X-Robots-Tag` em `public/_headers`). Não vira concorrente de portal.
- **Só vai ao ar com a aprovação do dono:** botão "Página pública" no card do imóvel → prévia exata do que vai aparecer (campos,
  fotos, WhatsApp e Instagram) → **"Aprovar e publicar"** (grava `approved_at`/`approved_by`) ou "Despublicar". Exige o mínimo de
  fotos **reais** da ficha (`min_photos`, 3). Foto mobiliada por IA (`staged_photos`) nunca aparece nem conta.
- **O que aparece vem da ficha (regra 6):** `vertical_playbooks.config.public_page.fields` é uma lista **branca**; campo
  `private` nunca sai; campo vazio some; nada de número inventado (só o que o dono cadastrou).
- **Lead com origem:** quem preenche o formulário (nome, WhatsApp ou e-mail, mensagem opcional, **consentimento desmarcado por
  padrão** + link para `/privacidade`) vira lead com `source='link_page'`, `item_id`, `opportunity_id` (se o link veio de uma
  peça de oportunidade) e `link_id`, com `consent_at`/`consent_text`. **Nada é enviado ao visitante automaticamente** — o dono
  responde (o alerta de lead novo que já existia no banco continua valendo). Limites: 3 envios/visitante/hora, 20/link/dia,
  mesmo contato + imóvel em 24 h não duplica; campo-armadilha (honeypot) contra robô. IP **nunca** é guardado (só um hash com sal).
- **Link nas peças sem tocar o `creative-generate`:** o cron `cron_opportunities` acrescenta UMA vez a frase da ficha
  (`caption_line`) com o link (canal `caption`) aos **rascunhos** de oportunidade cujo imóvel tem página no ar; nunca em peça
  aprovada/agendada/publicada. A mensagem **nova** do "Comente QUERO" ganha o link (canal `dm`); a já aprovada fica como está.
- **Continua sem atribuição:** lead que chega por DM ou comentário (instagram-webhook) segue sem item/oportunidade — só o lead
  que entra pela página tem origem. Atribuir DM/comentário exigiria mexer no `instagram-webhook` (fica para depois).
- **Corretores ficam para a Etapa 7.** Não há encaminhamento ao corretor nesta etapa.
- **Ainda é decisão/ação do dono:** aplicar a migration, publicar o `marketing-ai`/`item-videos`/site e aprovar a primeira
  página (ver ROADMAP).

## 2026-10-30 — Inteligência comercial, Etapas 6 e 7 (versão mínima): resultados por oportunidade e corretor sem login

- **Corretor é só um CONTATO de encaminhamento, sem login.** Nome + WhatsApp (+ e-mail opcional) cadastrados pelo dono em
  Configurações. O lead que entra pela página pública (Etapa 5) é distribuído em **rodízio** entre os corretores ativos
  (`assign_next_broker`: o ativo com `last_assigned_at` mais antigo, nulos primeiro; só a service role executa) e o dono
  **encaminha por WhatsApp** pelo Funil — abre um `wa.me` com o resumo, **nada é enviado por nós** (regra 1).
- **Login por papel (dono/gestor/corretor) = projeto futuro**, junto com o **preço para imobiliária com equipe** (R$/US$) e o
  **domínio de e-mail verificado** (convite por e-mail). Mexe em autenticação e RLS; não faz parte desta versão.
- **O telefone do corretor pode aparecer no botão de WhatsApp da página pública:** o clique usa o corretor ativo que recebeu o
  lead mais recentemente (o clique **não** gira o rodízio; só lead gira); sem corretor, vale o telefone da empresa. O número só sai
  no redirecionamento do clique, nunca no `get` da página. O card de Configurações avisa o dono disso.
- **Resultados só com origem rastreável:** visitas, cliques e leads de uma oportunidade vêm do link `/p/<código>` dela. Oportunidade
  **sem link = "sem dado"** (diferente de 0); atribuição aparece só quando houve evento. Lead de comentário ou DM **continua sem
  atribuição** (exigiria mexer no `instagram-webhook`). **Valor** (proposta/venda) é opcional, digitado pelo dono: a tela soma só o
  que foi informado e mostra "N de M vendas com valor"; sem valor, "valor não informado". Nada é estimado.
- **Mapa dos estágios (o funil real não tem etapa "visita"):** Qualificado carimba `visit_at` (visita agendada), Proposta carimba
  `proposal_at`, Venda realizada carimba `closed_at` — só se estiver vazio, e pular etapa não preenche as anteriores.

## 2026-10-30 — O Sales Boost em 5 componentes (hub do Marketing AI)

Decisão do dono: o produto se apresenta em 5 componentes, na sequência dos cards (um embaixo do outro) do hub
`/dashboard/marketing-ai`:
1. **Inteligência de Mercado** (era "Agente de Dados") — catálogo com fotos reais, concorrentes/tendências, notícias do bairro.
2. **Motor de Oportunidades** (card novo, abre `/dashboard/opportunities`).
3. **Agente de Estratégia** — público, oferta, mensagem e ação; estratégia da conta + plano de cada oportunidade.
4. **Ativação** (era "Agente de Conteúdo e Campanha") — calendário, peças das oportunidades, página do imóvel.
5. **Resultados e Aprendizado** (era "Agente de Conversão") — funil com origem e corretor, atendimento, comentários/DMs.

Cada card mostra uma linha ao vivo só com contagens reais (o que espera o dono em laranja). Só tela: nenhuma
lógica, tabela ou função mudou; as seções por trás continuam as mesmas. **Motivo:** o dono enxergar o "motor"
trabalhando e vender "5 agentes trabalhando por você". **Não feito de propósito:** chat com cada agente (custo de IA
por mensagem e mais um lugar para cuidar). **Lacunas conhecidas:** material para o corretor executar (componente 4) e
atribuição de lead de DM/comentário (componente 5).

## 2026-11-01 — Resultados e Aprendizado só com resultado e aprendizado; Conversas vão para Ativação

Pedido do dono: o 5º card tinha coisas "nada a ver" (Atendimento, Engagement). Agora:
- **Resultados e Aprendizado** (`/dashboard/marketing-ai/conversao`, sub-aba em `?sub=`): Funil de vendas · Desempenho
  dos posts (saiu de Ativação → Campanha) · Aprendizado (memória do negócio, antes a página solta `brain`) · Experimentos ·
  Relatórios. Os links antigos `brain`/`experiments`/`reports`/`campanha&sub=resultados` redirecionam.
- **Ativação** ganhou a aba de topo **Conversas** (`?tab=conversas`): Atendimento (WhatsApp) e Respostas automáticas
  (comentários/DMs, ex.: "Comente QUERO") — responder é execução (escolha do dono, 2026-11-01).
Só tela: nenhuma regra de envio/aprovação mudou. **Lacuna registrada:** o 80/20 do `_shared/learning.ts` (o que
alimenta a estratégia) ainda não aparece na aba Aprendizado.

## 2026-11-01 — Inteligência de Mercado ampla, teto de US$ 5/cliente/mês

O dono pediu coleta "absurda" de notícias e Instagram e aprovou teto de **US$ 5 por cliente por mês** (Apify + Tavily),
contando dentro do teto de US$ 40. Supera — sem apagar — os limites da Etapa 3 de 30/10 (3 buscas e 5 sinais por
semana). Plano em etapas pequenas (contador de dólares com reserva antes de gastar → notícias diárias → tela de
mercado → Instagram semanal com até ~20 concorrentes → ligação com o motor de oportunidades, no máx. 1 rodada/24 h).

## 2026-11-01 — Catálogo sai da Inteligência de Mercado; Oportunidades sai do menu lateral

Pedido do dono: a Inteligência de Mercado fica focada em inteligência de mercado. O **Catálogo** (imóveis/itens com
fotos reais + Avatar em breve) virou página própria `/dashboard/catalogo`, aberta **só pelo botão "+" laranja** e pelos
atalhos do sino (`?item=<id>`; o link antigo `marketing-ai/dados?item=` redireciona). Na Inteligência de Mercado ficam
Ideias e trends, Lugares perto e Dicas/FAQ (a aba de notícias/Instagram entra com a Etapa de mercado). **Oportunidades**
saiu do menu da esquerda — já é o card 2 do fluxo do Marketing AI (a rota `/dashboard/opportunities` continua).

## 2026-11-01 — Inteligência de Mercado ampla, estágios 1-3

- **Decisão do dono:** teto de **US$ 5 por cliente por mês** para Apify + Tavily, contado **dentro** dos US$ 40 de `spendCap`.
  Fatias da ficha: Instagram 3 / notícias 2. Estágio 4+ (Instagram semanal via Apify) fica para depois.
- **Substitui** (sem apagar o registro acima) os tetos fixos semanais da Etapa 3 de 2026-10-30 (3 buscas/5 sinais por 7 dias e
  `MARKET_NEWS_MONTHLY_CAP`): agora o limite é o dólar (reserva antes, ajuste depois no livro-caixa `agent_performance`),
  mais tetos da ficha (por dia, por mês, sinais novos por dia). Coleta DIÁRIA, 1 rodada por empresa/dia, em um cron próprio
  (`cron_market_intel`); o `cron_opportunities` deixa de coletar e só roda nova rodada por sinal novo com 24 h de intervalo.
- **Preço da busca Tavily não é conhecido:** padrão conservador US$ 0,008 (`TAVILY_COST_USD`) — **a confirmar** no extrato.
- Sinais ganham `kind` do tópico da ficha (lançamento, obra, economia, turismo), sempre com fonte e data da fonte.

## 2026-11-01 — As abas de cada agente mostram o fluxo real (faixa de fluxo)

Pedido do dono: "o que aparece nas abas de dentro de cada agente tem que ser realmente o fluxo que existe, para eu saber como o
fluxo está indo e ter rastreamento pelo front-end." Cada agente ganha, no topo, uma faixa com os **passos reais** em ordem
(status, última vez, próxima, contagens, o que espera o dono) e que serve de navegação para as sub-abas existentes. Só dado real:
sem dado = "sem dado ainda"; o que não foi construído (coleta do Instagram) aparece como 🚧. Leitura do livro-caixa por função
somente-leitura (`company_flow_status`), sem afrouxar a RLS. Feito agora: Inteligência de Mercado e Motor de Oportunidades; os outros
3 vêm no mesmo formato. Detalhes em [ARCHITECTURE.md](ARCHITECTURE.md#faixa-de-fluxo-dos-agentes-2026-11-01).

## 2026-11-02 — Idioma pelo setor (a ficha diz o idioma padrão)

- **Problema achado no teste de conta nova do zero:** um corretor do Rio se cadastrou e a empresa nasceu com
  `companies.language = 'en'` (padrão da entrada de 2026-10-27), então legendas e ganchos sairiam em inglês.
- **Decisão do dono:** o idioma padrão vem da **ficha do setor** (`vertical_playbooks.config.default_language`).
  `imoveis_rio` → `'pt'`. Setor sem essa chave segue em inglês (não contradiz a entrada de 27/10: o inglês continua
  sendo o padrão geral; só os setores brasileiros nascem em português).
- **Como funciona:** o gatilho `sync_company_vertical_key` (que já liga tipo de negócio → setor) agora também copia o
  idioma da ficha quando a empresa entra num setor **pela primeira vez** (cadastro, ou saindo de `generico`). Trocar de
  setor depois não mexe no idioma que o dono escolheu em Configurações. Empresas antigas não mudam.
  Migration `20261102100000_idioma_pelo_setor.sql` (aplicada; testada com inserção + rollback: nasce `pt`).
- A tela já segue o idioma da empresa (sem escolha explícita no navegador), então a conta nova também vê o painel em
  português depois do onboarding. As telas de cadastro (antes de saber o setor) continuam em inglês — ver pendências
  do teste de conta nova em [ROADMAP.md](ROADMAP.md).

## 2026-11-01 — Gerador antigo semanal desligado (`generate-posts-weekly`)

- Cron `generate-posts-weekly` (segunda 11h UTC, function `generate-posts`) foi **desagendado** a pedido do dono: o
  conteúdo vem só do calendário da estratégia. A function continua publicada (não foi removida).
- **Para religar:** `select cron.schedule('generate-posts-weekly', '0 11 * * 1', $$SELECT net.http_post(url :=
  'https://miwcxakzyforbahpnpst.supabase.co/functions/v1/generate-posts', headers := '{"Content-Type":
  "application/json"}'::jsonb, body := json_build_object('cron_secret', (SELECT value FROM _app_config WHERE key =
  'cron_secret'))::jsonb)$$);`

## 2026-11-02 — Pitch novo e ideia de preço em dólar (em aberto)

- O dono mandou o pitch: dores (não sabe como aumentar a base, não tem tempo, não sabe o que acontece no mercado nem
  onde a empresa está) → conteúdo com intenção no ritmo do mercado → ativação nos melhores conteúdos → painel que
  ensina. Guardado em [pitch/PITCH.md](../pitch/PITCH.md) (texto original + versão de trabalho PT/EN).
- **Preço NÃO decidido.** Ideia: US$ 19 / 29 / 59, com 5 / 15 / 30 posts; o mais caro com avatar, Meta Ads e
  leitura comercial avançada. Nada muda no código de cobrança até a decisão. Pendências listadas no pitch.
- O pitch só promete o que existe: impulsionar anúncio e avatar aparecem como "em construção / em breve".

## 2026-11-02 — Qualidade dos carrosséis (PR B)

Decisões do dono para o PR B (detalhes em [PLANO-CRIATIVOS.md](PLANO-CRIATIVOS.md#pr-b--qualidade-dos-carrosséis-2026-11-02)):

1. **"luxo", "nobre", "premium", "exclusivo" e afins:** liberados **só** se o cadastro do imóvel citado traz a palavra; senão a trava barra.
2. **Quando a trava dispara:** reescreve 1x; se persistir, corta só a frase; registra em `reasoning` "Tirei afirmação sem fonte: …".
   Nunca troca por outro adjetivo inventado.
3. **Educativo:** foto real do catálogo só quando a vaga cita um imóvel (`item_id`); sem imóvel, capa com design da marca
   (gancho/pergunta/erro comum — nunca índice).
4. **Carrossel de oferta:** no máximo 7 slides (capa + até 4 fotos melhores + dados + fecho).
5. **Foto da capa da oferta:** a de maior nota (`meta.photos[].score/quality`, vindo do PR A) de forma tolerante; sem nota,
   `photos[0]`. Nunca sorteia.
6. **Planejador:** não repetir o mesmo tema/ângulo das últimas 3 semanas nem dentro da semana (caso real: "R$ 1,5 mi Barra vs
   Leblon" saiu 4 semanas seguidas e 2x na mesma semana).

Não contradiz a decisão de 21/10 (capa do educativo com foto só quando há imóvel; design da marca quando não há). A foto aqui é
a do **catálogo** (não "foto do corretor").


## 2026-11-02 — Tour virtual: PR A (qualidade do tour)

Decisões do dono que fecham as dúvidas do plano do PR A (detalhes e o que mudou em
[PLANO-CRIATIVOS.md](PLANO-CRIATIVOS.md#pr-a--qualidade-do-tour-feito-no-código-em-2026-11-02-branch-claudenifty-shannon-ysp818-tour-ainda-não-publicado)):

1. **Estúdio (VPS) fora do ar: esperar.** O tour do calendário só sai em 9:16 com encerramento. Sem o estúdio a peça fica
   "Aguardando estúdio" e é montada quando ele volta. **Nunca** sai vídeo 4:5 / sem encerramento por esse caminho. (Limite que
   o agente pôs: 48 h esperando; depois a peça falha avisando. Os trechos já gerados ficam cobrados.)
2. **Tour "2 cômodos" (`pair`) liberado** para sala↔varanda, sala↔cozinha "e outros combos possíveis": a lista de pares
   plausíveis vive na **ficha** (`config.tour.adjacent_rooms`), nada de setor no código. Na aprovação a peça avisa
   "passagem entre cômodos não confirmada por planta".
3. **Encerramento do vídeo:** logo + bairro + CTA sempre; **preço só se cadastrado, com o MESMO valor do cadastro** (nunca soma nem arredonda;
   formatar milhar e moeda não é inventar — número só de dígitos e maior que 0 vira "R$ 3.000.000", 0 não aparece, texto que já tem letras/"R$" fica como veio; moeda/idioma na ficha); ~2,5 s; fundo escuro da marca. Feito por **código** (`render-format`, template `tour_endcard`), nunca pela IA
   de vídeo (regra 4).
4. **Mostrar cômodo/nota da foto na tela do catálogo:** não foi pedido — fica fora do PR (só no banco, em `meta.photos[i]`).

Junto, o que o plano já previa: foto escolhida por nota (Haiku, ~US$ 0,003/foto, uma vez) em vez de sorteio, variar o
cômodo, `opening` só com fachada/vista real, no máximo 1 tour por imóvel por semana, legenda sem "filmado" nem "N segundos".
**Substitui** (sem apagar) o "tipo sempre `room`" do automático descrito na fase 7 do PLANO-CRIATIVOS.


## 2026-11-02 — Travas em código: tema repetido, número por extenso, frases de mercado (depois do relatório da Tespon)

Pedido do dono depois do calendário de 1/11 da Tespon (carrossel "Barra ou Leblon acima de R$ 1,5 mi" 2x na semana e pela 4ª semana
seguida; legenda de vídeo "Trezentos metros quadrados" com m² cadastrado = 7373; frases de mercado sem fonte). Decisões:

1. **Tema repetido é travado em CÓDIGO, não só no prompt.** Um tema igual ou parecido não volta antes de N semanas — N vem da ficha
   (`config.content_rules.theme_cooldown_weeks`, **4** na ficha `imoveis_rio`; setor sem ficha = 4 genérico) — e **nunca 2x na mesma
   semana** (a janela mínima é 1 semana, não dá pra desligar). Semelhança determinística e barata: sem acento/palavra vazia, valor
   ("R$ 1,5 mi" = "R$1.5 mi") e nome de bairro contam; limiar na ficha (`theme_similarity`, **0,8**, padrão do código também 0,8). Temas que citam **bairros diferentes** (lista `theme_places` da ficha) não são repetidos só pelo molde parecido ("Dicas… no Leblon" × "…na Barra"); mesmos bairros + mesmo valor (caso R$ 1,5 mi) continuam repetidos. Vale no educativo (texto do tema) e na
   oferta (**mesmo imóvel + mesma receita**; a receita é o ângulo).
2. **Antes de gerar a imagem/slide, no planejamento da semana inteira.** `planWeekFromStrategy` reserva os temas de todas as vagas de
   post antes de disparar (as vagas rodam em paralelo e não se enxergavam): 1 pedido curto ao Diretor Criativo (modelo barato `CHEAP_MODEL`, timeout ~20 s; falhou = segue sem reservar) → conferência em código →
   repetiu: pede outro 1x com a lista proibida → ainda repetiu: **tema alternativo da ficha** (`theme_alternatives`, sem número) → sem
   alternativa: a vaga escolhe e a conferência na geração continua valendo. Tudo vai pro `reasoning` ("Tema trocado: …").
   Custo: **1 chamada curta de IA por semana por empresa** (+1 só quando algum tema repete); a conferência em si é de graça. Oferta cheia
   (todos os imóveis já usaram a receita na janela) vira "pra fazer" em vez de repetir.
3. **Número na legenda de vídeo e de catálogo** (algarismo OU por extenso em português) precisa existir no cadastro do imóvel
   (`meta.fields` + título). Não bate → reescreve 1x com aviso → persistiu: corta só a frase → "Tirei afirmação sem fonte: …". "um/uma"
   sozinho é artigo e não conta; slides do educativo **não** passam pela trava de número (carrossel educativo tem números legítimos
   — ex.: "3 passos"); só a legenda de vídeo e a do catálogo. Palavras de número ficam no código (são da língua, não do setor). "e" só encadeia número de ordem menor ("dois e três quartos" = 2 e 3); "4K" não é 4000. **A trava de número vale também para setor sem ficha (`generico`)**: a regra 5 (nunca inventar número) é universal; só os termos de mercado dependem da ficha.
4. **Frases de mercado** ("demanda alta", "costuma ter liquidez", "mais disputados", "valorização garantida"…) entram na ficha
   (migration aditiva `20261102130000_travas_tema_numero.sql`) e passam a valer também na **legenda de vídeo** (antes só o catálogo e o
   carrossel tinham a trava). "Sem filtro, sem encenação" já era coberta pelo PR A (`captionGuard` + `DEFAULT_FORBIDDEN`, aplicado em `runVideoSlot`).

Limite honesto: a semelhança é por palavras; sem a lista de bairros na ficha, título curto que só troca o bairro pode contar como repetido. Duas vagas que escolhessem o mesmo tema no mesmo segundo, sem reserva do planejamento (peça avulsa),
ainda dependem da conferência na geração.

## 2026-11-03 — Telas: voltar e 🔁 em todo agente, selos atuais e imóveis ligados ao fluxo (PR só de tela)

Pedido do dono, sem migration e sem function:
1. **Voltar e 🔁 em todo agente.** Oportunidades ganhou a barra "← Voltar" (vai ao hub) e o círculo 🔁 "O que a IA está aprendendo";
   o Catálogo ganhou o 🔁. Pilares lidos: Oportunidades = `competitor` + `tracking` (os que existem de mercado; não há pilar
   "oportunidade" na tabela); Resultados = `tracking` (antes vazio); Catálogo = `content` + as lições do Agente de Conteúdo.
2. **Selos do hub (real e demo) = os 5 agentes atuais**, com os mesmos ícones dos cards (📊 💡 🧭 ✍️ 🔀). Textos demo sem
   "concorrentes". Resumo do teste: Ideias abre a sub-aba Ideias, Resultados esperados abre `/dashboard/opportunities`, Análise e
   Concorrentes abrem a Inteligência de Mercado.
3. **Imóveis no fluxo.** Hook `useItemUsage` (uma consulta por empresa, cache de 30 s). Calendário mostra o imóvel de cada peça; o
   modal mostra capa/título/bairro/links e "Por que este imóvel"; o Catálogo mostra "Última peça · Próxima · N peças em 30 dias" (ou
   "ainda não usado"); "Lugares perto" abre no imóvel pedido e mostra "usado em N peças"; "Imóveis ligados" das oportunidades vira link.
   Consulta que falha esconde a linha (regra 5: nunca um 0 fingido).

**Divergências do plano, registradas de propósito:**
- **Motivo da escolha do imóvel não é gravado por peça.** O `reasoning` da peça é sobre formato/tema, não sobre o imóvel, então a tela
  NÃO o apresenta como motivo. Mostra só o que o código garante: peça de oportunidade → "vem da oportunidade"; qualquer outra → "sem
  motivo registrado". (A 1ª versão dizia "rodízio" para toda peça com dia no calendário; o QA reprovou, porque peça do "Gerar agora"
  com imóvel escolhido pelo dono e do pacote do catálogo também têm dia, e nada na peça diz de onde veio.) Gravar o motivo de verdade é a Fase 4 do plano em
  [ROADMAP.md](ROADMAP.md) ("Pós-validação").
- **`?item=` não serve para "Lugares perto"**: na Inteligência de Mercado ele redireciona ao Catálogo (links antigos do sino). Foram
  criados `?sub=` (abre a sub-aba: mercado/ideias/lugares/faq) e `?imovel=<id>` (imóvel de "Lugares perto"). O `?tab=ideias` do plano não existia.
- **Nº de peças em 30 dias** = o MAIOR entre as contagens de `marketing_ai_test_content` (sem adaptações) e de `posts`: uma peça aprovada
  vira uma linha em `posts` com o mesmo `item_id`, e somar contaria 2x.
- **A vaga vazia "no imóvel" não mostra imóvel reservado**: não existe reserva antes da peça nascer (o `pickItem` roda na criação).

## 2026-11-03 — Fase 1 começa antes da validação terminar (decisão do dono), só tela, custo zero

O dono aprovou adiantar a **Fase 1** do plano pós-validação ([ROADMAP.md](ROADMAP.md#pós-validação--marketing-ai-da-informação-à-decisão-plano-de-2026-11-03)):
só frontend, sem migration, sem função, sem IA, custo zero. O hub ganha 4 indicadores de decisão no topo (janela de 7 dias; cada um mostra a
regra e leva à tela de origem; sem dado = "sem dado ainda", nunca 0 fingido):
1. **Sinais relevantes** = `market_signals` com `source_url` preenchido e data nos últimos 7 dias (`observed_at`; se nula, `created_at`).
   **"Relevante" hoje = passou no filtro da coleta** (fonte e data; a deduplicação só vale para os sinais automáticos, `collected_by='system'` — os manuais não passam por ela). Relevância de verdade (interpretação) = Fase 2.
2. **Oportunidades para avaliar** = `growth_opportunities` `status='suggested'`; sub-linha "N novas em 7 dias".
3. **Direcionamento ativo** = `marketing_ai_strategies` `kind='main'` `status='active'` (contagem + nome).
4. **Ações prontas** = `marketing_ai_test_content` com `status='vault'` (passou na nota = pronta pra aprovar; "peças do calendário prontas para aprovar") e `source_id` nulo (adaptações
   não contam de novo), **menos as já agendadas** (`agent_actions` `ref_type='marketing_ai_test_content'`, `execution_status='QUEUED'`,
   `scheduled_at` não nulo — o mesmo recorte de peças que a tela Aprovações usa). **Ressalva:** o número NÃO é idêntico ao "Para aprovar" de lá — a Aprovações lista só até 40 peças e soma também ações pendentes e ideias de `marketing_ai_content`, então o dela pode ser maior; o selo do menu lateral é outro número. `draft` (em revisão, ainda
   não passou na nota) **não entra no total**; aparece só na sub-linha "+ M em revisão (ainda não passaram na nota)". Busca ids (limite
   500); consulta falhou ou estourou o limite = "sem dado ainda".
O **painel antigo (receita/ROAS/funil) desceu** para logo abaixo dos indicadores — nada foi removido. As contagens de coleta (sinais,
última rodada de oportunidades) saíram das linhas dos cards para o bloco recolhido "Status da coleta"; os cards ficam só com o que pede
ação do dono. Abas da Inteligência de Mercado renomeadas (só rótulos; `?sub=` igual): Mercado → "Insights e evidências", Ideias e trends →
"Direcionamento e ideias", Lugares → "Inteligência de localização", Dicas → "Base de conhecimento". Oportunidades vazias agora explicam a
última análise com a data real do livro-caixa (fuso America/Sao_Paulo); "seguimos o direcionamento ativo" só aparece com estratégia main ativa, e com a lista vazia a frase é uma só.

## 2026-11-03 — Pacotes A e B antes da Fase 2 (revisão do dono da proposta "organizar por decisão")

**Contexto.** O dono propôs organizar a experiência por decisão (entender o mercado → definir a direção → oportunidades → executar →
aprender), fazendo as telas que já existem se conectarem, sem criar telas, agentes ou dashboards novos. Cruzamos a proposta com o que já
estava feito (PRs #92 e #93) e com as 5 fases. Muita coisa já estava coberta; o que sobrou virou os **Pacotes A, B1 e B2**, descritos em
[ROADMAP.md](ROADMAP.md), "Pós-validação". Eles são uma camada de conexão sobre o que já existe, não fases novas.

**Ordem (aprovada pelo dono):** validação (Tespon + "Teste Zero", gate do dono) → A → B1 → B2 → Fase 2 → 3 → 4 → 5. Nenhum código dos
pacotes antes da validação. A Fase 2 só começa com A, B1 e B2 concluídos.

**As 4 decisões:**
1. **Os pacotes não criam fonte de verdade nova.** Não duplicar o `content_plan`, não criar tabela de direcionamento, não duplicar as
   relações lead↔peça↔oportunidade e não criar serviço de imóveis antes da Fase 4. Os pacotes só leem o que já existe.
2. **A regra 5 inclui os estados da tela**, em hub, calendário, catálogo, funil e oportunidades:

   | Situação | O que a tela mostra |
   |---|---|
   | Dado real | O dado |
   | Sem registro | A ausência ("sem registro") |
   | Carregando | Carregamento |
   | Erro | "Não foi possível verificar" |
   | Dado fictício | Só no modo demonstração, com etiqueta |

   Erro e vazio são coisas diferentes: com consulta falhando, a tela nunca diz "não existe" nem "tudo em dia".
3. **Toda relação que existe pode ser navegada.** Imóvel→peça, peça→oportunidade, lead→peça e lead→oportunidade viram links ou detalhes,
   usando os ids que já estão no banco, sem tela nova de rastreabilidade. Só se mostra a relação quando ela é inequívoca. Exemplo: um
   `link_id` só aponta "conteúdo de origem" se levar a uma peça só.
4. **Mostrar relação não é escolher imóvel.** O Pacote B mostra o que existe. Decidir qual imóvel usar é a Fase 4, que grava um motivo
   verificável (os atributos que de fato decidiram) e revalida o imóvel antes de publicar.

**Ajustes para as fases seguintes** (detalhe no ROADMAP):
- **Fase 2:** controlar volume e custo por rodada, sem reinterpretar sinal que não mudou.
- **Fase 3:** tema sugerido entra como contexto; tese, público e objetivo só mudam com aprovação.
- **Fase 4:** motivo verificável; imóvel indisponível não publica.
- **Fase 5:** comercial separado de engajamento, com `results-flow` como dependência; não conta como pronta só com o Instagram.

**Fora dos pacotes, de propósito:**
- Os botões "Relacionar imóvel" (Fase 4) e "Adicionar ao direcionamento" (Fase 3).
- Demonstração nas outras telas.
- Campanha (segue "em breve").
- WhatsApp e mais agentes.

## 2026-11-03 — Validação: 3 correções achadas no teste (estratégia de empresa nova, carrossel regulado, hashtag)

**O que o teste da validação achou** (Tespon + "Teste Zero", antes de liberar o primeiro cliente):
1. **A estratégia de empresa nova não ficava pronta.** A 2ª parte da geração fazia mix da semana, funil, metas, orçamento,
   estimativas e campanha numa chamada só, de 5000 tokens. Na "Teste Zero" ela foi cortada por tamanho em 02/11, e em 03/11 passou dos
   150 s da execução e morreu sem registro, deixando a estratégia presa em "gerando".
   **Correção:** a geração agora tem 3 passos, cada um com o seu relógio.
   - Passo 2 (`continue`): mix da semana + funil.
   - Passo 3 (`continue`, `step: 3`): metas, orçamento, estimativas e campanha. Só esse passo ativa a estratégia e pede o calendário do resto da semana.
   - Cada chamada à IA tem teto de 130 s: a demora vira "failed" com motivo, nunca mais fica presa.
2. **Carrossel de tema regulado sem dica liberada** (FGTS na Tespon: a dica estava "revisar", então o modo foi o *geral*):
   - **Acentos:** a reescrita da trava devolveu listas sem acento ("voce", "imovel", "So entao"). A reescrita agora pede acento, e a que perde os
     acentos é descartada (`lostAccents` em `_shared/deckSlides.ts`).
   - **Regra afirmada como fato:** um slide afirmou uma regra sem número ("morar em outro estado não impede o uso"), que o validador de código não
     pega. O verificador barato de afirmações, que só rodava no modo regulado, agora roda também no modo geral (`_shared/deckGuard.ts`).
3. **Hashtag cortada baixava a nota.** A trava de frase de mercado tirou "#imoveisdeluxo" e escreveu "Tirei afirmação sem fonte". A nota
   caiu 25 pontos e um carrossel bom foi para rascunho. Agora a hashtag cortada vira só o aviso "Tirei hashtag sem base no cadastro", que não
   pesa na nota. Frase de mercado continua baixando (`claimNotice` em `_shared/claimLock.ts`).

Testes em `scripts/test-deck-topic.mjs` e `scripts/test-claim-lock.mjs`, com os casos exatos.

## 2026-11-03 — Validação, 2ª rodada: o que passou e mais 5 correções

**Passou:**
- **Estratégia de empresa nova** (3 passos, PR #95): a da "Teste Zero" ficou ativa em cerca de 3 minutos e já planejou o resto da semana.
- **Carrossel regulado com dica conferida** (Tespon, ITBI): conteúdo fiel à dica e com fonte no fecho.
- **Carrossel de tema regulado sem dica liberada** (FGTS): saiu com acento, e o verificador trocou os slides com regra sem fonte.

**Corrigido nesta rodada:**
1. **Vídeo bloqueado em empresa liberada à mão.** `item-videos` exigia `plan` diferente de "free", mas a empresa com `manual_access` passa
   em todo o resto (`hasPaidAccess`). Resultado: o calendário planejava os 3 tours e eles caíam para foto ("fazem parte do plano").
   Agora `manual_access` conta como plano no `item-videos`, a mesma regra do resto.
2. **Capa no pior cômodo.** Com as notas das fotos empatadas, a capa era a 1ª foto do cadastro. Na "Teste Zero", isso deu um banheiro com toalhas
   na capa do "3 coisas perto" e da enquete. Agora a capa segue a ficha (`tour.avoid_rooms` e `tour.room_priority`, regra 6) antes da nota,
   em oferta, bairro, enquete e educativo com imóvel (`pickCoverPhoto(photos, rooms)` em `_shared/carouselOffer.ts`). Sem a ficha, nada muda.
3. **Aviso falso de número no modo regulado.** O "3%" da própria dica do ITBI gerava o aviso "número que não veio dos dados", porque as
   duas funções usavam chaves diferentes ("3" contra "3|%"). Agora o aviso usa a mesma chave dos dois lados, e o conteúdo regulado continua
   conferido pelo `validateRegulated`.
4. **Regra disfarçada de "erro comum"** no modo geral ("erro: achar que precisa morar na cidade" afirma que não precisa). O verificador e a regra de
   escrita do modo geral agora pegam esse caso, e o modo geral não promete mais "o que é mito e o que é regra".
5. **Frase de urgência sem fonte numa legenda de tour** ("chega com pouca divulgação e sai rápido", "leads no radar têm vantagem").
   Migration `20261103210000_frases_urgencia.sql` acrescenta 12 termos à ficha (`market_claims`). Já está aplicada.
   - De quebra: enquete "por um cobertura" → artigo pelo gênero da palavra ("uma cobertura").

**Ainda a observar (sem correção agora):**
- O fecho do carrossel de oferta repete a última foto do meio. É o desenho atual.
- Os dados de teste da cobertura da "Teste Zero" não têm foto de sala nem de varanda.

## 2026-11-03 — Validação, 3ª rodada: vídeo pronto que não chegava na peça + condomínio/IPTU cortados

**Passou:**
- Os 3 tours da "Teste Zero" saíram pela Higgsfield e pelo estúdio da VPS: 1080×1920, cerca de 7 s, movimento suave em foto real e
  encerramento com bairro, preço e "Me chama no direct".
- "3 coisas perto" e enquete da cobertura refeitos. A capa já não é o banheiro, e a enquete diz "uma cobertura".

**Corrigido:**
1. **Vídeo pronto que não chegava na peça.** Quando a VPS monta o tour, o `vps-worker` marca `video_tours.status = 'completed'` direto. O
   `tick` do `item-videos` só procurava tours em `generating`/`assembling`, então a peça do calendário ficava com a foto para sempre. Isso afetou só a
   "Teste Zero": o caminho da VPS com encerramento foi ligado em 02/11, e nenhum cliente real tinha tour nesse caminho. Agora o `tick`
   também procura tours prontos dos últimos 3 dias cuja peça está sem vídeo e coloca o vídeo nela (`attached` no retorno).
2. **Condomínio e IPTU cadastrados eram cortados da legenda** ("Tirei afirmação sem fonte: Condomínio R$ 3.500 · IPTU R$ 1.200"), e a
   nota caía para rascunho. A trava só reconhecia o preço como valor em dinheiro. Agora a ficha lista os outros campos em dinheiro
   (`opportunity_fields.money`, migration `20261103223000_campos_dinheiro.sql`, já aplicada), e o `itemFacts` aceita esses valores. Valor fora do
   cadastro continua barrado.

**Observação (não é defeito do fluxo real):** os 2 tours do apartamento saíram com a mesma foto porque o teste pediu as vagas direto, sem o
planejador da semana. O planejador (`planTours`) já reparte fotos diferentes entre os tours da semana.

## 2026-11-04 — Fase 2 (inteligência de mercado): qualidade, registro por rodada e sem reinterpretar

**Estado:** código pronto no branch `claude/nifty-shannon-ysp818-fase2`, sem PR, sem migration aplicada e sem deploy. **Aguarda aprovação do dono.** Fica dentro do teto de
US$ 5/cliente/mês já decidido e não cria gasto novo (a IA só deixa de ser chamada quando nada mudou).

**Medição que motivou (04/11/2026, Tespon + "Teste Zero", 47 sinais automáticos, todos da Tavily):**
- Cerca de **60% eram ruins**: (a) **anúncios avulsos de imobiliárias** ("... para venda com 4 quartos em Ipanema", "Flat para venda - Leblon - RJ", "... 112,00 m² privativos,
  3 quartos", "8 Imóveis encontrados Ipanema", "Imóveis em Barra da Tijuca | Lançamentos RJ", "Arc Ipanema ... | Apto" — sites de ~17 imobiliárias/portais de lançamento);
  (b) **páginas sem valor** (Moovit "Como chegar até…", Wikipedia, Skyscanner, Threads, Catho "Vaga de Emprego…", "Termos de Uso", "Descubra a magia do Rio");
  (c) **tipo errado** (um anúncio de apartamento marcado como infraestrutura).
- **Bons**: O Globo, Folha ("Metrô da Gávea tem obras retomadas", "Aluguel sobe acima da inflação"), Metrô CPTM, ABIH-RJ, Riotur, Panrotas, Mercado&Eventos, Monitor
  Mercantil, Veja Rio, Terra, mais veloz ("Carta ao mercado"), e um limítrofe (enjoy: "Bairros do Rio com Melhor Mobilidade").
- As regras da ficha `imoveis_rio` saem dessa medição (nada inventado) e as amostras viraram casos de teste (`scripts/test-market-news.mjs`).

**O que foi decidido/feito:**
1. **Filtro de qualidade na ficha** (regra 6; código genérico). Começa em **`audit`**: só conta e registra o que reprovaria. Passar a `enforce` é uma troca na ficha
   (`update ... jsonb_set(config,'{market_intel,news,quality,mode}','"enforce"')`), depois de ver a contagem em `market_intel_runs`. Os domínios novos de `exclude_domains`
   valem desde já. Sinais ruins já gravados são **ignorados** (não apagados) pelo sistema, com motivo; o que o dono restaurar o sistema não ignora de novo.
2. **Registro por rodada** em tabela nova `market_intel_runs` (volume e custo, não só gasto — pedido do dono em 2026-11-03).
3. **Não reinterpretar sem mudança**: mesma impressão digital da última análise = nenhuma chamada à IA.
4. **"O que mudou"** sem tela nova: bloco no feed de Mercado + linhas no "Status da coleta" do hub.

**Divergências do plano (registradas, não escondidas):**
- O plano pedia "2 últimas linhas" de `market_intel_runs`; a tela lê as **20 últimas** e pega a mais recente de cada fase (cada dia grava até 3 linhas).
- `audit` não escreve nada no sinal; por isso, no `audit`, a reclassificação reavalia os mesmos sinais mais novos (até 150) a cada dia — é só leitura. Ao trocar para
  `enforce`, também reprovam os que o `audit` já marcou `quality_ok:false` na coleta.
- **Domínios que não entraram em `exclude_domains`** por falta do endereço exato na medição (só o nome curto): twoimoveis, familybrokersimobiliaria, kaselle, lancamentosrj /
  lancamentos-rj, miguezimobiliaria, novosimoveisrio, podiumimoveis, porta8, robertoalmeidaimoveis, suacasadigital, casapeimoveis, 313imoveis, lartcorretores,
  evandroimoveisrj, vgimobiliaria, visitrio, ladorio. Entram só pelas regras de título/endereço; se o dono quiser, é só listar o domínio completo na ficha.
- A regra de endereço `/imoveis/` (sugerida) também pode pegar a seção de notícias de imóveis de um portal que NÃO está em `trusted_domains` (ex.: Terra). Por isso o
  início é em `audit`: confira `details.reasons`/`samples` antes de `enforce` e, se preciso, ponha o portal em `trusted_domains` ou tire o padrão.
- `kind_terms` só existe para infraestrutura, turismo e economia (os tipos em que a medição achou tipo errado); lançamento/notícia/outro ficam livres.

**Para publicar (a sessão principal faz):** migration `20261104110000_market_intel_runs.sql`, depois `20261104120000_market_intel_quality.sql`; deploy de `marketing-ai`
(inclui `cron_market_intel`, `cron_opportunities` e `run_opportunities`); site. Sem a tabela, a tela mostra "Não foi possível verificar" e a análise segue normal (interpreta
sempre, sem pular). **Como desfazer:** voltar `mode` para `off` na ficha (para o filtro e a reclassificação); sinais ignorados pelo sistema são restaurados na própria tela
("Ver e restaurar") ou por SQL (`meta.ignored=false`); rollback comentado em cada migration.

**Ajustes pós-QA da Fase 2 (2026-11-04, mesmo branch):** (1) a tela trata análise que falhou ("A última análise falhou (dd/mm)") e só usa rodada com impressão digital em "nada mudou desde"; (2) a ficha passou a mirar o **anúncio**, não o tema: grupos com termo de oferta, `"à venda"` só junto de outro termo de anúncio, e novo campo `news_title_terms` (verbo de variação/fonte de índice libera as regras de título; as de endereço continuam), mais 8 portais em `trusted_domains` (valor, g1, estadão, exame, infomoney, cnn brasil, extra, o dia); modo segue `audit`; (3) em `audit` a linha `reclassify` só é gravada quando o resultado muda; (4) o teto mensal exibido vem de `details.cap_usd` gravado pela própria rodada (sem teto fixo na tela; rodada antiga sem o campo mostra só o acumulado). Falso positivo ainda possível: anúncio que use verbo de notícia no título ("Sobe o preço…") passa pelas regras de título, mas o endereço `/imovel/` ainda o pega.



## 2026-11-04 — Fase 3: Direcionamento (trava de aprovação + contexto de mercado nos temas)

**Contexto.** Regra do dono: posicionamento, público e objetivos só mudam com a aprovação dele. O código violava isso em dois pontos que eram
**automáticos**: (1) o `refresh` (mensal ou pedido pelo check-up) reescrevia funil (público/objetivo da etapa) e orçamento sem perguntar; (2) o
`reanalyze` decidindo PIVOT/TERMINATE gerava e **ativava** uma estratégia nova, pausando a antiga.

**Mudança de comportamento automático existente (declarada):**
1. `refresh` automático agora só altera **plano de conteúdo** (mix semanal, pilares, linha central), **metas** e a parte do funil que não é público/objetivo da etapa
   (mensagem, formato, CTA, métrica). Tese, foco, os 2 objetivos e o **orçamento** ficam como estão. Etapa de funil nova (público novo) não entra.
2. PIVOT/TERMINATE automático cria uma **proposta** (`status='needs_review'`; a ativa segue rodando; sem campanha-rascunho nem calendário até aprovar). Tela da Estratégia:
   bloco "Proposta de mudança" (hoje × proposta de tese, objetivos e público) com **Aprovar** / **Descartar**. Aprovar: a atual vai para `paused`, a proposta vira `active`,
   cria o rascunho de campanha e pede o calendário do resto da semana. Descartar: `paused` + `data_provenance.proposal.discarded_at/by`; a ativa não é tocada.
   Se o check-up voltar com a **mesma tese** da última descartada, não propõe de novo (só registra no log) — conferido logo após o passo 1, poupando os passos 2 e 3.
   Já existindo proposta aberta, não gera outra.
3. **Continua imediato** o botão "Pedir nova estratégia" (o clique do dono É a aprovação); ao ativar, propostas automáticas abertas são arquivadas.
4. Contexto de mercado nos temas da semana — ver [CONTENT-INTELLIGENCE.md](CONTENT-INTELLIGENCE.md). Sem sinal = nada muda. Fora do escopo (de propósito): botão "Adicionar ao direcionamento".

**Divergências do plano (registradas):**
- `archived` não existe no CHECK de status → descartada/antiga = `paused` + `data_provenance.proposal` (sem migration; ver PITFALLS).
- Além de `audience`, o `objective` de cada etapa do funil também fica travado (são "objetivos"); e o orçamento deixou de ser reescrito pelo refresh. Se o dono quiser o
  orçamento/objetivo de etapa de volta no refresh, é uma linha em `refreshPatch`/`lockFunnel`.
- O modelo aponta a fonte por **código curto** (S1/T1…) em vez do uuid (menos erro de cópia); o código converte para os ids reais antes de gravar. `evidence` ganhou `source_name`
  (o modal mostra "título · fonte · data").
- Tendência não tem janela de 14 dias (só `status='active'`, 3 mais recentes); a janela vale para sinais.
- A notificação `STRATEGY_PIVOT` da proposta só sai no fim do passo 3 (status `needs_review`), com texto novo em `log-bot-event` ("Há uma proposta de mudança na sua estratégia esperando você…"); a troca pedida pelo próprio dono mantém o texto de sempre. O registro `proposed` do check-up é fechado como `dismissed` (motivo no texto) quando a proposta é suprimida (tese repetida ou já há proposta aberta).
- Aprovar: ativa a proposta com UPDATE condicional (`needs_review`) ANTES de pausar a antiga (nunca zero ativas; 409 se já decidida; falha ao pausar devolve a proposta). Só descarte feito pelo dono (`discarded_by='owner'`) suprime tese repetida. `lockFunnel` mantém etapas que a IA não devolveu.
- Deploy: `strategy-generate`, `creative-generate` e `log-bot-event` (esta é chamada só com `secret` no corpo, sem Authorization → manter `--no-verify-jwt`).

**Como desfazer.** Código: reverter o PR e redeployar `strategy-generate` e `creative-generate`. Proposta aberta sem a tela nova: `update marketing_ai_strategies set status='paused'
where status='needs_review' and data_provenance ? 'proposal'` (ou aprovar por `update_strategy`). Contexto de mercado: sem deploy de `creative-generate` nada muda; peças já
gravadas com `intent.market_context` continuam válidas (campo extra ignorado). Sem migration nesta fase.

**Para publicar (a sessão principal faz):** deploy de `strategy-generate` e `creative-generate` (ambos de cliente real — testar em Tespon/Teste Zero antes: rodar `reanalyze`
forçando pivot e conferir `needs_review`); site. Nada de SQL.


## 2026-11-04 — Fase 4 (Imóveis e ativação): imóvel indisponível não publica

**Teste controlado em produção (04/11, 18:2x UTC, Teste Zero, sem Instagram conectado: nada podia ser publicado).**
- **Como foi feito:**
  - O imóvel "Apartamento em Leblon" foi marcado como `vendido` (manual).
  - Foi criada 1 ação `QUEUED`/`APPROVED` para a peça dele (`source='test_fase4'`, mesmo formato da aprovação agendada).
  - Em seguida, `run_scheduled` foi disparado do mesmo jeito que o cron dispara.
- **Resultado: passou.**
  - A ação virou `FAILED` com "Imóvel indisponível (vendido). Não publiquei.".
  - A peça **não** foi apagada (continua `draft`).
  - Nenhum post foi criado (`posts` da empresa = 0).
- **Desfeito:** a chave `availability` saiu do imóvel. O `meta` ficou idêntico ao original (md5 conferido) e o imóvel voltou a "disponível (nunca conferido)". A ação de teste ficou como registro (`FAILED`, `source='test_fase4'`).
- **Não testado aqui:**
  - A página pública do imóvel, porque ele não tem link público criado. Ela está coberta por teste de código e pelo QA.
  - A conferência no portal, porque a Teste Zero não tem feed configurado. Está coberta por `scripts/test-item-service.mjs`.
- **Observações pequenas (sem correção agora, para não abrir frente nova):**
  1. A mensagem mostra o status cru ("vendido") em vez do rótulo da ficha ("Vendido").
  2. A resposta do `run_scheduled` contou a ação bloqueada como `executed:1, failed:0`, mas a ação em si ficou `FAILED`. Só a contagem do resumo do cron está imprecisa.
- **A saída da Fase 4 continua aberta:** falta uma publicação real, com o Instagram de teste conectado e aprovada pelo dono.

**Decisões do dono (2026-11-04):**
1. **Disponibilidade** = status manual no Catálogo + conferência no link do portal (VRSync) na hora de publicar, para imóvel com `meta.source.listing_id`. Imóvel que sumiu do link = "removido". Sem link do portal configurado: só o status manual.
2. **Não deu pra conferir na hora de publicar → NÃO publica.** A ação fica na fila, o cron de 5 em 5 min tenta de novo e, depois de 2 h, vira FAILED "Não foi possível verificar a disponibilidade". Imóvel só manual nunca cai nessa regra.
3. **Página pública `/p/<código>`** de imóvel indisponível mostra "este imóvel não está mais disponível" e esconde botões e formulário de contato (o servidor também recusa clique e lead).
4. **Relacionar imóvel por tema/região fica FORA** desta fase: só se grava o motivo real da rotação de hoje (o menos usado em 21 dias, com a trava de repetição).

**O que foi feito.** Serviço único `supabase/functions/_shared/itemService.ts` (partes puras testadas em `scripts/test-item-service.mjs`; cópia mínima para a tela em `src/lib/itemAvailability.ts`). Status/bloqueios/rótulos vêm da ficha (`vertical_playbooks.config.availability`, regra 6; ficha sem a chave = nada bloqueado). Status guardado em `marketing_ai_knowledge.meta.availability {status, source, checked_at, note}`; sem ele = "disponível, nunca conferido". Mínimo de fotos agora vem da ficha em todo o servidor (antes 5 fixo). Motivo da escolha em `item_pick` (jsonb) na peça e no post, gravado em UPDATE à parte; só dados reais (candidatos, uso em 21 dias, fotos, disponibilidade), sem texto de IA. Trava de publicação em `agent-actions` `execute()`: conferência ANTES de marcar EXECUTING e de qualquer publishTo*; bloqueado → FAILED "Imóvel indisponível (…). Não publiquei." (peça não é apagada; volta ao Vault se estava 'publishing'). Caminhos escolhidos pelo dono (`catalog-package`, `item-videos`, `make_now`) devolvem 400 em português; `item-videos` confere ANTES de pagar a Higgsfield. Calendário, oportunidades (plano, peças, motor) e "Gerar agora" não oferecem imóvel indisponível: a vaga vira "pra fazer"/peça sem imóvel, nunca troca imóvel em silêncio.

**Divergências registradas (nada apagado).** (a) A conferência no portal só roda no momento de publicar (e no máximo 1x por hora por imóvel, cache em `meta.availability.checked_at`); não há varredura periódica. (b) `item_id` agora também vai no payload da ação do Telegram e do modal do calendário (nova tentativa depois de a peça ser apagada não perde o imóvel). (c) `plusOptions`/`usePlusOptions` não mudaram: a lista de imóveis vem do `make_now_options`, que agora usa o serviço (fotos da ficha + disponível). (d) Peças de oportunidade com imóvel indisponível viram peça de texto (já era o comportamento para pouca foto).

**Como desfazer.** Código: reverter o PR e redeployar `agent-actions`, `creative-generate`, `catalog-package`, `item-videos`, `marketing-ai`. Banco (só some o motivo/lista de status; nada depende): `alter table marketing_ai_test_content drop column if exists item_pick; alter table posts drop column if exists item_pick; update vertical_playbooks set config = config - 'availability' where key='imoveis_rio';`. `meta.availability` nos itens pode ficar (ignorado sem a ficha).

**Para publicar (a sessão principal faz):** migrations `20261104160000_item_pick.sql` e `20261104170000_availability_ficha.sql` → deploy `agent-actions --no-verify-jwt`, `creative-generate --no-verify-jwt`, `catalog-package`, `item-videos`, `marketing-ai` (manter as flags atuais de cada uma) → site.

## 2026-11-04 — Fase 5: Resultados (marketing × comercial, lado a lado)

**Decisão do dono.** A Fase 5 foi construída **do zero em cima da `main` atual**; a branch antiga `results-flow` **não** foi juntada nem usada
(fica como está, para depois). A automação "ideia vencedora" **não** entra. O objetivo é só **relacionar ações de marketing a resultado comercial
verificável**, sem nota única.

**O que foi feito (só tela; sem migration, sem function nova, sem deploy de function):**
- `resultsModel.ts` (puro, testado em `scripts/test-results-model.mjs`): dois blocos — **Marketing** {posts publicados, alcance, salvamentos,
  compartilhamentos, curtidas, comentários} e **Comercial** {conversas, leads, visitas, propostas, vendas, valor informado}. Todo valor é
  `número | null`; `null` aparece como "sem medição"/"sem dado", **nunca 0**. Nunca soma entre blocos e não existe nota única.
- Onde aparece: **Catálogo → Ver atividade → "Resultado do imóvel"** (`ItemResults.tsx`); **card da oportunidade aprovada** (lado Marketing via
  `posts.opportunity_id` ao lado do Comercial de `opportunity_results`); **Resultados (PerformanceTab)** com "Marketing" × "Comercial · conversas"
  por post (`engagement_events.media_ref`). O hub (`DecisionKpis`) não tem KPI de alcance nem de lead — nada a separar, nada mudou.
- Linhas obrigatórias: "N leads sem origem registrada" (leads sem `item_id`, `opportunity_id` e `link_id`) e "N posts publicados ficaram de fora
  (imóvel não registrado)" (posts publicados sem `item_id`).
- Estados (regra 5): carregando · ausência ("Nenhuma peça publicada ligada a este imóvel") · dado real · "Não foi possível verificar" quando qualquer
  consulta falha (inclusive migration pendente).

**Regra de ligação (inegociável).** A ligação comercial é **por imóvel e por oportunidade, nunca por peça**: `tracked_links` é único por
imóvel+oportunidade+canal e `content_id` guarda só a primeira peça. Nenhuma tela diz "esta peça gerou este lead"; a tela escreve "ligação por
imóvel/oportunidade, não por peça". O único vínculo verificável por peça é **conversa**: `engagement_events.media_ref` = `posts.instagram_media_id`.

**Aprendizado ≠ resultado.** `_shared/learning.ts` (80/20) **não foi alterado**; continua sendo "aprendizado" (score interno conversas×3 + saves/shares)
e não aparece dentro dos blocos de resultado.

**Como desfazer:** reverter o commit (só front; nenhum dado foi criado).

## 2026-11-07 — Menu: abas Imóveis e Relatórios

- **Decisão do dono (opção 1):** o menu lateral ganha a aba do catálogo logo abaixo de "Agentes" (seção Marketing AI) e "Atividades" é
  substituída por **"Relatórios"**.
- **Catálogo:** leva à mesma página do botão "+" → Adicionar item (`/dashboard/catalogo`). O rótulo **não é fixo no código**: vem da ficha
  (`vertical_playbooks.config.vocabulary.catalog`, hoje "Meus imóveis" no setor imobiliário; ficha sem catálogo = "Catálogo"/"Catalog"). A ficha só tem
  esse nome em um idioma (sem versão en) — decidir se vale um campo bilíngue (migration, não feita).
- **Relatórios** (`/dashboard/relatorios`): em cima, os relatórios que o sistema já grava em `bot_notifications` (`WEEKLY_REPORT`,
  `MONTHLY_REPORT`, `ANNUAL_REPORT`, da `periodic-report`), cada um abrindo inteiro no mesmo popup de mensagem da Atividade; embaixo, o histórico de
  atividades (mesmo componente, mesma regra de exemplo marcado). O relatório diário continua só no histórico. O "relatório de saúde" (tabela `reports`)
  segue na própria `/dashboard/relatorio` (link no topo da nova página), não foi misturado.
- `/dashboard/atividades` redireciona para `/dashboard/relatorios`; o destino padrão de empresa com Marketing AI desligado também.
- Só tela: nenhuma migration, função ou dado novo. **Como desfazer:** reverter o commit.
