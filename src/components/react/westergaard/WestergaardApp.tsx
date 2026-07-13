// Westergaard Slab Stress — closed-form stresses and deflections for a
// concrete slab on a liquid (Winkler) foundation: interior, edge (circular
// load), and corner cases (Huang 2004, Eqs. 4.11–4.19, Ioannides et al.
// forms), plus Bradbury curling stresses with the analytic coefficient
// behind Bradbury's chart. US customary units, as in Huang Ch. 4.
import { useEffect, useMemo, useRef, useState } from 'react';
import Tip from '../Tip';
import { useTheme, chartColors, baseLayout, plotConfig, num, fmt } from '../chartTheme';
import '../tools.css';

/** Radius of relative stiffness, in. */
const ellOf = (E: number, h: number, nu: number, k: number) =>
  Math.pow((E * h ** 3) / (12 * (1 - nu * nu) * k), 0.25);

/** Westergaard's equivalent radius b for interior bending stress. */
const bOf = (a: number, h: number) =>
  a >= 1.724 * h ? a : Math.sqrt(1.6 * a * a + h * h) - 0.675 * h;

function slabResponses(E: number, h: number, nu: number, k: number, P: number, a: number) {
  const ell = ellOf(E, h, nu, k);
  const b = bOf(a, h);
  const c = 1.772 * a; // corner: side of the equivalent contact per Huang Eq. 4.11

  const sigI = ((3 * (1 + nu) * P) / (2 * Math.PI * h * h)) * (Math.log(ell / b) + 0.6159);
  const defI = (P / (8 * k * ell * ell)) *
    (1 + (1 / (2 * Math.PI)) * (Math.log(a / (2 * ell)) - 0.673) * (a / ell) ** 2);

  const sigE = ((3 * (1 + nu) * P) / (Math.PI * (3 + nu) * h * h)) *
    (Math.log((E * h ** 3) / (100 * k * a ** 4)) + 1.84 - (4 * nu) / 3 + (1 - nu) / 2 + 1.18 * (1 + 2 * nu) * (a / ell));
  const defE = ((Math.sqrt(2 + 1.2 * nu) * P) / Math.sqrt(E * h ** 3 * k)) *
    (1 - (0.76 + 0.4 * nu) * (a / ell));

  const sigC = ((3 * P) / (h * h)) * (1 - Math.pow(c / ell, 0.72));
  const defC = (P / (k * ell * ell)) * (1.205 - 0.69 * (c / ell));

  return { ell, b, c, sigI, defI, sigE, defE, sigC, defC };
}

/** Bradbury curling coefficient — the analytic form behind Bradbury's chart. */
function bradburyC(Lratio: number) {
  const lam = Lratio / Math.sqrt(8);
  if (lam < 1e-6) return 0;
  return 1 - (2 * Math.cos(lam) * Math.cosh(lam) * (Math.tan(lam) + Math.tanh(lam))) /
    (Math.sin(2 * lam) + Math.sinh(2 * lam));
}

