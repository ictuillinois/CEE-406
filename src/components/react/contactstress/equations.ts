// The classical side of the Contact Stress Visualizer, and the measurements
// taken off a predicted field. No React import — see equations.test.mjs.
//
// Everything here exists to answer one question the course keeps asking:
// *how wrong is the uniform-circle idealization?* Huang states the assumption
// and its justification in §1.3 (Figure 1.13):
//
//   "the contact pressure is greater than the tire pressure for low-pressure
//    tires, because the wall of tires is in compression ... the contact
//    pressure is smaller than the tire pressure for high-pressure tires,
//    because the wall of tires is in tension. However, in pavement design, the
//    contact pressure is generally assumed to be equal to the tire pressure."
//
// and gives the footprint idealization as a rectangle capped by two
// semicircles of length L and width 0.6L (Figure 1.14a, Eq. 1.1):
//
//   Ac = pi(0.3L)^2 + (0.4L)(0.6L) = 0.5227 L^2,   L = sqrt(Ac / 0.5227)
//
// with Ac = load on the tire / tire pressure. PCA (1984) replaces that outline
// with a rectangle of 0.8712L x 0.6L of the same area (Figure 1.14b), and
// layered-elastic theory (Huang Ch. 2, and the Stress Explorer and LEA tools
// here) replaces it again with a circle of the same area.
//
// Units are SI throughout — newtons, megapascals, millimeters — because that
// is what the model was trained in. Conversions to the course's customary
// units are at the bottom and are display-only.

/* This file imports nothing, not even a type — which is what lets it be read
   as the plain statement of the classical side. The keys below are the same
   strings predictor.ts types its own Inputs with, restated rather than
   imported. Keep them in step with predictor.ts by hand; predictor.test.mjs
   feeds these presets straight into predict(), so a mismatch fails there. */
export type TireKey = 'DTA' | 'WBT';
export type ChannelKey = 'vertical' | 'longitudinal' | 'transverse';
export type SpeedKey = '5mph' | '70mph';
export type ConditionKey = 'FR' | 'Brake' | 'Acc';

export interface PresetInputs {
  tire: TireKey;
  /** Wheel load on the tire, newtons. */
  load: number;
  /** Inflation pressure, MPa. */
  pressure: number;
  /** Slip ratio, 0-1. Zero whenever the condition is free rolling. */
  slip: number;
  speed: SpeedKey;
  condition: ConditionKey;
}

/** Huang Eq. 1.1: Ac = 0.5227 L^2 for the rectangle-plus-semicircles outline. */
export const HUANG_SHAPE_FACTOR = 0.5227;

/** PCA (1984) equivalent rectangle: 0.8712L long by 0.6L wide (Fig. 1.14b). */
export const PCA_RECT_LENGTH = 0.8712;
export const FOOTPRINT_WIDTH_RATIO = 0.6;

export interface Idealization {
  /** Ac = P / p, mm². */
  area: number;
  /** The assumed uniform contact pressure — the inflation pressure, MPa. */
  pressure: number;
  /** Radius of the equal-area circle used by layered-elastic theory, mm. */
  circleRadius: number;
  /** L in Huang Eq. 1.1, mm. */
  length: number;
  /** 0.6 L, mm. */
  width: number;
  /** Length of the PCA equivalent rectangle, 0.8712 L, mm. */
  rectLength: number;
}

/**
 * The textbook footprint for a wheel load and an inflation pressure, under the
 * assumption that contact pressure equals inflation pressure.
 */
export function idealizedContact(load: number, pressure: number): Idealization {
  const area = pressure > 0 ? load / pressure : 0;
  const length = Math.sqrt(Math.max(area, 0) / HUANG_SHAPE_FACTOR);
  return {
    area,
    pressure,
    circleRadius: Math.sqrt(Math.max(area, 0) / Math.PI),
    length,
    width: FOOTPRINT_WIDTH_RATIO * length,
    rectLength: PCA_RECT_LENGTH * length,
  };
}

/**
 * Outline of Huang Figure 1.14a in millimeters, centered on the origin, as a
 * closed polyline: a rectangle 0.4L long and 0.6L wide capped by semicircles
 * of radius 0.3L. `x` runs along the direction of travel.
 */
