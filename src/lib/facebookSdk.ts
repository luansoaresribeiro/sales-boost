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
    console.log('[Meta Signup] iniciado (config_id presente)')

    const sessionInfo: { wabaId: string | null; phoneNumberId: string | null } = { wabaId: null, phoneNumberId: null }
    let signupError = ''   // erro reportado pela própria janela do Meta
    let userCancelled = false

    const onMessage = (event: MessageEvent) => {
      // Aceita qualquer subdomínio do facebook.com (www, web, business, etc.) —
      // filtrar demais era o que fazia a gente perder a mensagem do número.
      let host = ''
      try { host = new URL(event.origin).hostname } catch { return }
      if (!host.endsWith('facebook.com')) return
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
        if (data?.type !== 'WA_EMBEDDED_SIGNUP') return
        // Logs seguros (IDs não são segredos; NUNCA logar token/secret/code).
        console.log('[Meta Signup] mensagem recebida', { event: data?.event, step: data?.data?.current_step })
        const d = data.data ?? {}
        // Captura assim que aparecer — pode vir em passos intermediários.
        if (d.waba_id) sessionInfo.wabaId = d.waba_id
        if (d.phone_number_id) sessionInfo.phoneNumberId = d.phone_number_id
        if (data.event === 'CANCEL') userCancelled = true
        if (data.event === 'ERROR') signupError = d.error_message || 'A janela do Meta reportou um erro no cadastro.'
      } catch { /* mensagens que não são JSON não interessam aqui */ }
    }
    window.addEventListener('message', onMessage)

    window.FB.login((res: FBLoginResponse) => {
      const code = res.authResponse?.code
      // Dá um respiro pra uma mensagem de número que chegue logo após o login
      // (às vezes o postMessage do FINISH vem milissegundos depois do callback).
      setTimeout(() => {
        window.removeEventListener('message', onMessage)
        console.log('[Meta Signup] login concluído', { temCode: !!code, status: res.status, temWaba: !!sessionInfo.wabaId, temPhone: !!sessionInfo.phoneNumberId, cancel: userCancelled, erro: !!signupError })
        if (signupError) { reject(new Error(signupError)); return }
        if (userCancelled) { reject(new Error('Você fechou a janela antes de terminar. Refaça e vá até o fim: escolha a conta do WhatsApp (WABA), selecione ou cadastre o número e clique em concluir.')); return }
        if (!code) { reject(new Error('Login cancelado ou sem permissão concedida.')); return }
        resolve({ code, wabaId: sessionInfo.wabaId, phoneNumberId: sessionInfo.phoneNumberId })
      }, 1500)
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
