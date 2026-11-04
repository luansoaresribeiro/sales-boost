import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLang } from '../../../contexts/LanguageContext'
import { CARD, MUTED, BORDER, D, STATUS_META } from './shared'
import { STAGE_ORDER } from './salesDemo'
import { mapStage } from './salesReal'
import { STAGE_EN } from './labels.i18n'
import { useItemActivity, type Block, type PieceTest } from './useItemActivity'
import CalendarPostModal from './CalendarPostModal'
import { useItemUsage } from './useItemUsage'
import { useAvailabilityCfg } from './useAvailabilityCfg'
import { useCompany } from '../../../contexts/CompanyContext'
import { availabilityOf, statusLabel } from '../../../lib/itemAvailability'

// "Atividade do imóvel" (Pacote B1): peças, oportunidades e leads ligados a um imóvel, só leitura.
// Só consulta ao abrir. A página pública continua no botão "Página pública" do card.
// Não mostra "peça de origem" de lead: o link da página pública é único por imóvel/oportunidade/canal e não identifica uma peça (docs/ARCHITECTURE.md).

const TX = {
  pt: {
    open: '📊 Ver atividade', close: 'Ocultar atividade', title: 'Atividade deste imóvel', availability: 'Disponibilidade', neverChecked: 'disponível (nunca conferido)', loading: 'Carregando…', error: 'Não foi possível verificar',
    pieces: 'Peças', noPieces: 'Nenhuma peça relacionada', opps: 'Oportunidades', noOpps: 'Nenhuma oportunidade ligada', leads: 'Leads', noLeads: 'Nenhum lead ligado',
    seeOpps: 'Ver em Oportunidades', capped: (n: number) => `Mostrando as ${n} mais recentes.`, noIdea: 'Peça sem título', publishing: 'Publicando', noName: 'Lead sem nome',
    postSt: { aprovado: 'Aprovada', approved: 'Aprovada', agendado: 'Agendada', scheduled: 'Agendada', publicado: 'Publicada', published: 'Publicada', rascunho: 'Rascunho', draft: 'Rascunho' } as Record<string, string>,
    oppSt: { suggested: 'Aguardando avaliação', approved: 'Aprovada', dismissed: 'Descartada' } as Record<string, string>,
  },
  en: {
    open: '📊 See activity', close: 'Hide activity', title: 'Activity for this listing', availability: 'Availability', neverChecked: 'available (never checked)', loading: 'Loading…', error: 'Could not verify',
    pieces: 'Pieces', noPieces: 'No related pieces', opps: 'Opportunities', noOpps: 'No linked opportunities', leads: 'Leads', noLeads: 'No linked leads',
    seeOpps: 'See in Opportunities', capped: (n: number) => `Showing the ${n} most recent.`, noIdea: 'Untitled piece', publishing: 'Publishing', noName: 'Unnamed lead',
    postSt: { aprovado: 'Approved', approved: 'Approved', agendado: 'Scheduled', scheduled: 'Scheduled', publicado: 'Published', published: 'Published', rascunho: 'Draft', draft: 'Draft' } as Record<string, string>,
    oppSt: { suggested: 'Awaiting review', approved: 'Approved', dismissed: 'Dismissed' } as Record<string, string>,
  },
} as const

const fmtDay = (iso: string | null | undefined, lang: 'pt' | 'en') => (iso ? new Date(iso).toLocaleDateString(lang === 'en' ? 'en-US' : 'pt-BR', { day: '2-digit', month: '2-digit' }) : '')
const btn: React.CSSProperties = { width: '100%', padding: '7px 10px', marginTop: '6px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '7px', color: 'white', fontWeight: 700, fontSize: '11px', cursor: 'pointer', fontFamily: D }
const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '10.5px', color: 'white', lineHeight: 1.45, padding: '3px 0' }

