import { useState } from 'react'
import { useLang } from '../../../contexts/LanguageContext'
import { CARD, MUTED, BORDER, D } from './shared'

const ORANGE = '#FF6D29'
const RELEVANCE_META: Record<string, { color: string; pt: string; en: string }> = {
  high: { color: '#f87171', pt: 'Alta', en: 'High' }, medium: { color: '#FBBF24', pt: 'Média', en: 'Medium' }, low: { color: MUTED, pt: 'Baixa', en: 'Low' },
}

export interface Trend { id: string; title: string; description: string | null; category: string | null; relevance: string | null; source: string | null; detected_at: string; status?: string | null; ignored_at?: string | null }

const TX = {
  pt: {
    evidence: 'Ver evidência', hideEvidence: 'Esconder evidência', carousel: '📑 Fazer carrossel desta trend', creating: 'Criando...',
    ignore: 'Ignorar', restore: 'Restaurar',
    origin: 'Origem', date: 'Detectada em', category: 'Categoria', relevance: 'Relevância', desc: 'Descrição completa', link: 'Post de origem',
    scan: 'Lida de posts reais do Instagram na varredura semanal', diag: 'Post em alta no diagnóstico',
    ai: 'Sugestão da IA a partir do seu segmento — raciocínio, sem fonte externa', other: (s: string) => `Origem registrada: ${s}`,
    notSaved: 'Os posts lidos nesta varredura não ficaram guardados.', rel: (r: string) => `${r} relevância`,
  },
  en: {
    evidence: 'See evidence', hideEvidence: 'Hide evidence', carousel: '📑 Make a carousel from this trend', creating: 'Creating...',
    ignore: 'Ignore', restore: 'Restore',
    origin: 'Origin', date: 'Detected on', category: 'Category', relevance: 'Relevance', desc: 'Full description', link: 'Source post',
    scan: 'Read from real Instagram posts in the weekly scan', diag: 'Trending post in the diagnostic',
    ai: 'AI suggestion based on your segment — reasoning, no external source', other: (s: string) => `Recorded origin: ${s}`,
    notSaved: 'The posts read in this scan were not saved.', rel: (r: string) => `${r} relevance`,
  },
} as const

const fmtDate = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR') }

/** Link do post só se a descrição trouxer um http(s) válido (o diagnóstico grava "… — <url>"). */
export function linkFromDescription(desc: string | null): string | null {
  const m = desc?.match(/https?:\/\/[^\s]+/)
  if (!m) return null
  try { const u = new URL(m[0]); return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null } catch { return null }
}

// Card de tendência do Trend Agent (Pacote B2, item 10). "Ver evidência" é a ação principal: mostra só o que existe de
// verdade na linha (origem, data, categoria, relevância, descrição) — nunca inventa fonte. "Fazer carrossel" é secundária
// (mesma ação de antes) e "Ignorar" é a terciária (sai das sugestões ativas; a evidência fica guardada).
export default function TrendCard({ t, onDeck, busy, onIgnore, onRestore, locked }: {
  t: Trend; onDeck?: () => void; busy?: boolean; onIgnore?: () => void; onRestore?: () => void; locked?: boolean
}) {
  const en = useLang().lang === 'en'
  const tx = TX[en ? 'en' : 'pt']
  const [open, setOpen] = useState(false)
  const rel = RELEVANCE_META[t.relevance ?? 'medium'] ?? RELEVANCE_META.medium
  const relLabel = tx.rel(en ? rel.en : rel.pt)
  const link = t.source === 'diagnostico' ? linkFromDescription(t.description) : null
  const origin = t.source === 'instagram_scan' ? tx.scan : t.source === 'diagnostico' ? tx.diag : !t.source ? tx.ai : tx.other(t.source)
  const small = { padding: '6px 10px', borderRadius: '7px', fontWeight: 700, fontSize: '10.5px', fontFamily: D } as const
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '11px', padding: '12px 14px', opacity: t.status === 'ignored' ? 0.85 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '5px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'white' }}>🔥 {t.title}</span>
        {t.category && <span style={{ fontSize: '8.5px', fontWeight: 700, color: MUTED, border: `1px solid ${BORDER}`, borderRadius: '99px', padding: '1px 7px' }}>{t.category}</span>}
        <span style={{ fontSize: '9px', fontWeight: 700, color: rel.color, marginLeft: 'auto' }}>{relLabel}</span>
      </div>
      {t.description && !open && <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.5 }}>{t.description}</div>}
      {open && (
        <dl style={{ margin: '4px 0 0', fontSize: '11px', lineHeight: 1.55, color: MUTED }}>
          <div><dt style={{ display: 'inline', color: 'white', fontWeight: 700 }}>{tx.origin}: </dt><dd style={{ display: 'inline', margin: 0 }}>{origin}</dd></div>
          {link && <div><dt style={{ display: 'inline', color: 'white', fontWeight: 700 }}>{tx.link}: </dt><dd style={{ display: 'inline', margin: 0, overflowWrap: 'anywhere' }}><a href={link} target="_blank" rel="noopener noreferrer" style={{ color: ORANGE }}>{link}</a></dd></div>}
          {fmtDate(t.detected_at) && <div><dt style={{ display: 'inline', color: 'white', fontWeight: 700 }}>{tx.date}: </dt><dd style={{ display: 'inline', margin: 0 }}>{fmtDate(t.detected_at)}</dd></div>}
          {t.category && <div><dt style={{ display: 'inline', color: 'white', fontWeight: 700 }}>{tx.category}: </dt><dd style={{ display: 'inline', margin: 0 }}>{t.category}</dd></div>}
          {t.relevance && <div><dt style={{ display: 'inline', color: 'white', fontWeight: 700 }}>{tx.relevance}: </dt><dd style={{ display: 'inline', margin: 0 }}>{en ? rel.en : rel.pt}</dd></div>}
          {t.description && <div style={{ marginTop: '4px' }}><dt style={{ color: 'white', fontWeight: 700 }}>{tx.desc}</dt><dd style={{ margin: 0, overflowWrap: 'anywhere' }}>{t.description}</dd></div>}
          {t.source === 'instagram_scan' && <div style={{ marginTop: '4px', fontStyle: 'italic' }}>{tx.notSaved}</div>}
        </dl>
      )}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
        <button onClick={() => setOpen(o => !o)} aria-expanded={open}
          style={{ ...small, background: ORANGE, border: 'none', color: '#000', cursor: 'pointer' }}>{open ? tx.hideEvidence : tx.evidence}</button>
        {onDeck && (
          <button onClick={onDeck} disabled={busy} style={{ ...small, background: 'rgba(255,109,41,0.12)', border: '1px solid rgba(255,109,41,0.35)', color: ORANGE, cursor: busy ? 'default' : 'pointer' }}>
            {busy ? tx.creating : tx.carousel}
          </button>
        )}
        {onIgnore && <button onClick={onIgnore} style={{ ...small, background: 'transparent', border: `1px solid ${BORDER}`, color: MUTED, cursor: 'pointer', marginLeft: 'auto' }}>{locked ? '🔒 ' : ''}{tx.ignore}</button>}
        {onRestore && <button onClick={onRestore} style={{ ...small, background: 'transparent', border: `1px solid ${BORDER}`, color: MUTED, cursor: 'pointer', marginLeft: 'auto' }}>{locked ? '🔒 ' : ''}{tx.restore}</button>}
      </div>
    </div>
  )
}
