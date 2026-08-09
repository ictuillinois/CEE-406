// Shared Plotly theming for CEE 406 tools.
//
// This file is the single source for every colour, axis, and hover default in
// the toolbox. It implements docs/chart-standards.md — §A is the visual
// language, §B binds it to the CEE 406 navy/orange identity. Tools must not
// set colours, gridlines, or axis chrome locally.
//
// Palettes are validated (dataviz six-checks) per surface: light on #FFFFFF,
// dark on #162033.
import { useEffect, useState } from 'react';

export type Mode = 'light' | 'dark';

/* ────────────────────────────── Tokens (§B1) ─────────────────────────────
 * Dark mode keeps the UIUC navy ladder rather than the standard's near-black,
 * but obeys its structure: sunken is darker than the card, elevation reads as
 * lightness rather than shadow, and primary text is never pure white.
 */
export const TOKENS: Record<Mode, Record<string, string>> = {
  light: {
    page: '#F8F9FB',
    surface: '#FFFFFF',
    sunken: '#F2F4F5',
    hover: '#F5F6F7',
    hairline: '#ECEDEF',
    control: '#D1D5DB',
    grid: '#F0F1F3',
    ink: '#1A1A2E',
    secondary: '#5B6670',
    muted: '#98A2AC',
    ghost: '#EDEFF1',
  },
  dark: {
    page: '#0F1A2E',
    surface: '#162033',
    sunken: '#101B2F',
    hover: '#1B2740',
    hairline: 'rgba(255,255,255,0.07)',
    control: '#2D3F59',
    grid: 'rgba(255,255,255,0.06)',
    ink: '#F1F5F9',
    secondary: '#9BA4AC',
    muted: '#7C8CA5',
    ghost: 'rgba(255,255,255,0.07)',
  },
};

/* ───────────────────── Categorical palette, fixed order (§B4) ─────────────
 * Illini Orange replaces the standard's orange and takes position 1, so the
 * brand hue is always the primary series. Dark values are +8-12% lightness,
 * -8-12% saturation. Assign 1 → 6 in this order, NEVER by data value.
 */
export type Hue = 'orange' | 'blue' | 'emerald' | 'amber' | 'violet' | 'pink';

export const HUE_ORDER: Hue[] = ['orange', 'blue', 'emerald', 'amber', 'violet', 'pink'];

export const HUES: Record<Mode, Record<Hue, string>> = {
  light: {
    orange: '#E87722',
    blue: '#3B9BF0',
    emerald: '#14B489',
    amber: '#F5B62E',
    violet: '#8B5CF6',
    pink: '#F0388B',
  },
  dark: {
    orange: '#F0913F',
    blue: '#5AAEF5',
    emerald: '#2FC79C',
    amber: '#F7C64F',
    violet: '#A78BFA',
    pink: '#F5619F',
  },
};

/* Semantic binding (§B4). The "series" in this product are physical
 * quantities that recur across tools, so bind them once: sigma_z is the same
 * colour in the Stress Explorer, the layered-elastic solver, and Westergaard.
 * Totals and envelopes use `ink` — a neutral, not a seventh hue. */
export type Quantity =
  | 'stress'       // sigma, load, pressure
  | 'strain'       // epsilon
  | 'deflection'   // w, delta, displacement
  | 'traffic'      // traffic, cost, GHG, mass
  | 'damage'       // damage, fatigue, cracking
  | 'temperature'; // temperature, curling, moisture

export const QUANTITY_HUE: Record<Quantity, Hue> = {
  stress: 'orange',
  strain: 'blue',
  deflection: 'emerald',
  traffic: 'amber',
  damage: 'violet',
  temperature: 'pink',
};

/** Colour for a physical quantity — the preferred way for a tool to pick one. */
export const hueFor = (q: Quantity, theme: Mode) => HUES[theme][QUANTITY_HUE[q]];

/* ───────────────────────── Sequential ramps (§B5) ─────────────────────────
 * 5 steps, 900 (deep) → 100 (pale). Ordered/stacked/heatmap data only.
 */
export type RampName = 'orange' | 'blue' | 'emerald' | 'neutral';

export const RAMPS: Record<RampName, [string, string, string, string, string]> = {
  orange: ['#8A3D0B', '#C2410C', '#EA580C', '#FB923C', '#FED7AA'],
  blue: ['#12447F', '#1B67C4', '#3B9BF0', '#93C6F8', '#E4F0FD'],
  emerald: ['#0B7A5D', '#12A57F', '#34C79E', '#8FE0C6', '#E4F7F1'],
  neutral: ['#3F474E', '#6B757E', '#98A2AC', '#CBD2D8', '#EDEFF1'],
};

/**
 * Plotly colorscale for a ramp. Per §A4.2 the ramp reverses which end reads as
 * "empty" between modes: light mode is pale-low → deep-high, dark mode is
 * deep-low → pale-high, so the high end always stands off the card surface.
 */
export function rampScale(name: RampName, theme: Mode): [number, string][] {
  const steps = RAMPS[name];
  const ordered = theme === 'dark' ? steps : [...steps].reverse();
  return ordered.map((c, i) => [i / (steps.length - 1), c] as [number, string]);
}

/** The two ends of a ramp as the RampBar legend renders them (low, high). */
export function rampEnds(name: RampName, theme: Mode): [string, string] {
  const s = rampScale(name, theme);
  return [s[0][1], s[s.length - 1][1]];
}

