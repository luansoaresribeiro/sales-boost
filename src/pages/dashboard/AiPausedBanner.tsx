import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useLang } from '../../contexts/LanguageContext'

// Item 1 da estratégia (dono, 23/11): quando a IA para (crédito da Anthropic zerado ou chave recusada), o
// platform-monitor liga feature_flags.ai_paused e o cliente vê esta faixa em vez de silêncio. Some sozinha quando volta.
const TX = {
  pt: 'A geração de conteúdo está pausada por um problema temporário. Seus dados e posts aprovados estão seguros; ela volta sozinha.',
  en: 'Content generation is paused due to a temporary issue. Your data and approved posts are safe; it will resume on its own.',
}

export function AiPausedBanner() {
  const { lang } = useLang()
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    let alive = true
    const load = () => supabase.from('feature_flags').select('enabled').eq('key', 'ai_paused').maybeSingle()
      .then(({ data }) => { if (alive) setPaused(!!(data as { enabled?: boolean } | null)?.enabled) })
    load()
    const id = setInterval(load, 5 * 60 * 1000)
    return () => { alive = false; clearInterval(id) }
  }, [])
  if (!paused) return null
  return (
    <div role="status" style={{ padding: '9px 16px', background: 'rgba(248,113,113,0.14)', borderBottom: '1px solid rgba(248,113,113,0.4)', fontSize: '12.5px', color: 'white', textAlign: 'center', lineHeight: 1.4 }}>
      {TX[lang]}
    </div>
  )
}
