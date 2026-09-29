// Released homeworks use the Fall 2026 sheets; unreleased entries retain the
// Fall 2024 reference sequence until their current assignment is issued.
// Each homework page, the homeworks index, and the homepage timeline
// are all generated from this single source of truth.

export interface HwDownload {
  label: string;
  file: string; // relative to public/homeworks/{id}/
  kind: 'assignment' | 'handout' | 'reference' | 'data';
}

export interface HwTool {
  label: string;
  href?: string;      // internal path relative to base, e.g. 'tools/stress-explorer/'
  external?: string;  // absolute URL
  note?: string;
}

export interface Homework {
  id: string;
  num: number;
  title: string;
  phase: 'Fundamentals' | 'Materials' | 'Analysis' | 'Loads & Drainage' | 'Design';
  due: string; // Fall 2024 reference schedule unless dueNote says otherwise
  /** Overrides the "(Fall 2024 reference)" note once the real date is issued. */
  dueNote?: string;
  overview: string;
  objectives: string[];
  problems: { label: string; desc: string }[];
  chapters: { id: string; label: string }[];
  tools: HwTool[];
  downloads: HwDownload[];
  /** Which band of the layer glyph is highlighted: 0 AC, 1 base, 2 subbase, 3 subgrade, -1 all */
  layerFocus: number;
}

