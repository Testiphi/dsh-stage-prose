# Stage Prose for DeepSeek Harness

[中文](README.zh.md) · [Compatibility evidence](compat/ledger.json)

**Live, non-intrusive progress updates during long multi-step tasks, with auto-folding on completion to keep final answers clean.**

**Stage Prose** keeps you informed while DeepSeek Harness runs complex workflows. After a configurable number of consecutive steps without visible text, the host adds a private context reminder asking the model for a brief progress update, without requiring another user message or a separate model request. Progress stays visible during execution and folds alongside reasoning and tool rows on completion by default.

> ⭐ If Stage Prose makes long tasks easier to follow, please consider giving this repo a **Star** to support ongoing DSH version adaptation and compatibility testing.

### Why Stage Prose?

- **Progress after every N silent steps (`everySteps: 1–50`, default `3`)**. A reminder enters the next request after N consecutive steps without visible text. Written updates reset the counter, and reminders stay within the existing execution flow.
- **Live visibility and auto-folding on completion**. Native defaults use Standard work details, completion-time folding, and Final answer only. Set `retainProse: true` to keep stage text visible after completion. Explicit DSH display preferences take precedence.
- **Hot-reload prompt and bilingual reminder customization**. Edit `guidance.md` and the `reminderEn`, `reminderZh`, and `tailReminder` settings on demand with no restart required. Reload the page after changing the prose-retention switch.
- **Timeline coordination and versioned coexistence evidence**. With `coordinateTimeline: true`, an enabled Timeline installation owns maintenance reminders when its planning tools are available to the current agent. Recorded combined tests cover context, cost, safety, side-chat, and sidebar plugins, with unresolved side-chat sending and untested paths documented. See the [compatibility ledger](compat/ledger.json).

### Installation

**Web via npm.** Install the prerelease into the Web profile, then restart the Web host:

```sh
dsh plugin --profile web add dsh-stage-prose@next --save-exact
```

**Tarball.**

Use a prebuilt `dsh-stage-prose-1.0.0-rc.2.tgz`, or run `npm pack` from the source checkout to create it. In the commands below, replace the example with the absolute path to your tarball. On Windows, use a path such as `E:/Downloads/dsh-stage-prose-1.0.0-rc.2.tgz`.

**Desktop.** Open DeepSeek Harness Desktop once to initialize its profile, then fully quit it from the application menu. Use the app's bundled CLI. Register it via **Manage dsh Command…** and open a new terminal, or invoke `resources/runtime/cli/bin/dsh` (`dsh.cmd` on Windows) directly from the installation directory. The npm-installed DSH CLI cannot manage the desktop profile.

```sh
dsh plugin --profile desktop add "file:/absolute/path/to/dsh-stage-prose-1.0.0-rc.2.tgz" --save-exact
```

Reopen Desktop after installation. Keep the tarball at a stable path for future installs from the profile's saved dependency.

For a Web tarball install, use the Web CLI with `--profile web` in the install command, then restart the Web host. The declared DSH range controls loading. The ledger records what was verified for each version.

### Settings and upgrading

Edit `$DSH_HOME/plugin-data/dsh-stage-prose/settings.json` or `guidance.md`. With no `DSH_HOME`, the home is `~/.dsh`. Settings and wording are read on demand. `enabled` controls silent-step reminders. `everySteps` is 1–50 (default 3), `debugLog` is off by default, and `tailReminder`, `reminderZh`, and `reminderEn` override the default wording. Reminders are recorded as plugin context in the local session log.

The bundle defaults Work details to Standard, collapse timing to completion, and Replies After Collapse to Final answer only. Progress remains visible during the task and folds with tools when the turn completes. Explicit user overrides in DSH's profile or home settings take precedence over bundle defaults.

`retainProse` independently controls the browser stylesheet and defaults to `false`. Set it to `true` to keep progress text visible after completion. Reload the page after changing it. Settings from schema 0 or 1 are backed up and migrated to schema 2 with `retainProse: false` when that field was absent. Explicit values and custom settings are preserved.

`coordinateTimeline` defaults to `true`. While an enabled official or standalone Timeline loader entry is present and its planning tools are available to the current agent, Timeline owns maintenance reminders and Stage Prose contributes its fixed narration guidance. Set this option to `false` to retain both reminder mechanisms.

With Timeline absent or disabled, Stage Prose uses its own `everySteps` reminder threshold. The compatibility ledger records exact versions and tested paths for the combined context, cost, side-chat, safety, and sidebar plugins. The DSH 0.2 coexistence check uses Side Chat's prebuilt v1.2.1 GitHub release.

To upgrade from `@local/dsh-stage-prose`, fully quit Desktop or stop the Web host. In your terminal, use the same `DSH_HOME` as that app. If the app uses the default `~/.dsh`, you can leave it unset. The importer is available in the source checkout and requires the old plugin directory containing both `settings.json` and `guidance.md`. From the checkout, run:

```sh
node scripts/import-legacy.mjs "/absolute/path/to/old/plugin-directory"
```

The importer prints the destination under `plugin-data/dsh-stage-prose/`. It copies only missing files. Before migrating unversioned settings, it saves the original as `settings.json.v0.<id>.bak` in that directory.

After verifying the imported files, remove the old package with `dsh plugin --profile desktop remove @local/dsh-stage-prose` using the bundled CLI, or use `--profile web` for Web. Install the new tarball into that same profile and reopen the app. To turn off Stage Prose entirely, remove `dsh-stage-prose` from the profile. User files remain available for reinstall.

### Maintenance

Run `npm ci`, `npx playwright install chromium`, `npm test`, and `npm pack --dry-run`. Run `npm run build` after editing the DOM adapter. Before widening support, install the tarball in a clean profile for the new DSH version, verify host and client loading, and test a folded turn with written progress, reasoning, and tools. Update the version ledger and fixture if the host changes.
