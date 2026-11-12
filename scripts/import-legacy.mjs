import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { dataDirectory, initializeData, openConfig } from '../core/config.js'

const source = process.argv[2]
if (!source || !existsSync(join(source, 'settings.json')) || !existsSync(join(source, 'guidance.md'))) {
  throw new Error('Usage: node scripts/import-legacy.mjs <old plugin directory>')
}
const target = dataDirectory()
initializeData(target, resolve(source))
openConfig().readSettings()
console.log(target)
