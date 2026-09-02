// Two-layer (Burmister) design quantities — the things Huang's Chapter 2
// charts plot, computed rather than read.
//
// Sections 2.2.1 covers five design charts. Every one of them is a picture of
// a two-layer elastic solution at a particular point, so each is reproduced
// here by calling the n-layer solver in lea.ts with n = 2:
//
//   Figure 2.14  σz/q down the axis, at h1/a = 1        verticalStressProfile
//   Figure 2.15  σc/q at the interface, vs a/h1         interfaceStressRatio
//   Figure 2.17  surface deflection factor F2           surfaceDeflectionFactor
//   Figure 2.19  interface deflection factor F          interfaceDeflectionFactor
//   Figure 2.21  strain factor Fe, single wheel         strainFactor
//   Figures 2.23, 2.25-2.27  conversion factor C        conversionFactor
//
// EVERY CHART IN THIS SECTION ASSUMES ν = 0.5 IN BOTH LAYERS. Huang states it
// once, on page 58 — "As in all charts presented in this section, a Poisson
// ratio of 0.5 is assumed for all layers" — and it is easy to lose. The
// functions here take no ν; CHART_NU is baked in, and a caller who wants a
// different Poisson ratio wants leaResponse, not this module.
//
// Every quantity is dimensionless in (E1/E2, h1/a, r/a), which is why one
// chart serves every load. The implementation therefore fixes a = 1 and
// E2 = 1 and varies only the ratios.
//
// Validated in twoLayer.test.mjs against the chart reads printed in Huang's
// Examples 2.5 through 2.10.
import { leaResponse, leaSuperpose, type Layer } from './lea.ts';

/** The Poisson ratio every two-layer chart in §2.2.1 assumes. */
export const CHART_NU = 0.5;

/** A two-layer system with unit radius and unit subgrade modulus. */
const system = (modulusRatio: number, h1OverA: number): Layer[] => [
  { h: h1OverA, E: modulusRatio, nu: CHART_NU },
  { h: 0, E: 1, nu: CHART_NU },
];

/* ── Figure 2.14: how a stiff layer redistributes vertical stress ───────── */

/**
 * σz/q on the axis at depth z/a, for a two-layer system with h1/a = 1 —
 * the case Figure 2.14 is drawn for.
 *
 * At the interface this is about 0.68 of the applied pressure when
 * E1/E2 = 1 (Boussinesq) and about 0.08 when E1/E2 = 100, which is the whole
 * argument for building a pavement.
 */
export function verticalStressProfile(
  modulusRatio: number, zOverA: number, h1OverA = 1
): number {
  const R = leaResponse(system(modulusRatio, h1OverA), 1, 1, 0, zOverA);
  return R ? R.sigZ : NaN;
}

/* ── Figure 2.15: vertical interface stress ─────────────────────────────── */

/**
 * σc/q — the vertical stress delivered to the top of the subgrade, under the
 * center of the load. Figure 2.15 plots it against a/h1 rather than h1/a,
 * "for the purpose of preparing influence charts" (Huang 1969b).
 *
 * @param aOverH1 contact radius divided by layer-1 thickness
 */
export function interfaceStressRatio(modulusRatio: number, aOverH1: number): number {
  if (!(aOverH1 > 0)) return NaN;
  const h1 = 1 / aOverH1;
  const R = leaResponse(system(modulusRatio, h1), 1, 1, 0, h1);
  return R ? R.sigZ : NaN;
}

/**
 * The thickness a/h1 at which the interface stress reaches a target σc/q —
 * the direction Example 2.5 actually reads Figure 2.15 in.
 *
 * σc/q rises monotonically with a/h1 (a thinner layer sheds more stress), so
 * a bisection is safe and always converges to the single crossing.
 */
