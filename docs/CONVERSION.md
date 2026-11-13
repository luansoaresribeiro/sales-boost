# Sales Boost — Conversão

> Etapa 9 do ciclo (ver [ARCHITECTURE.md](ARCHITECTURE.md)). Da conversa ao
> lead. Plano aprovado pelo dono em 2026-09-30/10-01 (4 ajustes) — ver
> status real abaixo, que deve ser mantido atualizado conforme o código
> avança (este é o doc que diverge mais rápido do código nesta fase).

## Fluxo alvo

1. Comentário com a palavra-chave da ficha (ex: "VISITA", "SIMULAÇÃO") OU
   DM → a IA escreve um RASCUNHO de resposta lendo:
   - a ficha (`dm_qualification` — **já existe** em
     `vertical_playbooks.config` pra `imoveis_rio`:
     `{goal: "agendar visita", questions: ["comprar ou alugar", "faixa de
     preço", "bairros", "prazo/financiamento"]}`);
   - o post/item de origem (de onde veio o comentário);
   - o histórico da conversa (`lead_messages`), pra não repetir pergunta
     já respondida.
2. O dono aprova ou edita o rascunho → aí sim envia pelo Instagram (nunca
   antes — regra de ouro do produto).
3. Vira lead ligado ao post/item/pilar de origem, com o estágio da
   conversa avançando até "visita agendada".
4. Tudo contado pra medição (conversas por item/pilar/formato — ver
   [LEARNING.md](LEARNING.md)).

## Janela de resposta (Meta)

A documentação oficial da Meta pra mensageria do Instagram define uma
janela de atendimento de **24 horas desde a última mensagem da pessoa**
pra responder DM fora de templates pré-aprovados; resposta privada a
comentário segue uma janela própria da API de comentários. **Checar a
documentação atual antes de confiar neste número** — políticas da Meta
mudam. Regra do produto, independente do número exato: avisar o dono NA
HORA (Telegram + Aprovações) quando um rascunho é criado, mostrar o tempo
restante da janela, e marcar como "expirada" se passar do prazo — **nunca
tentar enviar fora da janela** (a API da Meta rejeitaria mesmo assim, mas
o produto não deve nem tentar).

## Regras

- A IA **nunca inventa** dado do imóvel — preço/m²/condomínio só saem do
  cadastro real do item (`marketing_ai_knowledge`). Se perguntarem algo
  que não está cadastrado: a resposta é "vou confirmar e te retorno" +
  aviso pro corretor (vira uma notificação separada, não um rascunho de
  resposta inventada).
- Rascunho sempre como ação `PENDING` em `agent_actions` — dono
  aprova/edita, nunca envia sozinho.
- A automação com texto fixo (`engagement_automations.message`) continua
  funcionando pra quem preferir — a IA só entra quando `message` está
  vazio (automação configurada pra deixar a IA escrever).

## Rastreabilidade

`leads` ganha colunas de origem: `source_post_id`, `source_item_id`,
`source_pillar` — preenchidas pelo caminho comentário → `media_id` → post
→ item/pilar (join via `posts.id`/`marketing_ai_test_content` no momento
em que o lead é criado).

> **Divergência registrada:** no código atual `leads` NÃO tem
> `source_post_id`/`source_item_id`/`source_pillar` (nenhuma migration/uso).
> `agent-actions` cria o lead só com name/contact/channel/stage/notes. Até
> isso existir, a atribuição conversa→pilar vem de `engagement_events.media_ref`
> → `posts.instagram_media_id` → `posts.pillar` (ver [LEARNING.md](LEARNING.md)).

## "Comente QUERO" automático (2026-10-09)

Exceção aprovada pelo dono à regra "dono aprova cada envio": a mensagem do
QUERO é aprovada UMA VEZ por imóvel (tela "🎬 Vídeos e resposta do QUERO"
no card do imóvel) e depois é enviada sozinha, como resposta privada ao
comentário, a quem comentar QUERO em qualquer post daquele imóvel. Texto
fixo, só com dados cadastrados; também cria o lead. Detalhes em
[DECISIONS.md](DECISIONS.md). Limites da Meta: 1 mensagem por comentário,
até 7 dias depois do comentário, 750/hora por conta; sem custo por
mensagem.

