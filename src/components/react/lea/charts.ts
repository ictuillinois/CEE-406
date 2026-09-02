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
// you find the intersection of your two curves and read the ordinate.
//
// They were rectified here at first, each plotted against one of its two
// families on a real axis, on the reasoning that a blank abscissa cannot be
// reproduced. That threw away the figure: the mesh IS the figure, and the
// mesh turns out to be exactly reproducible. The `nomograph` flag marks them
// and sampleLattice, at the foot of this file, draws them as drawn.
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
  /**
   * The division between labelled ticks, drawn as a faint minor grid — the
   * ruled paper the chart was originally printed on. A number on a linear
   * axis; 'D1' (every mantissa) or 'D2' (2 and 5 only) on a log one. Omit
   * where the labelled ticks are already dense enough to interpolate between.
   */
  minorDtick?: number | string;
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
  /**
   * Drawn as a LATTICE rather than as a plot: two families crossing over an
   * abscissa that carries no variable. Figures 2.21 and 2.31 only. See
   * sampleLattice for how the mesh is built and why it is the book's mesh.
   */
  nomograph?: boolean;
  /** Points to plot per curve. Heavy charts ask for fewer. */
  samples?: number;
  /**
   * A point of this chart costs milliseconds rather than microseconds — a
   * critical-strain search over a wheel group, or a four-layer solve — so a
   * whole figure takes seconds. The UI shows a loader, computes only the
   * selected panel, and will not run the INVERSE while the pointer is moving:
   * a 240-step scan of a millisecond evaluator is a second of work to answer
   * a question about where the mouse is. The tests sweep one panel
   * exhaustively and spot-check the rest.
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
  // Foster and Ahlvin drew these on three-cycle semilog paper. 'D1' is that
  // paper: a line at every mantissa, which is what makes a value between two
  // labelled decades readable rather than guessable.
  minorDtick: 'D1',
});

const depthAxis = (max: number): AxisSpec => ({
  label: 'z/a', log: false, min: 0, max, reversed: true,
  ticks: Array.from({ length: max + 1 }, (_, i) => i),
  minorDtick: max <= 5 ? 0.25 : 0.5,
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
  family: { label: 'Numbers on curves indicate r/a', symbol: 'r/a', values: RA_FULL, range: RA_RANGE },
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
  family: { label: 'Numbers on curves indicate r/a', symbol: 'r/a', values: RA_FULL, range: RA_RANGE },
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
    label: 'Numbers on curves indicate r/a', symbol: 'r/a',
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
    label: 'Numbers on curves indicate r/a', symbol: 'r/a',
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
    minorDtick: 'D1',
  },
  sweep: depthAxis(10),
  valueOnX: true,
  family: {
    label: 'Numbers on curves indicate r/a', symbol: 'r/a',
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
  value: {
    label: 'σz/q', log: false, min: 0, max: 1,
    ticks: [0, 0.2, 0.4, 0.6, 0.8, 1], minorDtick: 0.05,
  },
  sweep: {
    label: 'z/a', log: false, min: 0, max: 3, reversed: true,
    ticks: [0, 0.5, 1, 1.5, 2, 2.5, 3], minorDtick: 0.25,
  },
  valueOnX: true,
  family: {
    label: 'Numbers on curves indicate E₁/E₂', symbol: 'E₁/E₂',
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
  value: {
    label: 'σc/q', log: false, min: 0, max: 0.9,
    ticks: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9], minorDtick: 0.025,
  },
  sweep: {
    label: 'a/h₁', log: false, min: 0, max: 2.4,
    ticks: [0, 0.4, 0.8, 1.2, 1.6, 2.0, 2.4], minorDtick: 0.1,
  },
  valueOnX: false,
  family: {
    label: 'Numbers on curves indicate E₁/E₂', symbol: 'E₁/E₂',
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
    minorDtick: 'D1',
  },
  sweep: {
    label: 'h₁/a', log: false, min: 0, max: 6,
    ticks: [0, 0.5, 1, 1.5, 2, 3, 4, 5, 6], minorDtick: 0.25,
  },
  valueOnX: false,
  family: {
    label: 'Numbers on curves indicate E₁/E₂', symbol: 'E₁/E₂',
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
    minorDtick: 0.025,
  },
  sweep: {
    label: 'h₁/a', log: false, min: 0.05, max: 7,
    ticks: [0, 1, 2, 3, 4, 5, 6, 7], minorDtick: 0.25, reversed: true,
  },
  valueOnX: true,
  family: {
    label: 'Numbers on curves indicate r/a', symbol: 'r/a',
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
  nomograph: true,
  purpose:
    'The critical tensile strain at the bottom of layer 1 — the number a fatigue transfer ' +
    'function consumes.',
  equation: 'e = (q/E₁) · Fe  (Eq. 2.17)',
  value: {
    label: 'Strain factor Fe', log: true, min: 0.01, max: 20,
    ticks: [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20],
    minorDtick: 'D1',
  },
  sweep: {
    label: 'h₁/a', log: false, min: 0.25, max: 4,
    // The nine stations the plate draws as its second family, 0.25 included.
    ticks: [0.25, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4], minorDtick: 0.25,
  },
  valueOnX: false,
  family: {
    label: 'Numbers on curves indicate E₁/E₂', symbol: 'E₁/E₂',
    // 0.25 and 0.5 are on the page too — a surface course SOFTER than what
    // it lies on, which is the case the lattice's left corner is.
    values: [0.25, 0.5, 1, 2, 5, 10, 20, 50, 100, 200], range: [0.2, 400], logSearch: true,
  },
  evaluate: (er, hOverA) => strainFactor(er, hOverA),
  anchors: [{ fv: 10, sv: 1.23, reads: 0.72, label: 'Example 2.8' }],
  // A lattice draws both families, nineteen curves rather than eight, and
  // every point of it is a critical-strain search. Twenty-two stations a
  // curve is what keeps the figure inside a couple of seconds; the mesh is
  // smooth enough that a spline through them is the same drawing.
  samples: 22,
  heavy: true,
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
  value: {
    label: 'Conversion factor C', log: false, min: 1, max: 1.8,
    ticks: [1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8], minorDtick: 0.025,
  },
  sweep: {
    label: 'Thickness of asphalt layer, in.', log: false, min: 2, max: 18,
    ticks: [2, 6, 10, 14, 18], minorDtick: 1,
  },
  valueOnX: false,
  family: {
    label: 'Numbers on curves indicate E₁/E₂', symbol: 'E₁/E₂',
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
  nomograph: true,
  purpose:
    'The tensile strain under the surface course of a three-layer section, without ' +
    "interpolating Jones' four-way table.",
  equation: 'εr = (q/E₁) · (RR1 − ZZ1)/2  (Eq. 2.25)',
  value: {
    label: '(RR1 − ZZ1)/2', log: true, min: 0.001, max: 100,
    ticks: [0.001, 0.01, 0.1, 1, 10, 100],
    minorDtick: 'D2',
  },
  sweep: {
    label: 'A = a/h₂', log: true, min: 0.1, max: 3.2,
    ticks: [0.1, 0.2, 0.4, 0.8, 1.6, 3.2], minorDtick: 'D1',
  },
  valueOnX: false,
  family: {
    label: 'Numbers on curves indicate H = h₁/h₂', symbol: 'H',
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
  samples: 22,
  heavy: true,
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

/* ── Where the numbers go ────────────────────────────────────────────────
 * A printed design chart carries seventeen curves and no legend. It does not
 * need one: each curve is named where it runs, in a gap in its own ink, and a
 * caption in a corner of the frame says what the numbers mean. That is a
 * contour plot's labelling, and it is the only scheme that survives this many
 * series — a legend of seventeen entries is a lookup table, not a key.
 *
 * Placing them is the hard half. Huang's engraver put each number where that
 * curve had room, which is a judgement about the whole drawing rather than
 * about one curve: on Figure 2.2 the r/a = 0 through 0.75 curves are the same
 * line near the surface and only separate with depth, so their labels have to
 * go deep even though the top of the chart looks emptier. So the placement
 * below works in FRAME coordinates — fractions of the drawing, not data units
 * — and scores every point of a curve by how far it stands from every other
 * curve and from the labels already placed.
 */

