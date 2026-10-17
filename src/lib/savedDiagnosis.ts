// Último diagnóstico feito NESTE aparelho (pedido do dono 2026-10-17: fechou o
// celular no meio do carregamento → ao voltar, o diagnóstico continua lá).
// O servidor devolve o id logo no envio e termina a análise sozinho; aqui só
// guardamos o id pra a página /diagnostico oferecer "Ver meu diagnóstico" ou
// "Começar outro". Sem acesso ao armazenamento (aba anônima etc.), não guarda
// e o fluxo segue normal.
const KEY = 'sb_last_diagnosis'
const MAX_AGE_MS = 30 * 24 * 3600 * 1000
const ID_RE = /^[0-9a-f-]{36}$/i

export type SavedDiagnosis = { id: string; at: number }

export function saveDiagnosis(id: string) {
  if (!ID_RE.test(id)) return
  try { localStorage.setItem(KEY, JSON.stringify({ id, at: Date.now() })) } catch { /* sem armazenamento */ }
}

export function loadDiagnosis(): SavedDiagnosis | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as SavedDiagnosis | null
    if (!v || typeof v.id !== 'string' || !ID_RE.test(v.id) || typeof v.at !== 'number') return null
    if (Date.now() - v.at > MAX_AGE_MS) return null
    return v
  } catch { return null }
}
