import {ANGLE_HEAD,angleHeadTcpWorld} from './angle-head.js';
import {GEOMETRY,HULL_SCALE,HULL_DECK} from './geometry.js';

/**
 * M7 独立预检：仅对角度头壳体 AABB、刀具圆形投影、顶板及炮塔开口做近似判断。
 * 返回 clear 只代表本示意模型；不代表 CNC、附件承载力或完整机床碰撞验证。
 */
export const DEMO_ENVELOPE=Object.freeze({
 housingHalfX:.52,housingHalfZ:.47,housingLowestLocalY:-.52,
 cutterRadius:.19,requestedMargin:.09,
});
const finite=(...numbers)=>numbers.every(Number.isFinite);

export function inspectAngleHeadClearance(pose){
 if(!pose||!finite(pose.machineX,pose.headY,pose.ramExtension))throw new TypeError('缺少有效的 XYZ 关节位置');
 const tcp=angleHeadTcpWorld(pose);
 const deck={
  xMin:HULL_DECK.xMin*HULL_SCALE.x,xMax:HULL_DECK.xMax*HULL_SCALE.x,
  zMin:GEOMETRY.hullCenterZ+HULL_DECK.zMin*HULL_SCALE.z,
  zMax:GEOMETRY.hullCenterZ+HULL_DECK.zMax*HULL_SCALE.z,
  y:GEOMETRY.hullCenterY+HULL_DECK.topY*HULL_SCALE.y,
  turretX:HULL_DECK.turretX*HULL_SCALE.x,
  turretZ:GEOMETRY.hullCenterZ+HULL_DECK.turretZ*HULL_SCALE.z,
  turretRadius:HULL_DECK.turretRadius*HULL_SCALE.x,
 };
 const pointInDeck=tcp.x>=deck.xMin&&tcp.x<=deck.xMax&&tcp.z>=deck.zMin&&tcp.z<=deck.zMax;
 const radialDistance=Math.hypot(tcp.x-deck.turretX,tcp.z-deck.turretZ);
 const insideOpening=radialDistance<deck.turretRadius;
 const cutterAtRim=Math.abs(radialDistance-deck.turretRadius)<DEMO_ENVELOPE.cutterRadius;
 const cutterOverSolidDeck=pointInDeck&&!insideOpening;
 const housingBottomY=pose.headY+GEOMETRY.spindleLocalY+DEMO_ENVELOPE.housingLowestLocalY;
 // 保守投影：壳体与顶板外框相交即计算最低点净距，不声称按实体 CAD 做精确布尔。
 const housingOverDeck=(tcp.x+DEMO_ENVELOPE.housingHalfX>=deck.xMin &&
  tcp.x-DEMO_ENVELOPE.housingHalfX<=deck.xMax &&
  tcp.z+DEMO_ENVELOPE.housingHalfZ>=deck.zMin &&
  tcp.z-DEMO_ENVELOPE.housingHalfZ<=deck.zMax);
 const cutterGap=cutterOverSolidDeck?tcp.y-deck.y:null;
 const housingGap=housingOverDeck?housingBottomY-deck.y:null;
 const distances=[cutterGap,housingGap].filter(Number.isFinite);
 const minimumGapMeters=distances.length?Math.min(...distances):null;
 const projectedTurretRimOverlap=pointInDeck&&cutterAtRim;
 const rimVerticalGap=tcp.y-deck.y;
 // 仅水平投影重叠但仍高于顶部时不误报三维干涉。
 const rimPenetration=projectedTurretRimOverlap&&rimVerticalGap<0;
 const rimWarning=projectedTurretRimOverlap&&rimVerticalGap>=0&&rimVerticalGap<DEMO_ENVELOPE.requestedMargin;
 const status=rimPenetration||(minimumGapMeters!==null&&minimumGapMeters<0)?'interference':
  rimWarning||(minimumGapMeters!==null&&minimumGapMeters<DEMO_ENVELOPE.requestedMargin-1e-8)?'attention':
  minimumGapMeters!==null?'clear':'outside';
 return Object.freeze({
  status,minimumGapMeters,cutterGapMeters:cutterGap,housingGapMeters:housingGap,
  cutterOverSolidDeck,housingOverDeck,projectedTurretRimOverlap,
  outputAxis:ANGLE_HEAD.outputAxis,reference:'场景 AABB 与圆形近似包络',
  actualMachineCertified:false,fullSceneCollisionCertified:false,antiRotationCertified:false,
 });
}

/** 人工换装演示的离散互锁，不连接安全 PLC。 */
export function inspectAttachmentTransition(previous,next,parkExtension=.06){
 if(!previous||!next)throw new TypeError('缺少前后状态');
 const changed=previous.toolMode!==next.toolMode;
 const rotating=Boolean(previous.spindleRotating||next.spindleRotating||previous.angleOutputRotating||next.angleOutputRotating);
 const parked=Math.abs(previous.ramExtension-parkExtension)<=1e-6&&Math.abs(next.ramExtension-parkExtension)<=1e-6;
 return Object.freeze({changed,parked,rotating,permitted:!changed||(parked&&!rotating),actualInterlock:false});
}
