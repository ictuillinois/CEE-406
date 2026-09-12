/* The LEAPS engine, and the port that carries it here.
 *
 * Two halves, and both matter.
 *
 * PHYSICS. The engine is a second, independent implementation of the same
 * thing `lea/lea.ts` implements — a different formulation of Burmister's
 * problem, a different quadrature, a different convergence rule, written
 * years apart. That is worth more than either of them checked alone: where
 * they agree to twelve digits over a sweep of sections, offsets and depths,
 * a regression in either one has nowhere to hide. And `lea.ts` is itself
 * pinned to Huang's printed answers, Burmister's chart and Jones' table, so
 * agreement with it IS agreement with the literature the course works
 * against — which is the whole of what "compatible with WinJULEA when the
 * same inputs are used" can mean for a program nobody here can run.
 *
 * Note the sign flip in every stress comparison: `lea.ts` is compression
 * positive, the convention Huang's chapter uses, and LEAPS is tension
 * positive, the convention every layered-elastic PROGRAM prints. The
 * displacements need no flip — both are positive downward.
 *
 * THE PORT. `leaps.js` and `markup.ts` are generated from the standalone
 * E-Lab and drive forty elements by id across a file boundary. Nothing in
 * the type system connects them, so the checks at the bottom do: every id
 * the app looks up exists in the markup, every glyph it names exists in the
 * icon set, and no Font Awesome markup survived the transform.
 *
 * Run:  node --test src/components/react/leaps/engine.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

/* solver.js is a UMD, so in a module context it looks for a global to hang
   itself on. Node has no `self`; giving it one is the whole adaptation, and
   is exactly what the Worker does. */
globalThis.self ??= globalThis;
await import('./engine/solver.js');
const LEAPS = globalThis.LEAPS;

const { leaResponse } = await import('../lea/lea.ts');
const { oneLayerResponse, pointLoadResponse } = await import('../lea/oneLayer.ts');

const rel = (a, b) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-12);

/* ═══════════════════════════════════════════════════════════════════════
 * 1. Closed forms
 * ═══════════════════════════════════════════════════════════════════════ */

test('the engine self-check passes', () => {
    const st = LEAPS.selfTest();
    assert.ok(st.pass, st.errors.join(' | '));
});

test('a circular load on a half-space is Boussinesq', () => {
    const p = 0.7, a = 150, E = 100, nu = 0.35;
    const job = {
        layers: [{ h: 0, E, nu }], interfaces: [],
        loads: [{ kind: 'circle', x: 0, y: 0, p, a }],
        points: [],
    };
    for (const [r, z] of [[0, 0], [0, 75], [0, 300], [75, 0], [300, 0], [200, 250], [600, 900]]) {
        job.points.push({ x: r, y: 0, z });
    }
    const out = LEAPS.solve(job);
    out.points.forEach((q, i) => {
        const [r, z] = [job.points[i].x, job.points[i].z];
        const want = oneLayerResponse(r, z, p, a, E, nu);
        assert.ok(want, `no reference at r=${r} z=${z}`);
        // lea.ts is compression positive; LEAPS is tension positive.
        assert.ok(rel(q.sig.zz, -want.sigZ) < 3e-5, `sz at r=${r} z=${z}: ${q.sig.zz} vs ${-want.sigZ}`);
        assert.ok(rel(q.disp.uz, want.w) < 3e-5, `uz at r=${r} z=${z}: ${q.disp.uz} vs ${want.w}`);
        if (Math.abs(want.sigR) > 1e-4) {
            assert.ok(rel(q.sig.xx, -want.sigR) < 1e-3, `sr at r=${r} z=${z}: ${q.sig.xx} vs ${-want.sigR}`);
        }
    });
});

