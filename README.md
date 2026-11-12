# Stage Prose for DeepSeek Harness

[中文](README.zh.md) · [Compatibility evidence](compat/ledger.json)

Stage Prose asks the model to give brief progress updates during longer tasks. If it goes several steps without written text, the host inserts a private reminder into the model context. In the Standard process view, written updates remain visible when a completed turn is folded.

Install the prebuilt tarball from your checkout or distribution. Use the bundled DSH CLI for the Electron desktop app.

```sh
npm pack
dsh plugin --profile desktop add ./dsh-stage-prose-1.0.0-rc.1.tgz --save-exact
```

Use `--profile web` for the browser app. Restart after installing. The declared DSH range is a loading policy; the ledger records the individual versions checked. New versions can change the chat attributes even within that range.

### Settings and upgrading

Edit `$DSH_HOME/plugin-data/dsh-stage-prose/settings.json` or `guidance.md`. With no `DSH_HOME`, the home is `~/.dsh`. Settings and wording are read on demand. `enabled` controls silent-step reminders; the prompt sections and client styling remain active. `everySteps` is 1–50 (default 3), `debugLog` is off by default, and `tailReminder`, `reminderZh`, and `reminderEn` override the default wording. Reminders are recorded as plugin context in the local session log.

For the old `@local/dsh-stage-prose` package, quit DSH, use the same `DSH_HOME` as the app, then run this from the checkout **before** uninstalling the old plugin:

```sh
node scripts/import-legacy.mjs /path/to/old/plugin-directory
dsh plugin --profile desktop remove @local/dsh-stage-prose
```

The importer leaves any existing user files in place. It copies old files and saves a backup of unversioned settings before migrating them. Install the new tarball and restart. To turn off Stage Prose entirely, remove `dsh-stage-prose` from the profile. User files remain available for reinstall.

### Maintenance

Run `npm ci`, `npx playwright install chromium`, `npm test`, and `npm pack --dry-run`. Run `npm run build` after editing the DOM adapter. Before widening support, install the tarball in a clean profile for the new DSH version, verify host and client loading, and test a folded turn with written progress, reasoning, and tools. Update the version ledger and fixture if the host changes.
