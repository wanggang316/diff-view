# Verification

Date: 2026-09-17. Environment: macOS arm64, Swift 6.2, Node.js 22.19.0.

## Executed

- `npm test`: 4 tests passed. Covers malformed/oversized/binary inputs, unusual file paths, addition/deletion line numbers, and computation-budget refusal.
- `npm run build`: TypeScript strict checking and local resource bundling passed.
- `npm run test:browser`: WebKit browser tests cover split/unified rendering, syntax tokens, new-side line callbacks, theme changes, hostile source/path escaping, preview-error recovery, and 480px layout. A test locator was corrected to allow whitespace around split-view line numbers.
- `swift test`: 3 Swift Testing cases passed. Covers structured payload preservation and bridge version/document/path/line validation.
- `swift run diff-view-demo --smoke-test`: passed using a real WKWebView with bundled resources. Observed ready, rendered, source text in DOM, and openFile callback from the actual file-open button.
- Screenshot review: browser narrow and desktop captures under ignored `test-results/`.

## Limits

These checks establish the standalone prototype, not Codans integration. Native smoke checks do not measure scrolling performance, VoiceOver quality, long-running memory behavior, all macOS 14 runtime differences, or editor launching. There is no Git provider or remote editor integration here. Render limits are enforced, but total rendering latency is not yet benchmarked.

Generated assets, test screenshots, Swift build output, and node_modules are ignored. Reproduce the resource bundle with `npm ci && npm run build` before building Swift.