test('a point load on a half-space is Boussinesq, exactly', () => {
    const P = 50000, E = 120, nu = 0.4;
    const pts = [[200, 300], [0, 400], [800, 150], [50, 900], [1000, 0]];
    const out = LEAPS.solve({
        layers: [{ h: 0, E, nu }], interfaces: [],
        loads: [{ kind: 'point', x: 0, y: 0, P }],
        points: pts.map(([r, z]) => ({ x: r, y: 0, z })),
    });
    out.points.forEach((q, i) => {
        const [r, z] = pts[i];
        const want = pointLoadResponse(r, z, P, E, nu);
        assert.ok(rel(q.sig.zz, -want.sigZ) < 1e-9, `sz at r=${r} z=${z}`);
        assert.ok(rel(q.sig.xx, -want.sigR) < 1e-9, `sr at r=${r} z=${z}`);
        assert.ok(rel(q.disp.uz, want.w) < 1e-9, `uz at r=${r} z=${z}`);
        assert.ok(Math.abs(q.disp.ux - want.u) < 1e-9 * Math.max(Math.abs(want.u), 1e-6),
            `ur at r=${r} z=${z}`);
    });
});

/* ═══════════════════════════════════════════════════════════════════════
 * 2. Against this site's own N-layer solver
 * ═══════════════════════════════════════════════════════════════════════ */

const SECTIONS = [
    {
        name: 'two layers, stiff over soft',
        layers: [{ h: 150, E: 3000, nu: 0.35 }, { h: 0, E: 70, nu: 0.4 }],
    },
    {
        name: 'three layers, conventional flexible',
        layers: [{ h: 100, E: 3450, nu: 0.35 }, { h: 250, E: 350, nu: 0.35 }, { h: 0, E: 60, nu: 0.4 }],
    },
    {
        name: 'four layers, FAA flexible',
        layers: [
            { h: 127, E: 1379, nu: 0.35 }, { h: 305, E: 350, nu: 0.35 },
            { h: 305, E: 150, nu: 0.35 }, { h: 0, E: 83, nu: 0.4 },
        ],
    },
    {
        name: 'inverted section — soft layer over stiff',
        layers: [{ h: 80, E: 200, nu: 0.35 }, { h: 200, E: 20000, nu: 0.15 }, { h: 0, E: 50, nu: 0.45 }],
    },
];

test('every layered section agrees with lea.ts point by point', () => {
    const p = 0.7, a = 150;
    for (const sec of SECTIONS) {
        const zb = [];
        let acc = 0;
        for (let i = 0; i < sec.layers.length - 1; i++) { acc += sec.layers[i].h; zb.push(acc); }
        const probes = [];
        for (const r of [0, 75, 150, 300, 600]) {
            for (const z of [0, 40, ...zb.map(v => v - 0.1), ...zb.map(v => v + 0.1), acc + 300, acc + 900]) {
                probes.push([r, z]);
            }
        }
        const out = LEAPS.solve({
            layers: sec.layers,
            interfaces: sec.layers.slice(1).map(() => ({ slip: 0 })),
            loads: [{ kind: 'circle', x: 0, y: 0, p, a }],
            points: probes.map(([r, z]) => ({ x: r, y: 0, z })),
            options: { tol: 1e-8 },
        });
        let worstS = 0, worstW = 0, nz = 0;
        out.points.forEach((q, i) => {
            const [r, z] = probes[i];
            const want = leaResponse(sec.layers, p, a, r, z, { tol: 1e-13 });
            assert.ok(want, `${sec.name}: no reference at r=${r} z=${z}`);
            // Scale the stress comparison on the contact pressure, not on the
            // local value: deep in a subgrade sigma_z is a thousandth of q and
            // a relative test there is a test of two quadratures' noise floors.
            worstS = Math.max(worstS, Math.abs(q.sig.zz + want.sigZ) / p);
            worstS = Math.max(worstS, Math.abs(q.sig.xx + want.sigR) / p);
            worstW = Math.max(worstW, rel(q.disp.uz, want.w));
            nz++;
        });
        assert.ok(nz >= 25, `${sec.name}: only ${nz} probes`);
        assert.ok(worstS < 4e-5, `${sec.name}: stress disagreement ${worstS.toExponential(2)} of q`);
        assert.ok(worstW < 4e-5, `${sec.name}: deflection disagreement ${worstW.toExponential(2)}`);
    }
});

