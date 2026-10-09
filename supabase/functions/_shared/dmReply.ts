// Mensagem pronta do "Comente QUERO" (decisão do dono 2026-10-09, opção B):
// o modelo vem da ficha do setor (vertical_playbooks.config.dm_reply.template,
// regra 6) e é preenchido SÓ com os dados cadastrados do imóvel (regra 5).
// Linha cujo dado não foi cadastrado some inteira — nunca sai "{preco}" nem
// número inventado. O dono revisa/edita e aprova uma vez por imóvel.

export interface DmReplyConfig { keyword?: string; template?: string }

export const DEFAULT_DM_KEYWORD = 'QUERO'
const DEFAULT_TEMPLATE = 'Oi! Que bom que você gostou 😊\n\nQuer saber mais e conhecer pessoalmente? Me diz o melhor dia e horário que eu agendo sua visita 🙂'

function fmt(v: unknown): string {
  if (typeof v === 'number') return v.toLocaleString('pt-BR')
  const s = String(v).trim()
  return /^\d+(\.\d+)?$/.test(s) && Number(s) >= 1000 ? Number(s).toLocaleString('pt-BR') : s
}

export function fillTemplate(template: string, fields: Record<string, unknown>): string {
  return template.split('\n').map(line => {
    let missing = false
    const out = line.replace(/\{(\w+)\}/g, (_, k: string) => {
      const v = fields[k]
      if (v === undefined || v === null || String(v).trim() === '') { missing = true; return '' }
      return fmt(v)
    })
    return missing ? null : out
  }).filter((l): l is string => l !== null).join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function draftReply(cfg: DmReplyConfig | undefined, fields: Record<string, unknown>): { keyword: string; message: string } {
  return { keyword: (cfg?.keyword || DEFAULT_DM_KEYWORD).toUpperCase(), message: fillTemplate(cfg?.template || DEFAULT_TEMPLATE, fields) }
}
