// Etapa A2: o dono informa os custos FIXOS do mês (VPS, Supabase, Cloudflare…). Mesmo mês + item = atualiza; nada é apagado.
import { useState } from 'react'

const ORANGE = '#FF6D29'
const CARD = '#150E08'
const MUTED = '#BABABA'
const BORDER = 'rgba(255,255,255,0.06)'
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const input = { padding: '8px 10px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '8px', color: 'white', fontSize: '13px', minWidth: 0 }

export default function FixedCostForm({ rows, accessToken, onSaved }: { rows: { month: string; item: string; amount_usd: number; source: string }[]; accessToken: string; onSaved: () => void }) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [item, setItem] = useState('')
  const [amount, setAmount] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true); setMsg(null)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/api-usage`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'set_fixed', month, item, amount_usd: Number(amount.replace(',', '.')) }) })
      const j = await res.json()
      if (!res.ok || !j.ok) throw new Error(j.error ?? `Erro ${res.status}`)
      setItem(''); setAmount(''); setMsg('Salvo.'); onSaved()
    } catch (e) { setMsg(e instanceof Error ? e.message : String(e)) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '16px' }}>
      <h2 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 6px' }}>Custos fixos do mês</h2>
      <p style={{ fontSize: '11px', color: MUTED, margin: '0 0 10px' }}>Valores da fatura de cada serviço, em dólar. Aparecem separados do custo variável.</p>
      {rows.length > 0 && (
        <div style={{ display: 'grid', gap: '4px', fontSize: '12px', marginBottom: '12px' }}>
          {rows.map(r => <div key={`${r.month}-${r.item}`}>{r.month.slice(0, 7)} · <b>{r.item}</b>: US$ {Number(r.amount_usd).toFixed(2)} <span style={{ color: MUTED }}>({r.source})</span></div>)}
        </div>
      )}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={input} aria-label="Mês" />
        <input value={item} onChange={e => setItem(e.target.value)} placeholder="Item (ex.: VPS)" style={{ ...input, flex: '1 1 140px' }} aria-label="Item" />
        <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="US$" inputMode="decimal" style={{ ...input, width: '90px' }} aria-label="Valor em dólar" />
        <button onClick={save} disabled={saving || !item.trim() || !amount.trim()} style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: ORANGE, color: 'white', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: saving || !item.trim() || !amount.trim() ? 0.5 : 1 }}>Salvar</button>
      </div>
      {msg && <div style={{ fontSize: '12px', color: MUTED, marginTop: '8px' }}>{msg}</div>}
    </div>
  )
}
