/* Gear3D — SI and English.
 *
 * Three halves, because the feature fails in three different ways.
 *
 * ROUNDING. Every stored value is canonical, so SI shows the cited number and
 * English cannot: a dimension cited in metric has no exact inch. Printing two
 * decimals of it anyway made a 1854 mm track read 72.99 in, which claims a
 * hundredth of an inch the data does not have and is harder to read than 73.
 * `engine/core/readable.js` wraps units.js and rounds English to three
 * significant figures; gear3d.js imports the wrappers instead of the raw
 * formatters. Upstream carries the same module and the same checks (§15 of
 * its own suite), so this file is a second reading of one contract rather
 * than a private one.
 *
 * Three figures is not a guess. It is what recovers the SOURCE's own
 * magnitude wherever the citation was itself converted from English, which in
 * this library is most of it, and the table below is that promise written
 * out: 44.5 kN is 10 kip, 4572 mm is 180 in, 13 608 kg is 30 000 lb. The
 * sweep after it bounds what the rounding costs everywhere else.
 *
 * COVERAGE. Upstream's switch already converted the figure, the dimension
 * engine and most of the panels, and then printed millimeters at an English
 * reader in five places: the hover coordinates, the contact-patch tooltip,
 * both structure-tree tags and three lines of the wide-base report. Nothing
 * threw and nothing rendered wrong, and render.test.mjs never runs a
 * client:only island's effects, so the only way to find one was to press the
 * switch and read every panel. A half-switched app is worse than an
 * unswitched one: nothing on the line says which system that number is in.
 *
 * WIRING. The toolbar is chrome, not state, so a restored session came back
 * in inches with the switch still lit on SI.
 *
 * gear3d.js and Gear3DApp.tsx are data as far as this is concerned. No DOM,
 * no browser, no bundler.
 *
 *   node --test src/components/react/gear3d/units.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import {
    MM_PER_IN, KN_PER_KIP, KPA_PER_PSI, KG_PER_LB, UNIT_SYSTEMS, UNIT_SPACE,
    lengthFromMm, forceFromKn, massFromKg, formatLength as citedLength
} from './engine/core/units.js';
import * as G3 from './engine/core/readable.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, '..', '..', '..', '..', 'public', 'gear3d', 'data');
const read = (p) => readFileSync(p, 'utf8');
const JS = read(join(HERE, 'gear3d.js')).replace(/\r\n/g, '\n');
const TSX = read(join(HERE, 'Gear3DApp.tsx'));

/** Narrow no-break spaces make a failing assertion unreadable. */
const plain = (s) => s.replace(/ /g, ' ');

/* ============================================================
   1. What English is allowed to say
   ============================================================ */

test('the English reading recovers the magnitude its source was cited in', () => {
    /* Every row is a value this library stores in metric that the SOURCE
       states in English: FHWA and manufacturer dimensions converted from
       feet and inches, tire data-book sections and diameters, axle loads
       converted from kips, gross weights from pounds. Three significant
       figures brings every one of them back. */
    const LENGTHS = [
        [1829, '72 in'],   [2032, '80 in'],   [2134, '84 in'],
        [1372, '54 in'],   [2591, '102 in'],  [4115, '162 in'],   // 102 in / 13 ft 6 in limits
        [4572, '180 in'],  [7620, '300 in'],  [12190, '480 in'],  // 15 ft / 25 ft / 40 ft
        [16760, '660 in'], [22860, '900 in'],                     // 55 ft / 75 ft
        [279, '11 in'],    [1054, '41.5 in'],                     // 11R22.5
        [1097, '43.2 in'],                                        // 11R24.5
        [1085, '42.7 in']                                         // 12R22.5
    ];
    for (const [mm, want] of LENGTHS) {
        assert.equal(plain(G3.formatLength(mm, 'in')), want, `${mm} mm`);
    }

    for (const [kN, want] of [[44.5, '10 kip'], [89, '20 kip'], [75.6, '17 kip'],
        [53.4, '12 kip'], [62.3, '14 kip']]) {
        assert.equal(plain(G3.formatForce(kN, 'kip')), want, `${kN} kN`);
    }

    for (const [kg, want] of [[13608, '30 000 lb'], [36287, '80 000 lb']]) {
        assert.equal(plain(G3.formatMass(kg, 'lb')), want, `${kg} kg`);
    }

    for (const [kPa, want] of [[1379, '200 psi'], [207, '30 psi']]) {
        assert.equal(plain(G3.formatPressure(kPa, 'psi')), want, `${kPa} kPa`);
    }
});

