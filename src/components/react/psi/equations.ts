// Serviceability, roughness and skid resistance — pure functions, no React.
//
// Huang (2004) §9.2 (PSI) and §9.3 (surface friction). Pinned to Eqs. 9.14
// and 9.15 and to the printed answers of Problems 9.2 and 9.4.
//
// The PSI equations are the hinge of the whole empirical tradition: they are
// what let a panel of people riding in cars be replaced by a profilometer, and
// therefore what made the AASHO Road Test — and every design equation
// descended from it — possible. They are also a multiple regression fitted to
// 74 sections, which is worth remembering every time a design hangs on a
// terminal serviceability of 2.5 rather than 2.4.
//
// US customary: in, ft, mph.

/* ─────────────────── The AASHO PSI equations (§9.2.1) ──────────────────── */

/**
 * Present serviceability index for FLEXIBLE pavements — Huang Eq. 9.14.
 *
 *   PSI = 5.03 − 1.91 log(1 + SV) − 1.38 RD² − 0.01 √(C + P)
 *
 * @param sv slope variance, in units of 10⁻⁶ as the Road Test reported it
 * @param rd mean rut depth, in
 * @param cp cracking + patching, ft or ft² per 1000 ft²
 */
export const psiFlexible = (sv: number, rd: number, cp: number) =>
  5.03 - 1.91 * Math.log10(1 + sv) - 1.38 * rd * rd - 0.01 * Math.sqrt(Math.max(0, cp));

/**
 * Present serviceability index for RIGID pavements — Huang Eq. 9.15.
 *
 *   PSI = 5.41 − 1.71 log(1 + SV) − 0.09 √(C + P)
 *
 * There is no rut depth term: concrete does not rut, so the transverse
 * profile carries no information the longitudinal one does not already have.
 */
export const psiRigid = (sv: number, cp: number) =>
  5.41 - 1.71 * Math.log10(1 + sv) - 0.09 * Math.sqrt(Math.max(0, cp));

/** The three linearising transformations of Eqs. 9.3-9.5. */
export const R1 = (sv: number) => Math.log10(1 + sv);
export const R2 = (rd: number) => rd * rd;
export const D1 = (cp: number) => Math.sqrt(Math.max(0, cp));

/**
 * Slope variance from a set of sampled slopes — the definition behind SV.
 *
 *   SV = Σ(S − S̄)² / (n − 1)
 *
 * The profilometer samples the slope between two points 9 in apart at 1 ft
 * intervals; SV is the variance of those slopes, averaged over both
 * wheelpaths.
 */
export function slopeVariance(slopes: number[]): number {
  const n = slopes.length;
  if (n < 2) return NaN;
  const mean = slopes.reduce((s, v) => s + v, 0) / n;
  return slopes.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
}

/* ───────────────── Fitting your own PSI equation (§9.2.1) ──────────────── */

export interface PsiObservation {
  sv: number;
  rd: number;
  cp: number;
  /** The panel's mean rating for this section. */
  psr: number;
}

export interface PsiFit {
  /** PSI = a0 + a1·log(1+SV) + a2·RD² + b1·√(C+P) */
  a0: number;
  a1: number;
  a2: number;
  b1: number;
  r2: number;
  /** Predicted PSI for each observation, in the order supplied. */
  predicted: number[];
  /** RMS residual against the panel ratings. */
  rms: number;
}

/**
 * Fit the PSI equation to panel ratings by least squares — Huang Eqs. 9.8-9.9.
 *
 * This is what Carey and Irick did to 74 flexible sections, and what Problem
 * 9.2 asks a student to do to five. Doing it to five is the point: the
 * coefficients come out wildly different from the published ones, which is
 * the most honest possible introduction to what a regression coefficient is
 * worth.
 *
 * Pass `includeRut = false` for rigid pavements, where Eq. 9.15 has no RD term.
 */
