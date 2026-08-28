// The classical side of the Contact Stress Visualizer, and the measurements
// taken off a predicted field. No React import — see equations.test.mjs.
//
// Everything here exists to answer one question the course keeps asking:
// *how wrong is the uniform-circle idealisation?* Huang states the assumption
// and its justification in §1.3 (Figure 1.13):
//
//   "the contact pressure is greater than the tire pressure for low-pressure
//    tires, because the wall of tires is in compression ... the contact
//    pressure is smaller than the tire pressure for high-pressure tires,
//    because the wall of tires is in tension. However, in pavement design, the
//    contact pressure is generally assumed to be equal to the tire pressure."
//
// and gives the footprint idealisation as a rectangle capped by two
// semicircles of length L and width 0.6L (Figure 1.14a, Eq. 1.1):
//
//   Ac = pi(0.3L)^2 + (0.4L)(0.6L) = 0.5227 L^2,   L = sqrt(Ac / 0.5227)
//
// with Ac = load on the tyre / tyre pressure. PCA (1984) replaces that outline
// with a rectangle of 0.8712L x 0.6L of the same area (Figure 1.14b), and
// layered-elastic theory (Huang Ch. 2, and the Stress Explorer and LEA tools
// here) replaces it again with a circle of the same area.
//
// Units are SI throughout — newtons, megapascals, millimetres — because that
// is what the model was trained in. Conversions to the course's customary
// units are at the bottom and are display-only.

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
 * Outline of Huang Figure 1.14a in millimetres, centred on the origin, as a
 * closed polyline: a rectangle 0.4L long and 0.6L wide capped by semicircles
 * of radius 0.3L. `x` runs along the direction of travel.
 */
export function huangOutline(ideal: Idealization, steps = 48): { x: number[]; y: number[] } {
  const r = ideal.width / 2; // 0.3 L
  const half = ideal.length / 2 - r; // 0.2 L — half the straight run
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 0; i <= steps; i++) {
    // Right cap, -90° to +90°, centred at (+0.2L, 0).
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

/** Equal-area circle, centred on the origin, as a closed polyline. */
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

/** PCA equivalent rectangle, centred on the origin, as a closed polyline. */
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
 * How the prediction stands against the idealisation, and against the physics
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
  /** |most tensile sigma_z| / peak sigma_z — should be ~0; a tyre cannot pull. */
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

/** Index of the row carrying the largest value — the centre of the peak rib. */
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
