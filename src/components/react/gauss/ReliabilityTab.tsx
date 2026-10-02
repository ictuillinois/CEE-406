import { useState } from 'react';
import Card from '../ui/Card';
import Equation from '../ui/Equation';
import { density, normalAreas, reliabilityDeviate, reliabilityFormulas, reliabilityTable } from './equations';

export default function ReliabilityTab() {
  const [r, setR] = useState('95'), [s0, setS0] = useState('0.35');
  const [source, setSource] = useState<'computed' | 'printed'>('computed');
  const R = r.trim() ? Number(r) : NaN;
  const valid = Number.isFinite(R) && R >= 50 && R <= 99.99;
  const row = reliabilityTable.find(t => t.reliability === R);
  const computed = valid ? reliabilityDeviate(R) : null;
  const zr = source === 'computed' ? computed : row?.printed ?? null;
  const areas = zr !== null ? normalAreas(zr) : null;
  const spread = s0.trim() ? Number(s0) : NaN;
  const spreadValid = Number.isFinite(spread) && spread >= 0 && spread <= 2;
  const adjustment = zr !== null && spreadValid ? zr * spread : null;
  const px = (z: number) => 50 + (z + 4.5) / 9 * 660;
  const py = (z: number) => 235 - density(z) / density(0) * 175;
  const path = (a: number, b: number) => Array.from({ length: 251 }, (_, i) => {
    const z = a + (b - a) * i / 250;
    return `${i ? 'L' : 'M'}${px(z)},${py(z)}`;
  }).join(' ');

  return <div className="cee-tool gauss-tool">
    <aside className="gauss-rail">
      <Card title="Choose a reliability" subtitle="Standard normal deviate · ZR">
        <label className="gauss-field"><span>Value source</span><select value={source} onChange={e => { const next = e.target.value as 'computed' | 'printed'; setSource(next); if (next === 'printed' && !row) setR('95'); }}><option value="computed">Computed normal quantile</option><option value="printed">Printed Table 11.15</option></select></label>
        {source === 'computed' ? <label className="gauss-field"><span>Reliability, R (%)</span><input type="number" min="50" max="99.99" step="any" value={r} onChange={e => setR(e.target.value)} /></label> : <label className="gauss-field"><span>Reliability, R (%)</span><select value={r} onChange={e => setR(e.target.value)}>{reliabilityTable.map(t => <option key={t.reliability} value={t.reliability}>{t.reliability}%</option>)}</select></label>}
        {source === 'computed' && <label className="gauss-slider"><span>Move the reliability <strong>{valid ? `${R}%` : '—'}</strong></span><input aria-label="Move the reliability" type="range" min="50" max="99.99" step="0.01" value={valid ? R : 95} onChange={e => setR(e.target.value)} /><span><small>50%</small><small>99.99%</small></span></label>}
        <div className="gauss-presets gauss-rel-presets">{[50, 90, 95, 99, 99.9, 99.99].map(v => <button key={v} aria-pressed={R === v} onClick={() => setR(String(v))}>{v}%</button>)}</div>
        {!valid && <p className="gauss-error" role="alert">Enter a reliability from 50% to 99.99%, the range of Table 11.15.</p>}
        <p className="gauss-help">Higher reliability moves ZR farther left. AASHTO uses a negative deviate for R above 50%.</p>
        <div className="gauss-divider" />
        <label className="gauss-field"><span>Overall standard deviation, S₀</span><input type="number" value={s0} min="0" max="2" step="any" onChange={e => setS0(e.target.value)} /></label>
        <p className="gauss-help">Optional design illustration, on the log₁₀ traffic scale. Default 0.35 is from Example 11.11. Enter 0–2; this does not change ZR.</p>
        {!spreadValid && <p role="alert" className="gauss-error">Enter S₀ between 0 and 2.</p>}
      </Card>
      <Card title="Why the minus sign?">
        <p className="gauss-copy">At 95% reliability, 95% of the standard normal curve lies <b>to the right</b> of ZR ≈ −1.645. Only 5% lies to its left. The positive 95th percentile, +1.645, answers a different cumulative-probability question.</p>
      </Card>
    </aside>
    <div className="gauss-main">
      <Card title="Reliability, seen as an area" subtitle="Standard normal distribution · mean 0 · standard deviation 1" affordance={<span className="gauss-badge">TABLE 11.15</span>}>
        <div className="gauss-answer" aria-live="polite"><div><span>Standard normal deviate · ZR</span><strong data-testid="reliability-deviate">{zr === null ? '—' : zr.toFixed(source === 'printed' ? 3 : 6)}</strong><p>{source === 'printed' ? 'Printed table value' : 'Computed from the inverse normal distribution'}</p></div><div className="gauss-percent">{valid ? `${R}%` : '—'}<small>selected reliability</small></div></div>
        {zr !== null && <figure className="gauss-figure"><svg viewBox="0 0 760 305" role="img" aria-label={`Standard normal curve. ZR is ${zr.toFixed(6)}. The area to its right is ${(100 * areas!.right).toFixed(6)} percent.`}>
          {[.1, .2, .3, .4].map(y => <line key={y} className="gauss-grid" x1="50" x2="710" y1={235 - y / density(0) * 175} y2={235 - y / density(0) * 175} />)}
          <path d={`${path(-4.5, 4.5)} L710,235 L50,235 Z`} className="gauss-backdrop" />
          <path d={`${path(zr, 4.5)} L710,235 L${px(zr)},235 Z`} className="gauss-shade" />
          <path d={path(-4.5, 4.5)} className="gauss-curve" />
          <line x1={px(0)} x2={px(0)} y1="48" y2="235" className="gauss-center" />
          <text x={px(0)} y="34" textAnchor="middle">Mean = 0</text>
          <line x1={px(zr)} x2={px(zr)} y1={py(zr)} y2="235" className="gauss-cutoff" />
          <circle cx={px(zr)} cy={py(zr)} r="5" className="gauss-dot" />
          <text x={Math.max(100, px(zr))} y={Math.min(202, py(zr) - 18)} textAnchor="middle">ZR = {zr.toFixed(3)}</text>
          {[-4, -3, -2, -1, 0, 1, 2, 3, 4].map(z => <text key={z} className={z % 2 ? 'gauss-minor-tick' : ''} x={px(z)} y="260" textAnchor="middle">{z}</text>)}
          <text x="380" y="292" textAnchor="middle">Standard normal deviate Z</text>
        </svg><figcaption><span className="gauss-key" /> Shaded: reliability, to the right of ZR<span className="gauss-cutoff-note">Left tail: {(100 * areas!.left).toFixed(6)}%</span></figcaption></figure>}
        <dl className="gauss-stats gauss-rel-stats"><div><dt>Computed ZR</dt><dd>{computed?.toFixed(6) ?? '—'}</dd><small>Inverse normal</small></div><div><dt>Printed ZR</dt><dd>{row?.printed.toFixed(3) ?? 'Not tabulated'}</dd><small>Huang Table 11.15</small></div><div><dt>Actual shaded area</dt><dd>{areas ? `${(100 * areas.right).toFixed(4)}%` : '—'}</dd><small>Using the selected ZR</small></div></dl>
        <p className="gauss-help">Computed values and printed values are kept separate. Most differ slightly through rounding; at 99.99%, the book prints −3.750, while the normal quantile is −3.719016. Selecting the printed source draws the area implied by that printed deviate.</p>
      </Card>
      <Card title="The reliability term in pavement design" subtitle="Huang Eq. 11.36 · impact at a fixed mean performance prediction">
        <dl className="gauss-stats"><div><dt>Selected ZR</dt><dd>{zr?.toFixed(6) ?? '—'}</dd><small>{source === 'printed' ? 'Printed table' : 'Computed quantile'}</small></div><div><dt>Adjustment · ZR S₀</dt><dd>{adjustment?.toFixed(6) ?? '—'}</dd><small>log₁₀ traffic units</small></div><div><dt>Traffic ratio · W₁₈ / Wt₁₈</dt><dd>{adjustment !== null ? `${(100 * 10 ** adjustment).toFixed(3)}%` : '—'}</dd><small>Relative to the mean prediction</small></div></dl>
      </Card>
      <Card title="Table 11.15 · standard normal deviates" subtitle="Select any row to inspect its reliability. Printed values are transcribed from Huang (2004), p. 512.">
        <div className="gauss-table-scroll gauss-reliability-table" tabIndex={0} role="region" aria-label="Reliability deviate table"><table><caption>Standard normal deviates for various levels of reliability</caption><thead><tr><th scope="col">Reliability (%)</th><th scope="col">Printed ZR</th><th scope="col">Computed ZR</th></tr></thead><tbody>{reliabilityTable.map(t => <tr key={t.reliability}><th scope="row"><button onClick={() => setR(String(t.reliability))} aria-pressed={R === t.reliability} className={R === t.reliability ? 'is-selected' : ''} aria-label={`Select ${t.reliability}% reliability`}>{t.reliability}%</button></th><td>{t.printed.toFixed(3)}</td><td>{t.computed.toFixed(6)}</td></tr>)}</tbody></table></div>
      </Card>
      <Card title="From probability to reliability" subtitle="Huang (2004), Chapter 11, §11.3.2, pp. 511–512."><div className="gauss-equations">{reliabilityFormulas.map(f => <article key={f.name}><div className="gauss-equation-title"><h4>{f.name}</h4><span>{f.note}</span></div><div className="gauss-math"><Equation tex={f.tex} plain={f.plain} display /></div><p>{f.explanation}</p></article>)}</div></Card>
    </div>
  </div>;
}
