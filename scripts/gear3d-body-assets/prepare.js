import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import * as THREE from 'three';
import {mergeGeometries, mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
// Source models are transformed rigidly into Y-up, nose -Z. No simplification.
window.prepareBody = async (spec) => {
 const source=await window.loadModel(spec.url);
 source.updateMatrixWorld(true);
 const rotation=new THREE.Matrix4().makeRotationY(spec.rotation || 0);
 const group=new THREE.Group();
 const mat=new THREE.MeshStandardMaterial({color:0x889bad,roughness:.8,side:THREE.FrontSide});
 const wheels=[];
 const namedWheels={};
 source.traverse(o=>{
  if(!o.isMesh)return;
  if(spec.removeGear) {
    for(let node=o;node;node=node.parent) if(/gear|wheel|tyre|tire/i.test(node.name))return;
  }
  let geo=o.geometry.clone().applyMatrix4(o.matrixWorld).applyMatrix4(rotation);
  // Baking a reflected node removes Three's automatic front-face reversal.
  // Reverse triangle winding to keep the source's exterior faces outward.
  if (o.matrixWorld.determinant() < 0) {
    const index=geo.index ? Array.from(geo.index.array) : Array.from({length:geo.attributes.position.count},(_,i)=>i);
    for(let i=0;i<index.length;i+=3) [index[i+1],index[i+2]]=[index[i+2],index[i+1]];
    geo.setIndex(index);
  }
  if (spec.id === 'trailer' && !/wheel/i.test(o.name)) {
    // Crop the source cargo shell above its wheel wells; interpolate the
    // original triangle surfaces instead of approximating them with boxes.
    const p=geo.attributes.position,n=geo.attributes.normal,idx=geo.index;
    const positions=[],normals=[];
    const count=idx?.count||p.count;
    for(let i=0;i<count;i+=3) {
      let poly=[0,1,2].map(k=>{const j=idx?idx.getX(i+k):i+k;return {
        p:new THREE.Vector3().fromBufferAttribute(p,j),n:new THREE.Vector3().fromBufferAttribute(n,j)};});
      for(const [axis,limit] of [['z',-.48],['y',.60]]) {
        const output=[];
        for(let j=0;j<poly.length;j++) {
          const a=poly[j],b=poly[(j+1)%poly.length],inside=a.p[axis]>=limit,next=b.p[axis]>=limit;
          if(inside)output.push(a);
          if(inside!==next){const t=(limit-a.p[axis])/(b.p[axis]-a.p[axis]);
            output.push({p:a.p.clone().lerp(b.p,t),n:a.n.clone().lerp(b.n,t).normalize()});}
        }
        poly=output;
      }
      for(let j=1;j<poly.length-1;j++)for(const v of [poly[0],poly[j],poly[j+1]]) {
        positions.push(...v.p.toArray());normals.push(...v.n.toArray());
      }
    }
    geo.dispose();geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
    if(!positions.length)return;
  }
  if (spec.id === 'motorcycle') {
    const pos=geo.attributes.position, old=geo.index;
    const retained=[];
    const count=old?.count || pos.count;
    for(let i=0;i<count;i+=3) {
      const ids=[0,1,2].map(k=>old?old.getX(i+k):i+k);
      const y=ids.reduce((a,j)=>a+pos.getY(j),0)/3;
      const z=ids.reduce((a,j)=>a+pos.getZ(j),0)/3;
      if (![-.29474,.40574].some(c=>Math.hypot(y-.142,z-c)<.155)) retained.push(...ids);
    }
    geo.setIndex(retained);
    geo=geo.toNonIndexed();
  }
  geo.computeBoundingBox();
  if(/wheel/i.test(o.name)) {
    const center=geo.boundingBox.getCenter(new THREE.Vector3());wheels.push(center);
    if(/FrontWheels/i.test(o.name))namedWheels.front=center;
    if(/BackWheels/i.test(o.name))namedWheels.rear=center;
    return;
  }
  // Retain position + normals only. UVs/textures and source wheels are irrelevant to an x-ray body.
  for(const key of Object.keys(geo.attributes))if(!['position','normal'].includes(key))geo.deleteAttribute(key);
  if (spec.id === 'bus') {
    // Keep authored glazing, lamps and trim as independent surfaces. Their
    // source polygons were previously invisible inside a uniform material.
    const attributes=geo.attributes, sourceMaterials=Array.isArray(o.material)?o.material:[o.material];
    for(const part of geo.groups) {
      const surface=sourceMaterials[part.materialIndex]?.name?.toLowerCase() || 'body';
      const partGeo=new THREE.BufferGeometry();
      for(const name of ['position','normal']) {
        const a=attributes[name], values=[];
        for(let i=part.start;i<part.start+part.count;i++) {
          const j=geo.index?geo.index.getX(i):i;
          values.push(a.getX(j),a.getY(j),a.getZ(j));
        }
        partGeo.setAttribute(name,new THREE.Float32BufferAttribute(values,3));
      }
      const mesh=new THREE.Mesh(partGeo,mat);mesh.name=`bus-${surface}`;
      mesh.userData.surface=surface;group.add(mesh);
    }
    geo.dispose();return;
  }
  geo.clearGroups();
  const mesh=new THREE.Mesh(geo,mat);mesh.name='body';group.add(mesh);
 });
 // The detailed aircraft contain many material primitives. Consolidate their
 // identical x-ray surfaces into one draw call without simplifying triangles.
 if(spec.merge) {
   const geometries=group.children.map(m=>m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone());
   const joined=mergeGeometries(geometries);
   const compact=mergeVertices(joined,1e-6);
   group.children.forEach(m=>m.geometry.dispose());
   geometries.forEach(g=>g.dispose());joined.dispose();group.clear();
   group.add(new THREE.Mesh(compact,mat));
 }
 const box=new THREE.Box3().setFromObject(group), size=box.getSize(new THREE.Vector3());
 const offset=new THREE.Vector3(-(box.min.x+box.max.x)/2,0,-box.min.z);
 group.children.forEach(m=>m.geometry.translate(...offset.toArray()));
 const stations=wheels.map(w=>w.z+offset.z).sort((a,b)=>a-b);
 const meta={length:size.z,width:size.x,minY:box.min.y,maxY:box.max.y,
   frontAxle:stations[0]??size.z*.13,rearAxle:stations.at(-1)??size.z*.54,
   axleY:wheels.length?wheels.reduce((s,w)=>s+w.y,0)/wheels.length:0};
 if(spec.id==='bus') {
    meta.frontAxle=namedWheels.front.z+offset.z;
    meta.rearAxle=namedWheels.rear.z+offset.z;
    meta.forwardAxis='-Z';
    if(meta.frontAxle>=meta.rearAxle)throw Error('Bus faces away from its steering axle');
 }
 if(spec.id==='motorcycle') {
    meta.frontAxle=-.29474+offset.z; meta.rearAxle=.40574+offset.z; meta.axleY=.142;
 }
 group.userData=meta;
 window.prepared=group;
 const result=await new GLTFExporter().parseAsync(group,{binary:true,onlyVisible:true});
 return {bytes:Array.from(new Uint8Array(result)),meta,triangles:group.children.reduce((s,m)=>s+(m.geometry.index?.count||m.geometry.attributes.position.count)/3,0)};
};
window.readyBake=true;
