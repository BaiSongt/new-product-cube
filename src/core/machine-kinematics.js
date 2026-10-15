import {angleHeadDiagnostics} from './angle-head.js';
import {GEOMETRY} from './geometry.js';

/**
 * M6 示意机床的刚体链定义（含可换 90°角度头）（米，右手系，Y 竖直）。
 * X 立柱 → Y 主轴箱 → Z 滑枕 → 主轴接口 → 刀柄 → 镗杆 / 测头。
 * 本文件给出可重复的正向位置关系，不声称符合任何实机的 CNC 轴定义。
 */
export const MACHINE_ASSEMBLY=Object.freeze({
 machineRootZ:GEOMETRY.machineRootZ,
 spindleCenterLocalX:GEOMETRY.spindleLocalX,
 spindleCenterLocalY:GEOMETRY.spindleLocalY,
 gaugePlaneLocalZ:4.14,
 flangeEndLocalZ:4.55,
 boringBarStartLocalZ:4.69,
 boringBarEndLocalZ:6.03,
 boringTipLocalZ:GEOMETRY.toolAxisTipLocalZ,
 probeBallCenterLocalZ:GEOMETRY.toolAxisTipLocalZ,
 probeBallRadiusMeters:.095,
 spindleDirection: Object.freeze([0,0,1]),
});

export function worldSpindleReference(pose){
 const machineX=pose.machineX,headY=pose.headY,ramZ=pose.ramExtension;
 if (![machineX,headY,ramZ].every(Number.isFinite))throw new TypeError('关节坐标必须是有限数值');
 const centerX=machineX+MACHINE_ASSEMBLY.spindleCenterLocalX;
 const centerY=headY+MACHINE_ASSEMBLY.spindleCenterLocalY;
 const at=localZ=>Object.freeze({x:centerX,y:centerY,z:GEOMETRY.machineRootZ+ramZ+localZ});
 return Object.freeze({
  centerX,centerY,axis: MACHINE_ASSEMBLY.spindleDirection,
  gauge:at(MACHINE_ASSEMBLY.gaugePlaneLocalZ),
  holderEnd:at(MACHINE_ASSEMBLY.flangeEndLocalZ),
  barStart:at(MACHINE_ASSEMBLY.boringBarStartLocalZ),
  barEnd:at(MACHINE_ASSEMBLY.boringBarEndLocalZ),
  cutterTip:at(MACHINE_ASSEMBLY.boringTipLocalZ),
  probeCenter:at(MACHINE_ASSEMBLY.probeBallCenterLocalZ),
 });
}

/** 与加工孔的中心线距离；不同轴向距离不计入此偏差。 */
export function spindleToPointAxisError(pose,point){
 const s=worldSpindleReference(pose);
 return Math.hypot(point.x-s.centerX,point.y-s.centerY);
}

/** 刀具/测头前端到近侧车体壁的轴向净距，负值表示超出示意安全边界。 */
export function frontStandoffMeters(pose){
 if(pose.toolMode==='angle')return angleHeadDiagnostics(pose).tipToTopSurfaceMeters;
 const p=worldSpindleReference(pose);
 return GEOMETRY.nearWallWorldZ-(pose.toolMode==='probe'?p.probeCenter.z+MACHINE_ASSEMBLY.probeBallRadiusMeters:p.cutterTip.z);
}

/** 物理坐标长度不以显示缩放后模型或光效环作为参考。 */
export function buildMachineDiagnostics(pose,targetPoint=null){
 const spindle=worldSpindleReference(pose);
 if(pose.toolMode==='angle'){const a=angleHeadDiagnostics(pose);return Object.freeze({axisErrorMeters:a.axisErrorMeters,standoffMeters:a.tipToTopSurfaceMeters,reference:'90°铣头输出刀具 TCP / -Y',toolMode:pose.toolMode,kinematicModel:'schematic-XYZ-angle-attachment',realMachineCalibrated:false});}
 return Object.freeze({
  axisErrorMeters:targetPoint?spindleToPointAxisError(pose,targetPoint):null,
  standoffMeters:frontStandoffMeters(pose),
  reference:pose.toolMode==='probe'?'测头球心':'镗杆中心线/切削端',
  toolMode:pose.toolMode,
  kinematicModel:'schematic-XYZ',
  realMachineCalibrated:false,
 });
}
