# Stage Prose for DeepSeek Harness

[中文](README.zh.md) · [Compatibility evidence](compat/ledger.json)

Stage Prose asks the model to give brief progress updates during longer tasks. If it goes several steps without written text, the host inserts a private reminder into the model context. In the Standard process view, written updates remain visible when a completed turn is folded.

### Installation

Use a prebuilt `dsh-stage-prose-1.0.0-rc.1.tgz`, or run `npm pack` from the source checkout to create it. In the commands below, replace the example with the absolute path to your tarball. On Windows, use a path such as `E:/Downloads/dsh-stage-prose-1.0.0-rc.1.tgz`.

**Desktop.** Open DeepSeek Harness Desktop once to initialize its profile, then fully quit it from the application menu. Use the app's bundled CLI. Register it via **Manage dsh Command…** and open a new terminal, or invoke `resources/runtime/cli/bin/dsh` (`dsh.cmd` on Windows) directly from the installation directory. The npm-installed DSH CLI cannot manage the desktop profile.

```sh
dsh plugin --profile desktop add "file:/absolute/path/to/dsh-stage-prose-1.0.0-rc.1.tgz" --save-exact
```

Reopen Desktop after installation. Keep the tarball at a stable path for future installs from the profile's saved dependency.

**Web.** Use the Web CLI with `--profile web` in the install command, then restart the Web host. The declared DSH range controls loading. The ledger records what was verified for each version.

### Settings and upgrading

Edit `$DSH_HOME/plugin-data/dsh-stage-prose/settings.json` or `guidance.md`. With no `DSH_HOME`, the home is `~/.dsh`. Settings and wording are read on demand. `enabled` controls silent-step reminders; the prompt sections and client styling remain active. `everySteps` is 1–50 (default 3), `debugLog` is off by default, and `tailReminder`, `reminderZh`, and `reminderEn` override the default wording. Reminders are recorded as plugin context in the local session log.

To upgrade from `@local/dsh-stage-prose`, fully quit Desktop or stop the Web host. In your terminal, use the same `DSH_HOME` as that app. If the app uses the default `~/.dsh`, you can leave it unset. The importer is available in the source checkout and requires the old plugin directory containing both `settings.json` and `guidance.md`. From the checkout, run:

```sh
node scripts/import-legacy.mjs "/absolute/path/to/old/plugin-directory"
```

The importer prints the destination under `plugin-data/dsh-stage-prose/`. It copies only missing files. Before migrating unversioned settings, it saves the original as `settings.json.v0.<id>.bak` in that directory.

After verifying the imported files, remove the old package with `dsh plugin --profile desktop remove @local/dsh-stage-prose` using the bundled CLI, or use `--profile web` for Web. Install the new tarball into that same profile and reopen the app. To turn off Stage Prose entirely, remove `dsh-stage-prose` from the profile. User files remain available for reinstall.

### Maintenance

Run `npm ci`, `npx playwright install chromium`, `npm test`, and `npm pack --dry-run`. Run `npm run build` after editing the DOM adapter. Before widening support, install the tarball in a clean profile for the new DSH version, verify host and client loading, and test a folded turn with written progress, reasoning, and tools. Update the version ledger and fixture if the host changes.