export function huangOutline(ideal: Idealization, steps = 48): { x: number[]; y: number[] } {
  const r = ideal.width / 2; // 0.3 L
  const half = ideal.length / 2 - r; // 0.2 L — half the straight run
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 0; i <= steps; i++) {
    // Right cap, -90° to +90°, centered at (+0.2L, 0).
    const t = -Math.PI / 2 + (Math.PI * i) / steps;
    x.push(half + r * Math.cos(t));
    y.push(r * Math.sin(t));
  }
  for (let i = 0; i <= steps; i++) {
    // Left cap, +90° to +270°. The polyline joins the two caps with the
    // straight edges of the rectangle on its own.
    const t = Math.PI / 2 + (Math.PI * i) / steps;
    x.push(-half + r * Math.cos(t));
    y.push(r * Math.sin(t));
  }
  x.push(x[0]);
  y.push(y[0]);
  return { x, y };
}

/** Equal-area circle, centered on the origin, as a closed polyline. */
export function circleOutline(radius: number, steps = 96): { x: number[]; y: number[] } {
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (2 * Math.PI * i) / steps;
    x.push(radius * Math.cos(t));
    y.push(radius * Math.sin(t));
  }
  return { x, y };
}

/** PCA equivalent rectangle, centered on the origin, as a closed polyline. */
/**
 * The half-extents of the plan view's axes, in mm.
 *
 * It takes NO load and NO pressure, and that is the whole point of it. The
 * frame used to be sized to the current idealization, which grows with P/p —
 * so the axis range moved every time the load slider moved, and with it the
 * aspect ratio the card solves its height from. The canvas breathed while the
 * student was trying to compare two states of the field, which is motion they
 * have to subtract before they can see the thing the figure is for.
 *
 * Instead: the solution window, or the largest idealization the sliders can
 * REACH, whichever is bigger. The widest case is the top of the load range
 * against the bottom of the pressure range, because area is P/p.
 *
 * `length / 2` bounds all three outlines horizontally — the equal-area radius
 * is 0.564*sqrt(A) against 0.692*sqrt(A) for L/2, and the PCA rectangle is
 * shorter again — which `equations.test.mjs` re-checks over the whole box.
 * Vertically it bounds Huang and PCA, both of which are 0.6L wide; the
 * equal-area circle is taller than that and its cap runs past the top and
 * bottom of the DTA frame, as it always has. Framing to the circle instead
 * would cost about a fifth of the figure's height to show two arcs of an
 * outline whose radius the legend already prints.
 */
export function planFrame(
  tire: TireKey,
  w: number,
  h: number,
  dx: number,
  dy: number
): { halfX: number; halfY: number } {
  const reach = SAFE_RANGE[tire];
  const widest = idealizedContact(reach.load[1], reach.pressure[0]);
  return {
    halfX: Math.max((w * dx) / 2, widest.length / 2) * 1.06,
    halfY: Math.max((h * dy) / 2, widest.width / 2) * 1.06,
  };
}

export function rectOutline(len: number, wid: number): { x: number[]; y: number[] } {
  const a = len / 2;
  const b = wid / 2;
  return { x: [-a, a, a, -a, -a], y: [-b, -b, b, b, -b] };
}

/* ────────────────────────── measuring a field ────────────────────────── */

/**
 * A pixel counts as "in contact" above this vertical stress, in MPa.
 *
 * The value is measured, not chosen for looking round. The generator does not
 * output exactly zero outside the footprint: it lays down a low positive haze.
 * Sampling the whole 4 kN field, the 75th percentile is 0.008 MPa and the 80th
 * is 0.018, then the 85th jumps to 0.103 — the haze and the real patch are
 * separated by roughly an order of magnitude. 0.05 MPa (7.3 psi) sits in that
 * gap at every load in the training set, and is still negligible beside a real
 * contact pressure of 0.3-3 MPa.
 *
 * The patch has a genuinely soft edge, so no threshold is canonical; this one
 * is a stated convention and the tool says so.
 */
