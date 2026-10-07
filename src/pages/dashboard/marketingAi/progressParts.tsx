import { CARD, MUTED, BORDER, D } from './shared'
import { useLang } from '../../../contexts/LanguageContext'
import { PROGRESS_TX, trProgress } from './progressParts.i18n'
import { RARITY_META, HEALTH_META, REWARD_CATEGORY_LABEL, LEAGUES, type ProgressData, type Pin, type Reward } from './progressGame'

const ORANGE = '#FF6D29'
const GREEN = '#4ade80'
const RED = '#f87171'

// Número sem fonte real: placeholder FIXO (nunca derivado de sorteio/dado),
// embaçado e ilegível, com rótulo "aguardando dados reais". Dá pra perceber que
// existe um número ali, mas não dá pra ler. Regra 5 do CLAUDE.md.
export function BlurredValue({ kind = 'num', hint = true, size, color = 'white' }: { kind?: 'num' | 'pct' | 'xp'; hint?: boolean; size?: string; color?: string }) {
  const { lang } = useLang()
  const wait = PROGRESS_TX[lang].waiting
  const text = kind === 'pct' ? '00,0%' : kind === 'xp' ? '0.000' : '00'
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'inherit', lineHeight: 1.1, verticalAlign: 'middle' }}>
      <span aria-label={wait} role="img" style={{ filter: 'blur(6px)', userSelect: 'none', pointerEvents: 'none', color, fontSize: size }}>{text}</span>
      {hint && <span style={{ fontSize: '9px', fontWeight: 600, color: MUTED, letterSpacing: '0.02em', marginTop: '2px' }}>{wait}</span>}
    </span>
  )
}

function sectionTitle(icon: string, title: string, sub?: string) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ fontSize: '14px', fontWeight: 800, color: 'white', fontFamily: D }}>{icon} {title}</div>
      {sub && <div style={{ fontSize: '11.5px', color: MUTED, marginTop: '2px' }}>{sub}</div>}
    </div>
  )
}

