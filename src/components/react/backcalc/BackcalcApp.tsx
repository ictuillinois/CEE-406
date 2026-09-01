// FWD Backcalculation Studio — take a measured deflection basin and work
// backwards to layer moduli, by two routes that disagree on purpose:
// the AASHTO 1993 closed form (Huang Eqs. 13.22-13.26) and a full
// layered-elastic inversion driven by the App. B solver.
//
// The tool deliberately reports how *badly determined* each modulus is, not
// just its value — Huang §9.4.3 is explicit that a good basin match does not
// mean a correct modulus set, especially for thin layers.
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
  basin, basinIndices, backcalculate, aashtoNdt, temperatureFactor, isDetermined,
  type Layer, type FitResult,
} from './equations.ts';
import '../tools.css';

/** Layers are unordered categories, so they take categorical hues 1-2-3-4 in
 *  a fixed order and keep them across every chart here (§B4). */
const LAYER_HUES = (t: Mode) => [HUES[t].orange, HUES[t].blue, HUES[t].emerald, HUES[t].violet];

interface SensorRow { id: number; r: string; d: string }
interface LayerRow { id: number; name: string; h: string; E: string; nu: string; fixed: boolean }

let nextId = 100;

/** A three-layer flexible section measured with a 9,000 lb / 5.9 in plate.
 *  The basin is the forward solution of E = 420/28/11 ksi, rounded to the
 *  0.01 mil an FWD actually reports — so the fit has something to chew on. */
const DEMO_SENSORS: [string, string][] = [
  ['0', '25.44'], ['8', '19.83'], ['12', '16.33'],
  ['18', '12.38'], ['24', '9.67'], ['36', '6.43'], ['60', '3.69'],
];

const DEMO_LAYERS: Omit<LayerRow, 'id'>[] = [
  { name: 'HMA surface', h: '4', E: '250000', nu: '0.35', fixed: false },
  { name: 'Granular base', h: '8', E: '20000', nu: '0.35', fixed: false },
  { name: 'Subgrade', h: '0', E: '8000', nu: '0.40', fixed: false },
];

interface Preset {
  label: string;
  tip: string;
  P: string; a: string; tempF: string;
  sensors: [string, string][];
  layers: Omit<LayerRow, 'id'>[];
}

/** Three cases, chosen to be argued with rather than just run.
 *
 *  The first has a known answer, so the tool can be checked against it. The
 *  second is the book's own worked example, so the AASHTO route can be checked
 *  against a printed number. The third is a basin that cannot determine what
 *  it is asked to determine, which is the situation Huang §9.4.3 warns about
 *  and the one students otherwise never meet. */
const PRESETS: Preset[] = [
  {
    label: 'Synthetic — answer known',
    tip: 'Basin generated forward from E = 420 / 28 / 11 ksi, then rounded to the 0.01 mil an FWD reports. Fit it and check whether you get those moduli back.',
    P: '9000', a: '5.9', tempF: '68',
    sensors: DEMO_SENSORS,
    layers: DEMO_LAYERS,
  },
  {
    label: 'Huang Example 13.11',
    tip: 'The worked example on p. 638. M_R comes straight out at 16,900 psi. SN_eff only reaches the printed 2.88 once you tick the manual box and enter 0.92, the factor Huang reads off Fig. 13.18 — the built-in suggestion gives 0.82 and SN_eff = 3.14. Two sensors, three unknowns: the layered fit cannot be trusted here and says so.',
    P: '9000', a: '5.9', tempF: '80',
    sensors: [['0', '13.90'], ['36', '3.55']],
    layers: [
      { name: 'HMA surface', h: '4.25', E: '400000', nu: '0.35', fixed: false },
      { name: 'Granular base', h: '8', E: '25000', nu: '0.35', fixed: false },
      { name: 'Subgrade', h: '0', E: '17000', nu: '0.40', fixed: false },
    ],
  },
  {
    label: 'Thin surface — indeterminate',
    tip: 'A 2 in surface over a thick base, measured with 1.5% instrument noise. It was generated from 200 / 18 / 8 ksi. Fit it: the subgrade comes back within a percent, the basin matches to about 1.5% RMS, and the surface modulus comes back roughly half the truth. That is Huang §9.4.3, quantified.',
    P: '9000', a: '5.9', tempF: '68',
    // Forward solution of 200 / 18 / 8 ksi with 1.5% measurement noise — the
    // noise is the point. Without it the fit recovers even a weakly-determined
    // layer, and the demonstration collapses.
    sensors: [
      ['0', '51.76'], ['8', '30.92'], ['12', '23.46'],
      ['18', '16.45'], ['24', '13.10'], ['36', '8.91'], ['60', '5.05'],
    ],
    // Seeded deliberately far from the moduli that generated this basin
    // (200 / 18 / 8 ksi). The subgrade will come back almost exactly; the
    // surface will land wherever the seed pushed it and the basin will not
    // object — which is the entire point of the preset.
    layers: [
      { name: 'HMA surface', h: '2', E: '450000', nu: '0.35', fixed: false },
      { name: 'Granular base', h: '10', E: '30000', nu: '0.35', fixed: false },
      { name: 'Subgrade', h: '0', E: '13000', nu: '0.40', fixed: false },
    ],
  },
];

