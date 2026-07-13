// Stress Explorer — one-layer (Boussinesq) elastic response under the center
// of a uniformly loaded flexible circular area. Closed forms from Huang (2004),
// Eqs. 2.1–2.6; the pressure bulb integrates the Boussinesq point-load kernel
// over the loaded area. Supports HW3/HW4 hand-calculation checks.
import { useEffect, useMemo, useRef, useState } from 'react';
import Tip from '../Tip';
import { useTheme, chartColors, baseLayout, plotConfig, num, fmt } from '../chartTheme';
import '../tools.css';

type Profile = {
  z: number[];      // depth, mm
  sigZ: number[];   // vertical stress, kPa
  sigR: number[];   // radial (= tangential) stress, kPa
  epsZ: number[];   // vertical strain, microstrain
  epsR: number[];   // radial strain, microstrain
  w: number[];      // deflection, mm
};

/** Axis-of-symmetry response at depth z (all closed-form). */
function responseAt(zi: number, p: number, a: number, E_kPa: number, nu: number) {
  const R = Math.sqrt(a * a + zi * zi);
  const zr3 = (zi * zi * zi) / (R * R * R);
  const sz = p * (1 - zr3);
  const sr = (p / 2) * (1 + 2 * nu - (2 * (1 + nu) * zi) / R + zr3);
  const ez = (sz - 2 * nu * sr) / E_kPa;
  const er = ((1 - nu) * sr - nu * sz) / E_kPa;
  const w = ((1 + nu) * p * a / E_kPa) * (a / R + ((1 - 2 * nu) * (R - zi)) / a);
  return { sz, sr, ez: ez * 1e6, er: er * 1e6, w };
}

function computeProfile(p: number, a: number, E_MPa: number, nu: number, zMaxRatio: number, n = 161): Profile {
  const E = E_MPa * 1000; // kPa
  const z: number[] = [], sigZ: number[] = [], sigR: number[] = [], epsZ: number[] = [], epsR: number[] = [], w: number[] = [];
  for (let i = 0; i < n; i++) {
    const zi = (i / (n - 1)) * zMaxRatio * a;
    const r = responseAt(zi, p, a, E, nu);
    z.push(zi); sigZ.push(r.sz); sigR.push(r.sr); epsZ.push(r.ez); epsR.push(r.er); w.push(r.w);
  }
  return { z, sigZ, sigR, epsZ, epsR, w };
}

/**
 * Normalized pressure bulb: σz/p on a (r/a, z/a) grid, by numerical integration
 * of the Boussinesq point-load kernel over the unit circle. Parameter-free —
 * computed once per session.
 */
function computeBulb() {
  const NR = 37, NZ = 45, NRHO = 28, NPHI = 36;
  const rMax = 3, zMax = 4;
  const rGrid: number[] = [], zGrid: number[] = [];
  for (let i = 0; i < NR; i++) rGrid.push((i / (NR - 1)) * rMax);
  for (let j = 0; j < NZ; j++) zGrid.push(0.06 + (j / (NZ - 1)) * (zMax - 0.06));

  const dRho = 1 / NRHO, dPhi = Math.PI / NPHI;
  // z rows × r cols
  const half: number[][] = [];
  for (let j = 0; j < NZ; j++) {
    const zb = zGrid[j];
    const row: number[] = [];
    for (let i = 0; i < NR; i++) {
      const rb = rGrid[i];
      let sum = 0;
      for (let ir = 0; ir < NRHO; ir++) {
        const rho = (ir + 0.5) * dRho;
        for (let ip = 0; ip < NPHI; ip++) {
          const phi = (ip + 0.5) * dPhi;
          const s2 = rb * rb + rho * rho - 2 * rb * rho * Math.cos(phi);
          const R2 = s2 + zb * zb;
          sum += (rho * dRho * dPhi) / Math.pow(R2, 2.5);
        }
      }
      // ×2 for the φ half-range; kernel prefactor 3z³/2π
      row.push(Math.min(1, (3 * zb ** 3 / (2 * Math.PI)) * 2 * sum));
    }
    half.push(row);
  }
  // Mirror across the axis of symmetry for a full-width bulb.
  const x: number[] = [];
  for (let i = NR - 1; i > 0; i--) x.push(-rGrid[i]);
  for (let i = 0; i < NR; i++) x.push(rGrid[i]);
  const zmat: number[][] = half.map(row => {
    const m: number[] = [];
    for (let i = NR - 1; i > 0; i--) m.push(row[i]);
    return m.concat(row);
  });
  return { x, y: zGrid, z: zmat };
}

