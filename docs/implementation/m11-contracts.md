# M11 打印与 PDF 视图契约

日期：2026-11-10（r2 修订）。本文公开 M11 打印投影的对外契约：输入身份检查、纸面内容、
显示语义和浏览器打印边界。实现位于 `apps/web/src/features/roster-output/`
（`printProjection.ts` 纯投影、`PrintPreview.tsx` 预览），入口在
`RosterWorkspace.tsx` 编辑器工具栏。领域契约本身（`packages/core`）未改动。

r2 依据 [a1 审查](m11-review-a1.md)修正：固定子排组成去重、评估版本三元组校验、
可选规则上纸、旧目录叶子根组成保留；契约语义相应更新如下。

## 1. 输入与身份检查

投影函数 `projectPrintableRoster({ document, release, evaluation })` 是纯函数：

- 输入一份 `RosterDocument`（当前内存草稿）、其绑定的精确目录 release 和**同一次**
  `Evaluation` 快照。
- 先核对身份与版本，任何不匹配都返回 `status: 'stale'` 并给出原因，**不输出军表内容**：
  - `roster-id`：`evaluation.identity.rosterId !== document.rosterId`；
  - `edit-revision`：`evaluation.identity.inputRevision !== document.revision`；
  - `document-catalog`：评估目录身份 ≠ 草稿 `catalogRef`；
  - `release-catalog`：传入 release 的目录身份 ≠ 草稿 `catalogRef`；
  - `evaluation-catalog`：评估目录身份 ≠ release 目录身份；
  - `evaluation-schema-version` / `evaluation-rules-revision` /
    `evaluation-catalog-revision`：`Evaluation.identity.versions` 三元组
    （schemaVersion／rulesRevision／catalogRevision）与 release manifest 实际值
    逐项对照，防止纸面印出互相矛盾的版本与费用。
- 身份一致时返回 `status: 'ready'` 与投影数据。费用、组成、问题、覆盖全部取自该
  评估快照；投影不重新计价、不解析规则。唯一的算术是把快照自己的 charge line
  汇总为显示用小计，其完整性标志与评估的 `MeasureStatus` 同义。

## 2. 快照冻结与预览生命周期

- 打开预览时从当前草稿 + 当前评估冻结一份快照（React state，不写存储）。
- 预览明确显示冻结的 edit revision；提供 Refresh（重新冻结最新草稿）与 Close。
  关闭后再次打开总是取得最新草稿，不存在静默复用过期结果。
- 预览、关闭、刷新、打印均不修改军表文档、撤销历史或保存队列；违规草稿、
  未保存草稿、保存失败草稿同样可打印。
- 无有效草稿／评估时点击入口只提示状态，不打印其他军表或空白占位。

## 3. 纸面内容

按顺序输出：

1. **页眉**：军表名、军表（nation · name）、Points／BR（完整时为总额；不完整时
   明确标注 *known subtotal*，且 BR 与 Points 各自独立）、预算剩余（仅在总额完
   整时给出）、规则检查结论；规则体系、目录 id／revision、rulesRevision、
   roster/目录 schema 版本、打印快照 revision、预算、规模、场景／玩家角色、
   **已选可选规则**（`settings.optionalRules` 非空时按文本逐项列出，不添加规则
   效果）；baseEdition 与来源文档标题。
2. **玩家备注**（`RosterDocument.notes`，纯文本渲染，换行保留）。
3. **问题清单**：全部 `Evaluation.issues`，含 ruleId、severity、message、
   actual/limit 与所属购买标题；无问题时明确写“已实现检查内无违规，覆盖仍部分”。
