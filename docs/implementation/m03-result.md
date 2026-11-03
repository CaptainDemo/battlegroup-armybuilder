# M03 最终交付报告

日期：2026-11-03。**主Agent已接手完成M03并通过验证，随后暂停，M04未启动。** 最终行为及证据见[验收记录](m03-acceptance.md)，公开API见[契约说明](m03-contracts.md)。

GLM首轮交付需要返工，第二轮因额度中断；用户随后要求主Agent继续修改。本地完成包含：修复静态槽位被附属目标绕过的漏洞，补齐profile／option来源引用检查，修正两项不正确的测试构造，并核对七项返工要求。其余基础契约沿用a1／a2已落盘代码，保留完整历史证据。

最终验证：正常权限npm ci、类型检查、9文件144项单测、静态构建、5项系统Chrome测试、M01四来源指纹和23份账目均通过。完整命令与退出码在`.tmp/m03-local/`。发布产物只含应用HTML／CSS／JS；没有部署。首次沙箱复装EPERM及修复前失败用例均保留，不记为首次通过。

关键API变化：附属目标使用ownerSelectionId＋自己的稳定路径；公开解析入口核对精确身份；Classic边界锁定体系；不可直接购买分区被拒绝；编辑revision进入评估协议；第二Section有独立费用／组成；基础训练按购买上下文保存，不从BR推算。领域契约有类型与Zod，Evaluation／Availability没有执行实现。

本地接手不是Spacecraft新attempt。外部a1仍为needs_rework、a2仍为failed／needs_rework，没有伪造正式报告或改写其结果。以下仅是a1历史自述，部分内容已被审查否定、部分API已由返工替代，不是最终验收结论。

## 历史附录：外部a1原报告

日期：2026-11-03。任务：执行 [m03-spacecraft-task.md](m03-spacecraft-task.md) 的完整M03契约。本报告与 [m03-contracts.md](m03-contracts.md)（公开API、语义决定、检查分工、23账目映射）配套阅读。关联码：`SPACECRAFT_T20261103050906_206DCC9C_7C136F0D10C6`。

## 1. 完成状态

M03范围内完成：领域类型、Zod边界schema、纯结构/引用校验、合成契约样本与正负例测试全部实现并通过验证。未实现且不应实现（M04+）：目录加载器、编辑命令、计价引擎、规则执行、UI/存储/部署。Evaluation/Availability/RulesetModule 仅为协议类型，导出面有"无伪引擎"守卫测试。

18份必读输入的SHA256已逐一与派发冻结指纹核对一致后才开工；`.tmp/m03-dispatch/required-inputs.json` 为证。

## 2. 实际修改/新增文件

