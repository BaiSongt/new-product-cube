import * as THREE from 'three';
import {palette,metal,solid,glow,meshBox,meshCylinder,pipe,tagPick,line} from '../core/materials.js';

function lineRail(x,z,span,alongX=false){
 const g=new THREE.Group();for(const offset of [-.14,.14]){
 const m=alongX?meshBox(span,.03,.035,solid(0xe3ad46),x,.035,z+offset):meshBox(.035,.03,span,solid(0xe3ad46),x+offset,.035,z);g.add(m);
 }return g;
}

export function createWorkshop(){
 const root=new THREE.Group();root.name='工业厂房环境';
 const steel=metal(0x94a9b0), frame=metal(0x8399a2), white=solid(0xecf0f1), hazard=solid(palette.yellow), black=solid(0x526670);
 const floor=meshBox(42,.25,28,solid(0xcbd7dc),0,-.20,0);floor.receiveShadow=true;root.add(floor);
 for(let x=-20;x<=20;x+=2.3)root.add(line([[x,-.065,-14],[x,-.065,14]],0xb4c6cc,.24));
 for(let z=-13;z<=13;z+=2.3)root.add(line([[-21,-.065,z],[21,-.065,z]],0xb4c6cc,.24));
 // 车间柱梁与天车只表现环境，不代表自动上下料系统。
 for(const x of [-20,-10,0,10,20]){
  for(const z of [-13,13]){root.add(meshBox(.36,10.2,.39,frame,x,5,z));root.add(meshBox(.69,.25,.68,steel,x,10,z));}
  root.add(meshBox(.3,.65,26.5,frame,x,9.74,0));
 }
 for(const z of [-12.6,12.6])root.add(meshBox(40,.28,.24,frame,0,9.67,z));
 for(const x of [-17.0,-8.6,0,8.6,17.0]){
  const fixture=new THREE.Group();fixture.position.set(x,9.3,-2.2);
  fixture.add(meshBox(2.5,.12,1.28,white,0,0,0));
  fixture.add(meshBox(2.39,.035,1.16,new THREE.MeshBasicMaterial({color:0xffffff}),0,-.08,0));root.add(fixture);
 }
 const crane=new THREE.Group();crane.name='厂房起吊能力预留（未自动化）';root.add(crane);
 for(const z of [-9.7,9.7])crane.add(meshBox(37,.47,.4,hazard,0,8.3,z));
 crane.add(meshBox(.75,.64,20.1,hazard,-7.4,8.4,0));
 crane.add(meshBox(.94,.84,.80,steel,-7.4,7.81,0));
 crane.add(meshBox(.055,2.08,.055,black,-7.4,6.42,0));
 const hook=new THREE.Mesh(new THREE.TorusGeometry(.30,.077,12,24,Math.PI*1.46),metal(0x6c818a));hook.rotation.x=Math.PI/2;hook.position.set(-7.4,5.26,0);crane.add(hook);
 // 地面安全区线框与分区导引。
 root.add(lineRail(0,-9.05,23,true));
 root.add(lineRail(-12.0,2.45,8));
 root.add(lineRail(9.45,2.45,6));
 for(let x=-11.5;x<=10.7;x+=1.7){
  const stripe=meshBox(.95,.015,.24,hazard,x,-.055,-8.5);stripe.rotation.y=-.26;root.add(stripe);
 }
 // 电缆沟，仅描述车间内部的机床—工作间专用本地链路。
 const cable=pipe([[8,-.045,-6.1],[12.4,-.045,-6.1],[12.4,-.045,.8],[13.1,-.045,.8]],.07,solid(0x2b9aa7));root.add(cable);
 for(const z of [-9.15,10.45]){
  for(let x=-20;x<=20;x+=6){root.add(meshBox(2.3,1.15,.13,new THREE.MeshStandardMaterial({color:0xc3d7dd,roughness:.25,metalness:.04,transparent:true,opacity:.23}),x,6.5,z));}
 }
 return {root};
}

function monitorTexture(label,secondary,mode){
 const canvas=document.createElement('canvas');canvas.width=768;canvas.height=448;
 const ctx=canvas.getContext('2d');ctx.fillStyle='#172936';ctx.fillRect(0,0,768,448);
 ctx.fillStyle='#1e3b49';ctx.fillRect(0,0,768,68);ctx.fillStyle='#cbe4eb';ctx.font='bold 30px sans-serif';ctx.fillText(label,36,45);
 ctx.fillStyle='#7b9cae';ctx.font='22px sans-serif';ctx.fillText(secondary,36,115);
 if(mode==='chart'){
  for(let i=0;i<5;i++){ctx.fillStyle='#385768';ctx.fillRect(32,175+i*45,700,1);}
  ctx.lineWidth=7;ctx.strokeStyle='#2ac0c2';ctx.beginPath();ctx.moveTo(42,320);
  [0,55,115,168,223,293,361,429,498,575,670].forEach((n,i)=>ctx.lineTo(42+n,300+Math.sin(i*.93)*60-i*4));ctx.stroke();
  ctx.fillStyle='#22b3b5';ctx.fillRect(38,370,360,16);
 } else {
  for(let i=0;i<4;i++){
   ctx.fillStyle='#294655';ctx.fillRect(36,154+i*59,696,42);ctx.fillStyle=i===2?'#e6b65a':'#3ac7b9';ctx.fillRect(44,166+i*59,12,18);
   ctx.fillStyle='#b3cfd7';ctx.font='20px sans-serif';ctx.fillText(['程序校验','受控入库','人工授权','机床程序传输'][i],76,182+i*59);
  }
 }
 const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;return tex;
}

