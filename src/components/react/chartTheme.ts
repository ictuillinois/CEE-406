// Shared Plotly theming for CEE 406 tools.
// Palette validated (dataviz six-checks) per mode: light on #fff, dark on #162033.
// Every chart also ships a legend (≥2 series), hover values, and a table view,
// which covers the light-mode contrast WARN.
import { useEffect, useState } from 'react';

export type Mode = 'light' | 'dark';

export const SERIES: Record<Mode, { orange: string; sky: string; green: string; violet: string }> = {
  light: { orange: '#E87722', sky: '#0EA5E9', green: '#10B981', violet: '#8B5CF6' },
  dark: { orange: '#DC7014', sky: '#0C93CF', green: '#0EA372', violet: '#8B5CF6' },
};

export function useTheme(): Mode {
  const [theme, setTheme] = useState<Mode>(() =>
    typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
  );
  useEffect(() => {
    const obs = new MutationObserver(() => {
      setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return theme;
}

export function chartColors(theme: Mode) {
  const dark = theme === 'dark';
  return {
    ...SERIES[theme],
    fg: dark ? '#94A3B8' : '#6B7280',
    grid: dark ? '#2D3F59' : '#E5E7EB',
    ink: dark ? '#F1F5F9' : '#0F1A2E',
  };
}

export function baseLayout(theme: Mode, overrides: Record<string, unknown> = {}) {
  const c = chartColors(theme);
  return {
    margin: { l: 58, r: 16, t: 8, b: 44 },
    height: 380,
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { family: 'IBM Plex Mono, monospace', size: 10.5, color: c.fg },
    legend: { orientation: 'h' as const, y: -0.16, font: { size: 10.5 } },
    ...overrides,
  };
}

export const plotConfig = { displayModeBar: false, responsive: true };

export const num = (v: string, fb = 0): number => {
  const x = parseFloat(v);
  return Number.isFinite(x) ? x : fb;
};

export const fmt = (x: number, d = 2) =>
  Math.abs(x) >= 1000 ? x.toLocaleString('en-US', { maximumFractionDigits: 0 }) : x.toFixed(d);
