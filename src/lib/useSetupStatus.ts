import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { useLang, type Lang } from '../contexts/LanguageContext'
import { useRealtime } from './useRealtime'
import {
  DEFAULT_SETUP_CONFIG, fetchCatalogSchema, fetchOnboardingQuestions, fetchSetupConfig,
  type CatalogSchema, type PlaybookQuestion,
} from './verticalPlaybook'
import { catalogMinPhotos, isCatalogItem, itemHasEnoughPhotos, itemPhotoCount, unansweredQuestions } from './setupRules'

// Status do /setup (fim do cadastro). Usa as MESMAS regras do sino de
// pendências (setupRules.ts). Cada passo obrigatório: dados do negócio,
// perguntas da ficha (se houver), itens do catálogo com fotos (se a ficha
// tiver catálogo) e, se a ficha pedir (config.setup.instagram_required), o
// Instagram conectado. Só LEITURA.

export type SetupStepId = 'dados' | 'perguntas' | 'catalogo'

export interface SetupStep { id: SetupStepId; done: boolean; missing: string }

export interface BusinessData { business_name: string; city: string; phone: string }

export interface SetupStatus {
  loading: boolean
  error: boolean
  steps: SetupStep[] // só os cartões numerados que existem pra essa conta
  instagramRequired: boolean
  instagramConnected: boolean
  required: number // quantos obrigatórios (cartões + Instagram, se obrigatório)
  doneCount: number
  allDone: boolean
  missingText: string // "Falta: 2 fotos" (vazio quando tudo pronto)
  business: BusinessData
  questions: PlaybookQuestion[]
  answers: Record<string, unknown>
  schema: CatalogSchema | null
  verticalKey: string
  minPhotos: number
  minItems: number
  refresh: () => Promise<void>
}

const MT = {
  pt: {
    name: 'nome', city: 'cidade', phone: 'telefone', business: (p: string) => `dados do negócio (${p})`,
    question: 'pergunta', questions: 'perguntas', photo: 'foto', photos: 'fotos',
    itemsWith: (n: number, item: string, p: number) => `${n} ${item} com ${p} fotos`,
    connectIg: 'conectar o Instagram', missing: 'Falta',
  },
  en: {
    name: 'name', city: 'city', phone: 'phone', business: (p: string) => `business details (${p})`,
    question: 'question', questions: 'questions', photo: 'photo', photos: 'photos',
    itemsWith: (n: number, item: string, p: number) => `${n} ${item} with ${p} photos`,
    connectIg: 'connect Instagram', missing: 'Missing',
  },
} as const

export const phoneDigits = (p: string) => p.replace(/\D/g, '')
export function businessDataValid(b: BusinessData): boolean {
  return b.business_name.trim().length >= 2 && b.city.trim().length >= 2 && phoneDigits(b.phone).length >= 10
}
function businessMissing(b: BusinessData, lang: Lang): string {
  const m = MT[lang]
  const parts: string[] = []
  if (b.business_name.trim().length < 2) parts.push(m.name)
  if (b.city.trim().length < 2) parts.push(m.city)
  if (phoneDigits(b.phone).length < 10) parts.push(m.phone)
  return m.business(parts.join(', '))
}

const EMPTY: Omit<SetupStatus, 'refresh' | 'loading' | 'error'> = {
  steps: [], instagramRequired: false, instagramConnected: false, required: 0, doneCount: 0, allDone: false, missingText: '',
  business: { business_name: '', city: '', phone: '' }, questions: [], answers: {}, schema: null,
  verticalKey: 'generico', minPhotos: 0, minItems: DEFAULT_SETUP_CONFIG.minItems,
}

