// Contact Stress Visualizer — the 3-D tire–pavement contact stress field a
// truck tire actually applies, against the uniform circle every design method
// assumes it applies.
//
// The prediction is phyContactGAN (Lang, Villamil & Al-Qadi 2026, ICT), a
// physics-informed cGAN trained on 1,852 validated FE simulations of a
// 275/80R22.5 truck tire. The network is not shipped; predictor.ts explains
// what is. The idealizations it is measured against are Huang §1.3 —
// Eq. 1.1 and Figures 1.13/1.14 — and live in equations.ts.
//
// Color: vertical stress is one-signed, so it takes `fieldScale` — the
// magnitude ramp of docs/chart-standards.md §B5 deviation 1, still the stress
// hue of §B4 but washed at zero and intense at the peak in *both* themes. The
// named §B5 ramps reverse their ends in dark mode (§A4.2), which is right for
// a count and wrong here: it painted the near-zero haze around the patch in
// deep 900 orange and the peak in pale 100, so the field read inside out. The
// two shear components change sign inside the footprint, and any sequential
// ramp on signed data hides exactly the thing the student is looking for, so
// they take a diverging blue–orange scale from the same tokens, symmetric
// about zero — and, alone in this tool, one whose half-extent follows the case
// rather than the slider's whole reach. equations.ts, at shearLimit(), is
// where that exception is argued.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Tip from '../Tip';
import Card from '../ui/Card';
import KpiStrip, { Kpi } from '../ui/KpiStrip';
import Legend from '../ui/Legend';
import RampBar from '../ui/RampBar';
import {
  useTheme, chartColors, baseLayout, plotConfig, axis, gridAxis, fieldScale,
  divergingScale, withAlpha, num,
} from '../chartTheme';
import {
  loadManifest, loadTire, predict, CHANNELS,
  type Channel, type Condition, type Inputs, type Manifest, type Speed,
  type TirePack, type TireType,
} from './predictor.ts';
import {
  idealizedContact, planFrame, huangOutline, circleOutline, rectOutline,
  fieldMetrics, compare, decimate, peakRow, rowProfile, colProfile,
  CONTACT_THRESHOLD, SPEED_KMH, SAFE_RANGE, SLIP_RANGE, EQUILIBRIUM_BAND, TENSION_LIMIT,
  clampTo, trainedBox,
  FIELD_RANGE, profileRange, divergingLimit, shearLimit,
  forceOut, forceUnit, pressureOut, pressureUnit, lengthOut, lengthUnit,
  areaOut, areaUnit, N_PER_LBF, PSI_PER_MPA,
  type UnitSystem,
} from './equations.ts';
import '../tools.css';

const BASE = import.meta.env.BASE_URL;

const LABEL: Record<Channel, string> = {
  vertical: 'Vertical σz',
  longitudinal: 'Longitudinal σx',
  transverse: 'Transverse σy',
};
const SUBLABEL: Record<Channel, string> = {
  vertical: 'normal to the pavement',
  longitudinal: 'along the direction of travel',
  transverse: 'across the tire',
};

/* What the two branches of the checkpoint actually are.
 *
 * The plan view is the only place in the tool where a student sees the tire at
 * all — everywhere else it is already a field — so the footprint card carries
 * the photograph and the finite-element mesh the field was computed on, beside
 * the patch they produce. A dual assembly is two tires straddling a gap; a
 * wide-base is one. That is the whole reason the two footprints look nothing
 * alike, and it is much faster seen than read.
 *
 * Both files are square with a transparent ground, so the proportions on the
 * page are the tire's own: the pair reads wide and short, the single tall and
 * narrow. Only the DTA designation is on record in the manifest, so the
 * wide-base tile does not claim one.
 */
const TIRE_ART: Record<TireType, {
  name: string;
  size: string | null;
  /** Only where the picture and the field are not the same object. */
  note: string | null;
  real: string;
  realAlt: string;
  model: string;
  modelAlt: string;
}> = {
  DTA: {
    name: 'Dual tire assembly',
    size: '275/80R22.5',
    // The photograph is the pair, because the pair is what distinguishes this
    // branch from the wide-base one. The solution window is 321 x 224 mm and
    // the load slider is per tire (see the preset note in equations.ts: "20 kN
    // per tire"), so the field beside it is ONE tire of that pair. Say so —
    // without this line the picture claims a footprint the plot is not.
    note: 'Field shown is one tire of the pair.',
    real: 'dta-real.webp',
    realAlt: 'Photograph of a dual tire assembly: two identical truck tires mounted side by side on one hub, separated by a narrow gap.',
    model: 'dta-model.webp',
    modelAlt: 'Finite-element mesh of the same dual assembly, tread in red over the blue belt package and the yellow carcass.',
  },
  WBT: {
    name: 'Wide-base tire',
    size: null,
    note: null,
    real: 'wbt-real.webp',
    realAlt: 'Photograph of a wide-base single truck tire: one tread about as wide as a dual assembly, on a single rim.',
    model: 'wbt-model.webp',
    modelAlt: 'Finite-element mesh of the same wide-base tire, tread in red over the blue belt package and the yellow carcass.',
  },
};

/* The signed shear components take the shared diverging scale (blue ← 0 →
   orange): zero is the card, so "no shear here" reads as bare surface in
   either theme, and neither sign of the friction force is drawn louder than
   the other. See `divergingScale` in chartTheme for the full contract. */

type View = 'all' | Channel;

