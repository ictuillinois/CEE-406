// Dynamic modulus and the master curve — pure functions, no React.
//
// Huang (2004) §7.2 for the two prediction methods, §2.3 for the
// time-temperature superposition that turns a family of isotherms into one
// curve. Pinned to the printed answers of Examples 2.16, 7.7, 7.8, 7.9 and
// 7.10 by equations.test.mjs.
//
// Two things make this worth a tool rather than a spreadsheet:
//
//   1. The Asphalt Institute and Shell/Bonnaure methods answer the same
//      question and DISAGREE. On the mix of Example 7.10 they differ by 65%
//      — 5.1x10^5 psi against 3.1x10^5 psi. Huang prints both without
//      declaring a winner.
//
//   2. Time-temperature superposition is an assumption, not a theorem. The
//      tool shifts predicted isotherms onto a reference temperature and
//      reports how well they actually collapse, so a student can see whether
//      superposition holds for the model they just used.
//
// Units: psi and °F for the AI route, N/m² and °C for the Shell route, as in
// the book. Conversions are explicit, never implicit.

export const PSI_PER_NM2 = 1 / 6900;   // Huang's note: 1 psi = 6900 N/m²

/* ───────────────────── Binder temperature susceptibility ───────────────── */

/**
 * Temperature susceptibility A — Huang Eq. 7.18, the slope of log(pen)
 * against temperature, using the ring-and-ball point where all bitumens have
 * a penetration of about 800.
 *
 *   A = [log(pen at T) − log 800] / (T − T_R&B)
 *
 * @param penAtT penetration at temperature T
 * @param T      that temperature, °C
 * @param tRB    ring-and-ball softening point, °C
 */
export const temperatureSusceptibility = (penAtT: number, T: number, tRB: number) =>
  (Math.log10(penAtT) - Math.log10(800)) / (T - tRB);

/**
 * Penetration index — Huang Eq. 7.16.
 *
 *   PI = (20 − 500A) / (1 + 50A)
 *
 * A blown or heavily modified bitumen has a high PI (less temperature
 * sensitive); a straight-run one sits near zero.
 */
export const penetrationIndex = (A: number) => (20 - 500 * A) / (1 + 50 * A);

/**
 * Asphalt viscosity at 70°F from penetration at 77°F — Huang Eq. 7.28.
 *
 *   λ = 29,508.2 · (P77)^(−2.1939)     [10⁶ poise]
 *
 * Used when viscosity data are not available. Note it takes the ORIGINAL
 * asphalt penetration, not the recovered one — the AI and Shell routes differ
 * on that point and it is a real source of disagreement between them.
 */
export const viscosityFromPenetration = (pen77: number) =>
  29508.2 * Math.pow(pen77, -2.1939);

/* ───────────────────────── Volumetric relations ────────────────────────── */

/**
 * Volume percentages of aggregate and bitumen — Huang Eqs. 7.20 and 7.21.
 *
 *   Vg = 100 (1 − p_b) · G_mix / G_agg
 *   Vb = 100 · p_b · G_mix / G_bitumen
 *
 * Air voids are whatever is left over.
 *
 * @param bitumenPct bitumen content by WEIGHT, percent
 * @param gMix       bulk specific gravity of the mixture
 * @param gAgg       bulk specific gravity of the aggregate
 * @param gBit       apparent specific gravity of the bitumen
 */
export function volumeFractions(bitumenPct: number, gMix: number, gAgg: number, gBit: number) {
  const pb = bitumenPct / 100;
  const Vg = 100 * (1 - pb) * (gMix / gAgg);
  const Vb = 100 * pb * (gMix / gBit);
  return { Vg, Vb, Va: 100 - Vg - Vb };
}

/* ──────────────── Asphalt Institute dynamic modulus (Eq. 7.27) ─────────── */

export interface AiInputs {
  /** Load frequency, Hz. */
  f: number;
  /** Temperature, °F. */
  T: number;
  /** Percent by weight of aggregate passing the No. 200 sieve. */
  p200: number;
  /** Air void volume, percent. */
  va: number;
  /** Bitumen volume, percent. */
  vb: number;
  /** Asphalt viscosity at 70°F, in 10⁶ poise. */
  lambda: number;
}

