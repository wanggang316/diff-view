import Foundation
import Testing
@testable import DiffViewKit

@Test @MainActor
func readinessTimeoutDoesNotRequireNavigationCompletion() async {
    var events: [DiffEvent] = []
    let coordinator = DiffView.Coordinator(document: document, options: .init()) { events.append($0) }
    coordinator.startReadyWatchdog(timeout: .milliseconds(1))
    await coordinator.readinessTask?.value
    #expect(events.count == 1)
    #expect(events.first?.type == "error")
    #expect(events.first?.documentID == document.id)
}

@Test @MainActor
func removedViewCannotEmitLateReadinessFailure() async {
    var events: [DiffEvent] = []
    let coordinator = DiffView.Coordinator(document: document, options: .init()) { events.append($0) }
    coordinator.startReadyWatchdog(timeout: .milliseconds(1))
    coordinator.disposed = true
    coordinator.readinessTask?.cancel()
    await coordinator.readinessTask?.value
    #expect(events.isEmpty)
}