## Ligação com o diagnóstico (2026-10-19)

O diagnóstico grátis avalia dois pilares de Social Selling que são a porta de
entrada deste fluxo:
- **Relacionamento:** posts que convidam o público a falar, e o dono
  respondendo comentários.
- **Conversão:** posts com chamada clara, como "comente", "chama no
  WhatsApp" ou "agende".

Quando um desses pilares sai "ausente", o diagnóstico explica o custo disso.
O "Comente QUERO" é a resposta do Sales Boost para esse problema.

## Status real (atualizar a cada mudança)

🟡 **Parcial, em construção** — `supabase/functions/instagram-webhook/index.ts`.

**Já funciona (antes desta rodada):** recebe comentário/DM, acha a
automação (`engagement_automations`), detecta intenção (palavra-chave ou
IA), cria `engagement_events` + proposta em `agent_actions`. Texto fixo
(`message`) continua funcionando.

**Construído nesta rodada (2026-10-01):** ver changelog real no histórico
de commits de `instagram-webhook` e nas migrações de `leads`/`engagement_events`
a partir desta data — o resumo deve ser mantido aqui conforme avança, em
vez de duplicar no CLAUDE.md.

## 2026-10-30 — Etapa 5: página pública do imóvel e lead com origem

- **O que existe:** o dono aprova uma página simples do imóvel (`/p/<código>`, só destino de link, `noindex`); cada link tem
  origem (`tracked_links`: imóvel + oportunidade + canal `caption`/`dm`/`bio`/`manual`) e cada visita/clique/lead vira um
  `link_events`. O formulário da página cria um lead com `source='link_page'` (ver [DECISIONS.md](DECISIONS.md)).
- **Divergência registrada (colunas de origem):** o plano de "Rastreabilidade" acima previa `leads.source_post_id`,
  `source_item_id` e `source_pillar`. O que foi construído é **`leads.item_id`, `leads.opportunity_id` e `leads.link_id`** (mais
  `consent_at`/`consent_text`). Motivo: a origem real que o sistema consegue provar hoje é o **link** (imóvel + oportunidade); o
  pilar/post se deriva de `opportunity_id` → peça → `posts.pillar`, sem coluna nova. `source_post_id`/`source_pillar` seguem
  **não existindo**.
- **O que continua sem atribuição:** leads de DM e de comentário ("Comente QUERO") criados pelo `instagram-webhook` /
  `agent-actions` seguem sem `item_id`/`opportunity_id` (só o lead da página tem origem). A DM/QUERO **nova** leva um link
  rastreável (canal `dm`), então quem clicar nele e preencher o formulário passa a ter origem.
- **Nunca automático:** nada é enviado ao visitante ao receber o lead; responder é com o dono (regra de ouro). Encaminhar ao
  corretor certo é a Etapa 7.

## 2026-10-30 — Etapa 7 mínima: corretor e encaminhamento

- **Corretor = contato, sem login** (tabela `brokers`; card "Corretores" em Configurações, com cadeado na vitrine). O lead da página
  pública recebe `assigned_broker_id` (rodízio no banco, só lead gira). No cartão do lead do Funil aparece "Corretor: X" e o botão
  **Encaminhar por WhatsApp**: abre `wa.me/<corretor>?text=<resumo>` (nome, contato, imóvel, mensagem) — o dono toca em enviar;
  **nada é enviado automaticamente**.
- **Clique no WhatsApp da página:** usa o corretor ativo que recebeu o lead mais recentemente (grava `link_events.broker_id`); sem
  corretor, o telefone da empresa. O `get` da página nunca devolve o telefone do corretor.
  `link_events.broker_id` é **indicativo, não exato**: é o corretor do lead mais recente, não necessariamente quem "atende" aquele visitante.
- **Funil e resultados:** mover o lead para Qualificado/Proposta/Venda carimba visita/proposta/fechado e oferece valor opcional
  (ver [LEARNING.md](LEARNING.md)). Lead de DM/comentário continua sem corretor (rodízio só na página pública).

## 2026-11-10 — Preparação da Fase 4 (novo modelo): lead qualificado e acompanhamento até a visita