export const homeworks: Homework[] = [
  {
    id: 'hw1',
    num: 1,
    title: 'Pavement Types, Layers & Distresses',
    phase: 'Fundamentals',
    due: 'Sep 17',
    dueNote: 'Fall 2026',
    layerFocus: 0,
    overview:
      'What the layers of flexible and rigid pavements do, how mechanistic-empirical design works, and how pavements fail: pumping, rutting, and the damage done by different axles and tire pressures.',
    objectives: [
      'Draw and label flexible and rigid cross-sections with typical thicknesses and interface treatments',
      'Explain the mechanistic and empirical components of M-E design',
      'Distinguish seal, tack, and prime coats and their binder viscosities',
      'Describe pumping, the two kinds of rutting, and the design methods that control them',
      'Compare single, tandem, and tridem axles and the effect of tire pressure',
    ],
    problems: [
      { label: 'Q1', desc: 'Cross-sections of a typical flexible and rigid pavement: layer functions, interface treatments, typical thicknesses' },
      { label: 'Q2', desc: 'The mechanistic-empirical design method: which part is which, and why a fully mechanistic method is out of reach' },
      { label: 'Q3', desc: 'Seal coat vs. tack coat vs. prime coat, and which needs the least viscous asphalt' },
      { label: 'Q4', desc: 'Mechanics of pumping: consequences and fixes' },
      { label: 'Q5', desc: 'The two kinds of rutting and how designs control them' },
      { label: 'Q6', desc: 'At the same group load, tire design and pressure, which does least damage: single, tandem, or tridem?' },
      { label: 'Q7', desc: 'Tire pressure effects on flexible pavements and trucking operations' },
    ],
    chapters: [
      { id: 'ch01', label: 'Ch. 1: Introduction' },
      { id: 'ch09', label: 'Ch. 9: Pavement Performance' },
    ],
    tools: [
      { label: 'Cross-Section Studio', href: 'tools/cross-section-studio/', note: 'draw and export the Q1 cross-sections, live' },
      { label: 'Gear3D', href: 'tools/gear3d/', note: 'single, tandem and tridem axles in 3-D for Q6, live' },
      { label: 'Contact Stress Visualizer', href: 'tools/contact-stress/', note: 'what inflation pressure does to the contact stresses, for Q7, live' },
    ],
    // The assignment sheet and the Distress Identification Manual are handed
    // out on Canvas; nothing is served from public/homeworks/hw1/.
    downloads: [],
  },
  {
    id: 'hw2',
    num: 2,
    title: 'Subgrade & Material Characterization',
    phase: 'Materials',
    due: 'Sep 24',
    dueNote: 'Fall 2026',
    layerFocus: 3,
    overview:
      'Fit and compare resilient modulus models, investigate outliers, distinguish interpolation from extrapolation, and evaluate how the CBR origin correction changes subgrade characterization.',
    objectives: [
      'Compute resilient modulus and stress invariants from repeated-load triaxial data',
      'Fit the generalized model, report R² in log space, and interpret the material parameters',
      'Identify outliers and compare the generalized and two-parameter models on the same cleaned dataset',
      'Evaluate model predictions within and beyond the tested stress range',
      'Calculate CBR before and after correcting the origin of a pressure-penetration curve',
    ],
    problems: [
      { label: 'Q1', desc: 'Compute modulus and stress invariants for 30 triaxial readings; fit the generalized model and interpret k₁, k₂, k₃ and R² in log space' },
      { label: 'Q2', desc: 'Identify two outliers by ID, compare them with similar stress states, and refit after removing them; discuss possible causes' },
      { label: 'Q3', desc: 'Fit the two-parameter bulk-stress model to the cleaned data; compare fit quality, the largest prediction difference, and suitability for design' },
      { label: 'Q4', desc: 'Compare both models at twice the largest tested bulk stress and at an untested stress state; distinguish interpolation from extrapolation' },
      { label: 'Q5', desc: 'Calculate CBR at both standard penetrations before and after a tangent-based origin correction, and discuss the design implications' },
    ],
    chapters: [{ id: 'ch07', label: 'Ch. 7: Material Characterization' }],
    tools: [
      { label: 'Resilient Modulus Fitter', href: 'tools/mr-fitter/', note: 'fit, compare and predict modulus for Q1–Q4' },
      { label: 'CBR Fitter', href: 'tools/cbr/', note: 'inspect the curve and origin correction for Q5' },
    ],
    // Assignment and supporting files are provided on Canvas, as for HW1.
    downloads: [],
  },
  {
    id: 'hw3',
    num: 3,
    title: 'Asphalt Materials & Layered Response',
    phase: 'Analysis',
    due: 'Oct 4',
    dueNote: 'Fall 2026',
    layerFocus: 0,
    overview:
      'Evaluate binder performance grades and Superpave compaction, build modulus and phase-angle master curves, and compare chart-based pavement responses with layered-elastic analysis.',
    objectives: [
      'Determine true and standard binder grades and assess climate and traffic requirements',
      'Use gyratory specimen heights to evaluate Superpave compaction criteria',
      'Build a master curve at 21°C, fit WLF shift factors, and assess predictions and phase-angle behavior',
      'Superpose two circular loads and compare chart readings with LEAPS',
      'Compare thickness and stiffness changes in a bonded two-layer pavement and interpret equal-deflection structures',
    ],
    problems: [
      { label: 'Q1', desc: 'Evaluate binder test criteria, determine true and standard PG grades, and assess suitability for the project climate and slow-moving heavy traffic' },
      { label: 'Q2', desc: 'Determine gyration counts and percent maximum theoretical specific gravity from specimen heights; interpret any failed Superpave criterion' },
      { label: 'Q3', desc: 'Build the 21°C modulus master curve, fit WLF shift factors, evaluate predictions and phase-angle collapse, and test predictions with the 54°C data withheld' },
      { label: 'Q4', desc: 'Superpose chart-based responses beneath two circular loads; compare stresses, vertical strain and deflection with LEAPS and explain differences' },
      { label: 'Q5', desc: 'Analyze a bonded two-layer pavement, check the homogeneous limit and plate assumptions, and compare thickness, stiffness and equal-deflection alternatives' },
    ],
    chapters: [
      { id: 'ch07', label: 'Ch. 7: Material Characterization' },
      { id: 'appendix-d', label: 'App. D: An Introduction to Superpave' },
      { id: 'ch02', label: 'Ch. 2: Stresses and Strains in Flexible Pavements' },
      { id: 'appendix-b', label: 'App. B: Theory of Elastic Layer Systems' },
    ],
    tools: [
      { label: 'Time-Temperature Superposition', href: 'tools/time-temperature-superposition/', note: 'master curves, phase angles and WLF predictions for Q3' },
      { label: 'Layered Elastic Analysis', href: 'tools/lea/', note: 'one- and two-layer design charts for Q4 and Q5' },
      { label: 'LEAPS', href: 'tools/leaps/', note: 'dual-load responses and two-layer comparisons for Q4 and Q5' },
    ],
    // Assignment and supporting files are provided on Canvas, as for HW1.
    downloads: [],
  },
  {
    id: 'hw4',
    num: 4,
    title: 'Multilayer Elastic Analysis',
    phase: 'Analysis',
    due: 'Oct 8',
    layerFocus: 1,
    overview:
      'Analyze a four-layer structure under a 720 kPa, 145 mm circular load with a layered-elastic program (e.g., WinJULEA), plot the response profiles with depth, and interpret each layer.',
    objectives: [
      'Set up a multilayer elastic analysis with bonded interfaces',
      'Plot σz, εz, σr, εr, and deflection versus depth under the load center',
      'Interpret sign conventions and the mechanics behind at least four observations',
    ],
    problems: [
      { label: 'P1', desc: 'Problem 2-6, Huang p. 92' },
      { label: 'P2', desc: 'Problem 2-7, Huang p. 92' },
      { label: 'P3', desc: 'Depth profiles of stress, strain, and deflection for a 4-layer structure (E = 3200/200/100/42 MPa) under p = 720 kPa, a = 145 mm' },
    ],
    chapters: [
      { id: 'ch02', label: 'Ch. 2: Stresses and Strains in Flexible Pavements' },
      { id: 'ch03', label: 'Ch. 3: KENLAYER Computer Program' },
      { id: 'appendix-c', label: 'App. C: KENPAVE Software' },
    ],
    tools: [
      { label: 'Layered Elastic Analysis', href: 'tools/lea/', note: 'the four-layer depth profile in the browser; check your WinJULEA run against it, live' },
      { label: 'Stress Explorer', href: 'tools/stress-explorer/', note: 'compare the one-layer solution against your multilayer run' },
      { label: 'WinJULEA', note: 'desktop layered-elastic analysis, provided in class' },
    ],
    downloads: [{ label: 'HW4 assignment', file: 'hw4-assignment.pdf', kind: 'assignment' }],
  },
  {
    id: 'hw5',
    num: 5,
    title: 'Traffic Loading & Volume',
    phase: 'Loads & Drainage',
    due: 'Oct 22',
    layerFocus: 0,
    overview:
      'Design traffic in ESALs: load equivalency factors, truck factors, growth, and lane distribution. Mixed traffic becomes the single number that drives thickness design.',
    objectives: [
      'Apply AASHTO equivalent axle load factors (EALF) to mixed axle streams',
      'Compute growth factors and design-lane ESALs over a design period',
      'Understand the sensitivity of design traffic to growth rate and truck factor',
    ],
    problems: [
      { label: 'P1', desc: 'Problem 6.2, Huang p. 276' },
      { label: 'P2', desc: 'Problem 6.3, Huang p. 276' },
      { label: 'P3', desc: 'Problem 6.6, Huang p. 277' },
      { label: 'P4', desc: 'Problem 6.7, Huang p. 277' },
      { label: 'P5', desc: 'Problem 6.9, Huang p. 278' },
    ],
    chapters: [{ id: 'ch06', label: 'Ch. 6: Traffic Loading and Volume' }],
    tools: [
      { label: 'ESAL Calculator', href: 'tools/esal-calculator/', note: 'AASHTO load equivalency + design traffic, live' },
    ],
    downloads: [{ label: 'HW5 assignment', file: 'hw5-assignment.pdf', kind: 'assignment' }],
  },
  {
    id: 'hw6',
    num: 6,
    title: 'Drainage Design',
    phase: 'Loads & Drainage',
    due: 'Oct 29',
    layerFocus: 2,
    overview:
      'Estimate inflow, size the permeable base, and check filter criteria, with FHWA’s DRIP software as a check on hand calculations.',
    objectives: [
      'Estimate design inflow from infiltration and groundwater',
      'Size drainage layers for steady-state flow and time-to-drain',
      'Verify granular filter criteria between subgrade and drainage layer',
    ],
    problems: [
      { label: 'P1', desc: 'Problem 8.6, Huang p. 366; check with DRIP' },
      { label: 'P2', desc: 'Problem 8.8, Huang p. 367; check with DRIP' },
      { label: 'P3', desc: 'Problem 8.10, Huang p. 367' },
    ],
    chapters: [{ id: 'ch08', label: 'Ch. 8: Drainage Design' }],
    tools: [
      { label: 'Drainage Designer', href: 'tools/drainage/', note: 'inflow, layer capacity, pipe sizing, filter criteria, live' },
      { label: 'DRIP', external: 'https://www.fhwa.dot.gov/pavement/software.cfm', note: 'FHWA Drainage Requirements In Pavements' },
    ],
    downloads: [{ label: 'HW6 assignment', file: 'hw6-assignment.pdf', kind: 'assignment' }],
  },
  {
    id: 'hw7',
    num: 7,
    title: 'AASHTO Flexible Pavement Design',
    phase: 'Design',
    due: 'Nov 5',
    layerFocus: -1,
    overview:
      'The AASHTO 1993 flexible design procedure end to end: structural number, layer and drainage coefficients, reliability, and the design nomographs.',
    objectives: [
      'Determine the required structural number SN from the AASHTO design equation or nomograph',
      'Select layer coefficients and solve the layered SN equation for thicknesses',
      'Apply reliability, standard deviation, and serviceability inputs correctly',
    ],
    problems: [
      { label: 'P1', desc: 'Problem 11-9, Huang p. 532' },
      { label: 'P2', desc: 'Problem 11-10, Huang p. 532' },
      { label: 'P3', desc: 'Problem 11-12, Huang p. 532' },
    ],
    chapters: [{ id: 'ch11', label: 'Ch. 11: Flexible Pavement Design' }],
    tools: [
      { label: 'AASHTO Design Studio', href: 'tools/aashto/', note: 'solve the 1993 flexible equation for SN, W₁₈, or reliability, and split SN into layers, live' },
      { label: 'ESAL Calculator', href: 'tools/esal-calculator/', note: 'design traffic input for the nomographs' },
    ],
    downloads: [
      { label: 'HW7 assignment', file: 'hw7-assignment.pdf', kind: 'assignment' },
      { label: 'Handout: AASHTO flexible nomographs', file: 'handout-aashto-nomographs.pdf', kind: 'handout' },
      { label: 'Handout: Worked AASHTO example', file: 'handout-aashto-example.pdf', kind: 'handout' },
      { label: 'Handout: Textbook explanation', file: 'handout-textbook-explanation.pdf', kind: 'handout' },
    ],
  },
  {
    id: 'hw8',
    num: 8,
    title: 'Mechanistic-Empirical Flexible Design',
    phase: 'Design',
    due: 'Nov 12',
    layerFocus: -1,
    overview:
      'An IDOT-style mechanistic design for a rural four-lane highway, then a WinJULEA sublayered analysis feeding AASHTOWare transfer functions to predict fatigue cracking and rutting versus load repetitions.',
    objectives: [
      'Perform a flexible mechanistic design for new construction from ADT and subgrade rating',
      'Assign AC sublayer moduli by loading frequency and compute critical strains',
      'Accumulate damage with Miner’s law and plot rutting and cracking growth',
    ],
    problems: [
      { label: 'P1', desc: 'Flexible mechanistic design: rural 4-lane highway, Sangamon County, 20-year performance period (PV 15,000 / SU 320 / MU 300, SSR fair, PG 64-22)' },
      { label: 'P2a', desc: 'WinJULEA: tensile and compressive strains at mid-depth of each sublayer under a 6,000 lb wheel on a 6 in radius' },
      { label: 'P2b', desc: 'AASHTOWare transfer functions: bottom-up cracking and rutting after 1,000 reps/day × 90 days' },
      { label: 'P2c', desc: 'Total rutting and the layer that governs it' },
    ],
    chapters: [
      { id: 'ch03', label: 'Ch. 3: KENLAYER Computer Program' },
      { id: 'ch11', label: 'Ch. 11: Flexible Pavement Design' },
    ],
    tools: [
      { label: 'WinJULEA', note: 'desktop layered-elastic analysis, provided in class' },
      { label: 'Transfer-Function Damage', href: 'tools/damage/', note: 'rutting & fatigue accumulation from your strains, live' },
    ],
    downloads: [
      { label: 'HW8 assignment', file: 'hw8-assignment.pdf', kind: 'assignment' },
      { label: 'Handout: AASHTO flexible nomographs', file: 'handout-aashto-nomographs.pdf', kind: 'handout' },
      { label: 'Handout: Worked AASHTO example', file: 'handout-aashto-example.pdf', kind: 'handout' },
      { label: 'Handout: Textbook explanation', file: 'handout-textbook-explanation.pdf', kind: 'handout' },
    ],
  },
  {
    id: 'hw9',
    num: 9,
    title: 'Rigid Pavement Design',
    phase: 'Design',
    due: 'Nov 19',
    layerFocus: 0,
    overview:
      'Concrete pavements: curling stresses, Westergaard edge and corner loading, joint design, and the rigid design procedures of Chapter 12.',
    objectives: [
      'Compute curling and load stresses in concrete slabs',
      'Apply Westergaard solutions for interior, edge, and corner loading',
      'Work through rigid pavement thickness design problems',
    ],
    problems: [
      { label: 'P1', desc: 'Problem 12-3, Huang p. 598' },
      { label: 'P2', desc: 'Problem 12-4, Huang p. 598' },
      { label: 'P3', desc: 'Problem 12-6, Huang p. 599' },
      { label: 'P4', desc: 'Problem 12-7, Huang p. 599' },
      { label: 'P5', desc: 'Problem 12-8, Huang p. 599' },
    ],
    chapters: [
      { id: 'ch04', label: 'Ch. 4: Stresses and Deflections in Rigid Pavements' },
      { id: 'ch12', label: 'Ch. 12: Rigid Pavement Design' },
      { id: 'ch05', label: 'Ch. 5: KENSLABS Computer Program' },
    ],
    tools: [
      { label: 'PCA Rigid Thickness', href: 'tools/pca/', note: 'fatigue + erosion damage summation; covers Problems 12-3 and 12-4, live' },
      { label: 'AASHTO Design Studio', href: 'tools/aashto/', note: 'rigid design equation + effective k; covers Problems 12-6, 12-7, 12-8, live' },
      { label: 'Westergaard Slab Stress', href: 'tools/westergaard/', note: 'interior, edge, corner + curling, live' },
    ],
    downloads: [{ label: 'HW9 assignment', file: 'hw9-assignment.pdf', kind: 'assignment' }],
  },
  {
    id: 'hw10',
    num: 10,
    title: 'Airfield Pavements & Life-Cycle Assessment',
    phase: 'Design',
    due: 'Dec 11',
    layerFocus: -1,
    overview:
      'Check runway ACR/PCR compatibility for a B747-400 and design an airfield section with FAARFIELD; then run a full pavement life-cycle assessment to find the stage that dominates GHG emissions.',
    objectives: [
      'Interpret ACR/PCR codes and decide where an aircraft can operate',
      'Design an airfield subbase with FAARFIELD and evaluate stabilization trade-offs',
      'Assemble a complete pavement LCA and identify the governing life-cycle stage',
    ],
    problems: [
      { label: 'P1a', desc: 'ACR/PCR check: B747-400 on runways rated 700/R/C/Y/T, 650/F/C/Y/T, 600/F/B/X/T' },
      { label: 'P1b', desc: 'FAARFIELD subbase design: 4,000 annual departures, CBR 5% vs. stabilized 7%' },
      { label: 'P2', desc: 'Pavement LCA over 20 years: GHG emissions per lane-mile with IRI-triggered mill-and-overlay' },
    ],
    chapters: [{ id: 'ch13', label: 'Ch. 13: Design of Overlays' }],
    tools: [
      { label: 'ACR/PCR Compatibility', href: 'tools/acr/', note: 'runway rating codes → where the aircraft may operate, live' },
      { label: 'FAARFIELD', external: 'https://www.faa.gov/airports/engineering/design_software', note: 'FAA airfield pavement design software' },
      { label: 'Pavement LCA Worksheet', href: 'tools/lca/', note: 'life-cycle GHG accounting online, live' },
    ],
    downloads: [{ label: 'HW10 assignment', file: 'hw10-assignment.pdf', kind: 'assignment' }],
  },
];

export const phases = ['Fundamentals', 'Materials', 'Analysis', 'Loads & Drainage', 'Design'] as const;

export function getHomework(id: string): Homework | undefined {
  return homeworks.find(h => h.id === id);
}
