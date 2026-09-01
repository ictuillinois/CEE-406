// Field-ramp gate — the properties that make a magnitude field readable.
//
//   node --experimental-strip-types --test src/components/react/fieldRamp.test.mjs
//
// The regression this exists to stop: `rampScale` implements §A4.2, which
// reverses which end of a sequential ramp reads as "empty" between themes. On
// a *count* that is correct. On a continuous physical field it inverts the
// picture — the contact-stress tool shipped with the near-zero haze around the
// tire patch painted in the deep 900 orange and the peak in the pale 100, and
// a reader who takes saturation for magnitude read it exactly backwards.
//
// `fieldScale` is the fix, and what makes it a fix is not the hexes but three
// properties, asserted here on both themes:
//
//   1. contrast against the card the ramp is drawn on rises monotonically
//      with the value — the one cue that reads as magnitude on either surface;
//   2. lightness is monotone, in whichever direction that card requires;
//   3. the ends do NOT swap between themes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FIELD_RAMP, fieldScale, fieldEnds } from './chartTheme.ts';

/** The card each theme's fields are drawn on. Mirrors TOKENS[mode].surface. */
const CARD = { light: '#FFFFFF', dark: '#162033' };

const channels = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const linear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

function luminance(hex) {
  const [r, g, b] = channels(hex).map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
}

/** OKLab lightness and chroma — perceptual, unlike the sRGB coordinates. */
function oklab(hex) {
  const [r, g, b] = channels(hex).map(linear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    L: 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    C: Math.hypot(
      1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
    ),
  };
}

for (const mode of ['light', 'dark']) {
  const steps = FIELD_RAMP[mode];
  const card = CARD[mode];

  test(`${mode}: contrast against the card rises with the value`, () => {
    const cs = steps.map((c) => contrast(c, card));
    for (let i = 1; i < cs.length; i++) {
      assert.ok(
        cs[i] > cs[i - 1] + 0.05,
        `step ${i} (${steps[i]}, ${cs[i].toFixed(2)}:1) does not stand further off ` +
        `${card} than step ${i - 1} (${steps[i - 1]}, ${cs[i - 1].toFixed(2)}:1)`,
      );
    }
  });

  test(`${mode}: the zero end is visible but recessive`, () => {
    const low = contrast(steps[0], card);
    // Below ~1.1 the first cell above the contact threshold is indistinguishable
    // from a blanked one, and the measured footprint boundary disappears.
    assert.ok(low >= 1.12, `zero end ${steps[0]} is ${low.toFixed(2)}:1 against ${card}`);
    assert.ok(low <= 1.45, `zero end ${steps[0]} is too loud at ${low.toFixed(2)}:1`);
  });

  test(`${mode}: the peak end carries a filled-shape contrast (§A4.2, 3:1)`, () => {
    const high = contrast(steps[steps.length - 1], card);
    assert.ok(high >= 3, `peak end ${steps.at(-1)} is only ${high.toFixed(2)}:1`);
  });

  test(`${mode}: lightness is monotone in the direction the card requires`, () => {
    const ls = steps.map((c) => oklab(c).L);
    const wantDarker = mode === 'light';
    for (let i = 1; i < ls.length; i++) {
      const ok = wantDarker ? ls[i] < ls[i - 1] : ls[i] > ls[i - 1];
      assert.ok(ok, `step ${i} (${steps[i]}) breaks the lightness run at L=${ls[i].toFixed(3)}`);
    }
  });

  test(`${mode}: chroma climbs with the value, bar the gamut cap`, () => {
    const cs = steps.map((c) => oklab(c).C);
    // Strictly increasing up to the last stop, which sits on the sRGB gamut
    // boundary (deep red in light, luminous amber in dark) and gives back a
    // little chroma to buy the lightness. Cap the give-back below the JND.
    for (let i = 1; i < cs.length - 1; i++) {
      assert.ok(cs[i] > cs[i - 1], `step ${i} (${steps[i]}) loses chroma: ${cs[i].toFixed(3)}`);
    }
    const dip = (cs.at(-2) - cs.at(-1)) / cs.at(-2);
    assert.ok(dip < 0.1, `the last stop gives back ${(dip * 100).toFixed(1)}% of its chroma`);
  });
}

test('the ends do not swap between themes — that is the whole point', () => {
  // The failure mode being locked out: `rampScale('orange', …)` returns the
  // 900 at t=0 in dark and the 100 at t=0 in light. `fieldScale` must not.
  const [lowL, highL] = fieldEnds('light');
  const [lowD, highD] = fieldEnds('dark');
  assert.ok(luminance(lowL) > luminance(highL), 'light ramp must run pale → deep');
  assert.ok(luminance(lowD) < luminance(highD), 'dark ramp must run dim → luminous');
  for (const mode of ['light', 'dark']) {
    assert.ok(
      contrast(fieldEnds(mode)[1], CARD[mode]) > contrast(fieldEnds(mode)[0], CARD[mode]),
      `${mode}: the peak must be the louder end`,
    );
  }
  assert.notEqual(lowL, lowD);
  assert.notEqual(highL, highD);
});

test('fieldScale is a well-formed Plotly colorscale', () => {
  for (const mode of ['light', 'dark']) {
    const scale = fieldScale(mode);
    assert.equal(scale.length, FIELD_RAMP[mode].length);
    assert.equal(scale[0][0], 0);
    assert.equal(scale.at(-1)[0], 1);
    for (let i = 1; i < scale.length; i++) {
      assert.ok(scale[i][0] > scale[i - 1][0], 'stop positions must increase');
    }
    for (const [, c] of scale) assert.match(c, /^#[0-9A-Fa-f]{6}$/);
  }
});
