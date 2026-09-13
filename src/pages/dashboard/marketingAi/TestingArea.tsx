import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import { track } from '../../../lib/analytics'
import { CARD, MUTED, BORDER, D, SUPABASE_URL, timeAgo } from './shared'
import AdaptModal, { type VaultPost } from './AdaptModal'

const KIND_PT: Record<string, string> = { organico: 'Orgânico', stories: 'Stories', campanhas: 'Campanhas' }
// Mesmas chaves do "template" escolhido pelo Diretor em creative-generate.
export const TEMPLATE_LABEL: Record<string, string> = {
  livre: 'Livre', tweet: 'Tweet', beforeafter: 'Antes/Depois', announcement: 'Anúncio', product: 'Produto',
}

const ORANGE = '#FF6D29'
const GREEN = '#4ade80'

type Kind = 'organico' | 'stories' | 'campanhas'
type CatScore = { score: number; comment: string }

export interface TestPost {
  id: string
  idea: string | null
  caption: string | null
  hashtags: string | null
  cta: string | null
  format: string | null
  image_url: string | null
  video_url: string | null
  video_script: string | null
  slides: { text?: string; image_prompt?: string; image_url?: string | null }[] | null
  reasoning: string | null
  scores: Record<string, CatScore> | null
  quality_score: number | null
  status: string
  brief: Record<string, string> | null
  personality: string | null
  created_at: string
}

// Recomendação de como GRAVAR o vídeo (roteiro), quando o formato é vídeo/reel/story.
export function VideoScript({ post }: { post: TestPost }) {
  if (!post.video_script || !post.video_script.trim()) return null
  return (
    <div style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: '8px', padding: '8px 10px' }}>
      <div style={{ fontSize: '9px', fontWeight: 700, color: '#A78BFA', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>🎥 Como gravar</div>
      <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{post.video_script}</div>
    </div>
  )
}

interface MediaItem { url: string; text?: string }

// Popup controlável — suporta 1 imagem OU carrossel (várias). Navega com as
// setas / ‹ ›, fecha no X, no fundo ou ESC. Mostra o texto do slide, se houver.
export function ImageModal({ images, start = 0, onClose }: { images: MediaItem[]; start?: number; onClose: () => void }) {
  const [i, setI] = useState(start)
  const n = images.length
  const go = useCallback((d: number) => setI(p => (p + d + n) % n), [n])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, go])
  const cur = images[i]
  const navBtn = { width: '44px', height: '44px', flexShrink: 0, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', color: 'white', fontSize: '22px', cursor: 'pointer' } as const
  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.87)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '28px' }}>
      <button onClick={onClose} aria-label="Fechar"
        style={{ position: 'absolute', top: '16px', right: '18px', width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', color: 'white', fontSize: '18px', cursor: 'pointer' }}>✕</button>
      <a href={cur.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
        style={{ position: 'absolute', top: '18px', left: '18px', fontSize: '12px', color: 'white', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '8px', padding: '6px 12px', textDecoration: 'none' }}>Abrir original ↗</a>
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '14px', maxWidth: '96vw' }}>
        {n > 1 && <button onClick={() => go(-1)} style={navBtn}>‹</button>}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <img src={cur.url} alt="" style={{ maxWidth: n > 1 ? '78vw' : '90vw', maxHeight: '78vh', objectFit: 'contain', borderRadius: '10px', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }} />
          {cur.text && <div style={{ fontSize: '12.5px', color: 'white', lineHeight: 1.5, maxWidth: '70vw', textAlign: 'center' }}>{cur.text}</div>}
        </div>
        {n > 1 && <button onClick={() => go(1)} style={navBtn}>›</button>}
      </div>
      {n > 1 && <div style={{ marginTop: '14px', fontSize: '12px', fontWeight: 700, color: 'white' }}>{i + 1} / {n}</div>}
    </div>
  )
}