test('a value cited in metric is read honestly, not snapped to a round inch', () => {
    // The other half of the rule. 300 mm is the cited section width of a
    // 12R22.5 whose data book calls it a nominal 12.0 in tire; the metric
    // number in this library is 300 and not 304.8, so the English reading is
    // 11.8. Recovering the "12" would mean overriding the citation from the
    // designation, and a designation is not a dimension: the 9.00 in a
    // 9.00R20 is a series number, and that tire's section is 10.2 in.
    assert.equal(plain(G3.formatLength(300, 'in')), '11.8 in');
    assert.equal(plain(G3.formatLength(259, 'in')), '10.2 in');
    assert.equal(plain(G3.formatLength(278, 'in')), '10.9 in');
    assert.equal(plain(G3.formatMass(18000, 'lb')), '39 700 lb');
});

test('English never carries a digit the rounding did not earn', () => {
    // Three significant figures, and then the trailing zeros go: a track is
    // 73 in, not 73.0 in and not 72.99 in.
    for (const [mm, want] of [[1854, '73 in'], [1054, '41.5 in'], [250, '9.84 in']]) {
        assert.equal(plain(G3.formatLength(mm, 'in')), want);
    }
    for (const v of [0.2473, 9.842, 41.496, 72.99, 1124.016]) {
        const r = G3.readable(v, 1);
        const digits = String(r).replace(/[-.]/g, '').replace(/0+$/, '').replace(/^0+/, '');
        assert.ok(digits.length <= 4, `${v} rounded to ${r}, which shows ${digits.length} figures`);
    }
});

test('lengths keep a whole-inch floor, because only lengths reach four digits', () => {
    // A 75-ft double is 1124 in. Three significant figures alone would show
    // it as 1120, losing four inches of a dimension the source states.
    assert.equal(plain(G3.formatLength(28550, 'in')), '1 124 in');
    assert.equal(G3.readable(1124.016, G3.LENGTH_FLOOR.in), 1124);
    assert.equal(G3.readable(1124.016), 1120);   // the same value with no floor
});

test('SI is left exactly as it was cited', () => {
    // The wrappers must be invisible in SI: same string, same grouping, same
    // honoring of `precision` as the engine's own formatter.
    for (const mm of [259, 279, 1054, 1854, 12190, 28550]) {
        for (const precision of [0, 1, 2]) {
            assert.equal(G3.formatLength(mm, 'mm', { precision }),
                citedLength(mm, 'mm', { precision }), `${mm} mm at precision ${precision}`);
        }
    }
    assert.equal(G3.plainLength(28550, 'mm'), '28550');
});

test('a value bound for a number input carries no thousands separator', () => {
    // formatNumber groups with U+202F, which is not a valid value for
    // <input type="number"> and would silently blank the field.
    for (const [mm, to] of [[28550, 'in'], [28550, 'mm'], [1854, 'in']]) {
        const s = G3.plainLength(mm, to);
        assert.doesNotMatch(s, /[^\d.-]/, `plainLength(${mm}, ${to}) = ${JSON.stringify(s)}`);
        assert.ok(Number.isFinite(Number(s)));
    }
});

/* ============================================================
   2. What the rounding costs, over the whole shipped library
   ============================================================ */

/** Every length, load and weight the library cites, in canonical units. */
function libraryQuantities() {
    const lengths = new Set(), forces = new Set(), masses = new Set();
    const index = JSON.parse(read(join(DATA, 'trucks', 'index.json')));
    for (const f of index.files) {
        for (const u of JSON.parse(read(join(DATA, 'trucks', f))).units) {
            for (const k of ['overallLength', 'wheelbase']) if (u[k]) lengths.add(u[k]);
            if (u.gvw && u.gvw.unit === 'kg') masses.add(u.gvw.value);
            for (const a of u.axles || []) {
                for (const k of ['x', 'trackWidth', 'dualSpacing']) if (a[k]) lengths.add(a[k]);
                if (a.load && a.load.unit === 'kN') forces.add(a.load.value);
            }
            for (const g of u.groups || []) if (g.spacing) lengths.add(g.spacing);
        }
    }
    for (const t of Object.values(JSON.parse(read(join(DATA, 'tires.json'))).nominal)) {
        if (t.sectionWidth) lengths.add(t.sectionWidth);
        if (t.overallDiameter) lengths.add(t.overallDiameter);
    }
    return { lengths, forces, masses };
}

