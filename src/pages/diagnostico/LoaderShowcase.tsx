import { useEffect, useRef, useState } from 'react'

// Fundo animado da tela de espera do diagnóstico (pedido do dono 2026-10-17):
// fotos reais de imóvel flutuam soltas → se organizam num tour (faixa que
// desliza) → os criativos de verdade do Sales Boost passam na frente, com um
// leve desfoque. Repete enquanto o diagnóstico roda; não segura nem atrasa nada
// (quem decide quando sai é o DiagnosisLoader, pelo andamento real).
// As imagens são da conta de teste (fotos reais de um apartamento + os criativos
// que o Sales Boost gerou com elas) — nada de banco de imagem nem tela inventada.
// Com "reduzir movimento" ligado no aparelho, fica uma composição parada.

const photos = Object.values(import.meta.glob('../../assets/loader/photo-*.webp', { eager: true, import: 'default' })) as string[]
const designs = Object.values(import.meta.glob('../../assets/loader/design-*.webp', { eager: true, import: 'default' })) as string[]

type Pose = { x: number; y: number; r: number; s: number; o: number; ry?: number }

// Tempo do ciclo (s): entra → espalhadas → tour → criativos → sai.
const K = { inEnd: 1.8, tourIn: 6.5, tourOn: 8.3, showIn: 13, showOn: 14.8, outIn: 21, cycle: 22.8 }
const ease = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2)
const mix = (a: Pose, b: Pose, u: number): Pose => {
  const e = ease(u)
  return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, r: a.r + (b.r - a.r) * e, s: a.s + (b.s - a.s) * e, o: a.o + (b.o - a.o) * e, ry: (a.ry ?? 0) + ((b.ry ?? 0) - (a.ry ?? 0)) * e }
}
const seg = (t: number, a: number, b: number) => (t - a) / (b - a)

// Posições normalizadas (−0.5…0.5 da largura/altura). O painel do carregamento
// fica embaixo no centro: as cartas ocupam mais o alto e as laterais.
const SCATTER: Pose[] = [
  { x: -0.33, y: -0.3, r: -9, s: 1, o: 1 }, { x: 0.3, y: -0.34, r: 7, s: 0.9, o: 1 },
  { x: -0.05, y: -0.2, r: 3, s: 1.12, o: 1 }, { x: 0.36, y: -0.02, r: -5, s: 0.85, o: 1 },
  { x: -0.38, y: 0.05, r: 6, s: 0.8, o: 1 }, { x: 0.14, y: -0.4, r: -4, s: 0.75, o: 1 },
  { x: -0.2, y: -0.42, r: 8, s: 0.7, o: 1 }, { x: 0.4, y: 0.28, r: 4, s: 0.7, o: 1 },
]
const OFF = (i: number): Pose => {
  const dir = [[-1, -0.6], [1, -0.7], [0, -1], [1, 0.1], [-1, 0.2], [0.5, -1], [-0.6, -1], [1, 0.8]][i % 8]
  return { x: dir[0] * 0.9, y: dir[1] * 0.9, r: dir[0] * 20, s: 0.8, o: 0 }
}
const DESIGN: Pose[] = [
  { x: -0.22, y: -0.17, r: -6, s: 1, o: 1 }, { x: 0.22, y: -0.22, r: 5, s: 1.05, o: 1 },
  { x: -0.4, y: 0.16, r: 4, s: 0.82, o: 1 }, { x: 0.4, y: 0.12, r: -5, s: 0.86, o: 1 },
]
const DESIGN_OFF = (i: number): Pose => ({ x: (i % 2 ? 1 : -1) * 0.25, y: 0.75, r: (i % 2 ? 1 : -1) * 12, s: 0.9, o: 0 })

