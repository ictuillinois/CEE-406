// N-layer elastic analysis of a pavement under a uniform circular load.
//
// Implements Huang (2004) Appendix B exactly:
//   B.3   stress function per layer, with constants A, B, C, D
//   B.4   stresses and displacements in terms of those constants
//   B.7   R = q·α ∫₀^∞ (R*/m) J₁(mα) dm — the Hankel inversion
//   B.9   surface boundary conditions (σz = -m·J₀, τrz = 0)
//   B.11  interface continuity for fully bonded layers
//   B.12  F_i = e^(-m(λ_i - λ_i₋₁)),  R_i = (E_i/E_i₊₁)((1+ν_i₊₁)/(1+ν_i))
// with A_n = C_n = 0 so the response vanishes at depth in the half-space.
//
// Lengths are normalized by H, the depth to the top of the lowest layer:
// λ = z/H, ρ = r/H, α = a/H. Every exponential is then of the form
// e^(-m·Δλ) with Δλ ≥ 0, so nothing overflows.
import { besselJ0, besselJ1, besselJ0Zero, besselJ1Zero } from './bessel.ts';

export interface Layer {
  /** Thickness. The last layer is the half-space and its thickness is ignored. */
  h: number;
  /** Elastic modulus, in the same force/length² units as the load pressure. */
  E: number;
  /** Poisson's ratio. */
  nu: number;
}

export interface Response {
  sigZ: number;   // vertical stress
  sigR: number;   // radial stress
  sigT: number;   // tangential stress
  tauRZ: number;  // shear stress
  w: number;      // vertical displacement
  u: number;      // radial displacement
  epsZ: number;   // vertical strain
  epsR: number;   // radial strain
  epsT: number;   // tangential strain
}

/** Solve A·x = b by Gaussian elimination with partial pivoting. */
function solve(A: number[][], b: number[]): number[] | null {
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
  return M.map((row, i) => row[n] / row[i][i] ?? 0).map((_, i) => M[i][n] / M[i][i]);
}

/**
 * Constants of integration A_i, B_i, C_i, D_i for one value of the Hankel
 * parameter m. Returns a flat array of 4n values (with A_n = C_n = 0).
 */
