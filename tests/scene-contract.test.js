import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path)=>readFileSync(new URL(path,import.meta.url),'utf8');
const manifest=JSON.parse(read('../docs/SCENE-CONTRACT.json'));
const html=read('../index.html');
const js=read('../src/main.js');

test('场景约束明确了单机、离线、示意和坐标单位',()=>{
 assert.equal(manifest.machine.count,1);
 assert.equal(manifest.coordinates.worldUp,'Y');
 assert.equal(manifest.coordinates.handedness,'right');
 assert.equal(manifest.coordinates.conversionMmToM,.001);
 assert.equal(manifest.representation,'schematic');
 assert.equal(manifest.validatedAgainstRealMachine,false);
 assert.equal(manifest.safetyConstraints.remoteCncStart,false);
 assert.equal(manifest.safetyConstraints.researchProductionPhysicalIsolation,true);
});
test('战车车体两侧轴孔必须共享横向 Z 轴理论轴线',()=>{
 const [left,right]=manifest.workpiece.wheelAxleBores;
 assert.equal(left.axisDirection,'Z');
 assert.equal(right.axisDirection,'Z');
 assert.equal(left.yMeters,right.yMeters);
 assert.equal(left.xMeters,right.xMeters);
 assert.ok(left.zMeters<1 && right.zMeters>4);
});
test('示意主轴轨迹只指向正面安装孔，不假定能直接加工车轮轴孔',()=>{
 assert.equal(manifest.machine.demoTrajectoryTargets,'twoSideMountHoles');
 assert.equal(manifest.machine.actualWheelBoreMachiningReachability,'not validated');
 for(const p of manifest.workpiece.frontMountingHoles)assert.equal(p.axisDirection,'Z');
});
test('必需的真实交互控件和三维场景入口均存在',()=>{
 for(const id of ['viewport','play-pause','motion-progress','speed','reset-motion','toggle-guides','toggle-labels','fullscreen','detail-close']){
  assert.ok(html.includes(`id="${id}"`),id);
 }
 assert.ok(js.includes('new THREE.WebGLRenderer('));
 assert.ok(js.includes('new OrbitControls('));
 assert.ok(js.includes('new THREE.Raycaster('));
});
test('源码不依赖 CDN，生产端不包含 WebSocket 或云端控制请求',()=>{
 assert.doesNotMatch(html,/https?:\/\//);
 assert.doesNotMatch(js,/https?:\/\/|new WebSocket\(|fetch\(/);
});

test('界面包含实时世界坐标轴误差和四业务视图，所有数据标明模拟',()=>{
 for(const id of ['axis-error','ops-title','ops-facts','toggle-trace','trace-body','export-demo-trace'])assert.ok(html.includes(`id="${id}"`));
 for(const view of ['cam','dnc','mdc','inspection','archive'])assert.ok(html.includes(`data-process="${view}"`));
 assert.match(js,/getSpindleWorldAxis\(/);
 assert.match(js,/err\*1000/);
 assert.match(html,/模拟过程记录|模拟数据|SIMULATED/);
});

test('显示的主轴中心线跟镗杆轴一致，切削刃不参与定中心',()=>{
 const src=read('../src/models/machine.js');
 assert.match(src,/shaft=meshCylinder\(\.14,1\.23,railMat,0,0,5\.37\)/);
 assert.match(src,/spindleDrive\.position\.y=GEOMETRY\.spindleLocalY/);
 assert.match(src,/spindleGuide\.add\(line\(\[\[0,\.02,3\.10\],\[0,\.02,6\.18\]\]/);
 assert.match(src,/getSpindleWorldAxis\(\)/);
 assert.match(src,/new THREE\.Vector3\(0,GEOMETRY\.spindleLocalY,MACHINE_ASSEMBLY\.boringTipLocalZ\)/);
});
