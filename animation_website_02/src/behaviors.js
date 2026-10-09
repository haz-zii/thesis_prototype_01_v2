import { damp, easeInOutCubic, lerp, spring } from './easing.js';

/** Names the keyboard (and later, sound) can fire independently. */
export const BEHAVIOR_NAMES = ['swell', 'flip', 'pulse', 'scatter', 'shift', 'rotate'];

const FLIP_STEP = Math.PI;
const ROTATE_STEP = Math.PI / 7;
const TAU = Math.PI * 2;

const FLIP_STIFFNESS = 30;
const FLIP_DAMPING = 6.1;
const ROTATE_STIFFNESS = 14;
const ROTATE_DAMPING = 5.1;

export function createBehaviors(grid) {
  const count = grid.cells.length;
  const scatter = {
    amount: 0,
    dx: new Float32Array(count),
    dy: new Float32Array(count),
    rand: new Float32Array(count),
    ox: new Float32Array(count),
    oy: new Float32Array(count),
    tx: new Float32Array(count),
    ty: new Float32Array(count),
  };
  rollScatterDirections(scatter);

  return {
    time: 0,
    swell: { start: -1, duration: 3.6 },
    flip: {
      angle: new Float32Array(count),
      velocity: new Float32Array(count),
      target: new Float32Array(count),
      pending: new Float32Array(count),
      delay: new Float32Array(count),
    },
    pulse: { start: -1, duration: 2.6 },
    scatter,
    shift: {
      shifted: false,
      offset: new Float32Array(grid.cols),
      from: new Float32Array(grid.cols),
      target: new Float32Array(grid.cols),
      t: new Float32Array(grid.cols).fill(1),
      delay: new Float32Array(grid.cols),
      duration: 1.2,
    },
    rotate: { angle: 0, velocity: 0, target: 0 },
  };
}

function rollScatterDirections(scatter) {
  for (let i = 0; i < scatter.dx.length; i += 1) {
    const angle = Math.random() * TAU;
    scatter.dx[i] = Math.cos(angle);
    scatter.dy[i] = Math.sin(angle);
    scatter.rand[i] = Math.sqrt(Math.random());
  }
}

function applyScatterTargets(scatter) {
  for (let i = 0; i < scatter.dx.length; i += 1) {
    const mag = scatter.rand[i] * scatter.amount;
    scatter.tx[i] = scatter.dx[i] * mag;
    scatter.ty[i] = scatter.dy[i] * mag;
  }
}

function changeScatterAmount(scatter, delta) {
  const prev = scatter.amount;
  let next = Math.max(0, Math.min(1.35, prev + delta));
  if (prev <= 0.001 && delta > 0) next = Math.max(next, 0.42);
  scatter.amount = next;
  applyScatterTargets(scatter);
}

function rerollScatter(scatter) {
  if (scatter.amount < 0.08) scatter.amount = 0.5;
  rollScatterDirections(scatter);
  applyScatterTargets(scatter);
}

function triggerShift(shift, cols) {
  shift.shifted = !shift.shifted;
  const mid = (cols - 1) / 2 || 1;
  for (let col = 0; col < cols; col += 1) {
    shift.from[col] = shift.offset[col];
    const along = (col - mid) / mid;
    shift.target[col] = shift.shifted ? along * 0.5 : 0;
    shift.t[col] = 0;
    shift.delay[col] = col * 0.045;
  }
}

function triggerFlip(flip, grid) {
  for (const cell of grid.cells) {
    const i = cell.index;
    flip.pending[i] += FLIP_STEP;
    if (flip.delay[i] <= 0) {
      flip.delay[i] = cell.col * 0.05 + cell.row * 0.016;
    }
  }
}

function resetBehaviors(state, grid) {
  state.swell.start = -1;
  state.pulse.start = -1;

  const { flip, scatter, shift, rotate } = state;
  for (let i = 0; i < flip.angle.length; i += 1) {
    const turns = Math.round(flip.angle[i] / TAU);
    flip.angle[i] -= turns * TAU;
    flip.target[i] = 0;
    flip.pending[i] = 0;
    flip.delay[i] = 0;
    flip.velocity[i] *= 0.2;
  }

  scatter.amount = 0;
  applyScatterTargets(scatter);

  shift.shifted = false;
  for (let col = 0; col < shift.offset.length; col += 1) {
    shift.from[col] = shift.offset[col];
    shift.target[col] = 0;
    shift.t[col] = 0;
    shift.delay[col] = col * 0.03;
  }

  const turns = Math.round(rotate.angle / TAU);
  rotate.angle -= turns * TAU;
  rotate.target = 0;
  rotate.velocity *= 0.25;
}

