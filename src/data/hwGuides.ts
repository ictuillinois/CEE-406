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
        title: 'How does the load reach the subgrade?',
        body: 'Trace one wheel load down each of your two sections. In which one does the load spread through the <em>thickness</em> of a stack, and in which through the <em>bending</em> of a single member? Your answer decides which material property governs each design, and how much stress is left at the subgrade. Huang §1.1–1.2.',
      },
      {
        kind: 'concept',
        title: 'Where does the physics stop?',
        body: 'Follow one design decision from wheel load to predicted distress and mark the point where computation ends and observed field performance takes over. What would you have to measure, and for how long, to push that mark all the way to the end? Huang §1.4.',
      },
      {
        kind: 'equation',
        title: 'Tire contact: pressure and area',
        body: '$$A_c = \\frac{P}{p} \\qquad p \\approx p_{tire}$$',
        where: '<dl class="doc-equation__defs"><dt>\$</dt><dd>contact area</dd><dt>P</dt><dd>wheel load</dd><dt>p</dt><dd>contact pressure, <em>assumed</em> equal to tire inflation pressure. Q7 is partly about how far that assumption holds.</dd></dl>',
      },
      {
        kind: 'concept',
        title: 'Anatomy of a distress',
        body: 'For each distress in the set, name three things: the driving force, the material that moves, and where that material ends up. For pumping, what has to be present under the slab before it can start, and what is carried away? For rutting, which of the two kinds leaves the total layer thickness unchanged? Huang §1.5 and the Distress Identification Manual.',
      },
    ],
    steps: [
      'Read Huang Ch. 1; skim the Distress Identification Manual for photos of each failure mode.',
      'Draw both cross-sections with labeled layers and typical thicknesses.',
      'Answer by explaining mechanisms; grading rewards cause-and-effect, not definitions.',
      'For the axle question, sketch the stress at depth under one axle before you try to compare groups.',
    ],
    pitfalls: [
      'Q3 turns on <em>what each coat is applied to</em> and what it has to do there. Settle that first; the viscosity ranking follows from it, and not the other way round.',
      'A rut is measured at the surface, but the material that moved need not be near it. For each mechanism, say which layer deforms, then check that the design method you propose acts on <em>that</em> layer.',
      'Q6 holds the total group load, tire design and inflation pressure fixed. Be explicit about what that leaves free to vary, and name the depth at which you are comparing damage: the ranking can depend on it.',
      'Q1 asks for interface treatments as well as layers. A drawing with no bond between lifts is missing part of the answer.',
    ],
  },

  hw2: {
    purpose:
      'Judge how test quality, model choice and data correction affect the subgrade properties used in pavement design.',
    concepts: [
      {
        kind: 'equation',
        title: 'From triaxial readings to model inputs',
        body: '$$M_r = \\frac{\\sigma_d}{\\varepsilon_r}, \\qquad \\theta = 3\\sigma_3 + \\sigma_d, \\qquad \\tau_{oct} = \\frac{\\sqrt{2}}{3}\\sigma_d$$',
        where: '<dl class="doc-equation__defs"><dt>&sigma;<sub>d</sub></dt><dd>deviator stress in kPa</dd><dt>&sigma;<sub>3</sub></dt><dd>confining stress in kPa; &sigma;<sub>1</sub> = &sigma;<sub>3</sub> + &sigma;<sub>d</sub>, and &sigma;<sub>2</sub> = &sigma;<sub>3</sub></dd><dt>&epsilon;<sub>r</sub></dt><dd>recoverable strain, entered as a dimensionless ratio</dd></dl>',
      },
      {
        kind: 'equation',
        title: 'Generalized resilient modulus model (MEPDG form)',
        body: '$$M_r = k_1\\, p_a \\left(\\frac{\\theta}{p_a}\\right)^{k_2} \\left(\\frac{\\tau_{oct}}{p_a} + 1\\right)^{k_3}$$',
        where: '<dl class="doc-equation__defs"><dt>p<sub>a</sub></dt><dd>atmospheric pressure, 101.325 kPa</dd><dt>k<sub>1</sub>, k<sub>2</sub>, k<sub>3</sub></dt><dd>fitted material parameters; interpret each while holding the other stress term fixed</dd></dl>',
      },
      {
        kind: 'concept',
        title: 'What makes a reading an outlier?',
        body: 'Compare readings at similar confining and deviator stresses before judging a point by its residual alone. Which measured quantity could explain an unusual modulus, and what evidence would justify removing that row? Preserve the original IDs.',
      },
      {
        kind: 'equation',
        title: 'Two-parameter comparison model',
        body: '$$M_r = k_1\\,\\theta^{k_2}$$',
        where: '<dl class="doc-equation__defs"><dt>comparison</dt><dd>fit both models to the same cleaned dataset and compare R² in log space</dd><dt>parameters</dt><dd>the two forms use different normalizations; record the stress units with each fit</dd></dl>',
      },
      {
        kind: 'concept',
        title: 'Does a good fit guarantee a good prediction?',
        body: 'Locate each requested prediction relative to the measured stress states. What changes when the bulk stress doubles and both stress components scale proportionally? Compare disagreement within the tested range with disagreement beyond it.',
      },
      {
        kind: 'equation',
        title: 'CBR definition',
        body: '$$CBR = \\frac{p_{test}}{p_{standard}} \\times 100\\%$$',
        where: '<dl class="doc-equation__defs"><dt>at 0.10 in</dt><dd>standard pressure = 1000 psi</dd><dt>at 0.20 in</dt><dd>standard pressure = 1500 psi</dd><dt>origin correction</dt><dd>&delta;<sub>corr</sub> = &delta;<sub>measured</sub> &minus; &delta;<sub>0</sub>; keep the uncorrected and corrected results separate</dd></dl>',
      },
      {
        kind: 'concept',
        title: 'Which part of the curve defines the origin?',
        body: 'Find the steepest linear region after the initial toe and explain why those points define your tangent. After shifting the origin, which measured penetrations correspond to the two standard corrected penetrations?',
      },
    ],
    steps: [
      'Read the assignment on Canvas and Huang Ch. 7; build the Q1 table with IDs, moduli, principal stresses and invariants.',
      'Fit the generalized model to all readings, then document the two outlier IDs and refit the cleaned data.',
      'Fit the two-parameter model to the same cleaned rows; compare log-space R² and prediction differences in kPa, psi and percent.',
      'Evaluate the Q4 stress states with both models and explain the limits of each prediction.',
      'For Q5, plot the raw curve, justify the tangent, and report both standard-penetration CBR values before and after correction.',
    ],
    pitfalls: [
      'Use recoverable strain as a ratio, not a percentage, and keep all stress quantities in the same units as p<sub>a</sub>.',
      'Report R² in <em>log space</em> as requested; do not substitute a value computed after transforming predictions back to modulus.',
      'Compare the two models on identical retained rows and state the denominator used for each percent difference.',
      'Changing the penetration origin changes where pressures are read; it does not shift the measured pressures vertically.',
      'Report both CBR values and justify the governing value using the procedure taught in class; do not silently select a value.',
    ],
  },

  hw3: {
    purpose:
      'Connect asphalt material characterization to pavement response, and judge what fitted models and elastic calculations can support.',
    concepts: [
      {
        kind: 'concept',
        title: 'Which binder criterion governs?',
        body: 'Track the aging condition, test quantity and limiting temperature separately. Q1 specifies log interpolation for DSR quantities and linear interpolation for BBR results. How do the true limiting temperatures translate into a standard grade and the project requirements? Use the supplied Performance Grades chart.',
      },
      {
        kind: 'concept',
        title: 'What can a specimen height tell you?',
        body: 'Start from mass divided by volume. If mass and diameter stay fixed, how does the measured height relate to bulk specific gravity at each gyration count? Derive that relationship before comparing the three compaction stages with the specified limits.',
      },
      {
        kind: 'equation',
        title: 'Reduced frequency and the sigmoidal master curve',
        body: '$$f_r = f\\,a_T, \\qquad \\log_{10}|E^*| = \\delta + \\frac{\\alpha}{1 + e^{\\beta + \\gamma\\log_{10}(f_r)}}$$',
        where: '<dl class="doc-equation__defs"><dt>reference</dt><dd>T<sub>ref</sub> = 21°C, with log<sub>10</sub>(a<sub>T</sub>) = 0</dd><dt>&delta;, &alpha;, &beta;, &gamma;</dt><dd>fit parameters; keep modulus in MPa and frequency in Hz when reporting them</dd><dt>phase angle</dt><dd>apply the modulus shift factors to the measured phase angles before judging whether they form a single curve</dd></dl>',
      },
      {
        kind: 'equation',
        title: 'Williams-Landel-Ferry shift relationship',
        body: '$$\\log_{10}(a_T) = \\frac{-C_1(T-T_{ref})}{C_2+(T-T_{ref})}$$',
        where: '<dl class="doc-equation__defs"><dt>C<sub>1</sub>, C<sub>2</sub></dt><dd>fit to the iterated shift factors at the stated reference temperature</dd><dt>prediction range</dt><dd>check both the temperature range used for WLF and the reduced-frequency range used for the modulus fit</dd></dl>',
      },
      {
        kind: 'concept',
        title: 'Can the fitted plateau be trusted?',
        body: 'Compare the full-data fit with a fit that never sees the 54°C readings. Which measured points constrain the lower plateau, and how should that affect your confidence in high-temperature predictions? Preserve the withheld data for evaluation only.',
      },
      {
        kind: 'concept',
        title: 'Which direction does each stress act in?',
        body: 'For Q4, sketch point A relative to <em>each</em> load and identify its local radial and tangential directions. Resolve those directions into the common x and y axes before adding contributions. Tabulate the chart factors and record any approximation the assignment asks you to make.',
      },
      {
        kind: 'concept',
        title: 'Does equal deflection mean equal performance?',
        body: 'For Q5, keep the interface and plate assumptions explicit, check the equal-modulus limit, and compare the critical stresses and strains as well as surface deflection. What can a single deflection measurement tell you about thickness and modulus separately?',
      },
    ],
    steps: [
      'Read the assignment and Performance Grades chart on Canvas; use Lecture 6 for gyration-count relationships and Huang Ch. 7 and Appendix D for materials.',
      'Complete the binder checks and derive the specimen-height relationship before interpreting any failed criterion.',
      'Build the 21°C master curve, record shifts and log-space R², fit WLF, and document the requested predictions and withheld-temperature check.',
      'For Q4, read Huang Figures 2.2, 2.3, 2.4 and 2.6, tabulate each load contribution, then reproduce the case in LEAPS.',
      'For Q5, use Figures 2.15, 2.17 and 2.21 for the base case and alternatives; use LEAPS for the equal-deflection thickness search.',
      'Attach a screenshot of the fitting-tool output or your script so the fits can be reproduced, as required by the assignment.',
    ],
    pitfalls: [
      'A BBR test temperature is not the grade temperature: account for the 10°C offset specified in Q1.',
      'Zero logarithmic shift at the reference temperature means a shift factor of one, not zero.',
      'Use the same modulus shift factors for the phase-angle check; independently shifting phase data would answer a different question.',
      'Withholding 54°C means excluding its readings from the fitting process, not merely hiding its points on the plot.',
      'Record any change from &nu; = 0.50 to 0.49 in LEAPS and retain Q4’s stated tangential-stress approximation when comparing methods.',
      'Keep chart axes, flexible versus rigid plate conventions, and response sign conventions explicit; explain sensitivity when the reference response is small.',
    ],
  },

  hw4: {
    purpose:
      'Analyze a four-layer structure with layered-elastic software and learn to read the response profiles like an engineer.',
    concepts: [
      {
        kind: 'concept',
        title: 'Layered elastic analysis: the assumptions',
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
      'WinJULEA is unit-agnostic, so use one consistent system (kPa, mm) or the output is garbage.',
      'Horizontal stress is ambiguous exactly at an interface, so offset ±1 mm to capture the jump.',
      'Bonded vs. frictionless interfaces change AC bottom strain dramatically. This assignment says bonded.',
    ],
  },

  hw5: {
    purpose:
      'Convert a mixed traffic stream into design ESALs: load equivalency, truck factors, growth, and lane distribution.',
    concepts: [
      {
        kind: 'equation',
        title: 'Load equivalency: fourth-power rule of thumb',
        body: '$$EALF \\approx \\left(\\frac{L_x}{18\\,\\text{kip}}\\right)^4$$',
        where: '<dl class="doc-equation__defs"><dt>L<sub>x</sub></dt><dd>single-axle load, kip</dd><dt>exact values</dt><dd>AASHTO design equation (Tables D.4–D.9), depend on SN and p<sub>t</sub>; the <a href="../../tools/esal-calculator/">ESAL Calculator</a> computes them exactly</dd></dl>',
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
        body: 'T<sub>f</sub> = average ESALs per truck of a class, the bridge between classified counts and axle spectra. Problems either give axle data (build T<sub>f</sub>) or T<sub>f</sub> directly (use it).',
      },
    ],
    steps: [
      'Classify what each problem gives: axle loads, truck volumes, or both.',
      'Get EALFs (fourth power to check, AASHTO values for the answer).',
      'Multiply, sum, then apply growth, directional, and lane factors in order.',
      'Sanity-check: a busy interstate sees 10⁶–10⁷ ESALs over 20 years.',
    ],
    pitfalls: [
      'A tandem is one axle group with its own EALF, never two singles.',
      'r enters as a decimal; G is the total multiplier, not per-year.',
      'Check whether ADT is two-way (needs D) or already one-way per lane.',
    ],
  },

  hw6: {
    purpose:
      'Estimate water inflow, size the drainage layer, and verify filter criteria, checked against FHWA’s DRIP.',
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
        where: '<dl class="doc-equation__defs"><dt>first</dt><dd>piping criterion, fine enough to hold the soil</dd><dt>second</dt><dd>permeability criterion, coarse enough to drain</dd><dt>D&#8321;&#8325;, D&#8328;&#8325;</dt><dd>sizes at 15% and 85% passing</dd></dl>',
      },
    ],
    steps: [
      'Set up the geometry: drainage path length, slope, thickness.',
      'Solve by hand with the Ch. 8 equations and charts.',
      'Rebuild in DRIP and compare. Small gaps are chart-reading, large ones are setup errors.',
      'Check both filter criteria and state which governs.',
    ],
    pitfalls: [
      'Permeability units (ft/day vs. m/day vs. cm/s) cause most wrong answers.',
      'Use effective porosity, not total, for time-to-drain.',
      'The drainage path follows the resultant slope, not simply the lane width.',
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
        body: 'Solve for SN₁ (on the base), SN₂ (on the subbase), SN₃ (on the subgrade). D₁ covers SN₁; D₂ covers SN₂ − a₁D₁; and so on, rounding each thickness <em>up</em> before moving down.',
      },
    ],
    steps: [
      'Assemble inputs: W₁₈ (ESAL Calculator), R → Z_R, S₀, ΔPSI, moduli.',
      'Solve for required SN by nomograph; verify with the equation.',
      'Do the top-down layered analysis with a-coefficients and m-factors.',
      'Report rounded thicknesses and provided vs. required SN.',
    ],
    pitfalls: [
      'M_R goes in as psi; ksi silently shifts the log term.',
      'Drainage coefficients m never apply to the AC layer.',
      'Z_R is negative for R > 50% (−1.645 at 95%), and dropping the sign inflates the design.',
    ],
  },

  hw8: {
    purpose:
      'Close the mechanistic loop: compute layer strains, feed AASHTOWare transfer functions, and watch rutting and cracking grow with N.',
    concepts: [
      {
        kind: 'concept',
        title: 'AC sublayers and loading frequency',
        body: 'The stress pulse lengthens with depth, so deeper AC feels a lower frequency, and asphalt is softer at low frequency. Assign the given sublayer moduli in descending order from the surface (595 → 585 → 575 → 570 → 565 ksi).',
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
        body: 'The 90-day × 1,000-reps/day accumulation is a loop; the <a href="../../tools/damage/">Transfer-Function Damage</a> tool runs it in the browser from your WinJULEA strains. Plot rutting and cracking against N and describe the shape.',
      },
    ],
    steps: [
      'Part 1: follow the class mechanistic design procedure for the Sangamon County highway.',
      'Part 2a: WinJULEA with 5 AC sublayers (moduli ordered by frequency), base, subgrade; extract the required strains.',
      'Part 2b: accumulate damage over N, plot rutting and cracking growth. The Damage tool automates this.',
      'Part 2c: total the rutting and name the governing layer.',
    ],
    pitfalls: [
      'The rutting equations want strains at sublayer mid-depths, not interface values.',
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
        body: '<strong>Interior</strong>: max stress at the slab bottom. <strong>Edge</strong>: the critical highway case, roughly 50% higher. <strong>Corner</strong>: max stress on <em>top</em>, away from the corner, which is why corner cracks break downward. Know the tension fiber before plugging numbers. The <a href="../../tools/westergaard/">Westergaard tool</a> computes all three cases live.',
      },
      {
        kind: 'equation',
        title: 'Curling stress (Bradbury)',
        body: '$$\\sigma_{curl} = \\frac{C\\,E\\,\\alpha_t\\,\\Delta t}{2}$$',
        where: '<dl class="doc-equation__defs"><dt>C</dt><dd>Bradbury coefficient from L<sub>x</sub>/&ell;, L<sub>y</sub>/&ell; (edge form; interior combines both directions with &nu;)</dd><dt>&alpha;<sub>t</sub></dt><dd>thermal coefficient</dd><dt>&Delta;t</dt><dd>top–bottom temperature difference</dd></dl>',
      },
    ],
    steps: [
      'Compute ℓ first; everything consumes it.',
      'Identify each problem’s case (interior/edge/corner, day/night) and critical fiber.',
      'Evaluate the stresses, superposing load + curling when asked.',
      'Compare against the modulus of rupture to interpret.',
    ],
    pitfalls: [
      'Day curling puts the interior bottom in tension; night reverses it, so get the sign of Δt right.',
      'k is in pci; mixing units breaks ℓ.',
      'Corner max stress is on top of the slab; checking bottom tension there is the classic error.',
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
      'Part 2: build the stage-by-stage GHG table, timeline the rehabs from IRI. The <a href="../../tools/lca/">LCA Worksheet</a> automates the accounting.',
      'Close with the governing stage and one concrete mitigation.',
    ],
    pitfalls: [
      'Compare each runway against the matching ACR (type + category), not a single number.',
      'The use phase usually dwarfs everything, and forgetting it (or the second rehab) flips the conclusion.',
      'Keep the functional unit straight: per lane-mile over 20 years.',
    ],
  },
};
