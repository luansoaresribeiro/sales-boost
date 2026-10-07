import { useState } from 'react'
import { CARD, MUTED, BORDER, D, SUPABASE_URL } from './shared'
import { useLang } from '../../../contexts/LanguageContext'

const TX = {
  pt: { one: '1 Business Discovery esperando', many: (n: number) => `${n} Business Discoveries esperando`, chipCta: '✨ Descobrir e ganhar XP →',
    why: 'Por que é especial:', achv: '🏆 Conquista:', title: '🎁 Business Discoveries', sub: 'Achados que a IA marcou como notáveis nos seus dados reais. Revele pra ganhar XP.',
    waiting: 'Descoberta esperando', found: '👀 A IA encontrou algo especial nos seus dados.', revealing: 'Revelando…', close: 'Fechar' },
  en: { one: '1 Business Discovery waiting', many: (n: number) => `${n} Business Discoveries waiting`, chipCta: '✨ Discover and earn XP →',
    why: 'Why it is special:', achv: '🏆 Achievement:', title: '🎁 Business Discoveries', sub: 'Findings the AI flagged as notable in your real data. Reveal them to earn XP.',
    waiting: 'Discovery waiting', found: '👀 The AI found something special in your data.', revealing: 'Revealing…', close: 'Close' },
} as const

const ORANGE = '#FF6D29'
const GREEN = '#4ade80'

export interface Discovery {
  id: string; kind: string; title: string; detail: string; reason: string
  achievement: string | null; xp: number; status: 'pending' | 'revealed'
  meta?: Record<string, unknown>
}

async function call(token: string, companyId: string, action: string, extra: Record<string, unknown> = {}) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/business-progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, company_id: companyId, ...extra }),
  })
  return res.json().catch(() => ({}))
}

export async function fetchDiscoveries(token: string, companyId: string): Promise<{ pending: Discovery[]; revealed: Discovery[] }> {
  const j = await call(token, companyId, 'list_discoveries')
  return { pending: j.pending ?? [], revealed: j.revealed ?? [] }
}

export async function revealDiscovery(token: string, companyId: string, id: string): Promise<Discovery | null> {
  const j = await call(token, companyId, 'reveal_discovery', { discovery_id: id })
  return j.discovery ?? null
}

// Chip discreto "algo especial te espera" — curadoria, não info comum escondida.
export function DiscoveryChip({ count, onClick }: { count: number; onClick: () => void }) {
  const tx = TX[useLang().lang]
  return (
    <button onClick={onClick} className="sb-disc-btn sb-disc-pulse"
      style={{ width: '100%', marginTop: '12px', padding: '11px 14px', background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.35)', borderRadius: '11px', cursor: 'pointer', fontFamily: D, display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left' }}>
      <style>{DISCOVERY_CSS}</style>
      <span style={{ fontSize: '18px' }}>🔒</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#c4b5fd' }}>{count === 1 ? tx.one : tx.many(count)}</div>
        <div style={{ fontSize: '10.5px', color: MUTED }}>{tx.chipCta}</div>
      </div>
      <span style={{ fontSize: '13px', color: '#A78BFA' }}>→</span>
    </button>
  )
}

// Animações da descoberta (reveal + pop de XP + pulso do botão).
export const DISCOVERY_CSS = `
@keyframes sbReveal{from{opacity:0;transform:scale(0.92)}to{opacity:1;transform:none}}
@keyframes sbXpPop{0%{transform:scale(0);opacity:0}55%{transform:scale(1.3);opacity:1}75%{transform:scale(0.92)}100%{transform:scale(1);opacity:1}}
@keyframes sbFloatIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes sbPulse{0%,100%{box-shadow:0 0 0 0 rgba(167,139,250,0)}50%{box-shadow:0 0 0 5px rgba(167,139,250,0.12)}}
.sb-disc-btn{transition:transform .12s ease}
.sb-disc-btn:hover{transform:translateY(-2px)}
.sb-disc-btn:active{transform:scale(0.96)}
.sb-disc-pulse{animation:sbPulse 2.6s ease-in-out infinite}
`

