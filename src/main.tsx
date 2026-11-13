import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

// Routing is hash-based (see shared/router.tsx) because GitHub Pages can't
// serve deep links. The service worker is registered by an injected deferred
// script (vite.config.ts → injectRegister), so it costs nothing in this bundle.
const root = document.getElementById('root');
if (!root) throw new Error('#root missing');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
