// Pavement drainage design — pure functions, no React.
// Huang (2004) Chapter 8. Exercised against the printed answers in
// equations.test.mjs.
//
// US customary throughout: ft, ft/day, ft³/h/ft², psf, in.

/* ───────────────────────── Surface infiltration ───────────────────────── */

/**
 * Ridgeway's infiltration, Huang Eq. 8.18:
 *   q = 0.1 · (N + 1 + W_p/C_s)      ft³/h per linear ft of pavement
 * with an assumed crack infiltration rate of 0.1 ft³/h/ft of crack,
 * N_c = N + 1 longitudinal cracks, W_c = W_p, and k_p ≈ 0.
 *
 * @param N   number of traffic lanes
 * @param Wp  width of pavement subject to infiltration (ft)
 * @param Cs  transverse joint/crack spacing (ft) — 40 ft for asphalt
 * @returns   { qLinear ft³/h/ft, qArea ft³/h/ft² }
 */
export function infiltrationRidgeway(N: number, Wp: number, Cs: number) {
  const qLinear = 0.1 * (N + 1 + Wp / Cs);
  return { qLinear, qArea: Wp > 0 ? qLinear / Wp : NaN };
}

/**
 * Cedergren's method: a fraction of the 1-hour / 1-year precipitation rate.
 * @param precipInHr  1-h/1-yr rate from Huang Fig. 8.13 (in/h)
 * @param coeff       0.33-0.50 asphalt, 0.50-0.67 concrete
 * @returns ft³/h/ft² (numerically ft/h)
 */
export const infiltrationCedergren = (precipInHr: number, coeff: number) =>
  (precipInHr * coeff) / 12;

/* ─────────────────────────── Groundwater ─────────────────────────── */

/** Huang Eq. 8.20 — radius of influence. */
export const radiusOfInfluence = (H: number, H0: number) => 3.8 * (H - H0);

/**
 * Inflow above the bottom of the drainage layer, Huang Eq. 8.19:
 *   q1 = k (H − H0)² / (2 L_i)
 * @param k  permeability of the native soil (ft/day)
 */
export function groundwaterAboveDrain(k: number, H: number, H0: number) {
  const Li = radiusOfInfluence(H, H0);
  return Li > 0 ? (k * Math.pow(H - H0, 2)) / (2 * Li) : 0;
}

/**
 * Lateral and areal groundwater inflow, Huang Eqs. 8.21-8.22 (drains both
 * sides) or 8.23-8.24 (pavement sloped one way, drains on one side).
 * q2 comes from Huang Fig. 8.14 and is supplied by the caller.
 */
export function groundwaterInflow(q1: number, q2: number, W: number, oneSided: boolean) {
  const qL = oneSided ? 2 * (q1 + q2) : q1 + q2;
  const qg = oneSided ? (q1 + 2 * q2) / W : (2 * q2) / W;
  return { qL, qg };
}

/* ──────────────────────────── Meltwater ────────────────────────────
 * Huang Table 8.5 — heave rate by Unified classification and the percent
 * finer than 0.02 mm. Transcribed from the printed table; each entry gives
 * the band of "percent passing 0.02 mm" and the corresponding heave rate.
 */
export interface HeaveEntry {
  soil: string;
  symbol: string;
  passing: [number, number];  // percent finer than 0.02 mm
  heave: [number, number];    // mm/day
  frost: string;
}

