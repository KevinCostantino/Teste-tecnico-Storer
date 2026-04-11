import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './popup.css'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Elemento root nao encontrado para o popup.')
}

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
