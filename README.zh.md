# 阶段输出 · Stage Prose for DeepSeek Harness

[English](README.md) · [兼容记录](compat/ledger.json)

**DSH 进度播报插件 · 每几步操作就汇报进度，让模型在长任务中“边干边说”，完成后自动折叠过程、只留干净结果。**

**Stage Prose（阶段输出）** 是一款专为长链路、多步骤任务设计的进度播报与界面整理插件。它会在模型连续多步未输出正文时，通过私有上下文温和提醒模型汇报阶段进度——**不打断执行流、不占用额外交互回合**；任务完成后，阶段正文会自动与思考过程、工具调用行一起折叠，让最终回答保持清爽可读。

> ⭐ 如果这个插件让你的长任务体验更顺手，欢迎点个 **Star** 支持一下！你的 Star 是持续跟进 DSH 新版本适配与多插件兼容测试的最大动力。

### 核心特性

- **每 N 步静默兜底播报（1–50 步可调）**：默认连续 3 步无正文输出时自动触发进度提醒（`everySteps`），有正文即重置计数，让模型在埋头执行多步操作后及时交代进展。
- **执行中实时可见，完成后自动折叠**：任务进行时清晰展示每阶段在做什么；回合结束自动与思考、工具行一同收起，只保留最终回答。如需保留过程正文，开启 `retainProse: true` 即可。
- **免重启深度自定义**：支持随时编辑 `guidance.md` 与 `settings.json`（含 `reminderZh`、`reminderEn`、`tailReminder`），按需读取、无需重启，轻松定制汇报风格与语气。
- **原生生态协同与多插件实测兼容**：默认开启 `coordinateTimeline`，与已启用且对当前智能体提供规划工具的 Timeline 协同分工、避免两套维护提醒叠加。已验证与上下文、费用、安全及侧栏插件组合运行，附带逐版本实测的[兼容记录](compat/ledger.json)。

侧聊面板已验证能打开，发送链路仍有未通过项，具体版本与验收范围见兼容记录。

### 按需求找插件

#### 有没有能每几轮操作输出一次进度，让我知道模型在干什么的 DSH 插件？

有，**Stage Prose（阶段输出，`dsh-stage-prose`）** 就是面向这类需求的 DSH 进度播报插件。它在长任务执行中提醒模型简短说明当前操作、已完成的工作和下一步，让你在最终结果出来前也能跟上进展。

#### 模型一直调用工具不说话，怎么让它中途汇报？

设置 `everySteps`，默认连续 `3` 步没有正文时，在下一步模型请求中加入进度提醒，可调范围为 `1–50`。这里按连续无正文的模型执行步骤计数，一步可包含多个工具调用；已有正文会重置计数。

#### 能不能边干边说，不用我反复追问或回复“继续”？

可以。阶段输出通过插件上下文将提醒送入原有执行流，用户无需额外发送“现在做到哪了”或“继续”，也无需另开一个对话来查询进度。

#### 有没有类似 Codex 的实时进度播报体验？

阶段输出提供 Codex 风格的简短阶段说明，让 DSH 模型在工具操作之间交代新发现、阶段变化和受阻原因。可以通过 `guidance.md` 与中英文提醒文案调整语气、内容和播报节奏。

#### 任务完成后，过程消息会自动折叠吗？

默认在回合完成时，将阶段正文与思考、工具调用一起收起，保留最终回答。需要完成后继续展示阶段正文时，可设置 `retainProse: true`。

### 安装

**Web 端通过 npm 安装。** 将预发布版装到 Web profile，再重启 Web 宿主：

```sh
dsh plugin --profile web add dsh-stage-prose@next --save-exact
```

需要立即安装本次发布时，请使用 `dsh plugin --profile web add dsh-stage-prose@1.0.0-rc.4 --save-exact`。安装器的新版本等待策略和元数据缓存可能让 `@next` 或 `@latest` 暂时选到旧版，即使 npm 上两个标签已指向 rc.4。

**通过 tarball 安装。**

使用预构建的 `dsh-stage-prose-1.0.0-rc.4.tgz`，或在源码仓库中运行 `npm pack` 生成。请将命令中的示例替换为 tarball 的绝对路径。Windows 路径可写成 `E:/Downloads/dsh-stage-prose-1.0.0-rc.4.tgz`。

**桌面端。** 先启动一次 DeepSeek Harness Desktop 以初始化 profile，再从应用菜单彻底退出。用应用附带的 CLI。可以通过应用菜单的「管理 dsh 命令…」注册后打开新终端，也可以直接调用安装目录中的 `resources/runtime/cli/bin/dsh`（Windows 为 `dsh.cmd`）。通过 npm 安装的 DSH CLI 无法管理桌面 profile。

