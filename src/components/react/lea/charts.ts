// The Chapter 2 chart catalog — every empirical design chart in Huang (2004)
// Chapter 2, described well enough to be redrawn and read in both directions.
//
// A chart in the book is a picture of a function of two or three dimensionless
// groups. Foster and Ahlvin's Figure 2.2, for instance, is σz/q over (r/a,
// z/a): one curve per r/a, depth down the page, the value across it on a log
// scale. Everything a reader does with that page — find a value from two
// parameters, or find the parameter that would give a value — is an evaluation
// or an inversion of that function.
//
// So each chart here carries its axes, its curve family, an `evaluate` that
// computes the plotted quantity, and a generic inverse. Nothing is digitized:
// the evaluators call the same solvers the rest of the tool uses, which is why
// they reproduce the book's own worked chart reads (see the tests).
//
// ── The two nomographs ───────────────────────────────────────────────────
// Figures 2.21 and 2.31 are not Cartesian plots. They are lattices of two
// crossing curve families over an abscissa that carries no variable at all —
// you find the intersection of your two curves and read the ordinate. There is
// nothing to reproduce on the x axis because there was never anything on it.
// Both are therefore RECTIFIED here: the same two families, plotted against
// one of them on a real axis. Same numbers, same anchors, readable scale. The
// `rectified` flag marks them so the UI can say so rather than implying the
// drawing matches the book's.
import {
  sigZRatio, sigRRatio, sigTRatio, tauRatio, deflectionFactorAt,
} from './oneLayer.ts';
import {
  verticalStressProfile, interfaceStressRatio, surfaceDeflectionFactor,
  interfaceDeflectionFactor, strainFactor, conversionFactor,
  CHART_SD, CHART_RADII,
} from './twoLayer.ts';
import { stressFactors } from './threeLayer.ts';

export type ChartSection = 'One layer' | 'Two layers' | 'Three layers';

export interface AxisSpec {
  /** Axis title, already pre-uppercased where it carries a Greek letter. */
  label: string;
  log: boolean;
  min: number;
  max: number;
  /** The tick values the book prints, so a redraw reads like the original. */
  ticks?: number[];
  /** Depth-like axes run down the page. */
  reversed?: boolean;
}

export interface FamilySpec {
  /** "Curves are r/a" — what the label on each curve means. */
  label: string;
  /** The symbol, for the readout. */
  symbol: string;
  /** The values the book draws. */
  values: number[];
  /** The continuous range the inverse may search, usually wider. */
  range: [number, number];
  /** Search on a log scale — right for a modulus ratio, wrong for r/a. */
  logSearch?: boolean;
}

export interface PanelSpec {
  label: string;
  symbol: string;
  values: number[];
  /** Rendered name for one panel, e.g. "k₁ = 20, k₂ = 2". */
  name?: (v: number) => string;
}

export interface ChartSpec {
  id: string;
  /** "Figure 2.2". */
  figure: string;
  title: string;
  /** "After Foster and Ahlvin (1954)". */
  source: string;
  section: ChartSection;
  /** One sentence: what a reader comes to this chart for. */
  purpose: string;
  /** The equation that turns the chart value into an answer. */
  equation: string;
  /** The plotted quantity's axis. */
  value: AxisSpec;
  /** The axis swept along each curve — depth, thickness, radius ratio. */
  sweep: AxisSpec;
  /** Depth charts put the value on x; the rest put it on y. */
  valueOnX: boolean;
  family: FamilySpec;
  panel?: PanelSpec;
  /** value = evaluate(family, sweep, panel). */
  evaluate: (fv: number, sv: number, pv?: number) => number;
  /** True for the two nomographs redrawn on real axes. */
  rectified?: boolean;
  /** Points to plot per curve. Heavy charts ask for fewer. */
  samples?: number;
  /**
   * Every point is a search rather than a single solve, so a panel takes
   * seconds rather than milliseconds. The UI shows a loader and computes only
   * the selected panel; the tests sweep one panel exhaustively and spot-check
   * the rest.
   */
  heavy?: boolean;
  /** Warnings and caveats shown under the chart. */
  notes?: string[];
  /**
   * A worked read printed in the book, drawn on the chart as a checkpoint.
   * `reads` is the number Huang prints; if the curve does not pass through
   * it, the redraw has stopped being the book's chart.
   */
  anchors?: { fv: number; sv: number; pv?: number; reads: number; label: string }[];
}

