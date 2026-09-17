export interface DiffDocument {
  id: string;
  path: string;
  oldText: string;
  newText: string;
  language?: string;
}
export interface DiffOptions {
  layout: 'unified' | 'split';
  theme: 'light' | 'dark';
  chrome?: 'full' | 'none';
}
export interface DiffEvent {
  version: 1;
  type: 'ready' | 'rendered' | 'openFile' | 'error';
  documentID?: string;
  path?: string;
  side?: 'old' | 'new';
  line?: number;
  message?: string;
}
export const defaultOptions: DiffOptions = { layout: 'unified', theme: 'dark', chrome: 'full' };
export function validateDocument(input: unknown): DiffDocument {
  if (!input || typeof input !== 'object') throw new Error('Expected a document.');
  const value = input as Record<string, unknown>;
  for (const key of ['id', 'path', 'oldText', 'newText']) {
    if (typeof value[key] !== 'string') throw new Error(`Expected string: ${key}.`);
  }
  if (!value.id || !value.path) throw new Error('Document ID and path must not be empty.');
  if ((value.id as string).length > 512 || (value.path as string).length > 4096) {
    throw new Error('Document metadata exceeds the size limit.');
  }
  if (value.language !== undefined && (typeof value.language !== 'string' || !/^[a-z0-9+-]{1,40}$/i.test(value.language))) {
    throw new Error('Invalid language identifier.');
  }
  for (const key of ['oldText', 'newText']) {
    const text = value[key] as string;
    if (text.length > 1_000_000 || text.split('\n').length > 10_000) {
      throw new Error('File exceeds the preview limit (1M characters / 10,000 lines per side).');
    }
    if (text.includes('\0')) throw new Error('Binary content cannot be previewed.');
    if (text.split('\n').some(line => line.length > 10_000)) throw new Error('A line exceeds the 10,000 character limit.');
  }
  return value as unknown as DiffDocument;
}
export function validateOptions(input: unknown): DiffOptions {
  if (!input || typeof input !== 'object') throw new Error('Expected display options.');
  const value = input as DiffOptions;
  if (!['unified', 'split'].includes(value.layout) || !['light', 'dark'].includes(value.theme)) {
    throw new Error('Invalid display options.');
  }
  if (value.chrome !== undefined && !['full', 'none'].includes(value.chrome)) {
    throw new Error('Invalid display chrome.');
  }
  return { layout: value.layout, theme: value.theme, chrome: value.chrome ?? 'full' };
}
