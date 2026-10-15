import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getDemoPose,getActiveStage,WORKFLOW,DEMO_DURATION_SECONDS,DEMO_MOUNT_CENTERS,TOOL_TIP_X_OFFSET,clamp01,getSpindleAngle,getAngleOutputRotation} from '../src/core/trajectory.js';
import {GEOMETRY,HULL_SCALE,holeCenterWorld,targetPoseForHole,perpendicularAxisError,probeTargetWorld,perpendicularProbeAxisError,angleHeadTopTargetWorld} from '../src/core/geometry.js';
import {angleTargetPose,angleHeadDiagnostics} from '../src/core/angle-head.js';
import {frontStandoffMeters} from '../src/core/machine-kinematics.js';
import {OPERATIONS,getOperationAt} from '../src/core/operation-plan.js';
const near=(a,b,eps=1e-8)=>assert.ok(Math.abs(a-b)<=eps,`${a} != ${b}`);

test('M6 150 秒九阶段且先加工/安全更换附件后检测与归档',()=>{
 assert.equal(DEMO_DURATION_SECONDS,150);
 assert.deepEqual(WORKFLOW.map(s=>s.id),['research','setup','alignment','dnc','machining','angleChange','angleMachining','inspection','archive']);
 assert.deepEqual(getDemoPose(.8),getDemoPose(.8));
 for(let i=1;i<WORKFLOW.length;i++)assert.ok(WORKFLOW[i].time>WORKFLOW[i-1].time);
 for(const st of WORKFLOW)assert.equal(getActiveStage(st.time).id,st.id);
 assert.equal(clamp01(-1),0);assert.equal(clamp01(2),1);
});

test('参数化车体放大后侧孔、轮孔、炮塔口、顶板目标共用相同缩放系',()=>{
 assert.deepEqual(HULL_SCALE,{x:1.1,y:1.1,z:1.1});
 near(holeCenterWorld(0).x,-2.42*1.10);
 near(holeCenterWorld(1).x,2.59*1.10);
 near(holeCenterWorld(0).y,GEOMETRY.hullCenterY+GEOMETRY.mountingY*1.1);
 near(GEOMETRY.nearWallWorldZ,GEOMETRY.hullCenterZ-GEOMETRY.hullWidth*1.1/2);
 const top=angleHeadTopTargetWorld();
 near(top.x,1.60*1.1);near(top.z,GEOMETRY.hullCenterZ-1.50*1.1);
 assert.deepEqual(top.axis,[0,-1,0]);
});

test('四道直镗工序两侧共轴、连续退刀并保持工作面安全净距',()=>{
 assert.deepEqual(OPERATIONS.map(op=>op.id),['A-ROUGH','A-FINISH','B-ROUGH','B-FINISH']);
 for(const op of OPERATIONS){
  assert.ok(op.start<op.feedEnd&&op.feedEnd<op.retractEnd);
  near(getOperationAt(op.start).extension,.06);near(getOperationAt(op.feedEnd).extension,op.reach);
  for(let j=0;j<=50;j++){
   const p=getDemoPose(op.start+(op.retractEnd-op.start)*j/51);
   assert.equal(p.toolMode,'boring');assert.equal(p.highlightHole,op.hole);
   near(perpendicularAxisError(p,op.hole),0);
   assert.ok(frontStandoffMeters(p)>=.0999);
  }
 }
 assert.equal(TOOL_TIP_X_OFFSET,0);
 near(DEMO_MOUNT_CENTERS.left,GEOMETRY.mountingXs[0]);near(DEMO_MOUNT_CENTERS.right,GEOMETRY.mountingXs[1]);
 for(let i=0;i<2;i++)near(targetPoseForHole(i).machineX,holeCenterWorld(i).x);
});

test('主轴停转、滑枕退回、返回换头位后才能拆镗杆并装 90°头',()=>{
 assert.equal(getDemoPose(.68999).toolMode,'boring');
 assert.equal(getDemoPose(.69).spindleRotating,false);
 assert.equal(getDemoPose(.721).ramExtension,.06);
 near(getDemoPose(.729).machineX,-5.4);
 near(getDemoPose(.741).headY,angleTargetPose().safeHeadY);
 assert.equal(getDemoPose(.747).toolMode,'none');
 assert.equal(getDemoPose(.752).toolMode,'angle');
 assert.equal(getDemoPose(.752).spindleRotating,false);
 assert.equal(getDemoPose(.752).angleOutputRotating,false);
});

