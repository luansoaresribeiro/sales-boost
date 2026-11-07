import { useEffect, type CSSProperties } from 'react'
import type { Lang } from '../../../../contexts/LanguageContext'
import { MUTED, BORDER, D } from '../shared'
import { MODULES, BADGES } from '../agentModules'
import { maturityLabel, STATION_KEYS, type StationInfo, type StationKey } from './factoryState'
import { POSE_COLOR, robotView, type RobotPose } from './robotState'

// Peças 2D da fábrica: o conteúdo de uma estação (estado do robô, números reais, selo, último evento, "Abrir"), o painel que aparece ao tocar
// numa estação do 3D (lateral no computador, de baixo no celular) e a VERSÃO LEVE (as 5 estações em 2D com o MESMO conteúdo do painel).
// Nenhuma importação de three aqui — carrega junto da página.
const ORANGE = '#FF6D29'
const TX = {
  pt: { open: 'Abrir', last: 'Último evento', upd: 'Atualizado às', maturity: 'Maturidade', close: 'Fechar painel', liteTitle: 'Fábrica (versão leve)', robot: 'Robô' },
  en: { open: 'Open', last: 'Last event', upd: 'Updated at', maturity: 'Maturity', close: 'Close panel', liteTitle: 'Factory (light version)', robot: 'Robot' },
} as const

// Bolinha do estado do robô. Forma diferente por pose (não só cor): cheia = trabalhando, anel = esperando você, clara = descansando,
// vermelha = problema, cinza tracejada = desligado.
export function PoseDot({ pose, size = 11 }: { pose: RobotPose; size?: number }) {
  const c = POSE_COLOR[pose]
  const st: CSSProperties = { display: 'inline-block', width: size, height: size, borderRadius: '50%', flexShrink: 0, boxSizing: 'border-box' }
  if (pose === 'working') return <span style={{ ...st, background: c, boxShadow: `0 0 0 3px ${c}33, 0 0 10px ${c}` }} />
  if (pose === 'waiting') return <span style={{ ...st, border: `2px solid ${c}`, background: `${c}22` }} />
  if (pose === 'problem') return <span style={{ ...st, background: c }} />
  if (pose === 'off') return <span style={{ ...st, border: `2px dashed ${c}`, background: 'transparent' }} />
  return <span style={{ ...st, background: c, opacity: 0.85 }} />
}

