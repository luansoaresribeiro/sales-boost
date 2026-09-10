import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import { track } from '../../../lib/analytics'
import { CARD, MUTED, BORDER, D, SUPABASE_URL } from './shared'

const ORANGE = '#FF6D29'
const MOD_LABEL: Record<string, string> = { organico: 'Orgânico', stories: 'Stories', campanhas: 'Campanhas' }
const RELEVANCE_META: Record<string, { color: string; label: string }> = {
  high: { color: '#f87171', label: 'Alta' }, medium: { color: '#FBBF24', label: 'Média' }, low: { color: MUTED, label: 'Baixa' },
}

interface Idea { id: string; title: string; hook: string | null; angle: string | null; format: string | null; module: string | null; rationale: string | null; status: string; created_at: string }
interface Trend { id: string; title: string; description: string | null; category: string | null; relevance: string | null; source: string | null; detected_at: string }

function TrendCard({ t }: { t: Trend }) {
  const rel = RELEVANCE_META[t.relevance ?? 'medium'] ?? RELEVANCE_META.medium
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '11px', padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '5px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'white' }}>🔥 {t.title}</span>
        {t.category && <span style={{ fontSize: '8.5px', fontWeight: 700, color: MUTED, border: `1px solid ${BORDER}`, borderRadius: '99px', padding: '1px 7px' }}>{t.category}</span>}
        <span style={{ fontSize: '9px', fontWeight: 700, color: rel.color, marginLeft: 'auto' }}>{rel.label} relevância</span>
      </div>
      {t.description && <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.5 }}>{t.description}</div>}
    </div>
  )
}

