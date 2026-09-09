import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useRealtime } from '../../../lib/useRealtime'
import {
  type MarketingAiConfig, type TrackingSnapshot, type Insight, type ContentItem, type CompetitorRow,
  type StrategyLogRow, type ActivityLogRow, type BrainNode, type Experiment, type ToolRegistryRow,
  type ToolConfigRow, type Campaign, type Trend, type MarketingReport,
} from './shared'

export function useMarketingAiData(companyId: string | undefined) {
  const [loading, setLoading] = useState(true)
  const [config, setConfig] = useState<MarketingAiConfig | null>(null)
  const [snapshots, setSnapshots] = useState<TrackingSnapshot[]>([])
  const [insights, setInsights] = useState<Insight[]>([])
  const [content, setContent] = useState<ContentItem[]>([])
  const [competitors, setCompetitors] = useState<CompetitorRow[]>([])
  const [strategyLog, setStrategyLog] = useState<StrategyLogRow[]>([])
  const [activity, setActivity] = useState<ActivityLogRow[]>([])
  const [brainNodes, setBrainNodes] = useState<BrainNode[]>([])
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [toolRegistry, setToolRegistry] = useState<ToolRegistryRow[]>([])
  const [toolConfigs, setToolConfigs] = useState<ToolConfigRow[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [trends, setTrends] = useState<Trend[]>([])
  const [reports, setReports] = useState<MarketingReport[]>([])

  const loadAll = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    const [cfg, snaps, ins, cont, comps, strat, act, brain, exps, tools, toolCfgs, camps, trds, reps] = await Promise.all([
      supabase.from('marketing_ai_config').select('*').eq('company_id', companyId).maybeSingle(),
      supabase.from('marketing_ai_tracking_snapshots').select('*').eq('company_id', companyId).order('collected_at', { ascending: false }).limit(20),
      supabase.from('marketing_ai_insights').select('*').eq('company_id', companyId).eq('status', 'open').order('created_at', { ascending: false }).limit(30),
      supabase.from('marketing_ai_content').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(20),
      supabase.from('marketing_ai_competitors').select('*').eq('company_id', companyId).order('followers', { ascending: false }),
      supabase.from('marketing_ai_strategy_log').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(20),
      supabase.from('marketing_ai_activity_log').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(30),
      supabase.from('marketing_ai_brain_nodes').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(100),
      supabase.from('marketing_ai_experiments').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(30),
      supabase.from('marketing_ai_tool_registry').select('*').order('category').order('name'),
      supabase.from('marketing_ai_tool_config').select('*').eq('company_id', companyId),
      supabase.from('marketing_ai_campaigns').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
      supabase.from('marketing_ai_trends').select('*').eq('company_id', companyId).order('detected_at', { ascending: false }).limit(20),
      supabase.from('marketing_ai_reports').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(30),
    ])
    setConfig((cfg.data as MarketingAiConfig | null) ?? null)
    setSnapshots((snaps.data ?? []) as TrackingSnapshot[])
    setInsights((ins.data ?? []) as Insight[])
    setContent((cont.data ?? []) as ContentItem[])
    setCompetitors((comps.data ?? []) as CompetitorRow[])
    setStrategyLog((strat.data ?? []) as StrategyLogRow[])
    setActivity((act.data ?? []) as ActivityLogRow[])
    setBrainNodes((brain.data ?? []) as BrainNode[])
    setExperiments((exps.data ?? []) as Experiment[])
    setToolRegistry((tools.data ?? []) as ToolRegistryRow[])
    setToolConfigs((toolCfgs.data ?? []) as ToolConfigRow[])
    setCampaigns((camps.data ?? []) as Campaign[])
    setTrends((trds.data ?? []) as Trend[])
    setReports((reps.data ?? []) as MarketingReport[])
    setLoading(false)
  }, [companyId])

  useEffect(() => { void loadAll() }, [loadAll])

  // Ultra-sync: qualquer mudança nessas tabelas atualiza o hub sem recarregar.
  useRealtime('marketing_ai_content', companyId, loadAll)
  useRealtime('marketing_ai_insights', companyId, loadAll)
  useRealtime('marketing_ai_activity_log', companyId, loadAll)
  useRealtime('marketing_ai_strategy_log', companyId, loadAll)
  useRealtime('marketing_ai_tracking_snapshots', companyId, loadAll)
  useRealtime('marketing_ai_competitors', companyId, loadAll)
  useRealtime('marketing_ai_campaigns', companyId, loadAll)

  return {
    loading, config, snapshots, insights, content, competitors, strategyLog, activity,
    brainNodes, experiments, toolRegistry, toolConfigs, campaigns, trends, reports,
    refresh: loadAll, setConfig,
  }
}
