// Diagnóstico de Social Selling — o coração do diagnóstico (pedido do dono
// 2026-10-19). Pergunta-guia: "quando um comprador visita este Instagram, o
// que encontra que o ajude a confiar, aprender e dar o próximo passo?".
// A página fica em 3 camadas (organização do dono, mesmo dia):
//   1. O que você está fazendo hoje      → <ContentMix> (+ nota e mercado na página);
//   2. O que você precisa entender sobre geração de demanda → <Principles>
//      (princípios fixos da ficha, com exemplo imobiliário — ensina antes de vender);
//   3. Como aplicar isso ao seu perfil   → <ApplyToProfile> (resposta, 5 pilares
//      ligados aos princípios, oportunidade ignorada e post de exemplo).
// Os dados vêm prontos de diagnostics.social_selling (run-diagnosis +
// _shared/socialSelling.ts). Todo NÚMERO aqui é contagem feita no código;
// os textos da IA não têm número (regra 5). Pilares e "por que importa" vêm
// da ficha do setor (regra 6).

const ORANGE = '#FF6D29'
const MUTED = '#BABABA'
const CARD = '#1A1008'
const BORDER = 'rgba(255,255,255,0.07)'
const D = "'Bricolage Grotesque', system-ui, sans-serif"

export interface SocialSelling {
  v: 1
  created_at: string
  total: number
  categories: { key: string; name: string }[]
  principles?: { key: string; title: string; text: string; example: string; pillar?: string }[]
  posts: { i: number; c: string; excerpt: string; ts: string | null }[]
  counts: Record<string, number>
  pillars: { key: string; name: string; question: string; why: string; level: 'forte' | 'parcial' | 'ausente'; count: number; evidence: number[]; note: string }[]
  answer: string
  opportunity: { gap: string; consequence: string; shift: string } | null
  example: { format: string; hook: string; outline: string; goal: string } | null
}

type L = 'pt' | 'en'
const TX = {
  pt: {
    layers: [
      ['O que você está fazendo hoje', 'Seu Instagram, seus formatos e o seu mercado — o que já funciona como vitrine e o que ainda não está sendo explorado.'],
      ['O que você precisa entender sobre geração de demanda', 'Princípios que valem pra qualquer corretor — com ou sem o Sales Boost.'],
      ['Como aplicar isso ao seu perfil', 'Os princípios acima, aplicados ao que lemos no seu Instagram.'],
    ],
    works: 'O que já funciona como vitrine', worksStart: 'Já existe um começo em', worksNone: 'Ainda não vimos nenhum pilar forte no seu perfil — é exatamente aí que está a oportunidade.',
    prEx: 'Na prática', prClose: 'Nenhum desses princípios depende de ferramenta: dá pra começar a aplicar hoje. O que o Sales Boost faz é aplicar todos, toda semana, com o seu perfil e os seus imóveis.',
    principle: 'Princípio',
    kicker: 'O que seu Instagram transmite',
    title: 'Quando um comprador visita o seu perfil, o que ele encontra?',
    mix: (n: number) => `Do que falam os seus ${n} posts mais recentes que lemos:`,
    pillarsT: 'Os 5 pilares do Social Selling',
    pillarsS: 'Social Selling é usar o Instagram pra construir confiança e facilitar a conversa — não só pra divulgar imóvel.',
    level: { forte: 'Forte', parcial: 'Parcial', ausente: 'Ausente' },
    shows: (n: number, of: number) => `${n} de ${of} posts mostram isso`,
    why: 'Por que importa',
    evidence: 'No seu perfil',
    oppK: 'A oportunidade que você pode estar ignorando',
    oppC: 'O que isso pode custar', oppS: 'Um novo jeito de pensar',
    exK: 'O raciocínio do Sales Boost',
    exT: 'Um post pensado pra este perfil',
    hook: 'Primeira frase', outline: 'O que o post mostra', goal: 'Objetivo estratégico',
    exNote: 'Exemplo criado a partir do que lemos no seu perfil. No painel, o Sales Boost planeja e cria posts assim toda semana — e nada vai ao ar sem a sua aprovação.',
    ai: 'Análise feita por IA a partir das legendas públicas. As contagens são do seu perfil; o resto é interpretação, não promessa.',
  },
  en: {
    layers: [
      ['What you are doing today', 'Your Instagram, your formats and your market — what already works as a showcase and what is still untapped.'],
      ['What you need to understand about demand generation', 'Principles that apply to any agent — with or without Sales Boost.'],
      ['How to apply it to your profile', 'The principles above, applied to what we read on your Instagram.'],
    ],
    works: 'What already works as a showcase', worksStart: 'There is a start in', worksNone: 'We have not seen a strong pillar on your profile yet — that is exactly where the opportunity is.',
    prEx: 'In practice', prClose: 'None of these principles depends on a tool: you can start applying them today. Sales Boost applies all of them, every week, with your profile and your listings.',
    principle: 'Principle',
    kicker: 'What your Instagram conveys',
    title: 'When a buyer visits your profile, what do they find?',
    mix: (n: number) => `What your ${n} most recent posts we read are about:`,
    pillarsT: 'The 5 pillars of Social Selling',
    pillarsS: 'Social Selling means using Instagram to build trust and make conversations easier — not just to advertise listings.',
    level: { forte: 'Strong', parcial: 'Partial', ausente: 'Missing' },
    shows: (n: number, of: number) => `${n} of ${of} posts show this`,
    why: 'Why it matters',
    evidence: 'On your profile',
    oppK: 'The opportunity you may be missing',
    oppC: 'What it may cost you', oppS: 'A new way to think',
    exK: 'How Sales Boost thinks',
    exT: 'A post designed for this profile',
    hook: 'Opening line', outline: 'What the post shows', goal: 'Strategic goal',
    exNote: 'Example built from what we read on your profile. In the dashboard, Sales Boost plans and creates posts like this every week — and nothing goes live without your approval.',
    ai: 'AI analysis of your public captions. Counts come from your profile; the rest is interpretation, not a promise.',
  },
} as const

