import Equation from '../../ui/Equation';
import ChartLink from './ChartLink';

interface Lesson { title: string; figures: string[]; steps: string[] }
const TWO: Lesson[] = [
  { title: 'Example 2.5 · Design the thickness', figures: ['fig-2-15'], steps: [
    'Given a = 6 in, q = 80 psi and E₂ = 5,000 psi, the target stress ratio is 8/80 = 0.10.',
    'For E₁ = 500,000 psi, E₁/E₂ = 100. Read a/h₁ ≈ 1.15, giving h₁ = 6/1.15 ≈ 5.2 in.',
    'For a 25,000-psi granular layer, E₁/E₂ = 5. Read a/h₁ ≈ 0.40, giving h₁ ≈ 15 in. Equation 2.13 gives about 3.7 × 10⁵ repetitions at 8 psi.' ] },
  { title: 'Example 2.6 · Recover the upper-layer modulus', figures: ['fig-2-17'], steps: [
    'A 20,000-lb load on a rigid plate of radius 6 in gives q = P/(πa²) = 176.8 psi. With h₁ = 8 in, h₁/a = 1.333.',
    'Use the rigid-plate coefficient: F₂ = w₀E₂/(1.18qa) = (0.1 × 6,400)/(1.18 × 176.8 × 6) ≈ 0.511.',
    'Read E₁/E₂ ≈ 5, so E₁ ≈ 32,000 psi. The flexible-load coefficient 1.5 would give a different inverse result.' ] },
  { title: 'Example 2.7 · Add the two deflection contributions', figures: ['fig-2-19'], steps: [
    'E₁/E₂ = 10, h₁/a = 6/4.52 ≈ 1.33. Under one tire, the two distances are r/a = 0 and 13.5/4.52 ≈ 2.99.',
    'Read Fnear ≈ 0.56 and Ffar ≈ 0.28. Deflections add: w = (70 × 4.52/10,000)(0.56 + 0.28) = 0.0266 in ≈ 0.027 in.',
    'The book reports 0.0281 in from KENLAYER. The live group readout sums every wheel, while the single-wheel row identifies one contribution.' ] },
  { title: 'Example 2.8 · Full-depth tensile strain', figures: ['fig-2-21'], steps: [
    'Use a = 6.5 in, q = 67.7 psi, h₁ = 8 in, E₁ = 150,000 psi and E₂ = 15,000 psi. Thus E₁/E₂ = 10 and h₁/a ≈ 1.23.',
    'Read Fε ≈ 0.72. The tensile magnitude is qFε/E₁ = 67.7 × 0.72/150,000 = 3.25 × 10⁻⁴ (325 µε). The reported KENLAYER result is 336 µε.' ] },
  { title: 'Example 2.9 · Dual-wheel conversion', figures: ['fig-2-21', 'fig-2-23'], steps: [
    'For a = 4.6 in and Sd = 11.5 in, rescale to the chart spacing: a′ = 24a/Sd = 9.6 in and h₁′ = 24 × 8/11.5 = 16.7 in.',
    'Read C₁ = 1.35 at a′ = 3 in and C₂ = 1.46 at a′ = 8 in. The radius formula gives C = 1.35 + 0.2(9.6 − 3)(1.46 − 1.35) ≈ 1.50. This is an extrapolation beyond 8 in.',
    'At the actual h₁/a = 8/4.6, the single-wheel factor is about 0.47. Multiply by C: εt ≈ 67.7 × 0.47 × 1.50/150,000 = 3.18 × 10⁻⁴. KENLAYER gives 3.21 × 10⁻⁴.' ] },
  { title: 'Example 2.10 · Dual-tandem conversion', figures: ['fig-2-23', 'fig-2-27'], steps: [
    'Add an axle at St = 49 in. The modified spacing is St′ = 24 × 49/11.5 = 102.3 in.',
    'At St′ = 72 in, C₁ = 1.23 and C₂ = 1.30 give C ≈ 1.32. Interpolate toward the dual-wheel limit C = 1.50 at St′ = 120 in: C ≈ 1.32 + (102.3 − 72)(1.50 − 1.32)/48 = 1.43.',
    'Then εt ≈ 67.7 × 0.47 × 1.43/150,000 = 3.03 × 10⁻⁴. KENLAYER gives 3.05 × 10⁻⁴. The live calculation evaluates the actual spacing rather than interpolating between the two printed spacing charts.' ] },
  { title: 'Problem 2.3 · Plate tests to base thickness', figures: ['fig-2-17'], steps: [
    'First recover the subgrade modulus from the bare-subgrade rigid plate: E₂ = 1.18 × 10,600/(π × 6 × 0.2) ≈ 3,318 psi.',
    'Doubling the plate load at the same deflection after adding 10 in of base gives F₂ = 0.5 at h₁/a = 10/6. Read E₁/E₂ ≈ 4 (the numerical inversion gives 4.04), so E₁ is about 13,300 psi.',
    'For the flexible tire load, a = √(50,000/(100π)) = 12.62 in and the target F₂ = 0.2E₂/(1.5 × 100 × 12.62) ≈ 0.3505. At the recovered modulus ratio, read h₁/a ≈ 5.55, giving the printed thickness ≈ 70 in.' ] },
  { title: 'Problem 2.4 · Three responses from one section', figures: ['fig-2-15', 'fig-2-17', 'fig-2-19'], steps: [
    'For P = 10,000 lb and q = 80 psi, a = √(P/(πq)) = 6.31 in. E₁/E₂ = 20 and h₁/a = 8/6.31 ≈ 1.27.',
    'Read the surface factor F₂, interface factor F at r/a = 0, and stress ratio σc/q. Apply w₀ = 1.5qaF₂/E₂, w = qaF/E₂ and σc = q(σc/q).',
    'The printed chart answers are w₀ ≈ 0.025 in, w ≈ 0.024 in and σc ≈ 11 psi. Select the preset to compare with the numerical solution.' ] },
  { title: 'Problem 2.5 · Four wheel contributions', figures: ['fig-2-19', 'fig-2-21', 'fig-2-25', 'fig-2-26', 'fig-2-27'], steps: [
    'Each wheel carries 50,000 lb at 100 psi: a = 12.62 in. Use E₁/E₂ = 50, h₁ = 8 in, Sd = 28 in and St = 60 in.',
    'Under one wheel, evaluate deflections at r = 0, 28, 60 and √(28² + 60²) = 66.21 in, then add qaF/E₂ for all four distances.',
    'For strain, rotate and sum the wheel stresses before computing principal strains at the bottom of the asphalt. The printed answers at the wheel center are tensile strain 2.05 × 10⁻⁴ and interface deflection 0.057 in. The live wheel-center result is distinct from the chart estimate of the group maximum.' ] },
];
const THREE: Lesson[] = [
  { title: 'Example 2.11 · Jones factors to stresses and strains', figures: [], steps: [
    'For E = 400,000 / 20,000 / 10,000 psi, h₁ = h₂ = 6 in and a = 4.8 in: k₁ = 20, k₂ = 2, A = 0.8 and H = 1.',
    'Table 2.3 gives ZZ1 = 0.12173, ZZ2 = 0.05938, ZZ1 − RR1 = 1.97428 and ZZ2 − RR2 = 0.09268. Multiply by q = 120 psi: σz1 = 14.61 psi, σz2 = 7.12 psi, D₁ = 236.91 psi and D₂ = 11.12 psi.',
    'At the bottom of layer 1, σr = 14.61 − 236.91 = −222.3 psi, εz = 236.91/400,000 = 592 µε and εr = −296 µε.',
    'Across the first interface, divide D₁ by k₁: D = 11.85 psi and σr = 2.76 psi. Across the second, D₂/k₂ = 5.56 psi and σr = 1.56 psi. Radial strain remains continuous; subgrade εz = 556 µε.' ] },
  { title: 'Example 2.12 · Read Peattie and change the base', figures: ['fig-2-31'], steps: [
    'For k₁ = 20, k₂ = 2, A = 0.8 and H = 1, read a tensile factor about 1. Thus |εr| ≈ (120/400,000) × 1 = 300 µε, close to the table result of 296 µε.',
    'Increase h₂ from 6 to 8 in: A = 0.6 and H = 0.75. The chart factor stays near 1; KENLAYER gives 291 µε. The graph below varies h₂ with all other inputs fixed so both changing dimensionless groups are respected.' ] },
  { title: 'Problem 2.6 · Asphalt tension and subgrade compression', figures: ['fig-2-31'], steps: [
    'P = 40,000 lb and q = 150 psi give a = √(P/(πq)) = 9.21 in. With h₁ = 5.75 in and h₂ = 23 in: k₁ = 20, k₂ = 2, A ≈ 0.40 and H = 0.25.',
    'Obtain the bottom-asphalt deviator from Jones or the tensile factor from Peattie. Compute εr = −q(ZZ1 − RR1)/(2E₁). At the second interface use εz = q(ZZ2 − RR2)/E₂; dividing both the deviator and modulus by k₂ gives the same strain on the subgrade side.',
    'Printed answers: εr ≈ −7.25 × 10⁻⁴ and εz ≈ 1.06 × 10⁻³. Select the preset for the computed interface values.' ] },
  { title: 'Problem 2.7 · Equivalent modulus depends on the response', figures: ['fig-2-21', 'fig-2-31'], steps: [
    'Start with the two target strains from Problem 2.6. To preserve asphalt tension, retain the 5.75-in asphalt layer at 400,000 psi and vary the modulus of the combined base/subgrade half-space until εr matches the target.',
    'To preserve subgrade compression, retain E₂ = 10,000 psi and combine asphalt plus base into a 28.75-in upper layer. Vary its modulus until εz at the top of the subgrade matches the target.',
    'The printed equivalent moduli are approximately 20,000 psi for the first reduction and 35,000 psi for the second. These are different response-matching models; one equivalent modulus cannot be assumed to preserve every stress and strain.' ] },
];

export default function LayerLessons({ layers }: { layers: 2 | 3 }) {
  return <section className="cee-card cee-card__body">
    <h3 className="cee-card__title">Worked examples and problems · Huang §2.2</h3>
    <p className="cee-note">Reference solutions below use the book’s rounded chart readings in psi and inches.
      They stay fixed when you edit the calculator. Live results use numerical integration.</p>
    <Equation tex={'a = \\sqrt{\\frac{P}{\\pi q}}'} plain="a = √(P/(πq))" display />
    {(layers === 2 ? TWO : THREE).map(lesson => <details className="cee-howto" key={lesson.title}>
      <summary>{lesson.title}</summary>
      <div className="cee-howto__body">
        <ol>{lesson.steps.map(step => <li key={step}>{step}</li>)}</ol>
        {lesson.figures.length > 0 && <p>Open in Solutions by Chart: {lesson.figures.map((figure, i) =>
          <span key={figure}>{i > 0 && ' · '}<ChartLink figure={figure} /></span>)}.</p>}
      </div>
    </details>)}
  </section>;
}