function constantsFor(m: number, lam: number[], nu: number[], E: number[]): number[] | null {
  const n = nu.length;
  // Unknown ordering: [A1,B1,C1,D1, ..., A_{n-1},...,D_{n-1}, B_n, D_n]
  const N = 4 * n - 2;
  const idx = (i: number, which: 0 | 1 | 2 | 3) =>
    i < n - 1 ? 4 * i + which : (which === 1 ? 4 * (n - 1) : which === 3 ? 4 * (n - 1) + 1 : -1);

  const A: number[][] = Array.from({ length: N }, () => new Array(N).fill(0));
  const b = new Array(N).fill(0);
  const put = (row: number, i: number, which: 0 | 1 | 2 | 3, v: number) => {
    const j = idx(i, which);
    if (j >= 0) A[row][j] += v;      // A_n and C_n are identically zero
  };

  const lam1 = lam[0];
  const e1 = Math.exp(-m * lam1);

  // ── B.9: surface, λ = 0 ──
  // σz: e^{-mλ1}A1 + B1 - (1-2ν1)e^{-mλ1}C1 + (1-2ν1)D1 = 1
  put(0, 0, 0, e1);
  put(0, 0, 1, 1);
  put(0, 0, 2, -(1 - 2 * nu[0]) * e1);
  put(0, 0, 3, 1 - 2 * nu[0]);
  b[0] = 1;
  // τrz: e^{-mλ1}A1 - B1 + 2ν1 e^{-mλ1}C1 + 2ν1 D1 = 0
  put(1, 0, 0, e1);
  put(1, 0, 1, -1);
  put(1, 0, 2, 2 * nu[0] * e1);
  put(1, 0, 3, 2 * nu[0]);
  b[1] = 0;

  // ── B.11: continuity at each interface λ_i, i = 0 .. n-2 (0-based) ──
  for (let i = 0; i < n - 1; i++) {
    const li = lam[i];
    const Fi = Math.exp(-m * (li - (i === 0 ? 0 : lam[i - 1])));
    const Fj = Math.exp(-m * (lam[i + 1] - li));   // F_{i+1}; for i+1 = n use λ_n = λ_{n-1}
    const Ri = (E[i] / E[i + 1]) * ((1 + nu[i + 1]) / (1 + nu[i]));
    const vi = nu[i], vj = nu[i + 1], ml = m * li;
    const r0 = 2 + 4 * i;

    // Left side: layer i.  Right side: layer i+1 (moved across with a minus).
    const L: number[][] = [
      [1, Fi, -(1 - 2 * vi - ml), (1 - 2 * vi + ml) * Fi],
      [1, -Fi, 2 * vi + ml, (2 * vi - ml) * Fi],
      [1, Fi, 1 + ml, -(1 - ml) * Fi],
      [1, -Fi, -(2 - 4 * vi - ml), -(2 - 4 * vi + ml) * Fi],
    ];
    const Rr: number[][] = [
      [Fj, 1, -(1 - 2 * vj - ml) * Fj, 1 - 2 * vj + ml],
      [Fj, -1, (2 * vj + ml) * Fj, 2 * vj - ml],
      [Ri * Fj, Ri, (1 + ml) * Ri * Fj, -(1 - ml) * Ri],
      [Ri * Fj, -Ri, -(2 - 4 * vj - ml) * Ri * Fj, -(2 - 4 * vj + ml) * Ri],
    ];

    for (let k = 0; k < 4; k++) {
      for (let w = 0 as 0 | 1 | 2 | 3; w < 4; w++) {
        put(r0 + k, i, w as 0 | 1 | 2 | 3, L[k][w]);
        put(r0 + k, i + 1, w as 0 | 1 | 2 | 3, -Rr[k][w]);
      }
      b[r0 + k] = 0;
    }
  }

  const x = solve(A, b);
  if (!x) return null;

  // Expand back to 4n values with A_n = C_n = 0.
  const out = new Array(4 * n).fill(0);
  for (let i = 0; i < n - 1; i++) for (let w = 0; w < 4; w++) out[4 * i + w] = x[4 * i + w];
  out[4 * (n - 1) + 1] = x[4 * (n - 1)];       // B_n
  out[4 * (n - 1) + 3] = x[4 * (n - 1) + 1];   // D_n
  return out;
}

/** Which layer contains normalized depth λ (returns a 0-based index). */
function layerAt(lam: number[], lambda: number): number {
  for (let i = 0; i < lam.length - 1; i++) if (lambda <= lam[i] + 1e-12) return i;
  return lam.length - 1;
}

/**
 * The starred responses of Eq. B.4 at (ρ, λ) for one m — the response to a
 * vertical load of −m·J₀(mρ) rather than to the actual circular load.
 */
function starred(
  m: number, rho: number, lambda: number,
  lam: number[], nu: number[], E: number[], K: number[]
) {
  const i = layerAt(lam, lambda);
  const A = K[4 * i], B = K[4 * i + 1], C = K[4 * i + 2], D = K[4 * i + 3];
  const li = lam[i];
  const liPrev = i === 0 ? 0 : lam[i - 1];
  const eUp = Math.exp(-m * (li - lambda));        // e^{-m(λ_i - λ)}
  const eDn = Math.exp(-m * (lambda - liPrev));    // e^{-m(λ - λ_{i-1})}
  const ml = m * lambda, v = nu[i];
  const J0 = besselJ0(m * rho);
  const J1 = besselJ1(m * rho);
  const J1r = rho === 0 ? m / 2 : J1 / rho;        // J1(mρ)/ρ → m/2 as ρ → 0

  const sigZ = -m * J0 * ((A - C * (1 - 2 * v - ml)) * eUp + (B + D * (1 - 2 * v + ml)) * eDn);

  const sigR =
    (m * J0 - J1r) * ((A + C * (1 + ml)) * eUp + (B - D * (1 - ml)) * eDn) +
    2 * v * m * J0 * (C * eUp - D * eDn);

  const sigT =
    J1r * ((A + C * (1 + ml)) * eUp + (B - D * (1 - ml)) * eDn) +
    2 * v * m * J0 * (C * eUp - D * eDn);

  const tauRZ = m * J1 * ((A + C * (2 * v + ml)) * eUp - (B - D * (2 * v - ml)) * eDn);

  const w = (-(1 + v) / E[i]) * J0 * ((A - C * (2 - 4 * v - ml)) * eUp - (B + D * (2 - 4 * v + ml)) * eDn);

  const u = ((1 + v) / E[i]) * J1 * ((A + C * ml) * eUp + (B - D * (1 - ml)) * eDn);

  return { sigZ, sigR, sigT, tauRZ, w, u };
}

