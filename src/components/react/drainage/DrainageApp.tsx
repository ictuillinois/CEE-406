// Drainage Designer — inflow estimation, drainage-layer capacity, collector
// pipe sizing, and filter criteria, following Huang (2004) Chapter 8.
//
// Covers HW6: Problem 8.6 (surface infiltration by Eq. 8.18 and Cedergren's
// method), Problem 8.8 (meltwater from ice lenses), Problem 8.10 (Manning
// pipe capacity). FHWA's DRIP does the same job as a desktop program.
//
// One deliberate limitation: the chart step in the meltwater calculation
// (Huang Fig. 8.15) is a user input rather than a digitized curve family —
// see the note in the tool.
import { useEffect, useMemo, useRef, useState } from 'react';
import Tip from '../Tip';
import {
  useTheme, chartColors, baseLayout, plotConfig, num, fmt,
  axis, gridAxis, hueFor, HUES, areaFill,
} from '../chartTheme';
import ChartFigure from '../ui/ChartFigure';
import KpiStrip, { Kpi } from '../ui/KpiStrip';
import ShareRows from '../ui/ShareRows';
import {
  infiltrationRidgeway, infiltrationCedergren, groundwaterAboveDrain,
  radiusOfInfluence, consolidationPressure, meltwaterInflow, designInflow,
  drainageCapacity, pipeCapacity, maxLateralInflow, filterCriteria,
  slopeFactor, timeToDrain, HEAVE_TABLE,
} from './equations';
import '../tools.css';

type Tab = 'inflow' | 'capacity' | 'pipe';

