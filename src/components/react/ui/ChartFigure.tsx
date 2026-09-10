// ChartFigure — the standard chart card, assembled.
//
// Composes the pieces so a tool cannot accidentally ship a chart that misses
// one: card header (§A6.1) → plot → HTML legend (§A7) → optional ramp legend
// (§A8.11) → visible explanation → accessible takeaway (§A11).
//
// The plot element is handed back through `plotRef` for Plotly.react().
import type { ReactNode, RefObject } from 'react';
import Card from './Card';
import Legend, { type LegendItem } from './Legend';
import RampBar from './RampBar';
import Figcaption from './Figcaption';
import type { Mode, RampName } from '../chartTheme';

interface ChartFigureProps {
  title: string;
  /** The encoding explanation (§A2.3) — short, sits under the title. */
  subtitle?: ReactNode;
  affordance?: ReactNode;
  plotRef: RefObject<HTMLDivElement | null>;
  /**
   * A heading over the main plot. Only for a figure that is a STACK of
   * panels, where the reader has to know which half they are looking at;
   * an ordinary chart's title already says.
   */
  plotLabel?: string;
  /**
   * Further panels of the SAME figure, drawn under the first and sharing its
   * legend, caption and takeaway. Huang's Figures 2.23 and 2.25-2.27 are
   * printed this way — C1 above, C2 below, one page — and Eq. 2.19 needs
   * both, so they are not two figures a reader chooses between.
   */
  panels?: { label: string; plotRef: RefObject<HTMLDivElement | null> }[];
  /** Fixed series order; omit for single-series charts. */
  legend?: LegendItem[];
  /** Continuous scale legend, for contour and heatmap figures. */
  ramp?: { name: RampName; theme: Mode; caption?: string; lowLabel?: string; highLabel?: string };
  /** The takeaway, in one sentence. Required — it is the chart's a11y text. */
  takeaway: string;
  /** Longer teaching prose shown under the chart. */
  children?: ReactNode;
}

export default function ChartFigure({
  title,
  subtitle,
  affordance,
  plotRef,
  plotLabel,
  panels,
  legend,
  ramp,
  takeaway,
  children,
}: ChartFigureProps) {
  return (
    <Card title={title} subtitle={subtitle} affordance={affordance}>
      <figure className="cee-figure">
        {plotLabel && <p className="cee-figure__panel">{plotLabel}</p>}
        <div className="cee-figure__plot cee-animate-in" ref={plotRef} role="img" aria-label={takeaway} />
        {panels?.map(pn => (
          <div key={pn.label}>
            <p className="cee-figure__panel">{pn.label}</p>
            <div
              className="cee-figure__plot cee-animate-in"
              ref={pn.plotRef}
              role="img"
              aria-label={`${pn.label}. ${takeaway}`}
            />
          </div>
        ))}
        {legend && <Legend items={legend} />}
        {ramp && (
          <RampBar
            ramp={ramp.name}
            theme={ramp.theme}
            caption={ramp.caption}
            lowLabel={ramp.lowLabel}
            highLabel={ramp.highLabel}
          />
        )}
        {children ? (
          <Figcaption visible>{children}</Figcaption>
        ) : (
          <Figcaption>{takeaway}</Figcaption>
        )}
      </figure>
    </Card>
  );
}