/* ── Axis vocabulary ─────────────────────────────────────────────────────
 * Foster and Ahlvin's four stress charts share one abscissa — a five-decade
 * log scale in percent — and one ordinate, z/a down the page. Reusing the
 * same objects keeps them literally identical, which is the point: the whole
 * family is meant to be read against itself.
 */
const PERCENT_TICKS = [0.1, 0.2, 0.3, 0.4, 0.6, 0.8, 1, 2, 4, 6, 8, 10, 20, 40, 60, 80, 100];

const percentAxis = (label: string): AxisSpec => ({
  label, log: true, min: 0.1, max: 100, ticks: PERCENT_TICKS,
});

const depthAxis = (max: number): AxisSpec => ({
  label: 'z/a', log: false, min: 0, max, reversed: true,
});

/** The r/a curves Foster and Ahlvin label on Figures 2.2, 2.3 and 2.5. */
const RA_FULL = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10];
const RA_RANGE: [number, number] = [0, 12];

/* ═══════════════════════════════════════════════════════════════════════
   §2.1.1 — Solutions by charts, the homogeneous half-space
   ═══════════════════════════════════════════════════════════════════════
   Foster and Ahlvin (1954), all drawn for ν = 0.5: "Because Poisson ratio
   has a relatively small effect on stresses and deflections, Foster and
   Ahlvin assumed the half-space to be incompressible with a Poisson ratio of
   0.5, so only one set of charts is needed instead of one for each Poisson
   ratio." Every one of these is exact — see oneLayer.ts.
*/

const FIG_2_2: ChartSpec = {
  id: 'fig-2-2',
  figure: 'Figure 2.2',
  title: 'Vertical stresses due to circular loading',
  source: 'After Foster and Ahlvin (1954)',
  section: 'One layer',
  purpose:
    'The vertical stress anywhere in a half-space under a circular load — the quantity ' +
    'that decides how much load reaches the subgrade.',
  equation: 'σz = q · (chart value)/100',
  value: percentAxis('σz/q × 100 (%)'),
  sweep: depthAxis(10),
  valueOnX: true,
  family: { label: 'Curves are r/a', symbol: 'r/a', values: RA_FULL, range: RA_RANGE },
  evaluate: (ra, za) => 100 * sigZRatio(ra, za),
  anchors: [
    { fv: 0, sv: 2, reads: 28, label: 'Example 2.1, left load' },
    { fv: 4, sv: 2, reads: 0.76, label: 'Example 2.1, right load' },
  ],
  notes: [
    'σz is independent of E and ν — Huang notes it under Eq. 2.3 — so this one chart ' +
    'serves every material as well as every load.',
  ],
};

const FIG_2_3: ChartSpec = {
  id: 'fig-2-3',
  figure: 'Figure 2.3',
  title: 'Radial stresses due to circular loading',
  source: 'After Foster and Ahlvin (1954)',
  section: 'One layer',
  purpose:
    'The radial stress, which with σz and σt gives the strains through Eq. 2.1.',
  equation: 'σr = q · (chart value)/100',
  value: percentAxis('σr/q × 100 (%)'),
  sweep: depthAxis(10),
  valueOnX: true,
  family: { label: 'Curves are r/a', symbol: 'r/a', values: RA_FULL, range: RA_RANGE },
  evaluate: (ra, za) => 100 * sigRRatio(ra, za),
  anchors: [
    { fv: 0, sv: 2, reads: 1.6, label: 'Example 2.1, left load' },
    { fv: 4, sv: 2, reads: 2.6, label: 'Example 2.1, right load' },
  ],
  notes: [
    'Drawn for ν = 0.5, and the Poisson ratio matters here in a way it does not for σz. ' +
    'At ν = 0.3 the radial stress under the center turns TENSILE below about z/a = 1.5 — ' +
    'Example 2.2 computes −0.25 psi where this chart, at ν = 0.5, gives +0.8 psi.',
    'Every curve runs off the left edge as z/a → 0, because at ν = 0.5 the surface outside ' +
    'the loaded circle carries no horizontal stress at all.',
  ],
};

