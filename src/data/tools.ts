// The tool catalogue — one source of truth for every surface that lists tools.
//
// The landing page and the tools index both render from this. They used to
// keep separate arrays, and the landing page drifted to showing 2 tools while
// 18 were live; that is exactly the failure this file exists to prevent.
//
// `glyph` is a stroke-drawn SVG motif of what the tool computes. The path
// carrying class "anim" redraws on hover. Keep them monochrome — the card
// supplies the colour through `--tool-color`.

export interface Tool {
  name: string;
  /** Directory under /tools/. The href is built with BASE_URL at render. */
  slug: string;
  /** Accent colour, from the categorical palette of docs/chart-standards.md §B4. */
  color: string;
  /** Homework or chapter chips shown on the card. */
  hws: string[];
  /** The equations or standard the tool implements, for the card footer. */
  ref: string;
  desc: string;
  glyph: string;
  /**
   * Screenshot under public/tools/, e.g. 'gear3d.webp'. Where a tool has one,
   * the showcase leads with it instead of the stroke glyph — a render of the
   * thing working sells it better than a 120x44 motif ever will. The glyph is
   * still required: it is what the compact lists and locked cards use.
   *
   * These are the same captures the E-Labs site uses, so a tool looks the same
   * wherever a student meets it.
   */
  image?: string;
  /** Alt text for `image`. Required whenever image is set. */
  imageAlt?: string;
}

