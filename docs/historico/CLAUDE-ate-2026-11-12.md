# CLAUDE.md — versão até 12/11/2026 (histórico)

> Copiado em 2026-11-13, antes da reorganização pedida pelo dono, sem alteração de texto. Substituído pelo
> [CLAUDE.md](../../CLAUDE.md) atual (semáforo, protocolo, documentação sempre atualizada).

# Sales Boost

Sales Boost é uma growth engine de IA pra pequenos negócios: entende o
cliente com dados reais, monta a estratégia, cria e publica conteúdo, e
aprende com o resultado — sempre com o dono aprovando antes de qualquer
coisa ir ao público. Setor piloto hoje: imóveis, Rio de Janeiro, via
Instagram.
Slogan (dono, 2026-11-10): **"Sales Boost — gerando mais visitas para o seu imóvel"**.
Direção (dono, 2026-11-11/13): de ferramenta de marketing para **sistema de
inteligência e geração de demanda comercial** — a medida é visita ao imóvel.
Prioridade agora: Tour Virtual do imóvel inteiro → motor próprio de vídeo →
sair de VPS/Telegram (só depois do substituto) → experiência do usuário.
**Antes de qualquer etapa, consultar [docs/PENDENCIAS.md](../PENDENCIAS.md).**

## Índice da documentação

Todo agente lê este arquivo primeiro — ele é curto de propósito. O
conteúdo técnico detalhado vive em `docs/`:

- [docs/PRODUCT.md](../PRODUCT.md) — posicionamento, verticalização,
  ofertas, público-alvo, diferenciais, concorrentes, modelo de cobrança,
  marca.
- [docs/ARCHITECTURE.md](../ARCHITECTURE.md) — o ciclo de 10 etapas
  (mapa ✅/🟡/❌), Jarvis, stack, modelo de dados, variáveis de ambiente.
- [docs/CONTENT-INTELLIGENCE.md](../CONTENT-INTELLIGENCE.md) — como o
  sistema decide o que criar (pilares, receitas de produção, pacote por
  item, calendário).
- [docs/MEDIA-ENGINE.md](../MEDIA-ENGINE.md) — vídeo a partir das fotos
  reais: Tour virtual (no ar, cobre parte do imóvel), estúdio na VPS,
  mobiliamento (especificação).
- [docs/PLANO-CRIATIVOS.md](../PLANO-CRIATIVOS.md) — plano: 4 famílias de
  conteúdo, formato fixo × intenção da estratégia, sistema de slides com a
  identidade do cliente (ainda não implementado).
- [docs/CONVERSION.md](../CONVERSION.md) — da conversa (comentário/DM)
  ao lead.
- [docs/LEARNING.md](../LEARNING.md) — medição e aprendizado.
- [docs/INSTAGRAM.md](../INSTAGRAM.md) — conexão e publicação.
- [docs/META-APP-REVIEW.md](../META-APP-REVIEW.md) — roteiro e textos
  do pedido de aprovação do app na Meta.
- [docs/TESTE-FINAL.md](../TESTE-FINAL.md) — o roteiro fixo do teste
  final (como rodar, o que confere, como ler o relatório).
- [docs/PITFALLS.md](../PITFALLS.md) — armadilhas já descobertas (ler
  antes de mexer em cron, auth, domínio, migrations).
- [docs/DECISIONS.md](../DECISIONS.md) — decisões, com data e motivo.
- [docs/ROADMAP.md](../ROADMAP.md) — prioridades (P0-P4) com critério de
  pronto.
- [pitch/PITCH.md](../../pitch/PITCH.md) — o pitch em trabalho e a ideia de
  preço (ainda não decidida).
- [docs/PILOTO.md](../PILOTO.md) — kit do piloto com imobiliária parceira
  (roteiro, o que pedir, plano de 4 semanas, critérios de sucesso).
- [docs/PENDENCIAS.md](../PENDENCIAS.md) — **lista central de pendências**: consultar
  antes de cada etapa; item só fica ✅ com a validação feita.
- [docs/PLANO-TOUR-COMPLETO.md](../PLANO-TOUR-COMPLETO.md) — tour do imóvel
  inteiro, motor próprio de vídeo, saída de VPS/Telegram (proposta 13/11).
- [docs/AUDITORIA-CUSTOS.md](../AUDITORIA-CUSTOS.md) — custos medidos por
  serviço (auditoria de 10/11; refazer a medição em 17/11).
- Histórico, não guia de direção: `docs/DATA_AUDIT.md`, `DATA_GAPS_PLAN.md`,
  `DATA_MAP.md`, `DATA_SYNC_ARCHITECTURE_PLAN.md` (levantamentos de set–out/2026).