const FIG_2_4: ChartSpec = {
  id: 'fig-2-4',
  figure: 'Figure 2.4',
  title: 'Tangential stresses due to circular loading',
  source: 'After Foster and Ahlvin (1954)',
  section: 'One layer',
  purpose: 'The circumferential stress — the third normal stress Eq. 2.1 needs.',
  equation: 'σt = q · (chart value)/100',
  value: percentAxis('σt/q × 100 (%)'),
  sweep: depthAxis(5),
  valueOnX: true,
  family: {
    label: 'Curves are r/a', symbol: 'r/a',
    values: [0, 0.25, 0.5, 0.75, 1, 1.5, 2, 2.5], range: [0, 4],
  },
  evaluate: (ra, za) => 100 * sigTRatio(ra, za),
  notes: [
    'Example 2.1 reads this chart as ZERO at r/a = 4, z/a = 2 — and that is the right read. ' +
    'The true value is 0.043% of q, a fifth of the way below the bottom of the scale, so the ' +
    'chart has nothing to show there. It is the one anchor in the tool that cannot be plotted.',
    'This chart covers less ground than Figures 2.2 and 2.3 — z/a to 5 instead of 10, r/a to ' +
    '2.5 instead of 10 — because σt collapses with radius far faster than σz does. By ' +
    'r/a = 2 at the surface it is already below 0.1% of q and off the scale.',
    'The outer curves hook back on themselves: σt at r/a = 2.5 peaks below the surface, not on it.',
  ],
};

const FIG_2_5: ChartSpec = {
  id: 'fig-2-5',
  figure: 'Figure 2.5',
  title: 'Shear stresses due to circular loading',
  source: 'After Foster and Ahlvin (1954)',
  section: 'One layer',
  purpose:
    'The shear stress in the r–z plane, which vanishes on the axis and peaks near the edge ' +
    'of the load — the reason a critical tensile strain can move off the axis.',
  equation: 'τrz = q · (chart value)/100',
  value: percentAxis('ΤRZ/q × 100 (%)'),
  sweep: depthAxis(10),
  valueOnX: true,
  family: {
    label: 'Curves are r/a', symbol: 'r/a',
    values: [0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10],
    range: [0.01, 12],
  },
  evaluate: (ra, za) => 100 * tauRatio(ra, za),
  notes: [
    'There is no r/a = 0 curve, and there cannot be: τrz is identically zero on the axis of ' +
    'symmetry, which is why σz and σr are principal stresses there.',
    'The shear peaks under the rim of the load, near r/a = 1 and z/a ≈ 0.75, at about 18% of q.',
  ],
};

const FIG_2_6: ChartSpec = {
  id: 'fig-2-6',
  figure: 'Figure 2.6',
  title: 'Vertical deflections due to circular loading',
  source: 'After Foster and Ahlvin (1954)',
  section: 'One layer',
  purpose:
    'The deflection factor F — what an FWD sensor at radius r would read over a half-space.',
  equation: 'w = (q·a/E) · F',
  value: {
    label: 'Deflection factor F', log: true, min: 0.1, max: 3,
    ticks: [0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.5, 2, 3],
  },
  sweep: depthAxis(10),
  valueOnX: true,
  family: {
    label: 'Curves are r/a', symbol: 'r/a',
    values: [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8],
    range: [0, 10],
  },
  evaluate: (ra, za) => deflectionFactorAt(ra, za),
  anchors: [
    { fv: 0, sv: 2, reads: 0.68, label: 'Example 2.1, left load' },
    { fv: 4, sv: 2, reads: 0.21, label: 'Example 2.1, right load' },
  ],
  notes: [
    'At the surface under the center, F = 2(1 − ν²) = 1.5 at ν = 0.5 — Eq. 2.8. A RIGID plate ' +
    'of the same average pressure gives only π/4 of that, 1.18, which is Eq. 2.10.',
  ],
};

