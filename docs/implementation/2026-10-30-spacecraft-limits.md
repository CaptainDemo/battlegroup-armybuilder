# Spacecraft执行上限升级记录

日期：2026-10-30。用户授权Claude Code + GLM实现M02/M03，并选择先把插件上限提高到5400秒、200轮再派发。

## 变更

在`C:/Projects/Respositories/spacecraft2/plugins/spacecraft-collaboration/`修改：

- `src/contract.ts`：CAPS上限变为5400秒及200轮，下限不变。
- `src/server.ts`：delegate_task与continue_task的新契约schema均引用同一CAPS，避免两处上限漂移。
- `tests/contract.test.mjs`：补充review/consult/implement接受5400/200、拒绝5401/201，并保持3600/64兼容的测试。
- `skills/collaboration/SKILL.md`：同步允许范围。

构建后仅安装`dist/contract.js`、`dist/server.js`及技能说明三个文件。修改前文件均在本工程`.tmp/spacecraft-limit-upgrade/before/`备份；未提交／推送，未修改模型配置，也未在升级验证中创建模型任务。

## 验证与边界

类型检查、构建、契约测试6/6通过。修正独立schema探针的Windows ESM路径格式后，源码及安装副本各启动独立MCP进程，只调用listTools，确认delegate_task和continue_task均公布5400/200；不涉及外部模型请求。安装三文件哈希与源码产物匹配。

证据保留在`.tmp/spacecraft-limit-upgrade/`：`source-changes.json`、`check.*`、`build.*`、`contract-tests.*`、`source-schema.json`、`install-plan.json`、`install-result.json`、`installed-schema.json`。

这些证明源码及磁盘安装有效，**尚不证明原有桌面MCP进程已重载**。M02必须通过当前真实工具接受5400/200契约后才可称已派发；若旧进程仍拒绝新上限，需用户重启Codex后重试原任务，不降回旧上限、不通过独立SDK伪造桌面调用者。

根AGENTS.md和M02/M03交接单已准备。派发前重新计算所有必要输入哈希，保留既有未跟踪资料；任务运行时主Agent不并行修改本工程。

## 当前桌面实际派发尝试

当前对话通过真实Spacecraft delegate_task提交M02，明确5400秒、200轮、effort=max。返回`apptools_discovery_failed`，消息为`CODEX_CLI_PATH is not set or does not point at the desktop CLI; cannot discover the App Tools server`。

安装源码核对显示这是App Tools发现预检失败，发生在模型任务启动之前；随后list_tasks仍仅有历史咨询`t20261022030701-1c32f173`，没有新M02任务。不能声称M02已登记／运行，也不能据此证明当前桌面已接受新参数上限（预检可能先于参数规范化）。未降低参数、未用独立SDK伪造桌面调用者、未反复重试。

下一步需要重新加载桌面插件及其环境，之后先复核App Tools发现。重启不保证自动补齐CODEX_CLI_PATH，若仍失败应定位实际桌面CLI发现机制，保留原错误，不能把全局npm codex命令直接冒充桌面内置CLI。M02输入哈希保存在`.tmp/spacecraft-limit-upgrade/m02-required-inputs.json`；输入有变更时重新冻结，再决定是否更换requestKey。

## 用户重启后的诊断与配置修正

用户确认重启后，必读文件哈希与先前相同，真实delegate_task仍在App Tools发现预检失败，错误不变；未启动新模型任务。没有降低5400秒／200轮限制。

本地检查发现：当前环境有CODEX_MCP_NODE_PATH，但没有CODEX_CLI_PATH。本机实际缓存`AppData/Local/OpenAI/Codex/bin/codex.exe`报告0.130.0-alpha.5，执行插件原来的`plugin list --marketplace openai-bundled --json`返回unrecognized subcommand，不能仅补这个路径后声称可用。

实际安装的官方codex-app-tools 26.1027.30824的.mcp.json明确给出server.mjs入口。采用Spacecraft**已有**的SPACECRAFT_APPTOOLS_SERVER覆盖配置，仅修改本机安装副本.mcp.json的env字段，不修改全局模型／账号配置或来源身份、不再修改源码、不构造元数据。原配置已备份于`.tmp/spacecraft-limit-upgrade/before/installed/.mcp.json`。该固定版本路径是本次机器安装配置，App Tools升级后需要重新核对，不能作为跨机器通用发现算法。

配置后独立进程调用discoverAppTools，返回实际server路径与via=env-override；结果在`app-tools-config-result.json`。这只证明配置可以绕过失效的CLI发现路径，尚不证明当前桌面旧MCP进程已重载，也不证明任务通知完成。

辅助只读SDK探针先遇到sandbox管道EPERM；以允许管道访问的执行环境重试后返回“require thread metadata from the executor”。探针没有传入线程元数据，故这不是Spacecraft真实通知路径损坏的证据；没有伪造_meta、没有发送线程消息，不为此追加产品故障结论。

**当前下一步：重新加载Spacecraft插件或重启Codex，使新增env生效，再从真实工具入口提交同一M02契约。** 不在未重载时循环派发。原授权、M02目标和5400秒／200轮保持，M03仍在M02验收之后。
