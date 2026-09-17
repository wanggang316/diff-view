import AppKit
import DiffViewKit
import SwiftUI
import WebKit

@MainActor
struct LifecycleHost: View {
    var document: DiffDocument?
    var onEvent: @MainActor (DiffEvent) -> Void
    var body: some View {
        HSplitView {
            Text("Terminal").frame(minWidth: 220, maxWidth: .infinity, maxHeight: .infinity)
            VStack {
                Text("Changes / Outgoing")
                HSplitView {
                    List { Text("Demo.swift"); Text("binary.bin") }
                        .frame(minWidth: 150, idealWidth: 200, maxWidth: 330)
                    Group {
                        if let document {
                            DiffView(document: document, onEvent: onEvent).id(0)
                        } else {
                            ProgressView("Loading file…")
                        }
                    }.frame(minWidth: 250, maxWidth: .infinity, maxHeight: .infinity)
                }
            }.frame(minWidth: 440, idealWidth: 700, maxWidth: .infinity)
        }
    }
}

@MainActor
final class DemoDelegate: NSObject, NSApplicationDelegate {
    var window: NSWindow?
    let layoutSmokeTest = CommandLine.arguments.contains("--layout-smoke-test")
    let lifecycleSmokeTest = CommandLine.arguments.contains("--lifecycle-smoke-test")
    var smokeTest: Bool { lifecycleSmokeTest || layoutSmokeTest || CommandLine.arguments.contains("--smoke-test") }
    var finished = false
    var receivedReady = false
    var checkedDOM = false
    var layoutSmokeStarted = false
    var lastRenderedID: String?
    let sample = DiffDocument(
        id: "sample-1", path: "Sources/Greeting.swift",
        oldText: "func greeting() -> String {\n    return \"Hello\"\n}\n",
        newText: "func greeting(name: String) -> String {\n    return \"Hello, \\(name)!\"\n}\n",
        language: "swift"
    )

