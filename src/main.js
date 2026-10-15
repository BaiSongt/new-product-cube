import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {createWorkshop,createOffice,createCNCStation} from './models/workshop.js';
import {createMachine} from './models/machine.js';
import {createWorkpiece} from './models/workpiece.js';
import {createCamOverlay} from './models/cam-overlay.js';
import {getDemoPose,getActiveStage,WORKFLOW,DEMO_DURATION_SECONDS,clamp01} from './core/trajectory.js';
import {holeCenterWorld,perpendicularAxisError,probeTargetWorld,perpendicularProbeAxisError} from './core/geometry.js';
import {DEMO_PACKAGE,displayState,makeDemoTrace,compactDemoSummary} from './core/process-demo.js';
import {OPERATIONS} from './core/operation-plan.js';
import {buildMachineDiagnostics} from './core/machine-kinematics.js';
import {angleHeadDiagnostics,angleTargetPose,angleHeadTcpWorld} from './core/angle-head.js';
import {inspectAngleHeadClearance} from './core/clearance.js';
import './styles.css';

const canvas=document.querySelector('#viewport');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,2));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.42;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;

const scene=new THREE.Scene();scene.background=new THREE.Color(0xdde7ec);scene.fog=new THREE.Fog(0xdde7ec,36,90);
const camera=new THREE.PerspectiveCamera(40,1,.2,180);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.dampingFactor=.06;
controls.minDistance=3.4;controls.maxDistance=63;
controls.minPolarAngle=.09;controls.maxPolarAngle=Math.PI/2.13;
controls.screenSpacePanning=true;

const ambient=new THREE.HemisphereLight(0xffffff,0x8ea7ad,2.0);scene.add(ambient);
const key=new THREE.DirectionalLight(0xfff8ec,3.1);key.position.set(-9,20,7);
key.castShadow=true;key.shadow.mapSize.set(2048,2048);
key.shadow.camera.left=-25;key.shadow.camera.right=25;key.shadow.camera.top=23;key.shadow.camera.bottom=-23;
key.shadow.camera.near=1;key.shadow.camera.far=55;key.shadow.bias=-.0002;
scene.add(key);scene.add(key.target);
const fill=new THREE.DirectionalLight(0xc4e3f0,1.5);fill.position.set(14,11,-18);scene.add(fill);

const workshop=createWorkshop();const machine=createMachine();const workpiece=createWorkpiece();const office=createOffice();const cnc=createCNCStation();const camOverlay=createCamOverlay();
scene.add(workshop.root,machine.root,workpiece.root,office.root,cnc.root,camOverlay.root);

// 机旁工作间经专用有线网络向 CNC 下发受控程序的可视化：仅画面内示意光点，不操作真实设备。
const dncCablePath=new THREE.CatmullRomCurve3([
 new THREE.Vector3(13.1,.10,.8),new THREE.Vector3(12.4,.10,.8),
 new THREE.Vector3(12.4,.10,-6.1),new THREE.Vector3(8,.10,-6.1)
 ],false,'catmullrom',.05);
const transferPulse=new THREE.Mesh(new THREE.SphereGeometry(.18,16,12),
 new THREE.MeshBasicMaterial({color:0x00b8c5,transparent:true,opacity:.95,depthWrite:false}));
transferPulse.name='DNC 本地受控程序传输光点（模拟）';transferPulse.visible=false;scene.add(transferPulse);


