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
  useTheme, chartColors, baseLayout, plotConfig, paperAxis, paperFrame,
  rampSeries, hoverLabel, fmt, TOKENS,
} from '../../chartTheme';
import ChartFigure from '../../ui/ChartFigure';
import type { AxisSpec, ChartSpec, CurvePoint, LatticeCurve } from '../charts.ts';
import {
  sampleCurve, invertFamily, nearestCurve,
  curveLabelSpots, emptiestCorner, CORNER_XY,
  sampleLattice, latticeLabels, latticeX, invertLattice, latticeCorner, LATTICE_RANGE,
} from '../charts.ts';

/** Which ramp carries which chart, per the §B4 semantic binding. */
function rampFor(spec: ChartSpec) {
  if (/deflection|w\b/i.test(spec.value.label)) return 'emerald' as const;
  if (/strain/i.test(spec.value.label)) return 'blue' as const;
  if (/factor C/i.test(spec.value.label)) return 'neutral' as const;
  return 'orange' as const;
}

/**
 * The second family of a lattice.
 *
 * §B4 binds a hue to the physical quantity, and on every other chart the
 * quantity is the value axis — one ramp, ordered along the family. A
 * nomograph draws TWO families at once and the reader's first job is telling
 * them apart, so the second gets its own ramp. It is still ordered and still
 * a ramp; the pair is the §B4 orange/blue adjacency, which the palette test
 * already gates as distinguishable.
 */