export const HEAVE_TABLE: HeaveEntry[] = [
  { soil: 'Gravel and sandy gravel', symbol: 'GP', passing: [0.4, 0.4], heave: [3.0, 3.0], frost: 'Medium' },
  { soil: 'Gravel and sandy gravel', symbol: 'GW', passing: [0.7, 1.0], heave: [0.3, 1.0], frost: 'Negligible to low' },
  { soil: 'Gravel and sandy gravel', symbol: 'GW', passing: [1.0, 1.5], heave: [1.0, 3.5], frost: 'Low to medium' },
  { soil: 'Gravel and sandy gravel', symbol: 'GW', passing: [1.5, 4.0], heave: [3.5, 2.0], frost: 'Medium' },
  { soil: 'Silty and sandy gravel', symbol: 'GP-GM', passing: [2.0, 3.0], heave: [1.0, 3.0], frost: 'Low to medium' },
  { soil: 'Silty and sandy gravel', symbol: 'GW-GM', passing: [3.0, 7.0], heave: [3.0, 4.5], frost: 'Medium to high' },
  { soil: 'Silty and sandy gravel', symbol: 'GM', passing: [7.0, 10.0], heave: [4.5, 3.0], frost: 'High to medium' },
  { soil: 'Clayey and silty gravel', symbol: 'GW-GC', passing: [4.2, 4.2], heave: [2.5, 2.5], frost: 'Medium' },
  { soil: 'Clayey and silty gravel', symbol: 'GM-GC', passing: [15.0, 15.0], heave: [5.0, 5.0], frost: 'High' },
  { soil: 'Clayey and silty gravel', symbol: 'GC', passing: [15.0, 30.0], heave: [2.5, 5.0], frost: 'Medium to high' },
  { soil: 'Sand and gravelly sand', symbol: 'SP', passing: [1.0, 2.0], heave: [0.8, 0.8], frost: 'Very low' },
  { soil: 'Sand and gravelly sand', symbol: 'SW', passing: [2.0, 2.0], heave: [3.0, 3.0], frost: 'Medium' },
  { soil: 'Silty and gravelly sand', symbol: 'SP-SM', passing: [1.5, 2.0], heave: [0.2, 1.5], frost: 'Negligible to low' },
  { soil: 'Silty and gravelly sand', symbol: 'SW-SM', passing: [2.0, 5.0], heave: [1.5, 6.0], frost: 'Low to high' },
  { soil: 'Silty and gravelly sand', symbol: 'SM', passing: [5.0, 9.0], heave: [6.0, 9.0], frost: 'High to very high' },
  { soil: 'Silty and gravelly sand', symbol: 'SM', passing: [9.0, 22.0], heave: [9.0, 5.5], frost: 'Very high to high' },
  { soil: 'Clayey and silty sand', symbol: 'SM-SC', passing: [9.5, 35.0], heave: [5.0, 7.0], frost: 'High' },
  { soil: 'Clayey and silty sand', symbol: 'SC', passing: [9.5, 35.0], heave: [5.0, 7.0], frost: 'High' },
  { soil: 'Silt and organic silt', symbol: 'ML-OL', passing: [23.0, 33.0], heave: [1.1, 14.0], frost: 'Low to very high' },
  { soil: 'Silt and organic silt', symbol: 'ML', passing: [33.0, 45.0], heave: [14.0, 25.0], frost: 'Very high' },
  { soil: 'Silt and organic silt', symbol: 'ML', passing: [45.0, 65.0], heave: [25.0, 25.0], frost: 'Very high' },
  { soil: 'Clayey silt', symbol: 'ML-CL', passing: [60.0, 75.0], heave: [13.0, 13.0], frost: 'Very high' },
  { soil: 'Gravelly and sandy clay', symbol: 'CL', passing: [38.0, 65.0], heave: [7.0, 10.0], frost: 'High to very high' },
  { soil: 'Lean clay', symbol: 'CL', passing: [65.0, 65.0], heave: [5.0, 5.0], frost: 'High' },
  { soil: 'Lean clay', symbol: 'CL-OL', passing: [30.0, 70.0], heave: [4.0, 4.0], frost: 'High' },
  { soil: 'Fat clay', symbol: 'CH', passing: [60.0, 60.0], heave: [0.8, 0.8], frost: 'Very low' },
];

/**
 * Consolidation pressure on the subgrade — the weight of the pavement above
 * it, per unit area.
 * @param layers  [{ thicknessIn, unitWeightPcf }]
 * @returns psf
 */
export const consolidationPressure = (layers: { t: number; g: number }[]) =>
  layers.reduce((s, l) => s + l.g * (l.t / 12), 0);

/**
 * Meltwater inflow from ice lenses.
 *
 * The chart step (Huang Fig. 8.15) is NOT digitized here — reading a family
 * of log-log curves off a scanned figure would put fabricated precision into
 * a number students hand in. The caller supplies q_m/√k read from the figure;
 * this converts it to an inflow.
 *
 * @param qmOverSqrtK  read from Huang Fig. 8.15 for the heave rate and σ_p
 * @param k            subgrade permeability (ft/day)
 * @returns ft³/day/ft²
 */
export const meltwaterInflow = (qmOverSqrtK: number, k: number) =>
  qmOverSqrtK * Math.sqrt(k);

/* ─────────────────────────── Design inflow ─────────────────────────── */

