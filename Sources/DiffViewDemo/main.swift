import AppKit
import DiffViewKit
import SwiftUI
import WebKit

@MainActor
final class DemoDelegate: NSObject, NSApplicationDelegate {
    var window: NSWindow?
    let layoutSmokeTest = CommandLine.arguments.contains("--layout-smoke-test")
    var smokeTest: Bool { layoutSmokeTest || CommandLine.arguments.contains("--smoke-test") }
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
        window.contentView = NSHostingView(rootView: content)
        window.center()
        window.makeKeyAndOrderFront(nil)
        self.window = window
        NSApp.activate(ignoringOtherApps: true)
        if smokeTest {
            Task {
                try? await Task.sleep(for: .seconds(15))
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
                    do { _ = try await webView.evaluateJavaScript("document.querySelector('#open').click()") }
                    catch { self.finish(success: false, message: error.localizedDescription) }
                }
            }
        }
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
