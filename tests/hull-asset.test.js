import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/models/workpiece.js',import.meta.url),'utf8');
const stage=JSON.parse(readFileSync(new URL('../docs/SCENE-CONTRACT.json',import.meta.url),'utf8'));
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('Three.js 直接生成车体，旧 CC0 网格文件不再用于运行时',()=>{
 assert.match(source,/new THREE\.ExtrudeGeometry\(createOutline\(/);
 assert.match(source,/new THREE\.ExtrudeGeometry\(createDeck\(/);
 assert.doesNotMatch(source,/GLTFLoader|vehicle-hull-only\.glb|tank\.blend/);
});
test('侧板以 Shape.holes 构造贯穿轮孔和侧面安装孔',()=>{
 assert.match(source,/s\.holes\.push\(cut\)/);
 assert.match(source,/for\(const x of HULL_CONFIG\.wheelAxleXs\)/);
 assert.match(source,/for\(const x of HULL_CONFIG\.mountingXs\)/);
 assert.equal(stage.workpiece.wheelHolePairs,5);
 assert.equal(stage.workpiece.holesArePhysicalGeometry,true);
 assert.equal(stage.workpiece.holesAreMachinedAtRuntime,false);
});
test('炮塔安装口是顶板真实圆形洞，开口中心没有顶板盖住',()=>{
 assert.match(source,/function createDeck\(/);
 assert.match(source,/cut\.absarc\(x,z,radius/);
 assert.match(source,/s\.holes\.push\(cut\)/);
 assert.match(source,/new THREE\.CylinderGeometry\(tc\.radius/);
 assert.equal(stage.workpiece.topTurretOpening.isOpen,true);
 assert.equal(stage.workpiece.topTurretOpening.axis,'Y');
});
test('顶板与车体侧壁采用同一局部坐标系及可独立切换结构线',()=>{
 assert.match(source,/hull\.add\(edges\)/);
 assert.match(source,/hull\.position\.set\(0,GEOMETRY\.hullCenterY,GEOMETRY\.hullCenterZ\)/);
 assert.match(source,/edges\.visible=wires/);
});
test('内置工艺展示不伪装为仿真、验收或 CNC 控制',()=>{
 assert.equal(stage.workpiece.geometryIsManufacturingCertified,false);
 assert.equal(stage.machine.actualWheelBoreMachiningReachability,'not validated');
 assert.equal(stage.safetyConstraints.remoteCncStart,false);
 assert.match(html,/非 NC/);
 assert.match(html,/开口|敞口/);
});
