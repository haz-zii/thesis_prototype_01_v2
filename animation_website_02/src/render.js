import { cubeColor, lineColor, rgbCss, sampleScene, scaleRgb } from './color.js';
import { motionForCell } from './behaviors.js';

const INV_SQRT2 = 1 / Math.sqrt(2);
const INV_SQRT6 = 1 / Math.sqrt(6);
const VIEW = [1, 1, 1];
const LIGHT = normalize([0.22, 0.48, 0.92]);
const FLIP_AXIS = [INV_SQRT2, -INV_SQRT2, 0];

const VERTS = [
  [-0.5, -0.5, -0.5],
  [0.5, -0.5, -0.5],
  [0.5, 0.5, -0.5],
  [-0.5, 0.5, -0.5],
  [-0.5, -0.5, 0.5],
  [0.5, -0.5, 0.5],
  [0.5, 0.5, 0.5],
  [-0.5, 0.5, 0.5],
];

const FACES = [
  [4, 5, 6, 7],
  [0, 3, 2, 1],
  [0, 1, 5, 4],
  [2, 3, 7, 6],
  [1, 2, 6, 5],
  [3, 0, 4, 7],
];

const NORMALS = [
  [0, 0, 1],
  [0, 0, -1],
  [0, -1, 0],
  [0, 1, 0],
  [1, 0, 0],
  [-1, 0, 0],
];

const EDGES = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

function normalize(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function rotateAround(v, axis, c, s) {
  const [ax, ay, az] = axis;
  const dot = ax * v[0] + ay * v[1] + az * v[2];
  const cx = ay * v[2] - az * v[1];
  const cy = az * v[0] - ax * v[2];
  const cz = ax * v[1] - ay * v[0];
  const t = 1 - c;
  return [
    v[0] * c + cx * s + ax * dot * t,
    v[1] * c + cy * s + ay * dot * t,
    v[2] * c + cz * s + az * dot * t,
  ];
}

function projectPoint(v, cubeSize) {
  return [
    (v[0] - v[1]) * INV_SQRT2 * cubeSize,
    (v[0] + v[1] - 2 * v[2]) * INV_SQRT6 * cubeSize,
  ];
}

function drawBackground(ctx, width, height, scene) {
  const cx = width / 2;
  const cy = height / 2;
  const len = Math.hypot(width, height);
  const dx = Math.cos(scene.angle) * len * 0.5;
  const dy = Math.sin(scene.angle) * len * 0.5;
  const gradient = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
  gradient.addColorStop(0, rgbCss(scene.bg[0]));
  gradient.addColorStop(0.52, rgbCss(scene.bg[1]));
  gradient.addColorStop(1, rgbCss(scene.bg[2]));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function projectCube(scale, rotation, cubeSize) {
  const c = Math.cos(rotation);
  const s = Math.sin(rotation);
  const verts = [];
  const proj = [];
  for (let i = 0; i < VERTS.length; i += 1) {
    const scaled = [VERTS[i][0] * scale, VERTS[i][1] * scale, VERTS[i][2] * scale];
    const spun = rotateAround(scaled, FLIP_AXIS, c, s);
    verts.push(spun);
    proj.push(projectPoint(spun, cubeSize));
  }

  const faces = [];
  for (let f = 0; f < FACES.length; f += 1) {
    const normal = rotateAround(NORMALS[f], FLIP_AXIS, c, s);
    const facing = normal[0] * VIEW[0] + normal[1] * VIEW[1] + normal[2] * VIEW[2];
    if (facing <= 0.04) continue;
    const idx = FACES[f];
    let depth = 0;
    for (let k = 0; k < 4; k += 1) {
      const v = verts[idx[k]];
      depth += v[0] * VIEW[0] + v[1] * VIEW[1] + v[2] * VIEW[2];
    }
    const light = normal[0] * LIGHT[0] + normal[1] * LIGHT[1] + normal[2] * LIGHT[2];
    faces.push({
      idx,
      depth: depth / 4,
      shade: 0.76 + 0.24 * Math.max(0, light),
    });
  }
  faces.sort((a, b) => a.depth - b.depth);
  return { proj, faces };
}

function toScreen(x, y, metrics, cos, sin) {
  const dx = x - metrics.cx;
  const dy = y - metrics.cy;
  return [
    metrics.cx + dx * cos - dy * sin,
    metrics.cy + dx * sin + dy * cos,
  ];
}

function drawCube(ctx, proj, faces, gx, gy, metrics, cos, sin, fill, stroke) {
  const screen = proj.map(([x, y]) => toScreen(gx + x, gy + y, metrics, cos, sin));

  if (fill) {
    for (let f = 0; f < faces.length; f += 1) {
      const face = faces[f];
      ctx.beginPath();
      const a = screen[face.idx[0]];
      ctx.moveTo(a[0], a[1]);
      for (let k = 1; k < 4; k += 1) {
        const p = screen[face.idx[k]];
        ctx.lineTo(p[0], p[1]);
      }
      ctx.closePath();
      ctx.fillStyle = rgbCss(scaleRgb(fill, face.shade));
      ctx.fill();
    }
    return;
  }

  const front = new Set();
  for (let f = 0; f < faces.length; f += 1) {
    const idx = faces[f].idx;
    for (let k = 0; k < 4; k += 1) {
      const u = idx[k];
      const v = idx[(k + 1) % 4];
      front.add(u < v ? `${u}-${v}` : `${v}-${u}`);
    }
  }

  ctx.beginPath();
  for (let e = 0; e < EDGES.length; e += 1) {
    const u = EDGES[e][0];
    const v = EDGES[e][1];
    const key = u < v ? `${u}-${v}` : `${v}-${u}`;
    if (!front.has(key)) continue;
    const a = screen[u];
    const b = screen[v];
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
  }
  ctx.strokeStyle = rgbCss(stroke);
  ctx.stroke();
}

export function renderFrame(ctx, grid, metrics, behaviors, time) {
  const { viewW, viewH } = metrics;
  const scene = sampleScene(time);
  drawBackground(ctx, viewW, viewH, scene);

  const cos = Math.cos(behaviors.rotate.angle);
  const sin = Math.sin(behaviors.rotate.angle);
  const draws = [];

  for (let i = 0; i < grid.cells.length; i += 1) {
    const cell = grid.cells[i];
    const motion = motionForCell(behaviors, grid, cell);
    const gx = metrics.originX + cell.col * metrics.cellW + motion.offsetX * metrics.cellW;
    const gy = metrics.originY + cell.row * metrics.cellH + motion.offsetY * metrics.cellH;
    const screen = toScreen(gx, gy, metrics, cos, sin);
    draws.push({ cell, motion, gx, gy, depth: screen[1] + screen[0] * 0.0001 });
  }

  draws.sort((a, b) => a.depth - b.depth);

  for (let i = 0; i < draws.length; i += 1) {
    const { cell, motion, gx, gy } = draws[i];
    const rgb = cubeColor(scene, cell, grid.cols, grid.rows, time);
    const cube = projectCube(motion.scale, motion.rotation, metrics.cubeSize);
    ctx.lineWidth = Math.max(1.15, metrics.cubeSize * motion.scale * 0.022);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (cell.filled) {
      drawCube(ctx, cube.proj, cube.faces, gx, gy, metrics, cos, sin, rgb, null);
    } else {
      drawCube(ctx, cube.proj, cube.faces, gx, gy, metrics, cos, sin, null, lineColor(scene, rgb));
    }
  }
}
