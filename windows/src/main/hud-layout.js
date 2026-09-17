'use strict';
function dockBounds(workArea, size, anchor = 'center') {
  const margin = 14;
  const left = workArea.x + margin;
  const right = Math.max(left, workArea.x + workArea.width - size.width - margin);
  const x = anchor === 'left' ? left : anchor === 'right' ? right : (left + right) / 2;
  const y = anchor === 'center' ? workArea.y + workArea.height - size.height - margin : workArea.y + (workArea.height - size.height) / 2;
  return { x: Math.round(x), y: Math.round(Math.max(workArea.y, y)) };
}
function nearestAnchor(workArea, point) {
  const points = { left: { x: workArea.x, y: workArea.y + workArea.height / 2 }, right: { x: workArea.x + workArea.width, y: workArea.y + workArea.height / 2 }, center: { x: workArea.x + workArea.width / 2, y: workArea.y + workArea.height } };
  return Object.keys(points).sort((a, b) => Math.hypot(point.x - points[a].x, point.y - points[a].y) - Math.hypot(point.x - points[b].x, point.y - points[b].y))[0];
}
module.exports = { dockBounds, nearestAnchor };