function Section<T>({ title, block, empty, loadingTx, errorTx, capped, render }: {
  title: string; block: Block<T>; empty: string; loadingTx: string; errorTx: string; capped: (n: number) => string; render: (r: T) => React.ReactNode
}) {
  return (
    <div style={{ marginTop: '8px' }}>
      <div style={{ fontSize: '10px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</div>
      {block.state === 'loading' ? <div style={{ fontSize: '10.5px', color: MUTED }}>{loadingTx}</div>
        : block.state === 'error' ? <div role="status" style={{ fontSize: '10.5px', color: '#FBBF24' }}>{errorTx}</div>
        : block.rows.length === 0 ? <div style={{ fontSize: '10.5px', color: MUTED }}>{empty}</div>
        : <>{block.rows.map(render)}{block.capped && <div style={{ fontSize: '10px', color: MUTED }}>{capped(block.rows.length)}</div>}</>}
    </div>
  )
}

export default function ItemActivity({ itemId, companyId }: { itemId: string; companyId: string }) {
  const { lang } = useLang()
  const tx = TX[lang]
  const [open, setOpen] = useState(false)
  const [piece, setPiece] = useState<PieceTest | null>(null)
  const d = useItemActivity(companyId, itemId, open)
  // Fase 4: status de disponibilidade (ficha). Sem ficha/consulta falhou: não mostra nada (nunca afirma "disponível" sem saber).
  const { company } = useCompany()
  const availCfg = useAvailabilityCfg(company?.vertical_key)
  const usage = useItemUsage(companyId)
  const info = usage.data.ok ? usage.data.items[itemId] : undefined
  const av = availCfg && info ? availabilityOf({ meta: { availability: info.availability } }, availCfg) : null
  const common = { loadingTx: tx.loading, errorTx: tx.error, capped: tx.capped }
  // Peças: as duas fontes numa lista só (uma peça aprovada deixa de existir em teste e passa a existir em posts — sem repetição).
  const pieces: Block<{ key: string; at: string; label: string; stLabel: string; color: string; test?: PieceTest }> =
    d.tests.state === 'loading' || d.posts.state === 'loading' ? { state: 'loading' }
      : d.tests.state === 'error' || d.posts.state === 'error' ? { state: 'error' }
      : {
        state: 'ok', capped: d.tests.capped || d.posts.capped,
        rows: [
          ...d.tests.rows.map(t => { const sm = STATUS_META[t.status] ?? { label: t.status === 'publishing' ? tx.publishing : t.status, color: MUTED }; return { key: `t-${t.id}`, at: t.planned_for ?? t.created_at, label: t.idea || tx.noIdea, stLabel: sm.label, color: sm.color, test: t } }),
          ...d.posts.rows.map(p => ({ key: `p-${p.id}`, at: p.published_at ?? p.created_at, label: (p.content ?? '').slice(0, 60) || tx.noIdea, stLabel: tx.postSt[p.status] ?? p.status, color: MUTED })),
        ].sort((a, b) => (a.at < b.at ? 1 : -1)),
      }
  return (
    <div style={{ marginTop: '6px' }}>
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} style={btn}>{open ? tx.close : tx.open}</button>
      {open && (
        <div style={{ marginTop: '8px', padding: '8px 10px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '8px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'white' }}>{tx.title}</div>
          {av && <div style={{ fontSize: '10.5px', color: av.blocking ? '#f87171' : MUTED, marginTop: '2px' }}>{tx.availability}: {av.never_checked ? tx.neverChecked : statusLabel(availCfg ?? null, av.status, lang)}</div>}
          <Section title={tx.pieces} block={pieces} empty={tx.noPieces} {...common} render={p => (
            <div key={p.key} style={row}>
              {p.test
                ? <button onClick={() => setPiece(p.test as PieceTest)} style={{ background: 'none', border: 'none', padding: 0, color: 'white', textDecoration: 'underline', cursor: 'pointer', textAlign: 'left', fontSize: '10.5px', fontFamily: D, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.label}</button>
                : <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.label}</span>}
              <span style={{ color: p.color, flexShrink: 0 }}>{fmtDay(p.at, lang)} · {p.stLabel}</span>
            </div>
          )} />
          <Section title={tx.opps} block={d.opps} empty={tx.noOpps} {...common} render={o => (
            <div key={o.id} style={row}>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.title}</span>
              <span style={{ color: MUTED, flexShrink: 0 }}>{tx.oppSt[o.status] ?? o.status}</span>
            </div>
          )} />
          {d.opps.state === 'ok' && d.opps.rows.length > 0 && <Link to="/dashboard/opportunities" style={{ fontSize: '10.5px', color: '#FF6D29' }}>{tx.seeOpps}</Link>}
          <Section title={tx.leads} block={d.leads} empty={tx.noLeads} {...common} render={l => {
            const sk = mapStage(l.stage)
            const stage = lang === 'en' ? STAGE_EN[sk] : STAGE_ORDER.find(s => s.key === sk)?.label
            return (
              <div key={l.id} style={row}>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name || l.contact || tx.noName}</span>
                <span style={{ color: MUTED, flexShrink: 0 }}>{stage} · {fmtDay(l.created_at, lang)}</span>
              </div>
            )
          }} />
        </div>
      )}
      {piece && <CalendarPostModal post={piece} companyId={companyId} onClose={() => setPiece(null)} onChanged={() => setPiece(null)} />}
    </div>
  )
}
