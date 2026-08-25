/* The release gate, enforced.
 *
 * This repository is PUBLIC. Everything here exists because "hidden" on a
 * static site has three separate meanings and getting two of them right is not
 * enough:
 *
 *   1. no card on any index      — a data concern (release.ts)
 *   2. no route at the URL       — a filesystem concern (_index.astro)
 *   3. no file under public/     — a build-output concern
 *
 * A tool whose card is hidden but whose page still builds is reachable by
 * anyone who guesses the URL. A homework whose page is gone but whose handouts
 * still sit in public/ is reachable the same way. And a chapter PDF in public/
 * is published whether or not a single line of HTML links to it.
 *
 * Run:  node --test src/data/release.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TOOLS_DIR = join(ROOT, 'src', 'pages', 'tools');
const PUBLIC = join(ROOT, 'public');

/* release.ts is TypeScript; read the maps out of it as text rather than
   dragging a loader in. The shapes are simple object literals by design. */
import { readFileSync } from 'node:fs';
const RELEASE_SRC = readFileSync(join(ROOT, 'src', 'data', 'release.ts'), 'utf8');

function releasedSet(constName) {
    const m = new RegExp(`${constName}[^=]*=\\s*\\{([\\s\\S]*?)\\n\\};`).exec(RELEASE_SRC);
    assert.ok(m, `could not find ${constName} in release.ts`);
    const body = m[1];
    const out = new Set();
    // `slug: true,` or `'slug-with-dashes': true,` — commented lines excluded.
    for (const line of body.split('\n')) {
        if (line.trim().startsWith('//')) continue;
        const e = /^\s*'?([A-Za-z0-9_-]+)'?\s*:\s*true\s*,?/.exec(line);
        if (e) out.add(e[1]);
    }
    return out;
}

const releasedTools = releasedSet('RELEASED_TOOLS');
const releasedHomeworks = releasedSet('RELEASED_HOMEWORKS');

const toolDirs = readdirSync(TOOLS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

test('every released tool has a routable page, and no locked tool does', () => {
    for (const slug of toolDirs) {
        const routable = existsSync(join(TOOLS_DIR, slug, 'index.astro'));
        const parked = existsSync(join(TOOLS_DIR, slug, '_index.astro'));
        const released = releasedTools.has(slug);

        assert.ok(routable || parked, `${slug}: has neither index.astro nor _index.astro`);
        assert.ok(!(routable && parked),
            `${slug}: has BOTH index.astro and _index.astro — the locked copy would still build`);

        if (released) {
            assert.ok(routable,
                `${slug} is in RELEASED_TOOLS but its page is _index.astro — rename it to index.astro`);
        } else {
            assert.ok(parked,
                `${slug} is NOT in RELEASED_TOOLS but index.astro still routes — rename it to _index.astro, ` +
                `or the tool is reachable at /tools/${slug}/ by anyone who guesses it`);
        }
    }
});

test('every released slug actually names something that exists', () => {
    for (const slug of releasedTools) {
        assert.ok(toolDirs.includes(slug),
            `RELEASED_TOOLS names "${slug}", but src/pages/tools/${slug}/ does not exist`);
    }
    const hwSrc = readFileSync(join(ROOT, 'src', 'data', 'homeworks.ts'), 'utf8');
    for (const id of releasedHomeworks) {
        assert.ok(hwSrc.includes(`id: '${id}'`),
            `RELEASED_HOMEWORKS names "${id}", which is not in homeworks.ts`);
    }
});

/* ── The copyright rule ────────────────────────────────────────────────── */

test('no textbook material is served from public/', () => {
    const dir = join(PUBLIC, 'textbook');
    if (!existsSync(dir)) return;                 // the expected state
    const files = readdirSync(dir).filter(f => !f.startsWith('.'));
    assert.deepEqual(files, [],
        'public/textbook/ must be empty: Huang is a copyrighted commercial textbook and this ' +
        'repo is public. Anything here is published whether or not a page links to it. ' +
        'See src/data/release.ts.');
});

test('no material is served for a homework that has not been released', () => {
    const dir = join(PUBLIC, 'homeworks');
    if (!existsSync(dir)) return;
    for (const hw of readdirSync(dir)) {
        const p = join(dir, hw);
        if (!statSync(p).isDirectory()) continue;
        const files = readdirSync(p).filter(f => !f.startsWith('.'));
        if (files.length === 0) continue;
        assert.ok(releasedHomeworks.has(hw),
            `public/homeworks/${hw}/ holds ${files.length} file(s) but ${hw} is not released. ` +
            `They are downloadable at /homeworks/${hw}/<file> right now. Move them back to the ` +
            `Box archive until ${hw} is unlocked.`);
    }
});

test('the library link is a real UIUC catalogue URL, not a placeholder', () => {
    const m = /TEXTBOOK_LIBRARY_URL\s*=\s*\n?\s*'([^']+)'/.exec(RELEASE_SRC);
    assert.ok(m, 'TEXTBOOK_LIBRARY_URL must be defined');
    const url = m[1];
    assert.ok(url.startsWith('https://'), 'library URL must be https');
    assert.match(url, /i-share-uiu\.primo\.exlibrisgroup\.com/,
        'library URL should point at the UIUC I-Share catalogue');
    assert.match(url, /docid=alma\d+/, 'library URL should carry the catalogue record id');
});
