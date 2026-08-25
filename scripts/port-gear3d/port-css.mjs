/* Transform gear3d/styles.css into the CEE 406 island stylesheet.
   Same contract as port-main.mjs: every edit asserted, no silent drift.

   Usage: node port-css.mjs <upstream styles.css> <out gear3d.css>        */
import { readFileSync, writeFileSync } from 'node:fs';

const SRC = process.argv[2];
const OUT = process.argv[3];
let s = readFileSync(SRC, 'utf8').split(String.fromCharCode(13)).join('');
const log = [];

function sub(label, find, replace, expect = 1) {
    const n = s.split(find).length - 1;
    if (n !== expect) throw new Error(`[${label}] expected ${expect} match(es), found ${n}`);
    s = s.split(find).join(replace);
    log.push(`${String(n).padStart(2)} x  ${label}`);
}
function subRe(label, re, replace, expect) {
    const m = s.match(re);
    const n = m ? m.length : 0;
    if (n !== expect) throw new Error(`[${label}] expected ${expect}, found ${n}`);
    s = s.replace(re, replace);
    log.push(`${String(n).padStart(2)} x  ${label}`);
}

/* ---- 1. Header --------------------------------------------------------- */
sub('header',
`/* ============================================================
   Gear3D — app styles
   Prefix: g3-`,
`/* ============================================================
   Gear3D — app styles (CEE 406 island port)
   Prefix: g3-
   ------------------------------------------------------------
   Ported from the standalone E-Lab. The layout, the responsive
   ladder, the touch sizing and every comment recording a real
   measurement are unchanged — they are worth more than a rewrite.

   Three things changed, and nothing else:

     1. TOKENS MOVED OFF :root. They are declared on .g3-app and
        inherit down, per the integration contract in
        docs/dashboard-visual-language.md §0.1 — the same rule
        tools.css follows for --cee-* and crosssection.css for
        --xs-*. On :root they would repaint the course site.

     2. THE PALETTE IS THE COURSE PALETTE. Upstream is teal on
        slate; this is Illini orange on navy, so Gear3D reads as
        part of the toolbox rather than as a transplant.
        --g3-graphite is deliberately KEPT at its upstream value:
        the comments below record WCAG measurements, and it
        clears them on the new surfaces too. --g3-muted did NOT
        survive the move in the dark theme — the course's raised
        navy is lighter than upstream's slate and pushed it from
        4.53:1 to 4.46:1 — so it is lifted. See the note beside
        it, and tokens.test.mjs, which re-runs upstream's own
        contrast gate against THIS palette. Never assume a
        re-skin inherits an upstream contrast result.

     3. THE FIGURE TOKENS ARE UNTOUCHED. --g3-fig-* on .g3-viewport
        are the colours of the DRAWING, not of the app, and they
        end up in exported PNGs, SVGs and PDFs that go into
        reports. A student's figure must not change because the
        course site changed its accent colour.

   The site-button overrides kept their !important: they are
   scoped inside .g3-app, so nothing leaks outward, and they are
   what stops the host stylesheet repainting every control.`);

/* ---- 2. Tokens move off :root ------------------------------------------ */
/* Light is the BASE on .g3-app rather than a [data-theme="light"] block.
   BaseLayout stamps the attribute from an inline script, but the island can
   render for a frame before that lands, and a theme-less host would leave
   every token undefined. */
sub('tokens: :root -> .g3-app', '\n:root {\n', '\n.g3-app {\n');
sub('tokens: light -> .g3-app base', '\n[data-theme="light"] {\n', '\n.g3-app {\n');
sub('tokens: dark -> scoped', '\n[data-theme="dark"] {\n', '\n[data-theme="dark"] .g3-app {\n');

/* ---- 3. The palette ---------------------------------------------------- */
/* Accent. Upstream teal -> Illini orange, light and dark. */
sub('datum light',        '--g3-datum: #18a9a8;',        '--g3-datum: #e87722;');
sub('datum-hover light',  '--g3-datum-hover: #14908f;',  '--g3-datum-hover: #c2500f;');
sub('datum-glow light',   '--g3-datum-glow: rgba(24, 169, 168, 0.28);',
                          '--g3-datum-glow: rgba(232, 119, 34, 0.26);');
sub('datum dark',         '--g3-datum: #22d3d1;',        '--g3-datum: #f0913f;');
sub('datum-hover dark',   '--g3-datum-hover: #18a9a8;',  '--g3-datum-hover: #f6b37b;');

/* Signal. Upstream reserves this for the live measurement and the current
   selection — never decoration — so it MUST stay separable from the accent.
   Orange is now the accent, so the old instrument red-orange would read as a
   second brand colour. The course's secondary navy takes it in light, and the
   dark-mode accent blue in dark, where navy on navy is invisible. */
sub('signal light',       '--g3-signal: #c8452a;',       '--g3-signal: #1b2d4a;');
sub('signal-soft light',  '--g3-signal-soft: rgba(200, 69, 42, 0.12);',
                          '--g3-signal-soft: rgba(27, 45, 74, 0.10);');
sub('signal dark',        '--g3-signal: #e46a4a;',       '--g3-signal: #5aaef5;');
sub('signal-soft dark',   '--g3-signal-soft: rgba(228, 106, 74, 0.16);',
                          '--g3-signal-soft: rgba(90, 174, 245, 0.16);');

/* Typography inherits from the host, per §0.1's no-font-import rule. */
sub('mono font',
    `--g3-mono: ui-monospace, 'Cascadia Code', 'SF Mono', Consolas, 'Liberation Mono', monospace;`,
    `--g3-mono: var(--font-mono, ui-monospace, 'IBM Plex Mono', Consolas, monospace);`);
