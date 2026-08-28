// Contact Stress Visualizer — the 3-D tyre–pavement contact stress field a
// truck tyre actually applies, against the uniform circle every design method
// assumes it applies.
//
// The prediction is phyContactGAN (Lang, Villamil & Al-Qadi 2026, ICT), a
// physics-informed cGAN trained on 1,852 validated FE simulations of a
// 275/80R22.5 truck tyre. The network is not shipped; predictor.ts explains
// what is. The idealisations it is measured against are Huang §1.3 —
// Eq. 1.1 and Figures 1.13/1.14 — and live in equations.ts.
//
// Colour: vertical stress is one-signed and takes the sequential orange ramp
// bound to stress in docs/chart-standards.md §B4. The two shear components
// change sign inside the footprint, and a sequential ramp on signed data hides
// exactly the thing the student is looking for, so they take a diverging
// blue–orange scale built from the same tokens, symmetric about zero.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Tip from '../Tip';
import Card from '../ui/Card';
import KpiStrip, { Kpi } from '../ui/KpiStrip';
import Legend from '../ui/Legend';
import RampBar from '../ui/RampBar';
import {
  useTheme, chartColors, baseLayout, plotConfig, axis, gridAxis, rampScale,
  HUES, TOKENS, withAlpha, num, type Mode,
} from '../chartTheme';
import {
  loadManifest, loadTire, predict, CHANNELS,
  type Channel, type Condition, type Inputs, type Manifest, type Speed,
  type TirePack, type TireType,
} from './predictor.ts';
import {
  idealizedContact, huangOutline, circleOutline, rectOutline,
  fieldMetrics, compare, decimate, peakRow, rowProfile, colProfile,
  CONTACT_THRESHOLD, SPEED_KMH,
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
  transverse: 'across the tyre',
};

/** Diverging scale for the signed shear components: blue ← 0 → orange. */
function divergingScale(theme: Mode): [number, string][] {
  const h = HUES[theme];
  const mid = TOKENS[theme].surface;
  return [
    [0, h.blue],
    [0.25, withAlpha(h.blue, 0.45)],
    [0.5, mid],
    [0.75, withAlpha(h.orange, 0.45)],
    [1, h.orange],
  ];
}

interface Preset {
  name: string;
  note: string;
  inp: Omit<Inputs, 'tire'> & { tire: TireType };
}

/* Every preset is a case somebody can check: four are figures in the source
   paper, the rest are the axle loads this course actually designs for. */
