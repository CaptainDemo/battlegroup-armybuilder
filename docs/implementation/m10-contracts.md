# M10 导入导出契约与格式

日期为 2026-11-09。本文记录 M10 交付的文件格式、限制、兼容分类、存储接口和 UI 流程。实现入口在 `apps/web/src/features/roster-transfer/`、`apps/web/src/adapters/storage/` 与 `packages/core/src/contracts/transfer.ts`。

## 文件格式

外壳只携带格式版本、类型和时间戳；主数据始终是玩家的 `RosterDocument`（或原稿）。外壳不携带 Points／BR、派生组成或数据库 saveRevision——文件中的任何版本号都不授予本地写入权限。

### 单军表文件 `roster-file/1`

```json
{
  "formatVersion": "roster-file/1",
  "kind": "single-roster",
  "savedAt": "2026-11-09T00:00:00.000Z",
  "document": { "...": "RosterDocument，formatVersion 为 roster/1" }
}
```

### 全库备份 `library-backup/1`

```json
{
  "formatVersion": "library-backup/1",
  "kind": "library-backup",
  "savedAt": "2026-11-09T00:00:00.000Z",
  "rosters": [
    { "rosterId": "…", "document": { "…": "RosterDocument 或原稿" } }
  ]
}
```

备份构建规则：以持久记录为基础，凡在本标签页有内存草稿的军表一律以内存最新选择替换（含未保存或保存失败的草稿）；仅在内存中存在、从未落盘的军表也会包含；删除标记（tombstone）不导出；不支持的原稿按原始字节包含。

### 旧输入

M09 恢复下载（无外壳的裸 `RosterDocument`，`formatVersion: roster/1`）仍是可导入输入，与 `roster-file/1` 外壳走同一分类。两者导入结果一致。

## 版本层次

按架构 §7.3 分别管理，互不推导：

| 层次 | 值 | 说明 |
|---|---|---|
| 文档格式 | `roster/1` | RosterDocument 自身格式（M03 起） |
| 外壳格式 | `roster-file/1`、`library-backup/1` | 本模块新增的文件外壳 |
| 数据库结构 | Dexie schema 2 | M09；M10 未改动 |
| 目录版本 | `1.0.0`、`1.1.0` | 按精确身份从应用索引加载，缺失即原稿 |

## 导入限制

门槛顺序固定：先字节、再解析、再结构，避免无界 `JSON.parse` 或递归遍历。

| 限制 | 值 | 阶段 |
|---|---|---|
| 任意导入文件 | 20 MiB | `File.size` 检查（读取 text 之前）与 `parseImportFile` 入口双重把关 |
| 单军表文件 | 2 MiB | 识别出单份 kind 之后；适用于外壳、裸 M09 文档与可识别未知格式三种入口 |
| 备份记录数 | 200 份 | 解析后、逐条分类之前 |
| 单军表购买数 | 5000 条 | 分类时（加载目录之前） |
| 单军表选项目标总数 | 20000 个 | 分类时（加载目录之前） |
| JSON 嵌套深度 | 64 | 解析后、任何 schema／递归校验之前，用迭代 `jsonDepth` 度量 |

ImportPanel 在读取 `file.text()` 之前先检查 `File.size`：超过 20 MiB 的文件不会先被完整读入内存再拒绝。r2 修订后三种单份入口（外壳、裸文档、未知格式）一致执行 2 MiB 门槛。

选项目标上限取 20000 的理由：5000 条购买 × 每条约 4 个目标的现实上界，足以容纳当前 Classic 目录（203 个选项）的任何合法军表，同时保证校验成本有界。常量集中在 `TRANSFER_LIMITS`（core），UI 说明文字同步列出。

## 兼容分类

每条记录独立分类为三种状态之一，预览逐一展示：

| 状态 | 判定 | 结果 |
|---|---|---|
| `ready` | `rosterDocumentSchema` 通过；限制内；精确目录从应用索引加载成功；`validateRosterCommandDocument` 无问题 | 正常导入为可编辑军表 |
| `original` | 文档可识别但（a）声明的目录身份不在应用索引（not-found／unsupported-version），或（b）声明未知 `formatVersion`（非本应用定义的版本） | 按原稿存为恢复行：不评估、不转换、可再次原样下载 |
| `error` | JSON 损坏；声称已知格式但结构不合法；同一文档内跨体系／跨版本引用、孤儿、循环等关系问题；购买／目标超限；目录已索引但当前无法校验（网络、摘要、数据损坏） | 不进入军表库，也不作为原稿保留；预览显示原因 |

关键边界：

- 未在应用索引中的目录身份只作为索引键查找，找不到即原稿；文件内的任何 URL、路径或提示都不会触发请求，目录只从应用索引 + 固定 base URL 加载。
- 目录已索引但校验失败（network-error／digest-mismatch／invalid-data）如实报错，不猜测为"不支持"，也不当作可导入。
- 1.0.0 与 1.1.0 均按精确身份加载和计算；1.0.0 文件不会静默切换到 1.1.0。