/* ═══════════════════════════════════════════════════════════════════════
   §2.2.1 — Two-layer systems
   ═══════════════════════════════════════════════════════════════════════
   "As in all charts presented in this section, a Poisson ratio of 0.5 is
   assumed for all layers." — Huang, page 58.
*/

const FIG_2_14: ChartSpec = {
  id: 'fig-2-14',
  figure: 'Figure 2.14',
  title: 'Vertical stress distribution in a two-layer system',
  source: 'After Burmister (1958)',
  section: 'Two layers',
  purpose:
    'What a stiff surface layer does to the vertical stress below it — the argument for ' +
    'building a pavement at all, in one picture.',
  equation: 'σz = q · (chart value)',
  value: { label: 'σz/q', log: false, min: 0, max: 1, ticks: [0, 0.2, 0.4, 0.6, 0.8, 1] },
  sweep: { label: 'z/a', log: false, min: 0, max: 3, reversed: true },
  valueOnX: true,
  family: {
    label: 'Curves are E₁/E₂', symbol: 'E₁/E₂',
    values: [1, 2.5, 5, 10, 25, 50, 100], range: [1, 200], logSearch: true,
  },
  evaluate: (er, za) => verticalStressProfile(er, za, 1),
  notes: [
    'Drawn for h₁/a = 1 only, so the interface sits at z/a = 1 on every curve.',
    'At the interface the vertical stress is about 68% of the applied pressure when ' +
    'E₁/E₂ = 1 — that is just Boussinesq — and about 8% when E₁/E₂ = 100.',
  ],
};

const FIG_2_15: ChartSpec = {
  id: 'fig-2-15',
  figure: 'Figure 2.15',
  title: 'Vertical interface stresses for two-layer systems',
  source: 'After Huang (1969b)',
  section: 'Two layers',
  purpose:
    'The vertical stress delivered to the top of the subgrade — the quantity a thickness ' +
    'is designed to limit.',
  equation: 'σc = q · (chart value);  Nd = 4.873×10⁻⁵ σc⁻³·⁷³⁴ E₂³·⁵⁸³ (Eq. 2.13)',
  value: { label: 'σc/q', log: false, min: 0, max: 0.9, ticks: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9] },
  sweep: { label: 'a/h₁', log: false, min: 0, max: 2.4, ticks: [0, 0.4, 0.8, 1.2, 1.6, 2.0, 2.4] },
  valueOnX: false,
  family: {
    label: 'Curves are E₁/E₂', symbol: 'E₁/E₂',
    values: [1, 2.5, 5, 10, 25, 50, 100], range: [1, 500], logSearch: true,
  },
  evaluate: (er, aOverH1) => (aOverH1 <= 0 ? 0 : interfaceStressRatio(er, aOverH1)),
  anchors: [
    { fv: 100, sv: 1.15, reads: 0.1, label: 'Example 2.5, full depth' },
    { fv: 5, sv: 0.4, reads: 0.1, label: 'Example 2.5, granular base' },
  ],
  notes: [
    'The abscissa is a/h₁, not h₁/a — Huang notes the reason was preparing influence charts. ' +
    'A thicker layer is therefore to the LEFT.',
  ],
};

const FIG_2_17: ChartSpec = {
  id: 'fig-2-17',
  figure: 'Figure 2.17',
  title: 'Vertical surface deflections for two-layer systems',
  source: 'After Burmister (1943)',
  section: 'Two layers',
  purpose:
    'Surface deflection under the load — and, read backwards, the modulus a plate bearing ' +
    'test implies.',
  equation: 'w₀ = 1.5·q·a·F₂/E₂  (flexible plate, Eq. 2.14);  1.18·q·a·F₂/E₂  (rigid, Eq. 2.15)',
  value: {
    label: 'Deflection factor F₂', log: true, min: 0.02, max: 1,
    ticks: [0.02, 0.03, 0.04, 0.05, 0.06, 0.08, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1],
  },
  sweep: { label: 'h₁/a', log: false, min: 0, max: 6, ticks: [0, 0.5, 1, 1.5, 2, 3, 4, 5, 6] },
  valueOnX: false,
  family: {
    label: 'Curves are E₁/E₂', symbol: 'E₁/E₂',
    values: [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000],
    range: [1, 20000], logSearch: true,
  },
  evaluate: (er, hOverA) => surfaceDeflectionFactor(er, hOverA),
  anchors: [{ fv: 5, sv: 1.333, reads: 0.511, label: 'Example 2.6: a plate test giving E₁/E₂ = 5' }],
  notes: [
    'F₂ = 1 at h₁/a = 0, where Eq. 2.14 collapses to Eq. 2.8 — that is what the 1.5 is for.',
    'This F₂ is 1/1.5 of the F in Figure 2.19. Huang flags the difference under Eq. 2.16, ' +
    'and it is the easiest slip to make when moving between the two charts.',
  ],
};

