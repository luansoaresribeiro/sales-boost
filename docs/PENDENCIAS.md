# Pendências — lista central (consultar ANTES de começar qualquer etapa)

> Regras desta lista (dono, 2026-11-13):
> - **Concluído só com validação.** Código escrito ou PR juntado não basta: o teste da coluna "Pronto quando" precisa ter
>   passado, e a prova (link, print, SQL) fica na coluna Status.
> - **Ao terminar um item**, o agente relê esta lista e pega o **próximo pendente da frente atual**. Nunca presume que o
>   projeto acabou. Frente nova só começa com a anterior validada, salvo autorização do dono.
> - **Decisão técnica ≠ autorização.** Nada aqui autoriza gastar crédito, mudar regra comercial, apagar infraestrutura ou
>   publicar conteúdo. Isso vem do dono, registrado em [DECISIONS.md](DECISIONS.md).
> - O detalhe de cada frente está em [PLANO-TOUR-COMPLETO.md](PLANO-TOUR-COMPLETO.md).
>
> Status: ⏳ pendente · 🔨 em andamento · 🧪 feito, aguardando validação · ✅ validado · ⛔ bloqueado (motivo)
> Responsável: **Dono** (Luan) ou **Agente** (Claude).

## Painel (atualizar a cada item)

- **Frente atual:** 1 — Tour do imóvel inteiro. D1 foi aprovado em 13/11 ([DECISIONS](DECISIONS.md#2026-11-13--decisões-do-dono-identidade-mercado-modelo-d1-autonomia-e-documentação)).
- **Próximo item do agente:** **1.1 — Ambientes físicos.**
  - **Agora:** construir e testar com testes automáticos, sem gasto. 🟢
  - **Validação na Tespon:** precisa de IA de visão (paga) e por isso espera o **D4**. 🔴
- **Esperando o dono:**
  - **D4:** verba de teste, incluindo a IA de visão da 1.1/1.2;
  - **D2:** fotos que faltam ou imóvel do teste;
  - **D3:** tamanho das partes;
  - **D5:** avisos do Telegram;
  - **D6:** reserva da VPS;
  - **D7:** pitch;
  - **validação comercial** (trilha abaixo, até 17/11).
- **Prioridade do negócio até 17/11:** a validação comercial. A Frente 1 anda em paralelo, sem tomar a atenção dela.

## Decisões do dono

| ID | Item | Resp. | Prior. | Depende de | Status |
|---|---|---|---|---|---|
| D1 | Aprovar o roadmap de [PLANO-TOUR-COMPLETO.md](PLANO-TOUR-COMPLETO.md) (4 frentes, uma por vez) | Dono | P0 | — | ✅ 13/11 ([DECISIONS](DECISIONS.md#2026-11-13--decisões-do-dono-identidade-mercado-modelo-d1-autonomia-e-documentação)) |
| D2 | Decidir quem tira as fotos que faltam na Tespon (tabela 2.3) ou qual imóvel usar no teste de ponta a ponta | Dono | P0 | — | ⏳ |
| D3 | Tamanho máximo de cada parte do tour (proposta: ~8 passagens, ~50 s) | Dono | P1 | — | ⏳ |
| D4 | Verba de teste da Frente 1: IA de visão da 1.1/1.2 (~US$ 0,30–0,80 por imóvel, estimado) + vídeo do teste de ponta a ponta (proposta: até US$ 15 no total). Também o provedor de nuvem da Frente 2 | Dono | P0 | — | ⏳ |
| D5 | Telegram: quais avisos viram e-mail; aviso para a A3 (inclui o canal do aviso de visita, ver [CONVERSION](CONVERSION.md)) | Dono | P1 | — | ⏳ |
| D6 | VPS: quanto tempo fica de reserva depois da troca | Dono | P2 | 2.3 | ⏳ |
| D7 | Reescrever o pitch ([pitch/PITCH.md](../pitch/PITCH.md)) com o modelo e o slogan novos. **Entram:** "Technology Partner for Real Estate" como posicionamento; **sem anúncios pagos**; o preço do tour como hipótese, que pode variar com o tamanho do imóvel | Dono + Agente | P2 | — | ⏳ |

## Validação comercial (dono, até 17/11) — prioridade do negócio

| ID | Item | Resp. | Prior. | Depende de | Pronto quando | Status |
|---|---|---|---|---|---|---|
| V1 | Conversas com imobiliárias pelo roteiro do [PILOTO.md](PILOTO.md) (meta: 3 conversas ou 1 piloto) | Dono | P0 | — | 3 conversas feitas ou 1 piloto fechado | ⏳ 0 de 3 registradas |
| V2 | Ficha preenchida por conversa (respostas como foram ditas) | Dono | P0 | V1 | 1 ficha por conversa | ⏳ |
| V3 | Consolidar as fichas em `docs/relatorios/` (sem inventar número; "disse que usaria" ≠ "pagou") | Agente | P0 | V2 | Relatório em [relatorios/](relatorios) | ⏳ |
| V4 | Revisão dos 3 portões da Fase 4 em 17/11 (custos medidos, demanda, critérios de lead) | Dono + Agente | P0 | V3 | Decisão registrada no DECISIONS | ⏳ |

## Frente 1 — Tour Virtual completo

| ID | Item | Resp. | Prior. | Depende de | Pronto quando | Status |
|---|---|---|---|---|---|---|
| 1.0 | Auditoria do tour + viabilidade da Tespon | Agente | P0 | — | Documento entregue + roadmap aprovado | ✅ 13/11 (#167; D1 aprovado) |
| 1.1 | Ambientes físicos (agrupar as fotos do mesmo ambiente) | Agente | P0 | D1 ✅; validação na Tespon: D4 | Testes automáticos ✅ + grupos da Tespon = tabela 2.1 (o dono confere os ❓) | ⏳ |
| 1.2 | Mapa de ligações com evidência (foto que prova cada ligação) | Agente | P0 | 1.1, D4 (IA de visão, 🔴) | Mapa da Tespon = 2.2, nenhuma ligação inventada; custo medido | ⏳ |
| 1.3 | Indicador de cobertura + lista de fotos que faltam (com ângulo) na tela | Agente | P0 | 1.2 | A tela mostra os pendentes da Tespon e a lista 2.3; print aprovado | ⏳ |
| 1.4 | Tour em partes + conferência de destino | Agente | P1 | 1.3, D3 | Testes automáticos + revisão do dono | ⏳ |
| 1.5 | Teste de ponta a ponta, imóvel inteiro | Agente + Dono | P0 | 1.4, D2, D4 | Os 7 critérios da seção 3, todos ✅, quadro a quadro; custo registrado | ⏳ |

## Frente 2 — Motor próprio de vídeo (só começa com a Frente 1 validada)

| ID | Item | Resp. | Prior. | Depende de | Pronto quando | Status |
|---|---|---|---|---|---|---|
| 2.1 | Contêiner com o `worker.mjs` (mesma fila `media_jobs`) | Agente | P1 | 1.5, D4 | Monta o trabalho de teste igual à VPS | ⏳ |
| 2.2 | Modo sombra: 10 trabalhos reais nos dois lugares | Agente | P1 | 2.1 | Equivalência (duração ±0,1 s, 1080×1920, fusões, capa, encerramento) | ⏳ |
| 2.3 | Contêiner principal, VPS de reserva | Agente | P1 | 2.2 | 14 dias sem falha | ⏳ |

## Frente 3 — Infraestrutura (VPS e Telegram) — NADA é apagado sem autorização do dono

| ID | Item | Resp. | Prior. | Depende de | Pronto quando | Status |
|---|---|---|---|---|---|---|
| D5 | Telegram: quais avisos viram e-mail; aviso para a A3 | Dono | P1 | D1 | Decisão registrada | ⏳ |
| D6 | VPS: quanto tempo fica de reserva depois da troca | Dono | P2 | 2.3 | Decisão registrada | ⏳ |
| 3.1 | Substitutos por e-mail (alertas da plataforma e de lead) | Agente | P1 | D5 | Alerta de teste chega | ⏳ |
| 3.2 | Conferir se os bots antigos (`marketing-bot`, `vendas-bot`, `group-manager`) estão publicados | Agente | P2 | — | Lista do que está no ar | ⏳ |
| 3.3 | Desligar Telegram e VPS por flag (sem apagar) | Agente | P2 | 2.3, 3.1, **autorização** | Checklist da seção 6 do plano | ⏳ |
| 3.4 | Apagar estrutura antiga | Agente | P3 | 3.3 + 14 dias + **2ª autorização** | Nada perdido (checklist) | ⏳ |

## Frente 4 — Experiência do usuário (depois do fluxo do tour definido)

| ID | Item | Resp. | Prior. | Depende de | Pronto quando | Status |
|---|---|---|---|---|---|---|
| 4.1 | Auditoria completa da jornada (prints no celular e no desktop) | Agente | P1 | 1.5 | Relatório aprovado pelo dono | ⏳ |
| 4.2 | Simplificações aprovadas, uma por PR | Agente | P1 | 4.1 | Print de cada uma + site publicado | ⏳ |

## Já validado (histórico)

| Item | Validação |
|---|---|
| Tour contínuo, área social da Tespon, 8 ambientes | Vídeo de 13/11: 0 cortes, conferido quadro a quadro, US$ 3,528 ([MEDIA-ENGINE.md](MEDIA-ENGINE.md)) |
| Legenda do tour cita só os ambientes reais | #166 + teste automático; publicado pelo workflow em 13/11 |
