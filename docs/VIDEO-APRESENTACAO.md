# Vídeo de apresentação do Sales Boost

> Passagem de bastão entre sessões (2026-10-16). Material de marketing do
> próprio Sales Boost (perfil @getsaleboost), não é funcionalidade do
> produto. Código e arquivos em `marketing/video-apresentacao/`.

## Objetivo

Vídeo vertical (Reels/Stories, 1080×1920) de ~33s apresentando o Sales
Boost **para corretores e imobiliárias**, deixando claro que **gera
demanda**. Precisa gerar curiosidade, autoridade e ter copy forte.

## O que já existe

- `out/sales-boost-apresentacao.mp4` — v1 (28s), só tipografia animada,
  baseada no carrossel. Já entregue ao dono.
- `out/storyboard.png` — storyboard v1 (6 cenas). **Superado** pelo
  roteiro v2 abaixo, depois que o dono mandou referências e pediu algo mais
  cinematográfico, "com muito mais objetos e transições".
- `src/index.tsx` (vídeo v1) e `src/board.tsx` (storyboard v1) — Remotion.
- `referencias/ref1..3-quadros.jpg` — quadros extraídos dos 3 vídeos de
  referência que o dono enviou (TikToks gravados de tela).

## Decisões do dono

- Abertura: **"Seu próximo cliente está no Instagram agora. Só não está te
  vendo."**
- Estilos: escuro com brilho + telas reais do painel; depois refinado
  pelas 3 referências (abaixo).
- Cenas de fundo: **cenas do Rio** (Copacabana, Botafogo, drone noturno).
- Higgsfield Katana: **sem economizar créditos** — mas mostrar ao dono a
  lista de cenas e pedir **um "ok" único** antes de gerar.
- Bio escolhida pra Instagram (sugestão): "🚀 Transforme seus imóveis em
  clientes / 🤖 IA feita para corretores e imobiliárias / ✅ Você aprova
  tudo antes de publicar / 👇 Diagnóstico grátis".

## As 3 referências (análise)

