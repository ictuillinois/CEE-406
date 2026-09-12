/* Transform the standalone LEAPS stylesheet into the CEE 406 island one.
 *
 * Same contract as port-main.mjs: every edit asserted, no silent drift.
 *
 * Three things change and nothing else:
 *
 *   1. THE PALETTE IS THE COURSE PALETTE, and the THEMES ARE INVERTED.
 *      Upstream is teal-on-slate and DARK-FIRST, with a `[data-theme="light"]`
 *      override. This site is Illini orange on navy and LIGHT-FIRST — the
 *      house rule is that the complete light palette lives on the bare
 *      selector and only the dark tokens are redefined, so a page rendered
 *      before the theme attribute lands is light rather than a dark flash.
 *      Both blocks are replaced wholesale rather than patched token by
 *      token, so a token added upstream fails the match instead of
 *      arriving half re-skinned.
 *
 *   2. THE LAYOUT OPT-OUT. `.cee-tool` is a 20rem-rail-plus-results grid;
 *      LEAPS is a three-column workspace with its own dock, so it opts out
 *      of that grid while keeping its tokens — exactly what
 *      cross-section-studio does with `.xs-tool`.
 *
 *   3. GLYPH SIZING. Upstream sizes Font Awesome; the port draws its own
 *      strokes, which need the one rule every other island uses.
 *
 * The `.lp-page` rules — the standalone page's own header and about strip —
 * are left in place deliberately. They are forty lines of CSS for markup
 * this island does not mount, and deleting them would be a fourth
 * transform to maintain for no rendered difference.
 *
 * Usage: node port-css.mjs <upstream styles.css> <out leaps.css>
 */
import { readFileSync, writeFileSync } from 'node:fs';

const SRC = process.argv[2];
const OUT = process.argv[3];
if (!SRC || !OUT) {
    console.error('usage: node port-css.mjs <upstream styles.css> <out leaps.css>');
    process.exit(2);
}

let s = readFileSync(SRC, 'utf8').split(String.fromCharCode(13)).join('');
const log = [];

function sub(label, find, replace, expect = 1) {
    const n = s.split(find).length - 1;
    if (n !== expect) throw new Error(`[${label}] expected ${expect} match(es), found ${n}`);
    s = s.split(find).join(replace);
    log.push(`${String(n).padStart(2)} x  ${label}`);
}

