import { useEffect, useState } from 'react'
import { fetchVerticalKey } from '../../lib/verticalPlaybook'
import { fetchOnboardingV2, type DiagnosisReadiness } from '../../lib/onboardingV2'
import type { InstagramData } from '../../lib/growthScore'

// "Seu Instagram está pronto pra gerar conversas?" (pedido do dono 2026-10-16:
// o diagnóstico tem que mostrar a dor de presença que não vira oportunidade,
// não só curtidas). Três camadas, sem misturar:
//   - Dado observado: contado no Instagram público (legendas, bio, posts).
//   - Análise: o que esse dado indica.
//   - Hipótese a validar: o que pode melhorar — não é promessa.
// Padrões (chamada, pergunta, bio, bairros) vêm da ficha do setor
// (config.onboarding_v2.diagnosis_readiness) — regra 6. Sem ficha, a seção
// não aparece. Diagnóstico antigo (sem legendas) mostra só o que dá pra ver.

const ORANGE = '#FF6D29'
const MUTED = '#BABABA'
const GREEN = '#4ade80'
const CARD = '#1A1008'
const BORDER = 'rgba(255,255,255,0.07)'
const D = "'Bricolage Grotesque', system-ui, sans-serif"

type L = 'pt' | 'en'
const TX = {
  pt: {
    title: 'Seu Instagram está pronto pra gerar conversas?',
    sub: 'Curtida não agenda visita. Aqui olhamos o que faz alguém sair do post e falar com você.',
    observed: 'O que vimos', analysis: 'O que isso indica', hypo: 'Oportunidades a validar',
    observedTag: 'Dado observado', analysisTag: 'Análise', hypoTag: 'Hipótese — não é promessa',
    signals: (a: number, b: number) => `${a} de ${b} sinais de conversa presentes`,
    cta: (n: number, of: number) => `${n} de ${of} posts recentes chamam pra uma conversa (comentar, chamar no WhatsApp, agendar)`,
    region: (n: number, of: number, label: string) => `${n} de ${of} posts recentes citam um ${label}`,
    video: (d: number | null, of: number) => d === null ? `Nenhum vídeo/Reels nos ${of} posts mais recentes` : `Último vídeo/Reels há ${d} dia(s)`,
    questions: (n: number) => n === 1 ? '1 comentário recente com cara de pergunta (valor, disponibilidade, localização)' : `${n} comentários recentes com cara de pergunta (valor, disponibilidade, localização)`,
    noCaptions: 'Este diagnóstico é anterior à leitura das legendas — refaça pra ver as chamadas e os bairros dos seus posts.',
    aCta: 'A maior parte dos posts mostra o imóvel mas não diz o que fazer em seguida — quem se interessa precisa adivinhar como falar com você.',
    aRegion: (label: string) => `Quem procura imóvel procura por ${label}. Post sem localização tende a ser achado por menos gente da região certa.`,
    aVideo: 'Vídeo é o formato que o Instagram mais mostra pra quem ainda não te segue — sem ele, o alcance fica nos seguidores de sempre.',
    aBio: (items: string) => `Faltam na bio: ${items}. É o primeiro lugar que o interessado olha antes de chamar.`,
    aQuestions: 'Gente já está perguntando nos comentários. Cada pergunta sem resposta rápida é uma conversa que pode esfriar.',
    hCta: (ex: string) => `Colocar uma chamada clara em todo post (ex.: "${ex}") pode transformar parte das curtidas em conversa. O Sales Boost mede isso pra você.`,
    hRegion: (label: string) => `Citar o ${label} e o que tem perto do imóvel pode atrair quem já procura naquela região.`,
    hVideo: 'Um Reels curto por imóvel (tour com as suas fotos reais) pode levar o imóvel a quem ainda não te conhece.',
    hBio: 'Ajustar a bio leva poucos minutos e deixa o caminho até a conversa mais curto.',
    hQuestions: 'Responder rápido e levar a conversa pro direct (com a sua aprovação) pode virar visita — é o "Comente QUERO" do Sales Boost.',
    allGood: 'Nos sinais que conseguimos ver, seu perfil já convida a conversa. O próximo passo é ganhar escala sem trabalho manual.',
    bioOk: 'presente', bioMissing: 'não encontramos',
  },
  en: {
    title: 'Is your Instagram ready to generate conversations?',
    sub: "Likes don't book viewings. Here we look at what makes someone leave the post and talk to you.",
    observed: 'What we saw', analysis: 'What it means', hypo: 'Opportunities to validate',
    observedTag: 'Observed data', analysisTag: 'Analysis', hypoTag: 'Hypothesis — not a promise',
    signals: (a: number, b: number) => `${a} of ${b} conversation signals present`,
    cta: (n: number, of: number) => `${n} of ${of} recent posts invite a conversation (comment, WhatsApp, book a viewing)`,
    region: (n: number, of: number, label: string) => `${n} of ${of} recent posts mention a ${label}`,
    video: (d: number | null, of: number) => d === null ? `No video/Reels in the ${of} most recent posts` : `Last video/Reels ${d} day(s) ago`,
    questions: (n: number) => `${n} recent comment(s) that look like questions (price, availability, location)`,
    noCaptions: 'This diagnosis predates caption reading — run it again to see the calls to action and locations in your posts.',
    aCta: "Most posts show the property but don't say what to do next — interested people have to guess how to reach you.",
    aRegion: (label: string) => `People look for property by ${label}. Posts without a location tend to reach fewer people in the right area.`,
    aVideo: 'Video is the format Instagram shows most to people who do not follow you yet — without it, reach stays with your current followers.',
    aBio: (items: string) => `Missing from your bio: ${items}. It's the first place an interested person checks before reaching out.`,
    aQuestions: 'People are already asking in the comments. Every question without a quick reply is a conversation that may cool down.',
    hCta: (ex: string) => `A clear call to action on every post (e.g. "${ex}") may turn part of the likes into conversations. Sales Boost measures it for you.`,
    hRegion: (label: string) => `Mentioning the ${label} and what is nearby may attract people already searching there.`,
    hVideo: 'A short Reels per property (a tour with your real photos) may take it to people who do not know you yet.',
    hBio: 'Fixing the bio takes minutes and shortens the path to a conversation.',
    hQuestions: 'Replying fast and moving the conversation to DMs (with your approval) may turn into a viewing — that is Sales Boost\'s "Comment WANT".',
    allGood: 'In the signals we can see, your profile already invites conversation. The next step is to scale without manual work.',
    bioOk: 'present', bioMissing: 'not found',
  },
} as const

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
function safeRe(pattern: string | undefined): RegExp | null {
  if (!pattern) return null
  try { return new RegExp(pattern, 'i') } catch { return null }
}

