/** Huang (2004), §10.1.3. Probabilities are computed from Eq. 10.34,
 * not transcribed from the typographically imperfect printed table. */
export const density = (z: number) => Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI);

/** Composite Simpson quadrature. 1,024 panels give < 2e-11 absolute error
 * over our supported z range [-8, 8]. Integrating the tail directly avoids
 * catastrophic cancellation in small exceedance probabilities. */
function integrate(a: number, b: number): number {
  const n = 1024, h = (b - a) / n;
  let sum = density(a) + density(b);
  for (let i = 1; i < n; i++) sum += (i % 2 ? 4 : 2) * density(a + i * h);
  return sum * h / 3;
}

export function normalAreas(z: number) {
  if (!Number.isFinite(z) || Math.abs(z) > 8) throw new RangeError('Use a finite z between −8 and 8.');
  const magnitude = Math.abs(z);
  const middle = integrate(0, magnitude);
  // The omitted standard-normal tail above 12 is less than 2e-33.
  const tail = magnitude === 0 ? 0.5 : integrate(magnitude, 12);
  return { middle, left: z < 0 ? tail : 1 - tail, right: z < 0 ? 1 - tail : tail, central: 2 * middle };
}

export function distributionStats(mean: number, sd: number, sdY: number, rho: number) {
  if (![mean, sd, sdY, rho].every(Number.isFinite) || sd <= 0 || sdY <= 0 || Math.abs(rho) > 1)
    throw new RangeError('Standard deviations must be positive and correlation must lie between −1 and 1.');
  return { mean, median: mean, sd, variance: sd * sd, covariance: rho * sd * sdY,
    cv: mean > 0 ? sd / mean * 100 : null };
}

export const normalTable = Array.from({ length: 40 }, (_, row) =>
  Array.from({ length: 10 }, (_, col) => normalAreas((row * 10 + col) / 100).middle));

