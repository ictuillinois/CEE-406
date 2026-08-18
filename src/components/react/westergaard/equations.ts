// Westergaard slab responses — pure functions, no React.
//
// Huang (2004) Chapter 4. Extracted from the app so the physics can be
// exercised directly against the printed worked answers of Examples 4.1
// through 4.5. See equations.test.mjs.
//
// Two things this module deliberately provides that the original app did not:
//
//   1. The SEMICIRCULAR edge cases (Eqs. 4.23, 4.25). Huang notes that a
//      semicircular contact — its straight edge flush with the slab edge — is
//      the realistic representation of a wheel at an edge, and it produces the
//      LARGER stress. Omitting it hides the governing case in rigid design.
//
//   2. The ORIGINAL corner formulas (Eqs. 4.13, 4.14) alongside the Ioannides
//      forms (Eqs. 4.15, 4.16). Huang prints both and observes they differ by
//      2% in stress and 11% in deflection. Two published answers to one
//      question is not a defect to hide — it is the thing worth teaching.
//
// US customary throughout: in, psi, pci, lb.

/**
 * Radius of relative stiffness — Huang Eq. 4.10.
 *
 *   ℓ = [E h³ / (12 (1 − ν²) k)]^(1/4)
 *
 * The single most important length in rigid pavement analysis: it sets the
 * scale over which the slab distributes a load into the foundation.
 */
export const radiusOfRelativeStiffness = (E: number, h: number, nu: number, k: number) =>
  Math.pow((E * h ** 3) / (12 * (1 - nu * nu) * k), 0.25);

/**
 * Westergaard's equivalent radius of resisting section — Huang Eq. 4.19.
 *
 * For a small contact area the bending stress under the load is governed not
 * by the true radius but by this equivalent one, which never falls below a
 * value set by the slab thickness.
 */
export const equivalentRadius = (a: number, h: number) =>
  a >= 1.724 * h ? a : Math.sqrt(1.6 * a * a + h * h) - 0.675 * h;

/**
 * Radius of the circle equivalent to a set of dual tires — Huang Eq. 4.31.
 *
 *   πa² = 0.8521 Pd/q + (Sd/π)·√(Pd/0.5227q)   … then solved for a
 *
 * The equivalent circle covers both tyre imprints AND the gap between them,
 * because for a rigid slab the load spreads across the gap. Using the tyre
 * contact area alone (the flexible-pavement convention) gives too small a
 * radius and therefore too large a stress.
 *
 * @param Pd load on ONE tyre (lb)
 * @param q  contact pressure (psi)
 * @param Sd centre-to-centre dual spacing (in)
 */
export const dualEquivalentRadius = (Pd: number, q: number, Sd: number) =>
  Math.sqrt((0.8521 * Pd) / (q * Math.PI) + (Sd / Math.PI) * Math.sqrt(Pd / (0.5227 * q)));

/* ───────────────────────────── Interior ─────────────────────────────────── */

/** Interior stress — Huang Eq. 4.18 (Westergaard 1926b). */
export function interiorStress(P: number, h: number, nu: number, ell: number, b: number) {
  return ((3 * (1 + nu) * P) / (2 * Math.PI * h * h)) * (Math.log(ell / b) + 0.6159);
}

/** Interior deflection — Huang Eq. 4.21 (Westergaard 1939). */
export function interiorDeflection(P: number, k: number, ell: number, a: number) {
  return (
    (P / (8 * k * ell * ell)) *
    (1 + (1 / (2 * Math.PI)) * (Math.log(a / (2 * ell)) - 0.673) * (a / ell) ** 2)
  );
}

/* ─────────────────────────────── Edge ───────────────────────────────────── */

/** Edge stress, CIRCULAR contact — Huang Eq. 4.22 (Ioannides et al. 1985). */
export function edgeStressCircle(P: number, E: number, h: number, nu: number, k: number, a: number, ell: number) {
  return (
    ((3 * (1 + nu) * P) / (Math.PI * (3 + nu) * h * h)) *
    (Math.log((E * h ** 3) / (100 * k * a ** 4)) +
      1.84 -
      (4 * nu) / 3 +
      (1 - nu) / 2 +
      1.18 * (1 + 2 * nu) * (a / ell))
  );
}

