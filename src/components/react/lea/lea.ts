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
import { oneLayerResponse, principalOfTensor } from './oneLayer.ts';

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
  // Note: an earlier form of this line ran a first .map() using row[i][i],
  // which indexes into a number and yields undefined. Its result was
  // immediately discarded by the second .map(), so the solver was correct —
  // but the same mistake, copied elsewhere, silently broke a fitter. Removed.
  return M.map((_, i) => M[i][n] / M[i][i]);
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

/**
 * The same starred responses for a HALF-SPACE made of the top layer's
 * material, at the same (ρ, λ) and m.
 *
 * This is the n = 1 specialization of the block above: the response has to
 * vanish at depth, so A = C = 0, and the surface conditions of Eq. B.9 leave
 * D = 1 and B = 2ν. It is subtracted from the layered integrand and added
 * back in closed form afterwards — see the note in leaResponse.
 */
function starredHalfSpace(m: number, rho: number, lambda: number, v: number, E1: number) {
  const B = 2 * v, D = 1;
  const e = Math.exp(-m * lambda);
  const ml = m * lambda;
  const J0 = besselJ0(m * rho);
  const J1 = besselJ1(m * rho);
  const J1r = rho === 0 ? m / 2 : J1 / rho;

  return {
    sigZ: -m * J0 * (B + D * (1 - 2 * v + ml)) * e,
    sigR: (m * J0 - J1r) * (B - D * (1 - ml)) * e - 2 * v * m * J0 * D * e,
    sigT: J1r * (B - D * (1 - ml)) * e - 2 * v * m * J0 * D * e,
    tauRZ: -m * J1 * (B - D * (2 * v - ml)) * e,
    w: ((1 + v) / E1) * J0 * (B + D * (2 - 4 * v + ml)) * e,
    u: ((1 + v) / E1) * J1 * (B - D * (1 - ml)) * e,
  };
}

/** 8-point Gauss-Legendre nodes and weights on [-1, 1]. */
const GL_X = [
  -0.9602898564975363, -0.7966664774136267, -0.5255324099163290, -0.1834346424956498,
  0.1834346424956498, 0.5255324099163290, 0.7966664774136267, 0.9602898564975363,
];
const GL_W = [
  0.1012285362903763, 0.2223810344533745, 0.3137066458778873, 0.3626837833783620,
  0.3626837833783620, 0.3137066458778873, 0.2223810344533745, 0.1012285362903763,
];

export interface LeaOptions {
  /**
   * Upper limit of the Hankel variable m, overriding the automatic range.
   * Rarely wanted — the default is derived from the exponential damping at
   * the evaluation depth, which is the thing that actually decides it.
   */
  mMax?: number;
  /** Panel budget. Bounds the cost at points that need a very long range. */
  budget?: number;
  /** Relative tail tolerance: stop once a run of panels stops contributing. */
  tol?: number;
  /** Deprecated. Kept so old call sites still type-check; ignored. */
  cycles?: number;
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
  const tol = opts.tol ?? 1e-12;

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

  /* ── How far the quadrature has to run, and where its panels go ─────────
   *
   * Both of these used to be decided by one `cycles` count applied to both
   * Bessel families, and that is wrong in a way that does not announce
   * itself. The zeros of J1(mα) arrive every π/α and those of J0(mρ) every
   * π/ρ, so a fixed count of each reaches a DIFFERENT m. Past the nearer of
   * the two limits, panels sized by one family straddle several oscillations
   * of the other, and 4-point Gauss-Legendre integrates the average of a sign
   * change rather than the function. Far from the load, where the answer is
   * small and the cancellation is nearly total, the error swamps it: at
   * r/a = 24 and z/a = 5.6 this returned σz = -3.3e-3 where the true value is
   * +2.9e-5 — two orders of magnitude out, with the wrong sign. Superposing
   * a tandem axle at a realistic 60-in spacing sampled exactly that region,
   * so the error reached the answer.
   *
   * Both families now run out to the same M. M itself comes from the
   * damping: every term in B.4 carries e^(-m·Δλ) with Δλ ≥ 0, so the tail
   * past M is about e^(-Mλ)/M and Mλ ≈ 18 puts it near 1e-8. A surface point
   * has no damping at all and falls back to the budget.
   */
  const spacingRate = alpha / Math.PI + (rho > 1e-9 ? (2 * rho) / Math.PI : 0);
  const budget = opts.budget ?? 4000;
  // The floor only keeps the range from collapsing at very deep points; the
  // damping sets it everywhere else. A convergence sweep at the bottom of a
  // layer with α = 0.18 is exact to 1e-13 by m = 30, where a floor of 6π/α
  // would have integrated to 105 for nothing.
  const floorM = 6 / alpha;
  /* The integrand is the DIFFERENCE from a half-space of the top layer's
     material (see below), and that difference is a reflection off the first
     interface, so it decays like e^(-m·λ1) even when the point itself is on
     the surface and has no damping of its own. λ1 therefore sets the range
     whenever the point is shallower than it. Without the subtraction a
     surface point ran to the panel budget every time — Figure 2.17 alone
     took 53 seconds to draw. */
  const decay = Math.max(lambda, lam[0], 1e-9);
  const mMax = opts.mMax ?? Math.min(
    Math.max(floorM, 18 / decay),
    Math.max(floorM, budget / Math.max(spacingRate, 1e-12))
  );