const MIL = 0.001; // FWD deflections are reported in mils

export default function BackcalcApp() {
  const [P, setP] = useState('9000');       // lb
  const [a, setA] = useState('5.9');        // in
  const [tempF, setTempF] = useState('68'); // °F at mid-depth of the AC
  const [C, setC] = useState('0.33');       // AASHTO design adjustment factor
  // The built-in temperature factor is an interpolation, not Figure 13.18.
  // Students who read the chart enter the real value here instead.
  const [manualT, setManualT] = useState(false);
  const [manualTVal, setManualTVal] = useState('1.000');

  const [sensors, setSensors] = useState<SensorRow[]>(
    DEMO_SENSORS.map(([r, d]) => ({ id: nextId++, r, d }))
  );
  const [layers, setLayers] = useState<LayerRow[]>(
    DEMO_LAYERS.map(l => ({ ...l, id: nextId++ }))
  );

  const [fit, setFit] = useState<FitResult | null>(null);
  const [fitting, setFitting] = useState(false);
  const [paste, setPaste] = useState('');

  const load = num(P, 0), plateA = num(a, 0);
  const q = plateA > 0 ? load / (Math.PI * plateA * plateA) : 0;

  const sensorData = useMemo(() => {
    const rows = sensors
      .map(s => ({ r: num(s.r, NaN), d: num(s.d, NaN) * MIL }))
      .filter(s => Number.isFinite(s.r) && Number.isFinite(s.d) && s.d > 0)
      .sort((x, y) => x.r - y.r);
    return { offsets: rows.map(s => s.r), defl: rows.map(s => s.d) };
  }, [sensors]);

  // Keyed on the numbers only: renaming a layer is a label change, and it
  // should not silently discard a fit the student just ran.
  const layerKey = layers.map(l => `${l.h}|${l.E}|${l.nu}`).join(';');
  const seedLayers = useMemo<Layer[]>(
    () => layers.map(l => ({ h: num(l.h, 0), E: num(l.E, 0), nu: num(l.nu, 0.35) })),
    [layerKey]
  );

  const totalD = useMemo(
    () => seedLayers.slice(0, -1).reduce((s, l) => s + l.h, 0),
    [seedLayers]
  );

  const freeCount = layers.filter(l => !l.fixed).length;
  const determined = isDetermined(sensorData.offsets.length, freeCount);

  const valid =
    load > 0 && plateA > 0 &&
    sensorData.offsets.length >= 2 &&
    seedLayers.length >= 2 &&
    seedLayers.every(l => l.E > 0) &&
    seedLayers.slice(0, -1).every(l => l.h > 0);

  // Invalidate a fit whenever its inputs change: a stale basin match shown
  // against edited data would be worse than no answer at all.
  useEffect(() => { setFit(null); }, [sensorData, seedLayers, load, plateA]);

  const runFit = () => {
    if (!valid) return;
    setFitting(true);
    // Yield a frame so the button can paint its pending state before the
    // solver takes the thread for a few hundred milliseconds.
    setTimeout(() => {
      const res = backcalculate(
        seedLayers, q, plateA, sensorData.offsets, sensorData.defl,
        {
          fixed: layers.map((l, i) => (l.fixed ? i : -1)).filter(i => i >= 0),
          lo: seedLayers.map((_, i) => (i === seedLayers.length - 1 ? 1500 : 3000)),
          hi: seedLayers.map((_, i) => (i === 0 ? 3e6 : 3e5)),
          tolPct: 0.1,
        }
      );
      setFit(res);
      setFitting(false);
    }, 30);
  };

  /* ── Route 1: the AASHTO 1993 closed form ── */
  const outer = sensorData.offsets.length
    ? sensorData.offsets.length - 1
    : -1;
  const hAc = seedLayers.length ? seedLayers[0].h : 0;
  const suggestedT = temperatureFactor(num(tempF, 68), hAc);
  const tFactor = manualT ? num(manualTVal, 1) : suggestedT;
  const aashto = useMemo(() => {
    if (!valid || outer < 0) return null;
    const d0 = sensorData.defl[0] * tFactor;
    return aashtoNdt(load, plateA, d0, sensorData.defl[outer], sensorData.offsets[outer], totalD, num(C, 0.33));
  }, [valid, outer, sensorData, tFactor, load, plateA, totalD, C]);

  const indices = useMemo(
    () => basinIndices(sensorData.offsets, sensorData.defl),
    [sensorData]
  );

  const theme = useTheme();
  const basinRef = useRef<HTMLDivElement>(null);
  const sensRef = useRef<HTMLDivElement>(null);

  /* ── Basin chart: measured vs computed ── */
  useEffect(() => {
    if (!basinRef.current || sensorData.offsets.length < 2) return;
    let canceled = false;
    (async () => {
      const Plotly = (await import('plotly.js-dist-min')).default;
      if (canceled || !basinRef.current) return;
      const c = chartColors(theme);
      const measuredHue = hueFor('deflection', theme);
      const computedHue = hueFor('stress', theme);

      // The seed basin, so the student sees what their guess predicts before
      // any fitting happens — the point being that a seed can look plausible.
      const seedBasin = valid ? basin(seedLayers, q, plateA, sensorData.offsets) : null;

      const traces: any[] = [
        {
          x: sensorData.offsets, y: sensorData.defl.map(d => d / MIL),
          name: 'Measured', mode: 'lines+markers',
          line: { color: measuredHue, width: 2.5 },
          marker: { color: measuredHue, size: 8, line: { color: c.surface, width: 2 } },
          hovertemplate: '%{x:.0f} in · %{y:.2f} mils<extra>measured</extra>',
        },
      ];
      if (fit) {
        traces.push({
          x: sensorData.offsets, y: fit.computed.map(d => d / MIL),
          name: 'Fitted', mode: 'lines+markers',
          line: { color: computedHue, width: 2, dash: 'dot' },
          marker: { color: computedHue, size: 6 },
          hovertemplate: '%{x:.0f} in · %{y:.2f} mils<extra>fitted</extra>',
        });
      } else if (seedBasin) {
        traces.push({
          x: sensorData.offsets, y: seedBasin.map(d => d / MIL),
          name: 'Seed', mode: 'lines',
          line: { color: c.secondary, width: 1.5, dash: 'dash' },
          hovertemplate: '%{x:.0f} in · %{y:.2f} mils<extra>seed guess</extra>',
        });
      }

      Plotly.react(basinRef.current, traces, baseLayout(theme, {
        height: 320,
        xaxis: axis(theme, 'Distance from load center (in)'),
        // The basin is drawn the way it deflects: down is more deflection.
        yaxis: gridAxis(theme, 'Deflection (mils)', { autorange: 'reversed' as const }),
        hovermode: 'x unified',
      }), plotConfig);
    })();
    return () => { canceled = true; };
  }, [fit, sensorData, seedLayers, q, plateA, valid, theme]);

  /* ── Sensitivity chart: which moduli the basin can actually see ── */
  useEffect(() => {
    if (!sensRef.current || !fit) return;
    let canceled = false;
    (async () => {
      const Plotly = (await import('plotly.js-dist-min')).default;
      if (canceled || !sensRef.current) return;
      const hues = LAYER_HUES(theme);
      Plotly.react(sensRef.current, [{
        type: 'bar', orientation: 'h',
        x: fit.sensitivity, y: layers.map(l => l.name),
        marker: { color: layers.map((_, i) => hues[i % hues.length]), cornerradius: 6, line: { width: 0 } },
        hovertemplate: '%{y}: %{x:.2f}%% extra RMS error<extra></extra>',
      }], baseLayout(theme, {
        height: 60 + 52 * layers.length,
        margin: { l: 110, r: 16, t: 8, b: 40 },
        xaxis: gridAxis(theme, 'Extra basin error if this modulus is 20% wrong (%)'),
        yaxis: axis(theme, undefined, { autorange: 'reversed' as const }),
        bargap: 0.4,
      }), plotConfig);
    })();
    return () => { canceled = true; };
  }, [fit, layers, theme]);

  const updateSensor = (id: number, patch: Partial<SensorRow>) =>
    setSensors(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)));
  const updateLayer = (id: number, patch: Partial<LayerRow>) =>
    setLayers(ls => ls.map(l => (l.id === id ? { ...l, ...patch } : l)));

  const applyPaste = () => {
    const parsed: SensorRow[] = [];
    for (const line of paste.split(/\r?\n/)) {
      const cells = line.trim().split(/[\t,;\s]+/).filter(Boolean);
      if (cells.length < 2) continue;
      const r = parseFloat(cells[0]), d = parseFloat(cells[1]);
      if (Number.isFinite(r) && Number.isFinite(d)) {
        parsed.push({ id: nextId++, r: String(r), d: String(d) });
      }
    }
    if (parsed.length >= 2) { setSensors(parsed); setPaste(''); }
  };

  /* The weakest-determined free layer, for the indeterminacy warning.
   * What matters is the ratio to the best-determined layer, not an absolute
   * error: a basin can be exquisitely sensitive to the subgrade and blind to
   * the surface in the same run. */
  const sensRanked = fit
    ? layers
        .map((l, i) => ({ name: l.name, s: fit.sensitivity[i], fixed: l.fixed }))
        .filter(x => !x.fixed)
        .sort((x, y) => x.s - y.s)
    : [];
  const weakest = sensRanked[0] ?? null;
  const strongest = sensRanked[sensRanked.length - 1] ?? null;
  const sensRatio = weakest && strongest && strongest.s > 0 ? weakest.s / strongest.s : 1;
  const blind = !!weakest && (sensRatio < 0.05 || weakest.s < 0.3);

  return (
    <div className="cee-tool">
      <aside className="cee-panel">
        <h2 className="cee-panel__title">Falling weight deflectometer</h2>

        <div className="cee-presets">
          {PRESETS.map(pr => (
            <button key={pr.label} type="button" className="cee-chip" title={pr.tip}
              onClick={() => {
                setP(pr.P); setA(pr.a); setTempF(pr.tempF);
                setManualT(false);
                setSensors(pr.sensors.map(([r, d]) => ({ id: nextId++, r, d })));
                setLayers(pr.layers.map(l => ({ ...l, id: nextId++ })));
              }}>{pr.label}</button>
          ))}
        </div>

        <div className="cee-field">
          <label className="cee-field__label" htmlFor="bc-p">
            <span>Plate load<Tip text="Total load delivered to the plate by the falling weight. The standard drop is 9,000 lb, which is one half of an 18-kip single axle." /></span>
            <span className="cee-field__unit">lb</span>
          </label>
          <input id="bc-p" className="cee-input" type="number" step="100" value={P}
            onChange={e => setP(e.target.value)} />
        </div>

        <div className="cee-field">
          <label className="cee-field__label" htmlFor="bc-a">
            <span>Plate radius<Tip text="Radius of the loading plate. 5.9 in (150 mm) is the standard FWD plate; the pressure follows from the load and this radius." /></span>
            <span className="cee-field__unit">in</span>
          </label>
          <input id="bc-a" className="cee-input" type="number" step="0.1" value={a}
            onChange={e => setA(e.target.value)} />
          <p className="cee-hint">Plate pressure q = {fmt(q, 1)} psi.</p>
        </div>

        <div className="cee-field">
          <span className="cee-field__label">
            <span>Deflection basin<Tip text="Sensor offset from the load center, and the peak deflection that sensor recorded. Enter deflections in mils (0.001 in), the way an FWD reports them." /></span>
            <span className="cee-field__unit">in · mils</span>
          </span>
          {sensors.map(s => (
            <div className="cee-axle-row cee-axle-row--2" key={s.id}>
              <input className="cee-input" type="number" step="1" value={s.r}
                aria-label="Sensor offset (in)" onChange={e => updateSensor(s.id, { r: e.target.value })} />
              <input className="cee-input" type="number" step="0.01" value={s.d}
                aria-label="Deflection (mils)" onChange={e => updateSensor(s.id, { d: e.target.value })} />
              <button className="cee-axle-remove" type="button" aria-label="Remove sensor"
                onClick={() => setSensors(rs => rs.filter(x => x.id !== s.id))}>×</button>
            </div>
          ))}
          <button className="cee-btn cee-btn--ghost cee-btn--sm" type="button"
            onClick={() => setSensors(rs => [...rs, { id: nextId++, r: '', d: '' }])}>+ Add sensor</button>
        </div>

        <div className="cee-field">
          <label className="cee-field__label" htmlFor="bc-paste">
            <span>Paste basin<Tip text="Two columns: sensor offset in inches, then deflection in mils." /></span>
          </label>
          <textarea id="bc-paste" className="cee-textarea" value={paste}
            onChange={e => setPaste(e.target.value)} placeholder="0&#9;18.42&#10;8&#9;13.71" />
          <button className="cee-btn cee-btn--primary cee-btn--sm" type="button"
            style={{ marginTop: '0.5rem' }} onClick={applyPaste}>Load pasted basin</button>
        </div>

        <h2 className="cee-panel__title" style={{ marginTop: '1.5rem' }}>Assumed structure</h2>
        <p className="cee-hint" style={{ marginTop: '-0.35rem' }}>
          Thicknesses come from cores or construction records and are held fixed. The moduli are
          only a starting guess — the fit moves them.
        </p>

        <div className="cee-field">
          <span className="cee-field__label">
            <span>Layers<Tip text="Top to bottom. The last layer is the subgrade half-space and its thickness is ignored. Tick 'hold' to freeze a modulus you know independently — a cored AC layer tested in the lab, for instance." /></span>
            <span className="cee-field__unit">in · psi · ν</span>
          </span>
          {layers.map((l, i) => (
            <div key={l.id} style={{ marginBottom: '0.6rem' }}>
              <input className="cee-input" type="text" value={l.name} aria-label="Layer name"
                style={{ marginBottom: '0.3rem' }}
                onChange={e => updateLayer(l.id, { name: e.target.value })} />
              <div className="cee-axle-row cee-axle-row--layer">
                <input className="cee-input" type="number" step="0.5" value={l.h}
                  disabled={i === layers.length - 1}
                  aria-label="Thickness (in)"
                  onChange={e => updateLayer(l.id, { h: e.target.value })} />
                <input className="cee-input" type="number" step="1000" value={l.E}
                  aria-label="Seed modulus (psi)"
                  onChange={e => updateLayer(l.id, { E: e.target.value })} />
                <input className="cee-input" type="number" step="0.01" value={l.nu}
                  aria-label="Poisson ratio"
                  onChange={e => updateLayer(l.id, { nu: e.target.value })} />
                {layers.length > 2 && (
                  <button className="cee-axle-remove" type="button" aria-label="Remove layer"
                    onClick={() => setLayers(ls => ls.filter(x => x.id !== l.id))}>×</button>
                )}
              </div>
              <label className="cee-hint" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem' }}>
                <input type="checkbox" checked={l.fixed}
                  onChange={e => updateLayer(l.id, { fixed: e.target.checked })} />
                Hold this modulus fixed
              </label>
            </div>
          ))}
          {layers.length < 4 && (
            <button className="cee-btn cee-btn--ghost cee-btn--sm" type="button"
              onClick={() => setLayers(ls => [
                ...ls.slice(0, -1),
                { id: nextId++, name: 'Subbase', h: '6', E: '15000', nu: '0.35', fixed: false },
                ls[ls.length - 1],
              ])}>+ Add layer</button>
          )}
        </div>

        <h2 className="cee-panel__title" style={{ marginTop: '1.5rem' }}>AASHTO route</h2>

        <div className="cee-field">
          <label className="cee-field__label" htmlFor="bc-t">
            <span>AC temperature<Tip text="Mid-depth asphalt temperature at the time of testing. Deflections are corrected to the 68°F standard before the AASHTO equations are applied." /></span>
            <span className="cee-field__unit">°F</span>
          </label>
          <input id="bc-t" className="cee-input" type="number" step="1" value={tempF}
            disabled={manualT} onChange={e => setTempF(e.target.value)} />
          <p className="cee-hint">
            Suggested d₀ factor ≈ {fmt(suggestedT, 3)} — an interpolation, <strong>not</strong>{' '}
            Figure 13.18. Read the chart and enter the real value below.
          </p>
          <label className="cee-hint" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.35rem' }}>
            <input type="checkbox" checked={manualT} onChange={e => setManualT(e.target.checked)} />
            Enter the factor from Fig. 13.18 myself
          </label>
          {manualT && (
            <input className="cee-input" type="number" step="0.01" value={manualTVal}
              aria-label="Temperature adjustment factor" style={{ marginTop: '0.35rem' }}
              onChange={e => setManualTVal(e.target.value)} />
          )}
          <p className="cee-hint">Factor in use: {fmt(tFactor, 3)}.</p>
        </div>

        <div className="cee-field">
          <label className="cee-field__label" htmlFor="bc-c">
            <span>Adjustment factor C<Tip text="AASHTO Eq. 13.23. The backcalculated subgrade modulus is reduced by C (never more than 0.33) before it is used in a design equation." /></span>
          </label>
          <input id="bc-c" className="cee-input" type="number" step="0.01" min="0.05" max="0.33" value={C}
            onChange={e => setC(e.target.value)} />
        </div>
      </aside>

      <div className="cee-results">
        <details className="cee-howto">
          <summary>How to use this tool</summary>
          <div className="cee-howto__body">
            <ol>
              <li><strong>Enter the basin and the load.</strong> Offsets in inches from the plate center, deflections in mils. The plate pressure follows from load and radius.</li>
              <li><strong>Enter the structure you believe is down there</strong> — thicknesses from cores, and a rough guess at each modulus. The guess only has to be within a factor of a few.</li>
              <li><strong>Fit.</strong> The solver adjusts the moduli until the computed basin matches the measured one, then reports how well it matched.</li>
              <li><strong>Read the sensitivity chart before you believe the moduli.</strong> A layer with low sensitivity is one the basin cannot see — its backcalculated modulus is close to arbitrary, and a different seed will give a different answer that fits just as well.</li>
              <li><strong>Compare against the AASHTO closed form.</strong> It uses one outer sensor for the subgrade and d₀ for everything above. When the two routes disagree, ask which assumption broke.</li>
            </ol>
            A basin match is necessary but not sufficient. Huang §9.4.3 records two agencies
            running the same program on the same sections and deriving very different moduli.
            Your job is to say how much of your answer is data and how much is your seed.
          </div>
        </details>

        {!valid ? (
          <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>
            Enter a load, a plate radius, at least two sensors, and at least two layers with
            positive thicknesses and seed moduli.
          </span></p>
        ) : (
          <>
            <KpiStrip>
              <Kpi accent label="Basin match (RMS)" value={fit ? fmt(fit.rmsPct, 2) : '—'} unit="%"
                tip="Root-mean-square of the per-sensor relative error. Under about 2% is a good match; a large value means the assumed structure cannot produce this basin at any moduli." />
              <Kpi label="Subgrade modulus" value={fit ? fmt(fit.E[fit.E.length - 1] / 1000, 1) : '—'} unit="ksi"
                tip="Backcalculated from the layered-elastic fit. This is the best-determined layer in almost every basin, because the outer sensors see nothing else." />
              <Kpi label="M R (AASHTO Eq. 13.22)" value={aashto ? fmt(aashto.mrBackcalculated / 1000, 1) : '—'} unit="ksi"
                tip="From one outer sensor and Boussinesq alone. Compare it with the fitted subgrade modulus — they are answering the same question with very different assumptions." />
              <Kpi label="SN eff" value={aashto?.snEff ? fmt(aashto.snEff, 2) : '—'}
                tip="Effective structural number of the existing pavement, AASHTO Eq. 13.26. This is what an overlay design subtracts from the SN a new pavement would need." />
            </KpiStrip>

            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', margin: '0.25rem 0 1rem' }}>
              <button className="cee-btn cee-btn--primary" type="button"
                onClick={runFit} disabled={fitting}>
                {fitting ? 'Fitting…' : fit ? 'Re-fit moduli' : 'Fit moduli to the basin'}
              </button>
              {fit && (
                <span className="cee-hint" style={{ margin: 0 }}>
                  {fit.converged ? 'Converged' : 'Stopped at a local minimum'} after {fit.iterations} iteration{fit.iterations === 1 ? '' : 's'}.
                </span>
              )}
              {!fit && !fitting && (
                <span className="cee-hint" style={{ margin: 0 }}>
                  The dashed line is what your seed moduli predict.
                </span>
              )}
            </div>

            {!determined && (
              <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>
                You are asking for <strong>{freeCount} free moduli</strong> from{' '}
                <strong>{sensorData.offsets.length} sensor{sensorData.offsets.length === 1 ? '' : 's'}</strong>.
                There are at least as many unknowns as measurements, so the fit can drive the error
                to zero through infinitely many different modulus sets — <strong>a perfect basin
                match here means nothing</strong>. Add sensors, or hold a modulus fixed at a value
                you know independently.
              </span></p>
            )}

            {fit && fit.rmsPct > 3 && (
              <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>
                The best match is <strong>{fmt(fit.rmsPct, 1)}% RMS</strong>, which is poor. No set of
                moduli for <em>this</em> layer structure reproduces the measured basin. Something in the
                assumed section is wrong — a thickness, a missing stiff or soft layer, a rigid bottom, or
                a cracked layer that is not behaving elastically at all.
              </span></p>
            )}

            {fit && blind && weakest && strongest && (
              <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>
                The basin is nearly blind to <strong>{weakest.name}</strong>: being 20% wrong about its
                modulus costs only {fmt(weakest.s, 2)}% extra error, about{' '}
                <strong>{fmt(strongest.s / Math.max(weakest.s, 1e-6), 0)}× less</strong> than the same
                error in {strongest.name}. Its backcalculated value is <strong>not determined by this
                data</strong>. Report it as a range, or hold it fixed at a value from cores and re-fit.
              </span></p>
            )}

            {aashto && aashto.sensorFarEnough === false && (
              <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>
                The outer sensor at {fmt(sensorData.offsets[outer], 0)} in is closer than the
                minimum {fmt(aashto.rMin ?? 0, 1)} in required by Eq. 13.24, so it still sees the layers
                above the subgrade. The M<sub>R</sub> from Eq. 13.22 is <strong>too high</strong>. Use a
                sensor further out.
              </span></p>
            )}

            <ChartFigure
              title="Deflection basin"
              subtitle={fit
                ? 'Measured basin against the basin computed from the fitted moduli'
                : 'Measured basin against the basin your seed moduli predict'}
              plotRef={basinRef}
              legend={[
                { label: 'Measured', color: hueFor('deflection', theme) },
                fit
                  ? { label: 'Fitted', color: hueFor('stress', theme), shape: 'dash' as const }
                  : { label: 'Seed', color: chartColors(theme).secondary, shape: 'dash' as const },
              ]}
              takeaway={fit
                ? `The fitted moduli reproduce the measured basin to ${fmt(fit.rmsPct, 2)}% RMS, with the largest single-sensor error ${fmt(fit.maxErrPct, 1)}%.`
                : 'The seed moduli produce this basin; fit to move them until it matches the measurement.'}
            >
              The basin is plotted the way the pavement moves — <strong>down is more deflection</strong>.
              Read it from the outside in: the far sensors are outside the stress zone of the bound
              layers, so they carry information about the <em>subgrade only</em>. Each sensor closer to
              the plate adds one more layer to what the reading depends on. That nesting is the whole
              basis of backcalculation, and it is also why the surface layer is always the least
              certain — by the time you get to d₀, every layer is in the answer at once.
            </ChartFigure>

            {fit && (
              <ChartFigure
                title="How much of each modulus the basin actually determines"
                subtitle="Extra RMS error caused by moving one modulus 20% off its fitted value"
                plotRef={sensRef}
                takeaway={weakest
                  ? `${weakest.name} is the least determined layer: a 20% error in it costs only ${fmt(weakest.s, 2)}% extra basin error.`
                  : 'Every layer is well determined by this basin.'}
              >
                A long bar means the basin <em>notices</em> that layer: get its modulus wrong and the
                match falls apart, so the backcalculated value is trustworthy. A short bar means the
                opposite — that modulus could be off by a factor of two and the basin would barely
                change, so what you are reading is mostly your seed guess coming back to you. This is
                Huang's warning in §9.4.3 made measurable: <em>"a good match between computed and
                measured deflections can be obtained even if totally unreasonable moduli are derived
                for these thin layers."</em>
              </ChartFigure>
            )}

            {fit && (
              <div className="cee-tablewrap">
                <table className="cee-table">
                  <thead>
                    <tr>
                      <th>Sensor (in)</th>
                      <th>Measured (mils)</th>
                      <th>Computed (mils)</th>
                      <th>Error (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sensorData.offsets.map((r, i) => (
                      <tr key={i}>
                        <td>{fmt(r, 0)}</td>
                        <td>{fmt(sensorData.defl[i] / MIL, 2)}</td>
                        <td>{fmt(fit.computed[i] / MIL, 2)}</td>
                        <td>{fit.errorsPct[i] >= 0 ? '+' : ''}{fmt(fit.errorsPct[i], 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="cee-chart-grid">
              <Card title="Backcalculated moduli"
                subtitle="Layered-elastic fit — the exact Burmister solution inverted">
                <div className="cee-tablewrap">
                  <table className="cee-table">
                    <thead>
                      <tr><th>Layer</th><th>Thickness (in)</th><th>Seed (ksi)</th><th>Fitted (ksi)</th></tr>
                    </thead>
                    <tbody>
                      {layers.map((l, i) => (
                        <tr key={l.id}>
                          <td>{l.name}{l.fixed && ' (held)'}</td>
                          <td>{i === layers.length - 1 ? '∞' : fmt(num(l.h, 0), 1)}</td>
                          <td>{fmt(num(l.E, 0) / 1000, 1)}</td>
                          <td>{fit ? fmt(fit.E[i] / 1000, 1) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card title="AASHTO 1993 closed form"
                subtitle="Eqs. 13.22–13.26, from d₀ and one outer sensor only">
                <div className="cee-tablewrap">
                  <table className="cee-table">
                    <tbody>
                      <tr><td>M<sub>R</sub> backcalculated (Eq. 13.22)</td>
                        <td>{aashto ? `${fmt(aashto.mrBackcalculated / 1000, 1)} ksi` : '—'}</td></tr>
                      <tr><td>Design M<sub>R</sub> = C · M<sub>R</sub> (Eq. 13.23)</td>
                        <td>{aashto ? `${fmt(aashto.mrDesign / 1000, 2)} ksi` : '—'}</td></tr>
                      <tr><td>E<sub>p</sub>, layers above subgrade (Eq. 13.25)</td>
                        <td>{aashto?.Ep ? `${fmt(aashto.Ep / 1000, 0)} ksi` : '—'}</td></tr>
                      <tr><td>E<sub>p</sub> / M<sub>R</sub></td>
                        <td>{aashto?.epOverMr ? fmt(aashto.epOverMr, 1) : '—'}</td></tr>
                      <tr><td>Minimum sensor offset (Eq. 13.24)</td>
                        <td>{aashto?.rMin ? `${fmt(aashto.rMin, 1)} in` : '—'}</td></tr>
                      <tr><td>SN<sub>eff</sub> (Eq. 13.26)</td>
                        <td>{aashto?.snEff ? fmt(aashto.snEff, 2) : '—'}</td></tr>
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            <Card title="Basin indices"
              subtitle="Sensor differences, each dominated by a different depth band">
              <div className="cee-tablewrap">
                <table className="cee-table">
                  <thead>
                    <tr><th>Index</th><th>Sensors</th><th>Value</th><th>Reads</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>SCI</td><td>d₀ − d₁₂</td>
                      <td>{indices.sci === null ? '—' : `${fmt(indices.sci / MIL, 2)} mils`}</td>
                      <td>the bound surface</td></tr>
                    <tr><td>BDI</td><td>d₁₂ − d₂₄</td>
                      <td>{indices.bdi === null ? '—' : `${fmt(indices.bdi / MIL, 2)} mils`}</td>
                      <td>base and subbase</td></tr>
                    <tr><td>BCI</td><td>d₂₄ − d₃₆</td>
                      <td>{indices.bci === null ? '—' : `${fmt(indices.bci / MIL, 2)} mils`}</td>
                      <td>the upper subgrade</td></tr>
                    <tr><td>Area</td><td>d₀…d₃₆</td>
                      <td>{indices.area === null ? '—' : `${fmt(indices.area, 1)} in`}</td>
                      <td>overall stiffness — 36 in is a perfectly rigid basin</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="cee-note" style={{ marginTop: '0.75rem' }}>
                The indices need sensors at 0, 12, 24, and 36 in to be defined; values here are
                interpolated between whatever sensors you entered. They are a cheap, model-free
                cross-check: if the fit says the base is stiff but BDI is large, one of the two is wrong.
              </p>
            </Card>

            <p className="cee-note">
              Layered-elastic route: Huang (2004) App. B, inverted by Levenberg–Marquardt on ln E.
              AASHTO route: Eqs. 13.22–13.26 (§13.5.2), which rest on Odemark's two-layer
              approximation rather than Burmister's theory — Huang Table 13.10 compares the two and
              the difference is not small. Backcalculation is non-unique by nature; report the seed
              you started from along with the moduli you ended at.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