export interface AiResult {
  /** |E*| in psi. */
  eStar: number;
  /** The five temporary constants, so a student can check them one by one
   *  against the book rather than only checking the final number. */
  beta: [number, number, number, number, number];
}

/**
 * Dynamic modulus by the Asphalt Institute regression — Huang Eq. 7.27.
 *
 *   β5 = 1.3 + 0.49825 log f
 *   β4 = 0.483 Vb
 *   β3 = 0.553833 + 0.028829 P200 f^(−0.1703) − 0.03476 Va
 *        + 0.070377 λ + 0.931757 f^(−0.02774)
 *   β2 = β4^0.5 · T^β5
 *   β1 = β3 + 0.000005 β2 − 0.00189 β2 f^(−1.1)
 *   |E*| = 100,000 · 10^β1
 */
export function dynamicModulusAI(i: AiInputs): AiResult | null {
  const { f, T, p200, va, vb, lambda } = i;
  if (!(f > 0 && T > 0 && vb > 0)) return null;

  const b5 = 1.3 + 0.49825 * Math.log10(f);
  const b4 = 0.483 * vb;
  const b3 =
    0.553833 +
    0.028829 * (p200 * Math.pow(f, -0.1703)) -
    0.03476 * va +
    0.070377 * lambda +
    0.931757 * Math.pow(f, -0.02774);
  const b2 = Math.pow(b4, 0.5) * Math.pow(T, b5);
  const b1 = b3 + 0.000005 * b2 - 0.00189 * b2 * Math.pow(f, -1.1);

  return { eStar: 100000 * Math.pow(10, b1), beta: [b1, b2, b3, b4, b5] };
}

/* ─────────────── Shell / Bonnaure stiffness modulus (Eq. 7.24) ─────────── */

export interface BonnaureResult {
  /** Sm in N/m². */
  sm: number;
  beta: [number, number, number, number];
  /** Which branch of Eq. 7.25 was used, or null if Sb is out of range. */
  branch: 'a' | 'b' | null;
}

/**
 * Stiffness modulus of the mix from the stiffness of its bitumen —
 * Huang Eqs. 7.24 and 7.25 (Bonnaure et al., 1977).
 *
 *   β1 = 10.82 − 1.342(100 − Vg)/(Vg + Vb)
 *   β2 = 8.0 + 0.00568 Vg + 0.0002135 Vg²
 *   β3 = 0.6 log[(1.37 Vb² − 1)/(1.33 Vb − 1)]     ← note Vb SQUARED on top
 *   β4 = 0.7582 (β1 − β2)
 *
 * and then, for 5×10⁶ < Sb < 10⁹ N/m² (Eq. 7.25a),
 *
 *   log Sm = ½(β4 + β3)(log Sb − 8) + ½(β4 − β3)|log Sb − 8| + β2
 *
 * or for 10⁹ < Sb < 3×10⁹ N/m² (Eq. 7.25b),
 *
 *   log Sm = β2 + β4 + 2.0959(β1 − β2 − β4)(log Sb − 9)
 *
 * **A note on Huang's Example 7.9, case 1.** The text works that case through
 * to log Sm = 9.188 (Sm = 1.5x10^9), and Table 7.6 repeats it. That value can
 * only be reached by using β4 in place of β3 on the descending branch, which
 * contradicts the book's own cases 2 and 3. Implemented as printed in
 * Eq. 7.25a, this function reproduces **eight of the nine cases to within 4%**
 * and returns 1.81x10^9 for case 1. The slip is the book's, not this code's —
 * equations.test.mjs pins all nine so the claim is checkable.
 *
 * @param sb stiffness modulus of the bitumen, N/m²
 * @param vb bitumen volume, percent
 * @param vg aggregate volume, percent
 */