// Player de vídeo, carrossel (slides) ou imagem única. Clique abre no popup.
export function PostMedia({ post, height = 150 }: { post: TestPost; height?: number }) {
  const [zoom, setZoom] = useState(false)
  if (post.video_url) return <video src={post.video_url} controls style={{ width: '100%', height, objectFit: 'cover', background: '#000' }} />

  const slideImgs = (post.slides ?? []).filter(s => s?.image_url).map(s => ({ url: s.image_url as string, text: s.text }))
  const images: MediaItem[] = slideImgs.length > 0 ? slideImgs : (post.image_url ? [{ url: post.image_url }] : [])
  if (images.length === 0) return <div style={{ width: '100%', height, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.03)', color: MUTED, fontSize: '11px' }}>sem imagem</div>

  return (
    <>
      <div onClick={() => setZoom(true)} title="Clique pra ampliar" style={{ position: 'relative', cursor: 'zoom-in' }}>
        <img src={images[0].url} alt="" style={{ width: '100%', height, objectFit: 'cover', display: 'block' }} />
        {images.length > 1 && <span style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.65)', color: 'white', fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '99px' }}>🖼 1/{images.length}</span>}
      </div>
      {zoom && <ImageModal images={images} onClose={() => setZoom(false)} />}
    </>
  )
}

// Barra de progresso indeterminada (usada enquanto gera + avalia).
export function ProgressBar({ label }: { label?: string }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <style>{`@keyframes sbslide{0%{left:-40%}100%{left:100%}}`}</style>
      {label && <div style={{ fontSize: '11px', color: MUTED, marginBottom: '5px' }}>{label}</div>}
      <div style={{ position: 'relative', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '99px', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, height: '100%', width: '40%', background: ORANGE, borderRadius: '99px', animation: 'sbslide 1.1s ease-in-out infinite' }} />
      </div>
    </div>
  )
}