export function triggerBehavior(state, name, grid) {
  switch (name) {
    case 'swell':
      state.swell.start = state.time;
      break;
    case 'flip':
      triggerFlip(state.flip, grid);
      break;
    case 'pulse':
      state.pulse.start = state.time;
      break;
    case 'scatter':
      rerollScatter(state.scatter);
      break;
    case 'scatter-up':
      changeScatterAmount(state.scatter, 0.18);
      break;
    case 'scatter-down':
      changeScatterAmount(state.scatter, -0.18);
      break;
    case 'shift':
      triggerShift(state.shift, grid.cols);
      break;
    case 'rotate':
      state.rotate.target += ROTATE_STEP;
      break;
    case 'rotate-ccw':
      state.rotate.target -= ROTATE_STEP;
      break;
    case 'reset':
      resetBehaviors(state, grid);
      break;
    default:
      break;
  }
}

export function updateBehaviors(state, dt, time) {
  state.time = time;
  const { flip, scatter, shift, rotate } = state;

  for (let i = 0; i < flip.angle.length; i += 1) {
    if (flip.delay[i] > 0) {
      flip.delay[i] -= dt;
      if (flip.delay[i] <= 0) {
        flip.target[i] += flip.pending[i];
        flip.pending[i] = 0;
      }
    }
    const next = spring(
      flip.angle[i],
      flip.velocity[i],
      flip.target[i],
      dt,
      FLIP_STIFFNESS,
      FLIP_DAMPING,
    );
    flip.angle[i] = next.position;
    flip.velocity[i] = next.velocity;
  }

  for (let i = 0; i < scatter.ox.length; i += 1) {
    scatter.ox[i] = damp(scatter.ox[i], scatter.tx[i], 4.6, dt);
    scatter.oy[i] = damp(scatter.oy[i], scatter.ty[i], 4.6, dt);
  }

  for (let col = 0; col < shift.offset.length; col += 1) {
    if (shift.delay[col] > 0) {
      shift.delay[col] = Math.max(0, shift.delay[col] - dt);
      continue;
    }
    if (shift.t[col] < 1) {
      shift.t[col] = Math.min(1, shift.t[col] + dt / shift.duration);
      shift.offset[col] = lerp(shift.from[col], shift.target[col], easeInOutCubic(shift.t[col]));
    }
  }

  const spun = spring(
    rotate.angle,
    rotate.velocity,
    rotate.target,
    dt,
    ROTATE_STIFFNESS,
    ROTATE_DAMPING,
  );
  rotate.angle = spun.position;
  rotate.velocity = spun.velocity;
}

function swellScale(cell, swell, time, cols, rows) {
  if (swell.start < 0) return 1;
  const midC = (cols - 1) / 2;
  const midR = (rows - 1) / 2;
  const dist = Math.hypot(cell.col - midC, cell.row - midR);
  const maxDist = Math.hypot(midC, midR) || 1;
  const delay = (dist / maxDist) * 0.42;
  const u = (time - swell.start - delay) / swell.duration;
  if (u <= 0 || u >= 1) return 1;
  const envelope = Math.sin(Math.PI * u);
  const wave = Math.sin(u * Math.PI * 4 + cell.phase);
  return 1 + wave * envelope * 0.5;
}

function pulseOffset(cell, pulse, time) {
  if (pulse.start < 0) return [0, 0];
  const delay = cell.seed * 0.16;
  const u = (time - pulse.start - delay) / pulse.duration;
  if (u <= 0 || u >= 1) return [0, 0];
  const envelope = Math.sin(Math.PI * u);
  const forth = Math.sin(u * Math.PI * 3 + cell.phase);
  const back = Math.sin(u * Math.PI * 2 + cell.phaseB);
  const dist = 0.22 + cell.seed * 0.72;
  return [
    Math.cos(cell.phase) * forth * envelope * dist,
    Math.sin(cell.phaseB) * back * envelope * dist,
  ];
}

/** Grid-space pose. Offsets are in cell widths / heights. Scale is around the cube center. */
export function motionForCell(state, grid, cell) {
  const i = cell.index;
  const [px, py] = pulseOffset(cell, state.pulse, state.time);
  return {
    scale: swellScale(cell, state.swell, state.time, grid.cols, grid.rows),
    rotation: state.flip.angle[i],
    offsetX: state.scatter.ox[i] + px,
    offsetY: state.scatter.oy[i] + py + state.shift.offset[cell.col],
  };
}
