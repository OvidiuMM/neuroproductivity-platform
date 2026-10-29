import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// La app en inglés: se fija antes de cargar los módulos (el idioma se lee al cargarlos)
(globalThis as { __CLAR_LOCALE__?: string }).__CLAR_LOCALE__ = 'en';
const { analyzeImmediateActionSyntax } = await import('../../src/services/syntaxAnalyzer.ts');

describe('analyzeImmediateActionSyntax in English', () => {
  it('rejects an empty action', () => {
    const result = analyzeImmediateActionSyntax('  ');
    assert.equal(result.isValid, false);
    assert.equal(result.warning, "The task name can't be empty.");
  });

  it('accepts an English action verb, also after a first word', () => {
    assert.deepEqual(analyzeImmediateActionSyntax('Call the supplier'), { isValid: true, detectedVerb: 'call' });
    assert.equal(analyzeImmediateActionSyntax('Book.').detectedVerb, 'book');
    assert.equal(analyzeImmediateActionSyntax('Please email Ana').detectedVerb, 'email');
  });

  it('suggests a first action for an amorphous project, in English', () => {
    const result = analyzeImmediateActionSyntax('Marketing');
    assert.equal(result.isValid, false);
    assert.equal(result.warning, '“Marketing” looks like a project, not a concrete action.');
    assert.match(result.suggestion ?? '', /^Draft a Google Ads plan/);
  });

  it('rejects an unknown one-word task with an English suggestion', () => {
    const result = analyzeImmediateActionSyntax('Groceries');
    assert.equal(result.isValid, false);
    assert.equal(result.warning, 'It needs an action verb.');
    assert.match(result.assistantQuestion ?? '', /first step/);
    assert.equal(result.suggestion, 'Call or write about groceries');
  });

  it('allows a multi-word phrase and suggests starting with a verb', () => {
    const result = analyzeImmediateActionSyntax('Quarterly report');
    assert.equal(result.isValid, true);
    assert.equal(result.detectedVerb, null);
    assert.match(result.warning ?? '', /start with an action verb/);
  });

  it('does not take Spanish verbs as English ones', () => {
    assert.equal(analyzeImmediateActionSyntax('Llamar al proveedor').detectedVerb, null);
  });
});
