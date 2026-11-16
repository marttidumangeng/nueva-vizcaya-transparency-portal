/**
 * This portal's configuration: the only file a fork needs to edit.
 * What each field means: src/config.ts. Check it against the live API with
 * `npm run check`.
 *
 * The Municipality of Bagabag, Nueva Vizcaya. The API does not yet place a
 * project in a city or municipality, so projects are found by a title that
 * names "Bagabag". Barangay Bagabag in Santo Tomas, Isabela is also in
 * Region II, so its lines are removed by hand below. Nueva Vizcaya's two
 * district engineering offices each cover many towns, so neither is listed
 * under `offices`: it would bring in the other towns' projects.
 */
import { defineConfig } from './src/config';

export default defineConfig({
  id: 'bagabag-nueva-vizcaya',
  kind: 'municipality',
  name: 'Municipality of Bagabag, Nueva Vizcaya',
  shortName: 'Bagabag',
  operator: { name: 'DababonPro - BetterBagabag' },
  logo: '/brand/bagabag-seal.jpg',
  // Bagabag's colour is green.
  accent: { base: '#15803d', deep: '#116432', soft: '#e6f4ea', paper: '#f4f9f5' },
  notice: 'Independent and unofficial. Not a website of the Municipal Government of Bagabag.',
  localSummary: {
    lang: 'fil',
    label: 'Sa Filipino',
    text:
      'Narito ang mga proyekto ng pambansang pamahalaan sa panukalang badyet ng 2027 na may pangalang Bagabag. ' +
      'Ang NEP ang badyet na isinumite ng Pangulo; ang House bill ang bersiyong ipinasa ng Kamara. ' +
      'Panukala pa lamang ang dalawa at hindi pa batas. Ang mga halaga ay awtoridad na gumastos, hindi aktuwal na ginastos.',
  },
  // The 17 barangays. Aliases are spellings and sitios the budget titles use.
  barangays: [
    { name: 'Bakir' },
    { name: 'Baretbet', aliases: ['Kinacao'] },
    { name: 'Careb' },
    { name: 'Lantap' },
    { name: 'Murong' },
    { name: 'Nangalisan' },
    { name: 'Paniki' },
    { name: 'Pogonsino' },
    { name: 'Quirino' },
    { name: 'San Geronimo' },
    { name: 'San Pedro' },
    { name: 'Santa Cruz', aliases: ['Sta. Cruz', 'Sta Cruz'] },
    { name: 'Santa Lucia', aliases: ['Sta. Lucia', 'Sta Lucia'] },
    { name: 'Tuao North' },
    { name: 'Tuao South' },
    { name: 'Villa Coloma' },
    { name: 'Villaros' },
  ],
  siteUrl: 'https://budget.betterbagabag.org',
  related: [{ label: 'Nueva Vizcaya province', url: 'https://betternuevavizcaya.org' }],
  // The template's credit stays in the footer.
  buildYourOwnStrip: false,
  scope: {
    places: [{ label: 'Bagabag', region: 'II' }],
    districts: ['leg:nueva-vizcaya:lone'],
    exclude: [
      {
        key: 'dpwh:house-reading:7120',
        reason: 'The title names Barangay Bagabag in Santo Tomas, Isabela, not the Municipality of Bagabag.',
      },
      {
        key: 'gaa:18-001|replacement of bagabagsitio lalappang bridge sta 9340  sta 9365 barangay bagabag sto tomas isabela',
        reason: 'The bridge is in Barangay Bagabag, Santo Tomas, Isabela.',
      },
      {
        key: 'gaa:18-001|construction of bagabag water supply system sto tomas isabela',
        reason: 'The water system is in Santo Tomas, Isabela.',
      },
      {
        key: 'gaa:18-001|construction of slope protection and cross drain along bagabag creek sto tomas isabela',
        reason: 'Bagabag Creek here is in Santo Tomas, Isabela.',
      },
      {
        key: 'gaa:05-001|concreting of bagabagbiga oriental fmr phase ii brgy bagabagbiga oriental sto tomas isabela',
        reason: 'The farm-to-market road is in Santo Tomas, Isabela.',
      },
      {
        key: 'gaa:18-001|construction of halag aguinaldo to maguitawa mayoyao to dulaotupaya lagawe to hapidpoblacion lamut to bagabag nueva vizcaya bypass road sta 0000  sta 2220 aguinaldo and mayoyao ifugao',
        reason: 'The title names Bagabag only as the end of the route; this section is in Aguinaldo and Mayoyao, Ifugao.',
      },
    ],
  },
  reporting: { enabled: false },
});
