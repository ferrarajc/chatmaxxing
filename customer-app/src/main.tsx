import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Build transparency: the deployed commit SHA (set by the deploy workflow) is logged and
// exposed on window.__BUILD__ so you can confirm exactly what's live in prod.
const buildSha = import.meta.env.VITE_GIT_SHA
if (buildSha) {
  ;(window as unknown as { __BUILD__?: string }).__BUILD__ = buildSha
  console.info(`%cBob's Mutual Funds — build ${String(buildSha).slice(0, 7)}`, 'color:#6B645A')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
