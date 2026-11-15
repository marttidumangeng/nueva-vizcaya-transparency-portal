import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import PortalProvider from './components/PortalProvider';
import { portalFor } from '../portals';
import './styles/theme.css';
import './styles/app.css';

// The portal's own accent, over the theme's default.
const accent = portalFor(import.meta.env.VITE_PORTAL).accent;
if (accent) {
  const vars = document.documentElement.style;
  vars.setProperty('--accent', accent.base);
  vars.setProperty('--accent-deep', accent.deep);
  vars.setProperty('--accent-soft', accent.soft);
  if (accent.paper) vars.setProperty('--paper-2', accent.paper);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <PortalProvider>
        <App />
      </PortalProvider>
    </BrowserRouter>
  </StrictMode>,
);
