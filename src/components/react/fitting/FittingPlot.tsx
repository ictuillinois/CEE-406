import { useEffect, useRef, useState } from "react";
import {
  useTheme,
  axis,
  gridAxis,
  baseLayout,
  plotConfig,
} from "../chartTheme";
import ChartFigure from "../ui/ChartFigure";
import type { LegendItem } from "../ui/Legend";
export default function FittingPlot({
  title,
  subtitle,
  xTitle,
  yTitle,
  traces,
  legend,
  height = 340,
}: {
  title: string;
  subtitle: string;
  xTitle: string;
  yTitle: string;
  traces: any[];
  legend: LegendItem[];
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null),
    theme = useTheme();
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    import("plotly.js-dist-min")
      .then(async ({ default: Plotly }) => {
        if (cancelled || !ref.current) return;
        ref.current.style.height = `${height}px`;
        await Plotly.react(
          ref.current,
          traces,
          baseLayout(theme, {
            height,
            xaxis: axis(theme, xTitle),
            yaxis: gridAxis(theme, yTitle),
            showlegend: false,
            hovermode: "closest",
            margin: { l: 65, r: 20, t: 20, b: 55 },
          }),
          plotConfig,
        );
        if (!cancelled) setError(false);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [traces, theme, height, xTitle, yTitle]);
  useEffect(() => {
    const el = ref.current;
    return () => {
      if (el)
        void import("plotly.js-dist-min")
          .then(({ default: p }) => p.purge(el))
          .catch(() => {});
    };
  }, []);
  return (
    <>
      <ChartFigure
        title={title}
        subtitle={subtitle}
        plotRef={ref}
        legend={legend}
        takeaway={subtitle}
      />
      {error && (
        <p role="alert">
          The chart could not load. The numerical tables remain available.
        </p>
      )}
    </>
  );
}
