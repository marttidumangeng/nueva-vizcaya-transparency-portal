/**
 * `npm run build:share` — the link-preview picture (1200×630) for each portal:
 * its name, seal and headline figures, typeset here from the live API, never
 * drawn by an image model. Writes public/share/<portal id>.png; vite.config.ts
 * adds og:image when that file exists and the portal has a siteUrl.
 *
 * The figures are a snapshot: rebuild after the API's data is rebuilt (the
 * picture prints the build date). Uses an installed Microsoft Edge or Chrome
 * through playwright-core, so there is nothing to download.
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { env, exit } from 'node:process';
import { chromium, type Browser } from 'playwright-core';
import defaultPortal from '../portal.config.ts';
import nuevaVizcaya from '../portals/nueva-vizcaya.config.ts';
import { createClient } from '../src/api/client.ts';
import { DEFAULT_API, KIND_LABELS, shortNameOf, type PortalConfig } from '../src/config.ts';
import { count, date, php } from '../src/lib/format.ts';
import { resolveScope, summarise } from '../src/lib/scope.ts';

const PORTALS: PortalConfig[] = [defaultPortal, nuevaVizcaya];
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

function logoData(config: PortalConfig): string | null {
  if (!config.logo || /^https?:/.test(config.logo)) return null;
  const file = resolve('public', config.logo.replace(/^\/+/, ''));
  if (!existsSync(file)) return null;
  const type = extname(file).slice(1).replace('jpg', 'jpeg').replace('svg', 'svg+xml');
  return `data:image/${type};base64,${readFileSync(file).toString('base64')}`;
}

async function page(config: PortalConfig): Promise<string> {
  const api = createClient(env.VITE_API_BASE || config.api || DEFAULT_API);
  const scope = await resolveScope(api, config);
  const s = summarise(scope.projects);
  const accent = config.accent?.base ?? '#0b4fd9';
  const deep = config.accent?.deep ?? '#0a44bd';
  const logo = logoData(config);
  const stat = (label: string, value: string, sub: string) =>
    `<div class="stat"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div><div class="sub">${esc(sub)}</div></div>`;
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@600;700&family=Inter:wght@400;500&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; background: #fff; color: #11151c; font-family: Inter, sans-serif; display: flex; flex-direction: column; }
  .band { height: 14px; background: ${accent}; }
  .main { flex: 1; padding: 46px 64px 0; display: flex; flex-direction: column; }
  .head { display: flex; align-items: center; gap: 26px; }
  .head img { height: 118px; width: auto; }
  .kicker { font-family: "JetBrains Mono", monospace; font-size: 17px; letter-spacing: 0.18em; text-transform: uppercase; color: ${accent}; margin-bottom: 10px; }
  h1 { font-family: Figtree, sans-serif; font-weight: 700; font-size: 58px; letter-spacing: -0.03em; line-height: 1.04; }
  .lede { margin-top: 30px; font-size: 27px; line-height: 1.35; color: #2b3340; max-width: 1040px; }
  .stats { margin-top: auto; display: grid; grid-template-columns: repeat(3, 1fr); border-top: 2px solid #11151c; }
  .stat { padding: 20px 24px 22px 0; }
  .stat + .stat { padding-left: 24px; border-left: 1px solid #d4d8e0; }
  .label { font-family: "JetBrains Mono", monospace; font-size: 15px; letter-spacing: 0.14em; text-transform: uppercase; color: #5b6373; }
  .value { font-family: Figtree, sans-serif; font-weight: 700; font-size: 54px; letter-spacing: -0.02em; line-height: 1.15; }
  .stat:last-child .value { color: ${accent}; }
  .sub { font-size: 18px; color: #5b6373; }
  .foot { background: ${deep}; color: #fff; padding: 15px 64px; display: flex; justify-content: space-between; font-family: Figtree, sans-serif; font-weight: 600; font-size: 19px; }
</style></head><body>
  <div class="band"></div>
  <div class="main">
    <div class="head">
      ${logo ? `<img src="${logo}" alt="">` : ''}
      <div>
        <div class="kicker">${esc(KIND_LABELS[config.kind])} · Budgets 2020–2027</div>
        <h1>${esc(config.name)}</h1>
      </div>
    </div>
    <p class="lede">Every project for ${esc(shortNameOf(config))} in the proposed 2027 national budget, with the source page for each.</p>
    <div class="stats">
      ${stat('Projects', count(s.rows), 'in the 2027 budget')}
      ${stat('NEP', php(s.nep.php), `${count(s.nep.rows)} projects · the President's budget`)}
      ${stat('House bill', php(s.house.php), `${count(s.house.rows)} projects · compared, not added`)}
    </div>
  </div>
  <div class="foot">
    <span>${esc((config.siteUrl ?? '').replace(/^https?:\/\//, ''))}</span>
    <span>Independent and unofficial · Data from BetterGov.ph, built ${esc(date(scope.meta.built_at))}</span>
  </div>
</body></html>`;
}

async function launch(): Promise<Browser> {
  for (const channel of ['msedge', 'chrome'] as const) {
    try {
      return await chromium.launch({ channel });
    } catch {
      // Try the next installed browser.
    }
  }
  return chromium.launch();
}

async function main() {
  mkdirSync(resolve('public', 'share'), { recursive: true });
  const browser = await launch();
  try {
    for (const config of PORTALS) {
      const tab = await browser.newPage({ viewport: { width: 1200, height: 630 } });
      await tab.setContent(await page(config), { waitUntil: 'networkidle' });
      const file = resolve('public', 'share', `${config.id}.png`);
      await tab.screenshot({ path: file });
      await tab.close();
      console.log(`wrote ${file}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  exit(1);
});
