// One-layer (Boussinesq) elastic half-space under a uniform circular load —
// the complete axisymmetric state at ANY point (r, z), not just on the axis.
//
// Huang (2004) §2.1 gives closed forms only on the axis of symmetry
// (Eqs. 2.2-2.6). Off the axis he prints charts — Figures 2.2 through 2.6,
// "after Foster and Ahlvin (1954)" — because there is no elementary closed
// form. This module supplies the thing the charts are pictures OF, so the
// charts can be redrawn rather than digitized.
//
// ── Where these come from ────────────────────────────────────────────────
// Specialize Appendix B (which lea.ts implements for n layers) to n = 1. The
// response must vanish at depth, so A = C = 0, and the two surface conditions
// of Eq. B.9 —  σz = -m·J0 and τrz = 0 — collapse to
//
//     -B + 2νD = 0,   B + (1-2ν)D = 1     ⟹   D = 1,  B = 2ν
//
// Substituting into Eq. B.4 and inverting with Eq. B.7 (R = q·a ∫ (R*/m)
// J1(ma) dm) leaves integrals whose integrands are elementary — no linear
// solve per quadrature node, which is what makes drawing a 17-curve chart
// interactive:
//
//   σz  = qa ∫ J1(ma) J0(mr) (1 + mz) e^(-mz) dm
//   σr  = qa ∫ J1(ma) [ (J0(mr) - J1(mr)/(mr))(1-2ν-mz) + 2ν J0(mr) ] e^(-mz) dm
//   σt  = qa ∫ J1(ma) [ (J1(mr)/(mr))(1-2ν-mz)          + 2ν J0(mr) ] e^(-mz) dm
//   τrz = qaz ∫ m J1(ma) J1(mr) e^(-mz) dm
//   w   = qa(1+ν)/E ∫ J1(ma) J0(mr) (2-2ν+mz) e^(-mz) dm/m
//   u   = qa(1+ν)/E ∫ J1(ma) J1(mr) (2ν-1+mz) e^(-mz) dm/m
//
// On the axis these integrate in closed form back to Huang Eqs. 2.2-2.6 —
// oneLayer.test.mjs asserts that, and also that the whole tensor agrees with
// the independent n-layer solver in lea.ts run with two identical layers.
//
// Sign convention: COMPRESSION POSITIVE, matching Huang's Chapter 2 and the
// rest of this site. Displacements are positive downward/outward.
//
// Three cases share this file, because they are one case with one factor
// changed: a CONCENTRATED load (Boussinesq's original, and the kernel every
// integral here integrates), a FLEXIBLE circular plate (a tire: uniform q),
// and a RIGID one (a plate bearing test: Huang Eq. 2.9). See `Plate` below.
//
// A defect fixed here, silent and shipped: at z = 0 outside the loaded
// circle, sigma_r and sigma_t carried the wrong sign — compression radially
// where the answer is TENSION. The quadrature disagreed with the closed form
// at every Poisson ratio, and nothing noticed, because the difference is
// identically zero at nu = 0.5 and nu = 0.5 is the only ratio the charts use
// and the only one the suite tested out there. `surface` is now derived from
// one identity that covers both plates, and the test asserts the integral
// converges on it.
import { besselJ0, besselJ1, besselJ0Zero, besselJ1Zero } from './bessel.ts';

export interface PointResponse {
  /** Vertical stress. */
  sigZ: number;
  /** Radial stress. */
  sigR: number;
  /** Tangential (circumferential) stress. */
  sigT: number;
  /** Shear stress in the r-z plane. Zero on the axis. */
  tauRZ: number;
  /** Vertical displacement, positive downward. */
  w: number;
  /** Radial displacement, positive outward. */
  u: number;
}

/** Principal stresses and strains at a point, sorted most compressive first. */
export interface Principal {
  /** σ1 ≥ σ2 ≥ σ3, compression positive. */
  sig: [number, number, number];
  /** The strains conjugate to sig, in the same order. */
  eps: [number, number, number];
}

/* ── Quadrature ───────────────────────────────────────────────────────────
 * 10-point Gauss-Legendre on each panel between successive zeros of the
 * Bessel factors, which is where the integrand changes sign. The first cycle
 * is split further, as Appendix B recommends, because the integrand varies
 * fastest there. A convergence sweep (cycles 40 → 800, split 8 → 64) moves
 * no digit of the r = a, z = 2a case, so 48/12 is generous.
 */
