/** Native plugin-page editor backed by the host's existing configuration files. */
export function installSettingsPage(ctx, React, applyRetention, css) {
  const h = React.createElement
  const { useEffect, useRef, useState, useSyncExternalStore } = React
  const words = {
    zh: {
      summary: '调整进度提醒、正文保留和提示词。', common: '常用设置', advanced: '高级设置',
      enabled: '静默提醒', enabledHint: '连续多步没有正文时提醒模型汇报进度。固定进度指导由插件持续提供。',
      everySteps: '连续静默步数', everyStepsHint: '1–50，默认 3。有正文输出后重新计数。',
      retainProse: '完成后保留阶段正文', retainProseHint: '关闭时遵循原生折叠设置，插件默认完成后只保留最终回答。',
      coordinateTimeline: '与 Timeline 协同', coordinateTimelineHint: '支持的会话由 Timeline 负责维护提醒，避免两套提醒叠加。',
      debugLog: '调试日志', debugLogHint: '在插件数据目录记录挂载和提醒事件。',
      tailReminder: '尾部进度指导', reminderZh: '中文静默提醒', reminderEn: '英文静默提醒',
      textHint: '留空并保存会使用内置默认文案。', guidance: '主提示词 guidance.md',
      guidanceHint: '单独保存指导文本。空文本使用内置指导，手动文件编辑仍然有效。',
      save: '保存设置', saveGuidance: '保存主提示词', reload: '重新读取', loading: '正在读取配置…',
      saved: '设置已保存，后续步骤生效。正文显示开关已应用到当前页面。',
      guidanceSaved: '主提示词已保存，后续请求生效。', external: '文件已有其他修改。请重新读取后再保存，当前草稿已保留。',
      invalid: '步数必须是 1–50 的整数。', failed: '操作失败，请检查文件权限和连接后重试。',
      invalidFile: '配置文件无法解析，请修复 settings.json 后重新读取。',
      unsupported: '配置文件版本较新，当前插件无法编辑。', discard: '放弃未保存的修改并重新读取文件？',
      dirty: '有未保存的修改', native: '原生折叠设置', final: '仅最终回答', all: '全部回复',
      completion: '完成时收起', nextInput: '下次有新消息时收起', unknown: '等待原生设置',
      standalone: '当前使用阶段输出自身的静默提醒。', timeline: 'Timeline 已加载，支持的会话使用协同提醒。',
      off: '静默提醒已关闭。',
    },
    en: {
      summary: 'Configure progress reminders, retained prose, and prompts.', common: 'Common settings', advanced: 'Advanced settings',
      enabled: 'Silent-step reminders', enabledHint: 'Ask for progress after consecutive silent steps. Fixed narration guidance stays active.',
      everySteps: 'Consecutive silent steps', everyStepsHint: '1–50, default 3. Written updates reset the counter.',
      retainProse: 'Keep stage text after completion', retainProseHint: 'When off, native folding applies. The bundle defaults to keeping only the final answer.',
      coordinateTimeline: 'Coordinate with Timeline', coordinateTimelineHint: 'Let Timeline own maintenance reminders in supported sessions.',
      debugLog: 'Diagnostic log', debugLogHint: 'Record mount and reminder events in the plugin data directory.',
      tailReminder: 'Tail guidance', reminderZh: 'Chinese silent-step reminder', reminderEn: 'English silent-step reminder',
      textHint: 'Saving an empty field restores its built-in wording.', guidance: 'Main prompt guidance.md',
      guidanceHint: 'Save guidance separately. Empty text uses built-in guidance. Manual file edits remain supported.',
      save: 'Save settings', saveGuidance: 'Save main prompt', reload: 'Reload files', loading: 'Reading configuration…',
      saved: 'Settings saved for subsequent steps. Prose visibility is updated on this page.',
      guidanceSaved: 'Main prompt saved for subsequent requests.', external: 'The file changed elsewhere. Reload before saving. Your draft has been retained.',
      invalid: 'Steps must be an integer from 1 to 50.', failed: 'The operation failed. Check file permissions and the connection, then retry.',
      invalidFile: 'Fix the invalid settings.json file, then reload.', unsupported: 'The configuration version is newer than this editor supports.',
      discard: 'Discard unsaved edits and reload the files?', dirty: 'Unsaved changes', native: 'Native folding',
      final: 'Final answer only', all: 'All replies', completion: 'Fold on completion', nextInput: 'Fold on next input', unknown: 'Waiting for native settings',
      standalone: 'Stage Prose is using its own silent-step reminders.', timeline: 'Timeline is loaded. Supported sessions use coordinated reminders.', off: 'Silent-step reminders are off.',
    },
  }
  const nativeForm = ctx.configForms.get('ui-chat')
  const subscribeLocale = listener => ctx.locale.subscribe(listener)
  const readLocale = () => ctx.locale.getSnapshot()
  const subscribeNative = listener => nativeForm.subscribe(listener)
  const readNative = () => nativeForm.getSnapshot()

  function Editor() {
    const locale = useSyncExternalStore(subscribeLocale, readLocale)
    const t = words[locale.active.startsWith('zh') ? 'zh' : 'en']
    const native = useSyncExternalStore(subscribeNative, readNative).value
    const [settings, setSettings] = useState(null)
    const [draft, setDraft] = useState(null)
    const [guidance, setGuidance] = useState(null)
    const [guidanceDraft, setGuidanceDraft] = useState('')
    const [status, setStatus] = useState({})
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const alive = useRef(false)
    const abort = useRef(null)
    const reading = useRef(false)
    const settingsDirty = settings !== null && JSON.stringify(draft) !== JSON.stringify(settings.value)
    const guidanceDirty = guidance !== null && guidanceDraft !== guidance.text
    const editing = useRef(false)
    editing.current = busy || settingsDirty || guidanceDirty

    function reportError(problem) {
      const labels = { CONFLICT: t.external, INVALID_INPUT: t.invalid, INVALID_FILE: t.invalidFile, UNSUPPORTED_VERSION: t.unsupported }
      setError(labels[problem.code] ?? t.failed)
    }
    async function request(endpoint, payload) {
      const result = await ctx.connection.rpc.call('/api', 'dsh-stage-prose/' + endpoint, payload, abort.current.signal)
      if (!result.ok) throw Object.assign(new Error(result.error.message), { code: result.error.code })
      return result.value
    }
    function accept(next) {
      setSettings({ value: next.settings, revision: next.settingsRevision })
      setDraft(next.settings)
      setGuidance({ text: next.guidance, revision: next.guidanceRevision })
      setGuidanceDraft(next.guidance)
      setStatus(next.status)
      applyRetention(next.settings.retainProse)
    }
    async function reload(force = false) {
      if (reading.current) return
      reading.current = true
      try {
        const next = await request('read', {})
        if (alive.current && (force || !editing.current)) { accept(next); setError('') }
      } catch (problem) {
        if (alive.current) reportError(problem)
      } finally { reading.current = false }
    }
    useEffect(() => {
      alive.current = true
      abort.current = new AbortController()
      reload()
      const timer = setInterval(() => { if (!editing.current && !document.hidden) reload() }, 5000)
      const focus = () => { if (!editing.current) reload() }
      window.addEventListener('focus', focus)
      return () => { alive.current = false; abort.current.abort(); clearInterval(timer); window.removeEventListener('focus', focus) }
    }, [])

    function edit(key, value) {
      setDraft(previous => ({ ...previous, [key]: value }))
      setMessage('')
    }
    async function saveSettings(event) {
      event.preventDefault()
      if (!Number.isInteger(draft.everySteps) || draft.everySteps < 1 || draft.everySteps > 50) { setError(t.invalid); return }
      const patch = Object.fromEntries(Object.entries(draft).filter(([key, value]) => value !== settings.value[key]))
      setBusy(true); setError(''); setMessage('')
      try {
        const next = await request('save-settings', { revision: settings.revision, patch })
        if (!alive.current) return
        setSettings({ value: next.settings, revision: next.settingsRevision }); setDraft(next.settings); setStatus(next.status)
        applyRetention(next.settings.retainProse); setMessage(t.saved)
      } catch (problem) { if (alive.current) reportError(problem) }
      finally { if (alive.current) setBusy(false) }
    }
    async function saveGuidance() {
      setBusy(true); setError(''); setMessage('')
      try {
        const next = await request('save-guidance', { revision: guidance.revision, text: guidanceDraft })
        if (!alive.current) return
        setGuidance({ text: next.guidance, revision: next.guidanceRevision }); setGuidanceDraft(next.guidance); setMessage(t.guidanceSaved)
      } catch (problem) { if (alive.current) reportError(problem) }
      finally { if (alive.current) setBusy(false) }
    }
    function toggle(key) {
      return h('label', { className: 'dsh-sp-row', key },
        h('span', null, h('span', { className: 'dsh-sp-label' }, t[key]), h('small', null, t[key + 'Hint'])),
        h('input', { type: 'checkbox', checked: draft[key], onChange: event => edit(key, event.target.checked), 'aria-label': t[key] }))
    }
    function prompt(key) {
      return h('label', { className: 'dsh-sp-prompt', key }, h('span', { className: 'dsh-sp-label' }, t[key]),
        h('textarea', { value: draft[key], rows: 3, onChange: event => edit(key, event.target.value), 'aria-label': t[key] }), h('small', null, t.textHint))
    }
    const nativeLabel = native ? `${native.foldedReplies === 'final' ? t.final : t.all} · ${native.collapseTiming === 'next-input' ? t.nextInput : t.completion}` : t.unknown
    const stateLabel = settings?.value.enabled === false ? t.off : status.timelineLoaded && settings?.value.coordinateTimeline ? t.timeline : t.standalone
    return h('div', { className: 'dsh-stage-prose-settings' },
      h('div', { className: 'dsh-sp-toolbar' }, h('span', null, settingsDirty || guidanceDirty ? t.dirty : stateLabel),
        h('button', { type: 'button', disabled: busy, onClick: () => { if ((!settingsDirty && !guidanceDirty) || window.confirm(t.discard)) { setMessage(''); reload(true) } } }, t.reload)),
      h('p', { className: 'dsh-sp-native' }, `${t.native} · ${nativeLabel}`),
      error && h('p', { role: 'alert' }, error), message && h('p', { role: 'status' }, message),
      !draft ? h('p', { role: 'status' }, t.loading) : h('form', { onSubmit: saveSettings },
        h('fieldset', { disabled: busy }, h('legend', null, t.common), toggle('enabled'),
          h('label', { className: 'dsh-sp-row' }, h('span', null, h('span', { className: 'dsh-sp-label' }, t.everySteps), h('small', null, t.everyStepsHint)),
            h('input', { type: 'number', min: 1, max: 50, step: 1, value: draft.everySteps, 'aria-label': t.everySteps, onChange: event => edit('everySteps', event.target.value === '' ? '' : Number(event.target.value)) })),
          toggle('retainProse'), toggle('coordinateTimeline'),
          h('details', null, h('summary', null, t.advanced), prompt('tailReminder'), prompt('reminderZh'), prompt('reminderEn'), toggle('debugLog'),
            h('label', { className: 'dsh-sp-prompt' }, h('span', { className: 'dsh-sp-label' }, t.guidance),
              h('textarea', { rows: 8, value: guidanceDraft, 'aria-label': t.guidance, onChange: event => { setGuidanceDraft(event.target.value); setMessage('') } }), h('small', null, t.guidanceHint)),
            h('button', { type: 'button', disabled: !guidanceDirty, onClick: saveGuidance }, t.saveGuidance)),
          h('div', { className: 'dsh-sp-actions' }, h('button', { type: 'submit', className: 'dsh-sp-primary', disabled: !settingsDirty }, t.save))))
    )
  }
  function Page({ view }) {
    const locale = useSyncExternalStore(subscribeLocale, readLocale)
    return view === 'summary' ? h('p', null, words[locale.active.startsWith('zh') ? 'zh' : 'en'].summary) : h(Editor)
  }
  ctx.effect(() => {
    const style = document.createElement('style')
    style.textContent = css
    document.head.append(style)
    return () => style.remove()
  }, 'stage-prose.settings-style')
  for (const [name, key] of [['plugins.bundle.config', 'dsh-stage-prose'], ['plugins.row.config', 'dsh-stage-prose#stage-prose']]) {
    ctx.effect(() => ctx.slots.inject(name, () => ctx.slots.register({ name, key }, Page)), 'stage-prose.settings-page')
  }
}
