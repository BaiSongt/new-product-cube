import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GEOMETRY,HULL_SCALE,angleHeadTopTargetWorld} from '../src/core/geometry.js';
import {ANGLE_HEAD,angleHeadDiagnostics,angleHeadTcpWorld,angleTargetPose} from '../src/core/angle-head.js';
import {getDemoPose,getSpindleAngle,getAngleOutputRotation} from '../src/core/trajectory.js';
import {frontStandoffMeters} from '../src/core/machine-kinematics.js';
import {makeDemoTrace} from '../src/core/process-demo.js';
const contract=JSON.parse(readFileSync(new URL('../docs/SCENE-CONTRACT.json',import.meta.url),'utf8'));
const near=(a,b,eps=1e-9)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);

test('模型 10% 统一尺度，车体仍留在原装夹台包络内',()=>{
 assert.deepEqual(HULL_SCALE,{x:1.1,y:1.1,z:1.1});
 assert.ok(4.22*HULL_SCALE.x<11.1/2-.4);
 assert.ok(GEOMETRY.hullWidth*HULL_SCALE.z<5.70-.8);
 assert.deepEqual(contract.workpiece.displayScale,HULL_SCALE);
});
test('顶部角度头加工点不落入炮塔敞口，且位于顶板横向边界内',()=>{
 const t=angleHeadTopTargetWorld();
 const localX=t.x/HULL_SCALE.x,localZ=(t.z-GEOMETRY.hullCenterZ)/HULL_SCALE.z;
 assert.ok(localX>.57&&localX<2.74);
 assert.ok(Math.abs(localZ)<1.99);
 assert.ok(Math.hypot(localX-1.60,localZ)>.78+.25);
 near(t.y,GEOMETRY.hullCenterY+(2.38+.04)*HULL_SCALE.y);
});
test('角度头两轴正交且两个坐标轴分别在 Z 与 Y，防转与实际校准均未宣称通过',()=>{
 near(ANGLE_HEAD.inputAxis.reduce((s,v,i)=>s+v*ANGLE_HEAD.outputAxis[i],0),0);
 assert.equal(ANGLE_HEAD.antiRotationLocatingRequired,true);
 assert.equal(ANGLE_HEAD.toolLengthCalibrationRequired,true);
 assert.equal(ANGLE_HEAD.clearanceAndReachValidated,false);
 assert.equal(contract.machine.angleHead.reachCollisionEnvelopeValidated,false);
});
test('角度头加工区下探只改变 Y，不移动 X/Z 目标轴线',()=>{
 const {machineX,ramExtension,safeHeadY,feedHeadY}=angleTargetPose();
 near(getDemoPose(.825).machineX,machineX);
 near(getDemoPose(.825).ramExtension,ramExtension);
 assert.ok(safeHeadY>feedHeadY);
 for(let j=0;j<=250;j++){
  const p=getDemoPose(.824+.046*j/250),tcp=angleHeadTcpWorld(p),d=angleHeadDiagnostics(p);
  near(tcp.x,d.target.x);near(tcp.z,d.target.z);
  assert.ok(d.tipToTopSurfaceMeters>=.0899);
 }
});
test('连续 5001 帧工具模式始终互斥，换装区不得有输出主轴旋转',()=>{
 for(let j=0;j<=5000;j++){
  const p=getDemoPose(j/5000);
  assert.ok(['boring','angle','probe','none'].includes(p.toolMode));
  if(p.stage==='angleChange'){assert.equal(p.isCutting,false);assert.equal(p.angleOutputRotating,false);assert.equal(p.spindleRotating,false);}
  if(p.toolMode!=='angle')assert.equal(p.angleOutputRotating,false);
  assert.ok(frontStandoffMeters(p)>=.0899);
 }
});
test('角度头模拟记录包含 TCP 和安全限制，不伪造实际切削、计量、碰撞通过',()=>{
 const pose=getDemoPose(.841),trace=makeDemoTrace(.841,pose);
 assert.equal(trace.stage,'angleMachining');
 assert.equal(trace.simulated,true);
 assert.equal(trace.rightAngleHead.antiRotationVerified,false);
 assert.equal(trace.rightAngleHead.actualMachineCollisionCertified,false);
 assert.equal(trace.rightAngleHead.actualTcpCalibrated,false);
 assert.equal(trace.quality.measured,false);
 assert.equal(trace.operation,null);
});
