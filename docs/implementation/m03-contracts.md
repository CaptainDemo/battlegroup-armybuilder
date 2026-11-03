# M03 领域契约说明

日期：2026-11-03。本文是 [M03任务契约](m03-spacecraft-task.md) 的最终交付说明。GLM完成初版及部分返工后因额度中断，用户授权主Agent接手完成；[验收记录](m03-acceptance.md)区分外部执行与最终实现。本文说明公开API、schema与关系检查的分工、以及23份M01账目的表达能力，不代表已实现游戏规则。

## 1. 公开入口

### packages/core（`@battlegroup/core`）

| 模块 | 主要导出 |
|---|---|
| `contracts/primitives.ts` | `localIdSchema`、`rulesetIds`（`classic-coldwar`/`airland`/`northag`）、`catalogIdentitySchema`（ruleset+catalog+revision）、`entryReferenceSchema`（含精确revision与localId）、`sha256Schema` |
| `contracts/values.ts` | `trackedValueSchema`（数值known/unknown/not_applicable）、`trackedTokenSchema`（不带体系枚举的字符串三态，用于基础训练）、`quantityLimitSchema`（limited/unlimited/unknown/not_applicable）、`costDeltaSchema`（Points与BR独立，允许0与负差额）及相应辅助函数 |
| `contracts/source.ts` | `sourceDocumentSchema`（authority、reviewStatus、errataApplication 三状态独立）、`sourceReferenceSchema`（`pdfPage` 与 `printedPage` 分列）、`errataRecordSchema` |
| `contracts/versioning.ts` | `CATALOG_SCHEMA_VERSION='catalog-shell/1'`、`ROSTER_FORMAT_VERSION='roster/1'`、`catalogManifestSchema`、`manifestVersionIdentity()`（schemaVersion+rulesRevision+catalogRevision 三层版本投影） |
| `contracts/catalog.ts` | 分区、目录外壳、组成三态、购买条目、资源、选项；`UnitEntry.baseTraining`保存上下文独立的训练三态；选项效果支持替换、训练变化、标签和显式composition-addition。`profileIdentitySchema`接受扩展属性，但core解析仅保留身份字段；保留战斗属性须使用对应规则体系schema |
| `contracts/roster.ts` | `rosterSettingsSchema`、`optionChoiceSchema`（whole-selection / member-path / attachment-member）、`rosterSelectionSchema`（稳定实例与挂载点）、`rosterDocumentSchema`（formatVersion、编辑revision、精确catalogRef、armyListId） |
| `contracts/evaluation.ts` | **仅协议类型**：`Evaluation`（身份及inputRevision、组成、费用归属、总额完整性、资源／统计、问题与覆盖）、`Availability`（allowed/blocked/unknown）、`CompatibilityResult`、`RulesetModule`；没有执行器 |
| `validation/` | `validateCatalogRelations(catalog)`、`validateRosterRelations(roster, catalog)`；静态组成路径`resolveCompositionPath`／`resolveRosterMemberPath`；显式附属拥有者路径`resolveAttachmentMemberPath`；返回`IntegrityIssue[]` |

### packages/rulesets/classic-coldwar（`@battlegroup/classic-coldwar`）

- `training.ts`：`classicTrainingLevelSchema = i/r/v/e`（含Elite；M01样本只用i/r不删e）、标签表、`isClassicTrainingLevel`。
- `profiles.ts`：`classicProfileStatsSchema`（各属性为TrackedValue）、`classicUnitProfileSchema`、`unverifiedStats(reason)`（M01未核验属性的诚实状态）。
- `classicSchema.ts`：目录与文档均锁定classic-coldwar身份；目录校验基础训练及训练变化token，文档校验C13规模枚举，精确版本与引用关系另由core关系校验检查。
- `index.ts`：保留 M02 的 `classicColdWarRuleset` 描述符（Web壳继续使用），追加上述导出。

## 2. 已固定的语义决定