let bulbCache: ReturnType<typeof computeBulb> | null = null;

const PRESETS: { label: string; p: string; a: string; E: string; nu: string; tip: string }[] = [
  { label: 'HW4 load', p: '720', a: '145', E: '42', nu: '0.40', tip: 'The HW4 wheel: 720 kPa on a 145 mm radius, on the HW4 subgrade (42 MPa).' },
  { label: 'Soft subgrade', p: '550', a: '120', E: '20', nu: '0.45', tip: 'A weak fine-grained subgrade — watch the strains and deflection grow.' },
  { label: 'Granular base', p: '700', a: '150', E: '150', nu: '0.35', tip: 'A stiff unbound layer — stresses are identical, strains are not.' },
];

export default function StressExplorerApp() {
  const [pStr, setP] = useState('720');
  const [aStr, setA] = useState('145');
  const [eStr, setE] = useState('42');
  const [nuStr, setNu] = useState('0.40');
  const [zRatioStr, setZRatio] = useState('4');
  const [probe, setProbe] = useState(1); // z/a of the depth probe

  const p = num(pStr, 720);
  const a = num(aStr, 145);
  const E = num(eStr, 42);
  const nu = Math.min(0.499, Math.max(0, num(nuStr, 0.4)));
  const zRatio = Math.min(10, Math.max(1, num(zRatioStr, 4)));
  const valid = p > 0 && a > 0 && E > 0;
  const probeClamped = Math.min(probe, zRatio);

  const prof = useMemo(() => (valid ? computeProfile(p, a, E, nu, zRatio) : null), [p, a, E, nu, zRatio, valid]);
  const atProbe = useMemo(
    () => (valid ? responseAt(probeClamped * a, p, a, E * 1000, nu) : null),
    [probeClamped, p, a, E, nu, valid]
  );

  const theme = useTheme();
  const stressRef = useRef<HTMLDivElement>(null);
  const strainRef = useRef<HTMLDivElement>(null);
  const deflRef = useRef<HTMLDivElement>(null);
  const bulbRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!prof) return;
    let cancelled = false;
    (async () => {
      const Plotly = (await import('plotly.js-dist-min')).default;
      if (cancelled) return;

      const c = chartColors(theme);
      const dark = theme === 'dark';
      const zProbeMm = probeClamped * a;
      const probeLine = {
        type: 'line' as const, xref: 'paper' as const, x0: 0, x1: 1,
        y0: zProbeMm, y1: zProbeMm,
        line: { color: c.violet, width: 1.5, dash: 'dot' as const },
      };
      const layout = (xTitle: string, extra: Record<string, unknown> = {}) =>
        baseLayout(theme, {
          xaxis: { title: { text: xTitle, font: { size: 11 } }, gridcolor: c.grid, zerolinecolor: c.fg },
          yaxis: {
            title: { text: 'Depth z (mm)', font: { size: 11 } },
            autorange: 'reversed' as const, gridcolor: c.grid, zerolinecolor: c.grid,
          },
          hovermode: 'y unified' as const,
          shapes: [probeLine],
          ...extra,
        });

      if (stressRef.current) {
        Plotly.react(stressRef.current, [
          { x: prof.sigZ, y: prof.z, name: 'σz', mode: 'lines', line: { color: c.orange, width: 2.5 } },
          { x: prof.sigR, y: prof.z, name: 'σr = σt', mode: 'lines', line: { color: c.sky, width: 2.5 } },
        ], layout('Stress (kPa)'), plotConfig);
      }
      if (strainRef.current) {
        Plotly.react(strainRef.current, [
          { x: prof.epsZ, y: prof.z, name: 'εz', mode: 'lines', line: { color: c.orange, width: 2.5 } },
          { x: prof.epsR, y: prof.z, name: 'εr', mode: 'lines', line: { color: c.sky, width: 2.5 } },
        ], layout('Strain (µε) — compression positive'), plotConfig);
      }
      if (deflRef.current) {
        Plotly.react(deflRef.current, [
          { x: prof.w, y: prof.z, name: 'w', mode: 'lines', line: { color: c.green, width: 2.5 }, fill: 'tozerox', fillcolor: 'rgba(16,185,129,0.06)' },
        ], layout('Deflection w (mm)', {
          xaxis: { title: { text: 'Deflection w (mm)', font: { size: 11 } }, gridcolor: c.grid, zerolinecolor: c.grid, rangemode: 'tozero' as const },
          showlegend: false,
        }), plotConfig);
      }
      if (bulbRef.current) {
        if (!bulbCache) bulbCache = computeBulb();
        // Sequential single-hue ramp (magnitude): light → dark in light mode,
        // dark → light on the dark surface.
        const scale = dark
          ? [[0, 'rgba(220,112,20,0)'], [0.15, '#7C2D12'], [0.45, '#C2410C'], [0.75, '#EA7317'], [1, '#FDBA74']]
          : [[0, 'rgba(232,119,34,0)'], [0.15, '#FED7AA'], [0.45, '#FB923C'], [0.75, '#EA580C'], [1, '#7C2D12']];
        Plotly.react(bulbRef.current, [
          {
            type: 'contour', x: bulbCache.x, y: bulbCache.y, z: bulbCache.z,
            colorscale: scale, zmin: 0, zmax: 1,
            contours: { start: 0.1, end: 0.9, size: 0.1, coloring: 'fill', showlines: true },
            line: { color: dark ? 'rgba(255,255,255,0.25)' : 'rgba(15,26,46,0.25)', width: 0.5 },
            colorbar: {
              title: { text: 'σz / p', font: { size: 10 } }, thickness: 10, len: 0.85,
              tickfont: { size: 9, color: c.fg }, outlinewidth: 0,
            },
            hovertemplate: 'r/a %{x:.2f} · z/a %{y:.2f}<br>σz/p = %{z:.2f}<extra></extra>',
          },
        ], baseLayout(theme, {
          margin: { l: 58, r: 8, t: 18, b: 44 },
          xaxis: { title: { text: 'Offset r / a', font: { size: 11 } }, gridcolor: c.grid, zerolinecolor: c.grid, range: [-3, 3] },
          yaxis: { title: { text: 'Depth z / a', font: { size: 11 } }, autorange: 'reversed' as const, gridcolor: c.grid, zerolinecolor: c.grid },
          shapes: [
            // the loaded area, drawn as a bar sitting on the surface
            { type: 'rect', x0: -1, x1: 1, y0: 0, y1: -0.14, fillcolor: c.ink, line: { width: 0 } },
            // depth probe
            { type: 'line', x0: -3, x1: 3, y0: probeClamped, y1: probeClamped, line: { color: c.violet, width: 1.5, dash: 'dot' } },
          ],
          annotations: [{
            x: 0, y: -0.3, text: 'p', showarrow: false, font: { size: 11, color: c.ink },
          }],
          showlegend: false,
        }), plotConfig);
      }
    })();
    return () => { cancelled = true; };
  }, [prof, theme, probeClamped, a]);

  // Key values
  const w0 = valid ? (2 * (1 - nu * nu) * p * a) / (E * 1000) : 0;
  const keyRows = useMemo(() => {
    if (!valid) return [];
    const ratios = [0, 0.5, 1, 1.5, 2, 3, 4];
    return ratios.filter(r => r <= zRatio).map(r => {
      const zi = r * a;
      const v = responseAt(zi, p, a, E * 1000, nu);
      return { r, zi, sz: v.sz, sr: v.sr, ez: v.ez, er: v.er, wi: v.w };
    });
  }, [p, a, E, nu, zRatio, valid]);

  const applyPreset = (pr: typeof PRESETS[number]) => {
    setP(pr.p); setA(pr.a); setE(pr.E); setNu(pr.nu);
  };
  const isPresetActive = (pr: typeof PRESETS[number]) =>
    pStr === pr.p && aStr === pr.a && eStr === pr.E && nuStr === pr.nu;

  return (
    <div className="cee-tool">
      <aside className="cee-panel">
        <h2 className="cee-panel__title">Inputs</h2>

        <div className="cee-presets">
          {PRESETS.map(pr => (
            <button
              key={pr.label} type="button"
              className={`cee-chip${isPresetActive(pr) ? ' cee-chip--active' : ''}`}
              title={pr.tip}
              onClick={() => applyPreset(pr)}
            >{pr.label}</button>
          ))}
        </div>

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
          One-layer elastic half-space, flexible circular load, on-axis response —
          Huang (2004) Eqs. 2.1–2.6. Compression positive. For layered systems use
          the HW3 charts or WinJULEA; this is the limiting check.
        </p>
      </aside>

      <div className="cee-results">
        <details className="cee-howto">
          <summary>How to use this tool</summary>
          <div className="cee-howto__body">
            <ol>
              <li><strong>Set the load</strong>: pressure <code>p</code> and radius <code>a</code> (a = √(P/πp)) — or pick a preset.</li>
              <li><strong>Set the material</strong>: one modulus and Poisson ratio — a homogeneous half-space.</li>
              <li><strong>Drag the depth probe</strong> to read every response at one depth; hover any curve for exact values.</li>
              <li><strong>Check hand solutions</strong>: the table gives the classic z/a ratios; σz/p = 0.646 at z = a and w₀ = 2(1−ν²)pa/E are the two results every solution should reproduce.</li>
            </ol>
            The pressure bulb shows σz/p over the whole r–z plane — where two wheels sit close together, their bulbs overlap and stresses superpose (the HW1 axle question, visualized). A stiff top layer cuts the subgrade stress well below the one-layer curve; that reduction is what the HW3 charts and WinJULEA quantify.
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

            <div className="cee-probe">
              <div className="cee-probe__head">
                <span className="cee-probe__title">Depth probe</span>
                <span className="cee-probe__loc">z = {fmt(probeClamped * a, 0)} mm · z/a = {probeClamped.toFixed(2)}</span>
              </div>
              <input
                className="cee-slider" type="range" min="0" max={zRatio} step="0.05"
                value={probeClamped}
                aria-label="Probe depth in multiples of the contact radius"
                onChange={e => setProbe(parseFloat(e.target.value))}
              />
              {atProbe && (
                <div className="cee-probe__vals">
                  <span>σz <strong>{fmt(atProbe.sz, 1)}</strong> kPa</span>
                  <span>σz/p <strong>{fmt(atProbe.sz / p, 3)}</strong></span>
                  <span>σr <strong>{fmt(atProbe.sr, 1)}</strong> kPa</span>
                  <span>εz <strong>{fmt(atProbe.ez, 0)}</strong> µε</span>
                  <span>εr <strong>{fmt(atProbe.er, 0)}</strong> µε</span>
                  <span>w <strong>{fmt(atProbe.w, 3)}</strong> mm</span>
                </div>
              )}
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

            <div className="cee-chart-grid cee-chart-grid--2">
              <div className="cee-chart">
                <h3 className="cee-chart__title">Pressure bulb — σz / p (normalized, any load)</h3>
                <div ref={bulbRef} />
              </div>
              <div className="cee-chart">
                <h3 className="cee-chart__title">Deflection vs. depth</h3>
                <div ref={deflRef} />
              </div>
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
