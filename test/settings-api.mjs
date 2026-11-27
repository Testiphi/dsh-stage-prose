import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { openConfig } from '../core/config.js'
import { createSettingsStore, installSettingsApi } from '../core/settings-api.js'

test('file editor migrates, preserves custom fields, validates writes, and detects stale drafts', t => {
  const directory = mkdtempSync(join(tmpdir(), 'stage-prose-editor-'))
  const originalHome = process.env.DSH_HOME
  process.env.DSH_HOME = directory
  t.after(() => {
    if (originalHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = originalHome
    rmSync(directory, { recursive: true, force: true })
  })
  const config = openConfig()
  const original = '{"schemaVersion":1,"everySteps":7,"custom":"preserve"}'
  writeFileSync(config.settingsPath, original)
  const editor = createSettingsStore(config)
  let state = editor.read()
  assert.equal(state.settings.everySteps, 7)
  assert.equal(state.settings.retainProse, false)
  const backup = readdirSync(config.dir).find(name => name.endsWith('.bak'))
  assert.equal(readFileSync(join(config.dir, backup), 'utf8'), original)
  state = editor.saveSettings({ revision: state.settingsRevision, patch: { enabled: false, everySteps: 2, reminderZh: '正在检查。' } })
  assert.equal(config.readSettings().everySteps, 2)
  assert.equal(config.readSettings().enabled, false)
  assert.equal(JSON.parse(readFileSync(config.settingsPath, 'utf8')).custom, 'preserve')
  const before = readFileSync(config.settingsPath, 'utf8')
  for (const patch of [{ everySteps: 0 }, { everySteps: 2.5 }, { everySteps: 51 }, { enabled: 'false' }, { path: '../outside' }]) {
    assert.throws(() => editor.saveSettings({ revision: state.settingsRevision, patch }), { code: 'INVALID_INPUT' })
    assert.equal(readFileSync(config.settingsPath, 'utf8'), before)
  }
  const changed = { ...JSON.parse(before), everySteps: 9 }
  writeFileSync(config.settingsPath, JSON.stringify(changed))
  assert.throws(() => editor.saveSettings({ revision: state.settingsRevision, patch: { everySteps: 4 } }), { code: 'CONFLICT' })
  assert.equal(config.readSettings().everySteps, 9)
  editor.saveGuidance({ revision: state.guidanceRevision, text: '用户定制的进度指导。' })
  assert.equal(config.readGuidance(), '用户定制的进度指导。')
  assert.equal(config.readSettings().everySteps, 9)
  assert.throws(() => editor.saveGuidance({ revision: state.guidanceRevision, text: 'stale' }), { code: 'CONFLICT' })
  state = editor.read()
  editor.saveSettings({ revision: state.settingsRevision, patch: { reminderZh: '' } })
  assert.equal(Object.hasOwn(JSON.parse(readFileSync(config.settingsPath, 'utf8')), 'reminderZh'), false)
  writeFileSync(config.settingsPath, '{"schemaVersion":99}')
  assert.throws(() => editor.read(), { code: 'UNSUPPORTED_VERSION' })
  const guidanceBefore = readFileSync(config.guidancePath, 'utf8')
  assert.throws(() => editor.saveGuidance({ revision: state.guidanceRevision, text: 'replacement' }), { code: 'UNSUPPORTED_VERSION' })
  assert.equal(readFileSync(config.guidancePath, 'utf8'), guidanceBefore)
  assert.equal(readFileSync(config.settingsPath, 'utf8'), '{"schemaVersion":99}')
  writeFileSync(config.settingsPath, '{broken')
  assert.throws(() => editor.read(), { code: 'INVALID_FILE' })
})

test('configuration API registers exact owner-only Connection routes and validates envelopes', async () => {
  const routes = []
  installSettingsApi({ inject(names, run) {
    assert.deepEqual(names, ['connection'])
    run({ connection: { fetch: { register: route => routes.push(route) } } })
  } }, {})
  assert.equal(routes.length, 3)
  assert.deepEqual(routes.map(route => route.path), ['/api/dsh-stage-prose/read', '/api/dsh-stage-prose/save-settings', '/api/dsh-stage-prose/save-guidance'])
  const route = routes[0]
  assert.deepEqual(route.methods, ['POST'])
  assert.equal(route.requestBody, 'buffered')
  const request = (body, type = 'application/json') => new Request('http://localhost' + route.path, { method: 'POST', headers: { 'content-type': type }, body })
  assert.equal((await route.fetch(request('{}', 'text/plain'))).status, 415)
  assert.equal((await route.fetch(request('{broken'))).status, 400)
  assert.equal((await route.fetch(request(JSON.stringify({ type: 'client-request', rpcId: 'a', method: '__proto__' })))).status, 400)
  const response = await route.fetch(request(JSON.stringify({ type: 'client-request', rpcId: 'a', method: 'dsh-stage-prose/read', payload: {} })))
  const body = await response.json()
  assert.equal(body.rpcId, 'a')
  assert.equal(body.type, 'server-response')
  assert.equal(body.result.ok, false)
  assert.equal(body.result.error.code, 'IO_ERROR')
})
