import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_PACKAGE,displayState,makeDemoTrace,PROCESS_SEQUENCE} from '../src/core/process-demo.js';
import {getDemoPose} from '../src/core/trajectory.js';

test('演示工作流明确研发物理隔离、DNC 与 CNC 现场控制的不同边界',()=>{
 assert.deepEqual(PROCESS_SEQUENCE.map(x=>x.id),['research','handoff','dnc','cnc','mdc','quality']);
 assert.match(DEMO_PACKAGE.transfer,/人工交接/);
 assert.match(DEMO_PACKAGE.approval,/未签发正式/);
 assert.match(DEMO_PACKAGE.interface,/不读取 CNC/);
});
test('阶段模拟记录确定性生成，不生成伪造实际哈希或合格结论',()=>{
 for(const t of [.0,.15,.34,.46,.76,.85,.97]){
  const a=makeDemoTrace(t,getDemoPose(t)),b=makeDemoTrace(t,getDemoPose(t));
  assert.deepEqual(a,b);
  assert.equal(a.simulated,true);
  assert.equal(a.quality.measured,false);
  assert.match(a.disclaimer,/非真实 CNC/);
  assert.doesNotMatch(JSON.stringify(a),/[a-f0-9]{64}/);
 }
});
test('MDC 显示为虚拟数据，检测仅为采点规划说明',()=>{
 const machining=displayState(.47,getDemoPose(.47));
 assert.equal(machining.stage,'machining');
 assert.match(machining.mdc.feed,/模拟/);
 const inspection=displayState(.945,getDemoPose(.945));
 assert.match(inspection.inspection,/非实测/);
 const archive=displayState(.98,getDemoPose(.98));
 assert.match(archive.archive,/不产生合格结论/);
});

test('导出记录包含虚拟几何对准量，但明确无测量效力',()=>{
 const t=.46,record=makeDemoTrace(t,getDemoPose(t));
 assert.ok(record.virtualAlignment);
 assert.ok(record.virtualAlignment.perpendicularErrorMeters<1e-10);
 assert.ok(record.virtualAlignment.toolTipToNearSidewallMeters>.05);
 assert.equal(record.virtualAlignment.isActualMachineMeasurement,false);
 assert.equal(record.quality.uncertainty,'未评定');
 assert.equal(record.quality.plannedSectionsPerSide,2);
});