/** The x axis of the drawing, whichever quantity the chart puts there. */
const xAxisOf = (spec: ChartSpec) => (spec.valueOnX ? spec.value : spec.sweep);
const yAxisOf = (spec: ChartSpec) => (spec.valueOnX ? spec.sweep : spec.value);

/** Fraction from the axis's own start to its end, honouring a reversed axis. */
function along(a: AxisSpec, v: number): number {
  const n = a.log
    ? (Math.log(Math.max(v, 1e-12)) - Math.log(Math.max(a.min, 1e-12))) /
      (Math.log(a.max) - Math.log(Math.max(a.min, 1e-12)))
    : (v - a.min) / (a.max - a.min);
  return a.reversed ? 1 - n : n;
}

export interface FramePoint { sx: number; sy: number }

/**
 * A (value, sweep) pair as a position on the DRAWING: sx runs 0 → 1 left to
 * right, sy runs 0 → 1 top to bottom. Everything about layout — which corner
 * is empty, whether two labels collide — is a question about the drawing, and
 * asking it in data units gets the wrong answer on any log axis.
 */
export function framePoint(spec: ChartSpec, value: number, sweep: number): FramePoint {
  const xv = spec.valueOnX ? value : sweep;
  const yv = spec.valueOnX ? sweep : value;
  return {
    sx: along(xAxisOf(spec), xv),
    // Plotly's y grows upward and range[0] is the bottom, which `along`
    // already measures from; the screen measures down.
    sy: 1 - along(yAxisOf(spec), yv),
  };
}