/* ═══════════════════════════════════════════════════════════════════════
 * 3. The three load idealizations
 * ═══════════════════════════════════════════════════════════════════════ */

const FLEX = [{ h: 100, E: 3000, nu: 0.35 }, { h: 200, E: 300, nu: 0.35 }, { h: 0, E: 60, nu: 0.4 }];
const BONDED = [{ slip: 0 }, { slip: 0 }];

test('a point load is the limit of a shrinking circle at constant load', () => {
    const P = 20000, p = 0.7, a = Math.sqrt(P / (Math.PI * p));
    const pts = [{ x: 0, y: 0, z: 300 }, { x: 400, y: 0, z: 300 }, { x: 0, y: 0, z: 900 }];
    const run = loads => LEAPS.solve({ layers: FLEX, interfaces: BONDED, loads, points: pts });
    const pt = run([{ kind: 'point', x: 0, y: 0, P }]);
    const tiny = run([{ kind: 'circle', x: 0, y: 0, p: p * 1e4, a: a / 100 }]);
    pt.points.forEach((q, i) => {
        assert.ok(rel(q.sig.zz, tiny.points[i].sig.zz) < 2e-4, `sz ${i}`);
        assert.ok(rel(q.disp.uz, tiny.points[i].disp.uz) < 2e-4, `uz ${i}`);
    });
});

test('a line load of vanishing length is a point load', () => {
    const P = 20000;
    const pts = [{ x: 0, y: 0, z: 250 }, { x: 350, y: 120, z: 90 }];
    const run = loads => LEAPS.solve({ layers: FLEX, interfaces: BONDED, loads, points: pts });
    const pt = run([{ kind: 'point', x: 0, y: 0, P }]);
    const ln = run([{ kind: 'line', x: 0, y: 0, P, L: 1e-3, theta: 41 }]);
    pt.points.forEach((q, i) => {
        assert.ok(rel(q.sig.zz, ln.points[i].sig.zz) < 1e-6, `sz ${i}`);
        assert.ok(rel(q.disp.uz, ln.points[i].disp.uz) < 1e-6, `uz ${i}`);
        assert.ok(rel(q.sig.xy, ln.points[i].sig.xy) < 1e-5 || Math.abs(q.sig.xy) < 1e-9, `sxy ${i}`);
    });
});

test('every idealization carries the applied load through the section', () => {
    /* Integrate sigma_z over a horizontal plane. Whatever the load is
     * spread over, the plane below it carries the whole of it — the one
     * check that catches a load-transform factor that is off by a constant,
     * which nothing else here would. */
    const P = 20000, p = 0.7, a = Math.sqrt(P / (Math.PI * p));
    const N = 81, X = 8000, h = (2 * X) / (N - 1);
    const grid = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        grid.push({ x: -X + h * i, y: -X + h * j, z: 500 });
    }
    for (const loads of [
        [{ kind: 'circle', x: 0, y: 0, p, a }],
        [{ kind: 'point', x: 0, y: 0, P }],
        [{ kind: 'line', x: 0, y: 0, P, L: 900, theta: 25 }],
    ]) {
        const out = LEAPS.solve({ layers: FLEX, interfaces: BONDED, loads, points: grid });
        let F = 0;
        out.points.forEach(o => { F += o.sig.zz; });
        F *= h * h;
        assert.ok(rel(F, -P) < 1.5e-2, `${loads[0].kind}: ${F.toFixed(1)} N carried, want ${-P}`);
    }
});

