/* Lift the LEAPS workspace markup out of the standalone page.
 *
 * The island's DOM is not hand-written as JSX, the way Cross-Section
 * Studio's is. It is GENERATED from the same index.html the standalone app
 * uses, because the app drives that DOM imperatively by id, and two
 * hand-maintained copies of forty ids is a bug waiting for the first
 * upstream change. React never owns this subtree — `LeapsApp.tsx` hands it
 * to `dangerouslySetInnerHTML` once and `initLeaps` takes it from there —
 * so generating it costs nothing and buys the guarantee that both copies of
 * LEAPS are the same program.
 *
 * Usage: node port-markup.mjs <upstream index.html> <out markup.ts>
 */
import { readFileSync, writeFileSync } from 'node:fs';

const SRC = process.argv[2];
const OUT = process.argv[3];
if (!SRC || !OUT) {
    console.error('usage: node port-markup.mjs <upstream index.html> <out markup.ts>');
    process.exit(2);
}

const html = readFileSync(SRC, 'utf8').split(String.fromCharCode(13)).join('');

/* ---- 1. The block ------------------------------------------------------ */
const START = '<!-- LEAPS:APP:START -->\n';
const END = '<!-- LEAPS:APP:END -->';
const i = html.indexOf(START);
const j = html.indexOf(END);
if (i < 0 || j < 0 || j < i) throw new Error('LEAPS:APP markers not found in ' + SRC);
let s = html.slice(i + START.length, j).replace(/\s+$/, '');

/* ---- 2. Icons ----------------------------------------------------------
   Same rule as port-main.mjs: the upstream class name is the key. The
   spinner is the one glyph with a second class on it, and it keeps a
   modifier so the stylesheet can still turn it. */
let counts = { spin: 0, plain: 0 };
s = s.replace(/<i class="fas fa-circle-notch fa-spin"><\/i>/g, () => {
    counts.spin++;
    return '__ICON__(fa-circle-notch|spin)';
});
s = s.replace(/<i class="fas (fa-[a-z0-9-]+)"><\/i>/g, (_, name) => {
    counts.plain++;
    return `__ICON__(${name}|)`;
});
if (counts.spin !== 1) throw new Error(`expected 1 spinner, found ${counts.spin}`);
if (counts.plain < 30) throw new Error(`only ${counts.plain} glyphs found — markers probably moved`);
if (/<i class="fas/.test(s)) throw new Error('an icon shape was not recognized');

/* ---- 3. Nothing may break out of a template literal -------------------- */
for (const bad of ['`', '${', '\\']) {
    if (s.includes(bad)) throw new Error(`markup contains ${JSON.stringify(bad)}, which a template literal cannot carry verbatim`);
}

/* ---- 4. Emit ----------------------------------------------------------- */
const body = s
    .split('__ICON__(')
    .map((chunk, k) => {
        if (k === 0) return chunk;
        const close = chunk.indexOf(')');
        const [name, mod] = chunk.slice(0, close).split('|');
        const call = mod ? `\${iconHtml('${name}', undefined, '${mod}')}` : `\${iconHtml('${name}')}`;
        return call + chunk.slice(close + 1);
    })
    .join('');

writeFileSync(OUT, `/* ────────────────────────────────────────────────────────────────────────
   GENERATED FILE — DO NOT EDIT.

   Lifted from e-labs/leaps/index.html by scripts/port-leaps/port-markup.mjs,
   between the LEAPS:APP markers, with Font Awesome swapped for this site's
   own strokes. The standalone page and this island therefore mount exactly
   the same DOM, which is what lets one app.js drive both.
   ──────────────────────────────────────────────────────────────────────── */
import { iconHtml } from './icons';

export const LEAPS_MARKUP = \`
${body}
\`;
`);
console.log(`port-markup: ${SRC} -> ${OUT}  (${counts.plain + counts.spin} glyphs)`);
