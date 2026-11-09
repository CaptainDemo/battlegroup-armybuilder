# M10 外部实现 a1 独立审查

日期为 2026-11-09。任务 t20261109015027-d390cf07，revision 1／attempt a1。正式结果 SHA-256 为 `87a09161d77b26566a462ca2b851b0eb680723f1c165a802489bf0a172255065`。

## 已核实的执行证据

- 插件记录 succeeded、exitCode 0、进程停止及 Job 排空，正式结果的关联码和 session 均匹配。CLI 流实际模型为 glm-5.3，共 110 轮。
- B→C 差异为 generated，23 新增、10 修改、0 删除。其中包括 10 份临时日志。33 份范围内交付文件的当前字节指纹与差异记录一致。
- 范围外新增 `packages/core/src/transferContracts.test.ts` 是相关契约测试，但未在 a1 writeScope 中声明。保留该事实和文件，后续修订明确纳入范围。
- 工作区原有 AGENTS.md 与 M10 派发契约保留。Git HEAD 为 0601352，无提交或暂存。

## 阻断验收的问题

1. **覆盖吞掉另一标签页的已提交更新。** a1 的 applyOverwrite 在等待本页队列后调用 store.read，直接用读到的最新 saveRevision 写入。实际顺序为本页载入 revision 1，另一标签页提交 revision 2，本页确认覆盖。结果为 saved，并将远端新内容替换为导入内容，预期应返回 conflict 并保留远端内容与本页草稿。确认时应绑定本页已知或明确展示并确认的目标版本，不能以临时重新读取的版本静默授权。
2. **裸格式单军表绕过大小限制。** 将超过 2 MiB、低于 20 MiB 的 M09 RosterDocument 输入 parseImportFile，当前返回 fatal=null。单份外壳有 2 MiB 检查，裸格式及未知格式单份入口没有一致检查。

独立复现位于 `.tmp/m10-review/regressions.test.ts`，命令为 `npx vitest run --config .tmp/m10-review/vitest.config.ts`，实际退出码 1，两项均失败。完整输出保存在 `.tmp/m10-review/probes-before.log`。这些是现有正确性断言在 a1 下的失败证据。

## 同轮需补齐

- onFile 在读取 file.text() 后才调用大小门槛。应先检查 File.size，避免超大文件在拒绝前被完整读入内存。
- 覆盖与自动保存的交接需要真实在途／待存编辑交错验证。当前仅 settle 后读取，没有明确排他窗口，现有单测不足以支持报告中的“旧草稿不能重新写回”结论。
- 全库预览对 error 条目当前允许整体确认并在 applyImportCopy 中跳过错误。应阻止含错误的整批确认，或提供明确的选择／跳过告知与数量结果。当前通用成功提示不能说明部分记录被跳过。
- a1 报告明确未执行真实双标签页覆盖冲突及保存失败时导出内存草稿，两项均已列入当前 M10 契约，需要补验，不转移到 M12。

本轮实现保留，处置为 needs_rework。执行成功和模型正文中的“全部交付”不等于主 Agent 验收通过。
