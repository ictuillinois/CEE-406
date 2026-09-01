// ESWL Comparator — four published ways to turn a set of duals into one
// wheel, shown together because they disagree.
//
// On Huang's own Example 6.1 configuration the four criteria give 5630, 6750,
// 7340 and 7410 lb. HW5 P3 asks a student to pick one for a thin pavement, a
// thick pavement and an airfield, and defend each choice separately. This
// tool exists to make that a real decision rather than a lookup.
//
// Huang's warning is printed on the page for a reason: "Erroneous results may
// be obtained if different ESWL methods are transposed for a given set of
// design curves." The criterion is part of the design method, not a free
// choice made afterwards.
//
// Physics in equations.ts, pinned to Examples 6.1, 6.2, 6.3 and 6.5.
import { useEffect, useMemo, useRef, useState } from 'react';
import Tip from '../Tip';
import {
  useTheme, chartColors, baseLayout, plotConfig, num, fmt,
  axis, gridAxis, HUES, type Mode,
} from '../chartTheme';
import ChartFigure from '../ui/ChartFigure';
import Card from '../ui/Card';
import KpiStrip, { Kpi } from '../ui/KpiStrip';
import {
  compareEswl, eswlBoydFoster, eswlEqualStress, eswlEqualDeflection,
  dualClearance, boydFosterAnchors, modifiedGeometry, candidatePoints,
} from './equations.ts';
import '../tools.css';

/** The four criteria are unordered alternatives, so categorical hues 1-4. */
const CRIT_HUE = {
  boyd: (t: Mode) => HUES[t].orange,
  stress: (t: Mode) => HUES[t].blue,
  deflection: (t: Mode) => HUES[t].emerald,
  strain: (t: Mode) => HUES[t].violet,
};

