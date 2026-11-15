import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import type { BridgeGroup, DatasetInfo, Disclaimer, GroupInfo } from '../api/types';
import { BRIDGE_GROUPS } from '../api/types';
import { shortNameOf, type DatasetKey } from '../config';
import { Await, Disclaimers, ReasonTags, StatusChip } from '../components/Bits';
import { PageHead } from '../components/Chrome';
import OfficesSection from '../components/OfficesSection';
import { projectsCsv, downloadText } from '../lib/csv';
import { count, php, phpDelta, plural } from '../lib/format';
import { areaLabel, barangaysIn, inBarangay, NO_BARANGAY, workName } from '../lib/local';
import { usePortal } from '../lib/portal-context';
import { summarise, type ScopedProject, type ScopeResult, type Summary } from '../lib/scope';
import { useTitle } from '../lib/use-title';

const PAGE = 100;
/** The largest projects are listed apart only when the list is long enough to bury them. */
const TOP = 5;
const TOP_MIN = 20;

type Sort = 'house' | 'nep' | 'change' | 'title';
const SORTS: Record<Sort, { label: string; cmp: (a: ScopedProject, b: ScopedProject) => number }> = {
  house: { label: 'House bill amount', cmp: (a, b) => (b.house_php ?? -1) - (a.house_php ?? -1) },
  nep: { label: 'NEP amount', cmp: (a, b) => (b.nep_php ?? -1) - (a.nep_php ?? -1) },
  change: { label: 'Size of change', cmp: (a, b) => Math.abs(b.delta_php ?? 0) - Math.abs(a.delta_php ?? 0) },
  title: { label: 'Name', cmp: (a, b) => a.title.localeCompare(b.title) },
};

export default function Home() {
  const { scope, overview, config } = usePortal();
  useTitle(`Every FY 2027 project · ${shortNameOf(config)}`);
  const datasets = overview.status === 'ready' ? overview.value.data.datasets : [];
  return (
    <main className="page main">
      <Await state={scope} what="projects">
        {(s) => <Projects scope={s} datasets={datasets} />}
      </Await>
    </main>
  );
}

/** Group wording from the API (label, sub, help), falling back to the row's own label. */
type GroupWords = Pick<GroupInfo, 'label' | 'sub' | 'help'>;

function groupInfo(datasets: DatasetInfo[], rows: ScopedProject[]): Record<BridgeGroup, GroupWords> {
  const fromApi = datasets[0]?.bridge.groups;
  const out = {} as Record<BridgeGroup, GroupWords>;
  for (const g of BRIDGE_GROUPS) {
    out[g] = fromApi?.[g] ?? { label: rows.find((r) => r.bridge_group === g)?.group_label ?? g, sub: '', help: '' };
  }
  return out;
}