export function fitPsi(obs: PsiObservation[], includeRut = true): PsiFit | null {
  const nTerms = includeRut ? 4 : 3;
  if (obs.length < nTerms) return null;

  // Design matrix: [1, R1, R2, D1] or [1, R1, D1].
  const X = obs.map(o => (includeRut
    ? [1, R1(o.sv), R2(o.rd), D1(o.cp)]
    : [1, R1(o.sv), D1(o.cp)]));
  const y = obs.map(o => o.psr);

  // Normal equations XᵀX b = Xᵀy.
  const A: number[][] = Array.from({ length: nTerms }, () => new Array(nTerms).fill(0));
  const rhs = new Array(nTerms).fill(0);
  for (let i = 0; i < nTerms; i++) {
    for (let j = 0; j < nTerms; j++) {
      A[i][j] = X.reduce((s, row) => s + row[i] * row[j], 0);
    }
    rhs[i] = X.reduce((s, row, k) => s + row[i] * y[k], 0);
  }

  const b = solve(A, rhs);
  if (!b) return null;

  const predicted = X.map(row => row.reduce((s, v, i) => s + v * b[i], 0));
  const meanY = y.reduce((s, v) => s + v, 0) / y.length;
  const ssRes = y.reduce((s, v, i) => s + (v - predicted[i]) ** 2, 0);
  const ssTot = y.reduce((s, v) => s + (v - meanY) ** 2, 0);

  return {
    a0: b[0],
    a1: b[1],
    a2: includeRut ? b[2] : 0,
    b1: includeRut ? b[3] : b[2],
    r2: ssTot > 0 ? 1 - ssRes / ssTot : 1,
    predicted,
    rms: Math.sqrt(ssRes / y.length),
  };
}

/** Evaluate a fitted PSI equation. */
export const psiFromFit = (fit: PsiFit, sv: number, rd: number, cp: number) =>
  fit.a0 + fit.a1 * R1(sv) + fit.a2 * R2(rd) + fit.b1 * D1(cp);

/** Gauss-Jordan solve for the small normal equations. */
function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
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
  // M[i][i], never row[i][i] — the latter indexes into a number.
  const out = M.map((_, i) => M[i][n] / M[i][i]);
  return out.every(Number.isFinite) ? out : null;
}

/* ──────────────────── Skid resistance (Huang §9.3) ─────────────────────── */

/**
 * Mean texture depth from a sand- or glass-bead patch.
 *
 *   MTD = volume / patch area
 *
 * @param volume spread volume, in³
 * @param diameter diameter of the resulting patch, in
 */
export const meanTextureDepth = (volume: number, diameter: number) =>
  diameter > 0 ? volume / (Math.PI * (diameter / 2) ** 2) : NaN;

/**
 * Percent normalized gradient from mean texture depth — Huang Eq. 9.33.
 *
 *   PNG = 0.157 (MTD)^(−0.47)     [h/mile, MTD in inches]
 *
 * PNG is the macrotexture half of skid resistance: how fast friction falls
 * away as you speed up. A coarse surface has a low PNG and holds its friction.
 */
export const pngFromTexture = (mtd: number) =>
  mtd > 0 ? 0.157 * Math.pow(mtd, -0.47) : NaN;

/** Zero-speed skid number from the British Pendulum Number — Huang Eq. 9.32. */
export const sn0FromBpn = (bpn: number) => 1.32 * bpn - 34.9;

/**
 * Skid number at speed — Huang Eqs. 9.31 and 9.34.
 *
 *   log(SN) = log(SN₀) − 0.00434 (PNG) V
 *
 * SN₀ is microtexture (what the surface feels like at rest); PNG is
 * macrotexture (how well it drains and stays gripping at speed). A surface can
 * be excellent at 20 mph and dangerous at 60 with the same SN₀.
 */
export const skidNumber = (sn0: number, png: number, V: number) =>
  Math.pow(10, Math.log10(sn0) - 0.00434 * png * V);

/**
 * Back out SN₀ from a skid number measured at one speed, so the curve can be
 * extrapolated to others. This is what Problem 9.4 asks for.
 */
export const sn0FromMeasurement = (sn: number, png: number, V: number) =>
  Math.pow(10, Math.log10(sn) + 0.00434 * png * V);

/**
 * Skid number at a new speed, given one measurement and the texture depth.
 * The composition of the two functions above, which is the whole of Problem 9.4.
 */
export function skidAtSpeed(snKnown: number, vKnown: number, mtd: number, vWanted: number) {
  const png = pngFromTexture(mtd);
  if (!Number.isFinite(png)) return NaN;
  return skidNumber(sn0FromMeasurement(snKnown, png, vKnown), png, vWanted);
}