export const tools: Tool[] = [
  {
    name: 'Resilient Modulus Fitter',
    slug: 'mr-fitter',
    color: '#E87722',
    hws: ['HW2'],
    ref: 'MEPDG k₁–k₂–k₃ · Huang Ch. 7',
    desc: 'Fit k₁, k₂, k₃ of the generalized Mr model to triaxial data — live LINEST-style regression with R², a parity plot, and paste-from-Excel input.',
    glyph: `<svg viewBox="0 0 120 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <path d="M14 6 V38 H112" opacity="0.35" stroke-width="1.5"/>
      <path class="anim" d="M16 33 Q52 24 108 9"/>
      <circle cx="32" cy="31" r="2.4" fill="currentColor" stroke="none"/>
      <circle cx="54" cy="22" r="2.4" fill="currentColor" stroke="none"/>
      <circle cx="76" cy="19" r="2.4" fill="currentColor" stroke="none"/>
      <circle cx="98" cy="10" r="2.4" fill="currentColor" stroke="none"/>
    </svg>`,
  },
  {
    name: 'CBR Reduction',
    slug: 'cbr',
    color: '#E87722',
    hws: ['HW2'],
    ref: 'AASHTO T 193 · ASTM D1883',
    desc: 'Reduce a piston penetration test to a CBR, with the tangent construction that corrects a concave-up curve — and a toggle to see how much that correction is worth.',
    glyph: `<svg viewBox="0 0 120 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <path d="M14 6 V38 H112" opacity="0.35" stroke-width="1.5"/>
      <path class="anim" d="M20 37 C34 36 44 26 60 18 C76 11 92 9 106 8"/>
      <path d="M28 38 L74 10" opacity="0.5" stroke-dasharray="3 3"/>
    </svg>`,
  },
  {
    name: 'Layered Elastic Analysis',
    slug: 'lea',
    color: '#0ea5e9',
    hws: ['HW3', 'HW4'],
    ref: 'Huang App. B · Hankel transform',
    desc: 'The real N-layer elastic solution in your browser: stresses, strains and deflections at any depth, dual and tandem wheels superposed — a check on WinJULEA, not a substitute for understanding it.',
    glyph: `<svg viewBox="0 0 120 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <path d="M10 10 H110" opacity="0.5" stroke-width="3"/>
      <path d="M10 20 H110" opacity="0.35"/>
      <path d="M10 30 H110" opacity="0.25"/>
      <path class="anim" d="M52 4 Q60 16 68 4" opacity="0.9"/>
      <path d="M44 6 Q60 30 76 6" opacity="0.55"/>
      <path d="M36 8 Q60 42 84 8" opacity="0.3"/>
    </svg>`,
  },
  {
    name: 'Stress Explorer',
    slug: 'stress-explorer',
    color: '#0ea5e9',
    hws: ['HW3', 'HW4'],
    ref: 'Boussinesq · Huang Eqs. 2.1–2.6',
    desc: 'One-layer (Boussinesq) response under a circular load: stress, strain, and deflection profiles, a draggable depth probe, and the classic σz/p pressure bulb.',
    glyph: `<svg viewBox="0 0 120 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <path d="M46 6 H74" stroke-width="4"/>
      <path d="M50 10 Q60 22 70 10" opacity="0.85"/>
      <path d="M44 10 Q60 34 76 10" opacity="0.6"/>
      <path class="anim" d="M37 10 Q60 48 83 10" opacity="0.4"/>
    </svg>`,
  },
  {
    name: 'ESAL Calculator',
    slug: 'esal-calculator',
    color: '#10b981',
    hws: ['HW5', 'HW7'],
    ref: 'AASHTO 1993 · App. D',
    desc: 'Exact AASHTO load equivalency factors, a mixed axle spectrum with presets, and the full design-lane projection — D, L, growth — shown factor by factor.',
    glyph: `<svg viewBox="0 0 120 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <path d="M14 6 V38 H112" opacity="0.35" stroke-width="1.5"/>
      <path class="anim" d="M16 36 C52 33 84 22 108 7"/>
      <path d="M42 34 l3.2 3.2 3.2-3.2 -3.2-3.2 Z" fill="currentColor" stroke="none"/>
      <path d="M72 27 l3.2 3.2 3.2-3.2 -3.2-3.2 Z" fill="currentColor" stroke="none"/>
      <path d="M94 15 l3.2 3.2 3.2-3.2 -3.2-3.2 Z" fill="currentColor" stroke="none"/>
    </svg>`,
  },
  {
    name: 'ESWL Comparator',
    slug: 'eswl',
    color: '#10b981',
    hws: ['HW5'],
    ref: 'Huang §6.2 · Eqs. 6.1-6.14',
    desc: 'Four published criteria for converting duals to one wheel, which give four different answers — 5630 to 7410 lb on the same example in Huang. The question is which failure mode you are designing against.',
    glyph: `<svg viewBox="0 0 120 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <circle cx="34" cy="14" r="6"/><circle cx="52" cy="14" r="6"/>
      <path d="M14 26 H108" opacity="0.35"/>
      <path class="anim" d="M26 30 Q43 40 60 30" opacity="0.8"/>
      <circle cx="90" cy="14" r="9" opacity="0.55"/>
      <path d="M72 4 L72 24" opacity="0.3" stroke-dasharray="3 3"/>
    </svg>`,
  },
  {
    name: 'Drainage Designer',
    slug: 'drainage',
    color: '#0ea5e9',
    hws: ['HW6'],
    ref: 'Huang Ch. 8 · Eqs. 8.18–8.34',
    desc: 'Surface infiltration by Ridgeway and Cedergren, groundwater and meltwater inflow, drainage-layer capacity and time to drain, Manning pipe sizing, and filter criteria.',
    glyph: `<svg viewBox="0 0 120 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <path d="M10 12 H110" opacity="0.4" stroke-width="3"/>
      <path class="anim" d="M18 16 L30 30 M40 16 L52 30 M62 16 L74 30 M84 16 L96 30" opacity="0.55"/>
      <path d="M10 34 H110" opacity="0.35" stroke-dasharray="3 3"/>
      <circle cx="60" cy="38" r="3.4" fill="currentColor" stroke="none"/>
    </svg>`,
  },
  {
    name: 'AASHTO Design Studio',
    slug: 'aashto',
    color: '#8b5cf6',
    hws: ['HW7', 'HW9'],
    ref: 'AASHTO 1993 · Huang Eqs. 11.34, 12.21, 12.29–12.30',
    desc: 'The 1993 design equations solved in any direction — SN, slab thickness, reliability, roadbed support — with the layered thickness solution and the seasonal effective k.',
    glyph: `<svg viewBox="0 0 120 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <path d="M14 6 V38 H112" opacity="0.35" stroke-width="1.5"/>
      <path class="anim" d="M18 34 C46 32 74 22 106 8"/>
      <path d="M18 38 C46 36 74 28 106 15" opacity="0.5" stroke-dasharray="3 3"/>
      <circle cx="70" cy="24" r="3.2" fill="currentColor" stroke="none"/>
    </svg>`,
  },
  {
    name: 'Transfer-Function Damage',
    slug: 'damage',
    color: '#8b5cf6',
    hws: ['HW8'],
    ref: 'AASHTOWare transfer functions',
    desc: 'Feed WinJULEA strains through the HW8 transfer functions: rutting per layer, Miner’s damage, and bottom-up cracking growing with every repetition.',
    glyph: `<svg viewBox="0 0 120 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <path d="M14 12 H106" opacity="0.3" stroke-dasharray="3 4" stroke-width="1.5"/>
      <path class="anim" d="M14 12 C34 12 38 26 60 26 C82 26 86 12 106 12"/>
      <path d="M25 38 C45 38 50 30 60 30 C70 30 75 38 95 38" opacity="0.45"/>
    </svg>`,
  },
  {
    name: 'PCA Rigid Thickness',
    slug: 'pca',
    color: '#8b5cf6',
    hws: ['HW9'],
    ref: 'PCA 1984 · Huang Eqs. 12.7–12.9',
    desc: 'Fatigue and erosion damage summed over an axle load distribution. You read four values off the PCA tables; the tool runs both criteria and tells you which one governs.',
    glyph: `<svg viewBox="0 0 120 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <path d="M14 6 V38 H112" opacity="0.35" stroke-width="1.5"/>
      <path class="anim" d="M24 36 V26 M38 36 V18 M52 36 V30 M66 36 V12 M80 36 V24 M94 36 V32"/>
      <path d="M14 14 H112" opacity="0.4" stroke-dasharray="3 3"/>
    </svg>`,
  },
  {
    name: 'Joints & Load Transfer',
    slug: 'joints',
    color: '#0ea5e9',
    hws: ['HW9'],
    ref: 'Huang Eqs. 4.35-4.45 · 12.3',
    desc: 'Dowel group action, bearing stress, tie bars, joint opening and faulting — under the three different conventions Huang uses in three different places, one of which may fail your design.',
    glyph: `<svg viewBox="0 0 120 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <path d="M8 14 H54 M66 14 H112" stroke-width="2.5"/>
      <path d="M8 30 H54 M66 30 H112" opacity="0.3"/>
      <path d="M60 6 V38" opacity="0.45" stroke-dasharray="3 3"/>
      <path class="anim" d="M44 22 H76" stroke-width="3"/>
      <circle cx="44" cy="22" r="2.4" fill="currentColor" stroke="none"/>
      <circle cx="76" cy="22" r="2.4" fill="currentColor" stroke="none"/>
    </svg>`,
  },
  {
    name: 'Westergaard Slab Stress',
    slug: 'westergaard',
    color: '#0ea5e9',
    hws: ['HW9'],
    ref: 'Westergaard · Huang Eqs. 4.9–4.31',
    desc: 'Every published case in Huang Ch. 4 — interior, edge under both circular and semicircular contact, and corner by both the original and Ioannides formulas, which disagree. Plus Bradbury curling and the dual-tyre equivalent circle.',
    glyph: `<svg viewBox="0 0 120 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <rect class="anim" x="22" y="9" width="76" height="26" rx="2"/>
      <circle cx="60" cy="22" r="4" fill="currentColor" stroke="none" opacity="0.9"/>
      <circle cx="60" cy="9" r="4" fill="currentColor" stroke="none" opacity="0.6"/>
      <circle cx="96" cy="33" r="4" fill="currentColor" stroke="none" opacity="0.6"/>
    </svg>`,
  },
  {
    name: 'Dynamic Modulus & Master Curve',
    slug: 'mastercurve',
    color: '#E87722',
    hws: ['HW2', 'HW8'],
    ref: 'Huang Eqs. 7.24-7.28 · 2.44-2.46',
    desc: 'Asphalt has no single modulus. Predict |E*| by two published routes that disagree by 65%, then shift the isotherms onto one master curve — and read whether time-temperature superposition actually held.',
    glyph: `<svg viewBox="0 0 120 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <path d="M14 6 V38 H112" opacity="0.35" stroke-width="1.5"/>
      <path class="anim" d="M18 35 C40 34 52 26 62 18 C72 10 92 8 108 7"/>
      <path d="M18 38 C36 37 46 32 56 27" opacity="0.4" stroke-dasharray="3 3"/>
      <path d="M40 38 C58 37 68 30 78 24" opacity="0.3" stroke-dasharray="3 3"/>
    </svg>`,
  },
  {
    name: 'FWD Backcalculation Studio',
    slug: 'backcalc',
    color: '#0ea5e9',
    hws: ['Ch. 9', 'Ch. 13'],
    ref: 'Huang §9.4.3 · Eqs. 13.22-13.26',
    desc: 'The forward problem run backwards: a measured deflection basin becomes layer moduli, by layered-elastic inversion and by the AASHTO closed form — plus the sensitivity that says which of those moduli the data actually determines.',
    glyph: `<svg viewBox="0 0 120 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <path d="M52 4 V12" stroke-width="3"/>
      <path class="anim" d="M14 14 C34 15 46 30 60 30 C74 30 86 15 106 14" opacity="0.9"/>
      <circle cx="60" cy="30" r="2.6" fill="currentColor" stroke="none"/>
      <circle cx="78" cy="24" r="2.2" fill="currentColor" stroke="none" opacity="0.7"/>
      <circle cx="94" cy="18" r="2.2" fill="currentColor" stroke="none" opacity="0.5"/>
      <path d="M10 38 H110" opacity="0.3" stroke-dasharray="3 3"/>
    </svg>`,
  },
  {
    name: 'Reliability & Variability',
    slug: 'reliability',
    color: '#8b5cf6',
    hws: ['Ch. 10'],
    ref: 'Huang Ch. 10 · Eqs. 10.38-10.46',
    desc: 'Give every design input a coefficient of variation and watch the reliability fall out. Ranks which input owns the uncertainty, and runs Taylor, Rosenblueth, and Monte Carlo side by side.',
    glyph: `<svg viewBox="0 0 120 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <path class="anim" d="M12 36 C30 36 32 12 48 12 C64 12 66 36 84 36" opacity="0.85"/>
      <path d="M36 36 C54 36 56 16 72 16 C88 16 90 36 108 36" opacity="0.5"/>
      <path d="M60 6 V38" opacity="0.35" stroke-dasharray="3 3"/>
    </svg>`,
  },
  {
    name: 'Serviceability & Skid Resistance',
    slug: 'psi',
    color: '#8b5cf6',
    hws: ['HW1', 'HW10'],
    ref: 'Huang Eqs. 9.14-9.15 · 9.31-9.34',
    desc: 'Fit the PSI equation yourself to a rating panel and watch the rut coefficient come out 27x the published value with an R-squared above 0.98. Plus skid number against speed.',
    glyph: `<svg viewBox="0 0 120 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <path d="M14 8 V38 H112" opacity="0.35" stroke-width="1.5"/>
      <path class="anim" d="M18 12 C40 14 62 26 106 34"/>
      <circle cx="34" cy="14" r="2.6" fill="currentColor" stroke="none"/>
      <circle cx="58" cy="22" r="2.6" fill="currentColor" stroke="none"/>
      <circle cx="82" cy="29" r="2.6" fill="currentColor" stroke="none"/>
      <circle cx="99" cy="33" r="2.6" fill="currentColor" stroke="none"/>
    </svg>`,
  },
  {
    name: 'ACR/PCR Compatibility',
    slug: 'acr',
    color: '#8b5cf6',
    hws: ['HW10'],
    ref: 'ICAO Annex 14 · ACR/PCR',
    desc: 'Parse runway rating codes and decide where an aircraft may operate — strength, subgrade category, tyre pressure, and the occasional-overload allowance.',
    glyph: `<svg viewBox="0 0 120 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <path d="M12 34 H108" opacity="0.35" stroke-width="1.5"/>
      <path d="M20 34 V28 M40 34 V28 M60 34 V28 M80 34 V28 M100 34 V28" opacity="0.4"/>
      <path class="anim" d="M28 20 L62 8 L70 12 L48 22 L52 26 L44 24 L40 18 Z"/>
    </svg>`,
  },
  {
    name: 'Pavement LCA Worksheet',
    slug: 'lca',
    color: '#10b981',
    hws: ['HW10'],
    ref: 'FHWA LCA framework',
    desc: 'Life-cycle GHG for one lane-mile across all six stages, with the IRI sawtooth driving the rehab schedule and every inventory factor editable.',
    glyph: `<svg viewBox="0 0 120 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <path d="M14 9 H106" opacity="0.3" stroke-dasharray="3 4" stroke-width="1.5"/>
      <path class="anim" d="M14 36 L44 9 L44 36 L74 9 L74 36 L104 9"/>
    </svg>`,
  },
  {
    name: 'Cross-Section Studio',
    slug: 'cross-section-studio',
    color: '#14B489',
    hws: ['Figures', 'Ch. 1'],
    ref: 'FAA P-401 · P-209 · P-154 · P-501',
    image: 'cross-section-studio.webp',
    imageAlt: 'A true-to-scale 3-D pavement cross section: asphalt surface over base, subbase and subgrade, each layer rendered with its own procedural material.',
    desc: 'The figure every write-up needs and nobody wants to redraw: a true-to-scale 3-D pavement section, eighteen procedural materials, thirteen airfield and highway templates — and the PNG copied straight to your clipboard, with or without a background.',
    glyph: `<svg viewBox="0 0 120 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path class="anim" d="M14 15h70l14-8H28z"/>
      <path d="M14 15v6h70v-6"/>
      <path d="M14 21v8h76v-8" opacity="0.7"/>
      <path d="M14 29v9h82v-9" opacity="0.45"/>
      <path d="M90 29l10-6M96 38l10-6" opacity="0.3" stroke-width="1.5"/>
    </svg>`,
  },
  {
    name: 'Gear3D',
    slug: 'gear3d',
    color: '#10b981',
    hws: ['HW4', 'HW5', 'Ch. 6'],
    ref: 'FHWA classes 1–13 · FAA Order 5300.7',
    image: 'gear3d.webp',
    imageAlt: 'A dual-tandem axle rendered in 3-D on a measurement grid, with the dual spacing, track width and axle spacing called out as dimension lines in millimetres.',
    desc: 'Truck axle configurations and aircraft landing gear drawn true to scale in 3-D, with spacings and track widths as measurable dimensions — and contact-patch corner coordinates exported in millimetres for a finite-element pre-processor.',
    glyph: `<svg viewBox="0 0 120 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 12h74l10 9v8H18z" opacity="0.5"/>
      <circle class="anim" cx="34" cy="31" r="7"/>
      <circle cx="76" cy="31" r="7"/>
      <circle cx="92" cy="31" r="7"/>
      <path d="M34 31h0M76 31h0M92 31h0" stroke-width="3"/>
      <path d="M34 40h58" opacity="0.35" stroke-width="1.5"/>
      <path d="M34 37v6M92 37v6" opacity="0.35" stroke-width="1.5"/>
    </svg>`,
  },
];

/** Build a tool's href from the site base. */
export const toolHref = (base: string, t: Tool) => `${base}tools/${t.slug}/`;
