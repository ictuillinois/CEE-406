// Two layers — Burmister's system, and the five design charts built on it.
//
// "The exact case of a two-layer system is the full-depth construction in
// which a thick layer of HMA is placed directly on the subgrade. If a pavement
// is composed of three layers... it is necessary to combine the base course
// and the subgrade into a single layer for computing the stresses and strains
// in the asphalt layer, or to combine the asphalt surface course and base
// course for computing the stresses and strains in the subgrade."
//
// This module answers every question §2.2.1 poses at once: the interface
// stress of Figure 2.15, the surface deflection of Figure 2.17, the interface
// deflection of Figure 2.19, the strain factor of Figure 2.21, and the
// conversion factor of Figures 2.23 and 2.25-2.27 — each with the equation
// that turns it into an answer, and each traceable to the worked example that
// pins it.
import { useEffect, useMemo, useRef, useState } from 'react';
import Tip from '../../Tip';
import {
  useTheme, chartColors, baseLayout, plotConfig, num, fmt,
  axis, gridAxis, hueFor, areaFill, withAlpha, hoverLabel,
} from '../../chartTheme';
import ChartFigure from '../../ui/ChartFigure';
import KpiStrip, { Kpi } from '../../ui/KpiStrip';
import {
  interfaceStressRatio, surfaceDeflectionFactor, interfaceDeflectionFactor,
  strainFactor, groupStrainFactor, allowableRepetitions, requiredAOverH1,
  CHART_NU,
} from '../twoLayer.ts';
import { leaResponse } from '../lea.ts';

type Wheels = 'single' | 'dual' | 'tandem';

interface Preset {
  label: string; tip: string;
  E1: string; E2: string; h1: string; q: string; a: string;
  wheels: Wheels; sd: string; st: string;
}

const PRESETS: Preset[] = [
  {
    label: 'Example 2.5',
    tip: '6-in radius at 80 psi on a 5000-psi subgrade. Full depth at E1 = 500,000 psi needs 5.2 in; a granular base at 25,000 psi needs 15 in, both for σc = 8 psi.',
    E1: '500000', E2: '5000', h1: '5.2', q: '80', a: '6', wheels: 'single', sd: '24', st: '48',
  },
  {
    label: 'Example 2.6',
    tip: '20,000 lb through a rigid 12-in plate, 8-in layer 1 over 6400 psi. A 0.1-in deflection gives F2 = 0.511, hence E1/E2 = 5 and E1 = 32,000 psi.',
    E1: '32000', E2: '6400', h1: '8', q: '176.8', a: '6', wheels: 'single', sd: '24', st: '48',
  },
  {
    label: 'Example 2.7 (dual)',
    tip: 'Dual tires at 4.52-in radius, 70 psi, 13.5 in apart. 6-in layer at 100,000 psi over 10,000 psi. Interface deflection at point A: 0.027 in from the chart, 0.0281 in from KENLAYER.',
    E1: '100000', E2: '10000', h1: '6', q: '70', a: '4.52', wheels: 'dual', sd: '13.5', st: '48',
  },
  {
    label: 'Example 2.8 (full depth)',
    tip: '9000 lb at 67.7 psi on 8 in of 150,000-psi asphalt over 15,000 psi. Fe = 0.72, critical tensile strain 3.25e-4 (KENLAYER: 3.36e-4).',
    E1: '150000', E2: '15000', h1: '8', q: '67.7', a: '6.5', wheels: 'single', sd: '24', st: '48',
  },
  {
    label: 'Examples 2.9 / 2.10',
    tip: 'The same section under dual tires at 11.5-in spacing (Ex 2.9, C = 1.50) and then dual-tandem at 49 in (Ex 2.10, C = 1.43).',
    E1: '150000', E2: '15000', h1: '8', q: '67.7', a: '4.6', wheels: 'dual', sd: '11.5', st: '49',
  },
  {
    label: 'Problem 2.4',
    tip: '10,000 lb at 80 psi, 8-in layer at 200,000 psi over 10,000 psi. Printed: w0 = 0.025 in, interface deflection 0.024 in, interface stress 11 psi.',
    E1: '200000', E2: '10000', h1: '8', q: '80', a: '6.31', wheels: 'single', sd: '24', st: '48',
  },
];

