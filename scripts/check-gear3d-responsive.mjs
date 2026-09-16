const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
mkdirSync('.tmp/vehicle-reference',{recursive:true});
const browser=await chromium.launch({channel:'chrome'});
try {
for(const [name,width,height,touch] of [['phone-small',320,740,true],['phone',390,844,true],['phone-landscape',844,390,true],['tablet',768,1024,true],['tablet-landscape',1024,768,true],['desktop',1600,1100,false]]) {
    const context=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch,deviceScaleFactor:1});
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(process.argv[2] || 'http://127.0.0.1:8766/.tmp/vehicle-reference/app.html');
    await page.waitForFunction(()=>window.gear3d?.assembly?.hasVehicleBody());
    await page.locator('.g3-figure').scrollIntoViewIfNeeded();
    for(const mode of ['quad','3d']) {
        await page.locator(`[data-view="${mode}"]`).click();
        await page.locator('.g3-figure').scrollIntoViewIfNeeded();
        await page.waitForTimeout(200);
        const layout=await page.evaluate(()=>{
            const rect=id=>{const r=document.getElementById(id).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
            return {canvas:rect('g3-canvas'),copy:rect('g3-figure-copy'),download:rect('g3-figure-download'),select:rect('g3-figure-background'),hud:rect('g3-hud'),overflow:document.documentElement.scrollWidth>innerWidth,helpOpen:document.querySelector('.g3-view-help').open};
        });
        assert.equal(layout.overflow,false,`${name}: horizontal overflow`);
        assert.equal(layout.helpOpen,false);
        for(const key of ['copy','download','select']){
            assert.ok(layout[key].bottom<=layout.canvas.y+1,`${name}: ${key} overlaps canvas`);
            assert.ok(layout[key].x>=0&&layout[key].right<=width,`${name}: ${key} clipped`);
            if(touch)assert.ok(layout[key].height>=44,`${name}: ${key} touch height`);
        }
        assert.ok(layout.hud.y>=layout.canvas.bottom-1);
        assert.ok(layout.canvas.width>200&&layout.canvas.height>180,`${name}: canvas too small`);
        await page.locator('.g3-figure').screenshot({path:`.tmp/vehicle-reference/responsive-${name}-${mode}.png`});
    }
    await page.locator('.g3-view-help summary').click();
    assert.equal(await page.locator('#g3-hud-right').isVisible(),true);
    assert.ok(await page.evaluate(()=>document.getElementById('g3-hud-right').getBoundingClientRect().top>=document.getElementById('g3-canvas').getBoundingClientRect().bottom));
    assert.deepEqual(errors,[]);console.log(`${name}: controls fit, no canvas overlap, help opens below canvas`);await context.close();
}
}finally{await browser.close();}
