import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDocument, validateOptions } from './protocol.ts';
import { makeDiff } from './patch.ts';
const base = { id: 'a', path: 'src/main.swift', oldText: 'one\ntwo\n', newText: 'one\nthree\n' };
test('patch preserves content changes and real path independently', () => {
  const doc = validateDocument({ ...base, path: 'a\tb\n" c.swift' });
  const files = makeDiff(doc);
  assert.equal(files.length, 1);
  assert.equal(files[0].newName, doc.path);
  assert.equal(files[0].addedLines, 1);
  assert.equal(files[0].deletedLines, 1);
});
test('rejects malformed or oversized input and binary data', () => {
  for (const input of [null, {}, { ...base, id: '' }, { ...base, oldText: '\0' }, { ...base, newText: 'x'.repeat(1_000_001) }, { ...base, newText: '\n'.repeat(10_001) }, { ...base, language: '<script>' }]) {
    assert.throws(() => validateDocument(input));
  }
  assert.throws(() => validateOptions({ layout: 'edit', theme: 'dark' }));
});
test('additions and deletions keep correct side line numbers', () => {
  const added = makeDiff({ ...base, oldText: '', newText: 'new\n' })[0];
  assert.equal(added.addedLines, 1);
  const line = added.blocks[0].lines[0];
  assert.equal(line.newNumber, 1);
  assert.equal(line.oldNumber, undefined);
  const removed = makeDiff({ ...base, oldText: 'old\n', newText: '' })[0];
  assert.equal(removed.deletedLines, 1);
  assert.equal(removed.blocks[0].lines[0].oldNumber, 1);
});
test('computation budget rejects radically different files', () => {
  assert.throws(() => makeDiff({ ...base, oldText: 'a\n'.repeat(2500), newText: 'b\n'.repeat(2500) }), /budget|limit/);
});