export interface CurveLabel {
  fv: number;
  sweep: number;
  value: number;
  sx: number;
  sy: number;
}

/**
 * One label position per curve, contour-plot style.
 *
 * `aspect` is the plot box's width over its height. It is here because a gap
 * of 0.05 frames sideways is nearly twice as many pixels as 0.05 down, and a
 * number is wider than it is tall — measuring clearance in unweighted frame
 * units puts labels side by side that overlap on screen.
 */
export function curveLabelSpots(
  spec: ChartSpec,
  drawn: { fv: number; pts: CurvePoint[] }[],
  opts: { margin?: number; aspect?: number } = {}
): CurveLabel[] {
  const margin = opts.margin ?? 0.07;
  const aspect = opts.aspect ?? 1.7;
  const gap = (a: FramePoint, b: FramePoint) =>
    Math.hypot((a.sx - b.sx) * aspect, a.sy - b.sy);

  type Spot = FramePoint & { value: number; sweep: number };

  const onFrame: { fv: number; pts: Spot[] }[] = drawn.map(cv => {
    const pts: Spot[] = [];
    for (const p of cv.pts) {
      if (!Number.isFinite(p.value)) continue;
      const f = framePoint(spec, p.value, p.sweep);
      if (!Number.isFinite(f.sx) || !Number.isFinite(f.sy)) continue;
      if (f.sx < -0.02 || f.sx > 1.02 || f.sy < -0.02 || f.sy > 1.02) continue;
      pts.push({ ...f, value: p.value, sweep: p.sweep });
    }
    return { fv: cv.fv, pts };
  });

  // Thinning both sides. The clearance field is a picture of where the ink
  // is, and forty points per curve draw that picture as well as two hundred
  // at a fifth of the cost — this runs on every rebuild of the figure.
  const thin = (a: Spot[], n: number) =>
    a.length <= n ? a : a.filter((_, i) => i % Math.ceil(a.length / n) === 0);

  const others = onFrame.map(c => thin(c.pts, 48));
  const interior = onFrame.map(c =>
    thin(
      c.pts.filter(p => p.sx >= margin && p.sx <= 1 - margin &&
                        p.sy >= margin && p.sy <= 1 - margin),
      60
    )
  );

  // Crowded curves choose first. A curve with three interior points has to
  // take one of them; a curve with two hundred can go wherever is left.
  const order = onFrame.map((_, i) => i)
    .sort((a, b) => (interior[a].length || 1e9) - (interior[b].length || 1e9));

  const placed: FramePoint[] = [];
  const out: (CurveLabel | null)[] = onFrame.map(() => null);

  for (const i of order) {
    // A curve that never reaches the interior is still labelled — at its own
    // best point rather than not at all, which is what the book does with the
    // curves that only clip a corner of the frame.
    const pool = interior[i].length ? interior[i] : thin(onFrame[i].pts, 60);
    if (!pool.length) continue;

    let best = pool[0];
    let bestScore = -Infinity;
    for (const cand of pool) {
      let dOther = Infinity;
      for (let j = 0; j < others.length; j++) {
        if (j === i) continue;
        for (const q of others[j]) {
          const d = gap(cand, q);
          if (d < dOther) dOther = d;
        }
      }
      let dLabel = Infinity;
      for (const l of placed) {
        const d = gap(cand, l);
        if (d < dLabel) dLabel = d;
      }
      // Both terms saturate. Past about a label's own width there is nothing
      // further to gain, and without the cap every number is dragged into
      // whichever corner of the frame is emptiest.
      const score = Math.min(dOther, 0.10) + 0.8 * Math.min(dLabel, 0.16);
      if (score > bestScore) { bestScore = score; best = cand; }
    }
    placed.push(best);
    out[i] = { fv: onFrame[i].fv, sweep: best.sweep, value: best.value, sx: best.sx, sy: best.sy };
  }

  return out.filter((l): l is CurveLabel => l !== null);
}

