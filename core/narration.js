import { randomUUID } from 'node:crypto'

export const DEFAULTS = {
  enabled: true,
  everySteps: 3,
  debugLog: false,
  tailReminder: '汇报提醒：调工具不等于汇报。连续几步只有工具调用时，先写一两句进度（在做什么、刚完成什么）再继续。',
  reminderZh: '（过程提醒）已经连续几步只在调用工具、没有正文说明了。先用一两句说清楚现在在做什么、刚完成了什么，再继续下一步；不要用工具调用代替进度说明。',
  reminderEn: '(process reminder) The last few steps ran tools without any written update. Before continuing, state in one or two sentences what you are doing and what just completed; do not let tool calls replace progress notes.',
}

export function isSubagent(session) {
  try {
    const header = session?.header
    if (header === undefined || header === null) return false
    return header.origin === 'subagent' || (typeof header.delegationDepth === 'number' && header.delegationDepth > 0)
  } catch {
    return false
  }
}

export function sessionKey(session) {
  try { return String(session?.id ?? '') } catch { return '' }
}

/** Whether one assistant message carries user-visible text (not only reasoning/tool calls). */
export function hasReportedText(message) {
  const blocks = message?.content
  if (!Array.isArray(blocks)) return false
  return blocks.some(block => block?.type === 'text' && typeof block.text === 'string' && block.text.trim() !== '')
}

/** Last user-authored text block in a committed user message. */
export function userText(message) {
  const blocks = message?.content
  if (!Array.isArray(blocks)) return ''
  for (const block of blocks) {
    if (block?.type === 'text' && typeof block.text === 'string') return block.text
  }
  return ''
}

/** Interface language for the nudge: Chinese when the latest user text is Chinese. */
export function detectLanguage(text) {
  if (typeof text !== 'string' || text.trim() === '') return 'zh'
  const cjk = (text.match(/[\u4e00-\u9fff]/g) ?? []).length
  return cjk > 0 ? 'zh' : 'en'
}

/** Compose the durable reminder message appended to one step's input batch. */
export function reminderMessage(text) {
  return {
    id: `stage-prose-nudge-${randomUUID()}`,
    role: 'user',
    content: [{ type: 'text', text }],
    source: { kind: 'stage-prose-nudge' },
  }
}
