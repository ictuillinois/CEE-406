// Westergaard Slab Stress — closed-form stresses and deflections for a
// concrete slab on a liquid (Winkler) foundation. Every published case in
// Huang (2004) Ch. 4: interior, edge under BOTH circular and semicircular
// contact, and corner by BOTH the original and the Ioannides formulas — which
// disagree, and are shown side by side for that reason. Plus Bradbury curling
// and the dual-tire equivalent circle. US customary units, as in Huang Ch. 4.
//
// The physics lives in equations.ts and is pinned to the printed answers of
// Examples 4.1-4.5 by equations.test.mjs.
import { useEffect, useMemo, useRef, useState } from 'react';
import Tip from '../Tip';
import {
  useTheme, chartColors, baseLayout, plotConfig, num, fmt,
  axis, gridAxis, HUES, type Mode,
} from '../chartTheme';
import ChartFigure from '../ui/ChartFigure';
import Card from '../ui/Card';
import KpiStrip, { Kpi } from '../ui/KpiStrip';
import {
  slabResponses, curlingStresses, dualEquivalentRadius, radiusOfRelativeStiffness,
} from './equations.ts';
import '../tools.css';

/** The three Westergaard load positions are unordered categories, so they
 *  take categorical hues 1-2-3 and keep them across both charts (§B4). */
const CASE_HUE = {
  edge: (t: Mode) => HUES[t].orange,
  corner: (t: Mode) => HUES[t].blue,
  interior: (t: Mode) => HUES[t].emerald,
};

