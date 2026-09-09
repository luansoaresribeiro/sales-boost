import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ScrollToPlugin } from 'gsap/ScrollToPlugin'
import { t, type Lang } from './i18n'

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin)

const NAV_LINKS = ['#features', '#how', '#pricing'] as const
const D = "'Bricolage Grotesque', system-ui, sans-serif"
const ORANGE = '#FF6D29'
const BG = '#0E0B0A'
const CARD = '#1A1008'
const MUTED = '#BABABA'

/* ─── shared glow ─── */
function Glow({ w = 500, h = 300, opacity = 0.18, top = '50%', left = '50%' }: { w?: number; h?: number; opacity?: number; top?: string; left?: string }) {
  return (
    <div className="absolute pointer-events-none" style={{ width: `${w}px`, height: `${h}px`, top, left, transform: 'translate(-50%,-50%)', background: `radial-gradient(ellipse, rgba(255,109,41,${opacity}) 0%, transparent 70%)`, filter: 'blur(30px)' }} />
  )
}

function Badge({ text }: { text: string }) {
  return (
    <div className="inline-flex items-center gap-2 text-sm font-medium px-4 py-1.5 rounded-full mb-6" style={{ background: 'rgba(255,109,41,0.1)', border: '1px solid rgba(255,109,41,0.25)', color: ORANGE }}>
      {text}
    </div>
  )
}

function SectionHeading({ white, accent }: { white: string; accent: string }) {
  return (
    <h2 className="font-black tracking-tight leading-none mb-4" style={{ fontFamily: D, fontSize: 'clamp(2.2rem,4.5vw,3.8rem)' }}>
      <span className="text-white">{white} </span>
      <span style={{ color: ORANGE }}>{accent}</span>
    </h2>
  )
}

/* ─── fire cursor ─── */
function FireCursor() {
  const tip = useRef<HTMLDivElement>(null)
  const mid = useRef<HTMLDivElement>(null)
  const base = useRef<HTMLDivElement>(null)
  const mouse = useRef({ x: -600, y: -600 })
  const p1 = useRef({ x: -600, y: -600 })
  const p2 = useRef({ x: -600, y: -600 })
  const p3 = useRef({ x: -600, y: -600 })

  useEffect(() => {
    const onMove = (e: MouseEvent) => { mouse.current = { x: e.clientX, y: e.clientY } }
    window.addEventListener('mousemove', onMove)
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t
    let raf: number
    const tick = () => {
      p1.current.x = lerp(p1.current.x, mouse.current.x, 0.2)
      p1.current.y = lerp(p1.current.y, mouse.current.y, 0.2)
      p2.current.x = lerp(p2.current.x, mouse.current.x, 0.09)
      p2.current.y = lerp(p2.current.y, mouse.current.y, 0.09)
      p3.current.x = lerp(p3.current.x, mouse.current.x, 0.04)
      p3.current.y = lerp(p3.current.y, mouse.current.y, 0.04)
      if (tip.current)  tip.current.style.transform  = `translate(${p1.current.x - 70}px,${p1.current.y - 110}px)`
      if (mid.current)  mid.current.style.transform  = `translate(${p2.current.x - 140}px,${p2.current.y - 200}px)`
      if (base.current) base.current.style.transform = `translate(${p3.current.x - 210}px,${p3.current.y - 300}px)`
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { window.removeEventListener('mousemove', onMove); cancelAnimationFrame(raf) }
  }, [])

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 9998 }}>
      {/* opacity kept low so fire glows behind content without obscuring text */}
      <div ref={tip}  style={{ position: 'absolute', width: '140px',  height: '200px',  borderRadius: '50% 50% 38% 42%',   background: 'radial-gradient(ellipse at 50% 62%, rgba(255,210,90,0.28) 0%, rgba(255,109,41,0.18) 32%, rgba(210,55,0,0.06) 68%, transparent 100%)', filter: 'blur(12px)',  willChange: 'transform', mixBlendMode: 'screen' }} />
      <div ref={mid}  style={{ position: 'absolute', width: '280px',  height: '380px',  borderRadius: '44% 56% 38% 62%',   background: 'radial-gradient(ellipse at 50% 65%, rgba(255,109,41,0.15) 0%, rgba(190,55,0,0.07) 42%, transparent 75%)',                            filter: 'blur(28px)',  willChange: 'transform', mixBlendMode: 'screen' }} />
      <div ref={base} style={{ position: 'absolute', width: '420px',  height: '580px',  borderRadius: '38% 62% 33% 67%',   background: 'radial-gradient(ellipse at 50% 70%, rgba(160,35,0,0.1) 0%, rgba(100,15,0,0.04) 52%, transparent 80%)',                              filter: 'blur(44px)',  willChange: 'transform', mixBlendMode: 'screen' }} />
    </div>
  )
}

