import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {swapToWideBase,restoreDualTires} from './engine/core/layout.js';
import {setNominalTable,resolveTire} from './engine/core/tires.js';
import {serializeProject,parseProject} from './engine/io/project.js';
import {styleVehicleBody} from './engine/geometry/vehicleBody.js';
import * as THREE from 'three';
setNominalTable(JSON.parse(readFileSync('public/gear3d/data/tires.json')).nominal);
const units=readdirSync('public/gear3d/data/trucks').filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync('public/gear3d/data/trucks/'+f)).units || []);

test('every dual axle restores exactly after each WBT size and project round trip',()=>{
    let checked=0;
    for(const unit of units)for(const axle of unit.axles || [])if(axle.tireConfig==='DTA') {
        for(const size of ['445/50R22.5','455/55R22.5','425/65R22.5']) {
            const original=structuredClone(axle),swap=swapToWideBase(axle,size).axle;
            const outer=a=>a.trackWidth/2+(a.dualSpacing || 0)/2+resolveTire(a.tire).geometry.sectionWidth/2;
            assert.ok(Math.abs(outer(axle)-outer(swap))<.06);
            const saved=parseProject(serializeProject({unit:{...unit,axles:[swap]},view:{}}));
            assert.deepEqual(restoreDualTires(saved.unit.axles[0]),original);
            assert.deepEqual(axle,original);checked++;
        }
    }
    assert.ok(checked>20);
});
test('restoring tires retains later load and axle-position changes',()=>{
    const axle=units.flatMap(u=>u.axles || []).find(a=>a.tireConfig==='DTA');
    const swap=swapToWideBase(axle,'445/50R22.5').axle;
    swap.x+=750;swap.load={value:150,unit:'kN'};
    const restored=restoreDualTires(swap);
    assert.equal(restored.x,swap.x);assert.deepEqual(restored.load,swap.load);
    assert.equal(restored.trackWidth,axle.trackWidth);assert.equal(restored.dualSpacing,axle.dualSpacing);
    assert.throws(()=>restoreDualTires({...swap,originalDTA:undefined}),/No original/);
});
test('body styling is reversible and preserves glazing contrast without replacing geometry',()=>{
    const root=new THREE.Group();
    const body=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial({color:0x71899b,opacity:.28,transparent:true}));
    const glass=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial({color:0x294859,opacity:.43,transparent:true}));
    root.add(body,glass);const geometry=body.geometry;
    for(let i=0;i<5;i++) {styleVehicleBody(root,{opacity:.6,color:'#ad7044'});styleVehicleBody(root,{opacity:.28,color:'#71899b'});}
    assert.equal(body.geometry,geometry);assert.equal(body.material.opacity,.28);assert.equal(glass.material.opacity,.43);
    assert.equal(body.material.color.getHex(),0x71899b);assert.equal(glass.material.color.getHex(),0x294859);
    for(const mesh of root.children){mesh.geometry.dispose();mesh.material.dispose();}
});
