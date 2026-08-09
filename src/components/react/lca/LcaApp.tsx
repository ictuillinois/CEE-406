// Pavement LCA Worksheet — cradle-to-grave GHG accounting for one lane-mile
// over an analysis period: materials, transport, construction, use phase,
// IRI-triggered maintenance & rehabilitation, and end of life. Inventory
// defaults are the HW10 assignment values; every factor is editable so
// "assume any missing information" variations are one keystroke away.
import { useEffect, useMemo, useRef, useState } from 'react';
import Tip from '../Tip';
import {
  useTheme, chartColors, baseLayout, plotConfig, num,
  axis, gridAxis, hueFor, HUE_ORDER, HUES,
} from '../chartTheme';
import ChartFigure from '../ui/ChartFigure';
import Card from '../ui/Card';
import KpiStrip, { Kpi } from '../ui/KpiStrip';
import ShareRows from '../ui/ShareRows';
import '../tools.css';

const kgFmt = (x: number) =>
  x >= 1e6 ? `${(x / 1e6).toFixed(2)} M` : x.toLocaleString('en-US', { maximumFractionDigits: 0 });

export default function LcaApp() {
  // Section geometry (1 lane-mile)
  const [laneW, setLaneW] = useState('12');    // ft
  const [hAc, setHAc] = useState('4');         // in
  const [hBase, setHBase] = useState('6');     // in
  const [rhoAc, setRhoAc] = useState('140');   // pcf
  const [rhoBase, setRhoBase] = useState('130'); // pcf
  // Inventory factors (kg CO2e)
  const [fAcProd, setFAcProd] = useState('70');      // per ton AC
  const [fAggProd, setFAggProd] = useState('8.1');   // per ton aggregate
  const [fAcCon, setFAcCon] = useState('48');        // per ton AC placed
  const [fBaseCon, setFBaseCon] = useState('39');    // per ton base placed
  const [fTrans, setFTrans] = useState('0.115');     // per ton-mile
  const [haul, setHaul] = useState('10');            // mi
  const [fFuel, setFFuel] = useState('9');           // per gallon
  const [fRehab, setFRehab] = useState('80000');     // per mill-and-overlay
  const [fEol, setFEol] = useState('876');           // disposal per lane-mile
  // Traffic & use
  const [adt, setAdt] = useState('1000');            // veh/day per lane
  const [fuelRate, setFuelRate] = useState('0.05');  // gal/mi
  // IRI model
  const [iri0, setIri0] = useState('60');
  const [iriRate, setIriRate] = useState('12.2');
  const [iriTrig, setIriTrig] = useState('170');
  const [period, setPeriod] = useState('20');

  const W = num(laneW, 12);
  const years = Math.max(1, num(period, 20));
  const rate = num(iriRate, 12.2);
  const trig = num(iriTrig, 170);
  const i0 = num(iri0, 60);

  const res = useMemo(() => {
    // Tonnages for one lane-mile (short tons)
    const acTons = (5280 * W * (num(hAc, 4) / 12) * num(rhoAc, 140)) / 2000;
    const baseTons = (5280 * W * (num(hBase, 6) / 12) * num(rhoBase, 130)) / 2000;

    // IRI sawtooth + rehab schedule
    const rehabTimes: number[] = [];
    const iriT: number[] = [], iriV: number[] = [];
    if (rate > 0 && trig > i0) {
      const interval = (trig - i0) / rate;
      for (let t = interval; t < years; t += interval) rehabTimes.push(t);
    }
    const step = years / 400;
    let last = 0, ri = 0;
    for (let t = 0; t <= years + 1e-9; t += step) {
      while (ri < rehabTimes.length && rehabTimes[ri] <= t) { last = rehabTimes[ri]; ri++; }
      iriT.push(t);
      iriV.push(i0 + rate * (t - last));
    }

    const materials = acTons * num(fAcProd, 70) + baseTons * num(fAggProd, 8.1);
    const transport = (acTons + baseTons) * num(haul, 10) * num(fTrans, 0.115);
    const construction = acTons * num(fAcCon, 48) + baseTons * num(fBaseCon, 39);
    const use = num(adt, 1000) * 365 * years * num(fuelRate, 0.05) * num(fFuel, 9);
    const mr = rehabTimes.length * num(fRehab, 80000);
    const eol = num(fEol, 876);
    const total = materials + transport + construction + use + mr + eol;

    const stages = [
      { name: 'Materials', v: materials, note: `${acTons.toFixed(0)} t AC + ${baseTons.toFixed(0)} t aggregate` },
      { name: 'Transport', v: transport, note: `${(acTons + baseTons).toFixed(0)} t × ${num(haul, 10)} mi` },
      { name: 'Construction', v: construction, note: 'placement of AC + base' },
      { name: 'Use phase', v: use, note: `${num(adt, 1000)} veh/day × ${years} yr × ${num(fuelRate, 0.05)} gal/mi` },
      { name: 'M&R', v: mr, note: `${rehabTimes.length} mill-and-overlay${rehabTimes.length === 1 ? '' : 's'}` },
      { name: 'End of life', v: eol, note: 'disposal' },
    ];
    const governing = stages.reduce((a, b) => (b.v > a.v ? b : a));
    return { acTons, baseTons, rehabTimes, iriT, iriV, stages, total, governing };
  }, [W, hAc, hBase, rhoAc, rhoBase, fAcProd, fAggProd, fAcCon, fBaseCon, fTrans, haul, fFuel, fRehab, fEol, adt, fuelRate, i0, rate, trig, years]);

  const theme = useTheme();
  const iriRef = useRef<HTMLDivElement>(null);

  // Six stages exceed the 6-hue categorical set only if a series is added, so
  // they take hues 1-6 in the fixed order and keep them (§B4). Order is the
  // life-cycle order, never sorted by value.
  const stageSegments = useMemo(
    () => res.stages.map((s, i) => ({
      label: s.name,
      value: s.v,
      color: HUES[theme][HUE_ORDER[i % HUE_ORDER.length]],
    })),
    [res.stages, theme]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const Plotly = (await import('plotly.js-dist-min')).default;
      if (cancelled) return;
      const c = chartColors(theme);

      if (iriRef.current) {
        Plotly.react(iriRef.current, [
          {
            x: res.iriT, y: res.iriV, name: 'IRI', mode: 'lines',
            line: { color: hueFor('damage', theme), width: 2.5 },
            hovertemplate: 'year %{x:.1f} · IRI %{y:.0f} in/mi<extra></extra>',
          },
        ], baseLayout(theme, {
          xaxis: axis(theme, 'Year', { range: [0, years] }),
          yaxis: gridAxis(theme, 'IRI (in/mi)', { rangemode: 'tozero' as const }),
          showlegend: false,
          hovermode: 'closest',
          shapes: [
            { type: 'line', xref: 'paper', x0: 0, x1: 1, y0: trig, y1: trig, line: { color: c.secondary, width: 1, dash: 'dash' } },
            ...res.rehabTimes.map(t => ({
              type: 'line' as const, x0: t, x1: t, yref: 'paper' as const, y0: 0, y1: 1,
              line: { color: c.secondary, width: 1, dash: 'dot' as const },
            })),
          ],
          annotations: [
            { xref: 'paper', x: 0.01, y: trig, text: `rehab trigger ${trig}`, showarrow: false, yshift: 9, font: { size: 10, color: c.fg }, xanchor: 'left' as const },
            ...res.rehabTimes.map(t => ({
              x: t, yref: 'paper' as const, y: 1.03, text: `yr ${t.toFixed(1)}`, showarrow: false,
              font: { size: 10, color: c.fg },
            })),
          ],
        }), plotConfig);
      }

      // The stage breakdown is the §A8.10 composition bar, rendered as HTML —
      // it replaced a log-scale bar chart, which cannot satisfy §A12's "bars
      // start at zero, always" because a log axis has no zero.
    })();
    return () => { cancelled = true; };
  }, [res, theme, years, trig]);

  const field = (id: string, label: React.ReactNode, unit: string, val: string, set: (v: string) => void, step = '1') => (
    <div className="cee-field">
      <label className="cee-field__label" htmlFor={id}>
        <span>{label}</span>
        <span className="cee-field__unit">{unit}</span>
      </label>
      <input id={id} className="cee-input" type="number" step={step} value={val} onChange={e => set(e.target.value)} />
    </div>
  );

  return (
    <div className="cee-tool">
      <aside className="cee-panel">
        <h2 className="cee-panel__title">Section · 1 lane-mile</h2>
        <div className="cee-row">
          {field('lc-w', 'Lane width', 'ft', laneW, setLaneW)}
          {field('lc-p', 'Analysis period', 'yr', period, setPeriod)}
        </div>
        <div className="cee-row">
          {field('lc-hac', 'AC thickness', 'in', hAc, setHAc, '0.5')}
          {field('lc-hb', 'Base thickness', 'in', hBase, setHBase, '0.5')}
        </div>
        <div className="cee-row">
          {field('lc-rac', 'AC density', 'pcf', rhoAc, setRhoAc)}
          {field('lc-rb', 'Base density', 'pcf', rhoBase, setRhoBase)}
        </div>

        <h2 className="cee-panel__title" style={{ marginTop: '1rem' }}>Traffic &amp; IRI</h2>
        <div className="cee-row">
          {field('lc-adt', 'Traffic', 'veh/day', adt, setAdt, '100')}
          {field('lc-fr', <span>Fuel use<Tip text="Average fuel consumed per vehicle per mile of travel." /></span>, 'gal/mi', fuelRate, setFuelRate, '0.01')}
        </div>
        <div className="cee-row">
          {field('lc-i0', <span>Initial IRI<Tip text="Roughness at construction — the IRI also resets to this after each rehab." /></span>, 'in/mi', iri0, setIri0)}
          {field('lc-ir', 'IRI growth', 'in/mi/yr', iriRate, setIriRate, '0.1')}
        </div>
        {field('lc-it', <span>Rehab trigger<Tip text="Mill-and-overlay is performed every time the IRI reaches this value." /></span>, 'in/mi', iriTrig, setIriTrig)}

        <h2 className="cee-panel__title" style={{ marginTop: '1rem' }}>Inventory factors</h2>
        <div className="cee-row">
          {field('lc-f1', 'AC production', 'kg/t', fAcProd, setFAcProd)}
          {field('lc-f2', 'Aggregate prod.', 'kg/t', fAggProd, setFAggProd, '0.1')}
        </div>
        <div className="cee-row">
          {field('lc-f3', 'AC construction', 'kg/t', fAcCon, setFAcCon)}
          {field('lc-f4', 'Base construction', 'kg/t', fBaseCon, setFBaseCon)}
        </div>
        <div className="cee-row">
          {field('lc-f5', 'Transport', 'kg/t-mi', fTrans, setFTrans, '0.005')}
          {field('lc-f6', 'Haul distance', 'mi', haul, setHaul)}
        </div>
        <div className="cee-row">
          {field('lc-f7', 'Fuel emission', 'kg/gal', fFuel, setFFuel, '0.5')}
          {field('lc-f8', 'Mill & overlay', 'kg/rehab', fRehab, setFRehab, '1000')}
        </div>
        {field('lc-f9', 'Disposal (EOL)', 'kg', fEol, setFEol)}

        <p className="cee-hint">
          Defaults are the HW10 inventory. Functional unit: 1 lane-mile over the
          analysis period. Tons are US short tons (2000 lb) from volume × density.
        </p>
      </aside>

      <div className="cee-results">
        <details className="cee-howto">
          <summary>How to use this tool</summary>
          <div className="cee-howto__body">
            <ol>
              <li><strong>Check the section and factors</strong> — every assignment value is preloaded; edit anything you assume differently and say so in your report.</li>
              <li><strong>Read the rehab schedule</strong> off the IRI timeline: the sawtooth resets each time the trigger is reached.</li>
              <li><strong>Walk the stage table</strong>: each row shows the quantity, the factor applied, and the resulting GHG — reproduce them by hand.</li>
              <li><strong>Answer the closing question</strong>: the governing stage and one mitigation for it.</li>
            </ol>
            Note the stage chart is on a <em>log scale</em> — the use phase is orders of magnitude above everything else, which is exactly the point of the problem.
          </div>
        </details>

        <KpiStrip>
          <Kpi
            accent
            label={`Total GHG · ${years} yr`}
            value={(res.total / 1000).toLocaleString('en-US', { maximumFractionDigits: 0 })}
            unit="t CO₂e"
            tip="Sum of all six life-cycle stages for the functional unit: one lane-mile over the analysis period. Reported in metric tonnes (1 t = 1000 kg CO₂e)."
          />
          <Kpi
            compact
            label="Governing stage"
            value={`${res.governing.name} · ${((res.governing.v / res.total) * 100).toFixed(1)}%`}
            tip="The stage with the largest share — the answer to the closing question of HW10, together with a mitigation aimed at THIS stage (e.g., smoother pavement → lower vehicle fuel use)."
          />
          <Kpi
            label="Rehabilitations"
            value={res.rehabTimes.length}
            unit={res.rehabTimes.map(t => `yr ${t.toFixed(1)}`).join(' · ')}
            tip="One mill-and-overlay is scheduled every time the IRI reaches the trigger; roughness then resets to the initial value. Their count multiplies the M&R factor."
          />
          <Kpi
            label="Material mass"
            value={(res.acTons + res.baseTons).toFixed(0)}
            unit="tons"
            tip="AC plus aggregate for the initial construction, from volume × density (short tons). This mass drives the materials, transport, and construction stages."
          />
        </KpiStrip>

        <div className="cee-chart-grid cee-chart-grid--2">
          <ChartFigure
            title="IRI timeline &amp; rehab schedule"
            subtitle="Roughness against the rehabilitation trigger over the analysis period"
            plotRef={iriRef}
            takeaway={`Roughness reaches the trigger ${res.rehabTimes.length} time${res.rehabTimes.length === 1 ? '' : 's'} in ${years} years, and each mill-and-overlay resets it to the initial value.`}
          >
            Roughness grows linearly until it hits the dashed trigger; each vertical marker is a
            mill-and-overlay that resets IRI to its initial value — the classic <strong>sawtooth</strong>.
            This chart <em>is</em> the M&amp;R stage: count the teeth, multiply by the rehab factor.
            Slower deterioration or a higher trigger removes whole rehabs at a time.
          </ChartFigure>

          <Card
            title="GHG by life-cycle stage"
            subtitle="Each stage as a share of the cradle-to-grave total"
          >
            <figure className="cee-figure">
              <ShareRows rows={stageSegments} theme={theme} format={v => `${kgFmt(v)} kg`} />
              <figcaption className="cee-figcaption">
                The <strong>use phase</strong> is {((res.governing.v / res.total) * 100).toFixed(0)}% of the
                total on these defaults: vehicles burning fuel over {years} years out-emit building the road
                by more than an order of magnitude. That imbalance, and what it implies for
                smoothness-focused maintenance, is the takeaway HW10 wants in your comment.
              </figcaption>
            </figure>
          </Card>
        </div>

        <div className="cee-tablewrap">
          <table className="cee-table">
            <thead>
              <tr>
                <th>Stage</th>
                <th>Quantity</th>
                <th>GHG (kg CO₂e)</th>
                <th>Share</th>
              </tr>
            </thead>
            <tbody>
              {res.stages.map((s, i) => (
                <tr key={s.name}>
                  <td>{s.name}</td>
                  <td style={{ textAlign: 'left', fontSize: '0.75rem', color: 'var(--cee-muted)' }}>{s.note}</td>
                  <td>{s.v.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                  <td className="cee-share-cell">
                    <span className="cee-share" aria-hidden="true">
                      <span style={{ width: `${(s.v / res.total) * 100}%`, background: stageSegments[i].color }} />
                    </span>
                    {((s.v / res.total) * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
              <tr>
                <td><strong>Total</strong></td>
                <td></td>
                <td><strong>{res.total.toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="cee-note">
          Stage boundaries follow the FHWA pavement LCA framework: materials
          (production), transport (plant → site), construction (placement), use
          (vehicle fuel over the period), M&amp;R (each mill-and-overlay as one
          inventory item), end of life (disposal). State every assumption you
          change — the grading looks for a complete, internally consistent system
          boundary, not one “right” number.
        </p>
      </div>
    </div>
  );
}
