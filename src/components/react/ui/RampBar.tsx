// RampBar — docs/chart-standards.md §A8.11 / §B6 deviation 2.
//
// The continuous gradient legend every heatmap and contour must ship: 6px
// tall, fully rounded, 160-220px wide, with Low/High end labels. Plotly's
// colorbar cannot be styled to this, so tools hide it and render this instead.
import { RAMPS, rampScale, type Mode, type RampName } from '../chartTheme';

interface RampBarProps {
  /** Named sequential ramp (§B5). Ignored when `stops` is given. */
  ramp?: RampName;
  theme: Mode;
  /**
   * An explicit colorscale, for a scale that is not one of the named ramps —
   * `fieldScale(theme)` for a magnitude field (§B5 deviation 1). Passing the
   * same stops the plot was drawn with is what keeps the legend honest.
   */
  stops?: [number, string][];
  /** End labels. Default "Low"/"High" (§A8.11). */
  lowLabel?: string;
  highLabel?: string;
  /** The quantity being encoded, e.g. "σz / p". Sits above the bar. */
  caption?: string;
  /**
   * Horizontal by default, below its plot. `vertical` stands the same bar on
   * end beside a tall plot — 6px wide instead of 6px tall, low at the BOTTOM
   * so it runs the same way as the y axis it sits against, and the caption
   * rotated like an axis title. §A8.11 fixes the geometry (6px, fully
   * rounded, 160-220px, end labels), not which way up it is.
   */
  orientation?: 'horizontal' | 'vertical';
}

export default function RampBar({
  ramp = 'orange',
  theme,
  stops,
  lowLabel = 'Low',
  highLabel = 'High',
  caption,
  orientation = 'horizontal',
}: RampBarProps) {
  // rampScale already handles the dark-mode end reversal (§A4.2), so the
  // gradient reads low → high left-to-right in both modes; fieldScale runs
  // the same direction in both modes by design.
  const scale = stops ?? rampScale(ramp, theme);
  const css = scale
    .map(([pos, color]) => `${color} ${(pos * 100).toFixed(0)}%`)
    .join(', ');

  const steps = stops ? scale.length : RAMPS[ramp].length;
  const label = `Color scale from ${lowLabel} to ${highLabel}, ${steps} steps`;

  if (orientation === 'vertical') {
    return (
      <div className="cee-rampbar cee-rampbar--vertical">
        {caption && <span className="cee-rampbar__caption">{caption}</span>}
        <div className="cee-rampbar__row">
          <span className="cee-rampbar__end">{highLabel}</span>
          <span
            className="cee-rampbar__track"
            style={{ background: `linear-gradient(to top, ${css})` }}
            role="img"
            aria-label={label}
          />
          <span className="cee-rampbar__end">{lowLabel}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="cee-rampbar">
      {caption && <span className="cee-rampbar__caption">{caption}</span>}
      <div className="cee-rampbar__row">
        <span className="cee-rampbar__end">{lowLabel}</span>
        <span
          className="cee-rampbar__track"
          style={{ background: `linear-gradient(to right, ${css})` }}
          role="img"
          aria-label={label}
        />
        <span className="cee-rampbar__end">{highLabel}</span>
      </div>
    </div>
  );
}
