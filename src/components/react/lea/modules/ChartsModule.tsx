// "Solutions by charts" — Huang's own heading for §2.1.1, generalized to
// every empirical chart in Chapter 2.
//
// The chapter carries twelve of them across three sections, and they are the
// part of the book a student is most likely to misread: five-decade log paper,
// seventeen unlabeled curves, and two figures that are not plots at all but
// nomographs. Each one is picked from a list and rendered by ChartReader,
// which knows how to draw it and how to read it backwards.
import { useMemo, useState } from 'react';
import Tip from '../../Tip';
import { CHARTS, SECTIONS, type ChartSpec } from '../charts.ts';
import ChartReader from './ChartReader';
import Equation from '../../ui/Equation';

export default function ChartsModule() {
  const [id, setId] = useState(() => {
    const requested = typeof window === 'undefined' ? null
      : new URLSearchParams(window.location?.search ?? '').get('figure');
    return CHARTS.find(c => c.id === requested)?.id ?? CHARTS[0].id;
  });
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
              <Tip text="Every empirical chart in Chapter 2. Each is computed from the same solvers the other modules use, not traced from the page, which is why they reproduce Huang's own worked reads." />
            </span>
            <span className="cee-field__unit">{CHARTS.length} charts</span>
          </label>
          <select id="chart-pick" className="cee-input" value={id}
            onChange={e => setId(e.target.value)}>
            {SECTIONS.map(section => (
              <optgroup key={section} label={section}>
                {bySection.get(section)!.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.figure}: {c.title}
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
            <dt>Applies as</dt>
            <dd>
              <Equation tex={spec.equation.tex} plain={spec.equation.plain} />
              {spec.equation.note && (
                <span className="cee-chartmeta__eqnote">{spec.equation.note}</span>
              )}
            </dd>
            {spec.nomograph && (<><dt>Note</dt><dd>Nomograph: a lattice of two crossing families, drawn as printed</dd></>)}
          </dl>
        </div>

        <p className="cee-hint">
          Poisson's ratio is <strong>0.5</strong> on every chart in this chapter. Foster and
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
              <li><strong>Select:</strong> Choose a figure or worked example.</li>
              <li><strong>Forward:</strong> Enter parameters to place the marker and read the result.</li>
              <li><strong>Inverse:</strong> Move the pointer over the chart to solve for the parameters at that point.</li>
            </ol>
          </div>
        </details>

        <ChartReader spec={spec} key={spec.id} />
      </div>
    </div>
  );
}
