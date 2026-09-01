// Serviceability & Skid Resistance — where the empirical tradition comes from.
//
// The PSI equation is what let a panel of people riding in cars be replaced
// by a profilometer, and therefore what made the AASHO Road Test — and every
// design equation descended from it — possible. It is also a multiple
// regression on 74 sections, which is worth remembering every time a design
// hangs on a terminal serviceability of 2.5 rather than 2.4.
//
// The centerpiece is Problem 9.2: fit the equation yourself to five sections
// and watch the rut coefficient come out 27x the published value with an R²
// above 0.98. That is the most honest introduction to regression a pavement
// course can offer.
//
// Physics in equations.ts, pinned to Eqs. 9.14, 9.15 and Problems 9.2, 9.4.
import { useEffect, useMemo, useRef, useState } from 'react';
import Tip from '../Tip';
import {
  useTheme, chartColors, baseLayout, plotConfig, num, fmt,
  axis, gridAxis, hueFor, HUES, type Mode,
} from '../chartTheme';
import ChartFigure from '../ui/ChartFigure';
import Card from '../ui/Card';
import KpiStrip, { Kpi } from '../ui/KpiStrip';
import {
  psiFlexible, psiRigid, fitPsi, psiFromFit, meanTextureDepth,
  pngFromTexture, sn0FromMeasurement, skidNumber, skidAtSpeed,
  type PsiObservation,
} from './equations.ts';
import '../tools.css';

const SERIES = {
  published: (t: Mode) => HUES[t].orange,
  fitted: (t: Mode) => HUES[t].violet,
  skid: (t: Mode) => HUES[t].emerald,
};

interface Row { id: number; sv: string; rd: string; cp: string; psr: string }
let nextId = 100;

/** Huang Table P9.2 — the five sections of Problem 9.2. */
const P92: Omit<Row, 'id'>[] = [
  { sv: '2.8', rd: '0.06', cp: '0', psr: '4.3' },
  { sv: '5.8', rd: '0.10', cp: '1', psr: '3.8' },
  { sv: '10.9', rd: '0.11', cp: '13', psr: '3.2' },
  { sv: '16.8', rd: '0.16', cp: '23', psr: '2.4' },
  { sv: '56.0', rd: '0.19', cp: '31', psr: '1.1' },
];

