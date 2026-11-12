import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { chromium } from 'playwright'

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const client = new URL('../client.js', import.meta.url)
for (const version of ['0.2.1-rc.3', '0.2.2-rc.1']) {
  test('Chromium collapsed-turn contract: ' + version, async (t) => {
    const browser = await chromium.launch({ executablePath: process.env.STAGE_PROSE_CHROMIUM })
    t.after(() => browser.close())
    const page = await browser.newPage()
    await page.setContent(readFileSync(new URL('./fixtures/dsh-' + version + '.html', import.meta.url), 'utf8'))
    const visibility = (selector) => page.locator(selector).evaluate((node) => getComputedStyle(node).contentVisibility)
    assert.equal(await visibility('#prose'), 'hidden')
    await page.evaluate((name) => {
      window.__ModuleLoader__ = { load(module) {
        if (module.id !== name) throw new Error('Wrong client module ID')
        module.factory().apply({ effect(run) { window.disposeStageProse = run() } })
      } }
    }, manifest.name)
    await page.addScriptTag({ content: readFileSync(client, 'utf8') })
    assert.equal(await visibility('#prose'), 'visible')
    assert.equal(await visibility('#reasoning'), 'hidden')
    assert.equal(await visibility('#tool'), 'hidden')
    assert.equal(await visibility('#final'), 'visible')
    if (version === '0.2.2-rc.1') assert.equal(await visibility('#prose [hidden]'), 'hidden')
    await page.evaluate(() => window.disposeStageProse())
    assert.equal(await visibility('#prose'), 'hidden')
  })
}
