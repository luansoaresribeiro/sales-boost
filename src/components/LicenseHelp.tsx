import { biText, licenseFooter, licenseStatus, parseLicense, withLicenseType, type LicenseRule } from '../lib/license'

// Ajuda do campo de registro profissional (no piloto, o CRECI): PF/PJ, conferência do formato e link do
// conselho. A trava de verdade fica no servidor (supabase/functions/_shared/compliance.ts): sem registro
// válido, nada é publicado — mas as peças continuam sendo criadas.

const ORANGE = '#FF6D29'
const MUTED = '#BABABA'
const GREEN = '#4ade80'

const TX = {
  pt: {
    ok: (s: string) => `✓ Vai aparecer assim nos posts: ${s}`,
    no_type: 'Marque se o registro é de pessoa física ou jurídica.',
    invalid: (ex: string) => `Formato não reconhecido. Exemplo: ${ex}`,
    missing: (n: string) => `Sem o ${n}, os posts não são publicados (as peças continuam sendo criadas).`,
    verify: 'Conferir no site do conselho ↗',
  },
  en: {
    ok: (s: string) => `✓ It will show like this on posts: ${s}`,
    no_type: 'Mark whether the license is individual or company.',
    invalid: (ex: string) => `Format not recognized. Example: ${ex}`,
    missing: (n: string) => `Without your ${n}, posts are not published (pieces are still created).`,
    verify: 'Check on the council website ↗',
  },
} as const

export default function LicenseHelp({ rule, value, onChange, lang }: { rule: LicenseRule; value: unknown; onChange: (v: string) => void; lang: 'pt' | 'en' }) {
  const t = TX[lang]
  const name = biText(rule.name, lang)
  const st = licenseStatus({ [rule.answer_key]: value }, rule)
  const lic = parseLicense(value, rule)
  const types = Object.entries(rule.types)
  const example = `12345-${types[0]?.[0] ?? ''}`
  const msg = st.ok ? t.ok(licenseFooter(rule, st.license, lang))
    : st.reason === 'no_type' ? t.no_type : st.reason === 'invalid' ? t.invalid(example) : t.missing(name)
  return (
    <div style={{ marginTop: '9px' }}>
      <div role="group" aria-label={name} style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {types.map(([k, label]) => {
          const on = lic?.type === k
          return (
            <button key={k} type="button" aria-pressed={on} disabled={!lic}
              onClick={() => onChange(withLicenseType(value, k, rule))}
              style={{
                minHeight: 34, padding: '6px 12px', borderRadius: '99px', fontSize: '12.5px', fontWeight: 600, fontFamily: 'inherit',
                cursor: lic ? 'pointer' : 'not-allowed', opacity: lic ? 1 : 0.5,
                background: on ? 'rgba(255,109,41,0.14)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${on ? 'rgba(255,109,41,0.55)' : 'rgba(255,255,255,0.08)'}`, color: on ? ORANGE : 'white',
              }}>
              {on ? '✓ ' : ''}{biText(label, lang)}
            </button>
          )
        })}
      </div>
      <div role="status" style={{ fontSize: '12.5px', marginTop: '8px', lineHeight: 1.5, color: st.ok ? GREEN : st.reason === 'missing' ? MUTED : ORANGE }}>{msg}</div>
      {rule.verify_url && (
        <a href={rule.verify_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: '6px', fontSize: '12.5px', color: ORANGE, fontWeight: 600 }}>{t.verify}</a>
      )}
    </div>
  )
}
