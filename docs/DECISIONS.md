# Sales Boost — Decisões

> Cada decisão com data e motivo. Quando o código real divergir de uma
> decisão aqui, registrar a divergência no doc técnico correspondente
> ([ARCHITECTURE.md](ARCHITECTURE.md),
> [CONTENT-INTELLIGENCE.md](CONTENT-INTELLIGENCE.md) etc.) em vez de
> apagar a decisão daqui.

## Decisões em vigor

> Uma linha por tema, com o que vale **hoje** e o link para a entrada de origem. Quando uma decisão nova substitui
> outra, a linha muda aqui e a entrada antiga ganha "substituído em DD/MM". Entradas antigas nunca são apagadas.

| Tema | O que vale hoje | Origem |
|---|---|---|
| Identidade (operacional) | **Sistema de inteligência e geração de demanda comercial para imobiliárias.** A medida de sucesso é a visita ao imóvel. | [13/11](#2026-11-13--decisões-do-dono-identidade-mercado-modelo-d1-autonomia-e-documentação) |
| Posicionamento comercial | "Technology Partner for Real Estate", só no site e no pitch. Não substitui a definição operacional. | [13/11](#2026-11-13--decisões-do-dono-identidade-mercado-modelo-d1-autonomia-e-documentação) |
| Slogan | "Sales Boost — gerando mais visitas para o seu imóvel". Nunca prometer visita garantida. | [10/11](#2026-11-10--slogan-gerando-mais-visitas-e-aviso-de-visita-no-telegram-dono) |
| Mercado | **Brasil agora** (principalmente o Rio de Janeiro, em português). EUA depois, só com a revisão jurídica. A ficha dos EUA fica sem comercialização. | [13/11](#2026-11-13--decisões-do-dono-identidade-mercado-modelo-d1-autonomia-e-documentação) · substitui [27/10](historico/DECISIONS-2026-09-a-10.md#2026-10-27--inglês-como-idioma-principal-mercado-eua-inteiro) |
| Idioma | O setor define o idioma: `imoveis_rio` = português. Idioma ≠ país ≠ regras. | [02/11](historico/DECISIONS-2026-11-01-a-09.md#2026-11-02--idioma-pelo-setor-a-ficha-diz-o-idioma-padrão) · [07/11](historico/DECISIONS-2026-11-01-a-09.md#2026-11-07--plataforma-internacional-idioma--país--regras-dono) |
| Modelo de negócio | **Em validação:** plataforma grátis + tour pago + lead qualificado. **Nenhum preço decidido.** | [10/11](#2026-11-10--novo-modelo-cenários-de-tour-lead-sem-preço-e-portões-da-fase-4-dono) · [13/11](#2026-11-13--decisões-do-dono-identidade-mercado-modelo-d1-autonomia-e-documentação) |
| Preço do tour | **Hipótese** de US$ 15 por tour, não é decisão. Um imóvel grande custa ~US$ 14 (estimado). | [13/11](#2026-11-13--decisões-do-dono-identidade-mercado-modelo-d1-autonomia-e-documentação) |
| Lead | Sem preço até haver definição e medição. Especificação v2 em [CONVERSION.md](CONVERSION.md). | [10/11](#2026-11-10--novo-modelo-cenários-de-tour-lead-sem-preço-e-portões-da-fase-4-dono) |
| Boosts | **Em aberto.** Não confundir com o preço do tour. A unidade comercial é validada nas conversas com imobiliárias. | [13/11](#2026-11-13--decisões-do-dono-identidade-mercado-modelo-d1-autonomia-e-documentação) |
| Anúncios pagos (impulsionar) | **Fora do modelo atual.** Nenhum agente promete, planeja ou constrói sem decisão nova. | [13/11](#2026-11-13--decisões-do-dono-identidade-mercado-modelo-d1-autonomia-e-documentação) |
| Prioridade | **Estratégica:** construir o sistema de inteligência e geração de demanda. **Do negócio, até 17/11:** validação comercial. **Do produto (D1 ✅):** as 4 frentes, uma por vez: tour do imóvel inteiro → motor próprio de vídeo → sair de VPS/Telegram → experiência do usuário. | [13/11](#2026-11-13--decisões-do-dono-identidade-mercado-modelo-d1-autonomia-e-documentação) · [plano 13/11](#2026-11-13--tour-do-imóvel-inteiro-motor-próprio-e-saída-de-vpstelegram-planejamento-nada-implementado) |
| Autonomia dos agentes | Semáforo 🟢🟡🔴 do [CLAUDE.md](../CLAUDE.md). Gasto externo do agente = US$ 0 sem aprovação. Código geral com testes verdes é 🟢, mesmo chegando à A3. | [13/11](#2026-11-13--decisões-do-dono-identidade-mercado-modelo-d1-autonomia-e-documentação) · substitui [29/10](historico/DECISIONS-2026-09-a-10.md#2026-10-29--autonomia-do-agente) |
| Merge e publicação | O agente junta o próprio PR com tudo verde dentro da frente aprovada. Site e funções vão ao ar sozinhos depois do merge. | [11/11](#2026-11-11-noite-2--eu-junto-os-prs-conferência-de-ligação-v2-enquete-sem-bairro-na-frase) · [11/11](#2026-11-11-noite-5--funções-publicadas-sozinhas-depois-do-merge) · [12/11](#2026-11-12--o-site-já-é-publicado-sozinho-correção) |
| Aprovação humana | Nada vai ao público (post, DM, resposta) sem aprovação humana. | [07/11](historico/DECISIONS-2026-11-01-a-09.md#2026-11-07--etapa-0-nenhuma-publicação-no-instagram-sem-aprovação-humana-dono) |
| Conformidade | CRECI obrigatório para publicar. O texto público passa pela trava de proteção. | [09/11](historico/DECISIONS-2026-11-01-a-09.md#2026-11-09--etapa-1--parte-a-creci-obrigatório-para-publicar-dono-autorizada-em-0711) · [09/11](historico/DECISIONS-2026-11-01-a-09.md#2026-11-09--etapa-1--parte-b-proteção-do-texto-que-vai-ao-público-dono-autorizada-em-0711) |
| Tour virtual | Pronto para cliente = **imóvel inteiro**, sem inventar passagem. Pode sair em várias partes. Vídeo do imóvel só no menu Tour virtual. | [13/11](#2026-11-13--tour-do-imóvel-inteiro-motor-próprio-e-saída-de-vpstelegram-planejamento-nada-implementado) · [11/11](#2026-11-11-noite--agente-de-conteúdo-só-com-foto-vídeo-do-imóvel-só-no-tour-virtual-avatar-em-breve) |
| Conteúdo | O agente de conteúdo trabalha só com foto. Sem o formato "Quanto você pagaria?". | [11/11](#2026-11-11-noite--agente-de-conteúdo-só-com-foto-vídeo-do-imóvel-só-no-tour-virtual-avatar-em-breve) · [11/11](#2026-11-11-noite-3--sai-o-formato-quanto-você-pagaria) |
| VPS e Telegram | Ficam intactos até o substituto estar construído e testado e o dono autorizar. A3 e os alertas da plataforma dependem deles. | [13/11](#2026-11-13--tour-do-imóvel-inteiro-motor-próprio-e-saída-de-vpstelegram-planejamento-nada-implementado) |
| Liga dos Sonhos | Nunca tocar, nem ler. | [13/11](#2026-11-13--decisões-do-dono-identidade-mercado-modelo-d1-autonomia-e-documentação) |
| Documentação | Todo pedido de direção atualiza os docs no mesmo trabalho (DECISIONS → PENDENCIAS → CLAUDE.md → doc da área → histórico). | [13/11](#2026-11-13--decisões-do-dono-identidade-mercado-modelo-d1-autonomia-e-documentação) |

## 2026-11-13 — Decisões do dono: identidade, mercado, modelo, D1, autonomia e documentação

Motivo (dono): "reorganizar a documentação do Sales Boost para que qualquer agente entenda, sem eu explicar de novo,
quatro coisas: a empresa, a direção atual, o que ele pode fazer sozinho e qual é a próxima tarefa."

**Identidade.**
- **Definição operacional** (a que os agentes usam): "sistema de inteligência e geração de demanda comercial para
  imobiliárias". A medida de sucesso é a visita ao imóvel.
- **Posicionamento comercial:** "Technology Partner for Real Estate", só no site e no pitch. Não substitui a definição
  operacional.
- **Slogan:** "Sales Boost — gerando mais visitas para o seu imóvel". Nunca prometer visita garantida.
- **Substituído em 13/11:** "growth engine de IA pra pequenos negócios" (CLAUDE.md antigo) deixa de ser a definição atual.

**Mercado.**
- **Agora:** Brasil, principalmente o Rio de Janeiro, em português.
- **EUA:** depois, só com a revisão jurídica resolvida. A ficha dos EUA continua sem comercialização.
- **Divergência:** a entrada de 27/10 ("EUA inteiro, inglês como idioma principal") fica **substituída em 13/11**. Vale
  "Brasil agora, EUA depois".

**Modelo de negócio (em validação).**
- **Plataforma:** grátis.
- **Tour:** pago. US$ 15 por tour é **hipótese, não decisão**, com o alerta de custo (um imóvel grande custa ~US$ 14,
  estimado).
- **Lead qualificado:** sem preço até haver definição e medição.
- **Boosts:** continuam **em aberto**. Não confundir com o preço do tour. A unidade comercial será validada nas conversas
  com imobiliárias.
- **Anúncios pagos (impulsionar publicação):** **fora do modelo atual.** Nenhum agente promete, documenta como plano ou
  constrói isso sem decisão nova.

**Prioridade.**
- **Estratégica, acima de tudo:** construir o sistema de inteligência e geração de demanda comercial. As 4 frentes são
  prioridades de produto e infraestrutura a serviço dessa direção. Não a substituem.
- **D1 APROVADO (13/11).** As frentes, uma por vez:
  1. Tour do imóvel inteiro;
  2. Motor próprio de vídeo;
  3. Sair da VPS e do Telegram (só depois do substituto, sem apagar);
  4. Experiência do usuário.
- **Até 17/11, a prioridade do negócio continua sendo a validação comercial.** A Frente 1 avança em paralelo, sem tomar a
  atenção da validação.

**Autonomia.** Substitui a nota de 29/10 do CLAUDE.md e a lista "Alterações arriscadas" (**substituídas em 13/11**).
O semáforo completo está no [CLAUDE.md](../CLAUDE.md).
- 🟢 **Faz sozinho:**
  - ler código;
  - ler o banco (só leitura, contas de teste);
  - escrever código e testes;
  - abrir PR;
  - juntar o próprio PR com todas as checagens verdes, dentro da frente aprovada;
  - migrations que só acrescentam;
  - atualizar documentação.
- 🟡 **Faz e informa:**
  - tela dentro do item;
  - ajuste da ficha que não muda regra comercial;
  - correção pequena achada no caminho.
  - Na dúvida, é 🔴.
- 🔴 **Para e pede antes:**
  - qualquer gasto externo (US$ 0 sem aprovação);
  - direção, preço ou regra comercial;
  - publicar ou enviar em conta real;
  - apagar ou desligar funcionalidade, infraestrutura, dado ou credencial;
  - migration que altera ou apaga dado, ou que muda RLS;
  - autenticação, secrets, domínio, DNS, painel da Meta, crons;
  - ação direta na A3;
  - começar frente nova.
- **Liga dos Sonhos:** nunca tocar, nem ler.
- **Respostas do dono no planejamento (13/11):**
  - **A3:** mudança de **código geral** com testes verdes, dentro da frente, é 🟢, mesmo indo ao ar para a A3 depois do
    merge. O 🔴 vale para **ação direta** na A3 (dados, mensagens, conta).
  - **IA de visão da etapa 1.2** (mapa de ligações, ~US$ 0,30–0,80 por imóvel, estimado): é 🔴 e entra na verba do **D4**.

**Continuidade.**
- **Ao validar um item:** o agente começa sozinho o próximo da **mesma** frente aprovada, desde que os testes tenham
  passado e o item não dependa do dono.
- **Para e reporta quando:** há bloqueio, o item é do dono, a frente acabou ou o pedido está fora do escopo.

**Relatório final (sempre).**
- Português simples, ~15 linhas.
- **Conteúdo:**
  - o que foi feito;
  - a prova (link, print, SQL, teste);
  - os custos;
  - o que falta;
  - o que depende do dono;
  - uma linha sobre a validação comercial.
- **Nunca** dizer "pronto" sem prova.

**Documentação sempre atualizada (regra permanente).**
- Todo pedido do dono que mude a direção atualiza os documentos no mesmo trabalho e no mesmo PR.
- **Ordem:** DECISIONS → PENDENCIAS → CLAUDE.md → doc da área → histórico.
- Pedido que contradiz uma decisão em vigor é 🔴: mostrar a decisão antiga e perguntar.
- Detalhe completo no [CLAUDE.md](../CLAUDE.md).

## 2026-11-13 — Tour do imóvel INTEIRO, motor próprio e saída de VPS/Telegram (planejamento; nada implementado)

> **Atualização (13/11):** o roadmap desta entrada foi **aprovado (D1)**. Ver a entrada "Decisões do dono" acima.

**Decisões do dono:**
- **Tour pronto = imóvel inteiro.** Um tour só está pronto para clientes se representa o imóvel inteiro de forma confiável.
  - Pode sair em várias partes, organizadas por área, desde que nenhum ambiente fique de fora sem aviso.
  - Nada de inventar porta, corredor ou escada. Se faltar foto, o sistema diz qual foto tirar e de qual ângulo.
- **4 frentes, uma por vez:**
  1. tour completo;
  2. motor próprio de vídeo;
  3. infraestrutura (VPS/Telegram);
  4. experiência do usuário.
- **VPS e Telegram ficam intactos** até o substituto estar construído e testado e o dono autorizar a desativação.
- **Independência ≠ não usar ferramenta externa.** ffmpeg, as APIs de vídeo e a nuvem continuam valendo. O que precisa
  ser nosso é a arquitetura, o fluxo, os dados, as regras e a experiência.
- **Gestão:** uma etapa só é concluída com a validação definida. A lista central fica em [PENDENCIAS.md](PENDENCIAS.md)
  e é consultada antes de cada etapa.

**Auditoria (agente, só leitura, sem gasto):**
- **Cobertura:** o tour de 13/11 cobriu 8 dos 22 ambientes da Tespon.
- **Causa:** o sistema agrupa por *tipo* de cômodo e não por ambiente físico, e não tem mapa de ligações.
- **Fotos:** as 50 fotos não bastam para o imóvel inteiro sem inventar passagens. Faltam cerca de 15 a 17 fotos de ligação.
- **VPS:** faz um só tipo de trabalho (o acabamento com ffmpeg). O código é nosso (`public/vps/worker.mjs`).
- **Telegram:** a A3 (cliente real) usa, e os alertas da plataforma para o dono também.
- **Detalhe e roadmap proposto:** [PLANO-TOUR-COMPLETO.md](PLANO-TOUR-COMPLETO.md). **Aguardando aprovação do dono (D1).**

**Correção do que registrei antes:** no ROADMAP e no MEDIA-ENGINE de 13/11 eu tinha escrito que o gate técnico "passou".
Isso vale só para o trecho social. Pelo critério novo, o tour não está pronto.

## 2026-11-12 — O site já é publicado sozinho (correção)

O agente dizia que o site só ia ao ar com `npm run build` + `npx wrangler deploy` rodados pelo dono. **Não é mais
assim:** a integração Git da Cloudflare (Workers Builds, `sales-boost-restaurants`) faz o build de produção e publica a
cada merge no main. Conferido em 12/11: a mudança de tela do #156 já estava no getsaleboost.com sem ninguém rodar
nada. Junto com as funções (`deploy-functions.yml`), o dono não precisa mais rodar comando de publicação. O agente
continua conferindo o bundle no ar antes de escrever "Site publicado em getsaleboost.com ✅". A entrada abaixo, que
dizia "o site fica de fora", fica como histórico.

## 2026-11-11 (noite, 5) — Funções publicadas sozinhas depois do merge

Dono: "tá chato eu ter que rodar isso toda vez". O workflow `.github/workflows/deploy-functions.yml` publica no Supabase,
depois de cada merge no main, só as funções afetadas:
- o próprio `index.ts` mudou, ou algum `_shared` que ela importa (`scripts/affected-functions.py`);
- cada função mantém o `verify_jwt` que já tem em produção (lido da API antes);
- função nova nasce com o `verify_jwt` ligado.

Precisa do secret `SUPABASE_ACCESS_TOKEN` no GitHub, colocado uma vez pelo dono. Também roda à mão (Actions → Deploy
functions). Os comandos `npx supabase functions deploy …` continuam valendo como plano B. O site (`wrangler deploy`)
fica de fora por enquanto.

## 2026-11-11 (noite, 4) — Ordem de trabalho e direção do produto

**Ordem:**
1. finalizar o Tour;
2. validar tecnicamente;
3. painel novo;
4. abas e fluxos;
5. Telegram e aprovações;
6. remover o Painel-resumo.

Detalhe e critério de pronto no [ROADMAP.md](ROADMAP.md).

**Regras:**
- O painel não depende de cliente: só da definição de lead qualificado e da decisão de privacidade.
- Boosts e monetização dependem da validação comercial com imobiliárias.
- Nenhuma frente nova antes de concluir a atual, salvo dependência real.

**Direção:** o Sales Boost evolui de ferramenta de marketing para sistema de inteligência e geração de demanda comercial. O painel gira em torno do resultado comercial (visualizações → interessados → leads qualificados → visitas), não de quantos posts foram gerados.

## 2026-11-11 (noite, 3) — Sai o formato "Quanto você pagaria?"

Dono: "não existe postarmos uma foto perguntando quanto você pagaria nesse imóvel. Isso é um formato que não deveríamos
estar tendo mais." O formato `stories_enquete_pagaria` vai para `content_rules.disabled_formats` da ficha imoveis_rio
(migration `20261111220000_sem_enquete_pagaria.sql`). Também sai:
- do pacote do imóvel;
- da receita de "mercado";
- da peça "story" de oportunidade, que passa a usar o formato de texto.

As estratégias ativas da A3, da Teste Zero e da Tespon tiram a linha da enquete do mix da semana. A enquete da A3
gerada em 11/11 foi arquivada. Divergência com a entrada abaixo, que só tirava o bairro da frase.

## 2026-11-11 (noite, 2) — Eu junto os PRs; conferência de ligação v2; enquete sem bairro na frase

**Merge pelo agente** (dono: "a partir de agora você trabalha num PR e quando estiver pronto e garanta que esteja
mergeable vc já aprova por mim"):
- o agente junta o próprio PR depois de todos os `scripts/test-*.mjs`, build, tsc, lint e `deno check` verdes e do PR
  estar juntável;
- se o GitHub Actions travar na fila (aconteceu no #147), junta com as mesmas checagens rodadas localmente e diz isso no
  PR;
- continua precisando do dono: gasto novo, direção do produto e publicação em conta real. Publicar as funções e o site
  continua com o dono (comandos prontos).

**Conferência de ligação v2:** a v1 errou o caso que mais importa no 1º uso real (ver MEDIA-ENGINE). Troca para
Sonnet 5.5 (~US$ 0,01 por par, uma vez por par) com uma pergunta que descreve as fotos antes de decidir. Divergência
com a entrada abaixo, que dizia Haiku 4.5 a ~US$ 0,005.

**Conferência de ligação v3 (mesma noite):** a v2 saiu rígida demais nas fotos da Tespon (ver MEDIA-ENGINE). Na v3 a
IA relata só fatos das fotos e uma regra fixa, testada, decide — mesmo andar dentro de casa passa; troca de andar e
fora → dentro precisam da escada/porta visível.

**Enquete "pagaria":** a frase sai sem o bairro ("Quanto você pagaria por um apartamento assim?"). Com o bairro saía
"assim em Barra da Tijuca" (o "em/na" errado que o dono pediu para tirar) e cortava no card; o bairro continua no selo
"Enquete · Barra da Tijuca".

## 2026-11-11 (noite) — Título "Tipo Bairro" e fotos de ligação no tour

**Título do imóvel** (dono: "vai ser sempre apartamento e lugar depois… sem o em ou sem o na"):
- vale para o cadastro (`titleFromFields`), a capa e o fecho do carrossel (`offerHeadline`) e as legendas (regra nos prompts de `catalog-package` e `creative-generate`);
- no resto do texto, português normal ("morar na Barra");
- títulos já salvos corrigidos em A3, Teste Zero e Tespon (12 imóveis; backup no scratchpad da sessão). Liga dos Sonhos não tocada.

**Fotos de ligação do tour.** Antes de gerar, uma IA de visão confere cada par de fotos vizinhas
(`_shared/passageCheck.ts`, ~US$ 0,005 por par, guardado no imóvel). Ela diz se a ligação aparece: porta, vão ou
escada. Se não aparecer:
- a tela mostra "⚠️ falta foto da escada / da porta de entrada";
- o "Gerar" só libera com o "gerar mesmo assim" do dono;
- o servidor recusa a passagem sem ligação se não houver confirmação (`code: 'unlinked'`).

## 2026-11-11 (noite) — Agente de conteúdo só com FOTO; vídeo do imóvel só no Tour virtual; avatar "em breve"

**Pedido do dono:** "o agente de tour virtual está sincronizado com o de conteúdo, não deve ter vídeo no agente de
conteúdo, somente foto… o avatar entra na tab do tour virtual como em breve".

**Agora:**
- **"Gerar agora"** (`creative-generate` `make_now_options`/`make_now`) não oferece nem aceita vídeo do imóvel.
- **O card do imóvel** (Catálogo) não tem mais a caixa de vídeos curtos. Ela deu lugar a um link para o menu Tour virtual.
- **O plano da semana** já não tinha vídeo desde o #140.
- **O Tour virtual** ganhou o botão desligado "🧑 Avatar apresentando · EM BREVE". Nada é gerado nem cobrado.
- **Divergência registrada:** em 10/11 eu tinha mantido de propósito os vídeos curtos do card (entrada do #140). Essa regra foi substituída por esta.
- **Peças de vídeo já criadas** continuam em Aprovações e no calendário; nada foi apagado.

## 2026-11-11 (tarde) — Tour do IMÓVEL INTEIRO, zero cortes, câmera entrando de fora + gates antes dos Boosts

**Pedido do dono (depois do teste da Tespon):** "o tour precisa ser feito do imóvel inteiro e não pode ter cortes…
como se fosse um vídeo de um drone passando dentro da casa… se tivermos uma foto do exterior, o drone vem de fora e
entra no cômodo."

**Agora:**
- **Zero cortes:** com 2 fotos ou mais, todo trecho é caminhada da foto i até a i+1 (`tourSegments`).
  - Saem o corte automático `enter` (#144, entrada abaixo) e o ✂️ do dono (#142).
  - As duas regras ficam registradas como histórico.
- **Foto de fora → 1º cômodo:** a câmera entra pela abertura visível, com a instrução `pair_in`. A passagem é `walk_in`, amarela, e o dono confere no vídeo antes de aprovar.
- **Imóvel inteiro:** a ordem sugerida põe 1 foto de cada cômodo antes de qualquer 2ª foto, com até 15 fotos (era 10). A tela avisa o cômodo que ficou de fora.
- **Instrução de câmera:** "drone" orienta só o movimento. A IA não pode inventar geometria, arquitetura, cômodos, móveis nem paisagem que as fotos não sustentem (regra 4).
- **Orçamento:**
  - o tour completo não refaz trecho sozinho;
  - se falhar, `cost_usd` = soma dos trechos prontos;
  - teste real com verba nova aprovada pelo dono: até +US$ 5, além dos US$ 4,62 já gastos.
- **Revisão do dono incorporada** ([ROADMAP.md](historico/ROADMAP-ate-2026-11-12.md#foco-e-gates-do-tour-virtual-e-dos-boosts-dono-2026-11-11)):
  - gate técnico + gate comercial antes de qualquer Boost ou cobrança;
  - markup ≠ margem;
  - no máximo 1 frente de produto com código por vez.

## 2026-11-11 — Tour virtual, Etapa 3: abertura aérea de fora, só a partir de foto real

**Pedido do dono (10/11):** a câmera vem de fora, em imagem de drone cinematográfica. **Regra:** aérea só a
partir de foto real (regra 4).

**Achado ao começar:** com a caminhada contínua (entrada abaixo), a foto de fachada ou vista caminhava até a
foto seguinte (vista → hall). A IA teria que inventar o caminho de fora até a porta.

**Agora:**
- **Foto de fora** (`opening_rooms` da ficha: fachada, vista) é sempre um trecho próprio de 5 s (`opening`). A
  passagem seguinte é um corte automático (`enter`), que o dono não desliga com ✂️ (`tourSegments`, servidor e
  tela).
- **Instrução de câmera da abertura** (`clip_prompts.opening` na ficha + padrão no código): drone estabilizado,
  subida lenta com aproximação lenta, sem nunca mostrar nada além da borda da foto. Migration
  `20261111160000_tour_abertura_aerea.sql` (rollback comentado).
- **Por dentro,** continua a caminhada contínua.
- **Sem foto de fora,** a tela continua dizendo que o tour começa dentro. A IA nunca cria o prédio nem a vista.
- **O dono escolhe a foto de abertura** (achado no teste da Tespon, 11/11): a IA chamou de "varanda" a foto real da
  piscina da cobertura com a Pedra da Gávea. Agora:
  - se a 1ª foto for de um ambiente da lista `tour.opening_candidates` da ficha (hoje só `varanda`), a tela
    oferece "🏙️ Abrir de fora com a 1ª foto";
  - o servidor confere de novo (`withOutsideFirst`) e nunca aceita um quarto ou outro ambiente fora da lista;
  - migration `20261111170000_tour_opening_candidates.sql`.

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
## 2026-11-11 — N1: segurança das conexões (Instagram, WhatsApp, Anúncios da Meta e Google) — dono: "sim"

**O buraco:**
- **Meta (Instagram, WhatsApp/Business, Anúncios):** o "Conectar" era um link sem login
  (`*-oauth-start?company_id=`), e o `state` era só `btoa({company_id, ts})`, sem assinatura, dono nem validade.
  Quem soubesse o id de uma empresa ligava o **próprio** Instagram, WhatsApp ou conta de anúncios nela.
- **Google (Meu Negócio, Search Console):** exigia login, mas não conferia se a empresa era de quem estava logado.
- Não há sinal de uso indevido: o id é longo e aleatório.

**O que mudou** (`_shared/oauthState.ts` + `src/lib/oauthStart.ts`):
1. **Início da conexão Meta:** a tela faz `POST { company_id }` com o login. O servidor confere que a empresa é do
   usuário e devolve o link da Meta com um `state` assinado pelo servidor (HMAC-SHA256). O `state` fica preso à
   empresa, ao usuário e ao provedor, tem um número único e **vale 15 minutos**. O link antigo (GET) responde
   "atualize a página".
2. **Volta da Meta:** confere assinatura, provedor, prazo e se a empresa ainda é do mesmo usuário. Qualquer falha
   = não conecta e explica na tela.
3. **Google:** só grava na empresa de quem está logado (403 se não for).
4. **Instagram:** início e volta usam o mesmo endereço de retorno (`INSTAGRAM_REDIRECT_URI`, com o endereço padrão
   da função como reserva).

**Não muda:** o painel da Meta, os segredos, o `verify_jwt` das funções e as contas já conectadas.

**Teste:** `scripts/test-oauth-state.mjs` (13 verificações, com os ataques: trocar a empresa no `state`, `state`
antigo sem assinatura, outro segredo, outro provedor, vencido).

**Depois de publicar:**
- link para a própria empresa ✅;
- id de outra empresa → 403;
- link antigo → 400;
- `state` adulterado → erro na tela.

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

## Decisões anteriores (histórico)

- 01/11 a 09/11/2026: [historico/DECISIONS-2026-11-01-a-09.md](historico/DECISIONS-2026-11-01-a-09.md)
- setembro e outubro de 2026: [historico/DECISIONS-2026-09-a-10.md](historico/DECISIONS-2026-09-a-10.md)
