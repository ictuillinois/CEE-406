// KPI strip — docs/chart-standards.md §A6.2.
//
// N equal columns separated by 1px vertical hairlines:
//   label  (14, secondary, sentence case)
//   value  (40/700, primary, tracking -0.03em, tabular)
//   delta  (arrow + semantic % + grey context phrase)
//
// Labels are sentence case, never CSS-uppercased: §A2.3 restricts uppercase to
// eyebrows, and CLAUDE.md forbids text-transform on labels that may contain
// Greek (σ would render as Σ).
import type { ReactNode } from 'react';
import Tip from '../Tip';

interface KpiProps {
  label: ReactNode;
  value: ReactNode;
  /** Small trailing unit, set in the muted token at 0.4× the value size. */
  unit?: string;
  /** Concept help — every key metric gets one (CLAUDE.md tool UX standard). */
  tip?: string;
  /** The brand-accented column. One per strip at most. */
  accent?: boolean;
  /** Long values (a layer name, a formula) that must not use the 40px size. */
  compact?: boolean;
  delta?: { direction: 'up' | 'down'; text: string; context?: string };
}

export function Kpi({ label, value, unit, tip, accent, compact, delta }: KpiProps) {
  return (
    <div className={`cee-kpi${accent ? ' cee-kpi--accent' : ''}`}>
      <div className="cee-kpi__label">
        <span>{label}</span>
        {tip && <Tip text={tip} />}
      </div>
      <div className={`cee-kpi__value${compact ? ' cee-kpi__value--compact' : ''}`}>
        {value}
        {unit && <small className="cee-kpi__unit">{unit}</small>}
      </div>
      {delta && (
        <div className={`cee-kpi__delta cee-kpi__delta--${delta.direction}`}>
          <span aria-hidden="true">{delta.direction === 'up' ? '↑' : '↓'}</span>
          <strong>{delta.text}</strong>
          {delta.context && <span className="cee-kpi__context">{delta.context}</span>}
        </div>
      )}
    </div>
  );
}

export default function KpiStrip({ children }: { children: ReactNode }) {
  return <div className="cee-kpis">{children}</div>;
}
