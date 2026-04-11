import React from 'react'
import { createRoot } from 'react-dom/client'
import { OptionsPage } from './components/OptionsPage'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Elemento root nao encontrado para options page.')
}

createRoot(rootElement).render(
  <React.StrictMode>
    <OptionsPage />
  </React.StrictMode>,
)
