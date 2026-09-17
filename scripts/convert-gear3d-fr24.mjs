/** Convert the archived glTF 1 inputs to glTF 2 before the browser bake.
 * npm install --prefix <tools-directory> gltf-pipeline@4.3.1
 * GLTF_PIPELINE_MODULE points to that package's index.js when not installed here.
 * First extract models/*.glb from public/gear3d/bodies/sources/*-source.zip
 * into <source-directory>, naming each fr24-<model>.glb.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const module=await import(process.env.GLTF_PIPELINE_MODULE || 'gltf-pipeline');
const {processGlb}=module.default || module;
const directory=path.resolve(process.argv[2] || '.tmp/vehicle-reference');
const sources=JSON.parse(fs.readFileSync('public/gear3d/bodies/sources/manifest.json','utf8'));
for (const source of sources) {
    const bytes=fs.readFileSync(path.join(directory,`fr24-${source.model}.glb`));
    if(createHash('sha256').update(bytes).digest('hex')!==source.sha256)
        throw Error(`${source.model}: input differs from the reviewed source`);
    const result=await processGlb(bytes);
    fs.writeFileSync(path.join(directory,`${source.model}.glb`),result.glb);
    console.log(`${source.model}: converted glTF 1 to 2`);
}
