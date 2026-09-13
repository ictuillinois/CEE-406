// How math is rendered, site-wide.
//
// The site has two ways to typeset an equation and both are real KaTeX: the
// page-level auto-renderer, which scans `$...$` inside a `[data-katex]` or
// `.doc-equation` subtree, and `<Equation>`, which islands use because the
// auto-renderer has already run by the time a `client:only` island exists.
//
// What this file gates is everything that can go wrong AROUND those two.
// None of it is visible at build time: KaTeX arrives in an effect, so a
// server-rendered page contains none of it, and `throwOnError: false` does
// not throw — it renders the source in red and returns normally. So an
// equation can be broken on every page and every test still pass.
//
// Run:  node --test src/components/react/ui/math.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { looksLikeRawTex } from './math.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..', '..');
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');

function walk(dir, test_, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, test_, out);
    else if (test_(n)) out.push(p);
  }
  return out;
}

const SOURCES = walk(SRC, n => /\.(tsx?|astro)$/.test(n) && !/\.test\./.test(n));
const rel = f => f.slice(ROOT.length + 1).replace(/\\/g, '/');

/* ══════════════════════════════════════════════════════════════════════════
   The trap that has cost this repo nine broken equations
   ══════════════════════════════════════════════════════════════════════════ */

test('every tex literal escapes its backslashes, everywhere in src', () => {
  // In a TS string literal `'\frac'` is a form feed and `'\sigma'` is the
  // letters "sigma": the backslash has to be doubled. Runs must be EVEN.
  // lea/render.test.mjs checked this for one folder; math is site-wide now.
  const bad = [];
  for (const f of SOURCES) {
    const src = readFileSync(f, 'utf8');
    const re = /\btex:\s*(['"`])([\s\S]*?)\1/g;
    let m;
    while ((m = re.exec(src))) {
      for (const run of m[2].match(/\\+/g) ?? []) {
        if (run.length % 2 !== 0) {
          const line = src.slice(0, m.index).split('\n').length;
          bad.push(`${rel(f)}:${line}  ${m[2].slice(0, 60)}`);
          break;
        }
      }
    }
  }
  assert.deepEqual(bad, [], 'odd backslash runs in a tex: literal');
});

test('every tex literal has a plain twin beside it', () => {
  // The plain form is the no-KaTeX fallback AND the accessible name. A tex
  // without one degrades to an empty box for anyone the CDN fails.
  const bad = [];
  for (const f of SOURCES) {
    const src = readFileSync(f, 'utf8');
    const re = /\btex:\s*(['"`])[\s\S]*?\1\s*(?:\+[\s\S]*?)?,/g;
    let m;
    while ((m = re.exec(src))) {
      const after = src.slice(m.index, m.index + 700);
      if (!/\bplain:\s*['"`]/.test(after)) {
        bad.push(`${rel(f)}:${src.slice(0, m.index).split('\n').length}`);
      }
    }
  }
  assert.deepEqual(bad, [], 'a tex: with no plain: within the same object');
});

test('no plain twin is itself TeX', () => {
  // A "plain" form carrying \dfrac or _{ } is not a fallback, it is the
  // source shown twice.
  const bad = [];
  for (const f of SOURCES) {
    const src = readFileSync(f, 'utf8');
    const re = /\bplain:\s*(['"])((?:[^'"\\]|\\.)*)\1/g;
    let m;
    while ((m = re.exec(src))) {
      if (/\\[a-zA-Z]+|[_^]\{/.test(m[2])) {
        bad.push(`${rel(f)}:${src.slice(0, m.index).split('\n').length}  ${m[2].slice(0, 50)}`);
      }
    }
  }
  assert.deepEqual(bad, [], 'plain: twins that still carry TeX markup');
});

/* ══════════════════════════════════════════════════════════════════════════
   Does KaTeX actually accept it?
   ══════════════════════════════════════════════════════════════════════════ */

test('every tex literal in src parses, in the KaTeX the browser loads', async () => {
  // The escaping test above catches one FAMILY of broken equation -- the one
  // that has bitten this repo nine times -- and nothing else. A mismatched
  // brace, an unknown macro, a \left with no \right are all just as broken
  // and just as silent, because `throwOnError: false` renders the source in
  // red and returns normally. So parse them, with the same version the CDN
  // serves (katex is a devDependency pinned to the BaseLayout URL; if that
  // URL moves, move this pin with it or the test stops describing the site).
  const katex = (await import('katex')).default;
  const pinned = (await import('katex/package.json', { with: { type: 'json' } })).default.version;
  const layout = readFileSync(join(SRC, 'layouts', 'BaseLayout.astro'), 'utf8');
  const cdn = layout.match(/katex@([\d.]+)/)?.[1];
  assert.equal(pinned, cdn,
    'the katex devDependency must match the version BaseLayout loads');

  const bad = [];
  for (const f of SOURCES) {
    const src = readFileSync(f, 'utf8');
    // the literal as JS sees it: evaluate the escapes the way the bundler will
    const re = /\btex:\s*('(?:[^'\\]|\\.)*'(?:\s*\+\s*(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"))*)/g;
    let m;
    while ((m = re.exec(src))) {
      let tex;
      try { tex = eval(m[1]); } catch { continue; }   // not a plain literal
      const line = src.slice(0, m.index).split('\n').length;
      try {
        const html = katex.renderToString(tex, { throwOnError: false });
        if (html.includes('katex-error')) bad.push(`${rel(f)}:${line}  ${tex.slice(0, 60)}`);
      } catch (e) {
        bad.push(`${rel(f)}:${line}  ${e.message.slice(0, 70)}`);
      }
    }
  }
  assert.deepEqual(bad, [], 'TeX that KaTeX will not render');
});

/* ══════════════════════════════════════════════════════════════════════════
   The chart catalog: an equation is an equation
   ══════════════════════════════════════════════════════════════════════════ */

test('every chart carries a typeset equation, not a spelled one', async () => {
  const { CHARTS } = await import('../lea/charts.ts');
  assert.ok(CHARTS.length >= 12, 'the catalog should have every figure in it');
  for (const c of CHARTS) {
    const eq = c.equation;
    assert.equal(typeof eq, 'object', `${c.id}: equation is still a bare string`);
    assert.ok(eq.tex && eq.plain, `${c.id}: equation needs both tex and plain`);
    // A citation belongs beside the math, not inside it: set as TeX it comes
    // out in italic math letters, as if "Eq" were a product of two variables.
    assert.ok(!/\\text\{[^}]*Eq\./.test(eq.tex), `${c.id}: citation inside the math`);
    assert.ok(!/Eq\.\s*\d/.test(eq.tex), `${c.id}: equation number inside the math`);
    // and no Unicode sub/superscripts left over from when it was prose
    assert.ok(!/[₀-₉⁰⁴-⁹²³¹]/.test(eq.tex),
      `${c.id}: Unicode sub/superscript inside TeX`);
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   The OTHER rendering path: $...$ on a homework page
   ══════════════════════════════════════════════════════════════════════════ */

test('every equation in the homework guides parses too', async () => {
  // These never reach <Equation>: they are HTML strings set into a
  // [data-katex] section and typeset by the page-level auto-renderer. Same
  // KaTeX, same silence when it fails, so the same gate applies -- and the
  // guides are the one place where TeX is written inside HTML, so a stray
  // &amp; or an unescaped brace has two ways to go wrong instead of one.
  const katex = (await import('katex')).default;
  const { hwGuides } = await import('../../../data/hwGuides.ts');

  let checked = 0, cards = 0;
  const bad = [];
  for (const [hw, guide] of Object.entries(hwGuides)) {
    for (const card of guide.concepts ?? []) {
      // A card that calls itself an equation must actually carry one. An
      // undelimited body is not a broken equation, it is prose wearing an
      // equation card's styling, and nothing downstream would notice.
      if (card.kind === 'equation') {
        cards++;
        const n = [...String(card.body).matchAll(/\$\$([^$]+)\$\$|\$([^$]+)\$/g)].length;
        assert.equal(n, 1, `${hw} "${card.title}": an equation card with ${n} equations`);
      }
      for (const field of ['body', 'where']) {
        const text = card[field];
        if (typeof text !== 'string') continue;
        // $$...$$ first so a display equation is not read as two inline ones
        for (const m of text.matchAll(/\$\$([^$]+)\$\$|\$([^$]+)\$/g)) {
          const tex = m[1] ?? m[2];
          checked++;
          try {
            const html = katex.renderToString(tex, { throwOnError: false });
            if (html.includes('katex-error')) {
              bad.push(`${hw} "${card.title}": ${tex.slice(0, 55)}`);
            }
          } catch (e) {
            bad.push(`${hw} "${card.title}": ${e.message.slice(0, 55)}`);
          }
        }
      }
    }
  }
  assert.ok(cards >= 15, `expected the guides' equation cards, found ${cards}`);
  assert.ok(checked >= cards, `expected at least one span per card, found ${checked}`);
  assert.deepEqual(bad, [], 'TeX in a homework guide that KaTeX will not render');
});

/* ══════════════════════════════════════════════════════════════════════════
   Raw TeX must not leak into prose
   ══════════════════════════════════════════════════════════════════════════ */

test('the homework guides never show their own TeX source', () => {
  // `<dt>A_c</dt>` renders as the three characters A, _, c directly beneath a
  // beautifully typeset $$A_c = P/p$$. Both shipped on the hw1 page.
  const src = readFileSync(join(SRC, 'data', 'hwGuides.ts'), 'utf8');
  const bad = [];
  for (const m of src.matchAll(/<(dt|dd|p|li)>([^<]{1,200})<\/\1>/g)) {
    const text = m[2];
    // $...$ is math and will be typeset; anything else must not look like TeX
    const outside = text.replace(/\$[^$]*\$/g, '');
    if (looksLikeRawTex(outside)) {
      bad.push(`${text.slice(0, 70)}`);
    }
  }
  assert.deepEqual(bad, [], 'raw TeX in hwGuides prose');
});

/* ══════════════════════════════════════════════════════════════════════════
   The auto-renderer's marker, which is easy to forget and silent to omit
   ══════════════════════════════════════════════════════════════════════════ */

test('no built page ships $...$ outside a katex-marked subtree', (t) => {
  // BaseLayout only runs renderMathInElement when the page has a
  // `.doc-equation` or `[data-katex]` element, and then runs it over the
  // whole body. A page with math in its prose and no marker anywhere ships
  // literal dollar signs, with nothing in the console to say so.
  if (!existsSync(DIST)) return t.skip('no dist/ — run npm run build first');
  const pages = walk(DIST, n => n.endsWith('.html'));
  assert.ok(pages.length > 0, 'dist/ has no pages');
  const bad = [];
  for (const p of pages) {
    const raw = readFileSync(p, 'utf8');
    const marked = /class="[^"]*doc-equation|\bdata-katex\b/.test(raw);
    if (marked) continue;
    // Scan what the auto-renderer would scan: it skips script, style, code,
    // pre and textarea, and a page's inline JS is full of `$` — a regex
    // literal ending `$/g` reads as an opening delimiter otherwise.
    const html = raw
      .replace(/<script[\s\S]*?<\/script>/g, ' ')
      .replace(/<style[\s\S]*?<\/style>/g, ' ')
      .replace(/<(code|pre|textarea)\b[\s\S]*?<\/\1>/g, ' ');
    // a $...$ span that looks like math rather than like two prices
    const hits = html.match(/\$[^$<>\n]{1,80}\$/g) ?? [];
    for (const h of hits) {
      if (/[\\_^{}]|[A-Za-z]\s*=/.test(h)) {
        bad.push(`${rel(p)}  ${h.slice(0, 60)}`);
      }
    }
  }
  assert.deepEqual(bad, [], 'math delimiters on a page the auto-renderer skips');
});
