import AppKit
import DiffViewKit
import SwiftUI
import WebKit

@MainActor
final class DemoDelegate: NSObject, NSApplicationDelegate {
    var window: NSWindow?
    let smokeTest = CommandLine.arguments.contains("--smoke-test")
    var finished = false
    var receivedReady = false
    var checkedDOM = false
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
        guard smokeTest else { return }
        if event.type == "error" { finish(success: false, message: event.message ?? "Unknown error") }
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
