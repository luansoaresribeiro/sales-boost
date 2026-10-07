import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from './supabase'
import { useRealtime } from './useRealtime'
import { useCompany } from '../contexts/CompanyContext'
import { useLang } from '../contexts/LanguageContext'
import { bi, fetchCatalogSchema, fetchOnboardingQuestions } from './verticalPlaybook'
import { catalogMinPhotos, isCatalogItem, itemPhotoCount, unansweredQuestions } from './setupRules'

// Pendências do dono — tudo que falta pro Sales Boost trabalhar melhor.
// SÓ LEITURA: nenhuma escrita aqui. Cada fonte é independente: se uma falha
// (rede, coluna ausente), ela é ignorada e as outras seguem — nunca mostramos
// número falso. Montado UMA vez no DashboardLayout.

export type PendenciaKind = 'aprovacoes' | 'instagram' | 'fotos' | 'ficha' | 'telegram'
export type PendenciaTone = 'amber' | 'red' | 'orange' | 'muted'

export interface Pendencia {
  id: string
  kind: PendenciaKind
  tone: PendenciaTone
  /** baixa prioridade: aparece na lista mas não entra no número da bolinha */
  low?: boolean
  title: string
  hint: string
  destino: string // texto do "→ destino"
  to?: string // rota
  openAdd?: { tab: 'catalogo'; itemId: string } // abre o botão "+" na aba do catálogo
}

const PT = {
  pending: (n: number) => `${n} ${n === 1 ? 'coisa esperando' : 'coisas esperando'} sua aprovação`,
  pendingHint: 'Nada vai ao público sem o seu OK.',
  approvals: 'Aprovações',
  connectIg: 'Conectar o Instagram', connectIgHint: 'Sem ele, não dá pra publicar nem medir resultado.',
  settingsConn: 'Configurações · Conexões',
  reconnectIg: 'Reconectar o Instagram', reconnectIgHint: 'A conexão venceu — as publicações param até reconectar.',
  igExpires: (d: number) => `Instagram expira em ${d} ${d === 1 ? 'dia' : 'dias'}`,
  igExpiresHint: 'Reconecte antes de vencer pra não parar as publicações.',
  telegram: 'Conectar o Telegram', telegramHint: 'Pra receber avisos e falar com o Hermes pelo celular.',
  settingsInt: 'Configurações · Integrações',
  photosHint: (n: number, min: number) => `Faltam fotos: ${n} de ${min}. São elas que viram os posts.`,
  addPhotos: 'Adicionar fotos',
  questions: (n: number) => `${n} ${n === 1 ? 'pergunta' : 'perguntas'} do seu negócio sem resposta`,
  eg: 'Ex.: ', questionsHint: 'Quanto mais o Hermes souber, melhor ele decide.',
  settingsUnd: 'Configurações · Entendimento do negócio',
}
const EN: typeof PT = {
  pending: (n: number) => `${n} ${n === 1 ? 'item' : 'items'} waiting for your approval`,
  pendingHint: 'Nothing goes public without your OK.',
  approvals: 'Approvals',
  connectIg: 'Connect Instagram', connectIgHint: "Without it, we can't publish or measure results.",
  settingsConn: 'Settings · Connections',
  reconnectIg: 'Reconnect Instagram', reconnectIgHint: 'The connection expired — publishing stops until you reconnect.',
  igExpires: (d: number) => `Instagram expires in ${d} ${d === 1 ? 'day' : 'days'}`,
  igExpiresHint: 'Reconnect before it expires so publishing keeps running.',
  telegram: 'Connect Telegram', telegramHint: 'To get alerts and talk to Hermes from your phone.',
  settingsInt: 'Settings · Integrations',
  photosHint: (n: number, min: number) => `Missing photos: ${n} of ${min}. They become the posts.`,
  addPhotos: 'Add photos',
  questions: (n: number) => `${n} ${n === 1 ? 'question' : 'questions'} about your business unanswered`,
  eg: 'E.g.: ', questionsHint: 'The more Hermes knows, the better it decides.',
  settingsUnd: 'Settings · Business understanding',
}

const EXPIRY_WARN_DAYS = 7
const DAY_MS = 86_400_000

