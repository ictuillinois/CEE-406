// The frames the One-layer figures are drawn in.
//
// Nothing here is physics. It is the answer to "how big is the box", which on
// these two figures is a real decision rather than a default, for a reason
// `contact-stress` records at length: a scale fitted to its own data holds the
// picture still and moves only the legend, so the reader watches an axis
// change instead of watching the thing they came to see change.
//
// The two figures resolve that differently, and the asymmetry is the point.
//
//   STRESS is read off the data. Its ceiling is the contact pressure, which
//   is a number the reader TYPED, so fitting the axis to the field is fitting
//   it to an input — a 90 psi load gets a 100 psi frame whatever the modulus
//   is, because sigma_z does not depend on E or nu at all (Huang's note under
//   Eq. 2.3). Rounding up to a round number is what makes the gridlines
//   readable.
//
//   DEFLECTION is not. A basin's depth is an OUTPUT: w goes as 1/E, so over
//   the modulus range a subgrade actually covers it moves by a factor of
//   eight, and a frame that followed it would draw eight identical pictures.
//   It is fixed per case instead, and a curve that leaves it is named rather
//   than clipped in silence.
//
// It lives in its own file, with no React import, because a figure I cannot
// open is a figure that has to be checked some other way: `frames.test.mjs`
// pins every rule below against the presets the module ships.

/**
 * The ladder a frame top is rounded up to.
 *
 * Deliberately coarser than `contact-stress`'s `NICE_STOPS`, which serves a
 * color ramp. A ramp wants a snug bound; a FRAME wants few round gridlines,
 * and a stop at 9 would put the top of a 90 psi figure at 90 — a frame line
 * lying exactly on the data, with the curve drawn half outside it.
 */
export const FRAME_STOPS = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

/**
 * The smallest round number at or above `v`.
 *
 * A value that IS a stop must land on it rather than jump a step: 0.3 / 0.1
 * is 2.9999999999999996 in binary floating point, and a strict compare would
 * take a 30 psi field to a 35 psi frame.
 */
export function frameTop(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return 1;
  const decade = 10 ** Math.floor(Math.log10(v));
  const m = v / decade;
  return (FRAME_STOPS.find(x => m <= x * (1 + 1e-9)) ?? 10) * decade;
}

/**
 * The deflection frame from its floor, in mils: [top, bottom].
 *
 * The top is negative, which is headroom rather than physics — nothing in a
 * Boussinesq half-space deflects upward. A basin that ran along the frame
 * line could not be read off it, and the zero line has to be visibly ABOVE
 * the curves for the figure to say that the surface is where they hang from.
 */
export function deflFrame(bot: number): [number, number] {
  return [-bot / 3, bot];
}

/**
 * Half-widths of the two figures, from the one control that sets them.
 *
 * Deflection takes the whole reach and stress takes half of it. That is not a
 * taste: off the axis sigma_z falls away like a Boussinesq 1/R^3 and is spent
 * within a few radii, while the basin goes as 1/r and is still measurable out
 * where the stress is gone. It is the whole reason an FWD has seven sensors,
 * and drawing both figures to the same width hides it.
 *
 * A superposed PAIR spans the reach itself, so there the stress figure keeps
 * the full width — at half of it the second circle is off the page.
 */
export function halfWidths(rMax: number, superposed: boolean) {
  return { stress: superposed ? rMax : rMax / 2, defl: rMax };
}

/** Inches to mils. */
export const MILS = 1000;

/**
 * The r stations of a curve: 2n-1 samples across the load, from -rMax to
 * +rMax, with r = 0 landing exactly on a station rather than falling between
 * the two either side of it.
 *
 * The grid is built from the right half and reflected, so `r[i]` is exactly
 * `-r[N-1-i]` — not merely within a rounding error of it. Walking the whole
 * span with one expression is a ulp off at most stations, and that is enough
 * to make the mirrored half of a curve carry a y solved at a very slightly
 * different x from the one it is drawn at. It is invisible either way; the
 * point is that the reflection is then EXACT and can be asserted as exact,
 * rather than asserted to a tolerance nobody can justify.
 */
export function stations(rMax: number, n: number): number[] {
  const N = 2 * n - 1;
  const out = new Array<number>(N);
  out[n - 1] = 0;
  for (let i = 1; i < n; i++) {
    const v = (i / (n - 1)) * rMax;
    out[n - 1 + i] = v;
    out[n - 1 - i] = -v;
  }
  return out;
}

/**
 * Is this case's field a function of |r| alone?
 *
 * The three single-load solutions are axisymmetric, so the half of the curve
 * left of the axis is the half right of it and only one of them has to be
 * solved. A PAIR is not: at -r the far circle is r + s away and at +r it is
 * |r - s|. Reflecting a pair would draw a symmetric figure for a gear that is
 * not symmetric, which is the one thing the two-sided figure exists to show.
 */
export const isMirrorable = (superposed: boolean) => !superposed;
