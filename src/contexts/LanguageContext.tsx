import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

export type Lang = 'pt' | 'en'

// Idioma da TELA (por usuário). Ordem de decisão (decisão do dono 2026-10-27,
// inglês como idioma principal):
//   1. escolha explícita do usuário (localStorage 'sb_lang') — sempre vence;
//   2. sem escolha e com empresa logada → `companies.language` ('pt' → pt, resto → en);
//   3. sem escolha e sem empresa (landing, visitante, cadastro) → 'en'.
// O passo 2 NÃO grava nada no localStorage: assim, trocar de empresa/idioma da
// empresa reflete na tela. Quem alimenta o passo 2 é o efeito dentro do CompanyProvider
// (evita dependência circular entre contextos).
interface LanguageCtx {
  lang: Lang
  setLang: (l: Lang) => void
  setCompanyLang: (l: Lang | null) => void
}

// Espelho do idioma atual pra código fora do React (libs). Nasce da escolha
// explícita (se houver) e o provider o mantém em dia (efeito + setLang).
let currentLang: Lang = readExplicit() ?? 'en'
export function getCurrentLang(): Lang { return currentLang }

const LanguageContext = createContext<LanguageCtx>({ lang: 'en', setLang: () => {}, setCompanyLang: () => {} })

function readExplicit(): Lang | null {
  try {
    const saved = localStorage.getItem('sb_lang')
    return saved === 'en' || saved === 'pt' ? saved : null
  } catch {
    return null
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [explicit, setExplicit] = useState<Lang | null>(readExplicit)
  const [companyLang, setCompanyLangState] = useState<Lang | null>(null)
  const lang: Lang = explicit ?? companyLang ?? 'en'

  const setLang = useCallback((l: Lang) => {
    currentLang = l
    setExplicit(l)
    try { localStorage.setItem('sb_lang', l) } catch { /* modo privado/sem storage: vale só nesta sessão */ }
  }, [])

  const setCompanyLang = useCallback((l: Lang | null) => setCompanyLangState(l), [])

  useEffect(() => { currentLang = lang; document.documentElement.lang = lang }, [lang])

  return <LanguageContext.Provider value={{ lang, setLang, setCompanyLang }}>{children}</LanguageContext.Provider>
}

export function useLang() {
  return useContext(LanguageContext)
}

// 'pt' → pt; qualquer outro valor (en, null, vazio) → en.
export function langFromCompany(language: string | null | undefined): Lang {
  return language === 'pt' ? 'pt' : 'en'
}