**packages/core/**（均新增，除标注外）：
- `package.json`（修改：声明 `zod@^4.6.7`，`sideEffects:false`）
- `src/index.ts`（修改：保留 `corePackageId`，重导出契约与校验）
- `src/contracts/primitives.ts`、`values.ts`、`source.ts`、`versioning.ts`、`catalog.ts`、`roster.ts`、`evaluation.ts`
- `src/validation/integrityIssue.ts`、`catalogRelations.ts`、`rosterRelations.ts`
- `src/samples/isolationCatalogs.ts`、`classicM01Catalog.ts`、`classicM01Rosters.ts`
- `src/contractsShape.test.ts`、`catalogRelations.test.ts`、`rosterRelations.test.ts`、`isolation.test.ts`、`evaluationProtocol.test.ts`（新增）；`src/dependencyBoundary.test.ts`（修改：core允许恰一个zod，classic为core+zod，继续禁React/DOM存储/跨体系）；`src/index.test.ts` 未改仍通过

**packages/rulesets/classic-coldwar/**：
- `package.json`（修改：直接声明zod）
- `src/index.ts`（修改：保留M02描述符供Web使用，追加schema导出）
- `src/training.ts`、`src/profiles.ts`、`src/classicSchema.ts`、`src/schema.test.ts`（新增）；`src/index.test.ts` 未改仍通过

**其他（writeScope内）**：`package-lock.json`（npm真实更新，`node_modules/zod@4.6.7`）；`docs/development.md`（M03入口、依赖边界、uv python说明）；`docs/implementation/m03-contracts.md`、`m03-result.md`（本文）；`.tmp/m03-validation/`（命令日志与退出码）。

无删除/重命名；未触碰 Web源文件、M01 fixtures、原始资料、AGENTS、任务契约及其他阶段文档；未提交/暂存/推送；无已跟踪文件被修改。`node_modules`、`apps/web/dist` 为工具生成物（dist经核对仅3个应用文件，不含references/fixtures/日志，zod经tree-shaking未进bundle）。

## 3. 关键设计决定（摘要）

1. 组成树用嵌套children（zod4 getter递归schema）；分区树与购买树用扁平ID+parent指针——使孤儿/循环可检测并各有负例。同层nodeId唯一、跨层同名合法（路径无歧义）。
2. 跨体系/错误revision引用：selection内嵌完整身份，与roster catalogRef不一致→报错并**跳过该选择一切条目级检查**，绝不借用本目录同localId记录（防结构层泄漏）。
3. 资源池以ruleset自定义resourceKind表达；`army-support-choice`与`platoon-support-slots`是Classic样本数据而非core常量；连内已含子排的局部名额用 formation-member+memberPath 授予，体现A02两池独立与"不重复授予"。
4. A03递归all：选项目标为声明式 `scope-selector`（匹配profile集合+includeSubFormations），roster记录编辑时显式成员路径；`resolveRosterMemberPath` 提供"条目组成+已购附属"合并视图，附属组成根在其挂载点可寻址（F01的12目标含2辆附属BMP运输）。
5. A04第二Fire Support建模为消耗 `platoon-support-slots` 的选项（per-target 35/+1，目标槽=platoon-1..3）。
6. profile身份视图在core非strict（规则体系目录可携带自有属性档案，core关系校验可直接运行于classic扩展目录）；catalog壳其余部分strict拒绝未知键。
7. one each = 组selectionLimit有限 + 各选项ownLimit=1，无冗余标志位；负例/正例覆盖。
8. 训练等级token只在classic精化（i/r/v/e含e；'p'拒绝）；core无训练枚举。
9. 附属条目按购买上下文独立entry（p.3公司AGL 35点 vs p.2独立排18点），同名不合并。

偏离说明：`python`在PATH中是WindowsApps存根（退出码49、无输出），按契约改用现有uv解释器 `uv run --python 3.12.13`，已在 development.md 记录。除此之外无偏离。

## 4. 验证命令与真实退出码

全部在仓库根目录执行；完整stdout/stderr存 `.tmp/m03-validation/`：

| # | 命令 | 退出码 | 结果 |
|---|---|---|---|
| 0 | `npm install`（锁文件更新） | 0 | zod 4.6.7 入锁 |
| 01 | `npm ci` | 0 | 复装通过 |
| 02 | `npm run typecheck` | 0 | 三包零错误 |
| 03 | `npm test` | 0 | 9文件/105测试全过 |
| 04 | `npm run build` | 0 | dist仅index.html+CSS+JS；无references/fixtures/日志；`_zod.def`在bundle中出现0次（tree-shaking生效） |
| 05 | `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` | 0 | 系统Chrome 5/5（预览4173端口空闲，未占用无关进程） |
| 06 | `uv run --python 3.12.13 python tools/data-import/check_m01_fixtures.py` | 0 | 4来源哈希/23账目一致，fixtures原件未改 |
| — | `python tools/data-import/check_m01_fixtures.py`（PATH存根） | 49 | 无输出；即上述uv替代的原因，非fixture问题 |

边界核对：`dependencyBoundary.test.ts` 5项断言全过；Web壳e2e不回归；`git status` 无已跟踪文件改动。

## 5. 样本映射与检查分工

详见 [m03-contracts.md](m03-contracts.md)：§5给出B01–B04/L01–L10/S01–S02/F01–F07共23份账目到契约能力的逐项映射（正例测试 `rosterRelations.test.ts` 以it.each断言全部23个结构零issue，含故意游戏违规的B02/B03/B04/S02/F03–F07——结构合法、规则不提前执行）；§3给出Zod形状检查与 `validateCatalogRelations`/`validateRosterRelations` 关系检查的逐项分工及明确未覆盖清单。三体系同名同localId隔离、NORTHAG分区/one-each/无实体请求在 `isolation.test.ts`。

## 6. 失败 / 未执行 / 受环境限制事项

- 无代码或验证失败。唯一环境适配是PATH python存根（退出49）改用uv解释器，已如实保留两份记录。
- 未执行：随包Chromium下载（契约明确沿用系统Chrome，未尝试）；Cloudflare/GitHub部署（超范围）。
- 未做（属后续模块，非本轮失败）：M04目录JSON与加载器、M05编辑命令、M06计价、M07规则执行、AirLand/NORTHAG真实数据、序列化迁移、UI/存储。

## 7. 剩余范围与最小下一步

M03按契约止步。建议的M04最小下一步：从M01已核实事实生成正式Classic JSON目录+manifest（复用本契约schema），实现构建期数据检查与静态目录加载/兼容结果；A05/A06仍按登记暂不开放。主Agent独立验收（含B→C差异、模型配置证据与独立复跑）后暂停，不自动派发M04。