const FIG_2_19: ChartSpec = {
  id: 'fig-2-19',
  figure: 'Figure 2.19',
  title: 'Vertical interface deflections for two-layer systems',
  source: 'After Huang (1969c)',
  section: 'Two layers',
  purpose:
    'Deflection on the layer-1/layer-2 interface at any radius — superposable, which is how ' +
    'Example 2.7 handles a dual.',
  equation: 'w = (q·a/E₂) · F',
  value: {
    label: 'Deflection factor F', log: false, min: 0, max: 1.5,
    ticks: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5],
  },
  sweep: { label: 'h₁/a', log: false, min: 0.05, max: 7, ticks: [0, 1, 2, 3, 4, 5, 6, 7], reversed: true },
  valueOnX: true,
  family: {
    label: 'Curves are r/a', symbol: 'r/a',
    values: [0, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 7, 10, 15],
    range: [0, 20],
  },
  panel: {
    label: 'Modulus ratio', symbol: 'E₁/E₂',
    values: [1, 2.5, 5, 10, 25, 50, 100],
    name: v => `E₁/E₂ = ${v}`,
  },
  evaluate: (ra, hOverA, er) => interfaceDeflectionFactor(er ?? 1, hOverA, ra),
  anchors: [
    { fv: 0, sv: 1.33, pv: 10, reads: 0.56, label: 'Example 2.7, near load' },
    { fv: 2.99, sv: 1.33, pv: 10, reads: 0.28, label: 'Example 2.7, far load' },
  ],
  notes: [
    'Huang prints seven separate panels, one per modulus ratio, and tells the reader to ' +
    'interpolate between them. Here E₁/E₂ is continuous — pick any value, not just the seven.',
    'The E₁/E₂ = 1 panel is Boussinesq.',
  ],
};

const FIG_2_21: ChartSpec = {
  id: 'fig-2-21',
  figure: 'Figure 2.21',
  title: 'Strain factor for a single wheel',
  source: 'After Huang (1973a)',
  section: 'Two layers',
  rectified: true,
  purpose:
    'The critical tensile strain at the bottom of layer 1 — the number a fatigue transfer ' +
    'function consumes.',
  equation: 'e = (q/E₁) · Fe  (Eq. 2.17)',
  value: {
    label: 'Strain factor Fe', log: true, min: 0.01, max: 20,
    ticks: [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20],
  },
  sweep: { label: 'h₁/a', log: false, min: 0.1, max: 4, ticks: [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4] },
  valueOnX: false,
  family: {
    label: 'Curves are E₁/E₂', symbol: 'E₁/E₂',
    values: [1, 2, 5, 10, 20, 50, 100, 200], range: [1, 400], logSearch: true,
  },
  evaluate: (er, hOverA) => strainFactor(er, hOverA),
  anchors: [{ fv: 10, sv: 1.23, reads: 0.72, label: 'Example 2.8' }],
  samples: 40,
  notes: [
    'Because the interface is bonded, this same factor gives the vertical compressive strain ' +
    'on the subgrade when layer 2 is incompressible: Eq. 2.21 makes εz twice the horizontal εr.',
    'The curves rise before they fall at low E₁/E₂ and low h₁/a. That is not noise — it is the ' +
    'critical point leaving the axis of symmetry, driven off it by the shear stress of ' +
    'Figure 2.5. Huang computed r/a = 0, 0.5, 1 and 1.5 and took the worst; so does this.',
  ],
};

