// One layer — the homogeneous half-space of Huang §2.1.
//
// Boussinesq's solution is where the chapter starts, and it is still the right
// model whenever the modulus ratio is near unity: "the theory can be used to
// determine the stresses, strains, and deflections in the subgrade if the
// modulus ratio between the pavement and the subgrade is close to unity."
//
// What this module adds over the closed forms in the book is the OFF-AXIS
// state. Huang prints equations for the axis of symmetry (Eqs. 2.2-2.6) and
// charts for everywhere else, because there is no elementary closed form off
// it. oneLayer.ts computes it exactly, so the full stress tensor, its
// principal values, and the strains that follow are available at any point —
// including under the edge of the load, which is what Problem 2.1 asks for.
import { useEffect, useMemo, useRef, useState } from 'react';
import Tip from '../../Tip';
import {
  useTheme, chartColors, baseLayout, plotConfig, num, fmt,
  axis, gridAxis, hueFor, areaFill, withAlpha, hoverLabel,
} from '../../chartTheme';
import ChartFigure from '../../ui/ChartFigure';
import KpiStrip, { Kpi } from '../../ui/KpiStrip';
import {
  oneLayerResponse, principalAt, strainsAt, superposeOneLayer,
  rigidPlateDeflection, rigidPlatePressure,
} from '../oneLayer.ts';

interface Preset {
  label: string;
  tip: string;
  q: string; a: string; E: string; nu: string;
  r: string; z: string;
  twin: boolean; spacing: string;
}

const PRESETS: Preset[] = [
  {
    label: 'Example 2.1 (two circles)',
    tip: 'Two 10-in circles at 50 psi, 20 in apart, E = 10,000 psi, ν = 0.5. Point A is 10 in under one center. Printed: σz = 14.38 psi, εz = 0.00129, w = 0.022 in.',
    q: '50', a: '5', E: '10000', nu: '0.5', r: '0', z: '10', twin: true, spacing: '20',
  },
  {
    label: 'Example 2.2 (ν = 0.3)',
    tip: 'The same left circle alone at ν = 0.3. Printed: σz = 14.2 psi, σr = −0.25 psi (TENSION), εz = 0.00144, w = 0.0176 in. Compare with ν = 0.5, where σr is +0.8 psi.',
    q: '50', a: '5', E: '10000', nu: '0.3', r: '0', z: '10', twin: false, spacing: '20',
  },
  {
    label: 'Problem 2.1 (under the edge)',
    tip: 'r = a, z = 2a, ν = 0.5 — the off-axis principal state. Huang prints σ = 0.221q, 0.011q, 0.004q and w = 0.58qa/E from Ahlvin and Ulery’s tables; computed exactly they are 0.228, 0.0108, 0.0092 and 0.572.',
    q: '100', a: '1', E: '1000', nu: '0.5', r: '1', z: '2', twin: false, spacing: '20',
  },
];