const GL_X = [
  -0.9739065285171717, -0.8650633666889845, -0.6794095682990244,
  -0.4333953941292472, -0.1488743389816312, 0.1488743389816312,
  0.4333953941292472, 0.6794095682990244, 0.8650633666889845,
  0.9739065285171717,
];
const GL_W = [
  0.0666713443086881, 0.1494513491505806, 0.2190863625159820,
  0.2692667193099963, 0.2955242247147529, 0.2955242247147529,
  0.2692667193099963, 0.2190863625159820, 0.1494513491505806,
  0.0666713443086881,
];

const SPLIT = 12;
/** Panels are capped so a pathological (r/a, z/a) cannot stall a redraw. */
const PANEL_BUDGET = 4000;

/**
 * How far out in m the quadrature has to run.
 *
 * The integrands all carry e^(-mz), so the tail past M contributes about
 * e^(-Mz)/M: taking mz ≈ 18 puts it near 1e-8 of the total. Shallow points
 * therefore need a much longer range than deep ones — this is why a fixed
 * cycle count silently loses the far field near the surface, where sigma_z/q
 * is 1e-6 and the panels derived from J1(ma) are five oscillations of
 * J0(mr) wide.
 *
 * The floor keeps enough cycles to resolve the load's own oscillation even
 * when z is large, and the ceiling is the cost cap.
 */
function mRange(a: number, r: number, z: number): number {
  // Breakpoints arrive at a/π per unit m from J1(ma) and 2r/π from the pair
  // J0(mr), J1(mr), so the budget converts straight into a range.
  const cap = (PANEL_BUDGET * Math.PI) / (a + 2 * r);
  const floor = (4 * Math.PI) / a;
  const wanted = Math.max(floor, 18 / Math.max(z, 1e-9));
  return Math.min(wanted, Math.max(floor, cap));
}

/**
 * WHICH LOAD sits on the surface -- the only thing that changes between a tire
 * and a plate bearing test.
 *
 * Everything below the surface is the same half-space, so the two cases differ
 * in exactly one factor of the Hankel integrand: the transform of the surface
 * traction. Writing p(s) for the pressure and P(m) = ∫ p(s) J0(ms) s ds, every
 * response is ∫ m P(m) (...) dm, so
 *
 *   'disc'   uniform q over s < a          ->  P = q a J1(ma)/m    -> J1(ma)
 *   'punch'  Huang Eq. 2.9, qa/(2*sqrt(a*a - s*s))
 *                                          ->  P = q a sin(ma)/2m  -> sin(ma)/2
 *
 * using ∫₀^a s J0(ms)/sqrt(a²-s²) ds = sin(ma)/m. That is the whole of the
 * rigid-plate implementation: one factor of the integrand, and the panel
 * breakpoints that go with it (sin has its zeros at kπ/a, J1 at
 * j₁,ₖ/a, which is about (k + 1/4)π/a).
 */
export type Plate = 'disc' | 'punch';

/**
 * Panel breakpoints for ∫₀^M f(m) dm where f oscillates at the zeros of the
 * load factor above and (off the axis) of J0(mr) and J1(mr).
 *
 * Every family runs out to the SAME M, so no panel ever spans more than half
 * an oscillation of any factor in it. Cached on (kind, a, r, M), because a chart
 * redraws the same handful of stations hundreds of times.
 */
const panelCache = new Map<string, number[]>();

function panels(a: number, r: number, mMax: number, kind: Plate): number[] {
  const key = `${kind}|${a}|${r}|${mMax.toFixed(4)}`;
  const hit = panelCache.get(key);
  if (hit) return hit;

  const brk = new Set<number>();
  for (let k = 1; ; k++) {
    const zk = (kind === 'punch' ? k * Math.PI : besselJ1Zero(k)) / a;
    if (zk > mMax) break;
    brk.add(zk);
  }
  if (r > 1e-9) {
    for (let k = 1; ; k++) {
      const z0 = besselJ0Zero(k) / r;
      const z1 = besselJ1Zero(k) / r;
      if (z0 > mMax && z1 > mMax) break;
      if (z0 <= mMax) brk.add(z0);
      if (z1 <= mMax) brk.add(z1);
    }
  }
  brk.add(mMax);
  const sorted = [...brk].sort((x, y) => x - y);
  const first = sorted[0];
  const out: number[] = [];
  for (let s = 0; s < SPLIT; s++) out.push((first * s) / SPLIT);
  out.push(...sorted);

  if (panelCache.size > 512) panelCache.clear();
  panelCache.set(key, out);
  return out;
}

