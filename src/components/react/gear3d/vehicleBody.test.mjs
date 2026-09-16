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
        new Set(body.children.map(mesh=>mesh.material)).forEach(material=>material.dispose());
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


test('bus faces the steering axle and tractors span only their drive group', () => {
    for (const unit of units.filter(u=>u.domain==='truck')) {
        const layout=resolveLayout(unit),body=buildVehicleBody(layout);
        if(!body)continue;
        if(body.userData.bus) {
            assert.equal(body.userData.forwardAxis,'-Z');
            const nose=body.getObjectByName('vehicle-body:destination-panel');
            const tail=body.getObjectByName('vehicle-body:rear-grille');
            nose.geometry.computeBoundingBox();tail.geometry.computeBoundingBox();
            assert.ok(nose.geometry.boundingBox.max.z < Math.min(...layout.axles.map(a=>a.x)));
            assert.ok(tail.geometry.boundingBox.min.z > Math.max(...layout.axles.map(a=>a.x)));
            assert.ok(body.children.some(m=>m.name==='vehicle-body:windows'));
        }
        if(body.userData.tractor) {
            const fit=body.userData.tractor,drive=layout.axles.filter(a=>a.role==='drive');
            assert.equal(fit.rear,Math.max(...drive.map(a=>a.x)));
            assert.ok(fit.cabEnd>fit.front);
            assert.ok(fit.rearEnd>fit.rear);
            const cab=body.getObjectByName('vehicle-body:tractor');
            cab.geometry.computeBoundingBox();
            assert.ok(cab.geometry.boundingBox.min.z<fit.front);
            assert.ok(cab.geometry.boundingBox.max.z>=fit.rear-1);
        }
        body.children.forEach(m=>m.geometry.dispose());
        new Set(body.children.map(m=>m.material)).forEach(m=>m.dispose());
    }
});
