// Resilient Modulus Fitter — fits the generalized (MEPDG) resilient modulus
// model Mr = k1·pa·(θ/pa)^k2·(τoct/pa + 1)^k3 to repeated-load triaxial data
// by multiple linear regression in log space (the same math as Excel LINEST).
// Supports HW2. Triaxial conventions: θ = σd + 3σ3, τoct = √2·σd/3.
import { useEffect, useMemo, useRef, useState } from 'react';
import Tip from '../Tip';
import {
  useTheme, chartColors, baseLayout, plotConfig, num,
  axis, gridAxis, HUE_ORDER, HUES,
} from '../chartTheme';
import ChartFigure from '../ui/ChartFigure';
import KpiStrip, { Kpi } from '../ui/KpiStrip';
import '../tools.css';

type Units = 'kPa' | 'psi';
type ValueMode = 'strain' | 'mr';
const PA: Record<Units, number> = { kPa: 101.325, psi: 14.696 };

interface DataRow {
  id: number;
  s3: string; // confining stress
  sd: string; // deviator stress
  v: string;  // recoverable strain (–) or Mr, per mode
}

let nextId = 100;

/** Least-squares fit of y = b0 + b1·x1 + b2·x2 via the 3×3 normal equations. */
function ols2(x1: number[], x2: number[], y: number[]) {
  const n = y.length;
  let s1 = 0, s2 = 0, sy = 0, s11 = 0, s22 = 0, s12 = 0, s1y = 0, s2y = 0;
  for (let i = 0; i < n; i++) {
    s1 += x1[i]; s2 += x2[i]; sy += y[i];
    s11 += x1[i] * x1[i]; s22 += x2[i] * x2[i]; s12 += x1[i] * x2[i];
    s1y += x1[i] * y[i]; s2y += x2[i] * y[i];
  }
  // Solve [[n,s1,s2],[s1,s11,s12],[s2,s12,s22]] · b = [sy,s1y,s2y]
  const A = [
    [n, s1, s2, sy],
    [s1, s11, s12, s1y],
    [s2, s12, s22, s2y],
  ];
  for (let col = 0; col < 3; col++) {
    let piv = col;
    for (let r = col + 1; r < 3; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    if (Math.abs(A[piv][col]) < 1e-12) return null;
    [A[col], A[piv]] = [A[piv], A[col]];
    for (let r = 0; r < 3; r++) {
      if (r === col) continue;
      const f = A[r][col] / A[col][col];
      for (let cc = col; cc < 4; cc++) A[r][cc] -= f * A[col][cc];
    }
  }
  const b = [A[0][3] / A[0][0], A[1][3] / A[1][1], A[2][3] / A[2][2]];
  // R² in log space
  const yBar = sy / n;
  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < n; i++) {
    const yh = b[0] + b[1] * x1[i] + b[2] * x2[i];
    ssTot += (y[i] - yBar) ** 2;
    ssRes += (y[i] - yh) ** 2;
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : NaN;
  // Predictor collinearity (single-σ3 datasets make x1, x2 nearly collinear)
  const v1 = s11 / n - (s1 / n) ** 2;
  const v2 = s22 / n - (s2 / n) ** 2;
  const cov = s12 / n - (s1 / n) * (s2 / n);
  const corr = v1 > 0 && v2 > 0 ? cov / Math.sqrt(v1 * v2) : 1;
  return { b, r2, corr };
}

const HW2_ROWS: Omit<DataRow, 'id'>[] = [
  // public/homeworks/hw2/hw2-part1-data.xlsx — one confining stress, psi
  { s3: '31.94', sd: '2', v: '0.000141' },
  { s3: '31.94', sd: '4', v: '0.00032' },
  { s3: '31.94', sd: '7', v: '0.000761' },
  { s3: '31.94', sd: '14', v: '0.00189' },
  { s3: '31.94', sd: '20', v: '0.003032' },
  { s3: '31.94', sd: '28', v: '0.005181' },
];

// A full T307-style matrix (kPa), for exploring a well-conditioned fit.
const DEMO_ROWS: Omit<DataRow, 'id'>[] = (() => {
  const rows: Omit<DataRow, 'id'>[] = [];
  const k1 = 900, k2 = 0.55, k3 = -0.35, pa = PA.kPa;
  const jitter = [1.03, 0.97, 1.02, 0.98, 1.01, 0.99, 1.04, 0.96, 1.0, 1.02, 0.98, 1.01, 0.99, 1.03, 0.97];
  let j = 0;
  for (const s3 of [20.7, 41.4, 68.9]) {
    for (const sd of [20.7, 41.4, 68.9, 103.4, 137.9]) {
      const theta = sd + 3 * s3;
      const toct = (Math.SQRT2 / 3) * sd;
      const mr = k1 * pa * Math.pow(theta / pa, k2) * Math.pow(toct / pa + 1, k3) * jitter[j++];
      rows.push({ s3: s3.toFixed(1), sd: sd.toFixed(1), v: (sd / mr).toExponential(3) });
    }
  }
  return rows;
})();

export default function MrFitterApp() {
  const [units, setUnits] = useState<Units>('psi');
  const [mode, setMode] = useState<ValueMode>('strain');
  const [rows, setRows] = useState<DataRow[]>(HW2_ROWS.map(r => ({ ...r, id: nextId++ })));
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const pa = PA[units];

  const points = useMemo(() => {
    return rows
      .map(r => {
        const s3 = num(r.s3, NaN), sd = num(r.sd, NaN), v = num(r.v, NaN);
        if (!(s3 >= 0) || !(sd > 0) || !(v > 0)) return null;
        const mr = mode === 'strain' ? sd / v : v;
        if (!(mr > 0)) return null;
        const theta = sd + 3 * s3;
        const toct = (Math.SQRT2 / 3) * sd;
        return { id: r.id, s3, sd, theta, toct, mr };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);
  }, [rows, mode]);

  const fit = useMemo(() => {
    if (points.length < 4) return null;
    const x1 = points.map(p => Math.log10(p.theta / pa));
    const x2 = points.map(p => Math.log10(p.toct / pa + 1));
    const y = points.map(p => Math.log10(p.mr));
    const res = ols2(x1, x2, y);
    if (!res) return null;
    const k1 = Math.pow(10, res.b[0]) / pa;
    const k2 = res.b[1];
    const k3 = res.b[2];
    const predict = (theta: number, toct: number) =>
      k1 * pa * Math.pow(theta / pa, k2) * Math.pow(toct / pa + 1, k3);
    const withPred = points.map(p => ({ ...p, pred: predict(p.theta, p.toct) }));
    // R² on back-transformed Mr
    const mBar = points.reduce((s, p) => s + p.mr, 0) / points.length;
    let ssT = 0, ssR = 0;
    for (const p of withPred) {
      ssT += (p.mr - mBar) ** 2;
      ssR += (p.mr - p.pred) ** 2;
    }
    return { k1, k2, k3, r2log: res.r2, r2: ssT > 0 ? 1 - ssR / ssT : NaN, corr: res.corr, predict, withPred };
  }, [points, pa]);

  const theme = useTheme();
  /** Distinct confining stresses, ascending — one series per group, and the
   *  legend must list them in this same fixed order (§B4). */
  const sigma3Groups = useMemo(
    () => [...new Set(points.map(p => p.s3))].sort((a, b) => a - b),
    [points]
  );
  const parityRef = useRef<HTMLDivElement>(null);
  const curvesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!fit) return;
    let cancelled = false;
    (async () => {
      const Plotly = (await import('plotly.js-dist-min')).default;
      if (cancelled) return;
      const c = chartColors(theme);
      // Confining-stress groups are unordered series: fixed hue order (§B4).
      const seriesColors = HUE_ORDER.map(h => HUES[theme][h]);

      if (parityRef.current) {
        const lo = Math.min(...fit.withPred.map(p => Math.min(p.mr, p.pred))) * 0.85;
        const hi = Math.max(...fit.withPred.map(p => Math.max(p.mr, p.pred))) * 1.15;
        Plotly.react(parityRef.current, [
          {
            x: [lo, hi], y: [lo, hi], name: '1:1 line', mode: 'lines',
            line: { color: c.secondary, width: 1, dash: 'dot' }, hoverinfo: 'skip',
          },
          {
            x: fit.withPred.map(p => p.mr), y: fit.withPred.map(p => p.pred),
            name: 'Test points', mode: 'markers',
            marker: { color: HUES[theme].orange, size: 8.5, line: { color: c.surface, width: 2 } },
            hovertemplate: `measured %{x:,.0f} · predicted %{y:,.0f} ${units}<extra></extra>`,
          },
        ], baseLayout(theme, {
          xaxis: axis(theme, `Measured Mr (${units})`, { type: 'log' }),
          yaxis: gridAxis(theme, `Predicted Mr (${units})`, { type: 'log' }),
          hovermode: 'closest',
          showlegend: false,
        }), plotConfig);
      }

      if (curvesRef.current) {
        const groups = [...new Set(points.map(p => p.s3))].sort((a, b) => a - b);
        const traces: any[] = [];
        groups.forEach((s3, gi) => {
          const color = seriesColors[gi % seriesColors.length];
          const pts = points.filter(p => p.s3 === s3);
          const sdMax = Math.max(...pts.map(p => p.sd)) * 1.2;
          const xs: number[] = [], ys: number[] = [];
          for (let i = 0; i <= 40; i++) {
            const sd = (i / 40) * sdMax + 1e-6;
            const theta = sd + 3 * s3;
            xs.push(theta);
            ys.push(fit.predict(theta, (Math.SQRT2 / 3) * sd));
          }
          traces.push({
            x: xs, y: ys, name: `σ₃ = ${s3} (fit)`, mode: 'lines',
            line: { color, width: 2 }, legendgroup: `g${gi}`, showlegend: false, hoverinfo: 'skip',
          });
          traces.push({
            x: pts.map(p => p.theta), y: pts.map(p => p.mr),
            name: `σ₃ = ${s3} ${units}`, mode: 'markers', legendgroup: `g${gi}`,
            marker: { color, size: 8.5, line: { color: c.surface, width: 2 } },
            hovertemplate: `θ %{x:.1f} · Mr %{y:,.0f} ${units}<extra>σ₃ = ${s3}</extra>`,
          });
        });
        Plotly.react(curvesRef.current, traces, baseLayout(theme, {
          xaxis: axis(theme, `Bulk stress θ (${units})`),
          yaxis: gridAxis(theme, `Mr (${units})`, { rangemode: 'tozero' as const }),
          hovermode: 'closest',
          showlegend: false,
        }), plotConfig);
      }
    })();
    return () => { cancelled = true; };
  }, [fit, points, theme, units]);

  const updateRow = (id: number, patch: Partial<DataRow>) =>
    setRows(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)));

  const loadPaste = () => {
    const parsed: DataRow[] = [];
    for (const line of pasteText.split(/\r?\n/)) {
      const cells = line.trim().split(/[\t,;]+|\s{1,}/).filter(Boolean);
      if (cells.length < 3) continue;
      const nums = cells.slice(0, 3).map(x => parseFloat(x));
      if (nums.some(x => !Number.isFinite(x))) continue;
      parsed.push({ id: nextId++, s3: cells[0], sd: cells[1], v: cells[2] });
    }
    if (parsed.length) {
      setRows(parsed);
      setPasteOpen(false);
      setPasteText('');
    }
  };

  const collinear = fit != null && Math.abs(fit.corr) > 0.985;
  const singleS3 = new Set(points.map(p => p.s3)).size === 1 && points.length > 0;

  return (
    <div className="cee-tool">
      <aside className="cee-panel">
        <h2 className="cee-panel__title">Test data</h2>

        <div className="cee-seg" role="group" aria-label="Units">
          <button type="button" className={units === 'psi' ? 'is-active' : ''} onClick={() => setUnits('psi')}>psi</button>
          <button type="button" className={units === 'kPa' ? 'is-active' : ''} onClick={() => setUnits('kPa')}>kPa</button>
        </div>
        <div className="cee-seg" role="group" aria-label="Third column meaning" style={{ marginLeft: '0.5rem' }}>
          <button type="button" className={mode === 'strain' ? 'is-active' : ''} onClick={() => setMode('strain')}>εr (–)</button>
          <button type="button" className={mode === 'mr' ? 'is-active' : ''} onClick={() => setMode('mr')}>Mr</button>
        </div>

        <div className="cee-presets">
          <button type="button" className="cee-chip" title="The HW2 dataset (single confining stress, psi, recoverable strains)."
            onClick={() => { setUnits('psi'); setMode('strain'); setRows(HW2_ROWS.map(r => ({ ...r, id: nextId++ }))); }}>HW2 data</button>
          <button type="button" className="cee-chip" title="A full 3×5 T307-style matrix (kPa) — see what a well-conditioned fit looks like."
            onClick={() => { setUnits('kPa'); setMode('strain'); setRows(DEMO_ROWS.map(r => ({ ...r, id: nextId++ }))); }}>T307 matrix demo</button>
          <button type="button" className="cee-chip" onClick={() => setPasteOpen(o => !o)}>Paste from Excel…</button>
        </div>

        {pasteOpen && (
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="mr-paste">
              <span>3 columns: σ₃, σd, {mode === 'strain' ? 'εr' : 'Mr'}<Tip text="Copy the three columns straight from Excel (tab-separated) — one test point per line. Replaces the current table." /></span>
            </label>
            <textarea id="mr-paste" className="cee-textarea" value={pasteText}
              placeholder={'31.94\t2\t0.000141\n31.94\t4\t0.00032'}
              onChange={e => setPasteText(e.target.value)} />
            <button className="cee-btn cee-btn--primary cee-btn--sm" type="button" onClick={loadPaste} style={{ marginTop: '0.4rem' }}>
              Load {pasteText.split(/\r?\n/).filter(l => l.trim()).length} lines
            </button>
          </div>
        )}

        <div className="cee-field">
          <span className="cee-field__label">
            <span>Points <Tip text="σ₃ = confining stress, σd = deviator stress, both in the selected units. θ and τoct are computed for you." /></span>
            <span className="cee-field__unit">σ₃ · σd · {mode === 'strain' ? 'εr' : `Mr (${units})`}</span>
          </span>
          {rows.map(r => (
            <div className="cee-axle-row cee-axle-row--data" key={r.id}>
              <input className="cee-input" type="number" min="0" step="1" value={r.s3} aria-label="Confining stress"
                onChange={e => updateRow(r.id, { s3: e.target.value })} />
              <input className="cee-input" type="number" min="0" step="1" value={r.sd} aria-label="Deviator stress"
                onChange={e => updateRow(r.id, { sd: e.target.value })} />
              <input className="cee-input" type="number" min="0" step="any" value={r.v} aria-label={mode === 'strain' ? 'Recoverable strain' : 'Resilient modulus'}
                onChange={e => updateRow(r.id, { v: e.target.value })} />
              <button className="cee-axle-remove" type="button" aria-label="Remove point"
                onClick={() => setRows(rs => rs.filter(x => x.id !== r.id))}>×</button>
            </div>
          ))}
          <button className="cee-btn cee-btn--ghost cee-btn--sm" type="button"
            onClick={() => setRows(rs => [...rs, { id: nextId++, s3: '20', sd: '40', v: mode === 'strain' ? '0.001' : '40000' }])}>
            + Add point
          </button>
        </div>

        <p className="cee-hint">
          Triaxial conventions: θ = σd + 3σ₃, τ_oct = √2 σd/3, Mr = σd/εr with the
          <em> recoverable</em> strain. p_a = {pa} {units}. Fit is ordinary least squares
          on log₁₀ Mr — identical to Excel LINEST on the linearized model.
        </p>
      </aside>

      <div className="cee-results">
        <details className="cee-howto">
          <summary>How to use this tool</summary>
          <div className="cee-howto__body">
            <ol>
              <li><strong>Pick units and what your third column is</strong> — recoverable strain εr (the tool computes Mr = σd/εr) or Mr directly.</li>
              <li><strong>Enter the data</strong>: type points, or paste the three columns straight from Excel.</li>
              <li><strong>Read the fit</strong>: k₁, k₂, k₃ and R² update live; the parity plot shows every point against the 1:1 line.</li>
              <li><strong>Check the physics</strong>: expect k₂ ≥ 0 (stress hardening with θ) and k₃ ≤ 0 (softening with shear).</li>
            </ol>
            R² is reported both in log space (what the regression optimizes — quote this one with LINEST) and on back-transformed Mr.
          </div>
        </details>

        {points.length < 4 ? (
          <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>Enter at least 4 valid test points (σ₃ ≥ 0, σd &gt; 0, {mode === 'strain' ? 'εr' : 'Mr'} &gt; 0) to fit the three-parameter model.</span></p>
        ) : !fit ? (
          <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>The regression is singular — the points don’t span enough stress states to separate k₂ and k₃.</span></p>
        ) : (
          <>
            {(collinear || singleS3) && (
              <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>
                All points share one confining stress, so θ and τ_oct move together
                (predictor correlation {fit.corr.toFixed(3)}). The fit still reproduces the data,
                but k₂ and k₃ individually are not reliable — a full test matrix varies σ₃. This is
                worth a sentence in your report.
              </span></p>
            )}
            {(fit.k2 < 0 || fit.k3 > 0) && (
              <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>
                Unusual sign: expected k₂ ≥ 0 and k₃ ≤ 0. Check units and whether the strain column is recoverable strain.
              </span></p>
            )}

            <KpiStrip>
              <Kpi
                label="k₁"
                value={fit.k1 >= 10 ? fit.k1.toFixed(1) : fit.k1 >= 0.01 ? fit.k1.toFixed(4) : fit.k1.toExponential(3)}
                tip="Dimensionless stiffness scale: at θ = pa and zero shear, Mr = k₁·pa. Typical soils: a few hundred to a few thousand."
              />
              <Kpi
                label="k₂"
                value={fit.k2.toFixed(4)}
                tip="Stress-hardening exponent on bulk stress θ — confinement stiffens the soil, so expect k₂ ≥ 0 (strongly positive for granular materials)."
              />
              <Kpi
                label="k₃"
                value={fit.k3.toFixed(4)}
                tip="Shear-softening exponent on τ_oct — shearing weakens the soil, so expect k₃ ≤ 0 (most negative for fine-grained soils)."
              />
              <Kpi
                accent
                label="R² (log space)"
                value={fit.r2log.toFixed(4)}
                tip="Goodness of fit of the linearized regression — this is the R² Excel LINEST reports, so quote this one when comparing."
              />
              <Kpi
                label="R² (on Mr)"
                value={fit.r2.toFixed(4)}
                tip="R² recomputed on back-transformed Mr values — usually close to the log-space value, but not identical; say which you report."
              />
            </KpiStrip>

            <div className="cee-chart-grid cee-chart-grid--2">
              <ChartFigure
                title="Measured vs. predicted Mr"
                subtitle="Each test point against the fitted model, log axes"
                plotRef={parityRef}
                legend={[
                  { label: 'Test points', color: HUES[theme].orange },
                  { label: '1:1 line', color: chartColors(theme).secondary, shape: 'dash' },
                ]}
                takeaway={`The fit reproduces the measured moduli with an R² of ${fit.r2log.toFixed(3)} in log space; scatter about the 1:1 line is the residual.`}
              >
                Every test point, measured against what the fitted model predicts for its stress state
                (log axes). A perfect model puts all points on the dashed <strong>1:1 line</strong>;
                vertical distance from it is the residual in the table. This is the plot HW2 asks for.
              </ChartFigure>
              <ChartFigure
                title="Mr vs. bulk stress θ — fitted model by σ₃"
                subtitle="The fitted surface sliced at each confining stress in the data set"
                plotRef={curvesRef}
                legend={sigma3Groups.map((s3, gi) => ({
                  label: `σ₃ = ${s3} ${units}`,
                  color: HUES[theme][HUE_ORDER[gi % HUE_ORDER.length]],
                }))}
                takeaway={
                  fit.k2 + fit.k3 >= 0
                    ? 'Modulus rises with bulk stress, so stress hardening dominates — granular behaviour.'
                    : 'Modulus falls as bulk stress rises, so shear softening dominates — fine-grained behaviour.'
                }
              >
                The fitted surface sliced at each confining stress: along one curve, rising θ comes with
                rising deviator stress, so the shape mixes hardening (k₂) and softening (k₃). Curves
                rising with θ ⇒ hardening dominates (granular behavior); falling ⇒ shear softening
                dominates (fine-grained behavior).
              </ChartFigure>
            </div>

            <div className="cee-tablewrap">
              <table className="cee-table">
                <thead>
                  <tr>
                    <th>σ₃ ({units})</th>
                    <th>σd ({units})</th>
                    <th>θ ({units})</th>
                    <th>τoct ({units})</th>
                    <th>Mr meas.</th>
                    <th>Mr pred.</th>
                    <th>Resid.</th>
                  </tr>
                </thead>
                <tbody>
                  {fit.withPred.map(p => (
                    <tr key={p.id}>
                      <td>{p.s3}</td>
                      <td>{p.sd}</td>
                      <td>{p.theta.toFixed(1)}</td>
                      <td>{p.toct.toFixed(2)}</td>
                      <td>{p.mr.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                      <td>{p.pred.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                      <td>{(((p.pred - p.mr) / p.mr) * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="cee-note">
              Model: Mr = k₁ p_a (θ/p_a)<sup>k₂</sup> (τ_oct/p_a + 1)<sup>k₃</sup> — MEPDG / NCHRP 1-28A
              form (Huang Ch. 7). The “+1” keeps the model defined at zero shear; don’t drop it.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
