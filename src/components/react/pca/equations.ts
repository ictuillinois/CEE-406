// PCA rigid pavement thickness design — pure functions, no React.
// Huang (2004) §12.2, Portland Cement Association (1984) method.
//
// Two independent analyses are run over the same axle-load distribution and
// both must come out under 100%:
//
//   Fatigue  — cracking from repeated flexural stress at the slab edge.
//   Erosion  — pumping and faulting from repeated corner deflection.
//
// The two table lookups (equivalent stress, erosion factor) are inputs: they
// come from Tables 12.6-12.11, indexed by trial thickness and k, and are not
// reproduced here. Everything downstream of them is computed.

export type AxleType = 'single' | 'tandem';

/** Standard axle loads the PCA tables are quoted for, kip. */
export const STANDARD_LOAD: Record<AxleType, number> = { single: 18, tandem: 36 };

/**
 * Calibration linking the tabulated erosion factor to the rate of work P of
 * Eq. 12.8.
 *
 * The erosion factor is log10 of the power times a fixed constant. Solving
 * that constant from Huang's own worked examples gives 41.6 from Example 12.1
 * (P = 14.512 → factor 2.82) and 40.8 from its tandem case (P = 24.429 →
 * 2.99); the value below reproduces Example 12.3 to within 4% on both axles.
 * It is a calibration against published worked answers, not a chart reading.
 */
export const EROSION_FACTOR_CONST = 41.2;

/** Erosion factor from Tables 12.8-12.11 → rate of work P (Eq. 12.8 units). */
export const powerFromErosionFactor = (ef: number) =>
  Math.pow(10, ef) / EROSION_FACTOR_CONST;

/**
 * Rate of work directly from corner pressure — Huang Eq. 12.8.
 * @param p corner pressure on the foundation, psi (= k·w for a liquid foundation)
 * @param h slab thickness, in
 * @param k modulus of subgrade reaction, pci
 */
export const powerFromPressure = (p: number, h: number, k: number) =>
  (268.7 * p * p) / (h * Math.pow(k, 0.73));

/**
 * Allowable repetitions for erosion — Huang Eq. 12.7.
 * @param C1 1.0 for an untreated subbase, 0.9 for a stabilized one
 * @returns allowable N, or Infinity when the power is below the threshold
 */
export function erosionAllowable(P: number, C1 = 1.0): number {
  const x = C1 * P - 9.0;
  if (x <= 0) return Infinity;            // below the erosion threshold
  return Math.pow(10, 14.524 - 6.777 * Math.pow(x, 0.103));
}

/**
 * Allowable repetitions for fatigue — the PCA (1984) stress-ratio criterion.
 * Below a stress ratio of 0.45 concrete has effectively unlimited fatigue life.
 */
export function fatigueAllowable(SR: number): number {
  if (SR < 0.45) return Infinity;
  if (SR <= 0.55) return Math.pow(4.2577 / (SR - 0.4325), 3.268);
  return Math.pow(10, 11.737 - 12.077 * SR);
}

export interface LoadGroup {
  /** Axle load, kip — before the load safety factor. */
  load: number;
  type: AxleType;
  /** Expected repetitions over the design period. */
  reps: number;
}

export interface GroupResult extends LoadGroup {
  factored: number;      // load × LSF
  stress: number;        // flexural stress for this group, psi
  stressRatio: number;
  fatigueN: number;
  fatigueDamage: number; // percent
  power: number;
  erosionN: number;
  erosionDamage: number; // percent
}

export interface PcaInput {
  /** Equivalent stress for the STANDARD axle, from Table 12.6 / 12.7 (psi). */
  equivalentStress: Record<AxleType, number>;
  /** Erosion factor for the STANDARD axle, from Tables 12.8-12.11. */
  erosionFactor: Record<AxleType, number>;
  /** Concrete modulus of rupture, psi. */
  modulusOfRupture: number;
  /** Load safety factor — 1.0 to 1.2 depending on the road class. */
  lsf: number;
  /** 1.0 untreated subbase, 0.9 stabilized. */
  c1: number;
  /** 0.06 without concrete shoulders, 0.94 with tied concrete shoulders. */
  c2: number;
}

/**
 * Run both analyses over an axle-load distribution.
 *
 * Stress scales linearly with axle load and the power of Eq. 12.8 scales with
 * its square, so both are projected from the standard-axle table values.
 */
export function pcaAnalyse(groups: LoadGroup[], input: PcaInput) {
  const rows: GroupResult[] = groups.map(g => {
    const std = STANDARD_LOAD[g.type];
    const factored = g.load * input.lsf;
    const ratio = std > 0 ? factored / std : 0;

    // Flexural stress scales linearly with the axle load.
    const stress = input.equivalentStress[g.type] * ratio;
    const stressRatio = input.modulusOfRupture > 0 ? stress / input.modulusOfRupture : Infinity;
    const fatigueN = fatigueAllowable(stressRatio);

    // Corner pressure scales linearly, and P scales with pressure squared.
    const power = powerFromErosionFactor(input.erosionFactor[g.type]) * ratio * ratio;
    const erosionN = erosionAllowable(power, input.c1);

    return {
      ...g,
      factored, stress, stressRatio, fatigueN,
      fatigueDamage: Number.isFinite(fatigueN) ? (100 * g.reps) / fatigueN : 0,
      power, erosionN,
      // Eq. 12.9 carries C2; the fatigue sum does not.
      erosionDamage: Number.isFinite(erosionN) ? (100 * input.c2 * g.reps) / erosionN : 0,
    };
  });

  const fatigueTotal = rows.reduce((s, r) => s + r.fatigueDamage, 0);
  const erosionTotal = rows.reduce((s, r) => s + r.erosionDamage, 0);
  return {
    rows,
    fatigueTotal,
    erosionTotal,
    governing: erosionTotal > fatigueTotal ? 'erosion' : 'fatigue',
    adequate: fatigueTotal <= 100 && erosionTotal <= 100,
  };
}
