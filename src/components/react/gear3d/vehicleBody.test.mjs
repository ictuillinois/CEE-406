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
        const detailed=['A319','A321','A330-200','A330-300','A220-100','A220-300','B777',
            'E170','E190','CRJ700','CRJ900','DHC8-400','ATR42'].includes(vehicleBodySpec(unit).id);
        assert.ok(triangles < (detailed?30000:6000), `${unit.id}: ${triangles}`);
        if(detailed) assert.equal(body.children.length,1,'detailed aircraft use one body draw call');
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

test('turboprops retain calibrated span, ground attitude and nacelle/sponson struts',()=>{
    const material=new THREE.MeshBasicMaterial();
    const materials={get:()=>material,tireMaterials:()=>[material,material],ghost:()=>material};
    for(const id of ['dhc8-400','atr42-500']) {
        const unit=units.find(u=>u.id===id),layout=resolveLayout(unit);
        const assembly=buildAssembly(layout,materials);
        const baseline=buildExportScene({assembly});
        assembly.setWheelFilter(()=>true,{vehicleBody:true});
        const body=assembly.root.getObjectByName('vehicle-body');
        const bounds=new THREE.Box3().setFromObject(body);
        assert.ok(Math.abs(bounds.max.y-unit.bodyFit.tailHeight)<1,id);
        assert.ok(Math.abs(bounds.min.z+unit.bodyFit.noseOffset)<1,id);
        if(id==='atr42-500')assert.ok(Math.abs(bounds.max.x-bounds.min.x-24572)<1,'ATR published span');
        for(const a of layout.axles) {
            const pin=assembly.root.getObjectByName(`axle:${a.id}`).getObjectByName('trunnion');
            assert.equal(pin.position.y,unit.bodyFit.attachmentHeights[a.role]);
            if(id==='atr42-500' && a.role==='main') {
                const gear=unit.gears.find(g=>g.id===a.id);
                assert.ok(Math.abs(pin.position.x+Math.sign(gear.y)*500)<1e-6,
                    'sponson struts lean inward without moving the axle');
            }
        }
        assert.equal(buildExportScene({assembly}).triangleCount,baseline.triangleCount,'body stays out of engineering export');
        assembly.dispose();
    }
    material.dispose();
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
            assert.ok(cab.geometry.boundingBox.min.z>fit.front, 'cab follows the hood');
            assert.ok(cab.geometry.boundingBox.max.z<fit.firstDrive, 'sleeper stops ahead of drive tires');
            const hood=body.getObjectByName('vehicle-body:hood');
            assert.ok(hood.geometry.boundingBox.min.z<fit.front-800);
            assert.ok(hood.geometry.boundingBox.max.z-hood.geometry.boundingBox.min.z>1300);
            const frame=body.getObjectByName('vehicle-body:frame-rail');
            assert.ok(frame.geometry.boundingBox.max.z>fit.rear);
            assert.ok(body.userData.trailers[0].start>fit.cabEnd);
            assert.ok(body.userData.trailers[0].start<fit.rear, 'trailer overlaps fifth wheel');
            for(const trailer of body.userData.trailers) {
                assert.ok(trailer.end>trailer.start);
                assert.ok(trailer.roof-trailer.floor>2500);
            }
        }
        body.children.forEach(m=>m.geometry.dispose());
        new Set(body.children.map(m=>m.material)).forEach(m=>m.dispose());
    }
});


test('trailer axle edits do not distort the conventional hood or cab', () => {
    const unit=units.find(u=>u.id==='fhwa-c09-3S2');
    const original=resolveLayout(unit),edited=resolveLayout(unit);
    edited.axles.filter(a=>a.role==='trailer').forEach(a=>a.x+=3000);
    const bodies=[buildVehicleBody(original),buildVehicleBody(edited)];
    for(const name of ['hood','tractor','windshield','frame-rail','fifth-wheel']) {
        assert.deepEqual(bodies[0].getObjectByName('vehicle-body:'+name).geometry.attributes.position.array,
            bodies[1].getObjectByName('vehicle-body:'+name).geometry.attributes.position.array);
    }
    assert.equal(bodies[1].userData.trailers[0].end-bodies[0].userData.trailers[0].end,3000);
    for(const body of bodies){body.children.forEach(m=>m.geometry.dispose());new Set(body.children.map(m=>m.material)).forEach(m=>m.dispose());}
});