/* ---- 1. Header --------------------------------------------------------- */
sub('header',
`/* =====================================================================
 * LEAPS: Linear Elastic Analysis of Pavement Structures
 * Workspace stylesheet. Dark-first; light theme via [data-theme="light"].
 * ===================================================================== */`,
`/* =====================================================================
 * LEAPS: Linear Elastic Analysis of Pavement Structures
 * Workspace stylesheet (CEE 406 island port).
 * Prefix: lp-
 * ---------------------------------------------------------------------
 * GENERATED FILE — DO NOT EDIT. Produced from e-labs/leaps/styles.css by
 * scripts/port-leaps/port-css.mjs. See scripts/port-leaps/README.md.
 *
 * The layout, the responsive ladder, the touch sizing and every comment
 * recording a real measurement are upstream's and are unchanged — they
 * are worth more than a rewrite. What changed is the palette and which
 * theme is the default: upstream is teal on slate and dark-first, this is
 * Illini orange on navy and light-first, so LEAPS reads as part of the
 * toolbox rather than as a transplant, and a page rendered before the
 * theme attribute lands is light rather than a dark flash.
 *
 * Tokens are declared on .lp-app, never on :root — the integration
 * contract in docs/dashboard-visual-language.md §0.1, the same rule
 * tools.css follows for --cee-* and crosssection.css for --xs-*.
 * ===================================================================== */

/* LEAPS is a three-column workspace with its own results dock, not the
   20rem-rail-plus-results grid every ordinary tool uses, so it opts out of
   .cee-tool's layout while keeping its tokens (the how-to panel and the
   notes around it need them). Two classes beat the one-class media query
   in tools.css outright.

   The class is 'lp-shell', NOT 'lp-tool', and that is not a naming
   preference. Upstream already spends '.lp-tool' on the little icon
   buttons in every toolbar, and that rule carries 'height: 2.1em'. A
   wrapper wearing the same name inherited it: the island root was pinned
   to 28.55px, its 1,480px of content spilled out of the flow, and the page
   painted the workspace straight over the site footer. Two classes beat
   one on 'display', which is why it LOOKED fine, and lost on 'height',
   which is why it was not. A port must not reuse its own prefix for both
   an app class and the shell that hosts it. */
.cee-tool.lp-shell {
    display: block;
    grid-template-columns: none;
}
.cee-tool.lp-shell > * + * { margin-top: 1.25rem; }

/* One 24-unit grid at 1.75 weight, the same hand as Icon.astro. Sized in
   em so a glyph tracks the text it sits beside. */
.lp-app .lp-i {
    display: inline-block;
    flex: none;
    width: 1.05em;
    height: 1.05em;
    vertical-align: -0.16em;
}
.lp-app .lp-i--spin { animation: lpSpin 1.1s linear infinite; }
@keyframes lpSpin { to { transform: rotate(360deg); } }

/* The island sits inside two course components — the how-to panel and one
   .cee-card of prose — and tools.css styles cards, not the paragraphs
   inside them. Every other tool's card body is a chart or a table, so
   nothing has needed this before. */
.cee-tool.lp-shell .cee-card__body > * + * { margin-top: 0.9rem; }
.cee-tool.lp-shell .cee-card__body p,
.cee-tool.lp-shell .cee-card__body li {
    margin: 0;
    font-family: var(--font-body);
    font-size: 0.875rem;
    line-height: 1.7;
    color: var(--cee-secondary);
}
.cee-tool.lp-shell .cee-card__body ul {
    margin: 0;
    padding-left: 1.15rem;
    display: grid;
    gap: 0.55rem;
}
.cee-tool.lp-shell .cee-card__body strong { color: var(--cee-ink); font-weight: 600; }
.cee-tool.lp-shell .cee-howto__body p { margin: 0.9rem 0 0; }
.cee-tool.lp-shell .cee-howto__body h4 {
    margin: 1.4rem 0 0.35rem;
    font-size: 0.8125rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--cee-secondary);
}

/* The how-to panel and the link to the manual, on one row. They are two
   different questions - how to drive the tool, and what the engine does -
   so the manual is a sibling of the panel rather than a line buried inside
   it. The button is the height of the CLOSED summary bar and stays at the
   top when the panel opens, which is what 'flex-start' is for.

   The names are 'lp-shell-*', in the shell's own namespace and not the
   app's: see the note above about what happened the last time a wrapper
   wore a class the app had already spent. */
.cee-tool.lp-shell .lp-shell-help {
    display: flex;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 0.75rem;
}
.cee-tool.lp-shell .lp-shell-help > .cee-howto { flex: 1 1 22rem; }
.cee-tool.lp-shell .lp-shell-help > * + * { margin-top: 0; }
.cee-tool.lp-shell .lp-shell-docs {
    flex: none;
    /* The same padding and the same type as '.cee-howto summary', so the two
       bars are the same height BY CONSTRUCTION rather than by a number that
       stops being right the first time either font changes. */
    padding: 1rem 1.25rem;
    font-family: var(--font-heading);
    font-size: 1.0625rem;
    letter-spacing: -0.01em;
    border-radius: var(--cee-radius-card);
    text-decoration: none;
    white-space: nowrap;
}`);

