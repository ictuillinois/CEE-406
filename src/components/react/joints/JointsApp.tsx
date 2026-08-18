// Joints & Load Transfer — the half of rigid design that is not slab thickness.
//
// HW9 asks a student to choose a joint spacing and defend it against three
// failure modes that pull in different directions: curling wants short slabs,
// steel and sealant cost money at every joint, and a joint that opens too far
// loses aggregate interlock and starts faulting. This tool makes each side
// computable; it does not resolve the tension, because that is the homework.
//
// It also carries a live disagreement. Friberg (1940) put the dowel load
// reach at 1.8L; Heinrichs et al. (1989) found 1.0L, which concentrates the
// load and raises the bearing stress. Huang prints both and works his
// examples with the older one.
//
// Physics in equations.ts, pinned to Examples 4.8, 4.9, 4.11, 4.12 and 4.13.
import { useEffect, useMemo, useRef, useState } from 'react';
import Tip from '../Tip';
import {
  useTheme, chartColors, baseLayout, plotConfig, num, fmt,
  axis, gridAxis, hueFor, HUES, type Mode,
} from '../chartTheme';
import ChartFigure from '../ui/ChartFigure';
import Card from '../ui/Card';
import KpiStrip, { Kpi } from '../ui/KpiStrip';
import {
  frictionStress, concreteTensileStrength, maxJointSpacing, jointOpening,
  tieBars, allowableBearingStress, dowelBearingStress, dowelBeta, dowelInertia,
  dowelGroup, dowelLoads, dowelPositions, faulting, FAULTING_BEARING_LIMIT,
  FAULTING_DATA_RANGE, faultingInRange, suggestedDowel,
} from './equations.ts';
import { radiusOfRelativeStiffness } from '../westergaard/equations.ts';
import '../tools.css';

/** The two reach conventions are unordered alternatives, so hues 1 and 2. */
const REACH_HUE = {
  friberg: (t: Mode) => HUES[t].orange,
  heinrichs: (t: Mode) => HUES[t].blue,
};

interface LoadRow { id: number; pos: string; W: string }
let nextId = 100;