sub('sans font',
    `--g3-sans: ui-sans-serif, system-ui, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;`,
    `--g3-sans: var(--font-body, ui-sans-serif, system-ui, 'Segoe UI', Roboto, sans-serif);`);

/* Light surfaces -> the course's off-white stack. */
sub('ink light',        '--g3-ink: #16202b;\n    --g3-paper: #ffffff;', '--g3-ink: #1a1a2e;\n    --g3-paper: #ffffff;');
sub('surface light',    '--g3-surface: #f4f6f8;',   '--g3-surface: #f8f9fb;');
sub('surface-2 light',  '--g3-surface-2: #e9edf1;', '--g3-surface-2: #eef1f6;');
sub('inset light',      '--g3-inset: #dfe5ea;',     '--g3-inset: #e6eaf0;');
sub('rule light',       '--g3-rule: #ccd5dd;',      '--g3-rule: #dfe3e8;');
sub('rule-strong light','--g3-rule-strong: #adb9c4;', '--g3-rule-strong: #c6ccd4;');
sub('shadow light',
    '--g3-shadow: 0 1px 2px rgba(22, 32, 43, .07), 0 6px 16px rgba(22, 32, 43, .06);',
    '--g3-shadow: 0 1px 2px rgba(16, 24, 40, .05), 0 6px 16px rgba(16, 24, 40, .05);');
/* The mark tile sits on --g3-inset. Orange at full strength manages only
   4.06:1 there; this is the same hue at 5.2:1. */
sub('wordmark light', '--g3-wordmark: #107271;   /* 4.51:1 on --g3-inset, the mark tile it sits on */',
                      '--g3-wordmark: #a8440c;   /* 5.17:1 on --g3-inset, the mark tile it sits on */');

/* Dark surfaces -> the course's navy stack. */
sub('ink dark',         '--g3-ink: #e8edf2;',      '--g3-ink: #f1f5f9;');
sub('paper dark',       '--g3-paper: #0f151c;',    '--g3-paper: #0f1a2e;');
sub('surface dark',     '--g3-surface: #161e27;',  '--g3-surface: #162033;');
sub('surface-2 dark',   '--g3-surface-2: #1d2732;', '--g3-surface-2: #1b2740;');
sub('inset dark',       '--g3-inset: #121a22;',    '--g3-inset: #101b2f;');
sub('rule dark',        '--g3-rule: #2b3846;',     '--g3-rule: #2d3f59;');
sub('rule-strong dark', '--g3-rule-strong: #3d4d5e;', '--g3-rule-strong: #3c5170;');

/* The one place the re-skin FAILED the contrast gate, and the reason that gate
   was ported to tokens.test.mjs rather than assumed to still hold.

   Upstream's dark --g3-muted (#7d8f9d) is documented there as "4.53:1 at worst"
   — measured against upstream's raised surface #1d2732. The course's raised
   navy #1b2740 is lighter and bluer, and the same token lands at 4.46:1 on it:
   a real AA failure, on every secondary label in the dark theme, introduced
   purely by moving the surface underneath it. Lifted to 4.71:1, which keeps it
   a clear step below --g3-graphite (the second assertion in that file). */
sub('muted dark (re-skin regression)', '--g3-muted: #7d8f9d;', '--g3-muted: #8293a1;');

/* Ink laid ON the accent — the mark tile and the active tab in dark mode.
   Upstream this was a deep teal-black; against orange it is the course navy. */
subRe('ink-on-accent', /#06222a/g, '#0f1a2e', 4);

/* ---- 4. Site-button overrides rescope to the island -------------------- */
subRe('body.Gear3D -> .g3-app', /body\.Gear3D\b/g, '.g3-app', 34);

/* ---- 5. Font Awesome <i> -> the site's own <svg class="g3-i"> ---------- */
subRe('icon selectors', /^(\.g3-[a-z-]+(?: summary)?) i \{/gm, '$1 .g3-i {', 7);

/* ---- 6. Shell: the page owns the measure, not the app ------------------ */
sub('shell width',
`.g3-app {
    max-width: 1620px;
    margin: 0 auto;
    padding: 0 1rem 2rem;
    font-family: var(--g3-sans);
}`,
`/* Upstream this centred itself in the browser window at 1620px. Here the
   Astro page owns the measure (.tool-page--gear3d), so the app fills what it
   is given and adds no padding of its own — the container already has some. */
.g3-app {
    width: 100%;
    margin: 0 auto;
    padding: 0 0 .5rem;
    font-family: var(--g3-sans);
    color: var(--g3-ink);
}

/* Gear3D is a three-column shell — 264px rail, viewport, 288px rail — not the
   20rem-rail-plus-results grid every React tool uses, so it opts out of
   .cee-tool's layout while keeping its tokens for the how-to panel and the
   notes below. Two classes beat the one-class media query in tools.css. */
.cee-tool.g3-tool {
    display: block;
    grid-template-columns: none;
}
.cee-tool.g3-tool > * + * { margin-top: 1.25rem; }

/* One 24-unit grid at 1.75 weight, the same hand as Icon.astro. Sized in em so
   a glyph tracks the text beside it — which is also why the upstream rules
   that set \`font-size\` on an icon still size these. */
.g3-app .g3-i {
    display: inline-block;
    flex: none;
    width: 1.05em;
    height: 1.05em;
    vertical-align: -0.16em;
}`);

writeFileSync(OUT, s);
console.log(log.join('\n'));
console.log(`\n${log.length} transformations -> ${OUT}`);
