// Shared Plotly theming for CEE 406 tools.
//
// This file is the single source for every color, axis, and hover default in
// the toolbox. It implements docs/chart-standards.md — §A is the visual
// language, §B binds it to the CEE 406 navy/orange identity. Tools must not
// set colors, gridlines, or axis chrome locally.
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
    /* Graph-paper chrome, used only by paperAxis (§B6 deviation 5). Opaque
       rather than rgba like `grid` and `hairline`, because these three are
       under a contrast gate — the frame has to stay quieter than the faintest
       curve it carries and louder than the grid, and a translucent token
       cannot be measured without first knowing what it is drawn on. They are
       already composited against `surface`, which is the only thing a chart
       card is ever drawn on. */
    frame: '#B4BBC3',
    gridStrong: '#DEE3E9',
    gridFaint: '#F0F2F4',
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
    frame: '#575E6C',
    gridStrong: '#373F50',
    gridFaint: '#232C3E',
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
 * color in the Stress Explorer, the layered-elastic solver, and Westergaard.
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

/** Color for a physical quantity — the preferred way for a tool to pick one. */
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

/**
 * N discrete colors along a ramp, for an ORDERED family of line series — a
 * chart whose curves are one quantity at successive values of a parameter,
 * like Huang's seventeen r/a curves on Figure 2.2.
 *
 * This is not the categorical palette of §B4 and must not be confused with
 * it: those six hues say "different things", while these say "the same thing,
 * further along". Using the categorical set for an ordered family throws away
 * the ordering, which on a chart of seventeen curves is the only thing making
 * it readable.
 *
 * Follows `rampScale`'s §A4.2 reversal, so the far end of the family is always
 * the end that stands off the card. The pale extreme is trimmed: at n > 6 the
 * 100-step is too faint to hold a 2 px line, and a curve nobody can see is
 * worse than a curve that shares a hue with its neighbour.
 */
export function rampSeries(name: RampName, theme: Mode, n: number): string[] {
  const r = RAMPS[name];          // [900, 700, 500, 300, 100]
  /* The five published stops span more range than a LINE can use. The pale
     100 stop is 1.11-1.16:1 on white and the deep 900 stop is 1.68-2.14:1 on
     the navy card — fine as a heatmap cell, which has area, and invisible as
     a 2 px stroke. Each mode therefore works from the four stops that survive
     on its own surface, running pale-to-deep on white and deep-to-luminous on
     navy per §A4.2, and light mode extends past 900 toward the ink to keep
     the span wide enough to read as an ordering. */
  const ordered = theme === 'dark'
    ? [r[1], r[2], r[3], r[4]]
    : [r[2], r[1], r[0], mixHex(r[0], TOKENS.light.ink, 0.55)];
  if (n <= 1) return [ordered[Math.floor(ordered.length / 2)]];
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * (ordered.length - 1);
    const j = Math.min(ordered.length - 2, Math.floor(x));
    out.push(mixHex(ordered[j + 1], ordered[j], x - j));
  }
  return out;
}

/** The two ends of a ramp as the RampBar legend renders them (low, high). */
export function rampEnds(name: RampName, theme: Mode): [string, string] {
  const s = rampScale(name, theme);
  return [s[0][1], s[s.length - 1][1]];
}

/**
 * Diverging colorscale for SIGNED data — a quantity that changes sign inside
 * the domain, where a sequential ramp would hide the sign change that is the
 * whole point. Sequential data must keep using `rampScale`.
 *
 * Three properties, and all three are what make it read in both themes:
 *
 *  - **Zero is the card.** The midpoint is `TOKENS[theme].surface`, so "none
 *    here" reads as bare surface rather than as a color the eye has to learn.
 *    This is the one ramp that is *not* reversed between modes: it does not
 *    need to be, because its neutral is defined as the background itself.
 *  - **The arms are equal in lightness.** Neither sign is the important one,
 *    so neither may be the louder one. (Measured: the two ends sit within
 *    1.01:1 of each other in light and 1.00:1 in dark.)
 *  - **Blue↔orange, never red↔green.** The pair has to survive deuteranopia
 *    and protanopia, and it doubles as the §B4 semantic pair.
 *
 * Stops are mixed into the surface, not alpha'd — see `mixHex` for why that
 * distinction is load-bearing on a 3-D surface.
 */
export function divergingScale(
  theme: Mode,
  low: Hue = 'blue',
  high: Hue = 'orange'
): [number, string][] {
  const h = HUES[theme];
  const mid = TOKENS[theme].surface;
  return [
    [0, h[low]],
    [0.25, mixHex(h[low], mid, 0.45)],
    [0.5, mid],
    [0.75, mixHex(h[high], mid, 0.45)],
    [1, h[high]],
  ];
}

