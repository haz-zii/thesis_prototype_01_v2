import { lerp, smoothstep } from './easing.js';

/**
 * Palettes taken from the TouchDesigner prototype:
 * saturated fields (green, magenta, purple, orange, blue)
 * and chalky instance colors sitting on top of them.
 * Each scene eases into the next. Cube colors are a second,
 * slower gradient scrolling across the grid.
 */
const SCENES = [
  {
    name: 'green',
    bg: ['#3ad24c', '#2fbe40', '#55e062'],
    cubes: ['#dccdf2', '#f1deb6', '#f7f4ee', '#cfc9c2', '#e4d4f4', '#f4e7c6'],
    lineMix: 0.5,
  },
  {
    name: 'magenta',
    bg: ['#ee45c0', '#e230b0', '#ff78d4'],
    cubes: ['#ffffff', '#ffd4ef', '#ffeaf7', '#f3c6e4', '#fff7fc', '#f0d0ea'],
    lineMix: 0.72,
  },
  {
    name: 'purple',
    bg: ['#7a3fd0', '#682ec0', '#9460e4'],
    cubes: ['#f6f1ff', '#e4d4fb', '#fff8ee', '#d9d0ea', '#f3e6c8', '#efe6ff'],
    lineMix: 0.62,
  },
  {
    name: 'orange',
    bg: ['#f1842a', '#e87418', '#ff9a48'],
    cubes: ['#fff6e8', '#ffffff', '#f0d8b4', '#e7d4f4', '#ffe7c4', '#f7f1e8'],
    lineMix: 0.58,
  },
  {
    name: 'blue',
    bg: ['#3a6fe0', '#2d5ed4', '#5b8ef0'],
    cubes: ['#f4f7ff', '#ffe9c4', '#ffffff', '#d5d8ea', '#f7e7a8', '#e4dcff'],
    lineMix: 0.6,
  },
].map(parseScene);

const CYCLE_SECONDS = 70;

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function parseScene(scene) {
  return {
    name: scene.name,
    bg: scene.bg.map(hexToRgb),
    cubes: scene.cubes.map(hexToRgb),
    lineMix: scene.lineMix,
  };
}

function mix(a, b, t) {
  return [
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t),
    lerp(a[2], b[2], t),
  ];
}

function mixList(a, b, t) {
  return a.map((color, i) => mix(color, b[i], t));
}

export function rgbCss(rgb) {
  return `rgb(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0})`;
}

export function scaleRgb(rgb, k) {
  return [rgb[0] * k, rgb[1] * k, rgb[2] * k];
}

export function sampleScene(time) {
  const count = SCENES.length;
  let cycle = Number.isFinite(time) ? time % CYCLE_SECONDS : 0;
  if (cycle < 0) cycle += CYCLE_SECONDS;
  const x = (cycle / CYCLE_SECONDS) * count;
  const i = Math.floor(x) % count;
  const j = (i + 1) % count;
  const t = smoothstep(x - Math.floor(x));
  const a = SCENES[i];
  const b = SCENES[j];
  return {
    bg: mixList(a.bg, b.bg, t),
    cubes: mixList(a.cubes, b.cubes, t),
    lineMix: lerp(a.lineMix, b.lineMix, t),
    angle: Math.PI * 0.5 + Math.sin(time * 0.07) * 0.4,
  };
}

/** Diagonal gradient across the grid, plus a little spatial drift. */
export function cubeColor(scene, cell, cols, rows, time) {
  const u = cols <= 1 ? 0.5 : cell.col / (cols - 1);
  const v = rows <= 1 ? 0.5 : cell.row / (rows - 1);
  const drift = Math.sin(cell.col * 0.72 + time * 0.18) * 0.06
    + Math.sin(cell.row * 0.64 - time * 0.14) * 0.06;
  let g = u * 0.62 + v * 0.38 + time * 0.032 + drift;
  g %= 1;
  if (g < 0) g += 1;

  const palette = scene.cubes;
  const x = g * palette.length;
  const i = Math.floor(x) % palette.length;
  const j = (i + 1) % palette.length;
  return mix(palette[i], palette[j], x - Math.floor(x));
}

export function lineColor(scene, rgb) {
  return mix(rgb, [255, 255, 255], scene.lineMix);
}
