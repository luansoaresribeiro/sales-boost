import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useLang } from '../contexts/LanguageContext'

// Nome do formato no idioma da tela (I1, 16/11). O nome fica gravado em português dentro da estratégia
// (content_plan.weekly_mix[].name); em inglês, a tela troca pelo `name_en` da ficha, achado pela chave do formato.
const cache = new Map<string, Promise<Record<string, string>>>()

function loadEnNames(verticalKey: string): Promise<Record<string, string>> {
  if (!cache.has(verticalKey)) {
    cache.set(verticalKey, (async () => {
      try {
        const { data } = await supabase.from('vertical_playbooks').select('config').eq('key', verticalKey).maybeSingle()
        const formats = ((data?.config as { content_formats?: { key?: string; name_en?: string }[] } | undefined)?.content_formats) ?? []
        return Object.fromEntries(formats.filter(f => f.key && f.name_en).map(f => [f.key as string, f.name_en as string]))
      } catch { return {} }
    })())
  }
  return cache.get(verticalKey)!
}

/** Devolve uma função (chave, nome gravado) → nome para mostrar. Em português, sempre o nome gravado. */
export function useFormatName(verticalKey: string | null | undefined): (key: string | undefined, name: string) => string {
  const { lang } = useLang()
  const [en, setEn] = useState<Record<string, string>>({})
  useEffect(() => {
    if (lang !== 'en' || !verticalKey) return
    let alive = true
    void loadEnNames(verticalKey).then(m => { if (alive) setEn(m) })
    return () => { alive = false }
  }, [lang, verticalKey])
  return (key, name) => (lang === 'en' && key && en[key]) || name
}
