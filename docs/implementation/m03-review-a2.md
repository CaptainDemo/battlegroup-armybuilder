# M03 a2 中断记录：GLM额度耗尽，部分实现未验收

日期：2026-11-03。Task `t20261103050906-206dcc9c`，revision 1 / attempt a2。此前a1的7项返工要求见[m03-review-a1.md](m03-review-a1.md)。本轮没有有效正式结果，不得标记accepted。

## 真实失败原因及停止状态

get_task确认execution.status=failed、CLI退出1、helperDrained=true、helperActiveAfterDrain=0、processTreeStopped=true。执行时间05:50:55–06:11:19 UTC（北京时间13:50:55–14:11:19），73轮，未触及5400秒／200轮上限。

CLI流最后一个result为`terminal_reason=api_error`、`api_error_status=429`，正文原样为：

> API Error: Request rejected (429) · [1308][已达到 5 小时的使用上限。您的限额将在 2026-11-03 14:59:45 重置。][2026110314112338567372b27842ed]

此前一次Bash未执行，工具结果明确为auto模式的安全分类模型暂时超时（automode-unavailable）；其后API返回上述额度错误。stderr另有unrecognized_model警告，但已有GLM实际模型响应及代码写入，不能单凭该警告推断模型从未调用或擅自修改配置。

插件错误码`continue_delivery_gate_failed`、细项`final-result-missing-new-marker`，是终结结果不具备本轮完成报告／关联码的交付门槛失败；底层可观察原因是API额度拒绝。resultSha256=null，没有有效正式报告。通知event中的哈希不是可用于accepted的正式结果哈希。

无结果终态引用为`19e14642e06f643670b39d3ffb785f0c6bad6e41bfef04de8cde19001c116ebb`，仅用作记录failed终态及后续续接引用。模型／账户／插件配置均未修改；额度重置前未再次调用GLM。服务提示的重置时间不是已实测的恢复保证。

## 部分修改及独立诊断

- B→C差异generated：新增2项、修改17项、删除0项，无范围外观察。部分实现已保留，没有回滚或清理。
- 独立核对18份冻结输入及19份本轮新增／修改文件的最终SHA256，全部一致。证据`.tmp/m03-acceptance/a2-integrity.json`。
- 已见稳定ownerSelectionId目标、精确身份检查、Classic体系绑定、directlyPurchasable检查、输入revision、第二Section独立组成／费用以及基础训练字段的代码与测试修改；这仅表示返工已经发生，不代表7项全部验收关闭。
- 独立`npm run typecheck`退出0，日志`a2-01-typecheck.log`。
- 独立`npm test`退出1：9文件，139项通过、2项失败（共141项）。日志`a2-02-vitest.log`。不能将此前a1的105项通过当成本轮全通过。

两个失败的初步定位：

1. attachment-owner-not-descendant负例将目标owner设为`hq`，但F01本身只有company及附属，没有hq实例，实际得到owner-unknown；需构造确实存在且不属于该父编制的实例来测试后代关系，不能仅替换错误码断言。
2. 第二Fire Support消耗断言额外要求note包含A04，实际数据已有正确resourceKind及amount，但没有该note。应测试语义与明确来源；不要让任意备注字面值替代规则表达验证。

另需在续接审查中核对：当前`attachment-member`分支绕开`member-slots`声明的目标集合限制。该行为从源码可见，但本轮未为其执行独立复现；不能据此声称另一个问题已验证，也不能在返工后忽略原有“错误目标拒绝”的验收边界。

本轮build、npm ci、浏览器及M01账目尚未独立重跑；原M03文档报告仍是a1版本，不能描述a2的新API或完成状态。主Agent没有修改产品代码、测试或外部报告来掩盖未完成交付。

## 继续条件

M03尚未通过。GLM额度恢复后可从本failed终态引用继续同一任务，保留5400秒／200轮和现有范围；先修复未完成的验证与目标边界，再更新正式契约说明及结果报告。新执行需有自己的关联码与真实结果；不复用a1报告或将API错误正文当完成结果。后续由主Agent独立验收，验收后暂停，不推进M04。
