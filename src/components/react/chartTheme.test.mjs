/* chartTheme — the light/dark contract.
 *
 * Every color in the toolbox comes from this file, and every one of them has
 * to work on TWO backgrounds: the white card (#FFFFFF) and the navy one
 * (#162033). A palette that is only ever checked in the mode the author had
 * open is a palette that is half unchecked, and the failure is invisible to
 * every other test in this repo — the build passes, the tools compute the
 * right numbers, and a student on the other theme cannot read the chart.
 *
 * This is the same argument gear3d/tokens.test.mjs makes for its CSS tokens.
 * That one guards text contrast in one tool; this one guards the chart palette
 * across all of them.
 *
 * The thresholds here are DESCRIPTIVE — they record what the palette actually
 * achieves today, so a regression trips them. Where a value is close to a
 * WCAG line rather than clear of it, the comment says so rather than rounding
 * it up. Don't raise a bound to make a point; raise the palette.
 *
 *   node --experimental-strip-types --test src/components/react/chartTheme.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TOKENS, HUES, HUE_ORDER, RAMPS, rampScale, divergingScale, mixHex, withAlpha,
  rampSeries, axis, paperAxis, paperFrame,
} from './chartTheme.ts';

const MODES = /** @type {const} */ (['light', 'dark']);

/** @param {string} h */
function rgb(h) {
  const m = /^#([0-9a-f]{6})$/i.exec(h.trim());
  if (!m) throw new Error(`not an opaque hex color: ${h}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** @param {number[]} c */
function relLuminance(c) {
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio. @param {string} a @param {string} b */
function contrast(a, b) {
  const l1 = relLuminance(rgb(a));
  const l2 = relLuminance(rgb(b));
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const card = (/** @type {'light'|'dark'} */ m) => TOKENS[m].surface;

/* ── 1. Both themes are actually defined ─────────────────────────────────── */

test('every token and hue exists in both modes', () => {
  const lightKeys = Object.keys(TOKENS.light).sort();
  const darkKeys = Object.keys(TOKENS.dark).sort();
  assert.deepEqual(darkKeys, lightKeys, 'a token defined in one mode only');

  for (const hue of HUE_ORDER) {
    for (const m of MODES) {
      assert.match(HUES[m][hue], /^#[0-9a-f]{6}$/i, `${m}.${hue} is not a hex color`);
    }
  }
});

/* ── 2. Series hues separate from their own card, in BOTH modes ──────────── */

test('every categorical hue stands off the card it is drawn on', () => {
  /* Dark mode is comfortable everywhere: 5.50:1 (pink) to 10.20:1 (amber) on
   * the navy card. LIGHT mode is the whole difficulty, and the measured floor
   * across the five usable hues is 2.65:1 (emerald).
   *
   * Those five sit just UNDER the 3:1 that WCAG 1.4.11 asks of a standalone
   * graphic. That is tolerated, deliberately: Illini Orange is 2.96:1 on white
   * and cannot move — it is the brand — and the hue is never the only channel
   * anyway, because <Legend> pairs every swatch with a text label in an
   * AA-passing ink. The color is redundant coding, not the sole cue.
   *
   * The bound is the real floor rather than a round number, so a NEW hue
   * cannot quietly land below what we already accepted. `amber` is excluded
   * here and pinned in its own test below. */
  for (const m of MODES) {
    for (const hue of HUE_ORDER) {
      if (m === 'light' && hue === 'amber') continue;
      const ratio = contrast(HUES[m][hue], card(m));
      assert.ok(
        ratio >= 2.6,
        `${m} ${hue} ${HUES[m][hue]} is ${ratio.toFixed(2)}:1 on ${card(m)} — below the palette's own floor`
      );
    }
  }
});