export function requiredAOverH1(modulusRatio: number, targetRatio: number): number | null {
  if (!(targetRatio > 0 && targetRatio < 1)) return null;
  let lo = 0.02, hi = 6;
  if (interfaceStressRatio(modulusRatio, hi) < targetRatio) return null;
  if (interfaceStressRatio(modulusRatio, lo) > targetRatio) return null;
  for (let i = 0; i < 44; i++) {
    const mid = 0.5 * (lo + hi);
    if (interfaceStressRatio(modulusRatio, mid) < targetRatio) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

/**
 * Allowable stress repetitions on the subgrade — Huang Eq. 2.13, from
 * Huang et al. (1984b), fitted to the Shell criterion and the AASHTO equation.
 *
 *   Nd = 4.873e-5 · σc^-3.734 · E2^3.583
 *
 * US units only: σc and E2 in psi. The exponents carry the units, so there is
 * no metric form of this equation — feeding it kPa gives a number with no
 * meaning, which is why it is kept apart from the dimensionless factors above.
 */
export const allowableRepetitions = (sigmaC_psi: number, E2_psi: number) =>
  4.873e-5 * Math.pow(sigmaC_psi, -3.734) * Math.pow(E2_psi, 3.583);

/* ── Figure 2.17: vertical surface deflection ───────────────────────────── */

/**
 * The deflection factor F2 of Eq. 2.14, w0 = 1.5·q·a·F2/E2.
 *
 * The 1.5 is there so that F2 = 1 for a homogeneous half-space at ν = 0.5,
 * where Eq. 2.14 becomes Eq. 2.8. A rigid plate uses Eq. 2.15 instead, with
 * 1.18 in place of 1.5 — the same π/4 = 79% factor as Eq. 2.10.
 */
export function surfaceDeflectionFactor(modulusRatio: number, h1OverA: number): number {
  if (h1OverA <= 0) return 1;
  const R = leaResponse(system(modulusRatio, h1OverA), 1, 1, 0, 0);
  return R ? R.w / 1.5 : NaN;
}

/**
 * Invert Figure 2.17 for E1/E2, which is how Example 2.6 uses it: a plate
 * bearing test gives F2 and h1/a, and the unknown is the modulus of layer 1.
 *
 * F2 falls monotonically with the modulus ratio at fixed h1/a.
 */
export function modulusRatioFromF2(F2: number, h1OverA: number): number | null {
  if (!(F2 > 0 && F2 <= 1.001 && h1OverA > 0)) return null;
  let lo = 1, hi = 20000;
  if (surfaceDeflectionFactor(hi, h1OverA) > F2) return null;
  if (surfaceDeflectionFactor(lo, h1OverA) < F2) return null;
  for (let i = 0; i < 60; i++) {
    const mid = Math.sqrt(lo * hi);            // bisect in log — the chart's axis
    if (surfaceDeflectionFactor(mid, h1OverA) > F2) lo = mid;
    else hi = mid;
  }
  return Math.sqrt(lo * hi);
}

/* ── Figure 2.19: vertical interface deflection ─────────────────────────── */

/**
 * The deflection factor F of Eq. 2.16, w = q·a·F/E2, at radial distance r
 * on the layer-1 / layer-2 interface.
 *
 * Note F differs from F2 of Eq. 2.14 by the factor 1.5 — Huang says so
 * explicitly under Figure 2.19, and it is the easiest slip to make when
 * moving between the two charts. Huang prints seven panels, for E1/E2 = 1,
 * 2.5, 5, 10, 25, 50 and 100; here the ratio is continuous.
 */
export function interfaceDeflectionFactor(
  modulusRatio: number, h1OverA: number, rOverA: number
): number {
  const R = leaResponse(system(modulusRatio, h1OverA), 1, 1, rOverA, h1OverA);
  return R ? R.w : NaN;
}

/* ── Figure 2.21: critical tensile strain, single wheel ─────────────────── */

/**
 * The radial stations Huang searched. From §2.2.1: "when both h1/a and E1/E2
 * are small, the critical tensile strain occurs at some distance from the
 * center, as the predominant effect of the shear stress. Under such
 * situations, the principal tensile strains at the radial distances 0, 0.5a,
 * a, and 1.5a from the center were computed, and the critical value was
 * obtained and plotted in Figure 2.21."
 */
const SINGLE_STATIONS = [0, 0.5, 1, 1.5];

/**
 * Largest tensile principal strain at the bottom of layer 1, as a positive
 * magnitude, for a set of loads — the "overall principal strain based on all
 * six components of normal and shear stresses" of §2.2.1.
 *
 * Huang notes the overall strain is slightly greater than the horizontal
 * principal strain KENLAYER reports, "so the use of overall principal strain
 * is on the safe side".
 */
function criticalTension(
  layers: Layer[], a: number, h1: number,
  wheels: { x: number; y: number }[],
  stations: { x: number; y: number }[]
): { value: number; at: { x: number; y: number } } {
  const z = h1 * (1 - 1e-9);          // just inside the bottom of layer 1
  let value = 0;
  let at = { x: 0, y: 0 };
  for (const p of stations) {
    const S = leaSuperpose(layers, 1, a, wheels, { x: p.x, y: p.y, z });
    if (S && S.tensile > value) { value = S.tensile; at = p; }
  }
  return { value, at };
}

/**
 * The strain factor Fe of Eq. 2.17, e = q·Fe/E1, for a single wheel —
 * Figure 2.21.
 *
 * Because the interface is bonded, the tensile strain at the bottom of layer
 * 1 equals that at the top of layer 2; and if layer 2 is incompressible and
 * the critical strain is on the axis, Eq. 2.21 makes the vertical compressive
 * strain twice the horizontal one. So this chart also gives the subgrade
 * strain — Huang points this out after Example 2.8.
 */
export function strainFactor(modulusRatio: number, h1OverA: number): number {
  if (!(h1OverA > 0 && modulusRatio > 0)) return NaN;
  const layers = system(modulusRatio, h1OverA);
  const stations = SINGLE_STATIONS.map(x => ({ x, y: 0 }));
  // e = q·Fe/E1 with q = 1, so Fe = strain × E1.
  return criticalTension(layers, 1, h1OverA, [{ x: 0, y: 0 }], stations).value * modulusRatio;
}

/* ── Figures 2.23, 2.25-2.27: the dual and dual-tandem conversion factor ── */

/** The dual spacing every conversion-factor chart is drawn for. */
export const CHART_SD = 24;
/** The two contact radii the paired panels of each chart are drawn for. */
export const CHART_RADII: [number, number] = [3, 8];
/**
 * The tandem spacing Figure 2.23 stands in for. Huang: "when St = 120 in.
 * the conversion factor due to dual-tandem wheels does not differ
 * significantly from that due to dual wheels alone, so Figure 2.23 can be
 * considered to have a tandem spacing of 120 in."
 */
export const DUAL_AS_TANDEM_ST = 120;

/**
 * Plan stations searched for the critical point under a wheel group.
 *
 * The critical point sits on the axle line, y = 0, in every case in the
 * charts' domain — a full quarter-plane sweep over modulus ratios 2 to 200,
 * h1/a from 1 to 6 and every tandem spacing the charts carry never found a
 * maximum off it, and never by more than roundoff. Both symmetries say it
 * should: the group is symmetric about y = 0 for duals and about y = St/2 for
 * tandems, and the second is a minimum of the load rather than a maximum.
 *
 * So the sweep is a LINE, not a patch — the difference between a chart that
 * redraws in under a second and one that takes half a minute. Four off-axis
 * probes stay in as a guard, so a case that does leave the line is caught
 * rather than quietly missed.
 */
function groupStations(a: number, sd: number, st: number | null) {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i <= 6; i++) out.push({ x: (i / 6) * (sd / 2), y: 0 });
  for (const d of [0.5, 1.5]) out.push({ x: -d * a, y: 0 });
  const yMax = st ? st / 2 : 1.5 * a;
  out.push({ x: 0, y: yMax });
  out.push({ x: sd / 2, y: yMax });
  return out;
}

/**
 * The conversion factor C of §2.2.1 — the ratio between the strain factor for
 * a wheel group and that for a single wheel at the same h1/a and E1/E2.
 * Multiplying Figure 2.21's Fe by C gives the group's strain factor.
 *
 * @param modulusRatio E1/E2
 * @param h1           thickness of the asphalt layer, in inches
 * @param a            contact radius, in inches (the charts use 3 and 8)
 * @param sd           dual spacing, in inches (the charts use 24)
 * @param st           tandem spacing in inches, or null for duals alone
 */
export function conversionFactor(
  modulusRatio: number, h1: number, a: number,
  sd = CHART_SD, st: number | null = null
): number {
  if (!(h1 > 0 && a > 0 && modulusRatio > 0)) return NaN;
  const h1OverA = h1 / a;
  const layers = system(modulusRatio, h1OverA);

  // Everything is dimensionless in (h1/a, sd/a, st/a), so the whole geometry
  // is scaled to the unit contact radius the system above is built with.
  const s = sd / a;
  const t = st === null ? null : st / a;
  const wheels = t === null
    ? [{ x: 0, y: 0 }, { x: s, y: 0 }]
    : [{ x: 0, y: 0 }, { x: s, y: 0 }, { x: 0, y: t }, { x: s, y: t }];

  // Coarse sweep, then a refinement around whichever station won. The maximum
  // is a smooth ridge along the axle line, so seven coarse points bracket it
  // and four fine ones resolve it — half the solves of a uniform grid dense
  // enough to do both, which is what makes the chart drawable at all.
  const coarse = groupStations(1, s, t);
  const first = criticalTension(layers, 1, h1OverA, wheels, coarse);
  const step = s / 12;
  const refined: { x: number; y: number }[] = [];
  for (const d of [-1, -0.5, 0.5, 1]) {
    const x = first.at.x + d * step;
    if (x >= -2 && x <= s / 2 + 1) refined.push({ x, y: first.at.y });
  }
  const second = criticalTension(layers, 1, h1OverA, wheels, refined);

  const single = criticalTension(
    layers, 1, h1OverA, [{ x: 0, y: 0 }], SINGLE_STATIONS.map(x => ({ x, y: 0 }))
  );
  const group = Math.max(first.value, second.value);
  return single.value > 0 ? group / single.value : NaN;
}

/**
 * Eq. 2.18: rescale a real wheel group to the Sd = 24 in. the charts are
 * drawn for, holding h1/a and Sd/a — and therefore the answer — fixed.
 *
 *   a' = 24a/Sd,   h1' = 24·h1/Sd,   St' = 24·St/Sd
 */
export function modifiedGeometry(a: number, h1: number, sd: number, st?: number) {
  const k = CHART_SD / sd;
  return { a: k * a, h1: k * h1, st: st === undefined ? undefined : k * st };
}

/**
 * Eq. 2.19: interpolate the conversion factor between the chart's two
 * contact radii, 3 in. and 8 in.
 *
 *   C = C1 + 0.2(a' - 3)(C2 - C1)
 *
 * The 0.2 is 1/(8 - 3). Huang notes the change with contact radius is small
 * enough that a straight line is accurate.
 */
export const interpolateByRadius = (aPrime: number, c1: number, c2: number) =>
  c1 + 0.2 * (aPrime - CHART_RADII[0]) * (c2 - c1);

/**
 * The full Example 2.9 / 2.10 procedure: a real dual or dual-tandem group,
 * converted to the chart geometry, read at both radii, and interpolated.
 *
 * Returns the pieces as well as the answer, because the intermediate values
 * are exactly what a student is asked to show.
 */
export function groupStrainFactor(
  modulusRatio: number, h1: number, a: number, sd: number, st?: number
) {
  const mod = modifiedGeometry(a, h1, sd, st);
  const c1 = conversionFactor(modulusRatio, mod.h1, CHART_RADII[0], CHART_SD, mod.st ?? null);
  const c2 = conversionFactor(modulusRatio, mod.h1, CHART_RADII[1], CHART_SD, mod.st ?? null);
  const C = interpolateByRadius(mod.a, c1, c2);
  const single = strainFactor(modulusRatio, h1 / a);
  return { modified: mod, c1, c2, C, singleFactor: single, groupFactor: C * single };
}