export default function DrainageApp() {
  const [tab, setTab] = useState<Tab>('inflow');

  /* Surface infiltration */
  const [lanes, setLanes] = useState('2');
  const [wp, setWp] = useState('22');
  const [cs, setCs] = useState('40');
  const [precip, setPrecip] = useState('1.2');
  const [cedLo, setCedLo] = useState('0.33');
  const [cedHi, setCedHi] = useState('0.50');

  /* Groundwater */
  const [kSoil, setKSoil] = useState('0.5');
  const [hTot, setHTot] = useState('25');
  const [h0, setH0] = useState('20');
  const [q2, setQ2] = useState('0');
  const [roadW, setRoadW] = useState('44');
  const [oneSided, setOneSided] = useState(false);

  /* Meltwater */
  const [layerT, setLayerT] = useState('4');
  const [layerG, setLayerG] = useState('145');
  const [layer2T, setLayer2T] = useState('10');
  const [layer2G, setLayer2G] = useState('120');
  const [qmRatio, setQmRatio] = useState('0.30');
  const [kSub, setKSub] = useState('0.05');

  /* Drainage layer */
  const [kDrain, setKDrain] = useState('10000');
  const [hDrain, setHDrain] = useState('8');
  const [slope, setSlope] = useState('0.04');
  const [lDrain, setLDrain] = useState('18');
  const [poros, setPoros] = useState('0.25');
  const [timeFactor, setTimeFactor] = useState('0.24');

  /* Pipe */
  const [pipeD, setPipeD] = useState('4');
  const [manningN, setManningN] = useState('0.01');
  const [pipeS, setPipeS] = useState('0.025');
  const [outletSp, setOutletSp] = useState('300');

  /* Filter */
  const [f15, setF15] = useState('0.5');
  const [f50, setF50] = useState('1.5');
  const [f85, setF85] = useState('3');
  const [s15, setS15] = useState('0.05');
  const [s50, setS50] = useState('0.2');
  const [s85, setS85] = useState('0.4');

  const theme = useTheme();
  const inflowRef = useRef<HTMLDivElement>(null);
  const capRef = useRef<HTMLDivElement>(null);

  /* ── Inflow ── */
  const inflow = useMemo(() => {
    const N = Math.max(1, num(lanes, 2));
    const Wp = num(wp, 22), Cs = num(cs, 40);
    if (Wp <= 0 || Cs <= 0) return null;

    const ridge = infiltrationRidgeway(N, Wp, Cs);
    const cLo = infiltrationCedergren(num(precip, 1.2), num(cedLo, 0.33));
    const cHi = infiltrationCedergren(num(precip, 1.2), num(cedHi, 0.5));

    const q1 = groundwaterAboveDrain(num(kSoil, 0.5), num(hTot, 25), num(h0, 20));
    const Li = radiusOfInfluence(num(hTot, 25), num(h0, 20));
    const W = Math.max(1, num(roadW, 44));
    const q2v = num(q2, 0);
    const qg = oneSided ? (q1 + 2 * q2v) / W : (2 * q2v) / W;

    const sigmaP = consolidationPressure([
      { t: num(layerT, 4), g: num(layerG, 145) },
      { t: num(layer2T, 10), g: num(layer2G, 120) },
    ]);
    const qm = meltwaterInflow(num(qmRatio, 0.3), num(kSub, 0.05));

    // Ridgeway is ft³/h/ft²; groundwater and meltwater are ft³/day/ft².
    const qiDay = ridge.qArea * 24;
    const d = designInflow(qiDay, qg, qm);

    return { ridge, qiDay, cLo, cHi, q1, Li, qg, sigmaP, qm, ...d };
  }, [lanes, wp, cs, precip, cedLo, cedHi, kSoil, hTot, h0, q2, roadW, oneSided,
      layerT, layerG, layer2T, layer2G, qmRatio, kSub]);

  /* ── Capacity ── */
  const capacity = useMemo(() => {
    const k = num(kDrain, 10000), H = num(hDrain, 8) / 12;
    const S = num(slope, 0.04), L = num(lDrain, 18), ne = num(poros, 0.25);
    if (k <= 0 || H <= 0 || L <= 0) return null;
    const q = drainageCapacity(k, H, S, L);
    // Required capacity is the governing design inflow over the drainage length.
    const required = inflow ? inflow.governing * L : NaN;
    const S1 = slopeFactor(L, S, H);
    // t = T·n_e·L²/(kH); T comes from the degree-of-drainage chart.
    const tDrain = timeToDrain(ne, L, k, H, num(timeFactor, 0.24)) * 24;  // hours
    return { q, required, S1, tDrain, adequate: Number.isFinite(required) ? q >= required : true };
  }, [kDrain, hDrain, slope, lDrain, poros, timeFactor, inflow]);

  /* ── Pipe & filter ── */
  const pipe = useMemo(() => {
    const D = num(pipeD, 4), n = num(manningN, 0.01), S = num(pipeS, 0.025);
    const Lo = num(outletSp, 300);
    if (D <= 0 || n <= 0 || S <= 0 || Lo <= 0) return null;
    const cap = pipeCapacity(D, n, S);
    return { ...cap, qL: maxLateralInflow(D, n, S, Lo) };
  }, [pipeD, manningN, pipeS, outletSp]);

  const filt = useMemo(() => filterCriteria(
    { d15: num(f15, 0.5), d50: num(f50, 1.5), d85: num(f85, 3) },
    { d15: num(s15, 0.05), d50: num(s50, 0.2), d85: num(s85, 0.4) }
  ), [f15, f50, f85, s15, s50, s85]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const Plotly = (await import('plotly.js-dist-min')).default;
      if (cancelled) return;
      const c = chartColors(theme);

      if (tab === 'inflow' && inflowRef.current && inflow) {
        // Ridgeway vs Cedergren across the plausible coefficient range —
        // the comparison Problem 8.6 asks for.
        const coeffs: number[] = [];
        for (let x = 0.3; x <= 0.7001; x += 0.01) coeffs.push(x);
        Plotly.react(inflowRef.current, [
          {
            x: coeffs, y: coeffs.map(x => infiltrationCedergren(num(precip, 1.2), x) * 24),
            name: 'Cedergren', mode: 'lines',
            line: { color: hueFor('deflection', theme), width: 2.5 },
            hovertemplate: 'coeff %{x:.2f} · %{y:.3f} ft³/day/ft²<extra></extra>',
          },
          {
            x: coeffs, y: coeffs.map(() => inflow.qiDay),
            name: 'Ridgeway (Eq. 8.18)', mode: 'lines',
            line: { color: hueFor('stress', theme), width: 2.5, dash: 'dash' },
            hovertemplate: 'Ridgeway %{y:.3f} ft³/day/ft²<extra></extra>',
          },
        ], baseLayout(theme, {
          xaxis: axis(theme, 'Cedergren coefficient'),
          yaxis: gridAxis(theme, 'Surface infiltration (ft³/day/ft²)', { rangemode: 'tozero' as const }),
          hovermode: 'x unified' as const,
        }), plotConfig);
      }

      if (tab === 'capacity' && capRef.current && capacity) {
        // Capacity against drainage-layer thickness, with the requirement.
        const hs: number[] = [], qs: number[] = [];
        for (let h = 2; h <= 18.01; h += 0.25) {
          hs.push(h);
          qs.push(drainageCapacity(num(kDrain, 10000), h / 12, num(slope, 0.04), num(lDrain, 18)));
        }
        const hue = hueFor('deflection', theme);
        Plotly.react(capRef.current, [
          {
            x: hs, y: qs, name: 'Capacity', mode: 'lines',
            line: { color: hue, width: 2.5 }, fill: 'tozeroy', ...areaFill(hue),
            hovertemplate: 'H %{x:.1f} in · %{y:,.0f} ft³/day/ft<extra></extra>',
          },
        ], baseLayout(theme, {
          xaxis: axis(theme, 'Drainage layer thickness H (in)'),
          yaxis: gridAxis(theme, 'Discharge capacity (ft³/day/ft)', { rangemode: 'tozero' as const }),
          hovermode: 'x unified' as const,
          shapes: Number.isFinite(capacity.required) ? [{
            type: 'line', xref: 'paper', x0: 0, x1: 1, y0: capacity.required, y1: capacity.required,
            line: { color: c.secondary, width: 1, dash: 'dash' },
          }] : [],
          annotations: Number.isFinite(capacity.required) ? [{
            xref: 'paper', x: 0.01, y: capacity.required,
            text: `required ${capacity.required.toFixed(1)} ft³/day/ft`,
            showarrow: false, yshift: 9, xanchor: 'left' as const, font: { size: 10, color: c.fg },
          }] : [],
        }), plotConfig);
      }
    })();
    return () => { cancelled = true; };
  }, [tab, inflow, capacity, theme, precip, kDrain, slope, lDrain]);

  const field = (id: string, label: React.ReactNode, unit: string, val: string,
                 set: (v: string) => void, step = '1') => (
    <div className="cee-field">
      <label className="cee-field__label" htmlFor={id}>
        <span>{label}</span>
        <span className="cee-field__unit">{unit}</span>
      </label>
      <input id={id} className="cee-input" type="number" step={step} value={val}
        onChange={e => set(e.target.value)} />
    </div>
  );

  return (
    <div className="cee-tool">
      <aside className="cee-panel">
        <h2 className="cee-panel__title">Stage</h2>
        <div className="cee-seg" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'inflow'}
            className={tab === 'inflow' ? 'is-active' : ''} onClick={() => setTab('inflow')}>Inflow</button>
          <button type="button" role="tab" aria-selected={tab === 'capacity'}
            className={tab === 'capacity' ? 'is-active' : ''} onClick={() => setTab('capacity')}>Capacity</button>
          <button type="button" role="tab" aria-selected={tab === 'pipe'}
            className={tab === 'pipe' ? 'is-active' : ''} onClick={() => setTab('pipe')}>Pipe &amp; filter</button>
        </div>

        {tab === 'inflow' && (
          <>
            <h2 className="cee-panel__title" style={{ marginTop: '1rem' }}>Surface infiltration</h2>
            <div className="cee-row">
              {field('dr-n', <span>Traffic lanes N<Tip text="Number of traffic lanes. Eq. 8.18 assumes N + 1 longitudinal cracks — one at each lane edge." /></span>, '–', lanes, setLanes)}
              {field('dr-wp', <span>Width W_p<Tip text="Width of pavement subject to infiltration — the traffic lanes. In Problem 8.6 that is the 22 ft roadway, not the full 40 ft including shoulders." /></span>, 'ft', wp, setWp)}
            </div>
            <div className="cee-row">
              {field('dr-cs', <span>Joint spacing C_s<Tip text="Transverse joint or crack spacing. Use the joint spacing for concrete; Huang recommends 40 ft for asphalt." /></span>, 'ft', cs, setCs)}
              {field('dr-p', <span>1-h/1-yr rain<Tip text="Maximum 1-hour duration, 1-year frequency precipitation rate from Huang Fig. 8.13 — about 1.2 in/h for Kentucky, 1.1 for Connecticut." /></span>, 'in/h', precip, setPrecip, '0.1')}
            </div>
            <div className="cee-row">
              {field('dr-cl', <span>Cedergren low<Tip text="0.33–0.50 for asphalt pavements, 0.50–0.67 for concrete." /></span>, '–', cedLo, setCedLo, '0.01')}
              {field('dr-ch', 'Cedergren high', '–', cedHi, setCedHi, '0.01')}
            </div>

            <h2 className="cee-panel__title" style={{ marginTop: '1rem' }}>Groundwater</h2>
            <div className="cee-row">
              {field('dr-k', <span>Native soil k<Tip text="Permeability of the soil above the impervious boundary." /></span>, 'ft/day', kSoil, setKSoil, '0.05')}
              {field('dr-w', 'Roadway width W', 'ft', roadW, setRoadW)}
            </div>
            <div className="cee-row">
              {field('dr-h', <span>H<Tip text="Depth from the original water table to the impervious boundary." /></span>, 'ft', hTot, setHTot)}
              {field('dr-h0', <span>H₀<Tip text="Depth from the bottom of the drainage layer to the impervious boundary." /></span>, 'ft', h0, setH0)}
            </div>
            {field('dr-q2', <span>q₂ from Fig. 8.14<Tip text="Inflow below the drainage layer, read from Huang Fig. 8.14 using W/H₀ and (L_i + 0.5W)/H₀. Leave at 0 to ignore it." /></span>, 'ft³/day/ft', q2, setQ2, '0.05')}
            <label className="cee-field__label" style={{ marginTop: '0.5rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" checked={oneSided} onChange={e => setOneSided(e.target.checked)} />
                Drains on one side only
              </span>
            </label>

            <h2 className="cee-panel__title" style={{ marginTop: '1rem' }}>Meltwater (frost)</h2>
            <div className="cee-row">
              {field('dr-t1', 'Surface thickness', 'in', layerT, setLayerT, '0.5')}
              {field('dr-g1', 'Surface unit wt.', 'pcf', layerG, setLayerG)}
            </div>
            <div className="cee-row">
              {field('dr-t2', 'Base thickness', 'in', layer2T, setLayer2T, '0.5')}
              {field('dr-g2', 'Base unit wt.', 'pcf', layer2G, setLayer2G)}
            </div>
            <div className="cee-row">
              {field('dr-qm', <span>q_m/√k from Fig. 8.15<Tip text="Read from Huang Fig. 8.15 (ch. 8, p. 356) using the heave rate from Table 8.5 and the consolidation pressure computed below. This chart is not digitized — see the note in the results." /></span>, '–', qmRatio, setQmRatio, '0.01')}
              {field('dr-ks', <span>Subgrade k<Tip text="Permeability of the subgrade soil, used to convert q_m/√k into an inflow." /></span>, 'ft/day', kSub, setKSub, '0.01')}
            </div>
          </>
        )}

        {tab === 'capacity' && (
          <>
            <h2 className="cee-panel__title" style={{ marginTop: '1rem' }}>Drainage layer</h2>
            <div className="cee-row">
              {field('dr-kd', <span>Layer k<Tip text="Permeability of the open-graded drainage layer — 1,000–20,000 ft/day for a properly graded material." /></span>, 'ft/day', kDrain, setKDrain, '500')}
              {field('dr-hd', 'Thickness H', 'in', hDrain, setHDrain, '0.5')}
            </div>
            <div className="cee-row">
              {field('dr-s', <span>Slope S<Tip text="Cross slope of the drainage layer, as a decimal (4% = 0.04)." /></span>, 'ft/ft', slope, setSlope, '0.005')}
              {field('dr-l', <span>Length L<Tip text="Flow path length across the drainage layer to the collector pipe." /></span>, 'ft', lDrain, setLDrain)}
            </div>
            {field('dr-ne', <span>Effective porosity n_e<Tip text="Drainable void fraction — the water that gravity actually removes, typically 0.20–0.30." /></span>, '–', poros, setPoros, '0.01')}
            {field('dr-tf', <span>Time factor T<Tip text="From the degree-of-drainage chart, using the slope factor S₁ shown in the results and the degree of drainage you want. For Problem 8.9 (S₁ = 1.08): T ≈ 0.24 for 50% drainage, ≈ 1.51 for 95%." /></span>, '–', timeFactor, setTimeFactor, '0.01')}
          </>
        )}

        {tab === 'pipe' && (
          <>
            <h2 className="cee-panel__title" style={{ marginTop: '1rem' }}>Collector pipe</h2>
            <div className="cee-row">
              {field('dr-pd', <span>Diameter<Tip text="Inside diameter of the collector pipe. Capacity scales as D^(8/3), so going from 4 to 6 in more than triples it." /></span>, 'in', pipeD, setPipeD, '0.5')}
              {field('dr-pn', <span>Manning n<Tip text="Roughness: 0.01 for smooth plastic pipe, 0.02–0.024 for corrugated." /></span>, '–', manningN, setManningN, '0.001')}
            </div>
            <div className="cee-row">
              {field('dr-ps', 'Pipe slope', 'ft/ft', pipeS, setPipeS, '0.005')}
              {field('dr-po', <span>Outlet spacing<Tip text="Distance between outlets. The full-flow capacity is spread over this length to give the allowable lateral inflow (Eq. 8.34)." /></span>, 'ft', outletSp, setOutletSp, '50')}
            </div>

            <h2 className="cee-panel__title" style={{ marginTop: '1rem' }}>Filter criteria</h2>
            <div className="cee-row">
              {field('dr-f15', 'Filter D₁₅', 'mm', f15, setF15, '0.01')}
              {field('dr-s15', 'Soil d₁₅', 'mm', s15, setS15, '0.01')}
            </div>
            <div className="cee-row">
              {field('dr-f50', 'Filter D₅₀', 'mm', f50, setF50, '0.01')}
              {field('dr-s50', 'Soil d₅₀', 'mm', s50, setS50, '0.01')}
            </div>
            <div className="cee-row">
              {field('dr-f85', 'Filter D₈₅', 'mm', f85, setF85, '0.01')}
              {field('dr-s85', 'Soil d₈₅', 'mm', s85, setS85, '0.01')}
            </div>
          </>
        )}
      </aside>

      <div className="cee-results">
        <details className="cee-howto">
          <summary>How to use this tool</summary>
          <div className="cee-howto__body">
            <ol>
              <li><strong>Estimate the inflow</strong>: surface infiltration always, then groundwater or meltwater — Huang treats them as alternatives, not additives, because frozen fine-grained soil is nearly impermeable.</li>
              <li><strong>Size the drainage layer</strong> so its steady-state capacity exceeds the design inflow over the flow length, and check the time to drain.</li>
              <li><strong>Size the collector pipe</strong> and the outlet spacing so the pipe can carry what the layer delivers.</li>
              <li><strong>Check the filter</strong> both ways: coarse enough to drain, fine enough not to pipe.</li>
            </ol>
            FHWA's <strong>DRIP</strong> does the same calculations as a desktop program — HW6 asks you to check Problems 8.6 and 8.8 against it.
          </div>
        </details>

        {tab === 'inflow' && (!inflow ? (
          <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>Enter a positive pavement width and joint spacing.</span></p>
        ) : (
          <>
            <KpiStrip>
              <Kpi accent label="Design inflow q_d" value={fmt(inflow.governing, 3)} unit="ft³/day/ft²"
                tip="The governing inflow: surface infiltration plus whichever of groundwater or meltwater is larger (Huang Eqs. 8.25–8.26)." />
              <Kpi label="Surface infiltration q_i" value={fmt(inflow.qiDay, 3)} unit="ft³/day/ft²"
                tip="Ridgeway's Eq. 8.18, converted from ft³/h/ft². This is the term that always applies." />
              <Kpi label="Groundwater q_g" value={fmt(inflow.qg, 3)} unit="ft³/day/ft²"
                tip="Seepage into the drainage layer from the water table (Eqs. 8.22 / 8.24)." />
              <Kpi label="Meltwater q_m" value={fmt(inflow.qm, 3)} unit="ft³/day/ft²"
                tip="Inflow from melting ice lenses in a frost-susceptible subgrade." />
              <Kpi label="Consolidation pressure σ_p" value={fmt(inflow.sigmaP, 0)} unit="psf"
                tip="Weight of the pavement above the subgrade — the second axis for reading Fig. 8.15." />
            </KpiStrip>

            <ChartFigure
              title="Ridgeway vs. Cedergren surface infiltration"
              subtitle="The crack-based estimate against the fraction-of-rainfall estimate"
              plotRef={inflowRef}
              legend={[
                { label: 'Cedergren', color: hueFor('deflection', theme) },
                { label: 'Ridgeway (Eq. 8.18)', color: hueFor('stress', theme), shape: 'dash' },
              ]}
              takeaway="Cedergren's method gives a much larger infiltration than Ridgeway's in wet regions, which is why Huang recommends Eq. 8.18 in the eastern United States and Cedergren as a check."
            >
              Two independent estimates of the same quantity. Ridgeway's is a flat line here because it
              depends on cracking geometry, not rainfall; Cedergren's rises with the coefficient you
              assume. <strong>The two agree better in the drier western states</strong> — where they
              disagree, Huang recommends Eq. 8.18 as the more physically grounded of the two and
              suggests taking the larger if you need to be conservative.
            </ChartFigure>

            <ShareRows
              theme={theme}
              rows={[
                { label: 'Surface infiltration', value: inflow.qiDay, color: HUES[theme].orange },
                { label: 'Groundwater', value: inflow.qg, color: HUES[theme].blue },
                { label: 'Meltwater', value: inflow.qm, color: HUES[theme].emerald },
              ]}
              format={v => `${v.toFixed(3)} ft³/day/ft²`}
            />

            <p className="cee-note">
              Huang Eqs. 8.18–8.26. Sanity checks — Problem 8.6: a two-lane HMA highway with a 22 ft
              roadway and C_s = 40 ft gives q_i = 0.016 ft³/h/ft² by Eq. 8.18, against 0.033–0.05 by
              Cedergren. Problem 8.8: a GW-GC subgrade with 4% finer than 0.02 mm heaves at 2.5 mm/day
              (Table 8.5) under σ_p ≈ 148 psf, and Fig. 8.15 gives q_m/√k ≈ 0.30, so
              q_m = 0.30√0.05 = 0.067 ft³/day/ft².
              <br /><br />
              <strong>One step is not automated.</strong> Reading Fig. 8.15 means interpolating a family
              of log-log curves off a scanned chart; digitizing it would put invented precision into a
              number you hand in, so this tool asks you for q_m/√k and does everything around it. The
              figure is in the course textbook, Chapter 8, p. 356.
            </p>
          </>
        ))}

        {tab === 'capacity' && (!capacity ? (
          <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>Enter positive permeability, thickness, and length.</span></p>
        ) : (
          <>
            <KpiStrip>
              <Kpi accent label="Discharge capacity q" value={fmt(capacity.q, 0)} unit="ft³/day/ft"
                tip="Steady-state capacity of the drainage layer per foot of width (Huang Eq. 8.27)." />
              <Kpi label="Required" value={Number.isFinite(capacity.required) ? fmt(capacity.required, 1) : '—'} unit="ft³/day/ft"
                tip="Design inflow multiplied by the flow length — what the layer must carry." />
              <Kpi label="Time to drain" value={fmt(capacity.tDrain, 2)} unit="h"
                tip="t = T·n_e·L²/(kH) for the time factor T you entered. AASHTO calls 2 hours to 50% drainage 'excellent'; Huang §8.3.2 suggests removing 95% within about 1 hour." />
              <Kpi label="Slope factor S₁" value={fmt(capacity.S1, 2)}
                tip="S₁ = L·S/H — the curve to use when reading the time factor T off the degree-of-drainage chart." />
            </KpiStrip>

            {!capacity.adequate && (
              <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>
                Capacity {fmt(capacity.q, 0)} ft³/day/ft is <strong>below</strong> the required{' '}
                {fmt(capacity.required, 1)}. Increase the thickness, the permeability, or the slope.
              </span></p>
            )}

            <ChartFigure
              title="Capacity vs. drainage layer thickness"
              subtitle="Steady-state discharge per foot of width, against the design requirement"
              plotRef={capRef}
              takeaway="Discharge capacity rises almost linearly with thickness, so the thickness needed to meet the inflow is read straight off the requirement line."
            >
              Capacity is <strong>k·H·(S + H/2L)</strong>: the slope term dominates for a thin layer,
              so capacity is nearly proportional to thickness. Where the curve crosses the dashed
              requirement line is the minimum thickness — but check the time to drain too, since a
              layer can be thick enough for steady flow and still drain too slowly.
            </ChartFigure>

            <p className="cee-note">
              Huang Eq. 8.27 for steady-state capacity, and t = T·n_e·L²/(kH) for time to drain
              (Casagrande &amp; Shannon, §8.3.2). Sanity check, Problem 8.9: H = 8 in, S = 4%,
              k = 10,000 ft/day, L = 18 ft, n_e = 0.25 → capacity 390 ft³/day/ft, S₁ = 1.08, and
              T = 0.24 / 1.51 give 0.07 h to 50% and 0.44 h to 95% drainage.
              <br /><br />
              <strong>The time factor is yours to read.</strong> T comes from the degree-of-drainage
              chart as a function of S₁ and the degree of drainage; like Fig. 8.15 it is a curve
              family, so this tool takes T from you and does the arithmetic around it rather than
              inventing precision it does not have.
            </p>
          </>
        ))}

        {tab === 'pipe' && (
          <>
            {pipe && (
              <KpiStrip>
                <Kpi accent label="Allowable lateral inflow" value={fmt(pipe.qL, 1)} unit="ft³/day/ft"
                  tip="The maximum inflow the pipe can accept per foot of length, given the outlet spacing (Huang Eq. 8.34)." />
                <Kpi label="Full-flow capacity" value={fmt(pipe.cfs, 3)} unit="ft³/s"
                  tip="Manning's equation for a circular pipe flowing full (Eq. 8.32)." />
                <Kpi label="Full-flow capacity" value={fmt(pipe.cfd, 0)} unit="ft³/day"
                  tip="The same capacity expressed per day, which is the unit the inflow calculations use." />
                <Kpi label="Outlet spacing" value={fmt(num(outletSp, 300), 0)} unit="ft"
                  tip="Shorter spacing means each length of pipe carries less, so a smaller pipe suffices." />
              </KpiStrip>
            )}

            <div className="cee-tablewrap">
              <table className="cee-table">
                <thead>
                  <tr>
                    <th>Filter criterion</th>
                    <th>Value</th>
                    <th>Limit</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {filt.checks.map(ch => (
                    <tr key={ch.name}>
                      <td>{ch.name}</td>
                      <td>{fmt(ch.value, 2)}</td>
                      <td>{ch.limit}</td>
                      <td style={{ color: ch.pass ? 'var(--cee-positive)' : 'var(--cee-negative)', fontWeight: 600 }}>
                        {ch.pass ? 'Pass' : 'Fail'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="cee-note">
              Manning's equation (Huang Eq. 8.32) with A = πD²/4 and R = D/4 for full flow, and
              Eq. 8.34 for the allowable lateral inflow. Sanity check, Problem 8.10: a 4-in smooth
              plastic pipe, n = 0.01, at 2.5% slope with outlets every 300 ft gives
              112.7 ft³/day/ft. Filter criteria are the classical granular rules — a filter must be
              coarse enough to pass water and fine enough to hold the protected soil back, and both
              directions have to be satisfied at once.
            </p>

            <div className="cee-tablewrap">
              <table className="cee-table">
                <thead>
                  <tr>
                    <th>Soil (Unified)</th>
                    <th>Symbol</th>
                    <th>% finer 0.02 mm</th>
                    <th>Heave rate (mm/day)</th>
                    <th>Frost susceptibility</th>
                  </tr>
                </thead>
                <tbody>
                  {HEAVE_TABLE.map((h, i) => (
                    <tr key={`${h.symbol}-${i}`}>
                      <td>{h.soil}</td>
                      <td>{h.symbol}</td>
                      <td>{h.passing[0] === h.passing[1] ? h.passing[0] : `${h.passing[0]}–${h.passing[1]}`}</td>
                      <td>{h.heave[0] === h.heave[1] ? h.heave[0].toFixed(1) : `${h.heave[0].toFixed(1)}–${h.heave[1].toFixed(1)}`}</td>
                      <td style={{ textAlign: 'right' }}>{h.frost}</td>
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
