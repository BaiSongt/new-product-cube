import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compactDemoSummary,makeDemoTrace} from '../src/core/process-demo.js';
import {getDemoPose,WORKFLOW} from '../src/core/trajectory.js';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const html=read('../index.html'),code=read('../src/main.js'),styles=read('../src/styles.css'),machine=read('../src/models/machine.js');

test('M4 的数据小面板默认收起、可按需显示摘要和完整 JSON',()=>{
 for(const id of ['toggle-trace','trace-body','trace-summary','trace-json','trace-json-details','copy-demo-trace','export-demo-trace'])assert.ok(html.includes(`id="${id}"`),id);
 assert.match(html,/<div id="trace-body"[^>]*hidden>/);
 assert.match(code,/traceBody\.hidden=!traceOpen/);
 assert.match(styles,/\.trace-body\[hidden\]\{display:none\}/);
 assert.match(styles,/#trace-json\{[^}]*max-height:170px/);
});
test('小面板是只读视图，不存在提交 CNC、WebSocket 与跨安全域操作',()=>{
 assert.doesNotMatch(code,/new WebSocket\(|fetch\(|http[s]?:\/\//);
 assert.doesNotMatch(html,/http[s]?:\/\//);
 assert.match(code,/JSON\.stringify\(record,null,2\)/);
 assert.match(code,/navigator\.clipboard/);
 assert.match(code,/URL\.createObjectURL/);
});
test('记录摘要与完整 JSON 保持阶段、任务、进度一致且标明非实测',()=>{
 for(const progress of [0,.11,.24,.34,.46,.72,.85,.95,1]){
  const record=makeDemoTrace(progress,getDemoPose(progress));
  const summary=compactDemoSummary(record);
  assert.equal(summary.stage,record.stage);
  assert.equal(summary.task,record.package.id);
  assert.equal(summary.progressPercent,Math.round(progress*100));
  assert.equal(record.simulated,true);
  assert.equal(record.quality.measured,false);
  assert.equal(record.quality.independentFinalInspection,'尚未进行');
  assert.match(summary.inspection,/非实测/);
  assert.doesNotMatch(JSON.stringify(record),/[a-f0-9]{64}/);
 }
});
test('全部九阶段均有按钮；CAM 工艺准备是独立流程和业务标签',()=>{
 for(const s of WORKFLOW)assert.ok(html.includes(`data-stage="${s.id}"`),s.id);
 assert.ok(html.includes('data-process="cam"'));
 assert.match(code,/case 'cam':/);
 assert.match(code,/stageView=\{research:'overview'/);
});
test('三维测头与镗杆共享滑枕主轴轴线，显示状态由确定性轨迹选择',()=>{
 assert.match(machine,/const probe=new THREE\.Group\(\)/);
 assert.match(machine,/probeTip\.position\.set\(0,GEOMETRY\.spindleLocalY,MACHINE_ASSEMBLY\.probeBallCenterLocalZ\)/);
 assert.match(machine,/spindleDrive\.visible=pose\.toolMode==='boring'/);
 assert.match(machine,/probe\.visible=pose\.toolMode==='probe'/);
 assert.match(code,/perpendicularProbeAxisError\(pose\)/);
});
test('研发端三维特征叠加层引用统一孔位，不生成真实 NC 刀位',()=>{
 const overlay=read('../src/models/cam-overlay.js');
 assert.match(overlay,/GEOMETRY\.mountingXs/);
 assert.match(overlay,/pose\.stage==='research'/);
 assert.match(overlay,/不是能够下发的刀路/);
 assert.match(code,/camOverlay\.update\(pose\)/);
});
