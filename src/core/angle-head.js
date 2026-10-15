import {GEOMETRY,angleHeadTopTargetWorld} from './geometry.js';

/**
 * M6 固定式 90°直角铣头示意配置；输入轴 +Z，输出轴 -Y。
 * 附件接口、防转销、包络和行程均未根据客户实机验证。
 * 这里描述的 TCP 是输出刀具最低端，而非主轴端面或壳体中心。
 */
export const ANGLE_HEAD=Object.freeze({
 inputAxis:Object.freeze([0,0,1]),
 outputAxis:Object.freeze([0,-1,0]),
 gearCenterLocalZ:5.00,
 outputTipLocalY:-1.25, // 相对于主轴局部中心 Y=0.02
 safeGapMeters:.25,
 approachGapMeters:.09,
 ramParkExtension:.06,
 attachment:'manual-demonstration-only',
 antiRotationLocatingRequired:true,
 toolLengthCalibrationRequired:true,
 clearanceAndReachValidated:false,
});
export function angleHeadTcpWorld(pose){
 return Object.freeze({
  x:pose.machineX+GEOMETRY.spindleLocalX,
  y:pose.headY+GEOMETRY.spindleLocalY+ANGLE_HEAD.outputTipLocalY,
  z:GEOMETRY.machineRootZ+pose.ramExtension+ANGLE_HEAD.gearCenterLocalZ,
  direction:ANGLE_HEAD.outputAxis,
 });
}
export function angleTargetPose(){
 const target=angleHeadTopTargetWorld();
 const machineX=target.x-GEOMETRY.spindleLocalX;
 const ramExtension=target.z-GEOMETRY.machineRootZ-ANGLE_HEAD.gearCenterLocalZ;
 const safeHeadY=target.y+ANGLE_HEAD.safeGapMeters-GEOMETRY.spindleLocalY-ANGLE_HEAD.outputTipLocalY;
 const feedHeadY=target.y+ANGLE_HEAD.approachGapMeters-GEOMETRY.spindleLocalY-ANGLE_HEAD.outputTipLocalY;
 return Object.freeze({target,machineX,ramExtension,safeHeadY,feedHeadY});
}
export function angleHeadDiagnostics(pose){
 const {target}=angleTargetPose(),tcp=angleHeadTcpWorld(pose);
 return Object.freeze({
  target,tcp,axisErrorMeters:Math.hypot(target.x-tcp.x,target.z-tcp.z),
  tipToTopSurfaceMeters:tcp.y-target.y,
  outputDirection:ANGLE_HEAD.outputAxis,
  antiRotationVerified:false,toolOffsetCalibrated:false,collisionValidated:false,
 });
}