  const brk = new Set<number>();
  for (let k = 1; ; k++) {
    const zk = besselJ1Zero(k) / alpha;
    if (zk > mMax) break;
    brk.add(zk);
  }
  if (rho > 1e-9) {
    for (let k = 1; ; k++) {
      const z0 = besselJ0Zero(k) / rho;
      const z1 = besselJ1Zero(k) / rho;
      if (z0 > mMax && z1 > mMax) break;
      if (z0 <= mMax) brk.add(z0);
      if (z1 <= mMax) brk.add(z1);
    }
  }
  brk.add(mMax);
  const sorted = [...brk].sort((x, y) => x - y);

  // The first cycle is subdivided, as the text recommends, because the
  // integrand varies fastest there.
  const nodes: number[] = [];
  for (let s = 0; s < 8; s++) nodes.push((sorted[0] * s) / 8);
  nodes.push(...sorted);

  const acc6 = { sigZ: 0, sigR: 0, sigT: 0, tauRZ: 0, w: 0, u: 0 };
  let peak = 0;      // largest single-panel contribution seen, any component
  let quiet = 0;     // consecutive panels that contributed nothing measurable

  for (let s = 0; s < nodes.length - 1; s++) {
    const lo = nodes[s], hi = nodes[s + 1];
    if (hi - lo < 1e-14) continue;
    const mid = 0.5 * (lo + hi), half = 0.5 * (hi - lo);
    let seg = 0;
    for (let g = 0; g < GL_X.length; g++) {
      const m = mid + half * GL_X[g];
      if (m <= 1e-12) continue;
      const K = constantsFor(m, lam, nu, E);
      if (!K) continue;
      const R = starred(m, rho, lambda, lam, nu, E, K);
      const P = starredHalfSpace(m, rho, lambda, nu[0], E[0]);
      // B.7: R = q·α ∫ (R*/m) J1(mα) dm, integrated on R* - P*.
      const f = (besselJ1(m * alpha) / m) * GL_W[g] * half;
      const dZ = (R.sigZ - P.sigZ) * f;
      const dR = (R.sigR - P.sigR) * f;
      const dT = (R.sigT - P.sigT) * f;
      const dS = (R.tauRZ - P.tauRZ) * f;
      acc6.sigZ += dZ;
      acc6.sigR += dR;
      acc6.sigT += dT;
      acc6.tauRZ += dS;
      acc6.w += (R.w - P.w) * f;
      acc6.u += (R.u - P.u) * f;
      seg = Math.max(seg, Math.abs(dZ), Math.abs(dR), Math.abs(dT), Math.abs(dS));
    }
    // Stop only once a RUN of panels has stopped contributing, measured
    // against the largest contribution seen rather than against a running
    // total that may be cancelling to near zero.
    peak = Math.max(peak, seg);
    quiet = seg < tol * peak ? quiet + 1 : 0;
    if (quiet >= 12) break;
  }

  /* ── Putting the half-space back ────────────────────────────────────────
   * The loop integrated (layered - half-space), so the half-space itself has
   * to be added back. oneLayer.ts supplies it in closed form — including at
   * the surface, where the raw integrals converge only conditionally and the
   * quadrature has nothing to converge to. The result is identical to
   * integrating the layered response directly, to the last digit either way
   * can resolve; what changes is that the integrand now decays.
   *
   * Appendix B reports stresses tension-positive; the rest of this site (and
   * Huang's own Chapter 2 tables) uses compression positive, so the stresses
   * are negated. Displacements are already downward-positive in B.4e-f and
   * keep their sign; they also carry an extra H from the normalization.
   */
  const base = oneLayerResponse(r, z, q, a, E[0], nu[0]);
  if (!base) return null;
  const scale = q * alpha;
  const sigZ = -scale * acc6.sigZ + base.sigZ;
  const sigR = -scale * acc6.sigR + base.sigR;
  const sigT = -scale * acc6.sigT + base.sigT;
  const tauRZ = -scale * acc6.tauRZ + base.tauRZ;
  const w = scale * acc6.w * H + base.w;
  const u = scale * acc6.u * H + base.u;