const secondRamp = (first: ReturnType<typeof rampFor>) =>
  (first === 'blue' ? 'orange' : 'blue') as 'orange' | 'blue';

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
  /** The sweep coordinate — or, on a nomograph, the lattice abscissa. */
  sweep: number;
  /** Family values whose curve passes through it; null when not solved yet. */
  roots: number[] | null;
  /** The nearest printed curve. */
  nearest: { familyValue: number; sweep: number; value: number } | null;
  /**
   * Nomographs only: the (family, sweep) pairs whose curves cross here. A
   * point on a lattice looks like it carries less than a point on a plot,
   * because the abscissa means nothing — but x fixes one combination of the
   * two parameters and the ordinate fixes another, so the pair is determined.
   */
  pairs: { family: number; sweep: number }[] | null;
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
  const [lattice, setLattice] = useState<LatticeCurve[] | null>(null);

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
      if (spec.nomograph) {
        // The mesh already carries the family curves, sampled the same way,
        // so the reading machinery below takes them from it rather than
        // solving the whole family a second time.
        const mesh = sampleLattice(spec, panelValue);
        if (dead) return;
        setLattice(mesh);
        setCurves(mesh.filter(c => c.kind === 'family').map(c => ({
          fv: c.label,
          pts: c.pts.map(pt => ({ sweep: pt.sweep, value: pt.value })),
        })));
        setBusy(false);
        return;
      }
      const out = spec.family.values.map(fv => ({ fv, pts: sampleCurve(spec, fv, panelValue) }));
      if (!dead) { setLattice(null); setCurves(out); setBusy(false); }
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
  const read = useMemo(() => (valueAt: number, sweepAt: number, solve: boolean): Reading => {
    if (spec.nomograph) {
      // `sweepAt` is the lattice abscissa here, and no nearest curve is
      // offered: nearestCurve measures in the value/sweep frame, which is not
      // the frame this chart is drawn in.
      return {
        value: valueAt, sweep: sweepAt, roots: null, nearest: null,
        pairs: solve ? invertLattice(spec, sweepAt, valueAt, panelValue) : null,
      };
    }
    return {
      value: valueAt,
      sweep: sweepAt,
      roots: solve ? invertFamily(spec, valueAt, sweepAt, panelValue) : null,
      nearest: nearestCurve(spec, valueAt, sweepAt, curves),
      pairs: null,
    };
  }, [spec, panelValue, curves]);

  /* ── The curve you asked for ──────────────────────────────────────────
   * The whole difference between this and the page it redraws. Foster and
   * Ahlvin drew seventeen values of r/a because seventeen is what fits on a
   * sheet of paper; the function underneath is continuous, and a reader who
   * needs r/a = 3.4 is meant to interpolate by eye between the 3 and the 4.
   * Here that curve is simply computed and drawn through the gap, dashed so
   * it cannot be mistaken for one the book printed.
   *
   * It is deferred and debounced for the same reason the family is: on the
   * conversion-factor chart every point is a critical-strain search, and this
   * would otherwise run one per keystroke.
   */
  const [userCurve, setUserCurve] = useState<CurvePoint[] | null>(null);
  useEffect(() => {
    const [lo, hi] = spec.family.range;
    const printed = spec.family.values.some(v => Math.abs(v - familyValue) < 1e-9);
    if (!Number.isFinite(familyValue) || printed || familyValue < lo || familyValue > hi) {
      setUserCurve(null);
      return;
    }
    let dead = false;
    const t = window.setTimeout(() => {
      const pts = sampleCurve(spec, familyValue, panelValue);
      if (!dead) setUserCurve(pts);
    }, spec.heavy ? 320 : 140);
    return () => { dead = true; window.clearTimeout(t); };
  }, [spec, familyValue, panelValue]);

  /* ── Draw ─────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!curves.length || !plotRef.current) return;
    if (spec.nomograph && !lattice) return;
    let dead = false;
    (async () => {
      const Plotly = (await import('plotly.js-dist-min')).default;
      if (dead || !plotRef.current) return;
      const c = chartColors(theme);
      const t = TOKENS[theme];

      // A nomograph is a lattice over an abscissa that carries no variable,
      // so the value/sweep plane the other charts are drawn in does not exist
      // here: x is the mesh coordinate and y is always the value.
      const nomo = spec.nomograph === true && lattice !== null;
      const onX = spec.valueOnX;
      const putX = (v: number, s: number) => (onX ? v : s);
      const putY = (v: number, s: number) => (onX ? s : v);

      /* Plotly is asymmetric about log axes and silent about it. On a log
         axis an axis `range` and an ANNOTATION position are given in log10;
         a trace and a SHAPE are given in data units. Getting it wrong never
         errors — the mark is simply placed at 10^value, three decades off
         the page, or at log10(value), which on this chart is somewhere
         around 1.5%. Both were verified against the rendered SVG rather
         than against the reference docs, which describe shapes as log too. */
      const toAx = (a: AxisSpec, v: number) => (a.log ? Math.log10(Math.max(v, 1e-12)) : v);
      const LATTICE_AXIS: AxisSpec = {
        label: '', log: false, min: LATTICE_RANGE[0], max: LATTICE_RANGE[1],
      };
      const xAxis = nomo ? LATTICE_AXIS : (onX ? spec.value : spec.sweep);
      const yAxis = nomo ? spec.value : (onX ? spec.sweep : spec.value);
      const annX = (x: number) => toAx(xAxis, x);
      const annY = (y: number) => toAx(yAxis, y);
      // Where a point of the TYPED family value lands: the marker and the
      // interpolated curve are both at familyValue, and on a lattice their
      // abscissa is the mesh coordinate rather than one of the two variables.
      const ownX = (v: number, s: number) => (nomo ? latticeX(spec, familyValue, s) : putX(v, s));
      const ownY = (v: number, s: number) => (nomo ? v : putY(v, s));

      // Enough samples to draw the function honestly means drawing it
      // straight between them; only the charts that cost seconds a panel are
      // sampled too coarsely for that and get a spline through the points.
      const shape = (spec.samples ?? 70) < 60 ? ('spline' as const) : ('linear' as const);

      const traces: any[] = [];
      const annotations: any[] = [];

      const plotW = plotRef.current.clientWidth || 900;
      const height = 560;
      const aspect = Math.max(0.6, Math.min(3, (plotW - 110) / (height - 90)));

      if (nomo) {
        /* ── The mesh ───────────────────────────────────────────────────
           Both families at once, each on its own ramp so the reader can
           tell which of the two crossing sets a curve belongs to — see
           secondRamp. Every crossing carries the true computed value; the
           abscissa is the spreading coordinate the plate was drawn on. */
        const fam = lattice!.filter(cv => cv.kind === 'family');
        const swp = lattice!.filter(cv => cv.kind === 'sweep');
        const famRamp = rampSeries(rampFor(spec), theme, fam.length);
        const swpRamp = rampSeries(secondRamp(rampFor(spec)), theme, swp.length);
        const inkOf = (kind: LatticeCurve['kind'], i: number) =>
          (kind === 'family' ? famRamp : swpRamp)[i];

        for (const [group, ramp] of [[fam, famRamp], [swp, swpRamp]] as const) {
          group.forEach((cv, i) => {
            const symbol = cv.kind === 'family' ? spec.family.symbol : spec.sweep.label;
            const other = cv.kind === 'family' ? spec.sweep.label : spec.family.symbol;
            traces.push({
              x: cv.pts.map(p => p.x),
              y: cv.pts.map(p => p.value),
              mode: 'lines',
              name: `${symbol} = ${cv.label}`,
              line: { color: ramp[i], width: 1.7, shape, smoothing: 0.6 },
              customdata: cv.pts.map(p => (cv.kind === 'family' ? p.sweep : p.family)),
              hovertemplate:
                `${symbol} = ${cv.label}<br>${other} = %{customdata:.3g}` +
                `<br>${spec.value.label} = %{y:.4g}<extra></extra>`,
            });
          });
        }

        /* Both plates name every curve at ONE end, outside the mesh: the
           first family at its sweep-min end, which runs down the left of the
           figure, the second at its family-max end, down the right. That is
           not a stylistic choice — it is why "A = 0.1  H = 8" is printed
           together at the bottom apex of Figure 2.31, because those two ends
           land on the same abscissa. They do here too. */
        for (const l of latticeLabels(spec, lattice!)) {
          const group = l.kind === 'family' ? fam : swp;
          const i = group.findIndex(cv => cv.label === l.label);
          annotations.push({
            x: annX(l.x), y: annY(l.value),
            text: fmtParam(l.label),
            showarrow: false,
            xanchor: l.kind === 'family' ? 'right' : 'left',
            yanchor: 'middle',
            xshift: l.kind === 'family' ? -3 : 3,
            font: { family: 'IBM Plex Mono, monospace', size: 10.5, color: inkOf(l.kind, i) },
            bgcolor: t.surface, borderpad: 2,
          });
        }

        // The caption has to name both families, and which side each is on —
        // and it has to keep off the bottom centre, where both plates print
        // their two extreme labels together at the apex of the mesh.
        const nomoCorner = CORNER_XY[latticeCorner(spec, lattice!, { w: 0.46, h: 0.13 })];
        annotations.push({
          xref: 'x domain', yref: 'y domain',
          x: nomoCorner.x, y: nomoCorner.y,
          xanchor: nomoCorner.xanchor, yanchor: nomoCorner.yanchor,
          text:
            `Numbers on curves indicate <span style="color:${famRamp[famRamp.length - 1]}">` +
            `${spec.family.symbol}</span> (left) and ` +
            `<span style="color:${swpRamp[swpRamp.length - 1]}">${spec.sweep.label}</span> (right)`,
          showarrow: false, align: 'left',
          font: { family: 'IBM Plex Sans, system-ui, sans-serif', size: 11.5, color: t.secondary },
          bgcolor: t.surface, bordercolor: t.frame, borderwidth: 1, borderpad: 6,
        });
      } else {
        curves.forEach((cv, i) => {
          traces.push({
            x: cv.pts.map(p => putX(p.value, p.sweep)),
            y: cv.pts.map(p => putY(p.value, p.sweep)),
            mode: 'lines',
            name: `${spec.family.symbol} = ${cv.fv}`,
            line: { color: colors[i], width: 1.7, shape, smoothing: 0.6 },
            hovertemplate:
              `${spec.family.symbol} = ${cv.fv}<br>${spec.sweep.label} = %{${onX ? 'y' : 'x'}:.3g}` +
              `<br>${spec.value.label} = %{${onX ? 'x' : 'y'}:.4g}<extra></extra>`,
          });
        });

        /* ── Labels on the curves, the way the book does them ────────────
           Seventeen series is far past what a legend can carry, so each
           curve is named in a gap in its own ink and a caption in the
           emptiest corner says what the numbers mean. The placement is
           solved in frame coordinates — see curveLabelSpots — using the
           figure's real aspect ratio, because a horizontal gap between two
           numbers is worth more pixels than a vertical one. */
        for (const spot of curveLabelSpots(spec, curves, { aspect })) {
          const i = curves.findIndex(cv => cv.fv === spot.fv);
          annotations.push({
            x: annX(putX(spot.value, spot.sweep)),
            y: annY(putY(spot.value, spot.sweep)),
            text: fmtParam(spot.fv),
            showarrow: false,
            // A number centred on a curve that runs along the frame edge
            // would hang half outside it; near an edge the label pushes in.
            xanchor: spot.sx < 0.09 ? 'left' : spot.sx > 0.91 ? 'right' : 'center',
            yanchor: spot.sy < 0.07 ? 'top' : spot.sy > 0.93 ? 'bottom' : 'middle',
            font: { family: 'IBM Plex Mono, monospace', size: 10.5, color: colors[i] ?? c.ink },
            // The opaque patch IS the contour label: it breaks the line it
            // sits on, exactly as an engraver would have left a gap for it.
            bgcolor: t.surface,
            borderpad: 2,
          });
        }

        // The caption the printed chart carries instead of a legend.
        const corner = CORNER_XY[emptiestCorner(spec, curves)];
        annotations.push({
          xref: 'x domain', yref: 'y domain',
          x: corner.x, y: corner.y, xanchor: corner.xanchor, yanchor: corner.yanchor,
          text: spec.family.label,
          showarrow: false, align: 'left',
          font: { family: 'IBM Plex Sans, system-ui, sans-serif', size: 11.5, color: t.secondary },
          bgcolor: t.surface, bordercolor: t.frame, borderwidth: 1, borderpad: 6,
        });
      }

      // The interpolated curve, between the printed ones. On a lattice it
      // threads the mesh, which is the clearest possible statement that the
      // printed curves are a sample and not the function.
      if (userCurve?.some(p => Number.isFinite(p.value))) {
        traces.push({
          x: userCurve.map(p => ownX(p.value, p.sweep)),
          y: userCurve.map(p => ownY(p.value, p.sweep)),
          mode: 'lines',
          name: `${spec.family.symbol} = ${fmtParam(familyValue)}`,
          line: { color: c.orange, width: 2.4, dash: 'dash', shape, smoothing: 0.6 },
          customdata: userCurve.map(p => p.sweep),
          hovertemplate:
            `${spec.family.symbol} = ${fmtParam(familyValue)} (interpolated)<br>` +
            `${spec.sweep.label} = %{customdata:.3g}` +
            `<br>${spec.value.label} = %{${nomo || !onX ? 'y' : 'x'}:.4g}<extra></extra>`,
        });
        const on = userCurve.filter(p => Number.isFinite(p.value));
        const p = on[Math.round(0.42 * (on.length - 1))];
        annotations.push({
          x: annX(ownX(p.value, p.sweep)), y: annY(ownY(p.value, p.sweep)),
          text: fmtParam(familyValue),
          showarrow: false, xanchor: 'center', yanchor: 'middle',
          font: { family: 'IBM Plex Mono, monospace', size: 10.5, color: c.orange },
          bgcolor: t.surface, bordercolor: c.orange, borderwidth: 1, borderpad: 2,
        });
      }

      // The solved point, plus crosshairs to the frame.
      const shapes: any[] = [];
      if (Number.isFinite(markerValue)) {
        const mx = ownX(markerValue, sweepValue), my = ownY(markerValue, sweepValue);
        traces.push({
          x: [mx], y: [my], mode: 'markers', name: 'Your point',
          marker: { size: 13, color: 'rgba(0,0,0,0)', line: { color: c.orange, width: 2.5 } },
          hovertemplate:
            `${spec.family.symbol} = ${fmtParam(familyValue)}<br>` +
            `${spec.sweep.label} = ${fmtParam(sweepValue)}<br>` +
            `${spec.value.label} = ${fmt(markerValue, 4)}<extra></extra>`,
        });
        // Crosshairs run to the frame, which is now a real edge to read
        // against — that is what the border is for. A lattice gets only the
        // one to the ordinate: there is nothing on its abscissa to reach.
        shapes.push({
          type: 'line', xref: 'x domain', x0: 0, x1: 1, yref: 'y', y0: my, y1: my,
          line: { color: c.orange, width: 1, dash: 'dot' }, layer: 'below',
        });
        if (!nomo) {
          shapes.push({
            type: 'line', yref: 'y domain', y0: 0, y1: 1, xref: 'x', x0: mx, x1: mx,
            line: { color: c.orange, width: 1, dash: 'dot' }, layer: 'below',
          });
        }
      }

      // A ghost marker while the pointer is in the frame.
      const ghost = hover ?? pinned;
      if (ghost) {
        traces.push({
          x: [nomo ? ghost.sweep : putX(ghost.value, ghost.sweep)],
          y: [nomo ? ghost.value : putY(ghost.value, ghost.sweep)],
          mode: 'markers', name: 'Reading',
          marker: { size: 9, color: c.secondary, symbol: 'x-thin', line: { color: c.secondary, width: 2 } },
          hoverinfo: 'skip',
        });
      }

      /* ── The frame ─────────────────────────────────────────────────────
         Log paper, not dashboard chrome: a boxed border, major and minor
         divisions, and tick VALUES on all four sides so a point in the
         middle of the chart can be run out to a number in whichever
         direction is shorter. §B6 deviation 5 says why these figures get a
         different axis vocabulary from every other chart in the toolbox. */
      const paperFor = (a: AxisSpec, title: string) => paperAxis(theme, {
        title,
        type: a.log ? 'log' : 'linear',
        range: (() => {
          const lo = a.log ? Math.log10(a.min) : a.min;
          const hi = a.log ? Math.log10(a.max) : a.max;
          return (a.reversed ? [hi, lo] : [lo, hi]) as [number, number];
        })(),
        tickvals: a.ticks,
        minorDtick: a.minorDtick,
      });

      // The lattice abscissa keeps the frame line and nothing else. It is
      // blank on the page because there is nothing on it to read, and a tick
      // here would be an invitation to read one.
      const xa = nomo
        ? paperAxis(theme, { range: LATTICE_RANGE, tickvals: [] })
        : paperFor(xAxis, xAxis.label);
      const frame = paperFrame(theme, xa, paperFor(yAxis, yAxis.label));
      traces.push(frame.anchor);

      await Plotly.react(plotRef.current, traces, baseLayout(theme, {
        height,
        margin: { l: 34, r: 34, t: 26, b: 34 },
        ...frame.axes,
        showlegend: false,
        hovermode: 'closest',
        hoverlabel: hoverLabel(theme),
        annotations,
        shapes,
      }), plotConfig);
    })();
    return () => { dead = true; };
  }, [curves, lattice, userCurve, colors, theme, spec, markerValue, sweepValue, familyValue, hover, pinned]);

  /* ── The pointer, which is the whole backwards half ───────────────────── */
  useEffect(() => {
    const gd = plotRef.current as any;
    if (!gd) return;
    let frame = 0;
    // Returns [value, sweep] — and on a nomograph the second slot is the
    // lattice abscissa, which is what invertLattice takes.
    const split = (d: { x: number; y: number }) =>
      (spec.nomograph || !spec.valueOnX ? [d.y, d.x] : [d.x, d.y]) as [number, number];

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
    (spec.nomograph
      ? r.sweep >= LATTICE_RANGE[0] && r.sweep <= LATTICE_RANGE[1]
      : r.sweep >= spec.sweep.min && r.sweep <= spec.sweep.max);

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
            <span>{spec.family.symbol}<Tip text={`${spec.family.label}. Any value in [${spec.family.range[0]}, ${spec.family.range[1]}] works — you are not restricted to the ${spec.family.values.length} the book drew. Type one it did not print and that curve is computed and drawn dashed, through the gap.`} /></span>
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
            {spec.source}.{' '}
            {spec.nomograph
              ? `A lattice of ${spec.family.symbol} against ${spec.sweep.label}, as printed.`
              : `${spec.family.label}.`}
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
        <p>
          <strong>Read it like the page.</strong>{' '}
          {spec.nomograph
            ? `Find where your ${spec.family.symbol} curve crosses your ${spec.sweep.label} curve, and run left to the ordinate. The frame is boxed and the ordinate is repeated on the right, so the shorter run is always available; the faint divisions between the labelled ticks are the ruled paper the figure was printed on.`
            : 'The frame is boxed and the tick values are repeated on all four sides, so a point in the middle can be run out to a number in whichever direction is shorter; the faint divisions between the labelled ticks are the ruled paper the figure was printed on, and they are what makes a value between two labels readable rather than guessable. Each curve is named in a gap in its own ink, the way a contour is.'}
        </p>
        <p>
          <strong>Nothing here is restricted to the {spec.family.values.length} curves that
          fitted on the sheet.</strong> Type any {spec.family.symbol} in
          [{spec.family.range[0]}, {spec.family.range[1]}] and it is computed and drawn dashed
          {spec.nomograph ? ', threading the mesh between the printed ones' : ', between the printed ones'}
          {' '}— the interpolation the book asks you to do by eye.
        </p>
        {spec.notes?.map(n => <p key={n}>{n}</p>)}
        {spec.nomograph && (
          <p>
            <strong>The abscissa is blank because it is blank in the book.</strong> This figure is
            a nomograph: two families crossing in a mesh over an axis that carries no variable at
            all. That axis is not arbitrary, though — a point's place on it is its position
            along one family plus its position along the other, which is why {spec.figure}'s
            corners, its label runs down the left and the right, and the apex where the two
            extreme curves meet all land where the plate puts them. Every crossing here carries
            the computed value, so this is the book's mesh rather than a picture of it.
          </p>
        )}
      </ChartFigure>

      <div className="cee-card cee-card--reading">
        <h3 className="cee-card__title">Reading the chart backwards</h3>
        {!reading ? (
          <p className="cee-hint">
            Move the pointer into the chart.{' '}
            {spec.nomograph
              ? `Whatever point it lands on, this panel solves for the ${spec.family.symbol} and ${spec.sweep.label} whose curves cross there. A point on a nomograph looks like it carries less than a point on a plot, because the abscissa means nothing — but the pair is determined, and the printed page cannot recover it.`
              : `Whatever point it lands on, this panel solves for the ${spec.family.symbol} whose curve passes through it — the question a printed chart cannot answer without a ruler and a guess.`}
          </p>
        ) : !inFrame(reading) ? (
          <p className="cee-hint">Pointer is outside the chart frame.</p>
        ) : (
          <>
            <p className="cee-reading__at">
              At <strong>{spec.value.label} = {fmt(reading.value, 4)}</strong>
              {spec.nomograph
                ? ', this point of the mesh is:'
                : <> and <strong>{spec.sweep.label} = {fmt(reading.sweep, 3)}</strong>:</>}
            </p>
            {spec.nomograph ? (
              reading.pairs === null ? (
                <p className="cee-hint">
                  <strong>Click to solve for {spec.family.symbol} and {spec.sweep.label}.</strong>{' '}
                  Every point of this mesh costs a full layered solve, so the inverse waits for a
                  click rather than running a few hundred of them per frame.
                </p>
              ) : reading.pairs.length === 0 ? (
                <p className="cee-warn cee-warn--inline">
                  <span className="cee-warn__icon">⚠️</span>
                  <span>
                    No pair of {spec.family.symbol} and {spec.sweep.label} lands here. That is a
                    real answer: the point is outside the mesh, and the section it would describe
                    is not one this chart covers.
                  </span>
                </p>
              ) : (
                <ul className="cee-reading__roots">
                  {reading.pairs.map((r, i) => (
                    <li key={i}>
                      <code>
                        {spec.family.symbol} = {fmtParam(r.family)}, {spec.sweep.label} ={' '}
                        {fmtParam(r.sweep)}
                      </code>
                      {reading.pairs!.length > 1 && i === 0 && (
                        <span className="cee-reading__note">
                          {' '}— more than one, because these families turn back on themselves
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )
            ) : reading.roots === null ? (
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
                if (reading.pairs?.length) {
                  setFamilyStr(fmtParam(reading.pairs[0].family));
                  setSweepStr(fmtParam(reading.pairs[0].sweep));
                } else {
                  if (reading.roots?.length) setFamilyStr(fmtParam(reading.roots[0]));
                  setSweepStr(fmtParam(reading.sweep));
                }
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
