// One layer — the homogeneous half-space of Huang §2.1.
//
// Huang opens the chapter with the sentence this module is built around:
// "The original Boussinesq (1885) theory was based on a concentrated load
// applied on an elastic half space. The stresses, strains, and deflections
// due to a concentrated load can be integrated to obtain those due to a
// circular loaded area."
//
// So §2.1 is not one problem but THREE, in a fixed order, and the third one
// splits in two:
//
//   POINT LOAD        Boussinesq's original. No length scale at all — the
//                     answer depends on r/z and nothing else.
//   CIRCULAR, FLEXIBLE  a tire: uniform pressure, dished deflection.
//                     Eqs. 2.2-2.8.
//   CIRCULAR, RIGID   a plate bearing test: uniform DEFLECTION, and a
//                     pressure that runs to infinity at the rim. Eqs. 2.9,
//                     2.10, and Huang's Figure 2.9.
//
// A student is asked to move between them and to notice that they are the
// same mechanics with a different thing held fixed. So the case is a control
// at the top of the panel, and it changes the inputs, the equations, the
// figure and the charts together: there is no state in which the tool is
// showing you the equations for one case and the numbers for another.
//
// What this adds over the closed forms in the book is the OFF-AXIS state.
// Huang prints equations for the axis of symmetry and charts for everywhere
// else, because there is no elementary closed form off it. oneLayer.ts
// computes it exactly, so the full stress tensor, its principal values, and
// the strains that follow are available at any point — including under the
// edge of the load, which is what Problem 2.1 asks for.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Tip from '../../Tip';
import {
  useTheme, chartColors, baseLayout, plotConfig, num, fmt,
  axis, gridAxis, hueFor, rampSeries, withAlpha, hoverLabel,
} from '../../chartTheme';
import ChartFigure from '../../ui/ChartFigure';
import KpiStrip, { Kpi } from '../../ui/KpiStrip';
import Equation from '../../ui/Equation';
import {
  oneLayerResponse, pointLoadResponse, rigidPlateResponse,
  principalAt, strainsAt, superposeOneLayer,
  rigidPlateDeflection, rigidPlatePressure, pointLoadAxisStress,
  type PointResponse,
} from '../oneLayer.ts';

/* ════════════════════════════════════════════════════════════════════════
   The three cases
   ════════════════════════════════════════════════════════════════════════ */

type Case = 'point' | 'flexible' | 'rigid';

/** Everything a case needs that is not a number: what it is, and how to say so. */
interface CaseDef {
  label: string;
  ref: string;
  /** One line under the case switch. */
  lead: string;
  /** Equations for the vertical-stress chart. */
  stress: EqItem[];
  /** Equations for the deflection chart. */
  deflection: EqItem[];
  /** What the figure is showing. */
  caption: ReactNode;
  /**
   * The two or three relations that DEFINE the case, for the card beside the
   * figure. Deliberately not the same list as the chart rails: what belongs
   * here is the boundary condition and the headline answer, because the
   * contrast between the cases is a contrast of boundary conditions.
   */
  defining: EqItem[];
}

interface EqItem {
  name: string;
  tex: string;
  plain: string;
  note?: string;
}

const R_DEF: EqItem = {
  name: 'with',
  tex: 'R=\\sqrt{r^{2}+z^{2}}',
  plain: 'R = sqrt(r^2 + z^2)',
  note: 'The straight-line distance from the load to the point.',
};

