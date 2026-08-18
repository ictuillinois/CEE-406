// Joints, dowels, tie bars and faulting — pure functions, no React.
//
// Huang (2004) §4.3 (friction and joint opening), §4.4 (dowels and joints),
// §12.1.4 (faulting). Pinned to the printed answers of Examples 4.8, 4.9,
// 4.11, 4.12 and 4.13 by equations.test.mjs.
//
// The tool this backs exists because HW9 asks a student to choose a joint
// spacing and defend it against three failure modes that pull in different
// directions — curling stress wants short slabs, steel and friction cost
// money at every joint, and faulting gets worse as joints open. Nothing here
// resolves that tension; it just makes each side of it computable.
//
// US customary throughout: in, psi, pci, lb, ft where noted.

/** Young's modulus of steel, psi. */
export const E_STEEL = 29e6;

/** Unit weight of concrete, pci (150 pcf). */
export const GAMMA_CONCRETE = 150 / 1728;

/* ───────────────────────── Friction (Huang §4.3) ───────────────────────── */

/**
 * Tensile stress in the slab from subgrade friction — Huang Eq. 4.35.
 *
 *   σc = γc · L · fa / 2
 *
 * Note what is absent: slab thickness. Friction stress does not depend on how
 * thick the slab is, because both the frictional force and the resisting area
 * scale with it. Students reliably expect otherwise.
 *
 * @param L  slab length between joints, in
 * @param fa average coefficient of friction, commonly 1.5
 * @param gamma unit weight of concrete, pci
 */
export const frictionStress = (L: number, fa = 1.5, gamma = GAMMA_CONCRETE) =>
  (gamma * L * fa) / 2;

/**
 * Tensile strength of concrete, taken as 3 to 5 √f'c (Winter and Nilson).
 * Returned as a range because that is how the book gives it.
 */
export const concreteTensileStrength = (fc: number): [number, number] =>
  [3 * Math.sqrt(fc), 5 * Math.sqrt(fc)];

/* ─────────────────── Joint opening (Huang Eq. 4.36) ────────────────────── */

/**
 * Joint opening from temperature drop and drying shrinkage — Eq. 4.36.
 *
 *   ΔL = C · L · (αt · ΔT + ε)
 *
 * @param L  joint spacing, in
 * @param dT temperature range (placement minus lowest mean monthly), °F
 * @param alphaT coefficient of thermal expansion, per °F (5-6 ×10⁻⁶)
 * @param eps drying shrinkage coefficient (0.5-2.5 ×10⁻⁴)
 * @param C  slab-subbase friction adjustment: 0.65 stabilised, 0.80 granular
 */
export const jointOpening = (L: number, dT: number, alphaT: number, eps: number, C: number) =>
  C * L * (alphaT * dT + eps);

/**
 * The joint spacing that just reaches an allowable opening — Eq. 4.36 solved
 * for L. Returned in inches.
 *
 * Typical allowable openings: 0.05 in undoweled (beyond which aggregate
 * interlock is lost), 0.25 in doweled.
 */
export const maxJointSpacing = (allowableOpening: number, dT: number, alphaT: number, eps: number, C: number) => {
  const denom = C * (alphaT * dT + eps);
  return denom > 0 ? allowableOpening / denom : NaN;
};

/* ────────────────────── Tie bars (Huang Eqs. 4.38, 4.40) ───────────────── */

export interface TieBarResult {
  /** Steel area required per unit length of joint, in²/in. */
  asPerIn: number;
  /** Bar spacing for the chosen bar, in. */
  spacing: number;
  /** Embedment length before the misalignment allowance, in. */
  lengthRaw: number;
  /** Length after adding the customary 3 in for misalignment. */
  length: number;
}

/**
 * Tie bar area, spacing and length — Huang Eqs. 4.38 and 4.40.
 *
 *   As = γc · h · L' · fa / fs          (area per unit length)
 *   t  = ½ · fs · d / μ                 (bond length, then +3 in)
 *
 * @param h    slab thickness, in
 * @param Lp   distance from the joint to the free edge, in (the lane width
 *             for a two- or three-lane highway)
 * @param fs   allowable steel stress, psi
 * @param barArea cross-sectional area of one bar, in²
 * @param barDia  bar diameter, in
 * @param mu   allowable bond stress, psi (350 for deformed bars)
 */
