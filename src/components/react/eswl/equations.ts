// Equivalent single-wheel load — pure functions, no React.
//
// Huang (2004) §6.2. Four published criteria for converting a set of dual
// wheels into one equivalent wheel, which is the whole point: they disagree.
// On Huang's own Example 6.1 configuration they span 5630 to 7410 lb, a 32%
// range, and the book's comment on the two that happen to agree is that "the
// close agreement between the two methods is a coincidence".
//
// Huang's warning is the thing to carry away, and it is stronger than it
// looks: "Any theoretical method can be used only as a guide and should be
// verified by performance... Erroneous results may be obtained if different
// ESWL methods are transposed for a given set of design curves." The method
// is not separable from the design chart it was built for.
//
// US customary: in, lb, psi.
import { sigZAt, deflectionFactorAt } from '../stress/equations.ts';

/** Clearance between dual tyres: centre spacing less two contact radii. */
export const dualClearance = (Sd: number, a: number) => Sd - 2 * a;

/* ─────────────── 1. Boyd and Foster, equal vertical stress ─────────────── */

/**
 * The empirical ESWL of Boyd and Foster (1950) — Huang Eq. 6.1.
 *
 *   log(ESWL) = log Pd + 0.301 · log(2z/d) / log(4Sd/d)
 *
 * A straight line on log-log axes between two anchors that need no theory at
 * all: at z = d/2 the two stress bulbs have not met, so ESWL = Pd; at
 * z = 2Sd they have merged completely, so ESWL = 2Pd. Everything between is
 * interpolation.
 *
 * @param Pd load on ONE of the dual tyres, lb
 * @param z  pavement thickness, in
 * @param Sd centre-to-centre dual spacing, in
 * @param a  contact radius of one tyre, in
 */
export function eswlBoydFoster(Pd: number, z: number, Sd: number, a: number): number {
  const d = dualClearance(Sd, a);
  if (!(Pd > 0 && z > 0 && d > 0)) return NaN;
  if (z <= d / 2) return Pd;          // bulbs have not overlapped
  if (z >= 2 * Sd) return 2 * Pd;     // fully overlapped
  const logE = Math.log10(Pd) + 0.301 * (Math.log10((2 * z) / d) / Math.log10((4 * Sd) / d));
  return Math.pow(10, logE);
}

/* ───────── The three candidate points beneath a set of duals ───────────── */

/**
 * Huang Figure 6.3: the maximum response under duals is not known in advance,
 * so it is found by comparing three points — under one tyre, midway between
 * the tyres, and halfway between those two.
 */
export const candidatePoints = (Sd: number) => [0, Sd / 4, Sd / 2];

export interface CriterionResult {
  /** ESWL, lb. */
  eswl: number;
  /** Response factor under the duals at the governing point. */
  dualFactor: number;
  /** Response factor under a single wheel. */
  singleFactor: number;
  /** Which of the three candidate points governed (0, 1 or 2). */
  governingPoint: number;
  /** The factor at each candidate point, for the working. */
  factors: number[];
}

/* ────────────── 2. Boussinesq, equal vertical subgrade stress ──────────── */

/**
 * Theoretical ESWL on the equal-vertical-stress criterion — Huang Eq. 6.3.
 *
 *   ESWL / Pd = (σz/q)_dual / (σz/q)_single
 *
 * Superposes the two tyres at each candidate point and takes the worst.
 * Huang's Example 6.2 reads the factors off Figure 2.2; this integrates the
 * Boussinesq kernel instead, so no chart is involved.
 */
export function eswlEqualStress(Pd: number, z: number, Sd: number, a: number): CriterionResult | null {
  if (!(Pd > 0 && z > 0 && Sd > 0 && a > 0)) return null;
  const pts = candidatePoints(Sd);
  const factors = pts.map(r => sigZAt(r, z, 1, a) + sigZAt(Math.abs(Sd - r), z, 1, a));
  const dualFactor = Math.max(...factors);
  const singleFactor = sigZAt(0, z, 1, a);
  return {
    eswl: (dualFactor / singleFactor) * Pd,
    dualFactor, singleFactor,
    governingPoint: factors.indexOf(dualFactor),
    factors,
  };
}