/**
 * All six components in ONE quadrature pass. Evaluating them separately costs
 * six times the Bessel calls for the same nodes, which is the difference
 * between a chart that redraws in 50 ms and one that redraws in 300.
 */
function integrate(
  a: number, r: number, z: number, nu: number, kind: Plate = 'disc'
): PointResponse {
  const nodes = panels(a, r, mRange(a, r, z), kind);
  const onAxis = r < 1e-12;

  let iZ = 0, iR = 0, iT = 0, iS = 0, iW = 0, iU = 0;

  for (let s = 0; s < nodes.length - 1; s++) {
    const lo = nodes[s], hi = nodes[s + 1];
    const half = 0.5 * (hi - lo);
    if (half < 1e-15) continue;
    const mid = 0.5 * (lo + hi);

    for (let g = 0; g < GL_X.length; g++) {
      const m = mid + half * GL_X[g];
      if (m <= 0) continue;
      const wq = GL_W[g] * half;

      const Ja = kind === 'punch' ? 0.5 * Math.sin(m * a) : besselJ1(m * a);
      const damp = Math.exp(-m * z);
      if (Ja === 0 || damp === 0) continue;
      const base = Ja * damp * wq;

      // J0(mr), J1(mr), and J1(mr)/(mr) — the last tends to 1/2 on the axis.
      const J0r = onAxis ? 1 : besselJ0(m * r);
      const J1r = onAxis ? 0 : besselJ1(m * r);
      const Qr = onAxis ? 0.5 : J1r / (m * r);

      const mz = m * z;
      const k = 1 - 2 * nu - mz;

      iZ += base * J0r * (1 + mz);
      iR += base * ((J0r - Qr) * k + 2 * nu * J0r);
      iT += base * (Qr * k + 2 * nu * J0r);
      iS += base * m * J1r;
      iW += (base * J0r * (2 - 2 * nu + mz)) / m;
      iU += (base * J1r * (2 * nu - 1 + mz)) / m;
    }
  }

  const qa = a;             // caller multiplies by q; E and (1+ν) applied below
  return {
    sigZ: qa * iZ,
    sigR: qa * iR,
    sigT: qa * iT,
    tauRZ: qa * z * iS,
    w: qa * iW,
    u: qa * iU,
  };
}

/* ── Complete elliptic integrals K(k) and E(k), by the AGM ────────────────
 * Needed only for the surface deflection below. The arithmetic-geometric
 * mean converges quadratically, so eight iterations are exact in double
 * precision for every k the charts reach.
 */
function elliptic(k: number): { K: number; E: number } {
  const m = Math.min(1, Math.max(0, k * k));
  if (m >= 1) return { K: Infinity, E: 1 };
  let a = 1, b = Math.sqrt(1 - m), c = k;
  let sum = c * c / 2;
  for (let n = 1; n < 40; n++) {
    const an = (a + b) / 2;
    const bn = Math.sqrt(a * b);
    c = (a - b) / 2;
    a = an; b = bn;
    sum += Math.pow(2, n - 1) * c * c;
    if (Math.abs(c) < 1e-16) break;
  }
  const K = Math.PI / (2 * a);
  return { K, E: K * (1 - sum) };
}