// 不从外部网络加载贴图、模型、字体或图标；仅依赖本地 npm 构建的 Three.js。
const views={
 overview:{position:[22.5,14.1,-19.8],target:[1.3,2.45,-.35]},
 machine:{position:[6.5,9.3,-16.2],target:[-1.3,3.55,-4.75]},
 workpiece:{position:[-7.2,7.1,-10.3],target:[0,2.55,2.15]},
 bores:{position:[10.5,6.9,10.7],target:[0,2.35,2.75]},
 office:{position:[20.5,7.25,-.2],target:[13.85,1.75,4.1]},
 machining:{position:[-2.2,4.4,-6.2],target:[0.2,2.8,-.08]},
 anglehead:{position:[4.5,7.5,-2.35],target:[1.3,3.9,1.0]},
 angleClose:{position:[4.6,6.10,-1.75],target:[1.76,3.9,1.15]}
};
const tmpVec=new THREE.Vector3();
function v3(a){return new THREE.Vector3(...a)}
camera.position.copy(v3(views.overview.position));controls.target.copy(v3(views.overview.target));controls.update();
let cameraMove=null;
function flyTo(viewName){
 const cfg=views[viewName];if(!cfg)return;
 cameraMove={start:performance.now(),duration:1080,from:camera.position.clone(),to:v3(cfg.position),targetFrom:controls.target.clone(),targetTo:v3(cfg.target)};
 document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===viewName));
 const description={overview:'场景整体',machine:'结构与运动',workpiece:'装夹与基准',bores:'孔轴线与加工位置',office:'程序与监控工作间',machining:'镗杆与孔位共轴',anglehead:'90°直角铣头 · 顶部加工',angleClose:'角度头 TCP / 顶板局部特写'}[viewName];
 document.querySelector('.eyebrow').innerHTML=`<span class="tinybar"></span> SCENE VIEW / ${description}`;
}
controls.addEventListener('start',()=>{cameraMove=null;cameraFollow=false;document.querySelector('#toggle-follow')?.classList.remove('active');if(document.querySelector('#follow-value'))document.querySelector('#follow-value').textContent='关';});

