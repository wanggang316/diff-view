import { createTwoFilesPatch } from 'diff';
import { parse } from 'diff2html';
import type { DiffDocument } from './protocol';

function inferLanguage(path: string): string {
  const filename = path.split('/').pop()?.toLowerCase() ?? '';
  if (filename === 'dockerfile' || filename === 'makefile') return filename;
  const extension = filename.includes('.') ? filename.split('.').pop()! : '';
  // diff2html maps source extensions to highlight.js languages itself.
  return /^[a-z0-9+-]{1,40}$/.test(extension) ? extension : 'plaintext';
}

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
    // The synthetic patch names deliberately conceal real paths, so their .txt
    // extension cannot identify the source language for syntax highlighting.
    file.language = document.language ?? inferLanguage(document.path);
  }
  return files;
}