test('KNOWN GAP: light-mode amber is far below the rest of the palette', () => {
  /* #F5B62E is 1.81:1 on the white card — not marginal like the others, but a
   * genuine failure, and the one place the palette does NOT hold up equally in
   * both themes. On the navy card the same role is 10.20:1.
   *
   * It is left standing rather than quietly patched because every fix costs
   * something a test cannot choose between: dropping it to 3:1 on white forces
   * it to roughly #96812C, which no longer reads as amber at all but as olive,
   * and darkening it toward orange instead collides with Illini Orange, which
   * sits two positions away in the same assignment order. That is a design
   * call about the course's identity, not a rounding error.
   *
   * Live exposure today is nil: amber is bound to `traffic` (§B4) and its only
   * consumers — aashto, esal, reliability — are all release-locked. This test
   * pins the number so the gap stays visible and cannot drift further, and so
   * whoever resolves it has to come here and delete this test on purpose. */
  const ratio = contrast(HUES.light.amber, card('light'));
  assert.ok(
    Math.abs(ratio - 1.81) < 0.02,
    `light amber is now ${ratio.toFixed(2)}:1, not the pinned 1.81:1 — if this was the fix, raise it past 2.6 and fold amber back into the test above`
  );
  assert.ok(contrast(HUES.dark.amber, card('dark')) >= 3, 'dark amber must stay clear');
});

test('adjacent hues in the assignment order are distinguishable from each other', () => {
  // Series 1 and 2 are the pair that most often appears together.
  for (const m of MODES) {
    for (let i = 0; i < HUE_ORDER.length - 1; i++) {
      const [a, b] = [HUES[m][HUE_ORDER[i]], HUES[m][HUE_ORDER[i + 1]]];
      const [ra, ga, ba] = rgb(a);
      const [rb, gb, bb] = rgb(b);
      const dist = Math.hypot(ra - rb, ga - gb, ba - bb);
      assert.ok(dist >= 60, `${m}: ${HUE_ORDER[i]} and ${HUE_ORDER[i + 1]} are only ${dist.toFixed(0)} apart in RGB`);
    }
  }
});

/* ── 3. Sequential ramps reverse between modes (§A4.2) ───────────────────── */

test('a ramp always puts its HIGH end furthest from the card', () => {
  /* This is the whole reason rampScale reverses by mode. If it ever stops
   * reversing, one of the two themes silently renders peak values in the
   * color that reads as "empty", and the chart inverts its meaning. */
  for (const m of MODES) {
    for (const name of /** @type {const} */ (['orange', 'blue', 'emerald', 'neutral'])) {
      const s = rampScale(name, m);
      const lowEnd = s[0][1];
      const highEnd = s[s.length - 1][1];
      const cLow = contrast(lowEnd, card(m));
      const cHigh = contrast(highEnd, card(m));
      assert.ok(
        cHigh > cLow,
        `${m} ${name}: high end ${highEnd} (${cHigh.toFixed(2)}:1) does not stand off the card more than the low end ${lowEnd} (${cLow.toFixed(2)}:1)`
      );
      assert.ok(cHigh >= 3, `${m} ${name}: high end only ${cHigh.toFixed(2)}:1 on the card`);
    }
  }
});

test('ramp stops are monotonic in luminance', () => {
  for (const name of Object.keys(RAMPS)) {
    const lums = RAMPS[name].map((c) => relLuminance(rgb(c)));
    for (let i = 1; i < lums.length; i++) {
      assert.ok(lums[i] > lums[i - 1], `RAMPS.${name} is not ordered deep → pale at step ${i}`);
    }
  }
});

/* ── 4. The diverging scale, which is the one contact-stress leans on ────── */

test('diverging scale is anchored to the card in both modes', () => {
  for (const m of MODES) {
    const s = divergingScale(m);
    assert.equal(s.length, 5);
    assert.deepEqual(s.map(([p]) => p), [0, 0.25, 0.5, 0.75, 1]);
    assert.equal(
      s[2][1].toLowerCase(), card(m).toLowerCase(),
      `${m}: the midpoint must be the surface token so zero reads as bare card`
    );
  }
});

test('diverging arms are equally loud, and neither sign is favored', () => {
  /* A diverging scale that is brighter on one arm tells the reader that sign
   * matters more, which for a shear field is simply false. */
  for (const m of MODES) {
    const s = divergingScale(m);
    const low = contrast(s[0][1], card(m));
    const high = contrast(s[4][1], card(m));
    const skew = Math.max(low, high) / Math.min(low, high);
    assert.ok(skew <= 1.15, `${m}: arms differ by ${skew.toFixed(2)}× in contrast against the card`);
  }
});