/* ─────────────────── Magnitude fields (§B5 deviation 1) ───────────────────
 * A documented exception to §A4.2's end reversal.
 *
 * The reversal is right for a *count*: a heatmap cell with nothing in it
 * should sink into the card, so "empty" is pale on white and dark on navy.
 * It is wrong for a *physical magnitude* rendered as a continuous field —
 * a stress surface, a pressure bulb, a contact patch. There, color is the
 * quantity, and a scale whose ends swap with the site theme makes the same
 * figure say the opposite thing in dark mode: the near-zero haze around a
 * contact patch comes out in deep 900 orange while the peak is pale 100. A
 * reader takes saturation for magnitude and reads the picture inside out.
 *
 * So the field ramp runs the same direction in both themes: **washed-out at
 * zero, intense at the peak**. It cannot do that with one hue on two
 * surfaces, because "intense" is dark on white and luminous on navy, so it
 * is a multi-hue warm ramp per theme, cut so that contrast against its own
 * card rises monotonically with the value — the one property that reads as
 * magnitude on either surface.
 *
 *   light  #FFE1C0 → #A3160F   contrast vs #FFFFFF  1.25 → 7.84
 *   dark   #2A2E3C → #F9C24A   contrast vs #162033  1.21 → 9.97
 *
 * Still the stress hue of §B4: the light ramp is the orange ramp opened out
 * through amber and closed into deep red, the dark one the same path run
 * from a near-neutral charcoal up to a luminous amber. Chroma climbs with
 * the value until the sRGB gamut caps it at the last stop (a ~7 % dip,
 * below the just-noticeable difference). Asserted in fieldRamp.test.mjs.
 */
export const FIELD_RAMP: Record<Mode, string[]> = {
  light: ['#FFE1C0', '#FCC983', '#F9A445', '#F0771B', '#D5450E', '#A3160F'],
  dark: ['#2A2E3C', '#4E3229', '#7F4420', '#B35D18', '#E08A18', '#F9C24A'],
};

/**
 * Plotly colorscale for a one-signed magnitude field. Unlike `rampScale`,
 * `t=0` is the washed end and `t=1` the intense end in *both* themes.
 */
export function fieldScale(theme: Mode): [number, string][] {
  const steps = FIELD_RAMP[theme];
  return steps.map((c, i) => [i / (steps.length - 1), c] as [number, string]);
}

