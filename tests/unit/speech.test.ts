import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import {
  MAX_DICTATION_MS,
  dictationAvailable,
  dictationErrorMessage,
  startDictation,
  transcriptOf,
  type SpeechResults
} from '../../src/services/speech.ts';

// Reconocimiento de voz simulado: apunta cómo se configuró y deja disparar sus eventos a mano
class FakeRecognition {
  static last: FakeRecognition | null = null;
  lang = '';
  interimResults = false;
  continuous = true;
  maxAlternatives = 0;
  onstart: (() => void) | null = null;
  onresult: ((event: { results: SpeechResults }) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  stopped = false;
  aborted = false;
  constructor() {
    FakeRecognition.last = this;
  }
  start() {}
  stop() {
    this.stopped = true;
  }
  abort() {
    this.aborted = true;
  }
}

const results = (...parts: string[]): SpeechResults =>
  Object.assign(
    parts.map((transcript) => Object.assign([{ transcript }], { isFinal: true })),
    { length: parts.length }
  );

const withWindow = (value: unknown) => {
  (globalThis as { window?: unknown }).window = value;
};
afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
  mock.timers.reset();
});

test('dictation is offered only where the browser can do it, prefixed or not', () => {
  assert.equal(dictationAvailable(), false);
  withWindow({ webkitSpeechRecognition: FakeRecognition });
  assert.equal(dictationAvailable(), true);
  withWindow({ SpeechRecognition: FakeRecognition });
  assert.equal(dictationAvailable(), true);
});

test('the text is what was recognised so far, in one line', () => {
  assert.equal(transcriptOf(results('comprar pan', ' para la  cena ')), 'comprar pan para la cena');
  // Los trozos se separan aunque no lleven espacio
  assert.equal(transcriptOf(results('luego', 'comprar')), 'luego comprar');
  assert.equal(transcriptOf(results()), '');
});

test('each error says what to do, and cancelling says nothing', () => {
  assert.match(dictationErrorMessage('not-allowed')!, /permiso al micrófono/);
  assert.match(dictationErrorMessage('network')!, /conexión/);
  assert.match(dictationErrorMessage('no-speech')!, /No se ha oído nada/);
  assert.equal(dictationErrorMessage('aborted'), null);
  assert.match(dictationErrorMessage('lo-que-sea')!, /No se pudo dictar/);
});

test('dictates in Spanish, one sentence at a time, and stops by itself after 30 seconds', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  withWindow({ SpeechRecognition: FakeRecognition });
  const seen: string[] = [];
  let started = false;
  let ended: string | null | undefined;
  startDictation({ onStart: () => (started = true), onText: (t) => seen.push(t), onEnd: (e) => (ended = e) });
  const recognition = FakeRecognition.last!;
  assert.equal(recognition.lang, 'es-ES');
  assert.equal(recognition.continuous, false);
  assert.equal(recognition.interimResults, true);
  recognition.onstart?.();
  assert.equal(started, true);
  recognition.onresult?.({ results: results('Comprar pan') });
  assert.deepEqual(seen, ['Comprar pan']);
  mock.timers.tick(MAX_DICTATION_MS - 1);
  assert.equal(recognition.stopped, false);
  mock.timers.tick(1);
  assert.equal(recognition.stopped, true);
  recognition.onerror?.({ error: 'no-speech' });
  recognition.onend?.();
  assert.match(ended!, /No se ha oído nada/);
});

test('cancelling (the form closes) writes nothing more', () => {
  withWindow({ SpeechRecognition: FakeRecognition });
  const seen: string[] = [];
  const dictation = startDictation({ onStart: () => undefined, onText: (t) => seen.push(t), onEnd: () => undefined });
  const recognition = FakeRecognition.last!;
  dictation.cancel();
  assert.equal(recognition.aborted, true);
  assert.equal(recognition.onresult, null);
  assert.deepEqual(seen, []);
});

test('without the API it ends right after, with a message', async () => {
  let ended: string | null = null;
  startDictation({ onStart: () => undefined, onText: () => undefined, onEnd: (e) => (ended = e) });
  // Después de volver: quien llama ya tiene el dictado cuando llega el final
  assert.equal(ended, null);
  await Promise.resolve();
  assert.match(ended!, /no permite dictar/);
});

test('only one dictation at a time: starting another cancels the previous one', () => {
  withWindow({ SpeechRecognition: FakeRecognition });
  const first: string[] = [];
  startDictation({ onStart: () => undefined, onText: (t) => first.push(t), onEnd: () => undefined });
  const previous = FakeRecognition.last!;
  startDictation({ onStart: () => undefined, onText: () => undefined, onEnd: () => undefined });
  assert.equal(previous.aborted, true);
  assert.equal(previous.onresult, null);
  assert.deepEqual(first, []);
});

test('the 30 seconds count from when the browser listens (after the permission prompt)', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  withWindow({ SpeechRecognition: FakeRecognition });
  startDictation({ onStart: () => undefined, onText: () => undefined, onEnd: () => undefined });
  const recognition = FakeRecognition.last!;
  mock.timers.tick(MAX_DICTATION_MS * 2);
  assert.equal(recognition.stopped, false);
  recognition.onstart?.();
  mock.timers.tick(MAX_DICTATION_MS);
  assert.equal(recognition.stopped, true);
});

test('cancelling detaches every handler, and Safari without dictation gets its own message', () => {
  withWindow({ SpeechRecognition: FakeRecognition });
  const dictation = startDictation({ onStart: () => undefined, onText: () => undefined, onEnd: () => undefined });
  const recognition = FakeRecognition.last!;
  dictation.cancel();
  assert.deepEqual(
    [recognition.onstart, recognition.onresult, recognition.onerror, recognition.onend],
    [null, null, null, null]
  );
  assert.match(dictationErrorMessage('service-not-allowed')!, /dictado del dispositivo/);
});
