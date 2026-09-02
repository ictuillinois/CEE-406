// N layers — the general case, solved rather than charted.
//
// Burmister's two- and three-layer results were as far as hand computation
// reached; "with the advent of computers, the theory can be applied to a
// multilayer system with any number of layers (Huang, 1967, 1968a)". This is
// that solver, from Appendix B, running in the browser.
//
// It is also the module the other three are checked against: run it with two
// identical layers and it must give Boussinesq, with two layers it must give
// Burmister, and with three it must give Jones' table.
import { useEffect, useMemo, useRef, useState } from 'react';
import Tip from '../../Tip';
import {
  useTheme, chartColors, baseLayout, plotConfig, num, fmt,
  axis, gridAxis, hueFor, hoverLabel,
} from '../../chartTheme';
import ChartFigure from '../../ui/ChartFigure';
import KpiStrip, { Kpi } from '../../ui/KpiStrip';
import { leaResponse, leaSuperpose, type Layer } from '../lea.ts';

interface LayerRow { id: number; h: string; E: string; nu: string }
let nextId = 100;

type WheelSet = 'single' | 'dual' | 'tandem';

interface Preset {
  label: string; tip: string;
  rows: Omit<LayerRow, 'id'>[];
  q: string; a: string; wheels: WheelSet; sd: string; st: string;
}

const PRESETS: Preset[] = [
  {
    label: 'Problem 2.6 (3 layer)',
    tip: '5.75 in HMA over 23 in base over subgrade, 40,000 lb at 150 psi. Printed: εt = 7.25e-4, εz = 1.06e-3.',
    rows: [
      { h: '5.75', E: '400000', nu: '0.5' },
      { h: '23', E: '20000', nu: '0.5' },
      { h: '0', E: '10000', nu: '0.5' },
    ],
    q: '150', a: '9.21', wheels: 'single', sd: '28', st: '60',
  },
  {
    label: 'Problem 2.4 (2 layer)',
    tip: '8 in at 200,000 psi over a 10,000 psi subgrade, 10,000 lb at 80 psi. Printed: w0 = 0.025 in, interface stress 11 psi.',
    rows: [
      { h: '8', E: '200000', nu: '0.5' },
      { h: '0', E: '10000', nu: '0.5' },
    ],
    q: '80', a: '6.31', wheels: 'single', sd: '28', st: '60',
  },
  {
    label: 'Problem 2.5 (dual-tandem)',
    tip: '8-in full-depth asphalt at 1,500,000 psi over 30,000 psi, four 50,000-lb wheels at 100 psi, 28 in dual and 60 in tandem. Printed: max tensile strain 2.05e-4, subgrade deflection 0.057 in.',
    rows: [
      { h: '8', E: '1500000', nu: '0.5' },
      { h: '0', E: '30000', nu: '0.5' },
    ],
    q: '100', a: '12.62', wheels: 'tandem', sd: '28', st: '60',
  },
  {
    label: 'HW4 four-layer',
    tip: 'The HW4 section: E = 3200/200/100/42 MPa under 720 kPa on a 145 mm radius, in metric units.',
    rows: [
      { h: '100', E: '3200', nu: '0.35' },
      { h: '200', E: '200', nu: '0.35' },
      { h: '300', E: '100', nu: '0.4' },
      { h: '0', E: '42', nu: '0.45' },
    ],
    q: '720', a: '145', wheels: 'single', sd: '350', st: '1400',
  },
];

/** Wheel centers for each configuration, in plan. */
function wheelCenters(kind: WheelSet, dual: number, tandem: number) {
  if (kind === 'single') return [{ x: 0, y: 0 }];
  if (kind === 'dual') return [{ x: 0, y: 0 }, { x: dual, y: 0 }];
  return [
    { x: 0, y: 0 }, { x: dual, y: 0 },
    { x: 0, y: tandem }, { x: dual, y: tandem },
  ];
}