## 导入写入语义

- **默认复制**：生成新 `rosterId` 与新编辑 `revision`；成员／附件 `selectionId`、挂载路径、选项目标、设置、备注、目录版本全部原样保留。文件内身份冲突不可能发生（全部换新 UUID）。
- **显式覆盖**（仅单军表导入）：用户先选择"覆盖"模式并明确选择目标军表，再经确认对话框执行。`expectedRevision` 是**本页已知**的版本：覆盖前先 `queue.settle` 等待该军表在途与合并待存写入全部落地，然后取保存槽最后确认的 `saveRevision` 作为 compare-and-write 令牌。实现刻意**不**重新读取数据库——重读会把其他标签页在本页载入之后提交的新版本静默授权给覆盖。以本页令牌写入时，另一标签页在载入与确认之间的提交表现为 conflict，远端内容与本页内存草稿都保留。外壳不携带任何存储版本。槽位处于 `deleting`／`deleted`（本页删除中／已删除）时拒绝覆盖，防止用 tombstone 版本复活已删军表。成功后 `queue.restore` 把保存槽替换并锚定到新存储版本，旧槽对象（包括覆盖期间新入队草稿的排空任务）不再挂在映射中，旧内容无法写回；失败（conflict／missing）时保存槽、原记录与内存草稿均不动，可继续编辑或按既有方式恢复。
- **全库导入**：所有新行在单个 Dexie 读写事务内创建，任何一条失败整体回滚，不出现半完成状态。正常记录与原稿在同一操作内写入，预览已分别标明其保存方式。预览中存在任一 error 条目时整批拒绝：确认按钮禁用并显示原因与数量，不做静默部分导入（r2 修订；条目级选择／跳过留作后续需要时的显式功能）。
- 预览阶段不写数据库、不改会话；取消仅丢弃预览。确认后才调用写入。

## 存储接口增量

`RosterStore` 新增（`save`／`remove` 语义不变）：

```ts
importBatch(writes: readonly ImportWrite[]): Promise<StoredRoster[]>
// ImportWrite =
//   | { kind: 'document'; rosterId: string; document: RosterDocument }
//   | { kind: 'original'; rosterId: string; document: unknown }
```

实现为单事务批量 `put`：遇已存在 ID（含 tombstone）、重复 ID 或文档 schema 失败即抛错回滚。原稿行若恰为 `roster/1` 文档则重建摘要用于列表显示，否则摘要为 null。

## UI 入口

- 首页 "Import & backup" 卡片：文件选择（真实 `<input type="file">`）、预览（逐条名称、体系／目录／版本、状态、数量、写入方式）、确认／取消、全库备份下载。
- 军表条目与编辑器工具栏的 "Export JSON"：读取当前内存草稿导出单军表外壳（未保存或保存失败亦可导出）。
- 恢复条目（原稿）沿用 M09 的 "Download recovery JSON"，下载内容可再次导入。
- 覆盖模式仅在选择单军表 ready 记录时出现；确认使用 `window.confirm` 二次确认。
- 预览与面板样式适配 360px 小屏（无横向溢出）。

## 公开 API 一览

`@battlegroup/core`（`contracts/transfer.ts`，经 index 导出）：

- `SINGLE_ROSTER_FILE_VERSION`、`LIBRARY_BACKUP_FILE_VERSION`
- `TRANSFER_LIMITS`
- `singleRosterFileSchema`、`libraryBackupFileSchema`、`libraryBackupEntrySchema`、`rosterOriginalHintSchema`、`KNOWN_FILE_FORMAT_VERSIONS`
- `jsonDepth(value)`（迭代深度度量）
- 类型 `SingleRosterFile`、`LibraryBackupFile`、`LibraryBackupEntry`

`apps/web/src/features/roster-transfer/`：

- `parseImportFile({ byteSize, text }, loader?)` → `ImportFilePreview`（纯解析分类，无副作用；单份三入口共用 2 MiB 门槛）
- `buildLibraryBackup(drafts, store)` → 备份外壳
- `singleRosterFile(document)`、`downloadSingleRoster(document)`、`downloadLibraryBackup(file)`
- `applyImportCopy(store, queue, records, freshId)` → `{ sessions, originals, releases }`
- `applyOverwrite(store, queue, source, targetRosterId, newRevision)` → saved／conflict／missing。签名与 a1 相同；r2 起内部语义变化：expectedRevision 取自 `queue.settle` 后保存槽的最后确认版本（本页已知），不再重读存储行，另新增 deleting／deleted 槽位拒绝。独立回归 `.tmp/m10-review/regressions.test.ts` 以原签名调用并通过。
- `<ImportPanel …/>` 组件（`File.size` 先于 `file.text()`；含 error 条目的备份整批拒绝）
