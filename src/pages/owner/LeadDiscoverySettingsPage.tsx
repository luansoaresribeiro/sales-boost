import { useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  BUSINESS_TYPES, DEFAULT_WEIGHTS, WEIGHT_LABELS,
  type ScoringWeights, type SearchKeyword,
} from './prospectShared'

const ORANGE = '#FF6D29'
const BG = '#0E0B0A'
const CARD = '#150E08'
const MUTED = '#BABABA'
const BORDER = 'rgba(255,255,255,0.06)'
const D = "'Bricolage Grotesque', system-ui, sans-serif"

// Valores de fábrica — usados só pelo botão "Restaurar padrões". Cidades e
// palavras-chave não entram aqui: são dados que o dono digitou, não "um
// padrão" pra restaurar.
const FACTORY_DEFAULTS = {
  maxPerNight: 10, minRating: 4.0, maxRating: 4.8, minReviews: 50, maxReviews: 500,
  requireActiveInstagram: true, requirePhone: true, excludeChains: true,
  customInstructions: '', weights: DEFAULT_WEIGHTS, confidenceThreshold: 60,
}

function SettingsSection({ title, description, children, defaultOpen = true }: { title: string; description: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', marginBottom: '16px', overflow: 'hidden' }}>
      <div onClick={() => setOpen(o => !o)} style={{ padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>{title}</div>
          <div style={{ fontSize: '11.5px', color: MUTED, marginTop: '3px' }}>{description}</div>
        </div>
        <span style={{ color: MUTED, fontSize: '13px', flexShrink: 0, marginLeft: '16px' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && <div style={{ padding: '0 24px 22px' }}>{children}</div>}
    </div>
  )
}

const inputStyle = { padding: '8px 12px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '8px', color: 'white', fontSize: '13px', outline: 'none' } as const
const labelStyle = { display: 'block', fontSize: '11px', fontWeight: 600, color: MUTED, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: '6px' }

export default function LeadDiscoverySettingsPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)

  const [cities, setCities] = useState('')
  const [enabledTypes, setEnabledTypes] = useState<string[]>([])
  const [maxPerNight, setMaxPerNight] = useState(FACTORY_DEFAULTS.maxPerNight)
  const [minRating, setMinRating] = useState(FACTORY_DEFAULTS.minRating)
  const [maxRating, setMaxRating] = useState(FACTORY_DEFAULTS.maxRating)
  const [minReviews, setMinReviews] = useState(FACTORY_DEFAULTS.minReviews)
  const [maxReviews, setMaxReviews] = useState(FACTORY_DEFAULTS.maxReviews)
  const [requireActiveInstagram, setRequireActiveInstagram] = useState(FACTORY_DEFAULTS.requireActiveInstagram)
  const [requirePhone, setRequirePhone] = useState(FACTORY_DEFAULTS.requirePhone)
  const [excludeChains, setExcludeChains] = useState(FACTORY_DEFAULTS.excludeChains)
  const [customInstructions, setCustomInstructions] = useState(FACTORY_DEFAULTS.customInstructions)
  const [weights, setWeights] = useState<ScoringWeights>(FACTORY_DEFAULTS.weights)
  const [confidenceThreshold, setConfidenceThreshold] = useState(FACTORY_DEFAULTS.confidenceThreshold)

  const [keywords, setKeywords] = useState<SearchKeyword[]>([])
  const [newKeywordType, setNewKeywordType] = useState(BUSINESS_TYPES[0])
  const [newKeywordText, setNewKeywordText] = useState('')

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!session) return
    void loadAll()
  }, [session])

  const loadAll = async () => {
    setLoading(true)
    const [{ data: settingsData }, { data: keywordData }] = await Promise.all([
      supabase.from('prospect_settings')
        .select('cities, business_types, max_per_night, min_rating, max_rating, min_reviews, max_reviews, require_active_instagram, require_phone, exclude_chains, icp_custom_instructions, scoring_weights, icp_confidence_threshold')
        .eq('id', true).maybeSingle(),
      supabase.from('prospect_search_keywords').select('id, business_type, keyword, active').order('business_type').order('keyword'),
    ])
    if (settingsData) {
      setCities((settingsData.cities ?? []).join(', '))
      setEnabledTypes(settingsData.business_types ?? [])
      setMaxPerNight(settingsData.max_per_night ?? FACTORY_DEFAULTS.maxPerNight)
      setMinRating(settingsData.min_rating ?? FACTORY_DEFAULTS.minRating)
      setMaxRating(settingsData.max_rating ?? FACTORY_DEFAULTS.maxRating)
      setMinReviews(settingsData.min_reviews ?? FACTORY_DEFAULTS.minReviews)
      setMaxReviews(settingsData.max_reviews ?? FACTORY_DEFAULTS.maxReviews)
      setRequireActiveInstagram(settingsData.require_active_instagram ?? FACTORY_DEFAULTS.requireActiveInstagram)
      setRequirePhone(settingsData.require_phone ?? FACTORY_DEFAULTS.requirePhone)
      setExcludeChains(settingsData.exclude_chains ?? FACTORY_DEFAULTS.excludeChains)
      setCustomInstructions(settingsData.icp_custom_instructions ?? FACTORY_DEFAULTS.customInstructions)
      setWeights((settingsData.scoring_weights as ScoringWeights) ?? FACTORY_DEFAULTS.weights)
      setConfidenceThreshold(settingsData.icp_confidence_threshold ?? FACTORY_DEFAULTS.confidenceThreshold)
    }
    setKeywords((keywordData ?? []) as SearchKeyword[])
    setLoading(false)
  }

  const saveSettings = async () => {
    setSaving(true)
    setSaved(false)
    const cityList = cities.split(',').map(c => c.trim()).filter(Boolean)
    const { error } = await supabase.from('prospect_settings').update({
      cities: cityList, business_types: enabledTypes, max_per_night: maxPerNight,
      min_rating: minRating, max_rating: maxRating, min_reviews: minReviews, max_reviews: maxReviews,
      require_active_instagram: requireActiveInstagram, require_phone: requirePhone, exclude_chains: excludeChains,
      icp_custom_instructions: customInstructions.trim() || null,
      scoring_weights: weights, icp_confidence_threshold: confidenceThreshold,
      updated_at: new Date().toISOString(),
    }).eq('id', true)
    setSaving(false)
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 2000) }
  }

  // Só restaura os campos de ICP/pontuação/automação pra fábrica — cidades e
  // palavras-chave são dados que o dono cadastrou, não faz sentido apagar.
  const restoreDefaults = () => {
    setMaxPerNight(FACTORY_DEFAULTS.maxPerNight)
    setMinRating(FACTORY_DEFAULTS.minRating)
    setMaxRating(FACTORY_DEFAULTS.maxRating)
    setMinReviews(FACTORY_DEFAULTS.minReviews)
    setMaxReviews(FACTORY_DEFAULTS.maxReviews)
    setRequireActiveInstagram(FACTORY_DEFAULTS.requireActiveInstagram)
    setRequirePhone(FACTORY_DEFAULTS.requirePhone)
    setExcludeChains(FACTORY_DEFAULTS.excludeChains)
    setCustomInstructions(FACTORY_DEFAULTS.customInstructions)
    setWeights(FACTORY_DEFAULTS.weights)
    setConfidenceThreshold(FACTORY_DEFAULTS.confidenceThreshold)
  }

  const addKeyword = async () => {
    if (!newKeywordText.trim()) return
    const { data, error } = await supabase.from('prospect_search_keywords')
      .insert({ business_type: newKeywordType, keyword: newKeywordText.trim() }).select('id, business_type, keyword, active').single()
    if (!error && data) {
      setKeywords(prev => [...prev, data as SearchKeyword].sort((a, b) => a.business_type.localeCompare(b.business_type) || a.keyword.localeCompare(b.keyword)))
      setNewKeywordText('')
    }
  }

  const toggleKeywordActive = async (id: string, active: boolean) => {
    setKeywords(prev => prev.map(k => k.id === id ? { ...k, active } : k))
    await supabase.from('prospect_search_keywords').update({ active }).eq('id', id)
  }

  const deleteKeyword = async (id: string) => {
    setKeywords(prev => prev.filter(k => k.id !== id))
    await supabase.from('prospect_search_keywords').delete().eq('id', id)
  }

  const goBack = () => navigate('/owner/prospects')

  return (
    <div style={{ minHeight: '100vh', background: BG }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={goBack} style={{ background: 'transparent', border: 'none', color: MUTED, fontSize: '18px', cursor: 'pointer', padding: '4px' }}>← Voltar</button>
          <div style={{ width: '1px', height: '20px', background: BORDER }} />
          <span style={{ fontFamily: D, fontSize: '1rem', fontWeight: 800, color: 'white' }}>Configurações da Busca de Leads</span>
        </div>
        <button onClick={goBack} style={{ padding: '7px 16px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '8px', color: MUTED, fontSize: '12px', cursor: 'pointer' }}>
          Fechar
        </button>
      </div>

      <div style={{ padding: '32px', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontFamily: D, fontSize: '1.6rem', fontWeight: 900, color: 'white', letterSpacing: '-0.03em', marginBottom: '4px' }}>Como o Agente de Leads funciona</h1>
          <p style={{ color: MUTED, fontSize: '13.5px' }}>Tudo aqui define onde, o quê e como ele busca — as mudanças só valem depois de clicar em "Salvar configurações".</p>
        </div>

        {loading ? (
          <div style={{ color: MUTED, fontSize: '14px', padding: '32px' }}>Carregando...</div>
        ) : (
          <>
            <SettingsSection title="Regiões de busca" description="As cidades onde o agente vai procurar negócios.">
              <label style={labelStyle}>Cidades que você atende (separadas por vírgula)</label>
              <input value={cities} onChange={e => setCities(e.target.value)} placeholder="Ex: Rio de Janeiro, Niterói"
                style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
            </SettingsSection>

            <SettingsSection title="Categorias de negócio" description="Quais tipos de negócio buscar, e as palavras-chave usadas em cada busca no Google.">
              <label style={{ ...labelStyle, marginBottom: '8px' }}>Tipos de negócio ativos (deixe todos marcados pra busca ampla — o ICP abaixo já filtra os melhores)</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
                {BUSINESS_TYPES.map(bt => {
                  const active = enabledTypes.includes(bt)
                  return (
                    <button key={bt} onClick={() => setEnabledTypes(prev => active ? prev.filter(t => t !== bt) : [...prev, bt])}
                      style={{ padding: '6px 14px', borderRadius: '99px', border: `1px solid ${active ? 'rgba(255,109,41,0.4)' : BORDER}`, background: active ? 'rgba(255,109,41,0.12)' : 'transparent', color: active ? ORANGE : MUTED, fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                      {bt}
                    </button>
                  )
                })}
              </div>

              <div style={{ paddingTop: '16px', borderTop: `1px solid ${BORDER}` }}>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'white', marginBottom: '2px' }}>Palavras-chave de busca</div>
                <div style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.45)', marginBottom: '12px' }}>
                  Cada categoria pode ter várias — adicione novas sem precisar mexer em código. Essas alterações são salvas na hora, não dependem do botão "Salvar" no fim da página.
                </div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                  <select value={newKeywordType} onChange={e => setNewKeywordType(e.target.value)}
                    style={{ ...inputStyle, fontSize: '12.5px' }}>
                    {BUSINESS_TYPES.map(bt => <option key={bt} value={bt} style={{ background: CARD }}>{bt}</option>)}
                  </select>
                  <input value={newKeywordText} onChange={e => setNewKeywordText(e.target.value)} placeholder="Nova palavra-chave, ex: barbearia premium"
                    onKeyDown={e => { if (e.key === 'Enter') void addKeyword() }}
                    style={{ ...inputStyle, flex: 1, minWidth: '200px', fontSize: '12.5px' }} />
                  <button onClick={addKeyword} style={{ padding: '8px 16px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '12px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>+ Adicionar</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  {BUSINESS_TYPES.map(bt => {
                    const items = keywords.filter(k => k.business_type === bt)
                    if (items.length === 0) return null
                    return (
                      <div key={bt}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>{bt}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          {items.map(k => (
                            <div key={k.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: '7px' }}>
                              <input type="checkbox" checked={k.active} onChange={e => toggleKeywordActive(k.id, e.target.checked)} />
                              <span style={{ flex: 1, fontSize: '12.5px', color: k.active ? 'white' : 'rgba(255,255,255,0.35)' }}>{k.keyword}</span>
                              <button onClick={() => deleteKeyword(k.id)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '13px', padding: '2px 4px' }}>×</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </SettingsSection>

            <SettingsSection title="Perfil de cliente ideal (ICP)" description="Só entra na lista quem passar nos obrigatórios — os desejáveis e os pesos abaixo é o que decide o score de cada lead.">
              <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Obrigatório</div>
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: MUTED, marginBottom: '4px' }}>Nota Google (faixa)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input type="number" step={0.1} min={1} max={5} value={minRating} onChange={e => setMinRating(Number(e.target.value))} style={{ ...inputStyle, width: '60px' }} />
                    <span style={{ color: MUTED, fontSize: '12px' }}>até</span>
                    <input type="number" step={0.1} min={1} max={5} value={maxRating} onChange={e => setMaxRating(Number(e.target.value))} style={{ ...inputStyle, width: '60px' }} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: MUTED, marginBottom: '4px' }}>Nº de avaliações (faixa)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input type="number" min={0} value={minReviews} onChange={e => setMinReviews(Number(e.target.value))} style={{ ...inputStyle, width: '70px' }} />
                    <span style={{ color: MUTED, fontSize: '12px' }}>até</span>
                    <input type="number" min={0} value={maxReviews} onChange={e => setMaxReviews(Number(e.target.value))} style={{ ...inputStyle, width: '70px' }} />
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', marginBottom: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', color: MUTED, cursor: 'pointer' }}>
                  <input type="checkbox" checked={requireActiveInstagram} onChange={e => setRequireActiveInstagram(e.target.checked)} />
                  Instagram ativo
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', color: MUTED, cursor: 'pointer' }}>
                  <input type="checkbox" checked={requirePhone} onChange={e => setRequirePhone(e.target.checked)} />
                  Telefone disponível
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', color: MUTED, cursor: 'pointer' }}>
                  <input type="checkbox" checked={excludeChains} onChange={e => setExcludeChains(e.target.checked)} />
                  Só negócios independentes (sem redes/franquias)
                </label>
              </div>

              <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Desejável (a IA usa pra pontuar, não elimina o lead)</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.8, marginBottom: '10px' }}>
                Site profissional · Pedido online no site · Avaliações recentes no Google · Faixa de preço mais alta
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', color: MUTED }}>
                  Confiança mínima de ICP pra aceitar um lead (%)
                  <input type="number" value={confidenceThreshold} onChange={e => setConfidenceThreshold(Number(e.target.value))} min={0} max={100} style={{ ...inputStyle, width: '70px' }} />
                </label>
              </div>

              <div style={{ paddingTop: '16px', borderTop: `1px solid ${BORDER}`, marginBottom: '20px' }}>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'white', marginBottom: '2px' }}>Pesos de pontuação (avançado)</div>
                <div style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.45)', marginBottom: '12px' }}>Cada critério soma (ou tira) pontos do score final de 0 a 100.</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px' }}>
                  {(Object.keys(WEIGHT_LABELS) as (keyof ScoringWeights)[]).map(key => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                      <label style={{ fontSize: '12.5px', color: MUTED }}>{WEIGHT_LABELS[key]}</label>
                      <input type="number" value={weights[key]} onChange={e => setWeights(prev => ({ ...prev, [key]: Number(e.target.value) }))} style={{ ...inputStyle, width: '65px' }} />
                    </div>
                  ))}
                </div>
              </div>

              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                Instrução extra pra IA (opcional)
              </label>
              <div style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.45)', marginBottom: '8px', lineHeight: 1.6 }}>
                Soma às regras acima — não substitui nada. Ex: "priorize marcas de moda e beleza de bairros nobres do Rio" ou "não considere negócios com menos de 2 anos de Instagram".
              </div>
              <textarea value={customInstructions} onChange={e => setCustomInstructions(e.target.value)}
                placeholder="Escreva em texto livre o que a IA deve priorizar ao pontuar os leads..."
                rows={3}
                style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: D }} />
            </SettingsSection>

            <SettingsSection title="Automação" description="Quantos leads buscar por vez, e o agendamento automático da busca." defaultOpen={false}>
              <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label style={labelStyle}>Novos leads por noite</label>
                <input type="number" value={maxPerNight} onChange={e => setMaxPerNight(Number(e.target.value))} min={1} max={100} style={{ ...inputStyle, width: '80px' }} />
              </div>
              <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '9px', fontSize: '12.5px', color: MUTED, lineHeight: 1.7 }}>
                <span style={{ color: '#4ade80', fontWeight: 700 }}>● Busca automática ativa</span> — roda todos os dias às 6h (horário do servidor), usando essas mesmas configurações. Pra mudar o horário ou desligar, é preciso ajustar direto na infraestrutura — fale com o time técnico se precisar.
              </div>
            </SettingsSection>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '8px', paddingTop: '8px' }}>
              <button onClick={saveSettings} disabled={saving}
                style={{ padding: '10px 22px', background: saved ? '#4ade80' : ORANGE, color: '#000', fontWeight: 700, fontSize: '13px', borderRadius: '9px', border: 'none', cursor: 'pointer' }}>
                {saved ? '✓ Salvo' : saving ? 'Salvando...' : 'Salvar configurações'}
              </button>
              <button onClick={restoreDefaults}
                style={{ padding: '10px 18px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '9px', color: MUTED, fontSize: '13px', cursor: 'pointer' }}>
                Restaurar padrões
              </button>
              <button onClick={goBack}
                style={{ padding: '10px 18px', background: 'transparent', border: 'none', borderRadius: '9px', color: 'rgba(255,255,255,0.4)', fontSize: '13px', cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
