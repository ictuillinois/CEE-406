/** Browser regression for the body controls and added aircraft. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({channel:'chrome'});
try {
 const page=await browser.newPage({viewport:{width:1600,height:1100}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.argv[2] || 'http://127.0.0.1:8768/');
 await page.waitForFunction(()=>window.gear3d?.assembly?.hasVehicleBody());
 await page.locator('#g3-domain').selectOption('aircraft');
 await page.locator('#g3-category').selectOption('2D');
 for(const id of ['b767-200er','b767-300f']) {
  await page.locator('#g3-unit').selectOption(id);
  await page.waitForFunction(()=>gear3d.assembly.hasVehicleBody());
  assert.equal(await page.evaluate(()=>gear3d.layout.wheels.length),10);
 }
 await page.locator('#g3-body-surface').evaluate(el=>el.closest('details').open=true);
 const original=await page.evaluate(()=>({uuid:gear3d.assembly.root.getObjectByName('vehicle-body').uuid,wheels:JSON.stringify(gear3d.layout.wheels)}));
 await page.locator('#g3-body-surface').selectOption('wireframe');
 await page.locator('#g3-body-finish').selectOption('metallic');
 await page.locator('#g3-body-detail').fill('90');
 await page.locator('#g3-body-detail').dispatchEvent('input');
 assert.equal(await page.locator('#g3-body-detail-value').textContent(),'90%');
 assert.equal(await page.evaluate(()=>gear3d.assembly.root.getObjectByName('vehicle-body').children[0].material.wireframe),true);
 assert.deepEqual(await page.evaluate(()=>({uuid:gear3d.assembly.root.getObjectByName('vehicle-body').uuid,wheels:JSON.stringify(gear3d.layout.wheels)})),original);
 const pending=page.waitForEvent('download');await page.locator('#g3-save').click();
 const project=JSON.parse(fs.readFileSync(await (await pending).path(),'utf8'));
 assert.equal(project.view.bodySurface,'wireframe');assert.equal(project.view.bodyFinish,'metallic');assert.equal(project.view.bodyDetail,90);
 await page.locator('#g3-body-reset').click();
 assert.deepEqual(await page.evaluate(()=>[gear3d.store.view.bodySurface,gear3d.store.view.bodyFinish,gear3d.store.view.bodyDetail]),['shaded','matte',65]);
 const open=async p=>{
  await page.locator('#g3-file-input').setInputFiles({name:'appearance.gear3d',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});
  await page.waitForFunction(()=>gear3d.assembly.hasVehicleBody());
 };
 await open(project);
 await page.waitForFunction(()=>gear3d.store.view.bodySurface==='wireframe');
 assert.equal(await page.locator('#g3-body-finish').inputValue(),'metallic');
 assert.equal(await page.locator('#g3-body-detail').inputValue(),'90');
 await page.waitForTimeout(1200);await page.reload();
 await page.waitForFunction(()=>window.gear3d?.store?.view.bodySurface==='wireframe' && window.gear3d?.assembly?.hasVehicleBody());
 delete project.view.bodySurface;delete project.view.bodyFinish;delete project.view.bodyDetail;
 await open(project);
 await page.waitForFunction(()=>gear3d.store.view.bodySurface==='shaded');
 assert.equal(await page.locator('#g3-body-finish').inputValue(),'matte');
 await page.locator('#g3-body-surface').evaluate(el=>el.closest('details').open=true);
 await page.locator('#g3-body-finish').selectOption('satin');
 await page.locator('[data-body-opacity="60"]').click();
 await page.locator('[data-view="3d"]').click();
 await page.locator('#g3-fit').click();await page.waitForTimeout(700);
 fs.mkdirSync('.tmp/gear-upgrade',{recursive:true});
 await page.screenshot({path:'.tmp/gear-upgrade/desktop.png'});
 await page.setViewportSize({width:390,height:844});
 await page.locator('#g3-body-surface').scrollIntoViewIfNeeded();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:'.tmp/gear-upgrade/mobile.png'});
 await page.locator('#g3-domain').selectOption('truck');
 assert.equal(await page.locator('#g3-body-detail').isDisabled(),true);
 assert.deepEqual(errors,[]);
 console.log('PASS: both aircraft, mesh reuse, material changes, project round trip, legacy defaults, autosave reload, reset and mobile layout.');
} finally {await browser.close();}
