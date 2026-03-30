/**
 * @file main.tsx — Application entry point.
 *
 * Mounts the React application onto the `#root` DOM element using
 * `createRoot`. Runs in `StrictMode` so that development-time warnings
 * and double-invocation of lifecycle hooks are enabled.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