export default function JointsApp() {
  // Slab and foundation
  const [hStr, setH] = useState('8');
  const [kStr, setK] = useState('100');
  const [eStr, setE] = useState('4000000');
  const [fcStr, setFc] = useState('3000');
  // Dowels
  const [dStr, setD] = useState('0.75');
  const [spacingStr, setSpacing] = useState('12');
  const [edgeStr, setEdge] = useState('6');
  const [laneStr, setLane] = useState('144');
  const [zStr, setZ] = useState('0.2');
  const [kdStr, setKd] = useState('1500000');
  // Wheel loads along the joint
  const [loads, setLoads] = useState<LoadRow[]>([{ id: nextId++, pos: '6', W: '9000' }]);
  // Joint spacing / thermal
  const [jsStr, setJs] = useState('15');          // ft
  const [dTStr, setDT] = useState('60');
  const [alphaStr, setAlpha] = useState('5.5e-6');
  const [epsStr, setEps] = useState('1.0e-4');
  const [cStr, setC] = useState('0.65');
  // Traffic, for faulting
  const [n18Str, setN18] = useState('10');
  // Tie bars
  const [fsStr, setFs] = useState('27000');
  const [barAreaStr, setBarArea] = useState('0.2');
  const [barDiaStr, setBarDia] = useState('0.5');

  const h = num(hStr, 8), k = num(kStr, 100), E = num(eStr, 4e6), fc = num(fcStr, 3000);
  const d = num(dStr, 0.75), z = num(zStr, 0.2), Kd = num(kdStr, 1.5e6);
  const lane = num(laneStr, 144), spacing = num(spacingStr, 12), edge = num(edgeStr, 6);
  const JS = num(jsStr, 15);

  const valid = h > 0 && k > 0 && E > 0 && d > 0 && spacing > 0 && lane > 0;

  const ell = useMemo(
    () => (valid ? radiusOfRelativeStiffness(E, h, 0.15, k) : NaN),
    [valid, E, h, k]
  );

  const positions = useMemo(
    () => (valid ? dowelPositions(lane, spacing, edge) : []),
    [valid, lane, spacing, edge]
  );

  const loadList = useMemo(
    () => loads
      .map(l => ({ pos: num(l.pos, NaN), W: num(l.W, NaN) }))
      .filter(l => Number.isFinite(l.pos) && l.W > 0),
    [loads]
  );

  /* ── The same dowel group under both published conventions ── */
  const byReach = useMemo(() => {
    if (!valid || !positions.length || !loadList.length) return null;
    const run = (reach: number, transfer: number) => {
      const per = dowelLoads(loadList, positions, ell, reach, transfer);
      if (!per) return null;
      const critical = Math.max(...per);
      return {
        per, critical,
        stress: dowelBearingStress(critical, d, z, Kd),
        effective: dowelGroup(loadList[0].pos, positions, ell, loadList[0].W, reach, transfer)?.effectiveDowels ?? NaN,
        reachIn: reach * ell,
      };
    };
    return {
      friberg: run(1.8, 0.5),
      heinrichs: run(1.0, 0.5),
      faultingConv: run(1.0, 0.45),
    };
  }, [valid, positions, loadList, ell, d, z, Kd]);

  const allowable = useMemo(() => allowableBearingStress(d, fc), [d, fc]);

  /* ── Faulting, on the convention §12.1.4 actually specifies ── */
  const fault = useMemo(() => {
    if (!byReach?.faultingConv) return null;
    const S = byReach.faultingConv.stress;
    return {
      S,
      inches: faulting(num(n18Str, 10), S, JS, k),
      atLimit: faulting(num(n18Str, 10), FAULTING_BEARING_LIMIT, JS, k),
      inRange: faultingInRange(S),
    };
  }, [byReach, n18Str, JS, k]);

  /* ── Joint spacing limits ── */
  const spacingLimits = useMemo(() => {
    const dT = num(dTStr, 60), a = num(alphaStr, 5.5e-6), e = num(epsStr, 1e-4), C = num(cStr, 0.65);
    return {
      undoweled: maxJointSpacing(0.05, dT, a, e, C) / 12,
      doweled: maxJointSpacing(0.25, dT, a, e, C) / 12,
      opening: jointOpening(JS * 12, dT, a, e, C),
      friction: frictionStress(JS * 12, 1.5),
      tensile: concreteTensileStrength(fc),
      ruleOfThumb: 2 * h,   // "joint spacing in feet not much more than twice the thickness in inches"
    };
  }, [dTStr, alphaStr, epsStr, cStr, JS, fc, h]);

  const ties = useMemo(
    () => tieBars(h, lane, num(fsStr, 27000), num(barAreaStr, 0.2), num(barDiaStr, 0.5)),
    [h, lane, fsStr, barAreaStr, barDiaStr]
  );

  const theme = useTheme();
  const forceRef = useRef<HTMLDivElement>(null);
  const faultRef = useRef<HTMLDivElement>(null);

  /* ── Load carried by each dowel, both conventions ── */
  useEffect(() => {
    if (!forceRef.current || !byReach?.friberg || !byReach?.heinrichs) return;
    let cancelled = false;
    (async () => {
      const Plotly = (await import('plotly.js-dist-min')).default;
      if (cancelled || !forceRef.current) return;
      Plotly.react(forceRef.current, [
        {
          x: positions, y: byReach.friberg.per, type: 'bar',
          name: 'Friberg 1.8ℓ',
          marker: { color: REACH_HUE.friberg(theme), cornerradius: 4, line: { width: 0 } },
          hovertemplate: '%{x} in from edge · %{y:,.0f} lb<extra>Friberg</extra>',
        },
        {
          x: positions, y: byReach.heinrichs.per, type: 'bar',
          name: 'Heinrichs 1.0ℓ',
          marker: { color: REACH_HUE.heinrichs(theme), cornerradius: 4, line: { width: 0 } },
          hovertemplate: '%{x} in from edge · %{y:,.0f} lb<extra>Heinrichs</extra>',
        },
      ], baseLayout(theme, {
        height: 320,
        barmode: 'group',
        bargap: 0.3,
        xaxis: axis(theme, 'Distance along the joint from the pavement edge (in)'),
        yaxis: gridAxis(theme, 'Load carried by that dowel (lb)'),
        hovermode: 'x unified',
      }), plotConfig);
    })();
    return () => { cancelled = true; };
  }, [byReach, positions, theme]);

  /* ── Faulting against bearing stress, Huang Figure 12.5 ── */
  useEffect(() => {
    if (!faultRef.current || !fault) return;
    let cancelled = false;
    (async () => {
      const Plotly = (await import('plotly.js-dist-min')).default;
      if (cancelled || !faultRef.current) return;
      const c = chartColors(theme);
      const hue = hueFor('damage', theme);
      const xs = Array.from({ length: 60 }, (_, i) => 1000 + (i * 2500) / 59);
      const n18 = num(n18Str, 10);
      Plotly.react(faultRef.current, [
        {
          x: xs, y: xs.map(S => faulting(n18, S, JS, k)),
          mode: 'lines', line: { color: hue, width: 2.5 },
          hovertemplate: '%{x:,.0f} psi → %{y:.3f} in<extra></extra>',
        },
        {
          x: [fault.S], y: [fault.inches], mode: 'markers',
          marker: { color: hue, size: 11, line: { color: c.surface, width: 2 } },
          hovertemplate: 'your design: %{x:,.0f} psi → %{y:.3f} in<extra></extra>',
        },
      ], baseLayout(theme, {
        height: 300,
        xaxis: axis(theme, 'Maximum dowel bearing stress (psi)'),
        yaxis: gridAxis(theme, 'Predicted faulting (in)', { rangemode: 'tozero' as const }),
        hovermode: 'closest',
        shapes: [{
          type: 'line', x0: FAULTING_BEARING_LIMIT, x1: FAULTING_BEARING_LIMIT,
          yref: 'paper', y0: 0, y1: 1,
          line: { color: c.secondary, width: 1, dash: 'dash' },
        }],
        annotations: [{
          x: FAULTING_BEARING_LIMIT, yref: 'paper', y: 1.02,
          text: '1500 psi', showarrow: false, font: { size: 10, color: c.fg },
        }],
      }), plotConfig);
    })();
    return () => { cancelled = true; };
  }, [fault, n18Str, JS, k, theme]);

  const updateLoad = (id: number, patch: Partial<LoadRow>) =>
    setLoads(ls => ls.map(l => (l.id === id ? { ...l, ...patch } : l)));

  const sug = suggestedDowel(h);

  return (
    <div className="cee-tool">
      <aside className="cee-panel">
        <h2 className="cee-panel__title">Slab</h2>

        <div className="cee-presets">
          <button type="button" className="cee-chip"
            title="Huang Example 4.12, p. 174: 8 in slab, k = 100 pci, 0.75 in dowels at 12 in centres, 0.2 in joint, K = 1.5e6 pci, one 9000 lb load over the outermost dowel. Should give 3.27 effective dowels, 1376 lb, and 3556 psi against an allowable 3250."
            onClick={() => {
              setH('8'); setK('100'); setE('4000000'); setFc('3000');
              setD('0.75'); setSpacing('12'); setEdge('6'); setLane('84'); setZ('0.2'); setKd('1500000');
              setLoads([{ id: nextId++, pos: '6', W: '9000' }]);
            }}>Huang Ex. 4.12</button>
          <button type="button" className="cee-chip"
            title="Huang Example 4.13, p. 176: 9.5 in slab on k = 50 pci, twelve dowels at 12 in centres across a 12 ft lane, two 9000 lb loads 72 in apart. The edge dowel should carry 1191 lb."
            onClick={() => {
              setH('9.5'); setK('50'); setE('4000000'); setFc('3000');
              setD('0.75'); setSpacing('12'); setEdge('6'); setLane('144'); setZ('0.2'); setKd('1500000');
              setLoads([{ id: nextId++, pos: '6', W: '9000' }, { id: nextId++, pos: '78', W: '9000' }]);
            }}>Huang Ex. 4.13</button>
        </div>

        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="j-h">
              <span>Thickness h</span><span className="cee-field__unit">in</span>
            </label>
            <input id="j-h" className="cee-input" type="number" step="0.5" value={hStr}
              onChange={e => setH(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="j-k">
              <span>Subgrade k</span><span className="cee-field__unit">pci</span>
            </label>
            <input id="j-k" className="cee-input" type="number" step="10" value={kStr}
              onChange={e => setK(e.target.value)} />
          </div>
        </div>

        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="j-e">
              <span>Concrete E</span><span className="cee-field__unit">psi</span>
            </label>
            <input id="j-e" className="cee-input" type="number" step="100000" value={eStr}
              onChange={e => setE(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="j-fc">
              <span>f′<sub>c</sub><Tip text="Compressive strength, which sets the allowable bearing stress through Eq. 4.41 — not the modulus of rupture used for slab thickness." /></span>
              <span className="cee-field__unit">psi</span>
            </label>
            <input id="j-fc" className="cee-input" type="number" step="100" value={fcStr}
              onChange={e => setFc(e.target.value)} />
          </div>
        </div>
        {valid && <p className="cee-hint">ℓ = {fmt(ell, 2)} in · 1.8ℓ = {fmt(1.8 * ell, 1)} in · 1.0ℓ = {fmt(ell, 1)} in.</p>}

        <h2 className="cee-panel__title" style={{ marginTop: '1.5rem' }}>Dowels</h2>
        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="j-d">
              <span>Diameter<Tip text="PCA's older rule is one eighth of the slab thickness; PCA (1991) moved to a flat 1.25 in for highway pavements." /></span>
              <span className="cee-field__unit">in</span>
            </label>
            <input id="j-d" className="cee-input" type="number" step="0.125" value={dStr}
              onChange={e => setD(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="j-sp">
              <span>Spacing</span><span className="cee-field__unit">in</span>
            </label>
            <input id="j-sp" className="cee-input" type="number" step="1" value={spacingStr}
              onChange={e => setSpacing(e.target.value)} />
          </div>
        </div>
        <p className="cee-hint">
          PCA rule of thumb for h = {fmt(h, 1)} in: {fmt(sug.diameter, 2)} in diameter,
          {' '}{sug.length} in long, {sug.spacing} in centres.
        </p>

        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="j-lane">
              <span>Lane width</span><span className="cee-field__unit">in</span>
            </label>
            <input id="j-lane" className="cee-input" type="number" step="6" value={laneStr}
              onChange={e => setLane(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="j-edge">
              <span>Edge offset</span><span className="cee-field__unit">in</span>
            </label>
            <input id="j-edge" className="cee-input" type="number" step="1" value={edgeStr}
              onChange={e => setEdge(e.target.value)} />
          </div>
        </div>

        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="j-z">
              <span>Joint width z</span><span className="cee-field__unit">in</span>
            </label>
            <input id="j-z" className="cee-input" type="number" step="0.05" value={zStr}
              onChange={e => setZ(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="j-kd">
              <span>Dowel support K<Tip text="Modulus of dowel support, 300,000 to 1,500,000 pci. It is the stiffness of the concrete bearing against the bar, not the subgrade." /></span>
              <span className="cee-field__unit">pci</span>
            </label>
            <input id="j-kd" className="cee-input" type="number" step="100000" value={kdStr}
              onChange={e => setKd(e.target.value)} />
          </div>
        </div>

        <div className="cee-field">
          <span className="cee-field__label">
            <span>Wheel loads<Tip text="Position along the joint measured from the pavement edge, and the load. The critical dowel is usually the one nearest the edge, not the one under the heaviest wheel." /></span>
            <span className="cee-field__unit">in · lb</span>
          </span>
          {loads.map(l => (
            <div className="cee-axle-row cee-axle-row--2" key={l.id}>
              <input className="cee-input" type="number" step="1" value={l.pos}
                aria-label="Load position (in)" onChange={e => updateLoad(l.id, { pos: e.target.value })} />
              <input className="cee-input" type="number" step="500" value={l.W}
                aria-label="Wheel load (lb)" onChange={e => updateLoad(l.id, { W: e.target.value })} />
              {loads.length > 1 && (
                <button className="cee-axle-remove" type="button" aria-label="Remove load"
                  onClick={() => setLoads(ls => ls.filter(x => x.id !== l.id))}>×</button>
              )}
            </div>
          ))}
          <button className="cee-btn cee-btn--ghost cee-btn--sm" type="button"
            onClick={() => setLoads(ls => [...ls, { id: nextId++, pos: '78', W: '9000' }])}>+ Add load</button>
        </div>

        <h2 className="cee-panel__title" style={{ marginTop: '1.5rem' }}>Joint spacing</h2>
        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="j-js">
              <span>Spacing</span><span className="cee-field__unit">ft</span>
            </label>
            <input id="j-js" className="cee-input" type="number" step="1" value={jsStr}
              onChange={e => setJs(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="j-dt">
              <span>ΔT<Tip text="Placement temperature minus the lowest mean monthly temperature — the range the joint has to accommodate." /></span>
              <span className="cee-field__unit">°F</span>
            </label>
            <input id="j-dt" className="cee-input" type="number" step="5" value={dTStr}
              onChange={e => setDT(e.target.value)} />
          </div>
        </div>
        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="j-a">
              <span>α<sub>t</sub></span><span className="cee-field__unit">/°F</span>
            </label>
            <input id="j-a" className="cee-input" type="text" value={alphaStr}
              onChange={e => setAlpha(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="j-eps">
              <span>Shrinkage ε</span>
            </label>
            <input id="j-eps" className="cee-input" type="text" value={epsStr}
              onChange={e => setEps(e.target.value)} />
          </div>
        </div>
        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="j-c">
              <span>Base factor C<Tip text="0.65 for a stabilised base, 0.80 for granular." /></span>
            </label>
            <input id="j-c" className="cee-input" type="number" step="0.05" value={cStr}
              onChange={e => setC(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="j-n18">
              <span>Traffic N₁₈</span><span className="cee-field__unit">millions</span>
            </label>
            <input id="j-n18" className="cee-input" type="number" step="1" value={n18Str}
              onChange={e => setN18(e.target.value)} />
          </div>
        </div>

        <h2 className="cee-panel__title" style={{ marginTop: '1.5rem' }}>Tie bars</h2>
        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="j-fs">
              <span>Steel f<sub>s</sub></span><span className="cee-field__unit">psi</span>
            </label>
            <input id="j-fs" className="cee-input" type="number" step="1000" value={fsStr}
              onChange={e => setFs(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="j-ba">
              <span>Bar area</span><span className="cee-field__unit">in²</span>
            </label>
            <input id="j-ba" className="cee-input" type="number" step="0.01" value={barAreaStr}
              onChange={e => setBarArea(e.target.value)} />
          </div>
        </div>
        <div className="cee-field">
          <label className="cee-field__label" htmlFor="j-bd">
            <span>Bar diameter</span><span className="cee-field__unit">in</span>
          </label>
          <input id="j-bd" className="cee-input" type="number" step="0.125" value={barDiaStr}
            onChange={e => setBarDia(e.target.value)} />
        </div>
      </aside>

      <div className="cee-results">
        <details className="cee-howto">
          <summary>How to use this tool</summary>
          <div className="cee-howto__body">
            <ol>
              <li><strong>Calibrate.</strong> Load Huang Ex. 4.12 and confirm 3.27 effective dowels, 1376 lb, 3556 psi against an allowable 3250 — a design the book calls unsatisfactory.</li>
              <li><strong>Find the critical dowel.</strong> It is normally the one nearest the pavement edge, and with two wheels on the slab it is not necessarily under either of them.</li>
              <li><strong>Choose a reach convention.</strong> Friberg's 1.8ℓ is what Huang's examples use; Heinrichs' 1.0ℓ is what he says is correct. They give different answers, and one of them may fail your design.</li>
              <li><strong>Then check faulting</strong>, which §12.1.4 computes on a third convention again — 1.0ℓ and 0.45W.</li>
              <li><strong>Now argue about joint spacing.</strong> Three limits pull against each other: the opening the sealant and aggregate interlock can tolerate, the friction stress in the slab, and faulting. Say which you let govern.</li>
            </ol>
            Nothing here decides the design. It makes each constraint visible so the defense can be
            about engineering rather than about arithmetic.
          </div>
        </details>

        {!valid || !byReach?.friberg ? (
          <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>
            Enter a positive slab thickness, subgrade modulus, dowel diameter and spacing, and at
            least one wheel load positioned on the lane.
          </span></p>
        ) : (
          <>
            <KpiStrip>
              <Kpi accent label="Critical dowel load" value={fmt(byReach.friberg.critical, 0)} unit="lb"
                tip="The largest load any single dowel carries, on Friberg's 1.8ℓ convention — the one Huang's worked examples use." />
              <Kpi label="Bearing stress" value={fmt(byReach.friberg.stress, 0)} unit="psi"
                tip="Between dowel and concrete, Huang Eq. 4.45. This, not the steel, is what governs dowel design." />
              <Kpi label="Allowable" value={fmt(allowable, 0)} unit="psi"
                tip="ACI Eq. 4.41: (4 − d)f′c/3. Note it FALLS as the dowel gets bigger — it is a concrete criterion, not a steel one." />
              <Kpi label="Predicted faulting"
                value={fault && Number.isFinite(fault.inches)
                  ? (fault.inRange ? fmt(fault.inches, 3) : `≫ ${fmt(fault.inches, 2)}`)
                  : '—'}
                unit="in"
                tip="Huang Eq. 12.3, the COPES regression, computed on the §12.1.4 convention of 1.0ℓ and 0.45W. Shown with a warning marker when the bearing stress falls outside the 1000-3500 psi range the model was fitted over." />
            </KpiStrip>

            {byReach.friberg.stress > allowable && (
              <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>
                Bearing stress <strong>{fmt(byReach.friberg.stress, 0)} psi</strong> exceeds the
                allowable <strong>{fmt(allowable, 0)} psi</strong> by{' '}
                {fmt(100 * (byReach.friberg.stress / allowable - 1), 0)}%. Use larger dowels or
                closer spacing. (On Huang's Example 4.12 this is the correct verdict — the book's own
                design fails by about 10%.)
              </span></p>
            )}

            {byReach.heinrichs && byReach.friberg.stress <= allowable &&
              byReach.heinrichs.stress > allowable && (
              <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>
                This design passes on <strong>Friberg's 1.8ℓ</strong> ({fmt(byReach.friberg.stress, 0)} psi)
                and <strong>fails on Heinrichs' 1.0ℓ</strong> ({fmt(byReach.heinrichs.stress, 0)} psi
                against {fmt(allowable, 0)} allowable). Huang works his examples with the first and
                says the second is correct. <strong>You have to choose, and say so.</strong>
              </span></p>
            )}

            {fault && !fault.inRange && Number.isFinite(fault.inches) && (
              <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>
                The faulting number above is an <strong>extrapolation</strong>. Eq. 12.3 was fitted
                over bearing stresses of {FAULTING_DATA_RANGE[0]}–{FAULTING_DATA_RANGE[1]} psi and
                this design sits at <strong>{fmt(fault.S, 0)} psi</strong>. Huang's instruction is
                explicit — the model "must not be used to predict faulting by extrapolation beyond
                the data range used in its generation". Treat {fmt(fault.inches, 2)} in as evidence
                the dowels are badly overstressed, not as a prediction.
              </span></p>
            )}

            <ChartFigure
              title="Load carried by each dowel"
              subtitle="The same wheel loads shared over the group by the two published reach conventions"
              plotRef={forceRef}
              legend={[
                { label: 'Friberg 1.8ℓ (Huang’s examples)', color: REACH_HUE.friberg(theme) },
                { label: 'Heinrichs 1.0ℓ (Huang says correct)', color: REACH_HUE.heinrichs(theme) },
              ]}
              takeaway={`The critical dowel carries ${fmt(byReach.friberg.critical, 0)} lb on Friberg's convention and ${byReach.heinrichs ? fmt(byReach.heinrichs.critical, 0) : '—'} lb on Heinrichs'.`}
            >
              Shear is assumed to fall off linearly from the dowel under the wheel to zero at the
              distance where the negative moment peaks. <strong>That distance is the whole
              disagreement.</strong> Friberg (1940) put it at 1.8ℓ; Heinrichs et al. (1989), checking
              against finite-element results, found 1.0ℓ. A shorter reach means fewer dowels share
              the load, so the critical one carries more — and Huang notes plainly that the load
              "should be larger than those shown in the examples". The examples were nonetheless
              left as they were.
            </ChartFigure>

            <Card title="One question, three conventions"
              subtitle="Huang uses a different pair of assumptions for design and for faulting">
              <div className="cee-tablewrap">
                <table className="cee-table">
                  <thead>
                    <tr><th>Convention</th><th>Reach</th><th>Transferred</th><th>Critical dowel</th><th>Bearing stress</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Friberg (1940) <span className="cee-field__unit">Ex. 4.12–4.13</span></td>
                      <td>1.8ℓ = {fmt(1.8 * ell, 0)} in</td><td>0.50 W</td>
                      <td>{fmt(byReach.friberg.critical, 0)} lb</td>
                      <td>{fmt(byReach.friberg.stress, 0)} psi</td>
                    </tr>
                    <tr>
                      <td>Heinrichs (1989) <span className="cee-field__unit">§4.4.1 note</span></td>
                      <td>1.0ℓ = {fmt(ell, 0)} in</td><td>0.50 W</td>
                      <td>{byReach.heinrichs ? fmt(byReach.heinrichs.critical, 0) : '—'} lb</td>
                      <td>{byReach.heinrichs ? fmt(byReach.heinrichs.stress, 0) : '—'} psi</td>
                    </tr>
                    <tr>
                      <td>Faulting model <span className="cee-field__unit">§12.1.4</span></td>
                      <td>1.0ℓ = {fmt(ell, 0)} in</td><td>0.45 W</td>
                      <td>{byReach.faultingConv ? fmt(byReach.faultingConv.critical, 0) : '—'} lb</td>
                      <td>{byReach.faultingConv ? fmt(byReach.faultingConv.stress, 0) : '—'} psi</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="cee-note" style={{ marginTop: '0.75rem' }}>
                The third row is not a fourth opinion — it is the convention Eq. 12.3 was
                <em>calibrated</em> against, so faulting must be predicted with it even if you design
                the dowels on another. Mixing them silently is the kind of error that survives review
                because every individual step looks defensible.
              </p>
            </Card>

            {fault && Number.isFinite(fault.inches) && (
              <ChartFigure
                title="Faulting against bearing stress"
                subtitle={`Huang Eq. 12.3 at N₁₈ = ${fmt(num(n18Str, 10), 0)} million, ${fmt(JS, 0)} ft joints, k = ${fmt(k, 0)} pci`}
                plotRef={faultRef}
                takeaway={`At ${fmt(fault.S, 0)} psi bearing stress this joint is predicted to fault ${fmt(fault.inches, 3)} in.`}
              >
                Huang's summary of Figure 12.5 is that <strong>bearing stress matters most and joint
                spacing least</strong> — which is why dowel design and faulting are the same problem
                wearing different clothes. Keeping bearing stress under about 1500 psi holds faulting
                to an acceptable level. Two cautions come with the model: it is a regression over 280
                sections and <em>"must not be used to predict faulting by extrapolation beyond the
                data range"</em>, and open-graded drainable bases were not in that data at all.
              </ChartFigure>
            )}

            <Card title="Choosing a joint spacing"
              subtitle="Four limits, pulling in different directions — HW9 asks you to pick one to obey">
              <div className="cee-tablewrap">
                <table className="cee-table">
                  <thead>
                    <tr><th>Limit</th><th>Value</th><th>What it protects</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Opening, undoweled</td>
                      <td>{fmt(spacingLimits.undoweled, 1)} ft</td>
                      <td>aggregate interlock, which is lost past about 0.05 in</td>
                    </tr>
                    <tr>
                      <td>Opening, doweled</td>
                      <td>{fmt(spacingLimits.doweled, 1)} ft</td>
                      <td>the sealant, good to about 0.25 in</td>
                    </tr>
                    <tr>
                      <td>Rule of thumb</td>
                      <td>{fmt(spacingLimits.ruleOfThumb, 0)} ft</td>
                      <td>experience: spacing in feet ≲ twice the thickness in inches</td>
                    </tr>
                    <tr>
                      <td>Friction stress at {fmt(JS, 0)} ft</td>
                      <td>{fmt(spacingLimits.friction, 1)} psi</td>
                      <td>
                        cracking — but the tensile strength is {fmt(spacingLimits.tensile[0], 0)}–
                        {fmt(spacingLimits.tensile[1], 0)} psi, so this never governs
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="cee-note" style={{ marginTop: '0.75rem' }}>
                Your {fmt(JS, 0)} ft joint opens <strong>{fmt(spacingLimits.opening, 3)} in</strong> under
                the stated temperature range and shrinkage. The friction row is worth reading twice:
                Huang computes it, finds 19.5 psi against a tensile strength near 200, and concludes
                that <em>joint spacing is not governed by friction stress at all</em>. It is governed
                by how far the joint opens — and, through faulting, by what happens after it does.
              </p>
            </Card>

            {ties && (
              <Card title="Tie bars across the longitudinal joint"
                subtitle="Huang Eqs. 4.38 and 4.40 — sized by friction, lengthened by bond">
                <div className="cee-tablewrap">
                  <table className="cee-table">
                    <tbody>
                      <tr><td>Steel area required</td><td>{fmt(ties.asPerIn, 5)} in²/in of joint</td></tr>
                      <tr><td>Bar spacing</td><td>{fmt(ties.spacing, 1)} in</td></tr>
                      <tr><td>Bond length</td><td>{fmt(ties.lengthRaw, 1)} in</td></tr>
                      <tr><td>With misalignment allowance</td><td><strong>{fmt(ties.length, 1)} in</strong> — round up</td></tr>
                    </tbody>
                  </table>
                </div>
                <p className="cee-note" style={{ marginTop: '0.75rem' }}>
                  Tie bars are <strong>not</strong> load transfer devices. They hold the longitudinal
                  joint closed so that aggregate interlock can do the load transfer; sizing them is a
                  friction problem, not a wheel-load problem. Most agencies use a standard detail —
                  0.5 in bars, 36 in long, at 30 to 40 in centres — rather than designing each one.
                </p>
              </Card>
            )}

            <p className="cee-note">
              Dowels: Huang Eqs. 4.41–4.45 (Friberg 1940, after Timoshenko), group action per §4.4.1.
              Joint opening: Eq. 4.36 (Darter and Barenberg, 1977). Friction: Eq. 4.35. Tie bars:
              Eqs. 4.38 and 4.40. Faulting: Eq. 12.3, the COPES regression over 280 doweled sections.
              Validated against the printed answers of Examples 4.8, 4.9, 4.11, 4.12 and 4.13.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