    func applicationDidFinishLaunching(_ notification: Notification) {
        let content = DiffView(document: sample) { [weak self] event in self?.handle(event) }
        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1100, height: 720),
                              styleMask: [.titled, .closable, .resizable, .miniaturizable],
                              backing: .buffered, defer: false)
        window.title = "Diff View — Native Host"
        if lifecycleSmokeTest {
            window.contentView = NSHostingView(rootView: LifecycleHost(document: sample) { [weak self] event in self?.handle(event) })
        } else {
            window.contentView = NSHostingView(rootView: content)
        }
        window.center()
        window.makeKeyAndOrderFront(nil)
        self.window = window
        NSApp.activate(ignoringOtherApps: true)
        if smokeTest {
            Task {
                try? await Task.sleep(for: .seconds(lifecycleSmokeTest ? 60 : 15))
                if !finished { finish(success: false, message: "Timed out waiting for the native bridge.") }
            }
        }
    }

    func handle(_ event: DiffEvent) {
        print("Diff event: \(event.type) \(event.documentID ?? "") \(event.message ?? "")")
        if event.type == "ready" { receivedReady = true }
        if event.type == "rendered" { lastRenderedID = event.documentID }
        guard smokeTest else { return }
        if event.type == "error" { finish(success: false, message: event.message ?? "Unknown error") }
        if lifecycleSmokeTest {
            if event.type == "rendered", !layoutSmokeStarted {
                layoutSmokeStarted = true
                Task {
                    do { try await verifyLifecycle() }
                    catch { finish(success: false, message: error.localizedDescription) }
                }
            }
            return
        }
        if layoutSmokeTest {
            if event.type == "rendered", !layoutSmokeStarted {
                layoutSmokeStarted = true
                Task {
                    do { try await verifyLayoutUpdates() }
                    catch { finish(success: false, message: error.localizedDescription) }
                }
            }
            return
        }
        if event.type == "openFile" {
            finish(success: checkedDOM && event.documentID == sample.id && event.path == sample.path,
                   message: "Bundled page rendered source text and delivered ready/rendered/openFile events.")
        }
        if event.type == "rendered" {
            guard receivedReady, let content = window?.contentView, let webView = findWebView(content) else {
                finish(success: false, message: "Missing ready event or WKWebView.")
                return
            }
            webView.evaluateJavaScript("document.body.innerText.includes('greeting')") { [weak self] result, error in
                Task { @MainActor in
                    guard let self else { return }
                    guard error == nil, result as? Bool == true else {
                        self.finish(success: false, message: error?.localizedDescription ?? "Missing source text in DOM.")
                        return
                    }
                    self.checkedDOM = true
                    do { _ = try await webView.evaluateJavaScript("Array.from(document.querySelectorAll('.line-num2')).find(el => Number(el.textContent.trim()) > 0).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))") }
                    catch { self.finish(success: false, message: error.localizedDescription) }
                }
            }
        }
    }

    func verifyLifecycle() async throws {
        guard let hosting = window?.contentView as? NSHostingView<LifecycleHost> else { return }
        print("Initial host bounds \(hosting.bounds), web \(String(describing: findWebView(hosting)?.bounds))")
        for index in 2...21 {
            hosting.rootView = LifecycleHost(document: nil) { [weak self] event in self?.handle(event) }
            try await Task.sleep(for: .milliseconds(120))
            guard findWebView(hosting) == nil else {
                finish(success: false, message: "The loading branch did not remove the previous WKWebView.")
                return
            }
            var updated = sample
            updated.id = "remount-\(index)"
            updated.newText += "// Remount \(index)\n"
            hosting.rootView = LifecycleHost(document: updated) { [weak self] event in self?.handle(event) }
            guard await waitForRender(updated.id), let webView = findWebView(hosting) else {
                finish(success: false, message: "Remount \(index) did not render. Native tree: \(hosting.subviews)")
                return
            }
            let valid = try await webView.evaluateJavaScript("document.body.innerText.includes('Remount \(index)')") as? Bool == true
            try await Task.sleep(for: .milliseconds(200))
            hosting.layoutSubtreeIfNeeded()
            guard valid, webView.bounds.width > 100, webView.bounds.height > 100 else {
                finish(success: false, message: "Remount \(index) has missing DOM or invalid bounds \(webView.bounds).")
                return
            }
            print("Remount \(index) bounds \(webView.bounds)")
        }
        finish(success: true, message: "Twenty DiffView removals and recreations rendered inside nested HSplitViews.")
    }

    func verifyLayoutUpdates() async throws {
        guard receivedReady, let hosting = window?.contentView as? NSHostingView<DiffView>,
              let webView = findWebView(hosting) else {
            finish(success: false, message: "Missing native host or ready event.")
            return
        }
        _ = try await webView.evaluateJavaScript("document.querySelector('#split').click()")
        for index in 2...3 {
            var updated = sample
            updated.id = "sample-\(index)"
            if index == 3 { updated.path = "Sources/Another.swift" }
            updated.newText += "// Updated \(index)\n"
            hosting.rootView = DiffView(document: updated) { [weak self] event in self?.handle(event) }
            guard await waitForRender(updated.id),
                  try await webView.evaluateJavaScript("document.querySelectorAll('.d2h-file-side-diff').length === 2") as? Bool == true else {
                finish(success: false, message: "Document update reset the user's split layout.")
                return
            }
        }
        var updated = sample
        updated.id = "host-options"
        hosting.rootView = DiffView(document: updated, options: .init(layout: "unified", theme: "light")) {
            [weak self] event in self?.handle(event)
        }
        let rendered = await waitForRender(updated.id)
        let applied = try await webView.evaluateJavaScript(
            "document.querySelectorAll('.d2h-file-side-diff').length === 0 && document.documentElement.dataset.theme === 'light'"
        ) as? Bool == true
        finish(success: rendered && applied, message: "Native document updates preserve Split; host option changes override it.")
    }

    func waitForRender(_ id: String) async -> Bool {
        for _ in 0..<200 {
            if lastRenderedID == id { return true }
            try? await Task.sleep(for: .milliseconds(20))
        }
        return false
    }

    func findWebView(_ view: NSView) -> WKWebView? {
        if let webView = view as? WKWebView { return webView }
        return view.subviews.lazy.compactMap { self.findWebView($0) }.first
    }

    func finish(success: Bool, message: String) {
        guard !finished else { return }
        finished = true
        print("\(success ? "PASS" : "FAIL"): \(message)")
        exit(success ? 0 : 1)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}

let application = NSApplication.shared
let delegate = DemoDelegate()
application.delegate = delegate
application.setActivationPolicy(.regular)
application.run()