export function stiffnessBonnaure(sb: number, vb: number, vg: number): BonnaureResult | null {
  if (!(sb > 0 && vb > 0 && vg > 0)) return null;
  // The β3 logarithm needs both 1.37Vb − 1 and 1.33Vb − 1 positive.
  if (1.33 * vb - 1 <= 0) return null;

  const b1 = 10.82 - (1.342 * (100 - vg)) / (vg + vb);
  const b2 = 8.0 + 0.00568 * vg + 0.0002135 * vg * vg;
  // Vb is squared in the numerator and not in the denominator — easy to
  // misread, and Huang's Example 7.9 (1.37 x 25 for Vb = 5) is the check.
  const b3 = 0.6 * Math.log10((1.37 * vb * vb - 1) / (1.33 * vb - 1));
  const b4 = 0.7582 * (b1 - b2);

  const L = Math.log10(sb);
  let logSm: number;
  let branch: 'a' | 'b' | null;

  if (sb >= 5e6 && sb <= 1e9) {
    logSm = 0.5 * (b4 + b3) * (L - 8) + 0.5 * (b4 - b3) * Math.abs(L - 8) + b2;
    branch = 'a';
  } else if (sb > 1e9 && sb <= 3e9) {
    logSm = b2 + b4 + 2.0959 * (b1 - b2 - b4) * (L - 9);
    branch = 'b';
  } else {
    // Outside the range the equations were fitted over. Extrapolate with the
    // nearer branch but say so, rather than returning a confident number.
    logSm = sb < 5e6
      ? 0.5 * (b4 + b3) * (L - 8) + 0.5 * (b4 - b3) * Math.abs(L - 8) + b2
      : b2 + b4 + 2.0959 * (b1 - b2 - b4) * (L - 9);
    branch = null;
  }

  return { sm: Math.pow(10, logSm), beta: [b1, b2, b3, b4], branch };
}

/* ─────────────── Time-temperature superposition (Huang §2.3) ───────────── */

/**
 * Time-temperature shift factor — Huang Eqs. 2.44-2.46.
 *
 *   log a_T = β (T − T0),   a_T = t_T / t_T0 = exp[2.3026 β (T − T0)]
 *
 * β is the slope of log a_T against temperature: 0.061 to 0.170 for asphalt
 * mixes, averaging 0.113 (FHWA, 1978).
 *
 * @param T    temperature of interest, °F
 * @param T0   reference temperature, °F
 * @param beta slope of the shift-factor line, per °F
 */
export const shiftFactor = (T: number, T0: number, beta = 0.113) =>
  Math.exp(2.3026 * beta * (T - T0));

/** Average slope of the shift-factor line for asphalt mixes (FHWA, 1978). */
export const BETA_DEFAULT = 0.113;
export const BETA_RANGE: [number, number] = [0.061, 0.170];

/**
 * Reduced frequency at the reference temperature.
 *
 * Time shifts by a_T, so frequency — its reciprocal — shifts by 1/a_T. A
 * measurement taken at a temperature above the reference behaves like a
 * SLOWER load at the reference, which is the whole content of superposition.
 */
export const reducedFrequency = (f: number, T: number, T0: number, beta = BETA_DEFAULT) =>
  f / shiftFactor(T, T0, beta);

/* ─────────────────────────── The master curve ──────────────────────────── */

export interface MasterPoint {
  T: number;
  f: number;
  /** Reduced frequency at the reference temperature, Hz. */
  fr: number;
  /** |E*| in psi. */
  eStar: number;
}

export interface SigmoidFit {
  /** log|E*| = delta + alpha / (1 + exp(beta + gamma·log fr)) */
  delta: number;
  alpha: number;
  beta: number;
  gamma: number;
  /** Coefficient of determination on log|E*|. */
  r2: number;
  /** RMS residual in log10 units. */
  rmsLog: number;
  /**
   * Which asymptotes finished pinned against their physical bound. A pinned
   * asymptote is one the DATA does not determine — the fit ran out of curve
   * before it ran out of parameter, and the number shown is the bound, not a
   * measurement. Report it as such.
   */
  atBound: { lower: boolean; upper: boolean };
}

/**
 * Build the master curve: predict |E*| across a grid of temperatures and
 * frequencies, then shift every isotherm onto the reference temperature.
 */
