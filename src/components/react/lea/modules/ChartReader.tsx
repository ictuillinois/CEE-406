// One chart from Huang's Chapter 2, redrawn and readable in both directions.
//
// A printed chart is read one way: you bring two parameters and take away a
// value. Everything else a reader wants — which curve is this point on, what
// radius would give me this stress, is my answer even on the page — costs a
// ruler and a guess. All of that is an inversion of the same function, and a
// computed chart can just do it.
//
// So this component does three things at once, from one ChartSpec:
//
//   FORWARD   type the parameters; the marker lands on the chart and the
//             readout applies the book's own equation to the value.
//   BACKWARD  move the cursor anywhere in the frame; it takes the point under
//             the pointer and solves for the family value whose curve passes
//             through it — reporting EVERY root, because several of these
//             families are not monotone, and reporting none when the point is
//             off every curve rather than inventing a nearby number.
//   SNAP      the nearest printed curve, measured in screen terms, which is
//             what a reader is actually doing with a page of seventeen curves.
import { useEffect, useMemo, useRef, useState } from 'react';
import Tip from '../../Tip';
import {
  useTheme, chartColors, baseLayout, plotConfig, axis, gridAxis,
  rampSeries, hoverLabel, fmt, TOKENS,
} from '../../chartTheme';
import ChartFigure from '../../ui/ChartFigure';
import type { ChartSpec } from '../charts.ts';
import { sampleCurve, invertFamily, nearestCurve } from '../charts.ts';

/** Which ramp carries which chart, per the §B4 semantic binding. */
function rampFor(spec: ChartSpec) {
  if (/deflection|w\b/i.test(spec.value.label)) return 'emerald' as const;
  if (/strain/i.test(spec.value.label)) return 'blue' as const;
  if (/factor C/i.test(spec.value.label)) return 'neutral' as const;
  return 'orange' as const;
}

const fmtParam = (v: number) =>
  Math.abs(v) >= 100 || (v !== 0 && Math.abs(v) < 0.01) ? v.toPrecision(3) : String(+v.toFixed(3));

/**
 * Data coordinates under the pointer.
 *
 * Plotly has no public API for "where is the cursor in data space" — its
 * hover events only fire on traces, and this chart needs the empty space
 * between the curves, which is exactly where a reader puts a ruler. The axis
 * objects' p2d converters are internal, so every access is guarded and the
 * feature simply switches itself off if a future Plotly moves them; the typed
 * inputs remain the primary path either way.
 */
