import { eventForKey } from './mapping.js';

/**
 * Phrase boundaries are sentence punctuation and line breaks.
 * A trailing fragment with no punctuation is still a phrase.
 */
const PHRASE_PATTERN = /[^.!?\n…]*[.!?…]+|[^.!?\n…]+/g;

export function splitPhrases(text) {
  const source = typeof text === 'string' ? text : '';
  if (!source.trim()) return [];

  const phrases = [];
  const lines = source.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const parts = lines[i].match(PHRASE_PATTERN);
    if (!parts) continue;
    for (let j = 0; j < parts.length; j += 1) {
      const phrase = parts[j].trim();
      if (phrase) phrases.push(phrase);
    }
  }
  return phrases;
}

/** Character events for one phrase, using the same key map as typing. */
export function eventsForPhrase(phrase) {
  const events = [];
  let gap = false;
  const chars = Array.from(phrase || '');
  for (let i = 0; i < chars.length; i += 1) {
    const char = chars[i];
    if (char === ' ' || char === '\t') {
      if (gap) continue;
      gap = true;
      events.push({ behavior: null, sound: null });
      continue;
    }
    gap = false;
    const resolved = eventForKey(char);
    if (!resolved) continue;
    events.push({
      behavior: resolved.behavior,
      sound: resolved.sound,
    });
  }
  return events;
}
