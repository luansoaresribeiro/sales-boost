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
