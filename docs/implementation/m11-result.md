# M11 打印与 PDF 视图交付记录（r2 修订）

日期：2026-11-10。开工提交 `6b6fded`；本轮为 a1 的显式返工修订（任务
`t20261110012332-5eea923d` revision 2），依据 [a1 审查](m11-review-a1.md)修复四类
已独立复现的问题。执行方式：Spacecraft 外部实现轮（GLM 代码实现授权，
open.bigmodel.cn，原生 auto 权限模式），关联码
`SPACECRAFT_T20261110012332_5EEA923D_4DEEBA44F731`。仅实现 M11 修正；未执行任何
Git 暂存／提交／推送、未部署、未推进 M12。审查记录、`.tmp/m11-review/` 下主 Agent
的独立检查与配置、`.tmp/m11-review/a1-evidence/` 历史证据均只读未改；未通过弱化
断言、改目录或切版本使检查通过（检查文件原样，六项全部原样通过）。

## a1 → r2 修正内容

1. **固定子排组成去重（保留不漏印）**：`printProjection.ts` 重构组成行生成——
   购买自身的组成行不再包含固定子排（configurableSlot platoon）子树（也去掉
   “1 × platoon” 包装行），固定子排成员只印在其独立标题块内；子排块保留父链
   标题、自身训练等级、成员行与挂载附件。结果：真实 1.1.0 目录未升级 BMP-1 连
   的 10 辆 BMP-1（1 连指挥 + 3×3 排内）正文恰好各印一次（a1 印 19 辆）。
2. **评估版本三元组校验**：在原五重身份检查后新增三项——
   `Evaluation.identity.versions` 的 schemaVersion／rulesRevision／catalogRevision
   与 release manifest 逐项对照，任一漂移返回 `stale`
   （`evaluation-schema-version`／`evaluation-rules-revision`／
   `evaluation-catalog-revision`），不再印出互相矛盾的版本与费用。
3. **可选规则上纸**：`settings.optionalRules` 非空时在页眉设置区按文本列出
   （“Optional rules” 标签），不添加规则效果、不改存档。
4. **旧目录叶子根组成保留**：带 profile 的组成根本身即为成员（精确 1.0.0 目录
   `brdm2-recon` 的 BRDM-2 ×1），没有子节点不再导出空组成；叶子排同理。

新增正式回归：`printProjection.test.ts` 6 项（真实 1.1.0 目录成员唯一性与结构、
三类版本漂移 it.each、可选规则静态渲染、1.0.0 叶子根）；
`tests/e2e/roster-print.spec.ts` 增至 4 项——长军表纸面按行精确计数
（BMP-1 行 = 15、T-72A 行 = 30）并断言可选规则文本；新增精确 1.0.0 目录导入打印
检查（纸面印 1.0.0 版本行、BRDM-2 叶子根行带训练等级、不出现 1.1.0 的
rulesRevision），并输出第三份 PDF 证据。

## 实际修改（全部在原 writeScope 内）

修改：`apps/web/src/features/roster-output/printProjection.ts`、
`apps/web/src/features/roster-output/PrintPreview.tsx`、
`apps/web/src/features/roster-output/printProjection.test.ts`、
`tests/e2e/roster-print.spec.ts`、`apps/web/src/i18n/en.ts`（Optional rules 词条）、
`docs/implementation/m11-contracts.md`、本文。
`RosterWorkspace.tsx`／`styles.css`／路由／`unitData.ts`／core／rulesets／目录与
资料包／存储与导入导出：本轮未再改动（a1 版本即最终版）。
a1 轮交付的其余文件（README、development.md、implementation_modules.md）保持
a1 内容，仅其描述的行为现已与 r2 实现一致；implementation_modules.md 的 M11 状态
行已同步 r2。

## 验证（真实命令与退出码）

全部在仓库根执行；完整 stdout/stderr 于 `.tmp/m11/`：

| 命令 | 退出码 | 结果 | 日志 |
| --- | --- | --- | --- |
| `npm run typecheck` | 0 | 三包 tsc 无错误 | `r2-typecheck-2.log`（过程首次 `r2-typecheck-1.log` 退出 1：测试对 readonly `identity` 赋值，改为重建对象后通过） |
| `npm test` | 0 | 27 文件／**357 通过**（a1 351 + 本轮 6） | `r2-unit-2.log` |
| `npm run build` | 0 | 含 `check:catalogs`，产物 `apps/web/dist` | `r2-build-1.log` |
| `PLAYWRIGHT_CHANNEL=chrome npx playwright test` | 0 | **22 通过**（既有 18 + 打印 4），约 23s | `r2-e2e-all-1.log` |
| `npx vitest run --config .tmp/m11-review/vitest.config.ts` | 0 | 主 Agent 六项独立检查**原样通过** | `r2-probes-final.log`（修复前 `probes-r2-1.log` 退出 1 系 value import 误置于 `import type`，修正后 `probes-r2-2.log` 起 6/6） |

