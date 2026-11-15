/**
 * The Province of Nueva Vizcaya: the second portal built from this repository
 * (`npm run dev:nv`, `npm run build:nv`, `npm run check:nv`).
 *
 * Both district engineering offices belong to the province, so each brings in
 * its whole DPWH ledger. The place name brings in lines from all four
 * programs whose title names the province: Central Office projects,
 * farm-to-market roads, health facilities and irrigation.
 */
import { defineConfig } from '../src/config';

export default defineConfig({
  id: 'nueva-vizcaya-province',
  kind: 'province',
  name: 'Province of Nueva Vizcaya',
  shortName: 'Nueva Vizcaya',
  operator: { name: 'DababonPro - BetterNuevaVizcaya' },
  siteUrl: 'https://betternuevavizcaya.org',
  related: [{ label: 'Bagabag', url: 'https://betterbagabag.org' }],
  // The template's credit stays in the footer.
  buildYourOwnStrip: false,
  notice: 'Independent and unofficial. Not a website of the Provincial Government of Nueva Vizcaya.',
  localSummary: {
    lang: 'fil',
    label: 'Sa Filipino',
    text:
      'Narito ang mga proyekto ng pambansang pamahalaan sa panukalang badyet ng 2027 para sa Nueva Vizcaya. ' +
      'Ang NEP ang badyet na isinumite ng Pangulo; ang House bill ang bersiyong ipinasa ng Kamara. ' +
      'Panukala pa lamang ang dalawa at hindi pa batas. Ang mga halaga ay awtoridad na gumastos, hindi aktuwal na ginastos.',
  },
  // The 15 municipalities. Aliases are spellings the budget titles use.
  areaLabel: 'Municipality',
  barangays: [
    { name: 'Alfonso Castañeda', aliases: ['Alfonso Castaneda', 'A. Castañeda', 'A. Castaneda'] },
    { name: 'Ambaguio' },
    { name: 'Aritao' },
    { name: 'Bagabag' },
    { name: 'Bambang' },
    { name: 'Bayombong' },
    { name: 'Diadi' },
    { name: 'Dupax del Norte' },
    { name: 'Dupax del Sur' },
    { name: 'Kasibu' },
    { name: 'Kayapa' },
    { name: 'Quezon' },
    { name: 'Santa Fe', aliases: ['Sta. Fe', 'Sta Fe'] },
    { name: 'Solano' },
    { name: 'Villaverde', aliases: ['Villa Verde'] },
  ],
  scope: {
    offices: [
      'Nueva Vizcaya District Engineering Office',
      'Nueva Vizcaya 2nd District Engineering Office',
    ],
    places: [{ label: 'Nueva Vizcaya', region: 'II' }],
    districts: ['leg:nueva-vizcaya:lone'],
    exclude: [],
  },
  reporting: { enabled: false },
});
