import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { profileFor } from './chassis.js';

const templates = new Map();
const requests = new Map();
const failures = new Set();
let generation = 0;

/** Source shapes are representative bodies, not manufacturer CAD. */
export function vehicleBodySpec(unit) {
    if (!unit || unit.kind === 'schematic') return null;
    if (unit.domain === 'aircraft') {
        if (!unit.gears?.some(g => g.role === 'nose')) return null;
        const id = /747/.test(unit.id) ? 'B747' : /380/.test(unit.id) ? 'A380'
            : /737|757/.test(unit.id) ? 'B737' : 'B787';
        return { id, label: `Representative ${id} airframe`, aircraft: true,
            representative: !unit.id.toLowerCase().includes(id.toLowerCase()) };
    }
    if (unit.domain !== 'truck') return null;
    const profile = profileFor(unit.bodyType).key;
    const articulated = /tractor|trailer/.test(unit.bodyType || '');
    const id = { car: 'sedan', pickup: 'truck', bus: 'bus', motorcycle: 'motorcycle' }[profile]
        || (articulated ? 'delivery-flat' : 'delivery');
    return { id, label: articulated ? 'Cab and articulated trailer bodies' : `${profile} reference body`, articulated, secondary: articulated ? 'trailer' : null };
}

export function vehicleBodyStatus(unit) {
    const spec = vehicleBodySpec(unit);
    if (!spec) return 'unavailable';
    const ids=[spec.id,spec.secondary].filter(Boolean);
    return ids.every(id=>templates.has(id)) ? 'ready' : ids.some(id=>failures.has(id)) ? 'failed' : 'loading';
}

/** Load only selected bodies after opt-in; repeated requests share promises. */
export function ensureVehicleBody(unit, base) {
    const spec = vehicleBodySpec(unit);
    if (!spec) return Promise.resolve();
    return Promise.all([spec.id,spec.secondary].filter(Boolean).map(id=>{
        if(templates.has(id)||failures.has(id))return Promise.resolve();
        if(requests.has(id))return requests.get(id);
        const epoch=generation;
        const request=new GLTFLoader().loadAsync(`${base}bodies/${id}.glb`).then(gltf=>{
            if(epoch!==generation){disposeTemplate(gltf.scene);return;}
            templates.set(id,gltf.scene.children[0]);
        }).catch(()=>{if(epoch===generation)failures.add(id);});
        requests.set(id,request);return request;
    }));
}

function disposeTemplate(root) {
    root.traverse(o => {
        o.geometry?.dispose();
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
        else o.material?.dispose();
    });
}
export function disposeVehicleBodies() {
    generation++;
    templates.forEach(disposeTemplate);
    templates.clear(); requests.clear(); failures.clear();
}

/** Clone body meshes into the assembly's render frame in millimeters.
 * Source wheel centers anchor road vehicles; aircraft gear stations are
 * representative fractions, since these external airframes have no gear.
 */
