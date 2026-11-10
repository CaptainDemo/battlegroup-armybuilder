# M11 a1 独立审查：需要返工

日期为 2026-11-10。任务 `t20261110012332-5eea923d`，revision 1／attempt a1，正式结果 SHA-256 为 `a166e6e3d46d07acd99c09bc424a85833f77a2ad49f43c689bdb925f6d04369c`。当前未验收，不提交或部署。

## 已核实的执行与差异

- 实际后端 Claude Code，服务 open.bigmodel.cn，模型 `glm-5.3[1m]`，effort max；流中最终结果为 success、139 轮、session `89fc2e94-3f97-49f0-914e-0b007513755e`，关联码与本轮一致。
- CLI 退出 0，进程停止，Job 已排空。正式结果文件哈希和产品返回一致。
- B→C 差异为 generated，51 个新增、6 个修改、0 删除、无范围外观察。主 Agent 对全部 57 个交付文件重新计算哈希，均匹配。
- 保留外部自述的 351 项单测及 21 项 Chrome 通过记录，但这些结果未覆盖下述缺陷，不能作为主 Agent 验收结论。
- 原始 PDF、逐页图像和日志复制保留在 `.tmp/m11-review/a1-evidence/`。初步查看 long-page-04、long-page-05、violations-page-01；尚未完成整套纸面验收。

## 当前阻塞及复现

主 Agent 的独立检查位于 `.tmp/m11-review/acceptance-probes.test.ts`，配置为 `.tmp/m11-review/vitest.config.ts`。命令 `npx vitest run --config .tmp/m11-review/vitest.config.ts` 退出 1，6 个断言失败；完整日志和退出码为 `a1-probes.log`、`a1-probes-exit.json`。测试不修改应用或目录。

1. **固定子排组成重复打印。** `printProjection.ts` 的 purchase.rows 已遍历连的全部固定子排，然后 platoons[].rows 又遍历同一批成员，`PurchaseBlock` 两处均渲染。真实目录 1.1.0 的未升级 BMP-1 连包含 10 辆 BMP-1（1 连指挥＋3×3 排内车辆），完整纸面投影却计出 19 辆。费用没有重复，但读者会误认为组成翻倍。修复后每个稳定组成成员在该购买的正文仅出现一次；固定子排仍须保留独立标题、训练等级、挂载附件和父子关系。
2. **评估版本字段不校验。** 保持三个 catalog identity 相同，分别更改 Evaluation.identity.versions 的 schemaVersion、rulesRevision 或 catalogRevision，投影仍返回 ready。须把这些字段与实际 release manifest 对照，错配返回 stale，不能印出互相矛盾的版本和费用。三种变体各有独立失败断言。
3. **可选规则选择未打印。** 合法文档 settings.optionalRules 非空时，投影保留了数据但 PrintPreview 不输出。独立静态渲染确认实际纸面 HTML 丢失 `review-optional-rule`。须把已选可选规则作为设置输出，按文本渲染，不擅自增加规则效果或更改存档。
4. **旧目录的叶子组成丢失。** 精确目录 1.0.0 的 brdm2-recon 以 BRDM-2 profile 为组成根，当前仅输出 root.children，导致组成行为空。须保留带 profile 的根节点及其数量；没有子节点不能作为没有组成的依据。保持 1.0.0 原有语义，不切换版本或借用 1.1.0 数据。

第一项检查初稿曾把连指挥车误当作已升级的 BMP-1P，期待 9 辆 BMP-1；对照实际 1.1.0 目录后已修正为 10 辆，重新运行依然得到 19 辆。该测试期待修正与真实产品重复分别记录，不把初稿的来源理解错误交给协作者实现。

## 返工范围和关闭条件

沿用原 M11 契约和 writeScope，只修正上述已复现问题及必要回归。主 Agent 独立检查文件、本审查记录和 a1 历史证据均只读；不要通过改期待、跳过检查或调整游戏数据使其通过。

六项独立检查须原样通过，并在正式源码测试中补充对应回归。重新生成多页 PDF，核对正文固定成员只出现一次、附件不丢、总计及版本一致，可选规则可见，旧目录根成员完整。原 a1 的 11／4 页只是历史输出页数，不要求修后维持该页数；消除重复后应按实际新输出检查分页。

完成后运行类型检查、单测、构建、既有及新增 Chrome 回归，提供当前构建的 PDF、逐页图像和完整退出码证据。不得修改 M11 以外逻辑或数据，不提交、推送、部署或推进 M12。
