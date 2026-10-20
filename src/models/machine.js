import * as THREE from 'three';
import {palette, metal,solid,glow,meshBox,meshCylinder,tagPick,line,pipe} from '../core/materials.js';
import {GEOMETRY} from '../core/geometry.js';
import {MACHINE_ASSEMBLY,worldSpindleReference} from '../core/machine-kinematics.js';
import {ANGLE_HEAD,angleHeadTcpWorld} from '../core/angle-head.js';

export function createMachine() {
 const root=new THREE.Group();root.name='示意落地镗铣床';root.position.z=GEOMETRY.machineRootZ;
 const baseMat=metal(palette.dark), skinMat=metal(palette.machine), railMat=metal(palette.steel,.29);
 const silver=metal(palette.aluminum,.26), deep=metal(palette.black,.55), bronze=metal(palette.brass,.33);
 const pale=solid(0xe4ecee), ribs=metal(0x677985);
 const foundation=meshBox(20,.47,3.6,solid(0x8e9fa5),-.4,.19,-.05);foundation.name='床身基础';root.add(foundation);
 for(const z of [-1.17,1.1]){
   root.add(meshBox(19.45,.18,.24,railMat,-.4,.53,z));
   root.add(meshBox(19.45,.11,.09,bronze,-.4,.67,z));
   for(let x=-9.5;x<=8.9;x+=.75)root.add(meshBox(.055,.055,.49,deep,x,.58,z));
 }
 for(let x=-9.25;x<=8.5;x+=1.25){root.add(meshBox(.46,.11,2.75,ribs,x,.46,0));}
 tagPick(root,'machine');
 const carriage=new THREE.Group();carriage.name='X 向移动立柱组件';root.add(carriage);
 const platform=meshBox(2.9,.55,2.94,skinMat,0,.78,0);carriage.add(platform);
 for(const x of [-1.22,1.22])for(const z of [-1.05,1.05])carriage.add(meshBox(.36,.18,.52,deep,x,.53,z));
 const column=new THREE.Group();column.name='立柱';carriage.add(column);
 column.add(meshBox(2.34,6.65,2.15,baseMat,0,4.16,-.22));
 column.add(meshBox(2.48,.38,2.24,skinMat,0,7.65,-.22));
 column.add(meshBox(2.55,.37,2.5,skinMat,0,1.15,-.18));
 column.add(meshBox(.20,5.6,.14,railMat,-.84,4.20,1.00));
 column.add(meshBox(.20,5.6,.14,railMat,.84,4.20,1.00));
 column.add(meshBox(.25,5.7,.17,deep,0,4.19,1.03));
 for(let y=1.7;y<=6.9;y+=.31)column.add(meshBox(.15,.13,.21,metal(0x354e5e),1.2,y,-.98));
 column.add(meshBox(1.4,.14,1.2,metal(0x90a3ab),0,7.91,-.2));
 column.add(meshBox(.7,.54,.7,deep,-.45,8.18,-.2));
 tagPick(column,'column');
 const head=new THREE.Group();head.name='Y 向主轴箱';carriage.add(head);
 head.add(meshBox(2.1,1.64,2.43,skinMat,0,.1,.7));
 head.add(meshBox(1.78,.15,2.35,silver,0,.98,.7));
 head.add(meshBox(.21,1.48,2.4,baseMat,-1.07,.1,.7));
 head.add(meshBox(.21,1.48,2.4,baseMat,1.07,.1,.7));
 head.add(meshBox(1.2,1.1,.17,deep,0,.02,1.97));
 for(let x of [-.71,.71])head.add(meshBox(.11,.92,.17,bronze,x,.05,2.09));
 head.add(meshBox(.35,.35,.3,glow(palette.cyan),.73,.58,2.13));
 tagPick(head,'headstock');
 const ram=new THREE.Group();ram.name='Z 向滑枕/镗轴示意';head.add(ram);
 const ramMain=meshBox(1.02,.93,3.6,silver,0,.02,1.85);ram.add(ramMain);
 for(let z=.45;z<3.3;z+=.52)ram.add(meshBox(1.07,.055,.10,railMat,0,.53,z));
 const collar=meshCylinder(.61,.35,deep,0,.02,3.73);collar.rotation.x=Math.PI/2;ram.add(collar);
 const spindle=meshCylinder(.42,.50,bronze,0,.02,4.02);spindle.rotation.x=Math.PI/2;ram.add(spindle);
 tagPick(ram,'ram');
 // 机床主轴端面为刀具安装基准，镗杆与测头共用接口，但不是同时装配。
 const spindleDrive=new THREE.Group();spindleDrive.name='主轴旋转关节 · 局部 +Z';spindleDrive.position.y=GEOMETRY.spindleLocalY;ram.add(spindleDrive);
 const mount=new THREE.Group();mount.name='主轴接口与刀柄装配';spindleDrive.add(mount);
 // 三层同轴结构：主轴安装面→短刀柄→支承套→镗杆→前端刀头。
 const gauge=MACHINE_ASSEMBLY.gaugePlaneLocalZ;
 const flange=meshCylinder(.48,.12,bronze,0,0,gauge+.06);flange.rotation.x=Math.PI/2;mount.add(flange);
 const tool=new THREE.Group();tool.name='粗/精镗刀具组件';mount.add(tool);
 const taper=meshCylinder(.30,.38,silver,0,0,4.39);taper.rotation.x=Math.PI/2;tool.add(taper);
 const barClamp=meshCylinder(.25,.30,deep,0,0,4.73);barClamp.rotation.x=Math.PI/2;tool.add(barClamp);
 const shaft=meshCylinder(.14,1.23,railMat,0,0,5.37);shaft.rotation.x=Math.PI/2;tool.add(shaft);
 const tip=meshCylinder(.165,.24,bronze,0,0,6.06);tip.rotation.x=Math.PI/2;tool.add(tip);
 // 模拟刀片可在刀杆外缘；轴线对准始终使用刀杆中心，而非刀片边缘。
 const insert=meshBox(.08,.14,.13,deep,.13,0,6.03);tool.add(insert);
 tagPick(tool,'tool');
 // 虚拟测头单独安装在滑枕接口处，和镗杆互斥可见；无自动换刀声明。
 const probe=new THREE.Group();probe.name='虚拟工件测头（非实测）';ram.add(probe);
 const probeFlange=meshCylinder(.42,.12,bronze,0,GEOMETRY.spindleLocalY,gauge+.06);probeFlange.rotation.x=Math.PI/2;probe.add(probeFlange);
 const probeHolder=meshCylinder(.29,.48,silver,0,GEOMETRY.spindleLocalY,4.44);probeHolder.rotation.x=Math.PI/2;probe.add(probeHolder);
 const probeStem=meshCylinder(.082,1.44,railMat,0,GEOMETRY.spindleLocalY,5.39);probeStem.rotation.x=Math.PI/2;probe.add(probeStem);
 const probeTip=new THREE.Mesh(new THREE.SphereGeometry(MACHINE_ASSEMBLY.probeBallRadiusMeters,24,16),glow(0x13b3bf));
 probeTip.position.set(0,GEOMETRY.spindleLocalY,MACHINE_ASSEMBLY.probeBallCenterLocalZ);probe.add(probeTip);
 probe.visible=false;tagPick(probe,'tool');
 // 固定 90°直角铣头，壳体与主轴箱刚性相连、防转销仅为几何示意。
 // 内部转向传动未解析；只有输出刀具组件随工况旋转，外壳绝对不转动。
 const angleHead=new THREE.Group();angleHead.name='90°直角角度头 · 防转定位（模拟）';
 angleHead.position.y=GEOMETRY.spindleLocalY;ram.add(angleHead);
 const housing=meshBox(.92,.72,.94,skinMat,0,-.16,4.67);angleHead.add(housing);
 const driveCoupling=meshCylinder(.43,.22,bronze,0,0,4.16);driveCoupling.rotation.x=Math.PI/2;angleHead.add(driveCoupling);
 const collar90=meshBox(1.05,.16,.88,deep,0,-.41,4.79);angleHead.add(collar90);
 const stopper=meshCylinder(.085,.52,bronze,-.40,.30,4.34);angleHead.add(stopper);
 const stopBlock=meshBox(.28,.19,.28,deep,-.40,.55,4.34);angleHead.add(stopBlock);
 const bearing=meshCylinder(.34,.18,silver,0,-.53,ANGLE_HEAD.gearCenterLocalZ);angleHead.add(bearing);
 const angleOutput=new THREE.Group();angleOutput.name='角度头输出旋转轴 -Y';angleOutput.position.z=ANGLE_HEAD.gearCenterLocalZ;angleHead.add(angleOutput);
 const angleShaft=meshCylinder(.15,.58,railMat,0,-.81,0);angleOutput.add(angleShaft);
 const cutter=meshCylinder(.19,.24,bronze,0,-1.13,0);angleOutput.add(cutter);
 angleOutput.add(meshBox(.13,.06,.08,deep,.11,-1.25,0));
 // 不以附件壳体中心替代输出刀具 TCP，最低端位于独立输出轴线上。
 const angleGuide=new THREE.Group();angleGuide.name='90°输出刀轴中心线';angleHead.add(angleGuide);
 angleGuide.add(line([[0,-.40,ANGLE_HEAD.gearCenterLocalZ],[0,-1.48,ANGLE_HEAD.gearCenterLocalZ]],0xffbe5a,.92));
 // M7：可开关的简化角度头壳体 AABB 与刀具圆柱包络；非工程碰撞实体。
 const angleEnvelope=new THREE.Group();angleEnvelope.name='M7 角度头空间预检包络（近似）';angleHead.add(angleEnvelope);
 const envelopeMaterial=new THREE.LineBasicMaterial({color:0x18a9b2,transparent:true,opacity:.94,depthTest:true});
 const housingEdges=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.04,.72,.94)),envelopeMaterial);
 housingEdges.position.set(0,-.16,4.67);angleEnvelope.add(housingEdges);
 const cutterEnvelope=new THREE.Mesh(new THREE.CylinderGeometry(.19,.19,.84,28,1,true),
  new THREE.MeshBasicMaterial({color:0x18a9b2,transparent:true,opacity:.19,depthWrite:false,side:THREE.DoubleSide}));
 cutterEnvelope.position.set(0,-.82,ANGLE_HEAD.gearCenterLocalZ);angleEnvelope.add(cutterEnvelope);
 let envelopeEnabled=false;angleEnvelope.visible=false;
 function setAngleEnvelopeVisible(on){envelopeEnabled=Boolean(on);angleEnvelope.visible=envelopeEnabled;return envelopeEnabled;}
 function setAngleEnvelopeStatus(status){
  const tone=status==='interference'?0xc25143:status==='attention'?0xd29b34:0x18a9b2;
  envelopeMaterial.color.setHex(tone);cutterEnvelope.material.color.setHex(tone);
 }
 angleHead.visible=false;tagPick(angleHead,'tool');
 // 主轴中心线辅助线，与可见镗杆严格共轴；只在工艺讲解时展示。
 const spindleGuide=new THREE.Group();spindleGuide.name='主轴中心线示意';ram.add(spindleGuide);
 spindleGuide.add(line([[0,.02,3.10],[0,.02,6.18]],palette.cyan,.92));
 const axisEnd=new THREE.Mesh(new THREE.TorusGeometry(.19,.014,8,48),glow(palette.cyan,.83));axisEnd.position.set(0,.02,6.18);spindleGuide.add(axisEnd);
 spindleGuide.visible=false;
 const guides=new THREE.Group();guides.name='机床轴向说明';
 guides.add(line([[-1.4,.90,-1.53],[1.4,.90,-1.53]],0xe4b84e));
 guides.add(line([[1.6,1.38,.4],[1.6,7.44,.4]],0x0c9ea8));
 root.add(guides);
 // 机床安装坐标系与加工坐标系分开维护，不将世界坐标冒充实机坐标。
 const frames=Object.freeze({machineRoot:'示意机床安装坐标',carriageX:'局部 X 导轨',headstockY:'局部 Y 升降',ramZ:'局部 Z 水平伸缩'});
 function applyPose(pose){
  carriage.position.x=pose.machineX;head.position.y=pose.headY;ram.position.z=pose.ramExtension;
  spindleDrive.visible=pose.toolMode==='boring';probe.visible=pose.toolMode==='probe';angleHead.visible=pose.toolMode==='angle';
  angleOutput.rotation.y=pose.angleOutputRotation??0;
  spindleDrive.rotation.z=pose.spindleAngle;
 }
 function getAngleHeadTipWorldPosition(){root.updateMatrixWorld(true);return angleHead.localToWorld(new THREE.Vector3(0,ANGLE_HEAD.outputTipLocalY,ANGLE_HEAD.gearCenterLocalZ));}
 function compareAngleHeadTcp(pose){const tip=getAngleHeadTipWorldPosition(),ref=angleHeadTcpWorld(pose);return tip.distanceTo(new THREE.Vector3(ref.x,ref.y,ref.z));}
 function getTipWorldPosition(){root.updateMatrixWorld(true);return ram.localToWorld(new THREE.Vector3(0,GEOMETRY.spindleLocalY,MACHINE_ASSEMBLY.boringTipLocalZ));}
 function getSpindleWorldAxis(){root.updateMatrixWorld(true);const from=ram.localToWorld(new THREE.Vector3(0,GEOMETRY.spindleLocalY,3.10));const to=ram.localToWorld(new THREE.Vector3(0,GEOMETRY.spindleLocalY,6.18));return {from,to,direction:to.clone().sub(from).normalize()};}
 function getGaugeWorldPosition(){root.updateMatrixWorld(true);return ram.localToWorld(new THREE.Vector3(0,GEOMETRY.spindleLocalY,MACHINE_ASSEMBLY.gaugePlaneLocalZ));}
 function getProbeCenterWorldPosition(){root.updateMatrixWorld(true);return probeTip.getWorldPosition(new THREE.Vector3());}
 function compareKinematicReference(pose){
  const point=getGaugeWorldPosition(),ref=worldSpindleReference(pose).gauge;
  return point.distanceTo(new THREE.Vector3(ref.x,ref.y,ref.z));
 }
 function setAxisGuideVisible(visible){spindleGuide.visible=Boolean(visible);}
 return {root,carriage,column,head,ram,tool,probe,angleHead,applyPose,getTipWorldPosition,getSpindleWorldAxis,getGaugeWorldPosition,getProbeCenterWorldPosition,compareKinematicReference,compareAngleHeadTcp,getAngleHeadTipWorldPosition,setAxisGuideVisible,setAngleEnvelopeVisible,setAngleEnvelopeStatus,frames};
}
