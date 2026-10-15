/**
 * Fixed HUD panels own their regions. 3D projected labels are low priority and
 * may move a short distance from their projected point or disappear when no
 * unobstructed placement exists. Coordinates are CSS pixels in canvas space.
 */
export function rectanglesOverlap(a, b, padding = 0) {
  return a.left < b.right + padding && a.right > b.left - padding &&
         a.top < b.bottom + padding && a.bottom > b.top - padding;
}

export function placeSceneLabels(items, obstacles, viewport, { gap = 8, maxShift = 105 } = {}) {
  if (!(viewport.width > 0 && viewport.height > 0)) return items.map(item => ({ id: item.id, visible: false }));
  const placed = [];
  const result = [];
  for (const item of items) {
    const width = Math.max(1, item.width), height = Math.max(1, item.height);
    const offsets = [
      [-0.10 * width, -height - 5], [-width - 12, -height - 9], [14, -height - 9],
      [-width / 2, 13], [-width - 14, 13], [13, 13],
      [-width / 2, -height - 23], [-width / 2, 33],
    ];
    let chosen = null;
    for (const [dx, dy] of offsets) {
      if (Math.hypot(dx + width * .1, dy + height + 5) > maxShift + width) continue;
      const left = item.x + dx, top = item.y + dy;
      const candidate = {left,top,right:left+width,bottom:top+height};
      if (left < gap || top < gap || candidate.right > viewport.width-gap || candidate.bottom > viewport.height-gap) continue;
      if (obstacles.some(rect=>rectanglesOverlap(candidate,rect,gap))) continue;
      if (placed.some(rect=>rectanglesOverlap(candidate,rect,gap))) continue;
      chosen=candidate;
      break;
    }
    if (chosen) {
      placed.push(chosen);
      result.push({id:item.id,visible:true,left:Math.round(chosen.left),top:Math.round(chosen.top)});
    } else result.push({id:item.id,visible:false});
  }
  return result;
}
