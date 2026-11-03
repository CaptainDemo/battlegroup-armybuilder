# NORTHAG 新增资料的设计影响评估

日期：2026-10-29。评估基线为技术方案 v0.3 与本地 `references/NORTHAG_Soviet_Agent_Reference/`。本文提出设计补充，不将参考包中的待核对数值直接提升为正式游戏数据。

## 1. 结论

React / TypeScript / Vite、纯函数核心、独立规则模块、本地保存和 Sites 测试路线仍适用。Classic 优先、三套游戏数据完全隔离的决定继续成立。NORTHAG 新资料主要影响核心数据契约及规则边界，不要求更换网站技术栈或立即增加后端。

Classic 开发期间应保留 NORTHAG 已暴露出的结构能力，不必等待 NORTHAG 完整军表录入。原始资料目录中的实现指南属于参考建议；其中 NORTHAG 优先、对局状态实现等说法不自动替代本项目已确定范围。

## 2. 本次证据范围

- 阅读资料包 README、组军规则、苏联军表索引、属性说明、实现指南、v9 应用清单、卡片勘误对照、在线来源核查记录及测试计划；检查主要 JSON 的层级、状态和样本。
- 用 pypdf 直接读取本地 `NORTHAG_2020_Official_Errata_v9.pdf` 的文件第 1、7–10、12 页。首页确认适用 2020 printing、Version 9、截至 2025-05-09；第 7 页确认原书 p.72 的 one of → one each；第 10 页确认移除 AA missiles 的 AT 值、移除飞机 Hits 等修订。
- 本次未渲染 PDF 页面；含删除线、跨栏归属的修改仍需原版面核对。尤其原书 p.69 观察员升级的删除，不能只靠提取文字确认删除样式。
- 本地没有完整 NORTHAG 2020 原书。本次没有重新访问 Scribd；Forward Screen / Vanguard、Restricted、增援次数和时序等原书机制引用资料包归纳，仍需原书或可核对页面确认后启用正式强制校验。
- 实测解锁卡片 PDF 可读、未加密、共 8 页。结构文件包含 52 个槽位：46 个单位卡候选、5 个参考表、1 个空白模板。不是 52 个可购买单位。
- 运行已检查过的 `tools/validate_reference_data.py` 与 `data/check_example.py`，均退出成功。前者只验证部分 JSON 结构及计数；后者只验证示例算术。它们不是规则合法性验证、全量属性核验或网站测试。

## 3. 对数据模型和界面的具体影响

### 3.1 编制分区与单位组成是两种层级

资料包将 Main Force 分为 Vanguard 与 Main Column，另有 Forward Screen、Additional Fire Support 和可选 Reinforcement Requests；同名 Tank Company 出现在不同购买池。不要将四个顶层分区误建成五个平级单位分类。

建议：`ArmyStructure` 表达分区树、可选分区与分区限制；`Roster Selection` 表达购买实例树。实例归属的 `sectionId` 应明确记录，局部上限按区段／父实例计数，全军 Restricted 等另按全军计数。同名不同区段使用独立购买定义或明确变体，不能按名字共用全局 maxCount。界面导航由规则模块的结构生成，不写死 Classic 分类。

来源：`01_NORTHAG_Army_Building_Rules.md` §2、§4；`02_NORTHAG_Soviet_Army_List.md`；条目索引中两份不同区段的 Tank Company ID。

### 3.2 可购买内容不都对应已部署单位

场外支援、战术加成和请求次数具有费用、使用次数或规则说明，但可能没有 UnitProfile。现有 UnitEntry 示例的 composition 应允许合法空组成，并明确条目类型或等价的效果定义；“不需要实体”和“组成尚未录入”分别表示。名称 UnitEntry 不必为此改掉。

增援请求在编表阶段保存启用设置、额外购买次数和费用；未来实际请求成功后选择的单位、到场时点、当时 BR 属于战斗状态。静态军表不得预加尚未确定的增援单位或其 BR。

首版仍是编表器：显示初始 BR、请求额度与说明即可。对局阶段的请求判定、消耗、部署及动态 BR 跟踪留作未来能力，不因参考包提到 battleState 就立即开发。

来源：`01_NORTHAG_Army_Building_Rules.md` §5–7；`12_Agent_Validation_Test_Plan.md` 的增援测试。次数、费用和时序本次尚未独立核对原书。

### 3.3 规模、训练等级和统计项目由规则体系定义

游戏规模应是显式设置，推荐预算与规模不等价；不能按点数上限自动选 Restricted 档位。现方案已具备这个入口，需要在最终类型与交互中落实。

Classic 的 i/r/v 与 NORTHAG 的 c/p/e 不能成为同一套硬编码枚举或统一等级换算。BR 使用数值，experience 引用所在规则体系自己的定义。BR 不设置任意“单单位最多 4”之类上限。