const LEVEL_COLOR = { forte: '#4ade80', parcial: '#FB923C', ausente: '#f87171' } as const
const MIX_COLORS = ['#FF6D29', '#4ade80', '#60a5fa', '#facc15', '#c084fc', '#f472b6', '#9CA3AF']

const kicker = (color: string): React.CSSProperties => ({ fontSize: 11, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 })
const label = (color: string): React.CSSProperties => ({ fontSize: 10.5, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '10px 0 3px' })
const dm = (ts: string | null) => { if (!ts) return ''; const d = new Date(ts); return Number.isNaN(d.getTime()) ? '' : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}` }

const mixOf = (ss: SocialSelling) => ss.categories.map((c, k) => ({ ...c, n: ss.counts[c.key] ?? 0, color: MIX_COLORS[k % MIX_COLORS.length] })).filter(c => c.n > 0 || c.key !== 'outro')

// Título de cada camada (1, 2, 3).
export function LayerHeader({ n, lang }: { n: 1 | 2 | 3; lang: L }) {
  const [title, sub] = TX[lang].layers[n - 1]
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', margin: n === 1 ? '0 0 14px' : '32px 0 14px' }}>
      <span aria-hidden style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 99, background: ORANGE, color: '#000', fontFamily: D, fontWeight: 900, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n}</span>
      <div>
        <h2 style={{ fontFamily: D, fontSize: '1.2rem', fontWeight: 900, color: 'white', letterSpacing: '-0.02em', lineHeight: 1.2, margin: '2px 0 4px' }}>{title}</h2>
        <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.5, margin: 0 }}>{sub}</p>
      </div>
    </div>
  )
}

// Camada 1: do que falam os posts + o que já funciona como vitrine.
export function ContentMix({ ss, lang }: { ss: SocialSelling; lang: L }) {
  const t = TX[lang]
  const total = Math.max(ss.total, 1)
  const mix = mixOf(ss)
  const strong = ss.pillars.filter(p => p.level === 'forte')
  const partial = ss.pillars.filter(p => p.level === 'parcial')
  return (
    <section style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 20, padding: 20, marginBottom: 20 }}>
      <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 8 }}>{t.mix(ss.total)}</div>
      <div role="img" aria-label={mix.filter(c => c.n).map(c => `${c.name}: ${c.n}`).join(', ')}
        style={{ display: 'flex', height: 12, borderRadius: 99, overflow: 'hidden', background: 'rgba(255,255,255,0.06)', marginBottom: 10 }}>
        {mix.filter(c => c.n).map(c => <div key={c.key} style={{ width: `${(c.n / total) * 100}%`, background: c.color }} />)}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px' }}>
        {mix.map(c => (
          <span key={c.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: c.n ? 'white' : MUTED }}>
            <span aria-hidden style={{ width: 9, height: 9, borderRadius: 3, background: c.n ? c.color : 'transparent', border: c.n ? 'none' : `1px solid ${MUTED}` }} />
            {c.name} <strong style={{ color: c.n ? 'white' : '#f87171' }}>{c.n}</strong>
          </span>
        ))}
      </div>
      <div style={label('#4ade80')}>{t.works}</div>
      {strong.length > 0 ? strong.map(p => (
        <p key={p.key} style={{ fontSize: 13.5, color: 'white', lineHeight: 1.6, margin: '4px 0 0' }}><strong>{p.name}</strong>{p.note ? ` — ${p.note}` : ''}</p>
      )) : partial.length > 0 ? (
        <p style={{ fontSize: 13.5, color: 'white', lineHeight: 1.6, margin: '4px 0 0' }}>{t.worksStart}: {partial.map(p => p.name).join(', ')}.</p>
      ) : (
        <p style={{ fontSize: 13.5, color: 'white', lineHeight: 1.6, margin: '4px 0 0' }}>{t.worksNone}</p>
      )}
    </section>
  )
}

// Camada 2: princípios de geração de demanda (texto fixo da ficha).
export function Principles({ ss, lang }: { ss: SocialSelling; lang: L }) {
  const t = TX[lang]
  const list = ss.principles ?? []
  if (!list.length) return null
  return (
    <>
      {list.map((pr, k) => (
        <section key={pr.key} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 18, marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
            <span style={{ fontFamily: D, fontWeight: 900, color: ORANGE, fontSize: 15 }}>{k + 1}.</span>
            <h3 style={{ fontFamily: D, fontSize: '1.02rem', fontWeight: 800, color: 'white', lineHeight: 1.3, margin: 0 }}>{pr.title}</h3>
          </div>
          {pr.text && <p style={{ fontSize: 13.5, color: '#E5E5E5', lineHeight: 1.6, margin: '6px 0 0' }}>{pr.text}</p>}
          {pr.example && (<><div style={label(ORANGE)}>{t.prEx}</div><p style={{ fontSize: 13, color: MUTED, lineHeight: 1.6, margin: 0 }}>{pr.example}</p></>)}
        </section>
      ))}
      <p style={{ fontSize: 13, color: 'white', lineHeight: 1.6, margin: '4px 0 0' }}>{t.prClose}</p>
    </>
  )
}

// Camada 3: resposta à pergunta-guia, pilares ligados aos princípios, oportunidade e exemplo.
export function ApplyToProfile({ ss, lang }: { ss: SocialSelling; lang: L }) {
  const t = TX[lang]
  const postBy = new Map(ss.posts.map(p => [p.i, p]))
  const principleOf = (pillar: string) => (ss.principles ?? []).find(pr => pr.pillar === pillar)

  return (
    <>
      <section style={{ background: CARD, border: '1px solid rgba(255,109,41,0.3)', borderRadius: 20, padding: 20, marginBottom: 20 }}>
        <div style={kicker(ORANGE)}>{t.kicker}</div>
        <h3 style={{ fontFamily: D, fontSize: '1.2rem', fontWeight: 900, color: 'white', letterSpacing: '-0.02em', lineHeight: 1.2, margin: '0 0 10px' }}>{t.title}</h3>
        {ss.answer && <p style={{ fontSize: 14.5, color: 'white', lineHeight: 1.6, margin: 0 }}>{ss.answer}</p>}
      </section>

      <section style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 20, padding: 20, marginBottom: 20 }}>
        <h3 style={{ fontFamily: D, fontSize: '1.05rem', fontWeight: 800, color: 'white', margin: '0 0 4px' }}>{t.pillarsT}</h3>
        <p style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.6, margin: '0 0 6px' }}>{t.pillarsS}</p>
        {ss.pillars.map(p => {
          const c = LEVEL_COLOR[p.level] ?? MUTED
          const ev = p.evidence.map(i => postBy.get(i)).filter(Boolean).slice(0, 2)
          const pr = principleOf(p.key)
          return (
            <div key={p.key} style={{ padding: '14px 0 4px', borderTop: `1px solid ${BORDER}`, marginTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: 'white' }}>{p.name}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: c, background: `${c}1f`, border: `1px solid ${c}55`, borderRadius: 99, padding: '3px 10px' }}>{t.level[p.level]}</span>
              </div>
              <div style={{ fontSize: 13, color: MUTED, margin: '3px 0 6px' }}>{p.question}</div>
              {pr && <div style={{ fontSize: 12, color: ORANGE, margin: '0 0 6px' }}>{t.principle}: {pr.title}</div>}
              <div style={{ fontSize: 12.5, fontWeight: 700, color: c, marginBottom: 6 }}>{t.shows(Math.min(p.count, ss.total), ss.total)}</div>
              {p.note && <p style={{ fontSize: 13.5, color: 'white', lineHeight: 1.6, margin: '0 0 4px' }}>{p.note}</p>}
              {ev.length > 0 && (
                <>
                  <div style={label(ORANGE)}>{t.evidence}</div>
                  {ev.map(e => (
                    <div key={e!.i} style={{ fontSize: 12.5, color: '#E5E5E5', lineHeight: 1.5, borderLeft: '2px solid rgba(255,109,41,0.4)', padding: '2px 0 2px 10px', margin: '4px 0', overflowWrap: 'anywhere' }}>
                      “{e!.excerpt}{e!.excerpt.length >= 140 ? '…' : ''}”{dm(e!.ts) && <span style={{ color: MUTED }}> · {dm(e!.ts)}</span>}
                    </div>
                  ))}
                </>
              )}
              {p.why && (
                <>
                  <div style={label('#4ade80')}>{t.why}</div>
                  <p style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.6, margin: 0 }}>{p.why}</p>
                </>
              )}
            </div>
          )
        })}
      </section>

      {/* A oportunidade que você pode estar ignorando */}
      {ss.opportunity && (
        <section style={{ background: 'linear-gradient(135deg, rgba(255,109,41,0.16), rgba(255,109,41,0.04))', border: '1px solid rgba(255,109,41,0.45)', borderRadius: 20, padding: 20, marginBottom: 20 }}>
          <div style={kicker(ORANGE)}>{t.oppK}</div>
          <p style={{ fontFamily: D, fontSize: '1.08rem', fontWeight: 800, color: 'white', lineHeight: 1.4, margin: 0 }}>{ss.opportunity.gap}</p>
          {ss.opportunity.consequence && (<><div style={label(ORANGE)}>{t.oppC}</div><p style={{ fontSize: 13.5, color: '#E5E5E5', lineHeight: 1.6, margin: 0 }}>{ss.opportunity.consequence}</p></>)}
          {ss.opportunity.shift && (<><div style={label('#4ade80')}>{t.oppS}</div><p style={{ fontSize: 13.5, color: 'white', lineHeight: 1.6, margin: 0 }}>{ss.opportunity.shift}</p></>)}
        </section>
      )}

      {/* O raciocínio do Sales Boost */}
      {ss.example && (
        <section style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 20, padding: 20, marginBottom: 20 }}>
          <div style={kicker('#4ade80')}>{t.exK}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
            <h3 style={{ fontFamily: D, fontSize: '1.05rem', fontWeight: 800, color: 'white', margin: 0 }}>{t.exT}</h3>
            {ss.example.format && <span style={{ fontSize: 11, fontWeight: 800, color: ORANGE, border: '1px solid rgba(255,109,41,0.4)', borderRadius: 99, padding: '2px 9px', textTransform: 'uppercase' }}>{ss.example.format}</span>}
          </div>
          <div style={label(ORANGE)}>{t.hook}</div>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'white', lineHeight: 1.5, margin: 0 }}>“{ss.example.hook}”</p>
          {ss.example.outline && (<><div style={label(ORANGE)}>{t.outline}</div><p style={{ fontSize: 13.5, color: '#E5E5E5', lineHeight: 1.6, margin: 0 }}>{ss.example.outline}</p></>)}
          <div style={label('#4ade80')}>{t.goal}</div>
          <p style={{ fontSize: 13.5, color: 'white', lineHeight: 1.6, margin: '0 0 12px' }}>{ss.example.goal}</p>
          <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.6, margin: 0 }}>{t.exNote}</p>
        </section>
      )}
      <p style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.6, margin: '-8px 0 20px' }}>{t.ai}</p>
    </>
  )
}
