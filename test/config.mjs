import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { dataDirectory, initializeData, openConfig } from '../core/config.js'

test('imports legacy files without overwriting, backs up before migrating, and retains custom fields', (t) => {
  const home = mkdtempSync(join(tmpdir(), 'stage-prose-config-'))
  const originalHome = process.env.DSH_HOME
  t.after(() => {
    if (originalHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = originalHome
    rmSync(home, { force: true, recursive: true })
  })
  process.env.DSH_HOME = home
  const legacy = join(home, 'legacy')
  mkdirSync(legacy)
  const original = '{"everySteps":7,"debugLog":true,"custom":"preserve me"}'
  writeFileSync(join(legacy, 'settings.json'), original)
  writeFileSync(join(legacy, 'guidance.md'), 'Custom guidance')
  const dir = dataDirectory()
  initializeData(dir, legacy)
  const { settingsPath, readSettings, readGuidance } = openConfig()
  assert.equal(readSettings().everySteps, 7)
  assert.deepEqual(JSON.parse(readFileSync(settingsPath, 'utf8')), { ...JSON.parse(original), retainProse: false, schemaVersion: 2 })
  const backup = readdirSync(dir).filter((name) => name.endsWith('.bak'))
  assert.equal(backup.length, 1)
  assert.equal(readFileSync(join(dir, backup[0]), 'utf8'), original)
  assert.equal(readGuidance(), 'Custom guidance')
  writeFileSync(join(dir, 'guidance.md'), 'Edited guidance')
  initializeData(dir, legacy)
  assert.equal(readGuidance(), 'Edited guidance')
  const future = '{"schemaVersion":99,"everySteps":9}'
  writeFileSync(settingsPath, future)
  assert.equal(readSettings().everySteps, 3)
  assert.equal(readFileSync(settingsPath, 'utf8'), future)
  writeFileSync(settingsPath, '{ broken')
  assert.equal(readSettings().everySteps, 3)
  assert.equal(readFileSync(settingsPath, 'utf8'), '{ broken')
  writeFileSync(settingsPath, '{"schemaVersion":2,"retainProse":false}')
  assert.equal(readSettings().retainProse, false)
  const v1 = '{"schemaVersion":1,"enabled":false,"everySteps":9,"custom":"keep"}'
  writeFileSync(settingsPath, v1)
  assert.equal(readSettings().retainProse, false)
  assert.equal(readSettings().enabled, false)
  assert.equal(readSettings().everySteps, 9)
  assert.equal(JSON.parse(readFileSync(settingsPath, 'utf8')).custom, 'keep')
  const v1Backups = readdirSync(dir).filter(name => name.startsWith('settings.json.v1.'))
  assert.equal(v1Backups.length, 1)
  assert.equal(readFileSync(join(dir, v1Backups[0]), 'utf8'), v1)
  writeFileSync(settingsPath, '{"schemaVersion":1,"retainProse":true}')
  assert.equal(readSettings().retainProse, true)
})
