// FWD backcalculation — pure functions, no React.
//
// Two independent routes from a measured deflection basin to layer stiffness,
// which is the whole pedagogical point: they disagree, and the student has to
// decide which to believe.
//
//   1. AASHTO 1993 closed form (Huang 2004, §13.5.2, Eqs. 13.22-13.26).
//      Two numbers out — the subgrade M_R from one outer sensor, and an
//      effective modulus E_p for everything above it, from d0 alone.
//      Odemark's approximation, not Burmister's: fast, and wrong in a
//      knowable direction (Huang Table 13.10).
//
//   2. Layered-elastic backcalculation. The forward model is the same exact
//      Hankel-transform solver the LEA tool uses (Huang App. B), driven by
//      Levenberg-Marquardt in log-modulus space until the computed basin
//      matches the measured one.
//
// Route 2 is not "the right answer" — §9.4.3 is explicit that no
// backcalculation method is guaranteed to return reasonable moduli, that thin
// layers are near-indeterminate because the basin is insensitive to them, and
// that two agencies running the same program on the same section have derived
// very different answers. The tool therefore reports the *uncertainty* of each
// backcalculated modulus alongside its value.
import { leaResponse, type Layer } from '../lea/lea.ts';

export type { Layer };

/** Fewer integration cycles than the LEA tool's default: at 30 the surface
 *  deflections agree to 5 significant figures and a fit runs ~7x faster. */
const FIT_CYCLES = 30;

/* ─────────────────────────── Forward model ─────────────────────────────── */

/**
 * Surface deflections under a uniform circular load at the given radial
 * offsets. This is the forward model the backcalculation inverts.
 *
 * @param layers  top to bottom; the last is the half-space
 * @param q       plate pressure
 * @param a       plate radius
 * @param offsets sensor distances from the load center
 */
export function basin(
  layers: Layer[], q: number, a: number, offsets: number[], cycles = FIT_CYCLES
): number[] | null {
  const out: number[] = [];
  for (const r of offsets) {
    const R = leaResponse(layers, q, a, r, 0, { cycles });
    if (!R || !Number.isFinite(R.w)) return null;
    out.push(R.w);
  }
  return out;
}

/* ─────────────────────────── Basin indices ─────────────────────────────── */

export interface BasinIndices {
  /** Surface curvature index d0 − d12: the top of the structure. */
  sci: number | null;
  /** Base damage index d12 − d24: the unbound layers. */
  bdi: number | null;
  /** Base curvature index d24 − d36: the subgrade. */
  bci: number | null;
  /** AASHTO area of the normalized basin, in. A stiff structure gives a
   *  larger area; 36 in is the theoretical maximum for a rigid basin. */
  area: number | null;
}

/** Deflection at a given offset, linearly interpolated between sensors. */
export function deflectionAt(offsets: number[], defl: number[], r: number): number | null {
  if (offsets.length !== defl.length || offsets.length === 0) return null;
  const idx = offsets.map((_, i) => i).sort((i, j) => offsets[i] - offsets[j]);
  const xs = idx.map(i => offsets[i]);
  const ys = idx.map(i => defl[i]);
  if (r < xs[0] - 1e-9 || r > xs[xs.length - 1] + 1e-9) return null;
  for (let i = 0; i < xs.length - 1; i++) {
    if (r >= xs[i] - 1e-9 && r <= xs[i + 1] + 1e-9) {
      const t = xs[i + 1] === xs[i] ? 0 : (r - xs[i]) / (xs[i + 1] - xs[i]);
      return ys[i] + t * (ys[i + 1] - ys[i]);
    }
  }
  return null;
}

/**
 * The classic basin indices. Each is a difference between two sensors, so
 * each is dominated by the stiffness of a different depth band — that is what
 * makes them a sanity check on a backcalculated modulus set.
 */
export function basinIndices(offsets: number[], defl: number[]): BasinIndices {
  const d = (r: number) => deflectionAt(offsets, defl, r);
  const d0 = d(0), d12 = d(12), d24 = d(24), d36 = d(36);
  const sub = (x: number | null, y: number | null) =>
    x === null || y === null ? null : x - y;
  const area =
    d0 === null || d12 === null || d24 === null || d36 === null || d0 === 0
      ? null
      : 6 * (1 + 2 * (d12 / d0) + 2 * (d24 / d0) + d36 / d0);
  return { sci: sub(d0, d12), bdi: sub(d12, d24), bci: sub(d24, d36), area };
}

/* ───────────────── AASHTO 1993 closed form (Eqs. 13.22-13.26) ───────────── */