/** Invert the directly integrated right tail; AASHTO uses a negative ZR for R > 50%. */
export function reliabilityDeviate(percent: number): number {
  if (!Number.isFinite(percent) || percent < 50 || percent > 99.99)
    throw new RangeError('Reliability must be between 50 and 99.99 percent.');
  if (percent === 50) return 0;
  let low = -8, high = 0;
  for (let i = 0; i < 48; i++) {
    const mid = (low + high) / 2;
    if (normalAreas(mid).right > percent / 100) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

/** Transcribed from the supplied Chapter 11 PDF, p. 512, Table 11.15.
 * Keep the printed values distinct from computed quantiles, especially 99.99%. */
export const reliabilityTable = [
  [50, 0], [60, -.253], [70, -.524], [75, -.674], [80, -.841], [85, -1.037],
  [90, -1.282], [91, -1.340], [92, -1.405], [93, -1.476], [94, -1.555],
  [95, -1.645], [96, -1.751], [97, -1.881], [98, -2.054], [99, -2.327],
  [99.9, -3.090], [99.99, -3.750],
].map(([reliability, printed]) => ({ reliability, printed, computed: reliabilityDeviate(reliability) }));

export const reliabilityFormulas = [
  { name: 'Reliability and its standard normal deviate', note: 'Huang Table 11.15 · Fig. 11.24',
    tex: 'R=P(Z\\ge Z_R)=1-\\Phi(Z_R),\\qquad Z_R=\\Phi^{-1}(1-R)=-\\Phi^{-1}(R)',
    plain: 'R = P(Z ≥ ZR) = 1 − Φ(ZR); ZR = inverse Φ(1 − R) = −inverse Φ(R)',
    explanation: 'R is a fraction in this equation (95% = 0.95). AASHTO uses the deviate on the left of the mean, so ZR is negative above 50% reliability. The large area to its right represents reliability; the left tail is 1 − R. This is the opposite sign from the positive 95th percentile.' },
  { name: 'Connect Tables 10.1 and 11.15', note: 'Huang Eq. 10.34 · Table 11.15',
    tex: '\\psi(|Z_R|)=R-\\tfrac12\\quad (R\\ge\\tfrac12)',
    plain: 'Table 10.1 area ψ(|ZR|) = R − ½, for R ≥ ½',
    explanation: 'At 95% reliability, find a center-to-deviate area of 0.45 in Table 10.1, then attach a negative sign to the deviate. The computed value is approximately −1.644854; Table 11.15 prints −1.645.' },
  { name: 'The AASHTO reliability adjustment', note: 'Huang Eqs. 11.36–11.37',
    tex: '\\log_{10}W_{18}=\\log_{10}W_{t18}+Z_R S_0,\\qquad \\frac{W_{18}}{W_{t18}}=10^{Z_R S_0}',
    plain: 'log₁₀ W18 = log₁₀ Wt18 + ZR S0; W18/Wt18 = 10 raised to (ZR S0)',
    explanation: 'S0 is the overall standard deviation on the base-10 logarithmic traffic scale, not σ from the first tab. Wt18 is the mean performance prediction; W18 is the allowable design traffic after the reliability adjustment. With S0 fixed, higher reliability makes ZR more negative and reduces this traffic ratio. This is an illustration of the reliability term, not a complete pavement design.' },
];

export const formulas = [
  { name: 'The Gaussian density', note: 'Huang Eq. 10.31',
    tex: 'f_X(x)=\\frac{1}{\\sigma\\sqrt{2\\pi}}\\exp\\!\\left[-\\frac{1}{2}\\left(\\frac{x-\\mu}{\\sigma}\\right)^2\\right]',
    plain: 'f(x) = exp[−½((x − μ)/σ)²] / (σ √(2π))',
    explanation: 'μ locates the center; σ > 0 controls the spread. Huang writes s for the standard deviation. The total area is 1. The curve’s height is density; probability is an area under it.' },
  { name: 'Standardize any value', note: 'Huang Eq. 10.33',
    tex: 'z=\\frac{x-\\mu}{\\sigma},\\qquad x=\\mu+z\\sigma',
    plain: 'z = (x − μ)/σ; x = μ + zσ',
    explanation: 'z counts standard deviations from the mean. Negative z is left of the mean; positive z is right. Standardizing lets every normal distribution use the same table.' },
  { name: 'Read Table 10.1', note: 'Huang Eq. 10.34 · Table 10.1',
    tex: 'A=\\psi(|z|)=\\int_0^{|z|}\\frac{e^{-u^2/2}}{\\sqrt{2\\pi}}\\,du=\\Phi(|z|)-\\frac12',
    plain: 'A = ψ(|z|) = integral of the standard-normal density from 0 to |z| = Φ(|z|) − ½',
    explanation: 'The table gives an unsigned area from the center, from 0 to 0.5. For a negative z, symmetry gives the same center-to-cutoff area. Values here are calculated from the integral, to six decimals; a few printed entries contain apparent typographical errors (for example z = 0.01 and 3.73).' },
  { name: 'Convert area to probability', note: 'Huang Eq. 10.32 · symmetry',
    tex: 'P(X\\le x)=\\Phi(z)=\\begin{cases}\\tfrac12+A&z\\ge0\\\\\\tfrac12-A&z<0\\end{cases},\\quad P(X>x)=1-\\Phi(z)',
    plain: 'P(X ≤ x) = ½ + A for z ≥ 0, or ½ − A for z < 0; P(X > x) = 1 − Φ(z)',
    explanation: 'Each half of the curve contains probability 0.5. The symmetric interval μ ± |z|σ contains 2A. Because the distribution is continuous, including or excluding a single endpoint does not change the probability.' },
  { name: 'Center and spread', note: 'Huang §10.1.1 · Eqs. 10.13–10.14',
    tex: 'E[X]=\\operatorname{median}(X)=\\mu,\\quad \\operatorname{Var}(X)=\\sigma^2,\\quad \\operatorname{SD}(X)=\\sqrt{\\operatorname{Var}(X)},\\quad \\mathrm{CV}=\\frac{\\sigma}{\\mu}\\times100\\%',
    plain: 'Mean = median = μ; variance = σ²; standard deviation = √variance; CV = 100σ/μ percent',
    explanation: 'The mean is the expected value. The median divides the probability in half; both lie at the center of a normal curve. Standard deviation measures spread in the original units, and variance has squared units. CV is the relative spread; it is shown here only for a positive mean and is meaningful for a quantity with a meaningful zero.' },
  { name: 'Covariance needs a second variable', note: 'Huang Eqs. 10.15–10.18',
    tex: '\\operatorname{Cov}(X,Y)=E[(X-\\mu_X)(Y-\\mu_Y)]=\\rho\\sigma_X\\sigma_Y,\\qquad \\operatorname{Cov}(X,X)=\\sigma_X^2',
    plain: 'Cov(X,Y) = E[(X − μX)(Y − μY)] = ρσXσY; Cov(X,X) = σX²',
    explanation: 'Covariance measures how two variables vary together. Enter σY and correlation ρ to compute it; the units are X-units × Y-units. A positive value means they tend to move together, a negative value means they tend to move in opposite directions. Independence implies zero covariance. A single normal curve does not determine Cov(X,Y); its covariance with itself is its variance.' },
];
