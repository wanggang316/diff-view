# Native macOS host

Status: standalone prototype. No Codans integration or editor process launching is included.

`DiffViewKit` is a Swift 6 package for macOS 14 and later. It exposes a SwiftUI
`DiffView` backed by WKWebView. Web assets are copied into the SwiftPM resource
bundle; the host requires no HTTP server or network service.

```swift
import DiffViewKit

DiffView(
    document: DiffDocument(
        id: "comparison-sha:file-path",
        path: "Sources/Example.swift",
        oldText: oldSource,
        newText: newSource,
        language: "swift"
    ),
    options: DiffOptions(layout: "unified", theme: "dark")
) { event in
    if event.type == "openFile" {
        // Resolve this validated request through the host's editor service.
    }
}
```

Use a new document ID whenever the source snapshot changes. The host owns Git
comparison semantics, source acquisition, file existence checks, remote paths,
and editor capabilities. An old-side request refers to historical content and
must not be assumed to map to the current working file. Even new-side positions
can be stale when the working tree differs from the rendered snapshot.

The native bridge uses protocol version 1. Main-frame messages must originate
from the bundled index page. `openFile` events must match the current document ID
and exact path and identify `old` or `new`. A supplied line number must be positive
and within that source; an absent line requests opening the file without a position.
Events do not directly cause filesystem or process operations.
Unknown protocol versions and invalid events are ignored. Native loading and
JavaScript errors are reported as `error` events.

Updates before `ready` retain only the latest document/options. Calls pass source
as structured JavaScript arguments rather than interpolated executable strings.
Host navigation is restricted to the bundled index. The web page's Content
Security Policy controls subresource loading. Dismantling the view removes its
message handler and navigation delegate; a terminated web process reports an
error and requires the host to recreate the view.

Build the web bundle before using SwiftPM:

```bash
npm ci
npm run build
swift test
swift run diff-view-demo
swift run diff-view-demo --smoke-test
```

The smoke test starts a real macOS window, verifies `ready` then `rendered`
through the native bridge, checks rendered source text in the DOM, clicks the
file-open button to validate its native callback, and exits
within 15 seconds. It requires an active macOS graphical session. Unit tests
cover bridge identity, version, path and line validation. They do not replace
visual QA, editor integration tests, or large-file performance measurement.
