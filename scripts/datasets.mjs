// Per-student dataset generation for CEE 406.
//
// Every homework in the redesigned problem set hands each student a different
// dataset, derived deterministically from their UIN and a per-semester salt.
// That single change is what removes the solution-manual problem: there is no
// published answer to a problem whose numbers exist only for one student.
//
//   seed = hash(UIN + salt)
//
// The salt matters. This file is in a public repository, so without a secret
// salt a student could read the source, recover the truth parameters used to
// synthesize their own data, and skip the work entirely. Keep the salt out of
// version control and change it every semester. See generate-datasets.mjs.
//
// Everything here is pure and deterministic: the same (uin, salt) always
// produces the same data, so a submission can be re-derived and checked months
// later without storing anything.

/* ─────────────────────────── Deterministic RNG ─────────────────────────── */

/** FNV-1a over a string → a 32-bit seed. */
export function hashSeed(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32 — small, fast, and reproducible across platforms. */
export function rng(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stream of helpers built on one generator, so draws stay reproducible. */
export function makeDraw(next) {
  let spare = null;
  const normal = () => {
    if (spare !== null) { const s = spare; spare = null; return s; }
    let u = 0, v = 0, s = 0;
    do { u = 2 * next() - 1; v = 2 * next() - 1; s = u * u + v * v; }
    while (s === 0 || s >= 1);
    const f = Math.sqrt((-2 * Math.log(s)) / s);
    spare = v * f;
    return u * f;
  };
  return {
    next,
    normal,
    /** Uniform on [lo, hi). */
    uniform: (lo, hi) => lo + (hi - lo) * next(),
    /** Uniform integer on [lo, hi]. */
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    /** Multiplicative noise: value × (1 + cv·z). */
    jitter: (value, cv) => value * (1 + cv * normal()),
    pick: arr => arr[Math.floor(next() * arr.length)],
    /** Round to n decimals — datasets are handed out at instrument precision. */
    round: (x, n) => +x.toFixed(n),
  };
}

/* ──────────────────────── HW2 · resilient modulus ──────────────────────── */

/** AASHTO T 307-style confining / deviator sequence, psi. */
const T307 = [
  [3, 3], [3, 6], [3, 9], [3, 15], [3, 21],
  [5, 5], [5, 10], [5, 15], [5, 20], [5, 30],
  [10, 10], [10, 15], [10, 20], [10, 30], [10, 40],
];

const PA = 14.696; // atmospheric pressure, psi

/** The generalized (MEPDG) model the students are asked to fit. */
export function mrModel(k1, k2, k3, s3, sd) {
  const theta = sd + 3 * s3;                 // bulk stress
  const tauOct = (Math.SQRT2 * sd) / 3;      // octahedral shear
  return k1 * PA * Math.pow(theta / PA, k2) * Math.pow(tauOct / PA + 1, k3);
}

/**
 * Thirty repeated-load triaxial points from a hidden k1-k2-k3 set, with
 * realistic scatter and two injected outliers.
 *
 * The outliers are the assignment: HW2 P2 asks the student to find them from
 * the residual structure and decide whether removing them is defensible. They
 * are placed on interior points, never at the ends of the stress range, so
 * they cannot be spotted as "the first and last readings".
 */
export function resilientModulusSet(d) {
  const k1 = d.round(d.uniform(500, 1500), 0);
  const k2 = d.round(d.uniform(0.45, 0.85), 3);
  const k3 = d.round(d.uniform(-0.40, -0.05), 3);
  const cv = d.uniform(0.02, 0.045);

  // Two passes over the sequence gives 30 points, as the assignment states.
  const points = [];
  for (let pass = 0; pass < 2; pass++) {
    for (const [s3, sd] of T307) {
      const mr = mrModel(k1, k2, k3, s3, sd);
      points.push({ s3, sd, mr: d.round(d.jitter(mr, cv), 0), outlier: false });
    }
  }

  const idx = [];
  while (idx.length < 2) {
    const i = d.int(4, points.length - 5);
    if (!idx.includes(i)) idx.push(i);
  }
  for (const i of idx) {
    const factor = d.next() < 0.5 ? d.uniform(0.60, 0.75) : d.uniform(1.28, 1.45);
    points[i].mr = d.round(points[i].mr * factor, 0);
    points[i].outlier = true;
  }

  return { k1, k2, k3, cv: d.round(cv, 4), outlierRows: idx.map(i => i + 1).sort((a, b) => a - b), points };
}

/* ─────────────────────────────── HW2 · CBR ─────────────────────────────── */

/**
 * A piston penetration curve with a concave-up toe, so the origin correction
 * of AASHTO T 193 actually changes the answer.
 *
 * The toe is modeled as the piston seating against surface irregularities:
 * below the corrected origin the response is quadratic and soft, above it the
 * curve is the real material response.
 */
export function cbrCurve(d) {
  const cbrTrue = d.round(d.uniform(3.5, 14), 1);
  const offset = d.round(d.uniform(0.012, 0.045), 3);   // the origin correction
  const p01 = (cbrTrue / 100) * 1000;                   // pressure at 0.1 in past the origin
  const shape = d.uniform(0.80, 0.95);                  // mild concavity above the toe
  const scale = p01 / Math.pow(0.1, shape);

  const pens = [0, 0.012, 0.025, 0.05, 0.075, 0.1, 0.125, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5];
  const readings = pens.map(pen => {
    const eff = pen - offset;
    const load = eff <= 0
      // Soft seating response through the toe, continuous at the origin.
      ? scale * Math.pow(0.1, shape) * 0.06 * Math.pow(pen / Math.max(offset, 1e-6), 2)
      : scale * Math.pow(eff, shape);
    return { pen, load: d.round(Math.max(0, d.jitter(load, 0.015)), 0) };
  });

  return { cbrTrue, offset, readings };
}

/* ──────────────────────── HW5 · W-4 loadometer table ───────────────────── */

const SINGLE_GROUPS = [8, 10, 12, 14, 16, 18, 20, 22, 24];
const TANDEM_GROUPS = [16, 20, 24, 28, 32, 36, 40, 44];

/**
 * A W-4 style table: axles weighed per load group, plus the far larger number
 * of axles actually counted. HW5 P1 requires the scale-up from one to the
 * other, which is the step students most often skip.
 */
export function w4Table(d) {
  // A lognormal-ish spread centered on a legal-ish load.
  const peakS = d.uniform(3.5, 5.5);       // index into SINGLE_GROUPS
  const peakT = d.uniform(2.5, 4.5);
  const spread = d.uniform(1.3, 2.2);

  const bell = (i, mu) => Math.exp(-0.5 * ((i - mu) / spread) ** 2);

  const singles = SINGLE_GROUPS.map((load, i) => ({
    load, type: 'single',
    weighed: Math.max(1, Math.round(d.jitter(900 * bell(i, peakS), 0.12))),
  }));
  const tandems = TANDEM_GROUPS.map((load, i) => ({
    load, type: 'tandem',
    weighed: Math.max(1, Math.round(d.jitter(620 * bell(i, peakT), 0.12))),
  }));

  const sumS = singles.reduce((s, g) => s + g.weighed, 0);
  const sumT = tandems.reduce((s, g) => s + g.weighed, 0);

  // The station counts several times more axles than it stops and weighs.
  const scaleS = d.round(d.uniform(2.6, 4.4), 2);
  const scaleT = d.round(d.uniform(2.6, 4.4), 2);

  return {
    groups: [...singles, ...tandems],
    weighed: { single: sumS, tandem: sumT },
    counted: { single: Math.round(sumS * scaleS), tandem: Math.round(sumT * scaleT) },
    trucksCounted: Math.round((sumS * scaleS + sumT * scaleT) / d.uniform(2.1, 2.9)),
  };
}

/* ───────────────────────── HW3 / HW4 · structures ──────────────────────── */

/** A four-layer flexible section with per-student moduli and thicknesses. */
export function structure(d) {
  return {
    ac: { h: d.round(d.uniform(3, 7), 1), E: d.round(d.uniform(250, 700), 0) * 1000, nu: 0.35 },
    base: { h: d.round(d.uniform(6, 14), 1), E: d.round(d.uniform(18, 45), 0) * 1000, nu: 0.35 },
    subbase: { h: d.round(d.uniform(6, 14), 1), E: d.round(d.uniform(10, 20), 0) * 1000, nu: 0.35 },
    subgrade: { E: d.round(d.uniform(5, 16), 0) * 1000, nu: 0.40 },
    load: { P: d.pick([9000, 9000, 4500]), pressure: d.round(d.uniform(80, 120), 0) },
  };
}

/* ──────────────────────── HW10 · FWD survey along a project ────────────── */

export const FWD_OFFSETS = [0, 8, 12, 18, 24, 36, 60];

/**
 * Ten stations along one project, with a genuine break part-way: the subgrade
 * steps to a different stiffness at a station the student has to find from the
 * data (HW10 P2 — uniform-section delineation).
 *
 * Basins are produced by the same forward solver the tool inverts, then given
 * measurement noise and rounded to the 0.01 mil an FWD reports. So the data is
 * solvable — the truth is recoverable — but not exactly, which is the point.
 *
 * @param basinFn the forward model, injected so this file stays dependency-free
 */
export function fwdSurvey(d, basinFn) {
  const hAc = d.round(d.uniform(3.5, 6), 1);
  const hBase = d.round(d.uniform(6, 12), 1);
  const eAc = d.round(d.uniform(300, 650), 0) * 1000;
  const eBase = d.round(d.uniform(18, 40), 0) * 1000;

  const sgWeak = d.round(d.uniform(5, 9), 0) * 1000;
  const sgStrong = d.round(sgWeak * d.uniform(1.6, 2.4), 0);
  const breakAt = d.int(4, 7);            // station index where the subgrade changes

  const P = 9000, a = 5.9;
  const q = P / (Math.PI * a * a);

  const stations = [];
  for (let i = 0; i < 10; i++) {
    const sgBase = i < breakAt ? sgWeak : sgStrong;
    const layers = [
      { h: hAc, E: d.jitter(eAc, 0.08), nu: 0.35 },
      { h: hBase, E: d.jitter(eBase, 0.10), nu: 0.35 },
      { h: 0, E: d.jitter(sgBase, 0.06), nu: 0.40 },
    ];
    const w = basinFn(layers, q, a, FWD_OFFSETS);
    if (!w) return null;
    stations.push({
      station: 100 * (i + 1),
      truth: layers.map(l => d.round(l.E, 0)),
      // 1.5% instrument noise, then rounded to the reported 0.01 mil.
      mils: w.map(x => d.round(d.jitter(x / 0.001, 0.015), 2)),
    });
  }

  return {
    P, a, offsets: FWD_OFFSETS,
    hAc, hBase,
    truth: { eAc, eBase, sgWeak, sgStrong, breakAtStation: 100 * (breakAt + 1) },
    stations,
  };
}

/* ─────────────────────────── HW6 · drainage site ───────────────────────── */

/**
 * A drainage site: geometry, permeabilities, and the two gradations the
 * filter criteria are checked against.
 *
 * The filter gradation is deliberately drawn so that a good fraction of the
 * class FAILS at least one of the three criteria. HW6 P5 asks students to
 * propose a fix "where they fail" — if every generated filter passed, that
 * part would be an empty exercise. A student whose filter passes cleanly
 * still has to show the checks, and should say so.
 */
export function drainageSite(d) {
  // Geometry
  const lanes = d.int(2, 4);
  const laneW = d.pick([11, 12, 12, 13]);
  const Wp = lanes * laneW + d.round(d.uniform(4, 10), 0);   // + shoulders
  const Cs = d.pick([15, 20, 40, 40]);                        // joint/crack spacing, ft
  const S = d.round(d.uniform(0.015, 0.05), 4);               // drainage layer slope
  const L = d.round(d.uniform(20, 42), 1);                    // drainage path length, ft
  const H = d.round(d.uniform(0.5, 1.25), 2);                 // layer thickness, ft
  const kLayer = d.round(d.uniform(300, 3000), 0);            // ft/day, open graded
  const ne = d.round(d.uniform(0.20, 0.34), 3);               // effective porosity

  // Groundwater
  const kSubgrade = d.round(d.uniform(0.02, 0.9), 3);         // ft/day
  const Hgw = d.round(d.uniform(3, 9), 1);                    // ft, water table above impervious
  const H0 = d.round(Hgw - d.uniform(1, 2.5), 1);             // ft, at the drain

  // Collector pipe
  const pipeD = d.pick([4, 4, 6, 6, 8]);                      // in
  const pipeN = d.pick([0.012, 0.012, 0.024]);                // smooth vs corrugated
  const pipeS = d.round(d.uniform(0.003, 0.02), 4);
  const outletSpacing = d.round(d.uniform(250, 500), 0);      // ft

  // Gradations, mm. The subgrade is a fine soil; the candidate separator is a
  // graded sand-gravel sized against it.
  //
  // The filter is constructed to hit a CHOSEN verdict rather than drawn and
  // hoped over, because the three criteria are not independent — a filter
  // coarse enough to drain freely tends to fail piping and uniformity
  // together, and left to chance almost the whole class fails everything.
  // Roughly half the class gets a filter that passes, so HW6 P5's "where they
  // fail, propose a fix" has both cases in the room.
  //
  //   piping       D15f / d85s <= 5
  //   permeability D15f / d15s >= 5
  //   uniformity   D50f / d50s <= 25
  const sgD85 = d.round(d.uniform(0.05, 0.45), 3);
  const fracD50 = d.uniform(0.25, 0.45);          // d50s / d85s
  const sgD50 = d.round(sgD85 * fracD50, 4);
  const sgD15 = d.round(sgD50 * d.uniform(0.10, 0.30), 4);

  const roll = d.next();
  const failPiping = roll < 0.30;                  // 30% too coarse at D15
  const failUniformity = roll >= 0.30 && roll < 0.48;   // 18% too broadly graded

  // D15f as a multiple of d85s decides piping.
  const ratioPiping = failPiping ? d.uniform(6.5, 13) : d.uniform(1.8, 4.3);
  const fD15 = sgD85 * ratioPiping;

  // D50f as a multiple of d50s decides uniformity, but must stay above D15f
  // to be a physically possible gradation.
  const minRatioU = (fD15 / sgD50) * 1.6;
  const ratioUniformity = failUniformity
    ? Math.max(minRatioU, 28) * d.uniform(1.0, 1.8)
    : Math.min(24, Math.max(minRatioU, 8) * d.uniform(1.0, 1.25));
  const fD50 = Math.max(sgD50 * ratioUniformity, fD15 * 1.6);
  const fD85 = fD50 * d.uniform(1.8, 3.2);

  return {
    lanes, laneW, Wp, Cs,
    layer: { S, L, H, k: kLayer, ne },
    groundwater: { kSubgrade, H: Hgw, H0 },
    pipe: { diameter: pipeD, n: pipeN, slope: pipeS, outletSpacing },
    gradation: {
      subgrade: { d15: sgD15, d50: sgD50, d85: sgD85 },
      filter: {
        d15: d.round(fD15, 4),
        d50: d.round(fD50, 4),
        d85: d.round(fD85, 4),
      },
    },
  };
}

/* ────────────────────── HW8 · IDOT mechanistic scenario ─────────────────── */

const IL_COUNTIES = [
  'Sangamon', 'Champaign', 'Peoria', 'Winnebago', 'Madison',
  'McLean', 'Rock Island', 'Vermilion', 'Adams', 'Kankakee',
];

const PG_GRADES = ['PG 58-22', 'PG 58-28', 'PG 64-22', 'PG 64-28', 'PG 70-22'];

/**
 * The IDOT-style inputs HW8 P1 designs from: a rural highway with its own
 * traffic mix, subgrade support rating and binder grade.
 */
export function idotScenario(d) {
  return {
    county: d.pick(IL_COUNTIES),
    performancePeriod: d.pick([15, 20, 20, 25]),
    // Design-lane daily counts, as IDOT's procedure takes them.
    PV: 1000 * d.int(8, 26),
    SU: 10 * d.int(15, 55),
    MU: 10 * d.int(12, 60),
    ssr: d.pick(['poor', 'fair', 'fair', 'granular']),
    binder: d.pick(PG_GRADES),
    // The trial section HW8 P2 sublayers; students refine it.
    trial: {
      hAc: d.round(d.uniform(5, 11), 1),
      hBase: d.round(d.uniform(6, 16), 1),
      wheelLoad: d.pick([4500, 6000, 9000]),
      contactRadius: d.round(d.uniform(4.5, 6.5), 1),
    },
    // Seasonal moduli for HW8 P3 — the same section in two states.
    seasonalAcModulus: {
      summer: d.round(d.uniform(150, 400), 0) * 1000,
      springThaw: d.round(d.uniform(800, 1800), 0) * 1000,
    },
    springThawSubgradeFactor: d.round(d.uniform(0.35, 0.65), 2),
  };
}

/* ──────────────────────────── HW9 · rigid slab ──────────────────────────── */

const PCA_SINGLE = [16, 18, 20, 22, 24, 26, 28, 30];
const PCA_TANDEM = [24, 28, 32, 36, 40, 44, 48, 52];

/**
 * A jointed concrete pavement plus the axle load distribution the PCA
 * fatigue/erosion summation runs over.
 *
 * The slab is drawn so the design decision is real: thick enough that it is
 * not absurd, thin enough that damage is not vanishing. `reps` are axles per
 * 1000 trucks, the form Huang's Table 12.x distributions take.
 */
export function rigidSlab(d) {
  const h = d.round(d.uniform(8, 11.5), 1);
  const k = d.round(d.uniform(80, 250), 0);
  const E = d.pick([4000000, 4000000, 4500000]);
  const modulusOfRupture = d.round(d.uniform(600, 700), 0);

  // Joint layout and thermal inputs for the curling half.
  const jointSpacing = d.pick([12, 15, 15, 20]);      // ft, transverse
  const laneWidth = d.pick([12, 12, 13]);             // ft
  const alpha = d.pick([5e-6, 5.5e-6, 6e-6]);
  const dtDay = d.round(d.uniform(2.5, 3.5) * h, 0);  // positive gradient, °F
  const dtNight = -d.round(d.uniform(1.1, 1.8) * h, 0);

  // Loading
  const wheelLoad = d.pick([9000, 10000, 12000]);
  const dualSpacing = d.round(d.uniform(12, 15), 0);
  const contactPressure = d.round(d.uniform(80, 120), 0);

  // Axle spectrum, axles per 1000 trucks.
  const peakS = d.uniform(1.5, 4.0), peakT = d.uniform(2.0, 5.0);
  const spread = d.uniform(1.2, 2.0);
  const bell = (i, mu) => Math.exp(-0.5 * ((i - mu) / spread) ** 2);
  const singles = PCA_SINGLE.map((load, i) => ({
    load, type: 'single',
    reps: d.round(Math.max(0.4, d.jitter(150 * bell(i, peakS), 0.15)), 1),
  }));
  const tandems = PCA_TANDEM.map((load, i) => ({
    load, type: 'tandem',
    reps: d.round(Math.max(0.4, d.jitter(95 * bell(i, peakT), 0.15)), 1),
  }));

  return {
    slab: { h, k, E, nu: 0.15, modulusOfRupture },
    joints: { spacing: jointSpacing, laneWidth, alpha, dtDay, dtNight },
    load: { wheelLoad, dualSpacing, contactPressure },
    design: {
      lsf: d.pick([1.0, 1.1, 1.1, 1.2]),
      c1: d.pick([1.0, 1.0, 0.9]),
      doweled: d.next() < 0.7,
      tiedShoulder: d.next() < 0.4,
      trucksPerDay: 100 * d.int(4, 30),
      designPeriod: d.pick([20, 20, 30]),
    },
    axles: [...singles, ...tandems],
  };
}

/* ──────────────────────────── Site assignments ─────────────────────────── */

// Scalar assignments only. The generator deliberately does not invent street
// addresses for the HW1 field survey: it emits a section index, and the
// instructor maps those indices to their own vetted list of locations.
const CLIMATES = [
  { name: 'Chicago, IL', highAir7d: 92, lowAir: -13, freezeIndex: 950 },
  { name: 'Springfield, IL', highAir7d: 95, lowAir: -8, freezeIndex: 620 },
  { name: 'Carbondale, IL', highAir7d: 97, lowAir: -2, freezeIndex: 310 },
  { name: 'Rockford, IL', highAir7d: 90, lowAir: -16, freezeIndex: 1180 },
  { name: 'Champaign, IL', highAir7d: 94, lowAir: -9, freezeIndex: 740 },
];

export function assignments(d) {
  return {
    fieldSectionIndex: d.int(1, 40),
    climate: d.pick(CLIMATES),
    reliabilityTarget: d.pick([90, 95, 95, 99]),
    designPeriodYears: d.pick([15, 20, 20, 25]),
    growthRatePct: d.round(d.uniform(2, 5.5), 1),
    subgradeSoil: d.pick(['A-4', 'A-6', 'A-7-5', 'A-7-6', 'A-2-4']),
    aadt: 1000 * d.int(6, 30),
    truckPct: d.round(d.uniform(6, 22), 1),
  };
}

/* ──────────────────────────── The whole bundle ─────────────────────────── */

/**
 * Everything one student gets, for the whole semester.
 *
 * @param uin      the student's university ID, as a string
 * @param salt     per-semester secret; keep it out of version control
 * @param basinFn  forward deflection model (see fwdSurvey)
 */
export function studentBundle(uin, salt, basinFn) {
  const d = makeDraw(rng(hashSeed(`${uin}::${salt}`)));

  // Draw order is the RNG contract: appending a new generator anywhere but the
  // end would silently reshuffle every dataset drawn after it. New sets are
  // therefore drawn last and only then sorted into homework order below.
  const assign = assignments(d);
  const hw2 = { mr: resilientModulusSet(d), cbr: cbrCurve(d) };
  const hw3 = structure(d);
  const hw5 = w4Table(d);
  const hw10 = basinFn ? fwdSurvey(d, basinFn) : null;
  const hw6 = drainageSite(d);
  const hw8 = idotScenario(d);
  const hw9 = rigidSlab(d);

  return { uin: String(uin), assignments: assign, hw2, hw3, hw5, hw6, hw8, hw9, hw10 };
}

/* ───────────────────────────── CSV rendering ───────────────────────────── */

const csv = rows => rows.map(r => r.join(',')).join('\n') + '\n';

/** The student-facing files. Truth values are stripped — see answerKey(). */
export function studentFiles(bundle) {
  const files = {};
  const b = bundle;

  files['hw2-resilient-modulus.csv'] = csv([
    ['point', 'sigma3_psi', 'sigma_d_psi', 'Mr_psi'],
    ...b.hw2.mr.points.map((p, i) => [i + 1, p.s3, p.sd, p.mr]),
  ]);

  files['hw2-cbr.csv'] = csv([
    ['penetration_in', 'piston_pressure_psi'],
    ...b.hw2.cbr.readings.map(r => [r.pen.toFixed(3), r.load]),
  ]);

  files['hw5-w4-table.csv'] = csv([
    ['axle_type', 'load_kip', 'axles_weighed'],
    ...b.hw5.groups.map(g => [g.type, g.load, g.weighed]),
    [],
    ['# axles counted (single)', b.hw5.counted.single],
    ['# axles counted (tandem)', b.hw5.counted.tandem],
    ['# trucks counted', b.hw5.trucksCounted],
  ]);

  if (b.hw10) {
    files['hw10-fwd-survey.csv'] = csv([
      ['# plate load (lb)', b.hw10.P],
      ['# plate radius (in)', b.hw10.a],
      ['# AC thickness (in)', b.hw10.hAc],
      ['# base thickness (in)', b.hw10.hBase],
      [],
      ['station_ft', ...b.hw10.offsets.map(o => `d${o}_mils`)],
      // Fixed to 2 dp: an FWD reports 17.00 mils, not 17, and a column of
      // ragged precision is the first thing a student notices and the last
      // thing we want them thinking about.
      ...b.hw10.stations.map(s => [s.station, ...s.mils.map(m => m.toFixed(2))]),
    ]);
  }

  files['hw6-drainage-site.csv'] = csv([
    ['parameter', 'value', 'unit'],
    ['traffic_lanes', b.hw6.lanes, '-'],
    ['lane_width', b.hw6.laneW, 'ft'],
    ['infiltration_width_Wp', b.hw6.Wp, 'ft'],
    ['crack_spacing_Cs', b.hw6.Cs, 'ft'],
    ['layer_slope_S', b.hw6.layer.S, 'ft/ft'],
    ['drainage_length_L', b.hw6.layer.L, 'ft'],
    ['layer_thickness_H', b.hw6.layer.H, 'ft'],
    ['layer_permeability_k', b.hw6.layer.k, 'ft/day'],
    ['effective_porosity_ne', b.hw6.layer.ne, '-'],
    ['subgrade_permeability', b.hw6.groundwater.kSubgrade, 'ft/day'],
    ['water_table_H', b.hw6.groundwater.H, 'ft'],
    ['water_table_at_drain_H0', b.hw6.groundwater.H0, 'ft'],
    ['pipe_diameter', b.hw6.pipe.diameter, 'in'],
    ['pipe_manning_n', b.hw6.pipe.n, '-'],
    ['pipe_slope', b.hw6.pipe.slope, 'ft/ft'],
    ['outlet_spacing', b.hw6.pipe.outletSpacing, 'ft'],
    [],
    ['# gradations, mm'],
    ['subgrade_d15', b.hw6.gradation.subgrade.d15, 'mm'],
    ['subgrade_d50', b.hw6.gradation.subgrade.d50, 'mm'],
    ['subgrade_d85', b.hw6.gradation.subgrade.d85, 'mm'],
    ['filter_D15', b.hw6.gradation.filter.d15, 'mm'],
    ['filter_D50', b.hw6.gradation.filter.d50, 'mm'],
    ['filter_D85', b.hw6.gradation.filter.d85, 'mm'],
  ]);

  files['hw8-idot-scenario.csv'] = csv([
    ['parameter', 'value', 'unit'],
    ['county', b.hw8.county, '-'],
    ['performance_period', b.hw8.performancePeriod, 'years'],
    ['PV_per_day', b.hw8.PV, 'veh/day'],
    ['SU_per_day', b.hw8.SU, 'veh/day'],
    ['MU_per_day', b.hw8.MU, 'veh/day'],
    ['subgrade_support_rating', b.hw8.ssr, '-'],
    ['binder_grade', b.hw8.binder, '-'],
    ['trial_AC_thickness', b.hw8.trial.hAc, 'in'],
    ['trial_base_thickness', b.hw8.trial.hBase, 'in'],
    ['wheel_load', b.hw8.trial.wheelLoad, 'lb'],
    ['contact_radius', b.hw8.trial.contactRadius, 'in'],
    ['AC_modulus_summer', b.hw8.seasonalAcModulus.summer, 'psi'],
    ['AC_modulus_spring_thaw', b.hw8.seasonalAcModulus.springThaw, 'psi'],
    ['spring_thaw_subgrade_factor', b.hw8.springThawSubgradeFactor, '-'],
  ]);

  files['hw9-rigid-slab.csv'] = csv([
    ['parameter', 'value', 'unit'],
    ['slab_thickness_h', b.hw9.slab.h, 'in'],
    ['modulus_of_subgrade_reaction_k', b.hw9.slab.k, 'pci'],
    ['concrete_modulus_E', b.hw9.slab.E, 'psi'],
    ['poisson_ratio', b.hw9.slab.nu, '-'],
    ['modulus_of_rupture', b.hw9.slab.modulusOfRupture, 'psi'],
    ['transverse_joint_spacing', b.hw9.joints.spacing, 'ft'],
    ['lane_width', b.hw9.joints.laneWidth, 'ft'],
    ['thermal_coefficient_alpha', b.hw9.joints.alpha, 'per_F'],
    ['temperature_differential_day', b.hw9.joints.dtDay, 'F'],
    ['temperature_differential_night', b.hw9.joints.dtNight, 'F'],
    ['wheel_load', b.hw9.load.wheelLoad, 'lb'],
    ['dual_spacing', b.hw9.load.dualSpacing, 'in'],
    ['contact_pressure', b.hw9.load.contactPressure, 'psi'],
    ['load_safety_factor', b.hw9.design.lsf, '-'],
    ['C1_subbase', b.hw9.design.c1, '-'],
    ['doweled_joints', b.hw9.design.doweled ? 'yes' : 'no', '-'],
    ['tied_concrete_shoulder', b.hw9.design.tiedShoulder ? 'yes' : 'no', '-'],
    ['trucks_per_day', b.hw9.design.trucksPerDay, 'trucks/day'],
    ['design_period', b.hw9.design.designPeriod, 'years'],
  ]);

  files['hw9-axle-distribution.csv'] = csv([
    ['axle_type', 'load_kip', 'axles_per_1000_trucks'],
    ...b.hw9.axles.map(g => [g.type, g.load, g.reps]),
  ]);

  files['assignments.csv'] = csv([
    ['parameter', 'value'],
    ['field_section_index', b.assignments.fieldSectionIndex],
    ['climate', b.assignments.climate.name],
    ['air_high_7day_F', b.assignments.climate.highAir7d],
    ['air_low_F', b.assignments.climate.lowAir],
    ['freezing_index_degF_days', b.assignments.climate.freezeIndex],
    ['reliability_target_pct', b.assignments.reliabilityTarget],
    ['design_period_years', b.assignments.designPeriodYears],
    ['growth_rate_pct', b.assignments.growthRatePct],
    ['subgrade_soil_class', b.assignments.subgradeSoil],
    ['aadt', b.assignments.aadt],
    ['truck_pct', b.assignments.truckPct],
    ['hw3_ac_thickness_in', b.hw3.ac.h],
    ['hw3_ac_modulus_psi', b.hw3.ac.E],
    ['hw3_base_thickness_in', b.hw3.base.h],
    ['hw3_base_modulus_psi', b.hw3.base.E],
    ['hw3_subbase_thickness_in', b.hw3.subbase.h],
    ['hw3_subbase_modulus_psi', b.hw3.subbase.E],
    ['hw3_subgrade_modulus_psi', b.hw3.subgrade.E],
    ['hw3_wheel_load_lb', b.hw3.load.P],
    ['hw3_contact_pressure_psi', b.hw3.load.pressure],
  ]);

  return files;
}

/** The instructor's copy: everything the student has to work out. */
export function answerKey(bundle) {
  const b = bundle;
  return {
    uin: b.uin,
    hw2_mr: {
      k1: b.hw2.mr.k1, k2: b.hw2.mr.k2, k3: b.hw2.mr.k3,
      noise_cv: b.hw2.mr.cv,
      outlier_rows: b.hw2.mr.outlierRows,
    },
    hw2_cbr: { cbr_true: b.hw2.cbr.cbrTrue, origin_correction_in: b.hw2.cbr.offset },
    hw10: b.hw10 ? {
      truth: b.hw10.truth,
      station_moduli: b.hw10.stations.map(s => ({ station: s.station, E: s.truth })),
    } : null,
  };
}