function Projects({ scope, datasets }: { scope: ScopeResult; datasets: DatasetInfo[] }) {
  const { config, districts } = usePortal();
  const { hash } = useLocation();

  // #offices and #projects links land on their section once it has rendered.
  useEffect(() => {
    if (!hash) return;
    document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ block: 'start' });
  }, [hash, districts.status]);

  // The disclaimers of every response on this page: the project lists' and the districts'.
  const disclaimers = useMemo(() => {
    const byId = new Map<string, Disclaimer>(scope.disclaimers.map((d) => [d.id, d]));
    if (districts.status === 'ready') for (const env of districts.value) for (const d of env.disclaimers) if (!byId.has(d.id)) byId.set(d.id, d);
    return [...byId.values()];
  }, [scope.disclaimers, districts]);
  const name = shortNameOf(config);
  const all = scope.projects;
  const summary = useMemo(() => summarise(all), [all]);
  const groups = useMemo(() => groupInfo(datasets, all), [datasets, all]);
  const programName = (k: DatasetKey) => datasets.find((d) => d.key === k)?.short ?? k.toUpperCase();
  const workOf = useCallback(
    (p: ScopedProject) => (p.dataset === 'dpwh' && p.program ? p.program : datasets.find((d) => d.key === p.dataset)?.label ?? p.dataset.toUpperCase()),
    [datasets],
  );

  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const program = (params.get('program') ?? '') as DatasetKey | '';
  const status = (params.get('status') ?? '') as BridgeGroup | '';
  const why = params.get('why') ?? '';
  const office = params.get('office') ?? '';
  const brgy = params.get('brgy') ?? '';
  const work = params.get('work') ?? '';
  const sort = (params.get('sort') as Sort) in SORTS ? (params.get('sort') as Sort) : 'house';
  const [shown, setShown] = useState(PAGE);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
    setShown(PAGE);
  };

  // DPWH offices among the rows, largest first, for the Office filter.
  const offices = useMemo(() => {
    const n = new Map<string, number>();
    for (const p of all) if (p.office) n.set(p.office, (n.get(p.office) ?? 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'en', { numeric: true }));
  }, [all]);

  const reasons = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of all) for (const r of p.reasons) seen.set(`${r.kind}:${r.label}`, r.kind === 'office' ? `Office: ${shortOffice(r.label)}` : `Title names ${r.label}`);
    return [...seen.entries()];
  }, [all]);

  // By barangay (a title that names two is under both) and by DPWH's own program name.
  const byBarangay = useMemo(() => {
    const cells = new Map<string, Tally>();
    for (const p of all) {
      const found = barangaysIn(config, p.title);
      for (const b of found.length ? found : [NO_BARANGAY]) tally(cells, b, p);
    }
    return [...cells.entries()].sort((a, b) => Number(a[0] === NO_BARANGAY) - Number(b[0] === NO_BARANGAY) || b[1].house - a[1].house || a[0].localeCompare(b[0]));
  }, [all, config]);
  const byWork = useMemo(() => {
    const cells = new Map<string, Tally>();
    for (const p of all) tally(cells, workOf(p), p);
    return [...cells.entries()].sort((a, b) => b[1].house - a[1].house || a[0].localeCompare(b[0]));
  }, [all, workOf]);
  const top = useMemo(
    () => (all.length >= TOP_MIN ? [...all].sort((a, b) => (b.house_php ?? b.nep_php ?? 0) - (a.house_php ?? a.nep_php ?? 0)).slice(0, TOP) : []),
    [all],
  );
  const hasBarangays = (config.barangays?.length ?? 0) > 0;
  const area = areaLabel(config);
  const areaLc = area.toLowerCase();
  const noArea = `No ${areaLc} named`;

  const filtered = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const rows = all.filter((p) => {
      if (program && p.dataset !== program) return false;
      if (status && p.bridge_group !== status) return false;
      if (why && !p.reasons.some((r) => `${r.kind}:${r.label}` === why)) return false;
      if (office && p.office !== office) return false;
      if (brgy && !inBarangay(config, p.title, brgy)) return false;
      if (work && workOf(p) !== work) return false;
      if (words.length) {
        const hay = [p.title, p.program, p.pap, p.office, p.region].join(' ').toLowerCase();
        if (!words.every((w) => hay.includes(w))) return false;
      }
      return true;
    });
    return rows.sort((a, b) => SORTS[sort].cmp(a, b) || a.title.localeCompare(b.title));
  }, [all, q, program, status, why, office, brgy, work, sort, config, workOf]);
  const filteredSummary = useMemo(() => summarise(filtered), [filtered]);
  const narrowed = filtered.length !== all.length;

  return (
    <>
      <PageHead
        eyebrow={<>FY 2027<span className="sep">·</span>NEP and House Bill 10858<span className="sep">·</span>{name}</>}
        title={`${plural(summary.rows, 'project')} for ${name} in the 2027 budget`}
      >
        <Lede summary={summary} />
        {config.localSummary && (
          <p className="local-summary" lang={config.localSummary.lang}>
            <span className="label">{config.localSummary.label}</span>
            {config.localSummary.text}
          </p>
        )}
      </PageHead>

      <Stats summary={summary} programName={programName} />

      {top.length > 0 && (
        <section className="section" aria-labelledby="top-h">
          <h2 id="top-h" className="section-h">The {top.length} largest projects</h2>
          <ol className="top-list">
            {top.map((p) => (
              <li key={p.key}>
                <span className="top-main">
                  <Link to={`/projects/${p.dataset}/${encodeURIComponent(p.id)}`} className="project-title">{p.title}</Link>
                  <span className="project-meta">
                    <span title={workOf(p)}>{workName(workOf(p))}</span>
                    {barangaysIn(config, p.title).map((b) => <span key={b} className="tag tag-brgy">{b}</span>)}
                    <StatusChip group={p.bridge_group} label={p.status_label} held={p.held} />
                  </span>
                </span>
                <span className="top-amount num">
                  {php(p.house_php ?? p.nep_php)}
                  <span className="label">{p.house_php != null ? 'House bill' : 'NEP'}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {hasBarangays && (
        <section className="section" aria-labelledby="where-h">
          <h2 id="where-h" className="section-h">By {areaLc}</h2>
          <BarLegend />
          <Tiles
            label={areaLc}
            rows={byBarangay.map(([k, c]) => ({ key: k, name: k === NO_BARANGAY ? noArea : k, cell: c }))}
            active={brgy}
            onPick={(k) => setParam('brgy', brgy === k ? '' : k)}
          />
          <p className="fine">
            A project is under a {areaLc} when its title names it; one that names two is under both, so the {areaLc} figures
            are not added up. Bars share one scale. Pick one to filter the list below.
          </p>
        </section>
      )}

      {byWork.length > 1 && (
        <section className="section" aria-labelledby="work-h">
          <h2 id="work-h" className="section-h">By type of work</h2>
          <Tiles
            list
            label="type of work"
            rows={byWork.map(([k, c]) => ({ key: k, name: workName(k), hint: k, cell: c }))}
            active={work}
            onPick={(k) => setParam('work', work === k ? '' : k)}
          />
          <p className="fine">
            Type of work is the DPWH program a project is listed under, or the list it comes from; hover a name for it as published.
          </p>
        </section>
      )}

      <section className="section" aria-labelledby="groups-h">
        <h2 id="groups-h" className="section-h">What the House bill did to them</h2>
        <div className="groups" role="group" aria-label="Filter by status">
          {BRIDGE_GROUPS.map((g) => {
            const cell = summary.groups[g];
            const info = groups[g];
            const active = status === g;
            return (
              <button
                key={g}
                type="button"
                className={`group-tile${active ? ' active' : ''}`}
                disabled={!cell.rows}
                aria-pressed={active}
                title={info.help}
                onClick={() => setParam('status', active ? '' : g)}
              >
                <span className="group-label"><span className={`status-dot g-${g}`} aria-hidden="true" />{info.label}</span>
                {info.sub && <span className="label">{info.sub}</span>}
                <span className="group-count num">{count(cell.rows)}</span>
                <span className="group-php num">{groupAmount(g, cell)}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="section" id="projects" aria-labelledby="list-h">
        <div className="list-head">
          <h2 id="list-h" className="section-h">
            {narrowed ? `${count(filtered.length)} of ${plural(all.length, 'project')}` : `Every project (${count(all.length)})`}
          </h2>
          <button type="button" className="button button-quiet" onClick={() => downloadText(`${config.id}-fy2027-projects.csv`, projectsCsv(filtered))}>
            Download CSV{narrowed ? ` (${count(filtered.length)})` : ''}
          </button>
        </div>

        <div className="toolbar">
          <label className="field field-grow">
            <span className="label">Search</span>
            <input type="search" value={q} placeholder="Barangay, road, school, office…" onChange={(e) => setParam('q', e.target.value)} />
          </label>
          <label className="field">
            <span className="label">Program</span>
            <select value={program} onChange={(e) => setParam('program', e.target.value)}>
              <option value="">All programs</option>
              {(Object.keys(summary.byDataset) as DatasetKey[]).map((k) => (
                <option key={k} value={k}>{programName(k)} ({count(summary.byDataset[k]!.rows)})</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">Status</span>
            <select value={status} onChange={(e) => setParam('status', e.target.value)}>
              <option value="">Any status</option>
              {BRIDGE_GROUPS.filter((g) => summary.groups[g].rows).map((g) => (
                <option key={g} value={g}>{groups[g].label} ({count(summary.groups[g].rows)})</option>
              ))}
            </select>
          </label>
          {offices.length > 1 && (
            <label className="field">
              <span className="label">DPWH office</span>
              <select value={office} onChange={(e) => setParam('office', e.target.value)}>
                <option value="">Any office</option>
                {offices.map(([o, n]) => <option key={o} value={o}>{shortOffice(o)} ({count(n)})</option>)}
              </select>
            </label>
          )}
          {hasBarangays && (
            <label className="field">
              <span className="label">{area}</span>
              <select value={brgy} onChange={(e) => setParam('brgy', e.target.value)}>
                <option value="">Any {areaLc}</option>
                {byBarangay.map(([k, c]) => <option key={k} value={k}>{k === NO_BARANGAY ? noArea : k} ({count(c.rows)})</option>)}
              </select>
            </label>
          )}
          {byWork.length > 1 && (
            <label className="field">
              <span className="label">Type of work</span>
              <select value={work} onChange={(e) => setParam('work', e.target.value)}>
                <option value="">Any type</option>
                {byWork.map(([k, c]) => <option key={k} value={k}>{workName(k)} ({count(c.rows)})</option>)}
              </select>
            </label>
          )}
          {reasons.length > 1 && (
            <label className="field">
              <span className="label">Listed because</span>
              <select value={why} onChange={(e) => setParam('why', e.target.value)}>
                <option value="">Any reason</option>
                {reasons.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </label>
          )}
          <label className="field">
            <span className="label">Sort by</span>
            <select value={sort} onChange={(e) => setParam('sort', e.target.value === 'house' ? '' : e.target.value)}>
              {(Object.keys(SORTS) as Sort[]).map((k) => <option key={k} value={k}>{SORTS[k].label}</option>)}
            </select>
          </label>
        </div>

        {narrowed && (
          <p className="filter-sums">
            These {count(filtered.length)}: NEP {php(filteredSummary.nep.php)} on {count(filteredSummary.nep.rows)}
            <span className="sep">·</span>House bill {php(filteredSummary.house.php)} on {count(filteredSummary.house.rows)}
            <span className="sep">·</span>
            <button type="button" className="link-button" onClick={() => { setParams(new URLSearchParams(), { replace: true }); setShown(PAGE); }}>
              Clear filters
            </button>
          </p>
        )}

        <ProjectTable rows={filtered.slice(0, shown)} programName={programName} barangays={(t) => barangaysIn(config, t)} />

        {filtered.length === 0 && <p className="state">No project matches. Try fewer words or clear the filters.</p>}
        {filtered.length > shown && (
          <div className="more">
            <span className="muted">Showing {count(shown)} of {count(filtered.length)}</span>
            <button type="button" className="button" onClick={() => setShown((n) => n + PAGE)}>Show {count(Math.min(PAGE, filtered.length - shown))} more</button>
            <button type="button" className="button button-quiet" onClick={() => setShown(filtered.length)}>Show all</button>
          </div>
        )}

        <p className="fine">
          Amounts are in pesos, as each document publishes them. A dash means that document has no such line. The NEP
          and the House bill are two versions of one budget: their totals are compared, never added.
        </p>
      </section>

      <OfficesSection />

      <Disclaimers items={disclaimers} compact />
    </>
  );
}

/** Rows and per-version amounts for one barangay or type of work. `nepRows` and `houseRows` tell "no such line" from zero. */
interface Tally { rows: number; nepRows: number; nep: number; houseRows: number; house: number }

function tally(cells: Map<string, Tally>, key: string, p: ScopedProject) {
  const c = cells.get(key) ?? { rows: 0, nepRows: 0, nep: 0, houseRows: 0, house: 0 };
  c.rows++;
  if (p.nep_php != null) { c.nepRows++; c.nep += p.nep_php; }
  if (p.house_php != null) { c.houseRows++; c.house += p.house_php; }
  cells.set(key, c);
}

function BarLegend() {
  return (
    <p className="legend">
      <span><i className="sw sw-nep" /> NEP</span>
      <span><i className="sw sw-house" /> House bill</span>
    </p>
  );
}

/** One tile per area or type of work: its count and a bar for each version, on one scale. Picking one filters the list. */
function Tiles({ rows, active, onPick, label, list }: {
  rows: { key: string; name: string; hint?: string; cell: Tally }[];
  active: string;
  onPick: (key: string) => void;
  label: string;
  list?: boolean;
}) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.cell.nep, r.cell.house]));
  const width = (v: number) => `${Math.max(v > 0 ? 1.5 : 0, (v / max) * 100)}%`;
  return (
    <div className={`tiles${list ? ' tiles-list' : ''}`} role="group" aria-label={`Filter by ${label}`}>
      {rows.map(({ key, name, hint, cell }) => (
        <button key={key} type="button" className={`tile${active === key ? ' active' : ''}`} aria-pressed={active === key} title={hint} onClick={() => onPick(key)}>
          <span className="tile-name">{name}</span>
          <span className="tile-count">{plural(cell.rows, 'project')}</span>
          <span className="vbars">
            <span className="vbar">
              <span className="label">NEP</span>
              <span className="vtrack"><i className="sw-nep" style={{ width: width(cell.nep) }} /></span>
              <span className="num">{php(cell.nepRows ? cell.nep : null)}</span>
            </span>
            <span className="vbar">
              <span className="label">House</span>
              <span className="vtrack"><i className="sw-house" style={{ width: width(cell.house) }} /></span>
              <span className="num strong">{php(cell.houseRows ? cell.house : null)}</span>
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

/** "Bohol 1st District Engineering Office" → "Bohol 1st DEO", for tight spaces. */
function shortOffice(office: string): string {
  return office.replace(/ District Engineering Office$/, ' DEO');
}

function groupAmount(g: BridgeGroup, c: { nep_php: number; house_php: number; rows: number }): string {
  if (!c.rows) return '—';
  switch (g) {
    case 'nep_only': return php(c.nep_php);
    case 'increased':
    case 'decreased':
    case 'scope_review': return phpDelta(c.house_php - c.nep_php);
    default: return php(c.house_php);
  }
}

function Lede({ summary }: { summary: Summary }) {
  const added = summary.groups.house_only.rows;
  const dropped = summary.groups.nep_only.rows;
  return (
    <p>
      The NEP lists {count(summary.nep.rows)} of them, for {php(summary.nep.php)}; the House bill lists{' '}
      {count(summary.house.rows)}, for {php(summary.house.php)}.{' '}
      {added || dropped ? (
        <>
          {plural(added, 'project is', 'projects are')} in the House bill only and {count(dropped)} in the NEP only: candidates
          to check, not confirmed changes.
        </>
      ) : (
        <>Every project is in both.</>
      )}
    </p>
  );
}

function Stats({ summary, programName }: { summary: Summary; programName: (k: DatasetKey) => string }) {
  const programs = (Object.entries(summary.byDataset) as [DatasetKey, { rows: number }][])
    .sort((a, b) => b[1].rows - a[1].rows)
    .map(([k, c]) => `${programName(k)} ${count(c.rows)}`)
    .join(' · ');
  return (
    <dl className="stats">
      <div>
        <dt className="label">Projects</dt>
        <dd className="stat num">{count(summary.rows)}</dd>
        <dd className="stat-sub">{programs || 'none'}</dd>
      </div>
      <div>
        <dt className="label">NEP</dt>
        <dd className="stat num">{php(summary.nep.php)}</dd>
        <dd className="stat-sub">{plural(summary.nep.rows, 'project')} · the budget the President submits</dd>
      </div>
      <div>
        <dt className="label">House bill</dt>
        <dd className="stat num stat-accent">{php(summary.house.php)}</dd>
        <dd className="stat-sub">{plural(summary.house.rows, 'project')} · compared with the NEP, not added</dd>
      </div>
      <div>
        <dt className="label">In the House bill only</dt>
        <dd className="stat num">{count(summary.groups.house_only.rows)}</dd>
        <dd className="stat-sub">{php(summary.groups.house_only.house_php)} · insertion candidates</dd>
      </div>
    </dl>
  );
}

function ProjectTable({ rows, programName, barangays }: { rows: ScopedProject[]; programName: (k: DatasetKey) => string; barangays: (title: string) => string[] }) {
  if (!rows.length) return null;
  return (
    <div className="table" role="table" aria-label="Projects">
      <div className="tr th" role="row">
        <span role="columnheader">Project</span>
        <span role="columnheader">Status</span>
        <span role="columnheader" className="r">NEP</span>
        <span role="columnheader" className="r">House bill</span>
        <span role="columnheader" className="r">Change</span>
      </div>
      {rows.map((p) => (
        <div className="tr" role="row" key={p.key}>
          <span role="cell" className="td-project">
            <Link to={`/projects/${p.dataset}/${encodeURIComponent(p.id)}`} className="project-title">{p.title}</Link>
            <span className="project-meta">
              <span className="label">{programName(p.dataset)}</span>
              {p.office && <span>{shortOffice(p.office)}</span>}
              {p.region && <span>{p.region}</span>}
              {barangays(p.title).map((b) => <span key={b} className="tag tag-brgy" title={`The title names ${b}`}>{b}</span>)}
              <ReasonTags reasons={p.reasons} />
            </span>
          </span>
          <span role="cell" className="td-status"><StatusChip group={p.bridge_group} label={p.status_label} held={p.held} /></span>
          <span role="cell" className="r num" data-label="NEP">{php(p.nep_php)}</span>
          <span role="cell" className="r num strong" data-label="House bill">{php(p.house_php)}</span>
          <span role="cell" className={`r num delta ${(p.delta_php ?? 0) > 0 ? 'up' : (p.delta_php ?? 0) < 0 ? 'down' : ''}`} data-label="Change">
            {phpDelta(p.delta_php)}
          </span>
        </div>
      ))}
    </div>
  );
}
