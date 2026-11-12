# 阶段输出 · DeepSeek Harness

[English](README.md) · [兼容记录](compat/ledger.json)

插件提示模型在长任务里简短说明进度。连续几步没有正文时，宿主会给模型补一条提醒。在「标准」工作步骤视图中，回合折叠后仍显示过程正文，思考和工具细节留在折叠组内。

从仓库打包后安装，桌面端请用应用附带的 DSH CLI。网页版把 `desktop` 改成 `web`。

```sh
npm pack
dsh plugin --profile desktop add ./dsh-stage-prose-1.0.0-rc.1.tgz --save-exact
```

安装后重启。兼容范围用于控制宿主是否加载，逐版本验证结果见兼容记录。

配置放在 `$DSH_HOME/plugin-data/dsh-stage-prose/`，没有设置 `DSH_HOME` 时用 `~/.dsh`。编辑 `guidance.md` 可调整主提示；在 `settings.json` 中，`enabled` 只控制静默提醒，`everySteps` 默认 3（允许 1–50），`debugLog` 默认关闭。也可设置 `tailReminder`、`reminderZh` 和 `reminderEn`。配置改动无需重启，提醒会作为插件上下文写入本机会话记录。

从 `@local/dsh-stage-prose` 升级时，先退出 DSH，在同一个 `DSH_HOME` 下执行 `node scripts/import-legacy.mjs <旧插件目录>`，然后移除旧包、安装新包。迁移保留已有用户文件，并在写入新格式前备份旧配置。卸载新包不会删除这些用户文件。