const FIG_2_23: ChartSpec = {
  id: 'fig-2-23',
  figure: 'Figures 2.23 and 2.25–2.27',
  title: 'Conversion factor for dual and dual-tandem wheels',
  source: 'After Huang (1973a)',
  section: 'Two layers',
  purpose:
    'How much worse a wheel group is than one wheel. Multiply Figure 2.21 by this and the ' +
    'single-wheel chart covers duals and tandems too.',
  equation: 'Fe(group) = C · Fe(single);  C = C₁ + 0.2(a′ − 3)(C₂ − C₁)  (Eq. 2.19)',
  value: { label: 'Conversion factor C', log: false, min: 1, max: 1.8, ticks: [1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8] },
  sweep: { label: 'Thickness of asphalt layer, in.', log: false, min: 2, max: 18, ticks: [2, 6, 10, 14, 18] },
  valueOnX: false,
  family: {
    label: 'Curves are E₁/E₂', symbol: 'E₁/E₂',
    values: [1, 2, 5, 10, 20, 50, 100, 200], range: [1, 400], logSearch: true,
  },
  panel: {
    // Sd is fixed at 24 in on every panel; a and St are what vary.
    // Encoded as a·1000 + St, with St = 0 meaning duals alone.
    label: 'Chart panel', symbol: 'a, St',
    values: [
      3000, 8000,
      3024, 8024,
      3048, 8048,
      3072, 8072,
    ],
    name: v => {
      const a = Math.floor(v / 1000), st = v % 1000;
      return st === 0
        ? `${a === 3 ? 'C₁' : 'C₂'} · a = ${a} in, duals only (Fig. 2.23)`
        : `${a === 3 ? 'C₁' : 'C₂'} · a = ${a} in, St = ${st} in (Fig. 2.${st === 24 ? 25 : st === 48 ? 26 : 27})`;
    },
  },
  heavy: true,
  evaluate: (er, h1, panel) => {
    const a = Math.floor((panel ?? 3000) / 1000);
    const st = (panel ?? 3000) % 1000;
    return conversionFactor(er, h1, a, CHART_SD, st === 0 ? null : st);
  },
  samples: 9,
  anchors: [
    { fv: 10, sv: 16.7, pv: 3000, reads: 1.35, label: 'Example 2.9, C₁' },
    { fv: 10, sv: 16.7, pv: 8000, reads: 1.46, label: 'Example 2.9, C₂' },
    { fv: 10, sv: 16.7, pv: 3072, reads: 1.23, label: 'Example 2.10, C₁' },
    { fv: 10, sv: 16.7, pv: 8072, reads: 1.30, label: 'Example 2.10, C₂' },
  ],
  notes: [
    `Every panel is drawn for a dual spacing of ${CHART_SD} in. A real group is rescaled to it ` +
    `by Eq. 2.18 — a′ = 24a/Sd and h₁′ = 24h₁/Sd — which holds h₁/a and Sd/a, and therefore ` +
    'the answer, fixed.',
    `The two contact radii ${CHART_RADII[0]} in and ${CHART_RADII[1]} in are the C₁ and C₂ ` +
    'panels of each figure; Eq. 2.19 interpolates between them.',
    'Adding a tandem axle often REDUCES the factor — the extra wheels compensate rather than ' +
    'add. The dip is deepest near St = 48 in, and by St = 120 in the tandem has faded back ' +
    'into the duals-only chart, which is why Figure 2.23 can stand in for it.',
    'This chart is the slowest in the tool: every point is a full critical-strain search over ' +
    'a wheel group, not a single solve.',
  ],
};

/* ═══════════════════════════════════════════════════════════════════════
   §2.2.2 — Three-layer systems
   ═══════════════════════════════════════════════════════════════════════ */

