# M02 Spacecraft 实现交接

日期：2026-10-30。交接已于2026-10-31完成并通过[主Agent验收](m02-acceptance.md)，任务`t20261030152231-8a652458` revision 1 / a1。以下保留派发时的实现约定；当前按用户要求暂停。目标工程：`C:/Projects/Respositories/battlegroup-armybuilder`。

## 授权与执行参数

用户已在当前对话明确授权Claude Code执行器及其GLM模型进行本项目代码实现，覆盖M02及后续M03。当前服务范围为open.bigmodel.cn，不将Claude Code执行器名称描述成Anthropic模型身份。主Agent负责实际派发、验收和后续任务，外部执行器不得自行启动另一任务。

用户选择先升级插件至单任务5400秒、200轮。2026-10-30源码与安装副本已更新，类型检查／构建／6项契约测试及独立MCP进程的两处schema核验通过。当前桌面加载状态需通过真实入口接受本契约确认；不能把磁盘升级当作已重载。M02派发参数为timeoutSeconds=5400、maxTurns=200、effort=max；不以旧参数静默替代。

## 本轮目标

只实现M02工程与构建基础。使用npm workspaces，React + TypeScript + Vite静态Web壳、hash路由、独立纯TypeScript核心包及Classic规则包的最小入口。不要实现购买操作、计价、组军校验、存储、正式目录录入、完整编辑器或部署。

现有Node为22.22.2、npm为10.9.7。执行前再次确认实际环境；查询依赖官方文档／包元数据，选择与环境兼容的稳定版本，写入锁文件。不要默认全局安装pnpm或升级Node。普通依赖安装及必要的浏览器测试依赖属于本轮准备，可记录安装失败及原因，不为其修改用户正常Claude配置。

## 输入优先级

1. 首先读取根`AGENTS.md`；本交接单限定本轮M02范围。
2. `docs/architecture.md`、`docs/implementation_modules.md`和`docs/technical_plan.md`描述工程边界。
3. `docs/data/classic-ambiguities.md`及`classic-constraints.md`记录用户已确定的规则解释；不得把已解决项重新作为阻塞。
4. `tests/fixtures/classic-coldwar/`是人工资料样本，不是最终运行时schema，不照抄其费用行结构作为军表。

三套规则的全部游戏记录完全隔离；本轮只准备Classic包，不创建AirLand/NORTHAG伪实现。共享仅限代码、类型及UI能力。Core不依赖React、浏览器数据库或具体规则包；规则包可依赖core，Web负责组合。

M01的A01/A02/A03/A04/A07/A09均已由用户明确解释解决。A05/A06仅影响相应选项，不阻塞本轮；A08为资料覆盖说明，不是已有代码实现的阻塞。

## 交付文件与保护边界

预期源码／配置位置：

- 根目录package.json、package-lock.json、TypeScript共享配置、.gitignore及必要npm配置。
- `apps/web/`：入口、样式、路由、Vite及TS配置、英文界面词典入口。
- `packages/core/`、`packages/rulesets/classic-coldwar/`：最小可导入入口及包配置，不预写M03领域schema。
- Vitest配置、`tests/e2e/`的单个Web壳主要访问路径检查及Playwright配置。
- 根README.md或`docs/development.md`：准确安装、启动、类型检查、测试、构建命令与环境要求。
- `docs/implementation/m02-result.md`：实际交付、命令及退出结果、失败或未执行项、剩余范围。

现有docs、references、M01 fixtures和tools为只读输入，不删除、移动、格式化或重写。根LICENSE保持原样。仓库有大量原有未跟踪资料；保留它们，不能清理、git reset、批量git add或提交。已有交接单只读，结果另写文件。

依赖、缓存、dist、测试报告是生成物，应由.gitignore排除；验证报告可放`.tmp/m02-validation/`。主Agent派发时需将必要生成物的写入与源码差异范围分别说明；writeScope是差异观察边界，不是沙箱。禁止把整个仓库、references或.tmp映射为公开资源。

## 验收

1. 干净依赖安装可使用锁文件复现；根目录提供清晰的dev、typecheck、test、build等脚本，实际名称写在README。
2. Web壳能通过hash路由访问并显示明确的规划阶段页面，不假装军表功能已经可用；英文字符串集中管理，基本小屏布局可用。
3. Core及Classic包入口可在无DOM的Node测试环境导入；无反向依赖、跨体系游戏数据或虚假规则函数。
4. 类型检查、针对性的测试、静态构建实际执行并记录退出码。Playwright验证页面加载及hash路径访问；若浏览器环境无法建立，如实报告，不能把构建成功写成浏览器通过。
5. 检查静态产物没有原始PDF、参考包、fixtures、任务日志或缓存；资源基础路径可配置。
6. 不为可逆页面文案堆叠镜像测试；不为M03提前构造大型框架。

达到验收后及时交付，不为了耗尽剩余回合追加M03或其他功能。遇到需要扩大范围的问题，保留已经完成的代码和诊断，明确报告。

## 主Agent接收

先get_task读取本attempt的结果、基线B到完成C的changes及真实执行记录，区分原有文件与本轮变化。审查源码后独立运行适用检查。只有M02验收后才更新M03输入哈希并派发M03，不允许两个外部任务同时修改本工程。
