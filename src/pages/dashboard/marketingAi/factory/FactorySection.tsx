import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Lang } from '../../../../contexts/LanguageContext'
import { MUTED, BORDER } from '../shared'
import { Factory2D, StationPanel } from './StationUi'
import { CurtainFront, CLOSED_H, FACTORY_CSS, OPEN_H, PREVIEW_SRC } from './CurtainUi'
import { STATION_KEYS, type StationInfo, type StationKey } from './factoryState'

// Área da fábrica na aba Agentes (C.2.1): uma CORTINA no topo (celular e computador iguais). Fechada é só HTML/CSS: prévia estática,
// as 5 luzes de estado e a frase do que precisa de você — nenhum byte de three. Tocar/clicar (ou Enter/espaço) abre a cortina com animação
// e SÓ ENTÃO baixa a cena 3D (import() em chunk à parte). Travas de desempenho:
//  1. Fechada = zero 3D e zero requestAnimationFrame; fechar de novo descarta a cena (dispose).
//  2. Checagem do aparelho ao abrir (sem WebGL, pouca memória/núcleos, reduzir movimento, economia de dados → versão leve com aviso e
//     o link "tentar o 3D mesmo assim"). 3. Escada automática na cena (sombras off → robôs congelados → versão leve lembrada).
//  4. Laço de animação só com cortina aberta + fábrica na tela + aba visível, ≤ 30 fps. 5. Qualquer erro do 3D cai na versão leve.
const loadScene = () => import('./FactoryScene')
const FactoryScene = lazy(loadScene)
const PREF_KEY = 'sb_factory_view'            // 'simple' (versão leve) | '3d'
const OPEN_MS = 780

const TX = {
  pt: { title: 'Fábrica dos agentes', openAria: 'Abrir a fábrica dos agentes', loading: 'Carregando a fábrica 3D…', close: 'Fechar cortina', home: 'Visão inicial', lite: 'Versão leve', try3d: 'tentar o 3D mesmo assim',
    liteAuto: 'Mostrando a versão leve neste aparelho.', weak: 'Este aparelho parece fraco para o 3D — mostrando a versão leve.', failed: 'Não foi possível abrir o 3D — mostrando a versão leve.', lowQ: 'Qualidade reduzida neste aparelho.',
    frozen: 'Os robôs pararam neste aparelho (a pose ainda mostra o estado real).', calm: 'Movimento reduzido: robôs parados (a pose ainda mostra o estado real).' },
  en: { title: 'Agent factory', openAria: 'Open the agent factory', loading: 'Loading the 3D factory…', close: 'Close curtain', home: 'Reset view', lite: 'Light version', try3d: 'try 3D anyway',
    liteAuto: 'Showing the light version on this device.', weak: 'This device looks too weak for 3D — showing the light version.', failed: 'Could not open the 3D view — showing the light version.', lowQ: 'Reduced quality on this device.',
    frozen: 'Robots stopped on this device (their pose still shows the real state).', calm: 'Reduced motion: robots are still (their pose still shows the real state).' },
} as const

const readPref = (): string | null => { try { return localStorage.getItem(PREF_KEY) } catch { return null } }
const writePref = (v: 'simple' | '3d') => { try { localStorage.setItem(PREF_KEY, v) } catch { /* sem localStorage: só não lembra */ } }
const calmMotion = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false } }

// Trava 2: aparelho fraco abre direto a versão leve (a pessoa ainda pode pedir o 3D).
export function deviceIsWeak(): boolean {
  try {
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } }
    if (calmMotion()) return true
    if (nav.connection?.saveData) return true
    if (typeof nav.deviceMemory === 'number' && nav.deviceMemory < 4) return true
    if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency < 4) return true // 4 núcleos (notebook comum) tenta o 3D; a escada recua se ficar lento
    const c = document.createElement('canvas')
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null
    if (!gl) return true
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return false
  } catch { return true }
}

class SceneBoundary extends Component<{ children: ReactNode; onError: () => void }, { bad: boolean }> {
  state = { bad: false }
  static getDerivedStateFromError() { return { bad: true } }
  componentDidCatch(e: Error) { console.error('[fábrica 3D]', e); this.props.onError() }
  render() { return this.state.bad ? null : this.props.children }
}

