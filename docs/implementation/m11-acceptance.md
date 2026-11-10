# M11 主 Agent 独立验收

日期为 2026-11-10。结论：M11 在本批范围内验收通过，停止于打印与 PDF 交付；尚未提交、推送或部署，M12 的线上打印闭环仍待后续执行。

## 本轮结果与边界

任务 `t20261110012332-5eea923d`，revision 2／attempt a2，正式结果 SHA-256 为 `2d2cb8cb3909714d9ae98777b1f030d8f9689d791ef8b6df99a963191e1c6c79`。实际使用 Claude Code／open.bigmodel.cn／GLM-5.3，effort max，续接同一 session `89fc2e94-3f97-49f0-914e-0b007513755e`，本轮 70 轮、退出 0，进程停止且 Job 排空。本轮新关联码为 `SPACECRAFT_T20261110012332_5EEA923D_4DEEBA44F731`，不是 a1 的旧结果。

主 Agent 逐项重算 49 个新增／修改交付文件哈希，均与本轮 B→C 记录相同；14 个不在 writeScope 内的冻结输入均未变化，包括 AGENTS、原交接契约、a1 审查及独立检查。未观察到范围外修改。两张过期的临时页图 long-page-10／11 在重新生成 9 页长军表时被删除；a1 原始 11 页证据已另行完整归档，无源文件删除。

保留 [a1 审查](m11-review-a1.md)及其 needs_rework 处置，不能以 a2 通过覆盖初次失败。a1／a2 外部原始证据分别归档于 `.tmp/m11-review/a1-evidence/`、`a2-evidence/`。正式外部 result.md 保持原样；该报告称“17 张逐页图像”属于计数笔误，实际三份 PDF 共 9＋4＋2＝15 页，以本次独立渲染为准。

## 独立验证

全部在本工程根执行，完整日志及真实退出码 JSON 保存在 `.tmp/m11-review/`。

| 检查 | 结果 | 退出码／证据 |
|---|---|---|
| `npm run typecheck` | 通过 | 0，a2-independent-typecheck.log／-exit.json |
| `npm test` | 27 个文件，357 项通过 | 0，a2-independent-unit.log／-exit.json |
| 原样运行主 Agent 的 a1 复现检查 | 6 项通过 | 0，a2-independent-probes.log／-exit.json |
| `npm run build` | 数据门禁及生产构建通过 | 0，a2-independent-build.log／-exit.json |
| 独立端口 Chrome 回归 | 22 项通过，包含既有 18 项及打印 4 项 | 0，a2-independent-browser.log／-exit.json；端口 4277、reuseExistingServer=false |
| 额外打印按钮实际交互 | 1 项通过，点击触发一次 window.print，关闭预览后恢复 398 Points 草稿且清除打印样式状态 | 0，a2-print-action.log／-exit.json |
| `git diff --check` | 通过 | 主 Agent 终检 |

6 项原样复现检查分别覆盖：固定子排组成不重复、评估 schemaVersion／rulesRevision／catalogRevision 三种错配拒绝、已选可选规则输出、精确 1.0.0 目录叶子根组成保留。正式投影测试也已覆盖这些回归。主 Agent 没有修改实现代码或放宽独立检查。

生产主 JS 为 599.24 kB，gzip 172.58 kB，保留既有的 500 kB 分块警告；它不是本次打印失败。PowerShell 重定向日志中对 npm notice／构建警告生成的 NativeCommandError 文本与真实命令退出码分开核对，各验收命令实际退出均为 0。

## 纸面核对

独立浏览器回归重新生成三份真实 A4 PDF。主 Agent 再从 PDF 本身渲染全部页面，并逐页查看，不依赖外部协作者提供的旧截图。

| PDF | 页数 | 核对内容 |
|---|---|---|
| `.tmp/m11/roster-long.pdf` | 9 | 2333 Points／116 BR／剩余 2667；可选规则及长备注可见；BMP-1 连正文 10 辆，加附件及独立排后共 15 辆；三连共 30 辆 T-72A；固定子排附件分别归属正确，逐目标 BG-15 三次计费合计 15 Points |
| `.tmp/m11/roster-violations.pdf` | 4 | 313 Points／16 BR／剩余 −213；违规及所属购买、部分覆盖和 no-entities 原因保留；玩家 HTML 字样作为文本印出 |
| `.tmp/m11/roster-legacy-1-0-0.pdf` | 2 | 明确显示 1.0.0 及其 rulesRevision；1 × BRDM-2 (Regular) 叶子根成员完整，未切换到 1.1.0 |

全部 15 页的文字边界均在纸内。人工检查确认长块正常跨页、表头延续、末页内容与快照 revision 完整，没有因编辑器折叠遗漏成员或把固定子排重复打印。独立逐页图像、提取文本与边界检查 JSON 位于 `.tmp/m11-review/a2-independent-pdf/`。

## 适用范围与后续

- 已验证系统 Chrome 生成 PDF，以及界面按钮调用浏览器打印；没有连接实体打印机，未验证 Safari／Firefox 的分页。
- 打印的车辆／武器速查目前是型号和携带清单，不是完整的车辆卡／武器属性手册。原编辑器的单位属性和资料包不变。
- 纸面未内置页码／总页数，浏览器打印对话框可另选页眉页脚。大编制可以跨页，部分小标题或费用表会延续到下一页。
- 原有 Classic 编制数据、规则、保存格式、导入导出逻辑及依赖未改。AGENTS.md 不提交，原始参考资料与临时证据不随网站发布。
- 额度查询时，Codex 五小时窗口剩余 77%，周窗口剩余 84%。本轮不自动启动下一阶段。
