import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {GEOMETRY,holeCenterWorld,probeTargetWorld} from '../src/core/geometry.js';
import {getDemoPose,getSpindleAngle} from '../src/core/trajectory.js';
import {MACHINE_ASSEMBLY,worldSpindleReference,frontStandoffMeters,spindleToPointAxisError,buildMachineDiagnostics} from '../src/core/machine-kinematics.js';
import {ANGLE_HEAD,angleHeadTcpWorld,angleHeadDiagnostics,angleTargetPose} from '../src/core/angle-head.js';
import {OPERATIONS,getOperationAt,getUpcomingOperation} from '../src/core/operation-plan.js';
import {makeDemoTrace,compactDemoSummary} from '../src/core/process-demo.js';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const near=(a,b,eps=1e-9)=>assert.ok(Math.abs(a-b)<=eps,`${a} != ${b}`);

test('M6 主轴基准端面—直镗杆—测头的参考链沿 +Z 同轴',()=>{
 assert.ok(MACHINE_ASSEMBLY.gaugePlaneLocalZ<MACHINE_ASSEMBLY.flangeEndLocalZ);
 assert.ok(MACHINE_ASSEMBLY.flangeEndLocalZ<MACHINE_ASSEMBLY.boringBarEndLocalZ);
 near(MACHINE_ASSEMBLY.boringTipLocalZ,GEOMETRY.toolAxisTipLocalZ);
 near(MACHINE_ASSEMBLY.probeBallCenterLocalZ,GEOMETRY.toolAxisTipLocalZ);
 assert.deepEqual(MACHINE_ASSEMBLY.spindleDirection,[0,0,1]);
});

test('直镗杆和测头独立位置链与数学 FK 始终对齐（仅在相应工具模式）',()=>{
 for(let i=0;i<=5000;i++){
  const p=getDemoPose(i/5000),ref=worldSpindleReference(p);
  near(ref.gauge.x,ref.barStart.x);near(ref.gauge.x,ref.cutterTip.x);
  near(ref.gauge.y,ref.barStart.y);near(ref.gauge.y,ref.probeCenter.y);
  if(p.toolMode==='angle'){
   const a=angleHeadTcpWorld(p);near(a.x,p.machineX);near(a.z,GEOMETRY.machineRootZ+p.ramExtension+ANGLE_HEAD.gearCenterLocalZ);
  }
  assert.ok(frontStandoffMeters(p)>=.0899);
 }
});

test('四工序仍可跳转，粗精镗无刀轴中心偏差',()=>{
 assert.deepEqual(OPERATIONS.map(o=>o.id),['A-ROUGH','A-FINISH','B-ROUGH','B-FINISH']);
 for(const op of OPERATIONS){
  near(getDemoPose(op.start).ramExtension,.06);
  near(getDemoPose(op.feedEnd).ramExtension,op.reach);
  for(let j=0;j<20;j++)near(spindleToPointAxisError(getDemoPose(op.start+(op.retractEnd-op.start)*j/20),holeCenterWorld(op.hole)),0);
 }
 assert.equal(getUpcomingOperation(.4).id,'A-FINISH');assert.equal(getUpcomingOperation(.70),null);
});

test('角度头输入输出轴真实正交、带防转定位和独立输出 TCP',()=>{
 assert.deepEqual(ANGLE_HEAD.inputAxis,[0,0,1]);assert.deepEqual(ANGLE_HEAD.outputAxis,[0,-1,0]);
 assert.equal(ANGLE_HEAD.inputAxis.reduce((x,v,i)=>x+v*ANGLE_HEAD.outputAxis[i],0),0);
 const d=angleHeadDiagnostics(getDemoPose(.845));near(d.axisErrorMeters,0);
 assert.ok(d.tipToTopSurfaceMeters>=.089);
 assert.equal(ANGLE_HEAD.antiRotationLocatingRequired,true);
 const src=read('../src/models/machine.js');
 assert.match(src,/angleHead\.visible=pose\.toolMode==='angle'/);
 assert.match(src,/angleOutput\.rotation\.y=pose\.angleOutputRotation/);
 assert.match(src,/stopBlock/);
 assert.match(src,/getAngleHeadTipWorldPosition/);
 assert.match(src,/compareAngleHeadTcp/);
});

test('模拟记录扩展角度头轴线和 TCP，未宣称实机标定',()=>{
 const bore=makeDemoTrace(.46,getDemoPose(.46));
 assert.equal(bore.operation.id,'A-FINISH');assert.equal(bore.simulated,true);
 assert.equal(bore.toolAssembly.actualToolLengthMeasurement,false);
 const p=getDemoPose(.842),trace=makeDemoTrace(.842,p),summary=compactDemoSummary(trace);
 assert.equal(trace.schemaVersion,4);
 assert.equal(trace.operation,null);
 assert.ok(trace.rightAngleHead);
 assert.ok(trace.rightAngleHead.axisErrorMeters<1e-8);
 assert.equal(trace.rightAngleHead.antiRotationVerified,false);
 assert.equal(trace.rightAngleHead.actualTcpCalibrated,false);
 assert.equal(trace.quality.measured,false);
 assert.match(summary.spindleAxisDeviation,/角度头计算/);
});

test('控制面板保留原四工序入口，并新增角度头流程及实时几何诊断',()=>{
 const h=read('../index.html'),m=read('../src/main.js');
 for(const id of ['operation-focus','operation-name','operation-state','operation-gap','operation-error','operation-jumps'])assert.ok(h.includes(`id="${id}"`));
 for(const stage of ['angleChange','angleMachining'])assert.ok(h.includes(`data-stage="${stage}"`));
 assert.match(m,/for\(const op of OPERATIONS\)/);
 assert.match(m,/machine\.compareAngleHeadTcp\(pose\)/);
 assert.match(m,/machine\.compareKinematicReference\(pose\)/);
});

test('测头净距应扣除实际测球半径，非虚拟相机距离',()=>{
 const pose=getDemoPose(.945),ref=worldSpindleReference(pose);
 assert.equal(pose.toolMode,'probe');
 near(frontStandoffMeters(pose),GEOMETRY.nearWallWorldZ-ref.probeCenter.z-MACHINE_ASSEMBLY.probeBallRadiusMeters);
 assert.ok(frontStandoffMeters(pose)>.11);
});
