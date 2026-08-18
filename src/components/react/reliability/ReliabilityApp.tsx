// Reliability & Variability Explorer — Huang (2004) Chapter 10.
//
// Turns a deterministic AASHTO flexible design into a probabilistic one:
// every input carries a coefficient of variation, the variances propagate,
// and the design comes back with a reliability instead of a verdict.
//
// Three estimators of the same number run side by side — Taylor's first-order
// expansion, Rosenblueth's point estimates, and Monte Carlo — because the
// interesting question is not "what is the reliability" but "which of my
// inputs is making it uncertain, and do my three methods agree?"
import { useEffect, useMemo, useRef, useState } from 'react';
import Tip from '../Tip';
import {
  useTheme, chartColors, baseLayout, plotConfig, num, fmt,
  axis, gridAxis, hueFor, withAlpha,
} from '../chartTheme';
import ChartFigure from '../ui/ChartFigure';
import Card from '../ui/Card';
import KpiStrip, { Kpi } from '../ui/KpiStrip';
import {
  trafficPrediction, performancePrediction, reliability, rosenblueth,
  monteCarlo, reliabilityVsSN, logWtOf,
  type TrafficInputs, type PerformanceInputs, type MonteCarloResult,
} from './equations.ts';
import '../tools.css';

interface LayerRow {
  id: number; name: string;
  a: string; cvA: string;
  D: string; cvD: string;
  m: string; cvM: string;
}

let nextId = 100;

/** Huang Table 10.3 — the section of Example 10.12. */
const DEMO_LAYERS: Omit<LayerRow, 'id'>[] = [
  { name: 'HMA surface', a: '0.42', cvA: '10', D: '8', cvD: '10', m: '1.00', cvM: '0' },
  { name: 'Granular base', a: '0.14', cvA: '14.3', D: '7', cvD: '10', m: '1.20', cvM: '10' },
  { name: 'Granular subbase', a: '0.08', cvA: '18.2', D: '11', cvD: '10', m: '1.20', cvM: '10' },
];

/** Recommended reliability by functional class — Huang Table 11.16, after
 *  AASHTO (1986). Reproduced so the tool can answer "is that enough?" rather
 *  than only "what is it?". */
const RELIABILITY_BANDS: { name: string; urban: [number, number]; rural: [number, number] }[] = [
  { name: 'Interstate and other freeways', urban: [85, 99.9], rural: [80, 99.9] },
  { name: 'Principal arterials', urban: [80, 99], rural: [75, 95] },
  { name: 'Collectors', urban: [80, 95], rural: [75, 95] },
  { name: 'Local', urban: [50, 80], rural: [50, 80] },
];

/** A normal density curve, for the distribution overlay. */
function density(mean: number, sd: number, xs: number[]): number[] {
  return xs.map(x => Math.exp(-0.5 * ((x - mean) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI)));
}

