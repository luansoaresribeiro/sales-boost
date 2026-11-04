import type { MarketChangesState } from './useMarketChanges'
import { changesText, describeChanges, demoChanges, ignoredLine } from './marketChanges'
import { MUTED, BORDER, ORANGE } from './shared'

// Bloco "O que mudou" (Fase 2) no topo do feed de Mercado. Sem tela nova. Demo: etiqueta "exemplo". onShowIgnored abre o bloco Ignorados (onde fica o Restaurar).
export default function MarketChanges({ lang, state, demo = false, onShowIgnored }: { lang: 'pt' | 'en'; state: MarketChangesState; demo?: boolean; onShowIgnored?: () => void }) {
  const t = changesText(lang)
  const d = demo ? demoChanges() : null
  const body = d ? { changes: d.changes, systemIgnored: d.systemIgnored as number | null } : state.status === 'ready' ? state : null
  const showIgnored = !!body || state.status === 'empty'
  const nIgnored: number | null = body ? body.systemIgnored : state.status === 'empty' ? state.systemIgnored : null
  return (
    <div role="status" style={{ border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '10px 12px', margin: '0 0 12px', fontSize: '12.5px', lineHeight: 1.55 }}>
      <div style={{ color: 'white', fontWeight: 700, marginBottom: '4px' }}>
        {t.title}
        {demo && <span style={{ marginLeft: '8px', fontSize: '9.5px', fontWeight: 800, color: '#FBBF24', border: '1px solid rgba(251,191,36,0.35)', borderRadius: '99px', padding: '2px 8px', textTransform: 'uppercase' }}>{t.example}</span>}
      </div>
      {!body && state.status === 'loading' && <div style={{ color: MUTED }}>{t.loading}</div>}
      {!body && state.status === 'error' && <div style={{ color: '#FBBF24' }}>{t.error}</div>}
      {!body && state.status === 'empty' && <div style={{ color: MUTED }}>{t.empty}</div>}
      {body && describeChanges(body.changes, lang).map(l => <div key={l} style={{ color: 'rgba(255,255,255,0.8)' }}>{l}</div>)}
      {showIgnored && (
        <div style={{ color: 'rgba(255,255,255,0.8)' }}>
          {ignoredLine(nIgnored, lang)}
          {nIgnored != null && nIgnored > 0 && onShowIgnored && <>{' — '}<button type="button" onClick={onShowIgnored} style={{ background: 'none', border: 'none', padding: 0, color: ORANGE, cursor: 'pointer', fontSize: '12.5px' }}>{t.seeIgnored}</button></>}
        </div>
      )}
    </div>
  )
}
