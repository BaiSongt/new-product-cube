const clamp01=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
const smoothstep=t=>{const u=clamp01(t);return u*u*(3-2*u);};
/** 两孔四道演示工序，不进行 B-Rep 去料或生成 NC。 */
export const OPERATIONS=Object.freeze([
 {id:'A-ROUGH',hole:0,kind:'rough',name:'安装孔 A · 粗镗示意',start:.37,feedEnd:.41,retractEnd:.435,reach:.70},
 {id:'A-FINISH',hole:0,kind:'finish',name:'安装孔 A · 精镗示意',start:.435,feedEnd:.48,retractEnd:.51,reach:.87},
 {id:'B-ROUGH',hole:1,kind:'rough',name:'安装孔 B · 粗镗示意',start:.55,feedEnd:.59,retractEnd:.61,reach:.70},
 {id:'B-FINISH',hole:1,kind:'finish',name:'安装孔 B · 精镗示意',start:.61,feedEnd:.655,retractEnd:.69,reach:.87},
]);
const RETRACT=.06;
export function getOperationAt(t){
 const progress=clamp01(t);
 const op=OPERATIONS.find(item=>progress>=item.start&&progress<item.retractEnd);
 if(!op)return null;
 const feeding=progress<op.feedEnd;
 const fraction=feeding?smoothstep((progress-op.start)/(op.feedEnd-op.start)):
  1-smoothstep((progress-op.feedEnd)/(op.retractEnd-op.feedEnd));
 return Object.freeze({...op,operationProgress:feeding?fraction:1-fraction,motion:feeding?'feed':'retract',
  extension:RETRACT+(op.reach-RETRACT)*fraction,simulatedSpindleOn:feeding});
}
export function getUpcomingOperation(t){return OPERATIONS.find(op=>op.start>clamp01(t))??null;}
