// AASHTO Design Studio — the 1993 Guide design equations, solved in any
// direction, for flexible and rigid pavements.
//
// Flexible  Huang (2004) Eq. 11.34 / AASHTO 1993 Part II:
//   log W18 = Z_R·S0 + 9.36 log(SN+1) − 0.20
//             + log[ΔPSI/(4.2−1.5)] / [0.40 + 1094/(SN+1)^5.19]
//             + 2.32 log(M_R) − 8.07
//   Layered thicknesses from SN = a1·D1 + a2·m2·D2 + a3·m3·D3.
//
// Rigid  Huang Eq. 12.21:
//   log W18 = Z_R·S0 + 7.35 log(D+1) − 0.06
//             + log[ΔPSI/(4.5−1.5)] / [1 + 1.624×10^7/(D+1)^8.46]
//             + (4.22 − 0.32 pt) · log[ Sc'·Cd·(D^0.75 − 1.132)
//                                     / (215.63·J·(D^0.75 − 18.42/(Ec/k)^0.25)) ]
//
// Effective k  Huang Eqs. 12.29-12.30: u_r = (D^0.75 − 0.39 k^0.25)^3.42,
//   averaged over the seasons and inverted for the equivalent k.
//
// Supports HW7 (Huang 11.9, 11.10, 11.12) and HW9 (Huang 12.6, 12.7, 12.8).
import { useEffect, useMemo, useRef, useState } from 'react';
import Tip from '../Tip';
import {
  useTheme, chartColors, baseLayout, plotConfig, num, fmt,
  axis, gridAxis, hueFor, HUES,
} from '../chartTheme';
import ChartFigure from '../ui/ChartFigure';
import KpiStrip, { Kpi } from '../ui/KpiStrip';
import {
  zOfR, rOfZ, logW18Flex, snFor, logW18Rigid, dFor, relDamage, kOfMr,
} from './equations';
import '../tools.css';

// All design equations live in ./equations.ts so they can be exercised
// directly against Huang's printed answers — see equations.test.mjs.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Huang Problem 12-8 monthly roadbed moduli (psi) — the worked example. */
const DEMO_MR = ['15900', '27300', '38700', '50000', '900', '1620', '2340', '3060', '3780', '4500', '4500', '4500'];

/* AASHTO 1993 Table 2.4 — drainage coefficient m (flexible) and Cd (rigid),
 * by quality of drainage and percent of time the structure is near saturation. */
const DRAIN_QUALITY = ['Excellent', 'Good', 'Fair', 'Poor', 'Very poor'] as const;
const DRAIN_SAT = ['<1%', '1-5%', '5-25%', '>25%'] as const;
// m values, [quality][saturation band] — midpoints of the AASHTO ranges.
const M_TABLE: number[][] = [
  [1.40, 1.35, 1.30, 1.20],
  [1.30, 1.25, 1.15, 1.00],
  [1.15, 1.10, 1.00, 0.80],
  [1.05, 1.00, 0.80, 0.60],
  [0.95, 0.85, 0.75, 0.40],
];
// Cd values for rigid pavements, same axes.
const CD_TABLE: number[][] = [
  [1.25, 1.20, 1.15, 1.10],
  [1.20, 1.15, 1.10, 1.00],
  [1.15, 1.10, 1.00, 0.90],
  [1.10, 1.00, 0.90, 0.80],
  [1.00, 0.90, 0.80, 0.70],
];

type Tab = 'flexible' | 'rigid' | 'effk';
type FlexSolve = 'SN' | 'W18' | 'R' | 'MR';
type RigidSolve = 'D' | 'W18' | 'R';