/**
 * Subgrade resilient modulus from one outer sensor — Huang Eq. 13.22,
 * the Boussinesq point-load deflection inverted at ν = 0.5.
 *
 *   M_R = 0.24 P / (d_r · r)
 *
 * @param P  total load on the plate (lb)
 * @param dr deflection at that sensor (in)
 * @param r  sensor offset (in)
 */
export const subgradeMr = (P: number, dr: number, r: number) =>
  dr > 0 && r > 0 ? (0.24 * P) / (dr * r) : NaN;

/**
 * The design M_R is the backcalculated one reduced by C ≤ 0.33 (Eq. 13.23).
 * The factor exists because Eq. 13.22 assumes a homogeneous half-space and
 * the real subgrade is neither homogeneous nor linear — it is a correction
 * for the model, not for the soil.
 */
export const designMr = (mrBackcalculated: number, C = 0.33) => C * mrBackcalculated;

/**
 * Minimum sensor offset at which Eq. 13.22 is valid — Huang Eq. 13.24.
 * Closer than this, the sensor still sees the layers above the subgrade.
 *
 *   r_min = 0.7 · sqrt(a² + (D · (E_p/M_R)^(1/3))²)
 */
export const minSensorOffset = (a: number, D: number, epOverMr: number) =>
  0.7 * Math.sqrt(a * a + Math.pow(D * Math.cbrt(epOverMr), 2));

/**
 * Center deflection predicted by Odemark's two-layer approximation —
 * Huang Eq. 13.25, at ν = 0.5:
 *
 *   d0 = 1.5 q a { 1 / (M_R sqrt(1 + (D/a · (E_p/M_R)^(1/3))²))
 *                + [1 − 1/sqrt(1 + (D/a)²)] / E_p }
 */
export function d0Odemark(q: number, a: number, D: number, MR: number, Ep: number): number {
  const term1 = 1 / (MR * Math.sqrt(1 + Math.pow((D / a) * Math.cbrt(Ep / MR), 2)));
  const term2 = (1 - 1 / Math.sqrt(1 + Math.pow(D / a, 2))) / Ep;
  return 1.5 * q * a * (term1 + term2);
}

/**
 * Effective modulus of everything above the subgrade, by inverting Eq. 13.25
 * for E_p. Monotone in E_p, so bisection is safe and needs no seed.
 *
 * @param d0 center deflection, already adjusted to 68°F (in)
 */
export function effectiveEp(
  d0: number, q: number, a: number, D: number, MR: number
): number | null {
  if (!(d0 > 0 && q > 0 && a > 0 && D > 0 && MR > 0)) return null;
  let lo = MR * 0.5, hi = MR * 2000;
  const f = (Ep: number) => d0Odemark(q, a, D, MR, Ep) - d0;
  if (f(lo) * f(hi) > 0) return null;   // the basin is outside the model's range
  for (let i = 0; i < 200; i++) {
    const mid = Math.sqrt(lo * hi);     // geometric bisection — Ep spans decades
    if (f(mid) > 0) lo = mid; else hi = mid;
  }
  return Math.sqrt(lo * hi);
}

/**
 * Effective structural number from the effective modulus — Huang Eq. 13.26.
 *
 *   SN_eff = 0.0045 · D · E_p^(1/3)
 *
 * The 0.0045 is not a fitted constant: it is 0.14/(30,000)^(1/3), the AASHO
 * Road Test crushed-stone base pinned to its layer coefficient.
 */
export const snEff = (D: number, Ep: number) => 0.0045 * D * Math.cbrt(Ep);

export interface AashtoNdtResult {
  mrBackcalculated: number;
  mrDesign: number;
  Ep: number | null;
  epOverMr: number | null;
  snEff: number | null;
  /** Minimum valid offset for the sensor used, by Eq. 13.24. */
  rMin: number | null;
  /** Whether the sensor actually used clears that minimum. */
  sensorFarEnough: boolean | null;
}

/**
 * The whole AASHTO 1993 NDT route, in the order the guide runs it.
 *
 * @param P    total plate load (lb)
 * @param a    plate radius (in)
 * @param d0   center deflection, temperature-adjusted (in)
 * @param dr   deflection at the outer sensor (in)
 * @param r    offset of that outer sensor (in)
 * @param D    total thickness above the subgrade (in)
 * @param C    design adjustment factor, ≤ 0.33
 */
export function aashtoNdt(
  P: number, a: number, d0: number, dr: number, r: number, D: number, C = 0.33
): AashtoNdtResult | null {
  if (!(P > 0 && a > 0 && d0 > 0 && dr > 0 && r > 0 && D > 0)) return null;
  const mrBack = subgradeMr(P, dr, r);
  const q = P / (Math.PI * a * a);
  const Ep = effectiveEp(d0, q, a, D, mrBack);
  const ratio = Ep === null ? null : Ep / mrBack;
  return {
    mrBackcalculated: mrBack,
    mrDesign: designMr(mrBack, C),
    Ep,
    epOverMr: ratio,
    snEff: Ep === null ? null : snEff(D, Ep),
    rMin: ratio === null ? null : minSensorOffset(a, D, ratio),
    sensorFarEnough: ratio === null ? null : r >= minSensorOffset(a, D, ratio),
  };
}

