import { existsSync } from 'node:fs';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { portalFor } from './portals';
import { DEFAULT_API, shortNameOf, type PortalConfig } from './src/config';

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** The portal's name and description in the HTML itself, for link previews and search engines. */
function portalHtml(portal: PortalConfig, api: string): Plugin {
  const accent = portal.accent?.base ?? '#0b4fd9';
  const favicon = `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="${accent}"/><path d="M8 22V10h3v12zm6.5 0V14h3v8zM21 22v-5h3v5z" fill="#fff"/></svg>`,
  )}`;
  const title = `${portal.name} · FY 2027 budget projects`;
  const description = `Every FY 2027 project for ${shortNameOf(portal)} in the NEP and the House bill (House Bill 10858), with the source page for each, and the enacted budgets 2020–2026. Data from the BetterGov.ph Budget API.`;
  // The link-preview picture (npm run build:share) needs an absolute URL, so a siteUrl.
  const share = `/share/${portal.id}.png`;
  const image = portal.siteUrl && existsSync(`public${share}`)
    ? `\n    <meta property="og:image" content="${escape(portal.siteUrl.replace(/\/+$/, '') + share)}" />\n    <meta property="og:image:width" content="1200" />\n    <meta property="og:image:height" content="630" />`
    : '';
  const url = portal.siteUrl
    ? `<link rel="canonical" href="${escape(portal.siteUrl)}" />\n    <meta property="og:url" content="${escape(portal.siteUrl)}" />${image}`
    : '';
  const card = image ? 'summary_large_image' : 'summary';
  return {
    name: 'portal-html',
    transformIndexHtml: (html) =>
      html
        .replaceAll('%PORTAL_TITLE%', escape(title))
        .replaceAll('%PORTAL_NAME%', escape(portal.name))
        .replaceAll('%PORTAL_DESCRIPTION%', escape(description))
        .replaceAll('%PORTAL_API%', escape(api))
        .replaceAll('%PORTAL_ACCENT%', accent)
        .replaceAll('%PORTAL_FAVICON%', favicon)
        .replaceAll('%PORTAL_URL_META%', url)
        .replaceAll('%PORTAL_CARD%', card),
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  // The default portal builds to dist/ on 5132; another (VITE_PORTAL, from .env.<mode>) to dist-<key>/ on 5133.
  const key = env.VITE_PORTAL;
  const portal = portalFor(key);
  const port = key ? 5133 : 5132;
  const api = (env.VITE_API_BASE || portal.api || DEFAULT_API).replace(/\/+$/, '');
  return {
    plugins: [react(), portalHtml(portal, api)],
    build: { outDir: key ? `dist-${key}` : 'dist' },
    server: {
      host: '0.0.0.0',
      // Reserved in ~/projects/ports.md (transparency-portal). strictPort so a
      // collision fails loudly instead of moving the URL.
      port,
      strictPort: true,
      allowedHosts: ['dev.neonplayground.com'],
    },
    preview: { host: '0.0.0.0', port, strictPort: true },
  };
});