  const i = layerAt(lam, lambda);
  const Ei = E[i], vi = nu[i];
  return {
    sigZ, sigR, sigT, tauRZ, w, u,
    epsZ: (sigZ - vi * (sigR + sigT)) / Ei,
    epsR: (sigR - vi * (sigZ + sigT)) / Ei,
    epsT: (sigT - vi * (sigZ + sigR)) / Ei,
  };
}

/** A superposed state, in the Cartesian plan frame rather than in (r, t). */
export interface SuperposedResponse {
  /** Normal stresses on the plan axes and on z. Compression positive. */
  sigX: number; sigY: number; sigZ: number;
  /** Shear stresses in the same frame. */
  tauXY: number; tauXZ: number; tauYZ: number;
  /** Vertical displacement, positive downward. */
  w: number;
  /** Principal stresses, σ1 ≥ σ2 ≥ σ3. */
  sig: [number, number, number];
  /** Principal strains, in the same order as `sig`. */
  eps: [number, number, number];
  /** Cartesian strains, for reading a horizontal tension off a known axis. */
  epsX: number; epsY: number; epsZ: number;
  /**
   * The largest tensile strain at the point, as a POSITIVE magnitude — the
   * "overall principal strain based on all six components" of Huang §2.2.1.
   * Zero if the point is in triaxial compression.
   */
  tensile: number;
}

/**
 * Superpose several identical circular loads — dual wheels, tandem axles.
 * Valid because the system is linear elastic.
 *
 * Each load's own (r, t) axes point in a different direction, so the axisym-
 * metric components are rotated into one common plan frame BEFORE they are
 * added. An earlier version added σr to σr and τrz to τrz regardless of
 * direction, which is only correct when every load sits on the same radius
 * through the point; for a dual it silently mixed the radial stress of one
 * wheel with the tangential of the other and dropped the in-plane shear
 * entirely, so no principal state could be recovered from it.
 *
 * @param wheels centers of each load in plan
 * @param point  where to evaluate, in the same plan coordinates
 */
export function leaSuperpose(
  layers: Layer[], q: number, a: number,
  wheels: { x: number; y: number }[],
  point: { x: number; y: number; z: number },
  opts: LeaOptions = {}
): SuperposedResponse | null {
  let sigX = 0, sigY = 0, sigZ = 0, tauXY = 0, tauXZ = 0, tauYZ = 0, w = 0;

  for (const wl of wheels) {
    const dx = point.x - wl.x, dy = point.y - wl.y;
    const dr = Math.hypot(dx, dy);
    const R = leaResponse(layers, q, a, dr, point.z, opts);
    if (!R) return null;
    sigZ += R.sigZ;
    w += R.w;
    if (dr < 1e-9) {
      // On this load's own axis σr = σt and τrz = 0, so the rotation is moot.
      sigX += R.sigR;
      sigY += R.sigT;
    } else {
      const c = dx / dr, s = dy / dr;
      sigX += R.sigR * c * c + R.sigT * s * s;
      sigY += R.sigR * s * s + R.sigT * c * c;
      tauXY += (R.sigR - R.sigT) * c * s;
      tauXZ += R.tauRZ * c;
      tauYZ += R.tauRZ * s;
    }
  }

  // Strains come from the SUPERPOSED stresses, in the layer holding the point.
  let H = 0;
  for (let i = 0; i < layers.length - 1; i++) H += layers[i].h;
  const lam: number[] = [];
  let acc = 0;
  for (let i = 0; i < layers.length - 1; i++) { acc += layers[i].h; lam.push(acc / H); }
  lam.push(1);
  const i = layerAt(lam, point.z / H);
  const E = layers[i].E, nu = layers[i].nu;

  const sig = principalOfTensor(sigX, sigY, sigZ, tauXY, tauXZ, tauYZ);
  const bulk = sig[0] + sig[1] + sig[2];
  const eps = sig.map(v => (v - nu * (bulk - v)) / E) as [number, number, number];

  return {
    sigX, sigY, sigZ, tauXY, tauXZ, tauYZ, w,
    sig, eps,
    epsX: (sigX - nu * (sigY + sigZ)) / E,
    epsY: (sigY - nu * (sigX + sigZ)) / E,
    epsZ: (sigZ - nu * (sigX + sigY)) / E,
    // Compression positive, so tension is the most NEGATIVE principal strain.
    tensile: Math.max(0, -Math.min(eps[0], eps[1], eps[2])),
  };
}
