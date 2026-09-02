// "Solutions by charts" — Huang's own heading for §2.1.1, generalized to
// every empirical chart in Chapter 2.
//
// The chapter carries twelve of them across three sections, and they are the
// part of the book a student is most likely to misread: five-decade log paper,
// seventeen unlabelled curves, and two figures that are not plots at all but
// nomographs. Each one is picked from a list and rendered by ChartReader,
// which knows how to draw it and how to read it backwards.
import { useMemo, useState } from 'react';
import Tip from '../../Tip';
import { CHARTS, SECTIONS, type ChartSpec } from '../charts.ts';
import ChartReader from './ChartReader';

export default function ChartsModule() {
  const [id, setId] = useState(CHARTS[0].id);
  const spec = useMemo(() => CHARTS.find(c => c.id === id) ?? CHARTS[0], [id]);

  const bySection = useMemo(() => {
    const map = new Map<string, ChartSpec[]>();
    for (const s of SECTIONS) map.set(s, CHARTS.filter(c => c.section === s));
    return map;
  }, []);

  return (
    <div className="cee-tool">
      <aside className="cee-panel">
        <h2 className="cee-panel__title">Chart</h2>

        <div className="cee-field">
          <label className="cee-field__label" htmlFor="chart-pick">
            <span>
              Figure
              <Tip text="Every empirical chart in Chapter 2. Each is computed from the same solvers the other modules use, not traced from the page — which is why they reproduce Huang's own worked reads." />
            </span>
            <span className="cee-field__unit">{CHARTS.length} charts</span>
          </label>
          <select id="chart-pick" className="cee-input" value={id}
            onChange={e => setId(e.target.value)}>
            {SECTIONS.map(section => (
              <optgroup key={section} label={section}>
                {bySection.get(section)!.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.figure} — {c.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="cee-card cee-card--sunken cee-chartmeta">
          <p className="cee-chartmeta__purpose">{spec.purpose}</p>
          <dl className="cee-chartmeta__list">
            <dt>Source</dt><dd>{spec.source}</dd>
            <dt>Curves</dt>
            <dd>
              {spec.family.values.length} printed values of <code>{spec.family.symbol}</code>;
              any value in [{spec.family.range[0]}, {spec.family.range[1]}] can be drawn
            </dd>
            <dt>Applies as</dt><dd><code>{spec.equation}</code></dd>
            {spec.nomograph && (<><dt>Note</dt><dd>Nomograph — a lattice of two crossing families, drawn as printed</dd></>)}
          </dl>
        </div>

        <p className="cee-hint">
          Poisson's ratio is <strong>0.5</strong> on every chart in this chapter — Foster and
          Ahlvin assumed the half-space incompressible so one set of charts would serve, and
          Huang keeps the assumption through the whole of §2.2. It is not an input here because
          changing it would stop reproducing the printed figure. Use the layer modules for any
          other ν.
        </p>
      </aside>

      <div className="cee-results">
        <details className="cee-howto">
          <summary>How to use this tool</summary>
          <div className="cee-howto__body">
            <ol>
              <li><strong>Pick a figure.</strong> The list is grouped the way the chapter is: the
                Foster–Ahlvin half-space charts, the Burmister two-layer design charts, and
                Peattie's three-layer lattice.</li>
              <li><strong>Read it forwards.</strong> Type the two parameters; the marker lands on
                the chart and the readout applies the equation printed beside it. A curve the book
                never drew is computed and drawn dashed between the ones it did.</li>
              <li><strong>Read it backwards.</strong> Move the pointer anywhere in the frame. The
                panel under the chart solves for the curve that passes through that point —
                including when there are two such curves, and when there are none.</li>
              <li><strong>Check it against the book.</strong> Every chart with a worked example
                carries its checkpoints; load one and confirm the marker lands where Huang says.</li>
            </ol>
            These are not scans or traced curves. Each is computed from the same layered-elastic
            solver the other modules use, so intermediate values are exact rather than
            interpolated by eye — and a curve the book never drew is as available as one it did.
          </div>
        </details>

        <ChartReader spec={spec} key={spec.id} />
      </div>
    </div>
  );
}
