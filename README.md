# Diff View

An independent, read-only code diff component for browser hosts and native macOS applications. The Web renderer is bundled locally and embedded by a Swift package using `WKWebView`. No Git executable, network service, Codans model, or repository access is required.

**Status:** implemented and consumed by Codans as a Swift package pinned to a release tag. Codans owns Git reads, comparison selection, and editor launching; this component remains independent. Large-file virtualization, search UI, and context expansion are not implemented. See [verification](docs/verification.md) for tested flows and remaining limits.

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

The generated Web resources in `Sources/DiffViewKit/Resources/Web` are committed, so a Swift package checkout builds without npm. The build is reproducible: commit rebuilt resources together with every source change, and `npm run check:resources` fails when the committed resources differ from a fresh build.

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

`diff2html` renders the diff and provides syntax highlighting; `diff` computes bounded text diffs. Exact versions are recorded in `package-lock.json`. See [third-party notices](THIRD_PARTY_NOTICES.md). No project license has been selected yet.

## Use from a Swift package

```swift
.package(url: "https://github.com/wanggang316/diff-view", exact: "0.1.0")
// target dependency
.product(name: "DiffViewKit", package: "diff-view")
```

A tag pins both the Swift source and the generated Web resources. Before tagging, run `npm run check:resources` so the tagged resources match the tagged source.

Hosts that prefer a vendored copy can export a pinned snapshot instead:

```bash
npm ci
npm run build
node scripts/export-swift-package.mjs /path/to/host/ThirdParty/DiffViewKit
```

The export includes Swift source, generated Web assets, third-party notices, and an upstream revision record. Consumers can use a local Swift package without a runtime path dependency on this repository. Commit source changes before exporting so the recorded revision identifies the inputs.

Native hosts can pass `chrome: "none"` to render code edge-to-edge with no Web toolbar, context bar, or footer. The default `"full"` retains standalone controls. Editor requests come from line-number double-clicks; no file-open button is rendered.
