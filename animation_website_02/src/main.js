import { createBehaviors, triggerBehavior, updateBehaviors } from './behaviors.js';
import { createDisplay, displaySettings } from './display.js';
import { computeMetrics, createGrid, gridSizeForViewport } from './grid.js';
import { eventForKey } from './mapping.js';
import { createPerformance } from './performance.js';
import { renderFrame } from './render.js';
import { beginAudio, createSoundLayer, disposeSoundLayers, getControlRange, getPerformanceControls, playSound, stopSound } from './sound.js';
import { createTextLog } from './text.js';

const scrollKeys = new Set([
  ' ',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'PageUp',
  'PageDown',
  'Home',
  'End',
  'Backspace',
  'Tab',
]);

function createEngine(canvas, display) {
  const ctx = canvas.getContext('2d');
  const scene = document.createElement('canvas');
  const sceneCtx = scene.getContext('2d');
  let viewW = window.innerWidth;
  let viewH = window.innerHeight;
  let dpr = 1;
  let grid = createGrid(8, 5);
  let behaviors = createBehaviors(grid);
  let metrics = computeMetrics(viewW, viewH, grid.cols, grid.rows);
  let time = 0;
  let last = performance.now();

  function fit() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    const pixelW = Math.round(viewW * dpr);
    const pixelH = Math.round(viewH * dpr);
    canvas.width = pixelW;
    canvas.height = pixelH;
    scene.width = pixelW;
    scene.height = pixelH;
    canvas.style.width = `${viewW}px`;
    canvas.style.height = `${viewH}px`;
    sceneCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    display.resize(viewW, viewH, dpr);

    const size = gridSizeForViewport(viewW, viewH);
    if (size.cols !== grid.cols || size.rows !== grid.rows) {
      grid = createGrid(size.cols, size.rows);
      behaviors = createBehaviors(grid);
    }
    metrics = computeMetrics(viewW, viewH, grid.cols, grid.rows);
  }

  function frame(now) {
    let dt = (now - last) / 1000;
    if (!Number.isFinite(dt) || dt < 0) dt = 0;
    else if (dt > 0.033) dt = 0.033;
    last = now;
    time += dt;
    updateBehaviors(behaviors, dt, time);
    renderFrame(sceneCtx, grid, metrics, behaviors, time);
    sceneCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    display.present(ctx, scene, time, dt);
    requestAnimationFrame(frame);
  }

  fit();
  window.addEventListener('resize', fit);
  requestAnimationFrame(frame);

  return {
    trigger(name) {
      triggerBehavior(behaviors, name, grid);
    },
  };
}

const canvas = document.getElementById('stage');
const display = createDisplay(document.getElementById('display'));
window.displaySettings = displaySettings;
const engine = createEngine(canvas, display);
const textLog = createTextLog(document.getElementById('transcript'));
const performanceButton = document.getElementById('performance');
const mixPanel = document.getElementById('mix');
const addButton = document.getElementById('mix-add');

function formatPitch(semitones) {
  const rounded = Math.round(semitones);
  if (rounded > 0) return `+${rounded}`;
  return String(rounded);
}

function formatVolume(level) {
  return `${Math.round(level * 100)}%`;
}

function formatHarmonics(value) {
  return value.toFixed(1);
}

function formatLength(value) {
  return `${value.toFixed(1)}×`;
}

function bindControl(id, key, format) {
  const input = document.getElementById(id);
  const readout = document.getElementById(`${id}-value`);
  const range = getControlRange()[key];
  const current = getPerformanceControls()[key];
  input.min = String(range.min);
  input.max = String(range.max);
  input.step = String(range.step);
  input.value = String(current);
  readout.textContent = format(current);

  input.addEventListener('input', () => {
    readout.textContent = format(Number(input.value));
  });
  input.addEventListener('pointerup', () => {
    input.blur();
  });
}

bindControl('mix-pitch', 'pitch', formatPitch);
bindControl('mix-volume', 'volume', formatVolume);
bindControl('mix-harmonics', 'harmonics', formatHarmonics);
bindControl('mix-length', 'length', formatLength);

function readDraft() {
  return {
    pitch: Number(document.getElementById('mix-pitch').value),
    volume: Number(document.getElementById('mix-volume').value),
    harmonics: Number(document.getElementById('mix-harmonics').value),
    length: Number(document.getElementById('mix-length').value),
  };
}

addButton.addEventListener('mousedown', (event) => {
  event.preventDefault();
});

addButton.addEventListener('click', () => {
  player.overdub();
  addButton.blur();
});

function setPerformanceButton(playing) {
  performanceButton.textContent = playing ? 'Stop' : 'Start';
  performanceButton.setAttribute('aria-pressed', playing ? 'true' : 'false');
  performanceButton.dataset.state = playing ? 'playing' : 'stopped';
}

const player = createPerformance({
  getText: () => textLog.value(),
  getMix: readDraft,
  trigger: (name) => engine.trigger(name),
  play: (params, layerId) => playSound(params, layerId),
  silence: () => stopSound(),
  prepare: () => beginAudio(),
  createLayer: (mix) => createSoundLayer(mix),
  disposeLayers: () => disposeSoundLayers(),
  onChange: setPerformanceButton,
});

function applyEvent(resolved) {
  if (resolved.type === 'reset') {
    player.reset();
    textLog.clear();
    return;
  }

  if (resolved.type === 'backspace') textLog.backspace();
  else if (resolved.type === 'newline') textLog.newline();
  else if (resolved.type === 'insert') textLog.insert(resolved.char);
}

performanceButton.addEventListener('mousedown', (event) => {
  event.preventDefault();
});

performanceButton.addEventListener('click', () => {
  if (player.isPlaying()) player.stop();
  else player.start();
  performanceButton.blur();
});

window.addEventListener('pagehide', () => {
  player.stop();
});

window.addEventListener('keydown', (event) => {
  if (event.target === performanceButton) return;
  if (event.target instanceof Node && mixPanel.contains(event.target)) return;
  if (event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return;

  const resolved = eventForKey(event.key);
  if (!resolved) {
    if (scrollKeys.has(event.key)) event.preventDefault();
    return;
  }

  event.preventDefault();
  applyEvent(resolved);
});