export default function EswlApp() {
  const [pdStr, setPd] = useState('4500');
  const [aStr, setA] = useState('4.5');
  const [sdStr, setSd] = useState('13.5');
  const [zStr, setZ] = useState('13.5');
  const [h1Str, setH1] = useState('8');
  const [cStr, setC] = useState('1.50');
  const [useStrain, setUseStrain] = useState(true);

  const Pd = num(pdStr, 4500), a = num(aStr, 4.5), Sd = num(sdStr, 13.5), z = num(zStr, 13.5);
  const C = num(cStr, 1.5);

  const clearance = dualClearance(Sd, a);
  const valid = Pd > 0 && a > 0 && Sd > 0 && z > 0 && clearance > 0;

  const cmp = useMemo(
    () => (valid ? compareEswl(Pd, z, Sd, a, useStrain ? C : undefined, 0.5) : null),
    [valid, Pd, z, Sd, a, C, useStrain]
  );

  const anchors = useMemo(() => boydFosterAnchors(Sd, a), [Sd, a]);
  const modified = useMemo(() => modifiedGeometry(a, num(h1Str, 8), Sd), [a, h1Str, Sd]);

  const theme = useTheme();
  const depthRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  /* ── How the criteria diverge with pavement thickness ── */
  useEffect(() => {
    if (!depthRef.current || !valid) return;
    let canceled = false;
    (async () => {
      const Plotly = (await import('plotly.js-dist-min')).default;
      if (canceled || !depthRef.current) return;
      const c = chartColors(theme);
      const zs: number[] = [];
      for (let t = Math.max(1, clearance / 2); t <= 2.2 * Sd; t += Math.max(0.5, Sd / 30)) zs.push(t);

      const traces: any[] = [
        {
          x: zs, y: zs.map(t => eswlBoydFoster(Pd, t, Sd, a)),
          name: 'Boyd & Foster', mode: 'lines',
          line: { color: CRIT_HUE.boyd(theme), width: 2.5 },
          hovertemplate: '%{x:.1f} in → %{y:,.0f} lb<extra>Boyd & Foster</extra>',
        },
        {
          x: zs, y: zs.map(t => eswlEqualStress(Pd, t, Sd, a)?.eswl ?? null),
          name: 'Equal stress', mode: 'lines',
          line: { color: CRIT_HUE.stress(theme), width: 2.5 },
          hovertemplate: '%{x:.1f} in → %{y:,.0f} lb<extra>equal stress</extra>',
        },
        {
          x: zs, y: zs.map(t => eswlEqualDeflection(Pd, t, Sd, a, 0.5)?.eswl ?? null),
          name: 'Equal deflection', mode: 'lines',
          line: { color: CRIT_HUE.deflection(theme), width: 2.5 },
          hovertemplate: '%{x:.1f} in → %{y:,.0f} lb<extra>equal deflection</extra>',
        },
      ];
      if (useStrain && C > 0) {
        traces.push({
          x: zs, y: zs.map(() => C * Pd),
          name: 'Equal strain', mode: 'lines',
          line: { color: CRIT_HUE.strain(theme), width: 2, dash: 'dash' },
          hovertemplate: '%{y:,.0f} lb<extra>equal strain (one chart read)</extra>',
        });
      }

      Plotly.react(depthRef.current, traces, baseLayout(theme, {
        height: 340,
        xaxis: axis(theme, 'Pavement thickness z (in)'),
        yaxis: gridAxis(theme, 'ESWL (lb)', { rangemode: 'tozero' as const }),
        hovermode: 'x unified',
        shapes: [
          { type: 'line', x0: z, x1: z, yref: 'paper', y0: 0, y1: 1, line: { color: c.ink, width: 1.5, dash: 'dot' } },
          { type: 'line', xref: 'paper', x0: 0, x1: 1, y0: 2 * Pd, y1: 2 * Pd, line: { color: c.secondary, width: 1, dash: 'dash' } },
          { type: 'line', xref: 'paper', x0: 0, x1: 1, y0: Pd, y1: Pd, line: { color: c.secondary, width: 1, dash: 'dash' } },
        ],
        annotations: [
          { xref: 'paper', x: 0.99, y: 2 * Pd, text: 'total load 2Pd', showarrow: false, yshift: 9, xanchor: 'right' as const, font: { size: 10, color: c.fg } },
          { xref: 'paper', x: 0.99, y: Pd, text: 'one wheel Pd', showarrow: false, yshift: 9, xanchor: 'right' as const, font: { size: 10, color: c.fg } },
        ],
      }), plotConfig);
    })();
    return () => { canceled = true; };
  }, [valid, Pd, Sd, a, z, C, useStrain, clearance, theme]);

  /* ── The four answers at the design thickness ── */
  useEffect(() => {
    if (!barRef.current || !cmp) return;
    let canceled = false;
    (async () => {
      const Plotly = (await import('plotly.js-dist-min')).default;
      if (canceled || !barRef.current) return;
      const c = chartColors(theme);
      const rows = [
        ['Boyd & Foster', cmp.boydFoster, CRIT_HUE.boyd(theme)],
        ['Equal deflection', cmp.equalDeflection?.eswl, CRIT_HUE.deflection(theme)],
        ['Equal strain', cmp.equalStrain, CRIT_HUE.strain(theme)],
        ['Equal stress', cmp.equalStress?.eswl, CRIT_HUE.stress(theme)],
      ].filter(r => typeof r[1] === 'number') as [string, number, string][];

      Plotly.react(barRef.current, [{
        type: 'bar', orientation: 'h',
        x: rows.map(r => r[1]), y: rows.map(r => r[0]),
        marker: { color: rows.map(r => r[2]), cornerradius: 6, line: { width: 0 } },
        text: rows.map(r => `${r[1].toLocaleString('en-US', { maximumFractionDigits: 0 })} lb`),
        textposition: 'outside',
        textfont: { family: 'IBM Plex Mono, monospace', size: 11.5, color: c.secondary },
        cliponaxis: false,
        hovertemplate: '%{y}: %{x:,.0f} lb<extra></extra>',
      }], baseLayout(theme, {
        height: 260,
        margin: { l: 130, r: 76, t: 8, b: 40 },
        bargap: 0.4,
        xaxis: axis(theme, 'ESWL (lb)', { range: [0, 2.2 * Pd] }),
        yaxis: axis(theme),
        shapes: [
          { type: 'line', x0: 2 * Pd, x1: 2 * Pd, yref: 'paper', y0: 0, y1: 1, line: { color: c.secondary, width: 1, dash: 'dash' } },
          { type: 'line', x0: Pd, x1: Pd, yref: 'paper', y0: 0, y1: 1, line: { color: c.secondary, width: 1, dash: 'dot' } },
        ],
      }), plotConfig);
    })();
    return () => { canceled = true; };
  }, [cmp, Pd, theme]);

  const pts = candidatePoints(Sd);

  return (
    <div className="cee-tool">
      <aside className="cee-panel">
        <h2 className="cee-panel__title">Dual wheels</h2>

        <div className="cee-presets">
          <button type="button" className="cee-chip"
            title="Huang Examples 6.1-6.3 and 6.5, pp. 246-254: 9000 lb total on duals at 13.5 in centers, 4.5 in contact radius, 13.5 in pavement. The four criteria should give 7410, 5630, 7340 and 6750 lb."
            onClick={() => {
              setPd('4500'); setA('4.5'); setSd('13.5'); setZ('13.5');
              setH1('8'); setC('1.50'); setUseStrain(true);
            }}>Huang Ex. 6.1–6.5</button>
        </div>

        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="e-pd">
              <span>Load per tire P<sub>d</sub><Tip text="Load on ONE of the dual tires. The total on the pair is twice this — and every criterion returns something between the two." /></span>
              <span className="cee-field__unit">lb</span>
            </label>
            <input id="e-pd" className="cee-input" type="number" step="250" value={pdStr}
              onChange={e => setPd(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="e-a">
              <span>Contact radius a</span><span className="cee-field__unit">in</span>
            </label>
            <input id="e-a" className="cee-input" type="number" step="0.25" value={aStr}
              onChange={e => setA(e.target.value)} />
          </div>
        </div>

        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="e-sd">
              <span>Dual spacing S<sub>d</sub><Tip text="Center to center. The clearance between the tires is this less two contact radii, and Boyd and Foster's construction is built on that clearance." /></span>
              <span className="cee-field__unit">in</span>
            </label>
            <input id="e-sd" className="cee-input" type="number" step="0.5" value={sdStr}
              onChange={e => setSd(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="e-z">
              <span>Pavement thickness z</span><span className="cee-field__unit">in</span>
            </label>
            <input id="e-z" className="cee-input" type="number" step="0.5" value={zStr}
              onChange={e => setZ(e.target.value)} />
          </div>
        </div>

        {valid && (
          <p className="cee-hint">
            Clearance d = {fmt(clearance, 2)} in. Boyd &amp; Foster anchors: ESWL = P<sub>d</sub> at
            z = {fmt(anchors.noOverlap, 2)} in, ESWL = 2P<sub>d</sub> at z = {fmt(anchors.fullOverlap, 1)} in.
          </p>
        )}

        <h2 className="cee-panel__title" style={{ marginTop: '1.5rem' }}>Equal tensile strain</h2>
        <p className="cee-hint" style={{ marginTop: '-0.35rem' }}>
          The only criterion that knows the pavement is layered. Its conversion factor comes off
          Huang Figure 2.23 — a chart read, so you supply it.
        </p>

        <label className="cee-field__label">
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input type="checkbox" checked={useStrain} onChange={e => setUseStrain(e.target.checked)} />
            Include the strain criterion
          </span>
        </label>

        {useStrain && (
          <>
            <div className="cee-row" style={{ marginTop: '0.5rem' }}>
              <div className="cee-field">
                <label className="cee-field__label" htmlFor="e-h1">
                  <span>AC thickness h₁</span><span className="cee-field__unit">in</span>
                </label>
                <input id="e-h1" className="cee-input" type="number" step="0.5" value={h1Str}
                  onChange={e => setH1(e.target.value)} />
              </div>
              <div className="cee-field">
                <label className="cee-field__label" htmlFor="e-c">
                  <span>Factor C<Tip text="Conversion factor from Figure 2.23 (or 2.25-2.27), entered at the modified geometry shown below." /></span>
                </label>
                <input id="e-c" className="cee-input" type="number" step="0.05" value={cStr}
                  onChange={e => setC(e.target.value)} />
              </div>
            </div>
            <p className="cee-hint">
              Enter the chart at the modified geometry (Eq. 2.18, scaled to a 24 in spacing):
              a′ = {fmt(modified.aPrime, 2)} in, h₁′ = {fmt(modified.h1Prime, 2)} in.
            </p>
          </>
        )}
      </aside>

      <div className="cee-results">
        <details className="cee-howto">
          <summary>How to use this tool</summary>
          <div className="cee-howto__body">
            <ol>
              <li><strong>Calibrate.</strong> Load the Huang preset and confirm 7410, 5630, 7340 and 6750 lb — four published answers to one question.</li>
              <li><strong>Read the divergence chart, not the number.</strong> The criteria agree at the extremes and disagree in the middle, which is exactly where real pavements sit.</li>
              <li><strong>Notice which response governs where.</strong> Stress peaks midway between the tires; deflection peaks at the center of the pair, because deflection spreads further than stress.</li>
              <li><strong>Then choose</strong> — and know that the choice is not free. Each criterion was built to feed a particular set of design curves.</li>
            </ol>
            HW5 P3 asks which you would use for a thin pavement, a thick pavement, and an airfield.
            The three answers are not the same, and the reasons are more interesting than the numbers.
          </div>
        </details>

        {!valid ? (
          <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>
            Enter a positive load, radius, spacing and thickness. The dual spacing must exceed twice
            the contact radius, or the tires overlap and there is no clearance for Boyd and Foster's
            construction to use.
          </span></p>
        ) : cmp && (
          <>
            <KpiStrip>
              <Kpi accent label="Spread across criteria" value={fmt(cmp.spreadPct, 0)} unit="%"
                tip="How far apart the published methods are for this geometry. It is widest at intermediate thicknesses, which is where highway pavements live." />
              <Kpi label="Lowest" value={fmt(cmp.range[0], 0)} unit="lb"
                tip="The least conservative criterion at this thickness." />
              <Kpi label="Highest" value={fmt(cmp.range[1], 0)} unit="lb"
                tip="The most conservative. Designing to it costs material; designing to the lowest costs pavement life." />
              <Kpi label="Total on the duals" value={fmt(cmp.totalLoad, 0)} unit="lb"
                tip="Every criterion must return something between one wheel load and the total — those are the physical bounds." />
            </KpiStrip>

            <p className="cee-warn" style={{ background: 'transparent' }}>
              <span className="cee-warn__icon">⚖️</span><span>
                Four published methods, <strong>{fmt(cmp.spreadPct, 0)}% apart</strong> on this
                geometry. Huang's instruction is not to average them: <em>"Erroneous results may be
                obtained if different ESWL methods are transposed for a given set of design
                curves."</em> The criterion belongs to the design method it was calibrated with.
              </span>
            </p>

            <ChartFigure
              title="Where the criteria diverge"
              subtitle="ESWL against pavement thickness; the dotted vertical line is your design thickness"
              plotRef={depthRef}
              legend={[
                { label: 'Boyd & Foster (empirical)', color: CRIT_HUE.boyd(theme) },
                { label: 'Equal stress (Boussinesq)', color: CRIT_HUE.stress(theme) },
                { label: 'Equal deflection', color: CRIT_HUE.deflection(theme) },
                ...(useStrain ? [{ label: 'Equal strain (layered)', color: CRIT_HUE.strain(theme), shape: 'dash' as const }] : []),
              ]}
              takeaway={`At ${fmt(z, 1)} in the four criteria span ${fmt(cmp.range[0], 0)} to ${fmt(cmp.range[1], 0)} lb, a spread of ${fmt(cmp.spreadPct, 0)}%.`}
            >
              All the criteria have to agree at the two extremes — a very thin pavement feels two
              separate wheels, a very thick one feels a single blur — so <strong>they can only
              disagree in between</strong>. That is not a defect of the theory; it is where the
              physics stops being obvious and a modeling choice has to be made. Highway pavements
              sit squarely in that band. Note also that the equal-strain criterion does not vary with
              thickness here: its conversion factor is a single chart read at one geometry, so it is
              a point, not a curve.
            </ChartFigure>

            <ChartFigure
              title={`The four answers at z = ${fmt(z, 1)} in`}
              subtitle="Bounded below by one wheel load and above by the total on the pair"
              plotRef={barRef}
              takeaway={`Boyd and Foster gives ${fmt(cmp.boydFoster, 0)} lb; the theoretical equal-stress criterion gives ${cmp.equalStress ? fmt(cmp.equalStress.eswl, 0) : '—'} lb.`}
            >
              Huang's comment on the two that come out closest is worth quoting: <em>"The close
              agreement between the two methods is a coincidence."</em> Boyd and Foster's method is
              an empirical straight line on log-log paper between two anchors; Foster and Ahlvin's is
              an elastic deflection calculation. That they land within 1% of each other here says
              nothing about either, and Huang warns that at other thicknesses and geometries they
              part company.
            </ChartFigure>

            {cmp.equalStress && cmp.equalDeflection && (
              <Card title="Where the maximum actually occurs"
                subtitle="Three candidate points under the duals — Huang Figure 6.3">
                <div className="cee-tablewrap">
                  <table className="cee-table">
                    <thead>
                      <tr>
                        <th>Point</th><th>Offset from one tire</th>
                        <th>σ<sub>z</sub> factor</th><th>Deflection factor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {['Under one tire', 'Quarter of the spacing', 'Center of the pair'].map((label, i) => (
                        <tr key={label}>
                          <td>
                            {label}
                            {cmp.equalStress!.governingPoint === i && <strong> · governs stress</strong>}
                            {cmp.equalDeflection!.governingPoint === i && <strong> · governs deflection</strong>}
                          </td>
                          <td>{fmt(pts[i], 2)} in</td>
                          <td>{fmt(cmp.equalStress!.factors[i], 4)}</td>
                          <td>{fmt(cmp.equalDeflection!.factors[i], 4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="cee-note" style={{ marginTop: '0.75rem' }}>
                  <strong>Stress and deflection peak in different places.</strong> Stress is the more
                  local of the two, so it is largest near a tire; deflection spreads much further, so
                  the two bowls add up most in the middle. That single difference is why the two
                  criteria give different ESWLs — and why the answer to "where is the critical point"
                  depends on which response you are designing against.
                </p>
              </Card>
            )}

            <Card title="What each criterion assumes"
              subtitle="Which is really the question HW5 P3 is asking">
              <div className="cee-tablewrap">
                <table className="cee-table">
                  <thead>
                    <tr><th>Criterion</th><th>Assumes</th><th>Blind to</th><th>ESWL</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Boyd &amp; Foster <span className="cee-field__unit">Eq. 6.1</span></td>
                      <td>a log-log straight line between two geometric anchors</td>
                      <td>material properties entirely — no E, no ν, no layers</td>
                      <td>{fmt(cmp.boydFoster, 0)} lb</td>
                    </tr>
                    <tr>
                      <td>Equal stress <span className="cee-field__unit">Eq. 6.3</span></td>
                      <td>a homogeneous half-space; failure driven by subgrade stress</td>
                      <td>the asphalt layer, and anything happening above the subgrade</td>
                      <td>{cmp.equalStress ? fmt(cmp.equalStress.eswl, 0) : '—'} lb</td>
                    </tr>
                    <tr>
                      <td>Equal deflection <span className="cee-field__unit">Eq. 6.6</span></td>
                      <td>a half-space; failure driven by total deflection</td>
                      <td>the same layer structure, but errs larger and so safer</td>
                      <td>{cmp.equalDeflection ? fmt(cmp.equalDeflection.eswl, 0) : '—'} lb</td>
                    </tr>
                    <tr>
                      <td>Equal strain <span className="cee-field__unit">Eq. 6.14</span></td>
                      <td>a two-layer system; failure driven by fatigue cracking</td>
                      <td>the subgrade — it is looking at the bottom of the asphalt</td>
                      <td>{cmp.equalStrain ? fmt(cmp.equalStrain, 0) : '—'} lb</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="cee-note" style={{ marginTop: '0.75rem' }}>
                Read the third column rather than the fourth. A <strong>thin</strong> pavement fails
                by fatigue at the bottom of a thin asphalt layer, so the strain criterion is asking
                the right question. A <strong>thick</strong> one protects a subgrade, so the stress
                or deflection criteria are. An <strong>airfield</strong>, with far higher loads and
                far fewer repetitions, is a different problem again — and Huang notes the whole ESWL
                idea began there, with the B-29, precisely because the single-wheel design curves of
                the day had nothing else to offer.
              </p>
            </Card>

            <p className="cee-note">
              Boyd and Foster (1950), Huang Eq. 6.1. Equal vertical stress, Eq. 6.3, superposed from
              the Boussinesq kernel rather than read off Figure 2.2. Foster and Ahlvin (1958) equal
              deflection, Eq. 6.6, likewise integrated rather than charted. Equal tensile strain,
              Eq. 6.14, with the conversion factor read from Figure 2.23 at the modified geometry of
              Eq. 2.18. Validated against the printed answers of Examples 6.1, 6.2, 6.3 and 6.5.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
