// Three-layer systems in Jones' and Peattie's parametrization — Huang §2.2.2.
//
// Jones (1962) tabulated the stresses at the two interfaces on the axis of
// symmetry; Peattie (1962) plotted the same numbers as Figure 2.31. Both are
// organized around four dimensionless groups (Eq. 2.22):
//
//     k1 = E1/E2      k2 = E2/E3      A = a/h2      H = h1/h2
//
// and four stress factors, whose products with the contact pressure are the
// stresses (Eq. 2.24):
//
//     σz1 = q·ZZ1                σz1 - σr1 = q·(ZZ1 - RR1)
//     σz2 = q·ZZ2                σz2 - σr2 = q·(ZZ2 - RR2)
//
// Huang keeps the tables because interpolating them is what a student had in
// 1962; he also says what they cost — "if all four parameters are different
// from those in the table, the total effort required will be 3 x 3 x 3 x 3, or
// 81 times". Here the four groups are continuous, because the factors are
// computed from the same layered solution the tables were computed from.
//
// That this is legitimate is not assumed. threeLayer.test.mjs checks the
// computed factors against the four values Jones' table gives for Example
// 2.11 and reproduces them to five significant figures.
//
// Sign convention: compression positive, as in Huang's table.
import { leaResponse, type Layer } from './lea.ts';

/**
 * The Poisson ratio Jones' tables and Peattie's charts assume. Huang states
 * it at Eq. 2.20: "When the Poisson ratio is 0.5..." — the whole three-layer
 * treatment in §2.2.2 rests on it, because Eq. 2.21's εz = -2εr does.
 */
export const CHART_NU = 0.5;

/** The four dimensionless groups of Eq. 2.22. */
export interface ThreeLayerParams {
  /** k1 = E1/E2. */
  k1: number;
  /** k2 = E2/E3. */
  k2: number;
  /** A = a/h2 — contact radius over the thickness of layer 2. */
  A: number;
  /** H = h1/h2 — thickness of layer 1 over thickness of layer 2. */
  H: number;
}

/** The four stress factors Jones tabulates, plus everything they imply. */
export interface ThreeLayerFactors {
  ZZ1: number;
  ZZ2: number;
  ZZ1_RR1: number;
  ZZ2_RR2: number;
  /** The quantity Peattie's Figure 2.31 plots: (RR1 - ZZ1)/2, as drawn. */
  peattie: number;
}

/**
 * Build the layer stack the groups describe. Only ratios matter, so h2 = 1
 * and E3 = 1; then h1 = H, a = A, E2 = k2 and E1 = k1·k2.
 */
function systemFor(p: ThreeLayerParams): { layers: Layer[]; a: number } {
  return {
    layers: [
      { h: p.H, E: p.k1 * p.k2, nu: CHART_NU },
      { h: 1, E: p.k2, nu: CHART_NU },
      { h: 0, E: 1, nu: CHART_NU },
    ],
    a: p.A,
  };
}

/**
 * The four stress factors of Table 2.3 at the two interfaces, on the axis.
 *
 * Evaluated just INSIDE the bottom of each layer. σz is continuous across an
 * interface so it does not matter there, but σr jumps, and the table's
 * RR1 and RR2 are the values at the bottom of layers 1 and 2. Huang notes
 * that the top-of-next-layer values Jones also tabulates "are actually not
 * necessary because they can be easily determined from those at the bottom" —
 * by Eq. 2.23, which divides the difference by the modulus ratio.
 */
export function stressFactors(p: ThreeLayerParams): ThreeLayerFactors | null {
  if (!(p.k1 > 0 && p.k2 > 0 && p.A > 0 && p.H > 0)) return null;
  const { layers, a } = systemFor(p);
  const z1 = p.H * (1 - 1e-9);
  const z2 = (p.H + 1) * (1 - 1e-9);

  const R1 = leaResponse(layers, 1, a, 0, z1);
  const R2 = leaResponse(layers, 1, a, 0, z2);
  if (!R1 || !R2) return null;

  const ZZ1 = R1.sigZ, ZZ2 = R2.sigZ;
  const ZZ1_RR1 = R1.sigZ - R1.sigR;
  const ZZ2_RR2 = R2.sigZ - R2.sigR;
  return { ZZ1, ZZ2, ZZ1_RR1, ZZ2_RR2, peattie: ZZ1_RR1 / 2 };
}

