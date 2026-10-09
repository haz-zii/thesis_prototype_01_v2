/**
 * Glass in front of the picture.
 * Turn the whole treatment off with displaySettings.enabled.
 * displaySettings.intensity scales every effect. 1 is the tuned level.
 * The other values are relative trims, also around 1.
 */
export const displaySettings = {
  enabled: true,
  intensity: 1,
  noise: 1,
  scanlines: 1,
  bars: 1,
  distortion: 1,
  chroma: 1,
  flicker: 1,
};

const NOISE_SIZE = 128;
const SLICE = 6;

export function createDisplay(overlay) {
  const glass = overlay.getContext('2d');
  const noiseCanvas = document.createElement('canvas');
  noiseCanvas.width = NOISE_SIZE;
  noiseCanvas.height = NOISE_SIZE;
  const noiseCtx = noiseCanvas.getContext('2d', { willReadFrequently: true });
  const noiseImage = noiseCtx.createImageData(NOISE_SIZE, NOISE_SIZE);

  const scanCanvas = document.createElement('canvas');
  scanCanvas.width = 1;
  scanCanvas.height = 3;
  const scanCtx = scanCanvas.getContext('2d');
  scanCtx.fillStyle = 'rgba(0, 0, 0, 0.85)';
  scanCtx.fillRect(0, 2, 1, 1);

  const bars = [];
  let viewW = 1;
  let viewH = 1;
  let dpr = 1;

  function resize(nextW, nextH, nextDpr) {
    viewW = nextW;
    viewH = nextH;
    dpr = nextDpr;
    overlay.width = Math.round(nextW * nextDpr);
    overlay.height = Math.round(nextH * nextDpr);
    overlay.style.width = `${nextW}px`;
    overlay.style.height = `${nextH}px`;
  }

  function level(name) {
    return displaySettings[name] * displaySettings.intensity;
  }

  function refreshNoise() {
    const pixels = noiseImage.data;
    for (let i = 0; i < pixels.length; i += 4) {
      const light = Math.random() < 0.5;
      const value = light ? 255 : 0;
      pixels[i] = value;
      pixels[i + 1] = value;
      pixels[i + 2] = value;
      pixels[i + 3] = 70 + ((Math.random() * 90) | 0);
    }
    noiseCtx.putImageData(noiseImage, 0, 0);
  }

  function shiftEnvelope(time) {
    return {
      envelope: Math.sin(time * 0.21 + 1.7),
      burst: Math.pow(Math.max(0, Math.sin(time * 0.31)), 28),
    };
  }

  function bandShift(y, time, envelope, burst) {
    const wave = Math.sin(y * 0.05 + time * 1.15) * envelope;
    const local = burst * Math.sin(y * 0.17 + time * 8);
    return (wave * 0.85 + local * 2.4) * level('distortion');
  }

  function updateBars(dt, time) {
    const amount = level('bars');
    if (amount <= 0) {
      bars.length = 0;
      return;
    }
    if (bars.length < 2 && Math.random() < dt * 0.18 * amount) {
      const travel = Math.random() < 0.4;
      bars.push({
        y: Math.random() * viewH,
        h: 5 + Math.random() * 9,
        age: 0,
        life: 0.45 + Math.random() * 0.85,
        travel,
        x: travel ? (Math.random() < 0.5 ? -0.85 : 1.15) : 0,
        dir: Math.random() < 0.5 ? 1 : -1,
        width: travel ? 0.42 + Math.random() * 0.38 : 1,
        light: Math.random() < 0.55,
        drift: (Math.random() - 0.5) * 18,
      });
    }
    for (let i = bars.length - 1; i >= 0; i -= 1) {
      const bar = bars[i];
      bar.age += dt;
      bar.y += bar.drift * dt;
      if (bar.travel) bar.x += bar.dir * dt * 0.85;
      if (bar.age >= bar.life) bars.splice(i, 1);
    }
  }

  function drawScene(viewCtx, scene, time) {
    viewCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    viewCtx.clearRect(0, 0, viewW, viewH);
    viewCtx.drawImage(scene, 0, 0, viewW, viewH);

    const { envelope, burst } = shiftEnvelope(time);
    const maxShift = (0.85 * Math.abs(envelope) + 2.4 * burst) * level('distortion');
    if (maxShift > 0.55) {
      for (let y = 0; y < viewH; y += SLICE) {
        const sliceH = Math.min(SLICE, viewH - y);
        const shift = bandShift(y, time, envelope, burst);
        if (Math.abs(shift) < 0.2) continue;
        viewCtx.drawImage(
          scene,
          0,
          y * dpr,
          viewW * dpr,
          sliceH * dpr,
          shift,
          y,
          viewW,
          sliceH,
        );
      }
    }

    const fringe = 1.1 * level('chroma');
    if (fringe > 0.01 && (Math.abs(envelope) > 0.72 || burst > 0.15)) {
      viewCtx.save();
      viewCtx.globalAlpha = 0.045 * level('chroma');
      viewCtx.drawImage(scene, fringe, 0, viewW, viewH);
      viewCtx.drawImage(scene, -fringe, 0, viewW, viewH);
      viewCtx.restore();
    }
  }

  function drawGlass(time, dt) {
    const pixelW = viewW * dpr;
    const pixelH = viewH * dpr;
    glass.setTransform(1, 0, 0, 1, 0, 0);
    glass.clearRect(0, 0, pixelW, pixelH);
    if (!displaySettings.enabled) return;

    const scan = level('scanlines');
    if (scan > 0.01) {
      glass.save();
      glass.globalAlpha = 0.16 * scan;
      glass.fillStyle = glass.createPattern(scanCanvas, 'repeat');
      glass.fillRect(0, 0, pixelW, pixelH);
      glass.restore();
    }

    const grain = level('noise');
    if (grain > 0.01) {
      refreshNoise();
      glass.save();
      glass.globalAlpha = 0.14 * grain;
      const pattern = glass.createPattern(noiseCanvas, 'repeat');
      glass.fillStyle = pattern;
      const ox = Math.random() * NOISE_SIZE;
      const oy = Math.random() * NOISE_SIZE;
      glass.translate(-ox, -oy);
      glass.fillRect(ox, oy, pixelW + NOISE_SIZE, pixelH + NOISE_SIZE);
      glass.restore();
    }

    updateBars(dt, time);
    for (let i = 0; i < bars.length; i += 1) {
      const bar = bars[i];
      const fade = Math.sin(Math.PI * Math.min(1, bar.age / bar.life));
      glass.globalAlpha = fade * 0.32 * level('bars');
      glass.fillStyle = bar.light ? '#f4f1ea' : '#14120f';
      const width = viewW * bar.width * dpr;
      const x = (bar.travel ? bar.x * viewW : (viewW - viewW * bar.width) * 0.5) * dpr;
      glass.fillRect(x, bar.y * dpr, width, bar.h * dpr);
    }
    glass.globalAlpha = 1;

    const flicker = level('flicker');
    if (flicker > 0.01) {
      const pulse = Math.sin(time * 17.0) * 0.65 + Math.sin(time * 43.0) * 0.35;
      glass.globalAlpha = Math.abs(pulse) * 0.035 * flicker;
      glass.fillStyle = pulse > 0 ? '#ffffff' : '#000000';
      glass.fillRect(0, 0, pixelW, pixelH);
      glass.globalAlpha = 1;
    }
  }

  function present(viewCtx, scene, time, dt) {
    if (!displaySettings.enabled || displaySettings.intensity <= 0) {
      viewCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      viewCtx.clearRect(0, 0, viewW, viewH);
      viewCtx.drawImage(scene, 0, 0, viewW, viewH);
      glass.setTransform(1, 0, 0, 1, 0, 0);
      glass.clearRect(0, 0, viewW * dpr, viewH * dpr);
      return;
    }
    drawScene(viewCtx, scene, time);
    drawGlass(time, dt);
  }

  return { resize, present };
}