test('rounding costs no more than 0.5% anywhere in the shipped library', () => {
    const { lengths, forces, masses } = libraryQuantities();
    assert.ok(lengths.size > 50, `only ${lengths.size} lengths found; the library did not load`);

    /** @param {Set<number>} vals @param {(v:number)=>number} to @param {number|undefined} floor */
    const sweep = (vals, to, floor, what) => {
        let worst = 0, at = null;
        for (const v of vals) {
            const truth = to(v);
            if (!(truth > 0)) continue;
            const err = Math.abs(G3.readable(truth, floor) - truth) / truth;
            if (err > worst) { worst = err; at = v; }
        }
        assert.ok(worst < 0.005,
            `${what}: ${(worst * 100).toFixed(2)}% at ${at} (shown ${G3.readable(to(at), floor)})`);
        return worst;
    };

    sweep(lengths, (mm) => lengthFromMm(mm, 'in'), G3.LENGTH_FLOOR.in, 'lengths in inches');
    sweep(forces, (kN) => forceFromKn(kN, 'kip'), undefined, 'axle loads in kips');
    sweep(masses, (kg) => massFromKg(kg, 'lb'), undefined, 'weights in pounds');
});

/* ============================================================
   3. The switch reaches every readout
   ============================================================
   The body of gear3d.js is deliberately not indented into its closure (see
   the port README), so every top-level function starts at column 0 and ends
   at one. That is what makes it splittable here.
*/

const FUNCTIONS = new Map();
for (const m of JS.matchAll(/^(?:async )?function ([A-Za-z0-9_]+)\s*\([^)]*\)\s*\{\n([\s\S]*?)\n\}/gm)) {
    FUNCTIONS.set(m[1], m[2]);
}

/** @param {string} name */
function fn(name) {
    const body = FUNCTIONS.get(name);
    assert.ok(body !== undefined, `gear3d.js has no top-level function ${name}()`);
    return body;
}

test('gear3d.js splits into its top-level functions', () => {
    assert.ok(FUNCTIONS.size > 60, `found only ${FUNCTIONS.size} functions; the split is wrong`);
    for (const name of ['setUnitSystem', 'syncUnitSystemUi', 'applyProject', 'renderTree']) fn(name);
});

test('no unit label is written against an interpolated value', () => {
    /* A unit symbol immediately after a `${...}` is a label pinned to a
       number, and that number came from the store in canonical units.
       Anything this matches is showing millimeters to a reader who may be in
       inches. The one exception is the FAA's own Table 1, which prints
       both. */
    const ALLOWED = ['${p.psi} psi / ${p.mpa} MPa (Table 1).'];
    const RE = /\}\s?(mm²|mm2|mm|kPa|MPa|kN|psi|kip|lbf|in²|in2|kg|lb)\b/;

    const offenders = [];
    JS.split('\n').forEach((line, i) => {
        const t = line.trim();
        // A comment line is not a readout. `@param {number} mm` is the
        // shape that made this exclusion necessary, and it is a real doc
        // comment.
        if (t.startsWith('*') || t.startsWith('//') || t.startsWith('/*')) return;
        if (!RE.test(line)) return;
        if (ALLOWED.some((a) => line.includes(a))) return;
        offenders.push(`${i + 1}: ${t}`);
    });
    assert.deepEqual(offenders, [], 'hardcoded unit label(s):\n' + offenders.join('\n'));
});

