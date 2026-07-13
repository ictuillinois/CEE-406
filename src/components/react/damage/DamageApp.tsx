// Transfer-Function Damage — accumulates AC/base/subgrade rutting and
// bottom-up fatigue cracking versus load repetitions, using the exact
// AASHTOWare-style transfer functions printed in the HW8 assignment.
// Strains come from the student's layered-elastic run (WinJULEA).
import { useEffect, useMemo, useRef, useState } from 'react';
import Tip from '../Tip';
import { useTheme, chartColors, baseLayout, plotConfig, num, fmt } from '../chartTheme';
import '../tools.css';

interface SubRow {
  id: number;
  h: string;   // in
  ev: string;  // vertical strain at mid-depth, µε
}

let nextId = 100;

// HW8 Figure 1 sublayering with placeholder strains — students must replace
// the strains with their own WinJULEA output.
const DEMO_AC: Omit<SubRow, 'id'>[] = [
  { h: '0.5', ev: '62' },
  { h: '0.5', ev: '158' },
  { h: '1', ev: '231' },
  { h: '1', ev: '244' },
  { h: '1', ev: '207' },
];
const DEMO = { base_ev: '385', sg_ev: '262', et: '128' };

/** AC rutting (assignment form), inches. εv dimensionless, h in inches, T °F. */
const rutAC = (ev: number, h: number, T: number, N: number) =>
  N <= 0 ? 0 : ev * h * 3.5 * Math.pow(10, -3.4488) * Math.pow(T, 1.5606) * Math.pow(N, 0.479244);

/** Base/subgrade rutting (assignment form), inches. */
const rutGran = (ev: number, h: number, N: number) =>
  N <= 0 ? 0 : ev * h * 46.55 * Math.exp(-Math.pow(10785.6 / N, 0.174));

/** Fatigue life Nf (εt dimensionless, E_AC psi). */
function fatigueNf(et: number, E: number, hHMA: number) {
  const CH = 1 / (0.000398 + 0.003602 / (1 + Math.exp(11.02 - 3.49 * hHMA)));
  return 0.003612 * CH * Math.pow(et, -3.9492) * Math.pow(E, -1.281);
}

/** Bottom-up cracked area, %, from Miner's DI. */
function fcBottom(DI: number) {
  if (DI <= 0) return 0;
  return (1 / 60) * (6000 / (1 + Math.exp(1.6193 - 2.81 * Math.log10(DI * 100))));
}

