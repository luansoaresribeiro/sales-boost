// Trava de números na legenda (2026-11-02): todo número — em algarismo OU por extenso em português ("trezentos", "dois mil",
// "quatro quartos") — precisa existir no cadastro do imóvel. Caso real (Tespon): legenda de vídeo "Trezentos metros
// quadrados de apartamento" com m2=7373 → número inventado por extenso, que a trava de algarismos não via.
// As palavras de número são da LÍNGUA (não do setor — regra 6). Função pura, sem Deno/rede: teste em Node (scripts/test-number-guard.mjs).
const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

const UNITS: Record<string, number> = { dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, catorze: 14, quatorze: 14, quinze: 15, dezesseis: 16, dezasseis: 16, dezessete: 17, dezassete: 17, dezoito: 18, dezenove: 19, dezanove: 19 }
const TENS: Record<string, number> = { vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90 }
const HUNDREDS: Record<string, number> = { cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300, trezentas: 300, quatrocentos: 400, quatrocentas: 400, quinhentos: 500, quinhentas: 500, seiscentos: 600, seiscentas: 600, setecentos: 700, setecentas: 700, oitocentos: 800, oitocentas: 800, novecentos: 900, novecentas: 900 }
const SCALES: Record<string, number> = { mil: 1e3, milhao: 1e6, milhoes: 1e6, bilhao: 1e9, bilhoes: 1e9 }
const MULT: Record<string, number> = { mil: 1e3, mi: 1e6, milhao: 1e6, milhoes: 1e6, k: 1e3 }
const isNum = (w: string) => w in UNITS || w in TENS || w in HUNDREDS || w === 'um' || w === 'uma'

/** Valores numéricos de um texto: algarismos ("7.373", "1,5 mi", "850 mil") e números por extenso ("trezentos", "dois mil e quinhentos"). */
export function numberReadings(text: string): number[][] {
  const toks = fold(String(text ?? '')).match(/\d+(?:[.,]\d+)*|[a-z]+/g) ?? []
  const out: number[][] = []
  for (let i = 0; i < toks.length; i++) {
    const w = toks[i]
    if (/^\d/.test(w)) {
      // dois jeitos de ler "1,200" (decimal BR × milhar EN): vale se QUALQUER leitura bate
      let mult = 1
      const nx = toks[i + 1]
      if (nx && MULT[nx]) { mult = MULT[nx]; i++ }
      const br = Number(w.replace(/\./g, '').replace(',', '.')), flat = Number(w.replace(/[.,]/g, ''))
      const reads = [...new Set([br, flat])].filter(Number.isFinite).map(v => v * mult)
      if (reads.length) out.push(reads)
      continue
    }
    if (toks[i - 1] === 'por' && w === 'cento') continue                      // "por cento" = %, não 100
    // "um/uma" sozinho é artigo ("uma sala"): só é número antes de mil/milhão ou dentro de "vinte e um"
    if ((w === 'um' || w === 'uma') && !(toks[i + 1] && SCALES[toks[i + 1]])) continue
    if (w === 'mil' && /^\d/.test(toks[i - 1] ?? '')) continue                 // "850 mil" já foi lido acima
    if (!isNum(w) && !(w in SCALES)) continue
    let total = 0, cur = 0, j = i
    while (j < toks.length) {
      const t = toks[j]
      if (t in HUNDREDS || t in TENS || t in UNITS) cur += HUNDREDS[t] ?? TENS[t] ?? UNITS[t]
      else if (t === 'um' || t === 'uma') cur += 1
      else if (t in SCALES) { total += (cur || 1) * SCALES[t]; cur = 0 }
      else break
      const n1 = toks[j + 1], n2 = toks[j + 2]
      if (n1 && (n1 in SCALES)) { j++; continue }
      if (n1 === 'e' && n2 && (isNum(n2) || n2 in SCALES)) { j += 2; continue }
      break
    }
    out.push([total + cur]); i = j
  }
  return out
}

/** Números permitidos = tudo que o cadastro (campos, título) contém, em algarismo ou por extenso. */
export function allowedValues(factTexts: string[]): Set<number> {
  const s = new Set<number>()
  for (const t of factTexts) for (const reads of numberReadings(t)) for (const v of reads) s.add(v)
  return s
}

/** Números da frase que NÃO estão no cadastro. */
export function unsourcedNumbers(sentence: string, allowed: Set<number>): number[] {
  return [...new Set(numberReadings(sentence).filter(reads => !reads.some(v => allowed.has(v))).map(reads => reads[0]))]
}

export const NUMBER_ISSUE = 'número sem fonte'
