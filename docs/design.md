# Independent Diff View

Status: component implemented and integrated into Codans through a vendored Swift-package snapshot. Local GUI core flows are verified; live SSH and live-PR GUI verification remain outstanding.

## Scope

Provide a reusable, read-only technical component that accepts two text snapshots and renders their differences. Browser and macOS applications can embed it independently of Codans. The macOS adapter uses WKWebView; the Web implementation owns code presentation only.

The host owns repository selection, Changes/Outgoing mode, comparison-base resolution, file inventory, Git reads, fetching, refresh policy, and editor dispatch. The component owns unified/split presentation, line numbers, text selection, syntax highlighting, theme, and line-opening intent.

No staging, unstaging, discard, commit, push, merge resolution, or implicit editor execution is included. Binary, metadata-only, submodule, and conflict presentation belong to the host. The renderer reports equal texts as no content changes; it cannot infer a rename or mode change from equal texts.

## Architecture

```text
Host application
  Git / file provider -> comparison snapshot -> selected file texts
  Editor service      <- validated openFile intent
                              |
                  DiffViewKit (Swift package)
                  WKWebView / typed bridge
                              |
                     Offline Web bundle
                   protocol validation + UI
                              |
                  jsdiff -> diff2html renderer
```

The Web bundle is independently usable. DiffViewKit is a transport/lifecycle adapter, not a Git client. No Swift type refers to Project, Worktree, Pane, or CodansCore. Codans must not move its domain selection or Git subprocess execution into this package.

## Renderer choice

| Candidate | Fit | Tradeoff |
|---|---|---|
| diff2html + jsdiff (selected) | Read-only unified/split diff and syntax highlighting; local classic bundle | DOM-based rendering needs limits; no large-file virtualization or editor-grade search |
| Monaco Diff Editor | Rich navigation, editor features, advanced large-document behavior | Larger integration and Web Worker/resource-origin complexity in an offline WKWebView |
| Custom native renderer | AppKit text interactions | Additional line mapping, paired scrolling, highlighting, and layout implementation |

The renderer is behind a stable document/event protocol so a later Monaco implementation does not require a new Git integration. Replacing it still requires native lifecycle, CSP, offline-worker, line mapping, and performance revalidation.

## Input and event contract

`render(document, options)` replaces one file. The host chooses a unique document ID that includes comparison generation and file identity. The same ID must not be reused for different snapshots.

| Field | Meaning |
|---|---|
| id | Opaque snapshot/file identity, 1–512 characters |
| path | Display and editor-intent path, 1–4096 characters; not a filesystem capability |
| oldText / newText | UTF-8-decoded text snapshots; an absent side is represented by an empty string |
| language | Optional highlighting language identifier; unsupported languages may remain plain text |
| layout | unified or split |
| theme | light or dark |

Events have `version: 1` and type `ready`, `rendered`, `openFile`, or `error`. `openFile` includes documentID, path, side (old/new), and an optional positive, one-based line. The file-open button sends no line. Double-clicking a line number includes its side-specific line.

A native host validates message origin, version, current document identity, matching path, side, and line bounds. The component does not treat a path from JavaScript as permission to read or open arbitrary files. The host additionally resolves it against the original file record and execution host.

Errors clear the preview instead of retaining unrelated prior content. The initial render API is synchronous and emits completion only after rendering; it is not an asynchronous Git load completion. The native bridge queues the latest input until `ready` and handles teardown/process failures.

## Offline packaging and security

The npm build creates classic IIFE JavaScript, CSS, and an HTML entrypoint, then copies production assets into Swift package resources. No module-loader, CDN, local HTTP listener, or Web Worker is needed at native runtime. WKWebView reads only its bundled Web directory.

CSP denies connections, images, fonts, frames, forms, and external scripts. Styles permit inline declarations required by the renderer. Native navigation must remain at the trusted local entrypoint. Source text is rendered through the dependency's escaped templates; source paths use textContent or escaped data, never interpolated JavaScript. Native-to-Web calls use `callAsyncJavaScript` arguments.

Patch headers use fixed synthetic names. Real file paths are attached after parsing; tabs, newlines, quotes, and strings resembling patch headers cannot change parser structure.

Limits are per side: 1,000,000 JavaScript UTF-16 code units, 10,000 lines, no NUL byte, and 10,000 characters per line. Diff computation has a 200 ms algorithm budget and an edit-distance cap of 4,000; the rendered result is limited to 4,000 lines. These are prototype bounds, not latency guarantees: parsing, highlighting, and DOM work add time. Errors must say the preview is unavailable rather than silently truncate it.

## Codans integration

### Comparison semantics

