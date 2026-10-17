import { useState } from 'react'
import { t, type Lang } from './i18n'
import { capture } from './posthog'

function Navbar({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const tx = t[lang].nav
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 border-b border-white/5 backdrop-blur-md bg-[#0a0f1e]/80">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center">
          <span className="text-black font-black text-sm">SB</span>
        </div>
        <span className="font-bold text-white text-lg tracking-tight">SalesBoost</span>
      </div>
      <div className="hidden md:flex items-center gap-8">
        {[tx.features, tx.how, tx.pricing].map((item) => (
          <a key={item} href="#" className="text-sm text-slate-400 hover:text-white transition-colors">
            {item}
          </a>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            const selectedLanguage = lang === 'pt' ? 'en' : 'pt'
            setLang(selectedLanguage)
            capture('language_changed', { selected_language: selectedLanguage })
          }}
          className="text-xs font-medium px-3 py-1.5 rounded-full border border-white/20 text-slate-300 hover:border-green-500/50 hover:text-white transition-all"
        >
          {lang === 'pt' ? '🇺🇸 EN' : '🇧🇷 PT'}
        </button>
        <button
          onClick={() => capture('start_free_clicked', { placement: 'navigation' })}
          className="bg-green-500 hover:bg-green-400 text-black font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
        >
          {tx.cta}
        </button>
      </div>
    </nav>
  )
}

function HeroSection({ lang }: { lang: Lang }) {
  const tx = t[lang].hero
  const stats = t[lang].stats
  const report = t[lang].report

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center pt-20 px-4 overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-green-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-20 right-1/4 w-64 h-64 bg-blue-500/5 rounded-full blur-[80px] pointer-events-none" />

      <div className="relative z-10 max-w-5xl w-full mx-auto text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-medium px-4 py-2 rounded-full mb-8">
          {tx.badge}
        </div>

        {/* Headline */}
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-black leading-tight tracking-tight mb-6">
          <span className="text-white">{tx.headline1}</span>
          <br />
          <span className="bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">
            {tx.headline2}
          </span>
        </h1>

        {/* Subheadline */}
        <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed mb-10">
          {tx.sub}
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <button
            onClick={() => capture('demo_report_requested', { placement: 'hero' })}
            className="group flex items-center gap-2 bg-green-500 hover:bg-green-400 text-black font-bold text-base px-8 py-4 rounded-xl transition-all shadow-lg shadow-green-500/25 hover:shadow-green-400/40"
          >
            {tx.cta_primary}
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </button>
          <button
            onClick={() => capture('how_it_works_clicked', { placement: 'hero' })}
            className="flex items-center gap-2 text-slate-300 hover:text-white font-medium text-base px-6 py-4 rounded-xl border border-white/10 hover:border-white/25 transition-all"
          >
            ▶ {tx.cta_secondary}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-16 max-w-3xl mx-auto">
          {stats.map((s) => (
            <div key={s.value} className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-green-500/30 transition-colors">
              <div className="text-3xl font-black text-green-400 mb-1">{s.value}</div>
              <div className="text-sm text-slate-400 leading-snug">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Report Preview Card */}
        <div className="relative max-w-md mx-auto">
          <div className="absolute inset-0 bg-green-500/20 rounded-3xl blur-xl" />
          <div className="relative bg-slate-900/90 border border-white/10 rounded-2xl p-6 text-left shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-widest mb-1">Junho 2026</div>
                <div className="font-bold text-white text-lg">{report.title}</div>
              </div>
              <div className="text-center bg-green-500/10 border border-green-500/30 rounded-xl px-3 py-2">
                <div className="text-2xl font-black text-green-400">87</div>
                <div className="text-xs text-green-600">{report.score}</div>
              </div>
            </div>
            <ul className="space-y-3">
              {report.items.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500/20 text-green-400 text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="text-slate-300 text-sm leading-snug">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Social proof */}
        <p className="mt-10 text-slate-500 text-sm">{t[lang].social}</p>
      </div>
    </section>
  )
}

export default function App() {
  const [lang, setLang] = useState<Lang>('pt')

  return (
    <div className="min-h-screen bg-[#0a0f1e]">
      <Navbar lang={lang} setLang={setLang} />
      <HeroSection lang={lang} />
    </div>
  )
}