export function usePendencias() {
  const { company } = useCompany()
  const { lang } = useLang()
  const location = useLocation()
  const companyId = company?.id ?? null
  const verticalKey = company?.vertical_key ?? 'generico'
  const [items, setItems] = useState<Pendencia[]>([])
  const [approvalsCount, setApprovalsCount] = useState(0)
  const seq = useRef(0)

  const compute = useCallback(async () => {
    if (!companyId) { setItems([]); setApprovalsCount(0); return }
    const run = ++seq.current
    const t = lang === 'en' ? EN : PT
    const out: Pendencia[] = []
    let approvalsN = 0

    // a) Aprovações — mesma fila da ApprovalsPage (agent_actions PENDING +
    // marketing_ai_content idea/draft).
    try {
      const [a, c] = await Promise.all([
        supabase.from('agent_actions').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('approval_status', 'PENDING'),
        supabase.from('marketing_ai_content').select('id', { count: 'exact', head: true }).eq('company_id', companyId).in('status', ['idea', 'draft']),
      ])
      if (!a.error && !c.error) {
        approvalsN = (a.count ?? 0) + (c.count ?? 0)
        if (approvalsN > 0) out.push({
          id: 'aprovacoes', kind: 'aprovacoes', tone: 'amber',
          title: t.pending(approvalsN),
          hint: t.pendingHint, destino: t.approvals, to: '/dashboard/aprovacoes',
        })
      }
    } catch { /* fonte ignorada */ }

    // b) Instagram + e) Telegram + dados da ficha (d)
    let answers: Record<string, unknown> | null | undefined
    try {
      const { data, error } = await supabase.from('companies').select('instagram_user_id, telegram_chat_id, playbook_answers').eq('id', companyId).maybeSingle()
      if (!error && data) {
        answers = (data.playbook_answers as Record<string, unknown> | null) ?? null
        let expiresAt: string | null = null
        try {
          const r = await supabase.from('companies').select('instagram_token_expires_at').eq('id', companyId).maybeSingle()
          if (!r.error) expiresAt = (r.data?.instagram_token_expires_at as string | null | undefined) ?? null
        } catch { /* sem a coluna de validade: só avisa de "não conectado" */ }

        const igTo = '/dashboard/settings?tab=conexoes'
        if (!data.instagram_user_id) {
          out.push({ id: 'ig-conectar', kind: 'instagram', tone: 'red', title: t.connectIg, hint: t.connectIgHint, destino: t.settingsConn, to: igTo })
        } else if (expiresAt) {
          const left = new Date(expiresAt).getTime() - Date.now()
          if (Number.isFinite(left)) {
            if (left < 0) out.push({ id: 'ig-reconectar', kind: 'instagram', tone: 'red', title: t.reconnectIg, hint: t.reconnectIgHint, destino: t.settingsConn, to: igTo })
            else if (left <= EXPIRY_WARN_DAYS * DAY_MS) {
              const days = Math.max(1, Math.ceil(left / DAY_MS))
              out.push({ id: 'ig-expira', kind: 'instagram', tone: 'red', title: t.igExpires(days), hint: t.igExpiresHint, destino: t.settingsConn, to: igTo })
            }
          }
        }
        if (!data.telegram_chat_id) {
          out.push({ id: 'telegram', kind: 'telegram', tone: 'muted', low: true, title: t.telegram, hint: t.telegramHint, destino: t.settingsInt, to: '/dashboard/settings?tab=integracoes' })
        }
      }
    } catch { /* fonte ignorada */ }

    // c) Fotos por item — só pra quem tem catálogo na ficha
    try {
      const schema = await fetchCatalogSchema(verticalKey)
      if (schema) {
        const min = catalogMinPhotos(schema)
        const { data, error } = await supabase.from('marketing_ai_knowledge').select('id, title, meta').eq('company_id', companyId).eq('module', 'visual').eq('kind', 'product').order('created_at', { ascending: false })
        if (!error) {
          for (const it of (data ?? []) as { id: string; title: string; meta: { photos?: unknown[]; fields?: unknown } | null }[]) {
            if (!isCatalogItem(it.meta)) continue // item antigo, sem estrutura do catálogo
            const n = itemPhotoCount(it.meta)
            if (n < min) out.push({
              id: `fotos-${it.id}`, kind: 'fotos', tone: 'orange',
              title: it.title || schema.itemLabel,
              hint: t.photosHint(n, min),
              destino: t.addPhotos, openAdd: { tab: 'catalogo', itemId: it.id },
            })
          }
        }
      }
    } catch { /* fonte ignorada */ }

    // d) Perguntas da ficha sem resposta (chaves que não existem mais na ficha são ignoradas)
    try {
      if (answers !== undefined) {
        const { questions } = await fetchOnboardingQuestions(verticalKey)
        const missing = unansweredQuestions(questions, answers)
        if (missing.length > 0) {
          const first = bi(missing[0].label, lang)
          out.push({
            id: 'ficha', kind: 'ficha', tone: 'orange',
            title: t.questions(missing.length),
            hint: first ? `${t.eg}${first}` : t.questionsHint,
            destino: t.settingsUnd, to: '/dashboard/settings?section=entendimento',
          })
        }
      }
    } catch { /* fonte ignorada */ }

    if (run !== seq.current) return
    const order: PendenciaKind[] = ['aprovacoes', 'instagram', 'fotos', 'ficha', 'telegram']
    out.sort((x, y) => order.indexOf(x.kind) - order.indexOf(y.kind))
    setApprovalsCount(approvalsN)
    setItems(out)
  }, [companyId, verticalKey, lang])

  // debounce ~500ms: vários eventos seguidos viram uma leitura só
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refresh = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { void compute() }, 500)
  }, [compute])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  useEffect(() => { refresh() }, [refresh, location.pathname, location.search])

  useRealtime('agent_actions', companyId, refresh, { key: 'pend' })
  useRealtime('marketing_ai_content', companyId, refresh, { key: 'pend' })
  useRealtime('marketing_ai_knowledge', companyId, refresh, { key: 'pend' })
  useRealtime('companies', companyId, refresh, { key: 'pend', column: 'id' })

  // Número da bolinha: aprovações contam cada uma; as demais, 1 por linha;
  // baixa prioridade (Telegram) aparece na lista mas não acende a bolinha.
  const count = items.filter(i => !i.low).reduce((s, i) => s + (i.kind === 'aprovacoes' ? approvalsCount : 1), 0)
  return { items, count, approvalsCount }
}
