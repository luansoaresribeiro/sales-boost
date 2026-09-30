import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { ORANGE, CARD, MUTED, BORDER, timeAgo, type ToolRegistryRow, type ToolConfigRow } from './shared'

const STATUS_LABEL: Record<string, string> = { live: 'Conectada', partial: 'Parcial', planned: 'Planejada' }
const STATUS_COLOR: Record<string, string> = { live: '#4ade80', partial: '#FBBF24', planned: 'rgba(255,255,255,0.35)' }
const HEALTH_LABEL: Record<string, string> = { ok: '● saudável', warning: '● atenção', error: '● erro', unknown: '○ sem dado' }
const HEALTH_COLOR: Record<string, string> = { ok: '#4ade80', warning: '#FBBF24', error: '#f87171', unknown: 'rgba(255,255,255,0.3)' }

interface SettingField { key: string; label: string; type: 'text' | 'select' | 'number'; options?: string[] }
const TOOL_SETTINGS_SCHEMA: Record<string, SettingField[]> = {
  instagram_tool: [{ key: 'refresh_frequency', label: 'Frequência de atualização', type: 'select', options: ['daily', 'weekly'] }],
  insights_tool: [{ key: 'historical_window', label: 'Janela histórica', type: 'select', options: ['7d', '30d', '90d'] }],
  publishing_tool: [{ key: 'retry_policy', label: 'Política de retry', type: 'select', options: ['none', 'once', 'retry_3x'] }],
  calendar_tool: [{ key: 'default_view', label: 'Visão padrão', type: 'select', options: ['week', 'month'] }],
  comment_tool: [{ key: 'sentiment_detection', label: 'Detecção de sentimento', type: 'select', options: ['on', 'off'] }],
  messaging_tool: [{ key: 'lead_detection', label: 'Detecção de lead', type: 'select', options: ['on', 'off'] }],
  competitor_tool: [{ key: 'refresh_frequency', label: 'Frequência de atualização', type: 'select', options: ['daily', 'weekly'] }],
  trend_discovery_tool: [{ key: 'sensitivity', label: 'Sensibilidade', type: 'select', options: ['low', 'medium', 'high'] }],
  research_tool: [{ key: 'refresh_frequency', label: 'Frequência de atualização', type: 'select', options: ['weekly', 'monthly'] }],
  image_generation_tool: [{ key: 'aspect_ratio', label: 'Proporção', type: 'select', options: ['1:1', '4:5', '9:16'] }, { key: 'creativity', label: 'Criatividade', type: 'select', options: ['low', 'medium', 'high'] }],
  caption_generation_tool: [{ key: 'length', label: 'Tamanho da legenda', type: 'select', options: ['short', 'medium', 'long'] }, { key: 'emoji_density', label: 'Uso de emoji', type: 'select', options: ['none', 'low', 'high'] }],
  analytics_tool: [{ key: 'report_frequency', label: 'Frequência de relatório', type: 'select', options: ['weekly', 'monthly'] }],
  experiment_tool: [{ key: 'confidence_threshold', label: 'Confiança mínima', type: 'select', options: ['low', 'medium', 'high'] }, { key: 'max_experiments', label: 'Máx. experimentos simultâneos', type: 'number' }],
  learning_tool: [{ key: 'memory_limit', label: 'Limite de itens no Brain', type: 'number' }],
  configuration_tool: [],
}