export const CONTACT_THRESHOLD = 0.05;

export interface FieldMetrics {
  /** Largest and smallest values in the field, MPa. */
  peak: number;
  min: number;
  /** Resultant of the field over the whole domain, N (vertical) or N (shear). */
  resultant: number;
  /** Area with sigma_z above CONTACT_THRESHOLD, mm². */
  contactArea: number;
  /** Resultant divided by that area — the ACTUAL mean contact pressure, MPa. */
  meanContactPressure: number;
  /** Bounding box of the contact patch, mm. */
  extentTransverse: number;
  extentLongitudinal: number;
  /** Where the patch sits, in stored-pixel indices: [r0, r1, c0, c1]. */
  bounds: [number, number, number, number] | null;
}

/**
 * Measure a reconstructed field. `mask` is optional and, when given, is the
 * vertical field used to define the contact patch — so the longitudinal and
 * transverse components are integrated over the same patch as the vertical one
 * rather than each inventing its own.
 */
export function fieldMetrics(
  field: Float32Array,
  h: number,
  w: number,
  dyMm: number,
  dxMm: number,
  mask?: Float32Array
): FieldMetrics {
  const cell = dyMm * dxMm;
  const gate = mask ?? field;
  let peak = -Infinity;
  let min = Infinity;
  let sum = 0;
  let count = 0;
  /* Extents come from the row and column marginals of the GATED field, not
     from the outermost gated pixel. A handful of stray pixels in the haze —
     and at light load there are always a few — would otherwise stretch the
     bounding box to the whole raster and make a 90 mm footprint report as
     321 x 224 mm. A marginal has to carry 2% of the peak marginal to count. */
  const rowLoad = new Float64Array(h);
  const colLoad = new Float64Array(w);

  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const i = r * w + c;
      const v = field[i];
      if (v > peak) peak = v;
      if (v < min) min = v;
      sum += v;
      if (gate[i] >= CONTACT_THRESHOLD) {
        count++;
        rowLoad[r] += gate[i];
        colLoad[c] += gate[i];
      }
    }
  }

  const span = (m: Float64Array) => {
    let mx = 0;
    for (const v of m) if (v > mx) mx = v;
    if (mx === 0) return null;
    const cut = 0.02 * mx;
    let a = -1;
    let b = -1;
    for (let i = 0; i < m.length; i++) {
      if (m[i] >= cut) {
        if (a < 0) a = i;
        b = i;
      }
    }
    return a < 0 ? null : ([a, b] as [number, number]);
  };

  const rs = span(rowLoad);
  const cs = span(colLoad);
  const contactArea = count * cell;
  return {
    peak,
    min,
    resultant: sum * cell,
    contactArea,
    meanContactPressure: contactArea > 0 ? (sum * cell) / contactArea : 0,
    extentTransverse: rs ? (rs[1] - rs[0] + 1) * dyMm : 0,
    extentLongitudinal: cs ? (cs[1] - cs[0] + 1) * dxMm : 0,
    bounds: rs && cs ? [rs[0], rs[1], cs[0], cs[1]] : null,
  };
}

/**
 * How the prediction stands against the idealization, and against the physics
 * the surrogate is supposed to obey. Ratios above 1 mean the real field
 * exceeds what the textbook assumption gives.
 */
export interface Comparison {
  /** peak sigma_z / inflation pressure. */
  peakOverInflation: number;
  /** actual mean contact pressure / inflation pressure. */
  meanOverInflation: number;
  /** actual contact area / (P/p). */
  areaOverIdeal: number;
  /** Resultant of sigma_z divided by the applied wheel load — should be 1. */
  equilibrium: number;
  /** |most tensile sigma_z| / peak sigma_z — should be ~0; a tire cannot pull. */
  tension: number;
}

export function compare(
  vertical: FieldMetrics,
  ideal: Idealization,
  load: number
): Comparison {
  return {
    peakOverInflation: ideal.pressure > 0 ? vertical.peak / ideal.pressure : 0,
    meanOverInflation: ideal.pressure > 0 ? vertical.meanContactPressure / ideal.pressure : 0,
    areaOverIdeal: ideal.area > 0 ? vertical.contactArea / ideal.area : 0,
    equilibrium: load > 0 ? vertical.resultant / load : 0,
    tension: vertical.peak > 0 ? Math.abs(Math.min(vertical.min, 0)) / vertical.peak : 0,
  };
}