export function buildMasterCurve(
  base: Omit<AiInputs, 'f' | 'T'>,
  temps: number[],
  freqs: number[],
  T0: number,
  beta = BETA_DEFAULT
): MasterPoint[] {
  const pts: MasterPoint[] = [];
  for (const T of temps) {
    for (const f of freqs) {
      const r = dynamicModulusAI({ ...base, f, T });
      if (!r || !(r.eStar > 0)) continue;
      pts.push({ T, f, fr: reducedFrequency(f, T, T0, beta), eStar: r.eStar });
    }
  }
  return pts.sort((a, b) => a.fr - b.fr);
}

/**
 * Fit the MEPDG sigmoidal master curve to the shifted points:
 *
 *   log|E*| = δ + α / (1 + exp(β + γ log f_R))
 *
 * by Levenberg-Marquardt on the four parameters. δ is the lower asymptote
 * (the modulus as the load becomes infinitely slow or hot), δ+α the upper
 * (infinitely fast or cold), and γ the steepness of the transition.
 *
 * **The fit quality is the point.** Superposition asserts that every isotherm
 * lands on ONE curve. If the residual is large, the model being shifted does
 * not obey superposition, and no amount of curve-fitting repairs that.
 */
export function fitSigmoid(points: MasterPoint[]): SigmoidFit | null {
  if (points.length < 6) return null;
  const x = points.map(p => Math.log10(p.fr));
  const y = points.map(p => Math.log10(p.eStar));

  const yMin = Math.min(...y), yMax = Math.max(...y);

  // Physical bounds on the asymptotes, in log10(psi).
  //
  // Without them the fit is under-determined whenever the data does not span
  // BOTH plateaus of the S — and it rarely does. The optimizer then drifts to
  // a nearly straight line (gamma -> 0) with an enormous alpha, which fits the
  // observed range perfectly well while reporting a glassy modulus of billions
  // of psi. The residual looks fine; the physics is nonsense.
  //
  // An asphalt mixture cannot be stiffer than its glassy limit (roughly
  // 3-5 x 10^6 psi) nor softer than its aggregate skeleton.
  const LOG_E_MIN = Math.log10(300);      // 0.3 ksi — softer than any mixture
  const LOG_E_MAX = Math.log10(5e6);      // 5,000 ksi — the glassy limit
  const bounds: [number, number][] = [
    [LOG_E_MIN, Math.log10(2e5)],   // delta: the lower asymptote
    [0.3, LOG_E_MAX - LOG_E_MIN],   // alpha: at least a factor of 2 of range
    [-30, 30],                      // beta: horizontal location, effectively free
    [-5, -0.05],                    // gamma: negative, or |E*| would fall with rate
  ];
  /** Project onto the box, then cap the UPPER asymptote too — bounding delta
   *  and alpha separately still allows their sum to exceed the glassy limit. */
  const clamp = (q: number[]): [number, number, number, number] => {
    const out = q.map((v, k) => Math.min(bounds[k][1], Math.max(bounds[k][0], v)));
    if (out[0] + out[1] > LOG_E_MAX) out[1] = Math.max(bounds[1][0], LOG_E_MAX - out[0]);
    return out as [number, number, number, number];
  };

  // Seed: asymptotes just outside the data, transition centered on the mean.
  let p: [number, number, number, number] = clamp([
    yMin - 0.1,
    Math.max(0.5, yMax - yMin + 0.2),
    0,
    -0.5,
  ]);

  const model = (q: number[], xi: number) =>
    q[0] + q[1] / (1 + Math.exp(q[2] + q[3] * xi));

  const sse = (q: number[]) =>
    y.reduce((s, yi, i) => s + (yi - model(q, x[i])) ** 2, 0);

  // Marquardt damping is ADDITIVE and scaled to the largest diagonal entry.
  // Multiplicative damping (A[i][i] *= 1+lambda) is useless here: J'J for a
  // four-parameter sigmoid is badly conditioned, and scaling a near-zero
  // diagonal by 1.001 leaves it near zero, so the solve returns NaN, every
  // step is rejected, and the fit silently hands back its own seed.
  let lambda = 1e-2;
  let err = sse(p);

  for (let iter = 0; iter < 300; iter++) {
    // Numerical Jacobian by central difference — a forward difference on a
    // saturating function loses too much precision near the asymptotes.
    const J: number[][] = x.map(() => new Array(4).fill(0));
    for (let k = 0; k < 4; k++) {
      const h = Math.max(1e-6, Math.abs(p[k]) * 1e-6);
      const up = [...p]; up[k] += h;
      const dn = [...p]; dn[k] -= h;
      for (let i = 0; i < x.length; i++) {
        J[i][k] = (model(up, x[i]) - model(dn, x[i])) / (2 * h);
      }
    }
    const r = x.map((xi, i) => y[i] - model(p, xi));

    // Normal equations, built once per iteration and re-damped per attempt.
    const JtJ: number[][] = Array.from({ length: 4 }, () => new Array(4).fill(0));
    const Jtr = new Array(4).fill(0);
    for (let a = 0; a < 4; a++) {
      for (let c = 0; c < 4; c++) JtJ[a][c] = J.reduce((s, row) => s + row[a] * row[c], 0);
      Jtr[a] = J.reduce((s, row, i) => s + row[a] * r[i], 0);
    }
    const diagMax = Math.max(...JtJ.map((row, i) => Math.abs(row[i])), 1e-12);

    let accepted = false;
    for (let attempt = 0; attempt < 24 && !accepted; attempt++) {
      const A = JtJ.map(row => [...row]);
      for (let a = 0; a < 4; a++) A[a][a] += lambda * diagMax;

      const d = solve4(A, Jtr);
      if (!d) { lambda *= 10; continue; }

      // Cap the step so a poorly conditioned iteration cannot throw the
      // parameters somewhere the model is meaningless.
      const trial = clamp(p.map((v, k) => v + Math.max(-2, Math.min(2, d[k]))));
      const e2 = sse(trial);
      if (Number.isFinite(e2) && e2 < err) {
        p = trial; err = e2; lambda = Math.max(1e-10, lambda / 3); accepted = true;
      } else {
        lambda *= 10;
      }
      if (lambda > 1e12) break;
    }
    if (!accepted) break;
    if (err < 1e-14) break;
  }

  const meanY = y.reduce((s, v) => s + v, 0) / y.length;
  const sst = y.reduce((s, v) => s + (v - meanY) ** 2, 0);
  const tol = 1e-6;
  return {
    delta: p[0], alpha: p[1], beta: p[2], gamma: p[3],
    r2: sst > 0 ? 1 - err / sst : 1,
    rmsLog: Math.sqrt(err / y.length),
    atBound: {
      lower: Math.abs(p[0] - bounds[0][0]) < tol || Math.abs(p[0] - bounds[0][1]) < tol,
      upper: Math.abs(p[0] + p[1] - LOG_E_MAX) < tol,
    },
  };
}

/** Evaluate a fitted sigmoid at a reduced frequency, returning |E*| in psi. */
export const sigmoidAt = (fit: SigmoidFit, fr: number) =>
  Math.pow(10, fit.delta + fit.alpha / (1 + Math.exp(fit.beta + fit.gamma * Math.log10(fr))));

/** Gaussian elimination for the 4x4 normal equations. */
function solve4(A: number[][], b: number[]): number[] | null {
  const n = 4;
  const M = A.map((row, i) => [...row, b[i]]);
  // Scale the singularity test to the matrix, not to an absolute epsilon:
  // an absolute 1e-300 lets a hopeless pivot through and yields NaN.
  const scale = Math.max(...A.flat().map(Math.abs), 1e-300);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-12 * scale) return null;
    [M[col], M[piv]] = [M[piv], M[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  // M[i][i], not row[i][i] — row is an array of numbers, so row[i][i] indexes
  // into a number and yields undefined, turning every solution into NaN.
  const out = M.map((_, i) => M[i][n] / M[i][i]);
  return out.every(Number.isFinite) ? out : null;
}