1. **身份与引用**：记录身份 = ruleset + catalog + 精确 revision + localId；不按名称解析，`entry-unknown` 负例用显示名故意失败。玩家实例 `selectionId` 独立；同一entry重复购买=多个selection。
2. **跨体系/跨版本引用拒绝**：selection内嵌完整身份，与roster catalogRef不一致即拒绝，不借用同localId记录；roster与目录身份不匹配时停止全部目录依赖检查。公开成员解析函数也检查完整身份，不依赖调用者事先运行关系检查。
3. **分区树与购买树分离**：`ArmyStructure`扁平节点+parent指针（检测孤儿/循环）；购买树用parentSelectionId。顶层selection声明可直接购买的sectionId并符合entry资格；子选择继承分区，禁止重复声明。是否允许某类附件、数量阈值等游戏资格留给规则模块。
4. **固定组成含于父价**：组成树节点不是独立购买，无价格字段；独立付费附属是独立selection（保留自己的selectionId、父实例与`targetMemberPath`）。重复计费防线在协议层：`ChargeLine.attributionKey` 每计费归属唯一（M06实现）。
5. **稳定成员目标**：`member-path`只在当前购买的静态组成内解析；`attachment-member`使用`ownerSelectionId + nodePath`，路径相对于该附属自己的组成根，不穿过父编制的同名节点。两份同条目附件、静态／附属同名及购买重排均不改变目标。关系检查要求附属拥有者存在、身份匹配并属于选择者的后代。`member-slots`不能通过attachment-member绕过声明槽位；只有scope-selector可引用附属成员。
6. **选项定义与选择分离**：`OptionGroup.scope`（selection/parent-formation/section/army）+ `selectionLimit`（组内总量）+ 每选项 `ownLimit`；one each = 组上限有限+各选项ownLimit=1（无冗余标志位）。计费 `chargeMode` once/per-target；差额Points/BR分开且允许0（免费替换、A09仅列Points→BR已知0）与负数（L08 -5/-1）。前置`requires`与互斥`mutuallyExclusiveWith`为同组声明数据，本阶段不执行。
7. **两种支援池独立**：资源以ruleset自定义 `resourceKind` 表示（`army-support-choice` 与 `platoon-support-slots` 是Classic样本数据，不是core常量）。授予作用域 army / parent-formation / formation-member（连内已含子排的排内名额用memberPath精确授予，不重复授予全军额度）；消耗带可选category。S01同时4/4表达两者独立；core无统一support上限。
8. **known/unknown/not_applicable与有限/无上限**：见values.ts；未知费用不能坍缩为0（schema拒绝裸数字），`not_applicable`需要理由（如勘误移除字段）。
9. **预算与规模独立**：两个独立字段；classic在roster精化中校验规模token，预算不参与推导。
10. **训练等级与数值BR分离**：`UnitEntry.baseTraining`在购买上下文保存已知token、未知或不适用；缺省表示本契约样本未提供，不自动补成等级。Classic校验其已知值为i/r/v/e，训练变化另为选项效果；BR独立。B01同时携带r编制与i附属／防空单位；T-62基值i及Regular选项r分别表达。不同体系的同字符等级也不共享游戏记录。
11. **来源身份**：authority（官方/社区/内部转录）、reviewStatus（目视核对程度）、errataApplication（勘误应用）三状态独立；PDF页序与印刷页码分列；manifest.sources 是引用校验的文档清单。
12. **编辑快照**：`RosterDocument.revision`是编辑输入的非空标识，评估生产者复制到`Evaluation.identity.inputRevision`；消费者与当前输入比较，拒绝旧结果。它不同于catalogRevision，也不同于后续存储并发控制的保存revision。M03仅定义协议，不生成revision或运行评估。
13. **第二Fire Support**：F02将第二Section作为独立的上下文购买条目，35 Points／1 BR、明确成员及BMP-2运输、所属排挂载点和1个局部名额。第一份40 Points／1 BR保持独立；不靠空效果或按名字生成隐藏单位。另有重复Section加all的合成例子验证两辆运输可分别寻址。

