/** Rectangular field of isometric cubes. Motion stays in cell units so resize does not pop. */

// Bounds of a cube at local ±0.5 under the projection in render.js.
const HEX_W = Math.sqrt(2);
const HEX_H = 2 * Math.sqrt(2 / 3);
const GAP = 1.16;

export function hash(a, b) {
  let n = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

export function gridSizeForViewport(viewW, viewH) {
  if (viewH > viewW) {
    return { cols: 5, rows: viewH > 900 ? 8 : 7 };
  }
  if (viewW >= 1700) return { cols: 10, rows: 6 };
  if (viewW >= 1280) return { cols: 8, rows: 5 };
  if (viewW >= 900) return { cols: 7, rows: 5 };
  return { cols: 5, rows: 4 };
}

export function createGrid(cols, rows) {
  const cells = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const seed = hash(col * 13 + 3, row * 17 + 5);
      const seedB = hash(col * 29 + 1, row * 7 + 11);
      cells.push({
        col,
        row,
        index: cells.length,
        filled: ((col + row) & 1) === 0,
        phase: seed * Math.PI * 2,
        phaseB: seedB * Math.PI * 2,
        seed,
        seedB,
      });
    }
  }
  return { cols, rows, cells };
}

export function computeMetrics(viewW, viewH, cols, rows) {
  const padX = viewW * 0.028;
  const padY = viewH * 0.032;
  const cellFactorW = HEX_W * GAP;
  const cellFactorH = HEX_H * GAP;
  const cubeSize = Math.min(
    (viewW - padX * 2) / (cols * cellFactorW),
    (viewH - padY * 2) / (rows * cellFactorH),
  );
  const cellW = cubeSize * cellFactorW;
  const cellH = cubeSize * cellFactorH;
  const gridW = cols * cellW;
  const gridH = rows * cellH;

  return {
    cubeSize,
    cellW,
    cellH,
    originX: (viewW - gridW) / 2 + cellW / 2,
    originY: (viewH - gridH) / 2 + cellH / 2,
    cx: viewW / 2,
    cy: viewH / 2,
    viewW,
    viewH,
  };
}
