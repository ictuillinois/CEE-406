/* Gear3D design tokens — text contrast.
 *
 * Ported from §14 of the upstream E-Lab's own suite, and it is the one
 * upstream test the port MUST re-run rather than inherit: the CEE 406 re-skin
 * replaced every surface and every ink in gear3d.css, so upstream's passing
 * result says nothing about ours.
 *
 * Upstream's reason for writing it stands unchanged: `--g3-muted` spent five
 * releases at 2.72:1 on the light panel — below the WCAG AA minimum on EVERY
 * background in that theme, across 55 elements — and nothing could tell. A
 * token is one edit away from regressing, and a regression here is invisible
 * to every other check in this repo.
 *
 * gear3d.css is data as far as this is concerned. No DOM, no browser.
 *
 *   node --test src/components/react/gear3d/tokens.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(join(HERE, 'gear3d.css'), 'utf8');

/** @param {number[]} c */
function relLuminance(c) {
    const [r, g, b] = c.map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** @param {string} h */
function hexRGB(h) {
    const m = /^#?([0-9a-f]{6})$/i.exec(h.trim());
    if (!m) throw new Error(`not a hex color: ${h}`);
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** @param {string} a @param {string} b */
function contrast(a, b) {
    const l1 = relLuminance(hexRGB(a));
    const l2 = relLuminance(hexRGB(b));
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/**
 * Collect one theme's tokens.
 *
 * Where upstream had one block per theme, the port declares light as the BASE
 * on `.g3-app` — split across two rules, accent tokens then surfaces — and
 * dark as an override on `[data-theme="dark"] .g3-app`. So the light theme is
 * every `.g3-app {` block that is NOT inside a dark override, and the dark
 * theme is light with the override applied on top, which is exactly how the
 * cascade resolves it in the browser.
 *
 * @param {'light'|'dark'} theme
 * @returns {Record<string,string>}
 */
function themeTokens(theme) {
    /** @type {Record<string,string>} */
    const out = {};
    const collect = (body) => {
        for (const m of body.matchAll(/(--g3-[\w-]+)\s*:\s*(#[0-9a-f]{6})/gi)) out[m[1]] = m[2];
    };

    // Light base: the `.g3-app {` rules at the top of the sheet.
    for (const m of CSS.matchAll(/(^|\n)\.g3-app \{([^}]*)\}/g)) collect(m[2]);
    assert.ok(Object.keys(out).length > 0, 'no .g3-app token block found');

    if (theme === 'dark') {
        const m = /\[data-theme="dark"\] \.g3-app \{([^}]*)\}/.exec(CSS);
        assert.ok(m, 'no [data-theme="dark"] .g3-app token block found');
        collect(m[1]);

        // Aliases. Dark declares `--g3-wordmark: var(--g3-datum)` rather than a
        // hex, and the light hex would otherwise survive from the base block —
        // which had this file comparing the LIGHT wordmark against the DARK
        // tile and reporting a failure that does not exist.
        for (const a of m[1].matchAll(/(--g3-[\w-]+)\s*:\s*var\((--g3-[\w-]+)\)/g)) {
            if (out[a[2]]) out[a[1]] = out[a[2]];
        }
    }
    return out;
}

test('body text tokens clear WCAG AA on every surface they are drawn on', () => {
    // 4.5:1 is the AA minimum for text below 18.66px bold / 24px regular, and
    // everything these tokens color is small.
    const AA = 4.5;
    for (const theme of /** @type {const} */ (['light', 'dark'])) {
        const t = themeTokens(theme);
        const surfaces = ['--g3-surface', '--g3-surface-2', '--g3-paper', '--g3-inset'];
        for (const ink of ['--g3-muted', '--g3-graphite', '--g3-ink']) {
            for (const bg of surfaces) {
                assert.ok(t[ink] && t[bg], `${theme}: missing ${ink} or ${bg}`);
                const c = contrast(t[ink], t[bg]);
                assert.ok(c >= AA,
                    `${theme}: ${ink} (${t[ink]}) on ${bg} (${t[bg]}) is ${c.toFixed(2)}:1, needs ${AA}`);
            }
        }
    }
});

test('the muted/graphite hierarchy stays visibly two steps wide', () => {
    // The re-skin moved every surface. If that collapsed muted onto graphite,
    // every "secondary" label would read as primary.
    for (const theme of /** @type {const} */ (['light', 'dark'])) {
        const t = themeTokens(theme);
        const g = contrast(t['--g3-graphite'], t['--g3-surface']);
        const m = contrast(t['--g3-muted'], t['--g3-surface']);
        assert.ok(g > m * 1.15,
            `${theme}: graphite ${g.toFixed(2)}:1 must stay clearly above muted ${m.toFixed(2)}:1`);
    }
});

test('the wordmark clears AA on the mark tile it sits on', () => {
    // Upstream teal managed 4.51:1 on --g3-inset. Illini orange at full
    // strength manages only 4.06:1 there, which is why the port darkens it.
    for (const theme of /** @type {const} */ (['light', 'dark'])) {
        const t = themeTokens(theme);
        if (!t['--g3-wordmark']) continue;   // dark aliases it to var(--g3-datum)
        const c = contrast(t['--g3-wordmark'], t['--g3-inset']);
        assert.ok(c >= 4.5,
            `${theme}: --g3-wordmark (${t['--g3-wordmark']}) on --g3-inset is ${c.toFixed(2)}:1, needs 4.5`);
    }
});

test('chrome drawn on the figure clears AA against the figure, not the theme', () => {
    // --g3-fig-* color the HUD and axis badge, which sit on the white plate
    // whatever the interface theme is. The port leaves them at their upstream
    // values on purpose — they end up in exported figures — so this check is
    // here to make sure a future re-skin does not quietly pull them along.
    const i = CSS.indexOf('--g3-fig-paper');
    assert.ok(i > 0, '--g3-fig-paper must be declared');
    const block = CSS.slice(i - 400, i + 900);
    /** @type {Record<string,string>} */
    const fig = {};
    for (const m of block.matchAll(/(--g3-fig-[\w-]+)\s*:\s*(#[0-9a-f]{6})/gi)) fig[m[1]] = m[2];

    for (const ink of ['--g3-fig-ink', '--g3-fig-muted', '--g3-fig-datum']) {
        assert.ok(fig[ink], `${ink} must be declared`);
        const c = contrast(fig[ink], fig['--g3-fig-paper']);
        assert.ok(c >= 4.5,
            `${ink} (${fig[ink]}) on the figure is ${c.toFixed(2)}:1, needs 4.5`);
    }
});

test('tokens are declared on .g3-app, never on :root', () => {
    // The integration contract in docs/dashboard-visual-language.md §0.1. A
    // --g3-* on :root would repaint the course site outside the tool.
    assert.ok(!/(^|\n):root\s*\{/.test(CSS), 'gear3d.css must not declare a :root block');
    assert.ok(!/(^|\n)\[data-theme="(light|dark)"\]\s*\{/.test(CSS),
        'theme blocks must be scoped to .g3-app, not bare [data-theme]');
});
