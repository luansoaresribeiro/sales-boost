# Sales Boost — Orquestração do time de agentes

> Roteiro da SESSÃO PRINCIPAL. Limitação real do Claude Code: subagentes em
> `.claude/agents/` não conseguem chamar outros subagentes — por isso o
> orquestrador é sempre a sessão principal seguindo este roteiro, nunca um
> arquivo de agente próprio.

## Os 3 agentes

Todos lêem SEMPRE, além do que é listado pra cada um: `CLAUDE.md` +
[ROADMAP.md](ROADMAP.md) + [PITFALLS.md](PITFALLS.md).

- **`product`** (`.claude/agents/product.md`) — Planejador de produto.
  Ferramentas: só leitura (`Read, Grep, Glob`). Lê também
  [PRODUCT.md](PRODUCT.md), [DECISIONS.md](DECISIONS.md),
  [ARCHITECTURE.md](ARCHITECTURE.md), [CONTENT-INTELLIGENCE.md](CONTENT-INTELLIGENCE.md).
  Saída: um plano com passos, arquivos, riscos, critério de pronto,
  conflitos com [DECISIONS.md](DECISIONS.md)/[PITFALLS.md](PITFALLS.md), e
  se há ALTERAÇÃO ARRISCADA (lista em CLAUDE.md).
- **`engineer`** (`.claude/agents/engineer.md`) — Engenheiro. Todas as
  ferramentas. Lê também [ARCHITECTURE.md](ARCHITECTURE.md) e o doc da
  área específica ([MEDIA-ENGINE.md](MEDIA-ENGINE.md),
  [CONVERSION.md](CONVERSION.md), [LEARNING.md](LEARNING.md),
  [INSTAGRAM.md](INSTAGRAM.md), [CONTENT-INTELLIGENCE.md](CONTENT-INTELLIGENCE.md)).
  Só trabalha em branch. Antes de qualquer ALTERAÇÃO ARRISCADA: PARA e
  devolve o aviso no formato combinado (CLAUDE.md seção de regras
  invioláveis). Implementa, roda build + checagem de tipos, atualiza os
  docs e o [ROADMAP.md](ROADMAP.md) no mesmo PR, abre o PR.
- **`qa`** (`.claude/agents/qa.md`) — QA. Ferramentas: `Read, Grep, Glob,
  Bash` (testes/Playwright), sem `Edit/Write`. Lê também
  [PRODUCT.md](PRODUCT.md) (regras invioláveis) e o doc da área. Tenta
  quebrar, confere cada armadilha do [PITFALLS.md](PITFALLS.md) e cada
  regra inviolável, testa a tela (inclusive celular) com prints. Saída:
  APROVADO/REPROVADO + resumo em português simples pro dono.

**Regra comum:** ao aprender algo novo (armadilha nova, decisão nova),
atualizar o doc correspondente no mesmo PR — nunca deixar pra depois.

## Roteiro (sessão principal)

1. Ler `CLAUDE.md` e [ROADMAP.md](ROADMAP.md); escolher o item de maior
   prioridade ainda não feito e que não dependa do dono.
2. Chamar o agente `product` → plano + critério de pronto.
3. Se o plano tiver ALTERAÇÃO ARRISCADA ou depender de uma decisão do
   dono → PARAR e perguntar no formato combinado (CLAUDE.md). Só seguir
   com o "sim" explícito do dono.
4. Chamar o agente `engineer` com o plano.
5. Chamar o agente `qa`. Se REPROVADO → volta pro `engineer` (máx. 3
   voltas; depois disso, parar e reportar o bloqueio pro dono em vez de
   insistir sozinho).
6. APROVADO → abrir PR com o resumo do QA em português simples, prints e
   link de prévia (quando existir); marcar o item em
   [ROADMAP.md](ROADMAP.md) como "aguardando aprovação do dono".
7. **Teto por rodada:** no máximo 2 tarefas, respeitando o limite de
   custo de IA combinado com o dono.
8. Relatório final pro dono: o que foi feito, o que espera aprovação, o
   que travou e por quê — sempre em português simples (Luan não é
   desenvolvedor).

## Até o P4 existir

Enquanto [ROADMAP.md](ROADMAP.md) P4 (infra de autonomia: ambiente de
ensaio, PR com checagens automáticas, deploy automático pós-aprovação)
não estiver pronto, os agentes **não rodam sozinhos sem o dono
acompanhar** — este roteiro é pra ser executado com a sessão principal
visível pro dono, nunca em background sem supervisão.
