# Changelog

## Unreleased

- Default to Standard work details, completion-time folding, and Final answer only through the host's native settings. User profile overrides retain precedence.
- Add an independent `retainProse` setting, defaulting to false for new settings and older settings without an explicit value, with a backup before migration.
- Let enabled Timeline installations own maintenance reminders by default through `coordinateTimeline`.
- Encourage concise updates about findings, phase changes, and blockers alongside the host's task and progress cards.
- Limit optional client styling to collapsed prose visibility, allowing host and third-party headings to retain their typography.

## 1.0.0-rc.1

- Package Stage Prose as a standalone DSH bundle.
- Store settings and prompt text outside the package, with a legacy import command and a backup before schema migration.
- Keep written progress visible when turns fold. Keep reasoning and tool rows folded.
- Add browser contract tests for the 0.2.1-rc.3 and 0.2.2-rc.1 chat markup.
