import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectAngleHeadClearance,inspectAttachmentTransition,DEMO_ENVELOPE} from '../src/core/clearance.js';
import {getDemoPose} from '../src/core/trajectory.js';
import {GEOMETRY,HULL_SCALE,HULL_DECK,angleHeadTopTargetWorld} from '../src/core/geometry.js';
import {makeDemoTrace} from '../src/core/process-demo.js';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const eps=1e-8;

test('顶板、炮塔开口、顶部目标共享统一几何契约',()=>{
 const point=angleHeadTopTargetWorld();
 assert.equal(HULL_DECK.turretRadius,.78);
 assert.ok(HULL_DECK.xMin<HULL_DECK.turretX&&HULL_DECK.turretX<HULL_DECK.xMax);
 assert.ok(HULL_DECK.zMin<HULL_DECK.turretZ&&HULL_DECK.turretZ<HULL_DECK.zMax);
 assert.ok(Math.abs(point.y-(GEOMETRY.hullCenterY+HULL_DECK.topY*HULL_SCALE.y))<eps);
 const workpiece=read('../src/models/workpiece.js');
 assert.match(workpiece,/depth:HULL_DECK.thickness/);
 assert.match(workpiece,/deck.position.y=HULL_DECK.deckY\+HULL_DECK.baseOffset/);
});

test('M7 顶部工序密集采样，输出刀具和壳体留出示意安全净距',()=>{
 let minimum=Infinity,seen=0;
 for(let i=0;i<=2400;i++){
  const p=getDemoPose(.76+i*(.87-.76)/2400),result=inspectAngleHeadClearance(p);
  assert.equal(p.toolMode,'angle');
  assert.ok(['clear','outside'].includes(result.status),'step '+i+': '+result.status);
  assert.equal(result.actualMachineCertified,false);
  assert.equal(result.fullSceneCollisionCertified,false);
  if(result.minimumGapMeters!==null){minimum=Math.min(minimum,result.minimumGapMeters);seen++;}
 }
 assert.ok(seen>500);
 assert.ok(minimum>=DEMO_ENVELOPE.requestedMargin-1e-7);
});

test('改变实际关节 Y 后能够从安全变为预警和示意干涉',()=>{
 const nominal=getDemoPose(.848),normal=inspectAngleHeadClearance(nominal);
 assert.equal(normal.status,'clear');
 assert.ok(Math.abs(normal.cutterGapMeters-.09)<eps);
 const warning=inspectAngleHeadClearance({...nominal,headY:nominal.headY-.04});
 assert.equal(warning.status,'attention');assert.ok(warning.minimumGapMeters>0);
 const interference=inspectAngleHeadClearance({...nominal,headY:nominal.headY-.12});
 assert.equal(interference.status,'interference');assert.ok(interference.cutterGapMeters<0);
 assert.equal(interference.fullSceneCollisionCertified,false);
});

test('壳体包络可单独报警，不能只考虑刀具中心',()=>{
 const nominal=getDemoPose(.848);
 const x=HULL_DECK.xMin*HULL_SCALE.x-.27;
 const result=inspectAngleHeadClearance({...nominal,machineX:x,headY:nominal.headY-1.15});
 assert.equal(result.cutterOverSolidDeck,false);
 assert.equal(result.housingOverDeck,true);
 assert.equal(result.status,'interference');
 assert.ok(result.housingGapMeters<0);
});

test('炮塔口边缘区分水平投影与真实竖向干涉，边界外不报告通过',()=>{
 const nominal=getDemoPose(.824);
 const turretX=HULL_DECK.turretX*HULL_SCALE.x;
 const turretZ=GEOMETRY.hullCenterZ+HULL_DECK.turretZ*HULL_SCALE.z;
 const rimPose={...nominal,machineX:turretX+HULL_DECK.turretRadius*HULL_SCALE.x,
  ramExtension:turretZ-GEOMETRY.machineRootZ-5};
 const rim=inspectAngleHeadClearance(rimPose);
 assert.equal(rim.projectedTurretRimOverlap,true);
 assert.equal(rim.status,'clear');
 const low=inspectAngleHeadClearance({...rimPose,headY:rimPose.headY-.30});
 assert.equal(low.status,'interference');
 const away=inspectAngleHeadClearance({...nominal,machineX:-6,ramExtension:.06});
 assert.equal(away.status,'outside');assert.equal(away.minimumGapMeters,null);
});

test('人工附件更换需停转且滑枕停放，故障注入必须禁止',()=>{
 for(const [before,after] of [[.74199,.742],[.75099,.751],[.89899,.899],[.97499,.975]]){
  const decision=inspectAttachmentTransition(getDemoPose(before),getDemoPose(after));
  assert.equal(decision.changed,true);assert.equal(decision.permitted,true);
  assert.equal(decision.actualInterlock,false);
 }
 const base=getDemoPose(.742);
 assert.equal(inspectAttachmentTransition({...base,toolMode:'boring',spindleRotating:true},base).permitted,false);
 assert.equal(inspectAttachmentTransition({...base,toolMode:'boring',ramExtension:1.1},base).permitted,false);
 assert.equal(inspectAttachmentTransition(base,{...base,toolMode:'angle',ramExtension:1.1}).permitted,false);
 assert.equal(inspectAttachmentTransition(base,{...base,toolMode:'angle',angleOutputRotating:true}).permitted,false);
});

test('JSON 追溯和交互可见预检均保留非认证身份',()=>{
 const trace=makeDemoTrace(.84,getDemoPose(.84));
 assert.equal(trace.simulated,true);assert.equal(trace.sceneClearancePreflight.status,'clear');
 assert.equal(trace.sceneClearancePreflight.actualMachineCertified,false);
 assert.equal(trace.quality.measured,false);
 const html=read('../index.html'),script=read('../src/main.js');
 for(const id of ['clearance-preflight','clearance-status','clearance-description','toggle-envelope','envelope-value']){
  assert.ok(html.includes('id="'+id+'"'));
 }
 assert.ok(html.includes('data-view="angleClose"'));
 assert.ok(script.includes('angleHeadTcpWorld(getDemoPose(progress))'));
 assert.ok(script.includes('仅简化几何预检，非实机碰撞认证'));
});

test('拒绝不合法或非有限的关节与附件状态',()=>{
 assert.throws(()=>inspectAngleHeadClearance({machineX:NaN,headY:2,ramExtension:0}),TypeError);
 assert.throws(()=>inspectAngleHeadClearance(null),TypeError);
 assert.throws(()=>inspectAttachmentTransition(null,getDemoPose(.75)),TypeError);
});