export default function ReadinessSection({ ig, businessType, answers, lang }: {
  ig: InstagramData | null; businessType: string; answers: Record<string, unknown>; lang: L
}) {
  const t = TX[lang]
  const [cfg, setCfg] = useState<DiagnosisReadiness | null>(null)
  useEffect(() => {
    let alive = true
    void fetchVerticalKey(businessType).then(fetchOnboardingV2).then(v2 => { if (alive) setCfg(v2?.diagnosis_readiness ?? null) })
    return () => { alive = false }
  }, [businessType])
  if (!cfg || !ig || ig.error) return null

  const posts = ig.posts ?? []
  const withCaption = posts.filter(p => typeof p.caption === 'string')
  const ctaRe = safeRe(cfg.cta_pattern)
  const qRe = safeRe(cfg.question_pattern)
  const label = cfg.region_label ?? (lang === 'pt' ? 'bairro ou região' : 'neighborhood or area')
  const userAreas = Array.isArray(answers.bairros) ? answers.bairros.map(String) : []
  const terms = [...userAreas, ...(cfg.region_terms ?? [])].map(norm).filter(x => x.length >= 3)

  const ctaN = ctaRe ? withCaption.filter(p => ctaRe.test(p.caption ?? '')).length : 0
  const regionN = withCaption.filter(p => { const c = norm(p.caption ?? ''); return terms.some(x => c.includes(x)) }).length
  const videos = posts.filter(p => p.is_video === true && p.ts).map(p => new Date(p.ts!).getTime()).sort((a, b) => b - a)
  const lastVideoDays = videos.length ? Math.floor((Date.now() - videos[0]) / 86400000) : null
  const bio = ig.biography ?? ''
  const bioChecks = (cfg.bio_checks ?? []).map(c => {
    const re = safeRe(c.pattern)
    const viaAnswers = c.use_answers ? terms.some(x => norm(bio).includes(x)) : false
    return { label: c.label, short: c.short ?? c.label, ok: !!bio && ((re?.test(bio) ?? false) || viaAnswers) }
  })
  const hasComments = posts.some(p => Array.isArray(p.comment_samples))
  const questionN = hasComments && qRe ? posts.flatMap(p => p.comment_samples ?? []).filter(c => !c.by_owner && qRe.test(c.text)).length : 0

  // Sinais (só os que dá pra medir neste diagnóstico).
  const half = (n: number, of: number) => of > 0 && n / of >= 0.5
  const signals: { key: string; ok: boolean }[] = []
  if (withCaption.length) {
    signals.push({ key: 'cta', ok: half(ctaN, withCaption.length) })
    signals.push({ key: 'region', ok: half(regionN, withCaption.length) })
  }
  if (posts.length) signals.push({ key: 'video', ok: lastVideoDays !== null && lastVideoDays <= 30 })
  for (const b of bioChecks) signals.push({ key: `bio:${b.label}`, ok: b.ok })
  if (hasComments) signals.push({ key: 'questions', ok: questionN === 0 })
  if (!signals.length) return null
  const okN = signals.filter(s => s.ok).length
  const bad = (k: string) => signals.some(s => s.key === k && !s.ok)
  const bioMissing = bioChecks.filter(b => !b.ok).map(b => b.short)

  const analyses: string[] = []
  const hypos: string[] = []
  if (bad('cta')) { analyses.push(t.aCta); hypos.push(t.hCta(cfg.cta_example ?? (lang === 'pt' ? 'Comente QUERO' : 'Comment WANT'))) }
  if (bad('region')) { analyses.push(t.aRegion(label)); hypos.push(t.hRegion(label)) }
  if (bad('video')) { analyses.push(t.aVideo); hypos.push(t.hVideo) }
  if (bioMissing.length) { analyses.push(t.aBio(bioMissing.join(', '))); hypos.push(t.hBio) }
  if (questionN > 0) { analyses.push(t.aQuestions); hypos.push(t.hQuestions) }

  const tag = (txt: string, color: string) => (
    <span style={{ fontSize: '10px', fontWeight: 800, color, border: `1px solid ${color}55`, borderRadius: '99px', padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{txt}</span>
  )
  const h3 = (txt: string, tg: React.ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', margin: '16px 0 8px' }}>
      <span style={{ fontSize: '13px', fontWeight: 800, color: 'white' }}>{txt}</span>{tg}
    </div>
  )
  const row = (ok: boolean, text: string) => (
    <div style={{ display: 'flex', gap: '8px', fontSize: '13px', color: 'white', lineHeight: 1.5, marginBottom: '6px' }}>
      <span style={{ color: ok ? GREEN : ORANGE, flexShrink: 0 }}>{ok ? '✓' : '•'}</span><span>{text}</span>
    </div>
  )

  return (
    <section style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '18px', padding: '20px', margin: '16px 0' }}>
      <h2 style={{ fontFamily: D, fontSize: '1.15rem', fontWeight: 800, color: 'white', margin: '0 0 4px' }}>{t.title}</h2>
      <p style={{ fontSize: '13px', color: MUTED, margin: '0 0 10px', lineHeight: 1.55 }}>{t.sub}</p>
      <div style={{ fontSize: '13px', fontWeight: 700, color: okN === signals.length ? GREEN : ORANGE }}>{t.signals(okN, signals.length)}</div>

      {h3(t.observed, tag(t.observedTag, GREEN))}
      {withCaption.length > 0 ? (
        <>
          {row(!bad('cta'), t.cta(ctaN, withCaption.length))}
          {row(!bad('region'), t.region(regionN, withCaption.length, label))}
        </>
      ) : posts.length > 0 && <div style={{ fontSize: '12px', color: MUTED, marginBottom: '6px' }}>{t.noCaptions}</div>}
      {posts.length > 0 && row(!bad('video'), t.video(lastVideoDays, posts.length))}
      {bioChecks.map(b => row(b.ok, `${b.label}: ${b.ok ? t.bioOk : t.bioMissing}`))}
      {hasComments && questionN > 0 && row(false, t.questions(questionN))}

      {analyses.length > 0 ? (
        <>
          {h3(t.analysis, tag(t.analysisTag, ORANGE))}
          {analyses.map(a => <p key={a} style={{ fontSize: '13px', color: 'white', lineHeight: 1.55, margin: '0 0 8px' }}>{a}</p>)}
          {h3(t.hypo, tag(t.hypoTag, MUTED))}
          {hypos.map(h => <p key={h} style={{ fontSize: '13px', color: MUTED, lineHeight: 1.55, margin: '0 0 8px' }}>{h}</p>)}
        </>
      ) : <p style={{ fontSize: '13px', color: GREEN, lineHeight: 1.55, margin: '12px 0 0' }}>{t.allGood}</p>}
    </section>
  )
}