> **Só preparação, sem código.** O dono decidiu (10/11) que nada da Fase 4 é implementado antes de três portões (ver o
> fim desta seção). O preço do lead **não** está definido: primeiro a definição objetiva e a medição, depois o preço.
> O modelo de negócio e o simulador estão em [AUDITORIA-CUSTOS.md](AUDITORIA-CUSTOS.md) e [DECISIONS.md](DECISIONS.md).

**Proposta de definição de lead qualificado.** O dono manteve os 7 critérios como **proposta** em 10/11. Os prazos entre colchetes (30 e 7 dias) são **hipóteses a validar com imobiliárias**, não decisões.

| # | Critério | Como o sistema confere | Hoje |
|---|---|---|---|
| 1 | Contato válido | Telefone com DDD ou e-mail em formato válido | Formato já é validado no formulário (`validateLead`) |
| 2 | Consentimento registrado | Data e texto do consentimento LGPD | Já existe (`consent_at`, `consent_text`) |
| 3 | Interesse num imóvel específico e disponível | Imóvel ligado ao lead e disponível naquele momento | Já existe para o lead da página (`item_id`); lead de DM/comentário não tem |
| 4 | Origem rastreável | Link, conteúdo e canal do contato que gerou o lead (na 1ª versão, sem marca guardada no celular) | Parcial: `link_id` → `tracked_links` (imóvel, oportunidade, canal, `content_id`) |
| 5 | Não duplicado | Mesmo contato + mesma imobiliária em [30] dias | Hoje: mesmo contato + mesmo imóvel em 24 h |
| 6 | Entregue à imobiliária | Data em que o lead chegou para ela | Não existe |
| 7 | Contestação | A imobiliária contesta em [7] dias com motivo fechado: contato inválido · duplicado · não é comprador/locatário · spam | Não existe |

**Estados separados** (dono, 10/11). Cada um tem data e quem marcou, e nenhum substitui o outro:

| Estado | O que significa | Quem marca |
|---|---|---|
| **Lead válido** | Contato válido + consentimento, sem ser spam (critérios 1 e 2) | Sistema |
| **Lead qualificado** | Cumpre os critérios 1 a 6. **É a única base possível para cobrança futura** | Sistema |
| **Em conversa** | A imobiliária falou com a pessoa | Imobiliária, ou a resposta pelo WhatsApp conectado |
| **Visita agendada** | Data e hora marcadas | Interessado (agendamento da Fase 4) ou imobiliária |
| **Visita realizada** | A visita aconteceu | Imobiliária |
| **Contestado** | A imobiliária recusou o lead, com motivo fechado | Imobiliária |

Depois vêm proposta e fechado, que já existem no Funil.

**Regra (dono, 10/11): o "Qualificado" do Funil não é o lead qualificado.** O Funil de hoje tem a etapa **"Qualificado"**, que é a opinião manual do dono ou do corretor.
- **Ela nunca conta para cobrança.**
- A qualificação objetiva fica em campo próprio.
- Na tela, os dois precisam de nomes diferentes. Proposta: renomear a etapa manual para algo como "Com potencial". Isso fica para quando a Fase 4 for aprovada.

**Acompanhamento da origem até a visita** (lido no código e no banco em 10/11):

- **Já existe:**
  - `tracked_links`: imóvel, oportunidade, conteúdo e canal;
  - `link_events`: visualização, clique no WhatsApp ou na DM, lead;
  - `leads`: imóvel, oportunidade, link, consentimento, `visit_at`, `proposal_at`, `closed_at`, corretor;
  - limites contra spam e lead repetido em 24 h.
