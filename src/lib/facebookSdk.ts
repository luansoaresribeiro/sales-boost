// Facebook SDK for JavaScript — carregado de forma assíncrona e graciosa.
//
// A Meta pede o SDK presente no site para liberar Login/Graph API do app.
// O App ID do Facebook é PÚBLICO (vai no SDK do browser por design), então
// fica numa env VITE_ — sem ela, o SDK simplesmente não carrega e nada quebra.
// A versão é fixada na mesma usada pelas edge functions de Instagram (v21.0).
const APP_ID = import.meta.env.VITE_FACEBOOK_APP_ID as string | undefined
const FB_VERSION = (import.meta.env.VITE_FACEBOOK_API_VERSION as string | undefined) ?? 'v21.0'
const WHATSAPP_CONFIG_ID = import.meta.env.VITE_WHATSAPP_CONFIG_ID as string | undefined

interface FBLoginResponse { authResponse?: { code?: string }; status?: string }
interface FBSdk {
  init: (opts: { appId: string; cookie?: boolean; xfbml?: boolean; version: string }) => void
  AppEvents?: { logPageView: () => void }
  login?: (
    cb: (res: FBLoginResponse) => void,
    opts: { config_id: string; response_type: string; override_default_response_type: boolean; extras?: { setup?: Record<string, unknown>; featureType?: string; sessionInfoVersion?: string } }
  ) => void
}
declare global {
  interface Window {
    FB?: FBSdk
    fbAsyncInit?: () => void
  }
}

// Injeta o SDK uma única vez. Idempotente (checa o id do script).
export function initFacebookSdk(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  if (!APP_ID) return // App ID não configurado → SDK desligado (nada quebra)
  if (document.getElementById('facebook-jssdk')) return

  window.fbAsyncInit = function () {
    window.FB?.init({ appId: APP_ID, cookie: true, xfbml: true, version: FB_VERSION })
    window.FB?.AppEvents?.logPageView()
  }

  const first = document.getElementsByTagName('script')[0]
  const js = document.createElement('script')
  js.id = 'facebook-jssdk'
  js.async = true
  js.defer = true
  js.src = 'https://connect.facebook.net/en_US/sdk.js'
  first?.parentNode?.insertBefore(js, first)
}

initFacebookSdk()

// WhatsApp Embedded Signup — o cliente clica, faz login com a conta do
// Meta dele numa janelinha, e escolhe/cria o WhatsApp Business Account e o
// número. A gente escuta duas coisas em paralelo: o "code" (pra trocar por
// token depois, no servidor) e o evento postMessage que a Meta manda com o
// waba_id/phone_number_id escolhidos — o code sozinho não diz qual número
// foi escolhido, só o WABA autorizado.
export interface WhatsAppSignupResult { code: string; wabaId: string | null; phoneNumberId: string | null }

export function isWhatsAppSignupConfigured(): boolean {
  return !!APP_ID && !!WHATSAPP_CONFIG_ID
}

export function launchWhatsAppSignup(): Promise<WhatsAppSignupResult> {
  return new Promise((resolve, reject) => {
    if (!WHATSAPP_CONFIG_ID) { reject(new Error('WhatsApp Embedded Signup não configurado (VITE_WHATSAPP_CONFIG_ID ausente).')); return }
    if (!window.FB?.login) { reject(new Error('SDK do Facebook ainda não carregou. Tenta de novo em alguns segundos.')); return }

    let sessionInfo: { wabaId: string | null; phoneNumberId: string | null } = { wabaId: null, phoneNumberId: null }

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://www.facebook.com' && event.origin !== 'https://web.facebook.com') return
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
        if (data?.type === 'WA_EMBEDDED_SIGNUP' && data?.data) {
          sessionInfo = { wabaId: data.data.waba_id ?? null, phoneNumberId: data.data.phone_number_id ?? null }
        }
      } catch { /* mensagens que não são JSON não interessam aqui */ }
    }
    window.addEventListener('message', onMessage)

    window.FB.login((res: FBLoginResponse) => {
      window.removeEventListener('message', onMessage)
      const code = res.authResponse?.code
      if (!code) { reject(new Error('Login cancelado ou sem permissão concedida.')); return }
      resolve({ code, wabaId: sessionInfo.wabaId, phoneNumberId: sessionInfo.phoneNumberId })
    }, {
      config_id: WHATSAPP_CONFIG_ID,
      response_type: 'code',
      override_default_response_type: true,
      // sessionInfoVersion é o que faz a Meta devolver o postMessage com
      // waba_id/phone_number_id escolhidos — sem isso o número não volta.
      extras: { setup: {}, featureType: '', sessionInfoVersion: '3' },
    })
  })
}