test('diverging scale fades monotonically toward zero from each end', () => {
  for (const m of MODES) {
    const s = divergingScale(m).map(([, c]) => contrast(c, card(m)));
    // s[2] is the card itself: contrast 1.0 by definition.
    assert.ok(s[0] > s[1] && s[1] > s[2], `${m}: negative arm is not monotonic toward zero`);
    assert.ok(s[4] > s[3] && s[3] > s[2], `${m}: positive arm is not monotonic toward zero`);
  }
});

test('diverging ends stay distinguishable under red-green color blindness', () => {
  /* Blue↔orange is chosen over red↔green precisely so the sign survives
   * deuteranopia and protanopia. Simulate both and require the ends stay far
   * apart in the simulated space. (Brettel/Viénot-style reduction: collapse
   * the confused channels, keep blue-yellow opponency.) */
  const deuter = ([r, g, b]) => { const y = 0.625 * r + 0.375 * g; return [y, y, b]; };
  const protan = ([r, g, b]) => { const y = 0.42 * r + 0.58 * g; return [y, y, b]; };
  for (const m of MODES) {
    const s = divergingScale(m);
    for (const [name, sim] of [['deuteranopia', deuter], ['protanopia', protan]]) {
      const a = sim(rgb(s[0][1]));
      const b = sim(rgb(s[4][1]));
      const dist = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      assert.ok(dist >= 60, `${m}: diverging ends collapse under ${name} (${dist.toFixed(0)} apart)`);
    }
  }
});

/* ── 5. The bug this file was written for ────────────────────────────────── */

test('no colorscale stop is translucent', () => {
  /* A Plotly colorscale on a gl3d `surface` applies alpha to the MESH, not as
   * a tint toward the card: translucent stops make the sheet see-through, the
   * far side and the axis walls bleed through the near side, and the depth
   * sort decides which wins per viewing angle. contact-stress shipped
   * `withAlpha(hue, 0.45)` at the quarter stops and had exactly that.
   *
   * rgba() remains correct for 2-D `fillcolor` and for areaFill, which really
   * do want the card to show through — this bans it only from colorscales. */
  const scales = [];
  for (const m of MODES) {
    for (const name of Object.keys(RAMPS)) scales.push([`rampScale(${name}, ${m})`, rampScale(name, m)]);
    scales.push([`divergingScale(${m})`, divergingScale(m)]);
  }
  for (const [label, scale] of scales) {
    for (const [pos, color] of scale) {
      assert.match(
        color, /^#[0-9a-f]{6}$/i,
        `${label} stop ${pos} is "${color}" — colorscale stops must be opaque hex`
      );
    }
  }
});

