import { useEffect, useRef, useState } from 'react';
import Card from '../ui/Card';
import Equation from '../ui/Equation';
import { density, distributionStats, formulas, normalAreas, normalTable } from './equations';
import '../tools.css';
import './gauss.css';
import ReliabilityTab from './ReliabilityTab';

type Mode = 'middle' | 'left' | 'right' | 'central';
const modes: { id: Mode; name: string; label: string }[] = [
  { id: 'middle', name: 'Table 10.1 area', label: 'Between the mean and cutoff' },
  { id: 'left', name: 'Cumulative probability', label: 'At or below the cutoff · P(X ≤ x)' },
  { id: 'right', name: 'Right-tail probability', label: 'Above the cutoff · P(X > x)' },
  { id: 'central', name: 'Symmetric interval', label: 'Within |z| standard deviations of the mean' },
];
const number = (s: string) => s.trim() === '' ? NaN : Number(s);
const fmt = (n: number) => Math.abs(n) >= 1e6 || (n !== 0 && Math.abs(n) < .0001) ? n.toExponential(4) : new Intl.NumberFormat('en-US', { maximumFractionDigits: 5 }).format(n);
const prob = (n: number) => n > 0 && n < .000001 ? n.toExponential(6) : n.toFixed(6);

function Field({ label, value, onChange, min, max, step = 'any' }: {
  label: string; value: string; onChange: (v: string) => void; min?: number; max?: number; step?: string;
}) {
  return <label className="gauss-field"><span>{label}</span><input type="number" value={value} onChange={e => onChange(e.target.value)} min={min} max={max} step={step} /></label>;
}