4. **军表主体**：按军表分区顺序输出每笔顶级购买的完整块——
   - 标题（名称 · 实例序号，同父同锚点分组编号）、训练等级、问题数标记；
   - 基础价（含固定成员说明）与该购买小计（known subtotal 语义）；
   - 展开组成（来自评估快照，含换装后的实际 profile 与数量）。**每个稳定组成
     成员在该购买正文只出现一次**：固定子排的成员只印在其子排块内，购买自身
     的组成行不含固定子排子树（无“1 × platoon”包装行重复）。带 profile 的
     组成根（如精确 1.0.0 目录的 BRDM-2 叶子根）本身即是成员，须按其数量
     印出；没有子节点不代表没有组成。叶子排／叶子根的训练等级随行显示；
   - **固定子排**（configurableSlot platoon）：独立标题（含父链与自身训练等级）、
     标注“含在编制价格内，不单独计费”，成员锚定附件（`targetMemberPath`）
     挂在其所属子排下，不按名字或顺序猜测；
   - 直接附件（无 member path）与其递归内容；锚定到非固定子排路径的附件归入
     residual 组，不静默丢失；
   - **已选配装**：选项名、组名、per-target 计价方式、逐目标稳定路径标签
     （member-path 为路径词；attachment-member 为“所属购买 — 路径”）、
     chargedUnits 与该选项的 Points/BR（known subtotal 语义）。未选择的选项
     不出现；
   - **价格明细表**：该购买全部 charge line（基础／附件／选项），逐行 units、
     Points、BR；固定子排不产生任何行。
5. **支援与统计**：资源账本（consumed/capacity/status）与命名统计。
6. **检查覆盖**：目录覆盖说明 + 全部 `CheckCoverage`（covered／not-implemented／
   blocked-unknown-data／missing-input 分开，含 note）。覆盖与违规互相独立，
   “无 Error”不等于“合法”。
7. **车辆／武器速查**：复用 `roster-editor/unitData.ts` 的已核实资料包
   （soviet-afv/1、draft6-weapons/1）与同一评估组成聚合；打印资料包来源与
   revision、未核实武器 profile 和未分类 profile。不复制独立数据，不引入新规则解释。
8. **页脚**：声明打印自当前内存草稿、部分覆盖不构成完全合法证明，及快照 revision。

已知零、未知、不适用三种值状态在所有位置分开显示（0／Unknown／Not applicable）；
预算剩余仅在 Points 总额完整时计算。问题清单同时给出不带 selectionId 的全局问题
（如 C01 预算）与带定位的问题；违规购买自身标题旁带问题数标记。

## 4. 打印样式与分页

- 打印媒体下隐藏应用头、底、编辑器全部面板与预览工具栏；`@page` 为 A4
  （14mm/12mm 边距），只输出纸面。
- 大编制块（连、多级附件）允许跨页拆分；仅小组件行（组成行、问题行、charge 行）
  使用 `break-inside: avoid`，表头 `thead` 跨页重复，标题 `break-after: avoid`。
  不用整段 avoid 造成超高块被截断。
- 长名称、长备注、长选项目标一律 `overflow-wrap: anywhere`；charge 表
  `table-layout: fixed`，无横向裁切。屏幕预览在 360px 宽可操作且无整页横向溢出。

## 5. 安全与不改动边界

- 军表名、备注、目录文本全部按 React 文本渲染；导入内容不可能作为 HTML 进入
  打印文档（浏览器打印即 PDF 输出路径，无新增 PDF 引擎或后端）。
- 本模块不修改：`packages/core`／rulesets 代码与契约、游戏目录与资料包、存储／
  导入导出格式、路由结构（打印为编辑器内覆盖层，无新路由）。

## 6. PDF 选项与资料附录（后续直接实现）

`PrintPreview` 的 `PrintOptions.includeUnitData` 默认为 false。勾选后在军表末尾附上
完整载具／武器数据页。选项位于纸面外的预览工具栏，刷新快照时保留，关闭后重开
恢复默认；它不进入 RosterDocument、不改变评估、费用或自动保存。

打印投影的 `PrintReferenceVehicle` 绑定精确目录内的 profile ID、配置 key、原始
资料卡（未核实时为 null）及当前配置的额外武器数据；`PrintReferenceWeapon` 保留
实际武器记录。附录复用编辑器的 `CombatCard`／`WeaponDetails` 格式化组件。
同型号／同配置载具合并；目标升级配置分开；所有实际携带及挂载的通用武器记录按
稳定 ID 只印一份。载具卡内已有的主炮／弹药性能随原卡输出。

未知载具仍显示名称、数量和未核实提示，不套用近似型号；未知武器及未分类条目
保持缺口列表。已替换的车载 ATGM 行不输出，已选升级数据列入后面的武器数据。
来源说明在附录中始终展开，不能因预览折叠而漏印。

附录从新页开始。每张有界资料卡尽量保持同页，表格列宽固定、文字可换行、表头
跨页重复，保留全部距离栏；不会给整个军表或连设置整段不分页。详见
[PDF 选项实现与验证](m11-pdf-options.md)。
