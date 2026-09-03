/* ============================================================
   Gear3D — wheel geometry gate
   ------------------------------------------------------------
   The one thing NOTHING else in either suite does: build the
   actual meshes.

   The upstream E-Lab's 176 checks cover the data, the layout,
   the contact patches and the exports, and every one of them
   passed while `buildRimDisc` threw on its first call and the
   tool rendered an empty viewport. `render.test.mjs` next door
   server-renders the islands, but a `client:only` island's
   effects never run under renderToString, so it never reaches a
   line of three.js. In between the two sits every part of this
   tool that a student actually looks at.

   These are geometric INVARIANTS, not golden images. Each one
   was a real defect found by rendering the tool and measuring
   what came out; each is expressed as something that must be
   true of the numbers, so it can be checked in 200 ms with no
   GPU and no canvas. The tire, rim and hub builders touch no
   DOM — only the texture builders do — which is what makes that
   possible and is worth preserving.

       node --test src/components/react/gear3d/geometry.test.mjs
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';

import { resolveTire, setNominalTable } from './engine/core/tires.js';
import { buildTireGeometry, tireMeridian, QUALITY } from './engine/geometry/tire.js';
import { buildRimBarrel, buildRimDisc, rimProfile, wheelStations, WHEEL } from './engine/geometry/rim.js';
import { buildHubGeometry } from './engine/geometry/hub.js';
import { MATERIAL_SPECS } from './engine/scene/materials.js';

/** Every tire designation the shipped library actually mounts. */
function libraryDesignations() {
    const out = new Set();
    const walk = (dir) => {
        for (const f of readdirSync(dir)) {
            const p = join(dir, f);
            if (statSync(p).isDirectory()) walk(p);
            else if (f.endsWith('.json')) {
                for (const m of readFileSync(p, 'utf8').matchAll(/"tire"\s*:\s*"([^"]+)"/g)) out.add(m[1]);
            }
        }
    };
    walk('public/gear3d/data');
    return [...out].sort();
}

// The inch-nominal sizes (11R22.5 and friends) encode neither their overall
// diameter nor their section width, so they come from the shipped table — the
// same file the app loads at runtime.
setNominalTable(JSON.parse(readFileSync('public/gear3d/data/tires.json', 'utf8')).nominal);
const geo = (d) => resolveTire(d).geometry;

const DESIGNATIONS = libraryDesignations();
const QUALITIES = /** @type {const} */ (['draft', 'standard', 'high']);

test('the library is not empty, or every check below passes vacuously', () => {
    assert.ok(DESIGNATIONS.length >= 20, `only ${DESIGNATIONS.length} designations found`);
});

test('every wheel in the library builds, at every quality', () => {
    for (const d of DESIGNATIONS) {
        const g = geo(d);
        for (const quality of QUALITIES) {
            for (const sign of [1, -1]) {
                const offsetRatio = 0.30 * sign;
                assert.doesNotThrow(() => {
                    for (const pattern of ['rib', 'lug', 'aircraft']) {
                        buildTireGeometry(g, { quality, pattern, designation: d });
                    }
                    buildRimBarrel(g, { quality });
                    buildRimDisc(g, { quality, offsetRatio });
                    buildHubGeometry(g, { quality, offsetRatio });
                }, `${d} @ ${quality} sign ${sign}`);
            }
        }
    }
});

test('no vertex is NaN, and the tire is exactly as wide as its section width', () => {
    for (const d of DESIGNATIONS) {
        const g = geo(d);
        const t = buildTireGeometry(g, { quality: 'high', pattern: 'lug', designation: d });
        const pos = t.attributes.position.array;
        for (let i = 0; i < pos.length; i++) {
            if (!Number.isFinite(pos[i])) assert.fail(`${d}: non-finite vertex at ${i}`);
        }
        // Local +X is the rotation axis, so the x extent IS the section width.
        // It must be the published figure and not a millimeter more: the
        // dimension engine draws that number and the footprint export writes
        // it out. Uniform Catmull-Rom overshot it by 0.6-1.1 mm on every tire
        // here, with the true maximum 11 mm off the station the profile puts
        // it at; centripetal parameterisation plus a maximum-width control
        // point whose neighbors share an axial station is what removes it.
        t.computeBoundingBox();
        const width = t.boundingBox.max.x - t.boundingBox.min.x;
        assert.ok(Math.abs(width - g.sectionWidth) < 0.02,
            `${d}: section width ${width.toFixed(3)} != published ${g.sectionWidth}`);
    }
});