/* ──────────────── Layered-elastic backcalculation (route 2) ─────────────── */

export interface FitOptions {
  /** Lower bound on each modulus, same order as the layers. */
  lo?: number[];
  /** Upper bound on each modulus. */
  hi?: number[];
  /** Layers whose modulus is held fixed (index into `layers`). */
  fixed?: number[];
  maxIter?: number;
  /** Stop when the RMS relative error falls below this (percent). */
  tolPct?: number;
  cycles?: number;
}

export interface FitResult {
  /** Backcalculated moduli, in the layer order given. */
  E: number[];
  /** Computed basin at the fitted moduli. */
  computed: number[];
  /** RMS of the per-sensor relative error, percent. */
  rmsPct: number;
  /** Signed relative error at each sensor, percent. */
  errorsPct: number[];
  /** Largest absolute per-sensor relative error, percent. */
  maxErrPct: number;
  iterations: number;
  /**
   * Per-layer sensitivity: the RMS error, in percent, produced by moving that
   * layer's modulus ±20% from the fitted value with all others held. A small
   * number means the basin barely notices that layer — its backcalculated
   * modulus is close to arbitrary, which is exactly Huang's warning about
   * thin layers in §9.4.3.
   */
  sensitivity: number[];
  converged: boolean;
}

const rmsRel = (computed: number[], measured: number[]) => {
  let s = 0;
  for (let i = 0; i < measured.length; i++) {
    s += Math.pow((computed[i] - measured[i]) / measured[i], 2);
  }
  return 100 * Math.sqrt(s / measured.length);
};

/**
 * Backcalculate layer moduli by Levenberg-Marquardt on ln(E).
 *
 * Working in log space is what keeps the search stable: moduli span three
 * decades, they must stay positive, and the basin responds to *ratios* of
 * moduli rather than differences.
 *
 * @param layers   seed structure — thicknesses and Poisson ratios are fixed,
 *                 the moduli are the starting guess
 * @param measured measured deflections at `offsets`
 */
