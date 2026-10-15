import * as THREE from 'three';
import {GEOMETRY} from '../core/geometry.js';

/**
 * 研发端制造特征规划的 3D 注释层。
 * 这里的连线仅代表 A、B 孔位及工序顺序，不是能够下发的刀路。
 * 所有坐标来自共用工件参数，避免再次手动猜测孔位。
 */
export function createCamOverlay(){
 const root=new THREE.Group();root.name='CAM 特征与工序次序（非刀路）';
 const z=GEOMETRY.nearWallWorldZ-.10;
 const y=GEOMETRY.mountingWorldY;
 const color=0x18b5bc;
 const ringMaterial=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.75,depthWrite:false});
 const rings=[];
 for(const x of GEOMETRY.mountingXs){
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.34,.012,8,64),ringMaterial.clone());
  ring.position.set(x,y,z);
  root.add(ring);rings.push(ring);
 }
 // 连线不是刀位轨迹：向上抬高，以区别于孔面的真实加工动作。
 const a=GEOMETRY.mountingXs[0],b=GEOMETRY.mountingXs[1];
 const points=[new THREE.Vector3(a,y+.34,z),new THREE.Vector3(a,y+.6,z),new THREE.Vector3(b,y+.6,z),new THREE.Vector3(b,y+.34,z)];
 const route=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),
  new THREE.LineDashedMaterial({color:0x10a5b5,transparent:true,opacity:.56,dashSize:.14,gapSize:.10}));
 route.computeLineDistances();root.add(route);
 root.visible=false;
 function update(pose){
  root.visible=pose.stage==='research';
  if(!root.visible)return;
  rings.forEach((r,i)=>{
   r.material.opacity=.4+.4*(.5+.5*Math.sin(pose.t*96*1.1-i*2.4));
  });
 }
 return {root,update};
}
