// ACR/PCR aircraft-pavement compatibility — pure functions, no React.
//
// The ICAO Aircraft Classification Rating / Pavement Classification Rating
// system replaced ACN/PCN in November 2024. A runway is reported as a
// five-part code:
//
//     PCR / type / subgrade / tyre pressure / evaluation method
//     700  / R    / C        / Y             / T
//
// An aircraft may operate without restriction when its ACR — quoted for the
// same pavement type and subgrade category — does not exceed the PCR, and
// its tyre pressure is within the coded limit.
//
// The ACR itself comes from the aircraft manufacturer's or ICAO's published
// tables and is an input here: those tables are not reproduced.

export type PavementType = 'R' | 'F';
export type SubgradeCode = 'A' | 'B' | 'C' | 'D';
export type TyreCode = 'W' | 'X' | 'Y' | 'Z';
export type EvalMethod = 'T' | 'U';

export const PAVEMENT_TYPE: Record<PavementType, string> = {
  R: 'Rigid',
  F: 'Flexible',
};

/** Subgrade strength categories. Rigid uses k, flexible uses CBR. */
export const SUBGRADE: Record<SubgradeCode, { name: string; rigid: string; flexible: string }> = {
  A: { name: 'High',      rigid: 'k = 150 MN/m³ (550 pci)', flexible: 'CBR 15' },
  B: { name: 'Medium',    rigid: 'k = 80 MN/m³ (300 pci)',  flexible: 'CBR 10' },
  C: { name: 'Low',       rigid: 'k = 40 MN/m³ (150 pci)',  flexible: 'CBR 6' },
  D: { name: 'Ultra low', rigid: 'k = 20 MN/m³ (75 pci)',   flexible: 'CBR 3' },
};

/** Maximum allowable tyre pressure by code. */
export const TYRE: Record<TyreCode, { name: string; mpa: number | null; psi: number | null }> = {
  W: { name: 'Unlimited', mpa: null, psi: null },
  X: { name: 'High',   mpa: 1.75, psi: 254 },
  Y: { name: 'Medium', mpa: 1.25, psi: 181 },
  Z: { name: 'Low',    mpa: 0.50, psi: 73 },
};

export const EVALUATION: Record<EvalMethod, string> = {
  T: 'Technical evaluation',
  U: 'Using aircraft experience',
};

export interface RunwayCode {
  pcr: number;
  type: PavementType;
  subgrade: SubgradeCode;
  tyre: TyreCode;
  method: EvalMethod;
}

/**
 * Parse a runway rating string such as "700/R/C/Y/T".
 * @returns the parsed code, or null if it is not a valid five-part rating
 */
export function parseRunwayCode(text: string): RunwayCode | null {
  const parts = text.trim().toUpperCase().split('/').map(s => s.trim());
  if (parts.length !== 5) return null;
  const pcr = Number(parts[0]);
  if (!Number.isFinite(pcr) || pcr <= 0) return null;
  if (!(parts[1] in PAVEMENT_TYPE)) return null;
  if (!(parts[2] in SUBGRADE)) return null;
  if (!(parts[3] in TYRE)) return null;
  if (!(parts[4] in EVALUATION)) return null;
  return {
    pcr,
    type: parts[1] as PavementType,
    subgrade: parts[2] as SubgradeCode,
    tyre: parts[3] as TyreCode,
    method: parts[4] as EvalMethod,
  };
}

export const formatRunwayCode = (c: RunwayCode) =>
  `${c.pcr}/${c.type}/${c.subgrade}/${c.tyre}/${c.method}`;

export interface Verdict {
  /** Unrestricted operation permitted. */
  ok: boolean;
  /** Permitted only as an occasional overload movement. */
  overload: boolean;
  ratio: number;
  reasons: string[];
}

/** Overload allowance for occasional movements, as a fraction of the PCR. */
export const OVERLOAD_ALLOWANCE = 0.10;

/**
 * Decide whether an aircraft may use a runway.
 *
 * @param acr           the aircraft's ACR for THIS pavement type and subgrade
 * @param tyrePressure  aircraft tyre pressure (psi)
 */
export function evaluate(runway: RunwayCode, acr: number, tyrePressure: number): Verdict {
  const reasons: string[] = [];
  const ratio = runway.pcr > 0 ? acr / runway.pcr : Infinity;

  const strengthOk = acr <= runway.pcr;
  const overloadOk = acr <= runway.pcr * (1 + OVERLOAD_ALLOWANCE);
  if (strengthOk) {
    reasons.push(`ACR ${acr} ≤ PCR ${runway.pcr}: strength is adequate.`);
  } else if (overloadOk) {
    reasons.push(
      `ACR ${acr} exceeds PCR ${runway.pcr} by ${((ratio - 1) * 100).toFixed(1)}%, ` +
      `within the ${(OVERLOAD_ALLOWANCE * 100).toFixed(0)}% occasional-overload allowance.`
    );
  } else {
    reasons.push(`ACR ${acr} exceeds PCR ${runway.pcr} by ${((ratio - 1) * 100).toFixed(1)}% — beyond the overload allowance.`);
  }

  const limit = TYRE[runway.tyre].psi;
  const tyreOk = limit === null || tyrePressure <= limit;
  reasons.push(
    limit === null
      ? `Tyre pressure code ${runway.tyre} is unlimited.`
      : tyreOk
        ? `Tyre pressure ${tyrePressure} psi is within the ${runway.tyre} limit of ${limit} psi.`
        : `Tyre pressure ${tyrePressure} psi exceeds the ${runway.tyre} limit of ${limit} psi.`
  );

  return {
    ok: strengthOk && tyreOk,
    overload: !strengthOk && overloadOk && tyreOk,
    ratio,
    reasons,
  };
}