export interface Preset {
  name: string;
  note: string;
  inp: PresetInputs;
}

/* Every preset is a case somebody can check: four are figures in the source
   paper, the rest are the axle loads this course actually designs for.
   They live here, not in the component, so that a test with no React can
   assert every one of them lands inside SAFE_RANGE below — a preset outside it
   would be silently clamped, and would then no longer be the printed case it
   claims to reproduce. */
export const PRESETS: Preset[] = [
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
    name: 'Standard axle · one tire',
    note: '80 kN (18 kip) single axle on dual tires: 20 kN per tire at 0.69 MPa (100 psi).',
    inp: { tire: 'DTA', load: 20000, pressure: 0.69, slip: 0, speed: '5mph', condition: 'FR' },
  },
  {
    name: 'Highway speed',
    note: 'The same wheel at 112.65 km/h (70 mph) instead of 8 km/h.',
    inp: { tire: 'DTA', load: 20000, pressure: 0.69, slip: 0, speed: '70mph', condition: 'FR' },
  },
  {
    name: 'Wide-base tire',
    note: 'One wide-base tire carrying what a dual assembly would, free rolling.',
    inp: { tire: 'WBT', load: 25000, pressure: 0.7, slip: 0, speed: '5mph', condition: 'FR' },
  },
];
/* ─────────── the range over which the surrogate stays admissible ───────────
 *
 * Two of the residuals above have thresholds, and in the corners of the
 * training domain a prediction crosses them: at very light load the vertical
 * resultant overshoots the applied load by tens of percent, at heavy load on a
 * soft tire it undershoots it, and the wide-base branch turns tensile over
 * whole bands. None of that is a bug — Eq. 5 of Lang et al. trains equilibrium
 * as a *soft* penalty, so a residual is expected — but a slider that walks a
 * student into a field which is not a statically admissible answer teaches
 * nothing except that the instrument is unreliable.
 *
 * So the two sliders span only the rectangle inside which every prediction
 * closes: equilibrium within EQUILIBRIUM_BAND and tensile fraction at or below
 * TENSION_LIMIT, for EVERY speed, rolling condition and slip ratio the tool
 * offers. Worst-casing over the rolling controls is deliberate — bounds that
 * jumped when you pressed "Braking" would read as a broken slider.
 *
 * These are the largest such rectangles, found by sweeping the shipped
 * artifact; equations.test.mjs is not able to re-derive them (it has no
 * artifact), so predictor.test.mjs owns that check and fails if any corner or
 * interior sample ever leaves the band.
 *
 * The residual KPIs stay on the page. Narrowing the range is not hiding the
 * residual — it is declining to quote a prediction that does not close.
 */
export const EQUILIBRIUM_BAND: [number, number] = [0.85, 1.15];
export const TENSION_LIMIT = 0.12;

export interface SafeRange {
  /** Wheel load, N. */
  load: [number, number];
  /** Inflation pressure, MPa. */
  pressure: [number, number];
}