export type FrameCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/** Paper coordinates and anchoring for a caption box in each corner. */
export const CORNER_XY: Record<
  FrameCorner,
  { x: number; y: number; xanchor: 'left' | 'right'; yanchor: 'top' | 'bottom' }
> = {
  'top-left': { x: 0.014, y: 0.986, xanchor: 'left', yanchor: 'top' },
  'top-right': { x: 0.986, y: 0.986, xanchor: 'right', yanchor: 'top' },
  'bottom-left': { x: 0.014, y: 0.014, xanchor: 'left', yanchor: 'bottom' },
  'bottom-right': { x: 0.986, y: 0.014, xanchor: 'right', yanchor: 'bottom' },
};

/**
 * Which corner of the frame the "numbers on curves indicate …" caption can
 * stand in without covering a curve. The book puts it wherever the drawing
 * left room, and which corner that is changes from figure to figure — on
 * Figure 2.2 the stress is small at depth, so the bottom right is empty.
 */
export function emptiestCorner(
  spec: ChartSpec,
  drawn: { fv: number; pts: CurvePoint[] }[],
  box: { w?: number; h?: number } = {}
): FrameCorner {
  const pts: FramePoint[] = [];
  for (const cv of drawn) {
    for (const p of cv.pts) {
      if (Number.isFinite(p.value)) pts.push(framePoint(spec, p.value, p.sweep));
    }
  }
  return freestCorner(pts, box);
}

/** The corner search itself, over points already in frame coordinates. */
export function freestCorner(
  pts: FramePoint[],
  box: { w?: number; h?: number } = {}
): FrameCorner {
  const w = box.w ?? 0.34;
  const h = box.h ?? 0.15;
  const boxes: Record<FrameCorner, [number, number, number, number]> = {
    'top-left': [0, w, 0, h],
    'top-right': [1 - w, 1, 0, h],
    'bottom-left': [0, w, 1 - h, 1],
    'bottom-right': [1 - w, 1, 1 - h, 1],
  };

  let bestCorner: FrameCorner = 'top-right';
  let bestScore: [number, number] = [Infinity, -Infinity];
  for (const corner of Object.keys(boxes) as FrameCorner[]) {
    const [x0, x1, y0, y1] = boxes[corner];
    let inside = 0;
    let nearest = Infinity;
    for (const f of pts) {
      if (f.sx >= x0 && f.sx <= x1 && f.sy >= y0 && f.sy <= y1) { inside++; continue; }
      const dx = Math.max(x0 - f.sx, 0, f.sx - x1);
      const dy = Math.max(y0 - f.sy, 0, f.sy - y1);
      const d = Math.hypot(dx, dy);
      if (d < nearest) nearest = d;
    }
    // Fewest curves crossing the box wins; a tie goes to the corner whose
    // nearest curve is furthest away, so the choice cannot flip on one point.
    if (inside < bestScore[0] || (inside === bestScore[0] && nearest > bestScore[1])) {
      bestScore = [inside, nearest];
      bestCorner = corner;
    }
  }
  return bestCorner;
}