/** `live`: assina mudanças em tempo real (tela /setup). O gate usa live=false: avalia uma vez, sem expulsar o dono do painel depois. */
export function useSetupStatus(companyId: string | null | undefined, opts: { live?: boolean } = {}): SetupStatus {
  const live = opts.live ?? true
  const { lang } = useLang()
  const [state, setState] = useState<{ loading: boolean; error: boolean; data: Omit<SetupStatus, 'refresh' | 'loading' | 'error'> }>({ loading: true, error: false, data: EMPTY })
  const seq = useRef(0)

  const compute = useCallback(async () => {
    if (!companyId) return
    const run = ++seq.current
    const m = MT[lang]
    try {
      const { data: c, error: cErr } = await supabase.from('companies')
        .select('business_name, city, phone, instagram_user_id, vertical_key, playbook_answers').eq('id', companyId).maybeSingle()
      if (cErr || !c) throw new Error('company')
      const verticalKey = (c.vertical_key as string | null) ?? 'generico'
      const answers = (c.playbook_answers as Record<string, unknown> | null) ?? {}
      const business: BusinessData = { business_name: (c.business_name as string | null) ?? '', city: (c.city as string | null) ?? '', phone: (c.phone as string | null) ?? '' }

      const [{ questions }, schema, cfg] = await Promise.all([fetchOnboardingQuestions(verticalKey), fetchCatalogSchema(verticalKey), fetchSetupConfig(verticalKey)])

      const steps: SetupStep[] = []
      const bOk = businessDataValid(business)
      steps.push({ id: 'dados', done: bOk, missing: bOk ? '' : businessMissing(business, lang) })

      if (questions.length > 0) {
        const miss = unansweredQuestions(questions, answers).length
        steps.push({ id: 'perguntas', done: miss === 0, missing: miss === 0 ? '' : `${miss} ${miss === 1 ? m.question : m.questions}` })
      }

      const minPhotos = catalogMinPhotos(schema)
      if (schema) {
        const { data: items, error: iErr } = await supabase.from('marketing_ai_knowledge').select('id, meta')
          .eq('company_id', companyId).eq('module', 'visual').eq('kind', 'product')
        if (iErr) throw new Error('items')
        const list = ((items ?? []) as { id: string; meta: { photos?: unknown[]; fields?: unknown } | null }[]).filter(i => isCatalogItem(i.meta))
        const ok = list.filter(i => itemHasEnoughPhotos(i.meta, minPhotos)).length
        const need = Math.max(0, cfg.minItems - ok)
        let missing = ''
        if (need > 0) {
          const partial = list.filter(i => !itemHasEnoughPhotos(i.meta, minPhotos)).map(i => minPhotos - itemPhotoCount(i.meta)).sort((a, b) => a - b)
          if (partial.length > 0) {
            const f = partial.slice(0, need).reduce((s, n) => s + n, 0)
            missing = `${f} ${f === 1 ? m.photo : m.photos}`
          } else {
            missing = m.itemsWith(need, schema.itemLabel.toLowerCase(), minPhotos)
          }
        }
        steps.push({ id: 'catalogo', done: need === 0, missing })
      }

      const instagramConnected = !!c.instagram_user_id
      const instagramRequired = cfg.instagramRequired
      const required = steps.length + (instagramRequired ? 1 : 0)
      const doneCount = steps.filter(s => s.done).length + (instagramRequired && instagramConnected ? 1 : 0)
      const missingParts = steps.filter(s => !s.done).map(s => s.missing)
      if (instagramRequired && !instagramConnected) missingParts.push(m.connectIg)

      if (run !== seq.current) return
      setState({
        loading: false, error: false,
        data: {
          steps, instagramRequired, instagramConnected, required, doneCount, allDone: doneCount === required,
          missingText: missingParts.length ? `${m.missing}: ${missingParts.join(' · ')}` : '',
          business, questions, answers, schema, verticalKey, minPhotos, minItems: cfg.minItems,
        },
      })
    } catch {
      if (run !== seq.current) return
      setState(s => ({ ...s, loading: false, error: true }))
    }
  }, [companyId, lang])

  useEffect(() => { void compute() }, [compute])

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  const debounced = useCallback(() => {
    if (!live) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { void compute() }, 500)
  }, [compute, live])
  const rtId = live ? companyId : null
  useRealtime('marketing_ai_knowledge', rtId, debounced, { key: 'setup' })
  useRealtime('companies', rtId, debounced, { key: 'setup', column: 'id' })

  return { loading: state.loading, error: state.error, ...state.data, refresh: compute }
}
