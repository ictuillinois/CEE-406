/** Rebuild the locally hosted source bodies and perform actual pixel comparisons.
 * Usage: node scripts/build-gear3d-bodies.mjs <source-directory>
 * Requires Playwright (development only) and Chrome; see the review README.
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const sourceDir=path.resolve(process.argv[2] || '.tmp/vehicle-reference');
const root=process.cwd();
const specs=[
    ...['B737','A380','B787','A320','A350'].map(id=>({id,file:`${id}.glb`,rotation:Math.PI/2})),
    {id:'B747',file:'B747.glb',rotation:-Math.PI/2},
    ...['sedan','truck','delivery','delivery-flat'].map(id=>({id,file:`kenney/Models/GLB format/${id}.glb`,rotation:Math.PI})),
    {id:'trailer',file:'kenney/Models/GLB format/delivery.glb',rotation:Math.PI},
    {id:'bus',file:'Bus.obj',rotation:-Math.PI/2},
    {id:'motorcycle',file:'motorcycle.glb',rotation:0}
];
for(const spec of specs) if(!fs.existsSync(path.join(sourceDir,spec.file))) throw Error(`Missing source: ${spec.file}`);
const server=http.createServer((req,res)=>{
    const requestPath=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const source=requestPath.startsWith('/__source/');
    const base=source?sourceDir:root;
    const file=path.resolve(base,'.'+(source?requestPath.slice('/__source'.length):requestPath));
    if(!file.startsWith(base+path.sep)){res.writeHead(403).end();return;}
    const type={'.html':'text/html','.js':'text/javascript','.glb':'model/gltf-binary','.obj':'text/plain'}[path.extname(file)]||'application/octet-stream';
    try {const data=fs.readFileSync(file);res.writeHead(200,{'Content-Type':type});res.end(data);}catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
    const page=await browser.newPage();
    await page.goto(`${origin}/scripts/gear3d-body-assets/viewer.html`);
    await page.waitForFunction(()=>window.ready);
    for(const file of ['prepare','compare'])await page.addScriptTag({type:'module',url:`${origin}/scripts/gear3d-body-assets/${file}.js`});
    await page.waitForFunction(()=>window.readyBake&&window.readyCompare);
    const assets='public/gear3d/bodies', review='docs/gear3d-body-review';
    fs.mkdirSync(assets,{recursive:true});fs.mkdirSync(review,{recursive:true});
    const manifest={}, comparisons=[];
    for(const spec of specs){
        spec.url='/__source/'+spec.file;
        const result=await page.evaluate(s=>window.prepareBody(s),spec);
        fs.writeFileSync(`${assets}/${spec.id}.glb`,Buffer.from(result.bytes));
        manifest[spec.id]={...result.meta,triangles:result.triangles,bytes:result.bytes.length};
        for(const view of ['iso','side','top']){
            const r=await page.evaluate(({spec,view})=>window.compareBody(spec,view),{spec,view});
            fs.writeFileSync(`${review}/${spec.id}-${view}.png`,Buffer.from(r.png,'base64'));
            comparisons.push({id:spec.id,view,...r.metrics});
            if(r.metrics.foregroundMae>.5 || r.metrics.silhouetteIoU<.999)
                throw Error(`${spec.id} ${view}: geometry fidelity regression`);
        }
        console.log(`${spec.id}: ${result.triangles} triangles, ${result.bytes.length} bytes; three image comparisons passed`);
    }
    fs.writeFileSync(`${assets}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');
    fs.writeFileSync(`${review}/pixel-comparison.json`,JSON.stringify(comparisons,null,2)+'\n');
} finally { await browser.close(); server.close(); }