export default function ReliabilityApp() {
  /* ── Traffic side (Eqs. 10.38-10.40) ── */
  const [sumPF, setSumPF] = useState('1.452');
  const [cvSumPF, setCvSumPF] = useState('35');
  const [ADT0, setADT0] = useState('5000');
  const [cvADT, setCvADT] = useState('15');
  const [r, setR] = useState('6');
  const [cvR, setCvR] = useState('10');
  const [T, setT] = useState('20');
  const [cvT, setCvT] = useState('10');
  const [A, setA] = useState('2.5');
  const [cvA, setCvA] = useState('10');
  const [D, setD] = useState('50');
  const [cvD, setCvD] = useState('0');
  const [L, setL] = useState('100');
  const [cvL, setCvL] = useState('0');
  const [Y, setY] = useState('20');

  /* ── Performance side (Eqs. 10.41-10.44) ── */
  const [layers, setLayers] = useState<LayerRow[]>(
    DEMO_LAYERS.map(l => ({ ...l, id: nextId++ }))
  );
  const [p0, setP0] = useState('4.6');
  const [cvP0, setCvP0] = useState('6.7');
  const [pt, setPt] = useState('2.0');
  const [MR, setMR] = useState('5700');
  const [cvMR, setCvMR] = useState('15');

  const [trials, setTrials] = useState('5000');
  const [seed, setSeed] = useState('406');
  const [mc, setMc] = useState<MonteCarloResult | null>(null);
  const [running, setRunning] = useState(false);

  const pct = (s: string) => num(s, 0) / 100;

  const traffic = useMemo<TrafficInputs>(() => ({
    sumPF: num(sumPF, 0), cvSumPF: pct(cvSumPF),
    ADT0: num(ADT0, 0), cvADT: pct(cvADT),
    r: pct(r), cvR: pct(cvR),
    T: pct(T), cvT: pct(cvT),
    A: num(A, 0), cvA: pct(cvA),
    D: pct(D), cvD: pct(cvD),
    L: pct(L), cvL: pct(cvL),
    Y: num(Y, 0),
  }), [sumPF, cvSumPF, ADT0, cvADT, r, cvR, T, cvT, A, cvA, D, cvD, L, cvL, Y]);

  const perf = useMemo<PerformanceInputs>(() => ({
    layers: layers.map(l => ({
      name: l.name,
      a: num(l.a, 0), cvA: pct(l.cvA),
      D: num(l.D, 0), cvD: pct(l.cvD),
      m: num(l.m, 1), cvM: pct(l.cvM),
    })),
    p0: num(p0, 0), cvP0: pct(cvP0),
    pt: num(pt, 0),
    MR: num(MR, 0), cvMR: pct(cvMR),
  }), [layers, p0, cvP0, pt, MR, cvMR]);

  const tRes = useMemo(() => trafficPrediction(traffic), [traffic]);
  const pRes = useMemo(() => performancePrediction(perf), [perf]);
  const rel = useMemo(
    () => (tRes && pRes ? reliability(tRes.logWT, tRes.varLogWT, pRes.logWt, pRes.varLogWt) : null),
    [tRes, pRes]
  );

  /* Rosenblueth on the same three performance variables Eq. 10.43 expands. */
  const rosen = useMemo(() => {
    if (!pRes) return null;
    return rosenblueth(
      [pRes.SN, perf.p0, perf.MR],
      [Math.sqrt(pRes.varSN), perf.p0 * perf.cvP0, perf.MR * perf.cvMR],
      ([SN, p0v, MRv]) => logWtOf(SN, MRv, p0v, perf.pt)
    );
  }, [pRes, perf]);

  const rosenRel = useMemo(
    () => (tRes && rosen ? reliability(tRes.logWT, tRes.varLogWT, rosen.mean, rosen.variance) : null),
    [tRes, rosen]
  );

  // Any input change makes a previous sampling run stale.
  useEffect(() => { setMc(null); }, [traffic, perf]);

  const runMc = () => {
    setRunning(true);
    setTimeout(() => {
      setMc(monteCarlo(traffic, perf, Math.min(50000, Math.max(200, num(trials, 5000))), num(seed, 406)));
      setRunning(false);
    }, 30);
  };

  /* Every variance term, in a FIXED order (§A12) — never re-sorted by value. */
  const allTerms = useMemo(() => {
    if (!tRes || !pRes) return [];
    const total = tRes.varLogWT + pRes.varLogWt;
    return [
      ...tRes.terms.map(t => ({ ...t, side: 'traffic' as const })),
      ...pRes.terms.map(t => ({ ...t, side: 'performance' as const })),
    ].map(t => ({ ...t, share: total > 0 ? t.variance / total : 0 }));
  }, [tRes, pRes]);

  const dominant = useMemo(
    () => (allTerms.length ? [...allTerms].sort((a, b) => b.variance - a.variance)[0] : null),
    [allTerms]
  );

  const curve = useMemo(
    () => reliabilityVsSN(traffic, perf, [0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.35, 1.5, 1.7, 2.0]),
    [traffic, perf]
  );

  const theme = useTheme();
  const varRef = useRef<HTMLDivElement>(null);
  const distRef = useRef<HTMLDivElement>(null);
  const snRef = useRef<HTMLDivElement>(null);
  const mcRef = useRef<HTMLDivElement>(null);

  const trafficHue = hueFor('traffic', theme);
  const perfHue = hueFor('damage', theme);

  /* ── Variance contributions ── */
  useEffect(() => {
    if (!varRef.current || !allTerms.length) return;
    let cancelled = false;
    (async () => {
      const Plotly = (await import('plotly.js-dist-min')).default;
      if (cancelled || !varRef.current) return;
      Plotly.react(varRef.current, [{
        type: 'bar', orientation: 'h',
        x: allTerms.map(t => 100 * t.share),
        y: allTerms.map(t => t.name),
        marker: {
          color: allTerms.map(t => (t.side === 'traffic' ? trafficHue : perfHue)),
          cornerradius: 6, line: { width: 0 },
        },
        hovertemplate: '%{y}: %{x:.1f}%% of the total variance<extra></extra>',
      }], baseLayout(theme, {
        height: 60 + 40 * allTerms.length,
        margin: { l: 165, r: 16, t: 8, b: 40 },
        xaxis: gridAxis(theme, 'Share of the total variance in log Dr (%)'),
        yaxis: axis(theme, undefined, { autorange: 'reversed' as const }),
        bargap: 0.4,
      }), plotConfig);
    })();
    return () => { cancelled = true; };
  }, [allTerms, theme, trafficHue, perfHue]);

  /* ── The two distributions, and the overlap that is the failure probability ── */
  useEffect(() => {
    if (!distRef.current || !tRes || !pRes) return;
    let cancelled = false;
    (async () => {
      const Plotly = (await import('plotly.js-dist-min')).default;
      if (cancelled || !distRef.current) return;
      const lo = Math.min(tRes.logWT - 4 * tRes.sdLogWT, pRes.logWt - 4 * pRes.sdLogWt);
      const hi = Math.max(tRes.logWT + 4 * tRes.sdLogWT, pRes.logWt + 4 * pRes.sdLogWt);
      const xs = Array.from({ length: 240 }, (_, i) => lo + ((hi - lo) * i) / 239);

      Plotly.react(distRef.current, [
        {
          x: xs, y: density(tRes.logWT, tRes.sdLogWT, xs),
          name: 'Traffic', mode: 'lines', fill: 'tozeroy',
          line: { color: trafficHue, width: 2.5 },
          fillcolor: withAlpha(trafficHue, 0.18),
          hovertemplate: 'log W = %{x:.2f}<extra>traffic demand</extra>',
        },
        {
          x: xs, y: density(pRes.logWt, pRes.sdLogWt, xs),
          name: 'Capacity', mode: 'lines', fill: 'tozeroy',
          line: { color: perfHue, width: 2.5 },
          fillcolor: withAlpha(perfHue, 0.18),
          hovertemplate: 'log W = %{x:.2f}<extra>pavement capacity</extra>',
        },
      ], baseLayout(theme, {
        height: 300,
        xaxis: axis(theme, 'log₁₀ of load repetitions'),
        yaxis: gridAxis(theme, 'Probability density', { showticklabels: false }),
        hovermode: 'x unified',
        shapes: [
          { type: 'line', x0: tRes.logWT, x1: tRes.logWT, yref: 'paper', y0: 0, y1: 1, line: { color: trafficHue, width: 1, dash: 'dot' } },
          { type: 'line', x0: pRes.logWt, x1: pRes.logWt, yref: 'paper', y0: 0, y1: 1, line: { color: perfHue, width: 1, dash: 'dot' } },
        ],
      }), plotConfig);
    })();
    return () => { cancelled = true; };
  }, [tRes, pRes, theme, trafficHue, perfHue]);

  /* ── What does thickness buy? ── */
  useEffect(() => {
    if (!snRef.current || curve.length < 2 || !pRes) return;
    let cancelled = false;
    (async () => {
      const Plotly = (await import('plotly.js-dist-min')).default;
      if (cancelled || !snRef.current) return;
      const c = chartColors(theme);
      const hue = hueFor('stress', theme);
      Plotly.react(snRef.current, [
        {
          x: curve.map(p => p.SN), y: curve.map(p => p.R),
          mode: 'lines', line: { color: hue, width: 2.5, shape: 'spline' },
          hovertemplate: 'SN = %{x:.2f} → R = %{y:.1f}%<extra></extra>',
        },
        {
          x: [pRes.SN], y: [rel?.R ?? 0], mode: 'markers',
          marker: { color: hue, size: 11, line: { color: c.surface, width: 2 } },
          hovertemplate: 'your design: SN = %{x:.2f}, R = %{y:.1f}%<extra></extra>',
        },
      ], baseLayout(theme, {
        height: 300,
        xaxis: axis(theme, 'Structural number SN'),
        yaxis: gridAxis(theme, 'Reliability (%)', { range: [0, 100] }),
        hovermode: 'closest',
        shapes: [90, 95].map(v => ({
          type: 'line' as const, xref: 'paper' as const, x0: 0, x1: 1, y0: v, y1: v,
          line: { color: c.secondary, width: 1, dash: 'dot' as const },
        })),
        annotations: [90, 95].map(v => ({
          xref: 'paper' as const, x: 0.01, y: v, text: `${v}%`, showarrow: false,
          yshift: 8, font: { size: 10, color: c.fg },
        })),
      }), plotConfig);
    })();
    return () => { cancelled = true; };
  }, [curve, pRes, rel, theme]);

  /* ── Monte Carlo histogram ── */
  useEffect(() => {
    if (!mcRef.current || !mc) return;
    let cancelled = false;
    (async () => {
      const Plotly = (await import('plotly.js-dist-min')).default;
      if (cancelled || !mcRef.current) return;
      const c = chartColors(theme);
      Plotly.react(mcRef.current, [{
        type: 'histogram', x: mc.samples, nbinsx: 48,
        marker: { color: withAlpha(perfHue, 0.75), cornerradius: 4, line: { width: 0 } },
        hovertemplate: 'log Dr %{x:.2f} · %{y} trials<extra></extra>',
      }], baseLayout(theme, {
        height: 300,
        xaxis: axis(theme, 'log₁₀ of the damage ratio, log Dr = log W T − log W t'),
        yaxis: gridAxis(theme, 'Trials'),
        bargap: 0.05,
        shapes: [{
          type: 'line', x0: 0, x1: 0, yref: 'paper', y0: 0, y1: 1,
          line: { color: c.ink, width: 2 },
        }],
        annotations: [{
          x: 0, yref: 'paper', y: 1.04, text: 'failure →', showarrow: false,
          xanchor: 'left', font: { size: 10, color: c.fg },
        }],
      }), plotConfig);
    })();
    return () => { cancelled = true; };
  }, [mc, theme, perfHue]);

  const updateLayer = (id: number, patch: Partial<LayerRow>) =>
    setLayers(ls => ls.map(l => (l.id === id ? { ...l, ...patch } : l)));

  const cvField = (label: string, tip: string, value: string, set: (v: string) => void,
                   mean: string, setMean: (v: string) => void, unit: string, step = '0.1') => (
    <div className="cee-field">
      <span className="cee-field__label">
        <span>{label}<Tip text={tip} /></span>
        <span className="cee-field__unit">{unit} · CV %</span>
      </span>
      <div className="cee-axle-row cee-axle-row--2">
        <input className="cee-input" type="number" step={step} value={mean}
          aria-label={`${label} mean`} onChange={e => setMean(e.target.value)} />
        <input className="cee-input" type="number" step="1" min="0" value={value}
          aria-label={`${label} coefficient of variation`} onChange={e => set(e.target.value)} />
      </div>
    </div>
  );

  return (
    <div className="cee-tool">
      <aside className="cee-panel">
        <h2 className="cee-panel__title">Traffic prediction</h2>
        <p className="cee-hint" style={{ marginTop: '-0.35rem' }}>
          Mean on the left, coefficient of variation on the right. A CV of 0 declares an input
          deterministic.
        </p>

        {cvField('Σ pᵢFᵢ', 'Mean equivalent axle load factor of the traffic mix. Huang Table 10.9 puts its coefficient of variation near 35% — by far the largest on the traffic side.', cvSumPF, setCvSumPF, sumPF, setSumPF, '—', '0.01')}
        {cvField('ADT₀', 'Average daily traffic at the start of the design period, both directions.', cvADT, setCvADT, ADT0, setADT0, 'veh/day', '100')}
        {cvField('Growth rate r', 'Annual traffic growth rate. Its variance reaches the answer through the growth factor G = ½[1 + (1+r)^Y], so a long design period amplifies it.', cvR, setCvR, r, setR, '%', '0.5')}
        {cvField('Trucks T', 'Percentage of ADT that is trucks.', cvT, setCvT, T, setT, '%', '1')}
        {cvField('Axles per truck A', 'Average number of axles per truck.', cvA, setCvA, A, setA, '—', '0.1')}
        {cvField('Directional D', 'Percentage of traffic in the design direction. Usually treated as deterministic.', cvD, setCvD, D, setD, '%', '1')}
        {cvField('Lane L', 'Percentage of directional traffic in the design lane.', cvL, setCvL, L, setL, '%', '1')}

        <div className="cee-field">
          <label className="cee-field__label" htmlFor="rel-y">
            <span>Design period<Tip text="Years. Enters log W_T directly and again through the growth factor." /></span>
            <span className="cee-field__unit">years</span>
          </label>
          <input id="rel-y" className="cee-input" type="number" step="1" value={Y}
            onChange={e => setY(e.target.value)} />
        </div>

        <h2 className="cee-panel__title" style={{ marginTop: '1.5rem' }}>Performance prediction</h2>

        <div className="cee-field">
          <span className="cee-field__label">
            <span>Layers<Tip text="Layer coefficient a, thickness D, and drainage coefficient m — each with its own coefficient of variation. All three vary, which is why Eq. 10.44 has three terms per layer." /></span>
            <span className="cee-field__unit">a · D · m, each + CV %</span>
          </span>
          {layers.map(l => (
            <div key={l.id} style={{ marginBottom: '0.7rem' }}>
              <input className="cee-input" type="text" value={l.name} aria-label="Layer name"
                style={{ marginBottom: '0.3rem' }}
                onChange={e => updateLayer(l.id, { name: e.target.value })} />
              <div className="cee-axle-row cee-axle-row--2">
                <input className="cee-input" type="number" step="0.01" value={l.a}
                  aria-label="Layer coefficient" onChange={e => updateLayer(l.id, { a: e.target.value })} />
                <input className="cee-input" type="number" step="1" value={l.cvA}
                  aria-label="CV of layer coefficient" onChange={e => updateLayer(l.id, { cvA: e.target.value })} />
              </div>
              <div className="cee-axle-row cee-axle-row--2" style={{ marginTop: '0.25rem' }}>
                <input className="cee-input" type="number" step="0.5" value={l.D}
                  aria-label="Thickness (in)" onChange={e => updateLayer(l.id, { D: e.target.value })} />
                <input className="cee-input" type="number" step="1" value={l.cvD}
                  aria-label="CV of thickness" onChange={e => updateLayer(l.id, { cvD: e.target.value })} />
              </div>
              <div className="cee-axle-row cee-axle-row--2" style={{ marginTop: '0.25rem' }}>
                <input className="cee-input" type="number" step="0.05" value={l.m}
                  aria-label="Drainage coefficient" onChange={e => updateLayer(l.id, { m: e.target.value })} />
                <input className="cee-input" type="number" step="1" value={l.cvM}
                  aria-label="CV of drainage coefficient" onChange={e => updateLayer(l.id, { cvM: e.target.value })} />
              </div>
              {layers.length > 1 && (
                <button className="cee-btn cee-btn--ghost cee-btn--sm" type="button"
                  style={{ marginTop: '0.3rem' }}
                  onClick={() => setLayers(ls => ls.filter(x => x.id !== l.id))}>Remove layer</button>
              )}
            </div>
          ))}
          <button className="cee-btn cee-btn--ghost cee-btn--sm" type="button"
            onClick={() => setLayers(ls => [...ls, { id: nextId++, name: 'New layer', a: '0.10', cvA: '15', D: '6', cvD: '10', m: '1.00', cvM: '10' }])}>+ Add layer</button>
        </div>

        {cvField('Initial serviceability p₀', 'Serviceability of the pavement as built. The AASHO Road Test flexible sections averaged 4.2 with a standard deviation of 0.33 — construction quality, in one number.', cvP0, setCvP0, p0, setP0, '—', '0.1')}

        <div className="cee-field">
          <label className="cee-field__label" htmlFor="rel-pt">
            <span>Terminal serviceability pₜ<Tip text="The serviceability at which the pavement is considered failed. This is a policy choice, not a measurement, so it carries no variance." /></span>
          </label>
          <input id="rel-pt" className="cee-input" type="number" step="0.1" value={pt}
            onChange={e => setPt(e.target.value)} />
        </div>

        {cvField('Roadbed modulus M R', 'Effective roadbed soil resilient modulus. Its coefficient of variation is typically 15% within a project — and much larger between projects.', cvMR, setCvMR, MR, setMR, 'psi', '100')}

        <h2 className="cee-panel__title" style={{ marginTop: '1.5rem' }}>Monte Carlo</h2>
        <div className="cee-field">
          <span className="cee-field__label">
            <span>Trials · seed<Tip text="The seed makes a run reproducible: the same seed always gives the same answer, so a result can be checked by someone else." /></span>
          </span>
          <div className="cee-axle-row cee-axle-row--2">
            <input className="cee-input" type="number" step="1000" min="200" max="50000" value={trials}
              aria-label="Trials" onChange={e => setTrials(e.target.value)} />
            <input className="cee-input" type="number" step="1" value={seed}
              aria-label="Seed" onChange={e => setSeed(e.target.value)} />
          </div>
        </div>
      </aside>

      <div className="cee-results">
        <details className="cee-howto">
          <summary>How to use this tool</summary>
          <div className="cee-howto__body">
            <ol>
              <li><strong>Traffic gives a distribution, not a number.</strong> Every factor in the ESAL product has a mean and a spread; they combine into a mean and variance of log W<sub>T</sub>.</li>
              <li><strong>So does the pavement.</strong> Layer coefficients, thicknesses, drainage coefficients, p₀ and M<sub>R</sub> all vary, giving a mean and variance of log W<sub>t</sub> — the capacity.</li>
              <li><strong>Reliability is the overlap.</strong> It is the probability that demand stays below capacity: P(log W<sub>T</sub> − log W<sub>t</sub> &lt; 0).</li>
              <li><strong>Read the variance chart first.</strong> It ranks every input by how much of the total uncertainty it owns. That ranking, not the reliability number, is what tells you where to spend money — on better traffic counts, tighter construction, or more asphalt.</li>
              <li><strong>Run Monte Carlo and compare.</strong> Taylor's expansion linearises the design equation; sampling does not. When they disagree, the equation is curved over the range your inputs actually span.</li>
            </ol>
            The design equation itself never changes here. What changes is your honesty about the inputs.
          </div>
        </details>

        {!tRes || !pRes || !rel ? (
          <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>
            Check the inputs: every mean must be positive, p₀ must exceed pₜ, and the section must
            have at least one layer.
          </span></p>
        ) : (
          <>
            <KpiStrip>
              <Kpi accent label="Reliability" value={fmt(rel.R, 1)} unit="%"
                tip="Probability that the pavement carries its design traffic before reaching terminal serviceability — Huang Eq. 10.45." />
              <Kpi label="Design traffic log W T" value={fmt(tRes.logWT, 3)}
                tip="Mean of the predicted log ESAL over the design period, Eq. 10.39. Its standard deviation is shown below." />
              <Kpi label="Capacity log W t" value={fmt(pRes.logWt, 3)}
                tip="Mean of the allowable log ESAL from the AASHTO equation at this structural number, Eq. 10.41." />
              <Kpi label="Structural number" value={fmt(pRes.SN, 2)}
                tip="SN = Σ aᵢDᵢmᵢ. Its own variance, from Eq. 10.44, is the largest single term in the capacity variance for most designs." />
            </KpiStrip>

            <p className="cee-note" style={{ marginTop: '-0.25rem' }}>
              σ[log W<sub>T</sub>] = {fmt(tRes.sdLogWT, 3)} · σ[log W<sub>t</sub>] = {fmt(pRes.sdLogWt, 3)} ·
              mean log D<sub>r</sub> = {fmt(rel.meanLogDr, 3)} · z = {fmt(rel.z, 2)}.
              The design carries {fmt(Math.pow(10, tRes.logWT) / 1e6, 2)} million ESAL against a mean
              capacity of {fmt(Math.pow(10, pRes.logWt) / 1e6, 2)} million.
            </p>

            {rel.R < 75 && (
              <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>
                Reliability is <strong>{fmt(rel.R, 1)}%</strong>. In Huang Table 11.16 (after AASHTO
                1986) the lowest band for any functional class above a local road is{' '}
                <strong>75%</strong>, rural collectors and rural principal arterials. This section is
                below the recommended range for everything except a local road, urban or rural.
              </span></p>
            )}

            <ChartFigure
              title="Where the uncertainty comes from"
              subtitle="Each input's share of the total variance in log Dr — traffic side in amber, pavement side in violet"
              plotRef={varRef}
              legend={[
                { label: 'Traffic prediction', color: trafficHue },
                { label: 'Performance prediction', color: perfHue },
              ]}
              takeaway={dominant
                ? `${dominant.name} owns ${fmt(100 * dominant.share, 0)}% of the total variance — it is the input worth measuring better.`
                : 'No input carries variance; every coefficient of variation is zero.'}
            >
              This is the chart that changes decisions. A design whose uncertainty is dominated by
              the <strong>axle mix</strong> is not made safer by another inch of asphalt — it is made
              safer by weighing more trucks. A design dominated by <strong>SN</strong> is a
              construction-control problem: tighter thickness tolerances and better material
              acceptance buy more reliability per dollar than a thicker section does. Adding
              thickness is only the right answer when SN's own term is small and the design is simply
              short of capacity.
            </ChartFigure>

            <ChartFigure
              title="Demand against capacity"
              subtitle="Both predictions as distributions on the same log-repetitions axis; the overlap is the probability of failure"
              plotRef={distRef}
              legend={[
                { label: 'Traffic demand, log W T', color: trafficHue },
                { label: 'Pavement capacity, log W t', color: perfHue },
              ]}
              takeaway={`The capacity distribution sits ${fmt(-rel.meanLogDr, 2)} log units above the demand, giving ${fmt(rel.R, 1)}% reliability.`}
            >
              A deterministic design compares two <em>points</em> and declares the pavement adequate
              if capacity exceeds demand. What actually matters is how far apart the two
              distributions are <em>relative to their combined spread</em> — that ratio is z, and the
              reliability is the area of the normal curve below it. Two designs with identical mean
              capacity and identical mean traffic can differ by twenty points of reliability purely
              because one was built to tighter tolerances.
            </ChartFigure>

            <ChartFigure
              title="What thickness buys"
              subtitle="Reliability against structural number, with every layer scaled together; the dot is the current design"
              plotRef={snRef}
              takeaway={`At SN = ${fmt(pRes.SN, 2)} the design reaches ${fmt(rel.R, 1)}% reliability; the curve flattens as SN grows.`}
            >
              The curve is an S, and where you sit on it decides whether more material is worth
              buying. On the steep part, an inch of base is worth several points of reliability. Past
              the knee, the same inch buys fractions of a point — the design is no longer limited by
              capacity but by <em>uncertainty</em>, and no amount of thickness removes uncertainty
              about the traffic. Find the knee before you specify the section.
            </ChartFigure>

            <Card title="Is that enough reliability?"
              subtitle="Recommended levels by functional class — Huang Table 11.16, after AASHTO (1986)">
              <div className="cee-tablewrap">
                <table className="cee-table">
                  <thead>
                    <tr><th>Functional class</th><th>Urban</th><th>Rural</th><th>Your design</th></tr>
                  </thead>
                  <tbody>
                    {RELIABILITY_BANDS.map(b => {
                      const inUrban = rel.R >= b.urban[0] && rel.R <= b.urban[1];
                      const inRural = rel.R >= b.rural[0] && rel.R <= b.rural[1];
                      return (
                        <tr key={b.name}>
                          <td>{b.name}</td>
                          <td>{b.urban[0]}–{b.urban[1]}%</td>
                          <td>{b.rural[0]}–{b.rural[1]}%</td>
                          <td>{inUrban && inRural ? 'within both'
                            : inUrban ? 'within urban'
                            : inRural ? 'within rural'
                            : rel.R > b.urban[1] && rel.R > b.rural[1] ? 'above both'
                            : 'below'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="cee-note" style={{ marginTop: '0.75rem' }}>
                These are the levels a task force recommended, not a law of mechanics. Note how wide
                the bands are, and that "above both" is not automatically good news — reliability is
                bought with material, and an interstate built to 99.9% when 95% was called for is
                money spent on a tail that may not exist.
              </p>
            </Card>

            <Card title="Three estimates of the same number"
              subtitle="They rest on different assumptions, so their disagreement is information">
              <div className="cee-tablewrap">
                <table className="cee-table">
                  <thead>
                    <tr><th>Method</th><th>V[log W t]</th><th>Reliability</th><th>Assumes</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Taylor expansion (§10.1.2)</td>
                      <td>{fmt(pRes.varLogWt, 4)}</td>
                      <td>{fmt(rel.R, 1)}%</td>
                      <td>the design equation is linear over ±1σ</td>
                    </tr>
                    <tr>
                      <td>Rosenblueth points (§10.4)</td>
                      <td>{rosen ? fmt(rosen.variance, 4) : '—'}</td>
                      <td>{rosenRel ? `${fmt(rosenRel.R, 1)}%` : '—'}</td>
                      <td>no derivatives, but symmetric inputs</td>
                    </tr>
                    <tr>
                      <td>Monte Carlo</td>
                      <td>{mc ? fmt(Math.max(0, mc.sdLogDr ** 2 - tRes.varLogWT), 4) : '—'}</td>
                      <td>{mc ? `${fmt(mc.R, 1)}%` : '—'}</td>
                      <td>only that the inputs are normal and independent</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginTop: '0.85rem' }}>
                <button className="cee-btn cee-btn--primary" type="button" onClick={runMc} disabled={running}>
                  {running ? 'Sampling…' : mc ? 'Re-run Monte Carlo' : 'Run Monte Carlo'}
                </button>
                {mc && (
                  <span className="cee-hint" style={{ margin: 0 }}>
                    {mc.trials.toLocaleString()} valid trials, seed {seed}.
                  </span>
                )}
              </div>
              {mc && Math.abs(mc.R - rel.R) > 2 && (
                <p className="cee-warn" style={{ marginTop: '0.85rem' }}>
                  <span className="cee-warn__icon">⚠️</span><span>
                    Sampling gives <strong>{fmt(mc.R, 1)}%</strong> where the closed form gives
                    {' '}<strong>{fmt(rel.R, 1)}%</strong>. The gap means the design equation is
                    noticeably curved across the range your inputs span, so the first-order expansion
                    is no longer trustworthy here. Say which one you are reporting, and why.
                  </span>
                </p>
              )}
            </Card>

            {mc && (
              <ChartFigure
                title="Monte Carlo damage ratio"
                subtitle={`${mc.trials.toLocaleString()} sampled designs; everything right of zero is a pavement that failed early`}
                plotRef={mcRef}
                takeaway={`${fmt(100 - mc.R, 1)}% of sampled designs reached terminal serviceability before carrying their design traffic.`}
              >
                Each trial is one pavement that could have been built from your specifications —
                its own layer thicknesses, its own subgrade, its own traffic. The histogram is the
                population of outcomes hiding behind a single deterministic answer. Note that it is
                not symmetric: the design equation is nonlinear, so normally distributed inputs do
                not produce a normally distributed damage ratio, and the tail that matters is the
                one on the right.
              </ChartFigure>
            )}

            <p className="cee-note">
              Traffic prediction: Huang Eqs. 10.38–10.40. Performance prediction: Eqs. 10.41–10.44,
              the AASHTO flexible equation with the reliability term removed — because reliability is
              the output here, not an input. Reliability: Eqs. 10.45–10.46. Rosenblueth's point
              estimates follow §10.4. All inputs are treated as independent; correlation between
              layer thicknesses, or between M<sub>R</sub> and drainage, would change the answer and
              is worth arguing about.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