export default function PsiApp() {
  const [rows, setRows] = useState<Row[]>(P92.map(r => ({ ...r, id: nextId++ })));
  const [rigid, setRigid] = useState(false);

  // The section whose PSI is reported at the top.
  const [svStr, setSv] = useState('25');
  const [rdStr, setRd] = useState('0.25');
  const [cpStr, setCp] = useState('40');

  // Skid resistance
  const [snStr, setSn] = useState('40');
  const [vStr, setV] = useState('40');
  const [volStr, setVol] = useState('2');
  const [diaStr, setDia] = useState('10');

  const sv = num(svStr, 0), rd = num(rdStr, 0), cp = num(cpStr, 0);

  const psiPublished = rigid ? psiRigid(sv, cp) : psiFlexible(sv, rd, cp);

  const obs = useMemo<PsiObservation[]>(
    () => rows
      .map(r => ({ sv: num(r.sv, NaN), rd: num(r.rd, NaN), cp: num(r.cp, NaN), psr: num(r.psr, NaN) }))
      .filter(o => [o.sv, o.rd, o.cp, o.psr].every(Number.isFinite)),
    [rows]
  );

  const fit = useMemo(() => fitPsi(obs, !rigid), [obs, rigid]);
  const psiFitted = fit ? psiFromFit(fit, sv, rd, cp) : null;

  /* ── Skid ── */
  const mtd = useMemo(() => meanTextureDepth(num(volStr, 2), num(diaStr, 10)), [volStr, diaStr]);
  const png = useMemo(() => pngFromTexture(mtd), [mtd]);
  const sn0 = useMemo(
    () => (Number.isFinite(png) ? sn0FromMeasurement(num(snStr, 40), png, num(vStr, 40)) : NaN),
    [png, snStr, vStr]
  );

  const theme = useTheme();
  const fitRef = useRef<HTMLDivElement>(null);
  const skidRef = useRef<HTMLDivElement>(null);

  /* ── Panel rating against fitted PSI ── */
  useEffect(() => {
    if (!fitRef.current || !fit || obs.length < 2) return;
    let canceled = false;
    (async () => {
      const Plotly = (await import('plotly.js-dist-min')).default;
      if (canceled || !fitRef.current) return;
      const c = chartColors(theme);
      const lo = Math.min(...obs.map(o => o.psr), ...fit.predicted) - 0.3;
      const hi = Math.max(...obs.map(o => o.psr), ...fit.predicted) + 0.3;
      Plotly.react(fitRef.current, [
        {
          x: obs.map(o => o.psr), y: fit.predicted,
          mode: 'markers', name: 'Your fit',
          marker: { color: SERIES.fitted(theme), size: 11, line: { color: c.surface, width: 2 } },
          hovertemplate: 'panel %{x:.2f} → fitted %{y:.2f}<extra></extra>',
        },
        {
          x: obs.map(o => o.psr),
          y: obs.map(o => (rigid ? psiRigid(o.sv, o.cp) : psiFlexible(o.sv, o.rd, o.cp))),
          mode: 'markers', name: 'AASHO equation',
          marker: { color: SERIES.published(theme), size: 9, symbol: 'diamond', line: { color: c.surface, width: 1.5 } },
          hovertemplate: 'panel %{x:.2f} → AASHO %{y:.2f}<extra></extra>',
        },
        {
          x: [lo, hi], y: [lo, hi], mode: 'lines', name: '1:1',
          line: { color: c.secondary, width: 1, dash: 'dash' },
          hoverinfo: 'skip',
        },
      ], baseLayout(theme, {
        height: 320,
        xaxis: axis(theme, 'Panel rating PSR', { range: [lo, hi] }),
        yaxis: gridAxis(theme, 'Predicted PSI', { range: [lo, hi] }),
        hovermode: 'closest',
      }), plotConfig);
    })();
    return () => { canceled = true; };
  }, [fit, obs, rigid, theme]);

  /* ── Skid number against speed ── */
  useEffect(() => {
    if (!skidRef.current || !Number.isFinite(sn0) || !Number.isFinite(png)) return;
    let canceled = false;
    (async () => {
      const Plotly = (await import('plotly.js-dist-min')).default;
      if (canceled || !skidRef.current) return;
      const c = chartColors(theme);
      const vs = Array.from({ length: 61 }, (_, i) => i * 1.5);
      Plotly.react(skidRef.current, [
        {
          x: vs, y: vs.map(V => skidNumber(sn0, png, V)),
          mode: 'lines', line: { color: SERIES.skid(theme), width: 2.5 },
          hovertemplate: '%{x:.0f} mph → SN %{y:.1f}<extra></extra>',
        },
        {
          x: [num(vStr, 40)], y: [num(snStr, 40)], mode: 'markers',
          marker: { color: SERIES.skid(theme), size: 11, line: { color: c.surface, width: 2 } },
          hovertemplate: 'measured: %{x:.0f} mph, SN %{y:.1f}<extra></extra>',
        },
      ], baseLayout(theme, {
        height: 300,
        xaxis: axis(theme, 'Speed (mph)'),
        yaxis: gridAxis(theme, 'Skid number SN', { rangemode: 'tozero' as const }),
        hovermode: 'closest',
        shapes: [{
          type: 'line', xref: 'paper', x0: 0, x1: 1, y0: 30, y1: 30,
          line: { color: c.secondary, width: 1, dash: 'dash' },
        }],
        annotations: [{
          xref: 'paper', x: 0.99, y: 30, text: 'SN 30 — a common minimum',
          showarrow: false, yshift: 9, xanchor: 'right' as const,
          font: { size: 10, color: c.fg },
        }],
      }), plotConfig);
    })();
    return () => { canceled = true; };
  }, [sn0, png, snStr, vStr, theme]);

  const update = (id: number, patch: Partial<Row>) =>
    setRows(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)));

  const ratio = fit && !rigid ? Math.abs(fit.a2 / -1.38) : null;

  return (
    <div className="cee-tool">
      <aside className="cee-panel">
        <h2 className="cee-panel__title">Section</h2>

        <div className="cee-presets">
          <button type="button" className="cee-chip"
            title="Huang Problem 9.2, p. 439: five flexible sections with panel ratings. Fitting them should give PSI = 5.51 − 1.70 log(1+SV) − 38.09 RD² − 0.004 √(C+P)."
            onClick={() => { setRows(P92.map(r => ({ ...r, id: nextId++ }))); setRigid(false); }}>
            Huang Prob. 9.2</button>
        </div>

        <label className="cee-field__label">
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input type="checkbox" checked={rigid} onChange={e => setRigid(e.target.checked)} />
            Rigid pavement
            <Tip text="Eq. 9.15 drops the rut depth term: concrete does not rut, so the transverse profile carries nothing the longitudinal one does not already have." />
          </span>
        </label>

        <div className="cee-field" style={{ marginTop: '0.75rem' }}>
          <label className="cee-field__label" htmlFor="p-sv">
            <span>Slope variance SV<Tip text="Variance of the pavement slope sampled at 1 ft intervals over a 9 in base length, averaged over both wheelpaths, in units of 10⁻⁶ as the Road Test reported it." /></span>
            <span className="cee-field__unit">×10⁻⁶</span>
          </label>
          <input id="p-sv" className="cee-input" type="number" step="1" value={svStr}
            onChange={e => setSv(e.target.value)} />
        </div>

        {!rigid && (
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="p-rd">
              <span>Mean rut depth RD</span><span className="cee-field__unit">in</span>
            </label>
            <input id="p-rd" className="cee-input" type="number" step="0.05" value={rdStr}
              onChange={e => setRd(e.target.value)} />
          </div>
        )}

        <div className="cee-field">
          <label className="cee-field__label" htmlFor="p-cp">
            <span>Cracking + patching<Tip text="Cracking in linear feet plus patching in square feet, both per 1000 ft² of pavement — combined into one variable because the Road Test could not separate their effects." /></span>
            <span className="cee-field__unit">per 1000 ft²</span>
          </label>
          <input id="p-cp" className="cee-input" type="number" step="5" value={cpStr}
            onChange={e => setCp(e.target.value)} />
        </div>

        <h2 className="cee-panel__title" style={{ marginTop: '1.5rem' }}>Rating panel data</h2>
        <p className="cee-hint" style={{ marginTop: '-0.35rem' }}>
          Sections with both measurements and a panel rating. Four are the minimum for the flexible
          equation, three for the rigid one.
        </p>

        <div className="cee-field">
          <span className="cee-field__label">
            <span>SV · RD · C+P · PSR</span>
          </span>
          {rows.map(r => (
            <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '0.25rem', marginBottom: '0.3rem' }}>
              <input className="cee-input" type="number" step="0.1" value={r.sv}
                aria-label="Slope variance" onChange={e => update(r.id, { sv: e.target.value })} />
              <input className="cee-input" type="number" step="0.01" value={r.rd}
                aria-label="Rut depth" onChange={e => update(r.id, { rd: e.target.value })} />
              <input className="cee-input" type="number" step="1" value={r.cp}
                aria-label="Cracking plus patching" onChange={e => update(r.id, { cp: e.target.value })} />
              <input className="cee-input" type="number" step="0.1" value={r.psr}
                aria-label="Panel rating" onChange={e => update(r.id, { psr: e.target.value })} />
              <button className="cee-axle-remove" type="button" aria-label="Remove section"
                onClick={() => setRows(rs => rs.filter(x => x.id !== r.id))}>×</button>
            </div>
          ))}
          <button className="cee-btn cee-btn--ghost cee-btn--sm" type="button"
            onClick={() => setRows(rs => [...rs, { id: nextId++, sv: '20', rd: '0.15', cp: '15', psr: '3.0' }])}>
            + Add section</button>
        </div>

        <h2 className="cee-panel__title" style={{ marginTop: '1.5rem' }}>Skid resistance</h2>
        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="p-sn">
              <span>Measured SN</span>
            </label>
            <input id="p-sn" className="cee-input" type="number" step="1" value={snStr}
              onChange={e => setSn(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="p-v">
              <span>at speed</span><span className="cee-field__unit">mph</span>
            </label>
            <input id="p-v" className="cee-input" type="number" step="5" value={vStr}
              onChange={e => setV(e.target.value)} />
          </div>
        </div>
        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="p-vol">
              <span>Bead volume<Tip text="Volume of glass beads or sand spread on the surface in the patch test." /></span>
              <span className="cee-field__unit">in³</span>
            </label>
            <input id="p-vol" className="cee-input" type="number" step="0.5" value={volStr}
              onChange={e => setVol(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="p-dia">
              <span>Patch diameter</span><span className="cee-field__unit">in</span>
            </label>
            <input id="p-dia" className="cee-input" type="number" step="0.5" value={diaStr}
              onChange={e => setDia(e.target.value)} />
          </div>
        </div>
        <p className="cee-hint">
          MTD = {fmt(mtd, 4)} in · PNG = {fmt(png, 3)} h/mile · SN₀ = {fmt(sn0, 1)}.
        </p>
      </aside>

      <div className="cee-results">
        <details className="cee-howto">
          <summary>How to use this tool</summary>
          <div className="cee-howto__body">
            <ol>
              <li><strong>Calibrate.</strong> Load Huang Problem 9.2 and confirm the fit gives 5.51, −1.70, −38.09 and −0.004.</li>
              <li><strong>Compare your coefficients with AASHO's.</strong> They fitted 74 sections; you have five. Look at what happens to the rut term.</li>
              <li><strong>Then look at R².</strong> It will be excellent. Sit with the fact that an excellent fit and a meaningless coefficient are entirely compatible.</li>
              <li><strong>Read the skid curve as two separate properties.</strong> SN₀ is what the surface feels like at rest; PNG is how fast that falls away with speed. A road can be fine at 30 mph and dangerous at 60 with the same SN₀.</li>
            </ol>
            Every design equation in this course descends from a panel of people rating rides in
            1958. This is where the numbers came from.
          </div>
        </details>

        <KpiStrip>
          <Kpi accent label="PSI, AASHO equation" value={fmt(psiPublished, 2)}
            tip={rigid ? 'Huang Eq. 9.15, fitted to 49 rigid sections.' : 'Huang Eq. 9.14, fitted to 74 flexible sections.'} />
          <Kpi label="PSI, your fitted equation" value={psiFitted !== null ? fmt(psiFitted, 2) : '—'}
            tip="The same section run through the coefficients fitted from your rating-panel data on the left." />
          <Kpi label="Fit quality" value={fit ? fmt(100 * fit.r2, 1) : '—'} unit="% R²"
            tip="How well your fitted equation reproduces the panel ratings it was fitted to. Note that this says nothing about whether the coefficients are trustworthy." />
          <Kpi label="Sections fitted" value={obs.length}
            tip="AASHO used 74 flexible sections and 49 rigid ones." />
        </KpiStrip>

        {!fit ? (
          <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>
            Not enough complete sections to fit. The flexible equation has four unknowns and needs at
            least four sections; the rigid form needs three.
          </span></p>
        ) : (
          <>
            {ratio !== null && ratio > 5 && (
              <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>
                Your rut-depth coefficient is <strong>{fmt(fit.a2, 2)}</strong> against AASHO's
                <strong> −1.38</strong> — {fmt(ratio, 0)} times larger — while the fit reports
                R² = {fmt(100 * fit.r2, 1)}%. Both things are true at once. With only {obs.length} sections,
                rut depth barely varies and moves in step with slope variance, so the regression cannot
                tell their effects apart and assigns an enormous coefficient to a variable that is
                really just tracking roughness. <strong>An excellent fit is not evidence of a
                meaningful coefficient.</strong>
              </span></p>
            )}

            <Card title="Your coefficients against AASHO's"
              subtitle={rigid ? 'Eq. 9.15, fitted to 49 rigid sections' : 'Eq. 9.14, fitted to 74 flexible sections'}>
              <div className="cee-tablewrap">
                <table className="cee-table">
                  <thead>
                    <tr><th>Term</th><th>Your fit</th><th>AASHO</th><th>Ratio</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Intercept</td><td>{fmt(fit.a0, 3)}</td>
                      <td>{rigid ? '5.41' : '5.03'}</td>
                      <td>{fmt(fit.a0 / (rigid ? 5.41 : 5.03), 2)}×</td>
                    </tr>
                    <tr>
                      <td>log(1 + SV)</td><td>{fmt(fit.a1, 3)}</td>
                      <td>{rigid ? '−1.71' : '−1.91'}</td>
                      <td>{fmt(fit.a1 / (rigid ? -1.71 : -1.91), 2)}×</td>
                    </tr>
                    {!rigid && (
                      <tr>
                        <td>RD²</td><td><strong>{fmt(fit.a2, 2)}</strong></td>
                        <td>−1.38</td>
                        <td><strong>{fmt(fit.a2 / -1.38, 1)}×</strong></td>
                      </tr>
                    )}
                    <tr>
                      <td>√(C + P)</td><td>{fmt(fit.b1, 4)}</td>
                      <td>{rigid ? '−0.09' : '−0.01'}</td>
                      <td>{fmt(fit.b1 / (rigid ? -0.09 : -0.01), 2)}×</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="cee-note" style={{ marginTop: '0.75rem' }}>
                The intercept and the roughness term usually come out close, because slope variance
                spans a wide range in almost any sample and dominates the equation. The other two
                wander, because they do not. That pattern — <strong>the coefficient you can trust is
                the one attached to the variable that actually varied</strong> — is the whole of
                regression diagnostics in one table.
              </p>
            </Card>

            <ChartFigure
              title="Predicted against panel rating"
              subtitle="Your fitted equation and the published one, both against the ratings people actually gave"
              plotRef={fitRef}
              legend={[
                { label: 'Your fit', color: SERIES.fitted(theme) },
                { label: 'AASHO equation', color: SERIES.published(theme) },
                { label: '1:1', color: chartColors(theme).secondary, shape: 'dash' as const },
              ]}
              takeaway={`Your equation reproduces its own training data to ${fmt(fit.rms, 3)} RMS; the published one, fitted elsewhere, will not sit as close.`}
            >
              Your fitted points hug the 1:1 line because they were fitted to it. The AASHO points do
              not, and that is the correct behavior — those coefficients came from 74 different
              sections in three states. <strong>A model always looks best on the data that made
              it.</strong> The only honest test of a PSI equation is a section it has never seen,
              which is exactly what neither you nor Carey and Irick can offer from a single dataset.
            </ChartFigure>

            {Number.isFinite(sn0) && Number.isFinite(png) && (
              <ChartFigure
                title="Skid number against speed"
                subtitle={`From one measurement and a texture depth of ${fmt(mtd, 4)} in — Huang Eqs. 9.31–9.34`}
                plotRef={skidRef}
                takeaway={`SN falls from ${fmt(sn0, 0)} at rest to ${fmt(skidNumber(sn0, png, 60), 1)} at 60 mph.`}
              >
                Two independent properties set this curve. <strong>SN₀</strong> — the intercept — is
                microtexture: the fine grit of the aggregate, which is what grips at low speed and
                what polishing destroys. <strong>PNG</strong> — the slope — is macrotexture: the
                coarse channels that let water escape, which is what keeps the tire in contact at
                speed. A surface can be resurfaced to fix one and leave the other untouched, and a
                skid number quoted without its test speed says almost nothing.
              </ChartFigure>
            )}

            <Card title="Why any of this matters"
              subtitle="The measurement that replaced a panel of people in cars">
              <p className="cee-note" style={{ marginTop: 0 }}>
                In 1958 present serviceability was defined by asking people to rate a ride from 0 to
                5. The whole apparatus of modern pavement design rests on the regression that
                replaced them: <strong>PSI is an approximation of PSR within prescribed limits</strong>,
                and every terminal serviceability in every design equation is a point on that
                approximated scale. Huang records that repeat ratings of the same section differed by
                0 to 0.5, averaging 0.2 — so the difference between a p<sub>t</sub> of 2.5 and 2.4 is
                comfortably inside the noise of the panel the scale was built from.
              </p>
            </Card>

            <p className="cee-note">
              PSI: Huang Eqs. 9.14 (flexible, 74 sections) and 9.15 (rigid, 49 sections), with the
              linearizing transformations of Eqs. 9.3–9.5 and the least-squares derivation of
              Eqs. 9.8–9.9. Skid resistance: Eqs. 9.31–9.34 (Leu and Henry 1978; Meyer 1991), which
              Huang notes are "based on limited data" with different regressions published elsewhere.
              Validated against Problems 9.2 and 9.4.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