Os três foram feitos pelo Claude com código (Hyperframes / "no After
Effects") — **não** com Higgsfield. Dá pra fazer em Remotion.

1. **Agência (Opus 5.5 x Hyperframes)** — anel de texto 3D girando, linha
   de luz neon como transição, uma cena por serviço com cor chapada, título
   grosso em caixa alta + palavra em itálico serifado, celulares/telas e
   figurinhas pulando, formas que se transformam, fluxo de automação se
   desenhando. Cortes de ~1,5s.
2. **Lançamento de produto (New Claude Opus 5.5)** — fundo escuro, celular
   surge com anel de brilho, ícone do app aparece, tela do produto se monta
   saindo do desfoque. Estilo Apple.
3. **"Claude cooked"** — fundo **laranja**, card de painel flutuando em 3D,
   esferas, palavra gigante "LYING." quebrando em estilhaços + "to you" em
   itálico, esfera laranja com valor que **derrete**. Copy com reviravolta.

Paleta resolvida: alternar **cenas escuras com brilho laranja** (ref 2) e
**cenas laranja chapadas** (ref 3), no ritmo da ref 1. Fica 100% na marca
(`#FF6D29`, `#0E0B0A`, `#150E08`, `#BABABA`, Bricolage Grotesque).

## Roteiro v2 (proposto — aguardando aprovação do dono)

| # | Tempo | Estilo | Cena | Texto |
|---|---|---|---|---|
| 1 | 0–3s | Katana + ref 2 | Copacabana ao entardecer escurece → celular surge girando com anel laranja | "Seu próximo cliente está no Instagram agora." |
| 2 | 3–5s | ref 1 | Anel 3D de texto: "IMÓVEIS + POSTS + VISITAS + DEMANDA +" | "Só não está *te vendo.*" |
| 3 | 5–9s | ref 3 | Fundo laranja, post de imóvel com corações e contador (número desfocado) → glitch → "CURTIDAS" estilhaçando | "Curtidas… não agendam *visita.*" |
| 4 | 9–12s | ref 2 | Escuro, logo surge com anel de luz laranja | "SALES BOOST · *a IA que transforma imóveis em demanda*" |
| 5 | 12–22s | ref 1 | 4 cenas rápidas alternando escuro/laranja | "ESTUDA *seu bairro*" (mapa do Rio + pinos) → "CRIA *posts que vendem*" (celular + carrossel) → "RESPONDE *quem pergunta*" (balões + fluxo) → "APRENDE *toda semana*" (gráfico sem números) |
| 6 | 22–27s | ref 3 | Fundo claro, botão 3D laranja "APROVAR" apertado e "amassando" | "Você aprova *tudo.* Seu nome. Seu CRECI. Sua marca." |
| 7 | 27–33s | Katana + ref 2 | Drone no Rio à noite → luzes → preto → logo + site | "Feito para corretores e imobiliárias. *Diagnóstico grátis* · getsaleboost.com" |

Perguntas em aberto ao dono:
1. Aprova o roteiro v2?
2. Cena 3 sem número nenhum (regra 5) — ok?
3. Tem **foto real** de imóvel (com autorização) pras cenas 3 e 5? Senão,
   post estilizado sem foto.

## Decisões de 2026-10-16 (ideia central + Higgsfield)

- **Ideia central do dono** (entra no roteiro): "não conseguir transformar
  presença digital em oportunidades comerciais previsíveis, sem depender de
  trabalho manual o tempo inteiro". Sem prometer resultado: o que é
  previsível é o **método**, não o número de clientes.
- **Roteiro v2 aprovado pelo dono, com estes ajustes** (mantém ~33s):
  - Cena 3 vira duas: 3a (5–7s) "Curtidas… não agendam *visita.*" e
    3b (7–9s) **"E fazer tudo na mão… não *escala.*"** (tarefas
    empilhando — "postar", "responder", "legendar" — até desabar).
  - Cena 4 (9–12s): logo SALES BOOST + **"Menos sorte. Mais *método*."**
    (escolha do dono; substitui "a IA que transforma imóveis em demanda").
  - Cenas 1, 2, 5, 6 e 7 iguais.
- **Higgsfield:** o conector do claude.ai está ligado, mas a conta dele tem
  0 créditos (plano free). Os créditos do dono estão na **API** do
  Higgsfield. Caminho: o dono põe a chave da API como variável de ambiente
  `HF_CREDENTIALS` (formato `key_id:key_secret`, igual ao secret do
  Supabase) e libera `platform.higgsfield.ai` em Network access; depois
  abre sessão nova. Continua valendo: lista de cenas + custo → um "ok"
  único do dono antes de gerar.

## Bloqueios desta sessão (2026-10-15/16)

- **Conector Higgsfield não aparecia** na sessão. Dono vai conectar em
  claude.ai/customize/connectors e abrir sessão nova.
- **Rede do ambiente bloqueava** `getsaleboost.com` e
  `miwcxakzyforbahpnpst.supabase.co` (sem prints do painel). Dono vai
  liberar em Network access (ou Full) — incluir também `higgsfield.ai`.
- Prints do painel: usar **conta de teste** (e-mail
  `Luan26ribeiro+teste2@gmail.com`; senha com o dono — **nunca** salvar
  aqui). Nunca conta de cliente real (Liga dos Sonhos). Dono deve trocar a
  senha depois.

## Sessão de 2026-10-16 (continuação)

- Dono confirmou: roteiro v2 aprovado com os ajustes acima; **não vai
  mandar fotos do Rio** — cenas de cidade geradas por IA (nunca imóvel,
  nunca texto). Usar os créditos da **API** do Higgsfield.
- **Bloqueio:** a chave `HF_CREDENTIALS` foi cadastrada em *Network
  secrets* presa ao domínio `getsaleboost.com`, não a
  `platform.higgsfield.ai`. Resultado: `platform.higgsfield.ai` responde
  401 "Invalid credentials" (a rede já está liberada). Correção: no menu do
  ambiente → Edit → Network secrets, trocar o domínio do `HF_CREDENTIALS`
  para `platform.higgsfield.ai` e abrir sessão nova.
- Sem a chave não dá pra consultar o preço real de cada cena — **não
  chutar valores**. Próximo passo: com a chave funcionando, montar a lista
  de cenas Katana (1: Copacabana ao entardecer; 7: drone no Rio à noite;
  opcionais: Botafogo/Pão de Açúcar pro fundo da cena 5) com o custo de
  cada uma e pedir o "ok" único.

## Pendências de outra conversa (retomar depois do vídeo)

1. **Agente de leads** (PR #51, branch `claude/nifty-shannon-ysp818`): o
   teste mostrou que o Google Maps quase só tem imobiliárias, não
   corretores autônomos. Dono vai escolher entre (1) afrouxar o mínimo de
   avaliações do Google para corretor, (2) buscar corretores direto no
   Instagram (bio com "corretor"/CRECI, hashtags) ou (3) os dois. Também
   vai dizer quantos leads quer por busca (hoje 10; a busca automática das
   6h usa o mesmo número). Detalhes no fim de `docs/DECISIONS.md`.
2. Depois que o dono juntar o PR #51: conferir se o site publicou e
   confirmar **"Site publicado em getsaleboost.com ✅"**.
3. Na sequência já aprovada: **"Comente QUERO" completo** (resposta
   pública + DM terminando em pergunta + follow-up só dentro de 24h depois
   que a pessoa responder) e depois a **confirmação de visita** (link de
   agendamento + confirmação em 1 toque no Telegram).

## Regras que valem pra esse vídeo

- IA de vídeo (Katana) **nunca escreve texto** e **nunca gera imóvel** —
  só cenas de cidade/bairro/celular. Texto e logo entram na montagem
  (Remotion).
- Nada de número inventado (curtidas, vendas, prazos), nada de "valorização
  garantida".
- Telas do painel: versões estilizadas só do que o produto faz de verdade.
- Nada é publicado pelo Claude — o dono posta.

## Como gerar os arquivos

```bash
cd marketing/video-apresentacao
npm install
# no container da nuvem, apontar pro Chromium já instalado:
npx remotion render src/index.tsx Apresentacao out/sales-boost-apresentacao.mp4 \
  --browser-executable=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell
npx remotion still src/board.tsx Board out/storyboard.png \
  --browser-executable=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell
```

O ffmpeg embutido do Remotion não tem filtros (`fps`, `scale`, `tile`):
pra extrair quadros de vídeo use `npx remotion ffmpeg -ss <t> -i <vídeo>
-frames:v 1 saida.jpg` e monte a folha de contato com Python/PIL.