export default function DamageApp() {
  const [acRows, setAcRows] = useState<SubRow[]>(DEMO_AC.map(r => ({ ...r, id: nextId++ })));
  const [baseH, setBaseH] = useState('12');
  const [baseEv, setBaseEv] = useState(DEMO.base_ev);
  const [sgH, setSgH] = useState('24');
  const [sgEv, setSgEv] = useState(DEMO.sg_ev);
  const [etStr, setEt] = useState(DEMO.et);
  const [eacStr, setEac] = useState('565000');
  const [tempStr, setTemp] = useState('71');
  const [repsStr, setReps] = useState('1000');
  const [daysStr, setDays] = useState('90');

  const T = num(tempStr, 71);
  const repsDay = Math.max(1, num(repsStr, 1000));
  const days = Math.max(1, num(daysStr, 90));
  const Nmax = repsDay * days;
  const et = num(etStr, 0) * 1e-6;
  const Eac = num(eacStr, 565000);
  const hHMA = acRows.reduce((s, r) => s + num(r.h, 0), 0);

  const isDemo =
    acRows.every((r, i) => DEMO_AC[i] && r.h === DEMO_AC[i].h && r.ev === DEMO_AC[i].ev) &&
    acRows.length === DEMO_AC.length && baseEv === DEMO.base_ev && sgEv === DEMO.sg_ev && etStr === DEMO.et;

  const valid = hHMA > 0 && et > 0 && Eac > 0 && T > 0 &&
    acRows.every(r => num(r.h, 0) > 0 && num(r.ev, 0) > 0) &&
    num(baseH, 0) > 0 && num(baseEv, 0) > 0 && num(sgH, 0) > 0 && num(sgEv, 0) > 0;

  const res = useMemo(() => {
    if (!valid) return null;
    const NPTS = 181;
    const N: number[] = [];
    for (let i = 0; i < NPTS; i++) N.push(Math.round((i / (NPTS - 1)) * Nmax));

    const ac = N.map(n => acRows.reduce((s, r) => s + rutAC(num(r.ev) * 1e-6, num(r.h), T, n), 0));
    const base = N.map(n => rutGran(num(baseEv) * 1e-6, num(baseH), n));
    const sg = N.map(n => rutGran(num(sgEv) * 1e-6, num(sgH), n));
    const total = N.map((_, i) => ac[i] + base[i] + sg[i]);

    const Nf = fatigueNf(et, Eac, hHMA);
    const DI = N.map(n => n / Nf);
    const FC = DI.map(fcBottom);

    const finals = {
      ac: ac[NPTS - 1], base: base[NPTS - 1], sg: sg[NPTS - 1], total: total[NPTS - 1],
      DI: DI[NPTS - 1], FC: FC[NPTS - 1], Nf,
    };
    const parts = [
      { name: 'AC (all sublayers)', v: finals.ac },
      { name: 'Base', v: finals.base },
      { name: 'Subgrade', v: finals.sg },
    ];
    const governing = parts.reduce((a, b) => (b.v > a.v ? b : a)).name;
    return { N, ac, base, sg, total, DI, FC, finals, parts, governing };
  }, [valid, acRows, baseH, baseEv, sgH, sgEv, T, Nmax, et, Eac, hHMA]);

  const theme = useTheme();
  const rutRef = useRef<HTMLDivElement>(null);
  const fcRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!res) return;
    let cancelled = false;
    (async () => {
      const Plotly = (await import('plotly.js-dist-min')).default;
      if (cancelled) return;
      const c = chartColors(theme);

      if (rutRef.current) {
        Plotly.react(rutRef.current, [
          { x: res.N, y: res.total, name: 'Total', mode: 'lines', line: { color: c.ink, width: 2.75 } },
          { x: res.N, y: res.ac, name: 'AC', mode: 'lines', line: { color: c.orange, width: 2 } },
          { x: res.N, y: res.base, name: 'Base', mode: 'lines', line: { color: c.sky, width: 2 } },
          { x: res.N, y: res.sg, name: 'Subgrade', mode: 'lines', line: { color: c.green, width: 2 } },
        ], baseLayout(theme, {
          xaxis: { title: { text: 'Load repetitions N', font: { size: 11 } }, gridcolor: c.grid, zerolinecolor: c.grid, exponentformat: 'SI' as const },
          yaxis: { title: { text: 'Rut depth (in)', font: { size: 11 } }, gridcolor: c.grid, zerolinecolor: c.grid, rangemode: 'tozero' as const },
          hovermode: 'x unified' as const,
        }), plotConfig);
      }
      if (fcRef.current) {
        Plotly.react(fcRef.current, [
          {
            x: res.N, y: res.FC, name: 'FC bottom-up', mode: 'lines',
            line: { color: c.violet, width: 2.5 },
            hovertemplate: 'N %{x:,} · %{y:.3f}%<extra></extra>',
          },
        ], baseLayout(theme, {
          xaxis: { title: { text: 'Load repetitions N', font: { size: 11 } }, gridcolor: c.grid, zerolinecolor: c.grid, exponentformat: 'SI' as const },
          yaxis: { title: { text: 'Bottom-up cracking (% area)', font: { size: 11 } }, gridcolor: c.grid, zerolinecolor: c.grid, rangemode: 'tozero' as const },
          showlegend: false,
          hovermode: 'x unified' as const,
        }), plotConfig);
      }
    })();
    return () => { cancelled = true; };
  }, [res, theme]);

  const updateAc = (id: number, patch: Partial<SubRow>) =>
    setAcRows(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <div className="cee-tool">
      <aside className="cee-panel">
        <h2 className="cee-panel__title">Inputs</h2>

        <div className="cee-field">
          <span className="cee-field__label">
            <span>AC sublayers<Tip text="One row per sublayer, top to bottom — thickness and the vertical strain at its mid-depth from WinJULEA. HW8 uses 0.5/0.5/1/1/1 in." /></span>
            <span className="cee-field__unit">h (in) · εv (µε)</span>
          </span>
          {acRows.map(r => (
            <div className="cee-axle-row cee-axle-row--2" key={r.id}>
              <input className="cee-input" type="number" min="0.1" step="0.25" value={r.h} aria-label="Sublayer thickness (in)"
                onChange={e => updateAc(r.id, { h: e.target.value })} />
              <input className="cee-input" type="number" min="0" step="10" value={r.ev} aria-label="Vertical strain (microstrain)"
                onChange={e => updateAc(r.id, { ev: e.target.value })} />
              <button className="cee-axle-remove" type="button" aria-label="Remove sublayer"
                onClick={() => setAcRows(rs => rs.filter(x => x.id !== r.id))}>×</button>
            </div>
          ))}
          <button className="cee-btn cee-btn--ghost cee-btn--sm" type="button"
            onClick={() => setAcRows(rs => [...rs, { id: nextId++, h: '1', ev: '200' }])}>+ Add sublayer</button>
        </div>

        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="dm-bh">Base h <span className="cee-field__unit">in</span></label>
            <input id="dm-bh" className="cee-input" type="number" min="1" step="1" value={baseH} onChange={e => setBaseH(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="dm-bev">
              <span>Base εv<Tip text="Vertical strain at the base mid-depth. Do not subdivide the base (assignment instruction)." /></span>
              <span className="cee-field__unit">µε</span>
            </label>
            <input id="dm-bev" className="cee-input" type="number" min="0" step="10" value={baseEv} onChange={e => setBaseEv(e.target.value)} />
          </div>
        </div>

        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="dm-sh">
              <span>Subgrade h<Tip text="The assignment says: use 24 in of subgrade for rutting." /></span>
              <span className="cee-field__unit">in</span>
            </label>
            <input id="dm-sh" className="cee-input" type="number" min="1" step="1" value={sgH} onChange={e => setSgH(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="dm-sev">Subgrade εv <span className="cee-field__unit">µε</span></label>
            <input id="dm-sev" className="cee-input" type="number" min="0" step="10" value={sgEv} onChange={e => setSgEv(e.target.value)} />
          </div>
        </div>

        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="dm-et">
              <span>εt AC bottom<Tip text="Tensile strain at the bottom of the AC — enter the magnitude in microstrain." /></span>
              <span className="cee-field__unit">µε</span>
            </label>
            <input id="dm-et" className="cee-input" type="number" min="0" step="10" value={etStr} onChange={e => setEt(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="dm-eac">
              <span>E_AC<Tip text="AC modulus for the fatigue equation — the assignment says use the lowest sublayer modulus (565,000 psi)." /></span>
              <span className="cee-field__unit">psi</span>
            </label>
            <input id="dm-eac" className="cee-input" type="number" min="1" step="5000" value={eacStr} onChange={e => setEac(e.target.value)} />
          </div>
        </div>

        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="dm-t">AC temp T <span className="cee-field__unit">°F</span></label>
            <input id="dm-t" className="cee-input" type="number" min="32" max="130" step="1" value={tempStr} onChange={e => setTemp(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="dm-r">Reps/day <span className="cee-field__unit">–</span></label>
            <input id="dm-r" className="cee-input" type="number" min="1" step="100" value={repsStr} onChange={e => setReps(e.target.value)} />
          </div>
        </div>

        <div className="cee-field">
          <label className="cee-field__label" htmlFor="dm-d">Duration <span className="cee-field__unit">days</span></label>
          <input id="dm-d" className="cee-input" type="number" min="1" max="3650" step="10" value={daysStr} onChange={e => setDays(e.target.value)} />
        </div>

        <p className="cee-hint">
          Transfer functions exactly as printed in the HW8 assignment (AASHTOWare
          form). h_HMA = {hHMA.toFixed(1)} in from your sublayers; strains enter in
          microstrain and are converted internally.
        </p>
      </aside>

      <div className="cee-results">
        <details className="cee-howto">
          <summary>How to use this tool</summary>
          <div className="cee-howto__body">
            <ol>
              <li><strong>Run WinJULEA first</strong> (HW8 P2a): 5 AC sublayers with moduli ordered by loading frequency, base, subgrade.</li>
              <li><strong>Enter the strains</strong>: εv at each sublayer mid-depth (AC, base, subgrade) and εt at the AC bottom — magnitudes, in µε.</li>
              <li><strong>Read the growth curves</strong>: rutting per layer and total, and bottom-up cracked area, from 0 to {Nmax.toLocaleString()} repetitions.</li>
              <li><strong>Answer P2c from the table</strong>: total rutting and the governing layer.</li>
            </ol>
            Because the same load repeats, DI = N/N_f — the sum in Miner’s law collapses. Describe the <em>shapes</em>: rutting grows as a power law (fast early, then flattening), cracking follows a sigmoid (slow, then accelerating).
          </div>
        </details>

        {isDemo && (
          <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>
            These are <strong>placeholder strains</strong> so you can see the tool working — replace
            every εv and εt with your own WinJULEA results before using any number in your report.
          </span></p>
        )}

        {!valid || !res ? (
          <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>Enter positive thicknesses and strains for every layer to see results.</span></p>
        ) : (
          <>
            <div className="cee-keys">
              <div className="cee-key cee-key--accent">
                <div className="cee-key__label">TOTAL RUT AT N = {Nmax.toLocaleString()}</div>
                <div className="cee-key__value">{res.finals.total.toFixed(3)}<small>in</small></div>
              </div>
              <div className="cee-key">
                <div className="cee-key__label">GOVERNING LAYER</div>
                <div className="cee-key__value" style={{ fontSize: '0.95rem' }}>{res.governing}</div>
              </div>
              <div className="cee-key">
                <div className="cee-key__label">FATIGUE LIFE N_f</div>
                <div className="cee-key__value">{res.finals.Nf.toExponential(2)}</div>
              </div>
              <div className="cee-key">
                <div className="cee-key__label">DAMAGE DI</div>
                <div className="cee-key__value">{res.finals.DI.toExponential(2)}</div>
              </div>
              <div className="cee-key">
                <div className="cee-key__label">CRACKING FC</div>
                <div className="cee-key__value">{res.finals.FC.toFixed(2)}<small>%</small></div>
              </div>
            </div>

            <div className="cee-chart-grid cee-chart-grid--2">
              <div className="cee-chart">
                <h3 className="cee-chart__title">Rutting vs. repetitions</h3>
                <div ref={rutRef} />
              </div>
              <div className="cee-chart">
                <h3 className="cee-chart__title">Bottom-up cracking vs. repetitions</h3>
                <div ref={fcRef} />
              </div>
            </div>

            <div className="cee-tablewrap">
              <table className="cee-table">
                <thead>
                  <tr>
                    <th>Layer</th>
                    <th>h (in)</th>
                    <th>Rut at N_max (in)</th>
                    <th>Share</th>
                  </tr>
                </thead>
                <tbody>
                  {res.parts.map(p => (
                    <tr key={p.name}>
                      <td>{p.name}</td>
                      <td>{p.name.startsWith('AC') ? hHMA.toFixed(1) : p.name === 'Base' ? num(baseH).toFixed(0) : num(sgH).toFixed(0)}</td>
                      <td>{p.v.toFixed(4)}</td>
                      <td className="cee-share-cell">
                        <span className="cee-share" aria-hidden="true"><span style={{ width: `${(p.v / res.finals.total) * 100}%` }} /></span>
                        {((p.v / res.finals.total) * 100).toFixed(0)}%
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td><strong>Total</strong></td>
                    <td></td>
                    <td><strong>{res.finals.total.toFixed(4)}</strong></td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="cee-note">
              Equations from the HW8 assignment sheet: AC rutting Rut = εv·h·3.5·10⁻³·⁴⁴⁸⁸·T¹·⁵⁶⁰⁶·N⁰·⁴⁷⁹²⁴⁴;
              granular rutting Rut = εv·h·46.55·exp(−(10785.6/N)⁰·¹⁷⁴); N_f = 0.003612·C_H·εt⁻³·⁹⁴⁹²·E_AC⁻¹·²⁸¹
              with the C_H thickness correction; FC_bottom is the AASHTOWare sigmoid on DI.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