export function tieBars(
  h: number, Lp: number, fs: number, barArea: number, barDia: number,
  fa = 1.5, mu = 350, gamma = GAMMA_CONCRETE
): TieBarResult | null {
  if (!(h > 0 && Lp > 0 && fs > 0 && barArea > 0 && barDia > 0 && mu > 0)) return null;
  const asPerIn = (gamma * h * Lp * fa) / fs;
  const lengthRaw = 0.5 * fs * (barDia / mu);
  return {
    asPerIn,
    spacing: barArea / asPerIn,
    lengthRaw,
    length: lengthRaw + 3,
  };
}

/* ──────────────────── Dowels (Huang Eqs. 4.41-4.45) ────────────────────── */

/**
 * Allowable bearing stress between dowel and concrete — Huang Eq. 4.41 (ACI).
 *
 *   fb = (4 − d) f'c / 3
 *
 * A larger dowel is allowed LESS bearing stress, which is the opposite of the
 * intuition most students bring, and the reason the equation is worth staring
 * at before using it.
 */
export const allowableBearingStress = (d: number, fc: number) => ((4 - d) * fc) / 3;

/** Moment of inertia of a round dowel — Huang Eq. 4.43. */
export const dowelInertia = (d: number) => (Math.PI * Math.pow(d, 4)) / 64;

/**
 * Relative stiffness of a dowel embedded in concrete — Huang Eq. 4.44.
 *
 *   β = [K d / (4 Ed Id)]^(1/4)
 *
 * @param K modulus of dowel support, pci (300,000 to 1,500,000)
 */
export const dowelBeta = (d: number, K: number, Ed = E_STEEL) =>
  Math.pow((K * d) / (4 * Ed * dowelInertia(d)), 0.25);

/**
 * Bearing stress on one dowel — Huang Eq. 4.45 (Friberg, after Timoshenko).
 *
 *   σb = K Pt (2 + βz) / (4 β³ Ed Id)
 *
 * @param Pt load carried by that dowel, lb
 * @param z  joint width, in
 */
export function dowelBearingStress(Pt: number, d: number, z: number, K: number, Ed = E_STEEL) {
  const Id = dowelInertia(d);
  const beta = dowelBeta(d, K, Ed);
  return (K * Pt * (2 + beta * z)) / (4 * Math.pow(beta, 3) * Ed * Id);
}

/* ───────────────────────── Dowel group action ──────────────────────────── */

export interface GroupResult {
  /** Effective number of dowels — the sum of the load factors. */
  effectiveDowels: number;
  /** Load factor at each dowel, same order as `positions`. */
  factors: number[];
  /** Load on the dowel nearest the load, lb. */
  criticalLoad: number;
  /** The effective length over which load is shared, in. */
  effectiveLength: number;
}

/**
 * Dowel group action — Huang §4.4.1, after Friberg (1940).
 *
 * Shear in each dowel is assumed to fall off linearly from the dowel under the
 * load to zero at the distance where the negative moment peaks. Friberg put
 * that distance at **1.8ℓ**; Heinrichs et al. (1989) later found **1.0ℓ**,
 * which concentrates the load on fewer dowels and therefore RAISES the
 * critical bearing stress. Huang prints both and notes the newer figure is the
 * better one — but works his examples with 1.8ℓ.
 *
 * §12.1.4 goes further: for faulting, use 1.0ℓ *and* assume only 0.45W crosses
 * the joint instead of 0.5W. This function takes both as parameters rather
 * than choosing.
 *
 * @param loadPos    position of the wheel load along the joint, in
 * @param positions  dowel positions along the joint, in
 * @param ell        radius of relative stiffness, in
 * @param W          total wheel load, lb
 * @param reach      multiplier on ell: 1.8 (Friberg) or 1.0 (Heinrichs)
 * @param transfer   fraction of W crossing the joint: 0.5 or 0.45
 */