/**
 * At the surface the integrals lose their e^(-mz) damping and converge only
 * conditionally, so z = 0 is taken from the closed forms instead — and both
 * plates come out of ONE identity, so neither can drift from the other.
 *
 * Set z = 0 in the integrands at the top of this file. The 2ν J0 and the
 * (1-2ν) J0 collapse together, and what is left of each horizontal stress is
 * the vertical stress plus one more integral:
 *
 *   σz(r,0) = ∫ m P̃ J0(mr) dm  =  p(r)          (Hankel inversion: the plate
 *                                                 pressure, carried directly)
 *   σr(r,0) = p(r)  - (1-2ν)·T,   T ≡ (1/r)∫ P̃(m) J1(mr) dm
 *   σt(r,0) = 2ν p(r) + (1-2ν)·T
 *   u (r,0) = -(1-2ν)(1+ν)·T·r/E
 *
 * so a plate is described here by exactly two numbers, p(r) and T(r):
 *
 *   FLEXIBLE  p = q inside, 0 outside;  T = q/2 inside, q a²/(2r²) outside,
 *             from ∫ J1(ma)J1(mr)/m dm = r/(2a) and a/(2r).
 *   RIGID     p = qa/(2√(a²-r²)) (Eq. 2.9);  T = (qa/2)(a-√(a²-r²))/r²
 *             inside and the same q a²/(2r²) outside, from
 *             ∫ sin(ma)J1(mr)/m dm = a/r and (a-√(a²-r²))/r.
 *
 * Inside a flexible plate this gives σr = σt = q(1+2ν)/2, which is Huang
 * Eq. 2.3 at z = 0. OUTSIDE it gives σr = -q(1-2ν)a²/(2r²) — NEGATIVE, i.e.
 * radial TENSION, with σt its compressive mirror. That sign is the whole
 * mechanics of the surface around a wheel: the bowl stretches the surface
 * radially and squeezes it circumferentially, which is why a punch cracks a
 * half-space radially. This module shipped it the other way round for both
 * stresses, and nothing caught it: the quadrature disagrees at every ν, but
 * the disagreement vanishes identically at ν = 0.5, and ν = 0.5 is the only
 * Poisson ratio Foster and Ahlvin drew a chart for and the only one the
 * suite tested outside the load. The far-field check below is the fix's gate.
 *
 * Vertical displacement, flexible, in complete elliptic integrals:
 *
 *   r ≤ a:   w = 4(1-ν²)qa/(πE) · E(r/a)
 *   r ≥ a:   w = 4(1-ν²)qr/(πE) · [ E(a/r) - (1 - a²/r²) K(a/r) ]
 *
 * At r = 0, E(0) = π/2 and this collapses to Huang Eq. 2.8, w₀ = 2(1-ν²)qa/E.
 * The two branches agree at r = a, where E(1) = 1 and the K term drops out.
 *
 * Rigid, the classical flat punch: the plate settles as a unit, so w is
 * CONSTANT under it — that flat top against the flexible plate's dish is
 * Huang's Figure 2.9, and it is the reason Eq. 2.10 is 79% of Eq. 2.8.
 *
 *   r ≤ a:   w = w₀ = π(1-ν²)qa/(2E)          (Eq. 2.10)
 *   r ≥ a:   w = (2 w₀/π) · asin(a/r)
 */
function surface(
  q: number, a: number, r: number, E: number, nu: number, kind: Plate = 'disc'
): PointResponse {
  const inside = r < a - 1e-12;
  const onRim = Math.abs(r - a) <= 1e-12;
  const rigid = kind === 'punch';

  /* p(r): the pressure the plate actually applies. Uniform under a tire;
     Eq. 2.9 under a rigid plate, which is q/2 at the center and unbounded at
     the rim, where the plate's edge digs in. */
  const sigZ = rigid
    ? (inside ? (q * a) / (2 * Math.sqrt(a * a - r * r)) : onRim ? Infinity : 0)
    : (inside ? q : onRim ? q / 2 : 0);

  // T = (1/r) ∫ P̃ J1(mr) dm, the one extra number the horizontal state needs.
  let T: number;
  if (r <= a + 1e-12) {
    T = rigid
      // (qa/2)(a - √(a²-r²))/r², whose r -> 0 limit is q/4.
      ? (r < 1e-9
          ? q / 4
          : (q * a * (a - Math.sqrt(Math.max(0, a * a - r * r)))) / (2 * r * r))
      : q / 2;
  } else {
    T = (q * a * a) / (2 * r * r);
  }

  const k = 1 - 2 * nu;
  const sigR = sigZ - k * T;
  const sigT = 2 * nu * sigZ + k * T;

  let w: number;
  if (rigid) {
    const w0 = (Math.PI * (1 - nu * nu) * q * a) / (2 * E);
    w = r <= a ? w0 : ((2 * w0) / Math.PI) * Math.asin(a / r);
  } else {
    const c = (4 * (1 - nu * nu) * q) / (Math.PI * E);
    if (r <= a) {
      w = c * a * elliptic(r / a).E;
    } else {
      const kk = a / r;
      const { K, E: Ek } = elliptic(kk);
      w = c * r * (Ek - (1 - kk * kk) * K);
    }
  }

  const u = -(k * (1 + nu) * T * r) / E;

  return { sigZ, sigR, sigT, tauRZ: 0, w, u };
}