/**
 * The fixed color scale, per tire and channel, in MPa.
 *
 * Every field used to be painted 0-to-its-own-peak, which meant the colors
 * carried no magnitude at all: a rib at 0.9 MPa and the same rib at 2.0 MPa
 * came out the identical orange, and dragging the load slider changed the
 * number on the legend while the picture sat still. That is exactly backwards
 * for a card whose subject is how load and inflation pressure change the
 * contact stress. The scale is fixed instead, so the color IS the magnitude
 * and the field is what moves.
 *
 * Swept off the shipped artifact by `scripts/contact-stress-range.mjs`, over
 * the whole of SAFE_RANGE crossed with every rolling control the tool offers
 * — 163,125 field reconstructions. Observed, and rounded outward here so the
 * scale ends on a number a student can read and keeps headroom against
 * interpolation between the sweep's grid points:
 *
 *          DTA vertical  -0.1031 .. 2.2608     WBT vertical  -0.0878 .. 1.1239
 *          DTA longitud. -0.5559 .. 0.6622     WBT longitud. -0.0402 .. 0.0318
 *          DTA transv.   -0.2477 .. 0.2010     WBT transv.   -0.1633 .. 0.1548
 *
 * VERTICAL AND TRANSVERSE ARE SHARED BY BOTH TIRES, so a wide-base tire and a
 * dual assembly can be read against each other — which is the comparison the
 * WBT preset ("one wide-base tire carrying what a dual assembly would") exists
 * to invite. It costs little: on the shared vertical scale the wide-base still
 * reaches 47% of the ramp and on the transverse 58%, both far into the legible
 * part of it.
 *
 * LONGITUDINAL IS PER TIRE, and is the one exception. Braking and acceleration
 * are offered only on the dual-assembly branch — the wide-base checkpoint was
 * trained free rolling — and they are the whole of what makes sigma_x large.
 * A shared scale would therefore be set by a braking DTA at 0.66 MPa and would
 * flatten every wide-base longitudinal window to a blank sheet at 5% of it,
 * hiding a field the card exists to show. Sharing where it informs, splitting
 * where it would erase.
 *
 * The shear pairs are stored SYMMETRIC about zero on purpose: chartTheme's
 * diverging scale puts the card's own surface color at its midpoint, so an
 * asymmetric range would move zero off the neutral stop and make one sign
 * read louder than the other.
 */
export const FIELD_RANGE: Record<TireKey, Record<ChannelKey, { lo: number; hi: number }>> = {
  DTA: {
    vertical: { lo: -0.15, hi: 2.4 },
    longitudinal: { lo: -0.72, hi: 0.72 },
    transverse: { lo: -0.28, hi: 0.28 },
  },
  WBT: {
    vertical: { lo: -0.15, hi: 2.4 },
    longitudinal: { lo: -0.05, hi: 0.05 },
    transverse: { lo: -0.28, hi: 0.28 },
  },
};

/**
 * The y range the two profile cards share, in MPa: wide enough for every
 * channel of this tire, at every load and pressure. All three curves are drawn
 * on one axis, so it is the union — and it does NOT follow the data, which is
 * the point. At the bottom of the load slider the vertical curve fills less
 * than a third of it; at the top, three quarters. That difference is the
 * reading.
 */
export function profileRange(tire: TireKey): [number, number] {
  const r = FIELD_RANGE[tire];
  const chans: ChannelKey[] = ['vertical', 'longitudinal', 'transverse'];
  return [
    Math.min(...chans.map((c) => r[c].lo)),
    Math.max(...chans.map((c) => r[c].hi)),
  ];
}

/** The symmetric half-extent a diverging channel is drawn on, in MPa. */
export function divergingLimit(tire: TireKey, ch: ChannelKey): number {
  const { lo, hi } = FIELD_RANGE[tire][ch];
  return Math.max(Math.abs(lo), Math.abs(hi));
}

export const SAFE_RANGE: Record<TireKey, SafeRange> = {
  /* Trained over 0.99-60.1 kN x 0.50-1.00 MPa. Equilibrium overshoots 1.15
     below ~13 kN and falls back through 0.85 above ~46 kN — the softer the
     tire the earlier, which is why the pressure floor is what buys the load
     ceiling. The box still holds every published-figure preset (20-45.4 kN at
     0.69-0.70 MPa), which is the binding constraint on it: the whole point of
     those presets is that the tool reproduces a printed case, and a preset
     outside the box would be clamped into something else. Worst residual
     anywhere inside: equilibrium 0.855, tension 0.093. */
  DTA: { load: [14000, 46000], pressure: [0.685, 1.0] },
  /* Trained over 1.0-56.0 kN x 0.40-1.00 MPa. The wide-base branch is an
     extension beyond the published paper and carries much larger residuals —
     it over-closes by 9-14% everywhere, and its tensile fraction reaches 25%
     below 0.55 MPa and again above ~36 kN — so the admissible box is a good
     deal smaller than the trained one. Worst inside: equilibrium 1.137,
     tension 0.097. */
  WBT: { load: [11000, 27000], pressure: [0.68, 1.0] },
};

