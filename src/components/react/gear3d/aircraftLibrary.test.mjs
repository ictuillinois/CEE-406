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
    assert.equal(units.length,18);
    for(const u of units) {
        assert.deepEqual(validateUnit(u).errors,[],u.id);
        const layout=resolveLayout(u);
        const row=audit.imported.find(r=>r.id===u.id);
        const mains=layout.wheels.filter(w=>w.axleId!=='NLG');
        assert.equal(mains.length,row.mainWheelCoordinatesMm.length);
        if(u.id!=='a350-1000' && !row.geometryOverride) for(const p of row.mainWheelCoordinatesMm) {
            assert.ok(mains.some(w=>Math.abs(w.x-u.wheelbase-p.x)<.001 && Math.abs(w.y-p.y)<.001),u.id);
        }
        const kg=u.mtow.value*(u.mtow.unit==='lb'?.45359237:1);
        assert.ok(Math.abs(layout.wheels.reduce((s,w)=>s+w.loadKn,0)-kg*9.80665/1000)<1e-8);
        assert.equal(vehicleBodySpec(u).representative,false);
    }
});

test('regional aircraft use explicit manufacturers and independently reviewed footprints',()=>{
    const expected={
        'e170-std':['Embraer',10620,5200,710,126],
        'e190-std':['Embraer',13830,5940,870,157],
        'crj700':['Bombardier / Canadair',590.98*25.4,162*25.4,24.52*25.4,142],
        'crj900':['Bombardier / Canadair',681.07*25.4,160*25.4,24.52*25.4,162],
        'dhc8-400':['De Havilland Canada',549*25.4,8800,533.4,227],
        'atr42-500':['ATR',8781,4100,380,8.6*14.503773773]
    };
    for(const [id,[manufacturer,wb,track,pitch,pressure]] of Object.entries(expected)) {
        const u=units.find(u=>u.id===id),row=audit.imported.find(r=>r.id===id);
        assert.equal(u.manufacturer,manufacturer);
        assert.equal(row.workbookCategory,'Regional/Commuter');
        assert.equal(u.wheelbase,wb);
        assert.equal(u.mainGearTrack,track);
        assert.equal(u.tirePressure.value,pressure);
        const mains=resolveLayout(u).wheels.filter(w=>w.axleId!=='NLG');
        for(const side of [-1,1])for(const offset of [-pitch/2,pitch/2])
            assert.ok(mains.some(w=>Math.abs(w.x-wb)<1e-6 && Math.abs(w.y-(side*track/2+offset))<1e-6),id);
        assert.ok(u.maxTaxiWeight.value>u.mtow.value,'taxi and takeoff are distinct');
        assert.ok(row.reference && row.corrections.length);
    }
    assert.equal(units.find(u=>u.id==='dhc8-400').gears[1].tire,'32x8.8-16');
    assert.equal(units.find(u=>u.id==='atr42-500').gears[1].tire,'32x8.8R16');
});

test('invalid aircraft visual attachment dimensions are rejected on import',()=>{
    const original=units.find(u=>u.id==='dhc8-400');
    for(const bodyFit of [
        {...original.bodyFit,tailHeight:-1},
        {...original.bodyFit,noseOffset:original.bodyFit.length+1},
        {...original.bodyFit,attachmentHeights:{main:'unknown'}}
    ]) assert.ok(validateUnit({...original,bodyFit}).errors.some(e=>e.includes('bodyFit')));
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
    assert.equal(vehicleBodySpec({...units[0],id:'b767-999'}),null);
});

test('757 and 767 variants retain their published footprints and distinct bodies',()=>{
    const additions=read('public/gear3d/data/aircraft/boeing-757-767.json').units;
    const expected=[
        ['b757-200','B757-200',720,288,24,34,45,255500,256000,183],
        ['b757-300','B757-300',880,288,24,34,45,270000,271000,200],
        ['b767-200','B767-200',775,366,25,45,56,315000,317000,165],
        ['b767-300er','B767-300',896,366,25,45,56,412000,413000,200],
        ['b767-400er','B767-400',1030,366,25,45.8,54,450000,451000,213]
    ];
    assert.equal(additions.length,expected.length);
    const index=read('public/gear3d/data/aircraft/index.json');
    const catalog=index.files.flatMap(f=>read(`public/gear3d/data/aircraft/${f}`).units);
    assert.equal(new Set(catalog.map(u=>u.id)).size,catalog.length,'catalog IDs remain unique');
    for(const [id,body,wb,track,nose,dual,tandem,mtow,taxi,psi] of expected) {
        const u=additions.find(u=>u.id===id),layout=resolveLayout(u);
        assert.deepEqual(validateUnit(u).errors,[],id);
        assert.equal(vehicleBodySpec(u).id,body);
        assert.equal(vehicleBodySpec(u).representative,false);
        assert.equal(u.mtow.value,mtow);assert.equal(u.maxTaxiWeight.value,taxi);
        assert.equal(u.tirePressure.value,psi);
        assert.ok(Math.abs(u.wheelbase-wb*25.4)<1e-6);
        assert.ok(Math.abs(u.mainGearTrack-track*25.4)<1e-6);
        assert.ok(Math.abs(u.gears[0].dualSpacing-nose*25.4)<1e-6);
        const mains=layout.wheels.filter(w=>w.axleId!=='NLG');
        assert.equal(mains.length,8);
        for(const side of [-1,1])for(const row of [-1,1])for(const across of [-1,1])
            assert.ok(mains.some(w=>Math.abs(w.x-(wb+row*tandem/2)*25.4)<1e-6 &&
                Math.abs(w.y-(side*track/2+across*dual/2)*25.4)<1e-6),id);
        assert.ok(Math.abs(layout.wheels.reduce((s,w)=>s+w.loadKn,0)-mtow*.45359237*9.80665/1000)<1e-8);
        assert.ok(u.sources[0].url.startsWith('https://www.boeing.com/'));
    }
});
test('new families retain manufacturer tire corrections and disclose A220 source conflicts',()=>{
    const a321=units.find(u=>u.id==='a321-200');
    assert.equal(a321.gears[1].tire,'1270x455R22');
    assert.equal(vehicleBodySpec(a321).id,'A321');
    for(const [id,body,takeoff,taxi] of [
        ['a220-100','A220-100',140500,141500],['a220-300','A220-300',156300,157000]
    ]) {
        const u=units.find(u=>u.id===id);
        assert.equal(u.gears[1].tire,'H42x15.0R21');
        assert.equal(u.gears[0].tire,'27x8.5R12');
        assert.equal(u.mtow.value,takeoff);
        assert.equal(u.maxTaxiWeight.value,taxi);
        assert.ok(u.assumedFields.some(f=>f.includes('conflicting manufacturer')));
        assert.equal(vehicleBodySpec(u).id,body);
    }
    assert.equal(vehicleBodySpec(units.find(u=>u.id==='a330-200')).id,'A330-200');
    assert.equal(vehicleBodySpec(units.find(u=>u.id==='a330-300')).id,'A330-300');
});
