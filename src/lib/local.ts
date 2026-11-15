/**
 * What a title says about where a project is, inside the LGU.
 *
 * The API places no line in a barangay, so, as for the place itself, the
 * title is read: a project is under a barangay when its title names it (or
 * one of its `aliases` in the config). A title that names two barangays is
 * under both, so barangay figures overlap and are never added up. Titles are
 * matched, not sites surveyed.
 */
import type { PortalConfig } from '../config';

export const NO_BARANGAY = 'none';

/** What the config's areas are called: "Barangay" unless the config says otherwise. */
export function areaLabel(config: PortalConfig): string {
  return config.areaLabel?.trim() || 'Barangay';
}

/**
 * Plain names for the kinds of work. The key is the name as published (DPWH's
 * program, or the list a project comes from); readers see the plain name and
 * the published one on hover. An unknown name is shown as published.
 */
const WORK_NAMES: Record<string, string> = {
  'Convergence and Special Support Program': 'Local roads and buildings',
  'Flood Management Program': 'Flood control',
  'Network Development Program': 'New roads and bypasses',
  'Asset Preservation Program': 'Road repair and upkeep',
  'Bridge Program': 'Bridges',
  'Local Program': 'Other local projects',
  'DA farm-to-market roads': 'Farm-to-market roads',
  'DOH Health Facilities Enhancement Program': 'Health facilities',
  'NIA irrigation projects': 'Irrigation',
};

export function workName(published: string): string {
  return WORK_NAMES[published] ?? published;
}

/** Lowercase, punctuation to spaces, padded: " sta lucia section bagabag ". */
function words(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9ñ]+/g, ' ').trim()} `;
}

/** The config's barangays a title names, in the config's order. */
export function barangaysIn(config: PortalConfig, title: string): string[] {
  const hay = words(title);
  return (config.barangays ?? [])
    .filter((b) => [b.name, ...(b.aliases ?? [])].some((n) => hay.includes(words(n))))
    .map((b) => b.name);
}

/** Does the row belong under this barangay filter value (a name, or NO_BARANGAY)? */
export function inBarangay(config: PortalConfig, title: string, value: string): boolean {
  const found = barangaysIn(config, title);
  return value === NO_BARANGAY ? found.length === 0 : found.includes(value);
}

/**
 * Coordinates some titles end with: "(16.628367, 121.214241)". Kept only
 * inside the Philippines' bounding box, so a station range is never a pin.
 */
export function coordsIn(title: string): { lat: number; lng: number } | null {
  const m = /\((-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{2,3}\.\d{3,})\)/.exec(title);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!(lat > 4 && lat < 22 && lng > 116 && lng < 127)) return null;
  return { lat, lng };
}

export function mapUrl({ lat, lng }: { lat: number; lng: number }): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
}
