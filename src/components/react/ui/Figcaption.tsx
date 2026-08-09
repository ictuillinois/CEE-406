// Figcaption — docs/chart-standards.md §A11.
//
// Every chart needs an accessible name and a text alternative stating the
// takeaway, not a restatement of the axes ("Delivery density peaks 11AM-3PM
// across all regions", not "a heatmap of delivery density"). Where a visible
// caption already says it, pass `visible` and use one element for both.
import type { ReactNode } from 'react';

interface FigcaptionProps {
  children: ReactNode;
  /** Render visibly instead of only to assistive technology. */
  visible?: boolean;
}

export default function Figcaption({ children, visible = false }: FigcaptionProps) {
  return (
    <figcaption className={visible ? 'cee-figcaption' : 'cee-figcaption cee-sr-only'}>
      {children}
    </figcaption>
  );
}
