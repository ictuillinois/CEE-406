export type Model = "generalized" | "bulk";
export interface Observation {
  id: number;
  s3: number;
  sd: number;
  strain: number;
}
export const KPA_PER_PSI = 6.894757293168;
export const invariants = (p: Observation) => ({
  ...p,
  theta: p.sd + 3 * p.s3,
  tau: (Math.SQRT2 * p.sd) / 3,
  mr: p.sd / p.strain,
});

/** QR least squares with standardized predictors and reorthogonalization.
 * Reject rank-deficient designs instead of returning arbitrary coefficients.
 */
export function leastSquares(x: number[][], y: number[]): number[] | null {
  const n = y.length,
    p = x[0]?.length ?? 0;
  if (
    !p ||
    n <= p ||
    x.length !== n ||
    x.some((r) => r.length !== p || r.some((v) => !Number.isFinite(v))) ||
    y.some((v) => !Number.isFinite(v))
  )
    return null;
  const mean = Array.from({ length: p }, (_, j) =>
    j ? x.reduce((s, r) => s + r[j], 0) / n : 0,
  );
  const scale = mean.map((m, j) =>
    j ? Math.sqrt(x.reduce((s, r) => s + (r[j] - m) ** 2, 0) / n) : 1,
  );
  if (scale.some((s) => s < 1e-12)) return null;
  const q: number[][] = [],
    r = Array.from({ length: p }, () => Array(p).fill(0));
  for (let j = 0; j < p; j++) {
    const v = x.map((row) => (row[j] - mean[j]) / scale[j]);
    for (let pass = 0; pass < 2; pass++)
      for (let k = 0; k < j; k++) {
        const d = v.reduce((s, a, i) => s + a * q[k][i], 0);
        r[k][j] += d;
        for (let i = 0; i < n; i++) v[i] -= d * q[k][i];
      }
    r[j][j] = Math.hypot(...v);
    if (r[j][j] < 1e-10 * Math.sqrt(n)) return null;
    q.push(v.map((a) => a / r[j][j]));
  }
  const b = q.map((col) => col.reduce((s, a, i) => s + a * y[i], 0));
  for (let j = p - 1; j >= 0; j--) {
    for (let k = j + 1; k < p; k++) b[j] -= r[j][k] * b[k];
    b[j] /= r[j][j];
  }
  const coefficients = b.map((a, j) => a / scale[j]);
  coefficients[0] -= coefficients.reduce(
    (s, a, j) => s + (j ? a * mean[j] : 0),
    0,
  );
  return coefficients.every(Number.isFinite) ? coefficients : null;
}
export function rSquared(y: number[], pred: number[]): number | null {
  const mean = y.reduce((s, a) => s + a, 0) / y.length;
  const total = y.reduce((s, a) => s + (a - mean) ** 2, 0);
  return total > 1e-20
    ? 1 - y.reduce((s, a, i) => s + (a - pred[i]) ** 2, 0) / total
    : null;
}
export interface Fit {
  model: Model;
  pa: number;
  k1: number;
  k2: number;
  k3: number;
  r2: number | null;
  r2log: number | null;
  points: (ReturnType<typeof invariants> & {
    predicted: number;
    residual: number;
    logResidual: number;
  })[];
}
export function predict(
  f: Pick<Fit, "model" | "pa" | "k1" | "k2" | "k3">,
  theta: number,
  sd: number,
): number {
  if (![theta, sd].every(Number.isFinite) || theta <= 0 || sd < 0 || sd > theta)
    return NaN;
  const value =
    f.model === "bulk"
      ? f.k1 * theta ** f.k2
      : f.k1 *
        f.pa *
        (theta / f.pa) ** f.k2 *
        (1 + (Math.SQRT2 * sd) / (3 * f.pa)) ** f.k3;
  return Number.isFinite(value) && value > 0 ? value : NaN;
}
export function fitModulus(
  observations: Observation[],
  model: Model,
  pa = 101.325,
): Fit | null {
  if (
    !Number.isFinite(pa) ||
    pa <= 0 ||
    observations.some(
      (p) =>
        ![p.s3, p.sd, p.strain].every(Number.isFinite) ||
        p.s3 < 0 ||
        p.sd <= 0 ||
        p.strain <= 0,
    )
  )
    return null;
  const pts = observations.map(invariants);
  const x = pts.map((p) =>
    model === "bulk"
      ? [1, Math.log(p.theta)]
      : [1, Math.log(p.theta / pa), Math.log1p(p.tau / pa)],
  );
  const y = pts.map((p) => Math.log(model === "bulk" ? p.mr : p.mr / pa));
  const b = leastSquares(x, y);
  if (!b) return null;
  const f = { model, pa, k1: Math.exp(b[0]), k2: b[1], k3: b[2] ?? 0 };
  const points = pts.map((p) => {
    const predicted = predict(f, p.theta, p.sd);
    return {
      ...p,
      predicted,
      residual: p.mr - predicted,
      logResidual: Math.log(p.mr) - Math.log(predicted),
    };
  });
  if (points.some((p) => !Number.isFinite(p.predicted))) return null;
  return {
    ...f,
    points,
    r2: rSquared(
      pts.map((p) => p.mr),
      points.map((p) => p.predicted),
    ),
    r2log: rSquared(
      pts.map((p) => Math.log(p.mr)),
      points.map((p) => Math.log(p.predicted)),
    ),
  };
}

/** Remove the fitted shear factor to expose the generalized bulk power curve.
 * This is a display transformation; regression always uses the original data.
 */
export function shearNormalizedModulus(
  f: Pick<Fit, "pa" | "k3">,
  modulus: number,
  sd: number,
): number {
  return modulus / (1 + Math.SQRT2 * sd / (3 * f.pa)) ** f.k3;
}
