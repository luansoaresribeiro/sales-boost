import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import ApiUsagePanel from './ApiUsagePanel'
import BusinessTypesPanel from './BusinessTypesPanel'
import ServerPanel from './ServerPanel'

const ORANGE = '#FF6D29'
const BG = '#0E0B0A'
const CARD = '#150E08'
const MUTED = '#BABABA'
const BORDER = 'rgba(255,255,255,0.06)'
const D = "'Bricolage Grotesque', system-ui, sans-serif"
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const BOT_USERNAME = 'luansoaresribeirobot'

// A aba "Referências globais" saiu a pedido do dono (2026-10-11).
type Tab = 'avisos' | 'apis' | 'negocios' | 'servidor'

export default function OwnerSettingsPage() {
  const { session, signOut } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('avisos')
  const [telegramChatId, setTelegramChatId] = useState<string | null>(null)
  const [telegramCode, setTelegramCode] = useState('')
  const [generating, setGenerating] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) return
    supabase.from('prospect_settings').select('telegram_chat_id').eq('id', true).maybeSingle()
      .then(({ data }) => {
        setTelegramChatId((data?.telegram_chat_id as string | null) ?? null)
        setLoading(false)
      })
  }, [session])

  const generateCode = async () => {
    if (!session) return
    setGenerating(true)
    setTelegramCode('')
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/owner-telegram-link`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json() as { code?: string; error?: string }
      if (data.code) setTelegramCode(data.code)
    } catch { /* silently ignore */ }
    setGenerating(false)
  }

  const disconnect = async () => {
    setDisconnecting(true)
    await supabase.from('prospect_settings').update({ telegram_chat_id: null }).eq('id', true)
    setTelegramChatId(null)
    setTelegramCode('')
    setDisconnecting(false)
  }

  const connected = !!telegramChatId

  const TABS: { key: Tab; label: string }[] = [
    { key: 'avisos', label: 'Avisos' },
    { key: 'apis', label: "APIs" },
    { key: 'negocios', label: 'Tipos de negócio' },
    { key: 'servidor', label: 'Servidor' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: BG }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => navigate('/owner')} style={{ background: 'transparent', border: 'none', color: MUTED, fontSize: '18px', cursor: 'pointer', padding: '4px' }}>←</button>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#000', fontWeight: 900, fontSize: '11px' }}>SB</span>
          </div>
          <div>
            <span style={{ fontFamily: D, fontSize: '1rem', fontWeight: 800, color: 'white' }}>SalesBoost</span>
            <span style={{ fontSize: '11px', marginLeft: '10px', padding: '2px 8px', background: 'rgba(255,109,41,0.1)', borderRadius: '99px', border: '1px solid rgba(255,109,41,0.2)', color: ORANGE }}>Configurações</span>
          </div>
        </div>
        <button onClick={async () => { await signOut(); navigate('/') }}
          style={{ padding: '7px 16px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '8px', color: MUTED, fontSize: '12px', cursor: 'pointer' }}>
          Sair
        </button>
      </div>

      <div style={{ padding: '32px', maxWidth: tab === 'apis' ? '920px' : '640px' }}>
        <div style={{ marginBottom: '20px' }}>
          <h1 style={{ fontFamily: D, fontSize: '1.8rem', fontWeight: 900, color: 'white', letterSpacing: '-0.03em', marginBottom: '4px' }}>Configurações</h1>
          <p style={{ color: MUTED, fontSize: '14px' }}>Avisos, integrações e APIs do painel do dono.</p>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '22px', borderBottom: `1px solid ${BORDER}` }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ padding: '9px 4px', marginBottom: '-1px', background: 'transparent', border: 'none', borderBottom: `2px solid ${tab === t.key ? ORANGE : 'transparent'}`, color: tab === t.key ? 'white' : MUTED, fontSize: '13.5px', fontWeight: tab === t.key ? 700 : 500, cursor: 'pointer', fontFamily: D, marginRight: '18px' }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'avisos' && (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 22px', borderBottom: `1px solid ${BORDER}` }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'white' }}>Aviso de lead quente</span>
            </div>
            <div style={{ padding: '22px' }}>
              <p style={{ fontSize: '12px', color: MUTED, marginBottom: '18px', lineHeight: 1.6 }}>
                Conecte seu Telegram pra receber uma mensagem na hora sempre que a busca de leads encontrar um negócio com score 80 ou mais.
              </p>

              {loading ? (
                <div style={{ color: MUTED, fontSize: '13px' }}>Carregando...</div>
              ) : connected ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: '10px' }}>
                  <span style={{ fontSize: '18px' }}>✈️</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', color: '#4ade80', fontWeight: 600 }}>✓ Telegram conectado</div>
                    <div style={{ fontSize: '11px', color: MUTED, marginTop: '1px' }}>Leads com score 80+ vão te avisar por lá, na hora.</div>
                  </div>
                  <button onClick={disconnect} disabled={disconnecting}
                    style={{ padding: '7px 14px', background: 'transparent', color: '#f87171', fontWeight: 600, fontSize: '12px', borderRadius: '8px', border: '1px solid rgba(248,113,113,0.3)', cursor: disconnecting ? 'not-allowed' : 'pointer', flexShrink: 0 }}>
                    {disconnecting ? 'Desconectando...' : 'Desconectar'}
                  </button>
                </div>
              ) : (
                <div>
                  <button onClick={generateCode} disabled={generating || !!telegramCode}
                    style={{ padding: '10px 18px', background: 'rgba(255,109,41,0.12)', border: '1px solid rgba(255,109,41,0.3)', borderRadius: '9px', color: ORANGE, fontSize: '13px', fontWeight: 700, cursor: generating || !!telegramCode ? 'default' : 'pointer' }}>
                    {generating ? 'Gerando...' : telegramCode ? '✓ Código pronto' : '✈️ Conectar Telegram'}
                  </button>

                  {telegramCode && (
                    <a
                      href={`https://t.me/${BOT_USERNAME}?start=${telegramCode}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: 'block', marginTop: '14px', padding: '14px 20px', background: ORANGE, borderRadius: '12px', color: '#000', fontSize: '15px', fontWeight: 800, textAlign: 'center', textDecoration: 'none', letterSpacing: '-0.01em' }}>
                      Abrir no Telegram e conectar →
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'apis' && <ApiUsagePanel />}

        {tab === 'negocios' && <BusinessTypesPanel />}

        {tab === 'servidor' && <ServerPanel />}

      </div>
    </div>
  )
}
