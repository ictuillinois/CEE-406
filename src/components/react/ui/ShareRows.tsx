// ShareRows — docs/chart-standards.md §A8.8 geometry, share-of-total semantics.
//
// One row per part: label left, percentage right, and a full-width track whose
// filled portion is the share. The remainder is a hatched tint of the same
// hue rather than grey, per §A8.8.
//
// Why not §A8.10's composition bar for parts of one total: that chart requires
// the percentage printed *inside* every segment, which is impossible once one
// part dominates — a 3% segment is a few pixels wide. Rows degrade gracefully
// because the number sits in its own column, so they stay readable whether the
// split is 20/20/20/20/20 or 88/4/4/3/1.
import type { Mode } from '../chartTheme';

export interface ShareRow {
  label: string;
  value: number;
  color: string;
  /** Optional secondary text under the label (quantities, assumptions). */
  note?: string;
}

interface ShareRowsProps {
  rows: ShareRow[];
  theme: Mode;
  format?: (v: number) => string;
}

export default function ShareRows({ rows, format }: ShareRowsProps) {
  const total = rows.reduce((s, r) => s + Math.max(r.value, 0), 0);
  if (total <= 0) return null;

  return (
    <div className="cee-shares">
      {rows.map(r => {
        const share = Math.max(r.value, 0) / total;
        const pct = share * 100;
        return (
          <div className="cee-progress" key={r.label} style={{ ['--cee-progress-hue' as string]: r.color }}>
            <div className="cee-progress__head">
              <span className="cee-progress__label">
                {r.label}
                {format && <span className="cee-progress__note"> · {format(r.value)}</span>}
              </span>
              <span className="cee-progress__value">
                {pct >= 10 ? pct.toFixed(0) : pct >= 0.1 ? pct.toFixed(1) : pct.toFixed(2)}%
              </span>
            </div>
            <div
              className="cee-progress__track"
              role="img"
              aria-label={`${r.label}: ${pct.toFixed(1)} percent of the total`}
            >
              {/* Sub-pixel shares still render a visible sliver so the row does
                  not read as zero; the printed number carries the precision. */}
              <div className="cee-progress__fill" style={{ width: `${Math.max(pct, 0.6)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
