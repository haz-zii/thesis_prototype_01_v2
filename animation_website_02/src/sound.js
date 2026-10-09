/**
 * FM voices for the page. Each Add builds one more PolySynth of FMSynth
 * on the same Tone context. A layer keeps the mix it was created with.
 */
const BASE_DECAY = 0.2;
const BASE_RELEASE = 0.4;
const MAX_GAIN = 0.4;

const controlRange = {
  pitch: { min: -12, max: 12, step: 1 },
  volume: { min: 0, max: 1, step: 0.01 },
  harmonics: { min: 0, max: 20, step: 0.1 },
  length: { min: 0.5, max: 2, step: 0.05 },
};

const controls = {
  pitch: 0,
  volume: 0.7,
  harmonics: 12.2,
  length: 1,
};

const MAX_LAYERS = 6;

let tone = null;
let loading = null;
let nextLayerId = 1;
const layers = new Map();

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function getControlRange() {
  return {
    pitch: { ...controlRange.pitch },
    volume: { ...controlRange.volume },
    harmonics: { ...controlRange.harmonics },
    length: { ...controlRange.length },
  };
}

export function getPerformanceControls() {
  return { ...controls };
}

function mixFrom(partial) {
  const source = partial || {};
  return {
    pitch: clamp(
      typeof source.pitch === 'number' ? source.pitch : controls.pitch,
      controlRange.pitch.min,
      controlRange.pitch.max,
    ),
    volume: clamp(
      typeof source.volume === 'number' ? source.volume : controls.volume,
      controlRange.volume.min,
      controlRange.volume.max,
    ),
    harmonics: clamp(
      typeof source.harmonics === 'number' ? source.harmonics : controls.harmonics,
      controlRange.harmonics.min,
      controlRange.harmonics.max,
    ),
    length: clamp(
      typeof source.length === 'number' ? source.length : controls.length,
      controlRange.length.min,
      controlRange.length.max,
    ),
  };
}

function voiceSettings(mix) {
  return {
    harmonicity: 3,
    modulationIndex: mix.harmonics,
    detune: mix.pitch * 100,
    envelope: {
      attack: 0.01,
      decay: BASE_DECAY * mix.length,
      sustain: 0.4,
      release: BASE_RELEASE * mix.length,
    },
    modulation: {
      type: 'square',
    },
    modulationEnvelope: {
      attack: 0.2,
      decay: 0.01,
      sustain: 0.2,
      release: 0.2,
    },
  };
}

function velocityFor(gain) {
  const level = typeof gain === 'number' ? gain : 0.2;
  return Math.min(1, Math.max(0.02, level * 2.5));
}

function loadTone() {
  if (tone) return Promise.resolve(tone);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL('../vendor/Tone.js', import.meta.url);
    script.onload = () => {
      if (window.Tone) {
        tone = window.Tone;
        resolve(tone);
        return;
      }
      loading = null;
      reject(new Error('Tone.js did not load'));
    };
    script.onerror = () => {
      loading = null;
      reject(new Error('Tone.js failed to load'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * Load Tone and resume its context. Call this from a click.
 * The context is created once. Each layer adds its own FM voice later.
 */
export function beginAudio() {
  return loadTone().then((Tone) => Tone.start());
}

/** A new FM voice that keeps this mix. Returns an id, or null at the layer cap. */
export function createSoundLayer(mix) {
  if (!tone || layers.size >= MAX_LAYERS) return null;
  const tuned = mixFrom(mix);
  const voice = new tone.PolySynth({
    voice: tone.FMSynth,
    maxPolyphony: 8,
    options: voiceSettings(tuned),
  });
  const output = new tone.Gain(tuned.volume * MAX_GAIN);
  voice.connect(output);
  output.toDestination();
  const id = nextLayerId;
  nextLayerId += 1;
  layers.set(id, { voice, output, mix: tuned });
  return id;
}

/** Release every sounding note. Layers stay so Start can play them again. */
export function stopSound() {
  for (const layer of layers.values()) {
    layer.voice.releaseAll(layer.voice.now());
  }
}

/** Drop every layer. The audio context stays. */
export function disposeSoundLayers() {
  stopSound();
  for (const layer of layers.values()) {
    if (typeof layer.voice.dispose === 'function') layer.voice.dispose();
    if (typeof layer.output.dispose === 'function') layer.output.dispose();
  }
  layers.clear();
}

/** Play one phrase event on one layer. `notes` stacks a chord; otherwise `note` is used. */
export function playSound(params, layerId) {
  const layer = layers.get(layerId);
  if (!params || !layer) return;
  const pitches = (params.notes ?? [params.note]).filter(Boolean);
  if (!pitches.length) return;
  const duration = Number(params.duration);
  const base = Number.isFinite(duration) && duration > 0 ? duration : 0.35;
  const length = Math.min(2.2, Math.max(0.05, base * layer.mix.length));
  layer.voice.triggerAttackRelease(
    pitches.length === 1 ? pitches[0] : pitches,
    length,
    layer.voice.now(),
    velocityFor(params.gain),
  );
}
