// Dynamic Modulus & Master Curve — the temperature and rate dependence of
// asphalt, which is the single fact most students leave the course without.
//
// Three things happen here. The Asphalt Institute regression (Huang Eq. 7.27)
// predicts |E*| across temperature and frequency. The Shell/Bonnaure route
// (Eqs. 7.24-7.25) answers the same question differently — by 65% on Huang's
// own Example 7.10. And time-temperature superposition collapses the
// isotherms onto one master curve, with the fit quality reported so a student
// can see whether superposition actually holds for the model they used.
//
// Physics in equations.ts, pinned to Examples 2.16, 7.7-7.10.
import { useEffect, useMemo, useRef, useState } from 'react';
import Tip from '../Tip';
import {
  useTheme, chartColors, baseLayout, plotConfig, num, fmt,
  axis, gridAxis, hueFor, RAMPS, withAlpha,
} from '../chartTheme';
import ChartFigure from '../ui/ChartFigure';
import Card from '../ui/Card';
import KpiStrip, { Kpi } from '../ui/KpiStrip';
import {
  dynamicModulusAI, stiffnessBonnaure, viscosityFromPenetration,
  temperatureSusceptibility, penetrationIndex, volumeFractions,
  buildMasterCurve, fitSigmoid, sigmoidAt, shiftFactor,
  BETA_DEFAULT, BETA_RANGE,
} from './equations.ts';
import '../tools.css';

/** Isotherms are ordered data, so they take a sequential ramp (§B5) rather
 *  than categorical hues — temperature is a continuum, not a category. */
const isothermColor = (i: number, n: number) => {
  const ramp = RAMPS.orange;
  const t = n <= 1 ? 0 : i / (n - 1);
  const idx = Math.min(ramp.length - 1, Math.round(t * (ramp.length - 1)));
  return ramp[idx];
};

const TEMPS = [40, 55, 70, 85, 100, 115];
const FREQS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 25];

