import * as THREE from 'three';
export const palette = {
  slate: 0x566b77, steel: 0x83949d, dark: 0x263b49, machine: 0x476878,
  mid: 0x9eafb5, aluminum: 0xc7d4d8, white: 0xf2f7f8, brass: 0xd4a353,
  cyan: 0x1aafbd, yellow: 0xedb64d, concrete: 0xdce4e7, glass: 0x8bd6e8,
  black: 0x162731, safety: 0xe3bb51
};
export function metal(color, roughness = 0.48) { return new THREE.MeshStandardMaterial({color, metalness: 0.53, roughness}); }
export function solid(color, roughness = 0.78) { return new THREE.MeshStandardMaterial({color, roughness, metalness: 0.1}); }
export function glow(color, opacity = 1) {return new THREE.MeshBasicMaterial({color,transparent: opacity < 1, opacity, depthWrite: opacity >= 1});}
export function meshBox(w,h,d,mat,x=0,y=0,z=0) {
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); mesh.position.set(x,y,z); mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
}
export function meshCylinder(radius,depth,mat,x=0,y=0,z=0,segments=32){
 const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,depth,segments),mat); mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
}
export function pipe(points,radius,material){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));return new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(8,points.length*10),radius,7,false),material);}
export function line(points,color,opacity=1){
 const geom=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)));
 const m=new THREE.LineBasicMaterial({color,transparent:opacity < 1,opacity,depthWrite:false});
 return new THREE.Line(geom,m);
}
export function tagPick(object,key){object.traverse(o=>{if(o.isMesh && !o.userData.pickKey)o.userData.pickKey=key});return object;}