const CASES: Record<Case, CaseDef> = {
  point: {
    label: 'Point load',
    ref: 'Boussinesq (1885) · Huang §2.1',
    lead:
      'A concentrated load P on the surface. The case Chapter 2 starts from and the kernel ' +
      'every circular-load integral in it integrates.',
    stress: [
      {
        name: 'Vertical stress at any (r, z)',
        tex: '\\begin{aligned}\\sigma_z&=\\frac{3P}{2\\pi}\\,\\frac{z^{3}}{R^{5}}\\\\[2pt]' +
          '&=\\frac{3P}{2\\pi z^{2}}\\left[\\frac{1}{1+(r/z)^{2}}\\right]^{5/2}\\end{aligned}',
        plain: 'sigma_z = 3P z^3 / (2 pi R^5)',
        note:
          'No E and no ν anywhere in it, and no length scale either: written the second way, ' +
          'the whole shape of the family below is one function of r/z.',
      },
      R_DEF,
      {
        name: 'On the axis (r = 0)',
        tex: '\\sigma_z=\\frac{3P}{2\\pi z^{2}}=0.4775\\,\\frac{P}{z^{2}}',
        plain: 'sigma_z(0, z) = 0.4775 P / z^2',
        note: 'Halve the depth and the stress goes up four times. That is the whole argument for a base course.',
      },
      {
        name: 'Radial and tangential',
        // Broken over two lines rather than left to scroll: an equation the
        // reader has to drag sideways to finish is not next to the chart any
        // more, which was the point of putting it here.
        tex: '\\begin{aligned}' +
          '\\sigma_r&=\\frac{P}{2\\pi}\\left[\\frac{3r^{2}z}{R^{5}}-\\frac{1-2\\nu}{R(R+z)}\\right]\\\\[2pt]' +
          '\\sigma_t&=\\frac{P(1-2\\nu)}{2\\pi}\\left[\\frac{1}{R(R+z)}-\\frac{z}{R^{3}}\\right]' +
          '\\end{aligned}',
        plain: 'sigma_r and sigma_t, both carrying (1 - 2 nu)',
        note: 'σt is proportional to (1 − 2ν) alone, so at ν = 0.5 the hoop stress vanishes everywhere.',
      },
    ],
    deflection: [
      {
        name: 'Vertical deflection at any (r, z)',
        tex: 'w=\\frac{P(1+\\nu)}{2\\pi E R}\\left[2(1-\\nu)+\\frac{z^{2}}{R^{2}}\\right]',
        plain: 'w = P(1+nu) / (2 pi E R) * [2(1-nu) + z^2/R^2]',
      },
      {
        name: 'On the surface (z = 0)',
        tex: 'w=\\frac{P\\,(1-\\nu^{2})}{\\pi E r}',
        plain: 'w(r, 0) = P(1 - nu^2) / (pi E r)',
        note:
          'A 1/r bowl, and infinite under the load: a point load is a singularity, so the ' +
          'z = 0 curve has no value at r = 0 and the tool will not draw one.',
      },
      {
        name: 'On the axis (r = 0)',
        tex: 'w=\\frac{P(1+\\nu)(3-2\\nu)}{2\\pi E z}',
        plain: 'w(0, z) = P(1+nu)(3-2nu) / (2 pi E z)',
      },
    ],
    defining: [
      {
        name: 'The load',
        tex: 'P \\;\\text{applied at a single point of the surface}',
        plain: 'P applied at a single point of the surface',
        note: 'No contact area, so no length scale: the answer depends on r/z and on P alone.',
      },
      {
        name: 'What it gives, on the axis',
        tex: '\\sigma_z=0.4775\\,\\frac{P}{z^{2}},\\qquad w=\\frac{P(1+\\nu)(3-2\\nu)}{2\\pi E z}',
        plain: 'sigma_z = 0.4775 P/z^2 and w = P(1+nu)(3-2nu)/(2 pi E z)',
      },
      {
        name: 'And on the surface',
        tex: 'w=\\frac{P(1-\\nu^{2})}{\\pi E r}\\;\\longrightarrow\\;\\infty \\;\\text{ as } r\\to 0',
        plain: 'w = P(1-nu^2)/(pi E r), unbounded under the load',
      },
    ],
    caption: (
      <>
        <strong>Boussinesq's concentrated load.</strong> Everything is measured from the point
        of application: r across the surface, z down, R along the ray. The load has no width, so
        there is nothing in the problem with the dimensions of length except r and z themselves.
      </>
    ),
  },

  flexible: {
    label: 'Circular · flexible plate',
    ref: 'Huang Eqs. 2.2 – 2.8',
    lead:
      'A tire. The pressure under it is uniform and equal to the inflation pressure, and the ' +
      'surface it presses on dishes: most deflection at the center, least at the rim.',
    stress: [
      {
        name: 'On the axis (Eq. 2.2)',
        tex: '\\sigma_z=q\\left[1-\\frac{z^{3}}{(a^{2}+z^{2})^{3/2}}\\right]',
        plain: 'sigma_z = q [1 - z^3 / (a^2 + z^2)^(3/2)]',
        note: 'Independent of E and ν, as Huang notes under Eq. 2.3: the same number for any material.',
      },
      {
        name: 'Off the axis',
        tex: '\\sigma_z=qa\\int_{0}^{\\infty}\\!J_{1}(ma)\\,J_{0}(mr)\\,(1+mz)\\,e^{-mz}\\,dm',
        plain: 'sigma_z = q a ∫ J1(ma) J0(mr) (1 + mz) e^(-mz) dm',
        note:
          'There is no elementary closed form off the axis, which is why Huang prints ' +
          'Figures 2.2–2.6 instead. This is the integral those figures are pictures of; the ' +
          'curves below are computed from it, not read off a page.',
      },
      {
        name: 'At the surface (z = 0)',
        tex: '\\sigma_z=q\\;(r<a),\\qquad \\sigma_z=0\\;(r>a)',
        plain: 'sigma_z = q inside the circle, 0 outside',
        note: 'The load has a sharp edge; nothing below the surface does.',
      },
    ],
    deflection: [
      {
        name: 'On the axis (Eq. 2.6)',
        tex: '\\begin{aligned}w=\\frac{(1+\\nu)qa}{E}\\Big\\{' +
          '&\\frac{a}{(a^{2}+z^{2})^{1/2}}\\\\[2pt]' +
          '&+\\frac{1-2\\nu}{a}\\left[(a^{2}+z^{2})^{1/2}-z\\right]\\Big\\}\\end{aligned}',
        plain: 'w = (1+nu) q a / E * { a/(a^2+z^2)^0.5 + (1-2nu)/a [(a^2+z^2)^0.5 - z] }',
      },
      {
        name: 'At the surface, under the center (Eq. 2.8)',
        tex: 'w_{0}=\\frac{2(1-\\nu^{2})\\,q\\,a}{E}',
        plain: 'w0 = 2(1 - nu^2) q a / E',
        note: 'Set z = 0 in Eq. 2.6. This is the deflection a rigid plate is compared against.',
      },
      {
        name: 'Elsewhere on the surface',
        tex: 'w=\\frac{4(1-\\nu^{2})qa}{\\pi E}\\,E\\!\\left(\\tfrac{r}{a}\\right),\\quad r\\le a',
        plain: 'w = 4(1-nu^2) q a / (pi E) * E(r/a) for r <= a',
        note:
          'E(k) is the complete elliptic integral of the second kind. The surface is DISHED — ' +
          'that is what makes the plate flexible, and it is the whole difference from the rigid case.',
      },
    ],
    defining: [
      {
        name: 'Boundary condition: the PRESSURE is fixed',
        tex: 'p(r)=q\\quad\\text{for } r\\le a,\\qquad P=\\pi a^{2}q',
        plain: 'p(r) = q for r <= a; total load P = pi a^2 q',
        note: 'The plate takes whatever shape the half-space gives it. That is what "flexible" means.',
      },
      {
        name: 'Vertical stress on the axis (Eq. 2.2)',
        tex: '\\sigma_z=q\\left[1-\\frac{z^{3}}{(a^{2}+z^{2})^{3/2}}\\right]',
        plain: 'sigma_z = q [1 - z^3/(a^2+z^2)^(3/2)]',
      },
      {
        name: 'Surface deflection at the center (Eq. 2.8)',
        tex: 'w_{0}=\\frac{2(1-\\nu^{2})\\,q\\,a}{E}',
        plain: 'w0 = 2(1-nu^2) q a / E',
      },
    ],
    caption: (
      <>
        <strong>Huang Figure 2.9(a).</strong> The plate cannot resist bending, so it applies a
        uniform pressure q and takes whatever shape the half-space gives it. The deflection is
        largest under the center and about 64% of that at the rim.
      </>
    ),
  },

  rigid: {
    label: 'Circular · rigid plate',
    ref: 'Huang Eqs. 2.9, 2.10 · Figure 2.9(b)',
    lead:
      'A plate loading test. The plate cannot bend, so the deflection is the same at every ' +
      'point under it and the pressure is whatever it takes to make that true.',
    stress: [
      {
        name: 'Pressure under the plate (Eq. 2.9)',
        tex: 'q(r)=\\frac{q\\,a}{2\\sqrt{a^{2}-r^{2}}}',
        plain: 'q(r) = q a / (2 sqrt(a^2 - r^2))',
        note:
          'q is the AVERAGE pressure, total load over plate area. The smallest pressure is q/2, ' +
          'at the center; at the rim it is infinite. The z = 0 curve below is this equation, and ' +
          'it leaves the top of the frame because the function does.',
      },
      {
        name: 'On the axis, below the plate',
        tex: '\\sigma_z=\\frac{q\\,a^{2}\\,(a^{2}+3z^{2})}{2\\,(a^{2}+z^{2})^{2}}',
        plain: 'sigma_z(0, z) = q a^2 (a^2 + 3 z^2) / (2 (a^2 + z^2)^2)',
        note:
          'q/2 at the surface, and 3qa²/(2z²) deep down — which is 3P/(2πz²), the point load. ' +
          'A plate is a point load once you are far enough from it.',
      },
      {
        name: 'Everywhere else',
        tex: '\\sigma_z=\\frac{qa}{2}\\int_{0}^{\\infty}\\!\\sin(ma)\\,J_{0}(mr)\\,(1+mz)\\,e^{-mz}\\,dm',
        plain: 'sigma_z = (q a / 2) ∫ sin(ma) J0(mr) (1 + mz) e^(-mz) dm',
        note:
          'The same integral as the flexible plate with one factor changed: J₁(ma) becomes ' +
          'sin(ma)/2. That single substitution is the entire rigid-plate solution.',
      },
    ],
    deflection: [
      {
        name: 'Settlement of the plate (Eq. 2.10)',
        tex: 'w_{0}=\\frac{\\pi\\,(1-\\nu^{2})\\,q\\,a}{2E}',
        plain: 'w0 = pi (1 - nu^2) q a / (2 E)',
        note: 'One number for the whole plate: it settles as a unit, so w is FLAT for r ≤ a.',
      },
      {
        name: 'Against the flexible plate (Eq. 2.8)',
        tex: '\\frac{w_{0}^{\\text{rigid}}}{w_{0}^{\\text{flexible}}}=\\frac{\\pi}{4}=0.785',
        plain: 'rigid / flexible = pi/4 = 0.785',
        note:
          'Huang: "the surface deflection under a rigid plate is only 79% of that under the ' +
          'center of a uniformly distributed load" — because the rigid plate sheds pressure to ' +
          'its rim, and pressure near the center is what moves the center.',
      },
      {
        name: 'Outside the plate',
        tex: 'w(r)=\\frac{2w_{0}}{\\pi}\\arcsin\\frac{a}{r},\\qquad r\\ge a',
        plain: 'w(r) = (2 w0 / pi) asin(a/r) for r >= a',
      },
    ],
    defining: [
      {
        name: 'Boundary condition: the DEFLECTION is fixed',
        tex: 'w(r)=w_{0}\\quad\\text{for } r\\le a,\\qquad P=\\pi a^{2}q',
        plain: 'w(r) = w0 for r <= a; total load P = pi a^2 q',
        note: 'The plate cannot bend, so it settles as a unit and the pressure adjusts to allow it.',
      },
      {
        name: 'The pressure that results (Eq. 2.9)',
        tex: 'p(r)=\\frac{q\\,a}{2\\sqrt{a^{2}-r^{2}}}',
        plain: 'p(r) = q a / (2 sqrt(a^2 - r^2))',
        note: 'q/2 at the center, unbounded at the rim. q itself is the AVERAGE pressure.',
      },
      {
        name: 'The settlement (Eq. 2.10)',
        tex: 'w_{0}=\\frac{\\pi(1-\\nu^{2})\\,q\\,a}{2E}=\\frac{\\pi}{4}\\,w_{0}^{\\text{flexible}}',
        plain: 'w0 = pi (1-nu^2) q a / (2E) = (pi/4) x the flexible value',
      },
    ],
    caption: (
      <>
        <strong>Huang Figure 2.9(b).</strong> Read the two figures against each other: the
        flexible plate fixes the pressure and lets the deflection vary; the rigid plate fixes the
        deflection and lets the pressure vary. Neither is more correct — they are different
        boundary conditions, and a plate bearing test is the second one.
      </>
    ),
  },
};

const CASE_ORDER: Case[] = ['point', 'flexible', 'rigid'];
const isCircular = (k: Case) => k !== 'point';

/* ════════════════════════════════════════════════════════════════════════
   Presets — every one of them a case printed in the book
   ════════════════════════════════════════════════════════════════════════ */

type SweepVar = 'E' | 'nu' | 'load' | 'a';
type Resp = 'w0' | 'sigZ' | 'w';