/**
 * Stresses and displacements at (r, z) in a homogeneous elastic half-space
 * carrying a uniform pressure q over a circle of radius a.
 *
 * @param r  radial distance from the load axis (≥ 0)
 * @param z  depth below the surface (≥ 0)
 * @param q  contact pressure
 * @param a  contact radius
 * @param E  elastic modulus, same pressure unit as q
 * @param nu Poisson's ratio
 * @param kind 'disc' for a tire (uniform q), 'punch' for a rigid plate (Eq. 2.9)
 */
export function oneLayerResponse(
  r: number, z: number, q: number, a: number, E: number, nu: number,
  kind: Plate = 'disc'
): PointResponse | null {
  if (!(a > 0 && E > 0 && r >= 0 && z >= 0 && Number.isFinite(q))) return null;
  if (z <= 1e-12) return surface(q, a, r, E, nu, kind);

  const n = integrate(a, r, z, nu, kind);
  return {
    sigZ: q * n.sigZ,
    sigR: q * n.sigR,
    sigT: q * n.sigT,
    tauRZ: q * n.tauRZ,
    w: (q * (1 + nu) * n.w) / E,
    u: (q * (1 + nu) * n.u) / E,
  };
}

/**
 * The same half-space under a RIGID plate — a plate bearing test rather than
 * a tire. Same arguments, and `q` is again the AVERAGE pressure, total load
 * over plate area, exactly as Huang defines it under Eq. 2.9.
 *
 * The plate settles as a unit, so it cannot apply a uniform pressure: it
 * sheds load to its rim (Eq. 2.9, q/2 at the center and unbounded at r = a)
 * and settles only π/4 of the flexible plate (Eq. 2.10). Both facts are the
 * same fact, and both come out of the one changed factor in the integrand.
 */
export const rigidPlateResponse = (
  r: number, z: number, q: number, a: number, E: number, nu: number
) => oneLayerResponse(r, z, q, a, E, nu, 'punch');

/* ── Boussinesq's original: a CONCENTRATED load ──────────────────────────
 * Huang opens §2.1 with it: "The original Boussinesq (1885) theory was based
 * on a concentrated load applied on an elastic half space. The stresses,
 * strains, and deflections due to a concentrated load can be integrated to
 * obtain those due to a circular loaded area."
 *
 * So this is the kernel every integral above is an integral OF, and the book
 * prints no equations for it — it goes straight to the circle. Everything
 * here is elementary, with R = √(r² + z²):
 *
 *   σz  = 3P z³ / (2π R⁵)
 *   σr  = (P/2π) [ 3r²z/R⁵ - (1-2ν)/(R(R+z)) ]
 *   σt  = (P/2π)(1-2ν) [ 1/(R(R+z)) - z/R³ ]
 *   τrz = 3P r z² / (2π R⁵)
 *   w   = P(1+ν)/(2πER) [ 2(1-ν) + z²/R² ]
 *   u   = P(1+ν)r/(2πE) [ z/R³ - (1-2ν)/(R(R+z)) ]
 *
 * Two readings worth having in front of a student:
 *
 *   ON THE AXIS   σz = 3P/(2πz²) = 0.4775 P/z², independent of E and ν and of
 *                 anything about the material — the same statement Huang
 *                 makes under Eq. 2.3, in its simplest form.
 *   ON THE SURFACE  w = P(1-ν²)/(πEr), and σr is NEGATIVE while σt is its
 *                 mirror: tension radially, compression circumferentially.
 *
 * The load is a singularity, so the origin has no value; every quantity runs
 * to infinity there. `pointLoadResponse` returns null at R = 0 rather than
 * Infinity, so a caller cannot plot it by accident.
 */
