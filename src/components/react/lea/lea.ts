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

/* ── The linear system, and why it is written like this ──────────────────
 *
 * Every Gauss node of every panel of every Hankel integral needs the 4n − 2
 * constants of integration at that m, and one chart is a few hundred
 * thousand of them. Profiled, this block was 77% of the running time of the
 * whole "Solutions by chart" module — and most of that was not arithmetic.
 * It was a fresh n×n matrix of JS arrays, a fresh augmented copy of it, an
 * object per coefficient write and a closure per index lookup, thirty
 * thousand times for one point of one curve. The garbage collector alone
 * took 5%.
 *
 * So the matrix is assembled in place in a flat Float64Array that is reused
 * across calls, and the elimination is an LU factorization with partial
 * pivoting followed by back substitution — a third of the flops of the
 * Gauss–Jordan sweep it replaces, which was eliminating above the diagonal
 * as well as below only to divide the result out again.
 *
 * None of the mathematics changed. Appendix B's equations are written out
 * below exactly as before; `lea.test.mjs`, `twoLayer.test.mjs`,
 * `threeLayer.test.mjs` and `charts.test.mjs` pin the answers, and a direct
 * sweep of both implementations over the charts' whole domain agrees to
 * better than 1e-12 relative.
 *
 * The buffers are module-level and therefore NOT reentrant. That is safe
 * here and would not be anywhere else: the only caller is the quadrature
 * loop in leaResponse, which reads each result before asking for the next,
 * and nothing in this file is async. Do not export `constantsFor`.
 */
let SCRATCH_N = 0;
let MAT = new Float64Array(0);      // N × (N+1), row-major, augmented
let XSOL = new Float64Array(0);     // the N unknowns, in solve order
let KOUT = new Float64Array(0);     // expanded to 4n, with A_n = C_n = 0
const LBLK = new Float64Array(16);  // one interface's 4×4 left block
const RBLK = new Float64Array(16);  // ...and its right block

function ensureScratch(N: number, n: number): void {
  if (N > SCRATCH_N) {
    SCRATCH_N = N;
    MAT = new Float64Array(N * (N + 1));
    XSOL = new Float64Array(N);
  }
  if (KOUT.length < 4 * n) KOUT = new Float64Array(4 * n);
}

/**
 * Constants of integration A_i, B_i, C_i, D_i for one value of the Hankel
 * parameter m, as a flat array of 4n values (with A_n = C_n = 0).
 *
 * `Rint[i]` is Eq. B.12's R_i for interface i — it depends only on the
 * materials, so leaResponse computes it once rather than once per node.
 *
 * The returned array is a SHARED buffer, valid only until the next call.
 */
