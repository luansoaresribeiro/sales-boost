import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './posthog.ts'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
