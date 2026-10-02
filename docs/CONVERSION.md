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
