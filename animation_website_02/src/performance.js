import { eventsForPhrase, splitPhrases } from './phrases.js';

const STEP_MS = 120;
const TAIL_MS = 420;

/**
 * Loops committed layers on one timer.
 * Typing does not change a layer. Add stacks another layer beside the ones already playing.
 * The draw loop is untouched; this only calls trigger() and play().
 */
export function createPerformance({
  getText,
  getMix,
  trigger,
  play,
  silence,
  prepare,
  createLayer,
  disposeLayers,
  onChange,
}) {
  let playing = false;
  let generation = 0;
  let epoch = 0;
  let timer = null;
  let clock = 0;
  let claim = '';
  let seeded = false;
  const score = [];

  function clearTimer() {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
  }

  function later(ms, fn) {
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      fn();
    }, ms);
  }

  function stop() {
    const wasPlaying = playing;
    playing = false;
    generation += 1;
    clearTimer();
    silence();
    trigger('reset');
    if (wasPlaying) onChange(false);
  }

  function reset() {
    stop();
    epoch += 1;
    score.length = 0;
    claim = '';
    seeded = false;
    if (disposeLayers) disposeLayers();
  }

  function takePhrases(text) {
    const source = typeof text === 'string' ? text : '';
    if (claim && source.startsWith(claim)) {
      if (source.length === claim.length) {
        const same = splitPhrases(source);
        return same.length ? same : null;
      }
      const extra = splitPhrases(source.slice(claim.length));
      if (!extra.length) return null;
      claim = source;
      return extra;
    }
    const phrases = splitPhrases(source);
    if (!phrases.length) return null;
    claim = source;
    return phrases;
  }

  function prime(layer, time) {
    layer.phraseIndex = 0;
    layer.eventIndex = 0;
    layer.events = eventsForPhrase(layer.phrases[0]);
    layer.nextTime = time;
    layer.armReset = false;
  }

  function advance(layer) {
    const count = layer.events.length;
    if (count > 0 && layer.eventIndex < count - 1) {
      layer.eventIndex += 1;
      layer.nextTime += STEP_MS;
      return;
    }
    const wrapped = layer.phraseIndex + 1 >= layer.phrases.length;
    layer.phraseIndex = wrapped ? 0 : layer.phraseIndex + 1;
    layer.eventIndex = 0;
    layer.events = eventsForPhrase(layer.phrases[layer.phraseIndex]);
    layer.nextTime += TAIL_MS;
    if (wrapped && layer.drivesVisuals) layer.armReset = true;
  }

  function tick(gen) {
    if (gen !== generation || !playing) return;
    for (let i = 0; i < score.length; i += 1) {
      const layer = score[i];
      if (layer.nextTime > clock) continue;
      if (layer.armReset) {
        trigger('reset');
        layer.armReset = false;
      }
      const event = layer.events[layer.eventIndex];
      if (layer.drivesVisuals && event?.behavior) trigger(event.behavior);
      if (event?.sound) play(event.sound, layer.soundId);
      advance(layer);
    }
    if (!playing || gen !== generation || score.length === 0) return;
    let next = Infinity;
    for (let i = 0; i < score.length; i += 1) {
      if (score[i].nextTime < next) next = score[i].nextTime;
    }
    const wait = Math.max(0, next - clock);
    clock = next;
    later(wait, () => tick(gen));
  }

  function pushLayer(phrases, mix) {
    const soundId = createLayer(mix);
    if (soundId == null) return null;
    const layer = {
      phrases: phrases.slice(),
      soundId,
      drivesVisuals: !score.some((item) => item.drivesVisuals),
      events: [],
      phraseIndex: 0,
      eventIndex: 0,
      nextTime: 0,
      armReset: false,
    };
    score.push(layer);
    return layer;
  }

  function overdub() {
    const text = getText() || '';
    const previous = claim;
    const phrases = takePhrases(text);
    if (!phrases) return false;
    const mix = getMix();
    const stamp = epoch;
    Promise.resolve(prepare ? prepare() : undefined)
      .then(() => {
        if (stamp !== epoch) return;
        const layer = pushLayer(phrases, mix);
        if (!layer) {
          if (claim === text) claim = previous;
          return;
        }
        claim = text;
        if (!playing) return;
        if (timer === null) {
          clock = 0;
          prime(layer, 0);
          tick(generation);
          return;
        }
        prime(layer, clock);
      })
      .catch((error) => {
        console.error(error);
        if (claim === text) claim = previous;
      });
    return true;
  }

  function start() {
    if (playing) return false;
    let seedPhrases = null;
    let seedText = '';
    let seedMix = null;
    const previousClaim = claim;
    if (score.length === 0 && !claim) {
      seedText = getText() || '';
      seedMix = getMix();
      seedPhrases = takePhrases(seedText);
      if (!seedPhrases) return false;
    }
    playing = true;
    generation += 1;
    const gen = generation;
    const stamp = epoch;
    onChange(true);
    Promise.resolve(prepare ? prepare() : undefined)
      .then(() => {
        if (gen !== generation || !playing || stamp !== epoch) {
          if (stamp === epoch && !seeded && score.length === 0) claim = previousClaim;
          return;
        }
        if (seedPhrases && !seeded) {
          const layer = pushLayer(seedPhrases, seedMix);
          if (!layer) {
            claim = '';
            stop();
            return;
          }
          seeded = true;
          if (timer !== null) prime(layer, clock);
        }
        if (score.length === 0 || timer !== null) return;
        clock = 0;
        for (let i = 0; i < score.length; i += 1) prime(score[i], 0);
        tick(gen);
      })
      .catch((error) => {
        console.error(error);
        if (gen !== generation || stamp !== epoch) return;
        if (!seeded && score.length === 0) claim = previousClaim;
        stop();
      });
    return true;
  }

  return {
    start,
    stop,
    reset,
    overdub,
    isPlaying() {
      return playing;
    },
  };
}
