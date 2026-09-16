import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateUnit} from './engine/core/schema.js';
import {resolveLayout} from './engine/core/layout.js';
import {vehicleBodySpec} from './engine/geometry/vehicleBody.js';

const read=p=>JSON.parse(readFileSync(p,'utf8'));
const units=read('public/gear3d/data/aircraft/aircrafter-reviewed.json').units;
const audit=read('docs/gear3d-body-review/aircrafter-audit.json');
test('reviewed aircraft validate and preserve the workbook footprints unless explicitly corrected',()=>{
    assert.equal(units.length,6);
    for(const u of units) {
        assert.deepEqual(validateUnit(u).errors,[],u.id);
        const layout=resolveLayout(u);
        const row=audit.imported.find(r=>r.id===u.id);
        const mains=layout.wheels.filter(w=>w.axleId!=='NLG');
        assert.equal(mains.length,row.mainWheelCoordinatesMm.length);
        if(u.id!=='a350-1000') for(const p of row.mainWheelCoordinatesMm) {
            assert.ok(mains.some(w=>Math.abs(w.x-u.wheelbase-p.x)<.001 && Math.abs(w.y-p.y)<.001),u.id);
        }
        const kg=u.mtow.value*(u.mtow.unit==='lb'?.45359237:1);
        assert.ok(Math.abs(layout.wheels.reduce((s,w)=>s+w.loadKn,0)-kg*9.80665/1000)<1e-8);
        assert.equal(vehicleBodySpec(u).representative,false);
    }
});
test('A350-1000 uses the manufacturer track, wider middle axle and smaller main tires',()=>{
    const u=units.find(u=>u.id==='a350-1000');
    const wheels=resolveLayout(u).wheels.filter(w=>w.axleId==='MLG-R');
    assert.equal(u.mainGearTrack,10734);
    for(let row=0;row<3;row++) {
        const ys=wheels.filter(w=>w.row===row).map(w=>w.y);
        assert.equal(Math.max(...ys)-Math.min(...ys),row===1?1474:1397);
    }
    assert.equal(u.gears[1].tire,'50x20R22');
});
test('unknown aircraft never silently acquire a 787 body',()=>{
    assert.equal(vehicleBodySpec({...units[0],id:'c17'}),null);
});