// Creative Agent (exibido como "Ideias") — traz IDEIAS de post em cards, com
// o Trend Agent acima (tendências reais do segmento, escaneadas por hashtag
// via Apify) alimentando o raciocínio. Roda sozinho (cron semanal); o botão
// aqui só força uma atualização na hora. Cada ideia vira post de teste
// (creative-generate), que cai na Área de Testes. Nada publica sozinho.
export default function CreativeAgent({ companyId, module }: { companyId: string; module?: string }) {
  const { session } = useAuth()
  const token = session?.access_token ?? ''
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [trends, setTrends] = useState<Trend[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const [{ data: i }, { data: t }] = await Promise.all([
      supabase.from('marketing_ai_ideas').select('*').eq('company_id', companyId).neq('status', 'dismissed').order('created_at', { ascending: false }).limit(30),
      supabase.from('marketing_ai_trends').select('*').eq('company_id', companyId).order('detected_at', { ascending: false }).limit(10),
    ])
    setIdeas((i ?? []) as Idea[])
    setTrends((t ?? []) as Trend[])
    setLoading(false)
  }, [companyId])
  useEffect(() => { load() }, [load])

  const generateIdeas = async () => {
    setGenerating(true); setErr(''); setMsg('')
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/creative-ideas`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ focus_module: module }),
      })
      const r = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(r.error ?? 'Erro ao gerar ideias')
      track('ideas_generated', 'Gerou ideias de post')
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao gerar ideias')
    }
    setGenerating(false)
  }

  const generatePost = async (idea: Idea) => {
    setBusyId(idea.id); setErr(''); setMsg('')
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/creative-generate`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: idea.module ?? 'organico', idea_id: idea.id, idea: { title: idea.title, hook: idea.hook, angle: idea.angle, format: idea.format } }),
      })
      const r = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(r.error ?? 'Erro ao gerar post')
      track('content_generated', `Gerou post de uma ideia (${MOD_LABEL[idea.module ?? 'organico'] ?? idea.module})`, { from_idea: idea.id })
      setMsg(`Post gerado! Está na aba Testes (Biblioteca), esperando sua nota e aprovação.`)
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao gerar post')
    }
    setBusyId(null)
  }

  const dismiss = async (id: string) => {
    await supabase.from('marketing_ai_ideas').update({ status: 'dismissed' }).eq('id', id)
    await load()
  }

  const realTrends = trends.filter(t => t.source === 'instagram_scan')
  const shownTrends = (realTrends.length > 0 ? realTrends : trends).slice(0, 6)

  return (
    <div>
      <div style={{ padding: '12px 16px', background: 'rgba(255,109,41,0.06)', border: '1px solid rgba(255,109,41,0.2)', borderRadius: '11px', fontSize: '11.5px', color: 'white', lineHeight: 1.6, marginBottom: '20px' }}>
        💡 <strong>Ideias.</strong> Toda semana o agente olha sua marca, os insights reais e o que está viralizando no seu segmento (Trend Agent, abaixo) e traz ideias novas sozinho — você não precisa pedir. Gostou de uma? <strong>Gera o post</strong> com um clique, que cai na aba Testes pra você aprovar. Nada é publicado sozinho.
      </div>

      {/* Trend Agent — tendências reais do segmento */}
      <section style={{ marginBottom: '22px' }}>
        <div style={{ fontSize: '13px', fontWeight: 800, color: 'white', marginBottom: '3px' }}>📈 Trend Agent</div>
        <div style={{ fontSize: '11px', color: MUTED, marginBottom: '11px' }}>
          {realTrends.length > 0
            ? 'O que está bombando no seu segmento agora, lido de posts reais do Instagram (Apify) — alimenta as ideias abaixo.'
            : 'Assim que o próximo ciclo semanal escanear posts reais do seu segmento, as tendências aparecem aqui.'}
        </div>
        {shownTrends.length === 0 ? (
          <div style={{ padding: '18px', textAlign: 'center', color: MUTED, fontSize: '12px', background: CARD, border: `1px dashed ${BORDER}`, borderRadius: '11px' }}>Nenhuma tendência ainda.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
            {shownTrends.map(t => <TrendCard key={t.id} t={t} />)}
          </div>
        )}
      </section>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <div style={{ fontSize: '13px', fontWeight: 800, color: 'white' }}>✨ Ideias de post</div>
        <button onClick={generateIdeas} disabled={generating} style={{ marginLeft: 'auto', padding: '8px 15px', background: 'rgba(255,109,41,0.12)', color: ORANGE, fontWeight: 700, fontSize: '11.5px', borderRadius: '8px', border: '1px solid rgba(255,109,41,0.3)', cursor: generating ? 'wait' : 'pointer', fontFamily: D }}>
          {generating ? '💭 Pensando...' : '🔄 Atualizar ideias agora'}
        </button>
        {msg && <span style={{ fontSize: '11.5px', color: '#4ade80' }}>{msg}</span>}
        {err && <span style={{ fontSize: '11.5px', color: '#f87171' }}>{err}</span>}
      </div>

      {(() => { const visible = module ? ideas.filter(i => (i.module ?? 'organico') === module) : ideas; return (
      loading ? (
        <div style={{ fontSize: '12px', color: MUTED }}>Carregando...</div>
      ) : visible.length === 0 ? (
        <div style={{ padding: '28px', textAlign: 'center', color: MUTED, fontSize: '12.5px', background: CARD, border: `1px dashed ${BORDER}`, borderRadius: '12px' }}>
          Nenhuma ideia de {MOD_LABEL[module ?? ''] ?? 'post'} ainda. O agente traz as primeiras no próximo ciclo — ou clique em <strong>Atualizar ideias agora</strong> pra não esperar.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
          {visible.map(i => (
            <div key={i.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px', opacity: i.status === 'used' ? 0.6 : 1 }}>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                {i.module && <span style={{ fontSize: '8.5px', fontWeight: 700, color: ORANGE, border: '1px solid rgba(255,109,41,0.4)', borderRadius: '99px', padding: '1px 7px' }}>{MOD_LABEL[i.module] ?? i.module}</span>}
                {i.format && <span style={{ fontSize: '8.5px', fontWeight: 700, color: MUTED, border: `1px solid ${BORDER}`, borderRadius: '99px', padding: '1px 7px' }}>{i.format}</span>}
                {i.status === 'used' && <span style={{ fontSize: '8.5px', fontWeight: 700, color: '#4ade80', marginLeft: 'auto' }}>✓ gerado</span>}
              </div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'white', lineHeight: 1.35 }}>{i.title}</div>
              {i.hook && <div style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>“{i.hook}”</div>}
              {i.angle && <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.5 }}>{i.angle}</div>}
              {i.rationale && <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.5, fontStyle: 'italic' }}>{i.rationale}</div>}
              <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '6px' }}>
                <button onClick={() => generatePost(i)} disabled={busyId === i.id || i.status === 'used'} style={{ flex: 1, padding: '7px', background: i.status === 'used' ? 'rgba(255,255,255,0.06)' : ORANGE, color: i.status === 'used' ? MUTED : '#000', fontWeight: 700, fontSize: '11px', borderRadius: '8px', border: 'none', cursor: busyId === i.id || i.status === 'used' ? 'default' : 'pointer', fontFamily: D }}>
                  {busyId === i.id ? 'Gerando...' : i.status === 'used' ? 'Já gerado' : '✨ Gerar post'}
                </button>
                <button onClick={() => dismiss(i.id)} title="Dispensar" style={{ padding: '7px 10px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '8px', color: MUTED, fontSize: '11px', cursor: 'pointer', fontFamily: D }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )
      ) })()}
    </div>
  )
}
