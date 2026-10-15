import {GEOMETRY,targetPoseForHole} from './geometry.js';
import {ANGLE_HEAD,angleTargetPose} from './angle-head.js';
import {getOperationAt,OPERATIONS} from './operation-plan.js';
/** 单机、研发生产物理隔离、不联网控制的虚拟演示。 */
export const DEMO_DURATION_SECONDS=150;
export const DEMO_MOUNT_CENTERS=Object.freeze({left:GEOMETRY.mountingXs[0],right:GEOMETRY.mountingXs[1]});
export const TOOL_TIP_X_OFFSET=GEOMETRY.spindleLocalX;
export const WORKFLOW=Object.freeze([
 {id:'research',label:'研发工艺',time:0,description:'CAD/PMI → 孔特征与顶部面规划 → 机床级检查 → 审批。仅流程示意。'},
 {id:'setup',label:'装夹就位',time:.08,description:'放大后的车体完成支撑、定位和压板闭合；装夹力待核实。'},
 {id:'alignment',label:'机床找正',time:.18,description:'主轴中心线和目标侧孔理论轴线重合。'},
 {id:'dnc',label:'离线交接',time:.28,description:'人工受控介质交接、检查后，机旁工作间本地 DNC 传输；禁止远端启动。'},
 {id:'machining',label:'直镗杆加工',time:.37,description:'两处侧面安装孔各演示粗镗、退刀、精镗、退刀，不实际去料。'},
 {id:'angleChange',label:'角度头换装',time:.69,description:'全退刀与停转 → 回换头位 → 卸下镗杆 → 90°铣头附件装配与防转校核（均为人工示意）。'},
 {id:'angleMachining',label:'角度头加工',time:.76,description:'输入 +Z、输出 -Y；顶部非炮塔开口区域的孔位定位、靠近和撤离。保留安全间隙。'},
 {id:'inspection',label:'在机检测',time:.87,description:'先全退角度头，再换虚拟测头，进行轴孔多截面采点规划。非实测。'},
 {id:'archive',label:'质量追溯',time:.955,description:'记录演示的附件模式、拟加工任务和检测规划；无正式产品验收结论。'},
]);
export function clamp01(v){return Math.max(0,Math.min(1,Number.isFinite(v)?v:0));}
export function lerp(a,b,t){return a+(b-a)*t;}
export function smoothstep(t){const x=clamp01(t);return x*x*(3-2*x);}
function segment(t,a,b){return smoothstep((t-a)/(b-a));}
export function getActiveStage(t){const u=clamp01(t);for(let i=WORKFLOW.length-1;i>=0;i--)if(u>=WORKFLOW[i].time)return WORKFLOW[i];return WORKFLOW[0];}
export function getSpindleAngle(progress){const t=clamp01(progress);return OPERATIONS.reduce((total,op)=>total+Math.max(0,Math.min(t,op.feedEnd)-op.start),0)*DEMO_DURATION_SECONDS*5.5;}
export function getAngleOutputRotation(progress){return Math.max(0,Math.min(clamp01(progress),.848)-.828)*DEMO_DURATION_SECONDS*9.5;}
export function getDemoPose(progress){
 const t=clamp01(progress),a=targetPoseForHole(0),b=targetPoseForHole(1),top=angleTargetPose();
 const inspectX=GEOMETRY.wheelAxleXs[2]-GEOMETRY.spindleLocalX;
 const inspectY=GEOMETRY.hullCenterY+GEOMETRY.wheelAxleLocalY*1.10-GEOMETRY.spindleLocalY;
 let machineX=-5.4,headY=3.25,ramExtension=.06,toolMode='boring',state='待机',phaseName='研发端工艺编程',highlightHole=-1;
 let clampRatio=segment(t,.10,.17);if(t>.98)clampRatio=1-segment(t,.98,1);
 const operation=getOperationAt(t),inspectionActive=t>=.87&&t<.955,stage=getActiveStage(t).id;
 if(t<.08){phaseName='研发端 CAM / 附件工艺准备（模拟）';state='工艺准备';}
 else if(t<.18){phaseName='装夹放大车体工件';state='装夹准备';}
 else if(t<.28){machineX=lerp(-5.4,a.machineX,segment(t,.18,.28));headY=lerp(3.25,a.headY,segment(t,.18,.28));phaseName='主轴对准安装孔 A';state='定位中';highlightHole=0;}
 else if(t<.37){machineX=a.machineX;headY=a.headY;phaseName='人工受控介质交接及 DNC 本地传输';state='待现场确认';highlightHole=0;}
 else if(t<.51){machineX=a.machineX;headY=a.headY;ramExtension=operation?.extension??.06;phaseName=operation?.name??'孔 A';state=operation?.motion==='feed'?'直镗杆进给示意':'退刀中';highlightHole=0;}
 else if(t<.55){machineX=lerp(a.machineX,b.machineX,segment(t,.51,.55));headY=a.headY;phaseName='主轴完全退回后横移';state='换孔定位';highlightHole=1;}
 else if(t<.69){machineX=b.machineX;headY=b.headY;ramExtension=operation?.extension??.06;phaseName=operation?.name??'孔 B';state=operation?.motion==='feed'?'直镗杆进给示意':'退刀中';highlightHole=1;}
 else if(t<.76){
  machineX=lerp(b.machineX,-5.4,segment(t,.69,.729));
  headY=lerp(b.headY,top.safeHeadY,segment(t,.729,.741));
  toolMode=t<.742?'boring':t<.751?'none':'angle';
  phaseName=t<.742?'停止主轴并移动到附件更换位':t<.751?'拆卸旧镗杆（示意）':'安装 90°角度头 / 防转销定位（示意）';state='附件换装';
 }else if(t<.87){
  toolMode='angle';machineX=lerp(-5.4,top.machineX,segment(t,.76,.799));
  ramExtension=lerp(.06,top.ramExtension,segment(t,.799,.824));
  headY=lerp(top.safeHeadY,top.feedHeadY,segment(t,.828,.848));
  if(t>=.847)headY=lerp(top.feedHeadY,top.safeHeadY,segment(t,.848,.869));
  phaseName=t<.824?'角度头定位至顶部待加工特征':t<.848?'90°输出轴 -Y · 顶部进给示意':'角度头竖向安全撤离';
  state=t<.824?'顶部定位':t<.848?'角度头模拟进给':'竖向退刀';
 }else if(t<.955){
  toolMode=t<.899?'angle':'probe';
  headY=top.safeHeadY;machineX=top.machineX;
  ramExtension=lerp(top.ramExtension,.06,segment(t,.87,.896));
  machineX=lerp(top.machineX,inspectX,segment(t,.901,.927));
  headY=lerp(top.safeHeadY,inspectY,segment(t,.901,.927));
  if(t>=.930)ramExtension=lerp(.06,.76,segment(t,.930,.944));
  phaseName=t<.899?'完全退出附件至安全位':t<.927?'更换虚拟测头并重新找正': '两侧轮轴孔采点规划（非实测）';state='测量规划';
 }else{
  toolMode=t<.975?'probe':'boring';
  machineX=lerp(inspectX,-5.4,segment(t,.975,1));
  headY=lerp(inspectY,3.25,segment(t,.975,1));
  ramExtension=lerp(.76,.06,segment(t,.955,.975));
  phaseName=t<.975?'探针先完全退回':'质量记录归档 / 设备复位';state='归档演示';
 }
 if(t===1){phaseName='演示完成';state='待机';clampRatio=0;}
 const isAngleFeeding=t>=.828&&t<.848;
 return {t,machineX,headY,ramExtension,clampRatio,inspectionActive,operation,
  inspectionProgress:inspectionActive?clamp01((t-.927)/.028):0,toolMode,highlightHole,phaseName,state,
  angleOutputRotation:getAngleOutputRotation(t),angleOutputRotating:isAngleFeeding,
  spindleAngle:getSpindleAngle(t),spindleRotating:Boolean(operation?.simulatedSpindleOn),
  stage,isCutting:Boolean(operation?.simulatedSpindleOn)||isAngleFeeding};
}