/* ---- 2. The palette, and the theme inversion --------------------------- */
sub('light palette on the bare selector',
`.LeapsApp,
.lp-app {
    --lp-bg0: #0a111f;      /* viewport void            */
    --lp-bg1: #0f1829;      /* panels                   */
    --lp-bg2: #16223a;      /* cards, inputs            */
    --lp-bg3: #1d2c49;      /* hover targets            */
    --lp-line: #24344f;
    --lp-line-soft: #1b2941;
    --lp-ink: #e8eef9;
    --lp-ink2: #93a5c4;
    --lp-ink3: #5f7396;
    --lp-accent: #22d3d1;
    --lp-accent-deep: #0d9488;
    --lp-indigo: #6366f1;
    --lp-warn: #d97706;
    --lp-danger: #e05252;
    --lp-ok: #34d399;
    --lp-cat1: #0d9488;     /* validated categorical set (dark) */
    --lp-cat2: #6366f1;
    --lp-cat3: #d97706;
    --lp-cat4: #db2777;
    --lp-shadow: 0 10px 30px rgba(2, 6, 16, 0.55);
    --lp-radius: 10px;
    --lp-mono: ui-monospace, "Cascadia Code", Consolas, "SF Mono", Menlo, monospace;
    --lp-font: "Source Sans Pro", Helvetica, Arial, sans-serif;

    /* the key-response cards, and only them */
    --lp-key-bg: #13233c;
    --lp-key-bg-lead: #143140;
    --lp-key-line: #27405e;
}`,
`.lp-app {
    --lp-bg0: #eceff4;      /* viewport void            */
    --lp-bg1: #ffffff;      /* panels                   */
    --lp-bg2: #f2f4f5;      /* cards, inputs            */
    --lp-bg3: #e7eaee;      /* hover targets            */
    --lp-line: #dfe3e8;
    --lp-line-soft: #ecedef;
    --lp-ink: #1a1a2e;
    --lp-ink2: #5b6670;
    --lp-ink3: #7a8590;
    --lp-accent: #e87722;   /* Illini Orange            */
    --lp-accent-deep: #c2500f;
    --lp-indigo: #1b2d4a;   /* the course navy, for the brand gradients */
    --lp-warn: #b45309;
    --lp-danger: #e5484d;
    --lp-ok: #12b76a;
    /* The categorical set of docs/chart-standards.md §B4, light surface:
       stress -> orange, strain -> blue, deflection -> emerald, damage ->
       violet. The section viewport and the dock charts share it, so a
       curve and a mark of the same quantity are the same color. */
    --lp-cat1: #e87722;
    --lp-cat2: #3b9bf0;
    --lp-cat3: #14b489;
    --lp-cat4: #8b5cf6;
    --lp-shadow: 0 8px 24px rgba(16, 24, 40, 0.1);
    --lp-radius: 10px;
    --lp-mono: var(--font-mono, ui-monospace, "IBM Plex Mono", Consolas, monospace);
    --lp-font: var(--font-body, "IBM Plex Sans", system-ui, sans-serif);

    /* The key-response cards, and only them. Everything else in the right
       rail is panel-colored, so a filled card in a rail of unfilled ones
       is the whole signal that these five are the numbers a decision gets
       made on. A brand wash rather than a second neutral: they have to
       read as a different KIND of thing, not a slightly different shade
       of the same one. */
    --lp-key-bg: #fdf6f0;
    --lp-key-bg-lead: #fceede;
    --lp-key-line: #f0dcc6;
}`);

sub('dark palette on the theme override',
`[data-theme="light"] .LeapsApp,
[data-theme="light"] .lp-app {
    --lp-bg0: #e8ecf3;
    --lp-bg1: #ffffff;
    --lp-bg2: #f2f5fa;
    --lp-bg3: #e7edf6;
    --lp-line: #d7dfeb;
    --lp-line-soft: #e4eaf3;
    --lp-ink: #17253c;
    --lp-ink2: #51637f;
    --lp-ink3: #8195b1;
    --lp-accent: #0d9488;
    --lp-accent-deep: #0d9488;
    --lp-cat1: #0d9488;     /* validated categorical set (light) */
    --lp-cat2: #4f46e5;
    --lp-cat3: #b45309;
    --lp-cat4: #be185d;
    --lp-shadow: 0 10px 26px rgba(23, 37, 60, 0.12);

    --lp-key-bg: #eef6f5;
    --lp-key-bg-lead: #e3f2f0;
    --lp-key-line: #c9e2de;
}`,
`[data-theme="dark"] .lp-app {
    --lp-bg0: #0b1424;
    --lp-bg1: #0f1a2e;
    --lp-bg2: #162033;
    --lp-bg3: #1b2740;
    --lp-line: #2d3f59;
    --lp-line-soft: #1e2b42;
    --lp-ink: #f1f5f9;
    --lp-ink2: #9ba4ac;
    /* 8293a1, not the 7c8ca5 tools.css uses for --cee-muted: the raised
       navy under these panels is lighter than the page, and the lighter
       token is what clears AA on a secondary label sitting on it. The
       same correction gear3d needed after its re-skin. */
    --lp-ink3: #8293a1;
    --lp-accent: #f0913f;
    --lp-accent-deep: #e87722;
    --lp-indigo: #2d3f59;
    --lp-warn: #f59e0b;
    --lp-danger: #ef6a6e;
    --lp-ok: #2fc79c;
    --lp-cat1: #f0913f;     /* §B4, dark surface */
    --lp-cat2: #5aaef5;
    --lp-cat3: #2fc79c;
    --lp-cat4: #a78bfa;
    --lp-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);

    --lp-key-bg: #1c2639;
    --lp-key-bg-lead: #2a2a37;
    --lp-key-line: #34455f;
}`);

writeFileSync(OUT, s);
console.log(`port-css: ${SRC} -> ${OUT}`);
log.forEach(l => console.log('  ' + l));
