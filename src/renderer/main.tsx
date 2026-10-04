import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { getApi } from './lib/api'
import './design/tokens.css'
import './design/base.css'

const container = document.getElementById('root')
if (!container) throw new Error('Missing #root element')

createRoot(container).render(
  <StrictMode>
    <App api={getApi()} />
  </StrictMode>
)
