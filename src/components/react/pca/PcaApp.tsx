// PCA Rigid Thickness — fatigue and erosion damage summation over an axle
// load distribution, following Huang (2004) §12.2 / PCA (1984).
// Supports HW9 Problems 12-3 and 12-4.
import { useMemo, useRef, useEffect, useState } from 'react';
import Tip from '../Tip';
import {
  useTheme, baseLayout, plotConfig, num, fmt,
  axis, gridAxis, HUES,
} from '../chartTheme';
import ChartFigure from '../ui/ChartFigure';
import KpiStrip, { Kpi } from '../ui/KpiStrip';
import ShareRows from '../ui/ShareRows';
import { pcaAnalyse, type AxleType, type LoadGroup } from './equations.ts';
import '../tools.css';

interface Row { id: number; load: string; type: AxleType; reps: string }
let nextId = 100;

/** Huang Problem 12-3 axle load distribution, axles per 1000 trucks. */
const DEMO: Omit<Row, 'id'>[] = [
  { load: '16', type: 'single', reps: '130.9' },
  { load: '18', type: 'single', reps: '110.8' },
  { load: '20', type: 'single', reps: '65.4' },
  { load: '22', type: 'single', reps: '15.6' },
  { load: '24', type: 'single', reps: '2.3' },
  { load: '26', type: 'single', reps: '1.9' },
  { load: '28', type: 'single', reps: '0.9' },
  { load: '24', type: 'tandem', reps: '80.2' },
  { load: '28', type: 'tandem', reps: '34.4' },
  { load: '32', type: 'tandem', reps: '24.0' },
  { load: '36', type: 'tandem', reps: '17.2' },
  { load: '40', type: 'tandem', reps: '16.8' },
  { load: '44', type: 'tandem', reps: '10.5' },
  { load: '48', type: 'tandem', reps: '9.6' },
];