/** 4-point Gauss-Legendre nodes and weights on [-1, 1]. */
const GL_X = [-0.8611363115940526, -0.3399810435848563, 0.3399810435848563, 0.8611363115940526];
const GL_W = [0.3478548451374538, 0.6521451548625461, 0.6521451548625461, 0.3478548451374538];

export interface LeaOptions {
  /** Integration cycles (intervals between Bessel zeros). */
  cycles?: number;
  /** Relative convergence tolerance on the accumulated integral. */
  tol?: number;
}

/**
 * Compute the response of a layered elastic system under a uniform circular
 * load, at radial offset r and depth z.
 *
 * @param layers  top to bottom; the last is the half-space
 * @param q       contact pressure
 * @param a       contact radius
 * @param r       radial offset from the load axis
 * @param z       depth below the surface
 */
export function leaResponse(
  layers: Layer[], q: number, a: number, r: number, z: number,
  opts: LeaOptions = {}
): Response | null {
  const n = layers.length;
  if (n < 2) return null;
  const cycles = opts.cycles ?? 60;
  const tol = opts.tol ?? 1e-10;

  // H = depth to the top of the lowest layer.
  let H = 0;
  for (let i = 0; i < n - 1; i++) H += layers[i].h;
  if (!(H > 0)) return null;

  // λ_i = cumulative depth / H. λ_{n-1} = 1, and λ_n is unused.
  const lam: number[] = [];
  let acc = 0;
  for (let i = 0; i < n - 1; i++) { acc += layers[i].h; lam.push(acc / H); }
  lam.push(1);   // λ_n placeholder so F_{i+1} is well defined at the last interface

  const nu = layers.map(l => l.nu);
  const E = layers.map(l => l.E);
  const alpha = a / H, rho = r / H, lambda = z / H;

  // Breakpoints: the union of the zeros of J1(mα) and J0(mρ), which is where
  // the integrand oscillates (Huang App. B, §B.2).
  const breaks: number[] = [0];
  for (let k = 1; k <= cycles; k++) {
    breaks.push(besselJ1Zero(k) / alpha);
    if (rho > 1e-9) breaks.push(besselJ0Zero(k) / rho);
  }
  breaks.sort((x, y) => x - y);

  // The first cycle is subdivided, as the text recommends, because the
  // integrand varies fastest there.
  const firstZero = besselJ1Zero(1) / alpha;
  const refined: number[] = [];
  for (let s = 0; s < 6; s++) refined.push((firstZero * s) / 6);
  const nodes = [...refined, ...breaks.filter(x => x > firstZero * (1 - 1e-12))];

  const acc6 = { sigZ: 0, sigR: 0, sigT: 0, tauRZ: 0, w: 0, u: 0 };
  let last = 0;

  for (let s = 0; s < nodes.length - 1; s++) {
    const lo = nodes[s], hi = nodes[s + 1];
    if (hi - lo < 1e-14) continue;
    const mid = 0.5 * (lo + hi), half = 0.5 * (hi - lo);
    let seg = 0;
    for (let g = 0; g < 4; g++) {
      const m = mid + half * GL_X[g];
      if (m <= 1e-12) continue;
      const K = constantsFor(m, lam, nu, E);
      if (!K) continue;
      const R = starred(m, rho, lambda, lam, nu, E, K);
      // B.7: R = q·α ∫ (R*/m) J1(mα) dm
      const f = (besselJ1(m * alpha) / m) * GL_W[g] * half;
      acc6.sigZ += R.sigZ * f;
      acc6.sigR += R.sigR * f;
      acc6.sigT += R.sigT * f;
      acc6.tauRZ += R.tauRZ * f;
      acc6.w += R.w * f;
      acc6.u += R.u * f;
      seg += Math.abs(R.sigZ * f);
    }
    // Stop once successive cycles stop contributing.
    if (s > 8 && seg < tol * Math.max(1e-30, Math.abs(acc6.sigZ))) { last = s; break; }
    last = s;
  }

  // Appendix B reports stresses tension-positive; the rest of this site (and
  // Huang's own Chapter 2 tables) uses compression positive, so the stresses
  // are negated. Displacements are already downward-positive in B.4e-f and
  // keep their sign; they also carry an extra H from the normalization.
  const scale = q * alpha;
  const sigZ = -scale * acc6.sigZ;
  const sigR = -scale * acc6.sigR;
  const sigT = -scale * acc6.sigT;
  const tauRZ = -scale * acc6.tauRZ;
  const w = scale * acc6.w * H;
  const u = scale * acc6.u * H;

  const i = layerAt(lam, lambda);
  const Ei = E[i], vi = nu[i];
  return {
    sigZ, sigR, sigT, tauRZ, w, u,
    epsZ: (sigZ - vi * (sigR + sigT)) / Ei,
    epsR: (sigR - vi * (sigZ + sigT)) / Ei,
    epsT: (sigT - vi * (sigZ + sigR)) / Ei,
  };
}

