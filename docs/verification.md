# Verification

Date: 2026-09-17. Environment: macOS arm64, Swift 6.2, Node.js 22.19.0.

## Executed

- `npm test`: 5 tests passed. Covers source-path language inference, malformed/oversized/binary inputs, unusual file paths, addition/deletion line numbers, and computation-budget refusal.
- `npm run build`: TypeScript strict checking and local resource bundling passed.
- `npm run test:browser`: 4 WebKit tests passed. Covers split/unified rendering, implicit Swift/JavaScript/TypeScript/Python/Go syntax highlighting, new-side line callbacks, layout preservation on document refresh, explicit host-option changes, hostile source/path escaping, preview-error recovery, and 480px layout.
- `swift test`: 5 Swift Testing cases passed. Covers structured payload preservation, bridge version/document/path/line validation, readiness timeout without navigation completion, and cancellation after disposal.
- `swift run diff-view-demo --smoke-test`: passed using a real WKWebView with bundled resources. Observed ready, rendered, source text in DOM, and openFile callback from the actual file-open button.
- `swift run diff-view-demo --layout-smoke-test`: passed. Real NSHostingView updates preserve Split for changed content and a new document; changed host options override it.
- `swift run diff-view-demo --lifecycle-smoke-test`: passed. Twenty renderer removals and recreations inside nested HSplitViews retain valid events, DOM content, and native bounds.
- Screenshot review: browser narrow and desktop captures under ignored `test-results/`.

## Codans host verification

Codans embeds code snapshot `5df58273a300e247491aeafede9d237e84b5d716`. Its local GUI core cases passed: Changes scopes and Outgoing, file-type handling, refresh, current-file launching in Cursor at line 4, focus behavior, and error recovery. The host repository maintains the case record at `docs/user-tests/git-diff-viewer.md`.

Final host GUI checks passed at 900px in normal and expanded modes and at wide-window zoom. Expansion hides the sidebar; Collapse restores the sidebar and terminal; Show Sidebar exits expansion. The Outgoing body was verified to show the branch contribution. The final host test run passed 26 app tests and 6 CodansCore tests. Real SSH and live-PR GUI cases have not run; local fixture results do not establish those integrations. Git access, comparison semantics, and editor launching remain Codans responsibilities.

## Limits

The standalone checks and host GUI cases do not measure sustained scrolling performance, VoiceOver quality, long-running memory behavior, or all macOS 14 runtime differences. Render limits are enforced, but total rendering latency is not yet benchmarked. A browser/native window must be brought to the foreground for visual and accessibility inspection; obscured WebKit content may suspend painting despite successful native bridge events.

Generated assets, test screenshots, Swift build output, and node_modules are ignored. Reproduce the resource bundle with `npm ci && npm run build` before building Swift.