export function buildVehicleBody(layout) {
    const spec = vehicleBodySpec(layout.unit);
    const template = spec && templates.get(spec.id);
    if (!template || vehicleBodyStatus(layout.unit) !== 'ready' || !layout.wheels.length) return null;
    const meta = template.userData;
    const group = new THREE.Group(); group.name = 'vehicle-body';
    group.userData = { illustrative: true, label: spec.label };
    const material = new THREE.MeshStandardMaterial({color:0x71899b,roughness:.85,
        transparent:true,opacity:.25,depthWrite:false,side:THREE.FrontSide});
    const xs = layout.axles.map(a=>a.x);
    let front = Math.min(...xs), rear = Math.max(...xs);
    let sx, sy, sz, lift;
    if (spec.aircraft) {
        const nose=layout.axles.find(a=>a.role==='nose');
        const mains=layout.axles.filter(a=>a.role==='main');
        if (!nose || !mains.length) {material.dispose();return null;}
        front=nose.x; rear=mains.reduce((sum,a)=>sum+a.x,0)/mains.length;
        sx=sy=sz=(rear-front)/(meta.rearAxle-meta.frontAxle);
        // Align the fuselage belly over the existing gear tops; engines may hang lower.
        let belly=Infinity;
        template.traverse(o=>{
            const p=o.geometry?.attributes.position;
            if(p) for(let i=0;i<p.count;i++) {
                if(Math.abs(p.getX(i))<meta.width*.045 &&
                    Math.abs(p.getZ(i)-meta.rearAxle)<meta.length*.07)
                    belly=Math.min(belly,p.getY(i));
            }
        });
        if (!Number.isFinite(belly)) belly=meta.minY;
        const gearTop=Math.max(...mains.map(a=>a.axleHeight+a.geometry.overallDiameter*1.35));
        lift=Math.max(gearTop-belly*sy, -meta.minY*sy + 150);
    } else {
        const drive=layout.axles.filter(a=>a.role==='drive');
        if(spec.articulated && drive.length) rear=Math.max(...drive.map(a=>a.x));
        const width=layout.extents.maxY-layout.extents.minY;
        sx=width/meta.width; sy=sx * (spec.id.startsWith('delivery') ? 1.35 : 1);
        sz=(rear-front)/(meta.rearAxle-meta.frontAxle);
        if(spec.id==='motorcycle') sx=sy=sz;
        lift=layout.axles[0].axleHeight-meta.axleY*sy;
    }
    if (![sx,sy,sz,lift].every(Number.isFinite) || sz<=0) {material.dispose();return null;}
    const offset=front-meta.frontAxle*sz;
    template.updateWorldMatrix(true,true);
    template.traverse(o=>{
        if(!o.isMesh)return;
        const geo=o.geometry.clone();
        const p=geo.attributes.position;
        for(let i=0;i<p.count;i++) {
            const z=p.getZ(i);
            const longitudinal = spec.aircraft ? z*sz+offset
                : z<meta.frontAxle ? front+(z-meta.frontAxle)*sx
                : z>meta.rearAxle ? rear+(z-meta.rearAxle)*sx
                : front+(z-meta.frontAxle)*sz;
            p.setXYZ(i,p.getX(i)*sx,p.getY(i)*sy+lift,longitudinal);
        }
        if (!spec.aircraft) geo.computeVertexNormals();
        geo.computeBoundingBox(); geo.computeBoundingSphere();
        const mesh=new THREE.Mesh(geo,material);mesh.name='vehicle-body:surface';
        mesh.userData.pickable=false;mesh.raycast=()=>{};
        group.add(mesh);
    });
    if(spec.articulated) {
        // Each separated trailer axle cluster carries its own cargo body.
        const trailer=layout.axles.filter(a=>a.role==='trailer').sort((a,b)=>a.x-b.x);
        let clusters=[];
        for(const a of trailer) {
            if(!clusters.length || a.x-clusters.at(-1).at(-1).x>3000) clusters.push([]);
            clusters.at(-1).push(a);
        }
        if (clusters.length > 2 && /full trailer|double/.test(layout.unit.bodyType || ''))
            clusters = [clusters[0], clusters.slice(1).flat()];
        let start=rear+700;
        const width=layout.extents.maxY-layout.extents.minY;
        for(const [i,cluster] of clusters.entries()) {
            const end=Math.max(...cluster.map(a=>a.x))+1200;
            if(end<=start)continue;
            const cargo=templates.get('trailer'), cm=cargo.userData;
            cargo.traverse(o=>{
                if(!o.isMesh)return;
                const geo=o.geometry.clone();
                geo.translate(0,-cm.minY,0);
                geo.scale(width/cm.width,2600/(cm.maxY-cm.minY),(end-start)/cm.length);
                geo.translate(0,1250,start);
                const mesh=new THREE.Mesh(geo,material);mesh.name=`vehicle-body:trailer-${i+1}`;
                mesh.userData.pickable=false;mesh.raycast=()=>{};group.add(mesh);
            });
            start=end+700;
        }
    }
    return group;
}