interface Preset {
  label: string;
  tip: string;
  kase: Case;
  P: string; q: string; a: string; E: string; nu: string;
  r: string; z: string;
  twin: boolean; spacing: string;
  depths: string; rMax: string;
  sweepVar: SweepVar; sweepVals: string; resp: Resp;
}

const PRESETS: Preset[] = [
  {
    label: 'Example 2.1 (two circles)',
    tip: 'Two 10-in circles at 50 psi, 20 in apart, E = 10,000 psi, ν = 0.5. Point A is 10 in under one center. Huang prints σz = 14.38 psi, εz = 0.00129, w = 0.022 in — read off Figures 2.2 and 2.3 as 28% and 0.76% of q. Computed exactly the sum is 14.60 psi, because 28% is a chart read of 28.44%.',
    kase: 'flexible',
    P: '9000', q: '50', a: '5', E: '10000', nu: '0.5',
    r: '0', z: '10', twin: true, spacing: '20',
    depths: '0, 5, 10, 20', rMax: '35',
    sweepVar: 'E', sweepVals: '5000, 10000, 20000, 40000', resp: 'w0',
  },
  {
    label: 'Example 2.2 (ν = 0.3)',
    tip: 'The same left circle alone at ν = 0.3. Printed: σz = 14.2 psi, σr = −0.25 psi (TENSION), εz = 0.00144, w = 0.0176 in. Compare with ν = 0.5, where σr is +0.8 psi.',
    kase: 'flexible',
    P: '9000', q: '50', a: '5', E: '10000', nu: '0.3',
    r: '0', z: '10', twin: false, spacing: '20',
    depths: '0, 5, 10, 20', rMax: '25',
    sweepVar: 'nu', sweepVals: '0.2, 0.3, 0.4, 0.5', resp: 'w0',
  },
  {
    label: 'Problem 2.1 (under the edge)',
    tip: 'r = a, z = 2a, ν = 0.5, the off-axis principal state. Huang prints σ = 0.221q, 0.011q, 0.004q and w = 0.58qa/E from Ahlvin and Ulery’s tables; computed exactly they are 0.228, 0.0108, 0.0092 and 0.572.',
    kase: 'flexible',
    P: '314', q: '100', a: '1', E: '1000', nu: '0.5',
    r: '1', z: '2', twin: false, spacing: '20',
    depths: '0, 1, 2, 4', rMax: '6',
    sweepVar: 'nu', sweepVals: '0.3, 0.4, 0.5', resp: 'sigZ',
  },
  {
    label: 'Example 2.3 (plate bearing test)',
    tip: 'A 12-in rigid plate, 8000 lb total, measured deflection 0.1 in, ν = 0.4. q = 8000/(36π) = 70.74 psi, and Eq. 2.10 back-figures E = 5600 psi. Check the w₀ KPI reads 0.1000.',
    kase: 'rigid',
    P: '8000', q: '70.74', a: '6', E: '5600', nu: '0.4',
    r: '0', z: '6', twin: false, spacing: '20',
    depths: '0, 3, 6, 12, 24', rMax: '30',
    sweepVar: 'E', sweepVals: '2500, 5600, 10000, 20000', resp: 'w0',
  },
  {
    label: 'Plate study: E = 5k – 40k',
    tip: 'A 12-in-diameter load at q = 90 psi on a half-space with ν = 0.30, for E = 5,000 / 10,000 / 20,000 / 40,000 psi. The parametric card answers it for BOTH plates at once: w₀ = 982.8/E flexible, π/4 of that rigid.',
    kase: 'flexible',
    P: '10179', q: '90', a: '6', E: '10000', nu: '0.3',
    r: '0', z: '12', twin: false, spacing: '20',
    depths: '0, 6, 12, 24, 36', rMax: '36',
    sweepVar: 'E', sweepVals: '5000, 10000, 20000, 40000', resp: 'w0',
  },
  {
    label: 'Point load: 9,000-lb wheel',
    tip: 'A single 9,000-lb wheel treated as a concentrated load, E = 10,000 psi, ν = 0.5. On the axis σz = 0.4775 P/z², so at z = 24 in it is 7.46 psi. Compare with the same load spread over a 6-in radius.',
    kase: 'point',
    P: '9000', q: '80', a: '6', E: '10000', nu: '0.5',
    r: '0', z: '24', twin: false, spacing: '20',
    depths: '6, 12, 24, 36, 48', rMax: '48',
    sweepVar: 'E', sweepVals: '5000, 10000, 20000, 40000', resp: 'w',
  },
];

/* ════════════════════════════════════════════════════════════════════════
   Input helpers
   ════════════════════════════════════════════════════════════════════════ */

/**
 * "0, 6, 12, 24" -> [0, 6, 12, 24]. Sorted, de-duplicated and capped, because
 * the curve colors come from an ordered ramp: past about six lines the ramp
 * stops separating them and the chart stops being readable.
 */
function parseList(s: string, cap: number, minValue = -Infinity): number[] {
  const out = new Set<number>();
  for (const part of s.split(/[,;\s]+/)) {
    if (!part) continue;
    const v = parseFloat(part);
    if (Number.isFinite(v) && v >= minValue) out.add(v);
  }
  return [...out].sort((x, y) => x - y).slice(0, cap);
}

const clampNu = (v: number) => Math.min(0.499, Math.max(0, v));

/** The four numbers a case is solved from, so a sweep can override one. */
interface Params { P: number; q: number; a: number; E: number; nu: number }

const SAMPLES = 61;
const MAX_CURVES = 6;

/* ════════════════════════════════════════════════════════════════════════
   The figure of what is being solved
   ════════════════════════════════════════════════════════════════════════ */

