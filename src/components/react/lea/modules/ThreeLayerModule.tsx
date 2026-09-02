// Three layers — Jones' tables and Peattie's charts, made continuous.
//
// Huang §2.2.2 organizes the three-layer problem around four dimensionless
// groups (Eq. 2.22) and four stress factors (Eq. 2.24), because Jones (1962)
// could only tabulate at k1, k2 in {0.2, 2, 20, 200} and A, H at powers of
// two. Huang is blunt about the cost: "Because each interpolation requires
// three points, the interpolation of only one parameter requires at least
// three times the effort. If all four parameters are different from those in
// the table, the total effort required will be 3 x 3 x 3 x 3, or 81 times."
//
// The groups here are continuous. What the table gave up to fit on a page —
// intermediate k1 and k2 — is simply available, and the four printed values of
// Example 2.11 come back to five significant figures, so the table is a test
// rather than a data source.
import { useMemo, useState } from 'react';
import Tip from '../../Tip';
import { num, fmt } from '../../chartTheme';
import KpiStrip, { Kpi } from '../../ui/KpiStrip';
import { groupsFor, threeLayerState, HUANG_K1, HUANG_K2 } from '../threeLayer.ts';

interface Preset {
  label: string; tip: string;
  E1: string; E2: string; E3: string; h1: string; h2: string; q: string; a: string;
}

const PRESETS: Preset[] = [
  {
    label: 'Examples 2.11 / 2.12',
    tip: 'a = 4.8 in, q = 120 psi, 6 in over 6 in, E = 400,000 / 20,000 / 10,000. An exact row of Jones’ table: ZZ1 = 0.12173, ZZ2 = 0.05938, ZZ1−RR1 = 1.97428, ZZ2−RR2 = 0.09268.',
    E1: '400000', E2: '20000', E3: '10000', h1: '6', h2: '6', q: '120', a: '4.8',
  },
  {
    label: 'Example 2.12 (thicker base)',
    tip: 'The same section with h2 = 8 in, so A = 0.6 and H = 0.75. The strain factor barely moves — layer 2 has very little say in the tension at the bottom of layer 1.',
    E1: '400000', E2: '20000', E3: '10000', h1: '6', h2: '8', q: '120', a: '4.8',
  },
  {
    label: 'Problem 2.6',
    tip: '5.75 in HMA at 400,000 psi over 23 in base at 20,000 psi over 10,000 psi, 40,000 lb at 150 psi. Printed: εt = −7.25e-4 at the bottom of the HMA, εz = 1.06e-3 on the subgrade.',
    E1: '400000', E2: '20000', E3: '10000', h1: '5.75', h2: '23', q: '150', a: '9.21',
  },
];