test('the meridian has no crease a smooth-shaded carcass would show', () => {
    // Vertex normals are averaged from the faces meeting at each row, so a
    // crease between consecutive meridian segments becomes a shading band
    // around the whole sidewall. At the fixed sample budget this reached 31
    // degrees and the tire read as a stack of washers.
    const LIMIT = 12;
    for (const d of DESIGNATIONS) {
        const g = geo(d);
        for (const quality of QUALITIES) {
            const m = tireMeridian(g, { profileDetail: QUALITY[quality].profileDetail });
            let worst = 0;
            for (let i = 1; i < m.length - 1; i++) {
                const ax = m[i].a - m[i - 1].a, ay = m[i].r - m[i - 1].r;
                const bx = m[i + 1].a - m[i].a, by = m[i + 1].r - m[i].r;
                const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
                if (la < 1e-9 || lb < 1e-9) continue;
                const c = Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb)));
                worst = Math.max(worst, (Math.acos(c) * 180) / Math.PI);
            }
            assert.ok(worst <= LIMIT, `${d} @ ${quality}: ${worst.toFixed(1)} deg crease`);
        }
    }
});

test('the meridian arc-length coordinate is monotone and spans exactly 0..1', () => {
    // The detail maps are addressed by it, and `meridianBands` measures the
    // tread band with it. A non-monotone s would fold the texture back on
    // itself somewhere on the sidewall.
    for (const d of DESIGNATIONS) {
        const m = tireMeridian(geo(d), { profileDetail: 1 });
        assert.equal(m[0].s, 0, `${d}: s does not start at 0`);
        assert.ok(Math.abs(m[m.length - 1].s - 1) < 1e-12, `${d}: s does not end at 1`);
        for (let i = 1; i < m.length; i++) {
            assert.ok(m[i].s > m[i - 1].s, `${d}: s not increasing at row ${i}`);
        }
    }
});

test('the tire never intersects the rim it is mounted on', () => {
    // Both are surfaces of revolution about one axis, so it is a 2-D question:
    // at every station the barrel occupies, the tire has to be outside it.
    // It was not, and the two interpenetrated into a ring of alternating
    // rubber-and-rim teeth around every wheel — the rim's two bead seats were
    // at different distances from their own flanges, so no symmetric tire
    // could seat on both.
    const barrelAt = (prof, a) => {
        let best = null;
        for (let i = 1; i < prof.length; i++) {
            const p = prof[i - 1], q = prof[i];
            const lo = Math.min(p.y, q.y), hi = Math.max(p.y, q.y);
            if (a < lo || a > hi || hi - lo < 1e-9) continue;
            const r = p.x + (q.x - p.x) * ((a - p.y) / (q.y - p.y));
            if (best === null || r > best) best = r;
        }
        return best;
    };
    for (const d of DESIGNATIONS) {
        const g = geo(d);
        const prof = rimProfile(g);
        let worst = Infinity;
        for (const p of tireMeridian(g, { profileDetail: 1.4 })) {
            const br = barrelAt(prof, p.a);
            if (br !== null) worst = Math.min(worst, p.r - br);
        }
        assert.ok(worst > 0.5, `${d}: tire is ${(-worst).toFixed(2)} mm inside the rim`);
    }
});

test('the rim bead seats are symmetric about the wheel centerline', () => {
    for (const d of DESIGNATIONS) {
        const g = geo(d);
        const prof = rimProfile(g);
        const seats = prof.filter((p) => Math.abs(p.x - g.rimRadius) < 1e-6).map((p) => p.y);
        assert.equal(seats.length, 2, `${d}: expected exactly two bead seats`);
        assert.ok(Math.abs(seats[0] + seats[1]) < 1e-6,
            `${d}: bead seats at ${seats[0].toFixed(1)} and ${seats[1].toFixed(1)} are not symmetric`);
    }
});

test('the lug nuts stand on the disc face, where they can be seen', () => {
    // They stood 24 to 74 mm BEHIND it on every tire in the library, because
    // the hub placed them off its own boss length while the disc was placed
    // off `offsetRatio`. Neither module was wrong on its own terms; they
    // simply were not reading the same number.
    for (const d of DESIGNATIONS) {
        const g = geo(d);
        for (const sign of [1, -1]) {
            const w = wheelStations(g, { offsetRatio: 0.30 * sign });
            const padRise = w.webThickness * 0.55;
            const nutBase = w.faceX + w.sign * padRise;
            assert.ok(w.sign * (nutBase - w.faceX) > 0,
                `${d}: lug nuts do not clear the disc face`);
            // ...and inside the tire, not sticking out through the sidewall.
            assert.ok(Math.abs(nutBase + w.sign * g.rimRadius * 0.052) < g.sectionWidth / 2,
                `${d}: lug nuts protrude past the tire's section width`);
        }
    }
});