export function backcalculate(
  layers: Layer[], q: number, a: number, offsets: number[], measured: number[],
  opts: FitOptions = {}
): FitResult | null {
  const n = layers.length;
  if (n < 2 || offsets.length !== measured.length || measured.length < 2) return null;
  if (measured.some(d => !(d > 0))) return null;

  const cycles = opts.cycles ?? FIT_CYCLES;
  const maxIter = opts.maxIter ?? 40;
  const tolPct = opts.tolPct ?? 0.5;
  const fixed = new Set(opts.fixed ?? []);
  const free: number[] = [];
  for (let i = 0; i < n; i++) if (!fixed.has(i)) free.push(i);
  if (free.length === 0) return null;

  const lo = opts.lo ?? layers.map(() => 1000);
  const hi = opts.hi ?? layers.map(() => 5e6);

  let E = layers.map(l => l.E);
  const withE = (Es: number[]) => layers.map((l, i) => ({ ...l, E: Es[i] }));

  const evaluate = (Es: number[]) => basin(withE(Es), q, a, offsets, cycles);

  let computed = evaluate(E);
  if (!computed) return null;
  let err = rmsRel(computed, measured);
  let lambda = 1e-2;
  let iter = 0;
  let converged = err <= tolPct;

  for (; iter < maxIter && !converged; iter++) {
    // Residuals in log-deflection: the basin spans an order of magnitude
    // between the plate and the outer sensor, and a plain residual would let
    // d0 dominate the fit and leave the outer sensors — the subgrade — loose.
    const rvec = computed.map((c, i) => Math.log(measured[i]) - Math.log(c));

    // Numerical Jacobian ∂ln(w)/∂ln(E) by forward difference.
    const J: number[][] = [];      // [sensor][param]
    for (let s = 0; s < offsets.length; s++) J.push(new Array(free.length).fill(0));
    const step = 0.05;             // 5% in ln E
    let jacOk = true;
    for (let p = 0; p < free.length; p++) {
      const Ep2 = [...E];
      Ep2[free[p]] = E[free[p]] * Math.exp(step);
      const w2 = evaluate(Ep2);
      if (!w2) { jacOk = false; break; }
      for (let s = 0; s < offsets.length; s++) {
        J[s][p] = (Math.log(w2[s]) - Math.log(computed[s])) / step;
      }
    }
    if (!jacOk) break;

    // Solve (JᵀJ + λ diag(JᵀJ)) δ = Jᵀ r, retrying with more damping on a
    // step that does not improve the fit.
    let accepted = false;
    for (let attempt = 0; attempt < 8 && !accepted; attempt++) {
      const m = free.length;
      const A: number[][] = Array.from({ length: m }, () => new Array(m).fill(0));
      const b = new Array(m).fill(0);
      for (let i = 0; i < m; i++) {
        for (let j = 0; j < m; j++) {
          let s = 0;
          for (let k = 0; k < offsets.length; k++) s += J[k][i] * J[k][j];
          A[i][j] = s;
        }
        let s = 0;
        for (let k = 0; k < offsets.length; k++) s += J[k][i] * rvec[k];
        b[i] = s;
      }
      for (let i = 0; i < m; i++) A[i][i] *= 1 + lambda;

      const delta = solveSym(A, b);
      if (!delta) { lambda *= 10; continue; }

      const trial = [...E];
      for (let p = 0; p < m; p++) {
        // Cap each step at a factor of e^0.7 ≈ 2 so a bad Jacobian cannot
        // throw the search into a different decade.
        const d = Math.max(-0.7, Math.min(0.7, delta[p]));
        const i = free[p];
        trial[i] = Math.min(hi[i], Math.max(lo[i], E[i] * Math.exp(d)));
      }
      const wTrial = evaluate(trial);
      if (!wTrial) { lambda *= 10; continue; }
      const errTrial = rmsRel(wTrial, measured);
      if (errTrial < err) {
        E = trial; computed = wTrial; err = errTrial;
        lambda = Math.max(1e-8, lambda / 3);
        accepted = true;
      } else {
        lambda *= 10;
      }
    }
    if (!accepted) break;             // damping exhausted: this is the minimum
    if (err <= tolPct) converged = true;
  }

  // Per-layer sensitivity at the solution: how badly does the basin degrade
  // when this one modulus is wrong by 20%?
  const sensitivity = layers.map((_, i) => {
    if (fixed.has(i)) return 0;
    let worst = 0;
    for (const f of [0.8, 1.25]) {
      const probe = [...E];
      probe[i] = E[i] * f;
      const w = evaluate(probe);
      if (w) worst = Math.max(worst, rmsRel(w, measured));
    }
    return worst - err;
  });

  const errorsPct = computed.map((c, i) => (100 * (c - measured[i])) / measured[i]);

  return {
    E,
    computed,
    rmsPct: err,
    errorsPct,
    maxErrPct: Math.max(...errorsPct.map(Math.abs)),
    iterations: iter,
    sensitivity,
    converged,
  };
}

/** Gaussian elimination with partial pivoting for the small normal equations. */
function solveSym(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-300) return null;
    [M[col], M[piv]] = [M[piv], M[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      if (f === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  const x = new Array(n);
  for (let i = 0; i < n; i++) x[i] = M[i][n] / M[i][i];
  return x.every(Number.isFinite) ? x : null;
}

/* ───────────────────── Temperature adjustment (§9.4.2) ──────────────────── */

/**
 * A rough suggestion for the d0 temperature adjustment factor.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  THIS IS NOT AASHTO FIGURE 13.18. It is an exponential interpolation with
 *  the right shape and the right anchor (exactly 1.0 at the 68°F standard,
 *  growing with AC thickness because a thicker bound layer carries more of
 *  the basin). Treat it as a starting value only.
 *
 *  Any number that goes into a submitted design should be read off Figure
 *  13.18 (granular or asphalt-treated base) or Figure 13.19 (cement- or
 *  pozzolanic-treated base) and entered manually. The tool takes a manual
 *  override for exactly this reason.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Its teaching purpose is to make the *magnitude* of the seasonal correction
 * visible before a student goes to the chart — Huang §9.4.2 spends two pages
 * on why the time of day and the season change a deflection measurement, and
 * a number that moves as you type the temperature makes the point faster than
 * the prose does.
 */
export function temperatureFactor(tempF: number, hAc: number): number {
  const b = 0.0075 * Math.min(hAc, 12) ** 0.55;
  return Math.exp(-b * (tempF - 68));
}

/**
 * Is the layered-elastic inversion even determined?
 *
 * Backcalculating n free moduli from m sensors is a least-squares problem
 * with n unknowns and m equations. At m = n the fit can drive the residual to
 * zero through any of infinitely many modulus sets, and at m < n it certainly
 * can — in both cases a perfect basin match means nothing at all. Huang
 * §9.4.3 describes the symptom; this reports the cause before the student
 * reads a 0.00% RMS and believes it.
 */
export function isDetermined(sensors: number, freeModuli: number): boolean {
  return sensors > freeModuli;
}