export default function WestergaardApp() {
  const [eStr, setE] = useState('4000000');
  const [hStr, setH] = useState('10');
  const [nuStr, setNu] = useState('0.15');
  const [kStr, setK] = useState('100');
  const [pStr, setP] = useState('10000');
  const [aStr, setA] = useState('6');
  const [mrStr, setMr] = useState('650');
  // Dual tires → equivalent circle (Eq. 4.31)
  const [useDuals, setUseDuals] = useState(false);
  const [sdStr, setSd] = useState('14');
  const [qStr, setQ] = useState('88.42');
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

  // Effective contact radius: either entered directly, or derived from a set
  // of duals via Huang Eq. 4.31. For a rigid slab the equivalent circle spans
  // the gap between the tires, so it is always larger than a single imprint.
  const aEff = useMemo(() => {
    if (!useDuals) return a;
    const q = num(qStr, 0), Pd = P / 2, Sd = num(sdStr, 0);
    if (!(q > 0 && Sd > 0 && Pd > 0)) return a;
    return dualEquivalentRadius(Pd, q, Sd);
  }, [useDuals, a, qStr, sdStr, P]);

  const res = useMemo(
    () => (valid ? slabResponses(E, h, nu, k, P, aEff) : null),
    [E, h, nu, k, P, aEff, valid]
  );

  const curl = useMemo(() => {
    if (!res || !(alpha > 0)) return null;
    return curlingStresses(E, nu, res.ell, Lx, Ly, alpha, dt);
  }, [res, E, nu, alpha, dt, Lx, Ly]);

  const theme = useTheme();
  const sensRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!res) return;
    let canceled = false;
    (async () => {
      const Plotly = (await import('plotly.js-dist-min')).default;
      if (canceled) return;
      const c = chartColors(theme);

      if (sensRef.current) {
        const hs: number[] = [], si: number[] = [], se: number[] = [], sc: number[] = [];
        for (let hh = 6; hh <= 14.01; hh += 0.25) {
          const r = slabResponses(E, hh, nu, k, P, aEff);
          if (!r) continue;
          hs.push(hh);
          si.push(r.interior.stress);
          se.push(r.edge.semicircle.stress);   // the governing edge case
          sc.push(r.corner.ioannides.stress);
        }
        Plotly.react(sensRef.current, [
          { x: hs, y: se, name: 'Edge (semicircle)', mode: 'lines', line: { color: CASE_HUE.edge(theme), width: 2.5 } },
          { x: hs, y: sc, name: 'Corner', mode: 'lines', line: { color: CASE_HUE.corner(theme), width: 2.5 } },
          { x: hs, y: si, name: 'Interior', mode: 'lines', line: { color: CASE_HUE.interior(theme), width: 2.5 } },
          {
            x: [h, h, h],
            y: [res.edge.semicircle.stress, res.corner.ioannides.stress, res.interior.stress],
            name: 'Current h',
            mode: 'markers',
            marker: {
              color: [CASE_HUE.edge(theme), CASE_HUE.corner(theme), CASE_HUE.interior(theme)],
              size: 9, symbol: 'circle', line: { color: c.surface, width: 2 },
            },
            hoverinfo: 'skip', showlegend: false,
          },
        ], baseLayout(theme, {
          xaxis: axis(theme, 'Slab thickness h (in)'),
          yaxis: gridAxis(theme, 'Load stress (psi)', { rangemode: 'tozero' as const }),
          hovermode: 'x unified' as const,
          showlegend: false,
          shapes: MR > 0 ? [{ type: 'line', xref: 'paper', x0: 0, x1: 1, y0: MR, y1: MR, line: { color: c.secondary, width: 1, dash: 'dash' } }] : [],
          annotations: MR > 0 ? [{ xref: 'paper', x: 0.99, y: MR, text: `MR ${MR} psi`, showarrow: false, yshift: 9, font: { size: 10, color: c.fg }, xanchor: 'right' as const }] : [],
        }), plotConfig);
      }

      if (barRef.current) {
        // §A8.2 target-vs-actual: a ghost bar to the modulus of rupture sits
        // behind each case, so the chart reads as the fraction of the
        // concrete's strength that loading consumes.
        // Every published case, so the two disagreements are visible rather
        // than resolved for the student behind the scenes.
        const cases = [
          'Edge · semicircle', 'Edge · circle',
          'Corner · Ioannides', 'Corner · original',
          'Interior',
        ];
        const vals = [
          res.edge.semicircle.stress, res.edge.circle.stress,
          res.corner.ioannides.stress, res.corner.original.stress,
          res.interior.stress,
        ];
        const hues = [
          CASE_HUE.edge(theme), CASE_HUE.edge(theme),
          CASE_HUE.corner(theme), CASE_HUE.corner(theme),
          CASE_HUE.interior(theme),
        ];
        const xMax = Math.max(MR, ...vals) * 1.15;
        Plotly.react(barRef.current, [
          ...(MR > 0 ? [{
            x: cases.map(() => MR), y: cases, type: 'bar' as const, orientation: 'h' as const,
            marker: { color: c.ghost, cornerradius: 6 },
            hoverinfo: 'skip' as const, name: 'Modulus of rupture',
          }] : []),
          {
            x: vals, y: cases, type: 'bar' as const, orientation: 'h' as const,
            marker: { color: hues, cornerradius: 6 },
            text: vals.map(v => `${v.toFixed(0)} psi`), textposition: 'outside' as const,
            textfont: { family: 'IBM Plex Mono, monospace', size: 11.5, color: c.secondary },
            cliponaxis: false, name: 'Bending stress',
            hovertemplate: '%{y}: %{x:.1f} psi<extra></extra>',
          },
        ], baseLayout(theme, {
          height: 340,
          margin: { l: 128, r: 64, t: 8, b: 40 },
          barmode: 'overlay' as const,
          bargap: 0.4,
          xaxis: axis(theme, 'Bending stress (psi)', { range: [0, xMax] }),
          yaxis: axis(theme, undefined, { autorange: 'reversed' as const }),
          showlegend: false,
        }), plotConfig);
      }
    })();
    return () => { canceled = true; };
  }, [res, theme, E, nu, k, P, aEff, h, MR]);

  return (
    <div className="cee-tool">
      <aside className="cee-panel">
        <h2 className="cee-panel__title">Inputs</h2>

        <div className="cee-presets">
          <button type="button" className="cee-chip"
            title="Huang Examples 4.2-4.4, pp. 155-158: k=100 pci, h=10 in, a=6 in, P=10,000 lb. Should give interior 143.7, edge 279.4 (circle) / 330.0 (semicircle), corner 186.6 (original) / 190.3 (Ioannides) psi."
            onClick={() => {
              setE('4000000'); setH('10'); setNu('0.15'); setK('100');
              setP('10000'); setA('6'); setUseDuals(false);
            }}>Huang Ex. 4.2–4.4</button>
          <button type="button" className="cee-chip"
            title="Huang Example 4.5, p. 159: the same 10,000 lb carried on duals at 14 in spacing, 88.42 psi contact pressure. The equivalent circle is 7.85 in, and every stress falls."
            onClick={() => {
              setE('4000000'); setH('10'); setNu('0.15'); setK('100');
              setP('10000'); setUseDuals(true); setSd('14'); setQ('88.42');
            }}>Huang Ex. 4.5 (duals)</button>
          <button type="button" className="cee-chip"
            title="Huang Example 4.1, p. 151: a 25 ft x 12 ft x 8 in slab on k=200 pci with a 20 F differential. Curling should give about 238 psi interior and 214 psi at the edge."
            onClick={() => {
              setE('4000000'); setH('8'); setNu('0.15'); setK('200');
              setLx('300'); setLy('144'); setAlpha('5e-6'); setDt('20');
            }}>Huang Ex. 4.1 (curling)</button>
        </div>

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

        <label className="cee-field__label" style={{ marginTop: '0.25rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input type="checkbox" checked={useDuals} onChange={e => setUseDuals(e.target.checked)} />
            Load is on dual tires
            <Tip text="For a rigid slab the equivalent circle covers both tire imprints AND the gap between them, because the slab spreads load across the gap (Huang Eq. 4.31). Using the tire contact area alone would overstate every stress." />
          </span>
        </label>

        {useDuals && (
          <div className="cee-row">
            <div className="cee-field">
              <label className="cee-field__label" htmlFor="wg-sd">
                <span>Dual spacing S<sub>d</sub></span>
                <span className="cee-field__unit">in</span>
              </label>
              <input id="wg-sd" className="cee-input" type="number" min="1" step="0.5" value={sdStr}
                onChange={e => setSd(e.target.value)} />
            </div>
            <div className="cee-field">
              <label className="cee-field__label" htmlFor="wg-q">
                <span>Contact pressure q</span>
                <span className="cee-field__unit">psi</span>
              </label>
              <input id="wg-q" className="cee-input" type="number" min="1" step="1" value={qStr}
                onChange={e => setQ(e.target.value)} />
            </div>
          </div>
        )}

        {useDuals && (
          <p className="cee-hint">
            Equivalent circle radius a = {fmt(aEff, 2)} in (Eq. 4.31), against {fmt(a, 2)} in entered above.
          </p>
        )}

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
              <li><strong>Check the critical fiber</strong>: interior and edge stresses are bottom tension; the corner stress is <em>top</em> tension.</li>
              <li><strong>Add curling</strong>: Δt &gt; 0 is daytime (bottom tension at interior — adds to load stress); night reverses the sign.</li>
            </ol>
            The h-sensitivity chart shows why edge loading governs rigid design — compare each curve against the modulus of rupture line.
          </div>
        </details>

        {!res ? (
          <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>Enter positive E, h, k, P, and a to see results.</span></p>
        ) : (
          <>
            <KpiStrip>
              <Kpi
                label="Radius of rel. stiffness ℓ"
                value={fmt(res.ell, 2)}
                unit="in"
                tip="The slab's natural length scale: how far it spreads a load into the foundation. Stiff slab / soft subgrade → large ℓ. Every Westergaard formula and both curling ratios consume it — compute it first."
              />
              <Kpi
                accent
                label="Governing stress"
                value={fmt(res.governing.stress, 1)}
                unit="psi"
                tip="The largest bending stress across every published case. Edge loading normally governs slab thickness because highway wheels track close to the edge — and the semicircular contact, whose centroid sits nearest the edge, is the worst of them."
              />
              <Kpi
                label="Governing case"
                compact
                value={res.governing.case}
                tip="Which load position and contact shape produced the number to its left."
              />
              <Kpi
                label="Stress ratio σ / MR"
                value={MR > 0 ? fmt(res.governing.stress / MR, 2) : '—'}
                tip="Governing bending stress over the concrete's flexural strength. PCA-style design keeps this well below 1 — at 0.5 and below, fatigue life is essentially unlimited."
              />
              <Kpi
                label="Corner deflection"
                value={fmt(res.corner.ioannides.deflection, 4)}
                unit="in"
                tip="The largest deflection of any case — repeated corner deflections pump water and fines from under the joint, which is how corner support is lost."
              />
            </KpiStrip>

            <div className="cee-diagram" aria-label="Plan view of the slab with the three Westergaard load positions">
              <svg viewBox="0 0 340 172" role="img">
                {(() => {
                  const cc = chartColors(theme);
                  const ink = cc.ink;
                  const mut = cc.fg;
                  const line = cc.hairline;
                  const cOr = CASE_HUE.edge(theme);
                  const cSk = CASE_HUE.corner(theme);
                  const cGr = CASE_HUE.interior(theme);
                  return (
                    <>
                      <rect x="20" y="26" width="300" height="120" rx="3" fill="none" stroke={ink} strokeWidth="1.5" />
                      <text x="24" y="18" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill={mut}>PLAN VIEW — one slab (joints at the boundary)</text>
                      {/* interior */}
                      <circle cx="170" cy="86" r="10" fill={cGr} opacity="0.9" />
                      <text x="170" y="110" textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill={ink}>Interior</text>
                      <text x="170" y="121" textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="8" fill={mut}>tension: bottom</text>
                      {/* edge */}
                      <circle cx="86" cy="36" r="10" fill={cOr} opacity="0.9" />
                      <text x="86" y="60" textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill={ink}>Edge</text>
                      <text x="86" y="71" textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="8" fill={mut}>tension: bottom</text>
                      {/* corner */}
                      <circle cx="308" cy="134" r="10" fill={cSk} opacity="0.9" />
                      <text x="288" y="128" textAnchor="end" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill={ink}>Corner</text>
                      <text x="288" y="139" textAnchor="end" fontFamily="IBM Plex Mono, monospace" fontSize="8" fill={mut}>tension: top</text>
                      {/* ℓ scale bar */}
                      <line x1="20" y1="158" x2={20 + Math.min(140, res.ell * 2)} y2="158" stroke={line} strokeWidth="2" />
                      <line x1="20" y1="154" x2="20" y2="162" stroke={mut} strokeWidth="1" />
                      <line x1={20 + Math.min(140, res.ell * 2)} y1="154" x2={20 + Math.min(140, res.ell * 2)} y2="162" stroke={mut} strokeWidth="1" />
                      <text x={26 + Math.min(140, res.ell * 2)} y="161" fontFamily="IBM Plex Mono, monospace" fontSize="9" fill={mut}>ℓ = {fmt(res.ell, 1)} in</text>
                    </>
                  );
                })()}
              </svg>
              <p className="cee-chart__caption" style={{ padding: '0.375rem 0 0' }}>
                The three Westergaard cases, colored to match the charts below. Each formula assumes the
                load circle is tangent to the boundary it names. The corner is the odd one out: its maximum
                stress is on the <strong>top</strong> of the slab, a distance ~2.38ℓ from the corner — which
                is why corner cracks break downward and why checking bottom tension there is the classic error.
              </p>
            </div>

            <div className="cee-tablewrap">
              <table className="cee-table">
                <thead>
                  <tr>
                    <th>Case</th>
                    <th>Tension fiber</th>
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
                    <td>{fmt(res.interior.stress, 1)}</td>
                    <td>{fmt(res.interior.deflection, 4)}</td>
                    <td>{curl ? fmt(curl.interiorX, 1) : '—'}</td>
                    <td>{curl ? fmt(res.interior.stress + curl.interiorX, 1) : '—'}</td>
                  </tr>
                  <tr>
                    <td>Edge · semicircle <span className="cee-field__unit">Eq. 4.23</span></td>
                    <td>bottom</td>
                    <td><strong>{fmt(res.edge.semicircle.stress, 1)}</strong></td>
                    <td>{fmt(res.edge.semicircle.deflection, 4)}</td>
                    <td>{curl ? fmt(curl.edgeX, 1) : '—'}</td>
                    <td>{curl ? fmt(res.edge.semicircle.stress + curl.edgeX, 1) : '—'}</td>
                  </tr>
                  <tr>
                    <td>Edge · circle <span className="cee-field__unit">Eq. 4.22</span></td>
                    <td>bottom</td>
                    <td>{fmt(res.edge.circle.stress, 1)}</td>
                    <td>{fmt(res.edge.circle.deflection, 4)}</td>
                    <td>{curl ? fmt(curl.edgeX, 1) : '—'}</td>
                    <td>{curl ? fmt(res.edge.circle.stress + curl.edgeX, 1) : '—'}</td>
                  </tr>
                  <tr>
                    <td>Corner · Ioannides <span className="cee-field__unit">Eq. 4.15</span></td>
                    <td><strong>top</strong></td>
                    <td>{fmt(res.corner.ioannides.stress, 1)}</td>
                    <td>{fmt(res.corner.ioannides.deflection, 4)}</td>
                    <td>—</td>
                    <td>—</td>
                  </tr>
                  <tr>
                    <td>Corner · original <span className="cee-field__unit">Eq. 4.13</span></td>
                    <td><strong>top</strong></td>
                    <td>{fmt(res.corner.original.stress, 1)}</td>
                    <td>{fmt(res.corner.original.deflection, 4)}</td>
                    <td>—</td>
                    <td>—</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <Card title="Two questions the literature answers twice"
              subtitle="Both pairs are published, both are defensible, and they do not agree">
              <div className="cee-tablewrap">
                <table className="cee-table">
                  <thead>
                    <tr><th>Question</th><th>Answer A</th><th>Answer B</th><th>Spread</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Edge contact shape</td>
                      <td>circle — {fmt(res.edge.circle.stress, 1)} psi</td>
                      <td>semicircle — {fmt(res.edge.semicircle.stress, 1)} psi</td>
                      <td>{fmt(100 * (res.edge.semicircle.stress / res.edge.circle.stress - 1), 0)}%</td>
                    </tr>
                    <tr>
                      <td>Corner formulation</td>
                      <td>original — {fmt(res.corner.original.stress, 1)} psi</td>
                      <td>Ioannides — {fmt(res.corner.ioannides.stress, 1)} psi</td>
                      <td>{fmt(100 * (res.corner.ioannides.stress / res.corner.original.stress - 1), 0)}%</td>
                    </tr>
                    <tr>
                      <td>Corner deflection</td>
                      <td>original — {fmt(res.corner.original.deflection, 4)} in</td>
                      <td>Ioannides — {fmt(res.corner.ioannides.deflection, 4)} in</td>
                      <td>{fmt(100 * (res.corner.ioannides.deflection / res.corner.original.deflection - 1), 0)}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="cee-note" style={{ marginTop: '0.75rem' }}>
                A wheel at a slab edge is closer to a <strong>semicircle</strong> than a circle — its
                straight side lies along the edge, so its centroid sits nearer to it and the stress
                comes out higher. That makes the semicircle the realistic and the conservative
                choice, and it is the one this tool treats as governing. The corner pair is a
                different kind of disagreement: the original formulas measure to the load center
                along the diagonal, the Ioannides forms replace the circle with an equivalent square
                of side 1.772a. Neither is wrong. <strong>Say which you used.</strong>
              </p>
            </Card>

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
              <ChartFigure
                title="Load stress vs. slab thickness"
                subtitle="Each case swept over h with every other input fixed; dots mark your current h"
                plotRef={sensRef}
                legend={[
                  { label: 'Edge · semicircle', color: CASE_HUE.edge(theme) },
                  { label: 'Corner · Ioannides', color: CASE_HUE.corner(theme) },
                  { label: 'Interior', color: CASE_HUE.interior(theme) },
                  ...(MR > 0 ? [{ label: 'Modulus of rupture', color: chartColors(theme).secondary, shape: 'dash' as const }] : []),
                ]}
                takeaway="Bending stress falls roughly as one over thickness squared, so a half-inch of slab buys more capacity than any other single change."
              >
                Each curve sweeps h with everything else fixed (dots = your current h). Stress falls
                roughly as <strong>1/h²</strong> — the leverage of thickness in rigid design. Where a
                curve crosses the dashed modulus-of-rupture line is the thickness at which one pass of
                this load would crack the slab; design keeps the working point far below it.
              </ChartFigure>
              <ChartFigure
                title={`Load stress by case — h = ${h} in`}
                subtitle="Colored bar is the bending stress; the pale bar behind it is the modulus of rupture"
                plotRef={barRef}
                legend={[
                  { label: 'Bending stress', color: CASE_HUE.edge(theme) },
                  ...(MR > 0 ? [{ label: 'Modulus of rupture', color: chartColors(theme).ghost }] : []),
                ]}
                takeaway="Edge loading produces the highest bending stress of the three positions, which is why it governs slab thickness design."
              >
                The same load in the three positions, each read against the concrete's strength. Edge &gt;
                corner &gt; interior in bending stress — the more slab surrounds the load, the more paths
                the moment has to spread. Deflections rank the other way (corner largest):
                <strong> stress cracks slabs, deflection pumps joints.</strong>
              </ChartFigure>
            </div>

            <p className="cee-note">
              <strong>Calibrate before you trust it.</strong> The first preset above loads Huang
              Examples 4.2–4.4: E = 4×10⁶ psi, ν = 0.15, h = 10 in, k = 100 pci, P = 10,000 lb,
              a = 6 in. It should return ℓ = 42.97 in, σ<sub>interior</sub> = 143.7 psi,
              σ<sub>edge</sub> = 279.4 psi (circle) and 330.0 psi (semicircle),
              σ<sub>corner</sub> = 186.6 psi (original) and 190.3 psi (Ioannides), with
              Δ<sub>corner</sub> = 0.0502 and 0.0560 in. The other two presets load Example 4.5
              (duals → a = 7.85 in) and Example 4.1 (curling → about 238 psi interior, 214 psi edge).
              If any of those disagree with your copy of the book, stop and find out why before
              using the tool on your own slab.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