const PRESETS: Preset[] = [
  {
    name: 'Figure 8 · free rolling',
    note: 'The headline case of Lang et al. (2026): 42 kN, 0.69 MPa, 8 km/h.',
    inp: { tire: 'DTA', load: 42000, pressure: 0.69, slip: 0, speed: '5mph', condition: 'FR' },
  },
  {
    name: 'Figure 8 · braking 7%',
    note: 'Same wheel, 7% slip under braking — the longitudinal field goes positive.',
    inp: { tire: 'DTA', load: 42000, pressure: 0.69, slip: 0.07, speed: '5mph', condition: 'Brake' },
  },
  {
    name: 'Figure 8 · accelerating 7%',
    note: 'Same wheel, 7% slip under acceleration — the longitudinal field reverses.',
    inp: { tire: 'DTA', load: 42000, pressure: 0.69, slip: 0.07, speed: '5mph', condition: 'Acc' },
  },
  {
    name: 'Figure 7 · 45.4 kN',
    note: 'The heaviest of the four loads for which the paper prints the summed vertical stress.',
    inp: { tire: 'DTA', load: 45430, pressure: 0.7, slip: 0, speed: '5mph', condition: 'FR' },
  },
  {
    name: 'Standard axle · one tyre',
    note: '80 kN (18 kip) single axle on dual tyres: 20 kN per tyre at 0.69 MPa (100 psi).',
    inp: { tire: 'DTA', load: 20000, pressure: 0.69, slip: 0, speed: '5mph', condition: 'FR' },
  },
  {
    name: 'Highway speed',
    note: 'The same wheel at 112.65 km/h (70 mph) instead of 8 km/h.',
    inp: { tire: 'DTA', load: 20000, pressure: 0.69, slip: 0, speed: '70mph', condition: 'FR' },
  },
  {
    name: 'Wide-base tyre',
    note: 'One wide-base tyre carrying what a dual assembly would, free rolling.',
    inp: { tire: 'WBT', load: 25000, pressure: 0.7, slip: 0, speed: '5mph', condition: 'FR' },
  },
];

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

  /* ── artefact loading ─────────────────────────────────────────────── */

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
     its slip normalisation has zero standard deviation — so those controls are
     not offered for it rather than silently extrapolated. */
  const wbtOnlyFR = tire === 'WBT';
  useEffect(() => {
    if (!wbtOnlyFR) return;
    setSpeed('5mph');
    setCondition('FR');
    setSlip(0);
  }, [wbtOnlyFR]);

  // Keep the wheel load and pressure inside the branch that is loaded.
  useEffect(() => {
    if (!spec) return;
    setLoad((L) => Math.min(Math.max(L, spec.domain.load[0]), spec.domain.load[1]));
    setPressure((p) => Math.min(Math.max(p, spec.domain.pressure[0]), spec.domain.pressure[1]));
  }, [spec]);

  const inputs: Inputs = useMemo(
    () => ({ tire, load, pressure, slip: condition === 'FR' ? 0 : slip, speed, condition }),
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

  /* Centre of the predicted patch, so the idealised outlines are compared
     against it rather than against the corner of the raster. */
  const centre = useMemo(() => {
    if (!result?.metrics.vertical.bounds) return null;
    const [r0, r1, c0, c1] = result.metrics.vertical.bounds;
    return { y: ((r0 + r1 + 1) / 2) * result.dy, x: ((c0 + c1 + 1) / 2) * result.dx };
  }, [result]);

  /* ── plots ────────────────────────────────────────────────────────── */

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
    const xs = Array.from({ length: w }, (_, i) => (i + 0.5) * dx);
    const ys = Array.from({ length: h }, (_, i) => (i + 0.5) * dy);

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
      const lim = Math.max(Math.abs(metrics[ch].peak), Math.abs(metrics[ch].min), 1e-6);
      const signed = ch !== 'vertical';
      await Plotly.react(el, [{
        type: 'surface' as const,
        x: dxs, y: dys, z: d.data,
        colorscale: signed ? divergingScale(theme) : rampScale('orange', theme),
        cmin: signed ? -lim : 0,
        cmax: lim,
        showscale: false,
        contours: { z: { show: false } },
        lighting: { ambient: 0.78, diffuse: 0.45, specular: 0.06, roughness: 0.9 },
        hovertemplate: 'x %{x:.0f} mm · y %{y:.0f} mm<br><b>%{z:.3f} MPa</b><extra></extra>',
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
          xaxis: { title: { text: three ? '' : 'Longitudinal (mm)' }, nticks: three ? 4 : 6, color: c.fg, gridcolor: grid3d, zeroline: false, showspikes: false, backgroundcolor: 'rgba(0,0,0,0)', showbackground: false },
          yaxis: { title: { text: three ? '' : 'Transverse (mm)' }, nticks: three ? 4 : 6, color: c.fg, gridcolor: grid3d, zeroline: false, showspikes: false, backgroundcolor: 'rgba(0,0,0,0)', showbackground: false },
          zaxis: { title: { text: three ? '' : 'σ (MPa)' }, nticks: three ? 3 : 6, color: c.fg, gridcolor: grid3d, zeroline: true, zerolinecolor: c.hairline, showspikes: false, backgroundcolor: 'rgba(0,0,0,0)', showbackground: false },
          camera: { eye: three ? { x: 1.7, y: -1.45, z: 1.0 } : { x: 1.55, y: -1.35, z: 0.95 } },
        },
      }), { ...plotConfig, displayModeBar: false });
    }

    /* 2. plan view: the predicted patch with the textbook outlines on top. */
    if (planRef.current) {
      const cy = centre?.y ?? (h * dy) / 2;
      const cx = centre?.x ?? (w * dx) / 2;
      /* Cells below the contact threshold are left blank rather than painted
         at the pale end of the ramp. The generator lays a low positive haze
         over the whole raster, and colouring it makes the footprint look like
         it fills the window; blanking it draws the same boundary the contact
         area is measured on, so the figure and the KPI agree. */
      const traces: Record<string, unknown>[] = [{
        type: 'heatmap' as const,
        x: xs.map((v) => v - cx), y: ys.map((v) => v - cy),
        z: Array.from({ length: h }, (_, r) =>
          Array.from({ length: w }, (_, k) => {
            const v = fields.vertical[r * w + k];
            return v >= CONTACT_THRESHOLD ? v : null;
          })),
        colorscale: rampScale('orange', theme),
        zmin: 0, zmax: Math.max(metrics.vertical.peak, 1e-6),
        showscale: false,
        hoverongaps: false,
        hovertemplate: '%{x:.0f}, %{y:.0f} mm<br><b>%{z:.3f} MPa</b><extra></extra>',
      }];
      if (overlay) {
        const circ = circleOutline(ideal.circleRadius);
        const hu = huangOutline(ideal);
        const rc = rectOutline(ideal.rectLength, ideal.width);
        // The idealisations are posed with the tyre width across the axle, so
        // their "length" runs along travel — the x axis here.
        traces.push(
          { x: circ.x, y: circ.y, mode: 'lines' as const, line: { color: c.blue, width: 2 }, name: 'Equal-area circle', hoverinfo: 'skip' as const },
          { x: hu.x, y: hu.y, mode: 'lines' as const, line: { color: c.emerald, width: 2, dash: 'dash' as const }, name: 'Huang Fig. 1.14a', hoverinfo: 'skip' as const },
          { x: rc.x, y: rc.y, mode: 'lines' as const, line: { color: c.violet, width: 1.5, dash: 'dot' as const }, name: 'PCA rectangle', hoverinfo: 'skip' as const }
        );
      }
      // Equal aspect, but `constrain: 'domain'` shrinks the plotting box to
      // fit rather than padding the x range out to the width of the card —
      // without it the footprint occupies a third of the figure.
      const halfX = Math.max((w * dx) / 2, ideal.length / 2) * 1.06;
      const halfY = Math.max((h * dy) / 2, ideal.width / 2) * 1.06;
      await Plotly.react(planRef.current, traces, baseLayout(theme, {
        height: 360,
        margin: { l: 56, r: 12, t: 8, b: 46 },
        xaxis: axis(theme, 'Longitudinal, from patch centre (mm)', {
          scaleanchor: 'y' as const, scaleratio: 1, constrain: 'domain' as const,
          range: [-halfX, halfX], zeroline: false,
        }),
        yaxis: axis(theme, 'Transverse (mm)', {
          range: [-halfY, halfY], constrain: 'domain' as const, zeroline: false,
        }),
      }), plotConfig);
    }

    /* 3. profiles — the same two cuts as Figures 9 and 10 of the paper. */
    const rowIdx = peakRow(fields.vertical, h, w);
    const colIdx = result.metrics.vertical.bounds
      ? Math.round((result.metrics.vertical.bounds[2] + result.metrics.vertical.bounds[3]) / 2)
      : Math.floor(w / 2);
    const hues = { vertical: c.orange, longitudinal: c.blue, transverse: c.emerald };

    if (longRef.current) {
      await Plotly.react(longRef.current, CHANNELS.map((ch) => ({
        x: xs, y: Array.from(rowProfile(fields[ch], h, w, rowIdx)),
        mode: 'lines' as const, name: LABEL[ch],
        line: { color: hues[ch], width: 2.2 },
      })), baseLayout(theme, {
        height: 260,
        xaxis: axis(theme, 'Longitudinal distance (mm)'),
        yaxis: gridAxis(theme, 'Contact stress (MPa)', { zeroline: true, zerolinecolor: c.hairline }),
        hovermode: 'x unified' as const,
      }), plotConfig);
    }
    if (tranRef.current) {
      await Plotly.react(tranRef.current, CHANNELS.map((ch) => ({
        x: ys, y: Array.from(colProfile(fields[ch], h, w, colIdx)),
        mode: 'lines' as const, name: LABEL[ch],
        line: { color: hues[ch], width: 2.2 },
      })), baseLayout(theme, {
        height: 260,
        xaxis: axis(theme, 'Transverse distance (mm)'),
        yaxis: gridAxis(theme, 'Contact stress (MPa)', { zeroline: true, zerolinecolor: c.hairline }),
        hovermode: 'x unified' as const,
      }), plotConfig);
    }
  }, [result, spec, theme, view, overlay, centre]);

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

  const warnings: string[] = [];
  if (result) {
    if (load < 3000) {
      warnings.push(
        `At ${F(load, 2)} ${forceUnit(unit)} the wheel is barely loaded. This is the corner of the ` +
        `training set where the surrogate is weakest — its vertical resultant overshoots the applied ` +
        `load by up to 40% and its peak stress reads ~4% low.`
      );
    }
    const eq = result.cmp.equilibrium;
    if (eq < 0.85 || eq > 1.15) {
      warnings.push(
        `The predicted vertical stresses integrate to ${(eq * 100).toFixed(0)}% of the applied wheel ` +
        `load. Equation 5 of the paper penalises exactly this residual during training, but it is a ` +
        `soft constraint: the network is not required to satisfy equilibrium and here it does not.`
      );
    }
    if (result.cmp.tension > 0.12) {
      warnings.push(
        `${(result.cmp.tension * 100).toFixed(0)}% of the peak appears as tensile (negative) vertical ` +
        `stress. A tyre cannot pull on a pavement, so that is prediction error, not physics — it is ` +
        `largest for the wide-base branch, which the published paper does not cover.`
      );
    }
  }

  const dom = spec?.domain;

  return (
    <div className="cee-tool">
      {/* ─────────────────────────── controls ─────────────────────────── */}
      <aside className="cee-panel">
        <h2 className="cee-panel__title">Tyre and loading</h2>

        <div className="cee-presets">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              className="cee-chip"
              title={p.note}
              onClick={() => {
                setTire(p.inp.tire);
                setLoad(p.inp.load);
                setPressure(p.inp.pressure);
                setSlip(p.inp.slip);
                setSpeed(p.inp.speed);
                setCondition(p.inp.condition);
              }}
            >
              {p.name}
            </button>
          ))}
        </div>

        <div className="cee-seg" role="group" aria-label="Tyre configuration">
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
              <Tip text="Load carried by this tyre, not by the axle. An 80 kN (18 kip) single axle on dual tyres puts about 20 kN on each. The model was trained from 0.99 to 60.1 kN." />
            </span>
            <span className="cee-field__unit">{F(load, 2)} {forceUnit(unit)}</span>
          </label>
          <input
            id="cs-load" className="cee-slider" type="range"
            min={dom?.load[0] ?? 1000} max={dom?.load[1] ?? 60000} step={10}
            value={load} onChange={(e) => setLoad(num(e.target.value, load))}
          />
        </div>

        <div className="cee-field">
          <label className="cee-field__label" htmlFor="cs-press">
            <span>
              Inflation pressure
              <Tip text="Cold inflation pressure. Huang §1.3 assumes the contact pressure equals it; this tool shows how far off that is. Trained range 0.5–1.0 MPa (73–145 psi) for the dual assembly, 0.4–1.0 MPa for the wide-base tyre." />
            </span>
            <span className="cee-field__unit">{P(pressure)} {pressureUnit(unit)}</span>
          </label>
          <input
            id="cs-press" className="cee-slider" type="range"
            min={dom?.pressure[0] ?? 0.5} max={dom?.pressure[1] ?? 1} step={0.005}
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
              <Tip text="Difference between tyre circumferential speed and vehicle speed, over vehicle speed. Free rolling is slip = 0 by definition — the FE dataset enforces it — so the slider only applies to braking and acceleration." />
            </span>
            <span className="cee-field__unit">{(inputs.slip * 100).toFixed(1)}%</span>
          </label>
          <input
            id="cs-slip" className="cee-slider" type="range"
            min={0} max={1} step={0.005}
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
              title="What this tyre is actually doing to the pavement"
              subtitle={
                <>
                  Measured on the predicted field; the idealised column is what{' '}
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
                  tip={`Area carrying σz above ${CONTACT_THRESHOLD} MPa. The idealisations all use Ac = P/p instead.`}
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
                  tip="Bounding box of the contact patch: along travel × across the tyre. Huang's idealisation would give L × 0.6L."
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
              title="Three-dimensional contact stress"
              subtitle="One window per direction, longitudinal × transverse in millimetres, each scaled to its own range. Drag to orbit, scroll to zoom; open one window on its own for labelled axes."
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
                      aria-label={`${LABEL[ch]} surface, ${SUBLABEL[ch]}, ranging from ${result.metrics[ch].min.toFixed(3)} to ${result.metrics[ch].peak.toFixed(3)} megapascals`} />
                    {ch === 'vertical' ? (
                      <RampBar ramp="orange" theme={theme} caption="σz" lowLabel="0" highLabel={`${P(result.metrics.vertical.peak)} ${pressureUnit(unit)}`} />
                    ) : (
                      <div className="cee-rampbar">
                        <span className="cee-rampbar__caption">{ch === 'longitudinal' ? 'σx' : 'σy'}</span>
                        <div className="cee-rampbar__row">
                          <span className="cee-rampbar__end">−</span>
                          <span
                            className="cee-rampbar__track"
                            style={{
                              background: `linear-gradient(to right, ${divergingScale(theme)
                                .map(([p, col]) => `${col} ${(p * 100).toFixed(0)}%`).join(', ')})`,
                            }}
                            role="img"
                            aria-label="Diverging colour scale, negative to positive through zero"
                          />
                          <span className="cee-rampbar__end">+</span>
                        </div>
                      </div>
                    )}
                  </figure>
                ))}
              </div>
              <p className="cee-figcaption">
                The ribs are the load-carrying structure: the tread blocks stand well above the
                inflation pressure and the grooves carry nothing. Braking pushes the longitudinal
                surface entirely positive and acceleration entirely negative — that reversal is the
                friction force the tyre transmits, and it is invisible to any method that models the
                tyre as a uniform vertical pressure.
              </p>
            </Card>

            <Card
              title="Footprint against the design idealisation"
              subtitle={
                <>
                  Plan view of σz, centred on the predicted patch. Cells below {CONTACT_THRESHOLD}{' '}
                  MPa are left blank, so the coloured region is exactly the contact area measured
                  above; the three textbook outlines all enclose <em>P/p</em>.
                </>
              }
            >
              <figure className="cee-figure">
                <div className="cee-figure__plot" ref={planRef} role="img"
                  aria-label={`Plan view of vertical contact stress. The predicted patch is ${result.metrics.vertical.extentLongitudinal.toFixed(0)} by ${result.metrics.vertical.extentTransverse.toFixed(0)} millimetres, ${result.cmp.areaOverIdeal.toFixed(2)} times the idealised area.`} />
                {overlay && (
                  <Legend
                    items={[
                      { label: 'Equal-area circle (layered theory)', color: chartColors(theme).blue, shape: 'line' },
                      { label: 'Huang Fig. 1.14a · L × 0.6L', color: chartColors(theme).emerald, shape: 'dash' },
                      { label: 'PCA equivalent rectangle', color: chartColors(theme).violet, shape: 'dash' },
                    ]}
                  />
                )}
                <figcaption className="cee-figcaption">
                  All three outlines have area <em>P/p</em> = {A(result.ideal.area)} {areaUnit(unit)}; the real
                  patch is {A(result.metrics.vertical.contactArea)} {areaUnit(unit)}, a factor of{' '}
                  {result.cmp.areaOverIdeal.toFixed(2)}. Huang §1.3 argues the assumption is
                  conservative because the sidewall of a high-pressure tyre is in tension. That holds
                  at heavy load, where the real patch is smaller than <em>P/p</em> and the real mean
                  pressure is higher; at light load the tyre barely deflects, the patch is far larger
                  than <em>P/p</em>, and the assumption over-predicts the pressure instead.
                  {result.metrics.vertical.bounds &&
                    (result.metrics.vertical.bounds[0] === 0 ||
                      result.metrics.vertical.bounds[1] === result.h - 1 ||
                      result.metrics.vertical.bounds[2] === 0 ||
                      result.metrics.vertical.bounds[3] === result.w - 1) && (
                      <>
                        {' '}The patch reaches the edge of the {Math.round(result.w * result.dx)} ×{' '}
                        {Math.round(result.h * result.dy)} mm window the finite-element model was solved on,
                        so the measured extent is a lower bound at this load.
                      </>
                    )}
                </figcaption>
              </figure>
            </Card>

            <div className="cee-chart-grid cee-chart-grid--2">
              <Card
                title="Profile along travel"
                subtitle="Through the most heavily loaded rib — the cut of Figure 9 in the source paper."
              >
                <figure className="cee-figure">
                  <div className="cee-figure__plot" ref={longRef} role="img"
                    aria-label="Longitudinal profiles of the three stress components through the peak rib" />
                  <Legend items={CHANNELS.map((ch) => ({ label: LABEL[ch], color: { vertical: chartColors(theme).orange, longitudinal: chartColors(theme).blue, transverse: chartColors(theme).emerald }[ch] }))} />
                  <figcaption className="cee-figcaption">
                    The vertical profile is the parabola every textbook draws. The longitudinal one is
                    not: under free rolling it is compressive at the front of the patch and tensile at
                    the rear, and it changes sign where the tread element stops being laid down and
                    starts being peeled off.
                  </figcaption>
                </figure>
              </Card>

              <Card
                title="Profile across the tyre"
                subtitle="Through the middle of the patch — the cut of Figure 10 in the source paper."
              >
                <figure className="cee-figure">
                  <div className="cee-figure__plot" ref={tranRef} role="img"
                    aria-label="Transverse profiles of the three stress components across the middle of the patch" />
                  <Legend items={CHANNELS.map((ch) => ({ label: LABEL[ch], color: { vertical: chartColors(theme).orange, longitudinal: chartColors(theme).blue, transverse: chartColors(theme).emerald }[ch] }))} />
                  <figcaption className="cee-figcaption">
                    Five ribs, five peaks, and the shoulder ribs carrying the most. The transverse
                    component reverses sign from rib to rib as the tread is squeezed outward at the
                    edges and inward at the centre — the mechanism behind near-surface shear damage.
                  </figcaption>
                </figure>
              </Card>
            </div>

            <Card
              title="Is the surrogate behaving?"
              subtitle="Two checks you can run on any prediction here, and should run before quoting one."
            >
              <KpiStrip>
                <Kpi
                  label="Equilibrium closure"
                  value={`${(result.cmp.equilibrium * 100).toFixed(0)}%`}
                  tip="Integral of σz over the footprint, divided by the wheel load you asked for. Physics says 100%. Equation 5 of the paper trains toward it as a soft penalty, so the residual is real information about how much to trust the prediction."
                />
                <Kpi
                  label="Resultant force"
                  value={F(result.metrics.vertical.resultant, 2)}
                  unit={forceUnit(unit)}
                  tip="What the predicted vertical field actually adds up to, over 2 mm cells."
                />
                <Kpi
                  label="Tensile fraction"
                  value={`${(result.cmp.tension * 100).toFixed(1)}%`}
                  tip="Most negative σz as a fraction of the peak. A tyre cannot pull on a pavement, so anything here is prediction error."
                />
                <Kpi
                  label="Friction force"
                  value={F(result.metrics.longitudinal.resultant, 2)}
                  unit={forceUnit(unit)}
                  tip="Integral of the longitudinal component: the net tractive or braking force this tyre transmits. Near zero when free rolling, positive braking, negative accelerating."
                  compact
                />
              </KpiStrip>
            </Card>

            <details className="cee-card cee-howto">
              <summary>How to use this</summary>
              <div className="cee-howto__body">
                <ol>
                  <li>
                    Start from a preset. <strong>Figure 8 · free rolling</strong> is the headline case
                    of the source paper, so the surfaces here should look like the ones printed there.
                  </li>
                  <li>
                    Read the first strip. <strong>Peak vertical stress</strong> against inflation
                    pressure is the number that breaks the uniform-pressure assumption; on a heavily
                    loaded tyre it is two to three times the inflation pressure, concentrated on the
                    shoulder ribs.
                  </li>
                  <li>
                    Sweep the wheel load from one end of the slider to the other and watch{' '}
                    <strong>contact area</strong> against <em>P/p</em>. It crosses 1.0 somewhere in
                    the middle: below that load the real patch is bigger than the idealisation, above
                    it, smaller. Find the crossing for two different inflation pressures.
                  </li>
                  <li>
                    Switch to braking, then acceleration, and watch the longitudinal window. Most of
                    the change happens in the first 5–10% of slip; beyond ~25% the field barely moves.
                  </li>
                  <li>
                    Before you quote a number, check <strong>equilibrium closure</strong>. If the
                    predicted stresses do not add up to the load you applied, the field is not a
                    statically admissible answer and the tool says so.
                  </li>
                </ol>
                <p>
                  <strong>What this is not.</strong> The stresses are computed on a rigid, flat,
                  smooth surface. There is no pavement compliance, no surface texture, and no layered
                  structure: this is the load a tyre applies, not the response a pavement gives. Take
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
                conditional GAN of Lang, Villamil and Al-Qadi (2026), trained at the Illinois Center
                for Transportation on 1,852 validated finite-element simulations of a 275/80R22.5
                truck tyre on a rigid flat surface. Reported accuracy against FEA: 0.0086 MPa RMSE,
                0.0036 MPa MAE, 0.17% MAPE.
              </p>
              <p className="cee-note">
                Lang, H., Villamil, W. D., &amp; Al-Qadi, I. L. (2026). 3D tire–pavement contact
                stresses: physics-informed prediction approach. <em>International Journal of Pavement
                Engineering</em>, 27(1), 2621970.{' '}
                <a href="https://doi.org/10.1080/10298436.2026.2621970" target="_blank" rel="noreferrer">
                  doi:10.1080/10298436.2026.2621970
                </a>
              </p>
              <p className="cee-note">
                The trained network is not distributed. This page loads a precomputed sample of its
                output over the whole of its training domain — {spec?.nodes.toLocaleString()} grid
                points for this tyre, compressed to a shared basis of{' '}
                {spec ? Object.values(spec.rank).reduce((a, b) => a + b, 0) : 0} fields at{' '}
                {spec?.mmPerPixelY.toFixed(1)} mm resolution ({spec ? (spec.gzipBytes / 1e6).toFixed(2) : '—'} MB)
                — and interpolates it. Held-out error against the network itself is 0.007 MPa rms on
                the vertical component, 0.4% on peak stress: below the 0.0086 MPa the network itself
                carries against FEA, but not zero. The wide-base branch is an extension beyond the
                published paper and carries larger residuals.
              </p>
              <p className="cee-note">
                Idealised footprints follow Huang, <em>Pavement Analysis and Design</em> (2nd ed.)
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