/**
 * Edge stress, SEMICIRCULAR contact — Huang Eq. 4.23.
 *
 * The straight edge of the semicircle lies along the slab edge, which puts
 * its centroid closer to the edge than a circle of the same area. That is why
 * this is the larger — and the realistic — answer for a wheel at an edge.
 */
export function edgeStressSemicircle(P: number, E: number, h: number, nu: number, k: number, a: number, ell: number) {
  return (
    ((3 * (1 + nu) * P) / (Math.PI * (3 + nu) * h * h)) *
    (Math.log((E * h ** 3) / (100 * k * a ** 4)) + 3.84 - (4 * nu) / 3 + ((1 + 2 * nu) * a) / (2 * ell))
  );
}

/** Edge deflection, CIRCULAR contact — Huang Eq. 4.24. */
export function edgeDeflectionCircle(P: number, E: number, h: number, nu: number, k: number, a: number, ell: number) {
  return (
    ((Math.sqrt(2 + 1.2 * nu) * P) / Math.sqrt(E * h ** 3 * k)) *
    (1 - (0.76 + 0.4 * nu) * (a / ell))
  );
}

/** Edge deflection, SEMICIRCULAR contact — Huang Eq. 4.25. */
export function edgeDeflectionSemicircle(P: number, E: number, h: number, nu: number, k: number, a: number, ell: number) {
  return (
    ((Math.sqrt(2 + 1.2 * nu) * P) / Math.sqrt(E * h ** 3 * k)) *
    (1 - (0.323 + 0.17 * nu) * (a / ell))
  );
}

/* ────────────────────────────── Corner ──────────────────────────────────── */

/**
 * Corner stress, ORIGINAL — Huang Eq. 4.13 (Goldbeck 1919 / Older 1924, as
 * refined by Westergaard). Uses the diagonal distance a√2 to the load centre.
 */
export const cornerStressOriginal = (P: number, h: number, a: number, ell: number) =>
  ((3 * P) / (h * h)) * (1 - Math.pow((a * Math.SQRT2) / ell, 0.6));

/** Corner deflection, ORIGINAL — Huang Eq. 4.14. */
export const cornerDeflectionOriginal = (P: number, k: number, a: number, ell: number) =>
  (P / (k * ell * ell)) * (1.1 - 0.88 * ((a * Math.SQRT2) / ell));

/**
 * Side of the square contact equivalent to a circle of radius a — Huang
 * Eq. 4.17, used by the Ioannides corner forms.
 */
export const equivalentSquareSide = (a: number) => 1.772 * a;

/** Corner stress, IOANNIDES — Huang Eq. 4.15, with c from Eq. 4.17. */
export const cornerStressIoannides = (P: number, h: number, c: number, ell: number) =>
  ((3 * P) / (h * h)) * (1 - Math.pow(c / ell, 0.72));

/** Corner deflection, IOANNIDES — Huang Eq. 4.16. */
export const cornerDeflectionIoannides = (P: number, k: number, c: number, ell: number) =>
  (P / (k * ell * ell)) * (1.205 - 0.69 * (c / ell));

/* ────────────────────────── Assembled responses ─────────────────────────── */

export interface SlabResponses {
  ell: number;
  b: number;
  c: number;
  interior: { stress: number; deflection: number };
  /** Both published edge cases. The semicircle is the larger one. */
  edge: {
    circle: { stress: number; deflection: number };
    semicircle: { stress: number; deflection: number };
  };
  /** Both published corner solutions — they disagree, on purpose. */
  corner: {
    original: { stress: number; deflection: number };
    ioannides: { stress: number; deflection: number };
  };
  /** The governing (largest) stress across all cases, and where it occurs. */
  governing: { case: string; stress: number };
}

/**
 * Every Westergaard case for one slab and one load, in one call.
 *
 * @param E  concrete elastic modulus (psi)
 * @param h  slab thickness (in)
 * @param nu Poisson's ratio
 * @param k  modulus of subgrade reaction (pci)
 * @param P  total load (lb)
 * @param a  contact radius (in)
 */
