import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'

test('client build stays identical with LF and CRLF source files', t => {
  const directory = mkdtempSync(join(tmpdir(), 'stage-prose-build-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const files = ['package.json', 'scripts/build.mjs', 'adapters/dsh-0.2.js', 'client/settings.js', 'client/settings.css', 'client.js']
  for (const ending of ['\n', '\r\n']) {
    for (const file of files) {
      const target = join(directory, file)
      mkdirSync(dirname(target), { recursive: true })
      const source = readFileSync(new URL('../' + file, import.meta.url), 'utf8')
      writeFileSync(target, file === 'client.js' ? source : source.replace(/\r\n/g, '\n').replace(/\n/g, ending))
    }
    const result = spawnSync(process.execPath, [join(directory, 'scripts/build.mjs'), '--check'], { encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr || result.error?.message)
  }
})
