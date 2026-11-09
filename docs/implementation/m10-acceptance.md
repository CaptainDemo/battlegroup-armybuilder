# M10 主 Agent 独立验收

日期为 2026-11-09。接受任务 t20261109015027-d390cf07 的 revision 2／attempt a2 实现。代码基线为 0601352，当前 M10 工作区尚未提交。

## 外部交付与差异

- a1 的覆盖并发与裸文件大小限制缺陷已登记为 needs_rework，详见 [a1 审查](m10-review-a1.md)。其正式结果和独立失败日志保留。
- a2 正式结果 SHA-256 为 25b974c9173b2abb26e7929ec918738fad773d7c79af23a3f424274461d157e2。新关联码、恢复 session、exitCode 0、进程停止和 Job 排空均已核对。CLI 流中实际模型为 glm-5.3，共 54 轮。
- a2 的 B→C 差异为 generated，30 新增、11 修改，包含临时验证产物。41 份交付文件的当前字节指纹与插件记录一致，本轮无范围外观察。AGENTS.md、冻结任务契约、a1 审查与独立复现文件均保持原始指纹。
- a1 新增的 packages/core/src/transferContracts.test.ts 未在其 writeScope 中声明。该事实保留在 a1 审查中，r2 已明确将该相关测试纳入允许范围。

## 独立检查

主 Agent 使用 .tmp/m10-review/run.ps1 保存完整日志和实际退出码。以下结果均由主 Agent 重新执行。

| 检查 | 实际结果 |
|---|---|
| a1 独立复现原样重跑 | 两项通过，退出码 0。a1 下同文件两项失败的日志仍保留 |
| npm test | 24 个文件、333 项通过，退出码 0 |
| npm run typecheck | 退出码 0 |
| npm run build | 退出码 0 |
| 系统 Chrome 回归 | 独立端口 4199、禁用服务器复用，18 项通过，退出码 0 |
| git diff --check | 退出码 0 |

独立浏览器回归覆盖真实文件下载、选择、预览、取消、复制导入与显式覆盖。单军表与全库往返、精确旧目录、不支持版本原稿、混合错误备份、大小门槛及 360px 布局均通过。专项确认了两标签页共用旧目标时，另一页更新后再确认覆盖会冲突，远端与本页草稿保留。模拟 IndexedDB 写入失败后下载的文件包含最新内存购买，并可再次预览和导入。

日志及退出码记录为 .tmp/m10-review/ 下的 probes-after-independent、tests-independent、typecheck-independent、build-independent、browser-independent 对应 log／JSON 文件，Git 忽略。

## 已接受的行为与边界

覆盖使用本页保存队列最后确认的 saveRevision，排空本页既有写入后进行事务 compare-and-write，成功后重新锚定队列与会话。刷新页面时重新读取存储版本。文件不携带本地数据库的写入权限。

全库备份导入采用复制模式，预览中存在错误条目时整批拒绝。合法但违反组军规则的草稿仍可导入。单份文件上限为 2 MiB，备份为 20 MiB，且文件读取前执行全局大小门槛。格式和数量边界见 [M10 契约](m10-contracts.md)。

不支持的原稿沿用 M09 恢复条目，只提供再次下载。主脚本为 523.40 kB、gzip 后为 156.49 kB，构建有默认 500 kB 阈值提示。后续打印与部署按模块计划另行实施。
