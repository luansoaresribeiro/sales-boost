import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
//
// HTTPS no dev server (basicSsl) é OBRIGATÓRIO pro Login do Facebook/WhatsApp:
// a Meta bloqueia o popup de login em páginas http (tela "isn't using a secure
// connection"). Com isso o dev roda em https://localhost:5173 (cert
// self-signed — o navegador pede pra confiar uma vez). Em produção o site já
// é https, então isso afeta só o desenvolvimento local.
export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    open: true,
    host: 'localhost',
    port: 5173,
  },
})
