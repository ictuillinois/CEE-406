// ESAL Calculator — AASHTO load equivalency factors for flexible pavements
// (AASHTO 1993 Guide, Appendix D; Huang 2004, Ch. 6) plus design-lane
// traffic projection with growth, directional, and lane factors.
import { useEffect, useMemo, useRef, useState } from 'react';
import '../tools.css';

type AxleType = 'single' | 'tandem' | 'tridem';
const AXLE_L2: Record<AxleType, number> = { single: 1, tandem: 2, tridem: 3 };
const AXLE_LABEL: Record<AxleType, string> = { single: 'Single', tandem: 'Tandem', tridem: 'Tridem' };

interface AxleRow {
  id: number;
  load: string;   // kip
  type: AxleType;
  count: string;  // passes per day (design lane)
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

function useTheme(): 'light' | 'dark' {
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
  );
  useEffect(() => {
    const obs = new MutationObserver(() => {
      setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return theme;
}

const num = (v: string, fb = 0) => {
  const x = parseFloat(v);
  return Number.isFinite(x) ? x : fb;
};

const sci = (x: number) => {
  if (x === 0) return '0';
  if (x >= 1e6) return (x / 1e6).toFixed(2) + ' M';
  return x.toLocaleString('en-US', { maximumFractionDigits: 0 });
};

let nextId = 4;

export default function EsalCalculatorApp() {
  // Pavement / serviceability
  const [snStr, setSn] = useState('5');
  const [pt, setPt] = useState('2.5');

  // Axle spectrum (per day, design lane)
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
  const years = Math.max(1, num(yearsStr, 20));
  const dir = Math.min(1, Math.max(0, num(dirStr, 0.5)));
  const lane = Math.min(1, Math.max(0, num(laneStr, 0.9)));

  const computed = useMemo(() => {
    const withEalf = rows.map(r => {
      const load = num(r.load);
      const count = num(r.count);
      const ealf = load > 0 ? ealfFlexible(load, r.type, SN, ptv) : 0;
      return { ...r, loadNum: load, countNum: count, ealf, esalDay: ealf * count };
    });
    const esalPerDay = withEalf.reduce((s, r) => s + r.esalDay, 0);
    const G = growth === 0 ? years : (Math.pow(1 + growth, years) - 1) / growth;
    const designEsal = esalPerDay * 365 * G * dir * lane;
    return { withEalf, esalPerDay, G, designEsal };
  }, [rows, SN, ptv, growth, years, dir, lane]);

  // Chart
  const theme = useTheme();
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const Plotly = (await import('plotly.js-dist-min')).default;
      if (cancelled || !chartRef.current) return;

      const dark = theme === 'dark';
      const fg = dark ? '#94A3B8' : '#6B7280';
      const grid = dark ? '#2D3F59' : '#E5E7EB';
      const colors: Record<AxleType, string> = { single: '#E87722', tandem: '#0ea5e9', tridem: '#8b5cf6' };
      const ranges: Record<AxleType, [number, number]> = { single: [2, 50], tandem: [6, 90], tridem: [10, 110] };

      const traces: any[] = (['single', 'tandem', 'tridem'] as AxleType[]).map(t => {
        const xs: number[] = [], ys: number[] = [];
        for (let L = ranges[t][0]; L <= ranges[t][1]; L += 1) {
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
          marker: { color: markers.map(r => colors[r.type]), size: 9, symbol: 'diamond', line: { color: dark ? '#F1F5F9' : '#0F1A2E', width: 1 } },
        });
      }

      Plotly.react(chartRef.current, traces, {
        margin: { l: 56, r: 16, t: 8, b: 44 },
        height: 380,
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'IBM Plex Mono, monospace', size: 10.5, color: fg },
        xaxis: { title: { text: 'Axle load (kip)', font: { size: 11 } }, gridcolor: grid, zerolinecolor: grid },
        yaxis: { title: { text: 'EALF (log scale)', font: { size: 11 } }, type: 'log', gridcolor: grid, zerolinecolor: grid },
        legend: { orientation: 'h', y: -0.16, font: { size: 10.5 } },
        hovermode: 'closest',
      }, { displayModeBar: false, responsive: true });
    })();
    return () => { cancelled = true; };
  }, [SN, ptv, computed, theme]);

  const updateRow = (id: number, patch: Partial<AxleRow>) =>
    setRows(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <div className="cee-tool">
      <aside className="cee-panel">
        <h2 className="cee-panel__title">Inputs</h2>

        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="es-sn">
              SN <span className="cee-field__unit">1–9</span>
            </label>
            <input id="es-sn" className="cee-input" type="number" min="1" max="9" step="0.5" value={snStr} onChange={e => setSn(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="es-pt">
              Terminal pₜ <span className="cee-field__unit">PSI</span>
            </label>
            <select id="es-pt" className="cee-select" value={pt} onChange={e => setPt(e.target.value)}>
              <option value="2.0">2.0</option>
              <option value="2.5">2.5</option>
              <option value="3.0">3.0</option>
            </select>
          </div>
        </div>

        <div className="cee-field">
          <span className="cee-field__label">Axle spectrum <span className="cee-field__unit">kip · type · passes/day</span></span>
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
              Directional D <span className="cee-field__unit">0–1</span>
            </label>
            <input id="es-d" className="cee-input" type="number" min="0" max="1" step="0.05" value={dirStr} onChange={e => setDir(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="es-l">
              Lane L <span className="cee-field__unit">0–1</span>
            </label>
            <input id="es-l" className="cee-input" type="number" min="0" max="1" step="0.05" value={laneStr} onChange={e => setLane(e.target.value)} />
          </div>
        </div>

        <p className="cee-hint">
          EALFs from the AASHTO design equation for flexible pavements
          (1993 Guide, App. D; Huang Ch. 6). If your axle counts are already
          design-lane, one-direction values, set D and L to 1.
        </p>
      </aside>

      <div className="cee-results">
        <div className="cee-keys">
          <div className="cee-key">
            <div className="cee-key__label">ESALs / DAY (YEAR 1)</div>
            <div className="cee-key__value">{computed.esalPerDay.toFixed(1)}</div>
          </div>
          <div className="cee-key">
            <div className="cee-key__label">GROWTH FACTOR G</div>
            <div className="cee-key__value">{computed.G.toFixed(2)}</div>
          </div>
          <div className="cee-key cee-key--accent">
            <div className="cee-key__label">DESIGN ESALs ({years} YR)</div>
            <div className="cee-key__value">{sci(computed.designEsal)}</div>
          </div>
        </div>

        <div className="cee-tablewrap">
          <table className="cee-table">
            <thead>
              <tr>
                <th>Axle</th>
                <th>Load (kip)</th>
                <th>EALF</th>
                <th>Passes/day</th>
                <th>ESALs/day</th>
              </tr>
            </thead>
            <tbody>
              {computed.withEalf.map(r => (
                <tr key={r.id}>
                  <td>{AXLE_LABEL[r.type]}</td>
                  <td>{r.loadNum || '—'}</td>
                  <td>{r.loadNum ? r.ealf.toFixed(4) : '—'}</td>
                  <td>{r.countNum || '—'}</td>
                  <td>{r.esalDay ? r.esalDay.toFixed(1) : '—'}</td>
                </tr>
              ))}
              <tr>
                <td><strong>Total</strong></td>
                <td></td>
                <td></td>
                <td></td>
                <td><strong>{computed.esalPerDay.toFixed(1)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="cee-chart">
          <h3 className="cee-chart__title">EALF vs. axle load — SN = {SN}, pₜ = {ptv}</h3>
          <div ref={chartRef} />
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
