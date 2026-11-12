import { appendFileSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { openConfig } from './core/config.js'
import { detectLanguage, hasReportedText, isSubagent, reminderMessage, sessionKey, userText } from './core/narration.js'

/** Cordis plugin name. */
export const name = 'stage-prose'

/** The prompt registry this row contributes to. */
export const inject = ['systemPrompt']

/** Section placements: after the deployment persona, before plan policy. */
const MAIN_SECTION_ORDER = 450
/** Tail reminder placement: after WEB_SURFACE (10100) and before the persona suffix (10200). */
const TAIL_SECTION_ORDER = 10150
const TAIL_OFFSET_FROM_WEB_SURFACE = 50

const LOG_MAX_BYTES = 64 * 1024

/** Append one diagnostic line, rotating the file when it outgrows its bound. */
function createLogger(dir, readSettings) {
  return (line) => {
    if (!readSettings().debugLog) return
    try {
      const path = join(dir, 'diagnostics.log')
      const stamp = new Date().toISOString()
      try {
        if (statSync(path).size > LOG_MAX_BYTES) writeFileSync(path, '')
      } catch {
        // Absent file: nothing to rotate.
      }
      appendFileSync(path, `[${stamp}] ${line}\n`)
    } catch {
      // Logging must never break the host plugin.
    }
  }
}

/** Resolve the tail placement against the running host, tolerating order-name drift. */
function tailOrder(systemPrompt) {
  try {
    const base = systemPrompt.getSectionOrder('WEB_SURFACE')
    if (Number.isFinite(base)) return base + TAIL_OFFSET_FROM_WEB_SURFACE
  } catch {
    // Older or future hosts may not name this placement.
  }
  return TAIL_SECTION_ORDER
}

/**
 * Register the narration contract, the tail reminder, and the silent-step nudge.
 * @param ctx - host context carrying the prompt registry and the agent events.
 */
export function apply(ctx) {
  const { dir, settingsPath, readSettings, readGuidance } = openConfig()
  const settings = readSettings()
  const log = createLogger(dir, readSettings)

  ctx.effect(() => ctx.systemPrompt.section({
    name: 'deployment:stage-report',
    order: MAIN_SECTION_ORDER,
    text: readGuidance,
  }), 'stage-prose.section()')

  ctx.effect(() => ctx.systemPrompt.section({
    name: 'deployment:stage-report-tail',
    order: tailOrder(ctx.systemPrompt),
    text: () => readSettings().tailReminder,
  }), 'stage-prose.tail()')

  /** Per-session narration facts: silent steps since the last written update, and interface language. */
  const sessions = new Map()

  const stateOf = (session) => {
    const key = sessionKey(session)
    if (key === '') return undefined
    let state = sessions.get(key)
    if (state === undefined) {
      state = { silent: 0, lang: 'zh' }
      sessions.set(key, state)
    }
    return state
  }

  ctx.effect(() => ctx.on('session/event', (session, event) => {
    if (event?.type === 'turn/start') {
      const state = stateOf(session)
      if (state !== undefined) state.silent = 0
      return
    }
    if (event?.type === 'assistant/message') {
      const state = stateOf(session)
      if (state === undefined) return
      state.silent = hasReportedText(event.data?.message) ? 0 : state.silent + 1
      return
    }
    if (event?.type === 'user/message') {
      const data = event.data
      if (data?.source?.kind !== 'user') return
      const state = stateOf(session)
      if (state === undefined) return
      const text = userText(data)
      if (text.trim() !== '') state.lang = detectLanguage(text)
    }
  }), 'stage-prose.session-events')

  ctx.effect(() => ctx.on('session/disposed', (session) => {
    sessions.delete(sessionKey(session))
  }), 'stage-prose.session-gc')

  ctx.effect(() => ctx.on('agent/pre-step', async (payload, next) => {
    const decision = await next()
    if (decision?.kind !== 'enter' || !Array.isArray(decision.messages)) return decision
    const current = readSettings()
    if (!current.enabled) return decision
    const agent = payload?.agent
    const session = agent?.session
    if (isSubagent(session)) return decision
    const state = stateOf(session)
    if (state === undefined) return decision
    if (state.silent < current.everySteps) return decision
    const text = state.lang === 'en' ? current.reminderEn : current.reminderZh
    const message = reminderMessage(text)
    state.silent = 0
    log(`nudge session=${sessionKey(session).slice(0, 8)} turn=${payload.turn} step=${payload.step} everySteps=${current.everySteps} lang=${state.lang}`)
    return { ...decision, messages: [...decision.messages, message] }
  }, { prepend: true }), 'stage-prose.nudge')

  log(`mount main=${MAIN_SECTION_ORDER} tail=${tailOrder(ctx.systemPrompt)} everySteps=${settings.everySteps} guidanceChars=${readGuidance().length} settings=${settingsPath}`)
}
