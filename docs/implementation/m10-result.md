# M10 导入导出与兼容处理 — r2 修订交付报告

日期 2026-11-09。任务 t20261109015027-d390cf07，父执行 a1（needs_rework），本轮为显式修订 r2（`docs/implementation/m10-spacecraft-revision2.md`）。Git HEAD 仍为 `0601352`，无提交／暂存。a1 实现与失败证据全部保留；独立复现 `.tmp/m10-review/`（含 `probes-before.log`）未改动。交付状态：**实现完成，待主 Agent 验收**。

## 修复内容（对应 r2 六项条件）

### 1. 覆盖绑定本页已知 saveRevision（阻断问题 1）

`applyOverwrite`（`apps/web/src/features/roster-transfer/applyImport.ts`）不再 `store.read` 重取最新版本。新语义：`queue.settle(target)` 等待本页在途与合并待存写入全部落地后，取保存槽**最后确认的 saveRevision** 作为 compare-and-write 令牌。另一标签页在本页载入／选择目标后、确认前提交的新版本因此必然返回 conflict，远端内容与本页内存草稿都保留。签名不变（store, queue, source, targetRosterId, newRevision），独立回归以原签名调用并通过；新增槽位 `deleting`／`deleted` 拒绝（missing），防止 tombstone 版本复活已删军表。外壳仍不携带任何存储版本。

### 2. 覆盖与自动保存队列的有界交接（阻断问题 1 关联）

按当前结构的最小方案：覆盖 = settle（排空在途与合并待存）→ 槽位版本写入 → 成功即 `queue.restore` 替换并锚定槽位。覆盖期间新入队的草稿持有旧槽对象引用，其排空写在事务中与新行冲突，旧内容无法写回；失败（conflict／missing）时槽位、原记录与内存草稿均不动。新增真实交错测试（手动控制 store.save 请求的 resolve 时机，请求真正到达交错点，非立即完成的桩）覆盖：正常写入排空后覆盖、在途＋合并待存两级排空、覆盖写入在途期间新编辑竞争（旧内容不回写）、错误队列上覆盖并清除错误槽、本页删除后拒绝覆盖。

### 3. 单份入口一致 2 MiB 门槛 ＋ File.size 先行（阻断问题 2 与补充项）

`parseImportFile` 在识别出单份 kind 后立即对三种入口一致执行 2 MiB 检查：`roster-file/1` 外壳、裸 M09 文档、可识别未知格式原稿；备份文件只受 20 MiB 全局门槛约束。深度（64，迭代度量）与记录数（200）在递归结构检查／逐条分类之前生效（维持 a1 顺序并已复核）。`ImportPanel.onFile` 先检查 `File.size` 超过 20 MiB 即拒绝，不再先调用 `file.text()` 把超大文件读入内存。浏览器验收用 `File.prototype.text` 计数探针证明 21 MiB 文件被拒绝时 `text` 调用次数为 0。

### 4. 含错误条目的备份整批拒绝（补充项）

预览中存在任一 error 条目时：确认按钮禁用，预览内 alert 显示错误数量与整批拒绝原因（"whole batch is rejected and nothing is written"），不做静默部分导入，不显示笼统成功。采用 r2 建议的最小实现；条目级选择／跳过留作未来显式功能（未实现，如实说明）。

### 5. 两项真实浏览器验收（补充项）

新增于 `tests/e2e/roster-transfer.spec.ts`：

- **双标签页覆盖冲突**：同一浏览器上下文两个页面；page1 创建示例并保存（rev 1）、导出文件；page2 从库中打开并改名保存（rev 2）；page1 经应用内"Back to My Rosters"链接返回（保持同文档，队列仍锚定 rev 1），选择覆盖目标并确认——结果为 conflict 提示，page1 内存草稿名称保留，冷 reload 后远端内容（'Remote edit wins'，398 Points）完好。
- **保存失败后导出内存草稿**：真实浏览器内以同步抛出补丁破坏 `IDBObjectStore.prototype.put`（返回 rejected Promise 会使 Dexie 请求悬挂，已实证并改用同步抛出驱动事务中止）；新增购买后显示"Not saved. Your draft is still available in this page."且 Points 超过 398；Export JSON 下载的文件包含 10 条选择（9＋新增）；恢复写入后该文件可预览（ready、10 purchases）并复制导入，打开后 Points 与失败页面实时值一致。

另新增两项支持性浏览器检查：混合备份（1 ready＋1 跨体系引用 error）整批拒绝且无写入；裸 M09 文档 >2 MiB 在 UI 被拒，且 >20 MiB 文件不读取 text。

### 6. 独立端口回归配置

新增 `.tmp/m10/playwright.config.ts`：端口 4199、`reuseExistingServer: false`、Chrome 通道取自 `PLAYWRIGHT_CHANNEL`。根 `playwright.config.ts` 未改动（超出 writeScope）。

## 实际修改文件（相对 a1 的增量）

