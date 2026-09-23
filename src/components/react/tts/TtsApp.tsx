import { useEffect, useMemo, useState } from 'react';
import Card from '../ui/Card';
import Tip from '../Tip';
import Equation from '../ui/Equation';
import KpiStrip, { Kpi } from '../ui/KpiStrip';
import { useTheme, HUES, HUE_ORDER, chartColors, withAlpha, mixHex } from '../chartTheme';
import { fmt } from '../fitting/shared';
import { DEFAULT_DATA } from './data.ts';
import {
  temperatures, zeroShifts, shiftData, rebaseShifts, validateData, parseData, dataCSV,
  fitSigmoid, sigmoidLog, overlapError, fitSpectrum, spectrumAt, fitShiftLaw, shiftLawAt, predictModulus, WLF_C2_MAX,
  type TestPoint, type Shifts, type ShiftedPoint, type SigmoidFit, type Spectrum,
} from './equations.ts';
import TtsPlot from './TtsPlot';
import '../tools.css';
import './tts.css';

type Stage = 'data' | 'shift' | 'results';
interface Snapshot { points: ShiftedPoint[]; shifts: Shifts; reference: number; fit: SigmoidFit; spectrum: Spectrum | null; equilibrium: number }
const columns = ['Temperature (°C)', 'Frequency (Hz)', '|E*| (MPa)', 'Phase (°)'];
const toRows = (data: TestPoint[]) => data.map(p => [String(p.temperature), String(p.frequency), String(p.modulus), p.phase === null ? '' : String(p.phase)]);
const symbols = ['circle', 'square', 'diamond', 'triangle-up', 'triangle-down', 'cross', 'x', 'star', 'hexagon', 'pentagon', 'hourglass', 'bowtie'];
function download(name: string, content: string, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Keep incomplete keyboard input (blank, minus, decimal) while editing. */
function ShiftValue({ value, temperature, index, disabled, onChange }: {
  value: number; temperature: number; index: number; disabled: boolean; onChange: (v: number) => void;
}) {
  const [text, setText] = useState(String(Number(value.toFixed(5))));
  useEffect(() => setText(String(Number(value.toFixed(5)))), [value]);
  return <input id={`tts-shift-${index}`} className="cee-input" type="number" step="0.05" min="-24" max="24"
    disabled={disabled} aria-label={`Log shift at ${temperature} °C`} value={text}
    onChange={e => {
      setText(e.target.value);
      if (e.target.value.trim() !== '' && Number.isFinite(Number(e.target.value))) onChange(Number(e.target.value));
    }} onBlur={() => setText(String(Number(value.toFixed(5))))} />;
}

export default function TtsApp() {
  const [data, setData] = useState<TestPoint[]>(DEFAULT_DATA);
  const [draft, setDraft] = useState(() => toRows(DEFAULT_DATA));
  const [paste, setPaste] = useState('');
  const [dataError, setDataError] = useState('');
  const [stage, setStage] = useState<Stage>('shift');
  const [shifts, setShifts] = useState<Shifts>(() => zeroShifts(DEFAULT_DATA));
  const [reference, setReference] = useState(21);
  const [shiftError, setShiftError] = useState('');
  const [history, setHistory] = useState<Shifts[]>([]);
  const [best, setBest] = useState<{ shifts: Shifts; error: number } | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [equilibrium, setEquilibrium] = useState('1');
  const [message, setMessage] = useState('PG 64-22 · 30 points · 5 temperatures · shifts start at zero.');
  const [rawView, setRawView] = useState(false);
  const theme = useTheme(), colors = chartColors(theme);
  const ts = useMemo(() => temperatures(data), [data]);
  const shifted = useMemo(() => shiftData(data, shifts), [data, shifts]);
  const fit = useMemo(() => fitSigmoid(shifted), [shifted]);
  const overlap = useMemo(() => overlapError(shifted), [shifted]);
  const legend = ts.map((t, i) => ({ label: `${t} °C`, color: HUES[theme][HUE_ORDER[i % HUE_ORDER.length]] }));
  const fitLegend = [...legend, { label: 'Sigmoid fit', color: colors.ink, shape: 'line' as const }];
  const nonmonotone = ts.some((t, i) => i > 0 && shifts[t] > shifts[ts[i - 1]] + 1e-8);
  const phaseCount = data.filter(p => p.phase !== null).length;
  const unapplied = JSON.stringify(draft) !== JSON.stringify(toRows(data));

  function replaceData(points: TestPoint[], label: string) {
    validateData(points);
    const temps = temperatures(points);
    const ref = temps.includes(21) ? 21 : temps[Math.floor(temps.length / 2)];
    setData(points); setDraft(toRows(points)); setShifts(zeroShifts(points));
    setReference(ref); setHistory([]); setBest(null); setSnapshot(null);
    setDataError(''); setShiftError(''); setMessage(`${label} · ${points.length} readings. Shifts reset to zero.`);
    // Keep the script's 1 MPa floor where appropriate; support softer custom materials.
    setEquilibrium(String(Math.min(1, Math.min(...points.map(p => p.modulus)) * 0.01)));
  }
  function changeShift(t: number, value: number) {
    if (!Number.isFinite(value)) return;
    try {
      const next = rebaseShifts(ts, { ...shifts, [t]: value }, reference);
      setHistory(h => [...h.slice(-49), shifts]); setShifts(next); setSnapshot(null); setShiftError('');
    } catch (e) { setShiftError((e as Error).message); }
  }
  function changeReference(value: string) {
    const ref = value.trim() === '' ? NaN : Number(value);
    if (!ts.includes(ref)) { setShiftError('Select a temperature from the loaded data.'); return; }
    try {
      const next = rebaseShifts(ts, shifts, ref);
      const nextBest = best ? { ...best, shifts: rebaseShifts(ts, best.shifts, ref) } : null;
      setShifts(next);
      setBest(nextBest);
      setReference(ref); setHistory([]); setSnapshot(null); setShiftError('');
      setMessage(`Reference: ${ref} °C · relative shifts preserved.`);
    } catch (e) { setShiftError((e as Error).message); }
  }
  function finalize() {
    if (!fit) return;
    const floor = Number(equilibrium);
    if (!(floor > 0) || !Number.isFinite(floor)) { setShiftError('Enter a positive, finite long-term modulus.'); return; }
    const spectrum = fitSpectrum(shifted, floor);
    setSnapshot({ points: shifted.map(p => ({ ...p })), shifts: { ...shifts }, reference, fit, spectrum, equilibrium: floor });
    setStage('results'); setShiftError('');
    setMessage('Final fit saved. Editing inputs clears these results.');
  }
  function groupTraces(points: ShiftedPoint[], property: 'modulus' | 'storage' | 'loss' | 'phase', raw = false) {
    return ts.map((t, i) => {
      const rows = points.filter(p => p.temperature === t && (property === 'modulus' || p.phase !== null)).sort((a, b) => a.frequency - b.frequency);
      return { x: rows.map(p => raw ? p.frequency : p.reducedFrequency),
        y: rows.map(p => property === 'modulus' ? p.modulus : property === 'phase' ? p.phase
          : property === 'storage' ? p.modulus * Math.cos(p.phase! * Math.PI / 180) : p.modulus * Math.sin(p.phase! * Math.PI / 180)),
        type: 'scatter', mode: 'lines+markers', name: `${t} °C`,
        line: { color: withAlpha(legend[i].color, 0.55), width: 1.3, dash: 'dot' },
        marker: { color: withAlpha(legend[i].color, 0.85), size: 9, symbol: symbols[i],
          line: { color: mixHex(legend[i].color, colors.ink, 0.35), width: 1.4 } },
        hovertemplate: `${t} °C<br>%{x:.4g} Hz<br>%{y:.4g}<extra></extra>` };
    });
  }
  const domain = (points: ShiftedPoint[]) => {
    const low = Math.min(...points.map(p => p.logFrequency)), high = Math.max(...points.map(p => p.logFrequency));
    return Array.from({ length: 160 }, (_, i) => 10 ** (low + (high - low) * i / 159));
  };
  const masterTraces: Record<string, unknown>[] = groupTraces(shifted, 'modulus', rawView || stage === 'data');
  if (fit && !rawView && stage !== 'data') {
    const f = domain(shifted);
    masterTraces.unshift({ x: f, y: f.map(fr => 10 ** sigmoidLog(fit, Math.log10(fr))), type: 'scatter', mode: 'lines', name: 'Sigmoid fit', line: { color: colors.ink, width: 3 } });
  }

  return <div className="cee-tool tts-tool">
    <div className="tts-top">
      <nav className="cee-seg tts-stages" aria-label="Superposition workflow">
        {(['data', 'shift', 'results'] as Stage[]).map((s, i) => <button key={s} type="button"
          aria-current={stage === s ? 'step' : undefined} className={stage === s ? 'is-active' : ''}
          disabled={s === 'results' && !snapshot} onClick={() => setStage(s)}>
          {i + 1}. {s === 'data' ? 'Test data' : s === 'shift' ? 'Shift & compare' : 'Final fit'}</button>)}
      </nav>
      <p role="status" className="cee-hint">{message}</p>
      {unapplied && <p className="cee-note" role="status">Unapplied edits — select Apply table to update the calculations.</p>}
    </div>

    {stage === 'data' ? <div className="tts-wide cee-results">
      <Card title="Test data" subtitle="One dataset · °C · Hz · MPa · degrees"
        affordance={<Tip text="Default: PG 64-22 (M1 R27-233), Johann J. Cardenas, 2023. One modulus and one phase angle per temperature/frequency pair. Data stay in your browser." />}>
        <div className="tts-actions">
          <button type="button" className="cee-chip" onClick={() => replaceData(DEFAULT_DATA, 'Default data restored')}>Restore default data</button>
          <button type="button" className="cee-chip" onClick={() => download('tts-test-data.csv', dataCSV(data))}>Download data / template</button>
          <label className="cee-chip tts-upload">Import CSV
            <input type="file" accept=".csv,.txt,.tsv" aria-label="Import test data CSV" onChange={async e => {
              const file = e.target.files?.[0]; if (!file) return;
              try { if (file.size > 250000) throw Error('Keep the file under 250 kB (maximum 500 readings).');
                replaceData(parseData(await file.text()), 'Imported data');
              } catch (err) { setDataError((err as Error).message); }
              e.target.value = '';
            }} />
          </label>
        </div>
        <details className="cee-howto">
          <summary>Paste CSV or spreadsheet columns</summary>
          <div className="cee-howto__body">
            <p>Header: <code>temperature_C,frequency_Hz,modulus_MPa,phase_deg</code>. Tabs and semicolons also work.
              The phase column may be omitted or left blank; measured phase is needed for storage and loss fitting.</p>
            <textarea className="cee-textarea" rows={7} aria-label="Pasted test data" value={paste} onChange={e => setPaste(e.target.value)} />
            <button type="button" className="cee-btn cee-btn--primary" onClick={() => {
              try { replaceData(parseData(paste), 'Pasted data'); setPaste(''); } catch (err) { setDataError((err as Error).message); }
            }}>Load pasted data</button>
          </div>
        </details>
        <p className="cee-hint">Edit → Apply table. New data reset the shifts.
          <Tip text="Use 2–12 temperature groups with at least three distinct frequencies each. Phase is optional for shifting but required for supplemental response fitting." /></p>
        <div className="cee-tablewrap tts-editor" tabIndex={0} role="region" aria-label="Editable test readings">
          <table className="cee-table"><thead><tr><th>Row</th>{columns.map(c => <th key={c}>{c}</th>)}<th>Remove</th></tr></thead>
            <tbody>{draft.map((row, i) => <tr key={i}><th scope="row">{i + 1}</th>{row.map((v, j) => <td key={j}>
              <input className="cee-input" type="number" step="any" value={v} aria-label={`${columns[j]}, row ${i + 1}`}
                onChange={e => setDraft(rows => rows.map((r, k) => k === i ? r.map((cell, n) => n === j ? e.target.value : cell) : r))} />
            </td>)}<td><button type="button" className="cee-chip" aria-label={`Remove row ${i + 1}`} onClick={() => setDraft(rows => rows.filter((_, k) => k !== i))}>×</button></td></tr>)}</tbody>
          </table>
        </div>
        <div className="tts-actions">
          <button type="button" className="cee-chip" disabled={draft.length >= 500} onClick={() => setDraft(rows => [...rows, ['', '', '', '']])}>Add reading</button>
          <button type="button" className="cee-btn cee-btn--primary" onClick={() => {
            try { replaceData(parseData('temperature_C,frequency_Hz,modulus_MPa,phase_deg\n' + draft.map(r => r.join(',')).join('\n')), 'Edited data applied'); }
            catch (err) { setDataError((err as Error).message); }
          }}>Apply table</button>
          <button type="button" className="cee-chip" disabled={unapplied} onClick={() => setStage('shift')}>Continue to shifting →</button>
        </div>
        {dataError && <p role="alert" className="tts-error">{dataError} The active dataset has not changed.</p>}
      </Card>
      <TtsPlot title="Unshifted test results" subtitle="Measured values, grouped by temperature."
        xTitle="Measured frequency f (Hz)" yTitle="Dynamic modulus |E*| (MPa)" traces={groupTraces(shifted, 'modulus', true)} legend={legend} />
    </div> : stage === 'shift' ? <>
      <aside className="cee-panel tts-controls" aria-label="Your shift factors" tabIndex={0}>
        <h2 className="cee-panel__title">Your shift factors</h2>
        <label className="cee-field__label" htmlFor="tts-ref">Reference temperature (°C)</label>
        <div className="tts-reference">
          <select id="tts-ref" className="cee-input" value={reference} onChange={e => changeReference(e.target.value)}>
            {ts.map(t => <option key={t} value={t}>{t} °C</option>)}
          </select>
        </div>
        <p className="cee-hint">log₁₀(aT): +1 → ×10 frequency.
          <Tip text="Positive shifts move right; negative shifts move left. Enter a value, use the ± buttons, or drag the slider. Every point at that temperature moves together." /></p>
        {ts.map((t, i) => <div className="tts-shift" key={t} style={{ borderLeftColor: legend[i].color }}>
          <label htmlFor={`tts-shift-${i}`}><strong>{t} °C</strong><span>{t === reference ? 'Reference · fixed' : `aT = ${fmt(10 ** shifts[t], 3)}`}</span></label>
          <div className="tts-shift-input">
            <button className="cee-chip" type="button" disabled={t === reference} aria-label={`Shift ${t} °C left by 0.1 in log shift`} onClick={() => changeShift(t, shifts[t] - 0.1)}>−</button>
            <ShiftValue value={shifts[t]} temperature={t} index={i} disabled={t === reference} onChange={value => changeShift(t, value)} />
            <button className="cee-chip" type="button" disabled={t === reference} aria-label={`Shift ${t} °C right by 0.1 in log shift`} onClick={() => changeShift(t, shifts[t] + 0.1)}>+</button>
          </div>
          <input type="range" min={Math.min(-8, shifts[t])} max={Math.max(8, shifts[t])} step="0.05" value={shifts[t]} disabled={t === reference}
            aria-label={`Slide log shift at ${t} °C`} onChange={e => changeShift(t, Number(e.target.value))} />
        </div>)}
        <div className="tts-actions">
          <button type="button" className="cee-chip" disabled={!history.length} onClick={() => {
            setShifts(history.at(-1)!); setHistory(h => h.slice(0, -1)); setSnapshot(null);
          }}>Undo</button>
          <button type="button" className="cee-chip" onClick={() => {
            setHistory(h => [...h.slice(-49), shifts]); setShifts(zeroShifts(data)); setSnapshot(null); setShiftError('');
          }}>Reset shifts</button>
        </div>
        {shiftError && <p className="tts-error" role="alert">{shiftError}</p>}
      </aside>
      <div className="cee-results">
        <KpiStrip>
          <Kpi accent label="Fit error · 1 − R²" value={fit ? (1 - fit.r2).toFixed(6) : '—'} tip="Lower is better; zero is a perfect fit. Error = Σ(log10 measured modulus − log10 predicted modulus)² / Σ(log10 measured modulus − mean log10 measured modulus)². Log space balances low and high modulus values. Error can exceed 1. Only sigmoid parameters are fitted automatically." />
          <Kpi label="R² · log modulus" value={fit ? fit.r2.toFixed(6) : '—'} tip="Higher is better; 1 is a perfect fit. A negative R² means the prediction is worse than using the mean log modulus." />
          <Kpi label="Connected neighbors" value={`${overlap.pairs} / ${overlap.totalPairs}`} tip="Neighboring temperatures with overlapping measured frequency ranges after shifting. A low error with disconnected curves does not establish a master curve." />
        </KpiStrip>
        <p className="cee-hint">Minimize fit error. Target: 0.</p>
        <div className="tts-actions">
          <div className="cee-seg" aria-label="Frequency view">
            <button type="button" className={!rawView ? 'is-active' : ''} aria-pressed={!rawView} onClick={() => setRawView(false)}>Shifted curves</button>
            <button type="button" className={rawView ? 'is-active' : ''} aria-pressed={rawView} onClick={() => setRawView(true)}>Original measurements</button>
          </div>
          <button type="button" className="cee-chip" onClick={() => setStage('data')}>Edit test data</button>
        </div>
        <TtsPlot title={rawView ? 'Before shifting · measured isotherms' : `Build one curve at ${reference} °C`}
          subtitle={rawView ? 'Original frequency · no shifts applied.' : 'Colored markers: test data · solid line: sigmoid.'}
          help="Each temperature keeps its color and symbol. Dotted lines connect its readings. The solid curve is refitted after each edit, without changing your shifts."
          xTitle={rawView ? 'Measured frequency f (Hz)' : 'Reduced frequency fr = f × aT (Hz)'} yTitle="Dynamic modulus |E*| (MPa)"
          traces={masterTraces} legend={rawView ? legend : fitLegend} height={370} />
        <div className="tts-callouts">
          <div className="tts-callout"><h3>Shift factors must be unique <Tip text="One consistent factor per temperature applies to all frequencies, moduli and phase readings. Different temperatures can share a numeric factor; sparse data may not identify a unique best fit." /></h3><p>One temperature, one shift, for every response.</p></div>
          <div className="tts-callout"><h3>Anchor the reference <Tip text="Colder curves usually move right and warmer curves left. Changing reference translates all curves together, preserving their relative spacing and fit error." /></h3><p>At Tref: aT = 1; log₁₀(aT) = 0.</p></div>
          <div className="tts-callout"><h3>Check the overlap <Tip text="A small sigmoid error can hide disconnected curves. Check neighboring overlap and phase: horizontal shifts cannot repair incompatible curve shapes." /></h3><p>Low error alone does not establish superposition.</p></div>
        </div>
        {(nonmonotone || overlap.pairs < overlap.totalPairs) && <div className="cee-note" role="status">
          {nonmonotone && <p>Shifts increase with temperature in one or more intervals. Check their direction.</p>}
          {overlap.pairs < overlap.totalPairs && <p>Some neighboring curves do not overlap. Check their alignment.</p>}
        </div>}
        <Card title="Keep your fit" affordance={<Tip text="The sigmoid adjusts its shape to your shifted data. Only you change the shift factors. Compare errors with experimental scatter; there is no universal passing threshold." />}>
          <Equation tex={'f_r=f\\,a_T,\\qquad x=\\log_{10} f_r=\\log_{10} f+\\log_{10}a_T'} plain="fr = f × aT; log10 fr = log10 f + log10 aT" display />
          <div className="tts-actions">
            <button type="button" className="cee-chip" disabled={!fit} onClick={() => {
              if (fit) { setBest({ shifts: { ...shifts }, error: 1 - fit.r2 }); setMessage('Attempt saved.'); }
            }}>Save this attempt</button>
            <button type="button" className="cee-chip" disabled={!best} onClick={() => { if (best) {
              setHistory(h => [...h.slice(-49), shifts]); setShifts(best.shifts); setSnapshot(null);
            } }}>Restore saved{best ? ` (${best.error.toFixed(6)})` : ''}</button>
          </div>
          <details className="cee-howto"><summary>Response-model assumption</summary><div className="cee-howto__body">
            <label htmlFor="tts-equilibrium">Long-term modulus E∞ (MPa)
              <Tip text="Default 1 MPa. Use a positive value below the smallest storage modulus. This controls long-time limits, not your shifts or sigmoid error." /></label>
            <input id="tts-equilibrium" className="cee-input" type="number" min="0" step="0.1" value={equilibrium} onChange={e => { setEquilibrium(e.target.value); setSnapshot(null); }} />
          </div></details>
          {phaseCount < data.length && <p className="cee-note">Phase: {phaseCount}/{data.length} readings.
            <Tip text="Shifting uses all modulus values. Supplemental response fitting uses only rows with measured phase; at least six are required." /></p>}
          <button type="button" className="cee-btn cee-btn--primary" disabled={!fit} onClick={finalize}>Use these shifts → final fit</button>
        </Card>
      </div>
    </> : snapshot && <div className="tts-wide cee-results">
      <FinalResults snapshot={snapshot} legend={legend} groupTraces={groupTraces} domain={domain} color={colors.ink} />
      <button type="button" className="cee-chip" onClick={() => setStage('shift')}>← Return to manual shifting</button>
    </div>}
  </div>;
}

export function FinalResults({ snapshot: s, legend, groupTraces, domain, color }: {
  snapshot: Snapshot;
  legend: { label: string; color: string }[];
  groupTraces: (p: ShiftedPoint[], property: 'modulus' | 'storage' | 'loss' | 'phase') => Record<string, unknown>[];
  domain: (p: ShiftedPoint[]) => number[]; color: string;
}) {
  const shiftFitColor = HUES[useTheme()][HUE_ORDER[0]];
  const [predictionTemperature, setPredictionTemperature] = useState(String(s.reference));
  const [predictionFrequency, setPredictionFrequency] = useState('10');
  const f = domain(s.points), ts = temperatures(s.points), spectrum = s.spectrum;
  const law = fitShiftLaw(ts, s.shifts, s.reference);
  const pole = law ? s.reference - law.c2 : null;
  const temperature = predictionTemperature.trim() === '' ? NaN : Number(predictionTemperature);
  const frequency = predictionFrequency.trim() === '' ? NaN : Number(predictionFrequency);
  const prediction = law ? predictModulus(s.fit, law, temperature, frequency) : null;
  const belowPole = pole !== null && Number.isFinite(temperature) && temperature <= pole;
  const extrapolated = prediction && (temperature < ts[0] || temperature > ts.at(-1)! ||
    prediction.logFrequency < Math.min(...s.points.map(p => p.logFrequency)) || prediction.logFrequency > Math.max(...s.points.map(p => p.logFrequency)));
  const temperatureCurve = Array.from({ length: 120 }, (_, i) => ts[0] + (ts.at(-1)! - ts[0]) * i / 119);
  const predictions = spectrum ? f.map(fr => spectrumAt(spectrum, fr)) : [];
  const line = (x: number[], y: number[], name: string) => ({ x, y, name, type: 'scatter', mode: 'lines', line: { color, width: 3 } });
  const responseLegend = [...legend, { label: 'Response model', color, shape: 'line' as const }];
  const overlap = overlapError(s.points);
  const poor = overlap.pairs < overlap.totalPairs;
  return <>
    <Card title={`Your final fit · reference ${s.reference} °C`} subtitle="Your shifts · fixed across every response">
      <Equation tex={'\\log_{10}|E^*|=\\delta+\\frac{\\alpha}{1+\\exp(\\beta+\\gamma\\log_{10}f_r)}'} plain="log10 |E*| = δ + α / [1 + exp(β + γ log10 fr)]" display />
      <KpiStrip>
        <Kpi label="δ" value={fmt(s.fit.delta, 6)} tip="Lower log10 modulus asymptote, with modulus in MPa." />
        <Kpi label="α" value={fmt(s.fit.alpha, 6)} tip="Difference between upper and lower log10 modulus asymptotes." />
        <Kpi label="β" value={fmt(s.fit.beta, 6)} tip="Horizontal position parameter; it changes when you change the reference temperature." />
        <Kpi label="γ" value={fmt(s.fit.gamma, 6)} tip="Negative for a modulus that increases with reduced frequency." />
      </KpiStrip>
      <p className="cee-field__label">Temperature-shift fit · Williams–Landel–Ferry</p>
      <Equation tex={'\\log_{10}a_T=\\frac{-C_1\\,(T-T_{ref})}{C_2+(T-T_{ref})}'} plain="log10 aT = −C1 (T − Tref) / [C2 + (T − Tref)]" display />
      <p className="cee-hint">Reference: {s.reference} °C · fitted to your shifts.
        <Tip text="Equal-weight least squares over your saved log10 shift factors; it changes neither them nor the sigmoid. C1 enters linearly once C2 is fixed, so only C2 is searched, and the reference is satisfied exactly rather than fitted. Both constants belong to this reference temperature: the WLF form itself converts exactly — a reference moved by ΔT gives C₂′ = C₂ + ΔT and C₁′ = C₁C₂/C₂′ — but refitting at another reference anchors the residuals elsewhere, so converting and refitting agree only as far as the fit is good." /></p>
      {ts.length < 3 && <p className="cee-hint">WLF fitting needs three temperatures; two cannot separate C₁ from C₂.</p>}
      {law ? <KpiStrip>
        <Kpi label="C₁" value={fmt(law.c1, 6)} tip="Dimensionless. Far above the reference log₁₀ aT approaches −C₁, so C₁ is the whole shift in log₁₀ frequency the law has on the hot side; with C₂ it also fixes the slope at the reference, C₁/C₂ per °C." />
        <Kpi label="C₂" value={fmt(law.c2, 6)} unit="°C" tip={`Degrees Celsius. WLF is singular at T = Tref − C₂ = ${fmt(pole, 4)} °C; the fit holds that pole below your coldest test temperature, and no shift is reported at or below it.`} />
        <Kpi label="Shift-fit R²" value={law.r2 === null ? '—' : law.r2.toFixed(6)} tip="R² compares fitted and student log10 shift factors, with equal weight per temperature. Undefined if all shift factors are equal. This is separate from sigmoid fit quality." />
      </KpiStrip> : <p role="status">The WLF fit is unavailable for these temperatures.</p>}
      {law?.atBound && <p className="cee-note">{law.c2 >= WLF_C2_MAX * 0.99
        ? `C₂ reached the fitting ceiling of ${fmt(WLF_C2_MAX, 4)} °C. These shifts carry no curvature, and a straight line is the C₂ → ∞ limit of WLF, so only the ratio C₁/C₂ = ${fmt(law.c1 / law.c2, 4)} per °C is determined, not C₁ and C₂ separately.`
        : `C₂ reached its lower limit, putting the WLF singularity at ${fmt(pole, 4)} °C, just under your coldest reading. Treat cold extrapolation as unsupported.`}</p>}
      <p>Fit error (1 − R²): <strong>{(1 - s.fit.r2).toFixed(6)}</strong> · R²: {s.fit.r2.toFixed(6)}
        <Tip text="Both metrics use log10 modulus. Minimize fit error toward zero. In the sigmoid, exp uses base e; modulus is in MPa and reduced frequency in Hz." /></p>
      {poor && <p className="cee-note">Some curves do not overlap. Review the alignment.</p>}
      {s.fit.atBound && <p className="cee-note">A sigmoid plateau reached its fitting limit; extrapolated values are uncertain.</p>}
      <div className="tts-actions">
        <button type="button" className="cee-chip" onClick={() => download('tts-final-fit.json', JSON.stringify({
          reference_C: s.reference, units: { modulus: 'MPa', frequency: 'Hz', time: 's' },
          fitError: { metric: '1 - R2 in log10 modulus', value: 1 - s.fit.r2 },
          temperatureShiftFit: law && { model: 'WLF', equation: 'log10(aT) = -C1 (T - Tref) / (C2 + T - Tref)',
            reference_C: law.reference, C1: law.c1, C2_C: law.c2, singularTemperature_C: pole, r2: law.r2, c2AtFittingBound: law.atBound },
          log10ShiftFactors: s.shifts, sigmoid: s.fit, equilibrium_MPa: s.equilibrium,
          responseModel: s.spectrum, readings: s.points,
        }, null, 2), 'application/json')}>Download fit + shifts</button>
        <button type="button" className="cee-chip" onClick={() => download('tts-shifted-data.csv',
          'temperature_C,frequency_Hz,modulus_MPa,phase_deg,log10_aT,reduced_frequency_Hz\n' +
          s.points.map(p => [p.temperature, p.frequency, p.modulus, p.phase ?? '', s.shifts[p.temperature], p.reducedFrequency].join(',')).join('\n'))}>Download shifted data</button>
      </div>
    </Card>
    <div className="cee-chart-grid cee-chart-grid--2">
      <TtsPlot title="Dynamic modulus · reduced frequency" subtitle={`Sigmoid · ${s.reference} °C`}
        help="The fitted line is drawn only across the shifted measurement range. It does not establish behavior outside that range."
        xTitle="Reduced frequency fr (Hz)" yTitle="|E*| (MPa)" legend={[...legend, { label: 'Sigmoid fit', color, shape: 'line' }]}
        traces={[line(f, f.map(fr => 10 ** sigmoidLog(s.fit, Math.log10(fr))), 'Sigmoid fit'), ...groupTraces(s.points, 'modulus')]} />
      <TtsPlot title="Shift factors" subtitle="WLF fit to your shifts"
        help="Markers are your saved shifts; the dashed curve is the least-squares WLF law. The star marks the fixed reference. This curve supplies shifts for the predictor below."
        xTitle="Temperature (°C)" yTitle="log₁₀(aT)" logX={false} logY={false} legend={[{ label: 'Your shifts', color }, { label: 'WLF fit', color: shiftFitColor, shape: 'line' }]}
        traces={[...(law ? [{ ...line(temperatureCurve, temperatureCurve.map(t => shiftLawAt(law, t)), 'WLF fit'), line: { color: shiftFitColor, width: 3, dash: 'dash' } }] : []), { ...line(ts, ts.map(t => s.shifts[t]), 'Your shifts'), mode: 'markers', marker: { size: 9, color, line: { color: 'white', width: 1.2 } } },
          { x: [s.reference], y: [0], type: 'scatter', mode: 'markers', marker: { symbol: 'star', size: 14, color, line: { color: 'white', width: 1.2 } }, name: 'Reference' }]} />
    </div>
    <Card title="Response fit" affordance={<Tip text="Measured modulus and phase give storage and loss. A nonnegative relaxation spectrum fits those responses using your fixed shifts, supplying the following curves. This supplemental model is separate from the sigmoid." />}>
      <Equation tex={'E^{\\prime}=|E^*|\\cos\\phi,\\qquad E^{\\prime\\prime}=|E^*|\\sin\\phi'} plain="Storage E′ = |E*| cos φ; loss E″ = |E*| sin φ" display />
      {spectrum ? <p>Assumed E∞ = {fmt(s.equilibrium)} MPa. {spectrum.converged ? '' : 'The response fit did not converge; its curves are provisional.'}</p>
        : <p role="status">Response curves are unavailable. Supply at least six phase readings and E∞ below the smallest storage modulus.</p>}
    </Card>
    <div className="cee-chart-grid cee-chart-grid--2">
      {(['storage', 'loss', 'phase'] as const).map(property => <TtsPlot key={property}
        title={property === 'storage' ? 'Storage modulus' : property === 'loss' ? 'Loss modulus' : 'Phase angle'}
        subtitle="Your shifts · measured points and response model"
        help={property === 'phase' ? 'Phase must use the same shift factors as modulus; it cannot be shifted separately.' : property === 'loss' ? 'Loss is calculated from measured modulus and phase. Zero loss values are omitted on a logarithmic axis.' : 'Storage is calculated from measured modulus and phase. Only frequency is shifted.'}
        xTitle="Reduced frequency fr (Hz)" yTitle={property === 'storage' ? 'E′ (MPa)' : property === 'loss' ? 'E″ (MPa)' : 'φ (degrees)'}
        logY={property !== 'phase'} legend={spectrum ? responseLegend : legend}
        traces={[...(spectrum ? [line(f, predictions.map(p => p[property]), 'Response model')] : []), ...groupTraces(s.points, property)]} />)}
    </div>
    <Card title="Predict dynamic modulus" subtitle="Temperature + frequency → |E*|"
      affordance={<Tip text="The fitted WLF law predicts log10(aT). Add log10(f) to obtain log10(fr), then evaluate the saved sigmoid. The output is the magnitude |E*| in MPa. Prediction uses the fitted shift curve, so it can differ from the manually shifted measurements." />}>
      <div className="tts-prediction-inputs">
        <label className="cee-field__label">Temperature (°C)
          <input className="cee-input" type="number" step="any" value={predictionTemperature} onChange={e => setPredictionTemperature(e.target.value)} /></label>
        <label className="cee-field__label">Frequency (Hz)
          <input className="cee-input" type="number" step="any" min="0" value={predictionFrequency} onChange={e => setPredictionFrequency(e.target.value)} /></label>
      </div>
      <div aria-live="polite">
        {belowPole ? <p role="status">At or below {fmt(pole, 4)} °C the WLF law is singular and reports no shift. Enter a warmer temperature.</p>
          : prediction ? <KpiStrip>
          <Kpi accent label="Predicted |E*|" value={fmt(prediction.modulus, 6)} unit="MPa" />
          <Kpi label="log₁₀(aT)" value={fmt(prediction.logShift, 6)} />
          <Kpi label="log₁₀(fr / Hz)" value={fmt(prediction.logFrequency, 6)} />
        </KpiStrip> : <p role="status">Enter a finite temperature and a positive frequency with an available shift fit.</p>}
        {extrapolated && <p className="cee-note">Extrapolation: outside the measured temperature or reduced-frequency range.</p>}
      </div>
    </Card>
    <Card title="Shift factors and residuals" subtitle="Error by temperature">
      <div className="cee-tablewrap" tabIndex={0} role="region" aria-label="Final shift factors"><table className="cee-table">
        <thead><tr><th>Temperature (°C)</th><th>log₁₀(aT)</th><th>aT</th><th>Readings</th><th>Mean absolute error (%)</th></tr></thead>
        <tbody>{ts.map(t => { const points = s.points.filter(p => p.temperature === t);
          const error = 100 * points.reduce((sum, p) => sum + Math.abs(10 ** sigmoidLog(s.fit, p.logFrequency) / p.modulus - 1), 0) / points.length;
          return <tr key={t}><th scope="row">{t}</th><td>{fmt(s.shifts[t], 6)}</td><td>{fmt(10 ** s.shifts[t], 6)}</td><td>{points.length}</td><td>{error.toFixed(5)}</td></tr>;
        })}</tbody>
      </table></div>
      <p className="cee-hint">Residuals are relative to measured modulus.
        <Tip text="Each row averages |predicted modulus − measured modulus| / measured modulus × 100. These per-temperature diagnostics complement the overall log-space fit error." /></p>
    </Card>
  </>;
}