/** Clamp a value into an inclusive range. */
export const clampTo = (v: number, [lo, hi]: [number, number]) =>
  Math.min(Math.max(v, lo), hi);

/* ─────────────────────────────── profiles ─────────────────────────────── */

/** One row of the field (a longitudinal profile at fixed transverse position). */
export function rowProfile(field: Float32Array, h: number, w: number, row: number): Float64Array {
  const r = Math.min(Math.max(row, 0), h - 1);
  const out = new Float64Array(w);
  for (let c = 0; c < w; c++) out[c] = field[r * w + c];
  return out;
}

/** One column (a transverse profile at fixed longitudinal position). */
export function colProfile(field: Float32Array, h: number, w: number, col: number): Float64Array {
  const c = Math.min(Math.max(col, 0), w - 1);
  const out = new Float64Array(h);
  for (let r = 0; r < h; r++) out[r] = field[r * w + c];
  return out;
}

/** Index of the row carrying the largest value — the center of the peak rib. */
export function peakRow(field: Float32Array, h: number, w: number): number {
  let best = -Infinity;
  let idx = 0;
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const v = field[r * w + c];
      if (v > best) {
        best = v;
        idx = r;
      }
    }
  }
  return idx;
}

/**
 * Box-average a field down to at most `maxH` x `maxW` cells, for a 3-D surface
 * that does not need 18,000 vertices. Preserves the mean of each block, so
 * integrals survive; peaks are gently clipped, which is why the KPI strip
 * measures the full-resolution field and only the surface is decimated.
 */
export function decimate(
  field: Float32Array,
  h: number,
  w: number,
  maxH: number,
  maxW: number
): { data: number[][]; h: number; w: number; fy: number; fx: number } {
  const fy = Math.max(1, Math.ceil(h / maxH));
  const fx = Math.max(1, Math.ceil(w / maxW));
  const oh = Math.ceil(h / fy);
  const ow = Math.ceil(w / fx);
  const data: number[][] = [];
  for (let r = 0; r < oh; r++) {
    const row = new Array<number>(ow);
    for (let c = 0; c < ow; c++) {
      let s = 0;
      let n = 0;
      for (let dr = 0; dr < fy; dr++) {
        const rr = r * fy + dr;
        if (rr >= h) break;
        for (let dc = 0; dc < fx; dc++) {
          const cc = c * fx + dc;
          if (cc >= w) break;
          s += field[rr * w + cc];
          n++;
        }
      }
      row[c] = n ? s / n : 0;
    }
    data.push(row);
  }
  return { data, h: oh, w: ow, fy, fx };
}

/* ────────────────────────────── unit display ──────────────────────────── */

export const N_PER_LBF = 4.4482216152605;
export const PSI_PER_MPA = 145.03773800722;
export const MM_PER_IN = 25.4;

export type UnitSystem = 'SI' | 'US';

/** Linear velocity behind the model's two speed categories (Table 1). */
export const SPEED_KMH = { '5mph': 8, '70mph': 112.65 } as const;

export const forceOut = (n: number, u: UnitSystem) => (u === 'SI' ? n / 1000 : n / N_PER_LBF / 1000);
export const forceUnit = (u: UnitSystem) => (u === 'SI' ? 'kN' : 'kip');
export const pressureOut = (mpa: number, u: UnitSystem) => (u === 'SI' ? mpa : mpa * PSI_PER_MPA);
export const pressureUnit = (u: UnitSystem) => (u === 'SI' ? 'MPa' : 'psi');
export const lengthOut = (mm: number, u: UnitSystem) => (u === 'SI' ? mm : mm / MM_PER_IN);
export const lengthUnit = (u: UnitSystem) => (u === 'SI' ? 'mm' : 'in');
export const areaOut = (mm2: number, u: UnitSystem) =>
  u === 'SI' ? mm2 / 100 : mm2 / (MM_PER_IN * MM_PER_IN);
export const areaUnit = (u: UnitSystem) => (u === 'SI' ? 'cm²' : 'in²');