/**
 * Huang Eqs. 8.25-8.26. Without frost, q_d = q_i + q_g; with frost,
 * q_d = q_i + q_m. Whichever is larger governs, because groundwater and
 * meltwater are not assumed to occur together.
 */
export function designInflow(qi: number, qg: number, qm: number) {
  const noFrost = qi + qg;
  const frost = qi + qm;
  return { noFrost, frost, governing: Math.max(noFrost, frost) };
}

/* ──────────────────── Drainage layer capacity ──────────────────── */

/**
 * Steady-state discharge capacity of the drainage layer, Huang Eq. 8.27:
 *   q = k H (S + H / (2L))
 * @param k permeability of the drainage layer (ft/day)
 * @param H thickness of the drainage layer (ft)
 * @param S slope of the drainage layer (ft/ft)
 * @param L length of the drainage layer (ft)
 * @returns ft³/day per ft of width
 */
export const drainageCapacity = (k: number, H: number, S: number, L: number) =>
  L > 0 ? k * H * (S + H / (2 * L)) : NaN;

/** Slope factor S1 = L·S/H — the x-axis of the degree-of-drainage chart. */
export const slopeFactor = (L: number, S: number, H: number) => (H > 0 ? (L * S) / H : NaN);

/**
 * Time to reach a given degree of drainage (Casagrande & Shannon, Huang
 * §8.3.2):
 *
 *   t = T · n_e · L² / (k · H)
 *
 * The dimensionless time factor T depends on the degree of drainage U and the
 * slope factor S1, and is read from the degree-of-drainage chart — it is not
 * digitized here for the same reason as Fig. 8.15, so the caller supplies it.
 *
 * @param ne effective (drainable) porosity
 * @param L  drainage length (ft)
 * @param k  drainage layer permeability (ft/day)
 * @param H  drainage layer thickness (ft)
 * @param T  time factor from the chart
 * @returns  time in days
 */
export function timeToDrain(ne: number, L: number, k: number, H: number, T: number) {
  return k * H > 0 ? (T * ne * L * L) / (k * H) : NaN;
}

/* ──────────────────────── Collector pipe ──────────────────────── */

/**
 * Manning full-flow capacity of a circular collector pipe (Huang Eq. 8.32):
 *   Q = (1.486/n) · A · R^(2/3) · S^(1/2)
 * with A = πD²/4 and R = D/4 for a pipe flowing full.
 * @param Din pipe inside diameter (in)
 * @param n   Manning roughness coefficient
 * @param S   pipe slope (ft/ft)
 * @returns   { cfs, cfd } — ft³/s and ft³/day
 */
export function pipeCapacity(Din: number, n: number, S: number) {
  const D = Din / 12;
  const A = (Math.PI * D * D) / 4;
  const R = D / 4;
  const cfs = (1.486 / n) * A * Math.pow(R, 2 / 3) * Math.sqrt(S);
  return { cfs, cfd: cfs * 86400 };
}

/**
 * Maximum allowable lateral inflow into the pipe (Huang Eq. 8.34): the full
 * flow capacity spread over the distance between outlets.
 * @returns ft³/day per ft of pipe
 */
export const maxLateralInflow = (Din: number, n: number, S: number, outletSpacing: number) =>
  outletSpacing > 0 ? pipeCapacity(Din, n, S).cfd / outletSpacing : NaN;

/* ─────────────────────── Filter criteria ─────────────────────── */

/**
 * Granular filter criteria (Huang §8.2). A filter must be coarse enough to
 * drain and fine enough to hold the protected soil back.
 */
export function filterCriteria(filter: { d15: number; d50: number; d85: number },
                               soil: { d15: number; d50: number; d85: number }) {
  const checks = [
    {
      name: 'Piping: D15(filter) / d85(soil) ≤ 5',
      value: filter.d15 / soil.d85,
      limit: 5,
      pass: filter.d15 / soil.d85 <= 5,
    },
    {
      name: 'Permeability: D15(filter) / d15(soil) ≥ 5',
      value: filter.d15 / soil.d15,
      limit: 5,
      pass: filter.d15 / soil.d15 >= 5,
    },
    {
      name: 'Uniformity: D50(filter) / d50(soil) ≤ 25',
      value: filter.d50 / soil.d50,
      limit: 25,
      pass: filter.d50 / soil.d50 <= 25,
    },
  ];
  return { checks, allPass: checks.every(c => c.pass) };
}
