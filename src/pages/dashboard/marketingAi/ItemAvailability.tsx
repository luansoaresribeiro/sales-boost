import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useLang } from '../../../contexts/LanguageContext'
import { MUTED, BORDER, D } from './shared'
import { useAvailabilityState } from './useAvailabilityCfg'
import { availabilityOf, statusLabel } from '../../../lib/itemAvailability'

// Fase 4: status de disponibilidade do imóvel no Catálogo (manual). As opções, o que bloqueia e os nomes vêm da ficha do setor.
// Imóvel sem status = "disponível, nunca conferido". Status que bloqueia: o sistema não cria peça nem publica esse imóvel.
const TX = {
  pt: { label: 'Disponibilidade', never: 'Disponível (nunca conferido)', portal: 'conferido no portal', manual: 'marcado por você', blocked: 'Não entra em peças nem é publicado.', err: 'Não foi possível salvar o status.', unverifiable: 'Não foi possível verificar' },
  en: { label: 'Availability', never: 'Available (never checked)', portal: 'checked on the portal', manual: 'set by you', blocked: 'Not used in pieces and not published.', err: 'Could not save the status.', unverifiable: 'Could not verify' },
} as const

interface Meta { availability?: { status?: unknown; source?: unknown; checked_at?: unknown } | null; [k: string]: unknown }

export default function ItemAvailability({ itemId, companyId, verticalKey, meta, onChanged }: { itemId: string; companyId: string; verticalKey: string; meta: Meta | null; onChanged: () => void }) {
  const { lang } = useLang()
  const tx = TX[lang]
  const { cfg, failed } = useAvailabilityState(verticalKey)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  if (failed) return <div role="status" style={{ fontSize: '10px', color: '#FBBF24', margin: '0 0 8px' }}>{tx.unverifiable}</div>
  if (!cfg) return null // carregando, ou ficha sem disponibilidade (nada a mostrar)
  const av = availabilityOf({ meta }, cfg)
  const change = async (status: string) => {
    setBusy(true); setErr('')
    // Relê o meta atual logo antes de gravar e troca SÓ meta.availability (não atropela foto/campo editado há pouco).
    const { data: cur, error: rerr } = await supabase.from('marketing_ai_knowledge').select('meta').eq('id', itemId).eq('company_id', companyId).maybeSingle()
    if (rerr || !cur) { setBusy(false); setErr(tx.err); return }
    const next = { ...((cur.meta ?? {}) as Record<string, unknown>), availability: { status, source: 'manual', checked_at: new Date().toISOString() } }
    const { error } = await supabase.from('marketing_ai_knowledge').update({ meta: next }).eq('id', itemId).eq('company_id', companyId)
    setBusy(false)
    if (error) setErr(tx.err); else onChanged()
  }
  const color = av.blocking ? '#f87171' : '#4ade80'
  return (
    <div style={{ margin: '0 0 8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '10px', color: MUTED, fontWeight: 700, textTransform: 'uppercase' }}>{tx.label}</span>
        <select value={av.never_checked ? '' : av.status ?? ''} disabled={busy} onChange={e => { if (e.target.value) void change(e.target.value) }} aria-label={tx.label}
          style={{ flex: 1, minWidth: 0, background: 'transparent', color, border: `1px solid ${BORDER}`, borderRadius: '6px', fontSize: '11px', fontWeight: 700, padding: '3px 4px', fontFamily: D }}>
          {av.never_checked && <option value="" style={{ color: 'black' }}>{tx.never}</option>}
          {cfg.statuses.map(s => <option key={s} value={s} style={{ color: 'black' }}>{statusLabel(cfg, s, lang)}</option>)}
        </select>
      </div>
      {!av.never_checked && av.source && <div style={{ fontSize: '9.5px', color: MUTED, marginTop: '2px' }}>{av.source === 'portal_feed' ? tx.portal : tx.manual}</div>}
      {av.blocking && <div style={{ fontSize: '10px', color: '#f87171', marginTop: '2px' }}>{tx.blocked}</div>}
      {err && <div role="alert" style={{ fontSize: '10px', color: '#f87171' }}>{err}</div>}
    </div>
  )
}
