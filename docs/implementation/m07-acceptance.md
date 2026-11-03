# M07 Classic规则与可用性

日期：2026-11-03。Classic模块新增`evaluateClassicRoster`、`getClassicEntryAvailability`和绑定精确目录的`createClassicRuleset`；core仍不包含Classic阈值或游戏分类。

## 覆盖

- 接入M06同一快照，检查预算C01、局部附件一次性与独立排名额C02/C03、带分类资格的全军额度C07–C09、独立条目Restricted及Unique C11/C12。预算与规模分开，C13预算范围只提示，不自动切换规模。
- Classic settings支持可选的playerRoleId（core仅承载opaque标识）；Classic只接受attacker／defender。Defences的场景或身份缺失属于missing-input，明确不符合才报C14；TOC按Battalion C15检查。初始正式目录没有开启Defences／TOC条目，这些分支用合成夹具验证。
- PT-76的独立购买和已选运输选项均可触发C16，递归检查派生实际profile；排、连、额外单车均覆盖。坦克家族来自当前体系profile的specialRules元数据（tank-family:t62／pt76／other），不用同名猜测；触发后遇到未分类坦克显示覆盖缺口。正式首批10条目尚未开放PT-76，测试用独立合成目录提供明确分类，不修改已发布JSON。
- Officer／Senior Officer按已录标记只计一次，Scout／Scout2按显式标记及数量统计；不按Platoon Commander名称或Reconnaissance分区自动增加。主样本Officer=1、Scout权重=1。
- A05升级计数范围未明确时保留blocked-unknown-data，A05／A06组合仍不开放。始终保留full-army-coverage缺口，无错误只表示已实现检查未发现违规，不称整本军表合法。
- 可用性通过纯候选添加及新旧问题对比返回allowed／blocked／unknown，带稳定原因代码及来源。未知价格／相关输入不会显示成确定可购；整体coverage仍在军表评估中独立显示。
- 模块实例绑定目录精确身份，不回退最新版本，也拒绝与调用上下文不同的目录身份。

## 验证

- 类型检查退出0（`.tmp/m07/typecheck.log`及最终检查）。
- 14文件218项单测通过，退出0（`.tmp/m07/tests-final.log`）。包含已发布目录的398/23主样本及Officer／Scout、独立手工违规、两种支援池、4个规模Restricted临界值、Unique、场景／身份、TOC、未知数据、四种PT-76触发及T-62例外、可用性和上下文隔离。
- 首轮213/214，唯一失败是M02状态断言仍要求planned；模块已实际接入规则，更新为in-development且保留边界检查，原日志`.tmp/m06/m07-tests.log`。
- 生产构建与目录发布检查退出0（`.tmp/m07/build.log`）。本轮未新增Web交互，不重复浏览器壳测试；M08再做实际编辑浏览器流程。

未实现全量Classic数据、未确定组合或对局状态；正式可购范围仍限M04的10条目。M07完成后单独提交，再检查账户额度决定是否推进M08。
