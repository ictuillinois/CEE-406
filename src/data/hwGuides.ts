// Guided-learning content for each homework: purpose, the concepts and
// equations a student needs, a suggested approach, and common pitfalls.
// Bodies are HTML and may contain KaTeX ($...$ inline, $$...$$ display);
// they render inside sections marked data-katex.

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
      'Build the vocabulary and the mental model everything else rests on: what each layer of a pavement does, how flexible and rigid structures carry load differently, and how pavements actually fail in the field.',
    concepts: [
      {
        kind: 'concept',
        title: 'Flexible vs. rigid load spreading',
        body: 'A flexible pavement spreads the wheel load through the layer stack in a narrowing cone of stress — so the quality of <em>every</em> layer matters, and stresses at the subgrade stay high enough that layer thicknesses control performance. A rigid slab spreads load by bending over a large area: slab flexural strength dominates and the subgrade sees very low stress.',
      },
      {
        kind: 'concept',
        title: 'Mechanistic–empirical design',
        body: 'The <strong>mechanistic</strong> part computes pavement responses (stresses, strains, deflections) from mechanics. The <strong>empirical</strong> part links those responses to observed performance (distress vs. load repetitions) through calibrated transfer functions. A fully mechanistic method would need physics for every distress and material — beyond current capability, which is why calibration never disappears.',
      },
      {
        kind: 'equation',
        title: 'Tire contact — pressure and area',
        body: '$$A_c = \\frac{P}{p} \\qquad p \\approx p_{tire}$$',
        where: '<dl class="doc-equation__defs"><dt>A_c</dt><dd>contact area</dd><dt>P</dt><dd>wheel load</dd><dt>p</dt><dd>contact pressure, close to tire inflation pressure for highway tires</dd></dl>',
      },
      {
        kind: 'concept',
        title: 'Distress mechanisms to know',
        body: '<strong>Pumping</strong>: free water under a slab ejects fines through joints under repeated loading, eroding support until corners crack. <strong>Rutting</strong> comes in two kinds — instability rutting (shear flow within the AC layer) and structural rutting (densification/deformation of base and subgrade) — and each is controlled by different design decisions.',
      },
    ],
    steps: [
      'Read Huang Ch. 1 and skim the Distress Identification Manual to see real photos of each failure mode.',
      'Draw both cross-sections in PowerPoint with labeled layers and typical thickness ranges (e.g., AC surface 25–100 mm, base 100–300 mm; PCC slab 200–300 mm).',
      'Answer the conceptual questions by explaining the mechanism, not by quoting definitions — the grading rewards cause-and-effect reasoning.',
      'For the axle-configuration question, think about how stress bulbs from adjacent axles overlap at depth.',
    ],
    pitfalls: [
      'Tack coat vs. prime coat: a tack coat is a light emulsion bonding two asphalt lifts; a prime coat penetrates and seals a granular base before the first lift. The prime coat needs the less viscous binder.',
      'Rutting is not only a subgrade problem — high-temperature instability rutting happens entirely inside the AC layer.',
      '“Least damage per axle” and “least damage per ton carried” are different questions; be explicit about which one you answer.',
    ],
  },

  hw2: {
    purpose:
      'Characterize the foundation. Fit the generalized resilient modulus model to real triaxial data, reduce a CBR test the way the standard requires, and understand what lime actually does to a weak subgrade.',
    concepts: [
      {
        kind: 'equation',
        title: 'Generalized resilient modulus model (MEPDG form)',
        body: '$$M_r = k_1\\, p_a \\left(\\frac{\\theta}{p_a}\\right)^{k_2} \\left(\\frac{\\tau_{oct}}{p_a} + 1\\right)^{k_3}$$',
        where: '<dl class="doc-equation__defs"><dt>&theta;</dt><dd>bulk stress = &sigma;&#8321; + &sigma;&#8322; + &sigma;&#8323; (in a triaxial test: &sigma;<sub>d</sub> + 3&sigma;&#8323;)</dd><dt>&tau;<sub>oct</sub></dt><dd>octahedral shear stress (in a triaxial test: &radic;2&thinsp;&sigma;<sub>d</sub>/3)</dd><dt>p_a</dt><dd>atmospheric pressure, 101.325 kPa (14.7 psi)</dd><dt>k&#8321;, k&#8322;, k&#8323;</dt><dd>regression constants (k&#8322; &ge; 0 hardening with bulk stress; k&#8323; &le; 0 softening with shear)</dd></dl>',
      },
      {
        kind: 'concept',
        title: 'Linearize, then regress',
        body: 'Take log&#8321;&#8320; of both sides and the model becomes linear in log(k&#8321;), k&#8322;, and k&#8323; — a two-variable multiple linear regression. Excel <code>LINEST</code>, Python, or a short Colab notebook all work; this is the calculation the upcoming <em>Resilient Modulus Fitter</em> tool will do online. Report R² and say whether it is computed in log space or on back-transformed M<sub>r</sub>.',
      },
      {
        kind: 'equation',
        title: 'CBR definition',
        body: '$$CBR = \\frac{p_{test}}{p_{standard}} \\times 100\\%$$',
        where: '<dl class="doc-equation__defs"><dt>at 0.1 in</dt><dd>standard stone pressure = 1000 psi</dd><dt>at 0.2 in</dt><dd>standard stone pressure = 1500 psi</dd><dt>rule</dt><dd>report the 0.1-in value unless the 0.2-in value is greater (confirmed on recheck), and correct the penetration origin if the curve starts concave-up</dd></dl>',
      },
      {
        kind: 'concept',
        title: 'What lime does to soil',
        body: '<strong>Immediately</strong>: cation exchange and flocculation drop plasticity and improve workability. <strong>Over weeks to months</strong>: pozzolanic reactions (lime + soil silica/alumina) cement particles and build strength. Best suited to clayey soils (PI &gt; 10); quicklime, hydrated lime, and slurry differ mainly in handling and water demand.',
      },
    ],
    steps: [
      'For each test row compute σ₁ = σd + σ₃, then θ and τ_oct, then Mr = σd/εr.',
      'Log-transform and run the regression to get k₁, k₂, k₃; compute R².',
      'Plot measured vs. predicted Mr to show the quality of the fit.',
      'For the CBR problem, plot pressure vs. penetration, correct the origin if needed, evaluate both penetrations, and apply the 0.1-in/0.2-in rule.',
    ],
    pitfalls: [
      'Unit consistency: the data are in kPa — use p_a = 101.325 kPa, not 14.7 psi, or your k₁ will be off by orders of magnitude.',
      'The “+1” inside the τ_oct term is what keeps the model defined at zero shear stress — do not drop it.',
      'Mr is deviator stress over recoverable (resilient) strain — total strain gives the wrong modulus.',
    ],
  },

  hw3: {
    purpose:
      'The analytical core of flexible pavement mechanics: compute stresses and deflections in one-, two-, and three-layer elastic systems by hand, using the classic Boussinesq solutions, Burmister charts, and Jones–Peattie tables.',
    concepts: [
      {
        kind: 'equation',
        title: 'One-layer system — vertical stress on the axis (Boussinesq)',
        body: '$$\\sigma_z = p\\left[1 - \\frac{z^3}{(a^2+z^2)^{3/2}}\\right] \\qquad w_0 = \\frac{2(1-\\nu^2)\\,p\\,a}{E}$$',
        where: '<dl class="doc-equation__defs"><dt>p, a</dt><dd>contact pressure and radius of the flexible circular load</dd><dt>z</dt><dd>depth below the surface, under the load center</dd><dt>w&#8320;</dt><dd>surface deflection at the center (flexible plate; a rigid plate gives &pi;/2 &times; p a (1&minus;&nu;&sup2;)/E &asymp; 79% of it... use the chart consistent with the problem)</dd></dl>',
      },
      {
        kind: 'equation',
        title: 'Two-layer deflection (Burmister)',
        body: '$$w_0 = \\frac{1.5\\,p\\,a}{E_2}\\,F_2$$',
        where: '<dl class="doc-equation__defs"><dt>F&#8322;</dt><dd>deflection factor from the two-layer chart, entered with E&#8321;/E&#8322; and h&#8321;/a</dd><dt>E&#8322;</dt><dd>modulus of the lower layer (subgrade)</dd></dl>',
      },
      {
        kind: 'concept',
        title: 'Three-layer systems (Jones tables, Peattie charts)',
        body: 'Normalize the geometry and stiffness: k₁ = E₁/E₂, k₂ = E₂/E₃, A = a/h₂, H = h₁/h₂. The tables give stress factors (ZZ1, ZZ2, ZZ1−RR1, …) at the layer interfaces; interpolate between tabulated k and A values, then scale by p to get stresses and compute strains from the interface stress pairs.',
      },
      {
        kind: 'concept',
        title: 'Check yourself online',
        body: 'The <a href="../../tools/stress-explorer/">Stress Explorer</a> computes the full one-layer response live — use it to verify every Boussinesq number before you move to the two- and three-layer charts (this replaces the Google Colab notebook used in past semesters).',
      },
    ],
    steps: [
      'Identify what each problem gives you and normalize: z/a, h₁/a, and modulus ratios.',
      'Pick the right chart or table for the system (one, two, or three layers) and read/interpolate the factor.',
      'Convert factors back to physical stresses and deflections; carry units through explicitly.',
      'Verify the one-layer answers with the Stress Explorer and note any interpolation error.',
    ],
    pitfalls: [
      'Flexible vs. rigid plate deflection formulas differ — check which one the problem (and chart) assumes.',
      'Most charts are log-log; interpolate on the log scale, not linearly.',
      'Compression is positive throughout Huang — state your sign convention and stick to it.',
    ],
  },

  hw4: {
    purpose:
      'From charts to software. Analyze a real four-layer structure with a layered-elastic program, extract the full depth profile of stresses, strains, and deflection, and learn to read a pavement response like an engineer.',
    concepts: [
      {
        kind: 'concept',
        title: 'Layered elastic analysis — the assumptions you accept',
        body: 'Each layer is homogeneous, isotropic, linear elastic (E, ν), horizontally infinite, with full bond at interfaces (this assignment) and a circular uniform load. Every result you get is only as good as these assumptions — that is why observations, not just numbers, are graded.',
      },
      {
        kind: 'concept',
        title: 'The critical responses of flexible design',
        body: 'Three numbers summarize the run: <strong>tensile strain at the bottom of the AC</strong> (drives fatigue cracking), <strong>compressive strain at the top of the subgrade</strong> (drives structural rutting), and <strong>surface deflection</strong> (overall structural response). Find them in your profiles and point at them in your observations.',
      },
      {
        kind: 'concept',
        title: 'What the profiles should show',
        body: 'σz decays smoothly with depth and is continuous across interfaces; horizontal stress <em>jumps</em> at interfaces (equilibrium only forces the vertical component to match); the AC bottom goes into horizontal tension; deflection accumulates mostly in the soft lower layers. If your plots disagree, check the run before writing observations.',
      },
    ],
    steps: [
      'Enter the four layers (E = 3200/200/100/42 MPa, ν = 0.35/0.3/0.3/0.4, h = 100/150/150 mm) and the 720 kPa, 145 mm load in WinJULEA.',
      'Place evaluation points under the load center: at the surface, 1 mm above and below each interface, and several points inside each layer.',
      'Export the results and plot σz, εz, σr, εr, and w versus depth (depth increasing downward).',
      'Write at least four observations tied to mechanics, and state the sign convention of your program.',
      'Cross-check the trend against the one-layer Stress Explorer solution to see what the stiff AC layer changes.',
    ],
    pitfalls: [
      'WinJULEA is unit-agnostic — enter everything in one consistent system (kPa and mm work well) or the output is garbage.',
      'Evaluating exactly at an interface is ambiguous for horizontal stress; offset ±1 mm to capture the jump.',
      'Fully bonded vs. frictionless interfaces change the AC bottom strain dramatically — this assignment says bonded.',
    ],
  },

  hw5: {
    purpose:
      'Turn a mixed traffic stream into the single number thickness design needs: equivalent single axle loads. Load equivalency, truck factors, growth, and lane distribution all live here.',
    concepts: [
      {
        kind: 'equation',
        title: 'Load equivalency — the fourth-power rule of thumb',
        body: '$$EALF \\approx \\left(\\frac{L_x}{18\\,\\text{kip}}\\right)^4$$',
        where: '<dl class="doc-equation__defs"><dt>L<sub>x</sub></dt><dd>single-axle load in kip</dd><dt>exact values</dt><dd>come from the AASHTO design equation (tables D.4–D.9) and depend on SN and p<sub>t</sub> — the <a href="../../tools/esal-calculator/">ESAL Calculator</a> computes them exactly</dd></dl>',
      },
      {
        kind: 'equation',
        title: 'Design traffic',
        body: '$$ESAL = \\sum_i F_i\\, n_i \\qquad G = \\frac{(1+r)^n - 1}{r}$$',
        where: '<dl class="doc-equation__defs"><dt>F<sub>i</sub>, n<sub>i</sub></dt><dd>EALF and number of passes of axle group i</dd><dt>G</dt><dd>growth factor over n years at rate r (total, applied to first-year traffic)</dd><dt>D, L</dt><dd>directional and lane distribution factors applied to two-way traffic</dd></dl>',
      },
      {
        kind: 'concept',
        title: 'Truck factor',
        body: 'The truck factor T<sub>f</sub> is the average ESALs contributed by one truck of a given class — the bridge between classified traffic counts and axle-load spectra. Problems give you either axle data (build T<sub>f</sub>) or T<sub>f</sub> directly (use it).',
      },
    ],
    steps: [
      'Classify what each problem gives: axle loads, truck volumes, or both.',
      'Get EALFs (fourth power for quick checks, AASHTO values for the real answer — the ESAL Calculator gives both).',
      'Multiply, sum, then apply growth, directional, and lane factors in the right order.',
      'Sanity-check magnitudes: a busy interstate accumulates 10⁶–10⁷ ESALs over 20 years.',
    ],
    pitfalls: [
      'A tandem axle is one axle group with its own EALF — never treat it as two independent single axles.',
      'Growth rate r enters as a decimal; and G above is the total multiplier for n years, not a per-year factor.',
      'Watch whether ADT is two-way (needs D) or one-way per lane (does not).',
    ],
  },

  hw6: {
    purpose:
      'Water is the enemy. Estimate how much gets in, size the permeable layer that carries it out, and verify the filter that keeps fines from clogging the path — checked against FHWA’s DRIP.',
    concepts: [
      {
        kind: 'concept',
        title: 'The drainage chain',
        body: 'Design follows the water: <strong>inflow</strong> (surface infiltration through cracks and joints, plus groundwater) → <strong>drainage layer</strong> (permeable base with enough capacity and slope) → <strong>collector</strong> (edge drain and outlet). Each Chapter 8 problem exercises one link of this chain.',
      },
      {
        kind: 'concept',
        title: 'Time-to-drain',
        body: 'Instead of steady flow, many designs are judged by how fast the base drains after a storm: the degree of drainage U is a function of the time factor (which bundles permeability k, effective porosity n<sub>e</sub>, slope, and drainage path length). “Good” drainage typically means 50% drained within hours, not days — and n<sub>e</sub> (water that can actually drain), not total porosity, is what belongs in the calculation.',
      },
      {
        kind: 'equation',
        title: 'Granular filter criteria',
        body: '$$D_{15}^{filter} \\le 5\\,D_{85}^{soil} \\qquad D_{15}^{filter} \\ge 5\\,D_{15}^{soil}$$',
        where: '<dl class="doc-equation__defs"><dt>first</dt><dd>clogging/piping criterion — filter fine enough to hold the soil</dd><dt>second</dt><dd>permeability criterion — filter coarse enough to drain freely</dd><dt>D&#8321;&#8325;, D&#8328;&#8325;</dt><dd>particle sizes at 15% and 85% passing</dd></dl>',
      },
    ],
    steps: [
      'Set up each problem’s geometry: drainage path length, slope, layer thickness.',
      'Solve by hand with the Chapter 8 equations and charts.',
      'Rebuild the same problem in DRIP and compare — small differences are chart-reading; large ones are setup errors.',
      'For the filter problem, check both criteria and state which governs.',
    ],
    pitfalls: [
      'Permeability units (ft/day vs. m/day vs. cm/s) cause most wrong answers in this set.',
      'Use effective porosity for time-to-drain, not total porosity.',
      'The drainage path is the resultant of longitudinal and cross slopes — not simply the lane width.',
    ],
  },

  hw7: {
    purpose:
      'Run the AASHTO 1993 flexible design procedure end to end: reliability, serviceability loss, the design equation for the structural number, and the layered analysis that converts SN into thicknesses.',
    concepts: [
      {
        kind: 'equation',
        title: 'AASHTO 1993 flexible design equation',
        body: '$$\\log_{10}W_{18} = Z_R S_0 + 9.36\\log_{10}(SN{+}1) - 0.20 + \\frac{\\log_{10}\\left(\\frac{\\Delta PSI}{4.2-1.5}\\right)}{0.40 + \\frac{1094}{(SN+1)^{5.19}}} + 2.32\\log_{10}M_R - 8.07$$',
        where: '<dl class="doc-equation__defs"><dt>W&#8321;&#8328;</dt><dd>design ESALs</dd><dt>Z<sub>R</sub>, S&#8320;</dt><dd>standard normal deviate for reliability R, overall standard deviation (&asymp;0.45 flexible)</dd><dt>&Delta;PSI</dt><dd>p&#8320; &minus; p<sub>t</sub> serviceability loss</dd><dt>M<sub>R</sub></dt><dd>subgrade resilient modulus in <strong>psi</strong></dd></dl>',
      },
      {
        kind: 'equation',
        title: 'Layered structural number',
        body: '$$SN = a_1 D_1 + a_2 D_2 m_2 + a_3 D_3 m_3$$',
        where: '<dl class="doc-equation__defs"><dt>a<sub>i</sub></dt><dd>layer coefficients (per inch): AC &asymp; 0.44, granular base &asymp; 0.14, subbase &asymp; 0.11 — from charts vs. modulus</dd><dt>m<sub>i</sub></dt><dd>drainage coefficients, granular layers only</dd><dt>D<sub>i</sub></dt><dd>thicknesses in inches</dd></dl>',
      },
      {
        kind: 'concept',
        title: 'Design from the top down',
        body: 'Solve the design equation three times: SN₁ on top of the base (using E_base), SN₂ on top of the subbase, SN₃ on the subgrade. D₁ covers SN₁; D₂ covers SN₂ − a₁D₁; and so on. Round each thickness <em>up</em> to constructible increments before moving down.',
      },
    ],
    steps: [
      'Assemble inputs: W₁₈ (use the ESAL Calculator), R → Z_R, S₀, Δ PSI, and moduli.',
      'Solve for the required SN with the nomograph (and verify with the equation — they should agree within reading error).',
      'Do the top-down layered analysis with the a-coefficients and drainage factors.',
      'Report rounded thicknesses and the final provided SN vs. required SN.',
    ],
    pitfalls: [
      'M_R goes in as psi; entering ksi silently shifts the log term.',
      'Drainage coefficients m apply only to unbound layers — never to the AC.',
      'Z_R is negative for R > 50% (e.g., −1.645 at 95%) — dropping the sign inflates the design.',
    ],
  },

  hw8: {
    purpose:
      'Close the mechanistic loop: design a section, compute layer strains with WinJULEA, feed them through AASHTOWare-style transfer functions, and watch rutting and cracking grow with every load repetition.',
    concepts: [
      {
        kind: 'concept',
        title: 'AC sublayers and loading frequency',
        body: 'The stress pulse from a moving wheel lengthens with depth, so deeper AC feels a <em>lower</em> loading frequency — and asphalt is softer at low frequency. At constant temperature, assign the given sublayer moduli in descending order from the surface down (595 → 585 → 575 → 570 → 565 ksi).',
      },
      {
        kind: 'equation',
        title: 'AC rutting transfer function (assignment form)',
        body: '$$Rut_{AC} = \\varepsilon_v\\, h_{AC}\\, \\cdot 3.5\\times10^{-3.4488}\\, T^{1.5606}\\, N^{0.479244}$$',
        where: '<dl class="doc-equation__defs"><dt>&epsilon;<sub>v</sub></dt><dd>vertical strain at mid-depth of the sublayer</dd><dt>T</dt><dd>AC temperature (71&deg;F here)</dd><dt>N</dt><dd>load repetitions</dd></dl>',
      },
      {
        kind: 'equation',
        title: 'Fatigue life and Miner’s damage',
        body: '$$N_f = 0.003612\\,C_H\\,\\varepsilon_t^{-3.9492}\\,E_{AC}^{-1.281} \\qquad DI = \\sum \\frac{n}{N_f}$$',
        where: '<dl class="doc-equation__defs"><dt>&epsilon;<sub>t</sub></dt><dd>tensile strain at the bottom of the AC</dd><dt>E<sub>AC</sub></dt><dd>AC modulus in psi (assignment: use the lowest sublayer modulus)</dd><dt>C<sub>H</sub></dt><dd>thickness correction from h<sub>HMA</sub></dd><dt>DI</dt><dd>cumulative damage; the FC<sub>bottom</sub> sigmoid converts DI to % cracked area</dd></dl>',
      },
      {
        kind: 'concept',
        title: 'Where the code goes',
        body: 'The damage accumulation (90 days × 1,000 reps/day, evaluated day by day) is a loop — past semesters ran it in a Google Colab notebook, and the in-development <em>Transfer-Function Damage</em> tool will run it here in the browser. Whatever you use, plot rutting and cracking against N and describe the shape.',
      },
    ],
    steps: [
      'Part 1: follow the mechanistic design procedure from class for the Sangamon County highway (traffic → design table → section).',
      'Part 2a: build the WinJULEA model with 5 AC sublayers (moduli ordered by frequency), base, and subgrade; extract strains at every required depth.',
      'Part 2b: accumulate N day by day, evaluate the rutting equations per layer and the fatigue DI, and plot both distresses vs. repetitions.',
      'Part 2c: total the rutting and identify the governing layer.',
    ],
    pitfalls: [
      'The rutting equations want strain magnitudes at sublayer mid-depths — not interface values.',
      'Use the lowest sublayer modulus in N_f exactly as the assignment states, even though it feels unphysical.',
      'N grows daily; recomputing damage with total N at the end ≠ summing daily increments only if you mix the two approaches — pick one and be consistent.',
    ],
  },

  hw9: {
    purpose:
      'Switch to concrete: slab curling from temperature gradients, Westergaard’s three loading cases, and the stress checks behind rigid pavement design.',
    concepts: [
      {
        kind: 'equation',
        title: 'Radius of relative stiffness',
        body: '$$\\ell = \\left[\\frac{E h^3}{12\\,(1-\\nu^2)\\,k}\\right]^{1/4}$$',
        where: '<dl class="doc-equation__defs"><dt>E, h, &nu;</dt><dd>slab modulus, thickness, Poisson ratio</dd><dt>k</dt><dd>modulus of subgrade reaction (pci)</dd><dt>&ell;</dt><dd>the length scale every Westergaard solution is written in</dd></dl>',
      },
      {
        kind: 'concept',
        title: 'Westergaard’s three cases',
        body: '<strong>Interior</strong>: max bending stress at the slab bottom under the load. <strong>Edge</strong>: the critical highway case — bottom tension roughly 50% higher than interior. <strong>Corner</strong>: max stress on the <em>top</em> of the slab, some distance from the corner — which is why corner cracks break downward. Know which fibre is in tension for each case before plugging numbers.',
      },
      {
        kind: 'equation',
        title: 'Curling stress (Bradbury)',
        body: '$$\\sigma_{curl} = \\frac{C\\,E\\,\\alpha_t\\,\\Delta t}{2}$$',
        where: '<dl class="doc-equation__defs"><dt>C</dt><dd>Bradbury coefficient from L<sub>x</sub>/&ell; and L<sub>y</sub>/&ell; (edge form shown; interior adds the two-direction &nu; combination)</dd><dt>&alpha;<sub>t</sub></dt><dd>concrete thermal coefficient</dd><dt>&Delta;t</dt><dd>top–bottom temperature difference</dd></dl>',
      },
    ],
    steps: [
      'Compute ℓ first — every subsequent equation consumes it.',
      'For each problem identify the case (interior/edge/corner, day/night curling) and the critical fibre.',
      'Evaluate the stress equations, superposing load and curling stresses when the problem asks.',
      'Compare against the concrete modulus of rupture to interpret the result.',
    ],
    pitfalls: [
      'Day curling (top hot) puts the slab bottom in tension at the interior — night reverses it; get the sign of Δt right.',
      'k is in pci (lb/in³); mixing it with psi/in² breaks ℓ.',
      'Corner-case maximum stress is on top of the slab — checking bottom tension there is the classic error.',
    ],
  },

  hw10: {
    purpose:
      'Two capstones that widen the lens: airfield pavements rated by the ICAO ACR/PCR system and designed with FAARFIELD, and a full life-cycle assessment that asks where a pavement’s carbon actually comes from.',
    concepts: [
      {
        kind: 'concept',
        title: 'Reading a PCR code',
        body: 'A rating like <code>650/F/C/Y/T</code> reads: PCR value 650, <strong>F</strong>lexible (R = rigid) pavement, subgrade category <strong>C</strong> (A strongest → D weakest), tire-pressure limit code <strong>Y</strong>, rated by <strong>T</strong>echnical evaluation (U = usage). An aircraft can operate when its ACR — computed for that pavement type and subgrade category — does not exceed the PCR, and its tire pressure respects the letter limit.',
      },
      {
        kind: 'concept',
        title: 'FAARFIELD in one paragraph',
        body: 'FAA’s layered design program accumulates a cumulative damage factor (CDF) over the full traffic mix and grows the layer being designed until CDF = 1 at the design life. For this assignment you design the subbase for a B747-400 at 4,000 annual departures, twice: CBR 5 subgrade vs. CBR 7 stabilized — then compare the subbase savings against the stated cost equivalence (15 in of subbase).',
      },
      {
        kind: 'equation',
        title: 'Life-cycle GHG accounting',
        body: '$$GHG_{total} = \\sum_{stages} GHG = Materials + Transport + Construction + Use + M\\&R + EOL$$',
        where: '<dl class="doc-equation__defs"><dt>Use phase</dt><dd>vehicles &times; miles &times; fuel/mile &times; 9 kg CO&#8322;e/gal over 20 years</dd><dt>M&amp;R</dt><dd>IRI grows 12.2 in/mi/yr from 60; rehab at 170 &rarr; every &asymp;9 years &rarr; rehabs in years 9 and 18 of the analysis period</dd><dt>EOL</dt><dd>disposal at end of life</dd></dl>',
      },
    ],
    steps: [
      'Part 1a: interpolate the ACR tables for each runway’s subgrade category and compare ACR vs. PCR (and tire pressure vs. the letter code).',
      'Part 1b: run FAARFIELD for both subgrade options, screenshot inputs and results, and make the stabilization decision quantitatively.',
      'Part 2: build a stage-by-stage GHG table from the inventory, timeline the rehabs from the IRI history, and total the 20-year emissions.',
      'Close with the governing stage and one concrete mitigation for it.',
    ],
    pitfalls: [
      'ACR depends on pavement type and subgrade category — compare each runway against the matching ACR, not a single number.',
      'In the LCA, the use phase usually dwarfs everything; forgetting it (or the second rehab) changes the conclusion entirely.',
      'Keep the functional unit straight: everything is per lane-mile over the 20-year analysis period.',
    ],
  },
};
