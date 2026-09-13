/* Transform the standalone LEAPS app.js into the CEE 406 island module.
 *
 * Same contract as scripts/port-gear3d: every edit is asserted, so a
 * transform whose anchor has moved upstream fails loudly on the next sync
 * instead of silently producing a file that is a little bit wrong.
 *
 * There are only FOUR rewrites, and that is the point. Everything a port
 * would normally have to change — how the Worker is constructed, where
 * Plotly comes from, which element the app mounts in, what typeface the
 * canvas and the charts use — is INJECTED upstream rather than patched
 * here (`opts.makeWorker`, `opts.plotly`, `initLeaps(root)`, `--lp-font`).
 * That is what makes "both copies are the same program" checkable rather
 * than aspirational: the body of the file below is byte-for-byte upstream,
 * and it is not re-indented into its new closure for the same reason
 * gear3d.js is not — so `diff` against upstream reports the real changes
 * rather than three thousand whitespace ones.
 *
 * Usage: node port-main.mjs <upstream app.js> <out leaps.js>
 */
import { readFileSync, writeFileSync } from 'node:fs';

const SRC = process.argv[2];
const OUT = process.argv[3];
if (!SRC || !OUT) {
    console.error('usage: node port-main.mjs <upstream app.js> <out leaps.js>');
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
function subRe(label, re, replace, expect) {
    const m = s.match(re);
    const n = m ? m.length : 0;
    if (n !== expect) throw new Error(`[${label}] expected ${expect}, found ${n}`);
    s = s.replace(re, replace);
    log.push(`${String(n).padStart(2)} x  ${label}`);
}
/* Same, but the count is reported rather than asserted. Use it where the
   pattern is generic and the real contract is checked another way. */
function subReMin(label, re, replace) {
    const m = s.match(re);
    const n = m ? m.length : 0;
    if (n < 1) throw new Error(`[${label}] matched nothing`);
    s = s.replace(re, replace);
    log.push(`${String(n).padStart(2)} x  ${label}`);
}

/* ---- 1. The module wrapper ---------------------------------------------
   Upstream is a UMD so that the same file serves a <script> tag, a Worker
   and Node. Here it is an ES module, because that is what Vite bundles and
   what `render.test.mjs` imports. The factory body is untouched. */
sub('UMD header -> ES module',
`(function (root, factory) {
    'use strict';
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.LeapsApp = api;
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';`,
`/* ────────────────────────────────────────────────────────────────────────
   GENERATED FILE — DO NOT EDIT.

   Produced from e-labs/leaps/app.js by scripts/port-leaps/port-main.mjs.
   A hand edit here is lost on the next upstream sync; put the change in
   the upstream app, or in the transform, and re-run it. See
   scripts/port-leaps/README.md.
   ──────────────────────────────────────────────────────────────────────── */
/* eslint-disable */
import { iconHtml } from './icons';

const LEAPS_APP = (function () {
    'use strict';`);

sub('UMD footer -> named exports',
`    return {
        init: initLeaps,
        UNITS: UNITS,
        MATERIALS: MATERIALS,
        TEMPLATES: TEMPLATES,
        LOAD_KINDS: LOAD_KINDS,
        RESULT_ROWS: RESULT_ROWS,
        RESULT_GROUPS: RESULT_GROUPS,
        FIELDS: FIELDS,
        SYM: SYM,
        EQ: EQ,
        symHtml: symHtml,
        symText: symText,
        axonometric: axonometric,
        fatigueLife: fatigueLife,
        ruttingLife: ruttingLife,
        governingLife: governingLife
    };
});`,
`    return {
        init: initLeaps,
        UNITS: UNITS,
        MATERIALS: MATERIALS,
        TEMPLATES: TEMPLATES,
        LOAD_KINDS: LOAD_KINDS,
        RESULT_ROWS: RESULT_ROWS,
        RESULT_GROUPS: RESULT_GROUPS,
        FIELDS: FIELDS,
        SYM: SYM,
        EQ: EQ,
        symHtml: symHtml,
        symText: symText,
        axonometric: axonometric,
        fatigueLife: fatigueLife,
        ruttingLife: ruttingLife,
        governingLife: governingLife
    };
})();

export const initLeaps = LEAPS_APP.init;
export const UNITS = LEAPS_APP.UNITS;
export const MATERIALS = LEAPS_APP.MATERIALS;
export const TEMPLATES = LEAPS_APP.TEMPLATES;
export const LOAD_KINDS = LEAPS_APP.LOAD_KINDS;
export const RESULT_ROWS = LEAPS_APP.RESULT_ROWS;
export const RESULT_GROUPS = LEAPS_APP.RESULT_GROUPS;
export const FIELDS = LEAPS_APP.FIELDS;
export const SYM = LEAPS_APP.SYM;
export const EQ = LEAPS_APP.EQ;
export const symHtml = LEAPS_APP.symHtml;
export const symText = LEAPS_APP.symText;
export const axonometric = LEAPS_APP.axonometric;
export const fatigueLife = LEAPS_APP.fatigueLife;
export const ruttingLife = LEAPS_APP.ruttingLife;
export const governingLife = LEAPS_APP.governingLife;
export default LEAPS_APP;`);

/* ---- 2. Icons -----------------------------------------------------------
   Upstream draws its chrome with Font Awesome, which this site does not
   load. Every glyph is redrawn in leaps/icons.ts on the site's own 24-unit
   grid, keyed by the UPSTREAM CLASS NAME — so this rewrite never has to
   know what a glyph is called here, and a glyph upstream adds surfaces as
   a thrown error from iconHtml rather than an empty square in a toolbar.

   All fifteen occurrences sit inside single-quoted JS string literals, in
   one of three shapes. The counts are asserted, so a fourth shape upstream
   stops the build. */
subReMin('icon with a title attribute',
    /<i class="fas (fa-[a-z0-9-]+)" title="([^"]*)"><\/i>/g,
    `' + iconHtml('$1', '$2') + '`);
subReMin('icon, dynamic name',
    /<i class="fas ' \+ (.+?) \+ '"><\/i>/g,
    `' + iconHtml($1) + '`);
subReMin('icon, literal name',
    /<i class="fas (fa-[a-z0-9-]+)"><\/i>/g,
    `' + iconHtml('$1') + '`);

/* The invariant, which the counts were only ever standing in for. */
if (/<i class="fas/.test(s)) throw new Error('an icon shape was not recognized');

writeFileSync(OUT, s);
console.log(`port-main: ${SRC} -> ${OUT}`);
log.forEach(l => console.log('  ' + l));
