export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function smoothstep(t) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

export function easeInOutCubic(t) {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - ((-2 * x + 2) ** 3) / 2;
}

/** Frame-rate independent exponential smoothing. */
export function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

/**
 * Underdamped spring. Lower damping lets the value pass the target
 * and settle, which reads as momentum rather than a linear slide.
 */
export function spring(position, velocity, target, dt, stiffness, damping) {
  const accel = (target - position) * stiffness - velocity * damping;
  const nextVelocity = velocity + accel * dt;
  return {
    position: position + nextVelocity * dt,
    velocity: nextVelocity,
  };
}