const catalogue={
 machine:{kind:'设备 / MACHINE',title:'大型数控落地镗铣床',desc:'本次工程只建设一台落地镗铣床。沿地轨运动的立柱、垂直升降主轴箱、水平滑枕与前端刀具装配采用独立的运动层级。',facts:[['设备数量','1 台'],['模型状态','示意几何，型号待确认'],['运动依据','可复现示例轨迹'],['工程前提','机床精度与行程需现场核验']]},
 column:{kind:'运动部件 / COLUMN',title:'移动立柱（导轨 X 示意）',desc:'立柱随车体沿床身线轨移动。场景中的 X 轴方向与位置只用于说明机构关系，不能等同于实机坐标约定。',facts:[['关节','XCarriage'],['运动形式','直线导轨平移'],['实机行程','待现场实测']]},
 headstock:{kind:'运动部件 / HEADSTOCK',title:'主轴箱（Y 升降示意）',desc:'主轴箱沿立柱导轨升降，决定镗轴中心高度。其运动独立于立柱横移和滑枕伸缩。',facts:[['关节','YHeadstock'],['运动形式','竖直升降'],['机床坐标','示意 / 未核验']]},
 ram:{kind:'运动部件 / RAM',title:'滑枕及镗轴（Z 水平示意）',desc:'滑枕朝工件方向伸出。真实设备若有独立 W 镗轴，须按实机部件节点与轴定义进一步拆分；M1 暂不假设真实 W 行程。',facts:[['关节','ZRam'],['方向','朝向工件'],['真实 W 镗轴','待核实']]},
 tool:{kind:'加工资源 / TOOL ASSEMBLY',title:'主轴接口、刀柄、镗杆、90°角度头与测头',desc:'刀具按 X 立柱→Y 主轴箱→Z 滑枕→主轴接口→刀柄→镗杆层级装配；测头与镗杆互斥显示，刀杆绕主轴中心旋转。直角铣头输出轴方向为 -Y，防转定位、真实刀具长度、主轴锥度及 W 轴结构均需实机核验。',facts:[['装配位置','主轴前端'],['刀尖定位','由局部关节变换获得'],['角度头','换装人工示意，输入 +Z / 输出 -Y'],['加工能力','仅运动示意']]},
 workpiece:{kind:'工程示意 / HULL MESH',title:'参数化战车车体外壳',desc:'放大 10% 的车体，由 Three.js 直接创建前部斜装甲、真实顶板炮塔圆形敞口、五组成对车轮安装孔和两处侧面安装孔；不含炮塔、履带、车轮或内部设备。此为展示网格，非客户 STEP/B-Rep。',facts:[['几何构建','Shape + ExtrudeGeometry'],['工件比例','约 +10%（示意缩放）'],['侧壁轮孔','5 组／每侧，真实网格开孔'],['侧面安装孔','2 处，真实网格开孔'],['炮塔开口','顶部圆形敞口，可见内腔'],['工程属性','示意网格，未作实机仿真']]},
 'mounting-hole':{kind:'演示特征 / SIDE MOUNT',title:'侧面安装孔',desc:'安装孔已经预置为真实网格开口。黄色圆环表示当前演示目标；进给动画不会改变实体几何，不是材料去除仿真。',facts:[['目标','两处侧面安装孔'],['说明','预置网格开孔'],['现场可达性','待实机核验']]},
 clamp:{kind:'夹具 / FIXTURING',title:'支撑与压紧夹具',desc:'工件以固定台面、支撑块和压紧件示意装夹过程。对双侧孔可能存在的翻转、转位或二次装夹，必须在实机可达性核验后确定。',facts:[['定位基准','示意'],['夹紧力','未进行力学计算'],['重装夹方案','待设计评审']]},
 bores:{kind:'质量要求 / DESIGN AXIS',title:'两侧轮孔与共轴设计基准',desc:'两侧壁均有 5 处网格孔口。蓝色设计轴线对应其中一组两侧轴孔，用来解释空间轴线与在机检测；不含实测点云或同轴度判定。',facts:[['特征','左右两处大直径轴孔'],['重点','同轴度及轴线位置关系'],['检测方法','多截面采点与独立复核'],['工艺可达性','待实机验证']]},
 'left-bore':{kind:'孔位设计 / LEFT BORE',title:'近侧轮轴孔',desc:'近侧墙板带有真实网格开孔，但仍是示意尺寸；蓝色圈仅表示设计目标。',facts:[['孔洞','网格开孔'],['同轴度','未执行真实测量']]},
 'right-bore':{kind:'孔位设计 / RIGHT BORE',title:'远侧轮轴孔',desc:'远侧墙板带真实网格开孔；与近侧设计孔的共轴关系仅代表规划目标。',facts:[['孔洞','网格开孔'],['工艺可达性','待核验']]},
 office:{kind:'生产安全域 / LOCAL ROOM',title:'机旁独立工作间',desc:'独立离线工作间内布置程序接收检查、DNC 程序管理、MDC 状态采集、历史记录与备份设施。它仅与机床经批准的本地有线接口连接。',facts:[['DNC','受控程序下发 / 不启动 CNC'],['MDC','设备运行只读采集'],['研发侧交付','受控介质人工交接'],['网络','与研发办公网络物理隔离']]},
 cnc:{kind:'现场控制 / CNC',title:'机床现场操作站',desc:'机床仍由原 CNC 与现场操作员执行程序启动、安全联锁和报警处理。工作间监控不替代机床边的安全确认。',facts:[['循环启动','仅由现场授权人员'],['远端操作','不允许远程启动/复位'],['CNC 精确型号','待核实']]}
};
const detailTitle=document.querySelector('#detail-title'), detailKind=document.querySelector('#detail-kind'),detailDesc=document.querySelector('#detail-desc'),detailFacts=document.querySelector('#detail-facts');
let selected=null,selectedHelper=null;
const pickTargets={machine:machine.root,column:machine.column,headstock:machine.head,ram:machine.ram,tool:machine.tool,workpiece:workpiece.part,clamp:workpiece.root,bores:workpiece.part,'left-bore':workpiece.boreFeatures[0],'right-bore':workpiece.boreFeatures[1], 'mounting-hole':workpiece.part,office:office.root,cnc:cnc.root};
function showDetails(key){
 const content=catalogue[key];if(!content)return;
 selected=key;detailKind.textContent=content.kind;detailTitle.textContent=content.title;detailDesc.textContent=content.desc;
 detailFacts.replaceChildren();
 for(const [a,b] of content.facts){const row=document.createElement('div');row.className='detail-fact';
  const name=document.createElement('span');name.textContent=a;const val=document.createElement('strong');val.textContent=b;row.append(name,val);detailFacts.append(row);}
 const old=selectedHelper;if(old){scene.remove(old);old.geometry.dispose();old.material.dispose();}
 selectedHelper=null;
 const o=pickTargets[key];if(o && key!=='bores'){
   selectedHelper=new THREE.BoxHelper(o,0x0da8ac);scene.add(selectedHelper);
 }
 document.querySelector('#details').classList.add('selected');
}
function closeDetails(){selected=null;document.querySelector('#details').classList.remove('selected');detailKind.textContent='场景说明 / SCENE GUIDE';detailTitle.textContent='数字化加工单元';detailDesc.textContent='当前展示一台大型数控落地镗铣床及其机旁离线工作间。点击三维模型中的部件，查看运动功能与业务职责。';detailFacts.replaceChildren();if(selectedHelper){scene.remove(selectedHelper);selectedHelper.geometry.dispose();selectedHelper.material.dispose();selectedHelper=null;}}
document.querySelector('#detail-close').addEventListener('click',closeDetails);

