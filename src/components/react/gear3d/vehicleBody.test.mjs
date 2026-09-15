import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import * as THREE from 'three';
import { resolveLayout } from './engine/core/layout.js';
import { setNominalTable } from './engine/core/tires.js';
import { buildVehicleBody, ensureVehicleBody, disposeVehicleBodies, vehicleBodySpec }  from './engine/geometry/vehicleBody.js';
import { buildAssembly } from './engine/geometry/assembly.js';
import { buildExportScene } from './engine/io/exportScene.js';

setNominalTable(JSON.parse(readFileSync('public/gear3d/data/tires.json')).nominal);
const units = ['trucks', 'aircraft'].flatMap(domain =>
    readdirSync(`public/gear3d/data/${domain}`).filter(f=>f.endsWith('.json'))
        .flatMap(f=>JSON.parse(readFileSync(`public/gear3d/data/${domain}/${f}`)).units || []));

// Exercise shipped GLBs through the production loader, without a server.
globalThis.ProgressEvent ??= class extends Event { constructor(type, props) { super(type); Object.assign(this, props); } };
const originalFetch = globalThis.fetch;
globalThis.fetch = async (request) => new Response(readFileSync(new URL(request.url || request)));
for (const unit of units) await ensureVehicleBody(unit, new URL('../../../../public/gear3d/', import.meta.url).href);
globalThis.fetch = originalFetch;
test.after(() => disposeVehicleBodies());

test('every library body has finite, lightweight geometry above pavement; schematics omitted', () => {
    for (const unit of units) {
        const before = JSON.stringify(unit);
        const body = buildVehicleBody(resolveLayout(unit));
        if (!vehicleBodySpec(unit)) { assert.equal(body, null); continue; }
        assert.ok(body, unit.id);
        const bounds = new THREE.Box3().setFromObject(body);
        assert.ok(bounds.min.y >= 0, `${unit.id}: bottom ${bounds.min.y}`);
        let triangles = 0;
        const vertex = new THREE.Vector3();
        for (const mesh of body.children) {
            assert.ok(Array.from(mesh.geometry.attributes.position.array).every(Number.isFinite), unit.id);
            triangles += (mesh.geometry.index?.count || mesh.geometry.attributes.position.count)/3;
            const positions = mesh.geometry.attributes.position;
            for (let i=0; i<positions.count; i++) {
                vertex.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);
                assert.ok(bounds.containsPoint(vertex), `${unit.id}: camera bounds exclude a body vertex`);
            }
            assert.equal(mesh.material.depthWrite, false);
            assert.equal(mesh.userData.pickable, false);
            mesh.geometry.dispose();
        }
        assert.ok(triangles < 6000, `${unit.id}: ${triangles}`);
        body.children[0].material.dispose();
        assert.equal(JSON.stringify(unit), before);
    }
});

test('body is lazy, follows visibility, fits bounds and stays out of engineering exports', () => {
    const material = new THREE.MeshBasicMaterial();
    const materials = { get:()=>material, tireMaterials:()=>[material,material], ghost:()=>material };
    const assembly = buildAssembly(resolveLayout(units.find(u=>u.id==='b747-400')), materials);
    assert.equal(assembly.hasVehicleBody(), false);
    const baseline = buildExportScene({assembly});
    assembly.setWheelFilter(()=>true, {vehicleBody:true});
    assert.equal(assembly.hasVehicleBody(), true);
    const body = assembly.root.getObjectByName('vehicle-body');
    assert.equal(body.visible, true);
    assert.ok(assembly.visibleBounds().containsBox(new THREE.Box3().setFromObject(body)));
    const withBody = buildExportScene({assembly});
    assert.equal(withBody.triangleCount, baseline.triangleCount);
    assembly.setWheelFilter(()=>true);
    assert.equal(body.visible, false);
    assembly.dispose(); material.dispose();
});
