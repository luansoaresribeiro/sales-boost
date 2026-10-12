// Configurações → Servidor: o "estúdio de vídeo" na VPS da Hostinger
// (decisão do dono 2026-10-12, docs/DECISIONS.md). Conecta a VPS com um
// comando de 15 min (nenhuma senha passa pelo chat), mostra se ela está no
// ar, liga/desliga o acabamento e roda um teste antes × depois.
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'

const ORANGE = '#FF6D29'
const CARD = '#150E08'
const MUTED = '#BABABA'
const BORDER = 'rgba(255,255,255,0.06)'
const GREEN = '#4ade80'
const RED = '#f87171'
const D = "'Bricolage Grotesque', system-ui, sans-serif"
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

interface NodeInfo { os?: string | null; cpus?: number | null; mem_total_mb?: number | null; mem_free_mb?: number | null; disk_free_gb?: number | null; ffmpeg?: string | null; jobs_done?: number | null }
interface WorkerNode { id: string; name: string; status: string; online: boolean; last_seen_at: string | null; info: NodeInfo }
interface Job { id: string; status: string; attempts: number; error: string | null; test: boolean; sample: boolean; created_at: string; before_url: string | null; after_url: string | null }
interface Status { enabled: boolean; nodes: WorkerNode[]; jobs: Job[] }

const JOB_LABEL: Record<string, { text: string; color: string }> = {
  queued: { text: 'Na fila', color: MUTED },
  running: { text: 'Montando…', color: '#FBBF24' },
  done: { text: 'Pronto', color: GREEN },
  failed: { text: 'Falhou', color: RED },
}