## 3. schema形状 vs 显式目录关系校验

| 检查 | 层 | 入口/前置 | 返回 |
|---|---|---|---|
| 字段形状、判别状态、数值范围（数量≥1整数、预算≥1、limit≥0、基础价非负、SHA256格式、strict未知键拒绝、顶层/子选择section规则、formatVersion/schemaVersion字面量） | **Zod schema** | 各schema `.safeParse` | zod issues |
| 同类重复ID（entry/profile/optionGroup/option/section/armyList/同层nodeId/selectionId） | 关系校验 | `validateCatalogRelations(catalog)` / `validateRosterRelations(roster, catalog)`，输入须已通过schema | `IntegrityIssue[]`（稳定checkId+定位path+消息） |
| 分区孤儿/循环、entry分区与军表归属、选项组挂载 | 关系校验 | 同上 | 同上 |
| 选项member-slots在条目组成可解析、scope-selector匹配的profile存在、替换效果profile存在、requires/mutex同组存在、formation-member授予memberPath可解析 | 关系校验（逐entry×group×option） | 同上 | 同上 |
| 选择精确身份、entry存在、可直接购买分区、父存在/循环、挂载点、选项类型／声明槽位、附属拥有者存在及后代关系 | 关系校验 | 同上 | 同上 |
| entry/profile/option/errata来源文档已声明、applied勘误目标存在 | 关系校验 | 同上 | 同上 |

**明确不在本阶段、也不声称覆盖**：游戏规则执行（预算超限C01、排内名额C02/C03、全军支援C07–C09、Restricted/Unique、PT-76排除C16、MANPADS互斥——B02/B03/B04/S02/F03–F07作为正例证明结构合法）、资源额度汇总与消耗判定、费用合计、组成展开、目录文件加载与版本兼容（M04）、编辑命令（M05）、计价（M06）、规则模块（M07）。classic训练token与规模token的枚举属于classic schema精化，不属于core关系校验。

## 4. 三体系隔离与NORTHAG结构样本

`packages/core/src/samples/isolationCatalogs.ts` 为三个体系生成**同名、同属性、故意复用localId**（`t72a`、`shared-t72-platoon`、180/7等完全一致）的合成目录：

- 各自独立通过schema与关系校验（校验某体系不需要其他体系记录）；
- classic roster引用airland的 `shared-t72-platoon` → 仅 `entry-reference-identity-mismatch`，不借用本体系同localId记录；
- 同localId在本体系内正常解析；
- classic roster引用northag独有的 `tank-company-vanguard` → `entry-unknown`（名称相同也无回退）；
- 改一个体系目录不影响其他体系样本。

NORTHAG合成目录表达：嵌套分区树（forward-screen、main-force{vanguard,main-column}、additional-fire-support、reinforcement-requests）、同名Tank Company两个分区独立entry、one-each选项组（selectionLimit=3+各ownLimit=1）、无实体请求购买（tactical-resource + no-entities + 消耗reinforcement-request-slots）。**不含任何未核实的真实阈值**，manifest覆盖状态标注合成。

## 5. 23份M01账目 → 契约能力映射

样本：`samples/classicM01Catalog.ts`（契约测试目录，非发布数据）与 `samples/classicM01Rosters.ts`。正例测试在 `packages/core/src/rosterRelations.test.ts`（23个账目全部断言结构校验零issue）。