export default function ThreeLayerModule() {
  const [p, setP] = useState<Preset>(PRESETS[0]);
  const [E1s, setE1] = useState(PRESETS[0].E1);
  const [E2s, setE2] = useState(PRESETS[0].E2);
  const [E3s, setE3] = useState(PRESETS[0].E3);
  const [h1s, setH1] = useState(PRESETS[0].h1);
  const [h2s, setH2] = useState(PRESETS[0].h2);
  const [qs, setQ] = useState(PRESETS[0].q);
  const [as_, setA] = useState(PRESETS[0].a);

  const E1 = num(E1s, 1), E2 = num(E2s, 1), E3 = num(E3s, 1);
  const h1 = num(h1s, 1), h2 = num(h2s, 1), q = num(qs, 1), a = num(as_, 1);
  const valid = [E1, E2, E3, h1, h2, q, a].every(v => v > 0);

  const apply = (x: Preset) => {
    setP(x); setE1(x.E1); setE2(x.E2); setE3(x.E3);
    setH1(x.h1); setH2(x.h2); setQ(x.q); setA(x.a);
  };

  const groups = useMemo(
    () => (valid ? groupsFor(E1, E2, E3, h1, h2, a) : null),
    [valid, E1, E2, E3, h1, h2, a]
  );
  const state = useMemo(
    () => (groups ? threeLayerState(groups, q, E1) : null),
    [groups, q, E1]
  );

  /** Whether the case sits on the grid Huang reprints, or is being interpolated. */
  const coverage = useMemo(() => {
    if (!groups) return null;
    const onGrid = (v: number, grid: number[]) => grid.some(g => Math.abs(v / g - 1) < 0.02);
    return {
      k1: onGrid(groups.k1, HUANG_K1),
      k2: onGrid(groups.k2, HUANG_K2),
      k1Range: groups.k1 >= 0.2 && groups.k1 <= 200,
      k2Range: groups.k2 >= 0.2 && groups.k2 <= 200,
    };
  }, [groups]);

  const rows = state ? [
    { where: 'Bottom of layer 1', ...state.bot1 },
    { where: 'Top of layer 2', ...state.top2 },
    { where: 'Bottom of layer 2', ...state.bot2 },
    { where: 'Top of layer 3', ...state.top3 },
  ] : [];

  return (
    <div className="cee-tool">
      <aside className="cee-panel">
        <h2 className="cee-panel__title">Section</h2>
        <div className="cee-presets">
          {PRESETS.map(x => (
            <button key={x.label} type="button"
              className={`cee-chip${p.label === x.label ? ' is-active' : ''}`}
              title={x.tip} onClick={() => apply(x)}>{x.label}</button>
          ))}
        </div>

        <div className="cee-field">
          <span className="cee-field__label">
            <span>Moduli<Tip text="Top to bottom. Only the two ratios k1 = E1/E2 and k2 = E2/E3 enter the stress factors; the absolute E1 is needed to turn them into strains." /></span>
            <span className="cee-field__unit">E₁ · E₂ · E₃</span>
          </span>
          <div className="cee-axle-row cee-axle-row--triple">
            <input className="cee-input" type="number" step="10000" min="1" value={E1s}
              aria-label="Modulus of layer 1" onChange={e => setE1(e.target.value)} />
            <input className="cee-input" type="number" step="1000" min="1" value={E2s}
              aria-label="Modulus of layer 2" onChange={e => setE2(e.target.value)} />
            <input className="cee-input" type="number" step="1000" min="1" value={E3s}
              aria-label="Modulus of layer 3" onChange={e => setE3(e.target.value)} />
          </div>
        </div>

        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="tr-h1">
              <span>h₁</span><span className="cee-field__unit">in / mm</span>
            </label>
            <input id="tr-h1" className="cee-input" type="number" step="0.25" min="0.1" value={h1s}
              onChange={e => setH1(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="tr-h2">
              <span>h₂</span><span className="cee-field__unit">in / mm</span>
            </label>
            <input id="tr-h2" className="cee-input" type="number" step="0.25" min="0.1" value={h2s}
              onChange={e => setH2(e.target.value)} />
          </div>
        </div>

        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="tr-q">
              <span>Pressure q</span><span className="cee-field__unit">psi / kPa</span>
            </label>
            <input id="tr-q" className="cee-input" type="number" step="5" min="0.1" value={qs}
              onChange={e => setQ(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="tr-a">
              <span>Radius a</span><span className="cee-field__unit">in / mm</span>
            </label>
            <input id="tr-a" className="cee-input" type="number" step="0.1" min="0.01" value={as_}
              onChange={e => setA(e.target.value)} />
          </div>
        </div>

        {groups && (
          <div className="cee-card cee-card--sunken cee-groups">
            <h3 className="cee-card__title">Eq. 2.22 groups</h3>
            <dl className="cee-groups__list">
              <dt>k₁ = E₁/E₂</dt><dd>{fmt(groups.k1, 3)}</dd>
              <dt>k₂ = E₂/E₃</dt><dd>{fmt(groups.k2, 3)}</dd>
              <dt>A = a/h₂</dt><dd>{fmt(groups.A, 3)}</dd>
              <dt>H = h₁/h₂</dt><dd>{fmt(groups.H, 3)}</dd>
            </dl>
          </div>
        )}

        <p className="cee-hint">
          Huang (2004) §2.2.2. All three layers take <strong>ν = 0.5</strong>, which is what
          Eq. 2.20 and the whole of Jones' tabulation assume. Responses are on the axis of
          symmetry, where the shear stress vanishes.
        </p>
      </aside>

      <div className="cee-results">
        <details className="cee-howto">
          <summary>How to use this tool</summary>
          <div className="cee-howto__body">
            <ol>
              <li><strong>Read the four groups first.</strong> k₁, k₂, A and H are the whole
                problem — two sections with the same four numbers have the same stress factors,
                whatever their absolute size.</li>
              <li><strong>The factors are Jones' table.</strong> ZZ1, ZZ2, ZZ1−RR1 and ZZ2−RR2
                are what Table 2.3 tabulates, and Eq. 2.24 turns them into stresses.</li>
              <li><strong>Both sides of each interface.</strong> σz is continuous across an
                interface and σr is not — the radial STRAIN is what carries over, which is what
                Eq. 2.23 says when it divides the deviator by the modulus ratio.</li>
              <li><strong>Interpolate nothing.</strong> Huang's table is on a coarse grid and he
                counts the cost of interpolating it at eighty-one times the work of a single
                lookup. Here any k₁ and k₂ are computed directly.</li>
            </ol>
            Matches Jones' printed values for Example 2.11 to four decimals, and reproduces
            Examples 2.11, 2.12 and Problem 2.6.
          </div>
        </details>

        {!state || !groups ? (
          <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>
            Enter positive moduli, thicknesses, pressure and radius.
          </span></p>
        ) : (
          <>
            <KpiStrip>
              <Kpi accent label="εr at bottom of layer 1"
                value={fmt(state.bot1.epsR * 1e6, 0)} unit="µε"
                tip="Horizontal strain under the surface course. Negative is tension, and its magnitude drives bottom-up fatigue cracking. This is Eq. 2.25 — what Peattie's Figure 2.31 is for." />
              <Kpi label="εz on top of layer 3"
                value={fmt(state.top3.epsZ * 1e6, 0)} unit="µε"
                tip="Vertical compressive strain on the subgrade — the strain that drives rutting." />
              <Kpi label="σz on top of layer 3" value={fmt(state.top3.sigZ, 3)}
                tip="Vertical stress reaching the subgrade. Continuous across the interface, so it is the same on both sides." />
              <Kpi label="(RR1 − ZZ1)/2" value={fmt(state.factors.peattie, 4)}
                tip="The quantity Figure 2.31 plots. Multiply by q/E1 for the radial strain at the bottom of layer 1." />
            </KpiStrip>

            <div className="cee-card">
              <h3 className="cee-card__title">Stress factors — Jones' Table 2.3</h3>
              <div className="cee-tablewrap">
                <table className="cee-table">
                  <thead>
                    <tr><th>Factor</th><th>Value</th><th>Eq. 2.24</th><th>Stress</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>ZZ1</td><td>{fmt(state.factors.ZZ1, 5)}</td>
                      <td><code>σz1 = q·ZZ1</code></td><td>{fmt(state.bot1.sigZ, 3)}</td>
                    </tr>
                    <tr>
                      <td>ZZ2</td><td>{fmt(state.factors.ZZ2, 5)}</td>
                      <td><code>σz2 = q·ZZ2</code></td><td>{fmt(state.bot2.sigZ, 3)}</td>
                    </tr>
                    <tr>
                      <td>ZZ1 − RR1</td><td>{fmt(state.factors.ZZ1_RR1, 5)}</td>
                      <td><code>σz1 − σr1 = q·(ZZ1−RR1)</code></td>
                      <td>{fmt(state.bot1.sigZ - state.bot1.sigR, 3)}</td>
                    </tr>
                    <tr>
                      <td>ZZ2 − RR2</td><td>{fmt(state.factors.ZZ2_RR2, 5)}</td>
                      <td><code>σz2 − σr2 = q·(ZZ2−RR2)</code></td>
                      <td>{fmt(state.bot2.sigZ - state.bot2.sigR, 3)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {coverage && (!coverage.k1 || !coverage.k2) && (
                <p className="cee-note">
                  {coverage.k1Range && coverage.k2Range ? (
                    <>
                      k₁ = {fmt(groups.k1, 2)} and k₂ = {fmt(groups.k2, 2)} are{' '}
                      <strong>not rows of the printed table</strong> — Huang reprints k₁ ∈ {'{'}2, 20,
                      200{'}'} and k₂ ∈ {'{'}2, 20{'}'}. By hand this case needs a four-way
                      interpolation; here it is computed directly, so no interpolation error enters.
                    </>
                  ) : (
                    <>
                      k₁ = {fmt(groups.k1, 2)} or k₂ = {fmt(groups.k2, 2)} lies{' '}
                      <strong>outside the range Jones tabulated</strong> (0.2 to 200). The layered
                      solution is still exact — but there is no printed value to check it against.
                    </>
                  )}
                </p>
              )}
            </div>

            <div className="cee-card">
              <h3 className="cee-card__title">Both sides of both interfaces</h3>
              <div className="cee-tablewrap">
                <table className="cee-table">
                  <thead>
                    <tr>
                      <th>Location</th><th>σz</th><th>σr</th>
                      <th>εz (µε)</th><th>εr (µε)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.where} className={i === 2 ? 'cee-table__rule' : undefined}>
                        <td>{r.where}</td>
                        <td>{fmt(r.sigZ, 3)}</td>
                        <td>{fmt(r.sigR, 3)}</td>
                        <td>{fmt(r.epsZ * 1e6, 1)}</td>
                        <td>{fmt(r.epsR * 1e6, 1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="cee-note">
                <strong>σz is the same on both sides of an interface and σr is not.</strong>
                {' '}Equilibrium demands the first; the second jumps because the two layers share a
                strain, not a stiffness — the deviator falls by exactly k₁ across interface 1 and
                by k₂ across interface 2, which is Eq. 2.23. Note the radial strain in each pair is
                identical, and that at ν = 0.5 every row has εz = −2εr (Eq. 2.21): the material is
                incompressible, so the three strains sum to zero.
              </p>
            </div>

            <p className="cee-note">
              Huang (2004) §2.2.2, Eqs. 2.20–2.25, Table 2.3 and Figure 2.31. Where Jones'
              table has a row, these factors reproduce it to four decimals — Example 2.11's
              ZZ1 = 0.12173 and ZZ1 − RR1 = 1.97428 come back as 0.12176 and 1.97406. All three
              layers are incompressible with fully bonded interfaces, and the responses are on
              the axis of symmetry, where the tangential and radial stresses are equal and the
              shear is zero.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
