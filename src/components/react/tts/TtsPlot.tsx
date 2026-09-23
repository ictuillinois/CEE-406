import { useEffect, useRef, useState } from 'react';
import ChartFigure from '../ui/ChartFigure';
import Tip from '../Tip';
import { useTheme, baseLayout, fitterAxis, plotConfig, TOKENS } from '../chartTheme';
import type { LegendItem } from '../ui/Legend';

export default function TtsPlot({ title, subtitle, help, xTitle, yTitle, traces, legend, logX = true, logY = true, height = 340 }: {
  title: string; subtitle: string; help?: string; xTitle: string; yTitle: string;
  traces: Record<string, unknown>[]; legend: LegendItem[]; logX?: boolean; logY?: boolean; height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null), theme = useTheme();
  const [error, setError] = useState(false);
  useEffect(() => {
    const element = ref.current;
    let cancelled = false;
    void import('plotly.js-dist-min').then(async ({ default: Plotly }) => {
      if (cancelled || !element) return;
      const xs = traces.flatMap(trace => Array.isArray(trace.x) ? trace.x : [])
        .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0);
      const decades = xs.length ? Math.log10(Math.max(...xs) / Math.min(...xs)) : 1;
      const chartAxis = (label: string, log: boolean, spacing = 1) => ({
        ...fitterAxis(theme, label), type: log ? 'log' : 'linear',
        ...(log ? { dtick: spacing, exponentformat: 'power', showexponent: 'all', minorloglabels: 'none' } : {}),
        minor: { showgrid: true, gridcolor: TOKENS[theme].gridFaint, gridwidth: 1,
          ticks: 'outside', ticklen: 2, tickcolor: TOKENS[theme].frame,
          ...(log ? { dtick: spacing > 1 ? 1 : 'D1' } : { nticks: 5 }) },
      });
      await Plotly.react(element, traces, baseLayout(theme, {
        height, margin: { l: 68, r: 20, t: 14, b: 56 },
        xaxis: chartAxis(xTitle, logX, Math.max(1, Math.ceil(decades / 7))),
        yaxis: chartAxis(yTitle, logY),
        hovermode: 'closest',
      }), plotConfig);
      if (!cancelled) setError(false);
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [traces, theme, title, xTitle, yTitle, logX, logY, height]);
  useEffect(() => {
    const element = ref.current;
    return () => { if (element) void import('plotly.js-dist-min').then(({ default: p }) => p.purge(element)); };
  }, []);
  return <div className="tts-plot">
    <ChartFigure title={title} subtitle={subtitle} affordance={help ? <Tip text={help} /> : undefined}
      plotRef={ref} legend={legend} takeaway={help ?? subtitle} />
    {error && <p role="alert">The chart could not load. Your data and calculated values remain available below.</p>}
  </div>;
}
