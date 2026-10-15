import * as THREE from 'three';
import {palette,metal,solid,glow,meshBox,meshCylinder,tagPick,line} from '../core/materials.js';
import {GEOMETRY,HULL_SCALE,angleHeadTopTargetWorld} from '../core/geometry.js';

// 单位：m；三维外形仅用于建设方案演示，不构成工程尺寸或加工指令。
export const HULL_CONFIG = Object.freeze({
  length:8.45,width:GEOMETRY.hullWidth,sideThickness:GEOMETRY.hullSideThickness,
  wheelAxleXs:Object.freeze(GEOMETRY.wheelAxleXs.map(x=>x/HULL_SCALE.x)),wheelAxleY:GEOMETRY.wheelAxleLocalY,wheelHoleRadius:GEOMETRY.wheelHoleRadius/HULL_SCALE.y,
  mountingXs:Object.freeze(GEOMETRY.mountingXs.map(x=>x/HULL_SCALE.x)),
  mountingY:GEOMETRY.mountingY,mountingRadius:.18,
  turret:{x:1.60,z:0,radius:.78,deckY:2.38},
});

function createOutline(){
 const s=new THREE.Shape();
 const stations=[[-4.22,.22],[-3.94,.55],[-3.12,1.45],[-2.32,2.04],[-.80,2.18],
                 [.64,2.19],[1.12,2.38],[2.75,2.38],[3.54,2.14],[4.12,1.68],
                 [4.20,.72],[3.87,.18],[-3.84,.18]];
 s.moveTo(...stations[0]);for(const p of stations.slice(1))s.lineTo(...p);s.closePath();
 for(const x of HULL_CONFIG.wheelAxleXs){
  const cut=new THREE.Path();cut.absarc(x,HULL_CONFIG.wheelAxleY,HULL_CONFIG.wheelHoleRadius,0,Math.PI*2,false);s.holes.push(cut);
 }
 // 两个上部侧装孔的位置与机床演示轨迹一一对应。
 for(const x of HULL_CONFIG.mountingXs){
  const cut=new THREE.Path();cut.absarc(x,HULL_CONFIG.mountingY,HULL_CONFIG.mountingRadius,0,Math.PI*2,false);s.holes.push(cut);
 }
 return s;
}
function createDeck(){
 // XZ 上的顶板；中心开口为真实轮廓孔，不能用不透明材质盖住。
 const {x,z,radius}=HULL_CONFIG.turret;
 const s=new THREE.Shape();s.moveTo(.57,-1.99);s.lineTo(2.74,-1.99);
 s.lineTo(2.74,1.99);s.lineTo(.57,1.99);s.closePath();
 const cut=new THREE.Path();cut.absarc(x,z,radius,0,Math.PI*2,false);s.holes.push(cut);
 return s;
}
function plate(points,material){
 // 由四顶点构造单块倾斜装甲板；正反面可见，避免面法线方向导致黑面。
 const a=points.flat();const vertices=[...a.slice(0,9),...a.slice(0,3),...a.slice(6,9),...a.slice(9,12)];
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.computeVertexNormals();
 const mesh=new THREE.Mesh(geo,material);mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
}
function outlineOf(mesh,lines,angle=25){
 const obj=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry,angle),new THREE.LineBasicMaterial({color:0x47616b,transparent:true,opacity:.62,depthTest:true}));
 obj.position.copy(mesh.position);obj.quaternion.copy(mesh.quaternion);obj.scale.copy(mesh.scale);lines.add(obj);
}
function addHullMesh(hull,edges,mesh){hull.add(mesh);mesh.userData.pickKey='workpiece';outlineOf(mesh,edges);return mesh;}
function ringAt(x,y,z,r,color=0xb9c9d1,tube=.026){
 // TorusGeometry 初始位于 XY 平面，法向为 Z，直接贴近车体侧板。
 const mesh=new THREE.Mesh(new THREE.TorusGeometry(r,tube,10,56),metal(color,.38));
 mesh.position.set(x,y,z);mesh.castShadow=true;return mesh;
}

