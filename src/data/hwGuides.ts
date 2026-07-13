// Guided-learning content for each homework: purpose, the concepts and
// equations a student needs, a suggested approach, and common pitfalls.
// Bodies are HTML and may contain KaTeX ($...$ inline, $$...$$ display);
// they render inside sections marked data-katex.
// Keep entries brief: purpose ≤ 1 sentence, steps and pitfalls one line each.

export interface HwConcept {
  kind: 'equation' | 'concept';
  title: string;
  body: string;   // equation: the display math; concept: explanatory HTML
  where?: string; // equation only: variable definitions (HTML)
}

export interface HwGuide {
  purpose: string;
  concepts: HwConcept[];
  steps: string[];
  pitfalls: string[];
}

export const hwGuides: Record<string, HwGuide> = {
  hw1: {
    purpose:
      'Build the base vocabulary: what each layer does, how flexible and rigid pavements carry load, and how pavements fail.',
    concepts: [
      {
        kind: 'concept',
        title: 'Flexible vs. rigid load spreading',
        body: 'A flexible pavement spreads load through the layer stack in a narrowing cone — every layer matters and thicknesses control performance. A rigid slab spreads load by bending over a large area — slab flexural strength dominates and the subgrade sees little stress.',
      },
      {
        kind: 'concept',
        title: 'Mechanistic–empirical design',
        body: 'The <strong>mechanistic</strong> part computes responses (stress, strain, deflection) from mechanics; the <strong>empirical</strong> part maps them to observed distress through calibrated transfer functions. Full physics for every distress is out of reach — calibration never disappears.',
      },
      {
        kind: 'equation',
        title: 'Tire contact — pressure and area',
        body: '$$A_c = \\frac{P}{p} \\qquad p \\approx p_{tire}$$',
        where: '<dl class="doc-equation__defs"><dt>A_c</dt><dd>contact area</dd><dt>P</dt><dd>wheel load</dd><dt>p</dt><dd>contact pressure ≈ tire inflation pressure</dd></dl>',
      },
      {
        kind: 'concept',
        title: 'Distress mechanisms to know',
        body: '<strong>Pumping</strong>: water under a slab ejects fines through joints until corners lose support and crack. <strong>Rutting</strong>: instability rutting (shear flow within the AC) vs. structural rutting (deformation of base/subgrade) — different causes, different design fixes.',
      },
    ],
    steps: [
      'Read Huang Ch. 1; skim the Distress Identification Manual for photos of each failure mode.',
      'Draw both cross-sections with labeled layers and typical thicknesses.',
      'Answer by explaining mechanisms — grading rewards cause-and-effect, not definitions.',
      'For the axle question, think about overlapping stress bulbs at depth.',
    ],
    pitfalls: [
      'Tack coat bonds two asphalt lifts; prime coat penetrates and seals a granular base — the prime coat is the less viscous one.',
      'Rutting is not only a subgrade problem — instability rutting lives entirely in the AC.',
      '“Least damage per axle” ≠ “least damage per ton carried” — say which you answer.',
    ],
  },

  hw2: {
    purpose:
      'Characterize the foundation: fit the resilient modulus model to triaxial data, reduce a CBR test, and understand lime stabilization.',
    concepts: [
      {
        kind: 'equation',
        title: 'Generalized resilient modulus model (MEPDG form)',
        body: '$$M_r = k_1\\, p_a \\left(\\frac{\\theta}{p_a}\\right)^{k_2} \\left(\\frac{\\tau_{oct}}{p_a} + 1\\right)^{k_3}$$',
        where: '<dl class="doc-equation__defs"><dt>&theta;</dt><dd>bulk stress &sigma;&#8321;+&sigma;&#8322;+&sigma;&#8323; (triaxial: &sigma;<sub>d</sub> + 3&sigma;&#8323;)</dd><dt>&tau;<sub>oct</sub></dt><dd>octahedral shear (triaxial: &radic;2&thinsp;&sigma;<sub>d</sub>/3)</dd><dt>p_a</dt><dd>atmospheric pressure, 101.325 kPa (14.7 psi)</dd><dt>k&#8321;, k&#8322;, k&#8323;</dt><dd>regression constants (k&#8322; &ge; 0, k&#8323; &le; 0)</dd></dl>',
      },
      {
        kind: 'concept',
        title: 'Linearize, then regress',
        body: 'Take log&#8321;&#8320; of both sides — the model becomes linear in log(k&#8321;), k&#8322;, k&#8323;: a two-variable regression (Excel <code>LINEST</code> or the <a href="../../tools/mr-fitter/">Resilient Modulus Fitter</a>, which runs it live). Report R² and whether it is in log space or on back-transformed M<sub>r</sub>.',
      },
      {
        kind: 'equation',
        title: 'CBR definition',
        body: '$$CBR = \\frac{p_{test}}{p_{standard}} \\times 100\\%$$',
        where: '<dl class="doc-equation__defs"><dt>at 0.1 in</dt><dd>standard pressure = 1000 psi</dd><dt>at 0.2 in</dt><dd>standard pressure = 1500 psi</dd><dt>rule</dt><dd>report the 0.1-in value unless the 0.2-in value is greater on recheck; correct the origin if the curve starts concave-up</dd></dl>',
      },
      {
        kind: 'concept',
        title: 'What lime does to soil',
        body: '<strong>Immediately</strong>: cation exchange and flocculation drop plasticity. <strong>Over weeks–months</strong>: pozzolanic reactions cement particles and build strength. Best for clayey soils (PI &gt; 10).',
      },
    ],
    steps: [
      'Per test row: σ₁ = σd + σ₃, then θ, τ_oct, and Mr = σd/εr.',
      'Log-transform, regress for k₁, k₂, k₃, and compute R².',
      'Plot measured vs. predicted Mr — check with the Mr Fitter tool.',
      'CBR: plot pressure–penetration, correct the origin, apply the 0.1/0.2-in rule.',
    ],
    pitfalls: [
      'The data are in kPa — use p_a = 101.325 kPa, or k₁ is off by orders of magnitude.',
      'Keep the “+1” in the τ_oct term — it keeps the model defined at zero shear.',
      'Mr uses recoverable (resilient) strain, not total strain.',
    ],
  },

  hw3: {
    purpose:
      'Compute stresses and deflections in one-, two-, and three-layer systems by hand with the classic charts and tables.',
    concepts: [
      {
        kind: 'equation',
        title: 'One-layer system — Boussinesq, on the axis',
        body: '$$\\sigma_z = p\\left[1 - \\frac{z^3}{(a^2+z^2)^{3/2}}\\right] \\qquad w_0 = \\frac{2(1-\\nu^2)\\,p\\,a}{E}$$',
        where: '<dl class="doc-equation__defs"><dt>p, a</dt><dd>contact pressure and radius (flexible plate)</dd><dt>z</dt><dd>depth under the load center</dd><dt>w&#8320;</dt><dd>center surface deflection; a rigid plate gives &asymp;79% of it — use the form the problem assumes</dd></dl>',
      },
      {
        kind: 'equation',
        title: 'Two-layer deflection (Burmister)',
        body: '$$w_0 = \\frac{1.5\\,p\\,a}{E_2}\\,F_2$$',
        where: '<dl class="doc-equation__defs"><dt>F&#8322;</dt><dd>deflection factor from the chart, entered with E&#8321;/E&#8322; and h&#8321;/a</dd><dt>E&#8322;</dt><dd>lower-layer (subgrade) modulus</dd></dl>',
      },
      {
        kind: 'concept',
        title: 'Three-layer systems (Jones tables, Peattie charts)',
        body: 'Normalize: k₁ = E₁/E₂, k₂ = E₂/E₃, A = a/h₂, H = h₁/h₂. Interpolate the interface stress factors (ZZ1, ZZ2, …), scale by p, and compute strains from the interface stress pairs.',
      },
      {
        kind: 'concept',
        title: 'Check yourself online',
        body: 'The <a href="../../tools/stress-explorer/">Stress Explorer</a> computes the full one-layer response live — verify every Boussinesq number before moving to the layered charts.',
      },
    ],
    steps: [
      'Normalize what each problem gives: z/a, h₁/a, modulus ratios.',
      'Pick the right chart or table and read/interpolate the factor.',
      'Convert factors back to physical stresses and deflections, carrying units.',
      'Verify one-layer answers with the Stress Explorer.',
    ],
    pitfalls: [
      'Flexible vs. rigid plate formulas differ — check which the chart assumes.',
      'Most charts are log-log: interpolate on the log scale.',
      'Compression is positive throughout Huang — state your convention and keep it.',
    ],
  },

  hw4: {
    purpose:
      'Analyze a four-layer structure with layered-elastic software and learn to read the response profiles like an engineer.',
    concepts: [
      {
        kind: 'concept',
        title: 'Layered elastic analysis — the assumptions',
        body: 'Homogeneous, isotropic, linear elastic layers (E, ν), horizontally infinite, fully bonded here, circular uniform load. The observations are graded because the numbers are only as good as these assumptions.',
      },
      {
        kind: 'concept',
        title: 'The critical responses of flexible design',
        body: '<strong>Tensile strain at the bottom of the AC</strong> (fatigue cracking), <strong>compressive strain at the top of the subgrade</strong> (structural rutting), and <strong>surface deflection</strong> (overall response). Find them in your profiles.',
      },
      {
        kind: 'concept',
        title: 'What the profiles should show',
        body: 'σz decays smoothly and is continuous across interfaces; horizontal stress <em>jumps</em> at interfaces; the AC bottom goes into tension; deflection accumulates mostly in the soft lower layers. If your plots disagree, check the run.',
      },
    ],
    steps: [
      'Enter the four layers (E = 3200/200/100/42 MPa) and the 720 kPa, 145 mm load in WinJULEA.',
      'Place evaluation points at the surface, ±1 mm around each interface, and inside each layer.',
      'Plot σz, εz, σr, εr, and w versus depth (depth downward).',
      'Write ≥ 4 observations tied to mechanics; state the sign convention. Compare against the one-layer Stress Explorer solution.',
    ],
    pitfalls: [
      'WinJULEA is unit-agnostic — one consistent system (kPa, mm) or the output is garbage.',
      'Horizontal stress is ambiguous exactly at an interface — offset ±1 mm to capture the jump.',
      'Bonded vs. frictionless interfaces change AC bottom strain dramatically — this assignment says bonded.',
    ],
  },

  hw5: {
    purpose:
      'Convert a mixed traffic stream into design ESALs: load equivalency, truck factors, growth, and lane distribution.',
    concepts: [
      {
        kind: 'equation',
        title: 'Load equivalency — fourth-power rule of thumb',
        body: '$$EALF \\approx \\left(\\frac{L_x}{18\\,\\text{kip}}\\right)^4$$',
        where: '<dl class="doc-equation__defs"><dt>L<sub>x</sub></dt><dd>single-axle load, kip</dd><dt>exact values</dt><dd>AASHTO design equation (Tables D.4–D.9), depend on SN and p<sub>t</sub> — the <a href="../../tools/esal-calculator/">ESAL Calculator</a> computes them exactly</dd></dl>',
      },
      {
        kind: 'equation',
        title: 'Design traffic',
        body: '$$ESAL = \\sum_i F_i\\, n_i \\qquad G = \\frac{(1+r)^n - 1}{r}$$',
        where: '<dl class="doc-equation__defs"><dt>F<sub>i</sub>, n<sub>i</sub></dt><dd>EALF and passes of axle group i</dd><dt>G</dt><dd>total growth factor over n years at rate r</dd><dt>D, L</dt><dd>directional and lane factors applied to two-way traffic</dd></dl>',
      },
      {
        kind: 'concept',
        title: 'Truck factor',
        body: 'T<sub>f</sub> = average ESALs per truck of a class — the bridge between classified counts and axle spectra. Problems either give axle data (build T<sub>f</sub>) or T<sub>f</sub> directly (use it).',
      },
    ],
    steps: [
      'Classify what each problem gives: axle loads, truck volumes, or both.',
      'Get EALFs (fourth power to check, AASHTO values for the answer).',
      'Multiply, sum, then apply growth, directional, and lane factors in order.',
      'Sanity-check: a busy interstate sees 10⁶–10⁷ ESALs over 20 years.',
    ],
    pitfalls: [
      'A tandem is one axle group with its own EALF — never two singles.',
      'r enters as a decimal; G is the total multiplier, not per-year.',
      'Check whether ADT is two-way (needs D) or already one-way per lane.',
    ],
  },

  hw6: {
    purpose:
      'Estimate water inflow, size the drainage layer, and verify filter criteria — checked against FHWA’s DRIP.',
    concepts: [
      {
        kind: 'concept',
        title: 'The drainage chain',
        body: 'Follow the water: <strong>inflow</strong> (infiltration + groundwater) → <strong>drainage layer</strong> (capacity and slope) → <strong>collector</strong> (edge drain and outlet). Each problem exercises one link.',
      },
      {
        kind: 'concept',
        title: 'Time-to-drain',
        body: 'Many designs are judged by how fast the base drains: degree of drainage U vs. the time factor (permeability k, <em>effective</em> porosity n<sub>e</sub>, slope, path length). “Good” means 50% drained in hours, not days.',
      },
      {
        kind: 'equation',
        title: 'Granular filter criteria',
        body: '$$D_{15}^{filter} \\le 5\\,D_{85}^{soil} \\qquad D_{15}^{filter} \\ge 5\\,D_{15}^{soil}$$',
        where: '<dl class="doc-equation__defs"><dt>first</dt><dd>piping criterion — fine enough to hold the soil</dd><dt>second</dt><dd>permeability criterion — coarse enough to drain</dd><dt>D&#8321;&#8325;, D&#8328;&#8325;</dt><dd>sizes at 15% and 85% passing</dd></dl>',
      },
    ],
    steps: [
      'Set up the geometry: drainage path length, slope, thickness.',
      'Solve by hand with the Ch. 8 equations and charts.',
      'Rebuild in DRIP and compare — small gaps are chart-reading, large ones are setup errors.',
      'Check both filter criteria and state which governs.',
    ],
    pitfalls: [
      'Permeability units (ft/day vs. m/day vs. cm/s) cause most wrong answers.',
      'Use effective porosity, not total, for time-to-drain.',
      'The drainage path follows the resultant slope — not simply the lane width.',
    ],
  },

  hw7: {
    purpose:
      'Run the AASHTO 1993 flexible procedure end to end: reliability, the design equation for SN, and the layered thickness analysis.',
    concepts: [
      {
        kind: 'equation',
        title: 'AASHTO 1993 flexible design equation',
        body: '$$\\log_{10}W_{18} = Z_R S_0 + 9.36\\log_{10}(SN{+}1) - 0.20 + \\frac{\\log_{10}\\left(\\frac{\\Delta PSI}{4.2-1.5}\\right)}{0.40 + \\frac{1094}{(SN+1)^{5.19}}} + 2.32\\log_{10}M_R - 8.07$$',
        where: '<dl class="doc-equation__defs"><dt>W&#8321;&#8328;</dt><dd>design ESALs</dd><dt>Z<sub>R</sub>, S&#8320;</dt><dd>reliability deviate, overall standard deviation (&asymp;0.45)</dd><dt>&Delta;PSI</dt><dd>p&#8320; &minus; p<sub>t</sub></dd><dt>M<sub>R</sub></dt><dd>subgrade resilient modulus in <strong>psi</strong></dd></dl>',
      },
      {
        kind: 'equation',
        title: 'Layered structural number',
        body: '$$SN = a_1 D_1 + a_2 D_2 m_2 + a_3 D_3 m_3$$',
        where: '<dl class="doc-equation__defs"><dt>a<sub>i</sub></dt><dd>layer coefficients per inch: AC &asymp; 0.44, base &asymp; 0.14, subbase &asymp; 0.11</dd><dt>m<sub>i</sub></dt><dd>drainage coefficients, granular layers only</dd><dt>D<sub>i</sub></dt><dd>thicknesses, inches</dd></dl>',
      },
      {
        kind: 'concept',
        title: 'Design from the top down',
        body: 'Solve for SN₁ (on the base), SN₂ (on the subbase), SN₃ (on the subgrade). D₁ covers SN₁; D₂ covers SN₂ − a₁D₁; and so on — rounding each thickness <em>up</em> before moving down.',
      },
    ],
    steps: [
      'Assemble inputs: W₁₈ (ESAL Calculator), R → Z_R, S₀, ΔPSI, moduli.',
      'Solve for required SN by nomograph; verify with the equation.',
      'Do the top-down layered analysis with a-coefficients and m-factors.',
      'Report rounded thicknesses and provided vs. required SN.',
    ],
    pitfalls: [
      'M_R goes in as psi — ksi silently shifts the log term.',
      'Drainage coefficients m never apply to the AC layer.',
      'Z_R is negative for R > 50% (−1.645 at 95%) — dropping the sign inflates the design.',
    ],
  },

  hw8: {
    purpose:
      'Close the mechanistic loop: compute layer strains, feed AASHTOWare transfer functions, and watch rutting and cracking grow with N.',
    concepts: [
      {
        kind: 'concept',
        title: 'AC sublayers and loading frequency',
        body: 'The stress pulse lengthens with depth, so deeper AC feels a lower frequency — and asphalt is softer at low frequency. Assign the given sublayer moduli in descending order from the surface (595 → 585 → 575 → 570 → 565 ksi).',
      },
      {
        kind: 'equation',
        title: 'AC rutting transfer function (assignment form)',
        body: '$$Rut_{AC} = \\varepsilon_v\\, h_{AC}\\, \\cdot 3.5\\times10^{-3.4488}\\, T^{1.5606}\\, N^{0.479244}$$',
        where: '<dl class="doc-equation__defs"><dt>&epsilon;<sub>v</sub></dt><dd>vertical strain at sublayer mid-depth</dd><dt>T</dt><dd>AC temperature (71&deg;F here)</dd><dt>N</dt><dd>repetitions</dd></dl>',
      },
      {
        kind: 'equation',
        title: 'Fatigue life and Miner’s damage',
        body: '$$N_f = 0.003612\\,C_H\\,\\varepsilon_t^{-3.9492}\\,E_{AC}^{-1.281} \\qquad DI = \\sum \\frac{n}{N_f}$$',
        where: '<dl class="doc-equation__defs"><dt>&epsilon;<sub>t</sub></dt><dd>tensile strain at the AC bottom</dd><dt>E<sub>AC</sub></dt><dd>AC modulus, psi (lowest sublayer)</dd><dt>C<sub>H</sub></dt><dd>thickness correction from h<sub>HMA</sub></dd><dt>DI</dt><dd>damage; the FC<sub>bottom</sub> sigmoid converts it to % cracked area</dd></dl>',
      },
      {
        kind: 'concept',
        title: 'Where the code goes',
        body: 'The 90-day × 1,000-reps/day accumulation is a loop — the <a href="../../tools/damage/">Transfer-Function Damage</a> tool runs it in the browser from your WinJULEA strains. Plot rutting and cracking against N and describe the shape.',
      },
    ],
    steps: [
      'Part 1: follow the class mechanistic design procedure for the Sangamon County highway.',
      'Part 2a: WinJULEA with 5 AC sublayers (moduli ordered by frequency), base, subgrade; extract the required strains.',
      'Part 2b: accumulate damage over N, plot rutting and cracking growth — the Damage tool automates this.',
      'Part 2c: total the rutting and name the governing layer.',
    ],
    pitfalls: [
      'The rutting equations want strains at sublayer mid-depths — not interface values.',
      'Use the lowest sublayer modulus in N_f, exactly as the assignment states.',
      'Pick one accumulation approach (running N vs. daily increments) and stay consistent.',
    ],
  },

  hw9: {
    purpose:
      'Switch to concrete: curling from temperature gradients, Westergaard’s three loading cases, and rigid design stress checks.',
    concepts: [
      {
        kind: 'equation',
        title: 'Radius of relative stiffness',
        body: '$$\\ell = \\left[\\frac{E h^3}{12\\,(1-\\nu^2)\\,k}\\right]^{1/4}$$',
        where: '<dl class="doc-equation__defs"><dt>E, h, &nu;</dt><dd>slab modulus, thickness, Poisson ratio</dd><dt>k</dt><dd>modulus of subgrade reaction (pci)</dd><dt>&ell;</dt><dd>the length scale of every Westergaard solution</dd></dl>',
      },
      {
        kind: 'concept',
        title: 'Westergaard’s three cases',
        body: '<strong>Interior</strong>: max stress at the slab bottom. <strong>Edge</strong>: the critical highway case — roughly 50% higher. <strong>Corner</strong>: max stress on <em>top</em>, away from the corner — why corner cracks break downward. Know the tension fibre before plugging numbers — the <a href="../../tools/westergaard/">Westergaard tool</a> computes all three cases live.',
      },
      {
        kind: 'equation',
        title: 'Curling stress (Bradbury)',
        body: '$$\\sigma_{curl} = \\frac{C\\,E\\,\\alpha_t\\,\\Delta t}{2}$$',
        where: '<dl class="doc-equation__defs"><dt>C</dt><dd>Bradbury coefficient from L<sub>x</sub>/&ell;, L<sub>y</sub>/&ell; (edge form; interior combines both directions with &nu;)</dd><dt>&alpha;<sub>t</sub></dt><dd>thermal coefficient</dd><dt>&Delta;t</dt><dd>top–bottom temperature difference</dd></dl>',
      },
    ],
    steps: [
      'Compute ℓ first — everything consumes it.',
      'Identify each problem’s case (interior/edge/corner, day/night) and critical fibre.',
      'Evaluate the stresses, superposing load + curling when asked.',
      'Compare against the modulus of rupture to interpret.',
    ],
    pitfalls: [
      'Day curling puts the interior bottom in tension; night reverses it — get the sign of Δt right.',
      'k is in pci — mixing units breaks ℓ.',
      'Corner max stress is on top of the slab — checking bottom tension there is the classic error.',
    ],
  },

  hw10: {
    purpose:
      'Two capstones: airfield ACR/PCR ratings with FAARFIELD design, and a full pavement life-cycle assessment.',
    concepts: [
      {
        kind: 'concept',
        title: 'Reading a PCR code',
        body: '<code>650/F/C/Y/T</code> = PCR 650, <strong>F</strong>lexible (R rigid), subgrade category <strong>C</strong> (A strongest → D weakest), tire-pressure code <strong>Y</strong>, <strong>T</strong>echnical rating. An aircraft can operate when ACR ≤ PCR for that type and category, and its tire pressure respects the letter.',
      },
      {
        kind: 'concept',
        title: 'FAARFIELD in one paragraph',
        body: 'FAA’s layered design program grows the designed layer until the cumulative damage factor CDF = 1 at design life. Here: subbase for a B747-400 at 4,000 annual departures, CBR 5 vs. stabilized CBR 7, compared against the 15-in-subbase cost equivalence.',
      },
      {
        kind: 'equation',
        title: 'Life-cycle GHG accounting',
        body: '$$GHG_{total} = Materials + Transport + Construction + Use + M\\&R + EOL$$',
        where: '<dl class="doc-equation__defs"><dt>Use</dt><dd>vehicles &times; miles &times; fuel/mile &times; 9 kg CO&#8322;e/gal</dd><dt>M&amp;R</dt><dd>IRI grows 12.2 in/mi/yr from 60; mill-and-overlay at 170 &rarr; rehabs near years 9 and 18</dd><dt>EOL</dt><dd>disposal</dd></dl>',
      },
    ],
    steps: [
      'Part 1a: interpolate the ACR tables per runway subgrade category; compare ACR vs. PCR and tire pressure vs. the letter.',
      'Part 1b: run FAARFIELD for both subgrades; make the stabilization decision quantitatively.',
      'Part 2: build the stage-by-stage GHG table, timeline the rehabs from IRI — the <a href="../../tools/lca/">LCA Worksheet</a> automates the accounting.',
      'Close with the governing stage and one concrete mitigation.',
    ],
    pitfalls: [
      'Compare each runway against the matching ACR (type + category), not a single number.',
      'The use phase usually dwarfs everything — forgetting it (or the second rehab) flips the conclusion.',
      'Keep the functional unit straight: per lane-mile over 20 years.',
    ],
  },
};
