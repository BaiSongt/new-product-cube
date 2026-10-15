/**
 * M3 统一几何基线。单位 m，仅适用于本方案的虚拟演示。
 * 不使用机床关节原点或刀具切削刃偏置替代主轴中心线。
 */
export const HULL_SCALE=Object.freeze({x:1.10,y:1.10,z:1.10});
export const GEOMETRY = Object.freeze({
  machineRootZ:-6.65,
  spindleLocalX:0,
  spindleLocalY:.02,
  spindleAxisLocal:[0,0,1],
  toolAxisTipLocalZ:6.18,
  hullCenterY:1.11,
  hullCenterZ:2.80,
  hullWidth:4.18,
  hullSideThickness:.095,
  mountingY:1.64,
  mountingXs:Object.freeze([-2.42*HULL_SCALE.x,2.59*HULL_SCALE.x]),
  wheelAxleXs:Object.freeze([-2.55,-1.20,.15,1.50,2.85].map(x=>x*HULL_SCALE.x)),
  wheelAxleLocalY:1.04,
  wheelHoleRadius:.335*HULL_SCALE.y,
  inspectionSectionOffsets:Object.freeze([.028,.072]),
  // 近侧外壁：本工件沿 +Z 方向从机床端被加工。
  get mountingWorldY(){return this.hullCenterY+this.mountingY*HULL_SCALE.y;},
  get nearWallWorldZ(){return this.hullCenterZ-this.hullWidth*HULL_SCALE.z/2;},
});

export function holeCenterWorld(index){
  if(!Number.isInteger(index)||index<0||index>=GEOMETRY.mountingXs.length)throw new RangeError('孔序号非法');
  return Object.freeze({x:GEOMETRY.mountingXs[index],y:GEOMETRY.mountingWorldY,z:GEOMETRY.nearWallWorldZ});
}
export function axisCenterWorld(pose){
  return {
    x:pose.machineX+GEOMETRY.spindleLocalX,
    y:pose.headY+GEOMETRY.spindleLocalY,
  };
}
export function targetPoseForHole(index){
  const center=holeCenterWorld(index);
  return Object.freeze({machineX:center.x-GEOMETRY.spindleLocalX,headY:center.y-GEOMETRY.spindleLocalY});
}
export function perpendicularAxisError(pose,index){
  const actual=axisCenterWorld(pose),target=holeCenterWorld(index);
  return Math.hypot(actual.x-target.x,actual.y-target.y);
}
export function axialTipWorldZ(pose){return GEOMETRY.machineRootZ+GEOMETRY.toolAxisTipLocalZ+pose.ramExtension;}
export function tipToNearWallGap(pose){return GEOMETRY.nearWallWorldZ-axialTipWorldZ(pose);}
export function isAxiallyAligned(pose,index,tolerance=1e-6){return perpendicularAxisError(pose,index)<=tolerance;}

/** 演示测头的目标轮轴孔中心，不等于机床计量结果。 */
export function probeTargetWorld(){return Object.freeze({
 x:GEOMETRY.wheelAxleXs[2],
 y:GEOMETRY.hullCenterY+GEOMETRY.wheelAxleLocalY*HULL_SCALE.y,
 z:GEOMETRY.nearWallWorldZ,
});}
export function perpendicularProbeAxisError(pose){
 const spindle=axisCenterWorld(pose),hole=probeTargetWorld();
 return Math.hypot(spindle.x-hole.x,spindle.y-hole.y);
}

/** 90°向下角度头：顶板外缘上的拟加工位置，不与炮塔开口重叠。 */
export function angleHeadTopTargetWorld(){return Object.freeze({
 x:1.60*HULL_SCALE.x,
 y:GEOMETRY.hullCenterY+(2.38+.04)*HULL_SCALE.y, // Extrude deck top face: base y=deckY-.05, thickness=.09
 z:GEOMETRY.hullCenterZ-1.50*HULL_SCALE.z,
 axis:Object.freeze([0,-1,0]),
 feature:'TOP-DECK-01',
 });}
