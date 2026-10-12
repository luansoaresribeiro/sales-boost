// Exclusão em lote de empresas (pedido do dono 2026-10-11). Proteção em 3
// camadas: (1) empresas travadas nem podem ser marcadas na lista; (2) aqui é
// preciso digitar a frase exata "EXCLUIR N EMPRESAS"; (3) o servidor
// (owner-delete-company) confere tudo de novo e pula as travadas.
import { useState } from 'react'

const MUTED = '#BABABA'
const RED = '#f87171'
const D = "'Bricolage Grotesque', system-ui, sans-serif"
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
export const MAX_BULK_DELETE = 25

export const bulkPhrase = (n: number) => `EXCLUIR ${n} ${n === 1 ? 'CADASTRO' : 'CADASTROS'}`

// kind 'company' apaga empresa + login; 'login' é cadastro sem empresa ("sem perfil").
export interface BulkItem { id: string; name: string; email: string; kind: 'company' | 'login' }
type Result = { deleted: string[]; skipped: { id: string; name: string | null; reason: string }[] }

export default function BulkDeleteDialog({ items, token, onClose, onDone }: {
  items: BulkItem[]; token: string; onClose: () => void; onDone: () => void
}) {
  const phrase = bulkPhrase(items.length)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const ok = typed.trim() === phrase

  const run = async () => {
    if (!ok || busy) return
    setBusy(true); setError('')
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/owner-delete-company`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_ids: items.filter(i => i.kind === 'company').map(i => i.id), user_ids: items.filter(i => i.kind === 'login').map(i => i.id), confirm_phrase: typed.trim() }),
      })
      const data = await res.json().catch(() => ({})) as Partial<Result> & { error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Erro ao excluir')
      setResult({ deleted: data.deleted ?? [], skipped: data.skipped ?? [] })
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setBusy(false)
  }

  return (
    <div role="dialog" aria-modal="true" onClick={() => !busy && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 520, background: '#150E08', border: '1px solid rgba(248,113,113,0.4)', borderRadius: 16, padding: 24, fontFamily: D }}>
        {result ? (
          <>
            <div style={{ fontSize: 18, fontWeight: 900, color: 'white', marginBottom: 10 }}>
              {result.deleted.length} {result.deleted.length === 1 ? 'cadastro excluído' : 'cadastros excluídos'}
            </div>
            {result.skipped.length > 0 && (
              <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.6, marginBottom: 12 }}>
                Não excluídas:
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {result.skipped.map(s => <li key={s.id}>{s.name ?? s.id} — {s.reason}</li>)}
                </ul>
              </div>
            )}
            <button onClick={onClose} style={{ width: '100%', padding: 12, background: 'rgba(255,255,255,0.08)', color: 'white', border: 'none', borderRadius: 10, fontWeight: 800, cursor: 'pointer' }}>Fechar</button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 18, fontWeight: 900, color: RED, marginBottom: 6 }}>⚠️ Excluir {items.length} {items.length === 1 ? 'cadastro' : 'cadastros'} para sempre</div>
            <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.6, marginBottom: 12 }}>
              Some a empresa (estratégia, posts, vídeos, contatos e conversas) <strong style={{ color: 'white' }}>e o login da pessoa</strong> — ela não consegue mais entrar. <strong style={{ color: 'white' }}>Não dá pra desfazer.</strong> O diagnóstico grátis fica guardado sem dono.
            </div>
            <div style={{ maxHeight: 200, overflowY: 'auto', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '8px 12px', marginBottom: 14 }}>
              {items.map(i => (
                <div key={i.id} style={{ fontSize: 13, color: 'white', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  {i.name} <span style={{ color: MUTED, fontSize: 11.5 }}>· {i.kind === 'login' ? 'login sem empresa' : i.email}</span>
                </div>
              ))}
            </div>
            <label style={{ display: 'block', fontSize: 12.5, color: 'white', marginBottom: 6 }}>
              Pra confirmar, digite exatamente: <strong style={{ color: RED, userSelect: 'none' }}>{phrase}</strong>
            </label>
            <input value={typed} onChange={e => setTyped(e.target.value)} placeholder={phrase} autoComplete="off" spellCheck={false}
              onPaste={e => e.preventDefault()}
              style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${ok ? RED : 'rgba(255,255,255,0.12)'}`, borderRadius: 10, color: 'white', fontSize: 14, outline: 'none', marginBottom: 12, fontFamily: 'inherit' }} />
            {error && <div style={{ fontSize: 12.5, color: RED, marginBottom: 10 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} disabled={busy}
                style={{ flex: 1, padding: 12, background: 'transparent', color: MUTED, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={() => void run()} disabled={!ok || busy}
                style={{ flex: 1, padding: 12, background: ok ? '#dc2626' : 'rgba(220,38,38,0.25)', color: ok ? 'white' : 'rgba(255,255,255,0.4)', border: 'none', borderRadius: 10, fontWeight: 900, cursor: ok && !busy ? 'pointer' : 'not-allowed' }}>
                {busy ? 'Excluindo…' : 'Excluir para sempre'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