export default function AashtoApp() {
  const [tab, setTab] = useState<Tab>('flexible');

  /* Shared reliability inputs */
  const [rStr, setR] = useState('90');
  const [s0Str, setS0] = useState('0.45');

  /* Flexible */
  const [fSolve, setFSolve] = useState<FlexSolve>('SN');
  const [fW18, setFW18] = useState('5e6');
  const [fMR, setFMR] = useState('5000');
  const [fP0, setFP0] = useState('4.2');
  const [fPt, setFPt] = useState('2.5');
  const [fSN, setFSN] = useState('5');
  // layered solution
  const [a1, setA1] = useState('0.44');
  const [a2, setA2] = useState('0.14');
  const [a3, setA3] = useState('0.11');
  const [m2, setM2] = useState('1.00');
  const [m3, setM3] = useState('1.00');
  const [mrBase, setMrBase] = useState('30000');
  const [mrSub, setMrSub] = useState('15000');

  /* Rigid */
  const [rSolve, setRSolve] = useState<RigidSolve>('D');
  const [gW18, setGW18] = useState('5e6');
  const [gD, setGD] = useState('9');
  const [gK, setGK] = useState('100');
  const [gEc, setGEc] = useState('4e6');
  const [gSc, setGSc] = useState('650');
  const [gJ, setGJ] = useState('3.2');
  const [gCd, setGCd] = useState('1.00');
  const [gP0, setGP0] = useState('4.5');
  const [gPt, setGPt] = useState('2.5');

  /* Effective k */
  const [ekD, setEkD] = useState('8.5');
  const [ekMode, setEkMode] = useState<'mr' | 'k'>('mr');
  const [ekVals, setEkVals] = useState<string[]>(DEMO_MR);

  const R = num(rStr, 90);
  const s0 = num(s0Str, 0.45);
  const zR = zOfR(R);

  /* ── Flexible results ── */
  const flex = useMemo(() => {
    const dPSI = num(fP0, 4.2) - num(fPt, 2.5);
    const MR = num(fMR, 5000);
    const W18 = num(fW18, 5e6);
    const SNin = num(fSN, 5);
    if (dPSI <= 0 || MR <= 0) return null;

    let SN = SNin, w = W18, rOut = R, mrOut = MR;
    if (fSolve === 'SN') {
      const s = snFor(W18, MR, dPSI, zR, s0);
      if (s === null) return null;
      SN = s;
    } else if (fSolve === 'W18') {
      w = Math.pow(10, logW18Flex(SNin, MR, dPSI, zR, s0));
    } else if (fSolve === 'R') {
      // Solve the reliability term for Z_R, then invert the normal CDF.
      const withoutZ = logW18Flex(SNin, MR, dPSI, 0, s0);
      const z = (Math.log10(W18) - withoutZ) / s0;
      rOut = rOfZ(z);
      SN = SNin;
    } else {
      // Solve for the roadbed modulus that supports W18 at this SN.
      const withoutMR = logW18Flex(SNin, 1, dPSI, zR, s0) - 2.32 * Math.log10(1);
      mrOut = Math.pow(10, (Math.log10(W18) - withoutMR) / 2.32);
      SN = SNin;
    }

    // Layered thicknesses: each layer is designed against the modulus of the
    // material *beneath* it, and the SN it must supply is the difference.
    const SN1 = snFor(w, num(mrBase, 30000), dPSI, zR, s0);
    const SN2 = snFor(w, num(mrSub, 15000), dPSI, zR, s0);
    const SN3 = SN;
    const A1 = num(a1, 0.44), A2 = num(a2, 0.14), A3 = num(a3, 0.11);
    const M2 = num(m2, 1), M3 = num(m3, 1);
    let layers: { name: string; sn: number; d: number; snStar: number }[] = [];
    if (SN1 !== null && SN2 !== null && A1 > 0 && A2 > 0 && A3 > 0 && M2 > 0 && M3 > 0) {
      const D1 = Math.ceil((SN1 / A1) * 2) / 2;           // round up to 1/2 in
      const sn1s = A1 * D1;
      const D2 = Math.max(0, Math.ceil(((SN2 - sn1s) / (A2 * M2)) * 2) / 2);
      const sn2s = A2 * M2 * D2;
      const D3 = Math.max(0, Math.ceil(((SN3 - sn1s - sn2s) / (A3 * M3)) * 2) / 2);
      const sn3s = A3 * M3 * D3;
      layers = [
        { name: 'Surface (HMA)', sn: SN1, d: D1, snStar: sn1s },
        { name: 'Base', sn: SN2, d: D2, snStar: sn2s },
        { name: 'Subbase', sn: SN3, d: D3, snStar: sn3s },
      ];
    }
    const snProvided = layers.reduce((s, l) => s + l.snStar, 0);
    return { SN, w, rOut, mrOut, dPSI, layers, snProvided };
  }, [fSolve, fW18, fMR, fP0, fPt, fSN, zR, s0, R, a1, a2, a3, m2, m3, mrBase, mrSub]);

  /* ── Rigid results ── */
  const rigid = useMemo(() => {
    const dPSI = num(gP0, 4.5) - num(gPt, 2.5);
    const k = num(gK, 100), Ec = num(gEc, 4e6), Sc = num(gSc, 650);
    const J = num(gJ, 3.2), Cd = num(gCd, 1), pt = num(gPt, 2.5);
    const W18 = num(gW18, 5e6), Din = num(gD, 9);
    if (dPSI <= 0 || k <= 0 || Ec <= 0 || Sc <= 0 || J <= 0) return null;

    let D = Din, w = W18, rOut = R;
    if (rSolve === 'D') {
      const d = dFor(W18, k, Ec, Sc, J, Cd, dPSI, pt, zR, s0);
      if (d === null) return null;
      D = d;
    } else if (rSolve === 'W18') {
      const lw = logW18Rigid(Din, k, Ec, Sc, J, Cd, dPSI, pt, zR, s0);
      if (lw === null) return null;
      w = Math.pow(10, lw);
    } else {
      const without = logW18Rigid(Din, k, Ec, Sc, J, Cd, dPSI, pt, 0, s0);
      if (without === null) return null;
      rOut = rOfZ((Math.log10(W18) - without) / s0);
    }
    // Traffic the section carries with no reliability penalty — Huang 12-7.
    const lwNoRel = logW18Rigid(D, k, Ec, Sc, J, Cd, dPSI, pt, 0, s0);
    return { D, w, rOut, dPSI, wNoRel: lwNoRel === null ? null : Math.pow(10, lwNoRel) };
  }, [rSolve, gW18, gD, gK, gEc, gSc, gJ, gCd, gP0, gPt, zR, s0, R]);

  /* ── Effective k ── */
  const effk = useMemo(() => {
    const D = num(ekD, 8.5);
    if (D <= 0) return null;
    const rows = ekVals.map((v, i) => {
      const val = num(v, 0);
      const k = ekMode === 'mr' ? kOfMr(val) : val;
      return { month: MONTHS[i], input: val, k, u: k > 0 ? relDamage(D, k) : NaN };
    });
    const valid = rows.filter(r => Number.isFinite(r.u) && r.k > 0);
    if (!valid.length) return null;
    const uBar = valid.reduce((s, r) => s + r.u, 0) / valid.length;
    // Invert Eq. 12.30 for the k that produces the mean relative damage.
    const inner = Math.pow(D, 0.75) - Math.pow(uBar, 1 / 3.42);
    const kEff = inner > 0 ? Math.pow(inner / 0.39, 4) : NaN;
    return { rows, uBar, kEff, D };
  }, [ekVals, ekMode, ekD]);

  /* ── Charts ── */
  const theme = useTheme();
  const flexRef = useRef<HTMLDivElement>(null);
  const rigidRef = useRef<HTMLDivElement>(null);
  const ekRef = useRef<HTMLDivElement>(null);

  const REL_SHOWN = [50, 90, 95, 99];

  useEffect(() => {
    let canceled = false;
    (async () => {
      const Plotly = (await import('plotly.js-dist-min')).default;
      if (canceled) return;
      const c = chartColors(theme);
      const hues = [HUES[theme].orange, HUES[theme].blue, HUES[theme].emerald, HUES[theme].amber];

      if (tab === 'flexible' && flexRef.current && flex) {
        const traces = REL_SHOWN.map((rel, i) => {
          const z = zOfR(rel);
          const xs: number[] = [], ys: number[] = [];
          for (let sn = 1; sn <= 8.01; sn += 0.1) {
            xs.push(sn);
            ys.push(Math.pow(10, logW18Flex(sn, num(fMR, 5000), flex.dPSI, z, s0)));
          }
          return { x: xs, y: ys, name: `R = ${rel}%`, mode: 'lines', line: { color: hues[i], width: 2 } };
        });
        traces.push({
          x: [flex.SN], y: [flex.w], name: 'Design point', mode: 'markers',
          marker: { color: c.ink, size: 10, symbol: 'circle', line: { color: c.surface, width: 2 } },
        } as any);
        Plotly.react(flexRef.current, traces, baseLayout(theme, {
          xaxis: axis(theme, 'Structural number SN'),
          yaxis: gridAxis(theme, 'Design ESALs W₁₈', { type: 'log' }),
          hovermode: 'closest',
        }), plotConfig);
      }

      if (tab === 'rigid' && rigidRef.current && rigid) {
        const traces = REL_SHOWN.map((rel, i) => {
          const z = zOfR(rel);
          const xs: number[] = [], ys: number[] = [];
          for (let d = 5; d <= 16.01; d += 0.2) {
            const lw = logW18Rigid(d, num(gK, 100), num(gEc, 4e6), num(gSc, 650), num(gJ, 3.2), num(gCd, 1), rigid.dPSI, num(gPt, 2.5), z, s0);
            if (lw === null) continue;
            xs.push(d); ys.push(Math.pow(10, lw));
          }
          return { x: xs, y: ys, name: `R = ${rel}%`, mode: 'lines', line: { color: hues[i], width: 2 } };
        });
        traces.push({
          x: [rigid.D], y: [rigid.w], name: 'Design point', mode: 'markers',
          marker: { color: c.ink, size: 10, symbol: 'circle', line: { color: c.surface, width: 2 } },
        } as any);
        Plotly.react(rigidRef.current, traces, baseLayout(theme, {
          xaxis: axis(theme, 'Slab thickness D (in)'),
          yaxis: gridAxis(theme, 'Design ESALs W₁₈', { type: 'log' }),
          hovermode: 'closest',
        }), plotConfig);
      }

      if (tab === 'effk' && ekRef.current && effk) {
        Plotly.react(ekRef.current, [{
          x: effk.rows.map(r => r.month),
          y: effk.rows.map(r => (Number.isFinite(r.u) ? r.u : 0)),
          type: 'bar',
          marker: { color: hueFor('damage', theme), cornerradius: 6 },
          hovertemplate: '%{x}: u_r = %{y:.1f}<extra></extra>',
        }], baseLayout(theme, {
          bargap: 0.4,
          xaxis: axis(theme),
          yaxis: gridAxis(theme, 'Relative damage u_r', { rangemode: 'tozero' as const }),
          shapes: [{
            type: 'line', xref: 'paper', x0: 0, x1: 1, y0: effk.uBar, y1: effk.uBar,
            line: { color: c.secondary, width: 1, dash: 'dash' },
          }],
          annotations: [{
            xref: 'paper', x: 0.01, y: effk.uBar, text: `mean u_r ${effk.uBar.toFixed(1)}`,
            showarrow: false, yshift: 9, xanchor: 'left' as const, font: { size: 10, color: c.fg },
          }],
        }), plotConfig);
      }
    })();
    return () => { canceled = true; };
  }, [tab, flex, rigid, effk, theme, fMR, s0, gK, gEc, gSc, gJ, gCd, gPt]);

  const setEk = (i: number, v: string) =>
    setEkVals(vs => vs.map((x, j) => (j === i ? v : x)));

  /* ────────────────────────────── UI ────────────────────────────── */
  return (
    <div className="cee-tool">
      <aside className="cee-panel">
        <h2 className="cee-panel__title">Method</h2>
        <div className="cee-seg" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'flexible'}
            className={tab === 'flexible' ? 'is-active' : ''} onClick={() => setTab('flexible')}>Flexible</button>
          <button type="button" role="tab" aria-selected={tab === 'rigid'}
            className={tab === 'rigid' ? 'is-active' : ''} onClick={() => setTab('rigid')}>Rigid</button>
          <button type="button" role="tab" aria-selected={tab === 'effk'}
            className={tab === 'effk' ? 'is-active' : ''} onClick={() => setTab('effk')}>Effective k</button>
        </div>

        {tab !== 'effk' && (
          <>
            <div className="cee-row">
              <div className="cee-field">
                <label className="cee-field__label" htmlFor="aa-r">
                  <span>Reliability R<Tip text="Probability that the pavement lasts the design period. Higher R makes Z_R more negative, which subtracts traffic capacity — the design gets thicker. AASHTO suggests 80–99% for interstates, 50–80% for local roads." /></span>
                  <span className="cee-field__unit">%</span>
                </label>
                <input id="aa-r" className="cee-input" type="number" min="50" max="99.99" step="1" value={rStr} onChange={e => setR(e.target.value)} />
              </div>
              <div className="cee-field">
                <label className="cee-field__label" htmlFor="aa-s0">
                  <span>Std. deviation S₀<Tip text="Overall standard deviation, capturing scatter in traffic prediction and performance. AASHTO: 0.40–0.50 flexible, 0.30–0.40 rigid." /></span>
                  <span className="cee-field__unit">–</span>
                </label>
                <input id="aa-s0" className="cee-input" type="number" min="0" max="1" step="0.05" value={s0Str} onChange={e => setS0(e.target.value)} />
              </div>
            </div>
            <p className="cee-hint">Z_R = {zR.toFixed(3)} at R = {R}%</p>
          </>
        )}

        {tab === 'flexible' && (
          <>
            <h2 className="cee-panel__title" style={{ marginTop: '1rem' }}>Solve for</h2>
            <div className="cee-seg">
              {(['SN', 'W18', 'R', 'MR'] as FlexSolve[]).map(s => (
                <button key={s} type="button" className={fSolve === s ? 'is-active' : ''} onClick={() => setFSolve(s)}>
                  {s === 'W18' ? 'W₁₈' : s === 'MR' ? 'M_R' : s}
                </button>
              ))}
            </div>

            {fSolve !== 'W18' && (
              <div className="cee-field">
                <label className="cee-field__label" htmlFor="aa-w18">
                  <span>Design ESALs W₁₈<Tip text="Cumulative 18-kip equivalent single axle loads in the design lane over the design period — the output of the ESAL Calculator." /></span>
                  <span className="cee-field__unit">–</span>
                </label>
                <input id="aa-w18" className="cee-input" type="text" value={fW18} onChange={e => setFW18(e.target.value)} />
              </div>
            )}
            {fSolve !== 'SN' && (
              <div className="cee-field">
                <label className="cee-field__label" htmlFor="aa-sn">
                  <span>Structural number SN<Tip text="An abstract index of total pavement strength: SN = Σ aᵢ·mᵢ·Dᵢ. It is not a thickness — the layered solution below turns it into one." /></span>
                  <span className="cee-field__unit">–</span>
                </label>
                <input id="aa-sn" className="cee-input" type="number" min="0" step="0.1" value={fSN} onChange={e => setFSN(e.target.value)} />
              </div>
            )}
            {fSolve !== 'MR' && (
              <div className="cee-field">
                <label className="cee-field__label" htmlFor="aa-mr">
                  <span>Roadbed M_R<Tip text="Effective roadbed soil resilient modulus. Use the seasonal-average value from the relative damage method, not a single summer test." /></span>
                  <span className="cee-field__unit">psi</span>
                </label>
                <input id="aa-mr" className="cee-input" type="number" min="1" step="500" value={fMR} onChange={e => setFMR(e.target.value)} />
              </div>
            )}

            <div className="cee-row">
              <div className="cee-field">
                <label className="cee-field__label" htmlFor="aa-p0">
                  <span>Initial p₀<Tip text="Serviceability right after construction. AASHTO Road Test: 4.2 flexible, 4.5 rigid." /></span>
                  <span className="cee-field__unit">–</span>
                </label>
                <input id="aa-p0" className="cee-input" type="number" min="0" max="5" step="0.1" value={fP0} onChange={e => setFP0(e.target.value)} />
              </div>
              <div className="cee-field">
                <label className="cee-field__label" htmlFor="aa-pt">
                  <span>Terminal pₜ<Tip text="Serviceability at which the pavement is considered failed: 2.5 for major highways, 2.0 for lower-volume roads." /></span>
                  <span className="cee-field__unit">–</span>
                </label>
                <input id="aa-pt" className="cee-input" type="number" min="0" max="5" step="0.1" value={fPt} onChange={e => setFPt(e.target.value)} />
              </div>
            </div>

            <h2 className="cee-panel__title" style={{ marginTop: '1rem' }}>Layer coefficients</h2>
            <div className="cee-row">
              <div className="cee-field">
                <label className="cee-field__label" htmlFor="aa-a1">
                  <span>a₁ surface<Tip text="HMA layer coefficient — about 0.42–0.44 for a dense-graded surface at 400,000–450,000 psi. Read it off AASHTO Fig. 2.5 for your modulus." /></span>
                  <span className="cee-field__unit">/in</span>
                </label>
                <input id="aa-a1" className="cee-input" type="number" min="0" step="0.01" value={a1} onChange={e => setA1(e.target.value)} />
              </div>
              <div className="cee-field">
                <label className="cee-field__label" htmlFor="aa-a2">
                  <span>a₂ base<Tip text="Base layer coefficient: ~0.14 for a good granular base, 0.20–0.28 for cement- or asphalt-treated. Huang Fig. 7.15c gives it from the 7-day unconfined compressive strength." /></span>
                  <span className="cee-field__unit">/in</span>
                </label>
                <input id="aa-a2" className="cee-input" type="number" min="0" step="0.01" value={a2} onChange={e => setA2(e.target.value)} />
              </div>
            </div>
            <div className="cee-row">
              <div className="cee-field">
                <label className="cee-field__label" htmlFor="aa-a3">
                  <span>a₃ subbase<Tip text="Subbase layer coefficient — around 0.11 for a sand-gravel subbase at 15,000 psi." /></span>
                  <span className="cee-field__unit">/in</span>
                </label>
                <input id="aa-a3" className="cee-input" type="number" min="0" step="0.01" value={a3} onChange={e => setA3(e.target.value)} />
              </div>
              <div className="cee-field">
                <label className="cee-field__label" htmlFor="aa-m2">
                  <span>m₂ base<Tip text="Drainage coefficient for the base: how fast water leaves and how long the layer sits near saturation. 1.00 is the Road Test condition." /></span>
                  <span className="cee-field__unit">–</span>
                </label>
                <input id="aa-m2" className="cee-input" type="number" min="0" step="0.05" value={m2} onChange={e => setM2(e.target.value)} />
              </div>
            </div>
            <div className="cee-row">
              <div className="cee-field">
                <label className="cee-field__label" htmlFor="aa-m3">
                  <span>m₃ subbase<Tip text="Drainage coefficient for the subbase — pick it from the table below the results." /></span>
                  <span className="cee-field__unit">–</span>
                </label>
                <input id="aa-m3" className="cee-input" type="number" min="0" step="0.05" value={m3} onChange={e => setM3(e.target.value)} />
              </div>
              <div className="cee-field">
                <label className="cee-field__label" htmlFor="aa-mrb">
                  <span>M_R base<Tip text="Resilient modulus of the base material — used to compute the SN the surface layer alone must supply." /></span>
                  <span className="cee-field__unit">psi</span>
                </label>
                <input id="aa-mrb" className="cee-input" type="number" min="1" step="1000" value={mrBase} onChange={e => setMrBase(e.target.value)} />
              </div>
            </div>
            <div className="cee-field">
              <label className="cee-field__label" htmlFor="aa-mrs">
                <span>M_R subbase<Tip text="Resilient modulus of the subbase — used to compute the SN that surface + base together must supply." /></span>
                <span className="cee-field__unit">psi</span>
              </label>
              <input id="aa-mrs" className="cee-input" type="number" min="1" step="1000" value={mrSub} onChange={e => setMrSub(e.target.value)} />
            </div>
          </>
        )}

        {tab === 'rigid' && (
          <>
            <h2 className="cee-panel__title" style={{ marginTop: '1rem' }}>Solve for</h2>
            <div className="cee-seg">
              {(['D', 'W18', 'R'] as RigidSolve[]).map(s => (
                <button key={s} type="button" className={rSolve === s ? 'is-active' : ''} onClick={() => setRSolve(s)}>
                  {s === 'W18' ? 'W₁₈' : s}
                </button>
              ))}
            </div>

            {rSolve !== 'W18' && (
              <div className="cee-field">
                <label className="cee-field__label" htmlFor="aa-gw">
                  <span>Design ESALs W₁₈<Tip text="Cumulative 18-kip ESALs in the design lane. Rigid EALFs differ from flexible ones — use the rigid column." /></span>
                  <span className="cee-field__unit">–</span>
                </label>
                <input id="aa-gw" className="cee-input" type="text" value={gW18} onChange={e => setGW18(e.target.value)} />
              </div>
            )}
            {rSolve !== 'D' && (
              <div className="cee-field">
                <label className="cee-field__label" htmlFor="aa-gd">
                  <span>Slab thickness D<Tip text="Concrete slab thickness. The equation is very sensitive to it: D enters as D^0.75 inside a logarithm raised to (4.22 − 0.32 pₜ)." /></span>
                  <span className="cee-field__unit">in</span>
                </label>
                <input id="aa-gd" className="cee-input" type="number" min="4" max="24" step="0.5" value={gD} onChange={e => setGD(e.target.value)} />
              </div>
            )}

            <div className="cee-row">
              <div className="cee-field">
                <label className="cee-field__label" htmlFor="aa-gk">
                  <span>Effective k<Tip text="Modulus of subgrade reaction on top of the subbase. With no subbase use k = M_R/19.4 (Huang Eq. 12.22); with one, read the composite k∞ from Huang Fig. 12.18, then season-average it on the Effective k tab." /></span>
                  <span className="cee-field__unit">pci</span>
                </label>
                <input id="aa-gk" className="cee-input" type="number" min="1" step="10" value={gK} onChange={e => setGK(e.target.value)} />
              </div>
              <div className="cee-field">
                <label className="cee-field__label" htmlFor="aa-gec">
                  <span>Concrete E_c<Tip text="Elastic modulus of the concrete — typically 4–5 ×10⁶ psi." /></span>
                  <span className="cee-field__unit">psi</span>
                </label>
                <input id="aa-gec" className="cee-input" type="text" value={gEc} onChange={e => setGEc(e.target.value)} />
              </div>
            </div>
            <div className="cee-row">
              <div className="cee-field">
                <label className="cee-field__label" htmlFor="aa-gsc">
                  <span>Modulus of rupture S'_c<Tip text="Flexural strength of the concrete at 28 days, third-point loading. 600–700 psi is typical for paving mixes." /></span>
                  <span className="cee-field__unit">psi</span>
                </label>
                <input id="aa-gsc" className="cee-input" type="number" min="1" step="10" value={gSc} onChange={e => setGSc(e.target.value)} />
              </div>
              <div className="cee-field">
                <label className="cee-field__label" htmlFor="aa-gj">
                  <span>Load transfer J<Tip text="Load transfer coefficient: ~3.2 for doweled joints with asphalt shoulders, 2.5–3.1 with tied concrete shoulders, 3.8–4.4 for undoweled. Lower J means better load transfer and a thinner slab." /></span>
                  <span className="cee-field__unit">–</span>
                </label>
                <input id="aa-gj" className="cee-input" type="number" min="1" step="0.1" value={gJ} onChange={e => setGJ(e.target.value)} />
              </div>
            </div>
            <div className="cee-row">
              <div className="cee-field">
                <label className="cee-field__label" htmlFor="aa-gcd">
                  <span>Drainage C_d<Tip text="Rigid drainage coefficient, from the table below the results. 1.00 is the Road Test condition." /></span>
                  <span className="cee-field__unit">–</span>
                </label>
                <input id="aa-gcd" className="cee-input" type="number" min="0" step="0.05" value={gCd} onChange={e => setGCd(e.target.value)} />
              </div>
              <div className="cee-field">
                <label className="cee-field__label" htmlFor="aa-gpt">
                  <span>Terminal pₜ<Tip text="Terminal serviceability. It appears twice in the rigid equation — in ΔPSI and in the exponent (4.22 − 0.32 pₜ)." /></span>
                  <span className="cee-field__unit">–</span>
                </label>
                <input id="aa-gpt" className="cee-input" type="number" min="0" max="5" step="0.1" value={gPt} onChange={e => setGPt(e.target.value)} />
              </div>
            </div>
            <div className="cee-field">
              <label className="cee-field__label" htmlFor="aa-gp0">
                <span>Initial p₀<Tip text="Initial serviceability — 4.5 for rigid pavements at the Road Test." /></span>
                <span className="cee-field__unit">–</span>
              </label>
              <input id="aa-gp0" className="cee-input" type="number" min="0" max="5" step="0.1" value={gP0} onChange={e => setGP0(e.target.value)} />
            </div>
          </>
        )}

        {tab === 'effk' && (
          <>
            <div className="cee-field">
              <label className="cee-field__label" htmlFor="aa-ekd">
                <span>Slab thickness D<Tip text="The relative damage equation contains D, so the effective k depends on the slab you assume. Iterate if the design thickness changes materially." /></span>
                <span className="cee-field__unit">in</span>
              </label>
              <input id="aa-ekd" className="cee-input" type="number" min="4" max="20" step="0.5" value={ekD} onChange={e => setEkD(e.target.value)} />
            </div>
            <div className="cee-field">
              <span className="cee-field__label"><span>Seasonal input</span></span>
              <div className="cee-seg">
                <button type="button" className={ekMode === 'mr' ? 'is-active' : ''} onClick={() => setEkMode('mr')}>Roadbed M_R</button>
                <button type="button" className={ekMode === 'k' ? 'is-active' : ''} onClick={() => setEkMode('k')}>k directly</button>
              </div>
            </div>
            <div className="cee-field">
              <span className="cee-field__label">
                <span>Monthly values<Tip text="One value per month. In M_R mode each is converted with k = M_R/19.4 (Huang Eq. 12.22) before the damage is computed." /></span>
                <span className="cee-field__unit">{ekMode === 'mr' ? 'psi' : 'pci'}</span>
              </span>
              {MONTHS.map((mo, i) => (
                <div className="cee-axle-row cee-axle-row--2" key={mo} style={{ gridTemplateColumns: '3rem 1fr' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--cee-secondary)' }}>{mo}</span>
                  <input className="cee-input" type="number" min="0" step="100" value={ekVals[i]}
                    aria-label={`${mo} value`} onChange={e => setEk(i, e.target.value)} />
                </div>
              ))}
            </div>
          </>
        )}
      </aside>

      <div className="cee-results">
        <details className="cee-howto">
          <summary>How to use this tool</summary>
          <div className="cee-howto__body">
            <ol>
              <li><strong>Pick the method</strong> — flexible (Huang Ch. 11), rigid (Ch. 12), or the effective-k season average that feeds the rigid design.</li>
              <li><strong>Pick what to solve for.</strong> The design equation is one relationship among W₁₈, thickness, reliability, and support; this inverts it in whichever direction the problem asks.</li>
              <li><strong>Read the design chart</strong>: your point sits on the curve for your reliability. Moving up a reliability curve is what the R term costs you in thickness.</li>
              <li><strong>Convert SN to layers</strong> (flexible): each layer is designed against the modulus of the material beneath it, and thicknesses are rounded up to constructible increments.</li>
            </ol>
            The equations are transcendental in SN and D, so those directions are solved by bisection rather than a nomograph — the same answer the AASHTO design charts give, without chart-reading error.
          </div>
        </details>

        {tab === 'flexible' && (!flex ? (
          <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>Enter a positive ΔPSI (p₀ &gt; pₜ) and roadbed modulus, and a W₁₈ the equation can reach.</span></p>
        ) : (
          <>
            <KpiStrip>
              <Kpi accent label="Structural number SN" value={fmt(flex.SN, 2)}
                tip="Total structural capacity required. It is an index, not a thickness — the layered solution converts it." />
              <Kpi label="Design ESALs W₁₈" value={flex.w.toExponential(2)}
                tip="Traffic the section carries to terminal serviceability at this reliability." />
              <Kpi label="Reliability R" value={fmt(flex.rOut, 1)} unit="%"
                tip="Probability the pavement survives the design traffic. Solving for R is Huang Problem 11-9." />
              <Kpi label="Roadbed M_R" value={fmt(flex.mrOut, 0)} unit="psi"
                tip="Effective roadbed soil resilient modulus supporting this design." />
              <Kpi label="ΔPSI" value={fmt(flex.dPSI, 2)}
                tip="Serviceability loss the design allows, p₀ − pₜ. It enters the equation as a logarithm, so it matters less than traffic or support." />
            </KpiStrip>

            <ChartFigure
              title="AASHTO flexible design chart"
              subtitle="The design equation solved across SN, one curve per reliability level"
              plotRef={flexRef}
              legend={[
                ...REL_SHOWN.map((rel, i) => ({
                  label: `R = ${rel}%`,
                  color: [HUES[theme].orange, HUES[theme].blue, HUES[theme].emerald, HUES[theme].amber][i],
                })),
                { label: 'Design point', color: chartColors(theme).ink },
              ]}
              takeaway={`At R = ${R}% this section needs SN = ${fmt(flex.SN, 2)}; raising reliability shifts the whole curve down, so the same SN carries less traffic.`}
            >
              Each curve is the design equation at one reliability. Reading up from your SN gives the
              traffic the section carries; reading across from your W₁₈ gives the SN you need.
              <strong> The vertical gap between curves is the price of reliability</strong> — it is
              pure penalty, subtracted from capacity through the Z_R·S₀ term.
            </ChartFigure>

            {flex.layers.length > 0 && (
              <div className="cee-tablewrap">
                <table className="cee-table">
                  <thead>
                    <tr>
                      <th>Layer</th>
                      <th>SN required</th>
                      <th>Thickness (in)</th>
                      <th>SN provided</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flex.layers.map(l => (
                      <tr key={l.name}>
                        <td>{l.name}</td>
                        <td>{fmt(l.sn, 2)}</td>
                        <td>{l.d.toFixed(1)}</td>
                        <td>{fmt(l.snStar, 2)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td><strong>Total</strong></td>
                      <td><strong>{fmt(flex.SN, 2)}</strong></td>
                      <td></td>
                      <td><strong>{fmt(flex.snProvided, 2)}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {flex.snProvided < flex.SN - 1e-6 && (
              <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>
                The layered section provides SN = {fmt(flex.snProvided, 2)}, below the required {fmt(flex.SN, 2)}.
                Increase a thickness or a layer coefficient.
              </span></p>
            )}

            <p className="cee-note">
              AASHTO 1993 Part II flexible equation (Huang Eq. 11.34). Layer thicknesses follow the
              staged procedure: each layer is designed against the modulus of the material beneath it,
              SNᵢ* = aᵢ·mᵢ·Dᵢ is what it actually supplies, and thicknesses round up to ½ in.
              Sanity checks — Problem 11-9: SN = 0.44 × 12 = 5.28, M_R = 10,000 psi, ΔPSI = 1.7,
              S₀ = 0.5, W₁₈ = 3×10⁷ → R ≈ 88%. Problem 11-12: W₁₈ = 5×10⁶, M_R = 5000 psi,
              ΔPSI = 1.7, R = 50% → SN ≈ 4.2.
            </p>
          </>
        ))}

        {tab === 'rigid' && (!rigid ? (
          <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>
            No solution for these inputs. The slab term D^0.75 − 18.42/(E_c/k)^0.25 must stay positive —
            a very soft foundation under a thin slab pushes it negative.
          </span></p>
        ) : (
          <>
            <KpiStrip>
              <Kpi accent label="Slab thickness D" value={fmt(rigid.D, 2)} unit="in"
                tip="Required concrete thickness. Construction rounds up to the next ½ in." />
              <Kpi label="Design ESALs W₁₈" value={rigid.w.toExponential(2)}
                tip="Traffic carried to terminal serviceability at this reliability." />
              <Kpi label="Reliability R" value={fmt(rigid.rOut, 1)} unit="%"
                tip="Probability the slab survives the design traffic." />
              <Kpi label="W₁₈ without reliability" value={rigid.wNoRel ? rigid.wNoRel.toExponential(2) : '—'}
                tip="Performance traffic with the Z_R·S₀ term dropped — this is what Huang Problem 12-7 asks for." />
            </KpiStrip>

            <ChartFigure
              title="AASHTO rigid design chart"
              subtitle="The design equation solved across slab thickness, one curve per reliability level"
              plotRef={rigidRef}
              legend={[
                ...REL_SHOWN.map((rel, i) => ({
                  label: `R = ${rel}%`,
                  color: [HUES[theme].orange, HUES[theme].blue, HUES[theme].emerald, HUES[theme].amber][i],
                })),
                { label: 'Design point', color: chartColors(theme).ink },
              ]}
              takeaway={`At R = ${R}% this section needs D = ${fmt(rigid.D, 2)} in; the curves steepen with thickness, so each extra half-inch buys progressively more traffic.`}
            >
              Slab thickness enters through D^0.75 inside a logarithm raised to (4.22 − 0.32 pₜ), which
              is why these curves are so much steeper than the flexible ones. <strong>Half an inch of
              concrete is worth far more than half an inch of asphalt</strong> — and why rigid designs
              are quoted to the nearest ½ in.
            </ChartFigure>

            <p className="cee-note">
              AASHTO 1993 rigid equation (Huang Eq. 12.21). The k it consumes is the effective modulus
              of subgrade reaction on top of the subbase — compute it on the Effective k tab. Sanity
              check, Problem 12-7: E_c = 4×10⁶ psi, S'_c = 650 psi, J = 3.2, ΔPSI = 4.5 − 2.0,
              C_d = 1.05, D = 8 in → W₁₈ ≈ 8.5×10⁶ without the reliability term.
            </p>
          </>
        ))}

        {tab === 'effk' && (!effk ? (
          <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>Enter at least one positive monthly value and a positive slab thickness.</span></p>
        ) : (
          <>
            <KpiStrip>
              <Kpi accent label="Effective k" value={Number.isFinite(effk.kEff) ? fmt(effk.kEff, 0) : '—'} unit="pci"
                tip="The single k that would cause the same seasonal damage as the twelve monthly values. Feed this into the rigid design tab." />
              <Kpi label="Mean relative damage" value={fmt(effk.uBar, 1)}
                tip="Average of u_r = (D^0.75 − 0.39k^0.25)^3.42 over the year (Huang Eq. 12.30)." />
              <Kpi label="Slab thickness used" value={fmt(effk.D, 1)} unit="in"
                tip="The relative damage equation contains D, so the effective k is tied to the slab assumed." />
              <Kpi compact label="Weakest month"
                value={effk.rows.reduce((a, b) => (Number.isFinite(b.u) && b.u > a.u ? b : a), effk.rows[0]).month}
                tip="The month contributing the most damage — spring thaw in most northern climates." />
            </KpiStrip>

            <ChartFigure
              title="Relative damage by month"
              subtitle="u_r = (D^0.75 − 0.39·k^0.25)^3.42, averaged to give the effective k"
              plotRef={ekRef}
              takeaway="Damage is dominated by the weak months, so the effective k sits far below the annual average of the seasonal k values."
            >
              The relationship between damage and support is steeply non-linear, so a few weak months
              dominate the year. <strong>This is why the effective k is much closer to the spring value
              than to the mean</strong> — averaging the k values directly would badly overstate the
              foundation.
            </ChartFigure>

            <div className="cee-tablewrap">
              <table className="cee-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>{ekMode === 'mr' ? 'M_R (psi)' : 'k (pci)'}</th>
                    <th>k (pci)</th>
                    <th>Relative damage u_r</th>
                  </tr>
                </thead>
                <tbody>
                  {effk.rows.map(r => (
                    <tr key={r.month}>
                      <td>{r.month}</td>
                      <td>{fmt(r.input, 0)}</td>
                      <td>{fmt(r.k, 1)}</td>
                      <td>{Number.isFinite(r.u) ? fmt(r.u, 1) : '—'}</td>
                    </tr>
                  ))}
                  <tr>
                    {/* Not an arithmetic average: k_eff is the value whose damage
                        equals the mean seasonal damage (Eq. 12.29). */}
                    <td><strong>Effective / mean</strong></td>
                    <td></td>
                    <td><strong>{Number.isFinite(effk.kEff) ? fmt(effk.kEff, 0) : '—'}</strong></td>
                    <td><strong>{fmt(effk.uBar, 1)}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="cee-note">
              Huang Eqs. 12.29–12.30, with k = M_R/19.4 (Eq. 12.22) when the input is a roadbed modulus.
              Sanity check, Problem 12-8: an 8.5-in slab on the twelve moduli preloaded here gives
              k_eff ≈ 300 pci (the text reports 305, the difference being chart-reading precision in the
              original solution).
            </p>
          </>
        ))}

        {tab !== 'effk' && (
          <div className="cee-tablewrap">
            <table className="cee-table">
              <thead>
                <tr>
                  <th>Quality of drainage</th>
                  {DRAIN_SAT.map(s => <th key={s}>{s} saturated</th>)}
                </tr>
              </thead>
              <tbody>
                {DRAIN_QUALITY.map((q, i) => (
                  <tr key={q}>
                    <td>{q}</td>
                    {DRAIN_SAT.map((s, j) => (
                      <td key={s}>{(tab === 'rigid' ? CD_TABLE : M_TABLE)[i][j].toFixed(2)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