export default function OneLayerModule() {
  const [p, setP] = useState<Preset>(PRESETS[0]);
  const [qStr, setQ] = useState(PRESETS[0].q);
  const [aStr, setA] = useState(PRESETS[0].a);
  const [EStr, setE] = useState(PRESETS[0].E);
  const [nuStr, setNu] = useState(PRESETS[0].nu);
  const [rStr, setR] = useState(PRESETS[0].r);
  const [zStr, setZ] = useState(PRESETS[0].z);
  const [twin, setTwin] = useState(PRESETS[0].twin);
  const [spStr, setSp] = useState(PRESETS[0].spacing);
  const [plate, setPlate] = useState<'flexible' | 'rigid'>('flexible');

  const q = num(qStr, 50), a = num(aStr, 5), E = num(EStr, 10000);
  const nu = Math.min(0.499, Math.max(0, num(nuStr, 0.5)));
  const r = Math.max(0, num(rStr, 0)), z = Math.max(0, num(zStr, 0));
  const spacing = num(spStr, 20);
  const valid = q !== 0 && a > 0 && E > 0;

  const apply = (preset: Preset) => {
    setP(preset);
    setQ(preset.q); setA(preset.a); setE(preset.E); setNu(preset.nu);
    setR(preset.r); setZ(preset.z); setTwin(preset.twin); setSp(preset.spacing);
    setPlate('flexible');
  };

  const wheels = useMemo(
    () => (twin ? [{ x: 0, y: 0 }, { x: spacing, y: 0 }] : [{ x: 0, y: 0 }]),
    [twin, spacing]
  );

  /** The point state — superposed when there are two circles. */
  const point = useMemo(() => {
    if (!valid) return null;
    if (!twin) {
      const R = oneLayerResponse(r, z, q, a, E, nu);
      if (!R) return null;
      return {
        R,
        principal: principalAt(R, E, nu),
        strains: strainsAt(R, E, nu),
        sx: R.sigR, sy: R.sigT, sz: R.sigZ, w: R.w,
      };
    }
    const S = superposeOneLayer(wheels, { x: r, y: 0, z }, q, a, E, nu);
    if (!S) return null;
    const sum = S.sig[0] + S.sig[1] + S.sig[2];
    return {
      R: { sigZ: S.sz, sigR: S.sx, sigT: S.sy, tauRZ: S.txz, w: S.w, u: 0 },
      principal: { sig: S.sig, eps: S.eps },
      strains: {
        epsZ: (S.sz - nu * (S.sx + S.sy)) / E,
        epsR: (S.sx - nu * (S.sy + S.sz)) / E,
        epsT: (S.sy - nu * (S.sx + S.sz)) / E,
        gamRZ: NaN,
      },
      sx: S.sx, sy: S.sy, sz: S.sz, w: S.w,
    };
  }, [valid, twin, wheels, r, z, q, a, E, nu]);

  /** Depth profile at the chosen radius, and radial profile at the chosen depth. */
  const profiles = useMemo(() => {
    if (!valid) return null;
    const zMax = Math.max(6 * a, z * 1.4, 1);
    const rMax = Math.max(6 * a, r * 1.4, twin ? spacing + 3 * a : 1);
    const at = (rr: number, zz: number) => twin
      ? (() => {
          const S = superposeOneLayer(wheels, { x: rr, y: 0, z: zz }, q, a, E, nu);
          return S && { sigZ: S.sz, sigR: S.sx, sigT: S.sy, w: S.w };
        })()
      : (() => {
          const R = oneLayerResponse(rr, zz, q, a, E, nu);
          return R && { sigZ: R.sigZ, sigR: R.sigR, sigT: R.sigT, w: R.w };
        })();

    const depth = [];
    for (let i = 0; i <= 44; i++) {
      const zz = (i / 44) * zMax;
      const v = at(r, zz);
      if (v) depth.push({ z: zz, ...v });
    }
    const radial = [];
    for (let i = 0; i <= 44; i++) {
      const rr = (i / 44) * rMax;
      const v = at(rr, z);
      if (v) radial.push({ r: rr, ...v });
    }
    return { depth, radial };
  }, [valid, r, z, q, a, E, nu, twin, wheels, spacing]);

  const theme = useTheme();
  const depthRef = useRef<HTMLDivElement>(null);
  const radialRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profiles) return;
    let dead = false;
    (async () => {
      const Plotly = (await import('plotly.js-dist-min')).default;
      if (dead) return;
      const c = chartColors(theme);
      const hs = hueFor('stress', theme);
      const hr = hueFor('strain', theme);
      const hw = hueFor('deflection', theme);

      if (depthRef.current) {
        await Plotly.react(depthRef.current, [
          {
            x: profiles.depth.map(d => d.sigZ), y: profiles.depth.map(d => d.z),
            name: 'σz', mode: 'lines', line: { color: hs, width: 2.5 },
            fill: 'tozerox', ...areaFill(hs),
          },
          {
            x: profiles.depth.map(d => d.sigR), y: profiles.depth.map(d => d.z),
            name: 'σr', mode: 'lines', line: { color: hr, width: 2.5 },
          },
          {
            x: profiles.depth.map(d => d.sigT), y: profiles.depth.map(d => d.z),
            name: 'σt', mode: 'lines', line: { color: hw, width: 2, dash: 'dot' },
          },
        ], baseLayout(theme, {
          height: 360,
          xaxis: axis(theme, 'Stress'),
          yaxis: gridAxis(theme, 'Depth z', { autorange: 'reversed' }),
          hovermode: 'y unified', hoverlabel: hoverLabel(theme),
          shapes: [{
            type: 'line', xref: 'paper', x0: 0, x1: 1, y0: z, y1: z,
            line: { color: c.orange, width: 1, dash: 'dot' },
          }],
        }), plotConfig);
      }

      if (radialRef.current) {
        await Plotly.react(radialRef.current, [
          {
            x: profiles.radial.map(d => d.r), y: profiles.radial.map(d => d.sigZ),
            name: 'σz', mode: 'lines', line: { color: hs, width: 2.5 },
          },
          {
            x: profiles.radial.map(d => d.r), y: profiles.radial.map(d => d.sigR),
            name: 'σr', mode: 'lines', line: { color: hr, width: 2.5 },
          },
          {
            x: profiles.radial.map(d => d.r), y: profiles.radial.map(d => d.sigT),
            name: 'σt', mode: 'lines', line: { color: hw, width: 2, dash: 'dot' },
          },
        ], baseLayout(theme, {
          height: 360,
          xaxis: axis(theme, `Radial distance r  (at z = ${fmt(z, 2)})`),
          yaxis: gridAxis(theme, 'Stress'),
          hovermode: 'x unified', hoverlabel: hoverLabel(theme),
          shapes: [
            {
              type: 'rect', xref: 'x', yref: 'paper', x0: 0, x1: a, y0: 0, y1: 1,
              fillcolor: withAlpha(c.orange, 0.1), line: { width: 0 }, layer: 'below',
            },
            ...(twin ? [{
              type: 'rect' as const, xref: 'x' as const, yref: 'paper' as const,
              x0: spacing - a, x1: spacing + a, y0: 0, y1: 1,
              fillcolor: withAlpha(c.orange, 0.1), line: { width: 0 }, layer: 'below' as const,
            }] : []),
          ],
        }), plotConfig);
      }
    })();
    return () => { dead = true; };
  }, [profiles, theme, z, a, twin, spacing]);

  const surfaceW = valid
    ? (plate === 'rigid'
        ? rigidPlateDeflection(q, a, E, nu)
        : (oneLayerResponse(0, 0, q, a, E, nu)?.w ?? NaN))
    : NaN;

  return (
    <div className="cee-tool">
      <aside className="cee-panel">
        <h2 className="cee-panel__title">Half-space</h2>
        <div className="cee-presets">
          {PRESETS.map(x => (
            <button key={x.label} type="button"
              className={`cee-chip${p.label === x.label ? ' is-active' : ''}`}
              title={x.tip} onClick={() => apply(x)}>{x.label}</button>
          ))}
        </div>

        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="ol-q">
              <span>Pressure q<Tip text="Uniform contact pressure over the circular area." /></span>
              <span className="cee-field__unit">psi / kPa</span>
            </label>
            <input id="ol-q" className="cee-input" type="number" step="5" value={qStr}
              onChange={e => setQ(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="ol-a">
              <span>Radius a<Tip text="Contact radius, a = √(P/πq) from the wheel load and pressure." /></span>
              <span className="cee-field__unit">in / mm</span>
            </label>
            <input id="ol-a" className="cee-input" type="number" step="0.5" min="0.01" value={aStr}
              onChange={e => setA(e.target.value)} />
          </div>
        </div>

        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="ol-e">
              <span>Modulus E<Tip text="Elastic modulus of the half-space. σz does not depend on it — Huang notes this under Eq. 2.3 — but every strain and deflection does." /></span>
              <span className="cee-field__unit">psi / kPa</span>
            </label>
            <input id="ol-e" className="cee-input" type="number" step="1000" min="1" value={EStr}
              onChange={e => setE(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="ol-nu">
              <span>Poisson ν<Tip text="Foster and Ahlvin drew every chart in §2.1.1 at ν = 0.5. Drop to 0.3 and the radial stress under the center turns tensile — the point of Example 2.2." /></span>
              <span className="cee-field__unit">0 – 0.499</span>
            </label>
            <input id="ol-nu" className="cee-input" type="number" step="0.05" min="0" max="0.499"
              value={nuStr} onChange={e => setNu(e.target.value)} />
          </div>
        </div>

        <div className="cee-field">
          <span className="cee-field__label">
            <span>Plate<Tip text="A tire is a flexible plate: uniform pressure, dished deflection. A plate bearing test is rigid: uniform deflection, pressure that runs to infinity at the rim (Eq. 2.9). The rigid plate settles only π/4 ≈ 79% as much." /></span>
          </span>
          <div className="cee-seg">
            {(['flexible', 'rigid'] as const).map(k => (
              <button key={k} type="button" className={plate === k ? 'is-active' : ''}
                onClick={() => setPlate(k)}>{k[0].toUpperCase() + k.slice(1)}</button>
            ))}
          </div>
        </div>

        <h2 className="cee-panel__title" style={{ marginTop: '1rem' }}>Point</h2>
        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="ol-r">
              <span>Radius r<Tip text="Horizontal distance from the first load's center. Off the axis the shear stress is non-zero and the principal directions rotate — which is why Huang has charts here instead of equations." /></span>
              <span className="cee-field__unit">in / mm</span>
            </label>
            <input id="ol-r" className="cee-input" type="number" step="1" min="0" value={rStr}
              onChange={e => setR(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="ol-z">
              <span>Depth z<Tip text="Depth below the surface." /></span>
              <span className="cee-field__unit">in / mm</span>
            </label>
            <input id="ol-z" className="cee-input" type="number" step="1" min="0" value={zStr}
              onChange={e => setZ(e.target.value)} />
          </div>
        </div>

        <div className="cee-field">
          <label className="cee-check">
            <input type="checkbox" checked={twin} onChange={e => setTwin(e.target.checked)} />
            <span>Second circle<Tip text="Example 2.1 superposes two circular loads. Legitimate because the half-space is linear elastic — but the stresses must be rotated into a common frame before they are added, not summed component by component." /></span>
          </label>
        </div>
        {twin && (
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="ol-sp">
              <span>Center spacing</span>
              <span className="cee-field__unit">in / mm</span>
            </label>
            <input id="ol-sp" className="cee-input" type="number" step="1" min="0" value={spStr}
              onChange={e => setSp(e.target.value)} />
          </div>
        )}

        <p className="cee-hint">
          Huang (2004) §2.1, Eqs. 2.1–2.10. Exact off the axis as well as on it. Compression positive.
        </p>
      </aside>

      <div className="cee-results">
        <details className="cee-howto">
          <summary>How to use this tool</summary>
          <div className="cee-howto__body">
            <ol>
              <li><strong>The axis is the easy case.</strong> At r = 0 the shear vanishes, σr = σt,
                and Huang's Eqs. 2.2–2.6 apply directly.</li>
              <li><strong>Off the axis is the interesting one.</strong> τrz is non-zero, so the
                principal directions rotate out of the vertical and the principal stresses are no
                longer σz and σr. That is what the principal card below reports, and it is what
                Problem 2.1 asks for.</li>
              <li><strong>Watch ν.</strong> σz is independent of it. σr is not: at ν = 0.5 the
                radial stress under the center stays compressive at every depth, and at ν = 0.3 it
                turns tensile below about z/a = 1.5.</li>
              <li><strong>Two circles superpose,</strong> but the rotation matters — each load's
                radial direction points somewhere different at the same point.</li>
            </ol>
            Reproduces Examples 2.1, 2.2 and 2.3. For Problem 2.1 it reports 0.228q, 0.0108q and
            0.0092q where the book prints 0.221, 0.011 and 0.004; both this module and the
            independent n-layer solver agree on the computed values, so the difference is the
            table read Huang worked from.
          </div>
        </details>

        {!point ? (
          <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>
            Enter a positive radius, modulus and pressure.
          </span></p>
        ) : (
          <>
            <KpiStrip>
              <Kpi accent label="σz at the point" value={fmt(point.sz, 3)}
                tip="Vertical stress. Independent of E and ν — the same number for any material." />
              <Kpi label="εz at the point" value={fmt(point.strains.epsZ * 1e6, 0)} unit="µε"
                tip="Vertical strain, from Eq. 2.1a with all three normal stresses." />
              <Kpi label="w at the point" value={fmt(point.w, 4)}
                tip="Vertical deflection at the depth given — Eq. 2.6 on the axis." />
              <Kpi label={`w₀ at the surface (${plate})`} value={fmt(surfaceW, 4)}
                tip={plate === 'rigid'
                  ? 'Eq. 2.10 — a rigid plate settles π/4 ≈ 79% as much as a flexible one at the same average pressure, because it sheds pressure to its rim.'
                  : 'Eq. 2.8, w₀ = 2(1 − ν²)qa/E, under the center of the load.'} />
            </KpiStrip>

            <div className="cee-card">
              <h3 className="cee-card__title">The state at the point</h3>
              <div className="cee-tablewrap">
                <table className="cee-table">
                  <thead>
                    <tr><th>Component</th><th>Stress</th><th>Strain (µε)</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>Vertical σz</td><td>{fmt(point.sz, 4)}</td><td>{fmt(point.strains.epsZ * 1e6, 1)}</td></tr>
                    <tr><td>Radial σr</td><td>{fmt(point.sx, 4)}</td><td>{fmt(point.strains.epsR * 1e6, 1)}</td></tr>
                    <tr><td>Tangential σt</td><td>{fmt(point.sy, 4)}</td><td>{fmt(point.strains.epsT * 1e6, 1)}</td></tr>
                    <tr><td>Shear ΤRZ</td><td>{fmt(point.R.tauRZ, 4)}</td><td>{Number.isFinite(point.strains.gamRZ) ? fmt(point.strains.gamRZ * 1e6, 1) : '—'}</td></tr>
                    <tr className="cee-table__rule"><td>Principal σ₁</td><td>{fmt(point.principal.sig[0], 4)}</td><td>{fmt(point.principal.eps[0] * 1e6, 1)}</td></tr>
                    <tr><td>Principal σ₂</td><td>{fmt(point.principal.sig[1], 4)}</td><td>{fmt(point.principal.eps[1] * 1e6, 1)}</td></tr>
                    <tr><td>Principal σ₃</td><td>{fmt(point.principal.sig[2], 4)}</td><td>{fmt(point.principal.eps[2] * 1e6, 1)}</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="cee-note">
                Compression is positive, so a negative stress is tension.
                {Math.abs(point.R.tauRZ) > 1e-9
                  ? ' The shear stress here is non-zero, so σz and σr are NOT principal stresses — the principal directions have rotated out of the vertical.'
                  : ' On the axis of symmetry the shear vanishes, so σz and σr are principal and σr = σt.'}
                {plate === 'rigid' && (
                  <> A rigid plate is not uniformly loaded: Eq. 2.9 puts {fmt(rigidPlatePressure(q, a, 0), 2)} at
                  its center, half the average, and runs to infinity at the rim. The stresses above assume the
                  uniform pressure of a flexible plate; only the surface deflection KPI uses the rigid form.</>
                )}
              </p>
            </div>

            <div className="cee-chart-grid cee-chart-grid--2">
              <ChartFigure
                title="Down the depth"
                subtitle={`At r = ${fmt(r, 2)}. The dotted line marks the point.`}
                plotRef={depthRef}
                legend={[
                  { label: 'σz', color: hueFor('stress', theme) },
                  { label: 'σr', color: hueFor('strain', theme) },
                  { label: 'σt', color: hueFor('deflection', theme), shape: 'dash' },
                ]}
                takeaway="Vertical stress decays smoothly with depth while the horizontal stresses fall much faster, so the state deep in a half-space is nearly uniaxial."
              >
                This is the column Figures 2.2 through 2.4 plot, at one radius. <strong>σz falls
                slowly</strong> — a half-space spreads load poorly, which is exactly the problem a
                pavement exists to fix — while <strong>σr and σt collapse</strong>, so a point well
                below the load is in near-uniaxial compression.
              </ChartFigure>

              <ChartFigure
                title="Across the radius"
                subtitle={`At z = ${fmt(z, 2)}. The tinted bands are the loaded circles.`}
                plotRef={radialRef}
                legend={[
                  { label: 'σz', color: hueFor('stress', theme) },
                  { label: 'σr', color: hueFor('strain', theme) },
                  { label: 'σt', color: hueFor('deflection', theme), shape: 'dash' },
                ]}
                takeaway="The stress bulb is wider than the load and has no edge — which is why two wheels 20 inches apart still add at a depth of 10 inches."
              >
                The load has a sharp edge; the stress does not. <strong>Nothing goes to zero at
                r = a</strong>, which is the whole reason superposition matters: at the depths that
                decide a pavement, neighbouring wheels are still reaching each other.
              </ChartFigure>
            </div>

            <p className="cee-note">
              Huang (2004) §2.1. On the axis this is Eqs. 2.2–2.6 exactly; off it, the Hankel
              integrals those charts were built from, so intermediate values are computed rather
              than interpolated between drawn curves. The half-space is linear elastic,
              homogeneous, isotropic and weightless — see §2.1.3 for what the nonlinearity of a
              real granular soil does to these numbers.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
