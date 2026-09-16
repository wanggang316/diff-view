const sample = {
  id: 'worktree-service:1', path: 'Sources/WorktreeService.swift', language: 'swift',
  oldText: 'import Foundation\n\nstruct WorktreeService {\n    func refresh() async throws -> [Worktree] {\n        return try await repository.worktrees()\n    }\n}\n',
  newText: 'import Foundation\n\nstruct WorktreeService {\n    private let cache: WorktreeCache\n\n    func refresh() async throws -> [Worktree] {\n        let worktrees = try await repository.worktrees()\n        await cache.replace(with: worktrees)\n        return worktrees\n    }\n}\n',
};
window.diffView.render(sample, { layout: 'split', theme: 'dark' });