// ── Liga (Business League) + XP + barra de progresso ───────────────────────
export function LevelCard({ d }: { d: ProgressData }) {
  const { lang } = useLang()
  const tx = PROGRESS_TX[lang]
  const loc = lang === 'en' ? 'en-US' : 'pt-BR'
  const xp = (n: number) => n.toLocaleString(loc)
  const c = d.level.color
  return (
    <div style={{ background: `linear-gradient(135deg, ${c}22, ${c}05)`, border: `1px solid ${c}44`, borderRadius: '16px', padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <div style={{ fontSize: '38px', lineHeight: 1 }}>{d.level.icon}</div>
        <div style={{ flex: 1, minWidth: '160px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: c, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{d.level.identity}</div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: 'white', lineHeight: 1.1 }}>{d.level.name}{tx.leagueSuffix}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '22px', fontWeight: 900, color: c, lineHeight: 1 }}>{d.totalGp == null ? <BlurredValue kind="xp" size="22px" color={c} /> : xp(d.totalGp)}</div>
          <div style={{ fontSize: '10px', color: MUTED }}>XP</div>
        </div>
      </div>
      <div style={{ height: '10px', background: 'rgba(255,255,255,0.08)', borderRadius: '99px', overflow: 'hidden', marginBottom: '7px' }}>
        <div style={{ width: `${d.totalGp == null ? 0 : d.levelPct}%`, height: '100%', background: `linear-gradient(90deg, ${c}, #ffffff88)`, borderRadius: '99px', transition: 'width 0.6s ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: MUTED }}>
        <span>{d.nextLevel ? (d.totalGp == null ? <><BlurredValue kind="xp" hint={false} /> / {xp(d.nextLevel.minGp)} XP</> : `${xp(d.totalGp)} / ${xp(d.nextLevel.minGp)} XP`) : tx.maxLeague}</span>
        {d.nextLevel && d.totalGp != null && <span><strong style={{ color: 'white' }}>{xp(d.gpToNext)} XP</strong> → {d.nextLevel.name}</span>}
      </div>
    </div>
  )
}

// ── Trilha da jornada do negócio (Foundation → Business Mastery) ────────────
export function JourneyTrack({ d }: { d: ProgressData }) {
  const tx = PROGRESS_TX[useLang().lang]
  const dot = (s: string) => s === 'done' ? '🟢' : s === 'current' ? '🟡' : '⚪'
  return (
    <div>
      {sectionTitle('🗺️', tx.journeyT, tx.journeyS)}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '16px 18px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
        {d.journey.map(st => (
          <div key={st.key} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 12px', borderRadius: '99px', background: st.state === 'current' ? 'rgba(251,191,36,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${st.state === 'current' ? 'rgba(251,191,36,0.35)' : BORDER}`, opacity: st.state === 'locked' ? 0.5 : 1 }}>
            <span style={{ fontSize: '11px' }}>{dot(st.state)}</span>
            <span style={{ fontSize: '12px', fontWeight: st.state === 'locked' ? 500 : 700, color: st.state === 'locked' ? MUTED : 'white' }}>{st.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Escada de ligas (Bronze → Master) ──────────────────────────────────────
export function LeagueLadder({ d }: { d: ProgressData }) {
  const { lang } = useLang()
  const tx = PROGRESS_TX[lang]
  const loc = lang === 'en' ? 'en-US' : 'pt-BR'
  return (
    <div>
      {sectionTitle('🏆', 'Business League', tx.ladderS)}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '9px' }}>
        {LEAGUES.map(lg => {
          const current = lg.key === d.level.key
          const passed = (d.totalGp ?? 0) >= (lg.maxGp ?? Infinity)
          return (
            <div key={lg.key} style={{ background: current ? `${lg.color}18` : CARD, border: `1px solid ${current ? lg.color : BORDER}`, borderRadius: '12px', padding: '13px 14px', opacity: passed || current ? 1 : 0.55 }}>
              <div style={{ fontSize: '20px', marginBottom: '4px' }}>{lg.icon}</div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: current ? lg.color : 'white' }}>{lg.name}{current && ' ·'}</div>
              <div style={{ fontSize: '10px', color: MUTED }}>{lg.identity}</div>
              <div style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.35)', marginTop: '4px' }}>{lg.minGp.toLocaleString(loc)}{lg.maxGp ? `–${lg.maxGp.toLocaleString(loc)}` : '+'} XP</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Próximo milestone ──────────────────────────────────────────────────────
export function MilestoneCard({ d }: { d: ProgressData }) {
  const { lang } = useLang()
  const tx = PROGRESS_TX[lang]
  const loc = lang === 'en' ? 'en-US' : 'pt-BR'
  const m = d.milestone
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '16px', padding: '20px 22px' }}>
      <div style={{ fontSize: '10px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>{tx.nextUnlock}</div>
      <div style={{ fontSize: '18px', fontWeight: 800, color: 'white', marginBottom: '12px' }}>{m.icon} {trProgress(lang, m.title)}</div>
      <div style={{ height: '10px', background: 'rgba(255,255,255,0.08)', borderRadius: '99px', overflow: 'hidden', marginBottom: '7px' }}>
        <div style={{ width: `${d.totalGp == null ? 0 : m.pct}%`, height: '100%', background: `linear-gradient(90deg, #A78BFA, #c4b5fd)`, borderRadius: '99px', transition: 'width 0.6s ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: MUTED, marginBottom: '12px' }}>
        {d.totalGp == null
          ? <span><BlurredValue kind="xp" hint={false} /> / {m.target.toLocaleString(loc)} XP</span>
          : <span>{m.current.toLocaleString(loc)} / {m.target.toLocaleString(loc)} XP · {m.pct}%</span>}
        {d.totalGp == null
          ? <BlurredValue kind="xp" />
          : <span><strong style={{ color: 'white' }}>{tx.remaining(m.remaining.toLocaleString(loc))}</strong></span>}
      </div>
      <div style={{ fontSize: '11.5px', color: MUTED, background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '9px', padding: '9px 12px' }}>
        {tx.suggested}<strong style={{ color: 'white' }}>{trProgress(lang, m.nextGoal)}</strong>
      </div>
    </div>
  )
}

// ── Enquanto você estava fora (clicável) ───────────────────────────────────
export function WhileAway({ d, onOpen }: { d: ProgressData; onOpen: (l: string) => void }) {
  const { lang } = useLang()
  const tx = PROGRESS_TX[lang]
  return (
    <div>
      {sectionTitle('🤖', tx.awayT, tx.awayS)}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
        {d.whileAway.map(w => (
          <button key={w.key} onClick={() => w.link && onOpen(w.link)}
            style={{ textAlign: 'left', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '14px 15px', cursor: w.link ? 'pointer' : 'default', fontFamily: D, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '20px' }}>{w.icon}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '20px', fontWeight: 900, color: 'white', lineHeight: 1 }}>{w.count == null ? <BlurredValue size="20px" /> : w.count}</div>
              <div style={{ fontSize: '11px', color: MUTED, marginTop: '2px' }}>{trProgress(lang, w.label)} {w.link && <span style={{ color: ORANGE }}>→</span>}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Business Health ────────────────────────────────────────────────────────
export function HealthCard({ d }: { d: ProgressData }) {
  const { lang } = useLang()
  const tx = PROGRESS_TX[lang]
  const meta = d.health.status ? HEALTH_META[d.health.status] : null
  return (
    <div>
      {sectionTitle('❤️‍🩹', 'Business Health', tx.healthS)}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '16px 18px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 800, color: meta ? meta.color : MUTED, marginBottom: '14px' }}>
          {meta ? `${meta.dot} ${tx.healthLabel}${trProgress(lang, meta.label)}` : <>{tx.healthLabel}<BlurredValue kind="pct" hint={false} /> <span style={{ fontSize: '10px', fontWeight: 600, color: MUTED }}>{tx.waiting}</span></>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '9px' }}>
          {d.health.metrics.map(m => (
            <div key={m.label} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '11px 12px' }}>
              <div style={{ fontSize: '10px', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '5px' }}>{trProgress(lang, m.label)}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ fontSize: '16px', fontWeight: 800, color: 'white' }}>{m.value == null ? <BlurredValue size="16px" /> : m.value}</span>
                {m.delta != null && <span style={{ fontSize: '10px', fontWeight: 700, color: m.delta >= 0 ? GREEN : RED }}>{m.delta >= 0 ? '▲' : '▼'}{Math.abs(m.delta)}%</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Progresso semanal ──────────────────────────────────────────────────────
export function WeeklyCard({ d }: { d: ProgressData }) {
  const { lang } = useLang()
  const tx = PROGRESS_TX[lang]
  const max = Math.max(...d.weekly.map(w => Math.abs(w.pct ?? 0)), 10)
  return (
    <div>
      {sectionTitle('📊', tx.weeklyT, tx.weeklyS)}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {d.weekly.map(w => (
          <div key={w.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '12px', color: MUTED }}>{trProgress(lang, w.label)}</span>
              {w.pct == null
                ? <BlurredValue kind="pct" />
                : <span style={{ fontSize: '12px', fontWeight: 800, color: w.pct >= 0 ? GREEN : RED }}>{w.pct >= 0 ? '+' : ''}{w.pct}%</span>}
            </div>
            <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '99px', overflow: 'hidden' }}>
              {w.pct == null
                ? <div aria-label={tx.waiting} style={{ width: '55%', height: '100%', background: 'rgba(255,255,255,0.25)', borderRadius: '99px', filter: 'blur(4px)' }} />
                : <div style={{ width: `${(Math.abs(w.pct) / max) * 100}%`, height: '100%', background: w.pct >= 0 ? GREEN : RED, borderRadius: '99px' }} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Pins / conquistas ──────────────────────────────────────────────────────
export function PinsGrid({ pins, onActivate, activating }: { pins: Pin[]; onActivate: (k: string) => void; activating: string | null }) {
  const { lang } = useLang()
  const tx = PROGRESS_TX[lang]
  return (
    <div>
      {sectionTitle('🏅', tx.pinsT, tx.pinsS)}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '11px' }}>
        {pins.map(p => {
          const rm = RARITY_META[p.rarity]
          return (
            <div key={p.key} style={{ background: CARD, border: `1px solid ${p.unlocked ? rm.color + '55' : BORDER}`, borderRadius: '13px', padding: '15px', opacity: p.unlocked ? 1 : 0.5, position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={{ fontSize: '26px', filter: p.unlocked ? 'none' : 'grayscale(1)' }}>{p.icon}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: 'white' }}>{p.name}</div>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: rm.color, border: `1px solid ${rm.color}44`, borderRadius: '99px', padding: '1px 7px' }}>{trProgress(lang, rm.label)}</span>
                </div>
              </div>
              <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.45, marginBottom: p.unlocked ? '9px' : 0 }}>{trProgress(lang, p.description)}</div>
              {p.unlocked && p.unlockedAt && <div style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.35)' }}>{tx.unlockedAt}{p.unlockedAt}</div>}
              {p.unlocked && p.rewardKey && (
                <button onClick={() => onActivate(p.rewardKey!)} disabled={activating === p.rewardKey}
                  style={{ marginTop: '10px', width: '100%', padding: '8px', background: activating === p.rewardKey ? 'rgba(255,109,41,0.4)' : ORANGE, color: '#000', fontWeight: 800, fontSize: '11.5px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: D }}>
                  {activating === p.rewardKey ? tx.activating : tx.activate}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Rewards por categoria ──────────────────────────────────────────────────
export function RewardsGrid({ rewards }: { rewards: Reward[] }) {
  const { lang } = useLang()
  const tx = PROGRESS_TX[lang]
  const cats = [...new Set(rewards.map(r => r.category))]
  return (
    <div>
      {sectionTitle('🎁', 'Rewards', tx.rewardsS)}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {cats.map(cat => (
          <div key={cat}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>{REWARD_CATEGORY_LABEL[cat] ?? cat}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '9px' }}>
              {rewards.filter(r => r.category === cat).map(r => (
                <div key={r.key} style={{ background: CARD, border: `1px solid ${r.unlocked ? 'rgba(74,222,128,0.3)' : BORDER}`, borderRadius: '11px', padding: '13px 14px', opacity: r.unlocked ? 1 : 0.55 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>{r.icon} {r.name}</span>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: r.unlocked ? GREEN : MUTED }}>{r.unlocked ? tx.active : '🔒'}</span>
                  </div>
                  <div style={{ fontSize: '10.5px', color: MUTED, lineHeight: 1.45 }}>{trProgress(lang, r.description)}</div>
                  {r.durationHours && <div style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.35)', marginTop: '5px' }}>{tx.boostOf(r.durationHours)}</div>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Timeline de progresso recente ──────────────────────────────────────────
export function Timeline({ d }: { d: ProgressData }) {
  const { lang } = useLang()
  const tx = PROGRESS_TX[lang]
  return (
    <div>
      {sectionTitle('🕒', tx.recentT, tx.recentS)}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '6px 18px' }}>
        {d.timeline.length === 0 && <div style={{ padding: '16px 0', fontSize: '12px', color: MUTED }}>{tx.noEvents}</div>}
        {d.timeline.map((t, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: i < d.timeline.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
            <span style={{ fontSize: '18px' }}>{t.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'white' }}>{trProgress(lang, t.label)}</div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>{t.when}</div>
            </div>
            {t.gp != null && <span style={{ fontSize: '12px', fontWeight: 800, color: ORANGE, flexShrink: 0 }}>+{t.gp} XP</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Next Best Action ───────────────────────────────────────────────────────
export function NextBestAction({ d, onOpen }: { d: ProgressData; onOpen: (l: string) => void }) {
  const { lang } = useLang()
  return (
    <div style={{ background: `linear-gradient(135deg, rgba(167,139,250,0.10), rgba(167,139,250,0.02))`, border: '1px solid rgba(167,139,250,0.25)', borderRadius: '16px', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: '200px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: '#A78BFA', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>🎯 Next Best Action</div>
        <div style={{ fontSize: '16px', fontWeight: 800, color: 'white', lineHeight: 1.35 }}>{trProgress(lang, d.nextBestAction.title)}</div>
      </div>
      <button onClick={() => onOpen(d.nextBestAction.link)}
        style={{ padding: '11px 20px', background: ORANGE, color: '#000', fontWeight: 800, fontSize: '13px', border: 'none', borderRadius: '10px', cursor: 'pointer', fontFamily: D, flexShrink: 0 }}>
        {trProgress(lang, d.nextBestAction.cta)} →
      </button>
    </div>
  )
}

// ── Recovery Boost (só quando desacelera) ──────────────────────────────────
export function RecoveryCard({ d, onActivate, activating }: { d: ProgressData; onActivate: (k: string) => void; activating: string | null }) {
  const tx = PROGRESS_TX[useLang().lang]
  if (!d.recovery) return null
  return (
    <div style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: '16px', padding: '20px 22px' }}>
      <div style={{ fontSize: '15px', fontWeight: 800, color: RED, marginBottom: '10px' }}>{tx.slowed}</div>
      <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', marginBottom: '14px' }}>
        {d.recovery.metrics.map(m => (
          <div key={m.label}><span style={{ fontSize: '18px', fontWeight: 900, color: RED }}>{m.value}</span> <span style={{ fontSize: '11px', color: MUTED }}>{m.label}</span></div>
        ))}
      </div>
      <div style={{ fontSize: '12px', fontWeight: 700, color: 'white', marginBottom: '7px' }}>{tx.found(d.recovery.causes.length)}</div>
      <ol style={{ margin: '0 0 14px', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {d.recovery.causes.map((c, i) => <li key={i} style={{ fontSize: '12px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>{c}</li>)}
      </ol>
      <div style={{ background: 'rgba(255,109,41,0.06)', border: '1px solid rgba(255,109,41,0.2)', borderRadius: '11px', padding: '13px 15px' }}>
        <div style={{ fontSize: '12.5px', color: 'white', lineHeight: 1.5, marginBottom: '10px' }}>🎁 <strong>{tx.recoveryA}</strong>{tx.recoveryB}</div>
        <button onClick={() => onActivate('recovery_boost')} disabled={activating === 'recovery_boost'}
          style={{ padding: '9px 18px', background: activating === 'recovery_boost' ? 'rgba(255,109,41,0.4)' : ORANGE, color: '#000', fontWeight: 800, fontSize: '12.5px', border: 'none', borderRadius: '9px', cursor: 'pointer', fontFamily: D }}>
          {activating === 'recovery_boost' ? tx.activating : tx.activateRecovery}
        </button>
      </div>
    </div>
  )
}

// ── Streak ─────────────────────────────────────────────────────────────────
export function StreakCard({ d }: { d: ProgressData }) {
  const tx = PROGRESS_TX[useLang().lang]
  const days = Array.from({ length: 7 }, (_, i) => i + 1)
  const st = d.streak
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '16px 18px' }}>
      <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'white', marginBottom: '3px' }}>
        🔥 {st == null ? <BlurredValue hint={false} /> : st} {st === 1 ? tx.day : tx.days} {tx.ofProgress}
        {st == null && <span style={{ fontSize: '10px', fontWeight: 600, color: MUTED, marginLeft: '8px' }}>{tx.waiting}</span>}
      </div>
      <div style={{ fontSize: '11px', color: MUTED, marginBottom: '12px' }}>
        {st != null && st > 0 ? tx.streakOn(st) : tx.streakOff}
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        {days.map(n => {
          const on = st != null && n <= st
          return <div key={n} style={{ flex: 1, height: '30px', borderRadius: '7px', background: on ? `linear-gradient(180deg, ${ORANGE}, rgba(255,109,41,0.3))` : 'rgba(255,255,255,0.05)', border: `1px solid ${on ? 'rgba(255,109,41,0.4)' : BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800, color: on ? '#000' : 'rgba(255,255,255,0.3)' }}>{n}</div>
        })}
      </div>
    </div>
  )
}