- **Falta:**
  1. **Datas e estado da qualificação:** recebido, qualificado + motivo, entregue, contestado + motivo, em conversa.
  2. **"Em conversa":** o clique no WhatsApp leva a pessoa direto ao corretor, mas não vira lead nem conversa registrada. Duas saídas possíveis:
     - a imobiliária marca o primeiro contato no lead;
     - a resposta pelo WhatsApp da própria conta, quando estiver conectado, registra a conversa.
  3. **Primeiro e último contato com o conteúdo:** a marca do visitante (`visitor_hash`) muda todo dia, porque é calculada com a data. Por isso hoje não dá para ligar a visita de segunda ao contato de quinta.
     - **Decisão do dono (10/11): na 1ª versão, nada de marca guardada no celular do visitante.**
     - Vale o contato que gerou o lead, com:
       - a origem rastreável (link, conteúdo e canal);
       - o identificador do lead;
       - o imóvel, quando houver;
       - o acompanhamento do estado.
     - Ligar visitas de dias diferentes fica para depois, se os dados do piloto mostrarem que faz falta.
  4. **Lead do Instagram (DM, comentário):** entra em `leads` sem imóvel e sem origem. Os mesmos critérios precisam valer nos dois caminhos.
  5. **Funcionalidades da Fase 4:** catálogo da imobiliária e agendamento de visita com horário.
  6. **Conferir:** se `tracked_links.content_id` é preenchido quando a peça é publicada.

> **Divergência (13/11):** a Frente 3 tira a dependência do Telegram. **O canal do aviso de visita é decidido junto com o D5**
> ([PENDENCIAS.md](PENDENCIAS.md)). Texto de 10/11 mantido abaixo como registro.

**Requisito do dono (10/11): Telegram avisa cada visita agendada pelo link.** Toda visita marcada pelo link rastreável gera um
aviso no Telegram da imobiliária, com o imóvel, o horário, o nome do interessado e de onde ele veio. Entra junto com o
agendamento de visita da Fase 4, que ainda não existe; até lá, nada a fazer no código.

**Observação.** O aviso de "novo lead" que existe hoje (`hermes-lead-alert`) passa pelo Hermes, que roda no VPS e é instável. O aviso de
visita deve sair direto do Supabase, pelo mesmo caminho dos avisos do `telegram-buddy`, sem depender do Hermes.

**Portões antes de qualquer código da Fase 4** (dono, 10/11):
1. **Custos medidos:** auditoria v1 em 17/11 e simulador atualizado.
2. **Demanda:**
   - perguntas de tour e lead no roteiro do piloto ([PILOTO.md](PILOTO.md), seção 2.1);
   - resultado de pelo menos 1 piloto ou 3 conversas.
3. **Critérios aprovados:** a definição acima aprovada pelo dono, com os prazos de duplicidade e contestação já conversados com imobiliárias. (A decisão de privacidade já foi tomada: sem marca no celular na 1ª versão.)

**Preço do lead:** nenhum antes dos dados reais do piloto (dono, 10/11).

**Até 17/11 (dono):** trabalho concentrado na **validação comercial**. Nada de implementação nem de escopo novo. O roteiro e a ficha de registro das conversas estão em [PILOTO.md](PILOTO.md) (seções 2.1 e 2.2).

## 2026-11-12 — Especificação do fluxo de leads v2: direção aprovada (implementação só em parte)

> **Aprovado pelo dono em 12/11:** a direção e as decisões abaixo. **Liberado para código agora:** só o painel com os dados
> que já existem e as 2 correções de fidelidade (item 9). Pessoa/identidade, condições, entrega com recebimento,
> contestação, agendamento e Boosts **esperam** a auditoria de custos (17/11), um piloto ou 3 conversas e a aprovação
> final dos critérios. Telegram e Hostinger não mudam até o fim do teste do tour.

**1. Pessoa, lead e negociação.**
- **Pessoa:** quem demonstrou interesse. Tem um ou mais identificadores.
- **Lead:** o interesse de uma pessoa num imóvel, por um canal, num momento. A mesma pessoa interessada em 2 imóveis gera 2 leads.
- **Negociação:** o acompanhamento comercial de um lead (conversa, visita, proposta, venda). É o cartão do Funil.
- **Nome:** "negociação", e não "oportunidade comercial", porque "oportunidade" já é a oportunidade de mercado (`growth_opportunities`, `leads.opportunity_id`).

**2. Identidade (decisão do dono).** Só se vinculam registros e se declara duplicidade com identidade coincidente:
- o mesmo telefone normalizado ou o mesmo e-mail normalizado, entre formulários;
- o mesmo id do Instagram, dentro desse tipo de identificador, **depois de validar se o id do comentário é o mesmo da DM** (isso ainda não foi verificado);
- telefone e Instagram sem vínculo comprovado: **não presumir** que são a mesma pessoa.