function pointerData(gd: any, evt: MouseEvent): { x: number; y: number } | null {
  const fl = gd?._fullLayout;
  const xa = fl?.xaxis, ya = fl?.yaxis;
  if (!fl?._size || typeof xa?.p2d !== 'function' || typeof ya?.p2d !== 'function') return null;
  const box = gd.getBoundingClientRect();
  const px = evt.clientX - box.left - fl._size.l;
  const py = evt.clientY - box.top - fl._size.t;
  if (px < 0 || py < 0 || px > fl._size.w || py > fl._size.h) return null;
  // p2d returns log10 of the value on a log axis.
  const un = (a: any, v: number) => (a.type === 'log' ? Math.pow(10, v) : v);
  const x = un(xa, xa.p2d(px));
  const y = un(ya, ya.p2d(py));
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

interface Reading {
  /** Where on the chart, in (value, sweep). */
  value: number;
  sweep: number;
  /** Family values whose curve passes through it; null when not solved yet. */
  roots: number[] | null;
  /** The nearest printed curve. */
  nearest: { familyValue: number; sweep: number; value: number } | null;
}

export default function ChartReader({ spec }: { spec: ChartSpec }) {
  const theme = useTheme();
  const plotRef = useRef<HTMLDivElement>(null);

  const [panelValue, setPanelValue] = useState<number | undefined>(spec.panel?.values[0]);
  const [familyStr, setFamilyStr] = useState('');
  const [sweepStr, setSweepStr] = useState('');
  const [hover, setHover] = useState<Reading | null>(null);
  const [pinned, setPinned] = useState<Reading | null>(null);
  const [busy, setBusy] = useState(false);
  const [curves, setCurves] = useState<{ fv: number; pts: { sweep: number; value: number }[] }[]>([]);

  // A fresh chart starts on its first anchor when it has one, so the tool
  // opens on a case the book has already worked out.
  useEffect(() => {
    const a = spec.anchors?.[0];
    setPanelValue(spec.panel ? (a?.pv ?? spec.panel.values[0]) : undefined);
    setFamilyStr(String(a?.fv ?? spec.family.values[Math.floor(spec.family.values.length / 2)]));
    setSweepStr(String(a?.sv ?? +(0.5 * (spec.sweep.min + spec.sweep.max)).toFixed(2)));
    setHover(null);
    setPinned(null);
  }, [spec]);

  const familyValue = Number(familyStr);
  const sweepValue = Number(sweepStr);
  const markerValue = useMemo(() => {
    if (!Number.isFinite(familyValue) || !Number.isFinite(sweepValue)) return NaN;
    return spec.evaluate(familyValue, sweepValue, panelValue);
  }, [spec, familyValue, sweepValue, panelValue]);

  /* ── Build the curves ────────────────────────────────────────────────────
   * Heavy charts are seconds of work, so the sampling is pushed off the paint
   * with a frame's delay and the card shows a loading state meanwhile —
   * docs/loaders.md. Light charts land inside one frame and never flash it.
   */
  useEffect(() => {
    let dead = false;
    setBusy(true);
    const build = () => {
      const out = spec.family.values.map(fv => ({ fv, pts: sampleCurve(spec, fv, panelValue) }));
      if (!dead) { setCurves(out); setBusy(false); }
    };
    const t = window.setTimeout(build, spec.heavy ? 40 : 0);
    return () => { dead = true; window.clearTimeout(t); };
  }, [spec, panelValue]);

  const colors = useMemo(
    () => rampSeries(rampFor(spec), theme, spec.family.values.length),
    [spec, theme]
  );

  /**
   * Turn a point on the chart into a full reading.
   *
   * `solve` gates the expensive half. Snapping to the nearest curve reads the
   * points already on screen and costs nothing, so it runs on every pointer
   * move. Inverting for the family value is a 240-step scan of `evaluate`,
   * which on the conversion-factor chart is 240 critical-strain searches --
   * fine on a click, impossible on a mousemove. Heavy charts therefore snap
   * while the pointer moves and solve when it is clicked.
   */
  const read = useMemo(() => (valueAt: number, sweepAt: number, solve: boolean): Reading => ({
    value: valueAt,
    sweep: sweepAt,
    roots: solve ? invertFamily(spec, valueAt, sweepAt, panelValue) : null,
    nearest: nearestCurve(spec, valueAt, sweepAt, curves),
  }), [spec, panelValue, curves]);

  /* ── Draw ─────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!curves.length || !plotRef.current) return;
    let dead = false;
    (async () => {
      const Plotly = (await import('plotly.js-dist-min')).default;
      if (dead || !plotRef.current) return;
      const c = chartColors(theme);
      const t = TOKENS[theme];

      const onX = spec.valueOnX;
      const putX = (v: number, s: number) => (onX ? v : s);
      const putY = (v: number, s: number) => (onX ? s : v);

      const traces: any[] = curves.map((cv, i) => ({
        x: cv.pts.map(p => putX(p.value, p.sweep)),
        y: cv.pts.map(p => putY(p.value, p.sweep)),
        mode: 'lines',
        name: `${spec.family.symbol} = ${cv.fv}`,
        line: { color: colors[i], width: 1.9, shape: 'spline', smoothing: 0.6 },
        hovertemplate:
          `${spec.family.symbol} = ${cv.fv}<br>${spec.sweep.label} = %{${onX ? 'y' : 'x'}:.3g}` +
          `<br>${spec.value.label} = %{${onX ? 'x' : 'y'}:.4g}<extra></extra>`,
      }));

      /* Curve labels, the way the book does them. Seventeen series is far past
         what a legend can carry, so each curve is named where it runs; the
         label positions march along the family so they never collide. */
      const annotations: any[] = [];
      curves.forEach((cv, i) => {
        const on = cv.pts.filter(p => Number.isFinite(p.value));
        if (!on.length) return;
        const frac = curves.length === 1 ? 0.5 : 0.1 + 0.8 * (i / (curves.length - 1));
        const p = on[Math.min(on.length - 1, Math.round(frac * (on.length - 1)))];
        annotations.push({
          x: putX(p.value, p.sweep), y: putY(p.value, p.sweep),
          text: String(cv.fv),
          showarrow: false,
          font: { family: 'IBM Plex Mono, monospace', size: 10.5, color: colors[i] },
          bgcolor: t.surface, borderpad: 1.5,
          xshift: onX ? 0 : 0, yshift: onX ? -9 : 9,
        });
      });

      // The solved point, plus crosshairs to both axes.
      const shapes: any[] = [];
      if (Number.isFinite(markerValue)) {
        const mx = putX(markerValue, sweepValue), my = putY(markerValue, sweepValue);
        traces.push({
          x: [mx], y: [my], mode: 'markers', name: 'Your point',
          marker: { size: 13, color: 'rgba(0,0,0,0)', line: { color: c.orange, width: 2.5 } },
          hovertemplate:
            `${spec.family.symbol} = ${fmtParam(familyValue)}<br>` +
            `${spec.sweep.label} = ${fmtParam(sweepValue)}<br>` +
            `${spec.value.label} = ${fmt(markerValue, 4)}<extra></extra>`,
        });
        shapes.push(
          { type: 'line', xref: onX ? 'paper' : 'x', x0: onX ? 0 : mx, x1: onX ? 1 : mx,
            y0: my, y1: my, line: { color: c.orange, width: 1, dash: 'dot' }, layer: 'below' },
          { type: 'line', yref: onX ? 'y' : 'paper', x0: mx, x1: mx,
            y0: onX ? my : 0, y1: onX ? my : 1, line: { color: c.orange, width: 1, dash: 'dot' }, layer: 'below' }
        );
      }

      // A ghost marker while the pointer is in the frame.
      const ghost = hover ?? pinned;
      if (ghost) {
        traces.push({
          x: [putX(ghost.value, ghost.sweep)], y: [putY(ghost.value, ghost.sweep)],
          mode: 'markers', name: 'Reading',
          marker: { size: 9, color: c.secondary, symbol: 'x-thin', line: { color: c.secondary, width: 2 } },
          hoverinfo: 'skip',
        });
      }

      const valueAxis = (title: string) => ({
        ...(onX ? axis(theme, title) : gridAxis(theme, title)),
        type: spec.value.log ? ('log' as const) : ('linear' as const),
        range: spec.value.log
          ? [Math.log10(spec.value.min), Math.log10(spec.value.max)]
          : [spec.value.min, spec.value.max],
        ...(spec.value.ticks
          ? { tickmode: 'array' as const, tickvals: spec.value.ticks, ticktext: spec.value.ticks.map(String) }
          : {}),
      });
      const sweepAxis = (title: string) => ({
        ...(onX ? gridAxis(theme, title) : axis(theme, title)),
        type: spec.sweep.log ? ('log' as const) : ('linear' as const),
        range: (() => {
          const lo = spec.sweep.log ? Math.log10(spec.sweep.min) : spec.sweep.min;
          const hi = spec.sweep.log ? Math.log10(spec.sweep.max) : spec.sweep.max;
          return spec.sweep.reversed ? [hi, lo] : [lo, hi];
        })(),
        ...(spec.sweep.ticks
          ? { tickmode: 'array' as const, tickvals: spec.sweep.ticks, ticktext: spec.sweep.ticks.map(String) }
          : {}),
      });

      await Plotly.react(plotRef.current, traces, baseLayout(theme, {
        height: 520,
        margin: { l: 58, r: 22, t: 10, b: 54 },
        xaxis: onX ? valueAxis(spec.value.label) : sweepAxis(spec.sweep.label),
        yaxis: onX ? sweepAxis(spec.sweep.label) : valueAxis(spec.value.label),
        showlegend: false,
        hovermode: 'closest',
        hoverlabel: hoverLabel(theme),
        annotations,
        shapes,
      }), plotConfig);
    })();
    return () => { dead = true; };
  }, [curves, colors, theme, spec, markerValue, sweepValue, familyValue, hover, pinned]);

  /* ── The pointer, which is the whole backwards half ───────────────────── */
  useEffect(() => {
    const gd = plotRef.current as any;
    if (!gd) return;
    let frame = 0;
    const split = (d: { x: number; y: number }) =>
      (spec.valueOnX ? [d.x, d.y] : [d.y, d.x]) as [number, number];

    const onMove = (e: MouseEvent) => {
      // One reading per animation frame. Without this the handler fires on
      // every pixel of travel, and each one redraws the figure.
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const d = pointerData(gd, e);
        if (!d) { setHover(null); return; }
        const [value, sweep] = split(d);
        setHover(read(value, sweep, !spec.heavy));
      });
    };
    const onLeave = () => setHover(null);
    const onClick = (e: MouseEvent) => {
      const d = pointerData(gd, e);
      if (!d) return;
      const [value, sweep] = split(d);
      setHover(null);
      setPinned(read(value, sweep, true));
    };
    gd.addEventListener('mousemove', onMove);
    gd.addEventListener('mouseleave', onLeave);
    gd.addEventListener('click', onClick);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      gd.removeEventListener('mousemove', onMove);
      gd.removeEventListener('mouseleave', onLeave);
      gd.removeEventListener('click', onClick);
    };
  }, [read, spec]);

  const reading = hover ?? pinned;
  const inFrame = (r: Reading) =>
    r.value >= spec.value.min && r.value <= spec.value.max &&
    r.sweep >= spec.sweep.min && r.sweep <= spec.sweep.max;

  /* ── Table view (§B9 — not optional) ──────────────────────────────────── */
  const tableRows = useMemo(() => {
    const stations = spec.sweep.ticks?.filter(v => v >= spec.sweep.min && v > 0)
      ?? Array.from({ length: 6 }, (_, i) => spec.sweep.min + ((i + 1) / 6) * (spec.sweep.max - spec.sweep.min));
    return stations.slice(0, 8).map(s => ({
      sweep: s,
      values: spec.family.values.map(fv => spec.evaluate(fv, s, panelValue)),
    }));
  }, [spec, panelValue, curves]);

  return (
    <>
      <div className="cee-row cee-row--wrap">
        {spec.panel && (
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="cr-panel">
              <span>{spec.panel.label}<Tip text={`Huang prints one chart per ${spec.panel.symbol}. Pick the panel you want; the curves are recomputed, not interpolated between printed sheets.`} /></span>
            </label>
            <select id="cr-panel" className="cee-input" value={panelValue}
              onChange={e => setPanelValue(Number(e.target.value))}>
              {spec.panel.values.map(v => (
                <option key={v} value={v}>{spec.panel!.name ? spec.panel!.name(v) : v}</option>
              ))}
            </select>
          </div>
        )}
        <div className="cee-field">
          <label className="cee-field__label" htmlFor="cr-family">
            <span>{spec.family.symbol}<Tip text={`${spec.family.label}. Any value in [${spec.family.range[0]}, ${spec.family.range[1]}] works — you are not restricted to the curves the book drew.`} /></span>
          </label>
          <input id="cr-family" className="cee-input" type="number" step="0.25" value={familyStr}
            onChange={e => setFamilyStr(e.target.value)} />
        </div>
        <div className="cee-field">
          <label className="cee-field__label" htmlFor="cr-sweep">
            <span>{spec.sweep.label}<Tip text="The other axis of the chart — where along the curve to read." /></span>
          </label>
          <input id="cr-sweep" className="cee-input" type="number" step="0.25" value={sweepStr}
            onChange={e => setSweepStr(e.target.value)} />
        </div>
      </div>

      <div className="cee-readout">
        <div className="cee-readout__main">
          <span className="cee-readout__label">{spec.value.label}</span>
          <span className="cee-readout__value">
            {Number.isFinite(markerValue) ? fmt(markerValue, 4) : '—'}
          </span>
        </div>
        <div className="cee-readout__eq">{spec.equation}</div>
        {Number.isFinite(markerValue) &&
          (markerValue < spec.value.min || markerValue > spec.value.max) && (
          <p className="cee-warn cee-warn--inline">
            <span className="cee-warn__icon">⚠️</span>
            <span>
              This value is <strong>off the printed chart</strong> — the axis stops at{' '}
              {markerValue < spec.value.min ? spec.value.min : spec.value.max}. The number is still
              right; Huang's page simply had nowhere to draw it.
            </span>
          </p>
        )}
      </div>

      <ChartFigure
        title={`${spec.figure} — ${spec.title}`}
        subtitle={
          <>
            {spec.source}. {spec.family.label}.
            {spec.rectified && ' Redrawn on real axes — see the note below.'}
          </>
        }
        plotRef={plotRef}
        takeaway={spec.purpose}
        affordance={busy ? <span className="cee-chip cee-chip--busy">Computing…</span> : undefined}
      >
        <p>
          <strong>Move the pointer over the chart.</strong> The reading below is solved from
          wherever the cursor is, not from the nearest data point — which is the half of a chart
          a printed page cannot do. Click to pin a reading.
        </p>
        {spec.notes?.map(n => <p key={n}>{n}</p>)}
        {spec.rectified && (
          <p>
            <strong>This figure is a nomograph in the book</strong> — two families of curves
            crossing over an abscissa that carries no variable at all, read by finding an
            intersection. There is nothing to reproduce on that axis, so it is redrawn here with{' '}
            {spec.sweep.label} on a real scale. Same families, same values, same anchors.
          </p>
        )}
      </ChartFigure>

      <div className="cee-card cee-card--reading">
        <h3 className="cee-card__title">Reading the chart backwards</h3>
        {!reading ? (
          <p className="cee-hint">
            Move the pointer into the chart. Whatever point it lands on, this panel solves for the{' '}
            {spec.family.symbol} whose curve passes through it — the question a printed chart
            cannot answer without a ruler and a guess.
          </p>
        ) : !inFrame(reading) ? (
          <p className="cee-hint">Pointer is outside the chart frame.</p>
        ) : (
          <>
            <p className="cee-reading__at">
              At <strong>{spec.value.label} = {fmt(reading.value, 4)}</strong> and{' '}
              <strong>{spec.sweep.label} = {fmt(reading.sweep, 3)}</strong>:
            </p>
            {reading.roots === null ? (
              <p className="cee-hint">
                <strong>Click to solve for {spec.family.symbol}.</strong> Every point on this chart
                is a critical-strain search over a whole wheel group, so the inverse does not run
                while the pointer is moving -- it would be a few hundred solves a frame.
              </p>
            ) : reading.roots.length === 0 ? (
              <p className="cee-warn cee-warn--inline">
                <span className="cee-warn__icon">⚠️</span>
                <span>
                  No value of {spec.family.symbol} reaches this point. That is a real answer, not a
                  gap in the chart — this combination does not occur.
                </span>
              </p>
            ) : (
              <ul className="cee-reading__roots">
                {reading.roots.map((r, i) => (
                  <li key={i}>
                    <code>{spec.family.symbol} = {fmtParam(r)}</code>
                    {reading.roots!.length > 1 && i === 0 && (
                      <span className="cee-reading__note">
                        {' '}— two answers, because this family turns back on itself
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {reading.nearest && (
              <p className="cee-reading__near">
                Nearest printed curve: <code>{spec.family.symbol} = {reading.nearest.familyValue}</code>,
                which passes through {spec.value.label} = {fmt(reading.nearest.value, 3)} at{' '}
                {spec.sweep.label} = {fmt(reading.nearest.sweep, 3)}.
              </p>
            )}
            <button type="button" className="cee-btn cee-btn--ghost cee-btn--sm"
              onClick={() => {
                if (reading.roots?.length) setFamilyStr(fmtParam(reading.roots[0]));
                setSweepStr(fmtParam(reading.sweep));
                setPinned(null);
              }}>
              Use this reading as the input
            </button>
          </>
        )}
      </div>

      {!!spec.anchors?.length && (
        <div className="cee-card cee-card--anchors">
          <h3 className="cee-card__title">Checkpoints from the book</h3>
          <p className="cee-hint">
            Reads Huang prints in a worked example. Load one and the marker should land on the
            printed value — that is how you tell this chart is still his chart.
          </p>
          <ul className="cee-anchors">
            {spec.anchors.map(a => (
              <li key={a.label}>
                <button type="button" className="cee-chip" onClick={() => {
                  setFamilyStr(String(a.fv));
                  setSweepStr(String(a.sv));
                  if (a.pv !== undefined) setPanelValue(a.pv);
                }}>
                  {a.label}
                </button>
                <span className="cee-anchors__read">
                  {spec.family.symbol} = {a.fv}, {spec.sweep.label} = {a.sv} → reads {a.reads}
                  {' '}· computed {fmt(spec.evaluate(a.fv, a.sv, a.pv), 4)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="cee-tablewrap">
        <table className="cee-table">
          <caption className="cee-table__caption">
            The chart as numbers — every curve at each printed station of {spec.sweep.label}.
          </caption>
          <thead>
            <tr>
              <th>{spec.sweep.label}</th>
              {spec.family.values.map(fv => <th key={fv}>{fv}</th>)}
            </tr>
          </thead>
          <tbody>
            {tableRows.map(r => (
              <tr key={r.sweep}>
                <td>{fmtParam(r.sweep)}</td>
                {r.values.map((v, i) => (
                  <td key={i}>{Number.isFinite(v) ? fmt(v, 3) : '—'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