const FIG_2_31: ChartSpec = {
  id: 'fig-2-31',
  figure: 'Figure 2.31',
  title: 'Horizontal strain factor at the bottom of layer 1',
  source: 'After Peattie (1962)',
  section: 'Three layers',
  rectified: true,
  purpose:
    'The tensile strain under the surface course of a three-layer section, without ' +
    "interpolating Jones' four-way table.",
  equation: 'εr = (q/E₁) · (RR1 − ZZ1)/2  (Eq. 2.25)',
  value: {
    label: '(RR1 − ZZ1)/2', log: true, min: 0.001, max: 100,
    ticks: [0.001, 0.01, 0.1, 1, 10, 100],
  },
  sweep: { label: 'A = a/h₂', log: true, min: 0.1, max: 3.2, ticks: [0.1, 0.2, 0.4, 0.8, 1.6, 3.2] },
  valueOnX: false,
  family: {
    label: 'Curves are H = h₁/h₂', symbol: 'H',
    values: [0.125, 0.25, 0.5, 1, 2, 4, 8], range: [0.05, 12], logSearch: true,
  },
  panel: {
    label: 'Modulus ratios', symbol: 'k₁, k₂',
    values: [202, 220, 2002, 2020, 20002, 20020],
    name: v => `k₁ = ${Math.floor(v / 100)}, k₂ = ${v % 100}`,
  },
  evaluate: (H, A, panel) => {
    const k1 = Math.floor((panel ?? 202) / 100), k2 = (panel ?? 202) % 100;
    const f = stressFactors({ k1, k2, A, H });
    return f ? f.peattie : NaN;
  },
  samples: 30,
  notes: [
    'Huang reprints only the realistic panels — k₁ ∈ {2, 20, 200} and k₂ ∈ {2, 20}. Jones’ ' +
    'own tables also carry 0.2, for a layer softer than the one beneath it.',
    'The factor goes NEGATIVE in one corner: a layer 1 much thinner than layer 2 under a very ' +
    'wide load does not bend, so its underside is in compression, not tension. A log axis ' +
    'cannot draw that, which is why the printed lattice closes to a point instead of continuing.',
    'The plotted quantity is the positive magnitude, as Huang draws it. The strain itself is ' +
    'tension.',
  ],
};

export const CHARTS: ChartSpec[] = [
  FIG_2_2, FIG_2_3, FIG_2_4, FIG_2_5, FIG_2_6,
  FIG_2_14, FIG_2_15, FIG_2_17, FIG_2_19, FIG_2_21, FIG_2_23,
  FIG_2_31,
];

export const chartById = (id: string) => CHARTS.find(c => c.id === id);

export const SECTIONS: ChartSection[] = ['One layer', 'Two layers', 'Three layers'];

/* ── Drawing ─────────────────────────────────────────────────────────────── */

export interface CurvePoint { sweep: number; value: number }

/**
 * Sample one curve of the family across the sweep axis.
 *
 * Sampling follows the axis: a log sweep is sampled geometrically, so the
 * points are evenly spaced on the drawing rather than bunched at one end.
 * Values that fall off the value axis are kept as NaN rather than clamped —
 * Plotly breaks the line there, which is what the book's own curves do when
 * they leave the frame.
 */
export function sampleCurve(spec: ChartSpec, familyValue: number, panelValue?: number): CurvePoint[] {
  const n = spec.samples ?? 70;
  const { min, max, log } = spec.sweep;
  const lo = log ? Math.log(Math.max(min, 1e-9)) : min;
  const hi = log ? Math.log(max) : max;
  const out: CurvePoint[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const sweep = log ? Math.exp(lo + t * (hi - lo)) : lo + t * (hi - lo);
    const value = spec.evaluate(familyValue, sweep, panelValue);
    const inFrame = Number.isFinite(value) &&
      value >= spec.value.min * 0.9 && value <= spec.value.max * 1.1 &&
      (!spec.value.log || value > 0);
    out.push({ sweep, value: inFrame ? value : NaN });
  }
  return out;
}

/* ── Reading the chart backwards ─────────────────────────────────────────
 * The half of the interaction that a paper chart cannot do at all. Given a
 * point ON the chart — a value and a sweep coordinate, which is exactly what
 * a cursor position is — find the family value whose curve passes through it.
 *
 * The families are not all monotone: σt's curves hook back, and Figure 2.21's
 * rise before they fall. So this scans the family range for sign changes in
 * (evaluate − target) and bisects each one, returning EVERY root rather than
 * assuming there is one. Two roots is a real answer — it means two different
 * radii give the same stress at that depth — and zero roots is also a real
 * answer, which the UI reports rather than inventing a number for.
 */