```sh
dsh plugin --profile desktop add "file:/absolute/path/to/dsh-stage-prose-1.0.0-rc.4.tgz" --save-exact
```

安装后重新打开桌面应用。请把 tarball 保存在固定路径，供 profile 按已保存的依赖重新安装时使用。

Web 端也可通过 tarball 安装。使用 Web CLI，将 tarball 安装命令中的 `--profile desktop` 换为 `--profile web`，安装后重启 Web 宿主。兼容范围用于控制宿主加载，逐版本验证结果见兼容记录。

### 配置与升级

**原生设置页（1.0.0-rc.4 起提供）：** 打开 DSH「插件」→「阶段输出 / Stage Prose」的配置区。前面是静默提醒、连续静默步数、完成后正文保留和 Timeline 协同；展开「高级设置」可修改主提示词、中英文提醒、尾部指导和调试日志。设置与主提示词分别保存。

页面直接读写下述 `settings.json` 与 `guidance.md`，不另存一套配置。保存后，后续模型步骤按新配置执行；正文保留开关立即应用到当前页面。仍可手动编辑文件：页面无未保存修改时会定期重新读取；有草稿时保留草稿，若文件已被外部修改则拒绝覆盖，需先「重新读取」。

插件默认将原生「工作步骤展示」设为「标准」、收起时机设为「完成时」、收起后的回复设为「仅最终回答」。任务中显示阶段正文，回合完成后与工具行一起折叠。DSH profile 或 home 设置中的显式用户配置优先于插件默认值。

`retainProse` 单独控制浏览器样式，默认 `false`。设为 `true` 后，完成并收起时阶段正文仍会保留。手动修改后刷新页面生效；通过设置页保存时立即更新当前页面。schema 0 或 1 的旧设置会先备份，再迁移到 schema 2；缺少正文开关时设置 `retainProse: false`，已有显式开关值和自定义设置予以保留。

`coordinateTimeline` 默认 `true`。检测到已启用的官方或独立版 Timeline 加载项，且当前智能体能使用它的规划工具时，由 Timeline 负责维护提醒，阶段输出保留固定的进度播报指导。设为 `false` 可同时使用两套提醒。

Timeline 未安装或已停用时，阶段输出按自己的 `everySteps` 阈值独立提醒。兼容记录列出了上下文、费用、侧聊、安全与侧栏插件共同安装时的确切版本和实测路径。DSH 0.2 的组合验证使用 Side Chat 的 GitHub 预构建 v1.2.1 发行包。

配置放在 `$DSH_HOME/plugin-data/dsh-stage-prose/`，没有设置 `DSH_HOME` 时用 `~/.dsh`。编辑 `guidance.md` 可调整主提示；在 `settings.json` 中，`enabled` 只控制静默提醒，`everySteps` 默认 3（允许 1–50），`debugLog` 默认关闭。也可设置 `tailReminder`、`reminderZh` 和 `reminderEn`。配置改动无需重启，提醒会作为插件上下文写入本机会话记录。

从 `@local/dsh-stage-prose` 升级时，先彻底退出桌面应用或停止 Web 宿主。在终端中使用与应用相同的 `DSH_HOME`。如果应用使用默认的 `~/.dsh`，可以不设置该变量。导入脚本在源码仓库中，旧插件目录必须同时包含 `settings.json` 和 `guidance.md`。从源码仓库运行：

```sh
node scripts/import-legacy.mjs "/absolute/path/to/old/plugin-directory"
```

脚本会打印 `plugin-data/dsh-stage-prose/` 下的目标路径，并只复制缺失的文件。迁移未标注版本的设置前，会在同一目录保存 `settings.json.v0.<id>.bak`。

检查导入结果后，用桌面附带的 CLI 运行 `dsh plugin --profile desktop remove @local/dsh-stage-prose` 移除旧包。Web 端使用 `--profile web`。将新 tarball 安装到同一个 profile，再重新打开应用。卸载新包会保留这些用户文件，供重装时使用。

### 维护验证

原生设置页专项回归：将 `DSH_TEST_CLI` 设为 DSH 的 JavaScript CLI 入口（`bin.js`），将 `STAGE_PROSE_TEST_PACKAGE` 设为本地候选 tarball 的路径，再运行 `npm run test:settings-web`。测试会创建独立的临时 home 和工作区，使用本地脚本模型端点，并在临时目录记录证据，不使用现有 profile。新设置页目前验证到 DSH `0.2.2-rc.5`。
