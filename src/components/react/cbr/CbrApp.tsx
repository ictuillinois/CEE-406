// CBR Reduction — reduce a piston penetration test to a California Bearing
// Ratio, applying the origin correction for a concave-up curve.
// AASHTO T 193 / ASTM D1883. Supports HW2 Problem 4.
import { useEffect, useMemo, useRef, useState } from 'react';
import Tip from '../Tip';
import {
  useTheme, chartColors, baseLayout, plotConfig, num, fmt,
  axis, gridAxis, hueFor,
} from '../chartTheme';
import ChartFigure from '../ui/ChartFigure';
import KpiStrip, { Kpi } from '../ui/KpiStrip';
import { reduceCbr, type Point } from './equations';
import '../tools.css';

interface Row { id: number; pen: string; load: string }
let nextId = 100;

/** A concave-up curve, the case the origin correction exists for. */
const DEMO: [string, string][] = [
  ['0', '0'], ['0.025', '35'], ['0.050', '95'], ['0.075', '185'],
  ['0.100', '300'], ['0.150', '565'], ['0.200', '790'],
  ['0.300', '1120'], ['0.400', '1350'], ['0.500', '1520'],
];

export default function CbrApp() {
  const [rows, setRows] = useState<Row[]>(
    DEMO.map(([pen, load]) => ({ id: nextId++, pen, load }))
  );
  const [correct, setCorrect] = useState(true);
  const [paste, setPaste] = useState('');

  const points = useMemo<Point[]>(
    () => rows
      .map(r => ({ pen: num(r.pen, NaN), load: num(r.load, NaN) }))
      .filter(p => Number.isFinite(p.pen) && Number.isFinite(p.load))
      .sort((a, b) => a.pen - b.pen),
    [rows]
  );

  const res = useMemo(() => reduceCbr(points, correct), [points, correct]);

  const theme = useTheme();
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!res || !chartRef.current) return;
    let canceled = false;
    (async () => {
      const Plotly = (await import('plotly.js-dist-min')).default;
      if (canceled || !chartRef.current) return;
      const c = chartColors(theme);
      const measured = hueFor('stress', theme);
      const shifted = hueFor('deflection', theme);

      const traces: any[] = [
        {
          x: points.map(p => p.pen), y: points.map(p => p.load),
          name: 'Measured', mode: 'lines+markers',
          line: { color: measured, width: 2.5 },
          marker: { color: measured, size: 7, line: { color: c.surface, width: 2 } },
          hovertemplate: '%{x:.3f} in · %{y:,.0f} psi<extra></extra>',
        },
      ];

      if (res.offset > 1e-9) {
        traces.push({
          x: res.corrected.map(p => p.pen), y: res.corrected.map(p => p.load),
          name: 'Corrected', mode: 'lines',
          line: { color: shifted, width: 2.5, dash: 'dot' },
          hovertemplate: 'corrected %{x:.3f} in · %{y:,.0f} psi<extra></extra>',
        });
        // The tangent whose intercept defines the corrected origin.
        const yTop = Math.max(...points.map(p => p.load));
        traces.push({
          x: [res.offset, res.offset + yTop / res.slope], y: [0, yTop],
          name: 'Tangent', mode: 'lines',
          line: { color: c.secondary, width: 1, dash: 'dash' },
          hoverinfo: 'skip',
        });
      }

      Plotly.react(chartRef.current, traces, baseLayout(theme, {
        height: 340,
        xaxis: axis(theme, 'Penetration (in)', { rangemode: 'tozero' as const }),
        yaxis: gridAxis(theme, 'Piston pressure (psi)', { rangemode: 'tozero' as const }),
        hovermode: 'closest',
        shapes: [
          { type: 'line', x0: 0.1, x1: 0.1, yref: 'paper', y0: 0, y1: 1, line: { color: c.secondary, width: 1, dash: 'dot' } },
          { type: 'line', x0: 0.2, x1: 0.2, yref: 'paper', y0: 0, y1: 1, line: { color: c.secondary, width: 1, dash: 'dot' } },
        ],
        annotations: [
          { x: 0.1, yref: 'paper', y: 1.03, text: '0.1 in', showarrow: false, font: { size: 10, color: c.fg } },
          { x: 0.2, yref: 'paper', y: 1.03, text: '0.2 in', showarrow: false, font: { size: 10, color: c.fg } },
        ],
      }), plotConfig);
    })();
    return () => { canceled = true; };
  }, [res, points, theme]);

  const update = (id: number, patch: Partial<Row>) =>
    setRows(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)));

  const applyPaste = () => {
    const parsed: Row[] = [];
    for (const line of paste.split(/\r?\n/)) {
      const cells = line.trim().split(/[\t,;\s]+/).filter(Boolean);
      if (cells.length < 2) continue;
      const pen = parseFloat(cells[0]), load = parseFloat(cells[1]);
      if (Number.isFinite(pen) && Number.isFinite(load)) {
        parsed.push({ id: nextId++, pen: String(pen), load: String(load) });
      }
    }
    if (parsed.length >= 2) { setRows(parsed); setPaste(''); }
  };

  return (
    <div className="cee-tool">
      <aside className="cee-panel">
        <h2 className="cee-panel__title">Penetration test</h2>

        <div className="cee-field">
          <span className="cee-field__label">
            <span>Readings<Tip text="Piston penetration and the corresponding pressure. Include the zero reading — the correction needs the toe of the curve." /></span>
            <span className="cee-field__unit">in · psi</span>
          </span>
          {rows.map(r => (
            <div className="cee-axle-row cee-axle-row--2" key={r.id}>
              <input className="cee-input" type="number" step="0.005" value={r.pen}
                aria-label="Penetration (in)" onChange={e => update(r.id, { pen: e.target.value })} />
              <input className="cee-input" type="number" step="10" value={r.load}
                aria-label="Piston pressure (psi)" onChange={e => update(r.id, { load: e.target.value })} />
              <button className="cee-axle-remove" type="button" aria-label="Remove reading"
                onClick={() => setRows(rs => rs.filter(x => x.id !== r.id))}>×</button>
            </div>
          ))}
          <button className="cee-btn cee-btn--ghost cee-btn--sm" type="button"
            onClick={() => setRows(rs => [...rs, { id: nextId++, pen: '', load: '' }])}>+ Add reading</button>
        </div>

        <div className="cee-field">
          <label className="cee-field__label" htmlFor="cbr-paste">
            <span>Paste from Excel<Tip text="Two columns: penetration then pressure. Tabs, commas, or spaces all work." /></span>
          </label>
          <textarea id="cbr-paste" className="cee-textarea" value={paste}
            onChange={e => setPaste(e.target.value)} placeholder="0.000&#9;0&#10;0.025&#9;35" />
          <button className="cee-btn cee-btn--primary cee-btn--sm" type="button"
            style={{ marginTop: '0.5rem' }} onClick={applyPaste}>Load pasted data</button>
        </div>

        <label className="cee-field__label" style={{ marginTop: '0.5rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input type="checkbox" checked={correct} onChange={e => setCorrect(e.target.checked)} />
            Apply origin correction
          </span>
        </label>

        <p className="cee-hint">
          AASHTO T 193 / ASTM D1883. Standard crushed-stone pressures are
          1000 psi at 0.1 in and 1500 psi at 0.2 in.
        </p>
      </aside>

      <div className="cee-results">
        <details className="cee-howto">
          <summary>How to use this tool</summary>
          <div className="cee-howto__body">
            <ol>
              <li><strong>Enter the readings</strong>, including the zero — the origin correction is constructed from the toe of the curve.</li>
              <li><strong>Look at the curve shape.</strong> If it starts concave upward, the test began against surface irregularities and the origin must move; the tool finds the tangent and shifts it.</li>
              <li><strong>Read the CBR</strong> at 0.1 in. If the 0.2 in value is larger, the standard says rerun the test — and if it repeats, report the 0.2 in value.</li>
              <li><strong>Toggle the correction off</strong> to see how much it matters: an uncorrected concave-up curve understates the CBR badly.</li>
            </ol>
            CBR is a ratio, not a stress: it is the piston pressure your soil needs expressed as a percentage of what a standard crushed stone needs at the same penetration.
          </div>
        </details>

        {!res ? (
          <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>Enter at least two valid readings.</span></p>
        ) : (
          <>
            <KpiStrip>
              <Kpi accent label="CBR (governing)" value={fmt(res.governing, 1)} unit="%"
                tip="The reported CBR. Normally the 0.1 in value; the 0.2 in value governs only if it is larger and the test repeats." />
              <Kpi label="CBR at 0.1 in" value={fmt(res.cbr01, 1)} unit="%"
                tip="Piston pressure at 0.1 in penetration divided by 1000 psi." />
              <Kpi label="CBR at 0.2 in" value={fmt(res.cbr02, 1)} unit="%"
                tip="Piston pressure at 0.2 in penetration divided by 1500 psi." />
              <Kpi label="Origin correction" value={fmt(res.offset, 4)} unit="in"
                tip="How far the origin moved. Zero means the curve was already concave down and needed no correction." />
            </KpiStrip>

            {res.rerunAdvised && (
              <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>
                The 0.2 in value ({fmt(res.cbr02, 1)}%) exceeds the 0.1 in value ({fmt(res.cbr01, 1)}%).
                AASHTO T 193 says to <strong>rerun the test</strong>; if the result repeats, report the
                0.2 in value as the CBR.
              </span></p>
            )}

            <ChartFigure
              title="Stress–penetration curve"
              subtitle={res.offset > 1e-9
                ? 'Measured curve, the tangent that locates the corrected origin, and the shifted curve'
                : 'Measured curve — concave down from the start, so no correction is needed'}
              plotRef={chartRef}
              legend={[
                { label: 'Measured', color: hueFor('stress', theme) },
                ...(res.offset > 1e-9 ? [
                  { label: 'Corrected', color: hueFor('deflection', theme), shape: 'dash' as const },
                  { label: 'Tangent', color: chartColors(theme).secondary, shape: 'dash' as const },
                ] : []),
              ]}
              takeaway={res.offset > 1e-9
                ? `The curve is concave upward, so the origin shifts ${fmt(res.offset, 3)} in and the CBR rises to ${fmt(res.governing, 1)}%.`
                : `The curve needs no origin correction; the CBR is ${fmt(res.governing, 1)}%.`}
            >
              The pressures at <strong>0.1 in and 0.2 in</strong> are the only two readings that matter,
              but where you measure them from is the whole question. A curve that starts concave upward
              means the piston was still seating; taking the tangent at the steepest point and extending
              it to zero load finds where penetration <em>really</em> began.
              {res.offset > 1e-9 && ' Everything is then re-read from that shifted origin.'}
            </ChartFigure>

            <div className="cee-tablewrap">
              <table className="cee-table">
                <thead>
                  <tr>
                    <th>Penetration (in)</th>
                    <th>Corrected (in)</th>
                    <th>Pressure (psi)</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((p, i) => (
                    <tr key={i}>
                      <td>{p.pen.toFixed(3)}</td>
                      <td>{(p.pen - res.offset).toFixed(3)}</td>
                      <td>{fmt(p.load, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="cee-note">
              CBR = piston pressure ÷ standard pressure × 100, with standard pressures of 1000 psi at
              0.1 in and 1500 psi at 0.2 in (AASHTO T 193). The origin correction is the standard
              construction: the tangent at the steepest point of the curve, extended to zero load.
              A soaked CBR is the usual design value — state which one you are reporting.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