test('角度头沿 +Z 进、沿 -Y 输出；顶部定位完成时独立 TCP 共轴',()=>{
 const plan=angleTargetPose();const at=getDemoPose(.842);const d=angleHeadDiagnostics(at);
 assert.equal(at.toolMode,'angle');
 near(at.machineX,plan.machineX);near(at.ramExtension,plan.ramExtension);
 near(d.axisErrorMeters,0);
 assert.deepEqual(d.outputDirection,[0,-1,0]);
 assert.ok(d.tipToTopSurfaceMeters>=.08999);
 assert.equal(d.antiRotationVerified,false);
 assert.equal(d.toolOffsetCalibrated,false);
 assert.equal(d.collisionValidated,false);
 for(let i=0;i<=160;i++){
  const p=getDemoPose(.824+.046*i/160),r=angleHeadDiagnostics(p);
  near(r.axisErrorMeters,0);
  assert.ok(r.tipToTopSurfaceMeters>=.0899);
 }
});

test('九阶段总计 12001 帧：动作连续、前向净距不越界；改变 X 时绝不同时推进滑枕',()=>{
 let prev=getDemoPose(0);
 for(let i=1;i<=12000;i++){
  const p=getDemoPose(i/12000),gap=frontStandoffMeters(p);
  assert.ok(gap>=.0899,`step=${i},t=${p.t} gap=${gap}`);
  const changingX=Math.abs(p.machineX-prev.machineX)>1e-9;
  if(changingX){near(p.ramExtension,.06,2e-6);near(prev.ramExtension,.06,2e-6);}
  for(const key of ['machineX','headY','ramExtension'])assert.ok(Math.abs(p[key]-prev[key])<.045,`${key} ${i}`);
  prev=p;
 }
});

test('角度头先完全退回再换测头，检测重新找正后才开始进给',()=>{
 assert.equal(getDemoPose(.88).toolMode,'angle');
 near(getDemoPose(.896).ramExtension,.06);
 assert.equal(getDemoPose(.899).toolMode,'probe');
 for(let t of [.928,.93,.944,.949])near(perpendicularProbeAxisError(getDemoPose(t)),0);
 assert.equal(getDemoPose(.944).inspectionActive,true);
 assert.ok(frontStandoffMeters(getDemoPose(.944))>=.11);
});

test('归档必须完全退回测头后才执行 X 横移，不发真实 CNC 指令',()=>{
 near(getDemoPose(.955).ramExtension,.76);
 near(getDemoPose(.975).ramExtension,.06);
 near(getDemoPose(.975).machineX,getDemoPose(.955).machineX);
 assert.ok(getDemoPose(.988).machineX<getDemoPose(.975).machineX);
});

test('主轴和角度头旋转相互独立，不转动固定头壳体',()=>{
 assert.ok(getSpindleAngle(.68)>0);
 near(getSpindleAngle(.87),getSpindleAngle(.69));
 near(getAngleOutputRotation(.80),0);
 assert.ok(getAngleOutputRotation(.84)>0);
 near(getAngleOutputRotation(.95),getAngleOutputRotation(.848));
 assert.equal(getDemoPose(.84).angleOutputRotating,true);
 assert.equal(getDemoPose(.86).angleOutputRotating,false);
});

test('测量环节仍只是采点规划而非实测结果',()=>{
 assert.equal(GEOMETRY.inspectionSectionOffsets.length,2);
 assert.ok(GEOMETRY.inspectionSectionOffsets.every(x=>x>0&&x<GEOMETRY.hullSideThickness));
 const p=getDemoPose(.945);
 assert.equal(p.isCutting,false);assert.equal(p.inspectionActive,true);
 near(probeTargetWorld().x,GEOMETRY.wheelAxleXs[2]);
});