/* ── The two nomographs, drawn as nomographs ─────────────────────────────
 * Figures 2.21 and 2.31 are not plots. Each is a LATTICE: two families of
 * curves crossing in a diamond mesh over an abscissa that carries no variable
 * at all, no ticks and no title. You enter with your two parameters, find
 * where their curves cross, and read the ordinate.
 *
 * These were rectified here at first — one family put on a real axis, the
 * other drawn as curves — on the reasoning that there is nothing to reproduce
 * on a blank axis. That was the wrong call. The blank axis is not the figure;
 * the MESH is, and the mesh is exactly reproducible, because the abscissa is
 * not arbitrary after all. Reading the plates back:
 *
 *     x = (position of the family value) + (position of the sweep value)
 *
 * with each position the value's normalized place along its own family, log
 * or linear as that family is spaced. Everything about both printed figures
 * follows from that one line and nothing else has to be assumed:
 *
 *   · Figure 2.31's H labels sit down the LEFT edge — those are the curve
 *     ends at A = 0.1, whose x is the H position alone, running 0 → 1.
 *   · Its A labels sit down the RIGHT — the ends at H = 8, x running 1 → 2.
 *   · "A = 0.1  H = 8" is printed together at the bottom apex, because both
 *     of those ends land on the same x = 1. They do, here, exactly.
 *   · Figure 2.21's four corners are (1, 0.25) far left, (200, 0.25) top
 *     centre, (0.25, 4) bottom centre and (200, 4) far right — which is the
 *     rhombus on the page, and it is where this puts them.
 *   · The scalloped arches across the top of 2.31 are the H curves turning
 *     over: H = 0.125 peaks at 13.6 near A = 0.8 and falls to 5.9 by A = 3.2.
 *
 * So the mesh is the book's mesh, every crossing carries the true computed
 * value, and the abscissa is still what it was on the page: a spreading
 * coordinate with no units, drawn without ticks because there is nothing on
 * it to read.
 */

/** Where a value sits along its own family, 0 at the first, 1 at the last. */
function spanPos(v: number, lo: number, hi: number, log: boolean): number {
  if (log) {
    return (Math.log(Math.max(v, 1e-12)) - Math.log(lo)) / (Math.log(hi) - Math.log(lo));
  }
  return (v - lo) / (hi - lo);
}

function spanVal(t: number, lo: number, hi: number, log: boolean): number {
  return log ? Math.exp(Math.log(lo) + t * (Math.log(hi) - Math.log(lo))) : lo + t * (hi - lo);
}

/** The two families a lattice crosses, and how each is spaced. */
export function latticeAxes(spec: ChartSpec) {
  const F = spec.family.values;
  const S = spec.sweep.ticks ?? [spec.sweep.min, spec.sweep.max];
  return {
    F, S,
    fLo: F[0], fHi: F[F.length - 1], fLog: spec.family.logSearch === true,
    sLo: S[0], sHi: S[S.length - 1], sLog: spec.sweep.log,
  };
}

/** The abscissa of the lattice. Carries no variable; spreads the two families. */
export function latticeX(spec: ChartSpec, familyValue: number, sweepValue: number): number {
  const a = latticeAxes(spec);
  return spanPos(familyValue, a.fLo, a.fHi, a.fLog) + spanPos(sweepValue, a.sLo, a.sHi, a.sLog);
}

/** A hair of room at each end so the corner labels are not clipped. */
export const LATTICE_RANGE: [number, number] = [-0.05, 2.05];

export interface LatticePoint { x: number; family: number; sweep: number; value: number }

export interface LatticeCurve {
  /** 'family' curves hold the family value and run along the sweep; 'sweep' the reverse. */
  kind: 'family' | 'sweep';
  label: number;
  pts: LatticePoint[];
}

/**
 * Both families of the mesh. The family curves are the ones the other charts
 * draw; the sweep curves are the second family, sampled at the sweep stations
 * the page prints — which is what `sweep.ticks` already are.
 */
export function sampleLattice(spec: ChartSpec, panelValue?: number): LatticeCurve[] {
  const a = latticeAxes(spec);
  const n = spec.samples ?? 70;
  const out: LatticeCurve[] = [];

  const walk = (
    kind: 'family' | 'sweep', label: number,
    lo: number, hi: number, log: boolean,
    at: (t: number) => [number, number]
  ) => {
    const pts: LatticePoint[] = [];
    for (let i = 0; i <= n; i++) {
      const [fv, sv] = at(spanVal(i / n, lo, hi, log));
      const value = spec.evaluate(fv, sv, panelValue);
      const on = Number.isFinite(value) &&
        value >= spec.value.min * 0.9 && value <= spec.value.max * 1.1 &&
        (!spec.value.log || value > 0);
      pts.push({ x: latticeX(spec, fv, sv), family: fv, sweep: sv, value: on ? value : NaN });
    }
    out.push({ kind, label, pts });
  };

  for (const fv of a.F) walk('family', fv, a.sLo, a.sHi, a.sLog, sv => [fv, sv]);
  for (const sv of a.S) walk('sweep', sv, a.fLo, a.fHi, a.fLog, fv => [fv, sv]);
  return out;
}

