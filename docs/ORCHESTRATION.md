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

## Até o P4 existir (regra antiga — substituída em 2026-10-02)

Texto original, mantido como registro: "Enquanto o P4 (infra de
autonomia) não estiver pronto, os agentes **não rodam sozinhos sem o dono
acompanhar** — este roteiro é pra ser executado com a sessão principal
visível pro dono, nunca em background sem supervisão."

**Divergência:** o dono decidiu liberar o modo autônomo abaixo enquanto o
P4 é construído (ver [DECISIONS.md](DECISIONS.md)). O que segura a
segurança agora é: só PR (nunca merge), `main` protegido no GitHub,
sessões automáticas sem acesso a Supabase/Gmail/Instagram, e a lista de
tarefas proibidas abaixo.

## Modo autônomo (rotina agendada)

Princípio: **autonomia pra trabalhar ≠ autonomia pra publicar.**

### Agenda (horário do Rio)

- **Seg/qua/sex de manhã — rodada de trabalho:** no máximo **1 tarefa**
  por rodada (aumentar só quando o dono decidir, depois de observar o
  comportamento).
- **Sexta 18h — relatório da semana.**

### Rodada de trabalho

1. Ler `CLAUDE.md`, [ROADMAP.md](ROADMAP.md), [PITFALLS.md](PITFALLS.md),
   [DECISIONS.md](DECISIONS.md) e os PRs abertos.
2. Escolher **1 tarefa elegível** (critérios abaixo). Se já houver PR
   aberto do modo autônomo esperando o dono pra mesma tarefa, não repetir.
3. Seguir o roteiro normal (`product` → `engineer` → `qa`, máx. 3 voltas).
4. Abrir PR pro `main` com o **relatório por tarefa** na descrição.
5. Parar. Nunca fazer merge, nunca deployar, nunca "aproveitar" pra fazer
   uma segunda tarefa.

**Se não houver tarefa claramente segura e bem definida, o agente não
inventa trabalho** — não faz nada e registra isso no relatório (por que
nenhuma tarefa era elegível e o que destravaria).

### Tarefa elegível (todas as condições)

- Está no [ROADMAP.md](ROADMAP.md) (ou é um bug real documentado), com
  critério de pronto claro.
- **Não depende do dono** (seção "Fora do código" do roadmap, conta da
  Meta, credencial, decisão em aberto).
- **Não envolve nenhuma ALTERAÇÃO ARRISCADA** (lista em `CLAUDE.md`).
  No modo autônomo não há dono pra responder "Posso seguir?" — então o
  agente não pergunta e segue: ele **pula a tarefa** e lista no relatório
  como "precisa de você".
- **Não precisa de banco de dados** enquanto a rotina autônoma não
  tiver as chaves do banco de ensaio (`salesboost-ensaio` — o schema já
  está lá desde 2026-10-02, mas a rotina ainda não consegue acessá-lo; ver
  P4 no [ROADMAP.md](ROADMAP.md)). Mesmo depois: migration/SQL só no
  ensaio, nunca em produção.
- Cabe em 1 PR revisável (prefira pequeno).

### Proibido no modo autônomo (sem exceção)

- Merge de PR, push no `main`, `wrangler deploy`, deploy de edge function.
- Qualquer acesso ao banco de produção (`miwcxakzyforbahpnpst`).
- Publicar/enviar qualquer coisa (Instagram, DM, e-mail, Telegram).
- Gastar com provedor pago (Higgsfield, IA em lote, API nova).
- Mexer em secrets, auth, crons, DNS, painel da Meta.
- Desligar/remover funcionalidade existente.

### Relatório por tarefa (descrição do PR)

```
Trabalho concluído: <o que foi feito, em português simples>
Alterações: <arquivos principais>
Testes: <build ok/falhou, checagens do qa, prints>
PR: <link>
Riscos/pendências: <ou "nenhum">
Próximo passo: aguarda sua aprovação
```

### Relatório semanal (sexta 18h)

O que foi implementado · PRs abertos/fechados · testes executados ·
problemas encontrados · decisões que precisam do dono · próximo trabalho
que o agente pretende executar. Sempre em português simples.
