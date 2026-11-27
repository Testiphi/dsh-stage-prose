# 阶段输出 · Stage Prose for DeepSeek Harness

[English](README.md) · [兼容记录](compat/ledger.json)

**让 DeepSeek Harness 在长任务中“边干边说”，完成后自动折叠过程、只留干净结果。**

**Stage Prose（阶段输出）** 为长链路、多步骤任务提供进度播报与界面整理。模型连续多步没有正文时，宿主通过插件上下文提醒它简短汇报阶段进度，无需用户追问，也无需额外启动一次模型请求。任务中显示阶段正文，完成后默认与思考、工具行一起折叠，让最终回答保持清晰可读。

> ⭐ 如果阶段输出让你的长任务更容易跟进，欢迎给仓库点个 **Star**，支持持续的 DSH 版本适配与兼容测试。

### 核心特性

- **每 N 步静默兜底播报（1–50 步可调）**。`everySteps` 默认 `3`，连续三步没有正文后，在下一步请求中提醒模型汇报进展。已有正文会重置计数，提醒附加到原有执行流中。
- **执行中实时可见，完成后自动折叠**。默认使用原生「标准」视图、「完成时收起」和「仅最终回答」，将阶段正文与思考、工具调用一起收起。需要完成后继续显示过程时，可开启 `retainProse: true`。DSH 中已有的显式显示设置优先。
- **免重启自定义提示词与中英文提醒**。`guidance.md` 和 `settings.json` 中的 `reminderZh`、`reminderEn`、`tailReminder` 按需读取，可随时调整播报风格。正文保留开关修改后刷新页面生效。
- **Timeline 协同与逐版本兼容证据**。`coordinateTimeline` 默认开启。Timeline 已启用且当前智能体能使用其规划工具时，由它负责维护提醒，减少两套提醒叠加。已记录与上下文、费用、安全、侧聊和侧栏插件组合测试的版本及结果，侧聊发送等未通过或未覆盖的路径也明确列出。详见[兼容记录](compat/ledger.json)。

### 安装

**Web 端通过 npm 安装。** 将预发布版装到 Web profile，再重启 Web 宿主：

```sh
dsh plugin --profile web add dsh-stage-prose@next --save-exact
```

**通过 tarball 安装。**

使用预构建的 `dsh-stage-prose-1.0.0-rc.2.tgz`，或在源码仓库中运行 `npm pack` 生成。请将命令中的示例替换为 tarball 的绝对路径。Windows 路径可写成 `E:/Downloads/dsh-stage-prose-1.0.0-rc.2.tgz`。

**桌面端。** 先启动一次 DeepSeek Harness Desktop 以初始化 profile，再从应用菜单彻底退出。用应用附带的 CLI。可以通过应用菜单的「管理 dsh 命令…」注册后打开新终端，也可以直接调用安装目录中的 `resources/runtime/cli/bin/dsh`（Windows 为 `dsh.cmd`）。通过 npm 安装的 DSH CLI 无法管理桌面 profile。

```sh
dsh plugin --profile desktop add "file:/absolute/path/to/dsh-stage-prose-1.0.0-rc.2.tgz" --save-exact
```

安装后重新打开桌面应用。请把 tarball 保存在固定路径，供 profile 按已保存的依赖重新安装时使用。

Web 端也可通过 tarball 安装。使用 Web CLI，将 tarball 安装命令中的 `--profile desktop` 换为 `--profile web`，安装后重启 Web 宿主。兼容范围用于控制宿主加载，逐版本验证结果见兼容记录。

### 配置与升级

插件默认将原生「工作步骤展示」设为「标准」、收起时机设为「完成时」、收起后的回复设为「仅最终回答」。任务中显示阶段正文，回合完成后与工具行一起折叠。DSH profile 或 home 设置中的显式用户配置优先于插件默认值。

`retainProse` 单独控制浏览器样式，默认 `false`。设为 `true` 后，完成并收起时阶段正文仍会保留。修改后刷新页面生效。schema 0 或 1 的旧设置会先备份，再迁移到 schema 2；缺少正文开关时设置 `retainProse: false`，已有显式开关值和自定义设置予以保留。

`coordinateTimeline` 默认 `true`。检测到已启用的官方或独立版 Timeline 加载项，且当前智能体能使用它的规划工具时，由 Timeline 负责维护提醒，阶段输出保留固定的进度播报指导。设为 `false` 可同时使用两套提醒。

Timeline 未安装或已停用时，阶段输出按自己的 `everySteps` 阈值独立提醒。兼容记录列出了上下文、费用、侧聊、安全与侧栏插件共同安装时的确切版本和实测路径。DSH 0.2 的组合验证使用 Side Chat 的 GitHub 预构建 v1.2.1 发行包。

配置放在 `$DSH_HOME/plugin-data/dsh-stage-prose/`，没有设置 `DSH_HOME` 时用 `~/.dsh`。编辑 `guidance.md` 可调整主提示；在 `settings.json` 中，`enabled` 只控制静默提醒，`everySteps` 默认 3（允许 1–50），`debugLog` 默认关闭。也可设置 `tailReminder`、`reminderZh` 和 `reminderEn`。配置改动无需重启，提醒会作为插件上下文写入本机会话记录。

从 `@local/dsh-stage-prose` 升级时，先彻底退出桌面应用或停止 Web 宿主。在终端中使用与应用相同的 `DSH_HOME`。如果应用使用默认的 `~/.dsh`，可以不设置该变量。导入脚本在源码仓库中，旧插件目录必须同时包含 `settings.json` 和 `guidance.md`。从源码仓库运行：

```sh
node scripts/import-legacy.mjs "/absolute/path/to/old/plugin-directory"
```

脚本会打印 `plugin-data/dsh-stage-prose/` 下的目标路径，并只复制缺失的文件。迁移未标注版本的设置前，会在同一目录保存 `settings.json.v0.<id>.bak`。

检查导入结果后，用桌面附带的 CLI 运行 `dsh plugin --profile desktop remove @local/dsh-stage-prose` 移除旧包。Web 端使用 `--profile web`。将新 tarball 安装到同一个 profile，再重新打开应用。卸载新包会保留这些用户文件，供重装时使用。
