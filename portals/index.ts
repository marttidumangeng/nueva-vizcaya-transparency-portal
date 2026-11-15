/**
 * The portals this repository builds. `portal.config.ts` is the default
 * (Bagabag); the others are picked by Vite mode, which sets VITE_PORTAL from
 * `.env.<mode>`: `vite build --mode nueva-vizcaya`.
 *
 * Pure, like src/config.ts: vite.config.ts and the app both import it.
 */
import type { PortalConfig } from '../src/config';
import defaultPortal from '../portal.config';
import nuevaVizcaya from './nueva-vizcaya.config';

const PORTALS: Record<string, PortalConfig> = {
  'nueva-vizcaya': nuevaVizcaya,
};

export function portalFor(key: string | undefined): PortalConfig {
  return (key && PORTALS[key]) || defaultPortal;
}