export function dowelGroup(
  loadPos: number, positions: number[], ell: number, W: number,
  reach = 1.8, transfer = 0.5
): GroupResult | null {
  if (!(ell > 0 && W > 0 && positions.length)) return null;
  const effectiveLength = reach * ell;
  const factors = positions.map(p =>
    Math.max(0, 1 - Math.abs(p - loadPos) / effectiveLength)
  );
  const effectiveDowels = factors.reduce((s, f) => s + f, 0);
  if (!(effectiveDowels > 0)) return null;
  return {
    effectiveDowels,
    factors,
    criticalLoad: (transfer * W) / effectiveDowels,
    effectiveLength,
  };
}

/**
 * Load on each dowel from several wheel loads at once, superposed.
 *
 * Each load is shared over its own group; a dowel picks up a share from every
 * load whose reach covers it. The critical dowel is usually the one nearest
 * the pavement edge, not the one under the heaviest wheel.
 *
 * @returns load on each dowel, lb, same order as `positions`
 */
export function dowelLoads(
  loads: { pos: number; W: number }[], positions: number[], ell: number,
  reach = 1.8, transfer = 0.5
): number[] | null {
  if (!positions.length || !loads.length || !(ell > 0)) return null;
  const total = new Array(positions.length).fill(0);
  for (const { pos, W } of loads) {
    const g = dowelGroup(pos, positions, ell, W, reach, transfer);
    if (!g) return null;
    // Within one group the loads split in proportion to the load factors.
    g.factors.forEach((f, i) => { total[i] += f * g.criticalLoad; });
  }
  return total;
}

/** Evenly spaced dowels across a lane, first one `edgeOffset` from the edge. */
export function dowelPositions(laneWidth: number, spacing: number, edgeOffset: number): number[] {
  const out: number[] = [];
  for (let p = edgeOffset; p <= laneWidth - edgeOffset + 1e-9; p += spacing) out.push(p);
  return out;
}

/* ──────────────────── Faulting (Huang Eq. 12.3) ────────────────────────── */

/**
 * Faulting of doweled JPCP/JRCP — Huang Eq. 12.3, the COPES regression over
 * 280 sections.
 *
 *   F = N18^0.5377 [2.2073 + 0.002171 S^0.4918
 *                   + 0.0003292 JS^1.0793 − 2.1397 k^0.01305]
 *
 * @param n18 equivalent 18-kip single-axle loads, MILLIONS
 * @param S   maximum dowel bearing stress, psi
 * @param JS  transverse joint spacing, ft
 * @param k   modulus of subgrade reaction on top of the subbase, pci
 * @returns faulting in inches
 *
 * Huang's own caution, worth passing on verbatim: "This model must not be used
 * to predict faulting by extrapolation beyond the data range used in its
 * generation." Open-graded drainable bases in particular were not in the data.
 */
export function faulting(n18: number, S: number, JS: number, k: number): number {
  if (!(n18 > 0 && S > 0 && JS > 0 && k > 0)) return NaN;
  const bracket =
    2.2073 +
    0.002171 * Math.pow(S, 0.4918) +
    0.0003292 * Math.pow(JS, 1.0793) -
    2.1397 * Math.pow(k, 0.01305);
  return Math.pow(n18, 0.5377) * bracket;
}

/**
 * The bearing stress below which §12.1.4 says faulting stays acceptable.
 * Not a code limit — an observation from the same data the model came from.
 */
export const FAULTING_BEARING_LIMIT = 1500;

/**
 * The bearing-stress range Figure 12.5 plots, and beyond which Eq. 12.3 is an
 * extrapolation. Huang is explicit: "This model must not be used to predict
 * faulting by extrapolation beyond the data range used in its generation."
 */
export const FAULTING_DATA_RANGE: [number, number] = [1000, 3500];

/** Is this bearing stress inside the range Eq. 12.3 was calibrated over? */
export const faultingInRange = (S: number) =>
  S >= FAULTING_DATA_RANGE[0] && S <= FAULTING_DATA_RANGE[1];

/* ─────────────────────── Recommended dowel sizes ───────────────────────── */

/**
 * PCA (1975) dowel size and length by slab thickness, Huang Table 4.4 — the
 * diameter is one eighth of the slab thickness. PCA's 1991 guidance moved to a
 * flat 1.25 in diameter for highway pavements, which is why the tool offers
 * the rule as a suggestion rather than applying it.
 */
export const suggestedDowel = (h: number) => ({
  diameter: h / 8,
  length: h <= 6 ? 12 : h <= 11 ? 14 : 16,
  spacing: 12,
});