function constantsFor(
  m: number, lam: number[], nu: number[], E: number[], Rint: number[]
): Float64Array | null {
  const n = nu.length;
  // Unknown ordering: [A1,B1,C1,D1, ..., A_{n-1},...,D_{n-1}, B_n, D_n]
  const N = 4 * n - 2;
  const W = N + 1;
  const last = n - 1;
  ensureScratch(N, n);
  const M = MAT;
  M.fill(0, 0, N * W);

  // Column of unknown `which` of layer i, or −1 where the unknown is
  // identically zero: A_n and C_n, which the half-space kills.
  const colOf = (i: number, which: number) =>
    (i < last ? 4 * i + which : which === 1 ? 4 * last : which === 3 ? 4 * last + 1 : -1);

  const e1 = Math.exp(-m * lam[0]);
  const v0 = nu[0];

  // ── B.9: surface, λ = 0 ──
  // σz: e^{-mλ1}A1 + B1 - (1-2ν1)e^{-mλ1}C1 + (1-2ν1)D1 = 1
  M[0] = e1;
  M[1] = 1;
  M[2] = -(1 - 2 * v0) * e1;
  M[3] = 1 - 2 * v0;
  M[N] = 1;                                    // right-hand side of row 0
  // τrz: e^{-mλ1}A1 - B1 + 2ν1 e^{-mλ1}C1 + 2ν1 D1 = 0
  M[W] = e1;
  M[W + 1] = -1;
  M[W + 2] = 2 * v0 * e1;
  M[W + 3] = 2 * v0;

  // ── B.11: continuity at each interface λ_i, i = 0 .. n-2 (0-based) ──
  for (let i = 0; i < last; i++) {
    const li = lam[i];
    const Fi = Math.exp(-m * (li - (i === 0 ? 0 : lam[i - 1])));
    const Fj = Math.exp(-m * (lam[i + 1] - li));   // F_{i+1}; for i+1 = n use λ_n = λ_{n-1}
    const Ri = Rint[i];
    const vi = nu[i], vj = nu[i + 1], ml = m * li;
    const r0 = 2 + 4 * i;

    // Left side: layer i.  Right side: layer i+1 (moved across with a minus).
    // Written out rather than built as arrays of arrays: these eight rows
    // are the inner loop of the whole module.
    const l00 = 1, l01 = Fi, l02 = -(1 - 2 * vi - ml), l03 = (1 - 2 * vi + ml) * Fi;
    const l10 = 1, l11 = -Fi, l12 = 2 * vi + ml, l13 = (2 * vi - ml) * Fi;
    const l20 = 1, l21 = Fi, l22 = 1 + ml, l23 = -(1 - ml) * Fi;
    const l30 = 1, l31 = -Fi, l32 = -(2 - 4 * vi - ml), l33 = -(2 - 4 * vi + ml) * Fi;

    const r00 = Fj, r01 = 1, r02 = -(1 - 2 * vj - ml) * Fj, r03 = 1 - 2 * vj + ml;
    const r10 = Fj, r11 = -1, r12 = (2 * vj + ml) * Fj, r13 = 2 * vj - ml;
    const r20 = Ri * Fj, r21 = Ri, r22 = (1 + ml) * Ri * Fj, r23 = -(1 - ml) * Ri;
    const r30 = Ri * Fj, r31 = -Ri, r32 = -(2 - 4 * vj - ml) * Ri * Fj,
      r33 = -(2 - 4 * vj + ml) * Ri;

    const L = LBLK, R = RBLK;
    L[0] = l00; L[1] = l01; L[2] = l02; L[3] = l03;
    L[4] = l10; L[5] = l11; L[6] = l12; L[7] = l13;
    L[8] = l20; L[9] = l21; L[10] = l22; L[11] = l23;
    L[12] = l30; L[13] = l31; L[14] = l32; L[15] = l33;
    R[0] = r00; R[1] = r01; R[2] = r02; R[3] = r03;
    R[4] = r10; R[5] = r11; R[6] = r12; R[7] = r13;
    R[8] = r20; R[9] = r21; R[10] = r22; R[11] = r23;
    R[12] = r30; R[13] = r31; R[14] = r32; R[15] = r33;

    for (let k = 0; k < 4; k++) {
      const row = (r0 + k) * W;
      for (let w = 0; w < 4; w++) {
        const jl = colOf(i, w);
        if (jl >= 0) M[row + jl] += L[4 * k + w];
        const jr = colOf(i + 1, w);
        if (jr >= 0) M[row + jr] -= R[4 * k + w];
      }
    }
  }

  // ── LU with partial pivoting, in place on the augmented matrix ──
  for (let col = 0; col < N; col++) {
    let piv = col, best = Math.abs(M[col * W + col]);
    for (let r = col + 1; r < N; r++) {
      const v = Math.abs(M[r * W + col]);
      if (v > best) { best = v; piv = r; }
    }
    if (best < 1e-300) return null;
    if (piv !== col) {
      const a = col * W, b = piv * W;
      for (let c = col; c < W; c++) {
        const t = M[a + c]; M[a + c] = M[b + c]; M[b + c] = t;
      }
    }
    const d = M[col * W + col];
    for (let r = col + 1; r < N; r++) {
      const rw = r * W;
      const f = M[rw + col] / d;
      if (f === 0) continue;
      M[rw + col] = 0;
      const cw = col * W;
      for (let c = col + 1; c < W; c++) M[rw + c] -= f * M[cw + c];
    }
  }

  const x = XSOL;
  for (let i = N - 1; i >= 0; i--) {
    const rw = i * W;
    let s = M[rw + N];
    for (let c = i + 1; c < N; c++) s -= M[rw + c] * x[c];
    x[i] = s / M[rw + i];
  }

  // Expand back to 4n values with A_n = C_n = 0.
  const out = KOUT;
  out.fill(0, 0, 4 * n);
  for (let i = 0; i < last; i++) for (let w = 0; w < 4; w++) out[4 * i + w] = x[4 * i + w];
  out[4 * last + 1] = x[4 * last];       // B_n
  out[4 * last + 3] = x[4 * last + 1];   // D_n
  return out;
}

/** Which layer contains normalized depth λ (returns a 0-based index). */
function layerAt(lam: number[], lambda: number): number {
  for (let i = 0; i < lam.length - 1; i++) if (lambda <= lam[i] + 1e-12) return i;
  return lam.length - 1;
}

/* Six components, written into a caller-owned buffer rather than returned as
   an object. Two objects per Gauss node is a quarter of a million of them
   for one point of a heavy chart, and they exist only to be subtracted from
   each other on the next line. Order: σz, σr, σt, τrz, w, u. */
