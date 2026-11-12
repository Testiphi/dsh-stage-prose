/**
 * Offline smoke test for the host half: a fake Cordis context captures the two
 * prompt sections and the two event listeners, then committed session events and
 * pre-step calls drive the silent-step nudge. No DSH install is required.
 *
 * Usage: node test/smoke.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdtempSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PLUGIN_DIR = join(fileURLToPath(import.meta.url), '..', '..')
const INDEX_URL = pathToFileURL(join(PLUGIN_DIR, 'index.js')).href

let failures = 0
const check = (name, condition, detail) => {
  if (condition) {
    console.log(`ok   ${name}`)
    return
  }
  failures += 1
  console.log(`FAIL ${name}${detail === undefined ? '' : ` :: ${detail}`}`)
}

const home = mkdtempSync(join(tmpdir(), 'stage-prose-test-'))
process.env.DSH_HOME = home

const data = join(home, 'plugin-data', 'dsh-stage-prose')
const SETTINGS_PATH = join(data, 'settings.json')
mkdirSync(data, { recursive: true })

try {
  writeFileSync(SETTINGS_PATH, JSON.stringify({ schemaVersion: 1, enabled: true, everySteps: 3, debugLog: true }, null, 2))

  const sections = []
  const events = { session: [], preStep: [], disposed: [] }
  const fakeCtx = {
    systemPrompt: {
      section(definition) { sections.push(definition); return () => {} },
      getSectionOrder(name) { return name === 'WEB_SURFACE' ? 10100 : undefined },
    },
    effect(run) { return run() },
    on(name, handler) {
      const bucket = name === 'session/event' ? events.session
        : name === 'agent/pre-step' ? events.preStep
          : name === 'session/disposed' ? events.disposed : undefined
      if (bucket !== undefined) bucket.push(handler)
      return () => {}
    },
  }

  const module = await import(INDEX_URL)
  module.apply(fakeCtx)

  check('two prompt sections registered', sections.length === 2, sections.map(s => s.name).join(','))
  const main = sections.find(s => s.name === 'deployment:stage-report')
  const tail = sections.find(s => s.name === 'deployment:stage-report-tail')
  check('main section order', main?.order === 450, String(main?.order))
  check('main section text', typeof main?.text === 'function' && main.text().includes('过程说明'))
  check('tail section order follows WEB_SURFACE', tail?.order === 10150, String(tail?.order))
  check('tail section text', typeof tail?.text === 'function' && tail.text().includes('汇报提醒'))

  check('session/event listener registered', events.session.length === 1)
  check('agent/pre-step listener registered', events.preStep.length === 1)
  check('mount log written', existsSync(join(data, 'diagnostics.log'))
    && readFileSync(join(data, 'diagnostics.log'), 'utf8').includes('mount'))

  const session = { id: 'session-main', header: { origin: 'user', delegationDepth: 0 } }
  const emit = (event) => events.session[0](session, event)
  const silent = () => emit({ type: 'assistant/message', data: { message: { content: [{ type: 'reasoning', text: 'thinking' }] } } })
  const narrated = (text = 'working on it') => emit({ type: 'assistant/message', data: { message: { content: [{ type: 'text', text }] } } })
  const userSays = (text) => emit({ type: 'user/message', data: { content: [{ type: 'text', text }], source: { kind: 'user' } } })
  const preStep = async (turn = 1, step = 1) => events.preStep[0](
    { agent: { session }, turn, step },
    async () => ({ kind: 'enter', messages: [] }),
  )

  emit({ type: 'turn/start' })
  silent(); silent()
  let decision = await preStep(1, 3)
  check('two silent steps stay below threshold', decision.messages.length === 0)

  silent()
  decision = await preStep(1, 4)
  check('third silent step injects one reminder', decision.messages.length === 1)
  const reminder = decision.messages[0]
  check('reminder is user-role with plugin source', reminder.role === 'user' && reminder.source.kind === 'stage-prose-nudge')
  check('reminder carries text', reminder.content[0].type === 'text' && reminder.content[0].text.includes('过程提醒'))
  check('reminder is not the user kind', reminder.source.kind !== 'user')
  check('counter resets after the reminder', (await preStep(1, 5)).messages.length === 0)

  narrated()
  check('narrated step resets the counter', (await preStep(1, 6)).messages.length === 0)
  silent(); silent()
  check('silence below threshold again', (await preStep(1, 8)).messages.length === 0)

  emit({ type: 'turn/start' })
  check('turn/start resets the counter', (await preStep(2, 1)).messages.length === 0)

  userSays('please fix the failing test')
  silent(); silent(); silent()
  decision = await preStep(2, 4)
  check('English session gets the English reminder',
    decision.messages.length === 1 && decision.messages[0].content[0].text.startsWith('(process reminder)'),
    decision.messages[0]?.content[0]?.text)

  const child = { id: 'session-child', header: { origin: 'subagent', delegationDepth: 1 } }
  const childEvents = []
  childEvents.push(events.session[0])
  events.session[0](child, { type: 'turn/start' })
  events.session[0](child, { type: 'assistant/message', data: { message: { content: [{ type: 'tool-call', id: 'c1', name: 'read', arguments: {} }] } } })
  events.session[0](child, { type: 'assistant/message', data: { message: { content: [{ type: 'reasoning', text: 'x' }] } } })
  events.session[0](child, { type: 'assistant/message', data: { message: { content: [{ type: 'reasoning', text: 'y' }] } } })
  const childDecision = await events.preStep[0](
    { agent: { session: child }, turn: 1, step: 4 },
    async () => ({ kind: 'enter', messages: [] }),
  )
  check('subagent sessions get no reminder', childDecision.messages.length === 0)

  writeFileSync(SETTINGS_PATH, JSON.stringify({ schemaVersion: 1, enabled: false, everySteps: 3, debugLog: true }))
  silent(); silent(); silent()
  decision = await preStep(9, 5)
  check('enabled:false disables the nudge', decision.messages.length === 0)

  writeFileSync(SETTINGS_PATH, JSON.stringify({ schemaVersion: 1, enabled: true, everySteps: 2, debugLog: true }))
  silent(); silent()
  decision = await preStep(10, 3)
  check('everySteps from settings.json applies', decision.messages.length === 1)

  const log = readFileSync(join(data, 'diagnostics.log'), 'utf8')
  check('nudge logged', log.includes('nudge session=session-'))
  check('no unexpected files in home', readdirSync(home).every(name => name === 'plugin-data'), readdirSync(home).join(','))

  check('JSON.stringify(decision) is lossless',
    JSON.stringify(JSON.parse(JSON.stringify(decision))) === JSON.stringify(decision))
} finally {
  rmSync(home, { recursive: true, force: true })
}

console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`)
process.exitCode = failures === 0 ? 0 : 1
