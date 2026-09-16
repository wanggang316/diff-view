import Foundation
import Testing
@testable import DiffViewKit

let document = DiffDocument(id: "revision-1", path: "src/example.swift", oldText: "old\n", newText: "first\nsecond\n")

@Test func validatesEditorRequestsAgainstCurrentSource() {
    #expect(DiffEvent(type: "openFile", documentID: document.id, path: document.path, side: "new").isValid(for: document))
    #expect(DiffEvent(type: "openFile", documentID: document.id, path: document.path, side: "new", line: 2).isValid(for: document))
    #expect(!DiffEvent(type: "openFile", documentID: document.id, path: document.path, side: "new", line: 3).isValid(for: document))
    #expect(!DiffEvent(type: "openFile", documentID: document.id, path: document.path, side: "old", line: 2).isValid(for: document))
    #expect(!DiffEvent(type: "openFile", documentID: document.id, path: document.path, side: "new", line: 0).isValid(for: document))
    #expect(!DiffEvent(type: "openFile", documentID: document.id, path: "/etc/passwd", side: "new", line: 1).isValid(for: document))
    #expect(!DiffEvent(type: "openFile", documentID: "stale", path: document.path, side: "new", line: 1).isValid(for: document))
}

@Test func rejectsUnknownProtocolAndStaleRenders() {
    #expect(!DiffEvent(version: 2, type: "ready").isValid(for: document))
    #expect(!DiffEvent(type: "execute").isValid(for: document))
    #expect(!DiffEvent(type: "rendered", documentID: "stale").isValid(for: document))
    #expect(DiffEvent(type: "rendered", documentID: document.id).isValid(for: document))
    #expect(!DiffEvent(type: "openFile", documentID: document.id, path: document.path, side: "new", line: 1)
        .isValid(for: DiffDocument(id: document.id, path: document.path, oldText: "", newText: "")))
}

@Test func bridgePayloadPreservesSourceText() throws {
    let original = DiffDocument(id: "unicode", path: "space file.swift", oldText: "</script>\n", newText: "\\\"${value} 中文\n")
    #expect(try JSONDecoder().decode(DiffDocument.self, from: JSONEncoder().encode(original)) == original)
}
