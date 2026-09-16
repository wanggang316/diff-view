# Diff View

An independent, read-only code diff component for browser hosts and native macOS applications. The Web renderer is bundled locally and embedded by a Swift package using `WKWebView`. No Git executable, network service, Codans model, or repository access is required.

**Status:** initial implementation and integration prototype. Not integrated into Codans. Large-file virtualization, search UI, context expansion, and a published release are not implemented.

## Run

Requires Node.js 22+, npm, and Swift 6 / macOS 14+ for the native host.

```bash
npm ci
npm run build
npm run dev
```

Open `http://127.0.0.1:4173/demo.html`. The server is a browser development convenience; the native component loads bundled files without a server.

```bash
swift run diff-view-demo
```

Build the Web resources before building Swift. Generated resources are not committed; a source checkout needs the npm build step. A future release must ship verified, reproducible resources in its source distribution.

## Documents

- [Technical design and Codans integration](docs/design.md)
- [Native package and demo](docs/native.md)
- [Verification record](docs/verification.md)

## Browser API

Load the built `dist/index.html` in an isolated frame/WebView. There is one viewer per document. The build uses classic bundled scripts, relative CSS, and no CDN or worker dependency.

```javascript
window.addEventListener('diff-view', ({ detail }) => {
  if (detail.type === 'openFile') {
    console.log(detail.documentID, detail.path, detail.side, detail.line);
  }
});
window.diffView.render({
  id: 'snapshot-42:src/main.swift',
  path: 'src/main.swift',
  language: 'swift',
  oldText: 'let value = 1\n',
  newText: 'let value = 2\n'
}, { layout: 'split', theme: 'dark' });
```

Wait for `ready` in native hosts; browser listeners that need this event must be registered before loading the bundle. The independent demo loads its sample after the renderer script.

`render` replaces the current document. A bad request clears the previous preview and emits `error`. `dispose` removes owned DOM event listeners and permanently disables that renderer instance. Theme/layout changes currently re-render and reset selection/scroll.

The Swift wrapper preserves Web toolbar layout/theme choices when only the document changes. Changed host options override those choices. Recreating the native view starts with the host options again.

## Verify

```bash
npm test
npm run build
npx playwright install webkit
npm run test:browser
swift test
swift run diff-view-demo --smoke-test
swift run diff-view-demo --layout-smoke-test
swift run diff-view-demo --lifecycle-smoke-test
```

The component never opens an editor itself. Native/browser hosts resolve `openFile` events to their editor service. The old side represents historical content; hosts must not reinterpret it as a current-file line number.

## Dependencies

`diff2html` renders the diff and provides syntax highlighting; `diff` computes bounded text diffs. Exact versions are recorded in `package-lock.json`. See [third-party notices](THIRD_PARTY_NOTICES.md). No project license has been selected yet; this prototype is not published.

## Embed a pinned source snapshot

```bash
npm ci
npm run build
node scripts/export-swift-package.mjs /path/to/host/ThirdParty/DiffViewKit
```

The export includes Swift source, generated Web assets, third-party notices, and an upstream revision record. Consumers can use a local Swift package without a runtime path dependency on this repository. Commit source changes before exporting so the recorded revision identifies the inputs.