function DistributionExplorer() {
  const [mean, setMean] = useState('0'), [sd, setSd] = useState('1');
  const [cutoff, setCutoff] = useState('1.34'), [input, setInput] = useState<'z' | 'x'>('z');
  const [mode, setMode] = useState<Mode>('middle');
  const [sdY, setSdY] = useState('1'), [rho, setRho] = useState('0');
  const tableRef = useRef<HTMLDivElement>(null);
  const mu = number(mean), sigma = number(sd), cut = number(cutoff);
  const z = input === 'z' ? cut : (cut - mu) / sigma;
  const x = input === 'x' ? cut : mu + cut * sigma;
  const valid = Number.isFinite(mu) && Math.abs(mu) <= 1e9 && Number.isFinite(sigma) && sigma >= 1e-6 && sigma <= 1e9 && Number.isFinite(z) && Math.abs(z) <= 8;
  const covValid = Number.isFinite(number(sdY)) && number(sdY) >= 1e-6 && number(sdY) <= 1e9 && Number.isFinite(number(rho)) && Math.abs(number(rho)) <= 1;
  const areas = valid ? normalAreas(z) : null;
  const stats = valid ? distributionStats(mu, sigma, covValid ? number(sdY) : 1, covValid ? number(rho) : 0) : null;
  const selected = modes.find(m => m.id === mode)!;
  const tableIndex = valid && Math.abs(z) <= 3.99 ? Math.round(Math.abs(z) * 100) : -1;
  const tableRow = Math.floor(tableIndex / 10), tableCol = tableIndex % 10;

  useEffect(() => {
    const wrap = tableRef.current;
    const row = wrap?.querySelector<HTMLElement>(`[data-row="${tableRow}"]`);
    if (wrap && row) wrap.scrollTop = Math.max(0, row.offsetTop - wrap.offsetTop - 110);
  }, [tableRow]);

  function chooseZ(value: number) { setInput('z'); setCutoff(value.toFixed(2)); }
  function preset(example: boolean) {
    setMean(example ? '135' : '0'); setSd(example ? String(Math.sqrt(125)) : '1');
    setInput(example ? 'x' : 'z'); setCutoff(example ? '150' : '1.34'); setMode(example ? 'right' : 'middle');
    setSdY('1'); setRho('0');
  }

  // Plot in standardized coordinates, with a second axis in original units.
  // Expanding only beyond ±4 keeps the usual teaching view stable while dragging.
  const extent = valid ? Math.max(4, Math.ceil(Math.abs(z) + .5)) : 4;
  const px = (u: number) => 52 + (u + extent) / (2 * extent) * 656;
  const py = (u: number) => 230 - density(u) / density(0) * 170;
  const path = (a: number, b: number) => Array.from({ length: 201 }, (_, i) => {
    const u = a + (b - a) * i / 200;
    return `${i ? 'L' : 'M'}${px(u).toFixed(2)},${py(u).toFixed(2)}`;
  }).join(' ');
  const [lo, hi] = !valid ? [0, 0] : mode === 'left' ? [-extent, z] : mode === 'right' ? [z, extent] : mode === 'central' ? [-Math.abs(z), Math.abs(z)] : [Math.min(0, z), Math.max(0, z)];
  const areaPath = `${path(lo, hi)} L${px(hi)},230 L${px(lo)},230 Z`;

  return <div className="cee-tool gauss-tool">
    <aside className="gauss-rail">
      <Card title="Define your distribution" subtitle="Normal · Gaussian · bell curve">
        <div className="gauss-presets"><button onClick={() => preset(false)}>Standard normal</button><button onClick={() => preset(true)}>Example 10.9 ↗</button></div>
        <Field label="Mean, μ" value={mean} onChange={setMean} min={-1e9} max={1e9} />
        <Field label="Standard deviation, σ" value={sd} onChange={setSd} min={1e-6} max={1e9} />
        <p className="gauss-help">μ shifts the center. σ changes the spread. Use consistent units for μ, σ, and x.</p>
        <div className="gauss-divider" />
        <label className="gauss-field"><span>Enter the cutoff as</span><select value={input} onChange={e => {
          const next = e.target.value as 'z' | 'x';
          if (valid) setCutoff(String(next === 'x' ? x : z));
          setInput(next);
        }}><option value="z">Standard deviate, z</option><option value="x">Original value, x</option></select></label>
        <Field label={input === 'z' ? 'Standard deviate, z' : 'Original value, x'} value={cutoff} onChange={setCutoff} min={input === 'z' ? -8 : undefined} max={input === 'z' ? 8 : undefined} />
        <label className="gauss-slider"><span>Move the cutoff <strong>{valid ? `z = ${fmt(z)}` : '—'}</strong></span><input aria-label="Move the cutoff" type="range" min="-4" max="4" step="0.01" value={valid ? Math.max(-4, Math.min(4, z)) : 0} onChange={e => chooseZ(Number(e.target.value))} /><span><small>−4σ</small><small>μ</small><small>+4σ</small></span></label>
        <p className="gauss-help">Slider: −4 to +4. Numeric entry: −8 to +8 standard deviations.</p>
        <label className="gauss-field"><span>Desired output</span><select value={mode} onChange={e => setMode(e.target.value as Mode)}>{modes.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
        {!valid && <p className="gauss-error" role="alert">Enter a mean within ±10⁹, a standard deviation from 0.000001 to 10⁹, and a cutoff within ±8 standard deviations. All fields must be finite numbers.</p>}
      </Card>
      <Card title="Two-variable covariance" subtitle="A separate relationship between X and Y">
        <Field label="Standard deviation of Y, σY" value={sdY} onChange={setSdY} min={1e-6} max={1e9} />
        <Field label="Correlation, ρ" value={rho} onChange={setRho} min={-1} max={1} step="0.01" />
        <input className="gauss-rho" aria-label="Adjust correlation" type="range" min="-1" max="1" step="0.01" value={covValid ? rho : '0'} onChange={e => setRho(e.target.value)} />
        <p className="gauss-help">The default ρ = 0 assumes uncorrelated variables. These inputs do not change the curve for X.</p>
        {!covValid && <p className="gauss-error" role="alert">Use σY from 0.000001 to 10⁹ and ρ from −1 to 1.</p>}
        <div className="gauss-cov"><span>Cov(X, Y)</span><strong data-testid="covariance">{stats && covValid ? fmt(stats.covariance) : '—'}</strong><small>X-units × Y-units</small></div>
      </Card>
    </aside>

    <div className="gauss-main">
      <Card className="gauss-hero" title="One curve. Every probability." subtitle="Choose an output; the shaded area follows your question." affordance={<span className="gauss-badge">HUANG · CH. 10</span>}>
        <div className="gauss-answer" aria-live="polite"><div><span>{selected.name}</span><strong data-testid="probability">{areas ? prob(areas[mode]) : '—'}</strong><p>{selected.label}</p></div><div className="gauss-percent">{areas ? `${(100 * areas[mode]).toFixed(3)}%` : '—'}<small>of the total area</small></div></div>
        <div className="gauss-modebar" aria-label="Probability output">{modes.map(m => <button key={m.id} aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>{m.name.replace(' probability', '')}</button>)}</div>
        {valid && <figure className="gauss-figure">
          <svg viewBox="0 0 760 310" role="img" aria-label={`${selected.name}: ${prob(areas![mode])}, z = ${fmt(z)}, x = ${fmt(x)}. Shaded region from ${fmt(lo)} to ${fmt(hi)} standard deviations; curve display truncates the infinite tails.`}>
            {[.1, .2, .3, .4].map(y => <g key={y}><line className="gauss-grid" x1="52" x2="708" y1={230 - y / density(0) * 170} y2={230 - y / density(0) * 170} /><text x="40" y={234 - y / density(0) * 170} textAnchor="end">{fmt(y / sigma)}</text></g>)}
            <text x="52" y="22" className="gauss-axis-title">Probability density f(x)</text>
            <path d={path(-extent, extent) + ` L708,230 L52,230 Z`} className="gauss-backdrop" />
            <path d={areaPath} className="gauss-shade" />
            <path d={path(-extent, extent)} className="gauss-curve" />
            <line className="gauss-center" x1={px(0)} x2={px(0)} y1="48" y2="230" />
            <text x={px(0)} y="38" textAnchor="middle">μ = median</text>
            <line className="gauss-cutoff" x1={px(z)} x2={px(z)} y1={py(z)} y2="230" />
            <circle cx={px(z)} cy={py(z)} r="5" className="gauss-dot" />
            {Array.from({ length: 9 }, (_, i) => (i - 4) * extent / 4).map((u, i) => <g key={u} className={i % 2 ? 'gauss-minor-tick' : ''}><text x={px(u)} y="251" textAnchor="middle">{fmt(u)}</text><text x={px(u)} y="274" textAnchor="middle">{fmt(mu + u * sigma)}</text></g>)}
            <text x="26" y="251">z</text><text x="26" y="274">x</text>
            <text x="380" y="301" textAnchor="middle">Standard deviate z · original value x</text>
          </svg>
          <figcaption><span className="gauss-key" /> Shaded area: <b>{selected.name.toLowerCase()}</b><span className="gauss-cutoff-note">x = {fmt(x)} · z = {fmt(z)}</span></figcaption>
        </figure>}
        <div className="gauss-probabilities">{(['middle', 'left', 'right'] as Mode[]).map(id => <button key={id} onClick={() => setMode(id)} aria-pressed={mode === id}><span>{id === 'middle' ? 'Table area · ψ(|z|)' : id === 'left' ? 'Cumulative · Φ(z)' : 'Right tail · 1 − Φ(z)'}</span><strong>{areas ? prob(areas[id]) : '—'}</strong></button>)}</div>
        <p className="gauss-help">Areas use the full distribution, including the tails beyond the plot. Table 10.1 area is always between 0 and 0.5; cumulative probability is between 0 and 1.</p>
      </Card>

      <Card title="Center, spread & relationship" subtitle="Population properties of the distribution you defined; these are not estimates from sampled data.">
        <dl className="gauss-stats">{[
          ['Mean · E[X]', stats ? fmt(stats.mean) : '—', 'Expected value'],
          ['Median', stats ? fmt(stats.median) : '—', '50th percentile'],
          ['Standard deviation · σ', stats ? fmt(stats.sd) : '—', 'Original units'],
          ['Variance · σ²', stats ? fmt(stats.variance) : '—', 'Also Cov(X, X)'],
          ['Coefficient of variation', stats?.cv != null ? `${fmt(stats.cv)}%` : 'Not applicable', 'Shown for μ > 0'],
          ['Covariance · Cov(X, Y)', stats && covValid ? fmt(stats.covariance) : '—', 'From σX, σY, and ρ'],
        ].map(([label, value, detail]) => <div key={label}><dt>{label}</dt><dd>{value}</dd><small>{detail}</small></div>)}</dl>
      </Card>

      <Card title="Table 10.1 · explore the normal area" subtitle="Pick a cell to move the cutoff. Row + column gives |z|; each entry is ψ(|z|)." affordance={<span className="gauss-badge">0.00–3.99</span>}>
        <p className="gauss-table-readout">{tableIndex >= 0 ? <>Nearest table entry: <b>{(tableRow / 10).toFixed(1)}</b> + <b>{(tableCol / 100).toFixed(2)}</b> → |z| = <b>{(tableIndex / 100).toFixed(2)}</b> → area <b>{normalTable[tableRow][tableCol].toFixed(6)}</b></> : 'No cell selected: the table covers |z| from 0.00 to 3.99.'}</p>
        <div className="gauss-table-scroll" ref={tableRef} tabIndex={0} role="region" aria-label="Scrollable normal area table"><table><caption>Calculated values of the Table 10.1 integral, rounded to six decimals</caption><thead><tr><th scope="col">|z|</th>{Array.from({ length: 10 }, (_, c) => <th key={c} scope="col">.{String(c).padStart(2, '0')}</th>)}</tr></thead><tbody>{normalTable.map((row, r) => <tr key={r} data-row={r}><th scope="row">{(r / 10).toFixed(1)}</th>{row.map((value, c) => <td key={c}><button className={tableIndex === r * 10 + c ? 'is-selected' : ''} aria-pressed={tableIndex === r * 10 + c} aria-label={`z ${(r / 10 + c / 100).toFixed(2)}, area ${value.toFixed(6)}`} onClick={() => chooseZ((z < 0 ? -1 : 1) * (r * 10 + c) / 100)}>{value.toFixed(6)}</button></td>)}</tr>)}</tbody></table></div>
        <p className="gauss-help">The active cell rounds |z| to two decimals; the main result uses your full input. Selecting a cell preserves the sign of z and your chosen output. Values are evaluated from Eq. 10.34, correcting apparent print errors rather than copying them.</p>
      </Card>

      <Card title="Worked check · Example 10.9" subtitle="Huang (2004), pp. 450–451" affordance={<button className="gauss-load" onClick={() => preset(true)}>Load example</button>}>
        <p className="gauss-copy">For a normal variable with mean 135 and variance 125, the standard deviation is √125 ≈ 11.18034. At x = 150, z ≈ 1.34164. The right-tail probability is <b>{prob(normalAreas(15 / Math.sqrt(125)).right)}</b> (about 8.986%). The book rounds z to 1.34 and reports about 9%.</p>
      </Card>

      <Card title="The equations behind the curve" subtitle="Huang, Pavement Analysis and Design, 2nd ed. (2004), Chapter 10, §§10.1.1–10.1.3, pp. 441–451.">
        <div className="gauss-equations">{formulas.map(f => <article key={f.name}><div className="gauss-equation-title"><h4>{f.name}</h4><span>{f.note}</span></div><div className="gauss-math"><Equation tex={f.tex} plain={f.plain} display /></div><p>{f.explanation}</p></article>)}</div>
      </Card>
    </div>
  </div>;
}

export default function GaussApp() {
  const [tab, setTab] = useState('distribution');
  const tabs = [['distribution', 'Gauss distribution', 'Table 10.1'], ['reliability', 'Reliability deviates', 'Table 11.15']];
  return <div className="gauss-app">
    <div className="gauss-tabs" role="tablist" aria-label="Gauss Distribution tools">{tabs.map(([id, title, note], i) => <button key={id} id={`gauss-tab-${id}`} role="tab" aria-selected={tab === id} aria-controls={`gauss-panel-${id}`} tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)} onKeyDown={e => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
        e.preventDefault(); const next = e.key === 'Home' ? tabs[0][0] : e.key === 'End' ? tabs[1][0] : tabs[1 - i][0];
        setTab(next); document.getElementById(`gauss-tab-${next}`)?.focus();
      }
    }}>{title}<small>{note}</small></button>)}</div>
    <div id="gauss-panel-distribution" role="tabpanel" aria-labelledby="gauss-tab-distribution" hidden={tab !== 'distribution'}><DistributionExplorer /></div>
    <div id="gauss-panel-reliability" role="tabpanel" aria-labelledby="gauss-tab-reliability" hidden={tab !== 'reliability'}><ReliabilityTab /></div>
  </div>;
}