// Brief do Diretor Criativo (Fase 2): mostra como o conteúdo nasceu.
export function BriefBlock({ post }: { post: TestPost }) {
  const b = post.brief
  if (!b && !post.personality) return null
  const chips = [
    post.personality && `🎭 ${post.personality}`,
    b?.objective && `🎯 ${b.objective}`,
    b?.visual_system && `🎨 ${b.visual_system}`,
    b?.framework && `🧩 ${b.framework}`,
  ].filter(Boolean) as string[]
  return (
    <div style={{ background: 'rgba(255,109,41,0.06)', border: '1px solid rgba(255,109,41,0.18)', borderRadius: '8px', padding: '8px 10px' }}>
      <div style={{ fontSize: '9px', fontWeight: 700, color: ORANGE, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px' }}>🎬 Brief do Diretor</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {chips.map(c => <span key={c} style={{ fontSize: '9.5px', color: 'white', background: 'rgba(255,255,255,0.05)', borderRadius: '99px', padding: '2px 7px' }}>{c}</span>)}
      </div>
    </div>
  )
}

// Único classificador que existe agora — os 9 antigos + a gramática
// separada foram removidos: eram inconsistentes e travavam o Vault sem
// necessidade real (ver content-test/scoreContent). Coerência NUNCA
// bloqueia sozinha — é só um sinal pro dono, "Enviar pro Vault" sempre
// existe. BAD_THRESHOLD tem que bater com o mesmo número no backend
// (content-test's COHERENCE_BAD_THRESHOLD).
const COHERENCE_BAD_THRESHOLD = 50
export const coherenceIsBad = (post: TestPost) => (post.scores?.coherence?.score ?? 100) < COHERENCE_BAD_THRESHOLD
// Analista visual — olha a IMAGEM de verdade (Claude com visão), separado
// do analista de texto: pega bug de layout (texto cortado no card) que a
// checagem de texto não enxerga. Mesma régua: nunca bloqueia, só avisa.
export const visualIsBad = (post: TestPost) => (post.scores?.visual_coherence?.score ?? 100) < COHERENCE_BAD_THRESHOLD

export async function callContentTest(token: string, payload: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/content-test`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Erro na Área de Testes')
  return data as { id?: string; quality_score?: number; regenerated?: string; image_generated?: boolean }
}

function CoherenceRow({ label, score, comment, bad }: { label: string; score: number; comment: string; bad: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '9px 10px', borderRadius: '8px',
      background: bad ? 'rgba(248,113,113,0.08)' : 'rgba(74,222,128,0.06)',
      border: `1px solid ${bad ? 'rgba(248,113,113,0.3)' : 'rgba(74,222,128,0.25)'}`,
    }}>
      <span style={{ fontSize: '18px', fontWeight: 800, color: bad ? '#f87171' : GREEN, lineHeight: 1, flexShrink: 0 }}>{score}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '9.5px', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>{label}</div>
        <div style={{ fontSize: '10.5px', color: bad ? '#f87171' : 'rgba(255,255,255,0.75)', lineHeight: 1.4 }}>{comment}</div>
      </div>
    </div>
  )
}

// Dois sinais: coerência de TEXTO (a ideia/legenda fazem sentido?) e
// coerência VISUAL (a imagem saiu legível, sem nada cortado/quebrado?).
// Nenhum dos dois bloqueia o Vault — são avisos, quem decide é o dono.
export function ScoreBreakdown({ post }: { post: TestPost }) {
  if (post.quality_score == null || !post.scores?.coherence) return null
  const coherence = post.scores.coherence
  const visual = post.scores.visual_coherence
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <CoherenceRow label="Coerência" score={coherence.score} bad={coherenceIsBad(post)}
        comment={coherence.comment || (coherenceIsBad(post) ? 'Post incoerente' : 'Post coerente')} />
      {visual && (
        <CoherenceRow label="Coerência visual" score={visual.score} bad={visualIsBad(post)}
          comment={visual.comment || (visualIsBad(post) ? 'Imagem com problema visual' : 'Imagem sem problema visual')} />
      )}
    </div>
  )
}

function Switch({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ width: '36px', height: '20px', borderRadius: '99px', border: 'none', background: on ? ORANGE : 'rgba(255,255,255,0.15)', position: 'relative', cursor: disabled ? 'default' : 'pointer', flexShrink: 0, opacity: disabled ? 0.6 : 1, padding: 0 }}>
      <span style={{ position: 'absolute', top: '2px', left: on ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: 'white', transition: 'left 0.15s' }} />
    </button>
  )
}

// Área de Testes (QC): gera com o mesmo motor da automação, avalia com o júri
// (nota ponderada, consultiva) e checa gramática/ortografia (eliminatória):
// sem erro de língua → Vault; com erro → regenera o texto. Isolado da fila
// principal; só publica quando o dono manda.
export default function TestingArea({ companyId, kind, onVaultChange }: { companyId: string; kind: Kind; onVaultChange?: () => void }) {
  const { session } = useAuth()
  const token = session?.access_token ?? ''
  const [tests, setTests] = useState<TestPost[]>([])
  const [adapts, setAdapts] = useState<Record<string, (TestPost & { source_id: string })[]>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [adaptFor, setAdaptFor] = useState<VaultPost | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [okMsg, setOkMsg] = useState('')
  const [autoDaily, setAutoDaily] = useState(false)
  const [autoDailyImage, setAutoDailyImage] = useState(true)
  const [allowCarrossel, setAllowCarrossel] = useState(false)
  const [autoLoaded, setAutoLoaded] = useState(false)
  const [autoSaving, setAutoSaving] = useState(false)

  // Geração automática (1x/dia, 10h de Brasília, sempre no formato Orgânico —
  // ver creative-generate) — liga/desliga por empresa, não por módulo.
  // allow_carrossel também é por empresa: desligado por padrão, então todo
  // post vira "foto" e sempre passa pelos templates reais (nenhum deles
  // hoje é pensado pra vários slides, então carrossel nunca usava nenhum).
  useEffect(() => {
    supabase.from('marketing_ai_config').select('auto_daily_test, auto_daily_test_image, allow_carrossel').eq('company_id', companyId).maybeSingle()
      .then(({ data }) => {
        setAutoDaily(!!data?.auto_daily_test)
        setAutoDailyImage(data?.auto_daily_test_image !== false)
        setAllowCarrossel(!!data?.allow_carrossel)
        setAutoLoaded(true)
      })
  }, [companyId])

  const saveAuto = async (patch: { auto_daily_test?: boolean; auto_daily_test_image?: boolean; allow_carrossel?: boolean }) => {
    setAutoSaving(true)
    // upsert, não update: empresa pode ainda não ter linha em
    // marketing_ai_config (só é criada quando algo é salvo) — um .update()
    // simples ali daria 0 linhas afetadas, sem erro, e o toggle pareceria
    // salvo na tela mas nunca teria efeito nenhum de verdade.
    await supabase.from('marketing_ai_config').upsert({ company_id: companyId, ...patch }, { onConflict: 'company_id' })
    if ('auto_daily_test' in patch) setAutoDaily(!!patch.auto_daily_test)
    if ('auto_daily_test_image' in patch) setAutoDailyImage(!!patch.auto_daily_test_image)
    if ('allow_carrossel' in patch) setAllowCarrossel(!!patch.allow_carrossel)
    setAutoSaving(false)
  }

  const load = useCallback(async () => {
    const [{ data }, { data: a }] = await Promise.all([
      supabase.from('marketing_ai_test_content').select('*').eq('company_id', companyId).eq('kind', kind).eq('status', 'draft').order('created_at', { ascending: false }),
      supabase.from('marketing_ai_test_content').select('*').eq('company_id', companyId).eq('kind', kind).eq('status', 'adapt').order('created_at', { ascending: false }),
    ])
    setTests((data ?? []) as TestPost[])
    const map: Record<string, (TestPost & { source_id: string })[]> = {}
    for (const row of (a ?? []) as (TestPost & { source_id: string })[]) { if (row.source_id) (map[row.source_id] ||= []).push(row) }
    setAdapts(map)
    setLoading(false)
  }, [companyId, kind])
  const toggleExpanded = (id: string) => setExpanded(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  useEffect(() => { load() }, [load])

  const generate = async () => {
    setGenerating(true); setError(''); setOkMsg('')
    try {
      // Diretor Criativo + personalidade + controle de qualidade — tudo
      // dentro de creative-generate agora (já devolve com quality_score pronto).
      const res = await fetch(`${SUPABASE_URL}/functions/v1/creative-generate`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind }),
      })
      const r = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(r.error ?? 'Erro ao gerar post de teste')
      await load()
      track('content_generated', `Gerou conteúdo (${KIND_PT[kind] ?? kind})`, { kind })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao gerar post de teste')
    }
    setGenerating(false)
  }

  const act = async (id: string, payload: Record<string, unknown>, okText?: string) => {
    setBusyId(id); setError(''); setOkMsg('')
    try {
      const r = await callContentTest(token, { ...payload, test_id: id })
      if (okText) setOkMsg(okText)
      if (payload.action === 'regenerate') setOkMsg(`Regenerado (${r.regenerated}) → nova nota ${r.quality_score}`)
      await load()
      if (payload.action === 'to_vault') { onVaultChange?.(); track('post_approved', 'Aprovou conteúdo pro Vault', { kind, test_id: id }) }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    }
    setBusyId(null)
  }

  const discard = async (id: string) => {
    setBusyId(id); setError('')
    await supabase.from('marketing_ai_test_content').delete().eq('id', id)
    await load()
    setBusyId(null)
  }

  return (
    <section style={{ marginTop: '26px', paddingTop: '22px', borderTop: `1px solid ${BORDER}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <div style={{ maxWidth: '600px' }}>
          <div style={{ fontSize: '13px', fontWeight: 800, color: 'white', marginBottom: '3px' }}>🧪 Área de Testes + Controle de Qualidade</div>
          <div style={{ fontSize: '11.5px', color: MUTED, lineHeight: 1.55 }}>
            Gera com o <strong>mesmo motor</strong> da automação e é avaliado por dois analistas — <strong>coerência</strong> (o post faz sentido do início ao fim?) e <strong>coerência visual</strong> (a imagem saiu legível, sem nada cortado/quebrado?). São sinais, não um portão: <strong>"Enviar pro Vault" sempre aparece</strong>, e "Corrigir" só aparece quando algo estiver claramente ruim. Só do Vault é que você publica.
          </div>
        </div>
        <button onClick={generate} disabled={generating || !token}
          style={{ padding: '9px 16px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '12px', borderRadius: '9px', border: 'none', cursor: generating ? 'default' : 'pointer', fontFamily: D, flexShrink: 0, opacity: generating ? 0.7 : 1 }}>
          {generating ? 'Gerando + avaliando...' : '✨ Gerar post de teste'}
        </button>
      </div>

      {kind === 'organico' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`, borderRadius: '10px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <Switch on={autoDaily} disabled={!autoLoaded || autoSaving} onClick={() => saveAuto({ auto_daily_test: !autoDaily })} />
            <div>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'white' }}>Gerar automaticamente todo dia às 10h</div>
              <div style={{ fontSize: '10px', color: MUTED }}>Cria 1 post de teste (Orgânico) sozinho, esperando você avaliar no QC.</div>
            </div>
          </div>
          {autoDaily && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
              <Switch on={autoDailyImage} disabled={autoSaving} onClick={() => saveAuto({ auto_daily_test_image: !autoDailyImage })} />
              <div style={{ fontSize: '11.5px', color: 'white' }}>Incluir imagem</div>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <Switch on={allowCarrossel} disabled={!autoLoaded || autoSaving} onClick={() => saveAuto({ allow_carrossel: !allowCarrossel })} />
            <div>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'white' }}>Considerar formato Carrossel</div>
              <div style={{ fontSize: '10px', color: MUTED }}>Desligado: todo post vira foto única, sempre usando um dos templates reais (Tweet Print, Anúncio, etc.).</div>
            </div>
          </div>
        </div>
      )}

      {generating && <ProgressBar label="Diretor Criativo criando + controle de qualidade avaliando... (pode levar ~1 min)" />}
      {error && <div style={{ color: '#f87171', fontSize: '11.5px', marginBottom: '12px' }}>{error}</div>}
      {okMsg && <div style={{ color: GREEN, fontSize: '11.5px', marginBottom: '12px' }}>{okMsg}</div>}

      {loading ? (
        <div style={{ fontSize: '12px', color: MUTED }}>Carregando testes...</div>
      ) : tests.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: MUTED, fontSize: '12.5px', background: CARD, border: `1px dashed ${BORDER}`, borderRadius: '11px' }}>
          Nenhum post de teste ainda. Clique em <strong>"Gerar post de teste"</strong> — ele já vem com nota de qualidade.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: '12px' }}>
          {tests.map(t => {
            const busy = busyId === t.id
            return (
              <div key={t.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <PostMedia post={t} />
                <div style={{ padding: '13px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    {t.format && <span style={{ fontSize: '9px', fontWeight: 700, color: ORANGE, padding: '2px 7px', borderRadius: '99px', border: `1px solid rgba(255,109,41,0.35)`, textTransform: 'uppercase' }}>{t.format}</span>}
                    {/* Template só é usado de verdade quando format="foto" (ver creative-generate) — pra carrossel/reel/story o valor é só um placeholder sem efeito, então não mostra. */}
                    {t.format === 'foto' && t.brief?.template && (
                      <span style={{ fontSize: '9px', fontWeight: 700, color: '#A78BFA', padding: '2px 7px', borderRadius: '99px', border: '1px solid rgba(167,139,250,0.35)' }}>
                        {TEMPLATE_LABEL[t.brief.template] ?? t.brief.template}
                      </span>
                    )}
                    <span style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.3)', marginLeft: 'auto' }}>{timeAgo(t.created_at)}</span>
                  </div>
                  {t.idea && <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'white' }}>{t.idea}</div>}
                  {t.caption && <div style={{ fontSize: '11.5px', color: MUTED, lineHeight: 1.5, maxHeight: '84px', overflow: 'auto' }}>{t.caption}</div>}
                  {t.cta && (
                    <div style={{ fontSize: '11px', color: 'white', background: 'rgba(255,109,41,0.1)', border: '1px solid rgba(255,109,41,0.25)', borderRadius: '7px', padding: '6px 9px' }}>
                      <span style={{ color: ORANGE, fontWeight: 700 }}>CTA:</span> {t.cta}
                    </div>
                  )}
                  {t.hashtags && <div style={{ fontSize: '11px', color: '#60a5fa', lineHeight: 1.4 }}>{t.hashtags}</div>}

                  <BriefBlock post={t} />
                  <VideoScript post={t} />
                  <ScoreBreakdown post={t} />

                  <div style={{ display: 'flex', gap: '7px', marginTop: 'auto', paddingTop: '2px', flexWrap: 'wrap' }}>
                    {t.quality_score == null ? (
                      <button onClick={() => act(t.id, { action: 'score' })} disabled={busy}
                        style={{ flex: 1, padding: '8px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, borderRadius: '8px', color: 'white', fontSize: '11.5px', fontWeight: 700, cursor: busy ? 'default' : 'pointer', fontFamily: D }}>
                        {busy ? '...' : 'Avaliar'}
                      </button>
                    ) : (
                      <>
                        {/* Enviar pro Vault sempre existe — a IA só avisa quando acha ruim, quem decide é o dono. */}
                        <button onClick={() => act(t.id, { action: 'to_vault' }, 'Enviado pro Vault ✓')} disabled={busy}
                          style={{ flex: 1, padding: '8px', background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.35)', borderRadius: '8px', color: GREEN, fontSize: '11.5px', fontWeight: 700, cursor: busy ? 'default' : 'pointer', fontFamily: D }}>
                          {busy ? '...' : '⭐ Enviar pro Vault'}
                        </button>
                        {(coherenceIsBad(t) || visualIsBad(t)) && (
                          <button onClick={() => act(t.id, { action: 'regenerate' })} disabled={busy}
                            style={{ flex: 1, padding: '8px', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.35)', borderRadius: '8px', color: '#FBBF24', fontSize: '11.5px', fontWeight: 700, cursor: busy ? 'default' : 'pointer', fontFamily: D }}>
                            {busy ? 'Regenerando...' : coherenceIsBad(t) ? '🔁 Corrigir coerência' : '🔁 Corrigir imagem'}
                          </button>
                        )}
                      </>
                    )}
                    <button onClick={() => discard(t.id)} disabled={busy}
                      style={{ padding: '8px 12px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '8px', color: MUTED, fontSize: '11.5px', cursor: busy ? 'default' : 'pointer', fontFamily: D }}>
                      Descartar
                    </button>
                  </div>

                  <button onClick={() => setAdaptFor(t as unknown as VaultPost)} style={{ padding: '7px', background: 'rgba(255,109,41,0.1)', border: '1px solid rgba(255,109,41,0.3)', borderRadius: '8px', color: '#FF6D29', fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: D, marginTop: '2px' }}>✨ Adaptar</button>
                  {adapts[t.id]?.length ? (
                    <div>
                      <button onClick={() => toggleExpanded(t.id)} style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: MUTED, fontSize: '10.5px', fontWeight: 700, cursor: 'pointer', fontFamily: D, padding: '3px 0' }}>Adaptações ({adapts[t.id].length}) {expanded.has(t.id) ? '▴' : '▾'}</button>
                      {expanded.has(t.id) && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(78px, 1fr))', gap: '6px', marginTop: '3px' }}>
                          {adapts[t.id].map(a => (
                            <div key={a.id} style={{ border: `1px solid ${BORDER}`, borderRadius: '7px', overflow: 'hidden' }}>
                              {a.image_url && <img src={a.image_url} alt="" style={{ width: '100%', height: '64px', objectFit: 'cover' }} />}
                              <div style={{ padding: '4px 5px' }}>
                                <div style={{ fontSize: '8px', color: MUTED, marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.format}</div>
                                <button onClick={() => discard(a.id)} title="Excluir" style={{ width: '100%', padding: '2px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '4px', color: MUTED, fontSize: '8px', cursor: 'pointer', fontFamily: D }}>🗑</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {adaptFor && <AdaptModal post={adaptFor} companyId={companyId} onClose={() => setAdaptFor(null)} onDone={() => { load() }} />}
    </section>
  )
}