test('the hub boss closes the wheel bore, and a hand hole reads as a hole', () => {
    for (const d of DESIGNATIONS) {
        const g = geo(d);
        const w = wheelStations(g, { offsetRatio: 0.30 });
        // A 0.28 boss inside a 0.30 bore left a ring of daylight into the
        // barrel on every wheel; the boss is now sized FROM the bore.
        assert.ok(w.boreR * 1.06 > w.boreR, `${d}: boss does not overlap the bore`);
        // The holes have to clear the raised hub pad and the nuts standing on
        // it, or they are not holes but scallops in the pad's edge...
        const nutOuter = w.studCircleR + g.rimRadius * 0.042;
        assert.ok(w.handHoleRingR - w.handHoleR > w.padR,
            `${d}: hand holes are cut into the hub pad`);
        assert.ok(w.padR > nutOuter, `${d}: lug nuts overhang the hub pad`);
        // ...and stay inside the rim of the web.
        assert.ok(w.handHoleRingR + w.handHoleR < w.webOuterR,
            `${d}: hand holes break the rim of the web`);
    }
});

test('the tire is a shell, so its sidewall is drawn from both faces', () => {
    // A hand hole looks through the wheel at the FAR sidewall from inside.
    // Culled to the front only that is a line of sight out of the back of the
    // wheel, and the holes rendered as white discs on a black tire. Three
    // surfaces in the wheel are single-thickness and have to say so; the tread
    // is not one of them, and is the larger half of the tire's mesh.
    assert.equal(MATERIAL_SPECS.rubberSidewall.doubleSided, true, 'sidewall');
    assert.equal(MATERIAL_SPECS.rimBarrel.doubleSided, true, 'rim barrel');
    assert.equal(MATERIAL_SPECS.aluminum.doubleSided, true, 'rim disc');
    assert.ok(!MATERIAL_SPECS.rubberTread.doubleSided, 'tread must stay single-sided');
});

test('the triangle budget survives a class 13 turnpike double', () => {
    // 34 tires, and the gear matrix renders four assemblies at once. `draft`
    // is the level `pickQuality` chooses above 20 tires, so it is the one that
    // has to hold. Adaptive meridian sampling raised the row count by two
    // thirds; this is the ceiling that says by how much more it may.
    const CEILING = 1.2e6;
    for (const d of DESIGNATIONS) {
        const t = buildTireGeometry(geo(d), { quality: 'draft', pattern: 'lug', designation: d });
        const tris = (t.index ? t.index.count : t.attributes.position.count) / 3;
        assert.ok(tris * 34 <= CEILING,
            `${d}: 34 tires at draft is ${(tris * 34 / 1e6).toFixed(2)} M triangles`);
    }
});

test('the wheel proportions stay inside the rim they describe', () => {
    // WHEEL is a table of ratios, and every one of them is a radius on a disc
    // that has to fit between the hub bore and the drop-center well.
    assert.ok(WHEEL.bore < WHEEL.studCircle, 'stud circle inside the bore');
    assert.ok(WHEEL.studCircle < WHEEL.pad, 'studs outside the hub pad they sit on');
    assert.ok(WHEEL.pad < WHEEL.webOuter, 'hub pad wider than the web');
    assert.ok(WHEEL.handHoleRing + WHEEL.handHole < 1 - WHEEL.drop,
        'hand holes reach past the drop-center well');
});

test('every geometry the assembly instances carries a bounding volume', () => {
    // InstancedMesh is built with `frustumCulled = false`, so a missing
    // bounding sphere is silent until something calls raycast on it — which
    // is exactly what picking a wheel does.
    const g = geo('295/75R22.5');
    for (const [name, built] of Object.entries({
        tire: buildTireGeometry(g, { quality: 'standard', pattern: 'lug' }),
        disc: buildRimDisc(g, { quality: 'standard', offsetRatio: 0.30 }),
        hub: buildHubGeometry(g, { quality: 'standard', offsetRatio: 0.30 })
    })) {
        assert.ok(built.boundingSphere, `${name}: no bounding sphere`);
        assert.ok(Number.isFinite(built.boundingSphere.radius) && built.boundingSphere.radius > 0,
            `${name}: bounding sphere radius is ${built.boundingSphere?.radius}`);
    }
    assert.ok(THREE.REVISION, 'three.js is loaded');
});
