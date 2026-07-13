// ESAL Calculator — AASHTO load equivalency factors for flexible pavements
// (AASHTO 1993 Guide, Appendix D; Huang 2004, Ch. 6) plus design-lane
// traffic projection with growth, directional, and lane factors.
import { useEffect, useMemo, useRef, useState } from 'react';
import Tip from '../Tip';
import { useTheme, chartColors, baseLayout, plotConfig, num } from '../chartTheme';
import '../tools.css';

type AxleType = 'single' | 'tandem' | 'tridem';
const AXLE_L2: Record<AxleType, number> = { single: 1, tandem: 2, tridem: 3 };
const AXLE_LABEL: Record<AxleType, string> = { single: 'Single', tandem: 'Tandem', tridem: 'Tridem' };
const AXLE_RANGE: Record<AxleType, [number, number]> = { single: [2, 50], tandem: [6, 90], tridem: [10, 110] };

interface AxleRow {
  id: number;
  load: string;   // kip
  type: AxleType;
  count: string;  // passes per day, two-way
}

/** AASHTO flexible-pavement load equivalency factor (EALF = Wt18 / Wtx). */
function ealfFlexible(Lx: number, type: AxleType, SN: number, pt: number): number {
  const L2 = AXLE_L2[type];
  const Gt = Math.log10((4.2 - pt) / (4.2 - 1.5));
  const beta = (L: number, L2v: number) =>
    0.4 + (0.081 * Math.pow(L + L2v, 3.23)) / (Math.pow(SN + 1, 5.19) * Math.pow(L2v, 3.23));
  const bx = beta(Lx, L2);
  const b18 = beta(18, 1);
  const logRatio =
    4.79 * Math.log10(18 + 1) -
    4.79 * Math.log10(Lx + L2) +
    4.33 * Math.log10(L2) +
    Gt / bx -
    Gt / b18;
  return Math.pow(10, -logRatio);
}

const sci = (x: number) => {
  if (x === 0) return '0';
  if (x >= 1e6) return (x / 1e6).toFixed(2) + ' M';
  return x.toLocaleString('en-US', { maximumFractionDigits: 0 });
};

let nextId = 100;

const SPECTRUM_PRESETS: { label: string; tip: string; rows: Omit<AxleRow, 'id'>[] }[] = [
  {
    label: 'Interstate mix',
    tip: 'A heavy mixed stream: steer singles, loaded tandems, and a tridem stream.',
    rows: [
      { load: '12', type: 'single', count: '220' },
      { load: '18', type: 'single', count: '120' },
      { load: '34', type: 'tandem', count: '80' },
      { load: '48', type: 'tridem', count: '25' },
    ],
  },
  {
    label: 'Class 9 semis',
    tip: 'One hundred 5-axle semis a day: a 12-kip steer axle plus two 34-kip tandems each.',
    rows: [
      { load: '12', type: 'single', count: '100' },
      { load: '34', type: 'tandem', count: '200' },
    ],
  },
  {
    label: 'Collector road',
    tip: 'A light stream: mostly single axles near the legal limit.',
    rows: [
      { load: '10', type: 'single', count: '60' },
      { load: '18', type: 'single', count: '25' },
      { load: '30', type: 'tandem', count: '10' },
    ],
  },
];