export default function TwoLayerModule() {
  const [p, setP] = useState<Preset>(PRESETS[3]);
  const [E1s, setE1] = useState(PRESETS[3].E1);
  const [E2s, setE2] = useState(PRESETS[3].E2);
  const [h1s, setH1] = useState(PRESETS[3].h1);
  const [qs, setQ] = useState(PRESETS[3].q);
  const [as_, setA] = useState(PRESETS[3].a);
  const [wheels, setWheels] = useState<Wheels>(PRESETS[3].wheels);
  const [sds, setSd] = useState(PRESETS[3].sd);
  const [sts, setSt] = useState(PRESETS[3].st);
  const [rs, setR] = useState('0');
  const [target, setTarget] = useState('8');

  const E1 = num(E1s, 1), E2 = num(E2s, 1), h1 = num(h1s, 1);
  const q = num(qs, 1), a = num(as_, 1), sd = num(sds, 24), st = num(sts, 48);
  const rOff = Math.max(0, num(rs, 0));
  const valid = E1 > 0 && E2 > 0 && h1 > 0 && q > 0 && a > 0;

  const ER = E1 / E2;
  const hOverA = h1 / a;

  const apply = (x: Preset) => {
    setP(x); setE1(x.E1); setE2(x.E2); setH1(x.h1);
    setQ(x.q); setA(x.a); setWheels(x.wheels); setSd(x.sd); setSt(x.st); setR('0');
  };

  /** Every chart in §2.2.1, at this section. */
  const charts = useMemo(() => {
    if (!valid) return null;
    const sigmaC = q * interfaceStressRatio(ER, a / h1);
    const F2 = surfaceDeflectionFactor(ER, hOverA);
    const F = interfaceDeflectionFactor(ER, hOverA, rOff / a);
    const Fe = strainFactor(ER, hOverA);
    const group = wheels === 'single'
      ? null
      : groupStrainFactor(ER, h1, a, sd, wheels === 'tandem' ? st : undefined);
    return {
      sigmaC,
      Nd: allowableRepetitions(sigmaC, E2),
      F2, w0: (1.5 * q * a * F2) / E2,
      w0rigid: (1.18 * q * a * F2) / E2,
      F, wInterface: (q * a * F) / E2,
      Fe, e: (q * Fe) / E1,
      group,
      eGroup: group ? (q * group.groupFactor) / E1 : null,
    };
  }, [valid, ER, hOverA, q, a, h1, E2, E1, rOff, wheels, sd, st]);

  /** The thickness that would hold the interface stress to a target. */
  const design = useMemo(() => {
    const t = num(target, 0);
    if (!valid || !(t > 0) || t >= q) return null;
    const aOverH1 = requiredAOverH1(ER, t / q);
    return aOverH1 ? { aOverH1, h1: a / aOverH1, target: t } : null;
  }, [valid, target, q, ER, a]);

  /** σz down the axis, which is Figure 2.14 drawn for the real section. */
  const profile = useMemo(() => {
    if (!valid) return null;
    const layers = [{ h: h1, E: E1, nu: CHART_NU }, { h: 0, E: E2, nu: CHART_NU }];
    const zMax = Math.max(3 * h1, 5 * a);
    const out: { z: number; sigZ: number; w: number }[] = [];
    for (let i = 0; i <= 46; i++) {
      const z = (i / 46) * zMax;
      const R = leaResponse(layers, q, a, 0, z);
      if (R) out.push({ z, sigZ: R.sigZ, w: R.w });
    }
    return out;
  }, [valid, h1, E1, E2, q, a]);

  /** The interface deflection basin — how Example 2.7 superposes a dual. */
  const basin = useMemo(() => {
    if (!valid) return null;
    const rMax = Math.max(6 * a, wheels !== 'single' ? sd + 3 * a : 0);
    const out: { r: number; F: number; w: number }[] = [];
    for (let i = 0; i <= 40; i++) {
      const r = (i / 40) * rMax;
      const F = interfaceDeflectionFactor(ER, hOverA, r / a);
      out.push({ r, F, w: (q * a * F) / E2 });
    }
    return out;
  }, [valid, ER, hOverA, a, q, E2, wheels, sd]);

  const theme = useTheme();
  const profRef = useRef<HTMLDivElement>(null);
  const basinRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profile || !basin) return;
    let dead = false;
    (async () => {
      const Plotly = (await import('plotly.js-dist-min')).default;
      if (dead) return;
      const c = chartColors(theme);
      const hs = hueFor('stress', theme);
      const hw = hueFor('deflection', theme);

      if (profRef.current) {
        await Plotly.react(profRef.current, [{
          x: profile.map(d => d.sigZ), y: profile.map(d => d.z),
          name: 'σz', mode: 'lines', line: { color: hs, width: 2.5 },
          fill: 'tozerox', ...areaFill(hs),
        }], baseLayout(theme, {
          height: 360,
          xaxis: axis(theme, 'Vertical stress σz'),
          yaxis: gridAxis(theme, 'Depth z', { autorange: 'reversed' }),
          hovermode: 'y unified', hoverlabel: hoverLabel(theme),
          shapes: [{
            type: 'line', xref: 'paper', x0: 0, x1: 1, y0: h1, y1: h1,
            line: { color: c.secondary, width: 1, dash: 'dot' },
          }],
          annotations: [{
            xref: 'paper', x: 0.98, y: h1, text: 'interface', showarrow: false,
            xanchor: 'right', yanchor: 'bottom',
            font: { family: 'IBM Plex Mono, monospace', size: 10.5, color: c.fg },
          }],
        }), plotConfig);
      }

      if (basinRef.current) {
        await Plotly.react(basinRef.current, [{
          x: basin.map(d => d.r), y: basin.map(d => d.w),
          name: 'w', mode: 'lines', line: { color: hw, width: 2.5 },
        }], baseLayout(theme, {
          height: 360,
          xaxis: axis(theme, 'Radial distance r'),
          yaxis: gridAxis(theme, 'Interface deflection w', { autorange: 'reversed' }),
          hovermode: 'x unified', hoverlabel: hoverLabel(theme),
          shapes: [
            {
              type: 'rect', xref: 'x', yref: 'paper', x0: 0, x1: a, y0: 0, y1: 1,
              fillcolor: withAlpha(c.orange, 0.1), line: { width: 0 }, layer: 'below',
            },
            ...(wheels !== 'single' ? [{
              type: 'rect' as const, xref: 'x' as const, yref: 'paper' as const,
              x0: Math.max(0, sd - a), x1: sd + a, y0: 0, y1: 1,
              fillcolor: withAlpha(c.orange, 0.1), line: { width: 0 }, layer: 'below' as const,
            }] : []),
          ],
        }), plotConfig);
      }
    })();
    return () => { dead = true; };
  }, [profile, basin, theme, h1, a, wheels, sd]);

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

        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="tl-e1">
              <span>E₁<Tip text="Modulus of the upper layer. Only the ratio E1/E2 enters the charts." /></span>
              <span className="cee-field__unit">psi / kPa</span>
            </label>
            <input id="tl-e1" className="cee-input" type="number" step="10000" min="1" value={E1s}
              onChange={e => setE1(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="tl-e2">
              <span>E₂<Tip text="Modulus of the subgrade half-space." /></span>
              <span className="cee-field__unit">psi / kPa</span>
            </label>
            <input id="tl-e2" className="cee-input" type="number" step="1000" min="1" value={E2s}
              onChange={e => setE2(e.target.value)} />
          </div>
        </div>

        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="tl-h1">
              <span>h₁<Tip text="Thickness of the upper layer." /></span>
              <span className="cee-field__unit">in / mm</span>
            </label>
            <input id="tl-h1" className="cee-input" type="number" step="0.5" min="0.1" value={h1s}
              onChange={e => setH1(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="tl-a">
              <span>Radius a</span>
              <span className="cee-field__unit">in / mm</span>
            </label>
            <input id="tl-a" className="cee-input" type="number" step="0.5" min="0.1" value={as_}
              onChange={e => setA(e.target.value)} />
          </div>
        </div>

        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="tl-q">
              <span>Pressure q</span>
              <span className="cee-field__unit">psi / kPa</span>
            </label>
            <input id="tl-q" className="cee-input" type="number" step="5" min="0.1" value={qs}
              onChange={e => setQ(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="tl-r">
              <span>Offset r<Tip text="Where on the interface to report the deflection factor F of Figure 2.19. Zero is under the load center." /></span>
              <span className="cee-field__unit">in / mm</span>
            </label>
            <input id="tl-r" className="cee-input" type="number" step="1" min="0" value={rs}
              onChange={e => setR(e.target.value)} />
          </div>
        </div>

        <div className="cee-field">
          <span className="cee-field__label"><span>Wheels</span></span>
          <div className="cee-seg">
            {(['single', 'dual', 'tandem'] as Wheels[]).map(w => (
              <button key={w} type="button" className={wheels === w ? 'is-active' : ''}
                onClick={() => setWheels(w)}>{w[0].toUpperCase() + w.slice(1)}</button>
            ))}
          </div>
        </div>
        {wheels !== 'single' && (
          <div className="cee-row">
            <div className="cee-field">
              <label className="cee-field__label" htmlFor="tl-sd">
                <span>Dual spacing S_d</span>
                <span className="cee-field__unit">in</span>
              </label>
              <input id="tl-sd" className="cee-input" type="number" step="0.5" min="0.1" value={sds}
                onChange={e => setSd(e.target.value)} />
            </div>
            {wheels === 'tandem' && (
              <div className="cee-field">
                <label className="cee-field__label" htmlFor="tl-st">
                  <span>Tandem spacing S_t</span>
                  <span className="cee-field__unit">in</span>
                </label>
                <input id="tl-st" className="cee-input" type="number" step="1" min="1" value={sts}
                  onChange={e => setSt(e.target.value)} />
              </div>
            )}
          </div>
        )}

        <h2 className="cee-panel__title" style={{ marginTop: '1rem' }}>Thickness design</h2>
        <div className="cee-field">
          <label className="cee-field__label" htmlFor="tl-target">
            <span>Allowable σc<Tip text="The interface stress the subgrade may carry. Example 2.5 uses 8 psi. The tool inverts Figure 2.15 for the thickness that delivers it." /></span>
            <span className="cee-field__unit">psi / kPa</span>
          </label>
          <input id="tl-target" className="cee-input" type="number" step="1" min="0.1" value={target}
            onChange={e => setTarget(e.target.value)} />
        </div>

        <p className="cee-hint">
          Huang (2004) §2.2.1. Both layers take <strong>ν = 0.5</strong>, as every chart in the
          section does. Fully bonded interface. Compression positive.
        </p>
      </aside>

      <div className="cee-results">
        <details className="cee-howto">
          <summary>How to use this tool</summary>
          <div className="cee-howto__body">
            <ol>
              <li><strong>Only two numbers matter to the charts:</strong> E₁/E₂ and h₁/a. Everything
                in §2.2.1 is dimensionless in those, which is why one page of curves serves every
                load and every section.</li>
              <li><strong>Each card is one figure.</strong> The chart value, the equation Huang
                applies to it, and the answer — so a hand solution can be checked line by line
                rather than only at the end.</li>
              <li><strong>Dual and tandem wheels go through the conversion factor</strong> of
                Figures 2.23 and 2.25–2.27: rescale to Sd = 24 in by Eq. 2.18, read both contact
                radii, interpolate with Eq. 2.19.</li>
              <li><strong>Design backwards</strong> with the allowable σc: the tool inverts
                Figure 2.15 for the thickness, the way Example 2.5 does.</li>
            </ol>
            Reproduces Examples 2.5 through 2.10 and Problem 2.4. Values are computed from the
            two-layer solution rather than read off the printed curves, so they will differ from a
            hand chart read by a percent or two — usually toward the KENLAYER answer Huang quotes
            beside each example.
          </div>
        </details>

        {!charts ? (
          <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>
            Enter positive moduli, a positive thickness and a positive load.
          </span></p>
        ) : (
          <>
            <KpiStrip>
              <Kpi accent label="E₁/E₂" value={fmt(ER, ER > 100 ? 0 : 1)}
                tip="The modulus ratio — with h₁/a, the only thing every chart in §2.2.1 depends on." />
              <Kpi label="h₁/a" value={fmt(hOverA, 3)}
                tip="Thickness in contact radii. Figure 2.15 plots its reciprocal, a/h₁." />
              <Kpi label="σc on subgrade" value={fmt(charts.sigmaC, 3)}
                tip="Vertical interface stress from Figure 2.15 — what the subgrade actually carries." />
              <Kpi label="Critical tensile strain"
                value={fmt((charts.eGroup ?? charts.e) * 1e6, 0)} unit="µε"
                tip="At the bottom of layer 1, from Figure 2.21 (times the conversion factor for a wheel group). This is what drives bottom-up fatigue cracking." />
            </KpiStrip>

            <div className="cee-card">
              <h3 className="cee-card__title">Every chart in §2.2.1, at this section</h3>
              <div className="cee-tablewrap">
                <table className="cee-table">
                  <thead>
                    <tr><th>Figure</th><th>Chart value</th><th>Equation</th><th>Answer</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>2.15 · interface stress</td>
                      <td>σc/q = {fmt(charts.sigmaC / q, 4)}</td>
                      <td><code>σc = q · (σc/q)</code></td>
                      <td>{fmt(charts.sigmaC, 3)}</td>
                    </tr>
                    <tr>
                      <td>2.13 · allowable repetitions</td>
                      <td>—</td>
                      <td><code>Nd = 4.873×10⁻⁵ σc⁻³·⁷³⁴ E₂³·⁵⁸³</code></td>
                      <td>{charts.Nd > 0 && Number.isFinite(charts.Nd) ? charts.Nd.toExponential(2) : '—'}</td>
                    </tr>
                    <tr>
                      <td>2.17 · surface deflection</td>
                      <td>F₂ = {fmt(charts.F2, 4)}</td>
                      <td><code>w₀ = 1.5·q·a·F₂/E₂</code></td>
                      <td>{fmt(charts.w0, 4)}</td>
                    </tr>
                    <tr>
                      <td>2.17 · rigid plate</td>
                      <td>F₂ = {fmt(charts.F2, 4)}</td>
                      <td><code>w₀ = 1.18·q·a·F₂/E₂</code></td>
                      <td>{fmt(charts.w0rigid, 4)}</td>
                    </tr>
                    <tr>
                      <td>2.19 · interface deflection at r = {fmt(rOff, 2)}</td>
                      <td>F = {fmt(charts.F, 4)}</td>
                      <td><code>w = q·a·F/E₂</code></td>
                      <td>{fmt(charts.wInterface, 4)}</td>
                    </tr>
                    <tr>
                      <td>2.21 · strain factor, single wheel</td>
                      <td>Fe = {fmt(charts.Fe, 4)}</td>
                      <td><code>e = q·Fe/E₁</code></td>
                      <td>{charts.e.toExponential(3)}</td>
                    </tr>
                    {charts.group && (
                      <>
                        <tr className="cee-table__rule">
                          <td>2.18 · rescaled to S_d = 24 in</td>
                          <td>a′ = {fmt(charts.group.modified.a, 3)}, h₁′ = {fmt(charts.group.modified.h1, 3)}
                            {charts.group.modified.st !== undefined && <>, S_t′ = {fmt(charts.group.modified.st, 1)}</>}</td>
                          <td><code>a′ = 24a/S_d</code></td>
                          <td>—</td>
                        </tr>
                        <tr>
                          <td>{wheels === 'dual' ? '2.23' : '2.25–2.27'} · conversion factor</td>
                          <td>C₁ = {fmt(charts.group.c1, 3)}, C₂ = {fmt(charts.group.c2, 3)}</td>
                          <td><code>C = C₁ + 0.2(a′ − 3)(C₂ − C₁)</code></td>
                          <td>{fmt(charts.group.C, 3)}</td>
                        </tr>
                        <tr>
                          <td>2.21 × C · strain, {wheels} wheels</td>
                          <td>Fe = {fmt(charts.group.groupFactor, 4)}</td>
                          <td><code>e = q·C·Fe/E₁</code></td>
                          <td>{charts.eGroup!.toExponential(3)}</td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
              {charts.group && wheels === 'tandem' && charts.group.C < 1.001 && (
                <p className="cee-note">
                  A conversion factor of essentially 1 means the tandem axle is far enough away to
                  do nothing at this thickness — the compensative effect Huang describes has
                  cancelled the extra load entirely.
                </p>
              )}
              <p className="cee-note">
                Every value here is computed from the two-layer solution, not read off the printed
                curve, so it may differ from a hand chart read by a percent or two. Where Huang
                quotes KENLAYER beside a chart answer, these numbers generally sit closer to
                KENLAYER — the chart is the lossy step, not the theory.
              </p>
            </div>

            {design && (
              <div className="cee-card cee-card--sunken">
                <h3 className="cee-card__title">Thickness for σc = {fmt(design.target, 2)}</h3>
                <p>
                  Figure 2.15 inverted: <code>a/h₁ = {fmt(design.aOverH1, 3)}</code>, so
                  {' '}<strong>h₁ = {fmt(design.h1, 2)}</strong> at a = {fmt(a, 2)}.
                  {' '}That layer would carry {allowableRepetitions(design.target, E2).toExponential(2)} repetitions
                  by Eq. 2.13.
                </p>
              </div>
            )}

            <div className="cee-chart-grid cee-chart-grid--2">
              <ChartFigure
                title="Vertical stress down the axis"
                subtitle="Figure 2.14, drawn for this section rather than for h₁/a = 1"
                plotRef={profRef}
                takeaway="The stiff upper layer sheds most of the applied pressure before it reaches the subgrade, and the interface is where the shedding shows."
              >
                Figure 2.14 is drawn once, for h₁/a = 1. This is the same curve for the section you
                actually have. <strong>The kink is at the interface</strong>: above it the stiff
                layer is spreading load sideways, below it the subgrade sees whatever is left —
                here {fmt((100 * charts.sigmaC) / q, 1)}% of the contact pressure.
              </ChartFigure>

              <ChartFigure
                title="Interface deflection basin"
                subtitle="Figure 2.19 across the radius. Tinted bands are the loaded circles."
                plotRef={basinRef}
                takeaway="The basin is far wider than the load, which is why a second wheel adds to the deflection under the first."
              >
                Example 2.7 reads this curve twice — once under the near wheel and once at the far
                one — and adds. <strong>The basin has no edge</strong>, so at a dual spacing of a
                few radii the second wheel is still contributing a third of the deflection under
                the first.
              </ChartFigure>
            </div>

            <p className="cee-note">
              Huang (2004) §2.2.1, Figures 2.14, 2.15, 2.17, 2.19, 2.21, 2.23 and 2.25–2.27,
              with Eqs. 2.13 through 2.19. Both layers are incompressible (ν = 0.5) and the
              interface is fully bonded, as every chart in the section assumes. The critical
              tensile strain is the overall principal strain on all six stress components,
              searched at r/a = 0, 0.5, 1 and 1.5 — Huang notes it is slightly greater than the
              horizontal principal strain KENLAYER reports, so it is on the safe side.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