export default function PcaApp() {
  const [rows, setRows] = useState<Row[]>(DEMO.map(r => ({ ...r, id: nextId++ })));
  const [esSingle, setEsSingle] = useState('206');
  const [esTandem, setEsTandem] = useState('192');
  const [efSingle, setEfSingle] = useState('2.82');
  const [efTandem, setEfTandem] = useState('2.99');
  const [sc, setSc] = useState('650');
  const [lsf, setLsf] = useState('1.1');
  const [c1, setC1] = useState('1.0');
  const [shoulders, setShoulders] = useState(false);
  const [trucks, setTrucks] = useState('6387500');

  const theme = useTheme();
  const chartRef = useRef<HTMLDivElement>(null);

  const res = useMemo(() => {
    const scale = num(trucks, 0) / 1000;   // rows are axles per 1000 trucks
    const groups: LoadGroup[] = rows
      .map(r => ({ load: num(r.load, 0), type: r.type, reps: num(r.reps, 0) * (scale > 0 ? scale : 1) }))
      .filter(g => g.load > 0 && g.reps > 0);
    if (!groups.length || num(sc, 0) <= 0) return null;
    return pcaAnalyse(groups, {
      equivalentStress: { single: num(esSingle, 206), tandem: num(esTandem, 192) },
      erosionFactor: { single: num(efSingle, 2.82), tandem: num(efTandem, 2.99) },
      modulusOfRupture: num(sc, 650),
      lsf: num(lsf, 1.1),
      c1: num(c1, 1),
      c2: shoulders ? 0.94 : 0.06,
    });
  }, [rows, esSingle, esTandem, efSingle, efTandem, sc, lsf, c1, shoulders, trucks]);

  useEffect(() => {
    if (!res || !chartRef.current) return;
    let cancelled = false;
    (async () => {
      const Plotly = (await import('plotly.js-dist-min')).default;
      if (cancelled || !chartRef.current) return;
      // §A8.1 paired bars: two series sharing a unit (percent of allowable),
      // one criterion against the other, per load group.
      const labels = res.rows.map(r => `${r.load}${r.type === 'single' ? 'S' : 'T'}`);
      Plotly.react(chartRef.current, [
        {
          x: labels, y: res.rows.map(r => r.fatigueDamage), name: 'Fatigue',
          type: 'bar', marker: { color: HUES[theme].orange, cornerradius: 6 },
          hovertemplate: '%{x}: %{y:.2f}% fatigue<extra></extra>',
        },
        {
          x: labels, y: res.rows.map(r => r.erosionDamage), name: 'Erosion',
          type: 'bar', marker: { color: HUES[theme].blue, cornerradius: 6 },
          hovertemplate: '%{x}: %{y:.2f}% erosion<extra></extra>',
        },
      ], baseLayout(theme, {
        height: 320,
        barmode: 'group', bargap: 0.4, bargroupgap: 0.1,
        xaxis: axis(theme, 'Axle load group (S = single, T = tandem)'),
        yaxis: gridAxis(theme, 'Damage (%)', { rangemode: 'tozero' as const }),
        hovermode: 'x unified' as const,
      }), plotConfig);
    })();
    return () => { cancelled = true; };
  }, [res, theme]);

  const update = (id: number, patch: Partial<Row>) =>
    setRows(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <div className="cee-tool">
      <aside className="cee-panel">
        <h2 className="cee-panel__title">Table values</h2>
        <p className="cee-hint" style={{ marginTop: 0 }}>
          Read for your trial thickness and k from Huang Tables 12.6–12.7 (stress)
          and 12.8–12.11 (erosion), for the standard 18-kip single and 36-kip tandem.
        </p>
        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="pca-es1">
              <span>σe single<Tip text="Equivalent stress for the standard 18-kip single axle, from Table 12.6 (no shoulders) or 12.7 (concrete shoulders)." /></span>
              <span className="cee-field__unit">psi</span>
            </label>
            <input id="pca-es1" className="cee-input" type="number" min="1" step="1" value={esSingle}
              onChange={e => setEsSingle(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="pca-es2">
              <span>σe tandem<Tip text="Equivalent stress for the standard 36-kip tandem axle — the right-hand number in each table cell." /></span>
              <span className="cee-field__unit">psi</span>
            </label>
            <input id="pca-es2" className="cee-input" type="number" min="1" step="1" value={esTandem}
              onChange={e => setEsTandem(e.target.value)} />
          </div>
        </div>
        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="pca-ef1">
              <span>Erosion factor single<Tip text="From Table 12.8 (doweled, no shoulders), 12.9 (aggregate interlock, no shoulders), or 12.10/12.11 with concrete shoulders." /></span>
              <span className="cee-field__unit">–</span>
            </label>
            <input id="pca-ef1" className="cee-input" type="number" min="0" step="0.01" value={efSingle}
              onChange={e => setEfSingle(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="pca-ef2">
              <span>Erosion factor tandem<Tip text="The tandem value from the same table cell." /></span>
              <span className="cee-field__unit">–</span>
            </label>
            <input id="pca-ef2" className="cee-input" type="number" min="0" step="0.01" value={efTandem}
              onChange={e => setEfTandem(e.target.value)} />
          </div>
        </div>

        <h2 className="cee-panel__title" style={{ marginTop: '1rem' }}>Design factors</h2>
        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="pca-sc">
              <span>Modulus of rupture<Tip text="28-day flexural strength, third-point loading. The design tables already fold in a 15% reduction for variability." /></span>
              <span className="cee-field__unit">psi</span>
            </label>
            <input id="pca-sc" className="cee-input" type="number" min="1" step="10" value={sc}
              onChange={e => setSc(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="pca-lsf">
              <span>Load safety factor<Tip text="1.2 for interstates and multilane with uninterrupted flow, 1.1 for arterials with moderate truck volume, 1.0 for roads with few trucks. It multiplies the axle loads." /></span>
              <span className="cee-field__unit">–</span>
            </label>
            <input id="pca-lsf" className="cee-input" type="number" min="1" max="1.3" step="0.05" value={lsf}
              onChange={e => setLsf(e.target.value)} />
          </div>
        </div>
        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="pca-c1">
              <span>C₁ subbase<Tip text="1.0 for an untreated subbase, 0.9 for a stabilized one (Huang Eq. 12.7)." /></span>
              <span className="cee-field__unit">–</span>
            </label>
            <input id="pca-c1" className="cee-input" type="number" min="0.8" max="1" step="0.05" value={c1}
              onChange={e => setC1(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="pca-tr">
              <span>Trucks in design period<Tip text="Total trucks over the design period. The rows below are axles per 1000 trucks, so they are scaled by this divided by 1000." /></span>
              <span className="cee-field__unit">–</span>
            </label>
            <input id="pca-tr" className="cee-input" type="text" value={trucks}
              onChange={e => setTrucks(e.target.value)} />
          </div>
        </div>
        <label className="cee-field__label" style={{ marginTop: '0.25rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input type="checkbox" checked={shoulders} onChange={e => setShoulders(e.target.checked)} />
            Tied concrete shoulders
          </span>
        </label>
        <p className="cee-hint">
          C₂ = {shoulders ? '0.94' : '0.06'} — Huang Eq. 12.9. With a concrete shoulder the
          corner deflection barely depends on where the truck tracks, so a much
          larger C₂ applies.
        </p>

        <h2 className="cee-panel__title" style={{ marginTop: '1rem' }}>Axle load distribution</h2>
        <div className="cee-field">
          <span className="cee-field__label">
            <span>Load groups<Tip text="Axle load in kip, type, and axles per 1000 trucks — column 2 of a W-4 style table." /></span>
            <span className="cee-field__unit">kip · type · per 1000</span>
          </span>
          {rows.map(r => (
            <div className="cee-axle-row" key={r.id}>
              <input className="cee-input" type="number" min="0" step="1" value={r.load}
                aria-label="Axle load (kip)" onChange={e => update(r.id, { load: e.target.value })} />
              <select className="cee-select" value={r.type} aria-label="Axle type"
                onChange={e => update(r.id, { type: e.target.value as AxleType })}>
                <option value="single">Single</option>
                <option value="tandem">Tandem</option>
              </select>
              <input className="cee-input" type="number" min="0" step="0.1" value={r.reps}
                aria-label="Axles per 1000 trucks" onChange={e => update(r.id, { reps: e.target.value })} />
              <button className="cee-axle-remove" type="button" aria-label="Remove load group"
                onClick={() => setRows(rs => rs.filter(x => x.id !== r.id))}>×</button>
            </div>
          ))}
          <button className="cee-btn cee-btn--ghost cee-btn--sm" type="button"
            onClick={() => setRows(rs => [...rs, { id: nextId++, load: '20', type: 'single', reps: '10' }])}>
            + Add load group
          </button>
        </div>
      </aside>

      <div className="cee-results">
        <details className="cee-howto">
          <summary>How to use this tool</summary>
          <div className="cee-howto__body">
            <ol>
              <li><strong>Assume a trial thickness</strong>, then read the four table values for that thickness and your k — equivalent stress and erosion factor, each for the standard single and tandem axle.</li>
              <li><strong>Enter the axle load distribution</strong> as axles per 1000 trucks, and the total trucks over the design period.</li>
              <li><strong>Check both totals.</strong> Fatigue and erosion are independent criteria and <em>both</em> must come out at or under 100%.</li>
              <li><strong>Iterate the thickness</strong> in ½ in steps until both pass, then step back down to confirm you have the thinnest section that works.</li>
            </ol>
            Fatigue usually governs thin slabs under light traffic; erosion governs thick slabs under heavy traffic. Which one binds tells you what the design is actually limited by.
          </div>
        </details>

        {!res ? (
          <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>
            Enter at least one load group with a positive load and repetition count, and a positive
            modulus of rupture.
          </span></p>
        ) : (
          <>
            <KpiStrip>
              <Kpi accent label="Fatigue damage" value={fmt(res.fatigueTotal, 1)} unit="%"
                tip="Sum of n/N over every load group. Must be at or below 100%." />
              <Kpi label="Erosion damage" value={fmt(res.erosionTotal, 1)} unit="%"
                tip="Sum of C₂·n/N over every load group (Huang Eq. 12.9). Must also be at or below 100%." />
              <Kpi compact label="Governing criterion" value={res.governing === 'erosion' ? 'Erosion' : 'Fatigue'}
                tip="Whichever total is larger is what limits this design — and tells you which failure mode the slab is actually close to." />
              <Kpi compact label="Verdict" value={res.adequate ? 'Adequate' : 'Too thin'}
                tip="Both criteria must pass. If either exceeds 100%, increase the trial thickness by half an inch and re-read the tables." />
            </KpiStrip>

            {!res.adequate && (
              <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>
                This trial thickness <strong>fails</strong> on{' '}
                {res.fatigueTotal > 100 && res.erosionTotal > 100 ? 'both criteria'
                  : res.fatigueTotal > 100 ? 'fatigue' : 'erosion'}.
                Increase the thickness by ½ in, re-read the four table values, and run it again.
              </span></p>
            )}

            <ChartFigure
              title="Damage by axle load group"
              subtitle="Fatigue and erosion contributions per load group, as a percentage of allowable"
              plotRef={chartRef}
              legend={[
                { label: 'Fatigue', color: HUES[theme].orange },
                { label: 'Erosion', color: HUES[theme].blue },
              ]}
              takeaway={`${res.governing === 'erosion' ? 'Erosion' : 'Fatigue'} governs this section, and the damage is concentrated in the heaviest load groups.`}
            >
              Damage is <strong>overwhelmingly concentrated in the heaviest axles</strong> — the light
              groups carry most of the repetitions but contribute almost nothing, because both criteria
              are steeply non-linear in load. A handful of overloaded trucks can matter more than
              hundreds of thousands of legal ones, which is the argument for weight enforcement rather
              than thicker pavement.
            </ChartFigure>

            <ShareRows
              theme={theme}
              rows={[
                { label: 'Fatigue', value: Math.max(res.fatigueTotal, 0.001), color: HUES[theme].orange },
                { label: 'Erosion', value: Math.max(res.erosionTotal, 0.001), color: HUES[theme].blue },
              ]}
              format={v => `${v.toFixed(1)}% of allowable`}
            />

            <div className="cee-tablewrap">
              <table className="cee-table">
                <thead>
                  <tr>
                    <th>Load (kip)</th>
                    <th>Type</th>
                    <th>×LSF</th>
                    <th>Repetitions</th>
                    <th>Stress ratio</th>
                    <th>N fatigue</th>
                    <th>Fatigue %</th>
                    <th>N erosion</th>
                    <th>Erosion %</th>
                  </tr>
                </thead>
                <tbody>
                  {res.rows.map((r, i) => (
                    <tr key={i}>
                      <td>{r.load}</td>
                      <td>{r.type === 'single' ? 'Single' : 'Tandem'}</td>
                      <td>{r.factored.toFixed(1)}</td>
                      <td>{r.reps.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                      <td>{r.stressRatio.toFixed(3)}</td>
                      <td>{Number.isFinite(r.fatigueN) ? r.fatigueN.toExponential(2) : 'unlimited'}</td>
                      <td>{r.fatigueDamage.toFixed(2)}</td>
                      <td>{Number.isFinite(r.erosionN) ? r.erosionN.toExponential(2) : 'unlimited'}</td>
                      <td>{r.erosionDamage.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td><strong>Total</strong></td>
                    <td colSpan={5}></td>
                    <td><strong>{res.fatigueTotal.toFixed(2)}</strong></td>
                    <td></td>
                    <td><strong>{res.erosionTotal.toFixed(2)}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="cee-note">
              PCA (1984) as presented in Huang §12.2. Fatigue uses the stress-ratio criterion — no
              damage below a ratio of 0.45, then two branches meeting at 0.55. Erosion uses Eq. 12.7,
              log N = 14.524 − 6.777(C₁P − 9.0)^0.103, with the rate of work P of Eq. 12.8 and the
              damage sum of Eq. 12.9 carrying C₂.
              <br /><br />
              Stress scales linearly with axle load and P with its square, so both are projected from
              the standard-axle table values you enter. The link from the tabulated erosion factor to
              P is calibrated against Huang's own worked examples and reproduces Example 12.3 to
              within 4% on both axles.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
