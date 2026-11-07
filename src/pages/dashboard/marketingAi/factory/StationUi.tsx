import type { Lang } from '../../../../contexts/LanguageContext'
import { MUTED, BORDER, D } from '../shared'
import { MODULES, BADGES } from '../agentModules'
import { maturityLabel, STATION_KEYS, type StateKind, type StationInfo, type StationKey } from './factoryState'

// Peças 2D da fábrica: painel lateral da estação selecionada (também usado com o 3D desligado) e a "versão simples"
// (as 5 estações em fila, sem three.js). Nenhuma importação de three aqui — carrega junto da página.
const ORANGE = '#FF6D29'
export const KIND_COLOR: Record<StateKind, string> = {
  unknown: '#6b6560', unavailable: '#4a4642', standby: '#8a7f75', approval: ORANGE, processing: ORANGE, scheduled: '#d9884f', queued: ORANGE, late: '#ff8a4d', recent: '#e8e2d8', failed: '#c0392b',
}
const TX = {
  pt: { open: 'Abrir', state: 'Estado', last: 'Último evento', upd: 'Atualizado às', hint: 'Clique numa estação para ver o estado e abrir a tela dela.', simpleTitle: 'Fábrica (versão simples)', maturity: 'Maturidade' },
  en: { open: 'Open', state: 'State', last: 'Last event', upd: 'Updated at', hint: 'Click a station to see its state and open its screen.', simpleTitle: 'Factory (simple version)', maturity: 'Maturity' },
} as const

export function Dot({ kind, size = 11 }: { kind: StateKind; size?: number }) {
  return <span style={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', flexShrink: 0, background: KIND_COLOR[kind], boxShadow: kind === 'failed' ? 'none' : `0 0 0 3px ${KIND_COLOR[kind]}22` }} />
}

export function StationPanel({ lang, info, onOpen }: { lang: Lang; info: StationInfo | null; onOpen: (k: StationKey) => void }) {
  const t = TX[lang]
  const box = { width: '100%', boxSizing: 'border-box' as const, background: '#150E08', border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '16px', fontFamily: D }
  if (!info) return <aside style={{ ...box, color: MUTED, fontSize: '13px', lineHeight: 1.5 }}>{t.hint}</aside>
  const m = MODULES[lang][info.key]
  const n = STATION_KEYS.indexOf(info.key) + 1
  return (
    <aside style={box} aria-live="polite">
      <div style={{ fontSize: '10.5px', fontWeight: 800, color: MUTED, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{BADGES[lang][info.key]}</div>
      <div style={{ fontSize: '17px', fontWeight: 800, color: 'white', margin: '4px 0 10px' }}>{n} · {m.title}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, color: 'white' }}><Dot kind={info.kind} />{info.stateLabel}{info.approvals > 0 && <span style={{ color: ORANGE }}>({info.approvals})</span>}</div>
      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', margin: '6px 0 10px', lineHeight: 1.45 }}>{info.headline}</div>
      <div style={{ display: 'inline-block', fontSize: '10px', fontWeight: 800, padding: '3px 9px', borderRadius: '99px', border: `1px solid ${BORDER}`, color: MUTED, letterSpacing: '0.04em' }}>{t.maturity}: {maturityLabel(info.maturity, lang)}</div>
      <dl style={{ margin: '12px 0', display: 'grid', gridTemplateColumns: '1fr auto', gap: '5px 12px', fontSize: '12px' }}>
        {info.facts.map(f => <div key={f.label} style={{ display: 'contents' }}><dt style={{ color: MUTED }}>{f.label}</dt><dd style={{ margin: 0, color: 'white', fontWeight: 700, textAlign: 'right' }}>{f.value}</dd></div>)}
      </dl>
      <div style={{ fontSize: '12px', color: MUTED, lineHeight: 1.45 }}><strong style={{ color: 'rgba(255,255,255,0.7)' }}>{t.last}:</strong> {info.lastEvent}</div>
      <div style={{ fontSize: '11px', color: MUTED, margin: '4px 0 12px' }}>{t.upd} {info.updatedAt}</div>
      <button onClick={() => onOpen(info.key)} style={{ width: '100%', padding: '10px', borderRadius: '10px', background: 'rgba(255,109,41,0.14)', border: '1px solid rgba(255,109,41,0.4)', color: ORANGE, fontFamily: D, fontWeight: 800, fontSize: '13px', cursor: 'pointer' }}>{t.open} →</button>
    </aside>
  )
}

// Versão simples (sem 3D): as 5 estações em fila com a luz de estado, o número, o nome e o selo.
export function Factory2D({ lang, stations, selected, onSelect }: { lang: Lang; stations: Record<StationKey, StationInfo>; selected: StationKey | null; onSelect: (k: StationKey) => void }) {
  return (
    <div role="group" aria-label={TX[lang].simpleTitle} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', padding: '4px 0' }}>
      {STATION_KEYS.map((k, i) => {
        const s = stations[k], sel = selected === k
        return (
          <button key={k} onClick={() => onSelect(k)} aria-pressed={sel}
            style={{ textAlign: 'left', cursor: 'pointer', fontFamily: D, padding: '12px 14px', borderRadius: '12px', background: sel ? 'rgba(255,255,255,0.07)' : '#150E08', border: `1px solid ${sel ? 'rgba(255,255,255,0.4)' : BORDER}`, color: 'white' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}><Dot kind={s.kind} /><span style={{ fontSize: '11px', fontWeight: 800, color: MUTED }}>{i + 1}{i < 4 ? ' →' : ' ↺'}</span></div>
            <div style={{ fontSize: '13px', fontWeight: 800 }}>{MODULES[lang][k].title}</div>
            <div style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.65)', marginTop: '3px' }}>{s.stateLabel}{s.approvals > 0 ? ` (${s.approvals})` : ''}</div>
            <div style={{ fontSize: '10.5px', color: MUTED, marginTop: '3px' }}>{maturityLabel(s.maturity, lang)}</div>
          </button>
        )
      })}
    </div>
  )
}