const ST_LAYERED = new Float64Array(6);
const ST_HALF = new Float64Array(6);

/**
 * The starred responses of Eq. B.4 at (ρ, λ) for one m — the response to a
 * vertical load of −m·J₀(mρ) rather than to the actual circular load.
 *
 * J0 and J1 of mρ are passed in because the half-space form below needs the
 * same two, and a Bessel evaluation is not free.
 */
function starred(
  m: number, rho: number, lambda: number,
  lam: number[], nu: number[], E: number[], K: Float64Array,
  J0: number, J1: number, out: Float64Array
): void {
  const i = layerAt(lam, lambda);
  const A = K[4 * i], B = K[4 * i + 1], C = K[4 * i + 2], D = K[4 * i + 3];
  const li = lam[i];
  const liPrev = i === 0 ? 0 : lam[i - 1];
  const eUp = Math.exp(-m * (li - lambda));        // e^{-m(λ_i - λ)}
  const eDn = Math.exp(-m * (lambda - liPrev));    // e^{-m(λ - λ_{i-1})}
  const ml = m * lambda, v = nu[i];
  const J1r = rho === 0 ? m / 2 : J1 / rho;        // J1(mρ)/ρ → m/2 as ρ → 0

  const inPlane = (A + C * (1 + ml)) * eUp + (B - D * (1 - ml)) * eDn;
  const bulk = 2 * v * m * J0 * (C * eUp - D * eDn);

  out[0] = -m * J0 * ((A - C * (1 - 2 * v - ml)) * eUp + (B + D * (1 - 2 * v + ml)) * eDn);
  out[1] = (m * J0 - J1r) * inPlane + bulk;
  out[2] = J1r * inPlane + bulk;
  out[3] = m * J1 * ((A + C * (2 * v + ml)) * eUp - (B - D * (2 * v - ml)) * eDn);
  out[4] = (-(1 + v) / E[i]) * J0 *
    ((A - C * (2 - 4 * v - ml)) * eUp - (B + D * (2 - 4 * v + ml)) * eDn);
  out[5] = ((1 + v) / E[i]) * J1 * ((A + C * ml) * eUp + (B - D * (1 - ml)) * eDn);
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
function starredHalfSpace(
  m: number, rho: number, lambda: number, v: number, E1: number,
  J0: number, J1: number, out: Float64Array
): void {
  const B = 2 * v, D = 1;
  const e = Math.exp(-m * lambda);
  const ml = m * lambda;
  const J1r = rho === 0 ? m / 2 : J1 / rho;

  const inPlane = (B - D * (1 - ml)) * e;
  const bulk = 2 * v * m * J0 * D * e;

  out[0] = -m * J0 * (B + D * (1 - 2 * v + ml)) * e;
  out[1] = (m * J0 - J1r) * inPlane - bulk;
  out[2] = J1r * inPlane - bulk;
  out[3] = -m * J1 * (B - D * (2 * v - ml)) * e;
  out[4] = ((1 + v) / E1) * J0 * (B + D * (2 - 4 * v + ml)) * e;
  out[5] = ((1 + v) / E1) * J1 * (B - D * (1 - ml)) * e;
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

/**
 * Panel breakpoints for the Hankel quadrature: every zero of J₁(mα), and off
 * the axis every zero of J₀(mρ) and J₁(mρ), so no panel ever spans more than
 * half an oscillation of any factor in the integrand. The first cycle is
 * subdivided, as Appendix B recommends, because the integrand varies fastest
 * there.
 *
 * Cached on (α, ρ, M) — the same trick oneLayer.ts already uses, and for the
 * same reason. A chart curve holds the geometry fixed and sweeps the modulus
 * ratio, so every curve of a family asks for an identical list; building a
 * few hundred breakpoints and sorting them is otherwise repeated once per
 * curve for nothing.
 *
 * ── The panels are NOT coarsened, and that was measured ─────────────────
 *
 * Off the axis the zeros of J₀(mρ) and J₁(mρ) interlace, so the union gives
 * panels a QUARTER of an oscillation wide where 8-point Gauss–Legendre
 * would carry a half comfortably. Dropping one ladder, or merging adjacent
 * panels under a phase cap, halves the panel count for the far wheels of a
 * tandem group — which is where this integral spends its time.
 *
 * It was implemented and thrown away. It bought about 15% of the chart
 * build, because the per-node cost is dominated by the linear solve rather
 * than by the node count, and it moved the response by up to 6e-8 relative
 * — small, but a genuine change to a quadrature that had just been repaired
 * for exactly the far-field case it touches (a tandem axle at a realistic
 * spacing samples ρ ≈ 36, where the layered and half-space integrands
 * cancel to four orders below their own size). Fifteen percent is not worth
 * spending that. If the panel count ever does become the bottleneck again,
 * the measurement to repeat is the whole-domain sweep, not the wall clock.
 */
const panelCache = new Map<string, number[]>();

function panels(alpha: number, rho: number, mMax: number): number[] {
  const key = `${alpha}|${rho}|${mMax}`;
  const hit = panelCache.get(key);
  if (hit) return hit;

  const brk: number[] = [];
  for (let k = 1; ; k++) {
    const zk = besselJ1Zero(k) / alpha;
    if (zk > mMax) break;
    brk.push(zk);
  }
  if (rho > 1e-9) {
    for (let k = 1; ; k++) {
      const z0 = besselJ0Zero(k) / rho;
      const z1 = besselJ1Zero(k) / rho;
      if (z0 > mMax && z1 > mMax) break;
      if (z0 <= mMax) brk.push(z0);
      if (z1 <= mMax) brk.push(z1);
    }
  }
  brk.push(mMax);
  brk.sort((x, y) => x - y);
  // The J1(mα) and J0(mρ) rungs can coincide, and mMax can land on one.
  const rungs: number[] = [];
  for (let i = 0; i < brk.length; i++) {
    if (i === 0 || brk[i] !== brk[i - 1]) rungs.push(brk[i]);
  }

  const out: number[] = [];
  // The first cycle is subdivided, as the text recommends, because the
  // integrand varies fastest there.
  const first = rungs[0];
  for (let s = 0; s < 8; s++) out.push((first * s) / 8);
  for (const m of rungs) out.push(m);

  if (panelCache.size > 512) panelCache.clear();
  panelCache.set(key, out);
  return out;
}

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

  const nodes = panels(alpha, rho, mMax);

  /* Eq. B.12's R_i depends only on the materials, so it is hoisted out of
     the node loop rather than recomputed a few hundred thousand times. */
  const Rint: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    Rint.push((E[i] / E[i + 1]) * ((1 + nu[i + 1]) / (1 + nu[i])));
  }

  let aZ = 0, aR = 0, aT = 0, aS = 0, aW = 0, aU = 0;
  let peak = 0;      // largest single-panel contribution seen, any component
  let quiet = 0;     // consecutive panels that contributed nothing measurable
  const RS = ST_LAYERED, PS = ST_HALF;

  for (let s = 0; s < nodes.length - 1; s++) {
    const lo = nodes[s], hi = nodes[s + 1];
    if (hi - lo < 1e-14) continue;
    const mid = 0.5 * (lo + hi), half = 0.5 * (hi - lo);
    let seg = 0;
    for (let g = 0; g < GL_X.length; g++) {
      const m = mid + half * GL_X[g];
      if (m <= 1e-12) continue;
      const K = constantsFor(m, lam, nu, E, Rint);
      if (!K) continue;
      const mr = m * rho;
      const J0r = besselJ0(mr), J1r = besselJ1(mr);
      starred(m, rho, lambda, lam, nu, E, K, J0r, J1r, RS);
      starredHalfSpace(m, rho, lambda, nu[0], E[0], J0r, J1r, PS);
      // B.7: R = q·α ∫ (R*/m) J1(mα) dm, integrated on R* - P*.
      const f = (besselJ1(m * alpha) / m) * GL_W[g] * half;
      const dZ = (RS[0] - PS[0]) * f;
      const dR = (RS[1] - PS[1]) * f;
      const dT = (RS[2] - PS[2]) * f;
      const dS = (RS[3] - PS[3]) * f;
      aZ += dZ;
      aR += dR;
      aT += dT;
      aS += dS;
      aW += (RS[4] - PS[4]) * f;
      aU += (RS[5] - PS[5]) * f;
      const a1 = dZ < 0 ? -dZ : dZ, a2 = dR < 0 ? -dR : dR;
      const a3 = dT < 0 ? -dT : dT, a4 = dS < 0 ? -dS : dS;
      if (a1 > seg) seg = a1;
      if (a2 > seg) seg = a2;
      if (a3 > seg) seg = a3;
      if (a4 > seg) seg = a4;
    }
    // Stop only once a RUN of panels has stopped contributing, measured
    // against the largest contribution seen rather than against a running
    // total that may be canceling to near zero.
    if (seg > peak) peak = seg;
    quiet = seg < tol * peak ? quiet + 1 : 0;
    if (quiet >= 12) break;
  }
  const acc6 = { sigZ: aZ, sigR: aR, sigT: aT, tauRZ: aS, w: aW, u: aU };

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