test('every function that formats through UNIT_SYSTEMS is refreshed by the switch', () => {
    /* Exempt, each for a reason about WHEN it runs rather than what it
       formats. Re-running any of these from the switch would be wrong. */
    const EXEMPT = {
        setUnitSystem: 'is the switch',
        setupViewport: 'formats the hover readout, redrawn on the next pointer move',
        drawPatches: 'part of the overlay, redrawn by app.viewport.invalidate()',
        placeMeasurePoint: 'a toast, written once when a dimension is committed',
        setupContactPanel: 'reads a typed inflation pressure at change time',
        applyPatchOverride: 'reads typed footprint dimensions at click time'
    };
    // applyWideBaseSwap is deliberately NOT here. Its report is a record of
    // one swap and must not be recomputed, so the printing was split into
    // renderWideBaseReport(), which IS on the list.

    const refreshed = new Set(
        [...fn('setUnitSystem').matchAll(/([A-Za-z0-9_]+)\(/g)].map((m) => m[1])
    );

    const missing = [];
    for (const [name, body] of FUNCTIONS) {
        if (!/UNIT_SYSTEMS\[/.test(body)) continue;
        if (EXEMPT[name] || refreshed.has(name)) continue;
        missing.push(name);
    }
    assert.deepEqual(missing, [],
        `not re-run when the display system changes: ${missing.join(', ')}`);

    // ...and the exemptions must stay honest: an entry for a function that no
    // longer formats units is a stale excuse someone will copy.
    for (const name of Object.keys(EXEMPT)) {
        assert.match(fn(name), /UNIT_SYSTEMS\[/, `${name} is exempt but no longer reads UNIT_SYSTEMS`);
    }
});

test('a restored session re-lights the switch', () => {
    assert.match(fn('applyProject'), /syncUnitSystemUi\(\)/);
    assert.match(fn('setupToolbar'), /syncUnitSystemUi\(\)/);
});

test('the choice is remembered', () => {
    // It rides the session autosave, like every other view setting, and the
    // project file records the system its figure was drawn in.
    assert.match(fn('setUnitSystem'), /scheduleAutosave\(\)/);
    assert.match(JS, /unitSystem: v\.unitSystem/);
    assert.match(JS, /unitSystem: p\.view\?\.unitSystem \|\| 'SI'/);
});

/* ============================================================
   4. The shell and the engine agree
   ============================================================
   Gear3DApp.tsx is the one piece of the port with no transform behind it, so
   an id it does not carry is an id the engine writes into nothing.
*/

test('the title block states the display system, and the engine can write it', () => {
    assert.match(TSX, /id="g3-tb-units"/);
    assert.match(fn('syncUnitSystemUi'), /\$\('g3-tb-units'\)/);
});

test('the toolbar offers exactly the systems the engine knows', () => {
    const offered = [...TSX.matchAll(/data-units="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(offered.slice().sort(), Object.keys(UNIT_SYSTEMS).slice().sort());
    // One button per system: two on the same key is a switch that cannot be
    // turned off.
    assert.equal(new Set(offered).size, offered.length);
});

test('the exported constants are the published ones', () => {
    assert.equal(MM_PER_IN, 25.4);
    assert.equal(KG_PER_LB, 0.45359237);
    assert.ok(Math.abs(KN_PER_KIP - 4.4482216152605) < 1e-12);
    assert.ok(Math.abs(KPA_PER_PSI - 6.894757293168361) < 1e-12);
    assert.equal(plain(citedLength(25.4, 'in', { precision: 1 })), `1.0${plain(UNIT_SPACE)}in`);
});

test('the inflation field offers the same physical band in both systems', () => {
    // syncInflationField carries its own min/max per system, because a
    // spinner stepping by 5 in a field showing psi is unusable. The two bands
    // have to describe the same pressures, or an English reader is locked out
    // of a case their SI classmate can set.
    const body = fn('syncInflationField');
    const bands = [...body.matchAll(/el\.min = '(\d+)'; el\.max = '(\d+)';/g)]
        .map((m) => [Number(m[1]), Number(m[2])]);
    assert.equal(bands.length, 2, 'expected one band per unit system');
    assert.ok(body.indexOf("'psi'") < body.indexOf("'kPa'"), 'the psi branch is no longer first');

    const [[psiLo, psiHi], [kpaLo, kpaHi]] = bands;
    for (const [a, b, what] of [
        [psiLo * KPA_PER_PSI, kpaLo, 'floor'],
        [psiHi * KPA_PER_PSI, kpaHi, 'ceiling']
    ]) {
        const off = Math.abs(a - b) / b;
        assert.ok(off < 0.05, `inflation ${what} differs by ${(off * 100).toFixed(1)}% between systems`);
    }
});
