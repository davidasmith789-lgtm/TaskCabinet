import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AppErrorBoundary from './AppErrorBoundary.jsx'
import ServiceWorkerUpdatePrompt from './ServiceWorkerUpdatePrompt.jsx'
import { registerServiceWorkerUpdates } from './serviceWorkerUpdates.js'

// Mount the single-page application. StrictMode catches unsafe React behavior
// during local development without changing the production interface.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
    <ServiceWorkerUpdatePrompt />
  </StrictMode>,
)

// Offline shell caching is production-only so local development always serves
// the newest source without a service worker intercepting requests.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  registerServiceWorkerUpdates()
}