test('a point load has no value at the load, and says so', () => {
    const out = LEAPS.solve({
        layers: FLEX, interfaces: BONDED,
        loads: [{ kind: 'point', x: 0, y: 0, P: 20000 }],
        points: [{ x: 0, y: 0, z: 0 }, { x: 0.5, y: 0, z: 0 }],
    });
    assert.equal(out.points[0].singular, true);
    assert.ok(Number.isNaN(out.points[0].sig.zz));
    // just off it, the answer is finite and very large — the idealization
    // working, not failing
    assert.equal(out.points[1].singular, false);
    assert.ok(Number.isFinite(out.points[1].disp.uz));
});

/* ═══════════════════════════════════════════════════════════════════════
 * 4. Interfaces on a WinJULEA slip value
 * ═══════════════════════════════════════════════════════════════════════ */

test('slip 0 is bonded, slip 1 is frictionless, and between is monotone', () => {
    const layers = [{ h: 150, E: 3000, nu: 0.35 }, { h: 0, E: 80, nu: 0.4 }];
    const loads = [{ kind: 'circle', x: 0, y: 0, p: 0.7, a: 150 }];
    const pts = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 149.99 }];
    const at = itf => LEAPS.solve({ layers, interfaces: [itf], loads, points: pts });

    const s0 = at({ slip: 0 }), bonded = at({ bond: 'bonded' });
    const s1 = at({ slip: 1 }), free = at({ bond: 'unbonded' });
    for (let i = 0; i < pts.length; i++) {
        assert.equal(s0.points[i].sig.xx, bonded.points[i].sig.xx);
        assert.equal(s1.points[i].sig.xx, free.points[i].sig.xx);
    }
    // a bonded two-layer section must also be what lea.ts computes
    const want = leaResponse(layers, 0.7, 150, 0, 0, { tol: 1e-13 });
    assert.ok(rel(s0.points[0].disp.uz, want.w) < 4e-5);

    const w = [0, 0.25, 0.5, 0.75, 1].map(s => at({ slip: s }).points[0].disp.uz);
    for (let i = 1; i < w.length; i++) {
        assert.ok(w[i] >= w[i - 1] - 1e-12,
            `deflection fell as slip rose: ${w.join(' -> ')}`);
    }
    assert.ok(w[4] > w[0] * 1.02, 'a frictionless interface should deflect measurably more');
});

test('the reported slip is the slip that was asked for', () => {
    const out = LEAPS.solve({
        layers: [{ h: 120, E: 2500, nu: 0.35 }, { h: 200, E: 300, nu: 0.35 }, { h: 0, E: 70, nu: 0.4 }],
        interfaces: [{ slip: 0.35 }, { slip: 1 }],
        loads: [{ kind: 'circle', x: 0, y: 0, p: 0.7, a: 150 }],
        points: [{ x: 0, y: 0, z: 0 }],
    });
    assert.ok(Math.abs(out.slip[0] - 0.35) < 1e-9);
    assert.equal(out.slip[1], 1);
});

/* ═══════════════════════════════════════════════════════════════════════
 * 5. Principal values and strains
 * ═══════════════════════════════════════════════════════════════════════ */