type Stage = 'closed' | 'opening' | 'open' | 'closing'
export interface Reveal { k: StationKey; n: number }
interface Props {
  lang: Lang; stations: Record<StationKey, StationInfo>; summary: string; selected: StationKey | null
  onSelect: (k: StationKey | null) => void; onOpen: (k: StationKey) => void; reveal: Reveal | null; sheet: boolean
}

export default function FactorySection({ lang, stations, summary, selected, onSelect, onOpen, reveal, sheet }: Props) {
  const t = TX[lang]
  const [stage, setStage] = useState<Stage>('closed')
  const [mode, setMode] = useState<'3d' | 'lite'>('3d')
  const [notice, setNotice] = useState<string | null>(null)
  const [lowQ, setLowQ] = useState(false)
  const [frozen, setFrozen] = useState(false)
  const [flyNonce, setFlyNonce] = useState(0)
  const [homeNonce, setHomeNonce] = useState(0)
  const root = useRef<HTMLElement>(null)
  const timer = useRef(0)
  const lastReveal = useRef(0)
  const kinds = Object.fromEntries(STATION_KEYS.map(k => [k, stations[k].kind])) as Record<StationKey, StationInfo['kind']>

  useEffect(() => () => window.clearTimeout(timer.current), [])
  const after = (ms: number, fn: () => void) => { window.clearTimeout(timer.current); if (calmMotion()) fn(); else timer.current = window.setTimeout(fn, ms) }

  // Abrir: escolhe 3D ou leve (checagem do aparelho) e anima a cortina. O 3D só começa a baixar aqui (ou no pointerdown do mouse).
  const openCurtain = useCallback(() => {
    if (stage === 'open' || stage === 'opening') return
    const pref = readPref()
    const calm = calmMotion()
    let m: '3d' | 'lite' = '3d', msg: string | null = null
    if (pref === 'simple') { m = 'lite'; msg = TX[lang].liteAuto } else if (pref !== '3d' && deviceIsWeak()) { m = 'lite'; msg = calm ? TX[lang].calm : TX[lang].weak }
    setMode(m); setNotice(msg); setLowQ(false); setFrozen(false)
    if (m === '3d') void loadScene()
    setStage('opening')
    // celular: ao terminar de abrir, alinha a cortina no topo da tela — sobra uma faixa de cartões embaixo (~20-30%) onde o dedo ainda rola a página
    after(OPEN_MS, () => { setStage('open'); if (sheet) root.current?.scrollIntoView({ block: 'start', behavior: calmMotion() ? 'auto' : 'smooth' }) })
  }, [stage, lang, sheet])

  const closeCurtain = useCallback(() => {
    onSelect(null); setStage('closing')   // desmonta a cena (dispose) já; a cortina fecha por cima da prévia
    after(OPEN_MS, () => setStage('closed'))
  }, [onSelect])

  // Pedido vindo de um cartão: abre a cortina se preciso, rola até a fábrica e voa até a estação.
  useEffect(() => {
    if (!reveal || reveal.n === lastReveal.current) return
    lastReveal.current = reveal.n
    onSelect(reveal.k); setFlyNonce(n => n + 1)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pedido externo (toque no cartão) abre a cortina
    if (stage === 'closed' || stage === 'closing') openCurtain()
    root.current?.scrollIntoView({ block: 'start', behavior: calmMotion() ? 'auto' : 'smooth' })
  }, [reveal]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { // versão leve: depois que abrir, leva até o cartão da estação pedida
    if (stage === 'open' && mode === 'lite' && selected) document.getElementById(`lite-station-${selected}`)?.scrollIntoView({ block: 'nearest', behavior: calmMotion() ? 'auto' : 'smooth' })
  }, [stage, mode, selected, reveal])

  const fallback = useCallback((msg: string, remember: boolean) => { setMode('lite'); setNotice(msg); onSelect(null); if (remember) writePref('simple') }, [onSelect])
  const onSlow = useCallback(() => fallback(TX[lang].liteAuto, true), [fallback, lang])
  const onFail = useCallback(() => fallback(TX[lang].failed, false), [fallback, lang])
  const tryThree = () => { writePref('3d'); setNotice(null); setLowQ(false); setFrozen(false); setMode('3d') }
  const goLite = () => { writePref('simple'); setNotice(null); setMode('lite'); onSelect(null) }
  const home = () => { onSelect(null); setHomeNonce(n => n + 1) }

  const isOpen = stage === 'opening' || stage === 'open'
  const scene3d = isOpen && mode === '3d'
  const settled = stage === 'open'
  const height = stage === 'closed' || stage === 'closing' ? CLOSED_H : mode === '3d' ? OPEN_H : settled ? 'auto' : CLOSED_H
  const calm = calmMotion()
  const note = notice ?? (scene3d && settled && frozen ? (calm ? t.calm : t.frozen) : scene3d && settled && lowQ ? t.lowQ : null)

  return (
    <section ref={root} aria-label={t.title} style={{ marginBottom: '22px', scrollMarginTop: sheet ? '72px' : '12px' }}>
      <style>{FACTORY_CSS}</style>
      <div className={`sbf-stage${isOpen ? ' is-open' : ''}`} style={{ height }}>
        {stage !== 'open' && <img className="sbf-preview" src={PREVIEW_SRC} alt="" aria-hidden="true" loading="lazy" decoding="async" />}
        {scene3d && settled && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
            <SceneBoundary onError={onFail}>
              <Suspense fallback={<div style={{ padding: '24px', color: MUTED, fontSize: '13px' }}>{t.loading}</div>}>
                <FactoryScene lang={lang} kinds={kinds} selected={selected} flyNonce={flyNonce} homeNonce={homeNonce} startLow={false} sheet={sheet}
                  onSelect={onSelect} onSlow={onSlow} onFrozen={() => setFrozen(true)} onFail={onFail} onQualityLow={() => setLowQ(true)} />
              </Suspense>
            </SceneBoundary>
          </div>
        )}
        {scene3d && !settled && <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: '#0E0B0A' }} />}
        {isOpen && mode === 'lite' && settled && <div style={{ position: 'relative', zIndex: 1, padding: '52px 14px 16px' }}><Factory2D lang={lang} stations={stations} selected={selected} onOpen={onOpen} /></div>}
        <div className="sbf-drape l" /><div className="sbf-drape r" /><div className="sbf-valance" />
        {stage !== 'open' && <button type="button" className="sbf-hit" aria-label={`${summary} — ${t.openAria}`} aria-expanded={isOpen} onClick={openCurtain}
          onPointerDown={e => { if (e.pointerType === 'mouse' && stage === 'closed' && !deviceIsWeakCached()) void loadScene() }} />}
        <CurtainFront lang={lang} stations={stations} summary={summary} />
        {settled && scene3d && selected && <StationPanel lang={lang} info={stations[selected]} onOpen={onOpen} onClose={() => onSelect(null)} sheet={sheet} />}
        {settled && scene3d && <>
          <button type="button" className="sbf-ctl" style={{ left: '12px', top: '12px' }} onClick={home}>⌂ {t.home}</button>
          <button type="button" className="sbf-ctl" style={{ left: '12px', bottom: '12px', background: 'transparent', border: 'none', textDecoration: 'underline', padding: '4px 2px', fontSize: '11px' }} onClick={goLite}>{t.lite}</button>
        </>}
        {settled && <button type="button" className="sbf-ctl" style={{ right: '12px', top: '12px', zIndex: 8 }} onClick={closeCurtain} aria-label={t.close}>{t.close} ▴</button>}
      </div>
      {note && (
        <div role="status" style={{ fontSize: '12px', color: MUTED, margin: '8px 2px 0', border: `0 solid ${BORDER}` }}>
          {note}{mode === 'lite' && <> <button type="button" className="sbf-link" onClick={tryThree}>{t.try3d}</button></>}
        </div>
      )}
    </section>
  )
}

// Pré-carregar no pointerdown do mouse só faz sentido se o aparelho vai tentar o 3D (não gasta dados à toa em aparelho fraco).
let weakCache: boolean | null = null
function deviceIsWeakCached(): boolean { if (weakCache == null) weakCache = readPref() === 'simple' ? true : deviceIsWeak(); return weakCache }
