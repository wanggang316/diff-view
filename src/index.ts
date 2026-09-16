import { Diff2HtmlUI } from 'diff2html/lib/ui/js/diff2html-ui-slim';
import { ColorSchemeType } from 'diff2html/lib/types';
import { makeDiff } from './patch';
import { defaultOptions, validateDocument, validateOptions, type DiffDocument, type DiffEvent, type DiffOptions } from './protocol';
import 'diff2html/bundles/css/diff2html.min.css';
import './style.css';

declare global {
  interface Window {
    diffView: { render(document: unknown, options?: unknown): void; dispose(): void };
    webkit?: { messageHandlers?: { diffView?: { postMessage(event: DiffEvent): void } } };
  }
}
const root = document.querySelector<HTMLElement>('#app')!;
root.innerHTML = `<header class="toolbar"><div class="identity"><span class="mark">±</span><span id="path">Diff View</span><span class="badge">READ ONLY</span></div><div class="controls"><button id="unified" type="button">Unified</button><button id="split" type="button">Split</button><button id="theme" type="button" aria-label="Toggle color theme">◐</button></div></header><div class="context"><span id="summary">Waiting for a document</span><span>Double-click a line number to open in editor</span></div><main id="diff" tabindex="0" aria-label="Code differences"></main><footer><span id="status" role="status" aria-live="polite">Ready</span><button id="open" type="button" disabled>Open file ↗</button></footer>`;
const target = document.querySelector<HTMLElement>('#diff')!;
let current: DiffDocument | undefined;
let options = { ...defaultOptions };
let disposed = false;
const listeners = new AbortController();
function emit(event: Omit<DiffEvent, 'version'>) {
  const message: DiffEvent = { version: 1, ...event };
  window.webkit?.messageHandlers?.diffView?.postMessage(message);
  window.dispatchEvent(new CustomEvent('diff-view', { detail: message }));
}
function label(selector: string, text: string) { document.querySelector(selector)!.textContent = text; }
function requestOpen(side: 'old' | 'new', line?: number) {
  if (!current) return;
  emit({ type: 'openFile', documentID: current.id, path: current.path, side, ...(line ? { line } : {}) });
  label('#status', `Requested editor · ${side}${line ? `:${line}` : ''}`);
}
function render(input: unknown, display: unknown = options) {
  if (disposed) return;
  current = undefined;
  (document.querySelector('#open') as HTMLButtonElement).disabled = true;
  label('#path', 'Diff View');
  label('#summary', '');
  try {
    const next = validateDocument(input);
    options = validateOptions(display);
    const files = makeDiff(next);
    document.documentElement.dataset.theme = options.theme;
    for (const mode of ['unified', 'split']) document.querySelector(`#${mode}`)!.setAttribute('aria-pressed', String(options.layout === mode));
    target.replaceChildren();
    if (next.oldText === next.newText) {
      const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = 'No content changes'; target.append(empty);
    } else {
      const ui = new Diff2HtmlUI(target, files, {
        drawFileList: false, outputFormat: options.layout === 'split' ? 'side-by-side' : 'line-by-line',
        matching: 'none', highlight: true, synchronisedScroll: true,
        colorScheme: options.theme === 'dark' ? ColorSchemeType.DARK : ColorSchemeType.LIGHT,
      });
      ui.draw();
    }
    current = next;
    label('#path', next.path);
    label('#summary', `${files.reduce((n, f) => n + f.addedLines, 0)} additions · ${files.reduce((n, f) => n + f.deletedLines, 0)} deletions`);
    label('#status', 'Offline · Select and copy code');
    (document.querySelector('#open') as HTMLButtonElement).disabled = false;
    emit({ type: 'rendered', documentID: next.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to render diff.';
    target.replaceChildren();
    const failure = document.createElement('p'); failure.className = 'empty'; failure.textContent = message; target.append(failure);
    label('#status', 'Preview unavailable');
    const documentID = input && typeof input === 'object' && 'id' in input && typeof input.id === 'string' ? input.id : undefined;
    emit({ type: 'error', documentID, message });
  }
}
for (const layout of ['unified', 'split'] as const) document.querySelector(`#${layout}`)!.addEventListener('click', () => { if (current) render(current, { ...options, layout }); }, { signal: listeners.signal });
document.querySelector('#theme')!.addEventListener('click', () => { if (current) render(current, { ...options, theme: options.theme === 'dark' ? 'light' : 'dark' }); }, { signal: listeners.signal });
document.querySelector('#open')!.addEventListener('click', () => requestOpen('new'), { signal: listeners.signal });
target.addEventListener('dblclick', event => {
  if (!(event.target instanceof Element)) return;
  const cell = event.target.closest('.d2h-code-linenumber, .d2h-code-side-linenumber');
  if (!cell) return;
  let side: 'old' | 'new'; let raw: string | null;
  if (options.layout === 'unified') {
    const explicit = event.target.closest('.line-num1, .line-num2');
    side = explicit?.classList.contains('line-num1') ? 'old' : 'new';
    raw = (explicit ?? cell.querySelector('.line-num2'))?.textContent ?? null;
  } else {
    const wrapper = cell.closest('.d2h-file-side-diff');
    side = wrapper === wrapper?.parentElement?.querySelector('.d2h-file-side-diff') ? 'old' : 'new';
    raw = cell.textContent;
  }
  const line = Number(raw?.trim());
  if (Number.isInteger(line) && line > 0) requestOpen(side, line);
}, { signal: listeners.signal });
window.diffView = { render, dispose() { disposed = true; current = undefined; listeners.abort(); target.replaceChildren(); } };
emit({ type: 'ready' });
