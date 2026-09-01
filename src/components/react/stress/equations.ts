// Boussinesq one-layer (homogeneous half-space) response — pure functions.
//
// Huang (2004) §2.1.2, Eqs. 2.2-2.6: a flexible circular plate of radius a
// carrying uniform pressure q on an elastic half-space, evaluated on the axis
// of symmetry where τrz = 0 and σr = σt, so σz and σr are principal.
//
// Extracted from the app so it can be pinned to Huang's printed answers.
// Consistent units throughout: pressure and modulus in the same unit, lengths
// in the same unit. Strains come back dimensionless.

export interface AxisResponse {
  /** Vertical stress. Independent of E and ν — worth noticing. */
  sigZ: number;
  /** Radial stress. Equal to the tangential stress on the axis. */
  sigR: number;
  /** Vertical strain. */
  epsZ: number;
  /** Radial strain. */
  epsR: number;
  /** Vertical deflection. */
  w: number;
}

/**
 * Response beneath the center of a flexible circular plate — Huang Eqs. 2.2-2.6.
 *
 *   σz = q[1 − z³/(a²+z²)^1.5]
 *   σr = (q/2)[1 + 2ν − 2(1+ν)z/(a²+z²)^0.5 + z³/(a²+z²)^1.5]
 *   w  = (1+ν)qa/E · [a/(a²+z²)^0.5 + (1−2ν)(√(a²+z²) − z)/a]
 *
 * Strains follow from Hooke's law with σr = σt on the axis:
 *   εz = [σz − 2ν σr]/E,   εr = [(1−ν)σr − ν σz]/E
 *
 * @param z depth below the surface (≥ 0)
 * @param q contact pressure
 * @param a contact radius
 * @param E elastic modulus, same pressure unit as q
 * @param nu Poisson's ratio
 */
export function axisResponse(z: number, q: number, a: number, E: number, nu: number): AxisResponse | null {
  if (!(q !== 0 && a > 0 && E > 0 && z >= 0)) return null;
  const R = Math.sqrt(a * a + z * z);
  const zr3 = (z * z * z) / (R * R * R);

  const sigZ = q * (1 - zr3);
  const sigR = (q / 2) * (1 + 2 * nu - (2 * (1 + nu) * z) / R + zr3);
  const epsZ = (sigZ - 2 * nu * sigR) / E;
  const epsR = ((1 - nu) * sigR - nu * sigZ) / E;
  const w = (((1 + nu) * q * a) / E) * (a / R + ((1 - 2 * nu) * (R - z)) / a);

  return { sigZ, sigR, epsZ, epsR, w };
}

/**
 * Deflection factor F in w = F·q·a/E — the quantity Huang's Figure 2.6 plots.
 * Useful for checking a chart read against the closed form.
 */
export const deflectionFactor = (z: number, a: number, nu: number) => {
  const R = Math.sqrt(a * a + z * z);
  return (1 + nu) * (a / R + ((1 - 2 * nu) * (R - z)) / a);
};

/**
 * Surface deflection under the center of a flexible plate — Huang Eq. 2.8.
 *
 *   w0 = 2(1 − ν²) q a / E
 *
 * At ν = 0.5 this is the familiar 1.5qa/E.
 */
export const surfaceDeflectionFlexible = (q: number, a: number, E: number, nu: number) =>
  (2 * (1 - nu * nu) * q * a) / E;

/**
 * Surface deflection under a RIGID plate — Huang Eq. 2.10.
 *
 *   w0 = π(1 − ν²) q a / (2E)
 *
 * A rigid plate of the same average pressure deflects only π/4 ≈ 79% as much
 * as a flexible one, because it redistributes pressure to its edge. This is
 * the correction the plate bearing test needs.
 */
export const surfaceDeflectionRigid = (q: number, a: number, E: number, nu: number) =>
  (Math.PI * (1 - nu * nu) * q * a) / (2 * E);

/**
 * Vertical stress at a point off the axis, by numerical integration of the
 * Boussinesq point-load kernel over the loaded circle.
 *
 *   σz = (3P/2π) · z³/R⁵   for a point load, integrated over the disc.
 *
 * On the axis this agrees with the closed form; off it, there is no
 * elementary closed form, which is why Huang prints charts (Figure 2.2).
 *
 * @param r radial offset from the load axis
 */
export function sigZAt(r: number, z: number, q: number, a: number, nRho = 64, nPhi = 96): number {
  if (!(z > 0)) return r <= a ? q : 0;      // at the surface the plate pressure is q
  const dRho = a / nRho;
  const dPhi = Math.PI / nPhi;
  let sum = 0;
  for (let i = 0; i < nRho; i++) {
    const rho = (i + 0.5) * dRho;
    for (let j = 0; j < nPhi; j++) {
      const phi = (j + 0.5) * dPhi;
      // Distance from the field point to this element of the loaded disc.
      const d2 = r * r + rho * rho - 2 * r * rho * Math.cos(phi);
      const R2 = d2 + z * z;
      // Two halves of the disc are symmetric about phi = 0, hence the factor 2.
      sum += 2 * ((3 * z ** 3) / (2 * Math.PI * Math.pow(R2, 2.5))) * rho * dRho * dPhi;
    }
  }
  return q * sum;
}

/**
 * Vertical deflection at a point off the axis, by integrating the Boussinesq
 * point-load kernel over the loaded circle.
 *
 *   w = (1+ν)P/(2πE) · [z²/R³ + 2(1−ν)/R]
 *
 * Returned as the deflection FACTOR F in Huang's Figure 2.6 convention,
 * w = F·q·a/E, which is what the ESWL methods of §6.2 are built on. Figure 2.6
 * is drawn for ν = 0.5.
 *
 * @param r radial offset from the load axis
 * @param z depth
 * @param a contact radius
 */
export function deflectionFactorAt(r: number, z: number, a: number, nu = 0.5,
                                   nRho = 80, nPhi = 120): number {
  if (!(a > 0)) return NaN;
  // On the axis the closed form is exact and much faster.
  if (Math.abs(r) < 1e-9) return deflectionFactor(z, a, nu);

  const dRho = a / nRho;
  const dPhi = Math.PI / nPhi;
  let sum = 0;
  for (let i = 0; i < nRho; i++) {
    const rho = (i + 0.5) * dRho;
    for (let j = 0; j < nPhi; j++) {
      const phi = (j + 0.5) * dPhi;
      const d2 = r * r + rho * rho - 2 * r * rho * Math.cos(phi);
      const R = Math.sqrt(d2 + z * z);
      if (R < 1e-12) continue;
      const kernel = ((1 + nu) / (2 * Math.PI)) * ((z * z) / (R * R * R) + (2 * (1 - nu)) / R);
      // Factor 2 for the symmetric half of the disc.
      sum += 2 * kernel * rho * dRho * dPhi;
    }
  }
  // w = q·sum/E, and F is defined by w = F·q·a/E.
  return sum / a;
}