test('mixHex composites toward the background, withAlpha does not', () => {
  // The two helpers must not be confused for each other again.
  assert.equal(mixHex('#000000', '#ffffff', 0), '#ffffff');
  assert.equal(mixHex('#000000', '#ffffff', 1), '#000000');
  assert.equal(mixHex('#000000', '#ffffff', 0.5), '#808080');
  assert.equal(mixHex('#3B9BF0', '#FFFFFF', 0.45), '#a7d2f8');
  assert.equal(mixHex('#5AAEF5', '#162033', 0.45), '#35608a');
  assert.match(withAlpha('#3B9BF0', 0.45), /^rgba\(/);

  // Mixing into a background always lands between the two, per channel.
  for (const t of [0.25, 0.45, 0.75]) {
    const out = rgb(mixHex(HUES.dark.orange, TOKENS.dark.surface, t));
    const fg = rgb(HUES.dark.orange);
    const bg = rgb(TOKENS.dark.surface);
    out.forEach((v, i) => {
      const [lo, hi] = [Math.min(fg[i], bg[i]), Math.max(fg[i], bg[i])];
      assert.ok(v >= lo - 1 && v <= hi + 1, `channel ${i} left the interval at t=${t}`);
    });
  }
});

test('rampSeries stays visible and keeps its ordering in both modes', () => {
  // An ordered family of curves — Huang's seventeen r/a curves, say — is drawn
  // from a ramp rather than from the six categorical hues, because the six say
  // "different things" and this family says "further along". Two properties
  // have to hold or a seventeen-curve chart stops being readable.
  for (const theme of ['light', 'dark']) {
    const surface = TOKENS[theme].surface;
    for (const n of [2, 5, 8, 17]) {
      const series = rampSeries('orange', theme, n);
      assert.equal(series.length, n, `rampSeries returned ${series.length} for n=${n}`);
      for (const c of series) {
        assert.match(c, /^#[0-9a-f]{6}$/i, `"${c}" is not opaque hex`);
      }

      // 1. Every curve has to be visible against the card it is drawn on.
      //    §A11 asks 3:1 of a graphical object; a 2px line at 1.6:1 is a line
      //    nobody can follow, which is the failure mode this guards.
      // Light mode is the tight side, exactly as it is for the categorical
      // palette (§B4): the floor here is the emerald 500 stop at 2.14:1 on
      // white. That is under §A11's 3:1 and tolerated for the same reason —
      // the curves are direct-labelled and every chart keeps its table view,
      // so hue is never the only encoding. Dark mode clears 2.9:1 throughout.
      const floor = theme === 'light' ? 2.1 : 2.9;
      for (const c of series) {
        const ratio = contrast(c, surface);
        assert.ok(ratio >= floor,
          `${theme}: ${c} is only ${ratio.toFixed(2)}:1 on the card — too faint for a line`);
      }

      // 2. Lightness has to run one way, so the family reads as ordered
      //    rather than as an arbitrary set. Per §A4.2 the direction flips
      //    between modes so the far end always stands OFF the card.
      const lums = series.map((c) => relLuminance(rgb(c)));
      const rising = lums.every((v, i) => i === 0 || v >= lums[i - 1] - 1e-9);
      const falling = lums.every((v, i) => i === 0 || v <= lums[i - 1] + 1e-9);
      assert.ok(rising || falling,
        `${theme} n=${n}: lightness must be monotone across the family`);
      if (theme === 'light') {
        assert.ok(falling, 'light mode runs pale-low to deep-high');
      } else {
        assert.ok(rising, 'dark mode runs deep-low to luminous-high');
      }
    }
  }
});

test('rampSeries spans the ramp rather than crowding one end', () => {
  // A family whose colors all sit within a few percent of each other conveys
  // no ordering at all. The ends must actually differ.
  for (const theme of ['light', 'dark']) {
    const s = rampSeries('blue', theme, 8);
    const first = relLuminance(rgb(s[0]));
    const last = relLuminance(rgb(s[s.length - 1]));
    assert.ok(Math.abs(first - last) > 0.15,
      `${theme}: the family spans only ${Math.abs(first - last).toFixed(3)} in luminance`);
  }
});

/* ── The paper frame (§B6 deviation 5) ───────────────────────────────────
 * `paperAxis` is the one axis vocabulary in this file that deliberately
 * breaks §A7, and `paperFrame` exists because Plotly has no switch for what
 * it does. Both fail silently: a twin that loses its `overlaying` becomes a
 * second, unrelated pair of axes and the figure quietly rescales; a twin that
 * keeps its `showgrid` doubles every gridline at half opacity; and a twin
 * with no trace pointing at it is dropped, taking the top and right tick
 * values with it. None of that throws.
 */

test('the paper frame is closed on all four sides', () => {
  for (const m of MODES) {
    const x = paperAxis(m, { title: 'σz/q × 100 (%)', type: 'log', range: [-1, 2], minorDtick: 'D1' });
    const y = paperAxis(m, { title: 'z/a', range: [10, 0], tickvals: [0, 5, 10], minorDtick: 0.5 });
    const { axes, anchor } = paperFrame(m, x, y);

    // The primaries draw the box; the twins must not draw it again.
    assert.equal(axes.xaxis.showline, true, `${m}: the x axis draws no frame line`);
    assert.equal(axes.xaxis.mirror, true, `${m}: the frame is not mirrored to the far side`);
    assert.equal(axes.yaxis.mirror, true);
    assert.equal(axes.xaxis2.showline, false, `${m}: the twin would double the top border`);
    assert.equal(axes.yaxis2.showline, false);

    // Tick VALUES on all four sides — the whole point of the twins.
    assert.equal(axes.xaxis2.showticklabels, true);
    assert.equal(axes.yaxis2.showticklabels, true);
    assert.equal(axes.xaxis2.side, 'top');
    assert.equal(axes.yaxis2.side, 'right');
    assert.equal(axes.xaxis2.overlaying, 'x',
      `${m}: without overlaying, the twin is a second axis and the figure rescales`);
    assert.equal(axes.yaxis2.overlaying, 'y');

    // Same scale, or the two sides of the frame disagree about the data.
    assert.deepEqual(axes.xaxis2.range, axes.xaxis.range);
    assert.deepEqual(axes.yaxis2.range, axes.yaxis.range);
    assert.equal(axes.xaxis2.type, axes.xaxis.type);
    assert.deepEqual(axes.yaxis2.tickvals, axes.yaxis.tickvals);

    // One grid, one title.
    assert.equal(axes.xaxis2.showgrid, false, `${m}: the twin would double every gridline`);
    assert.equal(axes.xaxis2.minor.showgrid, false);
    assert.equal(axes.xaxis2.title, undefined, `${m}: the axis title would be printed twice`);
    assert.equal(axes.yaxis2.title, undefined);

    // Plotly only lays out an axis some trace lives on.
    assert.equal(anchor.xaxis, 'x2');
    assert.equal(anchor.yaxis, 'y2');
    assert.equal(anchor.hoverinfo, 'skip', 'the anchor must never answer a hover');
    assert.equal(anchor.opacity, 0);

    // A trace carries DATA even where the axis range is log10. Handing the
    // anchor the range value itself would put it at 10^-1 of where it goes,
    // and on a log axis a non-positive point is dropped outright.
    assert.equal(anchor.x[0], 0.1, `${m}: the anchor is not in data units on a log axis`);
    assert.equal(anchor.y[0], 10);
  }
});

test('a paper axis is ruled, and an ordinary axis still is not', () => {
  for (const m of MODES) {
    const paper = paperAxis(m, { title: 'z/a', range: [0, 10], minorDtick: 0.5 });
    assert.equal(paper.showgrid, true);
    assert.equal(paper.minor.showgrid, true);
    assert.equal(paper.ticks, 'outside');
    assert.equal(paper.minor.dtick, 0.5);
    // Two weights, so the labelled divisions read as the labelled ones.
    assert.notEqual(paper.gridcolor, paper.minor.gridcolor,
      `${m}: major and minor divisions must not be the same weight`);
    assert.equal(paper.gridcolor, TOKENS[m].gridStrong);
    assert.equal(paper.minor.gridcolor, TOKENS[m].gridFaint);
    assert.equal(paper.linecolor, TOKENS[m].frame);

    // §A7 is still the default for every other chart in the toolbox.
    const ordinary = axis(m, 'z/a');
    assert.equal(ordinary.showline, false);
    assert.equal(ordinary.showgrid, false);
    assert.equal(ordinary.ticks, '');

    // Omitting the minor division must mean no minor grid, not a default one.
    assert.equal(paperAxis(m, { range: [0, 10] }).minor.showgrid, false);
  }
});

test('the graph-paper chrome stays behind the data in both modes', () => {
  // Ruled paper that is louder than the curves drawn on it is worse than no
  // ruling at all — §A7's actual argument, honoured inside the deviation.
  for (const m of MODES) {
    const surface = card(m);
    const frame = contrast(TOKENS[m].frame, surface);
    const major = contrast(TOKENS[m].gridStrong, surface);
    const minor = contrast(TOKENS[m].gridFaint, surface);
    // Measured against rampSeries, not the categorical six: an ordered family
    // of curves is what a reproduced design chart draws, and its pale end is
    // the faintest thing that will ever sit on this paper.
    const faintestCurve = Math.min(
      ...['orange', 'blue', 'emerald', 'neutral'].flatMap(
        r => rampSeries(r, m, 17).map(c => contrast(c, surface))
      )
    );

    assert.ok(frame > major && major > minor,
      `${m}: the frame, the major grid and the minor grid must read as three weights ` +
      `(got ${frame.toFixed(2)}, ${major.toFixed(2)}, ${minor.toFixed(2)})`);
    assert.ok(frame < faintestCurve,
      `${m}: the frame at ${frame.toFixed(2)}:1 is louder than the faintest curve it ` +
      `carries at ${faintestCurve.toFixed(2)}:1 — ruled paper must sit behind the data`);
    assert.ok(minor > 1.02,
      `${m}: the minor grid at ${minor.toFixed(3)}:1 is invisible, so the paper is not ruled`);
  }
});
