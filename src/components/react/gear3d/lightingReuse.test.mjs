import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {LightingRig} from './engine/scene/lighting.js';

test('ground refits retain GPU resources and preserve physical coverage',()=>{
    const scene=new THREE.Scene(),rig=new LightingRig(scene);
    rig.fit(new THREE.Box3(new THREE.Vector3(-1,0,-2),new THREE.Vector3(1,2,2)));
    const ground=rig.makeGround(),geometry=ground.geometry,material=ground.material;
    const positions=geometry.attributes.position;
    for(const [center,length] of [[12,20],[-3,4],[0,2]]) {
        rig.fit(new THREE.Box3(new THREE.Vector3(-1,0,center-length/2),new THREE.Vector3(1,2,center+length/2)));
        assert.equal(rig.makeGround(),ground);
        assert.equal(ground.geometry,geometry);
        assert.equal(ground.material,material);
        assert.equal(geometry.attributes.position,positions);
        assert.equal(ground.position.z,center);
        const bounds=new THREE.Box3().setFromObject(ground);
        assert.ok(Math.abs(bounds.getSize(new THREE.Vector3()).x-rig._radius*2.8)<1e-8);
        assert.ok(Math.abs(bounds.getCenter(new THREE.Vector3()).z-center)<1e-8);
    }
    rig.dispose();assert.equal(scene.getObjectByName('ground-shadow'),undefined);
});