export function invertFamily(
  spec: ChartSpec, targetValue: number, sweepValue: number, panelValue?: number,
  scanSteps = 240
): number[] {
  const [lo, hi] = spec.family.range;
  const useLog = spec.family.logSearch === true && lo > 0;
  const toX = (t: number) => (useLog
    ? Math.exp(Math.log(lo) + t * (Math.log(hi) - Math.log(lo)))
    : lo + t * (hi - lo));

  const f = (t: number) => {
    const v = spec.evaluate(toX(t), sweepValue, panelValue);
    return Number.isFinite(v) ? v - targetValue : NaN;
  };

  const roots: number[] = [];
  let prevT = 0, prevF = f(0);
  if (prevF === 0) roots.push(toX(0));

  for (let i = 1; i <= scanSteps; i++) {
    const t = i / scanSteps;
    const fv = f(t);
    // A root landing exactly ON a scan node makes the product zero, not
    // negative, and a strict sign test walks straight past it. That is not a
    // corner case here: the family values are round numbers and the scan is a
    // round division, so they coincide constantly — r/a = 2.5 on a 240-step
    // scan of [0, 12] is step 50 exactly, and the inverse of the chart's own
    // labelled curve came back empty.
    if (fv === 0) {
      roots.push(toX(t));
    } else if (Number.isFinite(prevF) && Number.isFinite(fv) && prevF * fv < 0) {
      // Bisect this bracket. 40 halvings is far past what the scan resolves.
      let a = prevT, b = t, fa = prevF;
      for (let k = 0; k < 40; k++) {
        const m = 0.5 * (a + b);
        const fm = f(m);
        if (!Number.isFinite(fm)) break;
        if (fa * fm <= 0) b = m; else { a = m; fa = fm; }
      }
      roots.push(toX(0.5 * (a + b)));
    }
    prevT = t;
    prevF = fv;
  }
  return roots;
}

/**
 * Nearest point on any drawn curve to a place on the chart, in SCREEN terms —
 * distances are measured in fractions of the plot box, not in data units, so
 * a log decade and a linear inch weigh the same to the eye and to this.
 *
 * This is the other half of reading a chart: not "what parameter gives this
 * value" but "which printed curve am I closest to", which is what a reader
 * actually does with a page of seventeen curves.
 */
export function nearestCurve(
  spec: ChartSpec, valueAt: number, sweepAt: number,
  drawn: { fv: number; pts: CurvePoint[] }[]
): { familyValue: number; sweep: number; value: number; distance: number } | null {
  const normV = (v: number) => {
    const { min, max, log } = spec.value;
    if (log) return (Math.log(Math.max(v, 1e-12)) - Math.log(min)) / (Math.log(max) - Math.log(min));
    return (v - min) / (max - min);
  };
  const normS = (s: number) => {
    const { min, max, log } = spec.sweep;
    if (log) return (Math.log(Math.max(s, 1e-12)) - Math.log(Math.max(min, 1e-12))) /
      (Math.log(max) - Math.log(Math.max(min, 1e-12)));
    return (s - min) / (max - min);
  };
  const tv = normV(valueAt), ts = normS(sweepAt);

  let best: { familyValue: number; sweep: number; value: number; distance: number } | null = null;
  // Searches the curves ALREADY DRAWN rather than re-sampling them. That is not
  // an optimization detail: this runs on every pointer move, and re-sampling
  // the conversion-factor chart would be eighty critical-strain searches per
  // frame -- seconds of work to answer a question about where the mouse is.
  for (const cv of drawn) {
    for (const p of cv.pts) {
      if (!Number.isFinite(p.value)) continue;
      const d = Math.hypot(normV(p.value) - tv, normS(p.sweep) - ts);
      if (!best || d < best.distance) {
        best = { familyValue: cv.fv, sweep: p.sweep, value: p.value, distance: d };
      }
    }
  }
  return best;
}
