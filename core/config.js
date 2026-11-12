import { copyFileSync, constants, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { DEFAULTS } from './narration.js'

const defaults = new URL('../defaults/', import.meta.url)
const currentVersion = 1
const migrations = {
  0: (value) => ({ ...value, schemaVersion: 1 }),
}

export function dataDirectory(home = process.env.DSH_HOME || join(homedir(), '.dsh')) {
  return join(home, 'plugin-data', 'dsh-stage-prose')
}

function seed(source, target) {
  try { copyFileSync(source, target, constants.COPYFILE_EXCL) }
  catch (error) { if (error.code !== 'EEXIST') throw error }
}

export function initializeData(dir, legacyDir) {
  mkdirSync(dir, { recursive: true })
  for (const name of ['settings.json', 'guidance.md']) {
    const target = join(dir, name)
    if (legacyDir) {
      try { seed(join(legacyDir, name), target); continue }
      catch (error) { if (error.code !== 'ENOENT') throw error }
    }
    seed(new URL(name, defaults), target)
  }
}

function migrate(path, original, value) {
  const version = value.schemaVersion ?? 0
  if (!Number.isSafeInteger(version) || version < 0 || version > currentVersion) return undefined
  if (version === currentVersion) return value
  for (let from = version; from < currentVersion; from++) value = migrations[from](value)
  const backup = path + '.v' + version + '.' + randomUUID() + '.bak'
  const temporary = path + '.' + randomUUID() + '.tmp'
  try {
    if (readFileSync(path, 'utf8') !== original) return undefined
    writeFileSync(backup, original, { flag: 'wx' })
    writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' })
    if (readFileSync(path, 'utf8') === original) renameSync(temporary, path)
  } finally {
    rmSync(temporary, { force: true })
  }
  return value
}

export function openConfig() {
  const dir = dataDirectory()
  const settingsPath = join(dir, 'settings.json')
  const guidancePath = join(dir, 'guidance.md')
  const defaultGuidance = readFileSync(new URL('guidance.md', defaults), 'utf8')
  try { initializeData(dir) } catch { /* Read-only home: retain packaged defaults. */ }

  let cachedText
  let cachedSettings = DEFAULTS
  function readSettings() {
    try {
      const text = readFileSync(settingsPath, 'utf8')
      if (text === cachedText) return cachedSettings
      const value = JSON.parse(text.replace(/^\uFEFF/, ''))
      if (!value || typeof value !== 'object' || Array.isArray(value)) return DEFAULTS
      const parsed = migrate(settingsPath, text, value)
      if (!parsed) return DEFAULTS
      const settings = { ...DEFAULTS }
      for (const key of ['enabled', 'debugLog']) {
        if (typeof parsed[key] === 'boolean') settings[key] = parsed[key]
      }
      if (Number.isInteger(parsed.everySteps) && parsed.everySteps >= 1 && parsed.everySteps <= 50) {
        settings.everySteps = parsed.everySteps
      }
      for (const key of ['tailReminder', 'reminderZh', 'reminderEn']) {
        if (typeof parsed[key] === 'string' && parsed[key].trim()) settings[key] = parsed[key]
      }
      cachedText = text
      cachedSettings = settings
      return settings
    } catch { return DEFAULTS }
  }
  function readGuidance() {
    try { return readFileSync(guidancePath, 'utf8').replace(/^\uFEFF/, '').trim() || defaultGuidance }
    catch { return defaultGuidance }
  }
  return { dir, settingsPath, readSettings, readGuidance }
}
