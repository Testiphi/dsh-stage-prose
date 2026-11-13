# 阶段输出 · DeepSeek Harness

[English](README.md) · [兼容记录](compat/ledger.json)

插件提示模型在长任务里简短说明进度。连续几步没有正文时，宿主会给模型补一条提醒。在「标准」工作步骤视图中，回合折叠后仍显示过程正文，思考和工具细节留在折叠组内。

### 安装

使用预构建的 `dsh-stage-prose-1.0.0-rc.1.tgz`，或在源码仓库中运行 `npm pack` 生成。请将命令中的示例替换为 tarball 的绝对路径。Windows 路径可写成 `E:/Downloads/dsh-stage-prose-1.0.0-rc.1.tgz`。

**桌面端。** 先启动一次 DeepSeek Harness Desktop 以初始化 profile，再从应用菜单彻底退出。用应用附带的 CLI。可以通过应用菜单的「管理 dsh 命令…」注册后打开新终端，也可以直接调用安装目录中的 `resources/runtime/cli/bin/dsh`（Windows 为 `dsh.cmd`）。通过 npm 安装的 DSH CLI 无法管理桌面 profile。

```sh
dsh plugin --profile desktop add "file:/absolute/path/to/dsh-stage-prose-1.0.0-rc.1.tgz" --save-exact
```

安装后重新打开桌面应用。请把 tarball 保存在固定路径，供 profile 按已保存的依赖重新安装时使用。

**Web 端。** 使用 Web CLI，将安装命令中的 `--profile desktop` 换为 `--profile web`，安装后重启 Web 宿主。兼容范围用于控制宿主加载，逐版本验证结果见兼容记录。

### 配置与升级

配置放在 `$DSH_HOME/plugin-data/dsh-stage-prose/`，没有设置 `DSH_HOME` 时用 `~/.dsh`。编辑 `guidance.md` 可调整主提示；在 `settings.json` 中，`enabled` 只控制静默提醒，`everySteps` 默认 3（允许 1–50），`debugLog` 默认关闭。也可设置 `tailReminder`、`reminderZh` 和 `reminderEn`。配置改动无需重启，提醒会作为插件上下文写入本机会话记录。

从 `@local/dsh-stage-prose` 升级时，先彻底退出桌面应用或停止 Web 宿主。在终端中使用与应用相同的 `DSH_HOME`。如果应用使用默认的 `~/.dsh`，可以不设置该变量。导入脚本在源码仓库中，旧插件目录必须同时包含 `settings.json` 和 `guidance.md`。从源码仓库运行：

```sh
node scripts/import-legacy.mjs "/absolute/path/to/old/plugin-directory"
```

脚本会打印 `plugin-data/dsh-stage-prose/` 下的目标路径，并只复制缺失的文件。迁移未标注版本的设置前，会在同一目录保存 `settings.json.v0.<id>.bak`。

检查导入结果后，用桌面附带的 CLI 运行 `dsh plugin --profile desktop remove @local/dsh-stage-prose` 移除旧包。Web 端使用 `--profile web`。将新 tarball 安装到同一个 profile，再重新打开应用。卸载新包会保留这些用户文件，供重装时使用。