Scout 权重、Officer、Restricted 等统计不能一律等同于购买次数、模型数或 BR。建议规则模块提供结构化统计结果与来源，右栏据此展示；需要比较对手或依赖场景的结果提供提示，不作为仅凭本方军表就能判断的错误。

来源：`01_NORTHAG_Army_Building_Rules.md` §1–3、§7；`08_Official_Errata_v9_Application.md` 的 Scout 说明。本次直接提取核对的官方 PDF 页不涵盖 Scout 全文。

### 3.4 区分未知、不适用与数值零

官方勘误文件第 10 页要求 AA missiles 移除 AT 值、飞机移除 Hits。已确认“不适用”不应记作零，也不应触发“关键数据尚未录入”的全局不完整状态。

建议最终字段模型以状态标记或等价字段区分 known / unknown / not_applicable，并记录来源。不是所有字段都必须包装成复杂对象，但完整性检查必须知道字段是否适用。武器射程档和装甲形态也不应强制套用 Classic 的固定数值列；保留规则体系自己的 profile 类型和详情展示适配。

来源：官方勘误文件第 9–10 页；`03_NORTHAG_Soviet_Unit_Profiles.md`。现方案“缺失不等于零”仍成立，需要补充“不适用不等于缺失”。

### 3.5 修订身份要包含原书版本与已应用勘误

NORTHAG 2020 + Errata v9、2025 Omnibus、HWC v6 社区卡是不同来源身份。社区卡包含不在正式军表中的单位和混合扩展参考，不能因为有属性卡就允许购买。

建议规则与目录的发布身份包含基础版本／印次、勘误集合和本项目修订号；勘误应用记录目标 ID、字段、原值、修订值、来源和状态。只有目标记录匹配明确时才生成修订后的发布数据；无法定位的补丁保持待处理。运行时可使用已经编译好的独立 JSON，无需为此搭建通用补丁服务。

官方 p.72 的 one each 修订说明 OptionGroup 需分别表达整组上限与逐选项上限。拼写修正应保持稳定 ID，别名仅在同一体系及明确版本内生效。上述同体系修订不构成跨 Classic / AirLand / NORTHAG 共享数据或差异覆盖。

来源：官方勘误文件第 1、7、9–10、12 页；`08_Official_Errata_v9_Application.md`；`10_WARPAC_v6_Errata_Reconciliation.md`。

## 4. 参考包进入正式目录前的具体问题

1. `data/manifest.json` 仍是 v3 状态，声称卡片加密、未读取；README 为 v5，另有 v4 extraction manifest、解锁 PDF 与候选数据。不能用单个旧 manifest 判断整个包的完成度。
2. `northag-2020-rules-partial.json` 同时存在平铺 sections 与 sectionHierarchy；前者没有 Main Force，且使用 reinforcement_request 单数，后者使用 reinforcement_requests 复数。正式转换必须选定唯一结构并验证引用，不让两个结构各自驱动 UI／校验。
3. 该 JSON 的 maxSelections:null、minSelections:null 不能沿用“费用 null=未知”的单一解释；限制字段需明确未知、无上限、不适用。来源权威性、转录准确性和补丁是否已应用也分别判断。
4. `05_Agent_Implementation_Guide.md`、`08_Official_Errata_v9_Application.md` 仍含“卡片待解密”旧说明；p.72 选项组的目标定位在不同文档中有不同确定程度。正式数据冻结前统一状态，原始参考保留历史痕迹。
5. 条目索引有 61 个导航项目，其 Points/BR 均未填写，且包含增援等非普通购买单位；它是导航资料，不是 61 个已验证可购买单位。7 个数值校准样本仍标记 web_transcription_crosscheck_required。
6. 示例可见条目合计确为 499 Points / 58 BR，来源标称 66 BR。将其用作算术与差异处理测试，不能作为已确认合法、来源无误的 golden roster，也不能补造 +8 BR。

这些问题不妨碍用资料包评估结构，但阻止把它原样作为发布目录。未修改原始参考文件。

## 5. 对现方案的最小补充建议

进入 Classic 核心实现前，在技术方案 §3–6 明确：分区树与购买实例树分离；无实体购买项；规则体系自定义 experience 与统计；unknown / not_applicable 区分；基础版本及勘误应用身份。首版依然只做静态组军，保留 battleState 的独立边界。

NORTHAG 接入阶段再核实具体阈值、增援数值和完整军表。测试优先覆盖分区同名条目独立上限、one each 多选、请求只计购买费用、未知费用不误判合法、不适用字段不误判缺失、未匹配勘误不生效、社区属性卡不自动生成购买资格。

当前尚无网站实现，因此这是设计影响评估；检查通过不能表述为 NORTHAG 规则引擎已通过验收。