| Host mode | Endpoints |
|---|---|
| Changes / All | HEAD -> working directory; include untracked files separately |
| Changes / Staged | HEAD -> index |
| Changes / Unstaged | Index -> working directory; include untracked files separately |
| Outgoing | merge-base(selected base, HEAD) -> HEAD |

Outgoing means all committed branch changes relative to main or the PR target, not unpushed commits. Push does not clear it. Uncommitted modifications remain in Changes. Base priority is explicit user selection, PR target, then repository remote default branch; unresolved references require an explicit selection/error state.

Codans shows the actual comparison base and reads local refs on ordinary refresh. Fetching remote refs remains an external Git operation; there is no Fetch & Refresh action in the current panel. An offline or missing target is not an empty diff. Fork PR targets require mapping target repository plus branch to an available local ref; never assume origin is the base repository.

### Data integration

Codans uses GitService / LiveGitService / CommandRunner, including the existing SSH routing, for typed comparison resolution and scope-aware file summaries. Outgoing endpoints resolve to immutable SHAs before files are listed and read. Summary and text acquisition use the same comparison scope.

Codans reads the chosen file's old/new blob or working contents on demand. An untracked file has an empty old side. An unborn HEAD has an explicit empty-tree baseline. File status is independent of content difference. Git can classify content as binary via attributes even without NUL bytes; the host handles that before invoking this text renderer. The current host shows a symlink-change notice and rejects working-file reads through symlinks.

For reproducible Git semantics, host reads must document encoding, line-ending and filter treatment. jsdiff recomputes a presentation diff from supplied texts and is not guaranteed to reproduce Git's algorithm, hunk grouping, whitespace handling, or rename decisions. Rename/status/summary truth remains with Git. Exact Git patch rendering is a possible future input type, not implemented in this prototype.

### UI and lifecycle

Codans embeds the component in a resizable right-side panel with an expanded reading mode. It owns Changes/Outgoing tabs and the file list and keeps a stable renderer instance while loading or displaying notices. Terminal sessions retain their ownership; closing the panel restores terminal focus. Existing external Git-client commands remain separate.

Host generation tokens reject late worktree, file, scope, and base results. Committed content uses immutable Git object IDs; mutable working content is read again when refreshed.

The visible host panel refreshes local Git state every two seconds and supports manual refresh. It does not fetch remote refs automatically. A working-directory read is not an atomic repository snapshot. The component has no polling system of its own.

The host remembers selected file, comparison scope, and base per worktree for the application session. Scroll/selection restoration across document updates is a future component API; current re-render resets both.

### Editor jump semantics

An event reports where the user clicked in the supplied snapshot. It does not claim that the same line exists in today's working file. Codans maps new-side positions when its working content matches the snapshot. Outgoing and staged requests open the current file without a line because their text may differ from the working file. Old-side and deleted-file requests report unavailability rather than fabricating a current position.

Codans DiffEditorClient and EditorService own configured-editor resolution, file/line launching, path validation, and remote-host routing. DiffViewKit has no editor-specific command formats.

## Delivery stages

1. Independent prototype: protocol, bounded renderer, browser demo, offline WKWebView wrapper, native demo, adversarial input tests, native bridge smoke test.
2. Component hardening: measured large-file behavior, cancellation strategy if computation becomes asynchronous, context expansion, search, selection/scroll restoration, accessibility audit, reproducible resource release packaging.
3. Codans integration: Git comparison APIs, side panel, file inventory, refresh invalidation, revision-aware editor jumping, end-to-end local/SSH acceptance tests.

Stage 1 and the Codans local integration are implemented. Codans consumes code snapshot `5df58273a300e247491aeafede9d237e84b5d716`; documentation-only commits do not change that pin. Stage 2 remains future work. Local GUI core cases and final 900px / wide-window layout cases have passed, including expanded-sidebar hiding and restoration. Live SSH / live-PR GUI cases have not run. The host repository records its acceptance cases in `docs/user-tests/git-diff-viewer.md`.

## Acceptance criteria

- Browser and native demos render without runtime network dependencies.
- Unified and split modes agree on side-specific line numbers.
- Text and hostile paths cannot execute scripts or cause network requests.
- Oversized/binary/malformed input reports an explicit error and clears stale content.
- Native callbacks reject invalid, stale, or out-of-bounds events.
- Native navigation cannot leave bundled content.
- No rendering path mutates repository state or invokes an editor directly.
- Codans integration is not considered complete until actual Git-backed flows, focus preservation, remote routing, and refresh races are tested.

## References

- [diff2html API](https://github.com/rtfpessoa/diff2html)
- [jsdiff patch generation and computation limits](https://github.com/kpdecker/jsdiff)
- [Monaco Editor](https://github.com/microsoft/monaco-editor)
- [WKWebView](https://developer.apple.com/documentation/webkit/wkwebview)
- [Git diff endpoint semantics](https://git-scm.com/docs/git-diff)