// Conteúdo da estação (usado no painel do 3D e nos cartões da versão leve — mesma fonte, nunca diverge).
export function StationDetails({ lang, info, onOpen }: { lang: Lang; info: StationInfo; onOpen: (k: StationKey) => void }) {
  const t = TX[lang]
  const m = MODULES[lang][info.key]
  const n = STATION_KEYS.indexOf(info.key) + 1
  const rv = robotView(info, lang)
  return (
    <>
      <div style={{ fontSize: '10.5px', fontWeight: 800, color: MUTED, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{BADGES[lang][info.key]}</div>
      <div style={{ fontSize: '17px', fontWeight: 800, color: 'white', margin: '4px 0 10px' }}>{n} · {m.title}</div>
      <div data-robot-pose={rv.pose} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', fontWeight: 800, color: 'white' }}>
        <PoseDot pose={rv.pose} />{rv.label}{info.approvals > 0 && <span style={{ color: ORANGE }}>({info.approvals})</span>}
      </div>
      {(info.stateLabel !== rv.label || rv.delayed) && <div style={{ fontSize: '11.5px', color: MUTED, margin: '3px 0 0 19px' }}>{info.stateLabel}{rv.delayed ? ' ⏱' : ''}</div>}
      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', margin: '8px 0 10px', lineHeight: 1.45 }}>{info.headline}</div>
      <div style={{ display: 'inline-block', fontSize: '10px', fontWeight: 800, padding: '3px 9px', borderRadius: '99px', border: `1px solid ${BORDER}`, color: MUTED, letterSpacing: '0.04em' }}>{t.maturity}: {maturityLabel(info.maturity, lang)}</div>
      <dl style={{ margin: '12px 0', display: 'grid', gridTemplateColumns: '1fr auto', gap: '5px 12px', fontSize: '12px' }}>
        {info.facts.map(f => <div key={f.label} style={{ display: 'contents' }}><dt style={{ color: MUTED }}>{f.label}</dt><dd style={{ margin: 0, color: 'white', fontWeight: 700, textAlign: 'right' }}>{f.value}</dd></div>)}
      </dl>
      <div style={{ fontSize: '12px', color: MUTED, lineHeight: 1.45 }}><strong style={{ color: 'rgba(255,255,255,0.7)' }}>{t.last}:</strong> {info.lastEvent}</div>
      <div style={{ fontSize: '11px', color: MUTED, margin: '4px 0 12px' }}>{t.upd} {info.updatedAt}</div>
      <button onClick={() => onOpen(info.key)} style={{ width: '100%', padding: '10px', borderRadius: '10px', background: 'rgba(255,109,41,0.14)', border: '1px solid rgba(255,109,41,0.4)', color: ORANGE, fontFamily: D, fontWeight: 800, fontSize: '13px', cursor: 'pointer' }}>{t.open} →</button>
    </>
  )
}

// Painel contextual da estação tocada no 3D. Computador: lateral (por cima da cena, à direita). Celular: sobe de baixo (folha). Esc fecha.
export function StationPanel({ lang, info, onOpen, onClose, sheet }: { lang: Lang; info: StationInfo; onOpen: (k: StationKey) => void; onClose: () => void; sheet: boolean }) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [onClose])
  const base: CSSProperties = { boxSizing: 'border-box', background: '#150E08', border: `1px solid ${BORDER}`, padding: '16px', fontFamily: D, overflowY: 'auto', zIndex: 6 }
  const pos: CSSProperties = sheet
    ? { position: 'fixed', left: 0, right: 0, bottom: 0, maxHeight: '46vh', paddingBottom: '76px', borderRadius: '18px 18px 0 0', animation: 'sbSheetUp 0.28s ease-out', zIndex: 60 }
    : { position: 'absolute', top: '12px', right: '12px', bottom: '12px', width: '300px', borderRadius: '14px', animation: 'sbPanelIn 0.22s ease-out' }
  return (
    <aside role="dialog" aria-label={MODULES[lang][info.key].title} aria-live="polite" style={{ ...base, ...pos }} onPointerDown={e => e.stopPropagation()}>
      <button onClick={onClose} aria-label={TX[lang].close} style={{ position: 'absolute', top: '8px', right: '10px', background: 'transparent', border: 'none', color: MUTED, fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}>×</button>
      <StationDetails lang={lang} info={info} onOpen={onOpen} />
    </aside>
  )
}

// Versão leve (sem 3D): as 5 estações em 2D com o mesmo conteúdo do painel do 3D. Plenamente funcional, não é uma versão capada.
export function Factory2D({ lang, stations, selected, onOpen }: { lang: Lang; stations: Record<StationKey, StationInfo>; selected: StationKey | null; onOpen: (k: StationKey) => void }) {
  return (
    <div role="group" aria-label={TX[lang].liteTitle} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '12px' }}>
      {STATION_KEYS.map(k => {
        const sel = selected === k
        return (
          <section key={k} id={`lite-station-${k}`} aria-current={sel || undefined}
            style={{ boxSizing: 'border-box', fontFamily: D, padding: '16px', borderRadius: '14px', background: sel ? 'rgba(255,255,255,0.06)' : '#150E08', border: `1px solid ${sel ? 'rgba(255,255,255,0.45)' : BORDER}`, color: 'white' }}>
            <StationDetails lang={lang} info={stations[k]} onOpen={onOpen} />
          </section>
        )
      })}
    </div>
  )
}
