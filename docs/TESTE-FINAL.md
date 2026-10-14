# Teste Final — roteiro fixo

Pedido do dono (2026-10-14): "precisamos fazer este momento ter sempre
resultados previsíveis". O teste roda sempre os mesmos passos, com o mesmo
imóvel, e confere cada passo por regras objetivas. O texto da IA muda a cada
rodada; o que é conferido não muda.

## Como rodar

```bash
QA_EMAIL=email-da-conta-de-teste QA_PASSWORD='senha' node scripts/teste-final.mjs
```

- Sem guardar senha: dá pra passar `QA_TOKEN` (sessão aberta, vale 1h) ou
  `QA_REFRESH_TOKEN` no lugar de `QA_EMAIL`/`QA_PASSWORD`.
- Roda com o **login do cliente de teste**, nunca com chave de administrador.
  Assim o teste também prova que a conta só vê o que é dela.
- Conta usada hoje: **Tespon** (produção, acesso liberado à mão). Nunca rodar
  em conta de cliente real (regra 2).
- Lê `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` do ambiente ou do
  `.env.local`/`.env`.
- Opções: `--sem-video`, `--com-mobiliar`, `--sem-calendario`,
  `--sem-limpeza`, `--saida=pasta`.
- O relatório sai em `qa-relatorios/` (`.md` pra ler, `.json` pra comparar
  rodadas). A pasta fica fora do git.
- Custo típico: US$ 0,50 a 1. Cada edição de foto custa US$ 0,08 e o vídeo
  de 5 s custa US$ 0,42. Tudo entra no teto de US$ 40 da conta.

## O que ele faz e confere

1. **Acesso da conta.** A conta está paga ou liberada, e o setor tem ficha.
2. **Imóvel fixo do teste.** "Imóvel de teste (QA)" tem dados realistas fixos
   e 10 fotos reais, copiadas uma vez de um imóvel da conta. Ele é
   reaproveitado em todas as rodadas.
3. **Gasto do mês (antes).** Anota quanto já foi gasto, pra comparar no fim.
4. **Artes do kit grátis.** Gera as 3 artes da ficha e confere o tamanho de
   cada uma. Não tem custo.
5. **Calendário da semana.** Gera **só o que a estratégia pede**. Não existe
   mais post avulso (decisão do dono, 2026-10-14).
   - Antes, apaga as peças da próxima semana que **ainda não foram aprovadas
     nem agendadas**, pra cada rodada começar igual.
   - Pede a semana (`plan_week`) e espera as peças e as notas ficarem
     prontas.
   - Confere quatro coisas:
     - a quantidade de peças é a que a estratégia pede;
     - peça de imóvel usa foto real;
     - nenhum texto proibido aparece (conversa ou depoimento inventado,
       "Ops", recado pro corretor, distância inventada);
     - quantas peças ficaram prontas pra aprovar (passaram na análise) e quantas
       ficaram em revisão, com a nota de cada uma.
6. **Vídeo do imóvel.** Só roda se a estratégia pedir vídeo na semana.
7. **Mobiliar.** Fica fora do calendário, então só roda com
   `--com-mobiliar`.
8. **Teto de US$ 40.** Confere se o que o teste gastou é igual ao que o teto
   somou.
9. **Segurança básica.** A conta não pode enxergar dado de outra empresa.
10. **Limpeza.** Apaga só as peças que esta rodada criou. O imóvel fixo fica
    pra próxima rodada.

## Pré-requisito: estratégia ativa

A 1ª estratégia só nasce depois que os requisitos principais estão
preenchidos. São os mesmos do sino:

- dados do negócio;
- perguntas da ficha;
- catálogo com o mínimo de fotos;
- Instagram, se a ficha pedir.

Ver [DECISIONS.md](DECISIONS.md). Sem estratégia, o passo do calendário
falha e diz isso.

## Onde o dono vê o resultado no site

Em **Conteúdo → Calendário da semana**, clique numa peça da grade. Abre a
análise com a nota:

- passou na análise (hoje: nota ≥ 50 nos dois analistas) aparece como "Pronta pra aprovar";
- nota baixa aparece como "Nota baixa — revisar", com o motivo.

A aba Vault saiu em 2026-10-14.
