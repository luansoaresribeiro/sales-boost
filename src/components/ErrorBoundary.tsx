import { Component, type ErrorInfo, type ReactNode } from 'react'

// Rede de segurança da tela inteira: sem isso, qualquer erro ao desenhar uma página desmonta o React e sobra só
// o fundo preto (o dono viu isso ao clicar em "Entrar", 2026-10-30). Aqui a pessoa vê o que aconteceu, a
// mensagem do erro (para mandar pro suporte) e dois caminhos: recarregar ou voltar ao início.
// `resetKey` (a rota atual) limpa o erro ao navegar para outra página.
interface Props { children: ReactNode; resetKey?: string }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State { return { error } }

  componentDidCatch(error: Error, info: ErrorInfo) { console.error('[tela] erro ao desenhar a página:', error, info.componentStack) }

  componentDidUpdate(prev: Props) { if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null }) }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const en = document.documentElement.lang === 'en'
    const btn = { padding: '10px 18px', borderRadius: '10px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(255,109,41,0.4)' }
    return (
      <div style={{ minHeight: '100vh', background: '#0E0B0A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '460px', width: '100%', background: '#150E08', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px', padding: '28px' }}>
          <h1 style={{ color: 'white', fontSize: '20px', margin: '0 0 8px' }}>{en ? 'Something went wrong on this screen' : 'Algo deu errado nesta tela'}</h1>
          <p style={{ color: '#BABABA', fontSize: '14px', lineHeight: 1.5, margin: '0 0 16px' }}>
            {en ? 'Try reloading. If it happens again, send us the message below.' : 'Tente recarregar. Se acontecer de novo, mande pra gente a mensagem abaixo.'}
          </p>
          <pre style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '12px', color: '#f87171', fontSize: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: '0 0 18px' }}>
            {`${error.name}: ${error.message}`.slice(0, 600)}{`\n${window.location.pathname}`}
          </pre>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => window.location.reload()} style={{ ...btn, background: '#FF6D29', color: '#0E0B0A' }}>{en ? 'Reload' : 'Recarregar'}</button>
            <button onClick={() => { window.location.href = '/' }} style={{ ...btn, background: 'transparent', color: '#FF6D29' }}>{en ? 'Go to home page' : 'Ir para o início'}</button>
          </div>
        </div>
      </div>
    )
  }
}
