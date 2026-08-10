// Bessel functions of the first kind, orders 0 and 1, and their zeros.
//
// Polynomial/asymptotic approximations from Abramowitz & Stegun §9.4
// (|error| < 5e-8 for J0, < 1.3e-8 for J1) — ample for the Hankel-transform
// quadrature in lea.ts, where the integrand is smooth between zeros.

/** J0(x), Abramowitz & Stegun 9.4.1 / 9.4.3. */
export function besselJ0(x: number): number {
  const ax = Math.abs(x);
  if (ax < 8) {
    const y = x * x;
    const p = 57568490574 + y * (-13362590354 + y * (651619640.7 +
      y * (-11214424.18 + y * (77392.33017 + y * -184.9052456))));
    const q = 57568490411 + y * (1029532985 + y * (9494680.718 +
      y * (59272.64853 + y * (267.8532712 + y))));
    return p / q;
  }
  const z = 8 / ax, y = z * z, xx = ax - 0.785398164;
  const p = 1 + y * (-0.1098628627e-2 + y * (0.2734510407e-4 +
    y * (-0.2073370639e-5 + y * 0.2093887211e-6)));
  const q = -0.1562499995e-1 + y * (0.1430488765e-3 +
    y * (-0.6911147651e-5 + y * (0.7621095161e-6 + y * -0.934935152e-7)));
  return Math.sqrt(0.636619772 / ax) * (Math.cos(xx) * p - z * Math.sin(xx) * q);
}

/** J1(x), Abramowitz & Stegun 9.4.4 / 9.4.6. */
export function besselJ1(x: number): number {
  const ax = Math.abs(x);
  let ans: number;
  if (ax < 8) {
    const y = x * x;
    const p = x * (72362614232 + y * (-7895059235 + y * (242396853.1 +
      y * (-2972611.439 + y * (15704.48260 + y * -30.16036606)))));
    const q = 144725228442 + y * (2300535178 + y * (18583304.74 +
      y * (99447.43394 + y * (376.9991397 + y))));
    return p / q;
  }
  const z = 8 / ax, y = z * z, xx = ax - 2.356194491;
  const p = 1 + y * (0.183105e-2 + y * (-0.3516396496e-4 +
    y * (0.2457520174e-5 + y * -0.240337019e-6)));
  const q = 0.04687499995 + y * (-0.2002690873e-3 +
    y * (0.8449199096e-5 + y * (-0.88228987e-6 + y * 0.105787412e-6)));
  ans = Math.sqrt(0.636619772 / ax) * (Math.cos(xx) * p - z * Math.sin(xx) * q);
  return x < 0 ? -ans : ans;
}

/** dJ0/dx = -J1(x). */
export const besselJ0Prime = (x: number) => -besselJ1(x);

/** dJ1/dx = J0(x) - J1(x)/x. */
export const besselJ1Prime = (x: number) => (x === 0 ? 0.5 : besselJ0(x) - besselJ1(x) / x);

/**
 * The k-th positive zero of J0 (k = 1, 2, ...), by McMahon's asymptotic
 * expansion refined with Newton's method.
 */
export function besselJ0Zero(k: number): number {
  const b = (k - 0.25) * Math.PI;
  const b8 = 1 / (8 * b);
  let x = b + b8 * (1 - b8 * b8 * (124 / 3 - b8 * b8 * 120928 / 15));
  for (let i = 0; i < 8; i++) {
    const dx = besselJ0(x) / besselJ0Prime(x);
    x -= dx;
    if (Math.abs(dx) < 1e-14) break;
  }
  return x;
}

/** The k-th positive zero of J1 (k = 1, 2, ...), excluding x = 0. */
export function besselJ1Zero(k: number): number {
  const b = (k + 0.25) * Math.PI;
  const b8 = 1 / (8 * b);
  let x = b - b8 * (3 + b8 * b8 * (-4 + b8 * b8 * 32 / 3));
  for (let i = 0; i < 8; i++) {
    const dx = besselJ1(x) / besselJ1Prime(x);
    x -= dx;
    if (Math.abs(dx) < 1e-14) break;
  }
  return x;
}