/* ══════════════════════════════════════════════════
   TRIAL MODAL  — shown before sending people to /onboarding
══════════════════════════════════════════════════ */
function TrialModal({ lang, open, onClose }: { lang: Lang; open: boolean; onClose: () => void }) {
  const tx = t[lang].trialModal
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="relative w-full max-w-md rounded-2xl p-8" style={{ background: CARD, border: '1px solid rgba(255,109,41,0.25)', boxShadow: '0 24px 80px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} aria-label={tx.dismiss} className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-colors" style={{ color: MUTED, background: 'rgba(255,255,255,0.05)' }}>✕</button>
        <Badge text={tx.badge} />
        <h3 className="font-black text-white leading-tight mb-4" style={{ fontFamily: D, fontSize: '1.6rem' }}>{tx.title}</h3>
        <p className="text-sm leading-relaxed mb-6" style={{ color: MUTED }}>{tx.body}</p>
        <div className="flex items-baseline gap-3 mb-8 p-4 rounded-xl" style={{ background: 'rgba(255,109,41,0.06)', border: '1px solid rgba(255,109,41,0.2)' }}>
          <span className="text-sm line-through" style={{ color: 'rgba(255,255,255,0.35)' }}>{tx.priceFrom}</span>
          <span className="font-black" style={{ fontFamily: D, fontSize: '2rem', color: ORANGE }}>{tx.priceTo}</span>
          <span className="text-xs" style={{ color: MUTED }}>{tx.priceNote}</span>
        </div>
        <Link to="/onboarding" className="w-full font-bold text-sm px-6 py-4 rounded-xl text-black transition-all text-center" style={{ background: ORANGE, textDecoration: 'none', display: 'block' }}>
          {tx.cta}
        </Link>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════
   NAVBAR  — smooth scroll on anchor clicks
══════════════════════════════════════════════════ */
function Navbar({ lang, setLang, onTrialClick }: { lang: Lang; setLang: (l: Lang) => void; onTrialClick: () => void }) {
  const tx = t[lang].nav
  const labels = [tx.features, tx.how, tx.pricing]

  const scrollTo = (href: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    const el = document.querySelector(href)
    if (el) gsap.to(window, { scrollTo: el, duration: 1.1, ease: 'power3.inOut' })
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(16px)', background: 'rgba(14,11,10,0.85)' }}>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: ORANGE }}>
          <span className="text-black font-black text-sm">SB</span>
        </div>
        <span className="font-bold text-white text-lg tracking-tight">SalesBoost</span>
      </div>
      <div className="hidden md:flex items-center gap-8">
        {labels.map((label, i) => (
          <a key={label} href={NAV_LINKS[i]} onClick={scrollTo(NAV_LINKS[i])} className="text-sm transition-colors" style={{ color: MUTED }} onMouseEnter={e => (e.currentTarget.style.color = '#fff')} onMouseLeave={e => (e.currentTarget.style.color = MUTED)}>
            {label}
          </a>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={() => setLang(lang === 'pt' ? 'en' : 'pt')} className="text-xs font-medium px-3 py-1.5 rounded-full transition-all" style={{ border: '1px solid rgba(255,255,255,0.15)', color: MUTED }}>
          {lang === 'pt' ? '🇺🇸 EN' : '🇧🇷 PT'}
        </button>
        <Link to="/login" className="font-medium text-sm px-4 py-2 rounded-lg transition-all" style={{ color: MUTED, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.12)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#fff'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.28)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = MUTED; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)' }}>
          {lang === 'pt' ? 'Entrar' : 'Sign in'}
        </Link>
        <button onClick={onTrialClick} className="font-semibold text-sm px-4 py-2 rounded-lg transition-all" style={{ background: ORANGE, color: '#000', border: 'none', cursor: 'pointer' }}>
          {tx.cta}
        </button>
      </div>
    </nav>
  )
}

/* ══════════════════════════════════════════════════
   HERO  — load anim + parallax
══════════════════════════════════════════════════ */
function HeroSection({ lang }: { lang: Lang }) {
  const tx = t[lang].hero
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
      tl.from('.hero-meta', { y: 18, opacity: 0, stagger: 0.08, duration: 0.6 })
        .from('.hero-line', { y: 70, opacity: 0, stagger: 0.1, duration: 0.9 }, '-=0.3')
        .from('.hero-desc', { y: 20, opacity: 0, duration: 0.6 }, '-=0.5')
        .from('.hero-phone', { y: 50, opacity: 0, scale: 0.94, duration: 1 }, '-=0.6')
        .from('.hero-side', { x: 16, opacity: 0, stagger: 0.07, duration: 0.5 }, '-=0.7')

      // parallax on scroll
      gsap.to('.hero-bgword', {
        yPercent: -28,
        scrollTrigger: { trigger: sectionRef.current!, start: 'top top', end: 'bottom top', scrub: 1.2 },
      })
      gsap.to('.hero-phone', {
        yPercent: 14,
        scrollTrigger: { trigger: sectionRef.current!, start: 'top top', end: 'bottom top', scrub: 1 },
      })
    }, sectionRef)
    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} className="relative overflow-hidden" style={{ height: '100vh', minHeight: '660px', background: 'linear-gradient(158deg,#4E0D02 0%,#8F2400 16%,#BE4A00 32%,#D97215 50%,#E9A840 66%,#F2CC7A 82%,#F8E4B8 100%)' }}>
      <div aria-hidden className="hero-bgword absolute bottom-[5%] left-0 right-0 overflow-hidden text-center select-none pointer-events-none z-0">
        <span style={{ fontFamily: D, fontSize: '15vw', fontWeight: 900, color: 'rgba(255,255,255,0.07)', lineHeight: 1, display: 'block', whiteSpace: 'nowrap' }}>{tx.bgWord}</span>
      </div>

      <div className="absolute z-10 flex items-start justify-between w-full px-6" style={{ top: '76px' }}>
        {tx.meta.map((m) => (
          <div key={m.label} className="hero-meta">
            <div style={{ fontSize: '9px', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', fontWeight: 500 }}>{m.label}</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', fontWeight: 600, marginTop: '3px' }}>{m.value}</div>
          </div>
        ))}
        <div className="hero-meta" style={{ fontFamily: D, fontSize: '10px', fontWeight: 900, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.72)', textAlign: 'right', lineHeight: 1.5 }}>SALES<br />BOOST</div>
      </div>

      <h1 className="absolute z-10 text-white leading-none" style={{ fontFamily: D, fontSize: 'clamp(2.6rem,6vw,6.2rem)', fontWeight: 800, letterSpacing: '-0.02em', top: '132px', left: '24px', maxWidth: '44%' }}>
        {tx.headline.map((line, i) => <span key={i} className="hero-line block">{line}</span>)}
      </h1>

      <div className="absolute z-10" style={{ top: '52%', left: '24px', transform: 'translateY(-24px)' }}>
        <div style={{ fontSize: '9px', letterSpacing: '0.13em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>{tx.project[0]}</div>
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.52)', fontWeight: 500, marginTop: '3px' }}>{tx.project[1]}</div>
      </div>
      <div className="absolute z-10" style={{ top: '64%', left: '24px' }}>
        <div style={{ fontSize: '9px', letterSpacing: '0.13em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>{tx.typeLabel}</div>
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.52)', fontWeight: 500, marginTop: '3px' }}>{tx.typeValue}</div>
      </div>

      <div className="hero-desc absolute z-10" style={{ top: '144px', right: '86px', maxWidth: '22%' }}>
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.72 }}>{tx.sub}</p>
      </div>

      <div className="hero-phone absolute z-10" style={{ left: '50%', top: '50%', transform: 'translate(-50%,-46%)' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '380px', height: '480px', background: 'radial-gradient(ellipse,rgba(175,60,0,0.55) 0%,rgba(210,95,0,0.28) 45%,transparent 72%)', pointerEvents: 'none', zIndex: -1 }} />
        <div style={{ width: '234px', height: '468px', borderRadius: '50px', background: '#100600', border: '2.5px solid rgba(255,255,255,0.1)', boxShadow: '0 50px 120px rgba(0,0,0,0.65),inset 0 1px 0 rgba(255,255,255,0.07)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: '3px', borderRadius: '47px', background: BG, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '12px', marginBottom: '8px' }}>
              <div style={{ width: '76px', height: '20px', borderRadius: '12px', background: '#100600' }} />
            </div>
            <div style={{ padding: '0 20px 10px' }}>
              <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.27)', letterSpacing: '0.13em', textTransform: 'uppercase' }}>Junho 2026</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'white', marginTop: '2px' }}>{tx.reportTitle}</div>
            </div>
            <div style={{ margin: '0 16px 12px', padding: '12px 14px', borderRadius: '14px', background: 'rgba(255,109,41,0.1)', border: '1px solid rgba(255,109,41,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '8px', color: 'rgba(255,109,41,0.6)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>{tx.scoreLabel}</div>
                  <div style={{ fontFamily: D, fontSize: '2.5rem', fontWeight: 900, color: ORANGE, lineHeight: 1 }}>87</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>↑ +12 pts</div>
                  <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.22)', marginTop: '2px' }}>vs anterior</div>
                </div>
              </div>
              <div style={{ marginTop: '8px', height: '3px', borderRadius: '99px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{ width: '87%', height: '100%', borderRadius: '99px', background: `linear-gradient(90deg,${ORANGE},#FFB05A)` }} />
              </div>
            </div>
            {tx.reportItems.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize: '11px', flexShrink: 0 }}>{item.icon}</span>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>{item.text}</span>
              </div>
            ))}
            <div style={{ padding: '12px 16px 0' }}>
              <div style={{ padding: '9px', borderRadius: '11px', background: 'rgba(255,109,41,0.1)', border: '1px solid rgba(255,109,41,0.22)', textAlign: 'center' }}>
                <span style={{ fontSize: '9px', fontWeight: 700, color: ORANGE }}>{tx.reportCta}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute z-10 flex flex-col" style={{ right: '30px', top: '42%', transform: 'translateY(-50%)', gap: '11px' }}>
        {tx.sideLabels.map((label) => (
          <div key={label} className="hero-side" style={{ fontSize: '9px', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.36)', textAlign: 'right' }}>{label}</div>
        ))}
      </div>

      <div className="absolute z-10 flex flex-col" style={{ right: '18px', bottom: '44px', gap: '10px' }}>
        {(['←', '▶', '→'] as const).map((icon, i) => (
          <button key={i} style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.85)', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
            {icon}
          </button>
        ))}
      </div>

      <div className="absolute z-10" style={{ bottom: '28px', left: '24px' }}>
        <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.28)', letterSpacing: '0.08em' }}>{tx.location}</div>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', fontWeight: 600, marginTop: '3px' }}>{tx.date} <span style={{ color: 'rgba(255,255,255,0.28)' }}>/</span> {tx.year}</div>
      </div>
    </section>
  )
}

/* ══════════════════════════════════════════════════
   STATS  — slide-up + number count-up
══════════════════════════════════════════════════ */
function StatsSection({ lang }: { lang: Lang }) {
  const tx = t[lang].stats
  const sectionRef = useRef<HTMLElement>(null)
  const numRefs = useRef<(HTMLDivElement | null)[]>([])

  // static values to animate toward (same order as i18n)
  const counters = [
    { end: 38, suffix: '%', decimals: 0 },
    { end: 2.4, suffix: '×', decimals: 1 },
    { end: 24, suffix: 'h', decimals: 0 },
  ]

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.stats-card', {
        y: 60, opacity: 0, duration: 0.9, ease: 'power3.out',
        scrollTrigger: { trigger: '.stats-card', start: 'top 86%', once: true },
      })
      gsap.from('.stats-intro', {
        y: 30, opacity: 0, duration: 0.7, ease: 'power2.out', delay: 0.15,
        scrollTrigger: { trigger: '.stats-card', start: 'top 86%', once: true },
      })

      numRefs.current.forEach((el, i) => {
        if (!el) return
        const { end, suffix, decimals } = counters[i]
        const obj = { val: 0 }
        gsap.to(obj, {
          val: end, duration: 2.4, ease: 'power2.out',
          onUpdate: () => { el.textContent = obj.val.toFixed(decimals) + suffix },
          scrollTrigger: { trigger: el, start: 'top 82%', once: true },
        })
      })
    }, sectionRef)
    return () => ctx.revert()
  }, [lang])

  return (
    <section ref={sectionRef} className="relative overflow-hidden py-24 px-6" style={{ background: BG }}>
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg,transparent,rgba(255,109,41,0.25),transparent)' }} />
      <Glow w={700} h={350} opacity={0.14} top="70%" left="20%" />
      <div className="relative z-10 max-w-6xl mx-auto">
        <div className="stats-card rounded-3xl p-10 md:p-14" style={{ background: CARD, border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="stats-intro grid md:grid-cols-2 gap-10 items-start mb-14">
            <div>
              <div className="flex items-center gap-2 mb-5">
                <div className="w-4 h-4 rounded-full" style={{ background: ORANGE }} />
                <span style={{ fontSize: '12px', color: MUTED, letterSpacing: '0.05em' }}>{tx.badge}</span>
              </div>
              <div className="flex gap-3">
                {['𝕏', 'in', '@'].map((s) => (
                  <div key={s} className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(255,255,255,0.06)', color: MUTED }}>{s}</div>
                ))}
              </div>
            </div>
            <p style={{ fontSize: 'clamp(1rem,2vw,1.2rem)', color: 'white', lineHeight: 1.6 }}>
              {tx.intro.split(' ').map((word, i) =>
                ['resultados', 'inteligência', 'ações', 'results', 'intelligence', 'actions'].includes(word.toLowerCase().replace(/[.,]/g, ''))
                  ? <span key={i} style={{ color: ORANGE }}>{word} </span>
                  : <span key={i}>{word} </span>
              )}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {tx.items.map((stat, i) => (
              <div key={i} className="relative" style={{ paddingLeft: i > 0 ? '32px' : 0 }}>
                {i > 0 && <div className="hidden md:block absolute left-0 top-0 bottom-0 w-px" style={{ background: 'rgba(255,255,255,0.07)' }} />}
                <div
                  ref={el => { numRefs.current[i] = el }}
                  style={{ fontFamily: D, fontSize: 'clamp(3rem,5vw,4.5rem)', fontWeight: 900, color: 'white', lineHeight: 1 }}
                >
                  {stat.value}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: ORANGE }} />
                  <span style={{ fontSize: '13px', color: MUTED }}>{stat.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ══════════════════════════════════════════════════
   FEATURES  — cards stagger right → left
══════════════════════════════════════════════════ */
function FeaturesSection({ lang }: { lang: Lang }) {
  const tx = t[lang].features
  const sectionRef = useRef<HTMLElement>(null)

  const icons = [
    <svg key="s" viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke={ORANGE} strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" /></svg>,
    <svg key="c" viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke={ORANGE} strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /></svg>,
    <svg key="u" viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke={ORANGE} strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>,
  ]

  useEffect(() => {
    const ctx = gsap.context(() => {
      // immediateRender:false prevents GSAP from setting opacity:0 before trigger fires
      // toggleActions ensures the animation plays even if ScrollTrigger was missed
      gsap.fromTo('.feat-heading',
        { y: 40, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, ease: 'power2.out', immediateRender: false,
          scrollTrigger: { trigger: '.feat-heading', start: 'top 90%', toggleActions: 'play none none none' } }
      )
      gsap.fromTo('.feature-card',
        { x: 90, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.75, stagger: 0.14, ease: 'power3.out', immediateRender: false,
          scrollTrigger: { trigger: '.feature-card', start: 'top 90%', toggleActions: 'play none none none' } }
      )
    }, sectionRef)
    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} id="features" className="relative overflow-hidden py-32 px-6" style={{ background: BG }}>
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg,transparent,rgba(255,109,41,0.1),transparent)' }} />
      <Glow w={600} h={400} opacity={0.1} top="50%" left="50%" />
      <div className="relative z-10 max-w-6xl mx-auto">
        <div className="feat-heading text-center mb-16">
          <Badge text={tx.badge} />
          <SectionHeading white={tx.title1} accent={tx.title2} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {tx.pillars.map((pillar, i) => (
            <div
              key={pillar.num}
              className="feature-card group relative rounded-2xl p-8 overflow-hidden transition-all duration-300"
              style={{ background: CARD, border: '1px solid rgba(255,255,255,0.05)' }}
              onMouseEnter={e => { const d = e.currentTarget; d.style.border = '1px solid rgba(255,109,41,0.3)'; d.style.background = '#201408' }}
              onMouseLeave={e => { const d = e.currentTarget; d.style.border = '1px solid rgba(255,255,255,0.05)'; d.style.background = CARD }}
            >
              <div className="absolute top-3 right-4 select-none pointer-events-none" style={{ fontFamily: D, fontSize: '7rem', fontWeight: 900, color: 'rgba(255,109,41,0.05)', lineHeight: 1 }}>{pillar.num}</div>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-6" style={{ background: 'rgba(255,109,41,0.1)', border: '1px solid rgba(255,109,41,0.2)' }}>{icons[i]}</div>
              <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,109,41,0.6)' }}>{pillar.num}</div>
              <h3 className="text-lg font-bold text-white mb-3">{pillar.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{pillar.desc}</p>
              <div className="absolute bottom-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: `linear-gradient(90deg,transparent,${ORANGE},transparent)` }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ══════════════════════════════════════════════════
   HOW IT WORKS  — sticky scroll, steps reveal right→left
══════════════════════════════════════════════════ */
function HowItWorksSection({ lang }: { lang: Lang }) {
  const tx = t[lang].how
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.how-heading', {
        y: 40, opacity: 0, duration: 0.8, ease: 'power2.out',
        scrollTrigger: { trigger: '.how-heading', start: 'top 86%', once: true },
      })

      // Sticky scroll: pin section, reveal each step from right as user scrolls
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current!,
          start: 'top top+=64',
          end: '+=1050',
          pin: true,
          pinSpacing: true,
          scrub: 0.7,
        },
      })

      tl.fromTo('.step-item-0', { x: 120, opacity: 0 }, { x: 0, opacity: 1, duration: 1 }, 0)
        .fromTo('.step-item-1', { x: 120, opacity: 0 }, { x: 0, opacity: 1, duration: 1 }, 1.2)
        .fromTo('.step-item-2', { x: 120, opacity: 0 }, { x: 0, opacity: 1, duration: 1 }, 2.4)
        .fromTo('.how-connector', { scaleX: 0 }, { scaleX: 1, duration: 2, ease: 'none' }, 0.8)
    }, sectionRef)
    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} id="how" className="relative overflow-hidden py-32 px-6" style={{ background: '#100C0A' }}>
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg,transparent,rgba(255,109,41,0.1),transparent)' }} />
      <Glow w={500} h={300} opacity={0.12} top="50%" left="50%" />
      <div className="relative z-10 max-w-5xl mx-auto">
        <div className="how-heading text-center mb-20">
          <Badge text={tx.badge} />
          <SectionHeading white={tx.title1} accent={tx.title2} />
        </div>
        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-6">
          <div className="how-connector hidden md:block absolute top-[38px] h-px border-t border-dashed origin-left" style={{ left: 'calc(100%/6)', right: 'calc(100%/6)', borderColor: 'rgba(255,109,41,0.2)' }} />
          {tx.steps.map((step, i) => (
            <div key={step.num} className={`step-item step-item-${i} flex flex-col items-center text-center`}>
              <div className="relative mb-8 flex-shrink-0">
                <div className="absolute inset-0 rounded-full" style={{ background: 'rgba(255,109,41,0.15)', filter: 'blur(16px)' }} />
                <div className="relative w-20 h-20 rounded-full flex items-center justify-center" style={{ border: '2px solid rgba(255,109,41,0.4)', background: BG }}>
                  <span className="font-black text-xl" style={{ fontFamily: D, color: ORANGE }}>{step.num}</span>
                </div>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
              <p className="text-sm leading-relaxed max-w-xs" style={{ color: MUTED }}>{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ══════════════════════════════════════════════════
   SHOWCASE  — laptop slides from right + parallax
══════════════════════════════════════════════════ */
function ShowcaseSection({ lang }: { lang: Lang }) {
  const tx = t[lang].showcase
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.showcase-heading', {
        y: 40, opacity: 0, duration: 0.8, ease: 'power2.out',
        scrollTrigger: { trigger: '.showcase-heading', start: 'top 86%', once: true },
      })
      gsap.from('.laptop-wrapper', {
        x: 130, opacity: 0, duration: 1.1, ease: 'power3.out',
        scrollTrigger: { trigger: '.laptop-wrapper', start: 'top 82%', once: true },
      })
      gsap.to('.laptop-wrapper', {
        yPercent: -6,
        scrollTrigger: { trigger: sectionRef.current!, start: 'top bottom', end: 'bottom top', scrub: 1.2 },
      })
      gsap.from('.feat-chip', {
        x: 50, opacity: 0, stagger: 0.1, duration: 0.6, ease: 'power2.out',
        scrollTrigger: { trigger: '.feat-chip', start: 'top 90%', once: true },
      })
    }, sectionRef)
    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} className="relative overflow-hidden py-32 px-6" style={{ background: BG }}>
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg,transparent,rgba(255,109,41,0.1),transparent)' }} />
      <div className="absolute pointer-events-none" style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '900px', height: '500px', background: 'radial-gradient(ellipse at 50% 55%, rgba(255,109,41,0.18) 0%, rgba(180,50,0,0.08) 45%, transparent 70%)', filter: 'blur(40px)' }} />

      <div className="relative z-10 max-w-6xl mx-auto">
        <div className="showcase-heading text-center mb-16">
          <Badge text={tx.badge} />
          <SectionHeading white={tx.title1} accent={tx.title2} />
          <p className="text-sm max-w-xl mx-auto leading-relaxed" style={{ color: MUTED }}>{tx.sub}</p>
        </div>

        <div className="laptop-wrapper mx-auto mb-14" style={{ maxWidth: '860px', perspective: '1400px' }}>
          <div style={{ transform: 'rotateX(3.5deg)', transformOrigin: 'bottom center' }}>
            <div style={{ background: 'linear-gradient(180deg,#232325 0%,#2C2C2E 100%)', borderRadius: '14px 14px 0 0', border: '1px solid rgba(255,255,255,0.09)', borderBottom: 'none', padding: '10px 10px 0', boxShadow: '0 -8px 60px rgba(0,0,0,0.7), 0 0 100px rgba(255,109,41,0.12)' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '7px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0A0A0A', boxShadow: '0 0 0 1.5px rgba(255,255,255,0.1), inset 0 0 3px rgba(100,200,255,0.15)' }} />
              </div>
              <div style={{ borderRadius: '7px', overflow: 'hidden', height: '500px', display: 'flex', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.5)' }}>
                <div style={{ width: '200px', flexShrink: 0, background: '#0D0D0F', borderRight: '1px solid rgba(255,255,255,0.05)', padding: '22px 14px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '26px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '10px', color: '#000', flexShrink: 0 }}>SB</div>
                    <span style={{ fontWeight: 700, color: 'white', fontSize: '12px' }}>SalesBoost</span>
                  </div>
                  {['Dashboard', 'Reviews', 'Concorrentes', 'Relatório', 'Config'].map((item, i) => (
                    <div key={item} style={{ padding: '8px 12px', borderRadius: '8px', fontSize: '11px', color: i === 0 ? ORANGE : 'rgba(255,255,255,0.4)', background: i === 0 ? 'rgba(255,109,41,0.1)' : 'transparent', fontWeight: i === 0 ? 600 : 400 }}>{item}</div>
                  ))}
                  <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {[{ name: 'João Silva', stars: '★★★★★', color: '#4ade80' }, { name: 'Maria Costa', stars: '★★★★☆', color: ORANGE }, { name: 'Pedro Lima', stars: '★★★☆☆', color: '#f87171' }].map((r) => (
                      <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)' }}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(255,109,41,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: ORANGE, fontWeight: 700, flexShrink: 0 }}>{r.name[0]}</div>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.55)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                          <div style={{ fontSize: '8px', color: r.color, marginTop: '1px', letterSpacing: '0.04em' }}>{r.stars}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(145deg,#1E0800 0%,#6B2000 22%,#B84A00 44%,#D97018 62%,#F0A040 80%,#FAC870 100%)' }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 28% 38%, rgba(255,220,130,0.18) 0%, transparent 55%)' }} />
                  <div style={{ position: 'relative', zIndex: 1, padding: '26px 28px', height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                      <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Score de Saúde · Jun 2026</div>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        {['Eng ▾', 'Login / Cadastro'].map((b) => (
                          <div key={b} style={{ padding: '4px 10px', borderRadius: '6px', background: 'rgba(0,0,0,0.22)', fontSize: '8px', color: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)' }}>{b}</div>
                        ))}
                      </div>
                    </div>
                    <div style={{ fontFamily: D, fontSize: '9rem', fontWeight: 900, color: 'white', lineHeight: 0.82, letterSpacing: '-0.04em' }}>87</div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.52)', marginTop: '10px' }}>↑ +12 pts vs. mês anterior</div>
                    <div aria-hidden style={{ position: 'absolute', bottom: '-18px', left: '14px', fontFamily: D, fontSize: '7.5rem', fontWeight: 900, color: 'rgba(0,0,0,0.14)', lineHeight: 1, whiteSpace: 'nowrap', pointerEvents: 'none', userSelect: 'none' }}>RELATÓRIO</div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: 'auto', position: 'relative', zIndex: 2 }}>
                      {['Atendimento ↑', 'Preço ok', 'Espera ↓', '3 Ações do Mês'].map((tag) => (
                        <div key={tag} style={{ padding: '5px 13px', borderRadius: '99px', fontSize: '10px', color: 'white', fontWeight: 500, background: 'rgba(0,0,0,0.24)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.13)' }}>{tag}</div>
                      ))}
                    </div>
                  </div>
                  <div style={{ position: 'absolute', right: '18px', top: '18px', width: '155px', display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 2 }}>
                    <div style={{ padding: '11px 13px', borderRadius: '11px', background: 'rgba(0,0,0,0.28)', backdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.45)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Concorrente próx.</div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'white', marginBottom: '2px' }}>Bela Vista Rest.</div>
                      <div style={{ fontSize: '9px', color: ORANGE }}>★ 4.2 · 238 reviews</div>
                    </div>
                    <div style={{ padding: '11px 13px', borderRadius: '11px', background: 'rgba(0,0,0,0.28)', backdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.45)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Top reclamação</div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'white', marginBottom: '2px' }}>Tempo de espera</div>
                      <div style={{ fontSize: '9px', color: '#f87171' }}>73% das 1★ reviews</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ background: 'linear-gradient(180deg,#2C2C2E 0%,#3A3A3C 50%,#2C2C2E 100%)', height: '4px', border: '1px solid rgba(255,255,255,0.06)', borderTop: 'none' }} />
            <div style={{ width: '108%', marginLeft: '-4%', background: 'linear-gradient(180deg,#2C2C2E 0%,#1C1C1E 100%)', borderRadius: '0 0 12px 12px', height: '22px', border: '1px solid rgba(255,255,255,0.07)', borderTop: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '90px', height: '5px', borderRadius: '99px', background: 'rgba(255,255,255,0.07)' }} />
            </div>
            <div style={{ width: '116%', marginLeft: '-8%', background: '#1A1A1C', borderRadius: '0 0 8px 8px', height: '7px', border: '1px solid rgba(255,255,255,0.04)', borderTop: 'none' }} />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
          {tx.features.map((feat) => (
            <div key={feat} className="feat-chip flex items-center gap-2.5 px-4 py-3 rounded-xl" style={{ background: CARD, border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,109,41,0.15)', border: '1px solid rgba(255,109,41,0.3)' }}>
                <svg viewBox="0 0 10 10" className="w-2.5 h-2.5" fill="none" stroke={ORANGE} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M1.5 5l2.5 2.5 4.5-4" /></svg>
              </div>
              <span className="text-xs font-medium text-white leading-tight">{feat}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ══════════════════════════════════════════════════
   STATEMENT  — card from below + blob parallax
══════════════════════════════════════════════════ */
function StatementSection({ lang }: { lang: Lang }) {
  const tx = t[lang].statement
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.statement-card', {
        y: 80, opacity: 0, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: '.statement-card', start: 'top 82%', once: true },
      })
      gsap.to('.blob-1', { yPercent: -22, scrollTrigger: { trigger: sectionRef.current!, start: 'top bottom', end: 'bottom top', scrub: 1.6 } })
      gsap.to('.blob-2', { yPercent: 16, scrollTrigger: { trigger: sectionRef.current!, start: 'top bottom', end: 'bottom top', scrub: 2.2 } })
      gsap.to('.blob-3', { yPercent: -10, scrollTrigger: { trigger: sectionRef.current!, start: 'top bottom', end: 'bottom top', scrub: 1 } })
    }, sectionRef)
    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} className="grain-overlay relative overflow-hidden py-40 px-6" style={{ background: BG }}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="blob-1" style={{ position: 'absolute', top: '10%', left: '20%', width: '500px', height: '500px', background: 'radial-gradient(ellipse,rgba(255,109,41,0.4) 0%,rgba(150,40,0,0.2) 40%,transparent 70%)', filter: 'blur(60px)', borderRadius: '50%' }} />
        <div className="blob-2" style={{ position: 'absolute', top: '30%', right: '15%', width: '350px', height: '350px', background: 'radial-gradient(ellipse,rgba(180,55,0,0.3) 0%,transparent 65%)', filter: 'blur(50px)', borderRadius: '50%' }} />
        <div className="blob-3" style={{ position: 'absolute', bottom: '10%', left: '40%', width: '280px', height: '280px', background: 'radial-gradient(ellipse,rgba(255,109,41,0.2) 0%,transparent 65%)', filter: 'blur(40px)', borderRadius: '50%' }} />
      </div>
      <div className="relative z-10 max-w-2xl mx-auto">
        <div className="statement-card rounded-3xl p-12 md:p-16 relative overflow-hidden" style={{ background: 'rgba(255,109,41,0.07)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,109,41,0.2)', boxShadow: '0 0 60px rgba(255,109,41,0.08)' }}>
          <div className="flex items-center gap-4 mb-8">
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.15)' }} />
            <span style={{ fontSize: '11px', color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase' }}>— {tx.eyebrow}</span>
          </div>
          <h2 className="font-black leading-none mb-6" style={{ fontFamily: D, fontSize: 'clamp(2rem,5vw,3.5rem)' }}>
            <span className="text-white block">{tx.line1}</span>
            <span className="block" style={{ color: ORANGE }}>{tx.line2}</span>
          </h2>
          <p className="mb-10 leading-relaxed" style={{ fontSize: '15px', color: MUTED }}>{tx.sub}</p>
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-2 font-bold text-sm px-7 py-3.5 rounded-xl transition-all" style={{ background: ORANGE, color: '#000', boxShadow: '0 8px 24px rgba(255,109,41,0.3)' }}>
              {tx.cta} <span>→</span>
            </button>
            <div className="ml-auto w-10 h-10 rounded-full flex items-center justify-center" style={{ border: '1px solid rgba(255,109,41,0.35)', color: ORANGE, fontSize: '18px' }}>⊙</div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ══════════════════════════════════════════════════
   PRICING  — cards stagger right → left
══════════════════════════════════════════════════ */
function PricingSection({ lang }: { lang: Lang }) {
  const [region, setRegion] = useState<'br' | 'us'>(lang === 'pt' ? 'br' : 'us')
  const tx = t[lang].pricing
  const plans = tx.regions[region].plans
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.pricing-heading', {
        y: 40, opacity: 0, duration: 0.8, ease: 'power2.out',
        scrollTrigger: { trigger: '.pricing-heading', start: 'top 86%', once: true },
      })
    }, sectionRef)
    return () => ctx.revert()
  }, [])

  useEffect(() => {
    gsap.fromTo('.pricing-card',
      { x: 60, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.65, stagger: 0.18, ease: 'power3.out' }
    )
  }, [region])

  return (
    <section ref={sectionRef} id="pricing" className="relative overflow-hidden py-32 px-6" style={{ background: '#100C0A' }}>
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg,transparent,rgba(255,109,41,0.1),transparent)' }} />
      <Glow w={600} h={400} opacity={0.1} top="50%" left="50%" />
      <div className="relative z-10 max-w-5xl mx-auto">
        <div className="pricing-heading text-center mb-12">
          <Badge text={tx.badge} />
          <SectionHeading white={tx.title1} accent={tx.title2} />
          <div className="inline-flex items-center gap-1 mt-6 p-1 rounded-xl" style={{ background: CARD, border: '1px solid rgba(255,255,255,0.06)' }}>
            {(['br', 'us'] as const).map((r) => (
              <button key={r} onClick={() => setRegion(r)} className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200" style={{ background: region === r ? ORANGE : 'transparent', color: region === r ? '#000' : MUTED }}>
                {tx.regions[r].label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-5 max-w-md mx-auto">
          {plans.map((plan, i) => {
            const isUltra = plan.name === 'Ultra'
            const cardBg   = plan.popular ? '#1E1008' : isUltra ? '#1A0C04' : CARD
            const cardBorder = plan.popular
              ? '2px solid rgba(255,109,41,0.45)'
              : isUltra
              ? '2px solid rgba(255,109,41,0.6)'
              : '1px solid rgba(255,255,255,0.05)'
            const cardShadow = plan.popular
              ? '0 0 40px rgba(255,109,41,0.1)'
              : isUltra
              ? '0 0 40px rgba(255,109,41,0.15)'
              : 'none'
            const checkColor = ORANGE
            const btnStyle = plan.popular
              ? { background: ORANGE, color: '#000', boxShadow: '0 8px 24px rgba(255,109,41,0.25)' } as React.CSSProperties
              : isUltra
              ? { background: ORANGE, color: '#000', boxShadow: '0 8px 24px rgba(255,109,41,0.3)' } as React.CSSProperties
              : { background: 'rgba(255,255,255,0.06)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' } as React.CSSProperties
            return (
            <div key={i} className="pricing-card relative rounded-2xl p-8" style={{ background: cardBg, border: cardBorder, boxShadow: cardShadow }}>
              {plan.popular && (
                <>
                  <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{ background: 'rgba(255,109,41,0.04)' }} />
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <div className="text-xs font-black px-4 py-1.5 rounded-full tracking-wide whitespace-nowrap text-black" style={{ background: ORANGE }}>{tx.popular}</div>
                  </div>
                </>
              )}
              {isUltra && (
                <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{ background: 'rgba(255,109,41,0.04)' }} />
              )}
              <div className="relative">
                <div className="mb-7">
                  <h3 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: isUltra ? ORANGE : MUTED }}>{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-white leading-none" style={{ fontFamily: D, fontSize: '3.2rem', fontWeight: 900 }}>{plan.price}</span>
                    <span className="text-sm ml-1" style={{ color: MUTED }}>{plan.period}</span>
                  </div>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${checkColor}22`, border: `1px solid ${checkColor}55` }}>
                        <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke={checkColor} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" /></svg>
                      </div>
                      <span className="text-sm text-white">{feature}</span>
                    </li>
                  ))}
                </ul>
                <button className="w-full py-3.5 rounded-xl font-bold text-sm transition-all" style={btnStyle}>
                  {tx.cta}
                </button>
              </div>
            </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ══════════════════════════════════════════════════
   FOOTER
══════════════════════════════════════════════════ */
function SiteFooter({ lang, onTrialClick }: { lang: Lang; onTrialClick: () => void }) {
  const tx = t[lang].footer
  const nav = t[lang].nav
  const labels = [nav.features, nav.how, nav.pricing]
  return (
    <footer style={{ background: '#090706', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-3 gap-10 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm text-black" style={{ background: ORANGE }}>SB</div>
              <span className="font-bold text-white text-lg tracking-tight">SalesBoost</span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: MUTED, maxWidth: '260px' }}>{tx.tagline}</p>
            {/* Razão social — exigida pela verificação de negócio da Meta (nome legal no site). */}
            <p className="text-xs mt-4" style={{ color: 'rgba(255,255,255,0.5)', maxWidth: '260px' }}>68.292.967 LUAN SOARES RIBEIRO — CNPJ 68.292.967/0001-28</p>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: 'rgba(255,255,255,0.3)' }}>Menu</div>
            <div className="flex flex-col gap-3">
              {labels.map((label, i) => (
                <a key={label} href={NAV_LINKS[i]} className="text-sm transition-colors w-fit" style={{ color: MUTED }} onMouseEnter={e => (e.currentTarget.style.color = '#fff')} onMouseLeave={e => (e.currentTarget.style.color = MUTED)}>
                  {label}
                </a>
              ))}
            </div>
          </div>
          <div className="flex flex-col justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: 'rgba(255,255,255,0.3)' }}>Começar</div>
              <button onClick={onTrialClick} className="font-bold text-sm px-6 py-3 rounded-xl text-black transition-all" style={{ background: ORANGE, border: 'none', cursor: 'pointer' }}>
                {nav.cta}
              </button>
            </div>
          </div>
        </div>
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="flex items-center gap-5 flex-wrap justify-center">
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>© 68.292.967 LUAN SOARES RIBEIRO — {tx.copy}</p>
            <Link to="/privacidade" className="text-xs transition-colors" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }} onMouseEnter={e => (e.currentTarget.style.color = '#fff')} onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}>
              Política de Privacidade
            </Link>
            <Link to="/termos" className="text-xs transition-colors" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }} onMouseEnter={e => (e.currentTarget.style.color = '#fff')} onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}>
              Termos de Uso
            </Link>
          </div>
          <div className="flex gap-3">
            {['𝕏', 'in', 'ig'].map((s) => (
              <div key={s} className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer" style={{ background: 'rgba(255,255,255,0.05)', color: MUTED }}>{s}</div>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

/* ══════════════════════════════════════════════════
   APP
══════════════════════════════════════════════════ */
export default function App() {
  const [lang, setLang] = useState<Lang>('pt')
  const [trialOpen, setTrialOpen] = useState(false)
  return (
    <div style={{ background: BG }}>
      <FireCursor />
      <Navbar lang={lang} setLang={setLang} onTrialClick={() => setTrialOpen(true)} />
      <HeroSection lang={lang} />
      <StatsSection lang={lang} />
      <FeaturesSection lang={lang} />
      <HowItWorksSection lang={lang} />
      <ShowcaseSection lang={lang} />
      <StatementSection lang={lang} />
      <PricingSection lang={lang} />
      <SiteFooter lang={lang} onTrialClick={() => setTrialOpen(true)} />
      <TrialModal lang={lang} open={trialOpen} onClose={() => setTrialOpen(false)} />
    </div>
  )
}
