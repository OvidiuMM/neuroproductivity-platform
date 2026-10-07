import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { analyzeImmediateActionSyntax } from '../../src/services/syntaxAnalyzer.ts';

describe('analyzeImmediateActionSyntax', () => {
  it('rejects an empty action', () => {
    const result = analyzeImmediateActionSyntax('  ');

    assert.equal(result.isValid, false);
    assert.equal(result.detectedVerb, null);
    assert.match(result.warning ?? '', /no puede estar vacío/);
  });

  it('accepts an immediate physical action', () => {
    const result = analyzeImmediateActionSyntax('Llamar al proveedor');

    assert.equal(result.isValid, true);
    assert.equal(result.detectedVerb, 'llamar');
  });

  it('suggests a first action for an amorphous project', () => {
    const result = analyzeImmediateActionSyntax('Marketing');

    assert.equal(result.isValid, false);
    assert.equal(result.detectedVerb, null);
    assert.match(result.suggestion ?? '', /Redactar plan de anuncios/);
  });

  it('rejects an unknown one-word task', () => {
    const result = analyzeImmediateActionSyntax('Proyecto');

    assert.equal(result.isValid, false);
    assert.match(result.assistantQuestion ?? '', /acción motora/);
  });

  it('allows a multi-word phrase and warns when it does not begin with an action', () => {
    const result = analyzeImmediateActionSyntax('Proyecto trimestral');

    assert.equal(result.isValid, true);
    assert.equal(result.detectedVerb, null);
    assert.match(result.warning ?? '', /Comienza con un verbo/);
  });
});