/**
 * Read the lattice backwards.
 *
 * A point on a nomograph looks like it carries less information than a point
 * on a plot — the abscissa means nothing — but it carries exactly as much:
 * x fixes one combination of the two parameters and the ordinate fixes
 * another, which is two equations in two unknowns. So a cursor anywhere in
 * the mesh solves to a (family, sweep) pair, and the tool answers a question
 * the printed page cannot: not "what is the value here" but "what section
 * would put me here".
 *
 * Scans the family, takes the sweep that x then forces, and bisects the
 * residual — the same shape as invertFamily, and returning every root for the
 * same reason: these families turn back on themselves.
 */
export function invertLattice(
  spec: ChartSpec, xAt: number, valueAt: number, panelValue?: number, scanSteps = 240
): { family: number; sweep: number }[] {
  const a = latticeAxes(spec);

  /* The scan runs over the SLICE of the family that can reach this abscissa,
     not over the whole of it. By construction the family's own position is
     the scan parameter, so x = t + (sweep position) puts the reachable t in
     [x - 1, x] clipped to [0, 1] — and scanning that interval directly is
     what makes a point on the EDGE of the mesh findable. Scanning the whole
     family and discarding the part where the sweep position falls outside
     [0, 1] leaves the root sitting exactly on the discard boundary, where
     the residual never changes sign because the function stops instead: a
     point typed straight off the left edge of Figure 2.21 came back as "no
     such section". */
  const tLo = Math.max(0, xAt - 1);
  const tHi = Math.min(1, xAt);
  if (tHi < tLo) return [];

  const at = (t: number) => {
    const fv = spanVal(t, a.fLo, a.fHi, a.fLog);
    const sPos = Math.min(1, Math.max(0, xAt - t));
    return { fv, sv: spanVal(sPos, a.sLo, a.sHi, a.sLog) };
  };

  if (tHi === tLo) {
    // The mesh's two extreme corners are single points: exactly one pair
    // reaches x = 0, and one x = 2. There is no interval to bisect, so the
    // corner is reported when the ordinate is its ordinate and not otherwise.
    const p = at(tLo);
    const v = spec.evaluate(p.fv, p.sv, panelValue);
    const scale = Math.max(Math.abs(valueAt), Math.abs(v), 1e-12);
    return Number.isFinite(v) && Math.abs(v - valueAt) <= 1e-6 * scale
      ? [{ family: p.fv, sweep: p.sv }]
      : [];
  }
  const f = (t: number) => {
    const p = at(t);
    const v = spec.evaluate(p.fv, p.sv, panelValue);
    return Number.isFinite(v) ? v - valueAt : NaN;
  };
  const step = (i: number) => tLo + (i / scanSteps) * (tHi - tLo);

  const found: number[] = [];
  const near = (t: number) => found.some(u => Math.abs(u - t) < 1.5 / scanSteps);

  /* A TANGENCY is a root a sign test cannot see, and on this lattice it is
     not a curiosity: along the slice the response often turns over exactly at
     a printed crossing, so the residual touches zero and comes back without
     ever changing sign. E1/E2 = 0.5 with h1/a = 3 on Figure 2.21 is one — the
     residual reaches -8e-7 and retreats — and the reader who typed those two
     numbers is precisely the one who would click on the marker to check. So
     a local minimum of |f| that gets within a thousandth of the value counts
     as a root, refined by golden section since there is no bracket to halve. */
  const tol = 1e-3 * Math.max(Math.abs(valueAt), 1e-12);
  const GOLD = (Math.sqrt(5) - 1) / 2;
  const minimize = (lo: number, hi: number) => {
    let a1 = hi - GOLD * (hi - lo), b1 = lo + GOLD * (hi - lo);
    let fa = Math.abs(f(a1)), fb = Math.abs(f(b1));
    for (let k = 0; k < 40 && hi - lo > 1e-12; k++) {
      if (fa < fb) { hi = b1; b1 = a1; fb = fa; a1 = hi - GOLD * (hi - lo); fa = Math.abs(f(a1)); }
      else { lo = a1; a1 = b1; fa = fb; b1 = lo + GOLD * (hi - lo); fb = Math.abs(f(b1)); }
    }
    return 0.5 * (lo + hi);
  };

  let t0 = tLo, f0 = f(tLo);
  let t1 = t0, f1 = f0;
  for (let i = 1; i <= scanSteps; i++) {
    const t2 = step(i);
    const f2 = f(t2);
    if (f2 === 0) {
      if (!near(t2)) found.push(t2);
    } else if (Number.isFinite(f1) && Number.isFinite(f2) && f1 * f2 < 0) {
      let lo = t1, hi = t2, flo = f1;
      for (let k = 0; k < 40; k++) {
        const m = 0.5 * (lo + hi);
        const fm = f(m);
        if (!Number.isFinite(fm)) break;
        if (flo * fm <= 0) hi = m; else { lo = m; flo = fm; }
      }
      const r = 0.5 * (lo + hi);
      if (!near(r)) found.push(r);
    } else if (
      i > 1 && Number.isFinite(f0) && Number.isFinite(f1) && Number.isFinite(f2) &&
      Math.abs(f1) <= Math.abs(f0) && Math.abs(f1) <= Math.abs(f2) && Math.abs(f1) <= tol
    ) {
      const r = minimize(t0, t2);
      if (Math.abs(f(r)) <= tol && !near(r)) found.push(r);
    }
    t0 = t1; f0 = f1;
    t1 = t2; f1 = f2;
  }

  /* And a root sitting exactly ON an end of the reachable slice is neither a
     sign change nor an interior minimum, so both ends are tested outright.
     That end is not an exotic place to be: it is where the sweep reaches its
     own first or last value, which is the whole left and bottom edge of the
     mesh — E1/E2 = 1 at h1/a = 4 on Figure 2.21 is one of the printed
     crossings, and it lands there. */
  for (const tEnd of [tLo, tHi]) {
    const fe = f(tEnd);
    if (Number.isFinite(fe) && Math.abs(fe) <= tol && !near(tEnd)) found.push(tEnd);
  }

  return found.sort((x, y) => x - y).map(t => {
    const p = at(t);
    return { family: p.fv, sweep: p.sv };
  });
}

