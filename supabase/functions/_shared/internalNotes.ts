// Legenda NUNCA fala com o corretor (2026-10-23). A IA às vezes escreve, dentro da legenda, um recado
// pro corretor ("⚠️ Sobre a metragem: os dados que recebi precisam de confirmação antes de publicar…").
// Isso é nota interna: não pode ir pro Instagram. `stripInternalNotes` tira esse trecho do texto e
// devolve o que tirou (pra virar aviso pro dono em `reasoning`). Função PURA (sem Deno/rede): roda
// no Deno e no teste em Node.
//
// Regras (cuidado com falso positivo — NUNCA tirar só por "corretor" nem só por ⚠️):
//  - FORTES (qualquer uma marca): "dados que recebi/informados" + precisa/confirm/revis; "precisa(m) de
//    confirmação/revisão/conferência"; "ser confirmad/revisad/conferid…"; "antes de publicar"; "nota/aviso/
//    obs interna"; "para o corretor/dono"; fala dirigida ("Corretor," no começo de um trecho); pedido de
//    dado ao corretor ("me passe/envie/confirme" ou "pode me passar/confirmar" + metragem/preço/dado…).
//  - FRACAS (só valem quando o bloco COMEÇA com ⚠/🚨/❗): "sobre a metragem/preço/área/endereço:",
//    "inconsistência", "parece erro", "valor estranho", "não bate", "verifique".
//  - Bloco que começa com ⚠/🚨/❗ ou "Corretor," e casa com qualquer regra: sai INTEIRO.
//    Bloco normal: só a linha/frase marcada sai, o resto da legenda fica.
//  - "Fale com o corretor João", "⚠️ Últimas unidades", "Me chama no direct", "Me passa seu contato" passam.

export const INTERNAL_NOTE_PREFIX = 'Recado da IA que saiu da legenda: '
export const EMPTY_CAPTION_NOTICE = 'A legenda não saiu (a IA só escreveu um recado pro corretor, que foi retirado) — gere de novo.'

const FLAG = /^[\s‍️]*(?:⚠|🚨|❗)/u
const NEEDS = /precis\w*|confirm\w*|revis\w*|confer\w*/i
const DATA_NOUN = '(?:metragem|[aá]rea|pre[cç]o|valor(?:es)?|dados?|informa[cç][a-zãõç]+|medidas?|n[uú]mero|endere[cç]o|condom[ií]nio|iptu|quartos?|vagas?)'
const STRONG: RegExp[] = [
  /precisa(?:m)?\s+(?:de\s+)?(?:confirma|revis|confer)\w*/i,
  /\bser\s+(?:confirmad|revisad|conferid)\w*/i,
  /antes\s+de\s+publicar/i,
  /\b(?:nota|aviso|obs\.?|observa[cç][aã]o)\s+interna\b/i,
  /\bpara\s+(?:o|a)\s+(?:corretor|corretora|dono|dona)\b/i,
  new RegExp(`\\bme\\s+(?:passe|passa|passar|envie|envia|enviar|confirme|confirma|confirmar)\\b[^.!?\\n]{0,40}?\\b${DATA_NOUN}\\b`, 'i'),
  new RegExp(`\\bpode\\s+me\\s+(?:passar|confirmar|enviar)\\b[^.!?\\n]{0,40}?\\b${DATA_NOUN}\\b`, 'i'),
]
const WEAK: RegExp[] = [
  /sobre\s+(?:a|o)\s+(?:metragem|pre[cç]o|[aá]rea|endere[cç]o|valor)\s*:/i,
  /inconsist[eê]ncia/i,
  /parece\s+(?:um\s+)?erro/i,
  /valor\s+estranho/i,
  /n[aã]o\s+bate/i,
  /verifique/i,
]
// "Corretor," / "Corretora," falando com a pessoa: no começo do bloco ou no começo de uma frase ("Ops! Corretor, …").
const ADDRESS_START = /^[\s\W]*corretor(?:a)?\s*,/iu
const ADDRESS_MID = /(?:^|[.!?…]\s+)(?:ops|opa|aten[cç][aã]o|oi|olá|ola)?[!.,:\s]*corretor(?:a)?\s*,/iu

const dadosRecebidos = (t: string) => /dados?\s+(?:que\s+(?:eu\s+)?recebi|informados|fornecidos|enviados|passados|cadastrados)/i.test(t) && NEEDS.test(t)
const isStrong = (t: string) => dadosRecebidos(t) || STRONG.some(r => r.test(t)) || ADDRESS_MID.test(t)
const isWeak = (t: string) => WEAK.some(r => r.test(t))

const INTERJECTION = /^[\s\W]*(?:ops|opa|aten[cç][aã]o|oi|ol[aá])[!.,:\s]*$/iu
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
      if (cut) keep = keep.filter(s => !INTERJECTION.test(s))   // "Ops!" que sobrou do recado
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
