// Proteção contra SSRF: só https, sem usuário/senha, nada de endereço interno (IPv4 privado/loopback/link-local/CGNAT, IPv6 literal).
// Usada pelo portal-import (importar anúncios) e pelo itemService (conferir disponibilidade) — em TODO endereço e em cada redirecionamento.
export function isSafeUrl(raw: string): URL | null {
  let u: URL
  try { u = new URL(raw) } catch { return null }
  if (u.protocol !== 'https:') return null
  if (u.username || u.password) return null
  const h = u.hostname.toLowerCase()
  if (!h.includes('.') || h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.localhost')) return null
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const [a, b] = h.split('.').map(Number)
    if (a === 10 || a === 127 || a === 0 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19))) return null
  }
  if (h.startsWith('[') || h.includes(':')) return null // IPv6 literal (::1, fc00::/7, fe80::/10, IPv4-mapped…): não aceita
  return u
}