- [docs/ORCHESTRATION.md](../ORCHESTRATION.md) — roteiro do time de
  agentes (`.claude/agents/`: `product`, `engineer`, `qa`).

Onde o código real divergir de um doc, **registre a divergência no doc em
vez de apagar o que estava escrito** — isso é o que mantém a documentação
confiável pro próximo agente.

## REGRAS INVIOLÁVEIS

1. Nada vai ao público sem aprovação do dono (post, DM, resposta,
   anúncio).
2. Nunca tocar dados de clientes reais (Liga dos Sonhos) em testes.
3. Nunca publicar em Instagram real sem aprovação explícita — inclui
   @getsaleboost (perfil oficial e público do Sales Boost; uso em teste
   só com as condições de [docs/DECISIONS.md](../DECISIONS.md)).
4. Foto de item (imóvel) é sempre real; IA de imagem/vídeo nunca escreve
   texto (texto só via `render-format` ou legenda).
5. Nunca inventar números (preço, m², mercado, métricas).
6. Tudo que é de setor vive na ficha (`vertical_playbooks`) — nunca
   código específico de setor.
7. Respeitar teto de custo de IA e de provedores.
8. Depois de mudar telas, publicar o site (`npm run build && npx wrangler
   deploy`) e confirmar **"Site publicado em getsaleboost.com ✅"** no
   relatório.
9. Falar com o dono (Luan) em português simples — ele não é
   desenvolvedor. Nada de jargão técnico sem explicação. Quando algo
   precisa ser feito no terminal por ele, dar o comando pronto.

## 🔴 Alterações arriscadas — parar e pedir aprovação antes de fazer

- Migration/SQL que altere o banco de produção, apague dados, mude RLS.
  (Se a mudança veio num PR que o dono aprovou e juntou, o merge já é a
  aprovação — aplicar só aquele SQL, conforme
  [docs/ORCHESTRATION.md](ORCHESTRATION-ate-2026-11-12.md#banco-de-produção-depois-do-pr-aprovado).)
- Mudar autenticação, `verify_jwt`, secrets, crons/agendamentos.
- Deploy de functions usadas por clientes reais em funcionamento
  (`agent-actions`, `instagram-webhook`, `hermes-proxy`,
  `strategy-generate`, `creative-generate`, `claim-diagnostic`).
- Qualquer publicação/envio em conta real (Instagram, DM, e-mail,
  Telegram de cliente).
- Gastar dinheiro além do teste combinado (Higgsfield, IA em lote, nova
  API paga, novo fornecedor).
- Mudar domínio, DNS, painel da Meta, Supabase Auth.
- Remover ou desligar funcionalidade existente.
- Mudar a direção do produto (algo que contradiga
  [docs/DECISIONS.md](../DECISIONS.md)).

> **Nota (2026-10-29):** a regra desta seção foi **relaxada pelo dono** — migration, deploy de function (inclusive de
> cliente real) e cron o agente faz sozinho; só decisões que mudam a **direção do produto** (e gasto novo, como
> vídeo/Higgsfield) continuam exigindo a resposta dele. Ver
> [docs/DECISIONS.md](DECISIONS-2026-09-a-10.md#2026-10-29--autonomia-do-agente). Os itens acima ficam como lista de **cuidado**
> (testar, comparar o deploy, deixar rollback documentado), não de pedido de permissão.

**Formato do aviso** (em português simples): O que vou fazer · Por quê ·
O que pode dar errado · Como desfazer · **"Posso seguir?"** — e esperar a
resposta antes de agir.

## Regras de engenharia (sempre, independente da área)

- Do what has been asked; nothing more, nothing less.
- NUNCA criar arquivo novo a menos que seja realmente necessário — prefira
  editar o que já existe.
- NUNCA criar arquivo de documentação fora de `docs/` sem pedido
  explícito.
- SEMPRE ler um arquivo antes de editá-lo.
- NUNCA commitar segredo, credencial ou `.env`.
- Manter arquivos abaixo de 500 linhas quando der.
- Validar entrada nas bordas do sistema.
- Tela e código andam juntos: em toda mudança, conferir se o que a tela
  promete ou mostra é o que o código faz de verdade (e vice-versa). Achou
  divergência → corrigir no mesmo trabalho ou registrar no doc da área.

## Build & Test

```bash
npm run build && npx wrangler deploy
```

Sempre verificar que o build passa antes de reportar tarefa como
concluída.

## Time de agentes

Pra tarefas de engenharia maiores (3+ arquivos, feature nova,
refatoração entre módulos, mudança de API), siga
[docs/ORCHESTRATION.md](../ORCHESTRATION.md) — o roteiro da sessão
principal coordenando `product` → `engineer` → `qa`. Pra edição pontual
(1-2 arquivos, fix pequeno, atualização de doc, mudança de config), não
precisa do time — trabalhe direto.