- 修改 `apps/web/src/features/roster-transfer/applyImport.ts` — 覆盖改用队列锚定版本、删除中／已删除拒绝（上述第 1、2 项）。
- 修改 `apps/web/src/features/roster-transfer/parseImportFile.ts` — 单份三入口一致 2 MiB 门槛（第 3 项）。
- 修改 `apps/web/src/features/roster-transfer/ImportPanel.tsx` — `File.size` 先行；含 error 条目整批拒绝与提示（第 3、4 项）。
- 修改 `apps/web/src/i18n/en.ts` — 新增 `transfer.batchRejectedPrefix/Suffix`。
- 修改 `apps/web/src/features/roster-transfer/applyImport.test.ts` — 新增 `manualStore`（手动控制请求交错）与六项覆盖交接测试，重命名一项旧描述（"locally read revision"→"page-known acknowledged revision"）。
- 修改 `apps/web/src/features/roster-transfer/parseImportFile.test.ts` — 裸文档／未知格式 2 MiB 门槛测试。
- 修改 `tests/e2e/roster-transfer.spec.ts` — 新增 4 项浏览器测试（第 3、4、5 项）。
- 新增 `.tmp/m10/playwright.config.ts`（第 6 项）。
- 更新 `docs/implementation/m10-contracts.md`（门槛表、覆盖语义、API 说明）、`docs/development.md`、`docs/implementation_modules.md`（状态改为"实现交付，待主 Agent 验收"）。
- a1 交付的其余文件未变动。

独立失败证据 `.tmp/m10-review/regressions.test.ts`、`probes-before.log` 与评审文档为只读交接材料，未改动。

## API 变更与测试对接说明

`applyOverwrite` 签名未变；内部语义按 r2 调整（expectedRevision 来源从"重读存储行"改为"settle 后保存槽最后确认版本"，新增 deleting／deleted 拒绝）。独立回归以原参数调用，修复后无需修改即通过。`RosterStore`、`importBatch`、`parseImportFile` 签名均未变。

## 验证（命令、真实退出码、日志路径）

| 命令 | 退出码 | 结果 | 日志 |
|---|---|---|---|
| `npx vitest run --config .tmp/m10-review/vitest.config.ts`（修复前复现） | 1 | 2 项独立回归失败（与评审一致） | `.tmp/m10/regressions-before.log` |
| `npx vitest run --config .tmp/m10-review/vitest.config.ts`（修复后） | 0 | 2 项独立回归通过 | `.tmp/m10/r2-final-regressions.log` |
| `npm run typecheck` | 0 | 三包 tsc 通过 | `.tmp/m10/r2-final-typecheck.log` |
| `npm test` | 0 | 24 文件 333 项全过（a1 327＋新增 6） | `.tmp/m10/r2-final-vitest.log` |
| `npm run build` | 0 | 主块 523.40 kB／gzip 156.49 kB，既有 >500 kB 警告仍在 | `.tmp/m10/r2-final-build.log` |
| `PLAYWRIGHT_CHANNEL=chrome npx playwright test --config .tmp/m10/playwright.config.ts` | 0 | 18/18（7 项 shell＋目录资产＋11 项 transfer，含 4 项新增） | `.tmp/m10/r2-final-e2e.log` |

浏览器验收环境：系统 Chrome（`C:\Program Files\Google\Chrome\Application\chrome.exe`）、独立端口 4199、`reuseExistingServer: false`。

## 开发中失败与修复记录（均保留日志）

- 独立回归修复前 2 项失败（见上）。
- 交错测试初版微任务刷新不足／漏一次手动 resolve／`row()` 可空导致 3 项失败（`.tmp/m10/r2-unit-1.log`），修复后通过。
- 浏览器双标签页测试初版失败（`.tmp/m10/r2-e2e-1.log`）：实证发现 Playwright `page.goto('/')` 从 `#/editor` 触发**完整重载**（探针 `.tmp/m10/nav-probe.spec.ts`：marker 丢失），page1 因此从存储重载并把队列重锚定到 rev 2，覆盖按"本页已知 rev 2"合法成功——应用行为符合契约，测试场景构造有误；改用应用内链接同文档导航后通过。此发现同时确认：重载页面会以存储行为准重新锚定，与"本页已知版本"语义一致。
- 保存失败模拟初版返回 rejected Promise 使 Dexie 请求悬挂（状态卡"Saving…"，`.tmp/m10/r2-e2e-fix1.log`）；探针验证同步抛出可驱动事务中止后改用之。
- 一项暂时性探针文件曾放入 `tests/e2e/`（导航／失败模拟验证），验证后即删除，未进入最终交付。

## 未执行与已知限制

- 条目级"部分导入"（选择／跳过与结果计数）未实现——按 r2 优先采用整批拒绝的最小实现。
- 覆盖仍会替换目标军表全部内容与撤销历史（含覆盖确认瞬间该军表在本页未保存的编辑）；显式覆盖语义，UI 有模式选择＋目标名称二次确认。
- 原稿恢复行沿用 M09 形态（不可删除／编辑，仅可再下载）；重复导入同一原稿会累积恢复行。
- 主块 523.40 kB 触发 Vite 默认阈值警告，与 a1 登记一致，未拆包。
- 根 `playwright.config.ts` 未改（超范围）；默认端口 4173 套件未单独重跑，本轮以 r2 指定的 4199 独立配置运行同一 `tests/e2e` 全量测试。

## 需主 Agent 判断的问题

1. 覆盖采用"本页已知（队列锚定）版本"而非"预览展示目标 saveRevision 供确认"实现（r2 条件 1 允许二者之一）；后者需向用户暴露内部版本号，如主 Agent 倾向展示式确认可后续调整。
2. 页面完整重载会把队列重锚定为存储最新版本（覆盖可据此成功）——这与"本页已知"语义一致（重载即重新知悉），e2e 已覆盖两种路径；如主 Agent 认为重载后也应提示"远端已变化"，属增强项。
3. 含 error 条目的备份整批拒绝后，用户需自行修改文件；是否需要条目级跳过 UI 由主 Agent 决定。

本轮止于 M10 修复交付；Git 暂存／提交／推送、M11 及后续模块由主 Agent 处理。
