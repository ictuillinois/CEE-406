import assert from 'node:assert/strict';
import fs from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const units=JSON.parse(fs.readFileSync('public/gear3d/data/aircraft/aircrafter-reviewed.json')).units;
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
    const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(process.argv[2] || 'http://127.0.0.1:8770/tools/gear3d/');
    await page.waitForFunction(()=>window.gear3d?.assembly);
    await page.locator('#g3-domain').selectOption('aircraft');
    for(const unit of units) {
        await page.locator('#g3-unit').selectOption(unit.id);
        await page.waitForFunction(id=>gear3d.store.doc.unit.id===id && gear3d.assembly.hasVehicleBody(),unit.id);
        const fit=await page.evaluate(()=>gear3d.assembly.root.getObjectByName('vehicle-body').userData.aircraftFit);
        assert.equal(fit.length,unit.bodyFit.length);
        assert.equal(await page.evaluate(()=>gear3d.layout.wheels.length),unit.gears.reduce((s,g)=>s+g.wheelsAcross*g.tandemRows,0));
        await page.locator('.g3-figure').screenshot({path:`.tmp/vehicle-reference/review-${unit.id}.png`});
    }
    await page.locator('#g3-unit').selectOption('b777-300er');
    await page.waitForFunction(()=>gear3d.store.doc.unit.id==='b777-300er' && gear3d.assembly.hasVehicleBody());
    assert.match(await page.evaluate(()=>gear3d.assembly.root.getObjectByName('vehicle-body').userData.label),/B777/);
    await page.locator('.g3-figure').screenshot({path:'.tmp/vehicle-reference/review-b777-300er.png'});
    await page.setViewportSize({width:390,height:844});
    await page.waitForFunction(()=>{
        const rig=gear3d.viewport.cameras;
        const canvas=document.getElementById('g3-canvas').getBoundingClientRect();
        return Math.abs(rig.aspect-canvas.width/canvas.height)<.01;
    });
    assert.equal(await page.evaluate(()=>{
        const rig=gear3d.viewport.cameras,box=gear3d.assembly.visibleBounds();
        const size=box.getSize(box.min.clone());
        return ['plan','side','front'].every(mode=>{
            const extent=rig._extentsFor(mode,size),s=rig.states[mode];
            return extent.horizontal<=2*s.halfHeight*rig.aspect && extent.vertical<=2*s.halfHeight;
        });
    }),true,'resized Quad fits aircraft bounds');
    await page.locator('.g3-figure').screenshot({path:'.tmp/vehicle-reference/review-aircraft-mobile.png'});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.deepEqual(errors,[]);
    console.log(`PASS: ${units.length} aircraft select and render with expected wheels and body fit; mobile has no horizontal overflow; zero page errors.`);
} finally {await browser.close();}