/**
 * Where each curve of the lattice is named.
 *
 * Not the clearance search the Cartesian charts use — a mesh has no clear
 * interior, and the book does not put the numbers inside it. Both plates
 * label every curve at ONE end, outside the mesh: the family at its sweep-min
 * end, which runs down the left of the figure, and the sweep family at its
 * family-max end, which runs down the right. Each label takes the outermost
 * point of its curve that is still on the frame, so a curve clipped by the
 * axis floor is named where it actually leaves.
 */
export interface LatticeLabel {
  kind: 'family' | 'sweep';
  label: number;
  x: number;
  value: number;
}

export function latticeLabels(spec: ChartSpec, curves: LatticeCurve[]): LatticeLabel[] {
  const out: LatticeLabel[] = [];
  for (const cv of curves) {
    // Family curves are named at their start, sweep curves at their end.
    const order = cv.kind === 'family' ? cv.pts : [...cv.pts].reverse();
    const p = order.find(q => Number.isFinite(q.value));
    if (p) out.push({ kind: cv.kind, label: cv.label, x: p.x, value: p.value });
  }
  return out;
}

/**
 * The same question for a lattice, whose abscissa is the mesh coordinate and
 * not one of the chart's own axes.
 *
 * It matters more here than on a Cartesian chart. Both plates print their two
 * extreme curve labels together at the bottom apex — "A = 0.1  H = 8" on
 * Figure 2.31 — so a caption parked at the bottom centre lands exactly on the
 * two labels a reader needs most.
 */
export function latticeCorner(
  spec: ChartSpec, curves: LatticeCurve[], box: { w?: number; h?: number } = {}
): FrameCorner {
  const va = spec.value;
  const span = LATTICE_RANGE[1] - LATTICE_RANGE[0];
  const pts: FramePoint[] = [];
  for (const cv of curves) {
    for (const p of cv.pts) {
      if (!Number.isFinite(p.value)) continue;
      const n = va.log
        ? (Math.log(p.value) - Math.log(va.min)) / (Math.log(va.max) - Math.log(va.min))
        : (p.value - va.min) / (va.max - va.min);
      pts.push({ sx: (p.x - LATTICE_RANGE[0]) / span, sy: 1 - n });
    }
  }
  return freestCorner(pts, box);
}