let playing=false,progress=0,playbackRate=1,cameraFollow=true,stageName='',currentProcessTab='cam';
const opsTitle=document.querySelector('#ops-title'),opsMessage=document.querySelector('#ops-message'),opsFacts=document.querySelector('#ops-facts');
function setProcessTab(next){currentProcessTab=next;document.querySelectorAll('[data-process]').forEach(el=>el.classList.toggle('active',el.dataset.process===next));refreshOperations();}
function refreshOperations(){
 const pose=getDemoPose(progress),display=displayState(progress,pose);
 let title='',message='',facts=[];
 switch(currentProcessTab){
  case 'cam':
   title='研发端 CAM · 工艺发布准备';message='CAD/PMI → 制造特征 → 工序与刀具 → 机床级仿真 → 后置 → 审批；与生产区物理隔离。';
   facts=[['工件','放大 10% 的示意车体'],['拟加工特征','侧面安装孔 A、B / 顶部角度头规划位'],['刀具/工装','参考配置，未绑定实机'],['发布状态','流程演示，未生成真实 NC']];break;
  case 'dnc':
   title='受控程序包 · DNC';message=display.handoff;
   facts=[['模拟任务',DEMO_PACKAGE.id],['版本',DEMO_PACKAGE.revision],['研发→生产','受控介质人工交接'],['批准状态','演示审批，非正式签发']];break;
  case 'mdc':
   title='MDC 只读状态';message='仅展示一台设备的虚拟采集字段；不连接真实 CNC。';
   facts=[['运行状态',display.mdc.state],['X/Y/Z 示意',`${pose.machineX.toFixed(2)} / ${pose.headY.toFixed(2)} / ${pose.ramExtension.toFixed(2)} m`],['工序',pose.operation?.name??(pose.stage==='angleMachining'?'顶部角度头加工':'工序准备 / 定位')],['刀具模式',pose.toolMode==='probe'?'工件测头':pose.toolMode==='angle'?'90°角度头':pose.toolMode==='none'?'待换装':'直镗杆'],['报警',display.mdc.alarm]];break;
  case 'inspection':
   title='轴孔多截面检测规划';message=display.inspection;
   facts=[['目标','两侧孔空间轴线'],['规划点位',`${Math.min(32,Math.floor(pose.inspectionProgress*32))} / 32（仅演示）`],['步骤','标定→多截面采点→轴线拟合'],['测头与孔轴','仅中心线对齐示意，无实际接触'],['检验结论','没有实测数据，不能判定合格']];break;
  case 'archive':
   title='作业记录与质量追溯';message=display.archive;
   facts=[['工件/作业',DEMO_PACKAGE.id],['程序完整性','示意说明，未计算 SHA-256'],['过程检测','规划中 / 非实测'],['独立终检','未进行']];break;
 }
 opsTitle.textContent=title;opsMessage.textContent=message;opsFacts.replaceChildren();
 for(const [label,value] of facts){const row=document.createElement('div');row.className='ops-fact';const key=document.createElement('span');key.textContent=label;const val=document.createElement('b');val.textContent=value;row.append(key,val);opsFacts.append(row);}
}
document.querySelectorAll('[data-process]').forEach(el=>el.addEventListener('click',()=>setProcessTab(el.dataset.process)));
// M4：过程 JSON 使用紧凑数据抽屉，不向主场景堆叠完整 JSON。
const traceDock=document.querySelector('#trace-dock');
const traceBody=document.querySelector('#trace-body');
let traceOpen=false,lastTraceRenderAt=-Infinity;
let traceJson='';
function refreshTracePanel(force=false){
 const active=getActiveStage(progress);
 document.querySelector('#trace-stage').textContent=active.label;
 if(!traceOpen)return;
 const now=performance.now();if(!force&&now-lastTraceRenderAt<220)return;
 lastTraceRenderAt=now;
 const record=makeDemoTrace(progress,getDemoPose(progress));
 const info=compactDemoSummary(record);
 const fields=[['任务',info.task],['阶段',active.label],['进度',`${info.progressPercent}%`],['工序',info.operation],
  ['设备状态',info.cnc],['刀轴偏差',info.spindleAxisDeviation],['检测',info.inspection],['终检',info.conclusion]];
 document.querySelector('#trace-summary').replaceChildren(...fields.map(([name,value])=>{
  const item=document.createElement('div');item.className='trace-stat';
  const a=document.createElement('span');a.textContent=name;
  const b=document.createElement('strong');b.textContent=value;
  item.append(a,b);return item;
 }));
 traceJson=JSON.stringify(record,null,2);
 document.querySelector('#trace-json').textContent=traceJson;
}
function showTrace(open){
 traceOpen=Boolean(open);traceBody.hidden=!traceOpen;
 traceDock.classList.toggle('expanded',traceOpen);
 document.body.classList.toggle('trace-open',traceOpen);
 document.querySelector('#toggle-trace').setAttribute('aria-expanded',String(traceOpen));
 document.querySelector('#trace-chevron').textContent=traceOpen?'收起 ▾':'展开 ▴';
 refreshTracePanel(true);
}
document.querySelector('#toggle-trace').addEventListener('click',()=>showTrace(!traceOpen));
document.querySelector('#open-trace').addEventListener('click',()=>showTrace(true));
document.querySelector('#copy-demo-trace').addEventListener('click',async()=>{
 refreshTracePanel(true);
 const button=document.querySelector('#copy-demo-trace');
 try{
  if(!navigator.clipboard?.writeText)throw new Error('clipboard-unavailable');
  await navigator.clipboard.writeText(traceJson);button.textContent='已复制 ✓';
 }catch(_){button.textContent='请手动选中 JSON 复制';document.querySelector('#trace-json-details').open=true;}
 setTimeout(()=>{button.textContent='复制 JSON';},2200);
});
document.querySelector('#export-demo-trace').addEventListener('click',()=>{
 refreshTracePanel(true);
 const url=URL.createObjectURL(new Blob([traceJson],{type:'application/json;charset=utf-8'}));
 const anchor=document.createElement('a');anchor.href=url;anchor.download='大型镗铣床_M7_仅模拟过程记录.json';
 document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
});
const operationFocus=document.querySelector('#operation-focus');
const operationName=document.querySelector('#operation-name');
const operationState=document.querySelector('#operation-state');
const operationGap=document.querySelector('#operation-gap');
const operationError=document.querySelector('#operation-error');
const operationButtons=document.querySelector('#operation-jumps');
const clearancePreflight=document.querySelector('#clearance-preflight');
const clearanceStatus=document.querySelector('#clearance-status');
const clearanceDescription=document.querySelector('#clearance-description');
for(const op of OPERATIONS){const btn=document.createElement('button');btn.type='button';btn.textContent=op.id;btn.dataset.operation=op.id;btn.title=op.name;btn.addEventListener('click',()=>{playing=false;progress=op.start+.001;updatePlaybackUI();flyTo('machining');});operationButtons.append(btn);}
function refreshOperationFocus(pose){
 const visible=['machining','angleChange','angleMachining','inspection'].includes(pose.stage);operationFocus.hidden=!visible;
 if(!visible)return;
 const diag=buildMachineDiagnostics(pose,pose.toolMode==='angle'?null:pose.highlightHole>=0?holeCenterWorld(pose.highlightHole):pose.inspectionActive?probeTargetWorld():null);
 operationName.textContent=pose.operation?.name??(pose.stage==='angleMachining'?'顶部平面 / 90°输出铣头':pose.stage==='angleChange'?'退刀停转 → 人工附件换装':pose.inspectionActive?'两侧轴孔检测点位规划':'两孔之间的安全换位');
 operationState.textContent=pose.operation?(pose.operation.motion==='feed'?'进给 / 非切削':'安全退刀'):pose.stage==='angleMachining'?'−Y 输出刀轴 · 顶板进给规划 / 非切削':pose.stage==='angleChange'?'停转 / 防转定位确认（均为示意）':pose.inspectionActive?'虚拟测头 / 不接触':'Z 轴回退后横移';
 operationGap.textContent=`${(diag.standoffMeters*1000).toFixed(0)} mm`;
 operationError.textContent=diag.axisErrorMeters===null?'—':`${(diag.axisErrorMeters*1000).toFixed(1)} mm`;
 const inAngle=pose.toolMode==='angle';
 clearancePreflight.hidden=!inAngle;
 if(inAngle){
  const check=inspectAngleHeadClearance(pose);
  machine.setAngleEnvelopeStatus(check.status);
  const label={outside:'远离顶部区域',clear:'场景净距充足',attention:'接近预警阈值',interference:'示意包络干涉'};
  clearanceStatus.textContent=label[check.status];clearancePreflight.dataset.status=check.status;
  const gap=check.minimumGapMeters===null?'未进入检查区域':`最小投影净距 ${(check.minimumGapMeters*1000).toFixed(0)} mm`;
  clearanceDescription.textContent=`${gap} · 仅简化几何预检，非实机碰撞认证`;
 }
 for(const btn of operationButtons.children)btn.classList.toggle('active',btn.dataset.operation===pose.operation?.id);
}
const storyNumber=document.querySelector('#story-number'),storyName=document.querySelector('#story-name'),storyDescription=document.querySelector('#story-description');
const stageView={research:'overview',setup:'workpiece',alignment:'machining',dnc:'office',machining:'machining',angleChange:'machine',angleMachining:'angleClose',inspection:'bores',archive:'office'};
function refreshStage(t){
 const stage=getActiveStage(t);if(stage.id===stageName)return;
 stageName=stage.id;
 const i=WORKFLOW.findIndex(x=>x.id===stage.id);
 storyNumber.textContent=`${String(i+1).padStart(2,'0')} / ${String(WORKFLOW.length).padStart(2,'0')}`;
 storyName.textContent=stage.label;storyDescription.textContent=stage.description;
 document.querySelectorAll('[data-stage]').forEach(b=>b.classList.toggle('active',b.dataset.stage===stage.id));
 if(stage.id==='research')setProcessTab('cam');
 else if(['dnc','inspection','archive'].includes(stage.id))setProcessTab(stage.id==='inspection'?'inspection':stage.id==='archive'?'archive':'dnc');
 else if(['machining','angleChange','angleMachining'].includes(stage.id))setProcessTab('mdc');
 if(playing&&cameraFollow)flyTo(stageView[stage.id]);
}
const play=document.querySelector('#play-pause'),glyph=document.querySelector('#play-glyph'),slider=document.querySelector('#motion-progress'),timecode=document.querySelector('#timecode');
function updatePlaybackUI(){
 const pose=getDemoPose(progress);machine.applyPose(pose);workpiece.applyAnimation(pose);camOverlay.update(pose);refreshStage(progress);refreshOperationFocus(pose);
 const chainError=machine.compareKinematicReference(pose);
 if(chainError>1e-7)console.error('主轴接口与纯数学正向运动学不一致',chainError);
 machine.setAxisGuideVisible(pose.toolMode==='boring'&&progress>=.18&&progress<.69);
 // 每帧以主轴中心线而非刀片外缘计算对中；真实 CNC 精度与测量误差不在本动画范围内。
 const errorEl=document.querySelector('#axis-error');
 if(pose.stage==='angleMachining'&&pose.toolMode==='angle'){
   const result=angleHeadDiagnostics(pose);const err=machine.compareAngleHeadTcp(pose);
   if(err>1e-7)console.error('角度头 TCP 数学/三维装配不一致',err);
   errorEl.textContent=`顶部轴线 ${(result.axisErrorMeters*1000).toFixed(1)} mm（计算）`;
   errorEl.classList.toggle('alignment-pending',result.axisErrorMeters>1e-6);
 }else if(pose.highlightHole>=0){
   const target=holeCenterWorld(pose.highlightHole),worldAxis=machine.getSpindleWorldAxis();
   const err=Math.hypot(worldAxis.to.x-target.x,worldAxis.to.y-target.y);
   // 三维物体变换与纯数据几何必须保持一致，否则立刻报出诊断错误。
   const analytical=perpendicularAxisError(pose,pose.highlightHole);
   if(Math.abs(err-analytical)>1e-6)console.error('演示机床关节坐标与几何基准不一致',err,analytical);
   errorEl.textContent=`${(err*1000).toFixed(1)} mm（模拟）`;
   errorEl.classList.toggle('alignment-pending',err>1e-6);
 }else if(pose.inspectionActive){
   const target=probeTargetWorld(),actual=machine.getSpindleWorldAxis().to;
   const error=Math.hypot(actual.x-target.x,actual.y-target.y);
   if(Math.abs(error-perpendicularProbeAxisError(pose))>1e-6)console.error('测头中心与几何基准不一致');
   errorEl.textContent=`测头 ${(error*1000).toFixed(1)} mm（计算）`;
   errorEl.classList.toggle('alignment-pending',error>1e-6);
 }else{errorEl.textContent='—';errorEl.classList.remove('alignment-pending');}
 refreshOperations();refreshTracePanel();
 // 本地光点只出现在 DNC 工作间与 CNC 之间；人工跨区交接不以网络光带连接。
 transferPulse.visible=progress>=.325&&progress<.37;
 if(transferPulse.visible){transferPulse.position.copy(dncCablePath.getPoint(clamp01((progress-.325)/.045)));}

 document.querySelector('#machine-phase').textContent=pose.phaseName;
 document.querySelector('#machine-status').textContent=pose.state;
 document.querySelector('#status-dot').classList.toggle('running',pose.isCutting);
 slider.value=String(Math.round(progress*1000));
 slider.style.setProperty('--pct',`${progress*100}%`);
 const current=Math.floor(progress*DEMO_DURATION_SECONDS);
 const total=Math.floor(DEMO_DURATION_SECONDS);
 timecode.textContent=`${String(Math.floor(current/60)).padStart(2,'0')}:${String(current%60).padStart(2,'0')} / ${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
 glyph.textContent=playing?'Ⅱ':'▶';play.setAttribute('aria-label',playing?'暂停运动':'播放运动');
}
function setPlay(next){if(next && progress>=1)progress=0;playing=next;updatePlaybackUI();}
play.addEventListener('click',()=>setPlay(!playing));
document.querySelector('#reset-motion').addEventListener('click',()=>{playing=false;progress=0;updatePlaybackUI();});
slider.addEventListener('input',e=>{playing=false;progress=clamp01(Number(e.target.value)/1000);updatePlaybackUI();});
document.querySelector('#speed').addEventListener('click',()=>{playbackRate=playbackRate===1?.5:playbackRate===.5?2:1;document.querySelector('#speed').textContent=`${playbackRate.toFixed(1)}×`;});
document.querySelectorAll('.view-button').forEach(b=>b.addEventListener('click',()=>{cameraFollow=false;document.querySelector('#toggle-follow').classList.remove('active');document.querySelector('#follow-value').textContent='关';flyTo(b.dataset.view);}));
document.querySelectorAll('[data-stage]').forEach(b=>b.addEventListener('click',()=>{playing=false;progress=WORKFLOW.find(s=>s.id===b.dataset.stage).time;updatePlaybackUI();flyTo(stageView[b.dataset.stage]);}));
document.querySelector('#toggle-follow').addEventListener('click',()=>{cameraFollow=!cameraFollow;document.querySelector('#toggle-follow').classList.toggle('active',cameraFollow);document.querySelector('#follow-value').textContent=cameraFollow?'开':'关';});
let labelsOn=true,guidesOn=true;
document.querySelector('#toggle-labels').addEventListener('click',()=>{labelsOn=!labelsOn;document.querySelector('#toggle-labels').classList.toggle('active',labelsOn);document.querySelector('#labels-value').textContent=labelsOn?'开':'关';});
document.querySelector('#toggle-wire').addEventListener('click',()=>{const enabled=!document.querySelector('#toggle-wire').classList.contains('active');workpiece.setWireframe(enabled);document.querySelector('#toggle-wire').classList.toggle('active',enabled);document.querySelector('#wire-value').textContent=enabled?'开':'关';});
document.querySelector('#toggle-envelope').addEventListener('click',()=>{const control=document.querySelector('#toggle-envelope');const enabled=machine.setAngleEnvelopeVisible(!control.classList.contains('active'));control.classList.toggle('active',enabled);document.querySelector('#envelope-value').textContent=enabled?'开':'关';});
document.querySelector('#toggle-guides').addEventListener('click',()=>{guidesOn=!guidesOn;workpiece.guides.visible=guidesOn;document.querySelector('#toggle-guides').classList.toggle('active',guidesOn);document.querySelector('#guides-value').textContent=guidesOn?'开':'关';});
document.querySelector('#fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch(_){/* 在受限浏览器环境下保持普通视图 */}});
document.querySelectorAll('.scene-tag').forEach(el=>el.addEventListener('click',()=>showDetails(el.dataset.key)));

const picker=new THREE.Raycaster(),mouse=new THREE.Vector2();
let startPoint=null;
canvas.addEventListener('pointerdown',e=>{startPoint={x:e.clientX,y:e.clientY};});
canvas.addEventListener('pointerup',e=>{
 if(!startPoint || Math.hypot(e.clientX-startPoint.x,e.clientY-startPoint.y)>6)return;
 const rect=canvas.getBoundingClientRect();mouse.set(((e.clientX-rect.left)/rect.width)*2-1,-((e.clientY-rect.top)/rect.height)*2+1);picker.setFromCamera(mouse,camera);
 const hits=picker.intersectObjects([machine.root,workpiece.root,office.root,cnc.root],true);
 const hit=hits.find(h=>h.object.userData.pickKey);
 if(hit)showDetails(hit.object.userData.pickKey);
 startPoint=null;
});
window.addEventListener('keydown',e=>{
 if(e.key==='Escape'){closeDetails();if(traceOpen)showTrace(false);}
 if(e.code==='Space' && !['INPUT','TEXTAREA','BUTTON'].includes(document.activeElement?.tagName)){e.preventDefault();setPlay(!playing);}
});

const tagAnchors=[
 ['label-machine',()=>new THREE.Vector3(machine.carriage.position.x,7.5,-6.65)],
 ['label-workpiece',()=>new THREE.Vector3(-1.6,4.25,2.7)],
 ['label-bores',()=>new THREE.Vector3(.165,2.35,5.14)],
 ['label-office',()=>new THREE.Vector3(13.85,4.5,4)]
];
function projectTags(){
 const rect=canvas.getBoundingClientRect();
 for(const [id,getPoint] of tagAnchors){
  const el=document.getElementById(id);el.hidden=!labelsOn;
  if(!labelsOn)continue;
  const position=getPoint();tmpVec.copy(position).project(camera);
  const hidden=tmpVec.z>1 || tmpVec.z< -1 || Math.abs(tmpVec.x)>1.1 || Math.abs(tmpVec.y)>1.1;
  el.hidden=hidden;
  if(!hidden){el.style.left=`${(tmpVec.x*.5+.5)*rect.width}px`;el.style.top=`${(-tmpVec.y*.5+.5)*rect.height}px`;}
 }
}
function resize(){const w=window.innerWidth,h=window.innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
window.addEventListener('resize',resize);resize();
const clock=new THREE.Clock();let frames=0;
function render(){
 requestAnimationFrame(render);
 const dt=Math.min(.07,clock.getDelta());
 if(playing){progress=Math.min(1,progress+dt*playbackRate/DEMO_DURATION_SECONDS);if(progress>=1)playing=false;updatePlaybackUI();}
 if(cameraMove){
  const k=Math.min(1,(performance.now()-cameraMove.start)/cameraMove.duration),e=1-Math.pow(1-k,3);
  camera.position.copy(cameraMove.from).lerp(cameraMove.to,e);controls.target.copy(cameraMove.targetFrom).lerp(cameraMove.targetTo,e);
  if(k>=1)cameraMove=null;
 }
 // 只在自动导览下以实际输出 TCP 跟随，用户操作 OrbitControls 则立即停止。
 if(playing && cameraFollow && !cameraMove && progress>=.824 && progress<.87){
  const tcp=angleHeadTcpWorld(getDemoPose(progress));
  const at=new THREE.Vector3(tcp.x,tcp.y+.04,tcp.z);
  const desired=at.clone().add(new THREE.Vector3(2.8,2.4,-3.0));
  controls.target.lerp(at,.065);camera.position.lerp(desired,.065);
 }
 controls.update();machine.root.updateMatrixWorld(true);
 if(selectedHelper && frames%2===0)selectedHelper.update();
 if(frames%2===0)projectTags();
 renderer.render(scene,camera);frames++;
}
updatePlaybackUI();render();
refreshTracePanel(true);
workpiece.ready.then(()=>{
 document.getElementById('loading').classList.add('dismissed');
}).catch(error=>{
 const box=document.getElementById('error-box');box.hidden=false;box.textContent=error.message;
 document.getElementById('loading').classList.add('dismissed');
});
