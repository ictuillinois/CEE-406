// RampBar — docs/chart-standards.md §A8.11 / §B6 deviation 2.
//
// The continuous gradient legend every heatmap and contour must ship: 6px
// tall, fully rounded, 160-220px wide, with Low/High end labels. Plotly's
// colorbar cannot be styled to this, so tools hide it and render this instead.
import { RAMPS, rampScale, type Mode, type RampName } from '../chartTheme';

interface RampBarProps {
  ramp: RampName;
  theme: Mode;
  /** End labels. Default "Low"/"High" (§A8.11). */
  lowLabel?: string;
  highLabel?: string;
  /** The quantity being encoded, e.g. "σz / p". Sits above the bar. */
  caption?: string;
}

export default function RampBar({
  ramp,
  theme,
  lowLabel = 'Low',
  highLabel = 'High',
  caption,
}: RampBarProps) {
  // rampScale already handles the dark-mode end reversal (§A4.2), so the
  // gradient reads low → high left-to-right in both modes.
  const stops = rampScale(ramp, theme)
    .map(([pos, color]) => `${color} ${(pos * 100).toFixed(0)}%`)
    .join(', ');

  return (
    <div className="cee-rampbar">
      {caption && <span className="cee-rampbar__caption">{caption}</span>}
      <div className="cee-rampbar__row">
        <span className="cee-rampbar__end">{lowLabel}</span>
        <span
          className="cee-rampbar__track"
          style={{ background: `linear-gradient(to right, ${stops})` }}
          role="img"
          aria-label={`Colour scale from ${lowLabel} to ${highLabel}, ${RAMPS[ramp].length} steps`}
        />
        <span className="cee-rampbar__end">{highLabel}</span>
      </div>
    </div>
  );
}
