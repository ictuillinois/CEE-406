/* Transform gear3d/main.js into the CEE 406 island controller.
   Every edit is asserted: an anchor that no longer matches is a hard failure,
   so this cannot silently half-apply against a changed upstream.

   Usage: node port-main.mjs <upstream main.js> <out gear3d.js>          */
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

/* ---- 1. Engine import paths ------------------------------------------ */
subRe('import paths ./src/ -> ./engine/', /from '\.\/src\//g, "from './engine/", 26);

/* ---- 2. Header -------------------------------------------------------- */
sub('file header',
`/* ============================================================
   Gear3D — application entry point`,
`/* ============================================================
   Gear3D — application controller (CEE 406 island port)
   ------------------------------------------------------------
   Ported from the standalone E-Lab at
   johanncardenas.com/e-labs/gear3d. The substance is unchanged:
   the same data library, the same resolveLayout(), the same
   dimension engine, the same contact-patch export. Everything
   under ./engine/ is a byte-for-byte copy of the upstream src/.

   What changed for CEE 406, and nothing else:

     · the app is one \`initGear3D(root)\` closure with a disposer,
       instead of a module that boots itself and owns the page;
     · every \`document.getElementById\` / \`querySelectorAll\` is
       scoped to the island root, so nothing reaches outside the
       mount and two mounts cannot collide;
     · the data library and the CC0 textures are served from
       public/gear3d/ and addressed through BASE_URL, because a
       bundled module's import.meta.url points into _astro/;
     · Font Awesome markup is replaced by the site's own strokes.

   The body is deliberately NOT re-indented into the closure. A
   flat diff against upstream main.js is what keeps this port
   maintainable — diff reports the real changes and nothing else.
   Re-indenting would report three thousand.

   The same rule as crosssection/studio.ts applies: no React
   import in this file. React supplies the markup and calls this
   once; it is never asked to re-render a WebGL scene.
   ============================================================ */

/* ============================================================
   Gear3D — application entry point`);

/* ---- 3. Open the closure; scope $ ------------------------------------- */
sub('open initGear3D + scoped $',
`const SVG_NS = 'http://www.w3.org/2000/svg';
const $ = (id) => document.getElementById(id);`,
`import { TextureLibrary } from './engine/scene/textures.js';
import { iconHtml } from './icons';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Where the data library and the CC0 textures are served from. */
const ASSET_BASE = \`\${import.meta.env.BASE_URL}gear3d/\`;

/**
 * Boot Gear3D inside \`root\` and return a disposer.
 *
 * The disposer must run on unmount. The viewport owns a rAF loop, a
 * ResizeObserver and a WebGL context; the two keyboard maps are on
 * \`document\` because they are global shortcuts. None of them are torn down
 * by React removing the tree, and a second mount would leave two render
 * loops on one canvas.
 *
 * @param {HTMLElement} root
 * @returns {() => void}
 */
export function initGear3D(root) {

const $ = (id) => /** @type {any} */ (root.querySelector('#' + CSS.escape(id)));

/** Teardown handles, registered as they are created. */
let _disposed = false;
/** @type {[EventListener, boolean][]} */
const _docKeys = [];
/** @type {Set<any>} */
const _toastTimers = new Set();`);

/* ---- 4. Scope the nine document-level collection queries --------------- */
subRe('document.querySelectorAll -> root', /document\.querySelectorAll\(/g, 'root.querySelectorAll(', 9);

/* ---- 5. cssVar reads the island's tokens, not :root -------------------- */
sub('cssVar scope',
`    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#16202b';`,
`    // Tokens are declared on .g3-app, not :root — the integration contract in
    // docs/dashboard-visual-language.md §0.1. Reading documentElement here
    // returns '' and every selected patch falls back to the default ink.
    return getComputedStyle(root).getPropertyValue(name).trim() || '#16202b';`);

/* ---- 6. Data library base ---------------------------------------------- */
sub('data base URL',
`    const base = new URL('./src/data/', import.meta.url);`,
`    // Upstream this was \`new URL('./src/data/', import.meta.url)\`. Under Vite
    // this module is bundled into _astro/, so import.meta.url no longer sits
    // beside the data; it is served from public/gear3d/data/ instead.
    const base = new URL(\`\${ASSET_BASE}data/\`, document.baseURI);`);

/* ---- 7. Texture base ---------------------------------------------------- */
sub('texture basePath',
`    app.materials = new MaterialLibrary({ seed: DEFAULT_SEED });`,
`    app.materials = new MaterialLibrary({
        seed: DEFAULT_SEED,
        // Same reason as the data library: the CC0 maps ship in public/.
        textures: new TextureLibrary({ basePath: new URL(\`\${ASSET_BASE}textures/\`, document.baseURI).href })
    });`);

/* ---- 8. Named document keydown handlers, so they can be removed -------- */
/* `closeCatalogue` is upstream's spelling and both strings below are upstream
   text — the anchor has to match main.js byte for byte, and the replacement is
   spliced in beside code that still calls it. The American spelling is applied
   afterwards, to the whole generated file, by scripts/us-english.mjs, which
   skips this script for exactly that reason. Do not respell these by hand. */
sub('catalogue Escape handler',
`    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.hidden) { closeCatalogue(); e.stopPropagation(); }
    }, true);`,
`    const onCatalogueKey = (e) => {
        if (e.key === 'Escape' && !modal.hidden) { closeCatalogue(); e.stopPropagation(); }
    };
    document.addEventListener('keydown', onCatalogueKey, true);
    _docKeys.push([onCatalogueKey, true]);`);

sub('shortcut map handler open',
`function setupKeyboard() {
    let pendingV = false;
    document.addEventListener('keydown', (e) => {`,
`function setupKeyboard() {
    let pendingV = false;
    const onShortcut = (e) => {`);

sub('shortcut map handler close',
`        } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            saveProject();
            e.preventDefault();
        }
    });
}`,
`        } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            saveProject();
            e.preventDefault();
        }
    };
    document.addEventListener('keydown', onShortcut);
    _docKeys.push([onShortcut, false]);
}`);

/* ---- 9. Toast timers are tracked --------------------------------------- */
sub('toast timer tracking',
`    setTimeout(() => el.remove(), kind === 'info' ? 4200 : 9000);`,
`    const t = setTimeout(() => { el.remove(); _toastTimers.delete(t); }, kind === 'info' ? 4200 : 9000);
    _toastTimers.add(t);`);

/* ---- 10. boot() must lose a race with dispose() ------------------------ */
sub('boot dispose guard',
`async function boot() {
    await loadLibrary();
`,
`async function boot() {
    await loadLibrary();

    // The only await in the boot path, so the only point at which an unmount
    // can land mid-boot. Without this, a tool page navigated away from before
    // the library resolved went on to build a viewport nothing would ever
    // dispose — a leaked WebGL context and a rAF loop drawing into a detached
    // canvas.
    if (_disposed) return;
`);

/* ---- 11. Font Awesome -> the site's own strokes ------------------------ */
/* Five sit at the head of a single-quoted string, five inside a template
   literal. The context decides the form, so each is named rather than swept
   up by one regex — that would put a ${...} inside a '...' and fail silently
   at runtime instead of loudly at build. `times` appears in both contexts,
   which is why the table is keyed on the site and not on the icon.          */
const ICON_SITES = [
    [`'<i class="fas fa-info-circle"></i><span>'`,
     `iconHtml('info-circle') + '<span>'`],
    [`'<i class="fas fa-drafting-compass"></i><span>'`,
     `iconHtml('drafting-compass') + '<span>'`],
    [`del.innerHTML = '<i class="fas fa-times"></i>';`,
     `del.innerHTML = iconHtml('times');`],
    [`'<i class="fas fa-ruler-combined"></i><span>'`,
     `iconHtml('ruler-combined') + '<span>'`],
    [`iso2.innerHTML = '<i class="fas fa-crosshairs"></i>';`,
     `iso2.innerHTML = iconHtml('crosshairs');`],
    ['`<i class="fas fa-exclamation-triangle"></i>`',
     `iconHtml('exclamation-triangle')`],
    [`<i class="fas fa-check"></i>`, '${' + `iconHtml('check')` + '}'],
    [`<i class="fas fa-times"></i>`, '${' + `iconHtml('times')` + '}'],
    [`<i class="fas fa-cube"></i>`, '${' + `iconHtml('cube')` + '}'],
    [`<i class="fas fa-plane"></i>`, '${' + `iconHtml('plane')` + '}'],
];
for (const [find, replace] of ICON_SITES) {
    sub(`icon ${find.replace(/\s+/g, ' ').slice(0, 52)}`, find, replace);
}

/* ---- 12. Close the closure and return the disposer --------------------- */
s += `
/* ============================================================
   13. Teardown
   ------------------------------------------------------------
   Everything bound to an element inside the island root dies with the
   tree when React unmounts. These do not: the viewport's rAF loop,
   ResizeObserver and WebGL context; the two global shortcut maps; the
   autosave debounce; any toast still counting down; and the body scroll
   lock, which would strand the page unscrollable if the tool were
   unmounted with the catalog open.
   ============================================================ */

return function dispose() {
    if (_disposed) return;
    _disposed = true;

    for (const [fn, capture] of _docKeys) document.removeEventListener('keydown', fn, capture);
    _docKeys.length = 0;

    clearTimeout(_autosaveTimer);
    for (const t of _toastTimers) clearTimeout(t);
    _toastTimers.clear();

    document.body.classList.remove('g3-modal-open');

    try { app.viewport?.dispose(); } catch { /* a context already lost */ }
    try { app.materials?.dispose?.(); } catch { /* ditto */ }

    if (window.gear3d === app) delete window.gear3d;
};

}
`;

writeFileSync(OUT, s);
console.log(log.join('\n'));
console.log(`\n${log.length} transformations -> ${OUT}`);