function ago(iso: string | null): string {
  if (!iso) return 'nunca'
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return `há ${s}s`
  if (s < 3600) return `há ${Math.round(s / 60)} min`
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const btn = (bg: string, color = '#000') => ({ padding: '9px 16px', background: bg, color, border: 'none', borderRadius: '9px', fontWeight: 800, fontSize: '12.5px', cursor: 'pointer', fontFamily: D })

export default function ServerPanel() {
  const { session } = useAuth()
  const [st, setSt] = useState<Status | null>(null)
  const [error, setError] = useState('')
  const [command, setCommand] = useState('')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  const call = useCallback(async (action: string, extra: Record<string, unknown> = {}) => {
    if (!session) throw new Error('Sem sessão')
    const res = await fetch(`${SUPABASE_URL}/functions/v1/vps-worker`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data.error) throw new Error(data.error ?? `Erro ${res.status}`)
    return data
  }, [session])

  const load = useCallback(async () => {
    try { setSt(await call('status')); setError('') } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
  }, [call])

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), 10_000)
    return () => clearInterval(t)
  }, [load])

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError('')
    try { await fn(); await load() } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    setBusy(false)
  }

  const active = (st?.nodes ?? []).filter(n => n.status === 'active')
  const online = active.some(n => n.online)

  return (
    <div>
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '18px 20px', marginBottom: '16px' }}>
        <div style={{ fontFamily: D, fontSize: '15px', fontWeight: 800, color: 'white', marginBottom: '6px' }}>🎬 Estúdio de vídeo no seu servidor</div>
        <div style={{ fontSize: '12.5px', color: MUTED, lineHeight: 1.6 }}>
          A VPS da Hostinger dá o acabamento nos vídeos do imóvel: deixa o vídeo <strong style={{ color: 'white' }}>em pé (1080×1920)</strong> ocupando a tela toda com fundo desfocado (nada é cortado), com entrada e saída suaves, no formato que o Instagram prefere, e tira uma capa.
          Se o servidor cair, os vídeos continuam saindo do jeito de antes (se ele cair no meio de um vídeo, esse vídeo pode levar até 20 minutos a mais).
        </div>
      </div>

      {error && <div style={{ marginBottom: '14px', padding: '10px 14px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: '9px', fontSize: '12.5px', color: RED }}>{error}</div>}
      {!st && !error && <div style={{ color: MUTED, fontSize: '13px' }}>Carregando…</div>}

      {st && (
        <>
          {active.map(n => (
            <div key={n.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '16px 20px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: 'white' }}>{n.online ? '🟢' : '🔴'} {n.name} <span style={{ fontSize: '12px', fontWeight: 600, color: n.online ? GREEN : RED }}>{n.online ? 'online' : 'fora do ar'}</span></div>
                  <div style={{ fontSize: '11.5px', color: MUTED, marginTop: '3px' }}>Último sinal {ago(n.last_seen_at)}</div>
                </div>
                <button disabled={busy} onClick={() => { if (confirm('Desconectar este servidor? Os vídeos voltam pro jeito de antes até conectar de novo.')) void act(() => call('revoke', { node_id: n.id })) }}
                  style={btn('transparent', MUTED)}>Desconectar</button>
              </div>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '10px', fontSize: '11.5px', color: MUTED }}>
                {n.info.cpus != null && <span>CPU: <b style={{ color: 'white' }}>{n.info.cpus}</b></span>}
                {n.info.mem_total_mb != null && <span>Memória: <b style={{ color: 'white' }}>{((n.info.mem_free_mb ?? 0) / 1024).toFixed(1)} GB livres de {(n.info.mem_total_mb / 1024).toFixed(1)} GB</b></span>}
                {n.info.disk_free_gb != null && <span>Disco livre: <b style={{ color: 'white' }}>{n.info.disk_free_gb} GB</b></span>}
                {n.info.jobs_done != null && <span>Vídeos desde a última ligada: <b style={{ color: 'white' }}>{n.info.jobs_done}</b></span>}
              </div>
            </div>
          ))}

          {!online && !command && (
            <div style={{ background: CARD, border: `1px dashed rgba(255,109,41,0.4)`, borderRadius: '14px', padding: '18px 20px', marginBottom: '12px' }}>
              <div style={{ fontSize: '13px', color: 'white', marginBottom: '10px' }}>{active.length ? 'O servidor está fora do ar. Se ele foi reinstalado ou trocado, conecte de novo:' : 'Nenhum servidor conectado.'}</div>
              <button disabled={busy} onClick={() => void act(async () => setCommand((await call('enroll_start')).command))} style={btn(ORANGE)}>Conectar servidor</button>
            </div>
          )}

          {command && !online && (
            <div style={{ background: CARD, border: `1px solid rgba(255,109,41,0.4)`, borderRadius: '14px', padding: '18px 20px', marginBottom: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'white', marginBottom: '8px' }}>Como conectar (uns 3 minutos):</div>
              <ol style={{ fontSize: '12.5px', color: MUTED, lineHeight: 1.8, paddingLeft: '18px', margin: '0 0 12px' }}>
                <li>No painel da Hostinger, abra <b style={{ color: 'white' }}>VPS → Terminal</b> (o terminal do navegador).</li>
                <li>Copie o comando abaixo, cole no terminal e aperte Enter.</li>
                <li>Espere aparecer <b style={{ color: 'white' }}>"Pronto ✅"</b>. O servidor aparece aqui como 🟢 online.</li>
              </ol>
              <div style={{ fontFamily: 'monospace', fontSize: '11.5px', color: 'white', background: 'rgba(0,0,0,0.4)', border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '10px 12px', wordBreak: 'break-all', marginBottom: '10px' }}>{command}</div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => { void navigator.clipboard.writeText(command).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }) }} style={btn(ORANGE)}>{copied ? 'Copiado ✓' : 'Copiar comando'}</button>
                <span style={{ fontSize: '11.5px', color: MUTED }}>O comando vale 15 minutos e só uma vez. Não mande pra ninguém.</span>
              </div>
            </div>
          )}

          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '16px 20px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'white' }}>Usar o servidor nos vídeos dos clientes</div>
              <div style={{ fontSize: '11.5px', color: MUTED, marginTop: '3px' }}>
                {st.enabled ? (online ? 'Ligado — os vídeos novos saem com acabamento.' : 'Ligado, mas sem servidor online — os vídeos saem do jeito de antes.') : 'Desligado — os vídeos saem do jeito de antes.'}
              </div>
            </div>
            <button disabled={busy} onClick={() => void act(() => call('set_enabled', { enabled: !st.enabled }))} style={btn(st.enabled ? 'rgba(255,255,255,0.1)' : ORANGE, st.enabled ? 'white' : '#000')}>
              {st.enabled ? 'Desligar' : 'Ligar'}
            </button>
          </div>

          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
              <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'white' }}>Últimos trabalhos</div>
              <button disabled={busy || !online} title={online ? '' : 'Conecte um servidor primeiro'} onClick={() => void act(() => call('test'))}
                style={{ ...btn(online ? ORANGE : 'rgba(255,255,255,0.08)', online ? '#000' : MUTED), cursor: online ? 'pointer' : 'not-allowed' }}>Testar antes × depois</button>
            </div>
            {st.jobs.length === 0 && <div style={{ fontSize: '12px', color: MUTED }}>Nenhum ainda. O teste usa um vídeo da sua própria conta (nunca de cliente) ou, se não houver, um vídeo de amostra deitado — e guarda o resultado numa pasta à parte.</div>}
            {st.jobs.map(j => (
              <div key={j.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', padding: '8px 0', borderTop: `1px solid ${BORDER}`, fontSize: '12px' }}>
                <span style={{ color: MUTED }}>{ago(j.created_at)} · {j.sample ? 'teste com vídeo de amostra' : j.test ? 'teste' : 'vídeo de cliente'}</span>
                <span style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  {j.test && j.status === 'done' && j.before_url && <a href={j.before_url} target="_blank" rel="noreferrer" style={{ color: MUTED }}>antes</a>}
                  {j.after_url && <a href={j.after_url} target="_blank" rel="noreferrer" style={{ color: ORANGE, fontWeight: 700 }}>depois</a>}
                  <span style={{ color: JOB_LABEL[j.status]?.color ?? MUTED, fontWeight: 700 }} title={j.error ?? ''}>{JOB_LABEL[j.status]?.text ?? j.status}</span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