/* ──────────────────────────── Semantic (§A3.5) ──────────────────────────── */
export const SEMANTIC = {
  positive: { fg: '#12B76A', tint: '#E6F7EF' },
  negative: { fg: '#E5484D', tint: '#FDECEC' },
  warning: { fg: '#F59E0B', tint: '#FEF3E2' },
  info: { fg: '#3B9BF0', tint: '#E8F3FE' },
  neutral: { fg: '#98A2AC', tint: '#F2F4F5' },
} as const;

/* ─────────────────────────────── Theme hook ─────────────────────────────── */
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

/**
 * Every colour a chart needs. `sky` and `green` are retained as aliases of the
 * blue and emerald hues so existing tools keep compiling during the retrofit.
 */
export function chartColors(theme: Mode) {
  const t = TOKENS[theme];
  const h = HUES[theme];
  return {
    ...h,
    sky: h.blue,
    green: h.emerald,
    fg: t.muted,
    grid: t.grid,
    ink: t.ink,
    secondary: t.secondary,
    surface: t.surface,
    hairline: t.hairline,
    ghost: t.ghost,
  };
}

/* ─────────────────────── Chart chrome defaults (§A7, §B6) ─────────────────
 * No axis lines, no ticks, no plot border. Horizontal gridlines only, dashed,
 * 3-5 of them. Tick labels 11.5px mono (mono runs small: ~12px sans
 * optically) in the muted token, never rotated.
 */
const TICK_FONT = (theme: Mode) => ({
  family: 'IBM Plex Mono, monospace',
  size: 11.5,
  color: TOKENS[theme].muted,
});

const AXIS_TITLE_FONT = (theme: Mode) => ({
  family: 'IBM Plex Sans, system-ui, sans-serif',
  size: 12,
  color: TOKENS[theme].secondary,
});

/** A standard-compliant category/value axis. Gridlines off by default. */
export function axis(theme: Mode, title?: string, overrides: Record<string, unknown> = {}) {
  return {
    title: title ? { text: title, font: AXIS_TITLE_FONT(theme), standoff: 12 } : undefined,
    showline: false,
    zeroline: false,
    ticks: '' as const,
    showgrid: false,
    tickfont: TICK_FONT(theme),
    automargin: true,
    ...overrides,
  };
}

/** A value axis carrying the (only permitted) horizontal gridlines. */
export function gridAxis(theme: Mode, title?: string, overrides: Record<string, unknown> = {}) {
  return axis(theme, title, {
    showgrid: true,
    gridcolor: TOKENS[theme].grid,
    griddash: 'dash' as const,
    gridwidth: 1,
    nticks: 4,
    ...overrides,
  });
}

/** Tooltip per §A6.7 — surface-coloured, hairline border, no arrow. */
export function hoverLabel(theme: Mode) {
  const t = TOKENS[theme];
  return {
    bgcolor: t.surface,
    bordercolor: t.hairline,
    font: { family: 'IBM Plex Mono, monospace', size: 12, color: t.ink },
    align: 'left' as const,
  };
}

/** Bar marker defaults: rounded value end, §A7 bar geometry. */
export const barMarker = (color: string, radius = 6) => ({
  color,
  cornerradius: radius,
  line: { width: 0 },
});

export const BAR_GEOMETRY = { bargap: 0.4, bargroupgap: 0.1 };

/**
 * Vertical gradient area fill that fades to transparent (§A9). Because it
 * ends transparent rather than at a colour, the same spec is correct on the
 * white card and on the navy one.
 */
export function areaFill(color: string) {
  return {
    fillgradient: {
      type: 'vertical' as const,
      colorscale: [
        [0, withAlpha(color, 0)],
        [1, withAlpha(color, 0.22)],
      ] as [number, string][],
    },
  };
}

/** #RRGGBB → rgba(). Passes through values that are already rgba(). */
export function withAlpha(hex: string, alpha: number): string {
  if (!hex.startsWith('#')) return hex;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/**
 * Base layout.
 *
 * Legends belong below the plot as 8px round dots (§A7), which Plotly cannot
 * draw — it renders line-series keys as segments. Charts therefore render
 * <Legend> as HTML and pass `showlegend: false`. Until every tool has moved
 * over, the Plotly legend stays on by default, positioned and coloured as
 * close to the standard as the library allows.
 */
export function baseLayout(theme: Mode, overrides: Record<string, unknown> = {}) {
  const t = TOKENS[theme];
  return {
    margin: { l: 56, r: 12, t: 8, b: 40 },
    height: 300,
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { family: 'IBM Plex Sans, system-ui, sans-serif', size: 11.5, color: t.secondary },
    legend: {
      orientation: 'h' as const,
      y: -0.2,
      font: { family: 'IBM Plex Sans, system-ui, sans-serif', size: 13, color: t.secondary },
    },
    hoverlabel: hoverLabel(theme),
    ...overrides,
  };
}

export const plotConfig = { displayModeBar: false, responsive: true };

/** Entrance animation is a container-level fade-and-rise (§B6 deviation 3). */
export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ────────────────────────────── Formatting ─────────────────────────────── */
export const num = (v: string, fb = 0): number => {
  const x = parseFloat(v);
  return Number.isFinite(x) ? x : fb;
};

export const fmt = (x: number, d = 2) =>
  Math.abs(x) >= 1000 ? x.toLocaleString('en-US', { maximumFractionDigits: 0 }) : x.toFixed(d);