export default function MasterCurveApp() {
  // Mix composition
  const [p200, setP200] = useState('6');
  const [va, setVa] = useState('5');
  const [vb, setVb] = useState('11');
  // Binder
  const [pen77, setPen77] = useState('70');       // original, drives the AI route
  const [penRec, setPenRec] = useState('50');     // recovered, drives the Shell route
  const [tRB, setTRB] = useState('60');           // ring & ball, °C
  const [sbStr, setSb] = useState('1e7');         // bitumen stiffness, N/m² (nomograph read)
  // Master curve
  const [t0, setT0] = useState('70');
  const [betaStr, setBeta] = useState(String(BETA_DEFAULT));
  // Design point
  const [designT, setDesignT] = useState('77');
  const [designF, setDesignF] = useState('8');

  const P200 = num(p200, 0), Va = num(va, 0), Vb = num(vb, 0);
  const lambda = useMemo(() => viscosityFromPenetration(num(pen77, 70)), [pen77]);
  const T0 = num(t0, 70);
  const beta = num(betaStr, BETA_DEFAULT);

  const valid = Vb > 0 && Va >= 0 && P200 >= 0 && num(pen77, 0) > 0;

  const base = useMemo(
    () => ({ p200: P200, va: Va, vb: Vb, lambda }),
    [P200, Va, Vb, lambda]
  );

  /* ── The design point, both ways ── */
  const ai = useMemo(
    () => (valid ? dynamicModulusAI({ ...base, f: num(designF, 8), T: num(designT, 77) }) : null),
    [valid, base, designF, designT]
  );

  const shell = useMemo(() => {
    if (!valid) return null;
    // Shell works from the aggregate volume, which is what is left after
    // bitumen and air.
    const Vg = 100 - Vb - Va;
    return stiffnessBonnaure(num(sbStr, 1e7), Vb, Vg);
  }, [valid, sbStr, Vb, Va]);

  const shellPsi = shell ? shell.sm / 6900 : null;

  /* ── Binder temperature susceptibility ── */
  const binder = useMemo(() => {
    const A = temperatureSusceptibility(num(penRec, 50), 25, num(tRB, 60));
    return { A, PI: penetrationIndex(A) };
  }, [penRec, tRB]);

  /* ── Master curve ── */
  const points = useMemo(
    () => (valid ? buildMasterCurve(base, TEMPS, FREQS, T0, beta) : []),
    [valid, base, T0, beta]
  );
  const fit = useMemo(() => (points.length ? fitSigmoid(points) : null), [points]);

  /* ── The shift slope that best collapses this mix ── */
  const bestBeta = useMemo(() => {
    if (!valid) return null;
    let best = { rms: Infinity, beta: BETA_DEFAULT, r2: 0 };
    for (let b = 0.02; b <= 0.30; b += 0.005) {
      const f = fitSigmoid(buildMasterCurve(base, TEMPS, FREQS, T0, b));
      if (f && f.rmsLog < best.rms) best = { rms: f.rmsLog, beta: b, r2: f.r2 };
    }
    return best;
  }, [valid, base, T0]);

  const theme = useTheme();
  const isoRef = useRef<HTMLDivElement>(null);
  const masterRef = useRef<HTMLDivElement>(null);

  /* ── Isotherms, before shifting ── */
  useEffect(() => {
    if (!isoRef.current || !valid) return;
    let cancelled = false;
    (async () => {
      const Plotly = (await import('plotly.js-dist-min')).default;
      if (cancelled || !isoRef.current) return;
      const traces = TEMPS.map((T, i) => ({
        x: FREQS,
        y: FREQS.map(f => dynamicModulusAI({ ...base, f, T })?.eStar ?? null),
        name: `${T}°F`, mode: 'lines+markers',
        line: { color: isothermColor(i, TEMPS.length), width: 2.2 },
        marker: { color: isothermColor(i, TEMPS.length), size: 6 },
        hovertemplate: `${T}°F · %{x} Hz · %{y:,.0f} psi<extra></extra>`,
      }));
      Plotly.react(isoRef.current, traces, baseLayout(theme, {
        height: 320,
        xaxis: axis(theme, 'Load frequency (Hz)', { type: 'log' as const }),
        yaxis: gridAxis(theme, '|E*| (psi)', { type: 'log' as const }),
        hovermode: 'closest',
      }), plotConfig);
    })();
    return () => { cancelled = true; };
  }, [base, valid, theme]);

  /* ── The master curve, after shifting ── */
  useEffect(() => {
    if (!masterRef.current || !points.length) return;
    let cancelled = false;
    (async () => {
      const Plotly = (await import('plotly.js-dist-min')).default;
      if (cancelled || !masterRef.current) return;
      const c = chartColors(theme);

      // One trace per isotherm so the student can see which temperature landed
      // where — the whole question is whether they overlap.
      const traces: any[] = TEMPS.map((T, i) => {
        const sub = points.filter(p => p.T === T);
        return {
          x: sub.map(p => p.fr), y: sub.map(p => p.eStar),
          name: `${T}°F`, mode: 'markers',
          marker: { color: isothermColor(i, TEMPS.length), size: 8, line: { color: c.surface, width: 1.5 } },
          hovertemplate: `${T}°F · fr %{x:.3g} Hz · %{y:,.0f} psi<extra></extra>`,
        };
      });

      if (fit) {
        const lo = Math.log10(points[0].fr), hi = Math.log10(points[points.length - 1].fr);
        const xs = Array.from({ length: 160 }, (_, i) => Math.pow(10, lo + ((hi - lo) * i) / 159));
        traces.push({
          x: xs, y: xs.map(x => sigmoidAt(fit, x)),
          name: 'Sigmoid', mode: 'lines',
          line: { color: c.ink, width: 2.5 },
          hovertemplate: 'fitted %{y:,.0f} psi<extra></extra>',
        });
      }

      Plotly.react(masterRef.current, traces, baseLayout(theme, {
        height: 340,
        xaxis: axis(theme, `Reduced frequency at ${fmt(T0, 0)}°F (Hz)`, { type: 'log' as const }),
        yaxis: gridAxis(theme, '|E*| (psi)', { type: 'log' as const }),
        hovermode: 'closest',
      }), plotConfig);
    })();
    return () => { cancelled = true; };
  }, [points, fit, T0, theme]);

  // Judged on the residual in modulus terms rather than R2, because R2 stays
  // flatteringly high long after the collapse stops being good enough to
  // design from.
  const residualPct = fit ? 100 * (Math.pow(10, fit.rmsLog) - 1) : null;
  const collapseVerdict = residualPct === null ? null
    : residualPct < 10 ? 'clean'
    : residualPct < 30 ? 'workable'
    : 'poor';

  return (
    <div className="cee-tool">
      <aside className="cee-panel">
        <h2 className="cee-panel__title">Mix</h2>

        <div className="cee-presets">
          <button type="button" className="cee-chip"
            title="Huang Example 7.10, p. 308: original penetration 70, recovered 50, ring-and-ball 60°C, Vb 11%, Va 5%, P200 6%. At 77°F and 8 Hz the AI equations should give 5.07 x 10^5 psi."
            onClick={() => {
              setP200('6'); setVa('5'); setVb('11');
              setPen77('70'); setPenRec('50'); setTRB('60'); setSb('1e7');
              setDesignT('77'); setDesignF('8'); setT0('70'); setBeta(String(BETA_DEFAULT));
            }}>Huang Ex. 7.10</button>
          <button type="button" className="cee-chip"
            title="Example 7.10's fines sensitivity: the same mix with only 1% passing the No. 200 sieve. |E*| should fall to 4.0 x 10^5 psi."
            onClick={() => { setP200('1'); setVa('5'); setVb('11'); setPen77('70'); setDesignT('77'); setDesignF('8'); }}>
            …with 1% fines</button>
        </div>

        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="mc-p200">
              <span>P<sub>200</sub><Tip text="Percent by weight of aggregate passing the No. 200 sieve. The Asphalt Institute equations use it; the Shell nomographs do not — one of several reasons the two methods disagree." /></span>
              <span className="cee-field__unit">%</span>
            </label>
            <input id="mc-p200" className="cee-input" type="number" min="0" step="0.5" value={p200}
              onChange={e => setP200(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="mc-va">
              <span>Air voids V<sub>a</sub><Tip text="Air void volume as a percentage of total mix volume." /></span>
              <span className="cee-field__unit">%</span>
            </label>
            <input id="mc-va" className="cee-input" type="number" min="0" step="0.5" value={va}
              onChange={e => setVa(e.target.value)} />
          </div>
        </div>

        <div className="cee-field">
          <label className="cee-field__label" htmlFor="mc-vb">
            <span>Bitumen volume V<sub>b</sub><Tip text="Bitumen volume as a percentage of total mix volume — by volume, not by weight. Huang Eq. 7.21 converts from weight if that is what you have." /></span>
            <span className="cee-field__unit">%</span>
          </label>
          <input id="mc-vb" className="cee-input" type="number" min="0.8" step="0.5" value={vb}
            onChange={e => setVb(e.target.value)} />
          <p className="cee-hint">Aggregate volume V<sub>g</sub> = {fmt(100 - Vb - Va, 1)}% by difference.</p>
        </div>

        <h2 className="cee-panel__title" style={{ marginTop: '1.5rem' }}>Binder</h2>

        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="mc-pen">
              <span>Pen at 77°F, original<Tip text="Penetration of the ORIGINAL asphalt. The Asphalt Institute route uses this; Shell uses the recovered binder. They are different numbers for the same mix." /></span>
            </label>
            <input id="mc-pen" className="cee-input" type="number" min="1" step="1" value={pen77}
              onChange={e => setPen77(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="mc-penr">
              <span>Pen, recovered<Tip text="Penetration of the binder recovered from the mix — always lower than the original, because mixing and ageing stiffen it." /></span>
            </label>
            <input id="mc-penr" className="cee-input" type="number" min="1" step="1" value={penRec}
              onChange={e => setPenRec(e.target.value)} />
          </div>
        </div>

        <div className="cee-field">
          <label className="cee-field__label" htmlFor="mc-trb">
            <span>Ring &amp; ball point<Tip text="Softening point, °C — the temperature at which every bitumen has a penetration of about 800. It anchors the temperature-susceptibility line of Eq. 7.18." /></span>
            <span className="cee-field__unit">°C</span>
          </label>
          <input id="mc-trb" className="cee-input" type="number" step="1" value={tRB}
            onChange={e => setTRB(e.target.value)} />
          <p className="cee-hint">
            λ = {fmt(lambda, 2)} ×10⁶ poise (Eq. 7.28) · A = {binder.A.toFixed(4)} ·
            penetration index PI = {binder.PI.toFixed(2)}.
          </p>
        </div>

        <div className="cee-field">
          <label className="cee-field__label" htmlFor="mc-sb">
            <span>Bitumen stiffness S<sub>b</sub><Tip text="Read off the Van der Poel nomograph (Huang Fig. 7.19) from the penetration index, the loading time, and the temperature below the ring-and-ball point. The nomograph is not digitised here — this is a chart read you supply." /></span>
            <span className="cee-field__unit">N/m²</span>
          </label>
          <input id="mc-sb" className="cee-input" type="text" value={sbStr}
            onChange={e => setSb(e.target.value)} />
        </div>

        <h2 className="cee-panel__title" style={{ marginTop: '1.5rem' }}>Design point</h2>
        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="mc-dt">
              <span>Temperature</span><span className="cee-field__unit">°F</span>
            </label>
            <input id="mc-dt" className="cee-input" type="number" step="1" value={designT}
              onChange={e => setDesignT(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="mc-df">
              <span>Frequency</span><span className="cee-field__unit">Hz</span>
            </label>
            <input id="mc-df" className="cee-input" type="number" min="0.01" step="1" value={designF}
              onChange={e => setDesignF(e.target.value)} />
          </div>
        </div>

        <h2 className="cee-panel__title" style={{ marginTop: '1.5rem' }}>Master curve</h2>
        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="mc-t0">
              <span>Reference T<sub>0</sub><Tip text="The temperature every isotherm is shifted onto. Changing it slides the master curve along the frequency axis without changing its shape." /></span>
              <span className="cee-field__unit">°F</span>
            </label>
            <input id="mc-t0" className="cee-input" type="number" step="5" value={t0}
              onChange={e => setT0(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="mc-beta">
              <span>Shift slope β<Tip text="Slope of log a_T against temperature. Huang §2.3.2 reports 0.061 to 0.170 for asphalt mixes, averaging 0.113 (FHWA 1978)." /></span>
            </label>
            <input id="mc-beta" className="cee-input" type="number" step="0.005" value={betaStr}
              onChange={e => setBeta(e.target.value)} />
          </div>
        </div>
        {bestBeta && (
          <button className="cee-btn cee-btn--ghost cee-btn--sm" type="button"
            onClick={() => setBeta(bestBeta.beta.toFixed(3))}>
            Use the best-collapsing β ({bestBeta.beta.toFixed(3)})
          </button>
        )}
      </aside>

      <div className="cee-results">
        <details className="cee-howto">
          <summary>How to use this tool</summary>
          <div className="cee-howto__body">
            <ol>
              <li><strong>Calibrate first.</strong> Load the Huang Ex. 7.10 preset and confirm |E*| = 5.07 × 10⁵ psi at 77°F and 8 Hz before trusting anything else.</li>
              <li><strong>Look at the isotherms.</strong> Each curve is one temperature. Asphalt is stiffer when cold and stiffer under a faster load — the two axes of the same underlying behaviour.</li>
              <li><strong>Shift them.</strong> Time–temperature superposition says a hot slow test and a cold fast test are the same test. If that is true, every isotherm lands on one curve.</li>
              <li><strong>Read the collapse, not just the curve.</strong> The R² tells you whether superposition actually held. A poor collapse means the model you shifted does not obey it, and no amount of curve-fitting fixes that.</li>
              <li><strong>Compare the two methods.</strong> The Asphalt Institute and Shell routes answer the same question and disagree. Decide which you would hand a designer, and on what grounds.</li>
            </ol>
            One number from this tool feeds everything else: the AC modulus that goes into a
            layered-elastic run is a point on this curve, chosen for a vehicle speed and a pavement
            temperature. Choosing it badly is a bigger error than most of the analysis downstream.
          </div>
        </details>

        {!valid ? (
          <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>
            Enter a positive bitumen volume and penetration. Bitumen volume must exceed about 0.8%
            for the Shell equations to have a solution.
          </span></p>
        ) : (
          <>
            <KpiStrip>
              <Kpi accent label="|E*| at the design point" value={ai ? fmt(ai.eStar / 1000, 0) : '—'} unit="ksi"
                tip="Asphalt Institute regression, Huang Eq. 7.27, at the temperature and frequency set on the left." />
              <Kpi label="Shell S m, same mix" value={shellPsi ? fmt(shellPsi / 1000, 0) : '—'} unit="ksi"
                tip="Shell/Bonnaure route, Eqs. 7.24-7.25, from the bitumen stiffness you read off the nomograph. The two answers are not supposed to be identical — see below." />
              <Kpi label="Master curve collapse" value={fit ? fmt(100 * fit.r2, 1) : '—'} unit="% R²"
                tip="How well the shifted isotherms fall on one sigmoid. This is a test of whether time-temperature superposition holds for the model, not a measure of curve-fitting effort." />
              <Kpi label="Best-collapsing β" value={bestBeta ? bestBeta.beta.toFixed(3) : '—'}
                tip="The shift slope that collapses these isotherms most tightly, searched over the plausible range. Compare it with the 0.113 average Huang quotes." />
            </KpiStrip>

            {ai && shellPsi && (
              <p className="cee-warn" style={{ background: 'transparent' }}>
                <span className="cee-warn__icon">⚖️</span><span>
                  The two published methods differ by{' '}
                  <strong>{fmt(Math.abs(100 * (ai.eStar / shellPsi - 1)), 0)}%</strong> on this mix
                  ({fmt(ai.eStar / 1000, 0)} ksi against {fmt(shellPsi / 1000, 0)} ksi). Huang prints
                  both without declaring a winner. Neither is a measurement.
                </span>
              </p>
            )}

            {collapseVerdict !== 'clean' && bestBeta && fit && (
              <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>
                At β = {beta.toFixed(3)} the shifted isotherms miss a single curve by{' '}
                <strong>{fmt(residualPct!, 0)}% in modulus</strong> (R² = {fmt(fit.r2, 3)}). This
                mix collapses best at <strong>β = {bestBeta.beta.toFixed(3)}</strong>, which is near
                the bottom of Huang's 0.061–0.170 range rather than at the 0.113 average.
                Superposition is not failing here — <strong>the handbook average is</strong>. Fit the
                shift slope to the mix rather than inheriting it, and say which you used.
              </span></p>
            )}

            <ChartFigure
              title="Isotherms — |E*| before any shifting"
              subtitle="One curve per temperature, from the Asphalt Institute regression"
              plotRef={isoRef}
              legend={TEMPS.map((T, i) => ({ label: `${T}°F`, color: isothermColor(i, TEMPS.length) }))}
              takeaway={ai
                ? `At ${fmt(num(designT, 77), 0)}°F and ${fmt(num(designF, 8), 1)} Hz the mix has a dynamic modulus of ${fmt(ai.eStar / 1000, 0)} ksi.`
                : 'Enter a valid mix to see the isotherms.'}
            >
              Both axes say the same thing about asphalt: it is a <strong>viscoelastic</strong>
              material, so its stiffness depends on how fast you load it and how hot it is. A curve
              that is steep in frequency is equally steep in temperature — which is the observation
              time–temperature superposition turns into a method. Note the range: across a summer
              afternoon and a winter morning, the same mix varies by more than an order of magnitude,
              which is why a single "AC modulus" in a design is always a choice about season and speed.
            </ChartFigure>

            <ChartFigure
              title={`Master curve at ${fmt(T0, 0)}°F`}
              subtitle={`Every isotherm shifted by a_T = exp[2.3026 β (T − T₀)] with β = ${beta.toFixed(3)}`}
              plotRef={masterRef}
              legend={[
                ...TEMPS.map((T, i) => ({ label: `${T}°F`, color: isothermColor(i, TEMPS.length) })),
                { label: 'Fitted sigmoid', color: chartColors(theme).ink, shape: 'line' as const },
              ]}
              takeaway={fit
                ? `The shifted isotherms fall on one sigmoid with R² = ${fmt(fit.r2, 3)} and an RMS residual of ${fmt(fit.rmsLog, 3)} log units.`
                : 'Not enough points to fit a master curve.'}
            >
              <strong>The question this chart asks is whether the coloured points overlap.</strong>
              Superposition claims a measurement at 115°F and 25 Hz contains the same information as
              one at 40°F and a much lower frequency — so shifted onto a common reference, every
              temperature should trace out one curve. Where the points separate into visible bands,
              the material (or the model standing in for it) is not thermorheologically simple, and
              the master curve is a convenient fiction rather than a physical law.
            </ChartFigure>

            {fit && (
              <Card title="The fitted master curve"
                subtitle="MEPDG sigmoidal form: log|E*| = δ + α / (1 + exp(β + γ log f_R))">
                <div className="cee-tablewrap">
                  <table className="cee-table">
                    <tbody>
                      <tr><td>δ — lower asymptote</td>
                        <td>{fmt(fit.delta, 3)} → {fmt(Math.pow(10, fit.delta) / 1000, 1)} ksi</td>
                        <td>the modulus as the load becomes infinitely slow, or the pavement infinitely hot</td></tr>
                      <tr><td>δ + α — upper asymptote</td>
                        <td>{fmt(fit.delta + fit.alpha, 3)} → {fmt(Math.pow(10, fit.delta + fit.alpha) / 1000, 0)} ksi
                          {fit.atBound.upper && <strong> (at the bound)</strong>}</td>
                        <td>the glassy modulus: infinitely fast, or infinitely cold</td></tr>
                      <tr><td>γ — transition steepness</td><td>{fmt(fit.gamma, 3)}</td>
                        <td>how abruptly the mix passes from glassy to viscous</td></tr>
                      <tr><td>RMS residual</td><td>{fmt(fit.rmsLog, 4)} log units</td>
                        <td>≈ {fmt(100 * (Math.pow(10, fit.rmsLog) - 1), 1)}% in modulus</td></tr>
                    </tbody>
                  </table>
                </div>
                <p className="cee-note" style={{ marginTop: '0.75rem' }}>
                  The two asymptotes bracket everything the mix can ever do. A design modulus outside
                  them is not conservative — it is impossible. Shifting the reference temperature
                  moves the curve sideways but must leave both asymptotes where they are; if it does
                  not, the fit has not converged.
                </p>
                {(fit.atBound.upper || fit.atBound.lower) && (
                  <p className="cee-warn" style={{ marginTop: '0.75rem' }}>
                    <span className="cee-warn__icon">⚠️</span><span>
                      The {fit.atBound.upper && 'upper'}{fit.atBound.upper && fit.atBound.lower && ' and '}
                      {fit.atBound.lower && 'lower'} asymptote finished <strong>pinned against its
                      physical bound</strong>. That means your temperature and frequency range never
                      reached that plateau, so the number shown is the bound this tool imposes, not
                      something your data determined. Quote it as a limit, not a result — or widen
                      the range until the curve actually flattens.
                    </span>
                  </p>
                )}
              </Card>
            )}

            <Card title="Two methods, one mix"
              subtitle="Huang prints both routes in §7.2 and compares them in Example 7.10">
              <div className="cee-tablewrap">
                <table className="cee-table">
                  <thead>
                    <tr><th>Route</th><th>Uses</th><th>Ignores</th><th>|E*| here</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Asphalt Institute<br/><span className="cee-field__unit">Eq. 7.27</span></td>
                      <td>ORIGINAL binder viscosity, fines content, air voids, bitumen volume, T and f directly</td>
                      <td>the binder actually in the mix after ageing</td>
                      <td>{ai ? `${fmt(ai.eStar / 1000, 0)} ksi` : '—'}</td>
                    </tr>
                    <tr>
                      <td>Shell / Bonnaure<br/><span className="cee-field__unit">Eqs. 7.24–7.25</span></td>
                      <td>RECOVERED binder stiffness, bitumen and aggregate volume</td>
                      <td>fines content; temperature and frequency enter only through S<sub>b</sub></td>
                      <td>{shellPsi ? `${fmt(shellPsi / 1000, 0)} ksi` : '—'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="cee-note" style={{ marginTop: '0.75rem' }}>
                They disagree because they are asking slightly different questions of slightly
                different materials — one characterises the binder as delivered, the other as it
                ends up in the road. Huang's own comment is that the Shell nomograph is accurate to
                "a factor of 1.5 to 2", which is worth holding next to any modulus quoted to three
                significant figures. <strong>Say which route you used, and why.</strong>
              </p>
            </Card>

            <p className="cee-note">
              Asphalt Institute route: Huang Eqs. 7.27–7.28 (Hwang and Witczak, 1979).
              Shell route: Eqs. 7.24–7.25 (Bonnaure et al., 1977), with S<sub>b</sub> read off the
              Van der Poel nomograph. Time–temperature superposition: Eqs. 2.44–2.46, shift slope
              0.061 to 0.170 averaging {BETA_DEFAULT} (FHWA, 1978). Sigmoidal master curve: the MEPDG
              form (App. F). Validated against the printed answers of Examples 2.16, 7.7, 7.8, 7.9
              and 7.10 — note that Example 7.9 case 1 does not reproduce, and the tool's tests record
              why.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
