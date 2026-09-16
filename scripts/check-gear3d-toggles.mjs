const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
    const page=await browser.newPage({viewport:{width:1600,height:1100}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(process.argv[2] || 'http://localhost:4321/tools/gear3d/');
    await page.waitForFunction(()=>window.gear3d?.assembly);
    assert.deepEqual(await page.evaluate(()=>[gear3d.store.view.annotations,gear3d.store.view.showGrid,gear3d.viewport.showGrid]),[false,false,false]);
    for(const mode of ['quad','3d']) {
        await page.locator(`[data-view="${mode}"]`).click();
        await page.waitForTimeout(300);
        const result=await page.evaluate(()=>{
            const vp=gear3d.viewport,original=vp.renderScene;
            let draws=0;vp.renderScene=function(...args){draws++;return original.apply(this,args);};
            const timings=[],counts=[],gridIds=[];
            try {
                for(let i=0;i<8;i++){
                    const start=performance.now();document.getElementById('g3-annot').click();
                    timings.push(performance.now()-start);
                    counts.push(document.getElementById('g3-overlay').querySelectorAll('*').length);
                }
                const annotationDraws=draws;
                for(let i=0;i<4;i++){
                    document.getElementById('g3-grid').click();
                    gridIds.push({id:vp._grid.uuid,visible:vp._grid.visible,dirty:vp._dirty});
                    // Clear explicitly to prove each toggle requests a frame.
                    vp._dirty=false;
                }
                vp.invalidate();
                return {annotationDraws,counts,gridIds,maxHandlerMs:Math.max(...timings)};
            }finally{vp.renderScene=original;}
        });
        assert.equal(result.annotationDraws,0,'annotation toggle must not render WebGL');
        assert.ok(result.counts[0]>result.counts[1],'labels appear/disappear synchronously');
        assert.ok(result.counts.every((n,i)=>n===result.counts[i%2]));
        assert.equal(new Set(result.gridIds.map(g=>g.id)).size,1,'grid buffers reused');
        result.gridIds.forEach((g,i)=>{assert.equal(g.visible,i%2===0);assert.equal(g.dirty,true);});
        console.log(`${mode}: annotation toggle max ${result.maxHandlerMs.toFixed(1)} ms, zero GL redraws; grid reused and every toggle invalidates`);
    }
    const saved=page.waitForEvent('download');
    await page.locator('#g3-save').click();
    const file=await saved;
    const project=JSON.parse(readFileSync(await file.path(),'utf8'));
    for(const explicit of [true,false]) {
        if(explicit){project.view.annotations=true;project.view.showGrid=true;}
        else {delete project.view.annotations;delete project.view.showGrid;}
        await page.locator('#g3-file-input').setInputFiles({name:'toggles.gear3d',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
        await page.waitForFunction(on=>gear3d.store.view.annotations===on&&gear3d.store.view.showGrid===on,explicit);
        assert.equal(await page.locator('#g3-annot').getAttribute('aria-pressed'),String(explicit));
        assert.equal(await page.locator('#g3-grid').getAttribute('aria-pressed'),String(explicit));
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: fresh defaults and responsive annotation/grid toggles');
}finally{await browser.close();}