/**
 * Superpose the responses of several identical circular loads (dual wheels,
 * tandem axles). Valid because the system is linear elastic.
 *
 * @param wheels  centres of each load in the plan, relative to the point
 */
export function leaSuperpose(
  layers: Layer[], q: number, a: number,
  wheels: { x: number; y: number }[],
  point: { x: number; y: number; z: number },
  opts: LeaOptions = {}
): Response | null {
  const total: Response = {
    sigZ: 0, sigR: 0, sigT: 0, tauRZ: 0, w: 0, u: 0, epsZ: 0, epsR: 0, epsT: 0,
  };
  for (const wl of wheels) {
    const dr = Math.hypot(point.x - wl.x, point.y - wl.y);
    const R = leaResponse(layers, q, a, dr, point.z, opts);
    if (!R) return null;
    // Axisymmetric components add directly on the axis of each load; off-axis
    // the radial/tangential pair must be resolved into common axes first.
    total.sigZ += R.sigZ;
    total.w += R.w;
    if (dr < 1e-9) {
      total.sigR += R.sigR;
      total.sigT += R.sigT;
    } else {
      const c = (point.x - wl.x) / dr, s = (point.y - wl.y) / dr;
      total.sigR += R.sigR * c * c + R.sigT * s * s;
      total.sigT += R.sigR * s * s + R.sigT * c * c;
    }
    total.tauRZ += R.tauRZ;
    total.u += R.u;
  }
  // Recompute strains from the superposed stresses in the layer containing z.
  let H = 0;
  for (let i = 0; i < layers.length - 1; i++) H += layers[i].h;
  const lam: number[] = [];
  let acc = 0;
  for (let i = 0; i < layers.length - 1; i++) { acc += layers[i].h; lam.push(acc / H); }
  lam.push(1);
  const i = layerAt(lam, point.z / H);
  const Ei = layers[i].E, vi = layers[i].nu;
  total.epsZ = (total.sigZ - vi * (total.sigR + total.sigT)) / Ei;
  total.epsR = (total.sigR - vi * (total.sigZ + total.sigT)) / Ei;
  total.epsT = (total.sigT - vi * (total.sigZ + total.sigR)) / Ei;
  return total;
}
