import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Lang } from '../../../../contexts/LanguageContext'
import { MUTED, BORDER, D } from '../shared'
import { Factory2D, StationPanel } from './StationUi'
import { STATION_KEYS, type StationInfo, type StationKey } from './factoryState'

// Área da fábrica na página Agentes. As 5 travas de desempenho (pedido do dono: "não pode travar"):
//  1. A página e os cartões funcionam sem o 3D; a cena é import() dinâmico (three em chunk à parte), só carrega quando a área
//     entra na tela, e qualquer erro dela cai pra versão 2D sem derrubar o resto (ErrorBoundary local).
//  2. Checagem do aparelho antes de carregar (sem WebGL, pouca memória/núcleos, reduzir movimento, economia de dados → versão simples).
//  3. Automedição de fps na cena (sceneCore): <40 baixa qualidade; continua <30 → versão simples, lembrada no aparelho.
//  4. Desenho sob demanda, pausa fora da tela/aba oculta, descarte completo (sceneCore/FactoryScene).
//  5. Botão "Versão simples" sempre visível, escolha lembrada (localStorage).
const FactoryScene = lazy(() => import('./FactoryScene'))
const PREF_KEY = 'sb_factory_view'            // 'simple' | '3d'
const SCENE_H = 540
const SCENE_H_MOBILE = 380
const TX = {
  pt: { overview: 'Visão geral', side: 'Lateral', focus: 'Foco na estação', simple: 'Versão simples', see3d: 'Ver fábrica 3D', loading: 'Carregando a fábrica 3D…',
    light: 'Mostrando a versão leve neste aparelho', failed: 'Não foi possível abrir o 3D — mostrando a versão simples', lowQ: 'Qualidade reduzida neste aparelho', title: 'Fábrica dos agentes' },
  en: { overview: 'Overview', side: 'Side', focus: 'Focus on station', simple: 'Simple version', see3d: 'See 3D factory', loading: 'Loading the 3D factory…',
    light: 'Showing the light version on this device', failed: 'Could not open the 3D view — showing the simple version', lowQ: 'Reduced quality on this device', title: 'Agent factory' },
} as const

const readPref = (): string | null => { try { return localStorage.getItem(PREF_KEY) } catch { return null } }
const writePref = (v: 'simple' | '3d') => { try { localStorage.setItem(PREF_KEY, v) } catch { /* sem localStorage: só não lembra */ } }

// Trava 2: aparelho fraco começa na versão simples (o usuário ainda pode pedir o 3D).
export function deviceIsWeak(): boolean {
  try {
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return true
    if (nav.connection?.saveData) return true
    if (typeof nav.deviceMemory === 'number' && nav.deviceMemory < 4) return true
    if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency < 4) return true // 4 núcleos (notebook comum) tenta o 3D; a automedição recua se ficar lento
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

interface Props { lang: Lang; stations: Record<StationKey, StationInfo>; selected: StationKey | null; onSelect: (k: StationKey | null) => void; onOpen: (k: StationKey) => void; compact: boolean }

export default function FactorySection({ lang, stations, selected, onSelect, onOpen, compact }: Props) {
  const t = TX[lang]
  const [want3d, setWant3d] = useState(() => { if (compact) return false; const p = readPref(); return p === 'simple' ? false : p === '3d' ? true : !deviceIsWeak() })
  const [visible, setVisible] = useState(false)      // a área já entrou na tela (só então carrega o 3D)
  const [notice, setNotice] = useState<string | null>(null)
  const [lowQ, setLowQ] = useState(false)
  const [view, setView] = useState<'overview' | 'side' | 'focus'>('overview')
  const [nonce, setNonce] = useState(0)
  const hold = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = hold.current
    if (!el || visible) return
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { setVisible(true); io.disconnect() } }, { rootMargin: '120px' })
    io.observe(el)
    return () => io.disconnect()
  }, [visible, want3d])

  const fallback = useCallback((msg: string, remember: boolean) => { setWant3d(false); setNotice(msg); if (remember) writePref('simple') }, [])
  const onSlow = useCallback(() => fallback(TX[lang].light, true), [fallback, lang])
  const onFail = useCallback(() => fallback(TX[lang].failed, false), [fallback, lang])
  const kinds = Object.fromEntries(STATION_KEYS.map(k => [k, stations[k].kind])) as Record<StationKey, StationInfo['kind']>
  const go3d = () => { setWant3d(true); setNotice(null); setLowQ(false); writePref('3d') }
  const goSimple = () => { setWant3d(false); setNotice(null); writePref('simple') }
  const pickView = (v: typeof view) => { setView(v); setNonce(n => n + 1) }

  const btn = (on = false, disabled = false, accent = false) => ({ padding: '7px 12px', borderRadius: '9px', fontFamily: D, fontSize: '12px', fontWeight: 700, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1,
    background: on ? 'rgba(255,255,255,0.1)' : 'transparent', border: `1px solid ${accent ? 'rgba(255,109,41,0.4)' : on ? 'rgba(255,255,255,0.35)' : BORDER}`, color: accent ? '#FF6D29' : on ? 'white' : MUTED }) as const
  const h = compact ? SCENE_H_MOBILE : SCENE_H

  return (
    <section aria-label={t.title} style={{ marginBottom: '22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginRight: 'auto' }}>{t.title}</span>
        {want3d && <>
          <button style={btn(view === 'overview')} onClick={() => pickView('overview')}>{t.overview}</button>
          <button style={btn(view === 'side')} onClick={() => pickView('side')}>{t.side}</button>
          <button style={btn(view === 'focus', !selected)} disabled={!selected} onClick={() => pickView('focus')}>{t.focus}</button>
        </>}
        {want3d ? <button style={btn()} onClick={goSimple}>{t.simple}</button> : <button style={btn(false, false, true)} onClick={go3d}>{t.see3d}</button>}
      </div>
      {notice && <div role="status" style={{ fontSize: '12px', color: MUTED, margin: '0 0 8px' }}>{notice}</div>}
      {want3d && lowQ && <div style={{ fontSize: '11.5px', color: MUTED, margin: '0 0 8px' }}>{t.lowQ}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr 320px', gap: '14px', alignItems: 'start' }}>
        {want3d ? (
          <div ref={hold} style={{ height: h, borderRadius: '16px', overflow: 'hidden', border: `1px solid ${BORDER}`, background: '#0E0B0A', position: 'relative' }}>
            {visible && (
              <SceneBoundary onError={onFail}>
                <Suspense fallback={<div style={{ padding: '24px', color: MUTED, fontSize: '13px' }}>{t.loading}</div>}>
                  <FactoryScene lang={lang} kinds={kinds} selected={selected} view={view} viewNonce={nonce} startLow={false} onSelect={onSelect} onSlow={onSlow} onFail={onFail} onQualityLow={() => setLowQ(true)} />
                </Suspense>
              </SceneBoundary>
            )}
          </div>
        ) : <Factory2D lang={lang} stations={stations} selected={selected} onSelect={onSelect} />}
        <StationPanel lang={lang} info={selected ? stations[selected] : null} onOpen={onOpen} />
      </div>
    </section>
  )
}
