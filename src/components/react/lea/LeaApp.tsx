// Layered Elastic Analysis — the whole of Huang (2004) Chapter 2, in five
// modules that share one solver.
//
// The chapter is not one method but a ladder of them, and the rungs are the
// point: Boussinesq's half-space, Burmister's two layers, Jones' three, the
// general n-layer solve, and the charts that stood in for all of it before
// there were computers. A student is asked to move between them — Problem 2.7
// asks for the equivalent modulus that makes a three-layer section behave like
// a two-layer one — so they are modules of one tool rather than four tools.
//
// The charts lead the strip and are the tab a first visit opens on. They are
// the rung a student meets first in the chapter and the one that needs no
// setup: a figure is already on screen, where every other module wants a
// section typed in before it shows anything.
//
// The four solver modules are LOCKED for now — dimmed in the strip, inert,
// and still built. Which ones are open is `release.ts`'s decision, not this
// file's, so unlocking one is the same one-line edit as unlocking a tool.
// The tabs stay in the strip rather than disappearing because the ladder is
// the teaching content: a student should see that Boussinesq, Burmister and
// Jones are rungs of one thing before the rungs open.
//
// Every module computes from the same Appendix B solver, which is what lets
// them be checked against each other: two identical layers must give
// Boussinesq, two layers must give Burmister's charts, three must give Jones'
// table. All three of those are assertions in the test files.
import { useEffect, useState } from 'react';
import { moduleLock } from '../../../data/release';
import OneLayerModule from './modules/OneLayerModule';
import TwoLayerModule from './modules/TwoLayerModule';
import ThreeLayerModule from './modules/ThreeLayerModule';
import MultiLayerModule from './modules/MultiLayerModule';
import ChartsModule from './modules/ChartsModule';
import '../tools.css';

interface ModuleDef {
  id: string;
  label: string;
  /** The section of the chapter it implements. */
  ref: string;
  /** One line under the tab strip, saying what this module is for. */
  lead: string;
  render: () => React.ReactNode;
}

const MODULES: ModuleDef[] = [
  {
    id: 'charts',
    label: 'Solutions by chart',
    ref: 'Figures 2.2 – 2.31',
    lead:
      'Every empirical chart in the chapter, redrawn from the equations behind it and readable ' +
      'in both directions — including backwards, which a printed page cannot do.',
    render: () => <ChartsModule />,
  },
  {
    id: 'one',
    label: 'One layer',
    ref: '§2.1 · Boussinesq',
    lead:
      'A homogeneous half-space. The right model when the modulus ratio is near unity — a thin ' +
      'surface on a thin granular base — and the starting point for everything after it.',
    render: () => <OneLayerModule />,
  },
  {
    id: 'two',
    label: 'Two layers',
    ref: '§2.2.1 · Burmister',
    lead:
      'Burmister’s two-layer system and the five design charts built on it: interface stress, ' +
      'surface and interface deflection, critical tensile strain, and the dual-wheel conversion factor.',
    render: () => <TwoLayerModule />,
  },
  {
    id: 'three',
    label: 'Three layers',
    ref: '§2.2.2 · Jones & Peattie',
    lead:
      'The four dimensionless groups of Eq. 2.22 and the four stress factors Jones tabulated — ' +
      'continuous in k₁ and k₂, where the printed table is a grid of four values.',
    render: () => <ThreeLayerModule />,
  },
  {
    id: 'multi',
    label: 'N layers',
    ref: 'Appendix B · Hankel transform',
    lead:
      'The general solve, for any number of layers, any Poisson ratio, and dual or tandem wheels ' +
      'superposed. The same equations WinJULEA and KENLAYER solve.',
    render: () => <MultiLayerModule />,
  },
];

const STORAGE_KEY = 'cee406-lea-module';

const lockOf = (id: string) => moduleLock('lea', id);

/** Where the tool opens: the first module the course has actually reached. */
const FIRST_OPEN = MODULES.find(m => lockOf(m.id).released) ?? MODULES[0];

/* The site's lock mark, copied from Icon.astro rather than imported, because
   that is an Astro component and this is a client island. A closed shackle
   and no keyhole: the meaning is "opens later", not "forbidden". */
function LockMark() {
  return (
    <svg
      className="cee-modules__lock" width="12" height="12" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.2" />
      <path d="M8 10.5V7.75a4 4 0 0 1 8 0v2.75" />
    </svg>
  );
}

export default function LeaApp() {
  const [active, setActive] = useState(FIRST_OPEN.id);

  // Which module you were last in survives a reload, because a student
  // working through one homework returns to the same rung of the ladder —
  // unless that rung has since been locked, which is why the saved id is
  // re-checked against the gate rather than only against the module list.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && MODULES.some(m => m.id === saved) && lockOf(saved).released) {
        setActive(saved);
      }
    } catch { /* private mode, or storage disabled — the default is fine */ }
  }, []);

  const choose = (id: string) => {
    // The tabs are aria-disabled rather than `disabled`, so that their title
    // still shows on hover; a locked tab is therefore refused twice — no
    // handler is attached to it, and this returns if one ever is.
    if (!lockOf(id).released) return;
    setActive(id);
    try { localStorage.setItem(STORAGE_KEY, id); } catch { /* not worth reporting */ }
  };

  const current =
    MODULES.find(m => m.id === active && lockOf(m.id).released) ?? FIRST_OPEN;

  return (
    <div className="cee-workbench">
      <nav className="cee-modules" role="tablist" aria-label="Analysis method">
        {MODULES.map(m => {
          const lock = lockOf(m.id);
          return (
            <button
              key={m.id}
              type="button"
              role="tab"
              id={`lea-tab-${m.id}`}
              aria-selected={current.id === m.id}
              aria-controls="lea-panel"
              aria-disabled={lock.released ? undefined : true}
              tabIndex={lock.released ? undefined : -1}
              title={lock.released ? undefined : `${m.label} — ${m.ref}. ${lock.label}.`}
              className={
                `cee-modules__tab${current.id === m.id ? ' is-active' : ''}` +
                `${lock.released ? '' : ' is-locked'}`
              }
              // No handler at all on a locked tab, AND a guard inside
              // `choose`. Two barriers because neither is observable from
              // renderToString, which is the only thing that renders this
              // island in CI — the tests can see the tab is marked disabled
              // and unreachable by keyboard, but not that a click does
              // nothing, so the click path is held by construction.
              onClick={lock.released ? () => choose(m.id) : undefined}
            >
              <span className="cee-modules__label">
                {m.label}
                {!lock.released && <LockMark />}
              </span>
              <span className="cee-modules__ref">{lock.released ? m.ref : lock.label}</span>
            </button>
          );
        })}
      </nav>

      <p className="cee-modules__lead">{current.lead}</p>

      <div id="lea-panel" role="tabpanel" aria-labelledby={`lea-tab-${current.id}`}>
        {current.render()}
      </div>
    </div>
  );
}
