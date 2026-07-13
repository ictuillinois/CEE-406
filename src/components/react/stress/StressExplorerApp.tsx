// Stress Explorer — one-layer (Boussinesq) elastic response under the center
// of a uniformly loaded flexible circular area. Closed forms from Huang (2004),
// Eqs. 2.1–2.6. Supports HW3/HW4 hand-calculation checks.
import { useEffect, useMemo, useRef, useState } from 'react';
import Tip from '../Tip';
import '../tools.css';

type Profile = {
  z: number[];      // depth, mm
  sigZ: number[];   // vertical stress, kPa
  sigR: number[];   // radial (= tangential) stress, kPa
  epsZ: number[];   // vertical strain, microstrain
  epsR: number[];   // radial strain, microstrain
  w: number[];      // deflection, mm
};

function computeProfile(p: number, a: number, E_MPa: number, nu: number, zMaxRatio: number, n = 161): Profile {
  const E = E_MPa * 1000; // kPa
  const z: number[] = [], sigZ: number[] = [], sigR: number[] = [], epsZ: number[] = [], epsR: number[] = [], w: number[] = [];
  for (let i = 0; i < n; i++) {
    const zi = (i / (n - 1)) * zMaxRatio * a;
    const R = Math.sqrt(a * a + zi * zi);
    const zr3 = (zi * zi * zi) / (R * R * R);
    const sz = p * (1 - zr3);
    const sr = (p / 2) * (1 + 2 * nu - (2 * (1 + nu) * zi) / R + zr3);
    const ez = (sz - 2 * nu * sr) / E;
    const er = ((1 - nu) * sr - nu * sz) / E;
    const wi = ((1 + nu) * p * a / E) * (a / R + ((1 - 2 * nu) * (R - zi)) / a);
    z.push(zi);
    sigZ.push(sz);
    sigR.push(sr);
    epsZ.push(ez * 1e6);
    epsR.push(er * 1e6);
    w.push(wi);
  }
  return { z, sigZ, sigR, epsZ, epsR, w };
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

function num(v: string, fallback: number): number {
  const x = parseFloat(v);
  return Number.isFinite(x) ? x : fallback;
}

const fmt = (x: number, d = 2) =>
  Math.abs(x) >= 1000 ? x.toLocaleString('en-US', { maximumFractionDigits: 0 }) : x.toFixed(d);

export default function StressExplorerApp() {
  const [pStr, setP] = useState('720');
  const [aStr, setA] = useState('145');
  const [eStr, setE] = useState('42');
  const [nuStr, setNu] = useState('0.40');
  const [zRatioStr, setZRatio] = useState('4');

  const p = num(pStr, 720);
  const a = num(aStr, 145);
  const E = num(eStr, 42);
  const nu = Math.min(0.499, Math.max(0, num(nuStr, 0.4)));
  const zRatio = Math.min(10, Math.max(1, num(zRatioStr, 4)));
  const valid = p > 0 && a > 0 && E > 0;

  const prof = useMemo(() => (valid ? computeProfile(p, a, E, nu, zRatio) : null), [p, a, E, nu, zRatio, valid]);

  const theme = useTheme();
  const stressRef = useRef<HTMLDivElement>(null);
  const strainRef = useRef<HTMLDivElement>(null);
  const deflRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!prof) return;
    let cancelled = false;
    (async () => {
      const Plotly = (await import('plotly.js-dist-min')).default;
      if (cancelled) return;

      const dark = theme === 'dark';
      const fg = dark ? '#94A3B8' : '#6B7280';
      const grid = dark ? '#2D3F59' : '#E5E7EB';
      const baseLayout = {
        margin: { l: 58, r: 16, t: 8, b: 44 },
        height: 380,
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'IBM Plex Mono, monospace', size: 10.5, color: fg },
        yaxis: {
          title: { text: 'Depth z (mm)', font: { size: 11 } },
          autorange: 'reversed' as const,
          gridcolor: grid, zerolinecolor: grid,
        },
        legend: { orientation: 'h' as const, y: -0.16, font: { size: 10.5 } },
        hovermode: 'y unified' as const,
      };
      const config = { displayModeBar: false, responsive: true };

      if (stressRef.current) {
        Plotly.react(stressRef.current, [
          { x: prof.sigZ, y: prof.z, name: 'σz', mode: 'lines', line: { color: '#E87722', width: 2.5 } },
          { x: prof.sigR, y: prof.z, name: 'σr = σt', mode: 'lines', line: { color: '#0ea5e9', width: 2.5 } },
        ], {
          ...baseLayout,
          xaxis: { title: { text: 'Stress (kPa)', font: { size: 11 } }, gridcolor: grid, zerolinecolor: fg },
        }, config);
      }
      if (strainRef.current) {
        Plotly.react(strainRef.current, [
          { x: prof.epsZ, y: prof.z, name: 'εz', mode: 'lines', line: { color: '#E87722', width: 2.5 } },
          { x: prof.epsR, y: prof.z, name: 'εr', mode: 'lines', line: { color: '#0ea5e9', width: 2.5 } },
        ], {
          ...baseLayout,
          xaxis: { title: { text: 'Strain (µε) — compression positive', font: { size: 11 } }, gridcolor: grid, zerolinecolor: fg },
        }, config);
      }
      if (deflRef.current) {
        Plotly.react(deflRef.current, [
          { x: prof.w, y: prof.z, name: 'w', mode: 'lines', line: { color: '#10b981', width: 2.5 }, fill: 'tozerox', fillcolor: 'rgba(16,185,129,0.06)' },
        ], {
          ...baseLayout,
          xaxis: { title: { text: 'Deflection w (mm)', font: { size: 11 } }, gridcolor: grid, zerolinecolor: grid, rangemode: 'tozero' as const },
          showlegend: false,
        }, config);
      }
    })();
    return () => { cancelled = true; };
  }, [prof, theme]);

  // Key values
  const w0 = valid ? (2 * (1 - nu * nu) * p * a) / (E * 1000) : 0;
  const keyRows = useMemo(() => {
    if (!valid) return [];
    const ratios = [0, 0.5, 1, 1.5, 2, 3, 4];
    return ratios.filter(r => r <= zRatio).map(r => {
      const zi = r * a;
      const R = Math.sqrt(a * a + zi * zi);
      const zr3 = (zi ** 3) / (R ** 3);
      const sz = p * (1 - zr3);
      const sr = (p / 2) * (1 + 2 * nu - (2 * (1 + nu) * zi) / R + zr3);
      const Ek = E * 1000;
      const ez = (sz - 2 * nu * sr) / Ek * 1e6;
      const er = ((1 - nu) * sr - nu * sz) / Ek * 1e6;
      const wi = ((1 + nu) * p * a / Ek) * (a / R + ((1 - 2 * nu) * (R - zi)) / a);
      return { r, zi, sz, sr, ez, er, wi };
    });
  }, [p, a, E, nu, zRatio, valid]);

  return (
    <div className="cee-tool">
      <aside className="cee-panel">
        <h2 className="cee-panel__title">Inputs</h2>

        <div className="cee-field">
          <label className="cee-field__label" htmlFor="sx-p">
            <span>Contact pressure p<Tip text="Uniform pressure on the circular contact area — close to the tire inflation pressure. HW4 uses 720 kPa (~105 psi)." /></span>
            <span className="cee-field__unit">kPa</span>
          </label>
          <input id="sx-p" className="cee-input" type="number" min="1" step="10" value={pStr} onChange={e => setP(e.target.value)} />
        </div>

        <div className="cee-field">
          <label className="cee-field__label" htmlFor="sx-a">
            <span>Contact radius a<Tip text="Radius of the loaded circle: a = √(P/πp) from wheel load and pressure. HW4 uses 145 mm." /></span>
            <span className="cee-field__unit">mm</span>
          </label>
          <input id="sx-a" className="cee-input" type="number" min="1" step="5" value={aStr} onChange={e => setA(e.target.value)} />
        </div>

        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="sx-e">
              <span>Modulus E<Tip text="Elastic modulus of the half-space. Typical subgrades: 20–150 MPa. Stresses don't depend on E — strains and deflection do." /></span>
              <span className="cee-field__unit">MPa</span>
            </label>
            <input id="sx-e" className="cee-input" type="number" min="1" step="10" value={eStr} onChange={e => setE(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="sx-nu">
              <span>Poisson ν<Tip text="0.30–0.35 for granular materials, 0.40–0.45 for fine-grained soils. ν = 0.5 is incompressible (limit)." /></span>
              <span className="cee-field__unit">–</span>
            </label>
            <input id="sx-nu" className="cee-input" type="number" min="0" max="0.49" step="0.05" value={nuStr} onChange={e => setNu(e.target.value)} />
          </div>
        </div>

        <div className="cee-field">
          <label className="cee-field__label" htmlFor="sx-zr">
            <span>Profile depth<Tip text="How deep to plot, in multiples of the contact radius. At z = 4a the vertical stress has dropped below ~5% of p." /></span>
            <span className="cee-field__unit">× a</span>
          </label>
          <input id="sx-zr" className="cee-input" type="number" min="1" max="10" step="1" value={zRatioStr} onChange={e => setZRatio(e.target.value)} />
        </div>

        {nu >= 0.48 && (
          <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>ν is near the incompressible limit (0.5): the (1−2ν) terms vanish and strains become very small. Use 0.45 or less for realistic soils.</span></p>
        )}

        <p className="cee-hint">
          One-layer elastic half-space, flexible circular load, response on the axis of
          symmetry — Huang (2004) Eqs. 2.1–2.6. Compression is positive. For layered
          systems use the HW3 charts or a layered-elastic program, and use this tool
          as a limiting check.
        </p>
      </aside>

      <div className="cee-results">
        <details className="cee-howto">
          <summary>How to use this tool</summary>
          <div className="cee-howto__body">
            <ol>
              <li><strong>Set the load</strong>: contact pressure <code>p</code> and radius <code>a</code> (from wheel load: a = √(P/πp)).</li>
              <li><strong>Set the material</strong>: one modulus and Poisson ratio — this is a <em>one-layer</em> (homogeneous half-space) model.</li>
              <li><strong>Read the profiles</strong>: depth increases downward; compression is positive. Hover any curve for exact values at a depth.</li>
              <li><strong>Check hand solutions</strong>: the table gives values at the classic z/a ratios used by the HW3 charts, and the key cards give the two results every solution should reproduce: σz/p = 0.646 at z = a, and w₀ = 2(1−ν²)pa/E.</li>
            </ol>
            For layered systems this is a bounding case: a stiff top layer will cut the subgrade stress well below the one-layer curve — that reduction is exactly what the HW3 two- and three-layer charts (and WinJULEA in HW4) quantify.
          </div>
        </details>

        {!valid ? (
          <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>Enter positive values for p, a, and E to see results.</span></p>
        ) : (
          <>
            <div className="cee-keys">
              <div className="cee-key cee-key--accent">
                <div className="cee-key__label">SURFACE DEFLECTION w₀</div>
                <div className="cee-key__value">{fmt(w0, 3)}<small>mm</small></div>
              </div>
              <div className="cee-key">
                <div className="cee-key__label">σz AT z = a</div>
                <div className="cee-key__value">{fmt(p * (1 - 1 / Math.pow(2, 1.5)), 1)}<small>kPa</small></div>
              </div>
              <div className="cee-key">
                <div className="cee-key__label">σz / p AT z = a</div>
                <div className="cee-key__value">{fmt(1 - 1 / Math.pow(2, 1.5), 3)}</div>
              </div>
              <div className="cee-key">
                <div className="cee-key__label">w₀ FORMULA</div>
                <div className="cee-key__value" style={{ fontSize: '0.8rem' }}>2(1−ν²)pa/E</div>
              </div>
            </div>

            <div className="cee-chart-grid cee-chart-grid--2">
              <div className="cee-chart">
                <h3 className="cee-chart__title">Stress vs. depth</h3>
                <div ref={stressRef} />
              </div>
              <div className="cee-chart">
                <h3 className="cee-chart__title">Strain vs. depth</h3>
                <div ref={strainRef} />
              </div>
            </div>

            <div className="cee-chart">
              <h3 className="cee-chart__title">Deflection vs. depth</h3>
              <div ref={deflRef} />
            </div>

            <div className="cee-tablewrap">
              <table className="cee-table">
                <thead>
                  <tr>
                    <th>z / a</th>
                    <th>z (mm)</th>
                    <th>σz (kPa)</th>
                    <th>σr (kPa)</th>
                    <th>εz (µε)</th>
                    <th>εr (µε)</th>
                    <th>w (mm)</th>
                  </tr>
                </thead>
                <tbody>
                  {keyRows.map(row => (
                    <tr key={row.r}>
                      <td>{row.r.toFixed(1)}</td>
                      <td>{fmt(row.zi, 0)}</td>
                      <td>{fmt(row.sz, 1)}</td>
                      <td>{fmt(row.sr, 1)}</td>
                      <td>{fmt(row.ez, 0)}</td>
                      <td>{fmt(row.er, 0)}</td>
                      <td>{fmt(row.wi, 3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
