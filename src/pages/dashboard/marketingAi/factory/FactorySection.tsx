import { Component, lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from 'react'
import type { Lang } from '../../../../contexts/LanguageContext'
import { MUTED } from '../shared'
import BrandLoader from '../../../../components/BrandLoader'
import { Factory2D, StationPanel } from './StationUi'
import { FACTORY_CSS, OPEN_H, PREVIEW_SRC } from './CurtainUi'
import { STATION_KEYS, type StationInfo, type StationKey } from './factoryState'

// Fábrica dos agentes na aba Agentes. Desde 2026-11-10 (dono: "sem cortina, sem cards, só os robozinhos"): a cena 3D abre
// DIRETO ao entrar na aba e é a própria aba — tocar num robô abre o painel da estação, e o "Abrir" do painel leva à aba do agente.
// Travas de desempenho que continuam valendo:
//  1. O 3D é um pedaço à parte (import()), baixado só nesta aba; enquanto baixa, aparece a prévia estática + o logo carregando.
//  2. Checagem do aparelho ao entrar (sem WebGL, pouca memória/núcleos, reduzir movimento, economia de dados → versão leve com aviso e
//     o link "tentar o 3D mesmo assim"). 3. Escada automática na cena (sombras off → robôs congelados → versão leve lembrada).
//  4. Laço de animação só com a fábrica na tela + aba visível, ≤ 30 fps. 5. Qualquer erro do 3D cai na versão leve.
const loadScene = () => import('./FactoryScene')
const FactoryScene = lazy(loadScene)
const PREF_KEY = 'sb_factory_view'            // 'simple' (versão leve) | '3d'

const TX = {
  pt: { title: 'Fábrica dos agentes', loading: 'Carregando a fábrica…', home: 'Visão inicial', lite: 'Versão leve', try3d: 'tentar o 3D mesmo assim',
    liteAuto: 'Mostrando a versão leve neste aparelho.', weak: 'Este aparelho parece fraco para o 3D — mostrando a versão leve.', failed: 'Não foi possível abrir o 3D — mostrando a versão leve.', lowQ: 'Qualidade reduzida neste aparelho.',
    frozen: 'Os robôs pararam neste aparelho (a pose ainda mostra o estado real).', calm: 'Movimento reduzido: robôs parados (a pose ainda mostra o estado real).',
    hint: 'Toque num robô para ver o que ele está fazendo.' },
  en: { title: 'Agent factory', loading: 'Loading the factory…', home: 'Reset view', lite: 'Light version', try3d: 'try 3D anyway',
    liteAuto: 'Showing the light version on this device.', weak: 'This device looks too weak for 3D — showing the light version.', failed: 'Could not open the 3D view — showing the light version.', lowQ: 'Reduced quality on this device.',
    frozen: 'Robots stopped on this device (their pose still shows the real state).', calm: 'Reduced motion: robots are still (their pose still shows the real state).',
    hint: 'Tap a robot to see what it is doing.' },
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

// Decide na entrada da aba: 3D ou versão leve (preferência lembrada > checagem do aparelho).
function initialMode(lang: Lang): { mode: '3d' | 'lite'; notice: string | null } {
  const pref = readPref()
  if (pref === 'simple') return { mode: 'lite', notice: TX[lang].liteAuto }
  if (pref !== '3d' && deviceIsWeak()) return { mode: 'lite', notice: calmMotion() ? TX[lang].calm : TX[lang].weak }
  return { mode: '3d', notice: null }
}

interface Props {
  lang: Lang; stations: Record<StationKey, StationInfo>; selected: StationKey | null
  onSelect: (k: StationKey | null) => void; onOpen: (k: StationKey) => void; sheet: boolean
}

export default function FactorySection({ lang, stations, selected, onSelect, onOpen, sheet }: Props) {
  const t = TX[lang]
  const [{ mode, notice }, setView] = useState(() => initialMode(lang))
  const [lowQ, setLowQ] = useState(false)
  const [frozen, setFrozen] = useState(false)
  const [homeNonce, setHomeNonce] = useState(0)
  const kinds = Object.fromEntries(STATION_KEYS.map(k => [k, stations[k].kind])) as Record<StationKey, StationInfo['kind']>

  useEffect(() => { if (mode === '3d') void loadScene() }, [mode])

  const fallback = useCallback((msg: string, remember: boolean) => { setView({ mode: 'lite', notice: msg }); onSelect(null); if (remember) writePref('simple') }, [onSelect])
  const onSlow = useCallback(() => fallback(TX[lang].liteAuto, true), [fallback, lang])
  const onFail = useCallback(() => fallback(TX[lang].failed, false), [fallback, lang])
  const tryThree = () => { writePref('3d'); setLowQ(false); setFrozen(false); setView({ mode: '3d', notice: null }) }
  const goLite = () => { writePref('simple'); setView({ mode: 'lite', notice: null }); onSelect(null) }
  const home = () => { onSelect(null); setHomeNonce(n => n + 1) }

  const scene3d = mode === '3d'
  const calm = calmMotion()
  const note = notice ?? (scene3d && frozen ? (calm ? t.calm : t.frozen) : scene3d && lowQ ? t.lowQ : null)

  return (
    <section aria-label={t.title}>
      <style>{FACTORY_CSS}</style>
      <div className="sbf-stage" style={{ height: scene3d ? OPEN_H : 'auto' }}>
        {scene3d && (
          <>
            <img className="sbf-preview" src={PREVIEW_SRC} alt="" aria-hidden="true" decoding="async" />
            <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
              <SceneBoundary onError={onFail}>
                <Suspense fallback={<div style={{ position: 'absolute', inset: 0, background: 'rgba(14,11,10,0.55)' }}><BrandLoader label={t.loading} /></div>}>
                  <FactoryScene lang={lang} kinds={kinds} selected={selected} flyNonce={0} homeNonce={homeNonce} startLow={false} sheet={sheet}
                    onSelect={onSelect} onSlow={onSlow} onFrozen={() => setFrozen(true)} onFail={onFail} onQualityLow={() => setLowQ(true)} />
                </Suspense>
              </SceneBoundary>
            </div>
            {selected && <StationPanel lang={lang} info={stations[selected]} onOpen={onOpen} onClose={() => onSelect(null)} sheet={sheet} />}
            <button type="button" className="sbf-ctl" style={{ left: '12px', top: '12px' }} onClick={home}>⌂ {t.home}</button>
            <button type="button" className="sbf-ctl" style={{ left: '12px', bottom: '12px', background: 'transparent', border: 'none', textDecoration: 'underline', padding: '4px 2px', fontSize: '11px' }} onClick={goLite}>{t.lite}</button>
          </>
        )}
        {!scene3d && <div style={{ position: 'relative', zIndex: 1, padding: '14px' }}><Factory2D lang={lang} stations={stations} selected={selected} onOpen={onOpen} /></div>}
      </div>
      <div role="status" style={{ fontSize: '12px', color: MUTED, margin: '8px 2px 0' }}>
        {note ?? (scene3d && !selected ? t.hint : null)}
        {mode === 'lite' && <> <button type="button" className="sbf-link" onClick={tryThree}>{t.try3d}</button></>}
      </div>
    </section>
  )
}