// Revelação (recompensa por curiosidade) — mostra o porquê + credita XP com pop.
export function DiscoveryReveal({ d }: { d: Discovery }) {
  const tx = TX[useLang().lang]
  return (
    <div style={{ textAlign: 'center', animation: 'sbReveal 0.35s cubic-bezier(0.34,1.56,0.64,1)' }}>
      <style>{DISCOVERY_CSS}</style>
      <div style={{ fontSize: '11px', fontWeight: 800, color: '#A78BFA', letterSpacing: '0.08em', marginBottom: '6px' }}>🔓 DISCOVERY REVEALED</div>
      <div style={{ fontSize: '18px', fontWeight: 900, color: 'white', lineHeight: 1.25, marginBottom: '10px', animation: 'sbFloatIn 0.4s ease 0.05s both' }}>{d.title}</div>
      <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', lineHeight: 1.55, marginBottom: '10px', animation: 'sbFloatIn 0.4s ease 0.12s both' }}>{d.detail}</div>
      <div style={{ fontSize: '11.5px', color: MUTED, lineHeight: 1.5, background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '9px', padding: '10px 12px', marginBottom: '12px', textAlign: 'left', animation: 'sbFloatIn 0.4s ease 0.18s both' }}>
        <strong style={{ color: 'white' }}>{tx.why}</strong> {d.reason}
      </div>
      {d.achievement && <div style={{ fontSize: '14px', fontWeight: 800, color: '#FBBF24', marginBottom: '8px', animation: 'sbFloatIn 0.4s ease 0.24s both' }}>{tx.achv} {d.achievement}</div>}
      {d.xp > 0 && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 18px', background: 'rgba(74,222,128,0.12)', border: `1px solid ${GREEN}55`, borderRadius: '99px', animation: 'sbXpPop 0.55s cubic-bezier(0.34,1.7,0.5,1) 0.3s both' }}>
          <span style={{ fontSize: '18px' }}>🟢</span>
          <span style={{ fontSize: '20px', fontWeight: 900, color: GREEN }}>+{d.xp} XP</span>
        </div>
      )}
    </div>
  )
}

// Seção da página: pendentes (lacradas) + já reveladas.
export function DiscoveriesSection({ token, companyId, pending, revealed, onRevealed }: {
  token: string; companyId: string; pending: Discovery[]; revealed: Discovery[]
  onRevealed: (d: Discovery) => void
}) {
  const tx = TX[useLang().lang]
  const [busy, setBusy] = useState<string | null>(null)
  const [shown, setShown] = useState<Discovery | null>(null)

  const open = async (id: string) => {
    setBusy(id)
    const d = await revealDiscovery(token, companyId, id)
    setBusy(null)
    if (d) { setShown(d); onRevealed(d) }
  }

  if (pending.length === 0 && revealed.length === 0) return null

  return (
    <div>
      <style>{DISCOVERY_CSS}</style>
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '14px', fontWeight: 800, color: 'white', fontFamily: D }}>{tx.title}</div>
        <div style={{ fontSize: '11.5px', color: MUTED, marginTop: '2px' }}>{tx.sub}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '11px' }}>
        {pending.map(d => (
          <button key={d.id} onClick={() => open(d.id)} disabled={busy === d.id} className="sb-disc-btn sb-disc-pulse"
            style={{ textAlign: 'left', background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '13px', padding: '16px', cursor: 'pointer', fontFamily: D, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '24px' }}>{busy === d.id ? '✨' : '🔒'}</div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#c4b5fd' }}>{tx.waiting}</div>
            <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.4 }}>{tx.found}</div>
            <div style={{ marginTop: '4px', alignSelf: 'flex-start', padding: '7px 14px', background: busy === d.id ? 'rgba(167,139,250,0.3)' : '#A78BFA', color: busy === d.id ? '#c4b5fd' : '#0E0B0A', fontWeight: 800, fontSize: '11.5px', borderRadius: '9px', fontFamily: D }}>
              {busy === d.id ? tx.revealing : tx.chipCta}
            </div>
          </button>
        ))}
        {revealed.map(d => (
          <div key={d.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '13px', padding: '16px' }}>
            <div style={{ fontSize: '12.5px', fontWeight: 800, color: 'white', marginBottom: '5px' }}>{d.achievement ? `🏆 ${d.achievement}` : d.title}</div>
            <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.45, marginBottom: '6px' }}>{d.detail}</div>
            {d.xp > 0 && <div style={{ fontSize: '11px', fontWeight: 800, color: GREEN }}>+{d.xp} XP</div>}
          </div>
        ))}
      </div>

      {shown && (
        <div onClick={() => setShown(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: D }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '420px', background: 'linear-gradient(180deg, #1A1008, #120c07)', border: '1px solid rgba(167,139,250,0.4)', borderRadius: '20px', padding: '28px 26px', boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 60px rgba(167,139,250,0.15)' }}>
            <DiscoveryReveal d={shown} />
            <button onClick={() => setShown(null)} style={{ width: '100%', marginTop: '18px', padding: '12px', background: ORANGE, color: '#000', fontWeight: 800, fontSize: '13px', border: 'none', borderRadius: '10px', cursor: 'pointer', fontFamily: D }}>{tx.close}</button>
          </div>
        </div>
      )}
    </div>
  )
}
