// Legenda NUNCA fala com o corretor (2026-10-23). A IA às vezes escreve, dentro da legenda, um recado
// pro corretor ("⚠️ Sobre a metragem: os dados que recebi precisam de confirmação antes de publicar…").
// Isso é nota interna: não pode ir pro Instagram. `stripInternalNotes` tira esse trecho do texto e
// devolve o que tirou (pra virar aviso pro dono em `reasoning`). Função PURA (sem Deno/rede): roda
// no Deno e no teste em Node.
//
// Regras (QA rodada 1, 2026-10-23 — cuidado com falso positivo; NUNCA tirar só por "corretor", ⚠️,
// "confirme", "antes de publicar" ou "precisa de…" soltos). O sinal de recado é a IA falando com QUEM PUBLICA:
//  - 1ª pessoa sobre os DADOS ("os dados que recebi precisam de confirmação", "não consegui confirmar",
//    "me parece um erro", "o m² informado parece incorreto");
//  - vocativo ("Corretor," / "Atenção corretor:" no começo de bloco ou de frase);
//  - ordem de revisão a quem publica ("favor revisar", "[REVISAR]", "confira/revise … antes de postar");
//  - dado "precisa de/ser" conferido (sujeito é um DADO: valor, preço, metragem…, não "seu imóvel");
//  - rótulo de nota ("Obs.:", "Nota:", "PS:", "Aviso:") seguido de revisão/estranheza de dado
//    ("parece alto", "confirme com o proprietário"); "nota/aviso/obs interna".
//  - FRACAS (só com ⚠/🚨/❗ no começo do bloco): "sobre a metragem:", "inconsistência", "parece erro",
//    "valor estranho", "não bate", "verifique".
//  - Bloco que começa com ⚠/🚨/❗ ou vocativo e casa com qualquer regra: sai INTEIRO. Bloco normal: só a
//    linha/frase marcada sai (e a ordem solta que sobrar, ex.: "Revise.").
//  - Passam intactas: "Fale com o corretor João", "⚠️ Últimas unidades", "Me passa seu WhatsApp…",
//    "Antes de publicar seu anúncio, tire fotos…", "Para o dono do primeiro imóvel…", "Nota: aceita pet".
//  - Removido de propósito: "me passa/envie + dado" e "para o dono/corretor" soltos (apagavam chamada pública).
//    "Ops! Corretor, me passa a metragem" sai pelo vocativo.

export const INTERNAL_NOTE_PREFIX = 'Recado da IA que saiu da legenda: '
export const EMPTY_CAPTION_NOTICE = 'A legenda não saiu (a IA só escreveu um recado pro corretor, que foi retirado) — gere de novo.'

const FLAG = /^[\s\u200d\ufe0f]*(?:⚠|🚨|❗)/u
// Sinais de RECADO (a IA falando com quem publica, não com o público). Nada aqui marca só por palavra solta
// ("corretor", "confirme", "antes de publicar", "precisa de…"): sempre combinado com o contexto.
const DATA = '(?:dados?|valor(?:es)?|n[uú]mero(?:s)?|informa[cç][oõ]es|metragem|pre[cç]o|m²|[aá]rea|iptu|condom[ií]nio)'
const REVIEW_VERB = '(?:confirma|revis|confer|verific|valid|checar)'
const STRONG: RegExp[] = [
  // 1ª pessoa sobre os DADOS
  /dados?\s+(?:que\s+(?:eu\s+)?recebi|informados|fornecidos|enviados|passados|cadastrados)[^.!?\n]{0,60}?(?:precis\w+|confirm\w+|revis\w+|confer\w+)/i,
  /\bn[aã]o\s+consegui\s+(?:confirmar|verificar|conferir|validar|obter|achar|encontrar)\b/i,
  /\bme\s+parece\s+(?:um\s+)?(?:alto|baixo|incorret\w*|errad\w*|estranh\w*|erro|suspeit\w*|absurd\w*)/i,
  /\binformad[oa]s?\b[^.!?\n]{0,30}\b(?:parece\w*|incorret\w*|errad\w*|estranh\w*|suspeit\w*)/i,
  // dado que "precisa ser/de" conferido (o sujeito é um DADO, não o imóvel)
  new RegExp(`\\b${DATA}\\b[^.!?\\n]{0,40}\\bprecis\\w+\\s+(?:de\\s+)?${REVIEW_VERB}`, 'i'),
  new RegExp(`\\b${DATA}\\b[^.!?\\n]{0,40}\\b(?:deve(?:m)?|precisa(?:m)?|tem\\s+que|t[eê]m\\s+que)\\s+ser\\s+(?:confirmad|revisad|conferid|verificad|validad)`, 'i'),
  // imperativo de revisão dirigido a quem publica
  /\bfavor\s+(?:revisar|conferir|confirmar|verificar|checar|corrigir|validar)/i,
  new RegExp(`\\b(?:revis\\w+|reveja|confir\\w+|confer\\w+|confira|verifi\\w+|valid\\w+|cheque|corrij\\w+)\\b[^.!?\\n]{0,60}\\bantes\\s+de\\s+(?:publicar|postar|o\\s+post)`, 'i'),
  /antes\s+de\s+(?:publicar|postar)\b[,:]?\s+(?:revis|confer|confir|verifi|valid)\w*/i,
  /\[\s*(?:revisar|revis[aã]o|conferir|verificar|checar|aten[cç][aã]o|nota|obs)[^\]]*\]/i,
  // rótulo de nota interna
  /\b(?:nota|aviso|obs\.?|observa[cç][aã]o)\s+interna\b/i,
  /\b(?:nota|aviso|recado|obs\w*|observa[cç][aã]o|mensagem)\s+(?:interna\s+)?para\s+(?:o|a)\s+(?:corretor|corretora|dono|dona)\b/i,
  // vocativo
  /\baten[cç][aã]o\s*,?\s+(?:corretor|corretora|dono|dona)\b/i,
]
const WEAK: RegExp[] = [
  /sobre\s+(?:a|o)\s+(?:metragem|pre[cç]o|[aá]rea|endere[cç]o|valor)\s*:/i,
  /inconsist[eê]ncia/i,
  /parece\s+(?:um\s+)?erro/i,
  /valor\s+estranho/i,
  /n[aã]o\s+bate/i,
  /verifique/i,
]
// Estranheza de dado: só conta com rótulo de nota ("Obs.:", "Nota:", "PS:", "Aviso:") ou ⚠/🚨/❗ no começo.
const ODD = new RegExp(`(?:parece|pareceu)\\s+(?:um\\s+)?(?:alto|baixo|incorret\\w*|errad\\w*|estranh\\w*|erro|suspeit\\w*|absurd\\w*)|\\b${DATA}\\s+(?:estranho|suspeito|incorreto|errado)|erro\\s+de\\s+digita[cç][aã]o|incomplet\\w+|inconsist[eê]nc\\w+|\\bfavor\\b|\\brevis(?:ar|e)\\b|(?:confirm\\w+|confer\\w+|verific\\w+|valid\\w+)\\s+com\\s+(?:o|a)\\s+(?:propriet\\S*|dono|dona|corretor\\w*)|(?:confirm\\w+|confer\\w+|revis\\w+)\\s+antes\\s+de\\s+(?:publicar|postar)`, 'i')
const LABEL = /^[\s\W]*(?:obs\.?|observa[cç][aã]o|p\.?\s?s\.?|nota|aviso|aten[cç][aã]o)\s*[:\-–—]/iu
// "Corretor," / "Atenção corretor:" falando com a pessoa: no começo do bloco ou de uma frase ("Ops! Corretor, …").
const ADDRESS_START = /^[\s\W]*(?:corretor(?:a)?\s*,|aten[cç][aã]o[\s,:!-]*(?:corretor|corretora|dono|dona)\b)/iu
const ADDRESS_MID = /(?:^|[.!?…]\s+)(?:ops|opa|aten[cç][aã]o|oi|olá|ola)?[!.,:\s]*corretor(?:a)?\s*,/iu