export function pointLoadResponse(
  r: number, z: number, P: number, E: number, nu: number
): PointResponse | null {
  if (!(E > 0 && r >= 0 && z >= 0 && Number.isFinite(P))) return null;
  const R = Math.hypot(r, z);
  if (R < 1e-12) return null;

  const c = P / (2 * Math.PI);
  const R3 = R * R * R, R5 = R3 * R * R;
  const k = 1 - 2 * nu;
  // 1/(R(R+z)) is well conditioned everywhere the half-space exists: R+z ≥ R.
  const g = 1 / (R * (R + z));

  return {
    sigZ: (3 * c * z * z * z) / R5,
    sigR: c * ((3 * r * r * z) / R5 - k * g),
    sigT: c * k * (g - z / R3),
    tauRZ: (3 * c * r * z * z) / R5,
    w: ((P * (1 + nu)) / (2 * Math.PI * E * R)) * (2 * (1 - nu) + (z * z) / (R * R)),
    u: ((P * (1 + nu)) / (2 * Math.PI * E)) * ((r * z) / R3 - k * r * g),
  };
}

/** σz on the axis under a point load: 0.4775 P/z², whatever the material. */
export const pointLoadAxisStress = (z: number, P: number) =>
  (3 * P) / (2 * Math.PI * z * z);

/** Surface deflection under a point load, Boussinesq: w = P(1-ν²)/(πEr). */
export const pointLoadSurfaceDeflection = (r: number, P: number, E: number, nu: number) =>
  (P * (1 - nu * nu)) / (Math.PI * E * r);

/* ── The five quantities Foster and Ahlvin charted ────────────────────────
 * Each is dimensionless in (r/a, z/a) alone — which is why one chart serves
 * every load. All are drawn for ν = 0.5, stated in the text on page 46:
 * "Poisson ratio has a relatively small effect on stresses and deflections,
 * [so] Foster and Ahlvin assumed the half-space to be incompressible".
 */

/** The Poisson ratio every chart in Figures 2.2-2.6 assumes. */
export const CHART_NU = 0.5;

/** σz/q at (r/a, z/a). Independent of ν and E — Huang's note under Eq. 2.3. */
export const sigZRatio = (ra: number, za: number, nu = CHART_NU) =>
  oneLayerResponse(ra, za, 1, 1, 1, nu)!.sigZ;

/** σr/q at (r/a, z/a). */
export const sigRRatio = (ra: number, za: number, nu = CHART_NU) =>
  oneLayerResponse(ra, za, 1, 1, 1, nu)!.sigR;

/** σt/q at (r/a, z/a). */
export const sigTRatio = (ra: number, za: number, nu = CHART_NU) =>
  oneLayerResponse(ra, za, 1, 1, 1, nu)!.sigT;

/** τrz/q at (r/a, z/a). */
export const tauRatio = (ra: number, za: number, nu = CHART_NU) =>
  oneLayerResponse(ra, za, 1, 1, 1, nu)!.tauRZ;

/**
 * The deflection factor F of Figure 2.6, defined there by w = (qa/E)·F.
 * On the axis this is (1+ν)[a/R + (1-2ν)(R-z)/a] with R = √(a²+z²), which is
 * Huang Eq. 2.6 rearranged.
 */
export const deflectionFactorAt = (ra: number, za: number, nu = CHART_NU) =>
  oneLayerResponse(ra, za, 1, 1, 1, nu)!.w;

/* ── Principal state ──────────────────────────────────────────────────────
 * Axisymmetry makes σt a principal stress in its own right; the other two lie
 * in the r-z plane and come off Mohr's circle. Problem 2.1 asks for exactly
 * this at r = a, z = 2a.
 */
export function principalAt(R: PointResponse, E: number, nu: number): Principal {
  const c = (R.sigR + R.sigZ) / 2;
  const d = Math.hypot((R.sigR - R.sigZ) / 2, R.tauRZ);
  const s = [c + d, c - d, R.sigT].sort((x, y) => y - x) as [number, number, number];
  const sum = s[0] + s[1] + s[2];
  const eps = s.map(si => (si - nu * (sum - si)) / E) as [number, number, number];
  return { sig: s, eps };
}

/**
 * Strains in the cylindrical frame, from Huang Eq. 2.1 with the shear term.
 * Compression positive, so a NEGATIVE εr is horizontal tension.
 */
export function strainsAt(R: PointResponse, E: number, nu: number) {
  const G = E / (2 * (1 + nu));
  return {
    epsZ: (R.sigZ - nu * (R.sigR + R.sigT)) / E,
    epsR: (R.sigR - nu * (R.sigZ + R.sigT)) / E,
    epsT: (R.sigT - nu * (R.sigZ + R.sigR)) / E,
    gamRZ: R.tauRZ / G,
  };
}

