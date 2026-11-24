// E-mail para o DONO da plataforma (user_roles.role = 'owner'), pelo Resend (RESEND_API_KEY).
// Remetente gratuito do Resend: só entrega ao e-mail da própria conta do Resend (ver PITFALLS, 23/11).
// Nunca manda nada ao cliente: o relatório chega ao dono, que revisa e encaminha (dono, 24/11).
// deno-lint-ignore no-explicit-any
type Admin = { from: (t: string) => any }

export async function ownerEmails(admin: Admin): Promise<string[]> {
  const { data } = await admin.from('user_roles').select('email').eq('role', 'owner')
  return ((data ?? []) as { email?: string | null }[]).map(r => r.email).filter((e): e is string => !!e && /@/.test(e))
}

/** Manda um e-mail de texto ao dono. Nunca lança: devolve se foi e, se não, o motivo. */
export async function sendOwnerEmail(admin: Admin, subject: string, text: string): Promise<{ ok: boolean; reason?: string }> {
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) return { ok: false, reason: 'RESEND_API_KEY ausente' }
  const to = await ownerEmails(admin)
  if (!to.length) return { ok: false, reason: 'nenhum e-mail de dono em user_roles' }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Sales Boost <onboarding@resend.dev>', to, subject: subject.slice(0, 150), text }),
    })
    if (!res.ok) return { ok: false, reason: `Resend ${res.status}: ${(await res.text()).slice(0, 200)}` }
    return { ok: true }
  } catch (e) { return { ok: false, reason: String(e).slice(0, 200) } }
}
