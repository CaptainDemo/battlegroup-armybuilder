# M05 纯编辑命令

日期：2026-11-03。入口：`packages/core/src/roster/commands.ts`，由core主入口导出。无React、数据库、网络、时间或随机ID依赖。

## 契约与行为

- `createRosterDocument(input, context)`：创建空军表，身份、编辑revision和设置由调用者提供。
- `executeRosterCommands(document, commands, context, nextRevision)`：新增、级联删除、复制子树、设置选项、替换购买定义、修改预算／规模／名称、重排。输入和命令内容不被修改，成功返回新的独立文档。
- `RosterCommandContext`显式传入目录及购买上下文；与M04发布外壳结构兼容，但core不依赖Classic或加载器。错父附件、顶层资格、精确引用与结构均检查；预算超限、重复Medic等游戏违规草稿允许保留。
- 批量中每个命令检查结构，任一失败整批返回原文档，不部分写入。调用者须提供与原文档不同的新编辑revision；它不代表未来数据库保存版本。
- 复制要求完整、无碰撞的新实例ID映射；内部parent及attachment-member拥有者同步重映射，成员路径不依赖数组排序，复制不共享可变数组。
- 删除父级连带删除附件；删除或替换引起目标失效时返回selection-removed／targets-removed／choice-removed提示。不会静默把失效目标移到另一成员。显式错误的配装命令被拒绝，不自动修好后假装成功。

当前只支持声明的购买上下文和静态组成挂载点；实时all目标重建由评估阶段负责，撤销／重做会话在M08装配。本模块不执行规则计数、计价或持久化。

## 验证

- 12项有区分度的命令测试，连同既有检查共162项通过（12文件，退出0）；日志`.tmp/m04/m05-tests.log`。
- 类型检查首次发现创建函数对象字面量把formatVersion扩大成string，保留`.tmp/m05/typecheck.log`；为文档补充显式RosterDocument类型，未放宽编译器选项，修复后退出0（`typecheck-final.log`）。
- 生产构建及构建前目录检查通过，退出0（`.tmp/m05/build.log`）。
- 命令测试覆盖无别名复制、目标重映射、同级隔离、级联删除、批量回滚、失效处理、显式错误目标、版本与购买上下文拒绝以及游戏违规草稿。没有修改Web交互，本轮未重复运行已通过的M04六项浏览器测试。

本阶段完成后单独提交并检查实际账户额度；低于20%暂停后续模块。