function photoPose(i: number, n: number, t: number, w: number, cardW: number): Pose {
  const drift = { x: Math.sin(t * 0.6 + i * 1.7) * 0.012, y: Math.cos(t * 0.5 + i) * 0.012, r: Math.sin(t * 0.4 + i) * 1.2 }
  const sc = SCATTER[i % SCATTER.length]
  const scatter = { ...sc, x: sc.x + drift.x, y: sc.y + drift.y, r: sc.r + drift.r }
  // Tour: faixa no alto, deslizando pra esquerda e "dando a volta".
  const gap = (cardW * 1.1) / w
  const span = n * gap
  const shift = Math.max(0, t - K.tourIn) * 0.045
  let tx = (i - (n - 1) / 2) * gap - shift
  tx = ((tx + span / 2) % span + span) % span - span / 2
  const tour: Pose = { x: tx, y: -0.24, r: 0, s: 0.92, o: 1, ry: -14 }
  // Criativos na frente: as fotos recuam pras bordas, menores e apagadas.
  const back: Pose = { x: sc.x * 1.15 + drift.x, y: sc.y * 1.1 - 0.04 + drift.y, r: sc.r * 0.6, s: 0.62, o: 0.38 }
  if (t < K.inEnd) return mix(OFF(i), scatter, seg(t, 0, K.inEnd))
  if (t < K.tourIn) return scatter
  if (t < K.tourOn) return mix(scatter, tour, seg(t, K.tourIn, K.tourOn))
  if (t < K.showIn) return tour
  if (t < K.showOn) return mix(tour, back, seg(t, K.showIn, K.showOn))
  if (t < K.outIn) return back
  return mix(back, OFF(i + 3), seg(t, K.outIn, K.cycle))
}

function designPose(i: number, t: number): Pose {
  const d = DESIGN[i % DESIGN.length]
  const on = { ...d, x: d.x + Math.sin(t * 0.5 + i * 2) * 0.01, y: d.y + Math.cos(t * 0.45 + i) * 0.012, r: d.r + Math.sin(t * 0.35 + i) * 1 }
  const delay = i * 0.35
  if (t < K.showIn + delay) return DESIGN_OFF(i)
  if (t < K.showOn + delay) return mix(DESIGN_OFF(i), on, seg(t, K.showIn + delay, K.showOn + delay))
  if (t < K.outIn) return on
  return mix(on, { ...DESIGN_OFF(i), y: -0.8 }, seg(t, K.outIn, K.cycle))
}

const prefersReduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function LoaderShowcase() {
  const box = useRef<HTMLDivElement>(null)
  const cards = useRef<(HTMLDivElement | null)[]>([])
  const [reduced] = useState(prefersReduced)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const n = photos.length
    const paint = (t: number) => {
      const w = el.clientWidth, h = el.clientHeight
      const cardW = Math.min(220, Math.max(108, w * 0.17))
      cards.current.forEach((c, idx) => {
        if (!c) return
        const isDesign = idx >= n
        const p = isDesign ? designPose(idx - n, t) : photoPose(idx, n, t, w, cardW)
        c.style.width = `${isDesign ? cardW * 1.18 : cardW}px`
        c.style.opacity = String(p.o)
        c.style.transform = `translate(-50%,-50%) translate(${p.x * w}px,${p.y * h}px) perspective(900px) rotateY(${p.ry ?? 0}deg) rotate(${p.r}deg) scale(${p.s})`
      })
    }
    if (reduced) { paint(K.showOn + 2); return }
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      paint(((now - t0) / 1000) % K.cycle)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [reduced])

  const card: React.CSSProperties = { position: 'absolute', left: '50%', top: '50%', aspectRatio: '4 / 5', borderRadius: 14, overflow: 'hidden', willChange: 'transform, opacity', opacity: 0, boxShadow: '0 18px 50px rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.12)' }
  const img: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', display: 'block' }

  return (
    <div ref={box} aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {photos.map((src, i) => (
        <div key={src} ref={el => { cards.current[i] = el }} style={{ ...card, zIndex: 1 + (i % 3) }}>
          <img src={src} alt="" style={img} loading="eager" decoding="async" />
        </div>
      ))}
      {designs.map((src, i) => (
        <div key={src} ref={el => { cards.current[photos.length + i] = el }} style={{ ...card, zIndex: 10 + i, boxShadow: '0 24px 70px rgba(0,0,0,0.6)' }}>
          {/* desfoque leve: dá pra ver o design, não pra ler cada detalhe */}
          <img src={src} alt="" style={{ ...img, filter: 'blur(1.4px)', transform: 'scale(1.03)' }} loading="eager" decoding="async" />
        </div>
      ))}
    </div>
  )
}