export function createOffice(){
 const root=new THREE.Group();root.name='机旁离线工作间';root.position.set(13.85,0,4.0);
 const metalMat=metal(0x55717d),frameMat=metal(0x8eabb6),glassMat=new THREE.MeshPhysicalMaterial({color:0xaad9e3,metalness:.05,roughness:.12,transparent:true,opacity:.17,side:THREE.DoubleSide,depthWrite:false});
 root.add(meshBox(7.0,.22,6.4,solid(0xe9eff1),0,.03,0));
 root.add(meshBox(7.0,.17,6.4,metalMat,0,4.05,0));
 for(let x of [-3.45,3.45])for(let z of [-3.1,3.1])root.add(meshBox(.13,4.1,.13,frameMat,x,2.02,z));
 for(let z of [-3.15,3.15])root.add(meshBox(6.95,.14,.14,frameMat,0,2.20,z));
 for(let x of [-3.49,3.49])root.add(meshBox(.10,3.78,6.22,glassMat,x,2.1,0));
 for(let z of [-3.13,3.13])root.add(meshBox(6.81,3.78,.10,glassMat,0,2.1,z));
 // 一侧透明墙内放置两个工位，机床看板与安全接收节点均明确为离线工作间。
 for(let z of [-1.7,1.4]){
  root.add(meshBox(2.6,.18,1.45,metal(0x879ba6),-1.0,1.0,z));
  root.add(meshBox(.15,1.0,.15,metalMat,-2.03,.49,z-.52));root.add(meshBox(.15,1.0,.15,metalMat,.04,.49,z-.52));
  const back=meshBox(1.60,.98,.09,solid(0x152a34),-1.0,1.87,z-.42);root.add(back);
  const screen=meshBox(1.47,.81,.018,new THREE.MeshBasicMaterial({map:monitorTexture(z<0?'DNC / 程序管理':'MDC / 设备监控',z<0?'版本核验 / 受控下发':'本地只读数据 / 状态履历',z<0?'list':'chart')}),-1.0,1.89,z-.36);root.add(screen);
  root.add(meshBox(.10,.38,.11,metalMat,-1.0,1.24,z-.4));
  root.add(meshBox(.54,.26,.54,solid(0x415e6e),.48,.67,z));
 }
 const cabinet=meshBox(1.08,2.22,1.07,metal(0x4b6776),2.0,1.15,1.8);root.add(cabinet);
 for(let y=.38;y<2.2;y+=.35){root.add(meshBox(.79,.19,.07,solid(0x142e3b),2.0,y,2.35));root.add(meshBox(.075,.05,.06,glow(0x22c4ae),2.33,y,2.40));}
 const check=meshBox(1.26,.76,.70,metal(0xd3dfe1),1.85,1.09,-1.65);root.add(check);
 const media=new THREE.Mesh(new THREE.CylinderGeometry(.15,.15,.03,24),metal(palette.yellow));media.position.set(1.85,1.49,-1.65);root.add(media);
 const labelPad=meshBox(2.9,.48,.07,solid(0x345d69),0,3.64,-3.17);root.add(labelPad);
 tagPick(root,'office');
 return {root};
}

export function createCNCStation(){
 const root=new THREE.Group();root.name='机床现场 CNC 操作站';root.position.set(7.6,0,-7.2);
 const body=metal(0x537280);root.add(meshBox(.82,1.55,.62,body,0,.80,0));
 const head=meshBox(1.37,1.14,.44,metal(0x9db0b9),0,2.04,0);head.rotation.x=-.12;root.add(head);
 const screen=meshBox(1.15,.65,.02,new THREE.MeshBasicMaterial({map:monitorTexture('CNC / LOCAL','机床现场操作', 'chart')}),0,2.23,.26);screen.rotation.x=-.12;root.add(screen);
 for(let x of [-.39,-.14,.11,.36])for(let y of [1.71,1.84])root.add(meshBox(.15,.07,.038,solid(0x1a3443),x,y,.26));
 const red=meshCylinder(.115,.1,solid(0xcc5550),.53,1.77,.28);red.rotation.x=Math.PI/2;root.add(red);
 tagPick(root,'cnc');return {root};
}