// Ferramentas de criação (category='criacao') vêm da ficha de setor — não
// são liga/desliga como as ferramentas globais (Instagram sync, insights
// etc.), são ações. A que já funciona de verdade (status='live') se usa
// dentro de cada item do catálogo ("O que criar com este imóvel" em
// CatalogItems.tsx); aqui é só a visão geral + interesse nas que ainda não
// existem ("Quero quando lançar").
function CreationToolsPanel({ tools, companyId }: { tools: ToolRegistryRow[]; companyId: string }) {
  const [interested, setInterested] = useState<Set<string>>(new Set())
  useEffect(() => {
    supabase.from('marketing_ai_tool_interest').select('tool_id').eq('company_id', companyId)
      .then(({ data }) => setInterested(new Set((data ?? []).map(r => r.tool_id as string))))
  }, [companyId])
  const registerInterest = async (toolId: string) => {
    await supabase.from('marketing_ai_tool_interest').upsert({ tool_id: toolId, company_id: companyId }, { onConflict: 'tool_id,company_id' })
    setInterested(s => new Set(s).add(toolId))
  }
  return (
    <div style={{ marginBottom: '22px' }}>
      <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>✨ Ferramentas de criação do seu setor</div>
      <div style={{ fontSize: '11.5px', color: MUTED, marginBottom: '12px', lineHeight: 1.5 }}>As prontas se usam dentro de cada item do seu catálogo. As "Em breve" você pode pedir pra avisar quando lançar.</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {tools.map(t => (
          <div key={t.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '6px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>{t.name}</div>
              <span style={{ fontSize: '9.5px', fontWeight: 700, color: STATUS_COLOR[t.status], padding: '1px 7px', borderRadius: '99px', border: `1px solid ${STATUS_COLOR[t.status]}44`, flexShrink: 0 }}>{STATUS_LABEL[t.status]}</span>
            </div>
            <div style={{ fontSize: '11px', color: MUTED, marginBottom: '10px', lineHeight: 1.5 }}>{t.description}</div>
            {t.status === 'planned' && (
              interested.has(t.id) ? (
                <span style={{ fontSize: '11px', color: '#4ade80', fontWeight: 700 }}>✓ Você será avisado quando lançar</span>
              ) : (
                <button onClick={() => registerInterest(t.id)} style={{ padding: '6px 12px', background: 'rgba(255,109,41,0.14)', border: '1px solid rgba(255,109,41,0.4)', borderRadius: '8px', color: ORANGE, fontWeight: 700, fontSize: '11px', cursor: 'pointer' }}>
                  Quero quando lançar
                </button>
              )
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ToolsTab({ companyId, tools, configs, onRefresh }: { companyId: string; tools: ToolRegistryRow[]; configs: ToolConfigRow[]; onRefresh: () => Promise<void> }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const configByTool = Object.fromEntries(configs.map(c => [c.tool_id, c]))
  const creationTools = tools.filter(t => t.category === 'criacao')
  const otherTools = tools.filter(t => t.category !== 'criacao')

  const toggleEnabled = async (toolId: string, enabled: boolean) => {
    await supabase.from('marketing_ai_tool_config').upsert({ company_id: companyId, tool_id: toolId, enabled, updated_at: new Date().toISOString() }, { onConflict: 'company_id,tool_id' })
    await onRefresh()
  }

  const saveSetting = async (toolId: string, key: string, value: string) => {
    const current = configByTool[toolId]?.settings ?? {}
    await supabase.from('marketing_ai_tool_config').upsert({
      company_id: companyId, tool_id: toolId, settings: { ...current, [key]: value }, updated_at: new Date().toISOString(),
    }, { onConflict: 'company_id,tool_id' })
    await onRefresh()
  }

  return (
    <div>
      {creationTools.length > 0 && <CreationToolsPanel tools={creationTools} companyId={companyId} />}

      <div style={{ fontSize: '12.5px', color: MUTED, marginBottom: '18px', lineHeight: 1.6 }}>
        Tudo que o Marketing AI sabe (ou vai saber) fazer. As marcadas como "Planejada" dependem de acesso a APIs que a Sales Boost ainda não tem (Meta Business API pra DMs/comentários/Insights oficial) — a configuração já existe, só a integração real que falta.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {otherTools.map(t => {
          const cfg = configByTool[t.id]
          const fields = TOOL_SETTINGS_SCHEMA[t.id] ?? []
          const isOpen = expanded === t.id
          return (
            <div key={t.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '14px 16px', gridColumn: fields.length > 2 ? 'span 2' : undefined }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '6px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>{t.name}</div>
                <label style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center' }}>
                  <input type="checkbox" checked={cfg?.enabled ?? true} onChange={e => toggleEnabled(t.id, e.target.checked)} style={{ width: '15px', height: '15px', accentColor: ORANGE, cursor: 'pointer' }} />
                </label>
              </div>
              <div style={{ fontSize: '11px', color: MUTED, marginBottom: '10px', lineHeight: 1.5 }}>{t.description}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: fields.length ? '10px' : 0 }}>
                <span style={{ fontSize: '9.5px', fontWeight: 700, color: STATUS_COLOR[t.status], padding: '1px 7px', borderRadius: '99px', border: `1px solid ${STATUS_COLOR[t.status]}44` }}>{STATUS_LABEL[t.status]}</span>
                <span style={{ fontSize: '10px', color: HEALTH_COLOR[cfg?.health ?? 'unknown'] }}>{HEALTH_LABEL[cfg?.health ?? 'unknown']}</span>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>{cfg?.last_sync_at ? `última sync ${timeAgo(cfg.last_sync_at)}` : 'nunca sincronizou'}</span>
                {!t.connected && t.requires_integration && <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>requer {t.requires_integration}</span>}
              </div>
              {fields.length > 0 && (
                <>
                  <button onClick={() => setExpanded(isOpen ? null : t.id)} style={{ background: 'transparent', border: 'none', color: ORANGE, fontSize: '11px', cursor: 'pointer', padding: 0 }}>
                    {isOpen ? '▲ Fechar configurações' : '⚙️ Configurações'}
                  </button>
                  {isOpen && (
                    <div style={{ display: 'grid', gridTemplateColumns: fields.length > 1 ? '1fr 1fr' : '1fr', gap: '10px', marginTop: '10px' }}>
                      {fields.map(f => (
                        <div key={f.key}>
                          <label style={{ display: 'block', fontSize: '10px', color: MUTED, marginBottom: '4px' }}>{f.label}</label>
                          {f.type === 'select' ? (
                            <select value={String(cfg?.settings?.[f.key] ?? f.options?.[0] ?? '')} onChange={e => saveSetting(t.id, f.key, e.target.value)}
                              style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '7px', color: 'white', fontSize: '12px' }}>
                              {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                          ) : (
                            <input type={f.type} value={String(cfg?.settings?.[f.key] ?? '')} onChange={e => saveSetting(t.id, f.key, e.target.value)}
                              style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '7px', color: 'white', fontSize: '12px' }} />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