function CaseFigure({ kase, theme }: { kase: Case; theme: 'light' | 'dark' }) {
  const c = chartColors(theme);
  const ink = c.ink, mut = c.fg, line = c.hairline, br = c.orange, gr = c.emerald;
  const mono = 'IBM Plex Mono, monospace';
  const SURF = 52;

  // The ground: a hairline surface with a washed body under it. Every case
  // is drawn on the same half-space so the three read as one figure.
  const ground = (
    <>
      <rect x="18" y={SURF} width="304" height="104" fill={withAlpha(mut, 0.06)} />
      <line x1="18" y1={SURF} x2="322" y2={SURF} stroke={ink} strokeWidth="1.6" />
      <text x="24" y="150" fontFamily={mono} fontSize="9" fill={mut}>
        Half-space: E, ν · homogeneous, isotropic, weightless
      </text>
    </>
  );

  if (kase === 'point') {
    return (
      <svg viewBox="0 0 340 160" role="img" aria-label="A concentrated load P on the surface of a half-space, with r, z and R marked to a point below it">
        {ground}
        <line x1="110" y1="10" x2="110" y2={SURF - 2} stroke={br} strokeWidth="2.6" />
        <path d={`M110 ${SURF} l-4.5 -8 h9 z`} fill={br} />
        <text x="118" y="20" fontFamily={mono} fontSize="11" fill={br} fontWeight="600">P</text>
        {/* the point */}
        <line x1="110" y1={SURF} x2="214" y2={SURF} stroke={mut} strokeWidth="1" strokeDasharray="3 3" />
        <line x1="214" y1={SURF} x2="214" y2="118" stroke={mut} strokeWidth="1" strokeDasharray="3 3" />
        <line x1="110" y1={SURF} x2="214" y2="118" stroke={gr} strokeWidth="1.3" strokeDasharray="5 3" />
        <circle cx="214" cy="118" r="3.4" fill={ink} />
        <text x="162" y={SURF - 5} textAnchor="middle" fontFamily={mono} fontSize="9.5" fill={mut}>r</text>
        <text x="220" y="90" fontFamily={mono} fontSize="9.5" fill={mut}>z</text>
        <text x="150" y="94" fontFamily={mono} fontSize="9.5" fill={gr}>R</text>
        <text x="222" y="122" fontFamily={mono} fontSize="9" fill={ink}>σz, σr, σt, w</text>
      </svg>
    );
  }

  const L = 118, Rr = 222, MID = 170;      // the loaded width, 2a
  const dim = (
    <>
      <line x1={L} y1="140" x2={Rr} y2="140" stroke={line} strokeWidth="1.6" />
      <line x1={L} y1="136" x2={L} y2="144" stroke={mut} strokeWidth="1" />
      <line x1={Rr} y1="136" x2={Rr} y2="144" stroke={mut} strokeWidth="1" />
      <text x={MID} y="136" textAnchor="middle" fontFamily={mono} fontSize="9" fill={mut}>2a</text>
    </>
  );

  if (kase === 'flexible') {
    return (
      <svg viewBox="0 0 340 160" role="img" aria-label="A flexible plate: uniform pressure arrows over the loaded width and a dished deflection basin below">
        {ground}
        {/* uniform pressure: equal arrows */}
        {[0, 1, 2, 3, 4, 5, 6].map(i => {
          const x = L + (i * (Rr - L)) / 6;
          return (
            <g key={i}>
              <line x1={x} y1="18" x2={x} y2={SURF - 3} stroke={br} strokeWidth="1.8" />
              <path d={`M${x} ${SURF - 1} l-3.2 -6 h6.4 z`} fill={br} />
            </g>
          );
        })}
        <line x1={L} y1="18" x2={Rr} y2="18" stroke={br} strokeWidth="1.4" />
        <text x={MID} y="13" textAnchor="middle" fontFamily={mono} fontSize="9.5" fill={br}>
          uniform pressure q
        </text>
        {/* the dish */}
        <path
          d={`M40 ${SURF + 2} C ${L - 6} ${SURF + 4} ${L + 4} ${SURF + 22} ${MID} ${SURF + 24}
              C ${Rr - 4} ${SURF + 22} ${Rr + 6} ${SURF + 4} 300 ${SURF + 2}`}
          fill="none" stroke={gr} strokeWidth="2" strokeDasharray="5 3"
        />
        <text x="300" y={SURF + 40} textAnchor="end" fontFamily={mono} fontSize="9" fill={gr}>
          deflection basin: dished
        </text>
        {dim}
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 340 160" role="img" aria-label="A rigid plate: pressure arrows growing toward the rim and a flat deflection under the plate">
      {ground}
      {/* the plate itself */}
      <rect x={L - 4} y="28" width={Rr - L + 8} height="8" rx="2" fill={ink} />
      <line x1={MID} y1="10" x2={MID} y2="26" stroke={br} strokeWidth="2.6" />
      <path d={`M${MID} ${28} l-4.5 -8 h9 z`} fill={br} />
      <text x={MID + 8} y="20" fontFamily={mono} fontSize="10.5" fill={br} fontWeight="600">P</text>
      <text x={L - 8} y="24" textAnchor="start" fontFamily={mono} fontSize="9" fill={ink}>rigid plate</text>
      {/* Eq. 2.9: arrows short at the center, long at the rim */}
      {[0, 1, 2, 3, 4, 5, 6].map(i => {
        const t = (i / 6) * 2 - 1;                 // -1 .. 1 across the plate
        const x = MID + t * ((Rr - L) / 2) * 0.94;
        const h = 4 + 9 / (2 * Math.sqrt(Math.max(0.06, 1 - t * t)));
        return (
          <g key={i}>
            <line x1={x} y1={SURF - h} x2={x} y2={SURF - 3} stroke={br} strokeWidth="1.8" />
            <path d={`M${x} ${SURF - 1} l-3.2 -6 h6.4 z`} fill={br} />
          </g>
        );
      })}
      {/* flat under the plate, curving up outside */}
      <path
        d={`M40 ${SURF + 2} C ${L - 14} ${SURF + 6} ${L - 6} ${SURF + 19} ${L} ${SURF + 19}
            L ${Rr} ${SURF + 19}
            C ${Rr + 6} ${SURF + 19} ${Rr + 14} ${SURF + 6} 300 ${SURF + 2}`}
        fill="none" stroke={gr} strokeWidth="2" strokeDasharray="5 3"
      />
      <text x="300" y={SURF + 40} textAnchor="end" fontFamily={mono} fontSize="9" fill={gr}>
        deflection: FLAT under the plate
      </text>
      {dim}
    </svg>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   The equation rail
   ════════════════════════════════════════════════════════════════════════ */

function EqRail({ title, items }: { title: string; items: EqItem[] }) {
  return (
    <aside className="cee-card cee-card--sunken cee-eqrail">
      <p className="cee-eqrail__title">{title}</p>
      <div className="cee-eqs">
        {items.map(it => (
          <div className="cee-eq" key={it.name + it.tex}>
            <span className="cee-eq__name">{it.name}</span>
            <div className="cee-eq__math">
              <Equation tex={it.tex} plain={it.plain} display />
            </div>
            {it.note && <span className="cee-eq__note">{it.note}</span>}
          </div>
        ))}
      </div>
    </aside>
  );
}

/* ════════════════════════════════════════════════════════════════════════ */

export default function OneLayerModule() {
  const [p, setP] = useState<Preset>(PRESETS[4]);
  const [kase, setKase] = useState<Case>(PRESETS[4].kase);
  const [PStr, setPLoad] = useState(PRESETS[4].P);
  const [qStr, setQ] = useState(PRESETS[4].q);
  const [aStr, setA] = useState(PRESETS[4].a);
  const [EStr, setE] = useState(PRESETS[4].E);
  const [nuStr, setNu] = useState(PRESETS[4].nu);
  const [rStr, setR] = useState(PRESETS[4].r);
  const [zStr, setZ] = useState(PRESETS[4].z);
  const [twin, setTwin] = useState(PRESETS[4].twin);
  const [spStr, setSp] = useState(PRESETS[4].spacing);
  const [depthStr, setDepths] = useState(PRESETS[4].depths);
  const [rMaxStr, setRMax] = useState(PRESETS[4].rMax);
  const [logY, setLogY] = useState(false);
  const [sweepVar, setSweepVar] = useState<SweepVar>(PRESETS[4].sweepVar);
  const [sweepStr, setSweep] = useState(PRESETS[4].sweepVals);
  const [resp, setResp] = useState<Resp>(PRESETS[4].resp);

  const base: Params = {
    P: num(PStr, 9000),
    q: num(qStr, 90),
    a: Math.max(1e-3, num(aStr, 6)),
    E: num(EStr, 10000),
    nu: clampNu(num(nuStr, 0.35)),
  };
  const r = Math.max(0, num(rStr, 0));
  const z = Math.max(0, num(zStr, 0));
  const spacing = num(spStr, 20);
  const rMax = Math.max(base.a * 1.5, num(rMaxStr, 36));

  const valid = kase === 'point'
    ? base.E > 0 && base.P !== 0
    : base.E > 0 && base.a > 0 && base.q !== 0;

  const superposed = kase === 'flexible' && twin;

  const apply = (x: Preset) => {
    setP(x); setKase(x.kase);
    setPLoad(x.P); setQ(x.q); setA(x.a); setE(x.E); setNu(x.nu);
    setR(x.r); setZ(x.z); setTwin(x.twin); setSp(x.spacing);
    setDepths(x.depths); setRMax(x.rMax); setLogY(false);
    setSweepVar(x.sweepVar); setSweep(x.sweepVals); setResp(x.resp);
  };

  /**
   * One evaluator for all three cases, so nothing downstream has to know
   * which one is selected. Returns null where the case has no value — the
   * origin of a point load, or a parameter that has been typed to nonsense.
   */
  const fieldOf = (k: Case, o: Params, useTwin: boolean) =>
    (rr: number, zz: number): PointResponse | null => {
      if (k === 'point') return pointLoadResponse(rr, zz, o.P, o.E, o.nu);
      if (k === 'rigid') return rigidPlateResponse(rr, zz, o.q, o.a, o.E, o.nu);
      if (!useTwin) return oneLayerResponse(rr, zz, o.q, o.a, o.E, o.nu);
      const S = superposeOneLayer(
        [{ x: 0, y: 0 }, { x: spacing, y: 0 }], { x: rr, y: 0, z: zz },
        o.q, o.a, o.E, o.nu
      );
      return S && {
        sigZ: S.sz, sigR: S.sx, sigT: S.sy, tauRZ: S.txz, w: S.w, u: 0,
      };
    };

  const field = fieldOf(kase, base, superposed);

  /* ── The curve family: one curve per depth ───────────────────────────── */

  const depths = useMemo(() => {
    const list = parseList(depthStr, MAX_CURVES, 0);
    // A point load is a singularity, so it has no surface curve at all: at
    // z = 0 the deflection is infinite under the load and sigma_z is zero
    // everywhere else. Dropping it is more honest than drawing a spike.
    return kase === 'point' ? list.filter(v => v > 0) : list;
  }, [depthStr, kase]);

  const droppedSurface =
    kase === 'point' && parseList(depthStr, MAX_CURVES, 0).some(v => v === 0);

  const curves = useMemo(() => {
    if (!valid || depths.length === 0) return [];
    return depths.map(zz => {
      const rs: number[] = [], sig: (number | null)[] = [], def: (number | null)[] = [];
      for (let i = 0; i < SAMPLES; i++) {
        const rr = (i / (SAMPLES - 1)) * rMax;
        const R = field(rr, zz);
        rs.push(rr);
        sig.push(R && Number.isFinite(R.sigZ) ? R.sigZ : null);
        def.push(R && Number.isFinite(R.w) ? R.w : null);
      }
      return { z: zz, r: rs, sigZ: sig, w: def };
    });
    // `field` closes over exactly these, so listing them is listing it.
  }, [valid, depths, rMax, kase, base.P, base.q, base.a, base.E, base.nu, superposed, spacing]);

  /**
   * Where to stop the stress axis.
   *
   * Eq. 2.9 is UNBOUNDED at the rim of a rigid plate, so a sample that lands
   * near r = a would set the scale for every other curve and squash the whole
   * figure into the bottom pixel. The axis is therefore taken from the field
   * away from the rim, and the surface curve is left to run off the top of
   * the frame — which is the correct picture: the pressure really does go to
   * infinity there, and a curve leaving the frame says so.
   */
  const stressTop = useMemo(() => {
    let top = 0;
    for (const c of curves) {
      for (let i = 0; i < c.r.length; i++) {
        const v = c.sigZ[i];
        if (v == null) continue;
        if (kase === 'rigid' && c.z === 0 &&
            c.r[i] > 0.9 * base.a && c.r[i] < 1.1 * base.a) continue;
        if (v > top) top = v;
      }
    }
    return top > 0 ? top * 1.12 : 1;
  }, [curves, kase, base.a]);

  /* ── The point state, for the table ──────────────────────────────────── */

  const point = useMemo(() => {
    if (!valid) return null;
    const R = field(r, z);
    if (!R) return null;
    if (superposed) {
      const S = superposeOneLayer(
        [{ x: 0, y: 0 }, { x: spacing, y: 0 }], { x: r, y: 0, z }, base.q, base.a, base.E, base.nu
      );
      if (!S) return null;
      return {
        R,
        principal: { sig: S.sig, eps: S.eps },
        strains: {
          epsZ: (S.sz - base.nu * (S.sx + S.sy)) / base.E,
          epsR: (S.sx - base.nu * (S.sy + S.sz)) / base.E,
          epsT: (S.sy - base.nu * (S.sx + S.sz)) / base.E,
          gamRZ: NaN,
        },
      };
    }
    return { R, principal: principalAt(R, base.E, base.nu), strains: strainsAt(R, base.E, base.nu) };
  }, [valid, r, z, kase, base.P, base.q, base.a, base.E, base.nu, superposed, spacing]);

  /* ── The parametric study ────────────────────────────────────────────── */

  const sweepVars: { id: SweepVar; label: string; unit: string }[] = [
    { id: 'E', label: 'Modulus E', unit: 'psi / kPa' },
    { id: 'nu', label: 'Poisson ν', unit: '0 – 0.499' },
    kase === 'point'
      ? { id: 'load', label: 'Load P', unit: 'lb / N' }
      : { id: 'load', label: 'Pressure q', unit: 'psi / kPa' },
    ...(isCircular(kase) ? [{ id: 'a' as const, label: 'Radius a', unit: 'in / mm' }] : []),
  ];
  const sweepDef = sweepVars.find(v => v.id === sweepVar) ?? sweepVars[0];

  const respLabel: Record<Resp, string> = {
    w0: 'Maximum surface deflection w₀',
    sigZ: `σz at (r = ${fmt(r, 1)}, z = ${fmt(z, 1)})`,
    w: `w at (r = ${fmt(r, 1)}, z = ${fmt(z, 1)})`,
  };
  // A point load has no finite surface deflection anywhere, so w0 is not on
  // the menu for it.
  const respOptions: Resp[] = kase === 'point' ? ['w', 'sigZ'] : ['w0', 'sigZ', 'w'];
  const activeResp: Resp = respOptions.includes(resp) ? resp : respOptions[0];

  const sweepRows = useMemo(() => {
    if (!valid) return [];
    const values = parseList(sweepStr, 8, sweepVar === 'nu' ? 0 : 1e-9);
    const answer = (k: Case, o: Params): number => {
      if (activeResp === 'w0') {
        // Under the center of the load, which for a twin is the center of the
        // FIRST circle — the same station Eq. 2.8 reports, superposed the same
        // way every other response here is.
        return k === 'rigid'
          ? rigidPlateDeflection(o.q, o.a, o.E, o.nu)
          : (fieldOf('flexible', o, superposed)(0, 0)?.w ?? NaN);
      }
      const R = fieldOf(k, o, k === 'flexible' && superposed)(r, z);
      if (!R) return NaN;
      return activeResp === 'sigZ' ? R.sigZ : R.w;
    };
    return values.map(v => {
      const o: Params = { ...base };
      if (sweepVar === 'E') o.E = v;
      else if (sweepVar === 'nu') o.nu = clampNu(v);
      else if (sweepVar === 'a') o.a = Math.max(1e-3, v);
      else if (kase === 'point') o.P = v;
      else o.q = v;
      return kase === 'point'
        ? { v, flexible: answer('point', o), rigid: NaN }
        : { v, flexible: answer('flexible', o), rigid: answer('rigid', o) };
    });
  }, [valid, sweepStr, sweepVar, activeResp, kase, r, z, base.P, base.q, base.a, base.E, base.nu, superposed, spacing]);

  /* ── Drawing ─────────────────────────────────────────────────────────── */

  const theme = useTheme();
  const stressRef = useRef<HTMLDivElement>(null);
  const deflRef = useRef<HTMLDivElement>(null);
  const sweepRef = useRef<HTMLDivElement>(null);

  const stressHues = rampSeries('orange', theme, Math.max(1, curves.length));
  const deflHues = rampSeries('emerald', theme, Math.max(1, curves.length));
  const respHue = hueFor(activeResp === 'sigZ' ? 'stress' : 'deflection', theme);

  useEffect(() => {
    let dead = false;
    (async () => {
      const Plotly = (await import('plotly.js-dist-min')).default;
      if (dead) return;
      const c = chartColors(theme);

      /* The loaded circle(s), drawn under the curves. A point load has no
         width, so it gets a hairline instead of a band. */
      const bands = kase === 'point'
        ? [{
            type: 'line' as const, xref: 'x' as const, yref: 'paper' as const,
            x0: 0, x1: 0, y0: 0, y1: 1,
            line: { color: c.orange, width: 1.5, dash: 'dot' as const },
          }]
        : [
            {
              type: 'rect' as const, xref: 'x' as const, yref: 'paper' as const,
              x0: 0, x1: base.a, y0: 0, y1: 1,
              fillcolor: withAlpha(c.orange, 0.1), line: { width: 0 }, layer: 'below' as const,
            },
            ...(superposed ? [{
              type: 'rect' as const, xref: 'x' as const, yref: 'paper' as const,
              x0: Math.max(0, spacing - base.a), x1: spacing + base.a, y0: 0, y1: 1,
              fillcolor: withAlpha(c.orange, 0.1), line: { width: 0 }, layer: 'below' as const,
            }] : []),
          ];

      const family = (key: 'sigZ' | 'w', hues: string[]) =>
        curves.map((cv, i) => ({
          x: cv.r,
          y: cv[key],
          name: `z = ${fmt(cv.z, 1)}`,
          mode: 'lines' as const,
          line: { color: hues[i], width: 2.4 },
          connectgaps: false,
          hovertemplate: `z = ${fmt(cv.z, 1)}<br>r = %{x:.2f}<br>%{y:.4g}<extra></extra>`,
        }));

      if (stressRef.current) {
        await Plotly.react(stressRef.current, family('sigZ', stressHues), baseLayout(theme, {
          height: 360,
          xaxis: axis(theme, 'Radial distance r  (in / mm)'),
          yaxis: gridAxis(theme, 'Vertical stress σz', logY
            ? { type: 'log' }
            : { range: [0, stressTop] }),
          hovermode: 'closest', hoverlabel: hoverLabel(theme),
          shapes: bands,
        }), plotConfig);
      }

      if (deflRef.current) {
        await Plotly.react(deflRef.current, family('w', deflHues), baseLayout(theme, {
          height: 360,
          xaxis: axis(theme, 'Radial distance r  (in / mm)'),
          yaxis: gridAxis(theme, 'Vertical deflection w', logY
            ? { type: 'log' }
            : { rangemode: 'tozero' }),
          hovermode: 'closest', hoverlabel: hoverLabel(theme),
          shapes: bands,
        }), plotConfig);
      }

      if (sweepRef.current) {
        const xs = sweepRows.map(row => row.v);
        // A sweep that spans decades is read on a log axis; one that spans a
        // Poisson ratio is not. w0 goes as 1/E, so E on log-log is a straight
        // line and the exponent is visible as its slope.
        const span = xs.length > 1 && Math.min(...xs) > 0
          ? Math.max(...xs) / Math.min(...xs) : 1;
        const logX = span >= 4;
        const ys = sweepRows.flatMap(row => [row.flexible, row.rigid])
          .filter(v => Number.isFinite(v) && v > 0);
        const logAxis = logX && ys.length > 0 && Math.max(...ys) / Math.min(...ys) >= 4;

        const traces: Record<string, unknown>[] = [{
          x: xs, y: sweepRows.map(row => row.flexible),
          name: kase === 'point' ? 'Point load' : 'Flexible plate',
          mode: 'lines+markers', line: { color: respHue, width: 2.6 },
          marker: { color: respHue, size: 8 },
          hovertemplate: `${sweepDef.label} = %{x}<br>%{y:.5g}<extra></extra>`,
        }];
        if (kase !== 'point') {
          traces.push({
            x: xs, y: sweepRows.map(row => row.rigid),
            name: 'Rigid plate',
            mode: 'lines+markers',
            line: { color: respHue, width: 2.2, dash: 'dash' },
            marker: { color: respHue, size: 7, symbol: 'diamond' },
            hovertemplate: `${sweepDef.label} = %{x}<br>%{y:.5g}<extra></extra>`,
          });
        }

        await Plotly.react(sweepRef.current, traces, baseLayout(theme, {
          height: 320,
          xaxis: axis(theme, sweepDef.label, logX ? { type: 'log' } : {}),
          // On a log axis Plotly's default minor labels come out as bare
          // mantissas — "8", "6", "4" under a "0.1" — which reads as a
          // different quantity. `~g` prints the value itself.
          yaxis: gridAxis(theme, respLabel[activeResp], logAxis
            ? { type: 'log', tickformat: '~g', nticks: 8 }
            : { rangemode: 'tozero' }),
          hovermode: 'closest', hoverlabel: hoverLabel(theme),
        }), plotConfig);
      }
    })();
    return () => { dead = true; };
  }, [curves, sweepRows, theme, logY, stressTop, kase, base.a, spacing, superposed,
      activeResp, sweepDef.label, respHue]);

  /* ── Headline numbers ────────────────────────────────────────────────── */

  const totalLoad = kase === 'point' ? base.P : base.q * Math.PI * base.a * base.a;
  const w0Flexible = valid && isCircular(kase)
    ? (oneLayerResponse(0, 0, base.q, base.a, base.E, base.nu)?.w ?? NaN)
    : NaN;
  const w0Rigid = valid && isCircular(kase)
    ? rigidPlateDeflection(base.q, base.a, base.E, base.nu)
    : NaN;

  const def = CASES[kase];

  return (
    <div className="cee-tool">
      <aside className="cee-panel">
        <h2 className="cee-panel__title">Half-space</h2>
        <div className="cee-presets">
          {PRESETS.map(x => (
            <button key={x.label} type="button"
              className={`cee-chip${p.label === x.label ? ' is-active' : ''}`}
              title={x.tip} onClick={() => apply(x)}>{x.label}</button>
          ))}
        </div>

        <div className="cee-field">
          <span className="cee-field__label">
            <span>Load type<Tip text="Boussinesq's own problem is a point load; the circular load is that solution integrated over a disc. Everything on the right — inputs, equations, figure and curves — follows this switch, so the tool is never showing one case's equations over another case's numbers." /></span>
          </span>
          <div className="cee-seg">
            <button type="button" className={kase === 'point' ? 'is-active' : ''}
              onClick={() => setKase('point')}>Point load</button>
            <button type="button" className={isCircular(kase) ? 'is-active' : ''}
              onClick={() => setKase(kase === 'point' ? 'flexible' : kase)}>Circular load</button>
          </div>
        </div>

        {isCircular(kase) && (
          <div className="cee-field">
            <span className="cee-field__label">
              <span>Plate<Tip text="A tire is a flexible plate: it fixes the PRESSURE and the surface dishes. A plate bearing test is rigid: it fixes the DEFLECTION and the pressure runs to infinity at the rim (Eq. 2.9). Same half-space, opposite boundary condition." /></span>
            </span>
            <div className="cee-seg">
              <button type="button" className={kase === 'flexible' ? 'is-active' : ''}
                onClick={() => setKase('flexible')}>Flexible</button>
              <button type="button" className={kase === 'rigid' ? 'is-active' : ''}
                onClick={() => setKase('rigid')}>Rigid</button>
            </div>
          </div>
        )}

        {kase === 'point' ? (
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="ol-p">
              <span>Load P<Tip text="The whole wheel load, concentrated at a point. σz on the axis is 0.4775 P/z² — no modulus, no Poisson ratio, no contact area." /></span>
              <span className="cee-field__unit">lb / N</span>
            </label>
            <input id="ol-p" className="cee-input" type="number" step="500" value={PStr}
              onChange={e => setPLoad(e.target.value)} />
          </div>
        ) : (
          <div className="cee-row">
            <div className="cee-field">
              <label className="cee-field__label" htmlFor="ol-q">
                <span>Pressure q<Tip text="Uniform contact pressure for a flexible plate; the AVERAGE pressure — total load over plate area — for a rigid one, which is how Huang defines it under Eq. 2.9." /></span>
                <span className="cee-field__unit">psi / kPa</span>
              </label>
              <input id="ol-q" className="cee-input" type="number" step="5" value={qStr}
                onChange={e => setQ(e.target.value)} />
            </div>
            <div className="cee-field">
              <label className="cee-field__label" htmlFor="ol-a">
                <span>Radius a<Tip text="Contact radius. For a tire, a = √(P/πq) from the wheel load and inflation pressure; for a plate test it is half the plate diameter." /></span>
                <span className="cee-field__unit">in / mm</span>
              </label>
              <input id="ol-a" className="cee-input" type="number" step="0.5" min="0.01" value={aStr}
                onChange={e => setA(e.target.value)} />
            </div>
          </div>
        )}

        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="ol-e">
              <span>Modulus E<Tip text="Elastic modulus of the half-space. σz does not depend on it, as Huang notes under Eq. 2.3, but every strain and deflection does — inversely, so doubling E halves w." /></span>
              <span className="cee-field__unit">psi / kPa</span>
            </label>
            <input id="ol-e" className="cee-input" type="number" step="1000" min="1" value={EStr}
              onChange={e => setE(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="ol-nu">
              <span>Poisson ν<Tip text="Foster and Ahlvin drew every chart in §2.1.1 at ν = 0.5. Drop to 0.3 and the radial stress under the center turns tensile, which is the point of Example 2.2." /></span>
              <span className="cee-field__unit">0 – 0.499</span>
            </label>
            <input id="ol-nu" className="cee-input" type="number" step="0.05" min="0" max="0.499"
              value={nuStr} onChange={e => setNu(e.target.value)} />
          </div>
        </div>

        <p className="cee-hint">
          {kase === 'point'
            ? <>Total load <strong>{fmt(base.P, 0)}</strong>. Spread over a 6-in radius this would be
              a contact pressure of {fmt(base.P / (Math.PI * 36), 1)}.</>
            : <>Diameter 2a = <strong>{fmt(2 * base.a, 2)}</strong> · total load
              P = πa²q = <strong>{fmt(totalLoad, 0)}</strong>
              {kase === 'rigid' && <> · pressure at the plate center {fmt(base.q / 2, 2)}</>}</>}
        </p>

        <h2 className="cee-panel__title cee-panel__group">Curves</h2>
        <div className="cee-field">
          <label className="cee-field__label" htmlFor="ol-depths">
            <span>Depths z<Tip text="One curve per depth, colored along an ordered ramp. Six at most: past that the ramp stops separating them. z = 0 is the surface — for a circular load that curve is the contact pressure itself." /></span>
            <span className="cee-field__unit">comma separated</span>
          </label>
          <input id="ol-depths" className="cee-input" type="text" value={depthStr}
            onChange={e => setDepths(e.target.value)} />
        </div>
        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="ol-rmax">
              <span>Max radius<Tip text="How far out to draw. The stress bulb has no edge, so there is always something out there — it just gets small." /></span>
              <span className="cee-field__unit">in / mm</span>
            </label>
            <input id="ol-rmax" className="cee-input" type="number" step="6" min="1" value={rMaxStr}
              onChange={e => setRMax(e.target.value)} />
          </div>
          <div className="cee-field">
            <span className="cee-field__label">
              <span>Y scale<Tip text="Linear reads the magnitudes; log reads the decay. Both quantities here are positive everywhere, so a log axis is safe." /></span>
            </span>
            <div className="cee-seg">
              <button type="button" className={!logY ? 'is-active' : ''}
                onClick={() => setLogY(false)}>Linear</button>
              <button type="button" className={logY ? 'is-active' : ''}
                onClick={() => setLogY(true)}>Log</button>
            </div>
          </div>
        </div>

        <h2 className="cee-panel__title cee-panel__group">Point</h2>
        <div className="cee-row">
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="ol-r">
              <span>Radius r<Tip text="Horizontal distance from the load axis. Off the axis the shear stress is non-zero and the principal directions rotate, which is why Huang has charts here instead of equations." /></span>
              <span className="cee-field__unit">in / mm</span>
            </label>
            <input id="ol-r" className="cee-input" type="number" step="1" min="0" value={rStr}
              onChange={e => setR(e.target.value)} />
          </div>
          <div className="cee-field">
            <label className="cee-field__label" htmlFor="ol-z">
              <span>Depth z<Tip text="Depth below the surface." /></span>
              <span className="cee-field__unit">in / mm</span>
            </label>
            <input id="ol-z" className="cee-input" type="number" step="1" min="0" value={zStr}
              onChange={e => setZ(e.target.value)} />
          </div>
        </div>

        {kase === 'flexible' && (
          <>
            <div className="cee-field">
              <label className="cee-check">
                <input type="checkbox" checked={twin} onChange={e => setTwin(e.target.checked)} />
                <span>Second circle<Tip text="Example 2.1 superposes two circular loads. Legitimate because the half-space is linear elastic, but the stresses must be rotated into a common frame before they are added, not summed component by component." /></span>
              </label>
            </div>
            {twin && (
              <div className="cee-field">
                <label className="cee-field__label" htmlFor="ol-sp">
                  <span>Center spacing</span>
                  <span className="cee-field__unit">in / mm</span>
                </label>
                <input id="ol-sp" className="cee-input" type="number" step="1" min="0" value={spStr}
                  onChange={e => setSp(e.target.value)} />
              </div>
            )}
          </>
        )}

        <h2 className="cee-panel__title cee-panel__group">Parametric study</h2>
        <div className="cee-field">
          <label className="cee-field__label" htmlFor="ol-sweepvar">
            <span>Vary<Tip text="Hold everything else and sweep one input. For a circular load the card answers for BOTH plates at once, which is how the classic problem is worded." /></span>
          </label>
          <select id="ol-sweepvar" className="cee-input" value={sweepVar}
            onChange={e => setSweepVar(e.target.value as SweepVar)}>
            {sweepVars.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        </div>
        <div className="cee-field">
          <label className="cee-field__label" htmlFor="ol-sweep">
            <span>Values</span>
            <span className="cee-field__unit">{sweepDef.unit}</span>
          </label>
          <input id="ol-sweep" className="cee-input" type="text" value={sweepStr}
            onChange={e => setSweep(e.target.value)} />
        </div>
        <div className="cee-field">
          <label className="cee-field__label" htmlFor="ol-resp">
            <span>Report<Tip text="w₀ is the surface deflection under the center — the answer a plate-bearing problem asks for. The other two are read at the probe point above, so they follow r and z." /></span>
          </label>
          <select id="ol-resp" className="cee-input" value={activeResp}
            onChange={e => setResp(e.target.value as Resp)}>
            {respOptions.map(o => <option key={o} value={o}>{respLabel[o]}</option>)}
          </select>
        </div>

        <p className="cee-hint">
          Huang (2004) §2.1, Eqs. 2.1–2.10, plus Boussinesq's concentrated load, which the
          chapter names but does not print. Exact off the axis as well as on it.
          Compression positive.
        </p>
      </aside>

      <div className="cee-results">
        <details className="cee-howto">
          <summary>How to use this tool</summary>
          <div className="cee-howto__body">
            <ol>
              <li><strong>Pick the case first.</strong> Point load, flexible circle, or rigid
                plate. The equations beside each chart change with it, and they are the equations
                the curves were computed from — not a general reference panel.</li>
              <li><strong>Read the family as a parametric study.</strong> Each curve is one depth.
                Change q, a, E or ν and watch the whole family move; the shape tells you which
                inputs matter where. σz does not move at all when you change E, which is
                Huang's remark under Eq. 2.3 made visible.</li>
              <li><strong>Then answer the actual question.</strong> The parametric card at the
                bottom sweeps one input over a list of values and reports one number for each —
                for a circular load, on both plates at once, because that is how the question is
                usually worded ("assuming both flexible and rigid plates").</li>
              <li><strong>The probe point is the exact answer.</strong> r and z above give the
                full tensor, its principal values and the strains, including off the axis where
                τrz is non-zero and σz is not a principal stress. That is what Problem 2.1
                asks for.</li>
              <li><strong>Watch ν.</strong> σz is independent of it. σr is not: at ν = 0.5 the
                radial stress under the center stays compressive at every depth, and at ν = 0.3
                it turns tensile below about z/a = 1.5.</li>
            </ol>
            Reproduces Examples 2.1, 2.2 and 2.3. For Problem 2.1 it reports 0.228q, 0.0108q and
            0.0092q where the book prints 0.221, 0.011 and 0.004; both this module and the
            independent n-layer solver agree on the computed values, so the difference is the
            table read Huang worked from.
          </div>
        </details>

        {!valid || !point ? (
          <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>
            {kase === 'point'
              ? 'Enter a non-zero load and a positive modulus. A point load has no value at the origin, so the probe cannot sit at r = 0, z = 0.'
              : 'Enter a positive radius, modulus and pressure.'}
          </span></p>
        ) : (
          <>
            <KpiStrip>
              {isCircular(kase) ? (
                <Kpi accent label={`w₀, ${kase} plate`} value={fmt(kase === 'rigid' ? w0Rigid : w0Flexible, 4)}
                  tip={kase === 'rigid'
                    ? 'Eq. 2.10. The plate settles as a unit, so this is the deflection everywhere under it.'
                    : 'Eq. 2.8, w₀ = 2(1 − ν²)qa/E, under the center of the load.'} />
              ) : (
                <Kpi accent label={`σz on the axis at z = ${fmt(z, 1)}`}
                  value={z > 0 ? fmt(pointLoadAxisStress(z, base.P), 3) : '—'}
                  tip="0.4775 P/z². No modulus and no Poisson ratio appear in it, and it is unbounded at the surface — a point load is a singularity." />
              )}
              <Kpi label="σz at the probe" value={fmt(point.R.sigZ, 3)}
                tip="Vertical stress at (r, z). Independent of E and ν: the same number for any material." />
              <Kpi label="εz at the probe" value={fmt(point.strains.epsZ * 1e6, 0)} unit="µε"
                tip="Vertical strain, from Eq. 2.1a with all three normal stresses." />
              {isCircular(kase) ? (
                <Kpi label="The other plate" value={fmt(kase === 'rigid' ? w0Flexible : w0Rigid, 4)}
                  tip="The same load on the other boundary condition. The ratio is π/4 = 0.785 whatever the numbers, which is Huang's comparison of Eqs. 2.8 and 2.10." />
              ) : (
                <Kpi label="w at the probe" value={fmt(point.R.w, 5)}
                  tip="Vertical deflection at (r, z), from the Boussinesq closed form." />
              )}
            </KpiStrip>

            <div className="cee-card">
              <h3 className="cee-card__title">The case you are solving</h3>
              <p className="cee-card__subtitle" style={{ margin: '0 0 0.9rem' }}>
                {def.label} · {def.ref}. {def.lead}
              </p>
              <div className="cee-casecard">
                <div className="cee-casefig">
                  <CaseFigure kase={kase} theme={theme} />
                  <p className="cee-casefig__caption">{def.caption}</p>
                </div>
                <div className="cee-eqs">
                  {def.defining.map(it => (
                      <div className="cee-eq" key={it.name}>
                        <span className="cee-eq__name">{it.name}</span>
                        <div className="cee-eq__math">
                          <Equation tex={it.tex} plain={it.plain} display />
                        </div>
                        {it.note && <span className="cee-eq__note">{it.note}</span>}
                      </div>
                  ))}
                </div>
              </div>
            </div>

            {droppedSurface && (
              <p className="cee-warn cee-warn--inline">
                <span className="cee-warn__icon">⚠️</span>
                <span>
                  <strong>z = 0 has been dropped from the family.</strong> A point load is a
                  singularity: at the surface the deflection is infinite under the load and the
                  vertical stress is zero everywhere else, so there is no curve to draw. Use the
                  circular load if you want a surface profile — that is what integrating over a
                  disc is for.
                </span>
              </p>
            )}

            <div className="cee-eqrow">
              <ChartFigure
                title="Vertical stress across the radius"
                subtitle={`σz against r, one curve per depth. ${
                  kase === 'point' ? 'The dotted line is the load axis.' : 'The tinted band is the loaded circle.'}`}
                plotRef={stressRef}
                legend={curves.map((cv, i) => ({
                  label: `z = ${fmt(cv.z, 1)}`, color: stressHues[i],
                }))}
                takeaway="Vertical stress spreads sideways as it goes down: the peak under the load falls fast with depth while the curve gets wider, so a deep point feels a broad, gentle bulb rather than the sharp edge of the load."
              >
                <p>
                  <strong>The load has a sharp edge; the stress does not.</strong> Nothing goes to
                  zero at r = a, which is the whole reason superposition matters: at the depths
                  that decide a pavement, neighboring wheels are still reaching each other.
                </p>
                {kase === 'rigid' && (
                  <p>
                    The <strong>z = 0 curve is Eq. 2.9 itself</strong> — the pressure the plate
                    applies. It starts at q/2 under the center and leaves the top of the frame
                    before it reaches the rim, because the equation is unbounded there. The
                    vertical axis is scaled to the field away from the rim so the deeper curves
                    stay readable.
                  </p>
                )}
                {kase === 'point' && (
                  <p>
                    Every curve here is the same curve. σz depends only on r/z and P, so halving
                    the depth multiplies the peak by four and narrows the bulb by two — which is
                    why the family looks self-similar however you set the depths.
                  </p>
                )}
              </ChartFigure>
              <EqRail title="THE EQUATIONS PLOTTED HERE" items={def.stress} />
            </div>

            <div className="cee-eqrow">
              <ChartFigure
                title="Vertical deflection across the radius"
                subtitle={
                  kase === 'point'
                    ? 'w against r, one curve per depth.'
                    : 'w against r, one curve per depth. The z = 0 curve is the surface deflection.'}
                plotRef={deflRef}
                legend={curves.map((cv, i) => ({
                  label: `z = ${fmt(cv.z, 1)}`, color: deflHues[i],
                }))}
                takeaway={kase === 'rigid'
                  ? 'The deflection under a rigid plate is flat: the same at the center as at the rim, which is the definition of the plate being rigid and the reason its settlement is only 79% of a flexible plate of the same average pressure.'
                  : 'The deflection basin is far wider than the load and falls off slowly, so a deflection measured well outside the load still carries information about the material under it.'}
              >
                <p>
                  <strong>The basin is much wider than the load.</strong> That is what an FWD
                  exploits: sensors set out to 6 ft are still reading a deflection, and the shape
                  of the basin, not its depth alone, is what backcalculation reads.
                </p>
                {isCircular(kase) && (
                  <p>
                    Compare the <strong>z = 0 curve</strong> across the two plates.{' '}
                    {kase === 'rigid'
                      ? 'Here it is flat under the plate, then falls as (2w₀/π)·asin(a/r).'
                      : 'Here it is dished — maximum at the center and about 64% of that at the rim.'}{' '}
                    Switch the plate control and watch it change shape; the total load has not
                    moved, only the boundary condition.
                  </p>
                )}
              </ChartFigure>
              <EqRail title="THE EQUATIONS PLOTTED HERE" items={def.deflection} />
            </div>

            <div className="cee-card">
              <h3 className="cee-card__title">The state at the probe point</h3>
              <div className="cee-tablewrap">
                <table className="cee-table">
                  <thead>
                    <tr><th>Component</th><th>Stress</th><th>Strain (µε)</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>Vertical σz</td><td>{fmt(point.R.sigZ, 4)}</td><td>{fmt(point.strains.epsZ * 1e6, 1)}</td></tr>
                    <tr><td>Radial σr</td><td>{fmt(point.R.sigR, 4)}</td><td>{fmt(point.strains.epsR * 1e6, 1)}</td></tr>
                    <tr><td>Tangential σt</td><td>{fmt(point.R.sigT, 4)}</td><td>{fmt(point.strains.epsT * 1e6, 1)}</td></tr>
                    <tr><td>Shear ΤRZ</td><td>{fmt(point.R.tauRZ, 4)}</td><td>{Number.isFinite(point.strains.gamRZ) ? fmt(point.strains.gamRZ * 1e6, 1) : '—'}</td></tr>
                    <tr className="cee-table__rule"><td>Principal σ₁</td><td>{fmt(point.principal.sig[0], 4)}</td><td>{fmt(point.principal.eps[0] * 1e6, 1)}</td></tr>
                    <tr><td>Principal σ₂</td><td>{fmt(point.principal.sig[1], 4)}</td><td>{fmt(point.principal.eps[1] * 1e6, 1)}</td></tr>
                    <tr><td>Principal σ₃</td><td>{fmt(point.principal.sig[2], 4)}</td><td>{fmt(point.principal.eps[2] * 1e6, 1)}</td></tr>
                    <tr className="cee-table__rule"><td>Deflection w</td><td colSpan={2}>{fmt(point.R.w, 5)}</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="cee-note">
                Compression is positive, so a negative stress is tension.
                {Math.abs(point.R.tauRZ) > 1e-9
                  ? ' The shear stress here is non-zero, so σz and σr are NOT principal stresses, because the principal directions have rotated out of the vertical.'
                  : ' On the axis of symmetry the shear vanishes, so σz and σr are principal and σr = σt.'}
                {kase === 'rigid' && z <= 1e-9 && r < base.a && (
                  <> This is a rigid plate, so the vertical stress in the row above is Eq. 2.9 at
                  this radius — {fmt(rigidPlatePressure(base.q, base.a, r), 2)} — not the average
                  pressure q.</>
                )}
                {kase === 'point' && (
                  <> A point load carries no length scale, so every number here scales with P and,
                  for the displacements, with 1/E.</>
                )}
              </p>
            </div>

            <div className="cee-card">
              <h3 className="cee-card__title">Parametric study</h3>
              <p className="cee-card__subtitle" style={{ margin: '0 0 0.9rem' }}>
                {respLabel[activeResp]} against {sweepDef.label.toLowerCase()}
                {kase === 'point'
                  ? '.'
                  : ', on both plates. The rigid answer is π/4 = 0.785 of the flexible one whenever the response is w₀, whatever the other numbers.'}
              </p>
              {sweepRows.length === 0 ? (
                <p className="cee-hint">Type a comma-separated list of values in the panel.</p>
              ) : (
                <>
                  <div className="cee-figure__plot cee-animate-in" ref={sweepRef} role="img"
                    aria-label={`${respLabel[activeResp]} against ${sweepDef.label}`} />
                  <ul className="cee-legend cee-legend--center">
                    <li className="cee-legend__item">
                      <span className="cee-legend__mark cee-legend__mark--dot"
                        style={{ background: respHue, borderColor: respHue }} aria-hidden="true" />
                      <span className="cee-legend__label">
                        {kase === 'point' ? 'Point load' : 'Flexible plate'}
                      </span>
                    </li>
                    {kase !== 'point' && (
                      <li className="cee-legend__item">
                        <span className="cee-legend__mark cee-legend__mark--dash"
                          style={{ background: respHue, borderColor: respHue }} aria-hidden="true" />
                        <span className="cee-legend__label">Rigid plate</span>
                      </li>
                    )}
                  </ul>
                  <div className="cee-tablewrap" style={{ marginTop: '1rem' }}>
                    <table className="cee-table">
                      <thead>
                        <tr>
                          <th>{sweepDef.label}</th>
                          <th>{kase === 'point' ? respLabel[activeResp] : 'Flexible plate'}</th>
                          {kase !== 'point' && <th>Rigid plate</th>}
                          {kase !== 'point' && <th>Rigid / flexible</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {sweepRows.map(row => (
                          <tr key={row.v}>
                            <td>{fmt(row.v, sweepVar === 'nu' ? 3 : 2)}</td>
                            <td>{fmt(row.flexible, 5)}</td>
                            {kase !== 'point' && <td>{fmt(row.rigid, 5)}</td>}
                            {kase !== 'point' && (
                              <td>{Number.isFinite(row.rigid / row.flexible)
                                ? (row.rigid / row.flexible).toFixed(3) : '—'}</td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              <p className="cee-note">
                Everything not being swept is held at the value in the panel. Deflections go as
                1/E exactly, so a sweep of E on log–log axes is a straight line of slope −1;
                anything else means the response you picked is not a deflection.
              </p>
            </div>

            <p className="cee-note">
              Huang (2004) §2.1. On the axis this is Eqs. 2.2–2.6 exactly; off it, the Hankel
              integrals those charts were built from, so intermediate values are computed rather
              than interpolated between drawn curves. The half-space is linear elastic,
              homogeneous, isotropic and weightless; see §2.1.3 for what the nonlinearity of a
              real granular soil does to these numbers.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
