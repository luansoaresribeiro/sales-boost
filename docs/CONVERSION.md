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

**Proposta de definição de lead qualificado** (para o dono aprovar; os números entre colchetes são propostas, não decisões):

| # | Critério | Como o sistema confere | Hoje |
|---|---|---|---|
| 1 | Contato válido | Telefone com DDD ou e-mail em formato válido | Formato já é validado no formulário (`validateLead`) |
| 2 | Consentimento registrado | Data e texto do consentimento LGPD | Já existe (`consent_at`, `consent_text`) |
| 3 | Interesse num imóvel específico e disponível | Imóvel ligado ao lead e disponível naquele momento | Já existe para o lead da página (`item_id`); lead de DM/comentário não tem |
| 4 | Origem rastreável | Link, conteúdo e canal (e, se aprovado, primeiro e último contato) | Parcial: `link_id` → `tracked_links` (imóvel, oportunidade, canal, `content_id`) |
| 5 | Não duplicado | Mesmo contato + mesma imobiliária em [30] dias | Hoje: mesmo contato + mesmo imóvel em 24 h |
| 6 | Entregue à imobiliária | Data em que o lead chegou para ela | Não existe |
| 7 | Contestação | A imobiliária contesta em [7] dias com motivo fechado: contato inválido · duplicado · não é comprador/locatário · spam | Não existe |

**Estágios** (cada um com data e quem marcou):
`recebido → qualificado (automático, critérios 1–6) → em conversa → visita agendada → visita realizada → proposta → fechado`,
com **contestado** como saída.

**Cuidado com um nome que já existe.** O Funil de hoje tem a etapa **"Qualificado"**, que é a opinião manual do dono ou
do corretor. A qualificação objetiva acima é outra coisa e precisa de um campo próprio, para os dois não se misturarem nem na
tela nem na cobrança futura.

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
     - Ligar exigiria um identificador guardado no navegador do visitante. **Isso é decisão do dono (privacidade/LGPD).**
     - Sem esse identificador, vale só o último contato.
  4. **Lead do Instagram (DM, comentário):** entra em `leads` sem imóvel e sem origem. Os mesmos critérios precisam valer nos dois caminhos.
  5. **Funcionalidades da Fase 4:** catálogo da imobiliária e agendamento de visita com horário.
  6. **Conferir:** se `tracked_links.content_id` é preenchido quando a peça é publicada.

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
3. **Critérios aprovados:** a definição acima aprovada pelo dono, incluindo a decisão de privacidade do item 3 de "Falta".
