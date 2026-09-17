import * as THREE from 'three';
window.compareBody=async(spec,view)=>{
 await window.prepareBody(spec);const reference=window.prepared;
 const local=await window.loadModel(`/public/gear3d/bodies/${spec.id}.glb`);
 const material=new THREE.MeshStandardMaterial({color:0x889bad,roughness:.8,side:THREE.FrontSide});
 for(const root of [reference,local])root.traverse(o=>{if(o.isMesh)o.material=material;});
 const w=480,h=360;
 const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(w,h);renderer.setClearColor('white');
 const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xffffff,0x707070,2));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(10,20,-10);scene.add(light);
 const bounds=new THREE.Box3().setFromObject(reference),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
 const camera=new THREE.PerspectiveCamera(35,w/h,.001,10000);
 const direction=view==='top'?[0,1,-.00001]:view==='side'?[1,0,0]:[1,.7,-1];
 camera.position.copy(center).add(new THREE.Vector3(...direction).normalize().multiplyScalar(Math.max(...size.toArray())*2.1));camera.lookAt(center);
 const capture=(model)=>{scene.add(model);renderer.render(scene,camera);const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(renderer.domElement,0,0);scene.remove(model);return c;};
 const a=capture(reference),b=capture(local),pa=a.getContext('2d').getImageData(0,0,w,h),pb=b.getContext('2d').getImageData(0,0,w,h);
 const diff=new ImageData(w,h);let sum=0,fgSum=0,union=0,intersection=0,changed=0,max=0;
 for(let i=0;i<pa.data.length;i+=4){let d=0;for(let k=0;k<3;k++){const v=Math.abs(pa.data[i+k]-pb.data[i+k]);sum+=v;d+=v;max=Math.max(max,v);diff.data[i+k]=Math.min(255,v*12);}diff.data[i+3]=255;
 const fa=Math.min(...pa.data.slice(i,i+3))<250,fb=Math.min(...pb.data.slice(i,i+3))<250;
 if(fa||fb){union++;fgSum+=d;}if(fa&&fb)intersection++;if(d>0)changed++;
 }
 const dc=document.createElement('canvas');dc.width=w;dc.height=h;dc.getContext('2d').putImageData(diff,0,0);
 const sheet=document.createElement('canvas');sheet.width=w*3;sheet.height=h+42;const ctx=sheet.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,sheet.width,sheet.height);ctx.fillStyle='#253346';ctx.font='16px sans-serif';
 [spec.spanRatio?'Source body (corrected span)':'Source body (wheels removed)','Local prepared body','Pixel difference (12x)'].forEach((t,i)=>ctx.fillText(`${spec.id} ${view}: ${t}`,i*w+12,27));
 ctx.drawImage(a,0,42);ctx.drawImage(b,w,42);ctx.drawImage(dc,w*2,42);
 renderer.dispose();
 return {png:sheet.toDataURL().split(',')[1],metrics:{mae:sum/(w*h*3),foregroundMae:fgSum/(Math.max(union,1)*3),silhouetteIoU:intersection/Math.max(union,1),changedPixels:changed,maxChannelDifference:max}};
};window.readyCompare=true;
