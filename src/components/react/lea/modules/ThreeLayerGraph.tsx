import { useEffect, useMemo, useRef } from 'react';
import ChartFigure from '../../ui/ChartFigure';
import { useTheme, baseLayout, axis, gridAxis, hueFor, plotConfig } from '../../chartTheme';
import { groupsFor, threeLayerState } from '../threeLayer';
import ChartLink from './ChartLink';

export default function ThreeLayerGraph({ E1, E2, E3, h1, h2, q, a }: {
  E1: number; E2: number; E3: number; h1: number; h2: number; q: number; a: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const data = useMemo(() => Array.from({ length: 17 }, (_, i) => {
    const thickness = h2 * (0.5 + i / 16);
    const state = threeLayerState(groupsFor(E1, E2, E3, h1, thickness, a), q, E1);
    return { thickness, tension: state ? -state.bot1.epsR * 1e6 : null,
      compression: state ? state.top3.epsZ * 1e6 : null };
  }), [E1, E2, E3, h1, h2, q, a]);
  useEffect(() => {
    let disposed = false;
    const element = ref.current;
    let cleanup: (() => void) | undefined;
    void import('plotly.js-dist-min').then(async ({ default: Plotly }) => {
      if (disposed || !element) return;
      cleanup = () => Plotly.purge(element);
      await Plotly.react(element, [
        { x: data.map(d => d.thickness), y: data.map(d => d.tension), name: 'Asphalt tension −εr',
          mode: 'lines+markers', line: { color: hueFor('stress', theme), width: 2.5 } },
        { x: data.map(d => d.thickness), y: data.map(d => d.compression), name: 'Subgrade compression εz',
          mode: 'lines+markers', line: { color: hueFor('deflection', theme), width: 2.5 } },
      ], baseLayout(theme, { height: 360, xaxis: axis(theme, 'Base thickness h₂ (in)'),
        yaxis: gridAxis(theme, 'Strain (µε)'), hovermode: 'x unified',
        showlegend: true, legend: { orientation: 'h', y: 1.15 },
        shapes: [{ type: 'line', x0: h2, x1: h2, y0: 0, y1: 1, yref: 'paper',
          line: { color: hueFor('stress', theme), dash: 'dot', width: 1 } }],
      }), plotConfig);
      if (disposed) cleanup();
    });
    return () => { disposed = true; cleanup?.(); };
  }, [data, theme, h2]);
  return <ChartFigure title="What does a thicker base change?"
    subtitle="On-axis strains; all inputs except h₂ held fixed. Dotted line: current section."
    plotRef={ref} takeaway="Compare the sensitivity of asphalt tension and subgrade compression before choosing an equivalent section.">
    Each point recomputes A = a/h₂ and H = h₁/h₂. The tensile curve uses −εr;
    negative values therefore indicate compression instead of tension. Compare with <ChartLink figure="fig-2-31" />.
  </ChartFigure>;
}