export default function WestergaardApp() {
  const [eStr, setE] = useState('4000000');
  const [hStr, setH] = useState('10');
  const [nuStr, setNu] = useState('0.15');
  const [kStr, setK] = useState('100');
  const [pStr, setP] = useState('10000');
  const [aStr, setA] = useState('6');
  const [mrStr, setMr] = useState('650');
  // Curling
  const [lxStr, setLx] = useState('180');
  const [lyStr, setLy] = useState('144');
  const [alphaStr, setAlpha] = useState('5e-6');
  const [dtStr, setDt] = useState('20');

  const E = num(eStr, 4e6);
  const h = num(hStr, 10);
  const nu = Math.min(0.3, Math.max(0.1, num(nuStr, 0.15)));
  const k = num(kStr, 100);
  const P = num(pStr, 10000);
  const a = num(aStr, 6);
  const MR = num(mrStr, 650);
  const Lx = num(lxStr, 180);
  const Ly = num(lyStr, 144);
  const alpha = num(alphaStr, 5e-6);
  const dt = num(dtStr, 20);

  const valid = E > 0 && h > 0 && k > 0 && P > 0 && a > 0;

  const res = useMemo(() => (valid ? slabResponses(E, h, nu, k, P, a) : null), [E, h, nu, k, P, a, valid]);

  const curl = useMemo(() => {
    if (!res || !(alpha > 0)) return null;
    const Cx = bradburyC(Lx / res.ell);
    const Cy = bradburyC(Ly / res.ell);
    const sigInterior = ((E * alpha * dt) / 2) * ((Cx + nu * Cy) / (1 - nu * nu));
    const sigEdge = (Cx * E * alpha * dt) / 2;
    return { Cx, Cy, sigInterior, sigEdge };
  }, [res, E, nu, alpha, dt, Lx, Ly]);

  const theme = useTheme();
  const sensRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!res) return;
    let cancelled = false;
    (async () => {
      const Plotly = (await import('plotly.js-dist-min')).default;
      if (cancelled) return;
      const c = chartColors(theme);

      if (sensRef.current) {
        const hs: number[] = [], si: number[] = [], se: number[] = [], sc: number[] = [];
        for (let hh = 6; hh <= 14.01; hh += 0.25) {
          const r = slabResponses(E, hh, nu, k, P, a);
          hs.push(hh); si.push(r.sigI); se.push(r.sigE); sc.push(r.sigC);
        }
        Plotly.react(sensRef.current, [
          { x: hs, y: se, name: 'Edge', mode: 'lines', line: { color: c.orange, width: 2.5 } },
          { x: hs, y: sc, name: 'Corner', mode: 'lines', line: { color: c.sky, width: 2.5 } },
          { x: hs, y: si, name: 'Interior', mode: 'lines', line: { color: c.green, width: 2.5 } },
          {
            x: [h, h, h], y: [res.sigE, res.sigC, res.sigI], name: 'Current h',
            mode: 'markers', marker: { color: [c.orange, c.sky, c.green], size: 9, symbol: 'diamond', line: { color: c.ink, width: 1 } },
            hoverinfo: 'skip', showlegend: false,
          },
        ], baseLayout(theme, {
          xaxis: { title: { text: 'Slab thickness h (in)', font: { size: 11 } }, gridcolor: c.grid, zerolinecolor: c.grid },
          yaxis: { title: { text: 'Load stress (psi)', font: { size: 11 } }, gridcolor: c.grid, zerolinecolor: c.grid, rangemode: 'tozero' as const },
          hovermode: 'x unified' as const,
          shapes: MR > 0 ? [{ type: 'line', xref: 'paper', x0: 0, x1: 1, y0: MR, y1: MR, line: { color: c.fg, width: 1, dash: 'dash' } }] : [],
          annotations: MR > 0 ? [{ xref: 'paper', x: 0.99, y: MR, text: `MR ${MR} psi`, showarrow: false, yshift: 8, font: { size: 9.5, color: c.fg }, xanchor: 'right' as const }] : [],
        }), plotConfig);
      }

      if (barRef.current) {
        const cases = ['Edge', 'Corner', 'Interior'];
        const vals = [res.sigE, res.sigC, res.sigI];
        Plotly.react(barRef.current, [{
          x: vals, y: cases, type: 'bar', orientation: 'h',
          marker: { color: [c.orange, c.sky, c.green] },
          text: vals.map(v => `${v.toFixed(0)} psi`), textposition: 'outside',
          textfont: { size: 10.5, color: c.fg }, cliponaxis: false,
          hovertemplate: '%{y}: %{x:.1f} psi<extra></extra>',
        }], baseLayout(theme, {
          height: 300,
          margin: { l: 70, r: 60, t: 8, b: 44 },
          xaxis: { title: { text: 'Bending stress (psi)', font: { size: 11 } }, gridcolor: c.grid, zerolinecolor: c.grid, rangemode: 'tozero' as const },
          yaxis: { gridcolor: 'rgba(0,0,0,0)', autorange: 'reversed' as const },
          showlegend: false,
          shapes: MR > 0 ? [{ type: 'line', x0: MR, x1: MR, yref: 'paper', y0: 0, y1: 1, line: { color: c.fg, width: 1, dash: 'dash' } }] : [],
        }), plotConfig);
      }
    })();
    return () => { cancelled = true; };
  }, [res, theme, E, nu, k, P, a, h, MR]);

  return (
    <div className="cee-tool">
      <aside className="cee-panel">
        <h2 className="cee-panel__title">Inputs</h2>

        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="wg-e">
              <span>Concrete E<Tip text="Slab elastic modulus — typically 3–5 ×10⁶ psi." /></span>
              <span className="cee-field__unit">psi</span>
            </label>
            <input id="wg-e" className="cee-input" type="number" min="1" step="100000" value={eStr} onChange={e => setE(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="wg-nu">Poisson ν <span className="cee-field__unit">–</span></label>
            <input id="wg-nu" className="cee-input" type="number" min="0.1" max="0.3" step="0.05" value={nuStr} onChange={e => setNu(e.target.value)} />
          </div>
        </div>

        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="wg-h">Slab h <span className="cee-field__unit">in</span></label>
            <input id="wg-h" className="cee-input" type="number" min="4" max="20" step="0.5" value={hStr} onChange={e => setH(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="wg-k">
              <span>Subgrade k<Tip text="Modulus of subgrade reaction (liquid foundation), in pci = lb/in³. Typical 50–500 pci." /></span>
              <span className="cee-field__unit">pci</span>
            </label>
            <input id="wg-k" className="cee-input" type="number" min="10" step="25" value={kStr} onChange={e => setK(e.target.value)} />
          </div>
        </div>

        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="wg-p">Wheel load P <span className="cee-field__unit">lb</span></label>
            <input id="wg-p" className="cee-input" type="number" min="100" step="500" value={pStr} onChange={e => setP(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="wg-a">
              <span>Contact radius a<Tip text="Radius of the circular contact area. Corner and edge formulas assume the load is tangent to the slab boundary." /></span>
              <span className="cee-field__unit">in</span>
            </label>
            <input id="wg-a" className="cee-input" type="number" min="1" step="0.5" value={aStr} onChange={e => setA(e.target.value)} />
          </div>
        </div>

        <div className="cee-field">
          <label className="cee-field__label" htmlFor="wg-mr">
            <span>Modulus of rupture<Tip text="Concrete flexural strength for interpreting the stress ratio — typically 600–700 psi. Set 0 to hide the reference line." /></span>
            <span className="cee-field__unit">psi</span>
          </label>
          <input id="wg-mr" className="cee-input" type="number" min="0" step="25" value={mrStr} onChange={e => setMr(e.target.value)} />
        </div>

        <h2 className="cee-panel__title" style={{ marginTop: '1.25rem' }}>Curling</h2>

        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="wg-lx">
              <span>Slab L<sub>x</sub><Tip text="Slab length in the direction of the stress you want (joint spacing), in inches." /></span>
              <span className="cee-field__unit">in</span>
            </label>
            <input id="wg-lx" className="cee-input" type="number" min="12" step="12" value={lxStr} onChange={e => setLx(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="wg-ly">Slab L<sub>y</sub> <span className="cee-field__unit">in</span></label>
            <input id="wg-ly" className="cee-input" type="number" min="12" step="12" value={lyStr} onChange={e => setLy(e.target.value)} />
          </div>
        </div>

        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="wg-al">
              <span>Thermal αt<Tip text="Concrete coefficient of thermal expansion, ~5×10⁻⁶ per °F." /></span>
              <span className="cee-field__unit">/°F</span>
            </label>
            <input id="wg-al" className="cee-input" type="number" min="0" step="0.000001" value={alphaStr} onChange={e => setAlpha(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="wg-dt">
              <span>Gradient Δt<Tip text="Top minus bottom temperature. Positive (day) puts the interior bottom in tension." /></span>
              <span className="cee-field__unit">°F</span>
            </label>
            <input id="wg-dt" className="cee-input" type="number" step="1" value={dtStr} onChange={e => setDt(e.target.value)} />
          </div>
        </div>

        {res && a / res.ell > 0.5 && (
          <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>a/ℓ = {(a / res.ell).toFixed(2)} — the closed forms assume a small load relative to ℓ; treat results beyond a/ℓ ≈ 0.5 with caution.</span></p>
        )}

        <p className="cee-hint">
          Huang (2004) Eqs. 4.11–4.19 (Westergaard with the Ioannides et al.
          corrections; circular edge load). Liquid foundation, single slab, load
          tangent to edge/corner. US customary units throughout.
        </p>
      </aside>

      <div className="cee-results">
        <details className="cee-howto">
          <summary>How to use this tool</summary>
          <div className="cee-howto__body">
            <ol>
              <li><strong>Describe slab and foundation</strong>: E, ν, h, and the subgrade reaction k — ℓ is computed first, every formula consumes it.</li>
              <li><strong>Set the load</strong>: P and contact radius a. The tool evaluates all three Westergaard cases at once.</li>
              <li><strong>Check the critical fibre</strong>: interior and edge stresses are bottom tension; the corner stress is <em>top</em> tension.</li>
              <li><strong>Add curling</strong>: Δt &gt; 0 is daytime (bottom tension at interior — adds to load stress); night reverses the sign.</li>
            </ol>
            The h-sensitivity chart shows why edge loading governs rigid design — compare each curve against the modulus of rupture line.
          </div>
        </details>

        {!res ? (
          <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>Enter positive E, h, k, P, and a to see results.</span></p>
        ) : (
          <>
            <div className="cee-keys">
              <div className="cee-key">
                <div className="cee-key__label">RADIUS OF REL. STIFFNESS ℓ</div>
                <div className="cee-key__value">{fmt(res.ell, 2)}<small>in</small></div>
              </div>
              <div className="cee-key cee-key--accent">
                <div className="cee-key__label">EDGE STRESS (CRITICAL)</div>
                <div className="cee-key__value">{fmt(res.sigE, 1)}<small>psi</small></div>
              </div>
              <div className="cee-key">
                <div className="cee-key__label">STRESS RATIO σ_EDGE / MR</div>
                <div className="cee-key__value">{MR > 0 ? fmt(res.sigE / MR, 2) : '—'}</div>
              </div>
              <div className="cee-key">
                <div className="cee-key__label">CORNER DEFLECTION</div>
                <div className="cee-key__value">{fmt(res.defC, 4)}<small>in</small></div>
              </div>
            </div>

            <div className="cee-tablewrap">
              <table className="cee-table">
                <thead>
                  <tr>
                    <th>Case</th>
                    <th>Tension fibre</th>
                    <th>σ load (psi)</th>
                    <th>Δ (in)</th>
                    <th>σ curl (psi)</th>
                    <th>σ load + curl</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Interior</td>
                    <td>bottom</td>
                    <td>{fmt(res.sigI, 1)}</td>
                    <td>{fmt(res.defI, 4)}</td>
                    <td>{curl ? fmt(curl.sigInterior, 1) : '—'}</td>
                    <td>{curl ? fmt(res.sigI + curl.sigInterior, 1) : '—'}</td>
                  </tr>
                  <tr>
                    <td>Edge</td>
                    <td>bottom</td>
                    <td>{fmt(res.sigE, 1)}</td>
                    <td>{fmt(res.defE, 4)}</td>
                    <td>{curl ? fmt(curl.sigEdge, 1) : '—'}</td>
                    <td>{curl ? fmt(res.sigE + curl.sigEdge, 1) : '—'}</td>
                  </tr>
                  <tr>
                    <td>Corner</td>
                    <td><strong>top</strong></td>
                    <td>{fmt(res.sigC, 1)}</td>
                    <td>{fmt(res.defC, 4)}</td>
                    <td>—</td>
                    <td>—</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {curl && (
              <p className="cee-note">
                Curling: ℓ = {fmt(res.ell, 1)} in → L<sub>x</sub>/ℓ = {fmt(Lx / res.ell, 2)}, C<sub>x</sub> = {curl.Cx.toFixed(3)};
                L<sub>y</sub>/ℓ = {fmt(Ly / res.ell, 2)}, C<sub>y</sub> = {curl.Cy.toFixed(3)} (analytic Bradbury coefficients —
                compare with the chart). Interior combines both directions with ν; the edge form is C·Eα∆t/2. Corner curling
                stress is negligible and customarily taken as zero. Superpose signs carefully: day curling <em>adds</em> to
                interior/edge load stress, night curling subtracts.
              </p>
            )}

            <div className="cee-chart-grid cee-chart-grid--2">
              <div className="cee-chart">
                <h3 className="cee-chart__title">Load stress vs. slab thickness</h3>
                <div ref={sensRef} />
              </div>
              <div className="cee-chart">
                <h3 className="cee-chart__title">Load stress by case — h = {h} in</h3>
                <div ref={barRef} />
              </div>
            </div>

            <p className="cee-note">
              Sanity anchor (Huang Ch. 4 examples): E = 4×10⁶ psi, ν = 0.15, h = 10 in, k = 100 pci,
              P = 10,000 lb, a = 6 in → ℓ ≈ 42.97 in, σ_corner ≈ 190 psi, Δ_corner ≈ 0.0560 in,
              σ_interior ≈ 144 psi, σ_edge(circle) ≈ 279 psi.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
