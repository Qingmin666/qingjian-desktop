const EDGES = new Set(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']);

function gestureBounds(start, kind, delta, minimum = { width: 470, height: 280 }) {
  const dx = Math.round(delta.x), dy = Math.round(delta.y);
  if (kind === 'move') return { ...start, x: start.x + dx, y: start.y + dy };
  if (!EDGES.has(kind)) throw new Error('Invalid resize edge');
  const next = { ...start };
  if (kind.includes('e')) next.width = Math.max(minimum.width, start.width + dx);
  if (kind.includes('s')) next.height = Math.max(minimum.height, start.height + dy);
  if (kind.includes('w')) {
    next.width = Math.max(minimum.width, start.width - dx);
    next.x = start.x + start.width - next.width;
  }
  if (kind.includes('n')) {
    next.height = Math.max(minimum.height, start.height - dy);
    next.y = start.y + start.height - next.height;
  }
  return next;
}

module.exports = { EDGES, gestureBounds };
