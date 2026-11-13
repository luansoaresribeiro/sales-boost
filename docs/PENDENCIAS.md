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

## Agora

| ID | Item | Resp. | Prior. | Depende de | Status |
|---|---|---|---|---|---|
| D1 | Aprovar o roadmap de [PLANO-TOUR-COMPLETO.md](PLANO-TOUR-COMPLETO.md) | Dono | P0 | — | ⏳ |
| D2 | Decidir quem tira as fotos que faltam na Tespon (tabela 2.3) ou qual imóvel usar no teste de ponta a ponta | Dono | P0 | D1 | ⏳ |
| D3 | Tamanho máximo de cada parte do tour (proposta: ~8 passagens, ~50 s) | Dono | P1 | D1 | ⏳ |
| D4 | Verba de teste da Frente 1 (proposta: até US$ 15) e provedor de nuvem da Frente 2 | Dono | P1 | D1 | ⏳ |

## Frente 1 — Tour Virtual completo

| ID | Item | Resp. | Prior. | Depende de | Pronto quando | Status |
|---|---|---|---|---|---|---|
| 1.0 | Auditoria do tour + viabilidade da Tespon | Agente | P0 | — | Documento entregue | 🧪 entregue em 13/11, aguardando D1 |
| 1.1 | Ambientes físicos (agrupar as fotos do mesmo ambiente) | Agente | P0 | D1 | Grupos da Tespon = tabela 2.1 (o dono confere os ❓) | ⏳ |
| 1.2 | Mapa de ligações com evidência (foto que prova cada ligação) | Agente | P0 | 1.1 | Mapa da Tespon = 2.2, nenhuma ligação inventada; custo medido | ⏳ |
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
