// ── Configuração dos Agentes (Módulo 10) ─────────────────────────────────
// Autonomia da IA + objetivo do negócio. Guiam como todos os agentes do
// Growth OS agem. Salvo por empresa em localStorage (mesma abordagem do modo
// demo) — quando as integrações reais entrarem, isso vira coluna no banco e
// os agentes passam a de fato obedecer a esse nível de autonomia.
import { useCallback, useState } from 'react'

// 2026-11-04 (dono): só 2 opções, na página Aprovações do menu (saiu de Configurações na mesma data). "Apenas sugerir" saiu; valor antigo salvo no
// navegador vira 'aprovar'. A fonte da verdade é companies.agent_automatic_mode (ver AgentConfigTab).
export type Autonomy = 'aprovar' | 'executar'
export type Objective = 'vendas' | 'leads' | 'seguidores' | 'cac'

export interface AgentConfig { autonomy: Autonomy; objective: Objective }

export const DEFAULT_AGENT_CONFIG: AgentConfig = { autonomy: 'aprovar', objective: 'vendas' }

export const AUTONOMY_OPTIONS: { key: Autonomy; label: string; desc: string; icon: string }[] = [
  { key: 'aprovar', label: 'Pedir aprovação', icon: '✋', desc: 'Padrão. A IA prepara tudo como rascunho e cada ação dos agentes espera o seu OK em Aprovações.' },
  { key: 'executar', label: 'Executar automaticamente', icon: '⚡', desc: 'As ações internas dos agentes (organizar funil, rascunhar, otimizar) são aprovadas sozinhas. Publicar no Instagram sempre espera o seu clique. Respostas automáticas a comentários e DMs seguem a regra de cada automação, não esta opção.' },
]

export const OBJECTIVE_OPTIONS: { key: Objective; label: string; desc: string; icon: string }[] = [
  { key: 'vendas', label: 'Mais vendas', icon: '💰', desc: 'Priorizar receita e conversão do funil.' },
  { key: 'leads', label: 'Mais leads', icon: '🧲', desc: 'Priorizar captação de novos contatos.' },
  { key: 'seguidores', label: 'Mais seguidores', icon: '📈', desc: 'Priorizar crescimento e alcance nas redes.' },
  { key: 'cac', label: 'Reduzir CAC', icon: '📉', desc: 'Priorizar eficiência — baixar o custo de aquisição.' },
]

function cfgKey(companyId: string | undefined): string {
  return `sb_agent_config_${companyId ?? 'anon'}`
}

export function useAgentConfig(companyId: string | undefined): [AgentConfig, (patch: Partial<AgentConfig>) => void] {
  const [config, setConfig] = useState<AgentConfig>(() => {
    if (typeof localStorage === 'undefined') return DEFAULT_AGENT_CONFIG
    try {
      const raw = localStorage.getItem(cfgKey(companyId))
      const saved = raw ? { ...DEFAULT_AGENT_CONFIG, ...JSON.parse(raw) } : DEFAULT_AGENT_CONFIG
      return saved.autonomy === 'executar' || saved.autonomy === 'aprovar' ? saved : { ...saved, autonomy: 'aprovar' }
    } catch { return DEFAULT_AGENT_CONFIG }
  })
  const update = useCallback((patch: Partial<AgentConfig>) => {
    setConfig(prev => {
      const next = { ...prev, ...patch }
      try { localStorage.setItem(cfgKey(companyId), JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [companyId])
  return [config, update]
}