/** The two ends of the field ramp (low, high) — for legends and swatches. */
export function fieldEnds(theme: Mode): [string, string] {
  const s = FIELD_RAMP[theme];
  return [s[0], s[s.length - 1]];
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
 * Every color a chart needs. `sky` and `green` are retained as aliases of the
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

/* ───────── Reproduced design charts — the paper frame (§B6 deviation 5) ────
 * §A7 strips a chart to its data: no border, no axis line, no ticks, three to
 * five gridlines. That is the right instrument for a dashboard, where the
 * reader wants a trend and the precision lives in a KPI beside it.
 *
 * It is the wrong instrument for a REPRODUCED DESIGN CHART. Huang's Chapter 2
 * figures are not illustrations of a result — they ARE the result, and the
 * whole operation the reader performs on one is metric: put a ruler on the
 * page, run it to the axis, read a number between two printed values. Take
 * away the frame and the reader has nothing to run the ruler to on three of
 * the four sides; thin the grid to five lines and the interpolation the chart
 * exists for stops being possible. The stripped chrome would not be a cleaner
 * version of Figure 2.2, it would be a broken one.
 *
 * So this is a second, narrower axis vocabulary, and it is deliberately not
 * the default: `axis`/`gridAxis` remain what every ordinary chart uses.
 * `paperAxis` is for a figure that is a redraw of a printed engineering chart
 * and is read by measurement. It gives that figure log-paper chrome — a boxed
 * frame, outside major and minor ticks, and a two-weight grid — and
 * `paperFrame` completes it by mirroring the TICK LABELS onto the top and the
 * right, which Plotly has no switch for: an axis draws its labels on one side
 * only, so the opposite side is a second axis overlaying the first.
 */
export interface PaperAxisOptions {
  title?: string;
  type?: 'linear' | 'log';
  /** In the axis's own units — so log10 values on a log axis, as Plotly wants. */
  range?: [number, number];
  /** The values the printed page labels. */
  tickvals?: number[];
  ticktext?: string[];
  /**
   * The minor division between labelled ticks: a number on a linear axis,
   * 'D1' (every mantissa) or 'D2' (2 and 5) on a log one. Omit for no minor
   * grid — an axis whose labelled ticks are already dense does not want one.
   */
  minorDtick?: number | string;
}

export function paperAxis(theme: Mode, o: PaperAxisOptions = {}): Record<string, unknown> {
  const t = TOKENS[theme];
  const hasMinor = o.minorDtick !== undefined;
  return {
    title: o.title ? { text: o.title, font: AXIS_TITLE_FONT(theme), standoff: 10 } : undefined,
    type: o.type ?? 'linear',
    ...(o.range ? { range: o.range, autorange: false } : {}),
    ...(o.tickvals
      ? {
          tickmode: 'array' as const,
          tickvals: o.tickvals,
          ticktext: o.ticktext ?? o.tickvals.map(String),
        }
      : {}),
    showline: true,
    linecolor: t.frame,
    linewidth: 1,
    // The box. Only the LINE is mirrored, not the ticks — the twin axis from
    // paperFrame draws those, and two sets in the same place read as one
    // slightly-too-thick set.
    mirror: true,
    ticks: 'outside' as const,
    ticklen: 5,
    tickwidth: 1,
    tickcolor: t.frame,
    tickfont: TICK_FONT(theme),
    zeroline: false,
    showgrid: true,
    gridcolor: t.gridStrong,
    gridwidth: 1,
    griddash: 'solid' as const,
    minor: {
      ...(hasMinor ? { tickmode: 'linear' as const, dtick: o.minorDtick } : {}),
      showgrid: hasMinor,
      gridcolor: t.gridFaint,
      gridwidth: 1,
      ticks: 'outside' as const,
      ticklen: 2.5,
      tickcolor: t.frame,
    },
    automargin: true,
  };
}

/**
 * The four-sided frame: the two axes you built, plus their label twins on the
 * top and the right, plus the invisible trace that makes Plotly draw them.
 *
 * The trace is not optional. Plotly only lays out an axis some trace lives on,
 * so an overlaying axis with nothing pointing at it is silently dropped and
 * the top and right labels never appear. One two-coordinate point carries
 * both twins; it is transparent and skips hover, so it is inert.
 *
 * Spread the result into the layout and push the trace onto the trace list:
 *
 *     const frame = paperFrame(theme, xa, ya);
 *     traces.push(frame.anchor);
 *     Plotly.react(el, traces, baseLayout(theme, { ...frame.axes, ... }));
 */
export function paperFrame(
  theme: Mode,
  xaxis: Record<string, unknown>,
  yaxis: Record<string, unknown>,
) {
  const twin = (a: Record<string, unknown>, over: 'x' | 'y', side: 'top' | 'right') => ({
    ...a,
    title: undefined,
    overlaying: over,
    side,
    // The primary already drew the box line and the grid; the twin adds only
    // ticks and labels, or the chart gets two of everything.
    showline: false,
    showgrid: false,
    mirror: false,
    showticklabels: true,
    minor: { ...(a.minor as Record<string, unknown>), showgrid: false },
  });

  // Trace data is in DATA units even on a log axis, where `range` is log10.
  const anchorAt = (a: Record<string, unknown>) => {
    const r = a.range as [number, number] | undefined;
    if (!r) return 0;
    return a.type === 'log' ? Math.pow(10, r[0]) : r[0];
  };

  return {
    axes: {
      xaxis,
      yaxis,
      xaxis2: twin(xaxis, 'x', 'top'),
      yaxis2: twin(yaxis, 'y', 'right'),
    },
    anchor: {
      x: [anchorAt(xaxis)],
      y: [anchorAt(yaxis)],
      xaxis: 'x2',
      yaxis: 'y2',
      mode: 'markers' as const,
      marker: { size: 0.1, color: 'rgba(0,0,0,0)' },
      opacity: 0,
      hoverinfo: 'skip' as const,
      showlegend: false,
    },
  };
}

/** Tooltip per §A6.7 — surface-colored, hairline border, no arrow. */
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
 * ends transparent rather than at a color, the same spec is correct on the
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
 * `fg` at `t` opacity resolved against `bg`, returned OPAQUE.
 *
 * This is `withAlpha`'s counterpart, and the distinction is not cosmetic.
 * Alpha means "let the background through", which is what an SVG area fill
 * wants — `areaFill` and every 2-D `fillcolor` composite over the card and are
 * correct as rgba(). A **colorscale on a gl3d `surface`** is a different
 * animal: alpha there is applied to the *mesh fragments*, so a translucent
 * stop does not tint toward the card, it makes the sheet see-through — the far
 * side of the surface, the axis walls and the grid all show through the near
 * side, and Plotly's depth sort makes which one wins view-dependent.
 *
 * So: rgba() for anything drawn flat, `mixHex` for anything drawn in 3-D.
 * Passing the theme's own surface token as `bg` keeps the result mode-correct,
 * because the color it fades into is the card it is actually drawn on.
 */
export function mixHex(fg: string, bg: string, t: number): string {
  const p = (h: string) => {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [a, b] = [p(fg), p(bg)];
  const c = a.map((v, i) => Math.round(v * t + b[i] * (1 - t)));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Base layout.
 *
 * Legends belong below the plot as 8px round dots (§A7), which Plotly cannot
 * draw — it renders line-series keys as segments. Charts render <Legend> as
 * HTML instead, so Plotly's own legend is off by default (§B6 deviation 1).
 */
export function baseLayout(theme: Mode, overrides: Record<string, unknown> = {}) {
  const t = TOKENS[theme];
  return {
    margin: { l: 56, r: 12, t: 8, b: 40 },
    height: 300,
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { family: 'IBM Plex Sans, system-ui, sans-serif', size: 11.5, color: t.secondary },
    showlegend: false,
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