打印专项 4 项（`r2-e2e-print-3.log`，退出 0）：当前草稿打印／关闭重开最新化／
撤销不丢；长军表 A4 PDF（可选规则上纸、BMP-1 行 15／T-72A 行 30 精确计数、
print 媒体隐藏全部编辑 chrome 且无横向溢出、360px 预览无溢出）；违规／覆盖军表
PDF；精确 1.0.0 目录打印（含第三份 PDF）。首轮 `r2-e2e-print-1.log` 退出 1：
1.0.0 BRDM-2 叶子根行带训练等级后缀 “(Regular)”，断言从裸行名改为整行
`1 × BRDM-2 (Regular)` 后通过——该后缀本身是正确行为（训练等级随行显示）。

### 纸面证据（.tmp/m11/，供人工核对；均由最终构建生成）

| 文件 | 内容 |
| --- | --- |
| `roster-long.pdf` | **9 页 A4**（a1 为 11 页；去重后页数自然减少）。FHQ＋3×T-72 连＋BMP-1 连（三固定子排＋逐排锚定附件）＋BMP-1 排（3 目标 BG-15）＋ZSU／BRDM／场外炮兵＋长备注。纸面行精确计数：`1 × BMP-1` 行 15、`1 × T-72A` 行 30（= 目录组成，无一重复、无一遗漏）；页眉含 “Optional rules long-print-optional-rule”；Points 2333／BR 116／剩余 2667／“No violations found within implemented checks. Coverage is partial.” |
| `roster-violations.pdf` | **4 页 A4**。C09／C01／C02／C13／C16 违规及定位、“Violations confirmed”、覆盖 not implemented、备注 HTML 按文本渲染；`1 × BMP-1` 行 3、`1 × T-72A` 行 3（T-72 排 3 辆）与目录一致。 |
| `roster-legacy-1-0-0.pdf` | **2 页 A4**。精确 1.0.0 目录：纸面印 `soviet-armoured-division-v4_1 · 1.0.0` 与 `cw-draft6+sov-v4.1`（不出现 1.1.0 的 `+formations1`）；BRDM-2 叶子根行 `1 × BRDM-2 (Regular)` 在正文印出。 |
| `long-page-01..09.png`、`violations-page-01..04.png`、`legacy-page-01..02.png` | 逐页 110dpi 图像（uv＋PyMuPDF 临时渲染，仅证据用，未入工程依赖）。 |
| `roster-long-preview.png`、`roster-violations-preview.png` | 预览覆盖层全页截图。 |
| `render_pages.py`、`*.log` | 渲染脚本与全部命令日志。 |

已目检关键页图像：长军表第 1 页（页眉含可选规则与总额）、第 5 页（BMP-1 连三个
固定子排块，成员各印一次，附件挂对子排）、旧目录第 1 页（版本行与 BRDM-2 叶子根）。
浏览器打印经 `window.print()`／Chromium `page.pdf()` 真实打印媒体输出；**未连接
物理打印机，实体打印未验证**。

## 与验收条件对照

- 主 Agent 六项独立检查原样通过（`r2-probes-final.log`，退出 0）。
- 正文每个固定组成成员只印一次（单测＋纸面 15/30 精确计数）；精确旧目录叶子根
  数量完整（单测＋e2e＋第三份 PDF）；三类评估版本漂移拒绝（it.each 单测＋探针）；
  已选可选规则按文本印出（单测静态渲染＋e2e＋纸面）。
- 既有保证全部保留：合计与编辑器同快照一致、不重复计价、父子附件与锚定、草稿
  刷新与撤销、违规／覆盖／三态值、A4 无编辑控件、360px 可操作（22 项 e2e 通过）。
- 未修改发布目录、资料包、领域规则／存储格式、AGENTS、审查记录与 a1 证据；
  未新增依赖；未提交／部署。

## 已知限制与剩余项

- 未验证实体打印机；打印样式仅系统 Chrome（headless）验证。
- 纸面未内置页码／总页数；训练等级／规模仍为目录词显示，未做本地化词典。
- M12 完整闭环验收与部署不在本轮范围。
