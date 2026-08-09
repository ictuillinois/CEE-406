// AASHTO 1993 design equations — pure functions, no React.
//
// Kept separate from the UI so they can be exercised directly against the
// worked answers printed in Huang (2004). See equations.test.mjs.
//
//   Flexible  Huang Eq. 11.34
//   Rigid     Huang Eq. 12.21
//   Effective k  Huang Eqs. 12.29-12.30 (relative damage)

/** Φ(z) — standard normal CDF via Abramowitz & Stegun 7.1.26. */
export function normCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp(-0.5 * z * z);
  const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? 1 - p : p;
}

/** Φ⁻¹(p) — Acklam's rational approximation with one Halley refinement. */
export function normInv(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  let q: number, r: number, x: number;
  if (p < pl) {
    q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= 1 - pl) {
    q = p - 0.5; r = q * q;
    x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
        (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const e = normCdf(x) - p;
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
  return x - u / (1 + (x * u) / 2);
}

/** Reliability in percent → Z_R. Negative above 50%, which is what makes the
 *  reliability term subtract capacity. */
export const zOfR = (Rpct: number) => -normInv(Math.min(99.99, Math.max(50, Rpct)) / 100);

/** Z_R → reliability in percent. */
export const rOfZ = (z: number) => normCdf(-z) * 100;

/* ──────────────────────────── Flexible ──────────────────────────── */

export function logW18Flex(SN: number, MR: number, dPSI: number, zR: number, s0: number): number {
  const denom = 0.40 + 1094 / Math.pow(SN + 1, 5.19);
  return (
    zR * s0 + 9.36 * Math.log10(SN + 1) - 0.20 +
    Math.log10(dPSI / (4.2 - 1.5)) / denom +
    2.32 * Math.log10(MR) - 8.07
  );
}

/** Invert for SN by bisection — log W18 is monotone increasing in SN. */
export function snFor(W18: number, MR: number, dPSI: number, zR: number, s0: number): number | null {
  const target = Math.log10(W18);
  let lo = 0.01, hi = 20;
  if (logW18Flex(hi, MR, dPSI, zR, s0) < target) return null;
  if (logW18Flex(lo, MR, dPSI, zR, s0) > target) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (logW18Flex(mid, MR, dPSI, zR, s0) < target) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/* ───────────────────────────── Rigid ───────────────────────────── */

export function logW18Rigid(
  D: number, k: number, Ec: number, Sc: number, J: number, Cd: number,
  dPSI: number, pt: number, zR: number, s0: number
): number | null {
  const d75 = Math.pow(D, 0.75);
  const inner = d75 - 18.42 / Math.pow(Ec / k, 0.25);
  if (inner <= 0) return null;
  const ratio = (Sc * Cd * (d75 - 1.132)) / (215.63 * J * inner);
  if (ratio <= 0) return null;
  return (
    zR * s0 + 7.35 * Math.log10(D + 1) - 0.06 +
    Math.log10(dPSI / (4.5 - 1.5)) / (1 + 1.624e7 / Math.pow(D + 1, 8.46)) +
    (4.22 - 0.32 * pt) * Math.log10(ratio)
  );
}

/** Invert for slab thickness D by bisection. */
export function dFor(
  W18: number, k: number, Ec: number, Sc: number, J: number, Cd: number,
  dPSI: number, pt: number, zR: number, s0: number
): number | null {
  const target = Math.log10(W18);
  let lo = 4, hi = 24;
  const f = (D: number) => logW18Rigid(D, k, Ec, Sc, J, Cd, dPSI, pt, zR, s0);
  const fh = f(hi);
  if (fh === null || fh < target) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const v = f(mid);
    if (v === null || v < target) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/* ──────────────────────── Effective k ──────────────────────── */

/** Relative damage to a rigid pavement — Huang Eq. 12.30. */
export const relDamage = (D: number, k: number) =>
  Math.pow(Math.pow(D, 0.75) - 0.39 * Math.pow(k, 0.25), 3.42);

/** Roadbed resilient modulus → modulus of subgrade reaction, Huang Eq. 12.22. */
export const kOfMr = (MR: number) => MR / 19.4;

/**
 * Effective modulus of subgrade reaction from seasonal k values, by equating
 * the damage of the effective k to the mean seasonal damage (Huang Eq. 12.29).
 */
export function effectiveK(D: number, ks: number[]): number {
  const us = ks.filter(k => k > 0).map(k => relDamage(D, k));
  if (!us.length) return NaN;
  const uBar = us.reduce((a, b) => a + b, 0) / us.length;
  const inner = Math.pow(D, 0.75) - Math.pow(uBar, 1 / 3.42);
  return inner > 0 ? Math.pow(inner / 0.39, 4) : NaN;
}
