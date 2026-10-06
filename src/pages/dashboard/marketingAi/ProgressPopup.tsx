import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCompany } from '../../../contexts/CompanyContext'
import { useAuth } from '../../../contexts/AuthContext'
import { D } from './shared'
import { buildProgress, choosePopup, fetchRealSignals, type ProgressData, type PopupVariant } from './progressGame'
import { BlurredValue } from './progressParts'
import { fetchDiscoveries, revealDiscovery, DiscoveryChip, DiscoveryReveal, type Discovery } from './Discoveries'

const ORANGE = '#FF6D29'
const GREEN = '#4ade80'
const MUTED = '#BABABA'
const LS_SHOWN = 'sb_popup_last_shown'
const LS_LEAGUE = 'sb_seen_league'
const LS_STREAK = 'sb_seen_streak'

const today = () => new Date().toISOString().slice(0, 10)

// Popup inteligente: NUNCA pede trabalho. Revela o que a IA já fez e onde o
// negócio está. Aparece 1x/dia ao abrir a plataforma; escolhe a variante mais
// relevante pelos dados reais.
export default function ProgressPopup() {
  const { company } = useCompany()
  const { session } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState<ProgressData | null>(null)
  const [variant, setVariant] = useState<PopupVariant>('status')
  const [open, setOpen] = useState(false)
  const [pendingDisc, setPendingDisc] = useState<Discovery[]>([])
  const [revealedDisc, setRevealedDisc] = useState<Discovery | null>(null)
  const [revealing, setRevealing] = useState(false)

  useEffect(() => {
    if (!company?.id) return
    let lastShown: string | null = null
    try { lastShown = localStorage.getItem(LS_SHOWN) } catch { /* ignore */ }
    if (lastShown === today()) return // já mostrou hoje

    let alive = true
    ;(async () => {
      const cid = company.id
      const daysSinceVisit = lastShown ? Math.max(1, Math.round((Date.now() - new Date(lastShown).getTime()) / 86400000)) : 1
      // Só números reais (progress_events, leads, posts…); o que não tem fonte vem null → embaçado.
      const real = await fetchRealSignals(cid, lastShown ? new Date(lastShown).toISOString() : null, daysSinceVisit)
      const d = buildProgress(real)

      let lastSeenLeague: string | null = null, lastStreakSeen = 0
      try { lastSeenLeague = localStorage.getItem(LS_LEAGUE); lastStreakSeen = Number(localStorage.getItem(LS_STREAK) ?? '0') } catch { /* ignore */ }
      const v = choosePopup(d, { daysSinceVisit, lastSeenLeague, lastStreakSeen })

      // Descobertas reais (curadas) — só surge o chip se houver algo notável.
      if (session) {
        try { const { pending } = await fetchDiscoveries(session.access_token, cid); if (alive) setPendingDisc(pending) } catch { /* opcional */ }
      }

      if (!alive) return
      setData(d); setVariant(v); setOpen(true)
    })()
    return () => { alive = false }
  }, [company?.id, session])

  const revealFirst = async () => {
    if (!company?.id || !session || pendingDisc.length === 0 || revealing) return
    setRevealing(true)
    const d = await revealDiscovery(session.access_token, company.id, pendingDisc[0].id)
    setRevealing(false)
    if (d) { setRevealedDisc(d); setPendingDisc(prev => prev.slice(1)) }
  }

  const dismiss = (go?: boolean) => {
    try {
      localStorage.setItem(LS_SHOWN, today())
      if (data) { localStorage.setItem(LS_LEAGUE, data.level.key); localStorage.setItem(LS_STREAK, String(data.streak ?? 0)) }
    } catch { /* ignore */ }
    setOpen(false)
    if (go) navigate('/dashboard/progresso')
  }

  if (!open || !data) return null
  const d = data
  const c = d.level.color
  const xp = (n: number) => n.toLocaleString('pt-BR')
  const num = (v: number | null, f: (n: number) => string = String) => v == null ? <BlurredValue hint={false} /> : f(v)
  const pct = (v: number | null) => v == null ? <BlurredValue kind="pct" hint={false} /> : `${v}%`

  const Bar = ({ pct, color }: { pct: number; color: string }) => (
    <div style={{ height: '12px', background: 'rgba(255,255,255,0.09)', borderRadius: '99px', overflow: 'hidden', margin: '4px 0 8px' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${color}, #ffffff88)`, borderRadius: '99px' }} />
    </div>
  )
  const Metric = ({ icon, label, value, color }: { icon: string; label: string; value: React.ReactNode; color?: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ fontSize: '13px', color: MUTED }}>{icon} {label}</span>
      <span style={{ fontSize: '15px', fontWeight: 800, color: color ?? 'white', textAlign: 'right' }}>{value}</span>
    </div>
  )
  const CTA = ({ label }: { label: string }) => (
    <button onClick={() => dismiss(true)} style={{ width: '100%', marginTop: '18px', padding: '13px', background: ORANGE, color: '#000', fontWeight: 800, fontSize: '13.5px', border: 'none', borderRadius: '11px', cursor: 'pointer', fontFamily: D, letterSpacing: '0.02em' }}>{label}</button>
  )

  const nextName = d.nextLevel?.name ?? 'Master'

  const body = () => {
    switch (variant) {
      case 'results': return (<>
        <Title emoji="🚀" text="BOM DIA, CONSTRUTOR DE NEGÓCIO" />
        <Sub>Resultados reais desde a sua última visita.</Sub>
        <div style={{ margin: '14px 0' }}>
          <Metric icon="📈" label="Alcance" value={pct(d.reachPct)} color={GREEN} />
          <Metric icon="❤️" label="Engajamento" value={pct(d.engagementPct)} color={GREEN} />
          <Metric icon="🤖" label="Ações da IA" value={num(d.actionsCount)} />
          <Metric icon="🟢" label="XP ganhos" value={num(d.gpEarnedSinceVisit, n => `+${xp(n)}`)} color={c} />
        </div>
        <LeagueLine d={d} c={c} />
        <Bar pct={d.levelPct} color={c} />
        {d.nextLevel && <div style={{ fontSize: '12.5px', color: 'white' }}>Faltam <strong>{xp(d.gpToNext)} XP</strong> para a <strong>{nextName} League</strong>.</div>}
        <CTA label="VER MEU PROGRESSO →" />
      </>)
      case 'status': return (<>
        <Title emoji="🏆" text="SEU STATUS DE NEGÓCIO" />
        <div style={{ textAlign: 'center', margin: '10px 0 14px' }}>
          <div style={{ fontSize: '46px', lineHeight: 1 }}>{d.level.icon}</div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: c, marginTop: '6px' }}>{d.level.name.toUpperCase()} BUSINESS</div>
          <div style={{ fontSize: '12px', color: MUTED }}>{d.level.identity}</div>
        </div>
        <Bar pct={d.totalGp == null ? 0 : d.levelPct} color={c} />
        <div style={{ textAlign: 'center', fontSize: '18px', fontWeight: 900, color: 'white' }}>{d.totalGp == null ? <BlurredValue kind="xp" /> : `${xp(d.totalGp)} XP`}</div>
        {d.hasRealData ? (
          <div style={{ textAlign: 'center', fontSize: '12.5px', color: MUTED, marginTop: '6px' }}>Você está na <strong style={{ color: c }}>{d.level.name} League</strong>.</div>
        ) : (<>
          <div style={{ textAlign: 'center', fontSize: '13px', color: 'white', lineHeight: 1.5, marginTop: '12px' }}>Hermes começou a trabalhar — os primeiros resultados aparecem aqui assim que houver dados reais.</div>
          <div style={{ margin: '12px 0 0' }}>
            <Metric icon="📈" label="Alcance" value={<BlurredValue kind="pct" />} />
            <Metric icon="❤️" label="Engajamento" value={d.engagementPct == null ? <BlurredValue kind="pct" /> : `${d.engagementPct}%`} />
            <Metric icon="🤖" label="Ações da IA" value={<BlurredValue />} />
          </div>
        </>)}
        {(d.streak ?? 0) >= 2 && <div style={{ textAlign: 'center', fontSize: '13px', color: ORANGE, fontWeight: 700, marginTop: '10px' }}>🔥 {d.streak} dias de Business Streak</div>}
        <CTA label="VER O BUSINESS GAME →" />
      </>)
      case 'almost': return (<>
        <Title emoji="👀" text="VOCÊ ESTÁ QUASE LÁ…" />
        <div style={{ textAlign: 'center', fontSize: '20px', fontWeight: 900, color: 'white', margin: '10px 0 2px' }}>{nextName} League</div>
        <Bar pct={d.levelPct} color={c} />
        <div style={{ textAlign: 'center', fontSize: '14px', color: 'white', fontWeight: 700 }}>Faltam {xp(d.gpToNext)} XP para chegar.</div>
        <div style={{ textAlign: 'center', fontSize: '12.5px', color: MUTED, marginTop: '10px' }}>🔓 Algo novo desbloqueia na <strong style={{ color: c }}>{nextName} League</strong></div>
        <CTA label="VER MINHA JORNADA →" />
      </>)
      case 'levelup': return (<>
        <Title emoji="🎉" text="SUBIU DE LIGA!" />
        <div style={{ textAlign: 'center', margin: '12px 0' }}>
          <div style={{ fontSize: '40px' }}>{d.level.icon}</div>
          <div style={{ fontSize: '22px', fontWeight: 900, color: c, marginTop: '6px' }}>{d.level.name.toUpperCase()} BUSINESS</div>
        </div>
        <div style={{ textAlign: 'center', fontSize: '12.5px', color: MUTED }}>Seu XP real passou para a próxima liga.</div>
        <CTA label="VER O QUE DESBLOQUEEI →" />
      </>)
      case 'streak': return (<>
        <Title emoji="🔥" text="SEU BUSINESS STREAK" />
        <div style={{ textAlign: 'center', fontSize: '46px', fontWeight: 900, color: ORANGE, margin: '10px 0 4px' }}>{d.streak} DIAS</div>
        <div style={{ textAlign: 'center', fontSize: '12.5px', color: MUTED, lineHeight: 1.6 }}>Seu negócio teve resultado registrado por {d.streak} dias seguidos.</div>
        <div style={{ textAlign: 'center', fontSize: '13px', fontWeight: 800, color: 'white', marginTop: '10px' }}>Não quebre o streak.</div>
        <CTA label="CONTINUAR →" />
      </>)
      case 'while_away': return (<>
        <Title emoji="👀" text="ENQUANTO VOCÊ ESTAVA FORA…" />
        <Sub>Resultados reais desde a sua última visita.</Sub>
        <div style={{ margin: '14px 0' }}>
          <Metric icon="🤖" label="Ações concluídas" value={num(d.actionsCount)} />
          <Metric icon="📝" label="Conteúdos criados" value={num(d.contentCreated)} />
          <Metric icon="📈" label="Alcance" value={pct(d.reachPct)} color={GREEN} />
          <Metric icon="❤️" label="Engajamento" value={pct(d.engagementPct)} color={GREEN} />
          <Metric icon="🟢" label="XP ganhos" value={num(d.gpEarnedSinceVisit, n => `+${xp(n)}`)} color={c} />
        </div>
        <div style={{ fontSize: '13px', color: 'white', fontWeight: 700 }}>Seu negócio está na <strong style={{ color: c }}>{d.level.name} League</strong>.</div>
        <CTA label="VER TUDO →" />
      </>)
    }
  }

  return (
    <div onClick={() => dismiss(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: D, animation: 'sbfade 0.25s ease' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '420px', background: 'linear-gradient(180deg, #1A1008, #120c07)', border: `1px solid ${c}44`, borderRadius: '20px', padding: '26px 26px 24px', position: 'relative', boxShadow: `0 24px 80px rgba(0,0,0,0.6), 0 0 60px ${c}18`, animation: 'sbpop 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>
        <button onClick={() => dismiss(false)} style={{ position: 'absolute', top: '14px', right: '16px', background: 'transparent', border: 'none', color: MUTED, fontSize: '18px', cursor: 'pointer', lineHeight: 1 }}>×</button>
        {revealedDisc ? (
          <>
            <DiscoveryReveal d={revealedDisc} />
            <button onClick={() => dismiss(true)} style={{ width: '100%', marginTop: '18px', padding: '12px', background: ORANGE, color: '#000', fontWeight: 800, fontSize: '13px', border: 'none', borderRadius: '10px', cursor: 'pointer', fontFamily: D }}>VER NO BUSINESS GAME →</button>
          </>
        ) : (<>
          {body()}
          {pendingDisc.length > 0 && <DiscoveryChip count={pendingDisc.length} onClick={revealFirst} />}
        </>)}
      </div>
      <style>{`@keyframes sbfade{from{opacity:0}to{opacity:1}}@keyframes sbpop{from{opacity:0;transform:scale(0.9) translateY(10px)}to{opacity:1;transform:none}}`}</style>
    </div>
  )
}

function Title({ emoji, text }: { emoji: string; text: string }) {
  return <div style={{ fontSize: '18px', fontWeight: 900, color: 'white', letterSpacing: '-0.01em', lineHeight: 1.2, paddingRight: '20px' }}>{emoji} {text}</div>
}
function Sub({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: '13px', color: MUTED, marginTop: '6px', lineHeight: 1.5 }}>{children}</div>
}
function LeagueLine({ d, c }: { d: ProgressData; c: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '6px 0' }}>
      <span style={{ fontSize: '18px' }}>{d.level.icon}</span>
      <span style={{ fontSize: '14px', fontWeight: 800, color: c }}>{d.level.name.toUpperCase()} BUSINESS</span>
      <span style={{ fontSize: '11px', color: MUTED, marginLeft: 'auto' }}>{d.totalGp == null ? <BlurredValue kind="pct" hint={false} /> : `${d.levelPct}%`}</span>
    </div>
  )
}