export default function EsalCalculatorApp() {
  // Pavement / serviceability
  const [snStr, setSn] = useState('5');
  const [pt, setPt] = useState('2.5');

  // Axle spectrum (per day, two-way)
  const [rows, setRows] = useState<AxleRow[]>([
    { id: 1, load: '12', type: 'single', count: '220' },
    { id: 2, load: '18', type: 'single', count: '120' },
    { id: 3, load: '34', type: 'tandem', count: '80' },
  ]);

  // Projection
  const [growthStr, setGrowth] = useState('3');
  const [yearsStr, setYears] = useState('20');
  const [dirStr, setDir] = useState('0.5');
  const [laneStr, setLane] = useState('0.9');

  const SN = Math.min(9, Math.max(1, num(snStr, 5)));
  const ptv = num(pt, 2.5);
  const growth = num(growthStr, 3) / 100;
  const years = Math.max(1, Math.round(num(yearsStr, 20)));
  const dir = Math.min(1, Math.max(0, num(dirStr, 0.5)));
  const lane = Math.min(1, Math.max(0, num(laneStr, 0.9)));

  const computed = useMemo(() => {
    const withEalf = rows.map(r => {
      const load = num(r.load);
      const count = num(r.count);
      const ealf = load > 0 ? ealfFlexible(load, r.type, SN, ptv) : 0;
      const fourth = r.type === 'single' && load > 0 ? Math.pow(load / 18, 4) : null;
      return { ...r, loadNum: load, countNum: count, ealf, fourth, esalDay: ealf * count };
    });
    const esalPerDay = withEalf.reduce((s, r) => s + r.esalDay, 0); // two-way
    const laneDay = esalPerDay * dir * lane;                        // design lane, day 1
    const G = growth === 0 ? years : (Math.pow(1 + growth, years) - 1) / growth;
    const designEsal = laneDay * 365 * G;
    // cumulative design-lane ESALs by year
    const cumYears: number[] = [], cum: number[] = [];
    let acc = 0;
    for (let t = 1; t <= years; t++) {
      acc += laneDay * 365 * Math.pow(1 + growth, t - 1);
      cumYears.push(t);
      cum.push(acc);
    }
    return { withEalf, esalPerDay, laneDay, G, designEsal, cumYears, cum };
  }, [rows, SN, ptv, growth, years, dir, lane]);

  const theme = useTheme();
  const chartRef = useRef<HTMLDivElement>(null);
  const cumRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const Plotly = (await import('plotly.js-dist-min')).default;
      if (cancelled) return;

      const c = chartColors(theme);
      const colors: Record<AxleType, string> = { single: c.orange, tandem: c.sky, tridem: c.violet };

      if (chartRef.current) {
        const traces: any[] = (['single', 'tandem', 'tridem'] as AxleType[]).map(t => {
          const xs: number[] = [], ys: number[] = [];
          for (let L = AXLE_RANGE[t][0]; L <= AXLE_RANGE[t][1]; L += 1) {
            xs.push(L);
            ys.push(ealfFlexible(L, t, SN, ptv));
          }
          return { x: xs, y: ys, name: AXLE_LABEL[t], mode: 'lines', line: { color: colors[t], width: 2.25 } };
        });
        const markers = computed.withEalf.filter(r => r.loadNum > 0);
        if (markers.length) {
          traces.push({
            x: markers.map(r => r.loadNum),
            y: markers.map(r => r.ealf),
            name: 'Your axles',
            mode: 'markers',
            marker: { color: markers.map(r => colors[r.type]), size: 9, symbol: 'diamond', line: { color: c.ink, width: 1 } },
          });
        }
        Plotly.react(chartRef.current, traces, baseLayout(theme, {
          xaxis: { title: { text: 'Axle load (kip)', font: { size: 11 } }, gridcolor: c.grid, zerolinecolor: c.grid },
          yaxis: { title: { text: 'EALF (log scale)', font: { size: 11 } }, type: 'log', gridcolor: c.grid, zerolinecolor: c.grid },
          hovermode: 'closest',
          shapes: [
            // the definition point: an 18-kip single axle has EALF = 1
            { type: 'line', x0: 18, x1: 18, yref: 'paper', y0: 0, y1: 1, line: { color: c.fg, width: 1, dash: 'dot' } },
          ],
          annotations: [{
            x: 18, yref: 'paper', y: 1.02, text: '18 kip · EALF 1', showarrow: false, font: { size: 9.5, color: c.fg },
          }],
        }), plotConfig);
      }

      if (cumRef.current) {
        Plotly.react(cumRef.current, [{
          x: computed.cumYears, y: computed.cum, name: 'Cumulative ESALs',
          mode: 'lines', line: { color: c.green, width: 2.5 },
          fill: 'tozeroy', fillcolor: 'rgba(16,185,129,0.08)',
          hovertemplate: 'Year %{x}: %{y:,.0f} ESALs<extra></extra>',
        }], baseLayout(theme, {
          xaxis: { title: { text: 'Year of design period', font: { size: 11 } }, gridcolor: c.grid, zerolinecolor: c.grid, dtick: Math.max(1, Math.round(years / 10)) },
          yaxis: { title: { text: 'Cumulative design-lane ESALs', font: { size: 11 } }, gridcolor: c.grid, zerolinecolor: c.grid, rangemode: 'tozero' as const },
          showlegend: false,
          hovermode: 'x unified' as const,
        }), plotConfig);
      }
    })();
    return () => { cancelled = true; };
  }, [SN, ptv, computed, theme, years]);

  const updateRow = (id: number, patch: Partial<AxleRow>) =>
    setRows(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)));

  const maxShare = Math.max(...computed.withEalf.map(r => r.esalDay), 1e-9);

  return (
    <div className="cee-tool">
      <aside className="cee-panel">
        <h2 className="cee-panel__title">Inputs</h2>

        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="es-sn">
              <span>SN<Tip text="Structural number of the pavement the EALF is evaluated for. If unknown, SN = 5 is the standard assumption — EALFs are only mildly sensitive to it." /></span>
              <span className="cee-field__unit">1–9</span>
            </label>
            <input id="es-sn" className="cee-input" type="number" min="1" max="9" step="0.5" value={snStr} onChange={e => setSn(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="es-pt">
              <span>Terminal pₜ<Tip text="Serviceability at end of life: 2.5 for major highways, 2.0 for lower-class roads." /></span>
              <span className="cee-field__unit">PSI</span>
            </label>
            <select id="es-pt" className="cee-select" value={pt} onChange={e => setPt(e.target.value)}>
              <option value="2.0">2.0</option>
              <option value="2.5">2.5</option>
              <option value="3.0">3.0</option>
            </select>
          </div>
        </div>

        <div className="cee-field">
          <span className="cee-field__label">Axle spectrum <span className="cee-field__unit">kip · type · passes/day two-way</span></span>
          <div className="cee-presets">
            {SPECTRUM_PRESETS.map(pr => (
              <button
                key={pr.label} type="button" className="cee-chip" title={pr.tip}
                onClick={() => setRows(pr.rows.map(r => ({ ...r, id: nextId++ })))}
              >{pr.label}</button>
            ))}
          </div>
          {rows.map(r => (
            <div className="cee-axle-row" key={r.id}>
              <input
                className="cee-input" type="number" min="1" step="1" value={r.load}
                aria-label="Axle load (kip)"
                onChange={e => updateRow(r.id, { load: e.target.value })}
              />
              <select
                className="cee-select" value={r.type}
                aria-label="Axle type"
                onChange={e => updateRow(r.id, { type: e.target.value as AxleType })}
              >
                <option value="single">Single</option>
                <option value="tandem">Tandem</option>
                <option value="tridem">Tridem</option>
              </select>
              <input
                className="cee-input" type="number" min="0" step="10" value={r.count}
                aria-label="Passes per day"
                onChange={e => updateRow(r.id, { count: e.target.value })}
              />
              <button
                className="cee-axle-remove" type="button" aria-label="Remove axle row"
                onClick={() => setRows(rs => rs.filter(x => x.id !== r.id))}
              >×</button>
            </div>
          ))}
          <button
            className="cee-btn cee-btn--ghost cee-btn--sm" type="button"
            onClick={() => setRows(rs => [...rs, { id: nextId++, load: '18', type: 'single', count: '100' }])}
          >+ Add axle group</button>
        </div>

        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="es-g">
              Growth r <span className="cee-field__unit">%/yr</span>
            </label>
            <input id="es-g" className="cee-input" type="number" min="0" max="15" step="0.5" value={growthStr} onChange={e => setGrowth(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="es-n">
              Period n <span className="cee-field__unit">yr</span>
            </label>
            <input id="es-n" className="cee-input" type="number" min="1" max="50" step="1" value={yearsStr} onChange={e => setYears(e.target.value)} />
          </div>
        </div>

        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="es-d">
              <span>Directional D<Tip text="Fraction of two-way traffic in the design direction, usually 0.5. Set to 1 if your counts are already one-direction." /></span>
              <span className="cee-field__unit">0–1</span>
            </label>
            <input id="es-d" className="cee-input" type="number" min="0" max="1" step="0.05" value={dirStr} onChange={e => setDir(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="es-l">
              <span>Lane L<Tip text="Fraction of directional trucks in the design lane: 1.0 for 1 lane/direction, 0.8–1.0 for 2, 0.6–0.8 for 3+." /></span>
              <span className="cee-field__unit">0–1</span>
            </label>
            <input id="es-l" className="cee-input" type="number" min="0" max="1" step="0.05" value={laneStr} onChange={e => setLane(e.target.value)} />
          </div>
        </div>

        {computed.withEalf.some(r => r.loadNum > AXLE_RANGE[r.type][1]) && (
          <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>An axle load is beyond the range of the AASHTO tables — the equation extrapolates, so treat that EALF with caution.</span></p>
        )}

        <p className="cee-hint">
          EALFs from the AASHTO design equation for flexible pavements
          (1993 Guide, App. D; Huang Ch. 6). If your axle counts are already
          design-lane, one-direction values, set D and L to 1.
        </p>
      </aside>

      <div className="cee-results">
        <details className="cee-howto">
          <summary>How to use this tool</summary>
          <div className="cee-howto__body">
            <ol>
              <li><strong>Describe the pavement</strong>: SN and pₜ pick the AASHTO equivalency table (SN = 5, pₜ = 2.5 reproduce Table D.4).</li>
              <li><strong>Build the axle spectrum</strong>: one row per axle group — a tandem is one group with its own EALF, <em>not</em> two singles. The presets load typical streams.</li>
              <li><strong>Project the traffic</strong>: D and L bring two-way counts down to the design lane; r and n set the growth factor G. Counts already design-lane? Set D = L = 1.</li>
              <li><strong>Read the results</strong>: the flow strip shows each factor doing its work, the table gives exact EALFs to compare with your interpolated values, and the growth chart shows the traffic accumulating.</li>
            </ol>
            EALFs come from the AASHTO design equation itself, so they match the printed tables to the fourth decimal — a stronger check than the (L/18)⁴ rule of thumb.
          </div>
        </details>

        <div className="cee-flow" role="group" aria-label="Traffic projection breakdown">
          <div className="cee-flow__step">
            <div className="cee-flow__label">ESALs/DAY · TWO-WAY</div>
            <div className="cee-flow__value">{computed.esalPerDay.toFixed(1)}</div>
          </div>
          <div className="cee-flow__op">× D·L = {(dir * lane).toFixed(2)}</div>
          <div className="cee-flow__step">
            <div className="cee-flow__label">DESIGN LANE / DAY</div>
            <div className="cee-flow__value">{computed.laneDay.toFixed(1)}</div>
          </div>
          <div className="cee-flow__op">× 365 × G = {computed.G.toFixed(2)}</div>
          <div className="cee-flow__step cee-flow__step--accent">
            <div className="cee-flow__label">DESIGN ESALs · {years} YR</div>
            <div className="cee-flow__value">{sci(computed.designEsal)}</div>
          </div>
        </div>

        <div className="cee-tablewrap">
          <table className="cee-table">
            <thead>
              <tr>
                <th>Axle</th>
                <th>Load (kip)</th>
                <th>EALF</th>
                <th>(L/18)⁴<Tip text="The fourth-power rule of thumb — defined for single axles only. Compare it with the exact EALF." /></th>
                <th>Passes/day</th>
                <th>ESALs/day</th>
                <th>Share</th>
              </tr>
            </thead>
            <tbody>
              {computed.withEalf.map(r => (
                <tr key={r.id}>
                  <td>{AXLE_LABEL[r.type]}</td>
                  <td>{r.loadNum || '—'}</td>
                  <td>{r.loadNum ? r.ealf.toFixed(4) : '—'}</td>
                  <td>{r.fourth != null ? r.fourth.toFixed(3) : '—'}</td>
                  <td>{r.countNum || '—'}</td>
                  <td>{r.esalDay ? r.esalDay.toFixed(1) : '—'}</td>
                  <td className="cee-share-cell">
                    <span className="cee-share" aria-hidden="true"><span style={{ width: `${(r.esalDay / maxShare) * 100}%` }} /></span>
                    {computed.esalPerDay > 0 ? `${((r.esalDay / computed.esalPerDay) * 100).toFixed(0)}%` : '—'}
                  </td>
                </tr>
              ))}
              <tr>
                <td><strong>Total</strong></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td><strong>{computed.esalPerDay.toFixed(1)}</strong></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="cee-chart-grid cee-chart-grid--2">
          <div className="cee-chart">
            <h3 className="cee-chart__title">EALF vs. axle load — SN = {SN}, pₜ = {ptv}</h3>
            <div ref={chartRef} />
          </div>
          <div className="cee-chart">
            <h3 className="cee-chart__title">Traffic accumulation — r = {(growth * 100).toFixed(1)}%/yr</h3>
            <div ref={cumRef} />
          </div>
        </div>

        <p className="cee-note">
          Sanity checks: an 18-kip single axle gives EALF = 1.0 by definition, and at
          SN = 5, pₜ = 2.5 a 12-kip single axle gives EALF ≈ 0.19 (AASHTO Table D.4).
          The fourth-power rule (L/18)⁴ is a quick approximation for single axles only.
        </p>
      </div>
    </div>
  );
}
