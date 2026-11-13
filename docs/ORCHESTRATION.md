# Sales Boost — Orquestração do time de agentes

> Roteiro da SESSÃO PRINCIPAL. Limitação real do Claude Code: subagentes em
> `.claude/agents/` não conseguem chamar outros subagentes — por isso o
> orquestrador é sempre a sessão principal seguindo este roteiro, nunca um
> arquivo de agente próprio.

## Regra geral
O [CLAUDE.md](../CLAUDE.md) manda: o semáforo 🟢🟡🔴, o protocolo de tarefa, a regra "Documentação sempre atualizada" e
o formato do relatório. Nada aqui pode contradizer o CLAUDE.md. A fonte do próximo item é a [PENDENCIAS.md](PENDENCIAS.md),
não o ROADMAP.

## Os 3 agentes
Todos leem SEMPRE: `CLAUDE.md`, [PENDENCIAS.md](PENDENCIAS.md) e [PITFALLS.md](PITFALLS.md).

- **`product`** (`.claude/agents/product.md`): planeja. Só leitura.
  - **Lê também:** [DECISIONS.md](DECISIONS.md) ("Decisões em vigor"), [PRODUCT.md](PRODUCT.md),
    [PLANO-TOUR-COMPLETO.md](PLANO-TOUR-COMPLETO.md) e o doc da área.
  - **Saída:** o plano (objetivo, passos, arquivos, riscos, "pronto quando"). Decisão para o dono sempre com: o que falta, por quê, alternativas (custo e prazo) e a recomendação. os conflitos com as decisões em vigor, a cor
    de cada ação no semáforo e se o pedido é **de direção** (aí lista os docs a atualizar).
- **`engineer`** (`.claude/agents/engineer.md`): implementa.
  - Só trabalha em branch.
  - Executa o que é 🟢/🟡 e para no 🔴, com o pedido no formato combinado.
  - Roda o build e os testes da área.
  - Atualiza no mesmo PR a PENDENCIAS, o DECISIONS (se houve decisão do dono) e o doc da área.
- **`qa`** (`.claude/agents/qa.md`): tenta quebrar. Sem `Edit/Write`.
  - Confere o PITFALLS e as regras invioláveis.
  - Testa a tela (inclusive no celular) com prints.
  - **Reprova o PR** que mudou direção sem atualizar os docs (DECISIONS → PENDENCIAS → CLAUDE.md → doc da área), ou
    que marca ✅ sem prova.
  - **Saída:** APROVADO/REPROVADO + resumo em português simples.

## Roteiro (sessão principal) — para tarefa grande (3+ arquivos, feature nova)
1. Seguir o **protocolo de tarefa** do CLAUDE.md: ler a PENDENCIAS e pegar o próximo item ⏳ da frente atual que seja
   do Agente e tenha as dependências ✅.
2. `product` → plano. Se houver ação 🔴 ou decisão do dono, **parar e pedir** no formato combinado.
3. `engineer` → implementa.
4. `qa` → APROVADO/REPROVADO. Se REPROVADO, volta ao `engineer` (máx. 3 voltas; depois, parar e reportar o bloqueio).
5. APROVADO e checagens verdes → o agente junta o próprio PR (🟢, dentro da frente aprovada). A publicação é automática.
   - **Exceção (dono, 13/11):** PR que muda `CLAUDE.md`, `.claude/agents/` ou este arquivo **espera a revisão do dono**. O
     agente não junta, e manda um resumo de no máximo 6 linhas: o que mudou, por quê, impacto, o que decidir.
6. **Validar** pelo "pronto quando". Marcar ✅ com a prova na PENDENCIAS, ou 🧪 se a prova ainda falta.
7. Se o próximo item é da mesma frente e não depende do dono, voltar ao passo 1. Senão, parar.
8. Relatório final no formato do CLAUDE.md, com a linha "Docs atualizados: …".

## Histórico
- O texto anterior (roteiro antigo, "Até o P4 existir", o modo autônomo agendado, pausado desde 06/10, e o banco de produção
  depois do PR aprovado) está em [historico/ORCHESTRATION-ate-2026-11-12.md](historico/ORCHESTRATION-ate-2026-11-12.md).