test('principal stresses carry the tensor invariants and Hooke carries the strains', () => {
    const layers = [{ h: 100, E: 3000, nu: 0.35 }, { h: 250, E: 350, nu: 0.35 }, { h: 0, E: 60, nu: 0.4 }];
    const out = LEAPS.solve({
        layers, interfaces: [{ slip: 0 }, { slip: 0.4 }],
        loads: [
            { kind: 'circle', x: -175, y: 0, p: 0.7, a: 110 },
            { kind: 'circle', x: 175, y: 60, p: 0.8, a: 100 },
        ],
        points: [
            { x: 40, y: 20, z: 60 }, { x: 0, y: 0, z: 99.9 }, { x: 210, y: -40, z: 355 },
        ],
    });
    for (const q of out.points) {
        const { s1, s2, s3 } = q.principal;
        assert.ok(s1 >= s2 - 1e-12 && s2 >= s3 - 1e-12, 'principal stresses out of order');

        const tr = q.sig.xx + q.sig.yy + q.sig.zz;
        assert.ok(Math.abs(s1 + s2 + s3 - tr) < 1e-12 * Math.max(Math.abs(tr), 1));

        const L = layers[q.li], E = L.E, nu = L.nu, G = E / (2 * (1 + nu));
        assert.ok(Math.abs(q.epsPrincipal.e1 - (s1 - nu * (s2 + s3)) / E) < 1e-16);
        assert.ok(Math.abs(q.epsPrincipal.e2 - (s2 - nu * (s1 + s3)) / E) < 1e-16);
        assert.ok(Math.abs(q.epsPrincipal.e3 - (s3 - nu * (s1 + s2)) / E) < 1e-16);

        // shear strains are ENGINEERING strains, gamma = tau/G — the row a
        // layered-elastic program prints, and half the tensor component
        assert.ok(Math.abs(q.eps.xz - q.sig.xz / G) < 1e-18);
        assert.ok(Math.abs(q.eps.yz - q.sig.yz / G) < 1e-18);
        assert.ok(Math.abs(q.eps.xy - q.sig.xy / G) < 1e-18);
    }
});

/* ═══════════════════════════════════════════════════════════════════════
 * 6. The port
 * ═══════════════════════════════════════════════════════════════════════ */

const appSrc = readFileSync(join(HERE, 'leaps.js'), 'utf8');
const markupSrc = readFileSync(join(HERE, 'markup.ts'), 'utf8');
const cssSrc = readFileSync(join(HERE, 'leaps.css'), 'utf8');
const iconSrc = readFileSync(join(HERE, 'icons.ts'), 'utf8');

test('the generated files say they are generated', () => {
    for (const [name, src] of [['leaps.js', appSrc], ['markup.ts', markupSrc], ['leaps.css', cssSrc]]) {
        assert.match(src, /GENERATED FILE — DO NOT EDIT/,
            `${name} lost its banner — a hand edit here is lost on the next sync`);
    }
});

