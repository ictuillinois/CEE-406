// Legend — docs/chart-standards.md §A7 / §B6 deviation 1.
//
// Rendered as HTML rather than by Plotly: Plotly draws line-series keys as
// line segments, not the 8px round dots the standard requires, and cannot
// align them to the card's padding. Tools set `showlegend: false` and render
// this below the plot.
//
// Series order is fixed by the caller and must not be re-sorted by value.
export interface LegendItem {
  label: string;
  color: string;
  /** dot (default) · line for a reference/envelope · dash for a projection */
  shape?: 'dot' | 'line' | 'dash';
}

interface LegendProps {
  items: LegendItem[];
  /** Centered for 2 series, left-aligned for 3+ (§A7). Auto by default. */
  align?: 'left' | 'center';
}

export default function Legend({ items, align }: LegendProps) {
  if (!items.length) return null;
  const resolved = align ?? (items.length <= 2 ? 'center' : 'left');
  return (
    <ul className={`cee-legend cee-legend--${resolved}`}>
      {items.map(it => (
        <li className="cee-legend__item" key={it.label}>
          <span
            className={`cee-legend__mark cee-legend__mark--${it.shape ?? 'dot'}`}
            style={{ background: it.color, borderColor: it.color }}
            aria-hidden="true"
          />
          <span className="cee-legend__label">{it.label}</span>
        </li>
      ))}
    </ul>
  );
}
