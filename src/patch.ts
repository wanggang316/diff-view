import { createTwoFilesPatch } from 'diff';
import { parse } from 'diff2html';
import type { DiffDocument } from './protocol';

export function makeDiff(document: DiffDocument) {
  // Real paths stay out of patch headers: Git quoting is not a UI transport.
  const patch = createTwoFilesPatch('before.txt', 'after.txt', document.oldText, document.newText, '', '', {
    context: 3, timeout: 200, maxEditLength: 4_000,
  });
  if (patch === undefined) throw new Error('Diff computation exceeded the preview budget.');
  const files = parse(patch);
  let renderedLines = 0;
  for (const file of files) {
    renderedLines += file.blocks.reduce((count, block) => count + block.lines.length, 0);
    if (renderedLines > 4_000) throw new Error('Diff exceeds the 4,000 visible line preview limit.');
    file.oldName = document.path;
    file.newName = document.path;
    if (document.language) file.language = document.language;
  }
  return files;
}
