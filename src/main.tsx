import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyAccent, applyTheme, loadAccent, loadTheme } from './lib/theme'

applyTheme(loadTheme())
applyAccent(loadAccent())
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(loadTheme()))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
