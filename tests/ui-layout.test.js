import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {placeSceneLabels,rectanglesOverlap} from '../src/ui/overlay-layout.js';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
const script=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');

test('场景左右栏与诊断组件必须使用统一容器，视角栏不允许留多个入口',()=>{
 assert.equal((html.match(/class="left-rail"/g)||[]).length,1);
 assert.equal((html.match(/class="view-panel"/g)||[]).length,1);
 assert.equal((html.match(/class="right-rail"/g)||[]).length,1);
 assert.match(css,/\.left-rail>\.view-panel\{/);
 assert.match(css,/\.right-rail>\.trace-dock\.expanded/);
 assert.match(html,/id="mobile-nav-toggle"/);
 assert.match(html,/id="mobile-info-toggle"/);
 assert.match(script,/function closeMobileDrawers\(/);
});

test('标签避让固定组件和已落位标签，不发生互相遮挡',()=>{
 const obstacles=[{left:0,top:0,right:220,bottom:600},{left:760,top:0,right:1000,bottom:600},{left:200,top:670,right:800,bottom:760}];
 const items=[{id:'a',x:500,y:320,width:140,height:42},{id:'b',x:500,y:320,width:140,height:42},
  {id:'c',x:100,y:300,width:140,height:42}];
 const positions=placeSceneLabels(items,obstacles,{width:1000,height:760});
 for(const p of positions){
  if(!p.visible)continue;
  const item=items.find(x=>x.id===p.id);
  const r={left:p.left,top:p.top,right:p.left+item.width,bottom:p.top+item.height};
  for(const blocked of obstacles)assert.equal(rectanglesOverlap(r,blocked,8),false,p.id);
 }
 const a=positions.find(x=>x.id==='a'),b=positions.find(x=>x.id==='b');
 assert.ok(a.visible&&b.visible);
 const ra={left:a.left,top:a.top,right:a.left+140,bottom:a.top+42};
 const rb={left:b.left,top:b.top,right:b.left+140,bottom:b.top+42};
 assert.equal(rectanglesOverlap(ra,rb,8),false);
 assert.equal(positions.find(x=>x.id==='c').visible,false);
});

test('即使无空余位置，也会隐藏三维标签而不是盖住操作控件',()=>{
 const p=placeSceneLabels([{id:'covered',x:280,y:150,width:155,height:50}],
  [{left:0,top:0,right:600,bottom:300}],{width:600,height:300});
 assert.deepEqual(p,[{id:'covered',visible:false}]);
});

test('屏幕外标签不参与碰撞求解，UI 不会产生负坐标或越界标签',()=>{
 const p=placeSceneLabels([{id:'out',x:-20,y:-10,width:120,height:32}],[],{width:360,height:200});
 assert.equal(p[0].visible,false);
});