export default function MultiLayerModule() {
  const [preset, setPreset] = useState(PRESETS[0].label);
  const [rows, setRows] = useState<LayerRow[]>(
    PRESETS[0].rows.map(r => ({ ...r, id: nextId++ }))
  );
  const [qStr, setQ] = useState(PRESETS[0].q);
  const [aStr, setA] = useState(PRESETS[0].a);
  const [wheels, setWheels] = useState<WheelSet>('single');
  const [dualSp, setDualSp] = useState(PRESETS[0].sd);
  const [tandemSp, setTandemSp] = useState(PRESETS[0].st);
  const [rStr, setR] = useState('0');

  const q = num(qStr, 150);
  const a = num(aStr, 9.21);
  const rOff = num(rStr, 0);

  const layers = useMemo<Layer[]>(
    () => rows.map(r => ({
      h: num(r.h, 0), E: num(r.E, 1),
      nu: Math.min(0.499, Math.max(0, num(r.nu, 0.35))),
    })),
    [rows]
  );

  const interfaces = useMemo(() => {
    const out: number[] = [];
    let acc = 0;
    for (let i = 0; i < layers.length - 1; i++) { acc += layers[i].h; out.push(acc); }
    return out;
  }, [layers]);

  const valid = layers.length >= 2 && q > 0 && a > 0 &&
    layers.slice(0, -1).every(l => l.h > 0) && layers.every(l => l.E > 0);

  const centers = useMemo(
    () => wheelCenters(wheels, num(dualSp, 28), num(tandemSp, 60)),
    [wheels, dualSp, tandemSp]
  );

  /**
   * Response at one depth. A single wheel keeps its axisymmetric frame; a
   * group is rotated into the plan frame and superposed, and its "radial"
   * stress is then σx along the dual axis.
   */
  const at = useMemo(() => (z: number) => {
    if (!valid) return null;
    if (wheels === 'single') {
      const R = leaResponse(layers, q, a, rOff, z);
      return R && {
        sigZ: R.sigZ, sigR: R.sigR, sigT: R.sigT,
        epsZ: R.epsZ, epsR: R.epsR, w: R.w,
        tensile: Math.max(0, -Math.min(R.epsR, R.epsT, R.epsZ)),
      };
    }
    const S = leaSuperpose(layers, q, a, centers, { x: rOff, y: 0, z });
    return S && {
      sigZ: S.sigZ, sigR: S.sigX, sigT: S.sigY,
      epsZ: S.epsZ, epsR: S.epsX, w: S.w, tensile: S.tensile,
    };
  }, [valid, layers, q, a, rOff, wheels, centers]);

  const profile = useMemo(() => {
    if (!valid) return null;
    const total = interfaces.length ? interfaces[interfaces.length - 1] : 10 * a;
    const zs = new Set<number>([0]);
    for (const zi of interfaces) {
      zs.add(Math.max(0, zi - 1e-4));
      zs.add(zi + 1e-4);
    }
    const zMax = total + 6 * a;
    for (let i = 0; i <= 40; i++) zs.add((i / 40) * zMax);
    const sorted = [...zs].sort((x, y) => x - y);
    return sorted.map(z => ({ z, R: at(z) })).filter(p => p.R) as
      { z: number; R: NonNullable<ReturnType<typeof at>> }[];
  }, [valid, interfaces, a, at]);

  const critical = useMemo(() => {
    if (!valid || !interfaces.length) return null;
    return {
      acBottom: at(interfaces[0] - 1e-4),
      sgTop: at(interfaces[interfaces.length - 1] + 1e-4),
      surface: at(0),
    };
  }, [valid, interfaces, at]);

  const theme = useTheme();
  const stressRef = useRef<HTMLDivElement>(null);
  const strainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profile) return;
    let dead = false;
    (async () => {
      const Plotly = (await import('plotly.js-dist-min')).default;
      if (dead) return;
      const c = chartColors(theme);
      const shapes = interfaces.map(zi => ({
        type: 'line' as const, xref: 'paper' as const, x0: 0, x1: 1, y0: zi, y1: zi,
        line: { color: c.secondary, width: 1, dash: 'dot' as const },
      }));
      const layout = (xt: string) => baseLayout(theme, {
        height: 380,
        xaxis: axis(theme, xt),
        yaxis: gridAxis(theme, 'Depth z', { autorange: 'reversed' as const }),
        hovermode: 'y unified' as const,
        hoverlabel: hoverLabel(theme),
        shapes,
      });

      if (stressRef.current) {
        await Plotly.react(stressRef.current, [
          {
            x: profile.map(p => p.R.sigZ), y: profile.map(p => p.z), name: 'σz',
            mode: 'lines', line: { color: hueFor('stress', theme), width: 2.5 },
          },
          {
            x: profile.map(p => p.R.sigR), y: profile.map(p => p.z),
            name: wheels === 'single' ? 'σr' : 'σx',
            mode: 'lines', line: { color: hueFor('strain', theme), width: 2.5 },
          },
        ], layout('Stress'), plotConfig);
      }
      if (strainRef.current) {
        await Plotly.react(strainRef.current, [
          {
            x: profile.map(p => p.R.epsZ * 1e6), y: profile.map(p => p.z), name: 'εz',
            mode: 'lines', line: { color: hueFor('stress', theme), width: 2.5 },
          },
          {
            x: profile.map(p => p.R.epsR * 1e6), y: profile.map(p => p.z),
            name: wheels === 'single' ? 'εr' : 'εx',
            mode: 'lines', line: { color: hueFor('strain', theme), width: 2.5 },
          },
          {
            x: profile.map(p => p.R.w), y: profile.map(p => p.z), name: 'w',
            mode: 'lines', line: { color: hueFor('deflection', theme), width: 2, dash: 'dot' },
            visible: 'legendonly',
          },
        ], layout('Strain (µε) — compression positive'), plotConfig);
      }
    })();
    return () => { dead = true; };
  }, [profile, theme, interfaces, wheels]);

  const update = (id: number, patch: Partial<LayerRow>) =>
    setRows(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)));

  const applyPreset = (x: Preset) => {
    setPreset(x.label);
    setRows(x.rows.map(r => ({ ...r, id: nextId++ })));
    setQ(x.q); setA(x.a); setWheels(x.wheels);
    setDualSp(x.sd); setTandemSp(x.st); setR('0');
  };

  return (
    <div className="cee-tool">
      <aside className="cee-panel">
        <h2 className="cee-panel__title">Structure</h2>
        <div className="cee-presets">
          {PRESETS.map(x => (
            <button key={x.label} type="button"
              className={`cee-chip${preset === x.label ? ' is-active' : ''}`}
              title={x.tip} onClick={() => applyPreset(x)}>{x.label}</button>
          ))}
        </div>

        <div className="cee-field">
          <span className="cee-field__label">
            <span>Layers<Tip text="Top to bottom. The last layer is the half-space and its thickness is ignored. Use consistent units: psi with inches, or kPa with millimeters." /></span>
            <span className="cee-field__unit">h · E · ν</span>
          </span>
          {rows.map((r, i) => (
            <div className="cee-axle-row cee-axle-row--layer" key={r.id}>
              <input className="cee-input" type="number" min="0" step="0.5" value={r.h}
                aria-label={`Layer ${i + 1} thickness`} disabled={i === rows.length - 1}
                placeholder={i === rows.length - 1 ? '∞' : ''}
                onChange={e => update(r.id, { h: e.target.value })} />
              <input className="cee-input" type="number" min="1" step="1000" value={r.E}
                aria-label={`Layer ${i + 1} modulus`} onChange={e => update(r.id, { E: e.target.value })} />
              <input className="cee-input" type="number" min="0" max="0.499" step="0.05" value={r.nu}
                aria-label={`Layer ${i + 1} Poisson ratio`} onChange={e => update(r.id, { nu: e.target.value })} />
              <button className="cee-axle-remove" type="button" aria-label="Remove layer"
                disabled={rows.length <= 2}
                onClick={() => setRows(rs => rs.filter(x => x.id !== r.id))}>×</button>
            </div>
          ))}
          <button className="cee-btn cee-btn--ghost cee-btn--sm" type="button"
            onClick={() => setRows(rs => {
              const copy = [...rs];
              copy.splice(rs.length - 1, 0, { id: nextId++, h: '6', E: '20000', nu: '0.4' });
              return copy;
            })}>+ Add layer</button>
        </div>

        <h2 className="cee-panel__title" style={{ marginTop: '1rem' }}>Load</h2>
        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="ml-q">
              <span>Pressure q<Tip text="Uniform contact pressure over the circular area." /></span>
              <span className="cee-field__unit">psi / kPa</span>
            </label>
            <input id="ml-q" className="cee-input" type="number" min="1" step="10" value={qStr}
              onChange={e => setQ(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="ml-a">
              <span>Radius a<Tip text="Contact radius, a = √(P/πq) from the wheel load and pressure." /></span>
              <span className="cee-field__unit">in / mm</span>
            </label>
            <input id="ml-a" className="cee-input" type="number" min="0.1" step="0.5" value={aStr}
              onChange={e => setA(e.target.value)} />
          </div>
        </div>

        <div className="cee-field">
          <span className="cee-field__label"><span>Wheel configuration</span></span>
          <div className="cee-seg">
            {(['single', 'dual', 'tandem'] as WheelSet[]).map(w => (
              <button key={w} type="button" className={wheels === w ? 'is-active' : ''}
                onClick={() => setWheels(w)}>{w[0].toUpperCase() + w.slice(1)}</button>
            ))}
          </div>
        </div>

        {wheels !== 'single' && (
          <div className="cee-row">
            <div className="cee-field">
              <label className="cee-field__label" htmlFor="ml-ds">
                <span>Dual spacing<Tip text="Center-to-center spacing of the two wheels in a dual." /></span>
                <span className="cee-field__unit">in / mm</span>
              </label>
              <input id="ml-ds" className="cee-input" type="number" min="0" step="1" value={dualSp}
                onChange={e => setDualSp(e.target.value)} />
            </div>
            {wheels === 'tandem' && (
              <div className="cee-field">
                <label className="cee-field__label" htmlFor="ml-ts">
                  <span>Tandem spacing<Tip text="Center-to-center spacing between the two axles of a tandem." /></span>
                  <span className="cee-field__unit">in / mm</span>
                </label>
                <input id="ml-ts" className="cee-input" type="number" min="0" step="1" value={tandemSp}
                  onChange={e => setTandemSp(e.target.value)} />
              </div>
            )}
          </div>
        )}

        <div className="cee-field">
          <label className="cee-field__label" htmlFor="ml-r">
            <span>Radial offset r<Tip text="Horizontal distance from the first load's center to the point analyzed. Zero is under the load center, where the critical responses usually are for a single wheel." /></span>
            <span className="cee-field__unit">in / mm</span>
          </label>
          <input id="ml-r" className="cee-input" type="number" min="0" step="1" value={rStr}
            onChange={e => setR(e.target.value)} />
        </div>

        <p className="cee-hint">
          Huang (2004) Appendix B, solved by Hankel transform. Fully bonded interfaces.
          Compression positive.
        </p>
      </aside>

      <div className="cee-results">
        <details className="cee-howto">
          <summary>How to use this tool</summary>
          <div className="cee-howto__body">
            <ol>
              <li><strong>Build the structure</strong> top to bottom. The bottom layer is the
                half-space; its thickness is ignored.</li>
              <li><strong>Set the load</strong> and, for Problem 2.5, switch to dual or tandem.
                The wheels are superposed — legitimate because the system is linear elastic — with
                each load's stresses rotated into a common plan frame before they are added.</li>
              <li><strong>Read the critical strains</strong>: horizontal tension at the bottom of
                the top layer drives fatigue cracking, vertical compression on top of the subgrade
                drives rutting. These are the two numbers the HW8 damage tool wants.</li>
              <li><strong>Check against WinJULEA.</strong> This solves the same equations; if the
                two disagree, one of the inputs differs.</li>
            </ol>
            Reproduces Problem 2-4 (w₀ = 0.025 in, interface stress 11 psi) and Problem 2-6
            (εt = 7.25×10⁻⁴, εz = 1.06×10⁻³), collapses onto the Boussinesq half-space when every
            layer has the same modulus, and matches Jones' three-layer table to four decimals.
          </div>
        </details>

        {!valid || !profile || !critical ? (
          <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>
            Enter at least two layers with positive moduli, a positive thickness for every layer
            above the half-space, and a positive load.
          </span></p>
        ) : (
          <>
            <KpiStrip>
              <Kpi accent label="Surface deflection w₀"
                value={critical.surface ? fmt(critical.surface.w, 4) : '—'}
                tip="Vertical displacement at the surface under the load — what an FWD sensor reads." />
              <Kpi label="εt at bottom of layer 1"
                value={critical.acBottom ? fmt(critical.acBottom.epsR * 1e6, 0) : '—'} unit="µε"
                tip="Horizontal strain at the bottom of the top layer. Negative here means tension (compression is positive), and its magnitude drives bottom-up fatigue cracking." />
              <Kpi label="εz on subgrade"
                value={critical.sgTop ? fmt(critical.sgTop.epsZ * 1e6, 0) : '—'} unit="µε"
                tip="Vertical compressive strain on top of the half-space — the strain that drives subgrade rutting." />
              <Kpi label="σz on subgrade"
                value={critical.sgTop ? fmt(critical.sgTop.sigZ, 2) : '—'}
                tip="Vertical stress delivered to the subgrade. A stiff upper structure is what keeps this small." />
            </KpiStrip>

            <div className="cee-chart-grid cee-chart-grid--2">
              <ChartFigure
                title="Stress vs. depth"
                subtitle="Dotted lines mark the layer interfaces, where the response kinks"
                plotRef={stressRef}
                legend={[
                  { label: 'σz', color: hueFor('stress', theme) },
                  { label: wheels === 'single' ? 'σr' : 'σx', color: hueFor('strain', theme) },
                ]}
                takeaway="Vertical stress is continuous across every interface while radial stress jumps, because the layers share strain but not stiffness."
              >
                <strong>σz is continuous</strong> across each interface — equilibrium demands it — but
                <strong> σr jumps</strong>, because the two layers share the same horizontal strain and
                a stiffer layer converts that strain into more stress. That jump is the whole reason
                layering works: the stiff upper layer takes the bending and hands the subgrade a much
                gentler stress than a half-space would see.
              </ChartFigure>
              <ChartFigure
                title="Strain vs. depth"
                subtitle="Compression positive, so a negative εr is horizontal tension"
                plotRef={strainRef}
                legend={[
                  { label: 'εz', color: hueFor('stress', theme) },
                  { label: wheels === 'single' ? 'εr' : 'εx', color: hueFor('strain', theme) },
                  { label: 'w (click to show)', color: hueFor('deflection', theme), shape: 'dash' },
                ]}
                takeaway="Radial strain reverses sign inside the top layer, so its bottom is in tension — the location and mechanism of bottom-up fatigue cracking."
              >
                The top layer bends: compression above the neutral axis, <strong>tension below it</strong>.
                Where εr crosses zero is that neutral axis, and the tension at the bottom of the layer is
                what the fatigue transfer function consumes. Vertical strain, meanwhile, peaks in the
                soft layers — which is where rutting accumulates.
              </ChartFigure>
            </div>

            <div className="cee-tablewrap">
              <table className="cee-table">
                <caption className="cee-table__caption">
                  Both sides of every interface, where the response kinks.
                </caption>
                <thead>
                  <tr>
                    <th>Depth z</th>
                    <th>σz</th>
                    <th>{wheels === 'single' ? 'σr' : 'σx'}</th>
                    <th>εz (µε)</th>
                    <th>{wheels === 'single' ? 'εr' : 'εx'} (µε)</th>
                    <th>w</th>
                  </tr>
                </thead>
                <tbody>
                  {[0, ...interfaces.flatMap(zi => [zi - 1e-4, zi + 1e-4])]
                    .sort((x, y) => x - y)
                    .map((z, i) => {
                      const R = at(z);
                      if (!R) return null;
                      return (
                        <tr key={i}>
                          <td>{z.toFixed(2)}</td>
                          <td>{fmt(R.sigZ, 2)}</td>
                          <td>{fmt(R.sigR, 2)}</td>
                          <td>{fmt(R.epsZ * 1e6, 0)}</td>
                          <td>{fmt(R.epsR * 1e6, 0)}</td>
                          <td>{fmt(R.w, 4)}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <p className="cee-note">
              Huang (2004) Appendix B: the stress function of Eq. B.3, responses B.4, Hankel inversion
              B.7, surface conditions B.9, and bonded-interface continuity B.11. Solved by
              Gauss–Legendre quadrature between the zeros of the Bessel functions, on the difference
              from a half-space of the top layer's material so the integrand decays even at the
              surface. Interfaces are fully bonded and every layer is linear elastic, homogeneous and
              isotropic — the same assumptions WinJULEA and KENLAYER make, so the answers should agree.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