/** Everything Example 2.11 asks for, at both interfaces and on both sides. */
export interface ThreeLayerState {
  factors: ThreeLayerFactors;
  /** Bottom of layer 1. */
  bot1: { sigZ: number; sigR: number; epsZ: number; epsR: number };
  /** Top of layer 2 — same strains as bot1, different stresses. */
  top2: { sigZ: number; sigR: number; epsZ: number; epsR: number };
  /** Bottom of layer 2. */
  bot2: { sigZ: number; sigR: number; epsZ: number; epsR: number };
  /** Top of layer 3. */
  top3: { sigZ: number; sigR: number; epsZ: number; epsR: number };
}

/**
 * The full interface state, worked exactly the way Example 2.11 works it —
 * factors from the table, stresses from Eq. 2.24, the other side of each
 * interface from Eq. 2.23, and strains from Eq. 2.20 at ν = 0.5:
 *
 *     εz = (σz - σr)/E        εr = -(σz - σr)/(2E)
 *
 * so εz = -2εr, which is Eq. 2.21: at ν = 0.5 the material is incompressible
 * and the three strains must sum to zero.
 *
 * @param q  contact pressure
 * @param E1 modulus of layer 1, in the same unit as q (E2 and E3 follow from
 *           k1 and k2, so only one absolute modulus is needed)
 */
export function threeLayerState(
  p: ThreeLayerParams, q: number, E1: number
): ThreeLayerState | null {
  const f = stressFactors(p);
  if (!f || !(q > 0 && E1 > 0)) return null;

  const E2 = E1 / p.k1;
  const E3 = E2 / p.k2;

  // Eq. 2.24.
  const sigZ1 = q * f.ZZ1;
  const sigZ2 = q * f.ZZ2;
  const dev1 = q * f.ZZ1_RR1;         // (σz - σr) at the bottom of layer 1
  const dev2 = q * f.ZZ2_RR2;         // (σz - σr) at the bottom of layer 2

  // Eq. 2.23: the radial strain is continuous, so the deviator on the far
  // side of an interface is the near-side deviator divided by the modulus
  // ratio across it.
  const dev1Top2 = dev1 / p.k1;
  const dev2Top3 = dev2 / p.k2;

  // Eq. 2.20 at ν = 0.5.
  const pack = (sigZ: number, dev: number, E: number) => ({
    sigZ,
    sigR: sigZ - dev,
    epsZ: dev / E,
    epsR: -dev / (2 * E),
  });

  return {
    factors: f,
    bot1: pack(sigZ1, dev1, E1),
    top2: pack(sigZ1, dev1Top2, E2),
    bot2: pack(sigZ2, dev2, E2),
    top3: pack(sigZ2, dev2Top3, E3),
  };
}

/**
 * The radial strain at the bottom of layer 1 — Eq. 2.25, which is how
 * Figure 2.31 is used:
 *
 *     εr = (q/E1)·(RR1 - ZZ1)/2
 *
 * Returned as a NEGATIVE number, because this site takes compression as
 * positive and the strain at the bottom of layer 1 is tension. Huang prints
 * the chart's ordinate as the positive magnitude and then says in the text
 * that "the radial strains at the bottom of layer 1 should be in tension".
 */
export function radialStrainBottomLayer1(
  p: ThreeLayerParams, q: number, E1: number
): number | null {
  const f = stressFactors(p);
  return f ? (-q / E1) * f.peattie : null;
}

/**
 * Convert a physical section to the four groups — the step Example 2.11
 * opens with, and the one where a sign of trouble is a group outside the
 * range Jones tabulated.
 */
export function groupsFor(
  E1: number, E2: number, E3: number, h1: number, h2: number, a: number
): ThreeLayerParams {
  return { k1: E1 / E2, k2: E2 / E3, A: a / h2, H: h1 / h2 };
}

/**
 * The values Jones tabulated, for saying whether a case is inside the table
 * or is being extrapolated.
 *
 * Jones' own tables carry k1 and k2 ∈ {0.2, 2, 20, 200}; Huang reprints only
 * "the more realistic cases (k1 = 2, 20, and 200, and k2 = 2 and 20)" to save
 * space, which is also the set Peattie's six panels cover.
 */
export const JONES_K = [0.2, 2, 20, 200];
export const HUANG_K1 = [2, 20, 200];
export const HUANG_K2 = [2, 20];
/** The A and H values Peattie's charts carry. */
export const PEATTIE_A = [0.1, 0.2, 0.4, 0.8, 1.6, 3.2];
export const PEATTIE_H = [0.125, 0.25, 0.5, 1, 2, 4, 8];