/**
 * Surface deflection under a RIGID plate — Huang Eq. 2.10. A rigid plate of
 * the same average pressure deflects only π/4 ≈ 79% as much as a flexible
 * one, because it sheds pressure to its edge (Eq. 2.9).
 */
export const rigidPlateDeflection = (q: number, a: number, E: number, nu: number) =>
  (Math.PI * (1 - nu * nu) * q * a) / (2 * E);

/** Pressure distribution under a rigid plate — Huang Eq. 2.9. Infinite at r = a. */
export const rigidPlatePressure = (q: number, a: number, r: number) =>
  r >= a ? Infinity : (q * a) / (2 * Math.sqrt(a * a - r * r));

/**
 * Superpose several identical circular loads in plan — Huang's Example 2.1,
 * where two 10-in. circles 20 in. apart are added at a point under one of them.
 *
 * Stresses are resolved into a common Cartesian frame before adding, because
 * each load's own (r, t) axes point in a different direction. Returned as the
 * full symmetric tensor plus its principal state.
 *
 * @param wheels centers in plan
 * @param point  where to evaluate, in the same plan coordinates
 */
export function superposeOneLayer(
  wheels: { x: number; y: number }[],
  point: { x: number; y: number; z: number },
  q: number, a: number, E: number, nu: number
) {
  let sx = 0, sy = 0, sz = 0, txy = 0, txz = 0, tyz = 0, w = 0;

  for (const wl of wheels) {
    const dx = point.x - wl.x, dy = point.y - wl.y;
    const dr = Math.hypot(dx, dy);
    const R = oneLayerResponse(dr, point.z, q, a, E, nu);
    if (!R) return null;
    sz += R.sigZ;
    w += R.w;
    if (dr < 1e-9) {
      sx += R.sigR;
      sy += R.sigT;
    } else {
      const c = dx / dr, s = dy / dr;
      sx += R.sigR * c * c + R.sigT * s * s;
      sy += R.sigR * s * s + R.sigT * c * c;
      txy += (R.sigR - R.sigT) * c * s;
      txz += R.tauRZ * c;
      tyz += R.tauRZ * s;
    }
  }

  const sig = principalOfTensor(sx, sy, sz, txy, txz, tyz);
  const sum = sig[0] + sig[1] + sig[2];
  const eps = sig.map(s => (s - nu * (sum - s)) / E) as [number, number, number];
  return { sx, sy, sz, txy, txz, tyz, w, sig, eps };
}

/**
 * Principal values of a symmetric 3×3 stress tensor, descending.
 *
 * Closed-form eigenvalues via the trigonometric solution of the characteristic
 * cubic — no iteration, and it cannot silently fail to converge the way a
 * Jacobi sweep can when two roots are nearly equal.
 */
export function principalOfTensor(
  sx: number, sy: number, sz: number, txy: number, txz: number, tyz: number
): [number, number, number] {
  const p1 = txy * txy + txz * txz + tyz * tyz;
  if (p1 < 1e-24) {
    return [sx, sy, sz].sort((a, b) => b - a) as [number, number, number];
  }
  const qm = (sx + sy + sz) / 3;
  const p2 =
    (sx - qm) ** 2 + (sy - qm) ** 2 + (sz - qm) ** 2 + 2 * p1;
  const p = Math.sqrt(p2 / 6);
  // B = (A - qI)/p, then r = det(B)/2 ∈ [-1, 1].
  const b = [
    [(sx - qm) / p, txy / p, txz / p],
    [txy / p, (sy - qm) / p, tyz / p],
    [txz / p, tyz / p, (sz - qm) / p],
  ];
  const det =
    b[0][0] * (b[1][1] * b[2][2] - b[1][2] * b[2][1]) -
    b[0][1] * (b[1][0] * b[2][2] - b[1][2] * b[2][0]) +
    b[0][2] * (b[1][0] * b[2][1] - b[1][1] * b[2][0]);
  const r = Math.max(-1, Math.min(1, det / 2));
  const phi = Math.acos(r) / 3;
  const e1 = qm + 2 * p * Math.cos(phi);
  const e3 = qm + 2 * p * Math.cos(phi + (2 * Math.PI) / 3);
  const e2 = 3 * qm - e1 - e3;
  return [e1, e2, e3];
}