const labelNote = (t: string) => LABEL.test(t) && ODD.test(t)
const isStrong = (t: string) => STRONG.some(r => r.test(t)) || ADDRESS_MID.test(t) || labelNote(t)
const isWeak = (t: string) => WEAK.some(r => r.test(t)) || ODD.test(t)

const INTERJECTION = /^[\s\W]*(?:ops|opa|aten[cç][aã]o|oi|ol[aá])[!.,:\s]*$/iu
// Sobra de recado: ordem solta ("Revise.", "Confirme.") que ficou sozinha depois de cortar a frase marcada.
const BARE_ORDER = /^[\s\W]*(?:revise|reveja|confira|confirme|verifique|corrija|valide)[\s!.]*$/iu
const SENTENCE = /(?<=[.!?…])\s+(?=\S)/

/** Tira de `text` os recados internos. `notes` = o que foi tirado (pra avisar o dono). Sem recado → mesmo texto, notes vazio. */
export function stripInternalNotes(text: string): { text: string; notes: string[] } {
  const original = String(text ?? '')
  if (!original.trim()) return { text: original, notes: [] }
  const notes: string[] = []
  const keptParas: string[] = []
  for (const para of original.split(/\n\s*\n/)) {
    const flagged = FLAG.test(para)
    // Bloco inteiro: começa com sinal de alerta ou fala com o corretor, e casa com qualquer regra.
    if ((flagged && (isStrong(para) || isWeak(para))) || ADDRESS_START.test(para)) { notes.push(para.trim()); continue }
    if (!isStrong(para)) { keptParas.push(para); continue }
    // Bloco normal com um trecho marcado: sai só a linha/frase marcada.
    const keptLines: string[] = []
    for (const line of para.split('\n')) {
      if (!isStrong(line)) { keptLines.push(line); continue }
      if ((FLAG.test(line) && (isStrong(line) || isWeak(line))) || ADDRESS_START.test(line)) { notes.push(line.trim()); continue }
      const sentences = line.split(SENTENCE)
      let cut = false
      let keep = sentences.filter(s => { if (isStrong(s)) { notes.push(s.trim()); cut = true; return false } return true })
      if (cut) keep = keep.filter(s => !INTERJECTION.test(s) && !BARE_ORDER.test(s))   // "Ops!" / "Revise." que sobrou do recado
      if (keep.length) keptLines.push(keep.join(' '))
    }
    const rest = keptLines.join('\n').trim()
    if (rest) keptParas.push(rest)
  }
  if (!notes.length) return { text: original, notes: [] }
  return { text: keptParas.join('\n\n').replace(/\n{3,}/g, '\n\n').trim(), notes }
}

/** Texto do aviso pro dono (vai em `reasoning`, junto do aviso do QUERO). null se não saiu nada. */
export function internalNotesNotice(notes: string[]): string | null {
  if (!notes.length) return null
  return INTERNAL_NOTE_PREFIX + notes.map(n => n.replace(/\s+/g, ' ')).join(' | ').slice(0, 500)
}
