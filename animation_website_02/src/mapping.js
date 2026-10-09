/**
 * Character → event map.
 * Edit this file to change which letters move the grid and how they sound.
 * The rest of the app only asks eventForKey() what to do.
 *
 * behavior: swell | flip | pulse | scatter | shift | rotate | null
 * sound:    a note event for the FM voice, or null for silence
 */

const pitches = ['c3', 'd3', 'f3', 'g3', 'a3', 'c4', 'd4', 'f4', 'g4', 'a4', 'c5', 'd5'];

const voices = {
  swell: {
    s: 'sine',
    gain: 0.2,
    attack: 0.02,
    decay: 0.2,
    sustain: 0.22,
    release: 0.42,
    cutoff: 1400,
    resonance: 1,
    room: 0.42,
    roomsize: 3,
    duration: 0.7,
  },
  flip: {
    s: 'square',
    gain: 0.11,
    attack: 0.004,
    decay: 0.07,
    sustain: 0.04,
    release: 0.08,
    cutoff: 980,
    resonance: 6,
    room: 0.14,
    roomsize: 1.4,
    duration: 0.2,
  },
  pulse: {
    s: 'triangle',
    gain: 0.18,
    attack: 0.01,
    decay: 0.12,
    sustain: 0.08,
    release: 0.16,
    cutoff: 1700,
    resonance: 3,
    room: 0.24,
    roomsize: 2,
    duration: 0.34,
  },
  scatter: {
    s: 'sawtooth',
    gain: 0.09,
    attack: 0.004,
    decay: 0.09,
    sustain: 0,
    release: 0.1,
    cutoff: 2600,
    resonance: 7,
    room: 0.18,
    roomsize: 2,
    duration: 0.24,
  },
  shift: {
    s: 'triangle',
    gain: 0.16,
    attack: 0.03,
    decay: 0.16,
    sustain: 0.16,
    release: 0.26,
    cutoff: 760,
    resonance: 2,
    room: 0.32,
    roomsize: 2.4,
    duration: 0.48,
  },
  rotate: {
    s: 'sine',
    gain: 0.18,
    attack: 0.04,
    decay: 0.22,
    sustain: 0.28,
    release: 0.55,
    cutoff: 1100,
    resonance: 1,
    room: 0.5,
    roomsize: 4,
    duration: 0.85,
  },
};

/** Letters share a behavior. Pitch still follows the letter, so they don't sound identical. */
export const groups = [
  { characters: 'aeiou', behavior: 'swell' },
  { characters: 'bcdgkpqt', behavior: 'flip' },
  { characters: 'mnlr', behavior: 'pulse' },
  { characters: 'fhsvxzj', behavior: 'scatter' },
  { characters: 'wy', behavior: 'shift' },
  {
    characters: '1234567890',
    behaviors: ['swell', 'flip', 'pulse', 'scatter', 'shift', 'rotate', 'swell', 'flip', 'pulse', 'scatter'],
  },
];

/** Per-character replacements. These win over the groups above. */
export const overrides = {
  // h: { behavior: 'shift', note: 'f3' },
};

export const special = {
  ' ': {
    type: 'insert',
    char: ' ',
    behavior: null,
    sound: null,
  },
  Enter: {
    type: 'newline',
    behavior: 'rotate',
    sound: {
      ...voices.rotate,
      notes: ['c3', 'g3'],
    },
  },
  Escape: {
    type: 'reset',
    behavior: 'reset',
    sound: null,
  },
  Backspace: {
    type: 'backspace',
    behavior: null,
    sound: {
      s: 'square',
      note: 'c6',
      gain: 0.07,
      attack: 0.001,
      decay: 0.04,
      sustain: 0,
      release: 0.03,
      cutoff: 3200,
      resonance: 2,
      room: 0,
      duration: 0.06,
    },
  },
};

const fallback = {
  behavior: 'pulse',
  voice: voices.pulse,
};

function pitchFor(char) {
  const code = char.toLowerCase().charCodeAt(0);
  if (code >= 97 && code <= 122) return pitches[(code - 97) % pitches.length];
  if (code >= 48 && code <= 57) return pitches[(code - 48) % pitches.length];
  return 'e4';
}

function panFor(char) {
  const code = char.charCodeAt(0);
  return 0.18 + ((code * 17) % 64) / 100;
}

function behaviorFor(group, char) {
  if (!group) return fallback.behavior;
  if (group.behaviors) {
    const index = group.characters.indexOf(char);
    return group.behaviors[index] ?? fallback.behavior;
  }
  return group.behavior ?? fallback.behavior;
}

function soundFor(behavior, char, extra) {
  const voice = voices[behavior] ?? fallback.voice;
  return {
    ...voice,
    note: pitchFor(char),
    pan: panFor(char),
    ...extra,
  };
}

export function eventForKey(key) {
  if (Object.prototype.hasOwnProperty.call(special, key)) {
    return { ...special[key] };
  }
  if (key.length !== 1) return null;

  const lower = key.toLowerCase();
  const group = groups.find((entry) => entry.characters.includes(lower));
  const behavior = behaviorFor(group, lower);
  const extra = overrides[lower] ?? {};
  const nextBehavior = extra.behavior === undefined ? behavior : extra.behavior;

  return {
    type: 'insert',
    char: key,
    behavior: nextBehavior,
    sound: extra.sound === null
      ? null
      : soundFor(nextBehavior, lower, extra.sound ?? (extra.note ? { note: extra.note } : {})),
  };
}
