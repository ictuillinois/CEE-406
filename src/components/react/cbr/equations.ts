// California Bearing Ratio reduction — pure functions, no React.
//
// AASHTO T 193 / ASTM D1883. The CBR is the piston pressure at a given
// penetration expressed as a percentage of the pressure a standard crushed
// stone requires at the same penetration.
//
// The subtle part is the origin correction: a stress-penetration curve that
// starts concave upward (from surface irregularities or a soft top layer)
// must have its origin shifted before the pressures are read, or the CBR
// comes out too low.

/** Standard piston pressures for crushed stone, psi (AASHTO T 193). */
export const STANDARD_PRESSURE: Record<string, number> = {
  '0.1': 1000,
  '0.2': 1500,
  '0.3': 1900,
  '0.4': 2300,
  '0.5': 2600,
};

export interface Point {
  pen: number;   // penetration, in
  load: number;  // piston pressure, psi
}

/** Linear interpolation of pressure at a penetration, from sorted points. */
export function pressureAt(points: Point[], pen: number): number {
  const p = [...points].sort((a, b) => a.pen - b.pen);
  if (!p.length) return NaN;
  if (pen <= p[0].pen) return p[0].load;
  if (pen >= p[p.length - 1].pen) return p[p.length - 1].load;
  for (let i = 1; i < p.length; i++) {
    if (pen <= p[i].pen) {
      const t = (pen - p[i - 1].pen) / (p[i].pen - p[i - 1].pen);
      return p[i - 1].load + t * (p[i].load - p[i - 1].load);
    }
  }
  return NaN;
}

/**
 * Find the origin correction for a concave-up curve.
 *
 * The standard construction: take the tangent at the steepest point of the
 * curve and extend it to zero load; where it crosses the penetration axis is
 * the corrected origin. A curve that is concave *down* from the start needs
 * no correction and returns 0.
 *
 * @returns the penetration offset to subtract from every reading (in)
 */
export function originCorrection(points: Point[]): { offset: number; slope: number; atIndex: number } {
  const p = [...points].sort((a, b) => a.pen - b.pen);
  if (p.length < 3) return { offset: 0, slope: NaN, atIndex: -1 };

  // Steepest secant between consecutive readings marks the inflection.
  let best = -Infinity, bi = 1;
  for (let i = 1; i < p.length; i++) {
    const s = (p[i].load - p[i - 1].load) / (p[i].pen - p[i - 1].pen);
    if (s > best) { best = s; bi = i; }
  }
  // Tangent through the midpoint of the steepest segment, extended to load 0.
  const x1 = p[bi - 1].pen, y1 = p[bi - 1].load;
  const offset = best > 0 ? x1 - y1 / best : 0;
  // Only a concave-up curve needs shifting; never shift backwards.
  return { offset: Math.max(0, offset), slope: best, atIndex: bi };
}

export interface CbrResult {
  offset: number;
  slope: number;
  corrected: Point[];
  p01: number;
  p02: number;
  cbr01: number;
  cbr02: number;
  governing: number;
  governingAt: '0.1' | '0.2';
  /** True when the 0.2 in value governs, which the standard says to check. */
  rerunAdvised: boolean;
}

/**
 * Reduce a penetration test to a CBR.
 *
 * @param points   measured penetration (in) and piston pressure (psi)
 * @param correct  apply the concave-up origin correction
 */
export function reduceCbr(points: Point[], correct = true): CbrResult | null {
  if (points.length < 2) return null;
  const { offset, slope } = correct ? originCorrection(points) : { offset: 0, slope: NaN };
  const corrected = points
    .map(p => ({ pen: p.pen - offset, load: p.load }))
    .filter(p => p.pen >= -1e-9);

  const p01 = pressureAt(corrected, 0.1);
  const p02 = pressureAt(corrected, 0.2);
  const cbr01 = (p01 / STANDARD_PRESSURE['0.1']) * 100;
  const cbr02 = (p02 / STANDARD_PRESSURE['0.2']) * 100;

  // AASHTO T 193: normally the 0.1 in value is the CBR. If the 0.2 in value
  // is larger, the test is rerun; if it repeats, the 0.2 in value is used.
  const governingAt = cbr02 > cbr01 ? '0.2' : '0.1';
  return {
    offset, slope, corrected, p01, p02, cbr01, cbr02,
    governing: governingAt === '0.2' ? cbr02 : cbr01,
    governingAt,
    rerunAdvised: cbr02 > cbr01,
  };
}