/* ────────── 3. Foster and Ahlvin, equal vertical deflection ────────────── */

/**
 * ESWL on the equal-deflection criterion — Huang Eq. 6.6.
 *
 *   ESWL / Pd = F_dual / F_single
 *
 * Foster and Ahlvin (1958) introduced this after accelerated traffic tests
 * showed Boyd and Foster's method was "not very safe". Deflection spreads
 * wider than stress, so the two tyres interact more and the ESWL is larger.
 */
export function eswlEqualDeflection(
  Pd: number, z: number, Sd: number, a: number, nu = 0.5
): CriterionResult | null {
  if (!(Pd > 0 && z > 0 && Sd > 0 && a > 0)) return null;
  const pts = candidatePoints(Sd);
  const factors = pts.map(r =>
    deflectionFactorAt(r, z, a, nu) + deflectionFactorAt(Math.abs(Sd - r), z, a, nu)
  );
  const dualFactor = Math.max(...factors);
  const singleFactor = deflectionFactorAt(0, z, a, nu);
  return {
    eswl: (dualFactor / singleFactor) * Pd,
    dualFactor, singleFactor,
    governingPoint: factors.indexOf(dualFactor),
    factors,
  };
}

/* ───────────────── 4. Equal tensile strain (Huang Eq. 6.14) ────────────── */

/**
 * ESWL on the equal-tensile-strain criterion — Huang Eq. 6.14.
 *
 *   ESWL = C · Pd
 *
 * where C is the conversion factor read from Figures 2.23, 2.25-2.27 for a
 * two-layer system. Those charts are not digitised here, so C is an input —
 * the student reads it, as they would in practice.
 *
 * This is the only one of the four that knows the pavement is layered rather
 * than a half-space, which matters: the tensile strain at the bottom of the
 * asphalt is what cracks it, and a half-space has no such interface.
 */
export const eswlEqualStrain = (Pd: number, C: number) => C * Pd;

/**
 * The modified geometry Huang Eq. 2.18 requires before Figure 2.23 can be
 * entered: the charts are drawn for a fixed dual spacing of 24 in, so a and
 * h1 are scaled by 24/Sd.
 */
export function modifiedGeometry(a: number, h1: number, Sd: number) {
  const f = 24 / Sd;
  return { aPrime: f * a, h1Prime: f * h1, scale: f };
}

/* ────────────────────── The comparison, assembled ──────────────────────── */

export interface EswlComparison {
  boydFoster: number;
  equalStress: CriterionResult | null;
  equalDeflection: CriterionResult | null;
  equalStrain: number | null;
  /** Lowest and highest ESWL across the criteria that returned a number. */
  range: [number, number];
  /** Spread as a percentage of the lowest. */
  spreadPct: number;
  /** Total load on the duals, for reference. */
  totalLoad: number;
}

/**
 * Every criterion at once, so the disagreement is the output rather than a
 * footnote. `C` is optional — omit it and the strain criterion is skipped.
 */
export function compareEswl(
  Pd: number, z: number, Sd: number, a: number, C?: number, nu = 0.5
): EswlComparison | null {
  if (!(Pd > 0 && z > 0 && Sd > 0 && a > 0)) return null;
  const boydFoster = eswlBoydFoster(Pd, z, Sd, a);
  const equalStress = eswlEqualStress(Pd, z, Sd, a);
  const equalDeflection = eswlEqualDeflection(Pd, z, Sd, a, nu);
  const equalStrain = C && C > 0 ? eswlEqualStrain(Pd, C) : null;

  const values = [
    boydFoster,
    equalStress?.eswl,
    equalDeflection?.eswl,
    equalStrain,
  ].filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

  const lo = Math.min(...values), hi = Math.max(...values);
  return {
    boydFoster, equalStress, equalDeflection, equalStrain,
    range: [lo, hi],
    spreadPct: lo > 0 ? (100 * (hi - lo)) / lo : NaN,
    totalLoad: 2 * Pd,
  };
}

/**
 * The two anchors of Boyd and Foster's construction, which are worth showing
 * because they are the only part of it that is not interpolation.
 */
export const boydFosterAnchors = (Sd: number, a: number) => ({
  noOverlap: dualClearance(Sd, a) / 2,
  fullOverlap: 2 * Sd,
});