export function createWorkpiece(){
 const root=new THREE.Group();root.name='车体与装夹台';
 const table=solid(0x526d7d),silver=metal(0xa8bbc5,.40),dark=metal(0x3a505e,.56),gold=metal(0xd1a85a,.40);
 const worktable=meshBox(11.1,.64,5.70,table,0,.48,2.80);worktable.name='固定工件支撑台';root.add(worktable);
 for(let z=.63;z<=5.15;z+=.76)root.add(meshBox(10.6,.066,.13,silver,0,.84,z));
 for(let x=-4.15;x<=4.15;x+=1.38)root.add(meshBox(.11,.14,4.9,dark,x,.87,2.80));
 const part=new THREE.Group();part.name='参数化战车车体壳体';root.add(part);
 const hull=new THREE.Group();hull.position.set(0,GEOMETRY.hullCenterY,GEOMETRY.hullCenterZ);hull.scale.set(HULL_SCALE.x,HULL_SCALE.y,HULL_SCALE.z);hull.name='车体实体外壳（示意网格）';part.add(hull);
 const edges=new THREE.Group();edges.name='显示结构边';hull.add(edges);edges.visible=false;
 const steel=new THREE.MeshStandardMaterial({color:0xaebfc9,metalness:.34,roughness:.57,side:THREE.DoubleSide});
 const topMetal=new THREE.MeshStandardMaterial({color:0xc3cfd4,metalness:.39,roughness:.49,side:THREE.DoubleSide});
 const inside=new THREE.MeshStandardMaterial({color:0x70818b,metalness:.16,roughness:.74,side:THREE.DoubleSide});
 const floorMat=solid(0x71838e,.75);
 const w=HULL_CONFIG.width/2;
 // 两侧立壁是真正开孔的挤出几何，孔洞穿过整个板厚。
 const wallGeo=new THREE.ExtrudeGeometry(createOutline(),{depth:HULL_CONFIG.sideThickness,bevelEnabled:false,curveSegments:48,steps:1});
 const near=addHullMesh(hull,edges,new THREE.Mesh(wallGeo,steel));near.position.z=-w+.002;near.name='近侧车体侧板（贯穿孔）';
 const far=addHullMesh(hull,edges,new THREE.Mesh(wallGeo,steel));far.position.z=w-.002-HULL_CONFIG.sideThickness;far.name='远侧车体侧板（贯穿孔）';
 // 中心底板与内底板位于顶部孔口的正下方；向上观察可看到有深度的空腔。
 addHullMesh(hull,edges,meshBox(7.83,.12,3.80,steel,-.04,.13,0));
 addHullMesh(hull,edges,meshBox(3.12,.09,2.37,floorMat,1.02,.52,0));
 for(const z of [-1.82,1.82])addHullMesh(hull,edges,meshBox(4.6,.30,.11,inside,.75,1.98,z));
 // 前装甲：折面、斜面直接连接到车体外轮廓，避免漂浮板材遮挡孔位。
 const frontPanels=[
  [[-4.20,.72,-1.72],[-4.20,.72,1.72],[-3.12,1.45,1.99],[-3.12,1.45,-1.99]],
  [[-3.12,1.45,-2.00],[-3.12,1.45,2.00],[-2.32,2.04,2.05],[-2.32,2.04,-2.05]],
  [[-2.32,2.04,-2.05],[-2.32,2.04,2.05],[-.80,2.18,2.04],[-.80,2.18,-2.04]],
  [[-.80,2.18,-2.04],[-.80,2.18,2.04],[.57,2.38,2.04],[.57,2.38,-2.04]],
 ];
 for(const pts of frontPanels)addHullMesh(hull,edges,plate(pts,topMetal));
 // 真正的顶部开口：带圆孔的挤出顶板，而非圆环贴在封闭箱体上。
 const deck=new THREE.Mesh(new THREE.ExtrudeGeometry(createDeck(),{depth:.09,bevelEnabled:false,curveSegments:64}),topMetal);
 deck.rotation.x=-Math.PI/2;deck.position.y=HULL_CONFIG.turret.deckY-.05;deck.name='炮塔安装区顶板（中央真开口）';addHullMesh(hull,edges,deck);
 // 顶部圆口的垂直内圈；开口中央完全无遮挡。
 const tc=HULL_CONFIG.turret;
 const innerRim=new THREE.Mesh(new THREE.CylinderGeometry(tc.radius-.012,tc.radius-.012,.34,72,1,true),inside);
 innerRim.position.set(tc.x,tc.deckY-.15,tc.z);addHullMesh(hull,edges,innerRim);
 const rim=new THREE.Mesh(new THREE.TorusGeometry(tc.radius,.043,12,72),metal(0xd6dfe2,.29));
 rim.rotation.x=Math.PI/2;rim.position.set(tc.x,tc.deckY+.045,tc.z);hull.add(rim);
 // 后倾板，不覆盖顶板中央的炮塔圆口。
 addHullMesh(hull,edges,plate([[2.74,2.38,-2.02],[2.74,2.38,2.02],[3.54,2.14,1.92],[3.54,2.14,-1.92]],topMetal));
 addHullMesh(hull,edges,plate([[3.54,2.14,-1.92],[3.54,2.14,1.92],[4.12,1.68,1.74],[4.12,1.68,-1.74]],topMetal));
 addHullMesh(hull,edges,plate([[4.12,1.68,-1.74],[4.12,1.68,1.74],[4.20,.72,1.68],[4.20,.72,-1.68]],steel));
 for(const x of [-3.12,3.65])addHullMesh(hull,edges,meshBox(.08,.12,3.46,topMetal,x,.44,0));
 // 侧面所有圆孔都是真洞；金属圈只增强可读性，不填充开孔内部。
 for(const sign of [-1,1]){
  const z=sign*w+(sign<0?-.014:.014);
  for(const x of HULL_CONFIG.wheelAxleXs)hull.add(ringAt(x,HULL_CONFIG.wheelAxleY,z,HULL_CONFIG.wheelHoleRadius,0xc4d0d6));
  for(const x of HULL_CONFIG.mountingXs)hull.add(ringAt(x,HULL_CONFIG.mountingY,z,HULL_CONFIG.mountingRadius,0xb9c9d3,.018));
 }
 // 点状焊接/支撑节点：不装炮塔、炮管、车轮、履带及内装。
 for(const x of [-.48,.14,1.88,2.38])for(const z of [-1.63,1.63])addHullMesh(hull,edges,meshBox(.15,.07,.15,metal(0x93a5af),x,2.47,z));

 // 工件支撑和可动压板；运动仅属于展示，不构成夹紧力仿真。
 const clampArms=[];
 for(const x of [-3.5,-1.80,1.80,3.5])for(const z of [.27,5.32]){
  root.add(meshBox(.58,.29,.67,silver,x,1.00,z));
  const arm=new THREE.Group();arm.position.set(x,1.33,z);root.add(arm);
  arm.add(meshBox(.62,.18,.78,gold,0,.28,0));arm.add(meshCylinder(.085,.42,dark,0,0,0));
  tagPick(arm,'clamp');clampArms.push(arm);
 }

 const guides=new THREE.Group();guides.name='加工基准与工序高亮（非测量结论）';root.add(guides);
 const frontZ=GEOMETRY.nearWallWorldZ-.018; // 贴近侧壁，位于刀具进给终点之后
 const mountRings=[];
 for(const x of GEOMETRY.mountingXs){
  const grp=new THREE.Group();guides.add(grp);
  const mark=ringAt(x,GEOMETRY.mountingWorldY,frontZ,HULL_CONFIG.mountingRadius*HULL_SCALE.x+.115,palette.yellow,.032);
  mark.material=new THREE.MeshBasicMaterial({color:0xe4b653,transparent:true,opacity:.24,depthWrite:false});grp.add(mark);
  guides.add(line([[x,GEOMETRY.mountingWorldY,-.45],[x,GEOMETRY.mountingWorldY,frontZ]],0xe4b653,.56));
  tagPick(grp,'mounting-hole');mountRings.push(grp);
 }
 const probeMarks=[];
 const inspectionPoints=[];
 // 中央共轴检测参考线只是选定的一组对应轮孔位置，非工件实际测量结果。
 const axleX=GEOMETRY.wheelAxleXs[2],axleY=GEOMETRY.hullCenterY+HULL_CONFIG.wheelAxleY*HULL_SCALE.y;
 guides.add(line([[axleX,axleY,.44],[axleX,axleY,5.16]],palette.cyan,.65));
 const boreFeatures=[];
 for(const [index,sign] of [-1,1].entries()){
  const z=GEOMETRY.hullCenterZ+sign*(w*HULL_SCALE.z+.09);
  const marker=new THREE.Group();marker.name=sign<0?'左侧轴孔设计基准':'右侧轴孔设计基准';guides.add(marker);
  const ring=ringAt(axleX,axleY,z,GEOMETRY.wheelHoleRadius+.12,palette.cyan,.028);
  ring.material=new THREE.MeshBasicMaterial({color:palette.cyan,transparent:true,opacity:.42,depthWrite:false});marker.add(ring);probeMarks.push(ring);
  // 每侧采用两个薄壁深度截面的虚拟采样点，仅展示测量规划。
  // 实际轴孔深度/点位/不确定度必须现场评估，不能把这些点当作采集结果。
  const outerZ=GEOMETRY.hullCenterZ+sign*w*HULL_SCALE.z;
  for(const [section,offset] of GEOMETRY.inspectionSectionOffsets.entries()){
   const sectionZ=outerZ-sign*offset;
   const sweepRing=ringAt(axleX,axleY,sectionZ,GEOMETRY.wheelHoleRadius,0x45cad4,.008);
   sweepRing.material=new THREE.MeshBasicMaterial({color:palette.cyan,transparent:true,opacity:.18,depthWrite:false});
   marker.add(sweepRing);inspectionPoints.push({mesh:sweepRing,phase:index*.5+section*.25});
   for(let k=0;k<8;k++){
    const a=2*Math.PI*k/8;
    const dot=new THREE.Mesh(new THREE.SphereGeometry(.032,9,8),new THREE.MeshBasicMaterial({color:0xf2d38b,transparent:true,opacity:0,depthWrite:false}));
    dot.position.set(axleX+GEOMETRY.wheelHoleRadius*Math.cos(a),axleY+GEOMETRY.wheelHoleRadius*Math.sin(a),sectionZ);
    marker.add(dot);inspectionPoints.push({mesh:dot,phase:index*.5+section*.25+k*.03});
   }
  }
  tagPick(marker,index===0?'left-bore':'right-bore');boreFeatures.push(marker);
 }
 const angleTarget=angleHeadTopTargetWorld();
 const angleGuide=new THREE.Group();angleGuide.name='角度头顶部加工目标（仅工艺规划）';guides.add(angleGuide);
 const angleRing=new THREE.Mesh(new THREE.TorusGeometry(.19,.018,12,64),new THREE.MeshBasicMaterial({color:0xffc058,transparent:true,opacity:.94,depthWrite:false}));
 angleRing.rotation.x=-Math.PI/2;angleRing.position.set(angleTarget.x,angleTarget.y+.016,angleTarget.z);angleGuide.add(angleRing);
 angleGuide.add(line([[angleTarget.x,angleTarget.y+.76,angleTarget.z],[angleTarget.x,angleTarget.y+.025,angleTarget.z]],0xffbd58,.90));
 angleGuide.visible=false;
 let wires=false;
 function setWireframe(on){wires=Boolean(on);edges.visible=wires;return wires;}
 function applyAnimation(pose){
  angleGuide.visible=pose.stage==='angleMachining'||pose.stage==='angleChange';
  const grip=pose.clampRatio??0;
  for(const arm of clampArms)arm.position.y=1.33+(1-grip)*.33;
  mountRings.forEach((grp,i)=>{
   const mesh=grp.children.find(o=>o.isMesh);if(!mesh)return;
   const selected=pose.highlightHole===i;
   mesh.material.opacity=selected?.98:.18;
   mesh.scale.setScalar(selected?1.08:1.0);
  });
  probeMarks.forEach(m=>{m.material.opacity=pose.inspectionActive?.96:.28;});
  inspectionPoints.forEach(({mesh,phase})=>{
    mesh.material.opacity=pose.inspectionActive && (pose.inspectionProgress??0)>phase ? .95 : 0;
  });
 }
 return {root,part,worktable,guides,boreFeatures,ready:Promise.resolve(part),setWireframe,applyAnimation,
  centers:[{x:axleX,y:axleY,z:GEOMETRY.hullCenterZ-w*HULL_SCALE.z},{x:axleX,y:axleY,z:GEOMETRY.hullCenterZ+w*HULL_SCALE.z}],config:HULL_CONFIG};
}