Identidades diferentes não significam pessoas diferentes; significam só que não há evidência para juntá-las.

**Achado em 12/11:** o link da DM é o mesmo para todos (um por imóvel, oportunidade e canal), então hoje não existe identidade em comum entre o formulário e o Instagram.

**Futuro (não agora):**
- **link pessoal na DM:** a solução principal, porque cria uma relação técnica entre o comentário ou a DM e o formulário;
- **campo opcional de @ no formulário:** pode existir só como informação complementar, nunca como prova.

**3. Condições independentes**, cada uma com sim/não, data, motivo e responsável, sem uma depender da outra para análise:
- **Válido:**
  - contato utilizável;
  - evidência de consentimento, conforme a regra definida para o fluxo;
  - sem spam nem robô.
- **Qualificado:**
  - interesse num imóvel específico;
  - imóvel disponível no momento da manifestação;
  - origem rastreável;
  - sem duplicidade comprovada dentro da regra (hipótese: [30] dias, com a mesma identidade e o mesmo imóvel).
- **Entregue:** ver o item 5.
- **Cobrável (futuro):** válido + qualificado + recebimento confirmado + sem contestação aceita.

**4. Contestação (hipótese para o piloto).**
- **Prazo:** [7] dias depois do recebimento.
- **Motivos fechados:** contato inválido, duplicado, sem intenção comercial, spam.
- **Quem decide:**
  - aceite automático quando o sistema prova o motivo;
  - decisão humana quando o motivo depende de interpretação comercial.
- **Registro:** motivo, data e responsável.

**5. Entrega em 3 passos separados:**
1. **encaminhamento iniciado** (hoje o clique em "Encaminhar por WhatsApp" não é registrado);
2. **envio confirmado**, só quando o canal confirma (o link do WhatsApp nunca confirma);
3. **recebimento confirmado pela imobiliária**.

Para cobrança, vale o recebimento confirmado, registrado e auditável. É uma regra comercial: a confirmação da imobiliária não é prova técnica de que a mensagem chegou.

**6. Mensagens ao interessado:** nada sai sem ação explícita. A exceção continua: a DM automática da automação de comentário, quando o usuário configurou e autorizou o modo automático.

**7. Estágio da negociação, separado das condições:** novo → em conversa → visita agendada → visita realizada → proposta → venda | perdido. Ele nunca gera nem muda cobrança. Os nomes novos no Funil esperam a fase aprovada.

**8. Divergências do código, lidas em 12/11:**
- `tracked_links.content_id`: é preenchido, mas o link era um por (imóvel, oportunidade, canal), então as publicações dividiam o link. **Corrigido em 12/11:** link por publicação; a DM do "Comente QUERO" leva o link do post comentado (ver PITFALLS). Não é link por pessoa;
- o lead de comentário ignora o `item_id` da automação e cria um lead novo a cada comentário;
- o lead de DM fica com o id do Instagram no `contact`;
- o "Qualificado" do Funil é onde se grava a visita;
- estágio, canal e origem são texto livre;
- o encaminhamento ao corretor não é registrado;
- o WhatsApp não cria lead.

**9. Liberado agora, com limites:**
- **(a) Painel novo** só com dados que existem. Sem métricas fictícias, e sem apresentar comentário ou DM como lead qualificado.
- **(b)** Preencher o `content_id` quando a relação com a publicação estiver disponível.
- **(c)** O lead de comentário recebe o imóvel da automação.

Fica de fora: cobrança, identidade, contestação e regras novas de duplicidade.

**10. Ordem (dono):**
1. finalizar e testar o tour;
2. painel + as 2 correções;
3. um piloto ou conversas reais;
4. validar qualificação, entrega e cobrança antes de construir essa camada.

**Visão:** o diferencial é ligar a origem do interesse ao que aconteceu comercialmente depois.
- **Geração de demanda:** inteligência → conteúdo → distribuição → tour → anúncios.
  > **Divergência (13/11):** "anúncios" (pagos) está **fora do modelo atual**. Vale: inteligência → conteúdo → distribuição → tour.
- **Gestão da demanda:** captura → identificação → qualificação → entrega → negociação → visita.