export default function ContactStressApp() {
  const theme = useTheme();
  const [unit, setUnit] = useState<UnitSystem>('SI');
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [packs, setPacks] = useState<Partial<Record<TireType, TirePack>>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  const [tire, setTire] = useState<TireType>('DTA');
  const [load, setLoad] = useState(42000);
  const [pressure, setPressure] = useState(0.69);
  const [slip, setSlip] = useState(0);
  const [speed, setSpeed] = useState<Speed>('5mph');
  const [condition, setCondition] = useState<Condition>('FR');
  const [view, setView] = useState<View>('all');
  const [overlay, setOverlay] = useState(true);

  /* ── artifact loading ─────────────────────────────────────────────── */

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const m = await loadManifest(BASE);
        const p = await loadTire(BASE, m, 'DTA');
        if (dead) return;
        setManifest(m);
        setPacks({ DTA: p });
      } catch (e) {
        if (!dead) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!dead) setBusy(false);
      }
    })();
    return () => { dead = true; };
  }, []);

  useEffect(() => {
    if (!manifest || packs[tire]) return;
    let dead = false;
    setBusy(true);
    (async () => {
      try {
        const p = await loadTire(BASE, manifest, tire);
        if (!dead) setPacks((prev) => ({ ...prev, [tire]: p }));
      } catch (e) {
        if (!dead) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!dead) setBusy(false);
      }
    })();
    return () => { dead = true; };
  }, [manifest, tire, packs]);

  const pack = packs[tire];
  const spec = manifest?.tires[tire];

  /* The WBT branch of the checkpoint was trained free-rolling at one speed —
     its slip normalization has zero standard deviation — so those controls are
     not offered for it rather than silently extrapolated. */
  const wbtOnlyFR = tire === 'WBT';
  useEffect(() => {
    if (!wbtOnlyFR) return;
    setSpeed('5mph');
    setCondition('FR');
    setSlip(0);
  }, [wbtOnlyFR]);

  /* Keep the wheel load and pressure inside the admissible box of whichever
     branch is selected — the two boxes differ, and the wide-base one is much
     the smaller, so switching tire has to pull the sliders in with it. */
  const safe = SAFE_RANGE[tire];
  useEffect(() => {
    setLoad((L) => clampTo(L, safe.load));
    setPressure((p) => clampTo(p, safe.pressure));
  }, [safe]);

  const inputs: Inputs = useMemo(
    () => ({
      tire, load, pressure, speed, condition,
      slip: condition === 'FR' ? 0 : clampTo(slip, SLIP_RANGE),
    }),
    [tire, load, pressure, slip, speed, condition]
  );

  /* ── prediction ───────────────────────────────────────────────────── */

  const result = useMemo(() => {
    if (!pack || !spec) return null;
    const { height: h, width: w, mmPerPixelY: dy, mmPerPixelX: dx } = spec;
    const fields = {} as Record<Channel, Float32Array>;
    for (const ch of CHANNELS) fields[ch] = predict(pack, ch, inputs);
    const vert = fieldMetrics(fields.vertical, h, w, dy, dx);
    const metrics = {
      vertical: vert,
      longitudinal: fieldMetrics(fields.longitudinal, h, w, dy, dx, fields.vertical),
      transverse: fieldMetrics(fields.transverse, h, w, dy, dx, fields.vertical),
    };
    const ideal = idealizedContact(inputs.load, inputs.pressure);
    return { fields, metrics, ideal, cmp: compare(vert, ideal, inputs.load), h, w, dy, dx };
  }, [pack, spec, inputs]);

  /* Center of the predicted patch, so the idealized outlines are compared
     against it rather than against the corner of the raster. */
  const center = useMemo(() => {
    if (!result?.metrics.vertical.bounds) return null;
    const [r0, r1, c0, c1] = result.metrics.vertical.bounds;
    return { y: ((r0 + r1 + 1) / 2) * result.dy, x: ((c0 + c1 + 1) / 2) * result.dx };
  }, [result]);

  /* ── plots ────────────────────────────────────────────────────────── */

  /* The half-extent the two shear windows are drawn on: symmetric, snapped to
     a round number, and fitted to THIS case rather than to the whole reach of
     the sliders. sigma_z is not in here — it keeps FIELD_RANGE, which is the
     whole point of the split. Computed once, because the surface, its z axis
     and the ramp bar under it must not be able to disagree. */
  const shearLim = useMemo(() => {
    const m = result?.metrics;
    return {
      longitudinal: shearLimit(m?.longitudinal.min ?? 0, m?.longitudinal.peak ?? 0),
      transverse: shearLimit(m?.transverse.min ?? 0, m?.transverse.peak ?? 0),
    };
  }, [result]);

  const surfRefs = {
    vertical: useRef<HTMLDivElement>(null),
    longitudinal: useRef<HTMLDivElement>(null),
    transverse: useRef<HTMLDivElement>(null),
  };
  const planRef = useRef<HTMLDivElement>(null);
  const longRef = useRef<HTMLDivElement>(null);
  const tranRef = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  const draw = useCallback(async () => {
    if (!result || !spec) return;
    const Plotly = (await import('plotly.js-dist-min')).default;
    const c = chartColors(theme);
    const three = view === 'all';
    // gl3d draws its wall grid opaquely and ignores the alpha in the token,
    // so give it a solid equivalent of the hairline on each surface.
    const grid3d = theme === 'dark' ? '#2A3A55' : '#E4E7EA';
    const { fields, metrics, ideal, h, w, dy, dx } = result;

    /* Everything PLOTTED is converted to the unit the toggle is on, not just
       the KPIs. The toggle promises "kip - psi - in"; a colorbar reading psi
       beside a heatmap whose hover reads MPa is the kind of quiet
       contradiction that makes a teaching instrument untrustworthy.
       Both helpers are the identity in SI, and the FIELD itself stays MPa —
       only what is handed to Plotly is converted, so CONTACT_THRESHOLD and
       every metric go on comparing in the unit they were computed in. */
    const pOut = (mpa: number) => pressureOut(mpa, unit);
    const lOut = (mm: number) => lengthOut(mm, unit);
    const pu = pressureUnit(unit);
    const lu = lengthUnit(unit);
    // Three decimals is precision in MPa and noise in psi; inches need one
    // where millimeters need none.
    const zfmt = unit === 'SI' ? '.3f' : '.1f';
    const xyfmt = unit === 'SI' ? '.0f' : '.1f';

    const xs = Array.from({ length: w }, (_, i) => (i + 0.5) * dx);
    const ys = Array.from({ length: h }, (_, i) => (i + 0.5) * dy);

    /* The center of the patch, and the two cuts the profile cards take
       through it. Hoisted out of the plan view because the plan view now
       DRAWS them: nothing else on the page said where Figures 9 and 10 are
       sliced, so the three charts read as unrelated pictures of one field. */
    const cx = center?.x ?? (w * dx) / 2;
    const cy = center?.y ?? (h * dy) / 2;
    const rowIdx = peakRow(fields.vertical, h, w);
    const colIdx = metrics.vertical.bounds
      ? Math.round((metrics.vertical.bounds[2] + metrics.vertical.bounds[3]) / 2)
      : Math.floor(w / 2);

    /* 1. the three 3-D windows. Decimated anisotropically: the ribs run
       longitudinally, so transverse resolution is what carries them and is
       kept, while the smooth along-travel direction is halved. */
    for (const ch of CHANNELS) {
      const el = surfRefs[ch].current;
      // A hidden figure has no box for Plotly to measure, and a gl3d scene
      // laid out at 0x0 stays 0x0. Skip it; the redraw that unhides it will
      // draw it at its real size, because `view` is a dependency of draw.
      if (!el || (view !== 'all' && view !== ch)) continue;
      const d = decimate(fields[ch], h, w, h, Math.ceil(w / 2));
      const dxs = Array.from({ length: d.w }, (_, i) => (i * d.fx + d.fx / 2) * dx);
      const dys = Array.from({ length: d.h }, (_, i) => (i * d.fy + d.fy / 2) * dy);
      /* The colorscale and the z AXIS always take the SAME limit, because
         height and hue encode the same quantity here and freezing one without
         the other would have them disagree — a low-load field would stand as
         tall as a high-load one while being paler.

         WHICH limit differs by channel, and that is deliberate. sigma_z keeps
         the fixed FIELD_RANGE top it has everywhere else in the tool, so its
         color and its height are the magnitude and the load slider moves the
         picture rather than the legend. The two shears take shearLim, fitted
         to this case: their fixed limits are set by a hard braking case at
         high slip, and a free-rolling wheel reaches 5% of that — flat sheet,
         neutral color, no height. See shearLimit() in equations.ts. */
      const signed = ch !== 'vertical';
      const limMPa = signed ? shearLim[ch] : FIELD_RANGE[tire].vertical.hi;
      const lim = pOut(limMPa);
      const zLo = pOut(signed ? -limMPa : 0);
      const zHi = lim;
      await Plotly.react(el, [{
        type: 'surface' as const,
        x: dxs.map(lOut), y: dys.map(lOut),
        z: d.data.map((row) => row.map(pOut)),
        colorscale: signed ? divergingScale(theme) : fieldScale(theme),
        cmin: signed ? -lim : 0,
        cmax: lim,
        showscale: false,
        contours: { z: { show: false } },
        lighting: { ambient: 0.78, diffuse: 0.45, specular: 0.06, roughness: 0.9 },
        hovertemplate: `x %{x:${xyfmt}} ${lu} · y %{y:${xyfmt}} ${lu}<br><b>%{z:${zfmt}} ${pu}</b><extra></extra>`,
      }], baseLayout(theme, {
        height: three ? 300 : 480,
        margin: three ? { l: 6, r: 6, t: 6, b: 6 } : { l: 26, r: 26, t: 10, b: 22 },
        scene: {
          // True to scale in plan; the stress axis is a free axis, so its
          // exaggeration is stated in the caption rather than implied.
          aspectmode: 'manual' as const,
          aspectratio: { x: 1, y: (h * dy) / (w * dx), z: 0.5 },
          // gl3d hangs its axis titles outside the scene box and reserves no
          // margin for them, so in the three-up layout they are dropped
          // altogether — the card subtitle names the axes instead — and only
          // the focused window, which has room, carries them.
          xaxis: { title: { text: three ? '' : `Longitudinal (${lu})` }, nticks: three ? 4 : 6, color: c.fg, gridcolor: grid3d, zeroline: false, showspikes: false, backgroundcolor: 'rgba(0,0,0,0)', showbackground: false },
          yaxis: { title: { text: three ? '' : `Transverse (${lu})` }, nticks: three ? 4 : 6, color: c.fg, gridcolor: grid3d, zeroline: false, showspikes: false, backgroundcolor: 'rgba(0,0,0,0)', showbackground: false },
          zaxis: { title: { text: three ? '' : `σ (${pu})` }, range: [zLo, zHi], nticks: three ? 3 : 6, color: c.fg, gridcolor: grid3d, zeroline: true, zerolinecolor: c.hairline, showspikes: false, backgroundcolor: 'rgba(0,0,0,0)', showbackground: false },
          camera: { eye: three ? { x: 1.7, y: -1.45, z: 1.0 } : { x: 1.55, y: -1.35, z: 0.95 } },
        },
      }), { ...plotConfig, displayModeBar: false });
    }

    /* 2. plan view: the predicted patch with the textbook outlines on top. */
    if (planRef.current) {
      /* THE FRAME IS FIXED FOR THE WHOLE REACH OF THE SLIDERS, and is a
         function of the tire alone — never of the current load.

         It used to be sized to `ideal`, which grows with P/p. So every time
         the load moved, the axis range moved with it, and because the height
         below is solved from the range's aspect ratio, the canvas itself
         breathed. That is motion the student has to subtract before they can
         see the only thing the card is for: how the distribution changes.
         A figure that resizes while you compare two states of it is worse
         than a figure that wastes a little room.

         So: worst case over SAFE_RANGE — the largest idealization the sliders
         can reach, at the top of the load range and the bottom of the
         pressure range. `ideal.length` bounds all three outlines, since the
         equal-area radius is 0.564*sqrt(A) against 0.692*sqrt(A) for L/2 and
         the PCA rectangle is shorter still. Nothing clips that did not clip
         before, and the outlines now grow and shrink inside a frame that
         holds still. */
      // Equal aspect, but `constrain: 'domain'` shrinks the plotting box to
      // fit rather than padding the x range out to the width of the card —
      // without it the footprint occupies a third of the figure.
      const frame = planFrame(tire, w, h, dx, dy);
      const halfX = lOut(frame.halfX);
      const halfY = lOut(frame.halfY);
      /* Cells below the contact threshold are left blank rather than painted
         at the pale end of the ramp. The generator lays a low positive haze
         over the whole raster, and coloring it makes the footprint look like
         it fills the window; blanking it draws the same boundary the contact
         area is measured on, so the figure and the KPI agree. */
      const traces: Record<string, unknown>[] = [{
        type: 'heatmap' as const,
        x: xs.map((v) => lOut(v - cx)), y: ys.map((v) => lOut(v - cy)),
        z: Array.from({ length: h }, (_, r) =>
          Array.from({ length: w }, (_, k) => {
            const v = fields.vertical[r * w + k];
            // Thresholded on the FIELD, in MPa; only what is drawn converts.
            return v >= CONTACT_THRESHOLD ? pOut(v) : null;
          })),
        colorscale: fieldScale(theme),
        /* FIXED. This used to be the current field's own peak, so the patch
           came out the same orange whatever the load was and the only thing
           that moved was the number on the legend. Now the number holds and
           the picture moves, which is the way round the card needs. */
        zmin: 0, zmax: pOut(FIELD_RANGE[tire].vertical.hi),
        showscale: false,
        hoverongaps: false,
        hovertemplate: `%{x:${xyfmt}}, %{y:${xyfmt}} ${lu}<br><b>%{z:${zfmt}} ${pu}</b><extra></extra>`,
      }];

      /* Where the two profile cards cut. Drawn beneath the idealizations and
         deliberately quiet — 1px, muted, finely dashed — because they are
         wayfinding between three figures, not a result of their own. Nothing
         on the page said where Figures 9 and 10 are sliced. */
      const cutY = lOut(ys[rowIdx] - cy);
      const cutX = lOut(xs[colIdx] - cx);
      const cutLine = { color: c.fg, width: 1, dash: 'dot' as const };
      traces.push(
        { x: [-halfX, halfX], y: [cutY, cutY], mode: 'lines' as const, line: cutLine, hoverinfo: 'skip' as const, showlegend: false },
        { x: [cutX, cutX], y: [-halfY, halfY], mode: 'lines' as const, line: cutLine, hoverinfo: 'skip' as const, showlegend: false }
      );

      if (overlay) {
        // The idealizations are posed with the tire width across the axle, so
        // their "length" runs along travel — the x axis here.
        const circ = circleOutline(ideal.circleRadius);
        const hu = huangOutline(ideal);
        const rc = rectOutline(ideal.rectLength, ideal.width);
        /* Casing. Three thin strokes over a saturated field are close to
           unreadable: the dashed emerald sank into the orange and the 1.5px
           violet all but vanished. Each outline is therefore drawn TWICE —
           once in the card's own surface color at +2.6px underneath, which
           punches a halo of quiet through the heatmap, then the hue on top.
           The casing carries the same dash, so every dash gets its own halo
           rather than sitting in a solid ghost tube. Ordinary cartographic
           casing; three extra traces buy the whole overlay back.

           The order is a hierarchy, not an accident. The equal-area circle is
           the one every method in this course actually assumes, so it is
           solid, heaviest, and drawn last — over both alternates.

           The halo is kept to +1.5px, not more. Huang's shape and the PCA
           rectangle share the SAME width (both 0.6L), so their top and bottom
           edges are exactly collinear over the middle third of the patch; at
           +2.6px the two casings merged there into one white band with dashes
           floating inside it, which read as a fourth thing on the figure.
           Nothing can un-overlap two collinear lines — the dash patterns have
           to carry that — but a thin halo lets them overlap quietly. */
        const outlines = [
          { d: rc, color: c.violet, width: 1.8, dash: 'dot' as const },
          { d: hu, color: c.emerald, width: 2, dash: 'dash' as const },
          { d: circ, color: c.blue, width: 2.6, dash: 'solid' as const },
        ];
        const plotted = outlines.map((o) => ({ ...o, x: o.d.x.map(lOut), y: o.d.y.map(lOut) }));
        for (const o of plotted) {
          traces.push({ x: o.x, y: o.y, mode: 'lines' as const, line: { color: c.surface, width: o.width + 1.5, dash: o.dash }, hoverinfo: 'skip' as const, showlegend: false });
        }
        for (const o of plotted) {
          traces.push({ x: o.x, y: o.y, mode: 'lines' as const, line: { color: o.color, width: o.width, dash: o.dash }, hoverinfo: 'skip' as const, showlegend: false });
        }
      }

      /* Fit the CARD to the figure, not the figure to the card. The plan view
         is equal-aspect, so Plotly shrinks its drawing box to whichever
         dimension binds and centers what is left — at a fixed height that
         left the patch floating in a lake of slack, worst on the wide-base
         branch, whose window is half as wide as it is tall. Measuring the
         column and solving for the height the data actually needs removes it,
         and the scale bar beside it then sits against a real edge. */
      const M = { l: 56, r: 8, t: 8, b: 46 };
      const boxW = Math.max(240, (planRef.current.clientWidth || 560) - M.l - M.r);
      const planH = Math.round(
        Math.min(560, Math.max(300, (boxW * halfY) / halfX + M.t + M.b))
      );
      await Plotly.react(planRef.current, traces, baseLayout(theme, {
        height: planH,
        margin: M,
        xaxis: axis(theme, `Longitudinal, from patch center (${lu})`, {
          scaleanchor: 'y' as const, scaleratio: 1, constrain: 'domain' as const,
          range: [-halfX, halfX], zeroline: false,
        }),
        yaxis: axis(theme, `Transverse, from patch center (${lu})`, {
          range: [-halfY, halfY], constrain: 'domain' as const, zeroline: false,
        }),
      }), plotConfig);
    }

    /* 3. profiles — the same two cuts as Figures 9 and 10 of the paper, and
       the two lines just drawn across the plan view.

       Three things changed together, and they only work together:

       1. Both x axes are measured FROM THE PATCH CENTER, the origin the plan
          view uses. They used to run 0-321 mm off the corner of the solution
          window, so the same rib sat at x = 150 in one figure and x = -10 in
          the other and nothing could be read across.
       2. Both y axes share one range, computed over all six series. Two cuts
          of one field on two autoscaled axes invite a comparison that is not
          there — the across-tire peak looked equal to the along-travel peak
          because each chart had rescaled itself to its own maximum.
       3. Vertical stress carries an area fill to the baseline. It is the
          one-signed channel and the textbook parabola; the two shears cross
          zero inside the patch and stay as lines, so the sign change is still
          the thing the eye lands on. Flat mark, so withAlpha (never mixHex).

       The shared range is now FIXED too — profileRange(tire), not the data.
       Autoscaling made every load look alike: the curve filled the card at
       14 kN exactly as it did at 46 kN, and only the axis labels betrayed the
       2.5x between them. Held still, the vertical curve fills under a third
       of the card at the bottom of the slider and three quarters at the top,
       and that difference is the reading.
    */
    const hues = { vertical: c.orange, longitudinal: c.blue, transverse: c.emerald };
    const longSeries = CHANNELS.map((ch) => Array.from(rowProfile(fields[ch], h, w, rowIdx), pOut));
    const tranSeries = CHANNELS.map((ch) => Array.from(colProfile(fields[ch], h, w, colIdx), pOut));
    const [rangeLo, rangeHi] = profileRange(tire);
    const yRange = [pOut(rangeLo), pOut(rangeHi)];
    const profileTrace = (ch: Channel, x: number[], y: number[]) => ({
      x, y, mode: 'lines' as const, name: LABEL[ch],
      line: { color: hues[ch], width: ch === 'vertical' ? 2.6 : 2 },
      ...(ch === 'vertical'
        ? { fill: 'tozeroy' as const, fillcolor: withAlpha(hues.vertical, 0.13) }
        : {}),
    });
    const profileLayout = (title: string) => baseLayout(theme, {
      height: 300,
      margin: { l: 58, r: 12, t: 8, b: 46 },
      xaxis: gridAxis(theme, title, { showgrid: false, zeroline: true, zerolinecolor: c.hairline }),
      yaxis: gridAxis(theme, `Contact stress (${pu})`, {
        // gridAxis defaults to nticks 4, which over a fixed 0-to-peak range
        // Plotly rounds down to two lines. §A7 wants three to five.
        range: yRange, nticks: 6, zeroline: true, zerolinecolor: c.hairline,
      }),
      hovermode: 'x unified' as const,
    });

    if (longRef.current) {
      const x = xs.map((v) => lOut(v - cx));
      await Plotly.react(
        longRef.current,
        CHANNELS.map((ch, i) => profileTrace(ch, x, longSeries[i])),
        profileLayout(`Longitudinal, from patch center (${lu})`),
        plotConfig
      );
    }
    if (tranRef.current) {
      const x = ys.map((v) => lOut(v - cy));
      await Plotly.react(
        tranRef.current,
        CHANNELS.map((ch, i) => profileTrace(ch, x, tranSeries[i])),
        profileLayout(`Transverse, from patch center (${lu})`),
        plotConfig
      );
    }
  }, [result, spec, theme, view, overlay, center, unit, tire, shearLim]);

  useEffect(() => {
    // Coalesce a slider drag into one redraw per animation frame.
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => { void draw(); });
    return () => cancelAnimationFrame(frame.current);
  }, [draw]);

  // Five plots, three of them WebGL. Browsers cap live contexts at 8-16, so
  // hand them back rather than waiting for the GC to notice.
  const allRefs = [surfRefs.vertical, surfRefs.longitudinal, surfRefs.transverse,
    planRef, longRef, tranRef];
  const refsForCleanup = useRef(allRefs);
  refsForCleanup.current = allRefs;
  useEffect(() => () => {
    void import('plotly.js-dist-min').then(({ default: Plotly }) => {
      for (const r of refsForCleanup.current) if (r.current) Plotly.purge(r.current);
    });
  }, []);

  /* ── derived readouts ─────────────────────────────────────────────── */

  /* toFixed on a small negative renders "-0.00"; snap it to zero first. */
  const z0 = (x: number, d: number) => (Math.abs(x) < 0.5 * 10 ** -d ? 0 : x);
  const F = (n: number, d = 1) => z0(forceOut(n, unit), d).toFixed(d);
  const P = (mpa: number, d = 2) => { const k = unit === 'SI' ? d : 0; return z0(pressureOut(mpa, unit), k).toFixed(k); };
  const A = (mm2: number) => areaOut(mm2, unit).toFixed(0);
  const L = (mm: number) => lengthOut(mm, unit).toFixed(unit === 'SI' ? 0 : 1);

  /* A backstop, not an expected path. SAFE_RANGE is chosen so that neither of
     these can fire anywhere the sliders reach, and predictor.test.mjs asserts
     that over the whole box for every rolling condition — so if one ever shows
     up, the artifact has been re-baked and the box has not been re-swept. */
  const warnings: string[] = [];
  if (result) {
    const eq = result.cmp.equilibrium;
    if (eq < EQUILIBRIUM_BAND[0] || eq > EQUILIBRIUM_BAND[1]) {
      warnings.push(
        `The predicted vertical stresses integrate to ${(eq * 100).toFixed(0)}% of the applied wheel ` +
        `load. Equation 5 of the paper penalizes exactly this residual during training, but it is a ` +
        `soft constraint: the network is not required to satisfy equilibrium and here it does not.`
      );
    }
    if (result.cmp.tension > TENSION_LIMIT) {
      warnings.push(
        `${(result.cmp.tension * 100).toFixed(0)}% of the peak appears as tensile (negative) vertical ` +
        `stress. A tire cannot pull on a pavement, so that is prediction error, not physics — it is ` +
        `largest for the wide-base branch, which the published paper does not cover.`
      );
    }
  }

  /* What the model was trained on, for the tooltips to set against what the
     slider offers.

     NOT spec.domain, which is what this used to be. That field is the union
     over the whole branch — the min and max columns of the checkpoint's own
     normalization table — so on the DTA branch it reports 0.99-60.08 kN and
     0.5-1.0 MPa, which is true of free rolling at 8 km/h and of nothing else.
     Quoting it made the tooltip claim coverage for a braking case at 1.0 MPa
     that the FE database has not one example of. trainedBox is the rectangle
     every block actually shares; TRAINED_ENVELOPE in equations.ts has the
     block-by-block table it comes from. */
  const trained = trainedBox(tire);

  return (
    <div className="cee-tool">
      {/* ─────────────────────────── controls ─────────────────────────── */}
      <aside className="cee-panel">
        <h2 className="cee-panel__title">Tire and loading</h2>

        <div className="cee-seg" role="group" aria-label="Tire configuration">
          <button type="button" className={tire === 'DTA' ? 'is-active' : ''} onClick={() => setTire('DTA')}>
            Dual assembly
          </button>
          <button type="button" className={tire === 'WBT' ? 'is-active' : ''} onClick={() => setTire('WBT')}>
            Wide-base
          </button>
        </div>

        <div className="cee-seg" role="group" aria-label="Units">
          <button type="button" className={unit === 'SI' ? 'is-active' : ''} onClick={() => setUnit('SI')}>kN · MPa · mm</button>
          <button type="button" className={unit === 'US' ? 'is-active' : ''} onClick={() => setUnit('US')}>kip · psi · in</button>
        </div>

        <div className="cee-field">
          <label className="cee-field__label" htmlFor="cs-load">
            <span>
              Wheel load
              <Tip text={`Load carried by this tire, not by the axle. An 80 kN (18 kip) single axle on dual tires puts about 20 kN on each. Every rolling condition and speed this tool offers was simulated over ${F(trained.load[0], 1)}–${F(trained.load[1], 1)} ${forceUnit(unit)} (free rolling at 8 km/h alone goes wider, to ${F(spec?.domain.load[1] ?? trained.load[1], 1)}); the slider spans ${F(safe.load[0], 0)}–${F(safe.load[1], 0)} ${forceUnit(unit)}, the part of that where the prediction also closes on the load you applied.`} />
            </span>
            <span className="cee-field__unit">{F(load, 2)} {forceUnit(unit)}</span>
          </label>
          <input
            id="cs-load" className="cee-slider" type="range"
            min={safe.load[0]} max={safe.load[1]} step={10}
            value={load} onChange={(e) => setLoad(num(e.target.value, load))}
          />
        </div>

        <div className="cee-field">
          <label className="cee-field__label" htmlFor="cs-press">
            <span>
              Inflation pressure
              <Tip text={`Cold inflation pressure. Huang §1.3 assumes the contact pressure equals it; this tool shows how far off that is. Every rolling condition and speed was simulated over ${P(trained.pressure[0])}–${P(trained.pressure[1])} ${pressureUnit(unit)}${tire === 'DTA' ? ' — above 0.9 MPa the database has free-rolling cases only, which is why the slider stops there rather than at the 1.0 MPa the free-rolling branch reaches' : ''}. The slider spans ${P(safe.pressure[0])}–${P(safe.pressure[1])} ${pressureUnit(unit)}, the part of that where the prediction also closes on the load you applied.`} />
            </span>
            <span className="cee-field__unit">{P(pressure)} {pressureUnit(unit)}</span>
          </label>
          <input
            id="cs-press" className="cee-slider" type="range"
            min={safe.pressure[0]} max={safe.pressure[1]} step={0.005}
            value={pressure} onChange={(e) => setPressure(num(e.target.value, pressure))}
          />
        </div>

        <h2 className="cee-panel__title cs-section">Rolling condition</h2>
        <div className="cee-seg" role="group" aria-label="Rolling condition">
          {(['FR', 'Brake', 'Acc'] as Condition[]).map((k) => (
            <button
              key={k} type="button"
              className={condition === k ? 'is-active' : ''}
              disabled={wbtOnlyFR && k !== 'FR'}
              onClick={() => setCondition(k)}
            >
              {k === 'FR' ? 'Free rolling' : k === 'Brake' ? 'Braking' : 'Accelerating'}
            </button>
          ))}
        </div>

        <div className="cee-field">
          <label className="cee-field__label" htmlFor="cs-slip">
            <span>
              Slip ratio
              <Tip text={`Difference between tire circumferential speed and vehicle speed, over vehicle speed. Free rolling is slip = 0 by definition — the FE dataset enforces it — so the slider only applies to braking and acceleration. Slip is a continuous input in the training set, sampled from 1% up to ${(SLIP_RANGE[1] * 100).toFixed(0)}%: the slider spans all of it because a locked wheel is in the data, not because 99% is a design case. Nearly all of the change is below 10%, and past about 25% the field barely moves.`} />
            </span>
            <span className="cee-field__unit">{(inputs.slip * 100).toFixed(1)}%</span>
          </label>
          <input
            id="cs-slip" className="cee-slider" type="range"
            min={SLIP_RANGE[0]} max={SLIP_RANGE[1]} step={0.005}
            value={slip} disabled={condition === 'FR'}
            onChange={(e) => setSlip(num(e.target.value, slip))}
          />
          {condition === 'FR' && <p className="cee-hint">Free rolling fixes slip at zero.</p>}
        </div>

        <div className="cee-field">
          <label className="cee-field__label">
            <span>
              Speed
              <Tip text="The FE dataset holds two linear velocities, 8 km/h (5 mph) and 112.65 km/h (70 mph). Speed enters the model as a category, not a number, so there is nothing in between." />
            </span>
          </label>
          <div className="cee-seg" role="group" aria-label="Speed">
            {(['5mph', '70mph'] as Speed[]).map((s) => (
              <button
                key={s} type="button"
                className={speed === s ? 'is-active' : ''}
                disabled={wbtOnlyFR && s !== '5mph'}
                onClick={() => setSpeed(s)}
              >
                {SPEED_KMH[s]} km/h
              </button>
            ))}
          </div>
        </div>

        {wbtOnlyFR && (
          <p className="cee-hint">
            The wide-base branch of the checkpoint was trained free rolling at 8 km/h only, so
            braking, acceleration and highway speed are not offered for it.
          </p>
        )}

        <h2 className="cee-panel__title cs-section">Compare against</h2>
        <label className="cee-field__label" style={{ gap: '0.5rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <input type="checkbox" checked={overlay} onChange={(e) => setOverlay(e.target.checked)} />
            Textbook footprint outlines
            <Tip text="The equal-area circle used by layered-elastic theory, Huang's rectangle-plus-semicircles (Fig. 1.14a), and the PCA equivalent rectangle (Fig. 1.14b). All three assume the contact pressure equals the inflation pressure, so all three have area P/p." />
          </span>
        </label>
      </aside>

      {/* ─────────────────────────── results ─────────────────────────── */}
      <div className="cee-results">
        {error && (
          <div className="cee-warn">
            <span className="cee-warn__icon" aria-hidden="true">!</span>
            <span>Could not load the precomputed contact-stress fields: {error}</span>
          </div>
        )}
        {busy && !result && <Card><p className="cee-hint">Loading the precomputed fields…</p></Card>}

        {result && (
          <>
            <Card
              title="What this tire is actually doing to the pavement"
              subtitle={
                <>
                  Measured on the predicted field; the idealized column is what{' '}
                  <em>P/p</em> and a uniform pressure would give.
                </>
              }
            >
              <KpiStrip>
                <Kpi
                  accent
                  label="Peak vertical stress"
                  value={P(result.metrics.vertical.peak)}
                  unit={pressureUnit(unit)}
                  tip="The largest σz anywhere in the footprint, on the stored 2 mm grid. The model's native 1 mm output peaks 2–4% higher."
                  delta={{
                    direction: result.cmp.peakOverInflation >= 1 ? 'up' : 'down',
                    text: `${result.cmp.peakOverInflation.toFixed(2)}×`,
                    context: 'of inflation pressure',
                  }}
                />
                <Kpi
                  label="Contact area"
                  value={A(result.metrics.vertical.contactArea)}
                  unit={areaUnit(unit)}
                  tip={`Area carrying σz above ${CONTACT_THRESHOLD} MPa. The idealizations all use Ac = P/p instead.`}
                  delta={{
                    direction: result.cmp.areaOverIdeal >= 1 ? 'up' : 'down',
                    text: `${result.cmp.areaOverIdeal.toFixed(2)}×`,
                    context: `vs ${A(result.ideal.area)} ${areaUnit(unit)} ideal`,
                  }}
                />
                <Kpi
                  label="Mean contact pressure"
                  value={P(result.metrics.vertical.meanContactPressure)}
                  unit={pressureUnit(unit)}
                  tip="Resultant vertical force divided by the contact area — the single number the uniform-pressure assumption replaces the whole field with."
                  delta={{
                    direction: result.cmp.meanOverInflation >= 1 ? 'up' : 'down',
                    text: `${result.cmp.meanOverInflation.toFixed(2)}×`,
                    context: 'of inflation pressure',
                  }}
                />
                <Kpi
                  label="Patch size"
                  value={`${L(result.metrics.vertical.extentLongitudinal)} × ${L(result.metrics.vertical.extentTransverse)}`}
                  unit={lengthUnit(unit)}
                  compact
                  tip="Bounding box of the contact patch: along travel × across the tire. Huang's idealization would give L × 0.6L."
                />
              </KpiStrip>
            </Card>

            {warnings.map((wtext) => (
              <div className="cee-warn" key={wtext.slice(0, 40)}>
                <span className="cee-warn__icon" aria-hidden="true">!</span>
                <span>{wtext}</span>
              </div>
            ))}

            <Card
              title="Footprint against the design idealization"
              subtitle={
                <>
                  Plan view of σz on a scale that does not move: 0 to{' '}
                  {P(FIELD_RANGE[tire].vertical.hi)} {pressureUnit(unit)} at every load and
                  pressure, so the color is the magnitude. Blank cells carry under{' '}
                  {P(CONTACT_THRESHOLD)} {pressureUnit(unit)}; each textbook outline
                  encloses <em>P/p</em>.
                </>
              }
            >
              <figure className="cee-figure">
                <div className="cs-foot">
                  {/* The tire that made the patch, beside the patch. */}
                  <aside className="cs-tirekey" aria-label={`${TIRE_ART[tire].name} reference`}>
                    <div className="cs-tirekey__item">
                      <img
                        className="cs-tirekey__img"
                        src={`${BASE}tools/contact-stress/tires/${TIRE_ART[tire].real}`}
                        alt={TIRE_ART[tire].realAlt}
                        width={440} height={440} loading="lazy" decoding="async"
                      />
                      <span className="cs-tirekey__label">The tire</span>
                    </div>
                    <div className="cs-tirekey__item">
                      <img
                        className="cs-tirekey__img"
                        src={`${BASE}tools/contact-stress/tires/${TIRE_ART[tire].model}`}
                        alt={TIRE_ART[tire].modelAlt}
                        width={440} height={440} loading="lazy" decoding="async"
                      />
                      <span className="cs-tirekey__label">The FE model</span>
                    </div>
                    <p className="cs-tirekey__name">
                      {TIRE_ART[tire].name}
                      {TIRE_ART[tire].size && <><br /><span className="cs-tirekey__size">{TIRE_ART[tire].size}</span></>}
                      {TIRE_ART[tire].note && <><br /><span className="cs-tirekey__note">{TIRE_ART[tire].note}</span></>}
                    </p>
                  </aside>

                  <div className="cs-foot__main">
                    <div className="cee-figure__plot" ref={planRef} role="img"
                      aria-label={`Plan view of vertical contact stress. The predicted patch is ${L(result.metrics.vertical.extentLongitudinal)} by ${L(result.metrics.vertical.extentTransverse)} ${lengthUnit(unit)}, ${result.cmp.areaOverIdeal.toFixed(2)} times the idealized area. Vertical stress runs from 0 to ${P(result.metrics.vertical.peak)} ${pressureUnit(unit)}. Dotted lines mark where the two profiles below are cut.`} />
                  </div>

                  {/* Same stops, same limits as the heatmap it stands against
                      — §B6 deviation 2: Plotly's own colorbar cannot be styled
                      to the house ramp, so the plot hides it and this carries
                      the magnitude instead. Vertical and to the right, because
                      the patch is a tall figure and a bar under it reads as a
                      third thing on the card rather than as its scale. */}
                  <RampBar
                    orientation="vertical"
                    theme={theme}
                    stops={fieldScale(theme)}
                    caption={`Vertical stress σz (${pressureUnit(unit)})`}
                    lowLabel="0"
                    highLabel={P(FIELD_RANGE[tire].vertical.hi)}
                  />
                </div>

                {/* The legend carries each idealization's defining dimension.
                    All three enclose the same area P/p — naming them is not
                    the interesting part, and the numbers are what a student
                    would otherwise have to work out to compare the shapes. */}
                <Legend
                  items={[
                    ...(overlay ? [
                      { label: `Equal-area circle · r = ${L(result.ideal.circleRadius)} ${lengthUnit(unit)}`, color: chartColors(theme).blue, shape: 'line' as const },
                      { label: `Huang L × 0.6L · ${L(result.ideal.length)} × ${L(result.ideal.width)} ${lengthUnit(unit)}`, color: chartColors(theme).emerald, shape: 'dash' as const },
                      { label: `PCA rectangle · ${L(result.ideal.rectLength)} × ${L(result.ideal.width)} ${lengthUnit(unit)}`, color: chartColors(theme).violet, shape: 'dash' as const },
                    ] : []),
                    { label: 'Profile cuts (below)', color: chartColors(theme).fg, shape: 'dash' as const },
                  ]}
                />
                <figcaption className="cee-figcaption">
                  All three outlines enclose the same area — idealized{' '}
                  <em>P/p</em> = {A(result.ideal.area)} {areaUnit(unit)}. The real patch is{' '}
                  {A(result.metrics.vertical.contactArea)} {areaUnit(unit)}, a factor of{' '}
                  {result.cmp.areaOverIdeal.toFixed(2)}, and it is not that shape.
                  {result.metrics.vertical.bounds &&
                    (result.metrics.vertical.bounds[0] === 0 ||
                      result.metrics.vertical.bounds[1] === result.h - 1 ||
                      result.metrics.vertical.bounds[2] === 0 ||
                      result.metrics.vertical.bounds[3] === result.w - 1) && (
                      <>
                        {' '}It reaches the edge of the {L(result.w * result.dx)} ×{' '}
                        {L(result.h * result.dy)} {lengthUnit(unit)} solution window, so the
                        extent is a lower bound here.
                      </>
                    )}
                </figcaption>
              </figure>
            </Card>

            <Card
              title="Three-dimensional contact stress"
              subtitle={
                <>
                  One window per direction, and they are not scaled the same way. σz keeps the
                  fixed 0–{P(FIELD_RANGE[tire].vertical.hi)} {pressureUnit(unit)} scale it has
                  everywhere else here, so its color and its height are the magnitude. The two
                  shears are more than a decade smaller and would lie flat on any scale wide
                  enough for hard braking, so each one fits itself to the case — read its limits
                  off the bar beneath it, and the exact extremes off the header. Drag to orbit,
                  scroll to zoom.
                </>
              }
              affordance={
                <div className="cee-seg" style={{ marginBottom: 0 }} role="group" aria-label="Which window">
                  <button type="button" className={view === 'all' ? 'is-active' : ''} onClick={() => setView('all')}>All three</button>
                  {CHANNELS.map((ch) => (
                    <button key={ch} type="button" className={view === ch ? 'is-active' : ''} onClick={() => setView(ch)}>
                      {ch === 'vertical' ? 'σz' : ch === 'longitudinal' ? 'σx' : 'σy'}
                    </button>
                  ))}
                </div>
              }
            >
              <div className={`cs-windows${view === 'all' ? '' : ' cs-windows--one'}`}>
                {CHANNELS.map((ch) => (
                  <figure
                    key={ch}
                    className="cs-window"
                    hidden={view !== 'all' && view !== ch}
                  >
                    <figcaption className="cs-window__head">
                      <span className="cs-window__title">{LABEL[ch]}</span>
                      <span className="cs-window__range">
                        {P(result.metrics[ch].min)} … {P(result.metrics[ch].peak)} {pressureUnit(unit)}
                      </span>
                      <span className="cs-window__sub">{SUBLABEL[ch]}</span>
                    </figcaption>
                    <div className="cee-figure__plot" ref={surfRefs[ch]} role="img"
                      aria-label={`${LABEL[ch]} surface, ${SUBLABEL[ch]}, ranging from ${P(result.metrics[ch].min)} to ${P(result.metrics[ch].peak)} ${pressureUnit(unit)}`} />
                    {ch === 'vertical' ? (
                      <RampBar theme={theme} stops={fieldScale(theme)} caption="σz" lowLabel="0" highLabel={`${P(FIELD_RANGE[tire].vertical.hi)} ${pressureUnit(unit)}`} />
                    ) : (
                      /* This is the one scale in the tool that moves, so its
                         ends have to carry numbers — a bare − and + would say
                         nothing about a limit that is not constant. */
                      <div className="cee-rampbar">
                        <span className="cee-rampbar__caption">{ch === 'longitudinal' ? 'σx' : 'σy'}</span>
                        <div className="cee-rampbar__row">
                          <span className="cee-rampbar__end">−{P(shearLim[ch])}</span>
                          <span
                            className="cee-rampbar__track"
                            style={{
                              background: `linear-gradient(to right, ${divergingScale(theme)
                                .map(([p, col]) => `${col} ${(p * 100).toFixed(0)}%`).join(', ')})`,
                            }}
                            role="img"
                            aria-label={`Diverging color scale, minus to plus ${P(shearLim[ch])} ${pressureUnit(unit)} through zero, fitted to this case`}
                          />
                          <span className="cee-rampbar__end">+{P(shearLim[ch])}</span>
                        </div>
                      </div>
                    )}
                  </figure>
                ))}
              </div>
              <p className="cee-figcaption">
                The ribs carry the load and stand well above the inflation pressure; the grooves
                carry nothing. Braking drives σx entirely positive, acceleration entirely
                negative — the friction force, which a uniform vertical pressure cannot represent.
                The two shear scales follow the case, so compare them by their numbers rather
                than by their color: σx is drawn here on ±{P(shearLim.longitudinal)}{' '}
                {pressureUnit(unit)}, against ±{P(divergingLimit(tire, 'longitudinal'))} for the
                widest field these controls can reach.
              </p>
            </Card>

            <div className="cee-chart-grid cee-chart-grid--2">
              <Card
                title="Profile along travel"
                subtitle="Through the most heavily loaded rib — the horizontal cut above (paper, Fig. 9). Both profiles share one fixed stress scale, so the curve's height is the load."
              >
                <figure className="cee-figure">
                  <div className="cee-figure__plot" ref={longRef} role="img"
                    aria-label="Longitudinal profiles of the three stress components through the peak rib" />
                  <Legend items={CHANNELS.map((ch) => ({ label: LABEL[ch], color: { vertical: chartColors(theme).orange, longitudinal: chartColors(theme).blue, transverse: chartColors(theme).emerald }[ch] }))} />
                  <figcaption className="cee-figcaption">
                    σz is the textbook parabola. σx is not: free rolling, it is compressive at the
                    front of the patch and tensile at the rear.
                  </figcaption>
                </figure>
              </Card>

              <Card
                title="Profile across the tire"
                subtitle="Across the middle of the patch — the vertical cut above (paper, Fig. 10). Both profiles share one fixed stress scale, so the curve's height is the load."
              >
                <figure className="cee-figure">
                  <div className="cee-figure__plot" ref={tranRef} role="img"
                    aria-label="Transverse profiles of the three stress components across the middle of the patch" />
                  <Legend items={CHANNELS.map((ch) => ({ label: LABEL[ch], color: { vertical: chartColors(theme).orange, longitudinal: chartColors(theme).blue, transverse: chartColors(theme).emerald }[ch] }))} />
                  <figcaption className="cee-figcaption">
                    Five ribs, five peaks, the shoulders carrying most. σy reverses sign rib to
                    rib — the mechanism behind near-surface shear damage.
                  </figcaption>
                </figure>
              </Card>
            </div>

            <details className="cee-card cee-howto">
              <summary>How to use this</summary>
              <div className="cee-howto__body">
                <ol>
                  <li>
                    The tool opens on the headline case of the source paper — a dual assembly at
                    42 kN and 0.69 MPa, free rolling at 8 km/h — so the surfaces here should look
                    like the ones printed there.
                  </li>
                  <li>
                    Read the first strip. <strong>Peak vertical stress</strong> against inflation
                    pressure is the number that breaks the uniform-pressure assumption; on a heavily
                    loaded tire it is two to three times the inflation pressure, concentrated on the
                    shoulder ribs.
                  </li>
                  <li>
                    Sweep the wheel load from one end of the slider to the other and watch{' '}
                    <strong>contact area</strong> against <em>P/p</em>. The ratio falls the whole
                    way — the real patch grows more slowly than <em>P/p</em> does — and on a softly
                    inflated tire it drops through 1.0 near 40 kN. Now raise the inflation pressure
                    and sweep again: it never gets there. The real patch stays larger than the
                    idealization everywhere else the slider reaches.
                  </li>
                  <li>
                    Switch to braking, then acceleration, and watch the longitudinal window. Most of
                    the change happens in the first 5–10% of slip; beyond ~25% the field barely moves.
                    The slider still runs to 99% because the FE database contains a locked wheel,
                    not because 99% is a case anyone designs for.
                  </li>
                  <li>
                    The two shear windows rescale themselves to whatever case is loaded, and σz
                    never does. So the numbers on their color bars are part of the reading: a
                    free-rolling wheel and the same wheel braking hard can look alike and be an
                    order of magnitude apart. Compare σz by eye, σx and σy by the bar.
                  </li>
                  <li>
                    The load and pressure sliders stop short of what the manifest calls the
                    training domain, for two separate reasons. They span only the part where the
                    predicted field still sums back to the load you applied within ±15%; and only
                    the part every rolling condition was actually simulated over — above 0.9 MPa,
                    and below 18 kN, the database has free-rolling cases and nothing else. It is a
                    surrogate, so treat the third decimal place with care.
                  </li>
                </ol>
                <p>
                  <strong>What this is not.</strong> The stresses are computed on a rigid, flat,
                  smooth surface. There is no pavement compliance, no surface texture, and no layered
                  structure: this is the load a tire applies, not the response a pavement gives. Take
                  the field from here into the{' '}
                  <a href={`${BASE}tools/lea/`}>Layered Elastic Analysis</a> or{' '}
                  <a href={`${BASE}tools/stress-explorer/`}>Stress Explorer</a> tool for the second
                  half of that question, and to <a href={`${BASE}tools/gear3d/`}>Gear3D</a> for how
                  these footprints sit under a real axle group.
                </p>
              </div>
            </details>

            <Card title="Where these numbers come from">
              <p className="cee-note">
                Contact stresses are predicted by <strong>phyContactGAN</strong>, the physics-informed
                conditional GAN of{' '}
                <a href="https://doi.org/10.1080/10298436.2026.2621970" target="_blank" rel="noreferrer">
                  Lang, Villamil and Al-Qadi (2026)
                </a>, trained at the Illinois Center for Transportation on 1,852 validated
                finite-element simulations of a 275/80R22.5 truck tire on a rigid flat surface.
                Reported accuracy against FEA: 0.0086 MPa RMSE, 0.0036 MPa MAE, 0.17% MAPE.
              </p>
              <p className="cee-note">
                Idealized footprints follow Huang, <em>Pavement Analysis and Design</em> (2nd ed.)
                §1.3: Eq. 1.1, <em>Ac</em> = π(0.3<em>L</em>)² + (0.4<em>L</em>)(0.6<em>L</em>) =
                0.5227<em>L</em>², with <em>Ac</em> = <em>P</em>/<em>p</em>; Figure 1.14b for the PCA
                equivalent rectangle; and the equal-area circle that layered-elastic theory requires.
              </p>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

/* Keep the unit constants referenced so a future refactor cannot quietly drop
   them from equations.ts without a type error surfacing here. */
void N_PER_LBF;
void PSI_PER_MPA;
