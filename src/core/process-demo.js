import {clamp01,getActiveStage} from './trajectory.js';
import {holeCenterWorld,perpendicularAxisError,tipToNearWallGap,probeTargetWorld,perpendicularProbeAxisError,GEOMETRY} from './geometry.js';
import {buildMachineDiagnostics,worldSpindleReference} from './machine-kinematics.js';
import {angleHeadDiagnostics} from './angle-head.js';
import {inspectAngleHeadClearance} from './clearance.js';
/** 数据全部从确定性动画状态派生；不连接设备、不伪造哈希、测量值或通过状态。 */
export const DEMO_PACKAGE=Object.freeze({
 id:'DEMO-HULL-001',revision:'演示 V7',machine:'单台落地镗铣床（型号待核验）',
 approval:'审核流程模拟 / 未签发正式 NC',verification:'未执行真实 SHA-256',
 transfer:'受控介质人工交接（逻辑说明）',interface:'不读取 CNC（真实接口未连接）',
});
export const PROCESS_SEQUENCE=Object.freeze([
 {id:'research',title:'研发安全域',action:'CAD/PMI → 特征编程 → 仿真/后置 → 审批发布',status:'无实际 NC'},
 {id:'handoff',title:'人工跨区',action:'受控介质、登记、查验、入库',status:'无在线研发链路'},
 {id:'dnc',title:'DNC 工作间',action:'程序版本核验、指定 CNC 受控传输',status:'仅下发演示'},
 {id:'cnc',title:'CNC 机旁',action:'现场授权人员完成安全确认与循环启动',status:'禁止远程启动'},
 {id:'mdc',title:'MDC 监控',action:'只读状态、轴位置、报警和时间记录',status:'虚拟数据'},
 {id:'quality',title:'检测追溯',action:'规划测点/空间轴线；独立终检另行实施',status:'无实际测量结论'},
]);
export function displayState(progress,pose){
 const t=clamp01(progress),stage=getActiveStage(t).id;
 const mdc=['machining','angleChange','angleMachining'].includes(stage)?{
  state:pose.operation?`${pose.operation.name} · ${pose.operation.motion==='feed'?'模拟进给':'安全退刀'}`:pose.stage==='angleMachining'?'90°角度头顶部进给（模拟）':pose.stage==='angleChange'?'停机退刀与人工附件换装（模拟）':'安全换位',feed:'非实测：模拟进给',alarm:'未连接 CNC'}:
  {state:stage==='research'?'编程与仿真示意':stage==='setup'?'装夹准备':stage==='alignment'?'找正定位':stage==='inspection'?'测头规划运动':stage==='dnc'?'待现场确认':'待机/流程演示',feed:'—',alarm:'—'};
 let handoff='研发侧与生产侧无在线连接';
 if(stage==='dnc')handoff='人工携带受控介质 → 安全检查 → 版本入库 → DNC 本地传输';
 if(['machining','angleMachining'].includes(stage))handoff='现场人员确认后，机床执行预设模拟动作（不提供远程启动）';
 return {stage,mdc,handoff,inspection:stage==='inspection'?'测头虚拟定位 / 两侧孔多截面采点规划（非实测）':'等待测头检查计划',archive:stage==='archive'?'已生成模拟任务履历；不产生合格结论，独立终检待执行':'等待归档'};
}
export function makeDemoTrace(progress,pose){
 const status=displayState(progress,pose);
 const hole=Number.isInteger(pose.highlightHole)&&pose.highlightHole>=0?pose.highlightHole:null;
 return {schemaVersion:4,source:'threejs-demo',simulated:true,
  disclaimer:'仅为建设方案模拟数据，非真实 CNC、NC、测量或产品验收结果',
  package:{...DEMO_PACKAGE},progress:clamp01(progress),stage:status.stage,
  stageStatus:status,
  machinePose:{machineX:pose.machineX,headY:pose.headY,ramExtension:pose.ramExtension,toolMode:pose.toolMode},
  operation:pose.operation?{id:pose.operation.id,kind:pose.operation.kind,hole:pose.operation.hole,motion:pose.operation.motion,stage:'simulated',actualNcGenerated:false}:null,
  toolAssembly:{reference:'主轴基准端面与局部刀具坐标',spindleReference:worldSpindleReference(pose),
   diagnostics:buildMachineDiagnostics(pose,hole!==null?holeCenterWorld(hole):pose.inspectionActive?probeTargetWorld():null),
   actualToolLengthMeasurement:false},
  virtualAlignment:pose.toolMode==='angle'||hole===null?null:{targetHoleIndex:hole,targetCenterMeters:holeCenterWorld(hole),
   spindleDirection:[...GEOMETRY.spindleAxisLocal],perpendicularErrorMeters:perpendicularAxisError(pose,hole),
   toolTipToNearSidewallMeters:tipToNearWallGap(pose),isActualMachineMeasurement:false},
  rightAngleHead:pose.toolMode==='angle'?{...angleHeadDiagnostics(pose),inputAxis:[0,0,1],outputAxis:[0,-1,0],antiRotationVerified:false,actualTcpCalibrated:false,actualMachineCollisionCertified:false}:null,
  sceneClearancePreflight:pose.toolMode==='angle'?inspectAngleHeadClearance(pose):null,
  virtualInspection:status.stage==='inspection'?{probeTargetMeters:probeTargetWorld(),
   nominalAxisErrorMeters:perpendicularProbeAxisError(pose),contactTriggered:false,measuredPoints:0}:null,
  quality:{measured:false,nominalAxisOnly:true,plannedSectionsPerSide:2,
   sectionOffsetsMeters:[...GEOMETRY.inspectionSectionOffsets],uncertainty:'未评定',independentFinalInspection:'尚未进行'},
 };
}
export function compactDemoSummary(trace){
 return Object.freeze({
  stage:trace.stage,
  operation:trace.operation?.id??(trace.stage==='angleMachining'?'90°顶部加工':trace.stage==='angleChange'?'附件换装':'—'),
  task:trace.package.id,
  progressPercent:Math.round(trace.progress*100),
  cnc:trace.stageStatus.mdc.state,
  spindleAxisDeviation:trace.rightAngleHead?`${(trace.rightAngleHead.axisErrorMeters*1000).toFixed(2)} mm（角度头计算）`:trace.virtualAlignment?`${(trace.virtualAlignment.perpendicularErrorMeters*1000).toFixed(2)} mm（计算）`:'—',
  inspection:'仅规划 / 非实测',
  conclusion:'未作终检判定',
 });
}