export function slabResponses(
  E: number, h: number, nu: number, k: number, P: number, a: number
): SlabResponses | null {
  if (!(E > 0 && h > 0 && k > 0 && P > 0 && a > 0)) return null;

  const ell = radiusOfRelativeStiffness(E, h, nu, k);
  const b = equivalentRadius(a, h);
  const c = equivalentSquareSide(a);

  const interior = {
    stress: interiorStress(P, h, nu, ell, b),
    deflection: interiorDeflection(P, k, ell, a),
  };
  const edge = {
    circle: {
      stress: edgeStressCircle(P, E, h, nu, k, a, ell),
      deflection: edgeDeflectionCircle(P, E, h, nu, k, a, ell),
    },
    semicircle: {
      stress: edgeStressSemicircle(P, E, h, nu, k, a, ell),
      deflection: edgeDeflectionSemicircle(P, E, h, nu, k, a, ell),
    },
  };
  const corner = {
    original: {
      stress: cornerStressOriginal(P, h, a, ell),
      deflection: cornerDeflectionOriginal(P, k, a, ell),
    },
    ioannides: {
      stress: cornerStressIoannides(P, h, c, ell),
      deflection: cornerDeflectionIoannides(P, k, c, ell),
    },
  };

  const candidates: [string, number][] = [
    ['Interior', interior.stress],
    ['Edge (circle)', edge.circle.stress],
    ['Edge (semicircle)', edge.semicircle.stress],
    ['Corner (Ioannides)', corner.ioannides.stress],
  ];
  const top = candidates.reduce((best, x) => (x[1] > best[1] ? x : best));

  return { ell, b, c, interior, edge, corner, governing: { case: top[0], stress: top[1] } };
}

/* ────────────────────────────── Curling ─────────────────────────────────── */

/**
 * Bradbury's curling stress coefficient C — the analytic form behind the
 * chart of Huang Figure 4.4, as a function of L/ℓ.
 *
 * The analytic form is strictly better than reading the chart: it reproduces
 * both landmarks Huang quotes (C = 1.0 at L = 6.7ℓ, and a maximum of ~1.084
 * near L = 8.5ℓ) and it does not round to two decimals. Huang's Example 4.1
 * reads Cx = 1.07 off the chart where the closed form gives 1.079 — a 2 psi
 * difference in the answer, and a good illustration of where chart-reading
 * error actually lives.
 */
export function bradburyC(lengthOverEll: number): number {
  const lam = lengthOverEll / Math.sqrt(8);
  if (!(lam > 1e-6)) return 0;
  return (
    1 -
    (2 * Math.cos(lam) * Math.cosh(lam) * (Math.tan(lam) + Math.tanh(lam))) /
      (Math.sin(2 * lam) + Math.sinh(2 * lam))
  );
}

export interface CurlingResult {
  Cx: number;
  Cy: number;
  /** Interior curling stress in the x direction — Huang Eq. 4.9a. */
  interiorX: number;
  /** Interior curling stress in the y direction. */
  interiorY: number;
  /** Edge curling stress in the x direction — Huang Eq. 4.11. */
  edgeX: number;
  edgeY: number;
}

/**
 * Curling stresses from a temperature differential — Huang Eqs. 4.9a, 4.11.
 *
 *   interior:  σx = Eαt Δt / 2 · (Cx + ν Cy) / (1 − ν²)
 *   edge:      σx = Cx Eαt Δt / 2          (Eq. 4.11 = Eq. 4.9 with ν = 0)
 *
 * @param Lx slab length in x (in)
 * @param Ly slab length in y (in)
 * @param alpha coefficient of thermal expansion (per °F)
 * @param dt  temperature differential top to bottom (°F)
 */
export function curlingStresses(
  E: number, nu: number, ell: number, Lx: number, Ly: number, alpha: number, dt: number
): CurlingResult {
  const Cx = bradburyC(Lx / ell);
  const Cy = bradburyC(Ly / ell);
  const base = (E * alpha * dt) / 2;
  return {
    Cx,
    Cy,
    interiorX: base * ((Cx + nu * Cy) / (1 - nu * nu)),
    interiorY: base * ((Cy + nu * Cx) / (1 - nu * nu)),
    edgeX: base * Cx,
    edgeY: base * Cy,
  };
}