test('no Font Awesome markup survived the transform', () => {
    for (const [name, src] of [['leaps.js', appSrc], ['markup.ts', markupSrc]]) {
        assert.ok(!/class="fas/.test(src), `${name} still carries Font Awesome markup`);
        assert.ok(!/<i class=/.test(src), `${name} still builds an <i> element`);
    }
});

test('every element the app looks up exists in the markup', () => {
    /* The app drives the DOM by id across a file boundary and nothing in the
     * type system connects the two. This is that connection. It is not
     * hypothetical: the whole point of generating the markup instead of
     * rewriting it as JSX is that forty ids cannot be kept in step by hand. */
    const wanted = new Set();
    for (const m of appSrc.matchAll(/\$\('([a-z0-9-]+)'\)/g)) wanted.add(m[1]);
    assert.ok(wanted.size > 30, `only found ${wanted.size} id lookups — the scan pattern moved`);

    // ids the app creates itself rather than finding
    const made = new Set();
    for (const m of appSrc.matchAll(/\.id = '([a-z0-9-]+)'/g)) made.add(m[1]);

    const missing = [...wanted].filter(id => !made.has(id) && !markupSrc.includes(`id="${id}"`));
    assert.deepEqual(missing, [],
        `the app looks up ids the markup does not define: ${missing.join(', ')}`);
});

test('every glyph the app names exists in the icon set', () => {
    /* markup.ts calls iconHtml at module load, so its glyphs are checked by
     * importing it. The app's are named in data — the load kinds, the result
     * groups, the performance cards — and are only reached when a panel
     * renders, which is exactly when a missing one would be a blank square
     * in front of a student. */
    const names = new Set();
    for (const m of appSrc.matchAll(/icon: '(fa-[a-z0-9-]+)'/g)) names.add(m[1]);
    for (const m of appSrc.matchAll(/iconHtml\('(fa-[a-z0-9-]+)'/g)) names.add(m[1]);
    for (const m of appSrc.matchAll(/act\('(fa-[a-z0-9-]+)'/g)) names.add(m[1]);
    for (const m of appSrc.matchAll(/'(fa-[a-z0-9-]+)'/g)) names.add(m[1]);
    assert.ok(names.size > 15, `only found ${names.size} glyph names`);
    const missing = [...names].filter(n => !iconSrc.includes(`'${n}':`));
    assert.deepEqual(missing, [], `icons.ts has no glyph for: ${missing.join(', ')}`);
});

test('the markup mounts one root and the stylesheet opts out of the tool grid', () => {
    assert.ok(markupSrc.includes('id="lp-root"'), 'markup.ts lost the mount point');
    assert.equal(markupSrc.split('id="lp-root"').length - 1, 1, 'more than one mount point');
    assert.match(cssSrc, /\.cee-tool\.lp-shell \{\s*display: block;/,
        'leaps.css must opt out of the .cee-tool two-column grid');
    /* The shell class must not collide with an app class, or a single-class
       app rule lands on the island root. `.lp-tool` is the toolbar button,
       carries height: 2.1em, and pinned the root to 28px while its content
       spilled over the site footer. */
    assert.ok(!/\.cee-tool\.lp-tool\b/.test(cssSrc),
        'the island shell must not reuse an app class name');
    assert.match(cssSrc, /\[data-theme="dark"\] \.lp-app \{/,
        'leaps.css must define the dark theme as an override, not as the default');
    assert.ok(!/\[data-theme="light"\]/.test(cssSrc),
        'the port should have inverted the themes: light is the base here');
});

/* ═══════════════════════════════════════════════════════════════════════
 * 5. Notation, and the table it prints
 * ═══════════════════════════════════════════════════════════════════════ */

test('every symbol the app names exists in the notation table', () => {
    /* `symOf` falls back to the id itself, which is the right thing to do at
     * runtime and the wrong thing to leave unchecked: a mistyped id renders
     * as the letters "sxz" where the tau belongs, in the results table, the
     * field picker and the colorbar at once, and nothing throws. */
    const table = appSrc.match(/var SYM = \{([\s\S]*?)\n {4}\};/);
    assert.ok(table, 'the SYM table moved');
    const defined = new Set(
        [...table[1].matchAll(/(?:^|[\s{,])([A-Za-z][A-Za-z0-9]*)\s*:\s*\{/g)].map(m => m[1])
    );
    assert.ok(defined.size > 30, `only found ${defined.size} symbols in SYM`);

    const named = new Set();
    for (const m of appSrc.matchAll(/\bsym: '([A-Za-z0-9]+)'/g)) named.add(m[1]);
    for (const m of appSrc.matchAll(/\bsym(?:Html|Text)\('([A-Za-z0-9]+)'/g)) named.add(m[1]);
    for (const m of appSrc.matchAll(/\bdrawSym\([A-Za-z]+, '([A-Za-z0-9]+)'/g)) named.add(m[1]);
    assert.ok(named.size > 20, `only found ${named.size} symbol references`);

    const missing = [...named].filter(n => !defined.has(n));
    assert.deepEqual(missing, [],
        `the app names symbols the table does not define: ${missing.join(', ')}`);
});

test('the results table is in WinJULEA row order', () => {
    /* The order is the contract, not a preference: it is the order WinJULEA
     * prints, so a run can be read across the two programs line by line.
     * Reordering a group here silently breaks that comparison and the CSV
     * anybody has already written a script against. */
    const block = appSrc.match(/var RESULT_ROWS = \[([\s\S]*?)\n {4}\];/);
    assert.ok(block, 'RESULT_ROWS moved');
    const keys = [...block[1].matchAll(/key: '([a-z0-9]+)'/g)].map(m => m[1]);
    assert.deepEqual(keys, [
        'x', 'y', 'z',
        'sxx', 'syy', 'szz', 'sxz', 'syz', 'sxy',
        'exx', 'eyy', 'ezz', 'gxz', 'gyz', 'gxy',
        'ux', 'uy', 'uz',
        's1', 's2', 's3',
        'e1', 'e2', 'e3'
    ]);
});

test('every equation is typeset-safe and carries a plain twin', () => {
    /* The trap `Equation.tsx` documents, one file over: TeX in a JavaScript
     * string literal needs its backslashes doubled, and nothing catches a
     * single one. `\pi` becomes nothing at all and `\frac` becomes a form
     * feed, so the equation renders as wrong mathematics rather than as an
     * error. The plain twin is what shows before KaTeX arrives, so an entry
     * without one is a blank line on a slow connection. */
    const block = appSrc.match(/var EQ = \{([\s\S]*?)\n {4}\};/);
    assert.ok(block, 'the EQ table moved');
    const entries = [...block[1].matchAll(/(\w+): \{\s*tex: '([^']*)',\s*plain: '([^']*)'/g)];
    assert.ok(entries.length >= 5, `only found ${entries.length} equations`);
    for (const [, name, tex, plain] of entries) {
        for (const run of tex.match(/\+/g) || []) {
            assert.equal(run.length % 2, 0,
                `EQ.${name} has an odd run of ${run.length} backslashes: ${tex}`);
        }
        assert.ok(plain.trim().length > 0, `EQ.${name} has no plain-text twin`);
    }
});

test('nothing the app puts on screen uses a long hyphen', () => {
    /* A standing request, and worth a test rather than a proofread: an em
     * dash is one keystroke from a hyphen in an editor that autocorrects,
     * and in the middle of a label or a units string it reads as a
     * different character than the one that was meant. Comment lines are
     * exempt, which is also what lets the generated banner keep its own. */
    const speech = (src, lineComments) => {
        let out = '', i = 0;
        const n = src.length;
        while (i < n) {
            const c = src[i], d = src[i + 1];
            if (c === '/' && d === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
            if (lineComments && c === '/' && d === '/') { const e = src.indexOf('\n', i); i = e < 0 ? n : e; continue; }
            if (c === "'" || c === '"' || c === '`') {
                out += c; i++;
                while (i < n && src[i] !== c) {
                    if (src[i] === '\\') { out += src[i]; i++; }
                    if (i < n) { out += src[i]; i++; }
                }
                i++; continue;
            }
            out += c; i++;
        }
        return out;
    };
    for (const [name, src, lc] of [['leaps.js', appSrc, true], ['markup.ts', markupSrc, true], ['leaps.css', cssSrc, false]]) {
        const bad = [...speech(src, lc).matchAll(/.{0,40}[–—].{0,40}/g)].map(m => m[0].trim());
        assert.deepEqual(bad, [], `${name} uses a long hyphen: ${bad.join(' | ')}`);
    }
});

/* ═══════════════════════════════════════════════════════════════════════
 * 6. The 3-D view
 *
 * The PROJECTION is checked in render.test.mjs, which bundles the module
 * and can therefore call it; `leaps.js` imports './icons' extensionless
 * and Node cannot resolve that on its own. What belongs here is the half
 * that is a source fact: the switch the port has to carry across.
 * ═══════════════════════════════════════════════════════════════════════ */

test('the two views are one switch, and the switch is in the markup', () => {
    /* The 3-D view is a mode of the same canvas, not a second canvas, so
     * the only thing holding it together across the port is the id and the
     * two data-view values the app reads back. */
    assert.match(appSrc, /state\.settings\.view3d/, 'the view mode left the settings');
    assert.ok(markupSrc.includes('id="lp-viewmode"'), 'the view switch is missing from the markup');
    assert.ok(markupSrc.includes('data-view=\\"2d\\"') || markupSrc.includes('data-view="2d"'),
        'the section button lost its data-view');
    assert.ok(markupSrc.includes('data-view=\\"3d\\"') || markupSrc.includes('data-view="3d"'),
        'the 3D button lost its data-view');
});
