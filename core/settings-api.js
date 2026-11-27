import { createHash, randomUUID } from 'node:crypto'
import { readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { settingsFrom } from './config.js'
import { DEFAULTS } from './narration.js'

class SettingsError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

function fileRevision(text) {
  return createHash('sha256').update('file\0' + text).digest('hex')
}

function fileState(path, fallback) {
  try {
    const text = readFileSync(path, 'utf8')
    return { text, revision: fileRevision(text) }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    return { text: fallback, revision: 'missing' }
  }
}

function settingsDocument(text) {
  let value
  try { value = JSON.parse(text.replace(/^\uFEFF/, '')) }
  catch { throw new SettingsError('INVALID_FILE', 'settings.json is not valid JSON.') }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SettingsError('INVALID_FILE', 'settings.json must contain an object.')
  }
  if (value.schemaVersion !== 2) {
    throw new SettingsError('UNSUPPORTED_VERSION', 'The configuration version cannot be edited by this plugin.')
  }
  return value
}

function replaceFile(path, revision, text, fallback) {
  if (fileState(path, fallback).revision !== revision) {
    throw new SettingsError('CONFLICT', 'The file changed. Reload it before saving.')
  }
  const temporary = path + '.' + randomUUID() + '.tmp'
  let mode = 0o600
  try { mode = statSync(path).mode } catch (error) { if (error.code !== 'ENOENT') throw error }
  try {
    writeFileSync(temporary, text, { flag: 'wx', mode })
    if (fileState(path, fallback).revision !== revision) {
      throw new SettingsError('CONFLICT', 'The file changed. Reload it before saving.')
    }
    renameSync(temporary, path)
  } finally {
    rmSync(temporary, { force: true })
  }
}

/** File-backed editor. Each save targets one file and compares its content revision. */
export function createSettingsStore(config, status = () => ({})) {
  const fallbackSettings = JSON.stringify({ schemaVersion: 2, ...DEFAULTS })
  function read() {
    config.readSettings()
    const settings = fileState(config.settingsPath, fallbackSettings)
    const guidance = fileState(config.guidancePath, config.defaultGuidance)
    return {
      settings: settingsFrom(settingsDocument(settings.text)),
      settingsRevision: settings.revision,
      guidance: guidance.text,
      guidanceRevision: guidance.revision,
      status: status(),
    }
  }
  function saveSettings(payload) {
    if (!payload || typeof payload.revision !== 'string' || !payload.patch || typeof payload.patch !== 'object' || Array.isArray(payload.patch)) {
      throw new SettingsError('INVALID_INPUT', 'A revision and settings patch are required.')
    }
    const previous = read()
    const state = fileState(config.settingsPath, fallbackSettings)
    const document = settingsDocument(state.text)
    for (const [key, value] of Object.entries(payload.patch)) {
      if (!Object.hasOwn(DEFAULTS, key) || typeof value !== typeof DEFAULTS[key]) {
        throw new SettingsError('INVALID_INPUT', 'Invalid settings field or type.')
      }
      if (key === 'everySteps' && (!Number.isInteger(value) || value < 1 || value > 50)) {
        throw new SettingsError('INVALID_INPUT', 'everySteps must be an integer from 1 to 50.')
      }
      if (typeof value === 'string' && !value.trim()) delete document[key]
      else document[key] = value
    }
    const text = JSON.stringify(document, null, 2) + '\n'
    replaceFile(config.settingsPath, payload.revision, text, fallbackSettings)
    return { ...previous, settings: settingsFrom(document), settingsRevision: fileRevision(text) }
  }
  function saveGuidance(payload) {
    if (!payload || typeof payload.revision !== 'string' || typeof payload.text !== 'string') {
      throw new SettingsError('INVALID_INPUT', 'A revision and guidance text are required.')
    }
    const previous = read()
    replaceFile(config.guidancePath, payload.revision, payload.text, config.defaultGuidance)
    return { ...previous, guidance: payload.text, guidanceRevision: fileRevision(payload.text) }
  }
  return { read, saveSettings, saveGuidance }
}

/** Exact Connection routes inherit its authentication, owner-only access, and Origin checks. */
export function installSettingsApi(ctx, config, status) {
  ctx.inject?.(['connection'], scope => {
    if (!scope.connection.fetch?.register) return
    const store = createSettingsStore(config, status)
    const handlers = { read: store.read, 'save-settings': store.saveSettings, 'save-guidance': store.saveGuidance }
    for (const [operation, handler] of Object.entries(handlers)) {
      const endpoint = 'dsh-stage-prose/' + operation
      scope.connection.fetch.register({
        path: '/api/' + endpoint, methods: ['POST'], requestBody: 'buffered',
        async fetch(request) {
          if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
            return new Response('Expected JSON', { status: 415 })
          }
          let message
          try { message = await request.json() } catch { return new Response('Invalid JSON', { status: 400 }) }
          if (message?.type !== 'client-request' || typeof message.rpcId !== 'string' || message.method !== endpoint) {
            return new Response('Invalid request', { status: 400 })
          }
          let result
          try {
            request.signal.throwIfAborted()
            result = { ok: true, value: handler(message.payload) }
          } catch (error) {
            result = { ok: false, error: { code: error.code ?? 'IO_ERROR', message: error.message, details: {} } }
          }
          return Response.json({ type: 'server-response', rpcId: message.rpcId, result })
        },
      })
    }
  })
}