| 账目 | 需要的表示能力 | 对应实现/测试 |
|---|---|---|
| B01 | 顶层多分区购买、附属挂载、known(0) BR（Medic 8/0、请求5/0）、两池资源授予/消耗、预算与规模分开 | b01Roster + 关系校验零issue；catalog中C07/C08/C09授予与三类消耗 |
| B02 | 局部唯一违规仍是合法文档结构 | b02Roster正例（C02不执行） |
| B03 | 预算独立字段，改动不影响结构 | b03Roster（budget 397） |
| B04 | 额度生产者缺失是游戏问题非结构问题 | b04Roster正例 |
| L01 | 整组一次计费 + 单成员槽位per-target、A09 BR已知0 | t72-platoon-upgrades（platoon-to-b once、kmt member-slots） |
| L02 | 训练变化效果+BR差额(+3)、前置requires、逐项一次 | t62-platoon-upgrades + classic schema训练token校验 |
| L03 | 独立排上下文价45 vs 连内40 → 不同entry localId | `bmp2-platoon-fire-support` vs `bmp2-company-platoon-fire-support` |
| L04 | 连内附属锚定已含子排（targetMemberPath）、子排不重复计费 | l04Roster（子排只是组成节点，无第二个购买） |
| L05 | 同名附属挂不同父、连内三排各自局部名额 | l05Roster + formation-member授予（platoon-1/2/3各4） |
| L06 | scope-selector按实际目标计费、无附属时3目标 | l06Roster（3条member-path） |
| L07 | 免费替换=已知0差额、替换非追加 | engineer-transport选项（0/0） |
| L08 | 负差额已知值(-5/-1) | ambulance-downgrade选项 + schema负数测试 |
| L09 | 非实体购买（no-entities）带费用与0 BR | timed122 entry |
| L10 | 逐辆per-target×10、A01连组成修正、A09 BR不变 | t72-company组成（1+3+6）+ b1-per-tank 10目标 |
| S01 | 两池各自4/4同时成立 | s01Roster（4附属+4侦察） |
| S02 | 全军第5个超C07仍是合法结构 | s02Roster正例 |
| F01 | all含10基础+2附属BMP、每目标一次 | f01Roster的10条member-path及2条owner明确的attachment-member |
| F02 | 两Section各占一个排内名额且有独立组成／价格 | fs1与fs2购买实例；第二条目bmp2-company-platoon-fire-support-second为35/1 |
| F03 | 第5个排内选项超C03仍是合法结构 | f03Roster正例 |
| F04/F05/F06 | PT-76排除T-72排/连/额外单车——触发保留、判定不执行 | pt76b-recon specialRules + f04–f06正例 |
| F07 | 嵌套运输选择触发PT-76、免费选项BR不变 | recon-command transport-pt76b选项（specialRules在选项上）+ f07正例 |

附属条目区分购买上下文：`bmp1-company-platoon-*`（p.3，AGL 35点）与 `bmp1-platoon-*`（p.2，AGL 18点）是不同entry——同名不同上下文不合并。

## 6. 依赖与边界

- `packages/core` 运行时依赖仅 `zod@^4.6.7`；`classic-coldwar` 直接import zod故直接声明。两者 `"sideEffects": false`，Web壳不引用schema时不打包zod（构建产物核对）。
- `dependencyBoundary.test.ts`允许core的Zod和Classic直接使用Zod，继续禁止React／浏览器存储／体系间依赖。`@battlegroup/core/samples`子路径仅供测试，主入口不导出样本；构建不将这些数据发布为正式目录。
- `evaluationProtocol.test.ts` 固化"无伪引擎"：公开导出面不得出现 evaluate/calculate/price/total/legality 入口。

## 7. 已知边界与未做

- samples 是契约测试数据，不能替代M04正式目录。包含部分MTLB换装表示，但未覆盖全量选项（如Konkurs、Svir）；AFV属性未核验，不填造数值。
- scope-selector的profile筛选、includeSubFormations及随附属变化重建完整目标集属于M06/M07；M03检查显式目标身份／存在／归属，尚不证明这些目标就是完整all集合。组成新增效果仅声明并校验静态引用，不执行展开。
- 来源检查验证文档引用存在，不代替PDF值与页码的人工核实；manifest内容哈希、兼容实现集合和正式发布检查由M04接入。
- A05（Restricted/Unique升级作用域）与A06（MANPADS互斥）相关组合未开放，未新造解释。
- Evaluation/Availability/RulesetModule 是协议；`evaluate` 无实现；错误消息文本不是稳定API（checkId才是）。
- roster文档当前单一formatVersion字面量；多版本迁移属M10。
