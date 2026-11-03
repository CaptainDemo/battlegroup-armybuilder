# M03 领域契约与 schema — Spacecraft 实现契约

日期：2026-11-03。用户已明确恢复并要求通过Spacecraft使用GLM启动M03。M02已验收，本任务独立派发；任务登记不代表执行完成或验收通过。仅完成M03，主Agent验收后暂停，不自动启动M04。

## 目标

在M02实际工程配置上实现领域契约和Zod边界校验：RosterDocument、Selection、ArmyStructure、目录外壳、OptionGroup及Option、来源、版本、Evaluation和Availability结果协议。

分区树与购买树分离，使用稳定实例／成员目标；表达嵌套固定组成、独立购买、明确无需实体及组成未知；区分known、unknown、not_applicable及有限／无上限限制。选择按本体系及明确版本解析；Classic/AirLand/NORTHAG同名同属性记录仍相互独立。训练与战斗属性保持体系自己的schema边界。

使用M01实际样本验证表达能力，特别是：编制独立价格、递归all包含附属BMP、第二Fire Support另占一个局部名额、全军Support units与Platoon Support Options独立、PT-76触发需可遍历嵌套选择、仅列Points的选项BR差额为已知0。这里只建立表示与结构校验，不在M03实现上述游戏规则计算器。

## 验收边界

- 有符合真实样本的正例；有孤儿／循环／重复实例、错误选项目标、不合理数量、跨体系引用等有区分度的负例。记录哪些检查属于schema形状，哪些需要显式传入目录的引用／关系校验，不声称Zod单文件解析完成了所有语义检查。
- 三套合成同名数据分别加载，互不合并；NORTHAG分区树、one each及非实体购买使用合成契约样本，不录入未经核实的真实阈值。
- M01账目保留只读。测试从其已核实事实构造契约输入，不把费用行格式当最终RosterDocument，不把字面expectedTotals当规则引擎结果。
- 不实现M04目录加载器、M05编辑命令、M06计价引擎、M07规则执行或后续UI／存储。Evaluation是返回协议，并不意味着已有evaluate实现。
- 类型检查、针对性Vitest及工程构建通过；现有M02页面及模块依赖不回归。

## 实际入口与执行参数

- projectRoot：`C:/Projects/Respositories/battlegroup-armybuilder`。
- 执行器：默认Claude Code后端，沿用已配置的GLM及`open.bigmodel.cn`服务；不选择Pi，不修改模型、账户、插件或全局配置。若实际服务／模型不符，报告并停止，不静默切换。
- 用户已授权本工程M02/M03的代码实现及必要资料使用；本次参数明确为`timeoutSeconds=5400`、`maxTurns=200`、`effort=max`，原生auto权限，保留正常配置。不使用美元估算预算。
- 现有包：`@battlegroup/core` → `packages/core/src/index.ts`；`@battlegroup/classic-coldwar` → `packages/rulesets/classic-coldwar/src/index.ts`；Web包为`@battlegroup/web`。均直接消费TS源文件，无需新增独立包构建流程。
- 使用npm及既有`package-lock.json`。现有`vitest.config.ts`在Node环境发现两个包`src/**/*.test.ts`；测试与合成契约样本放在包内，不需要为了测试创建AirLand或NORTHAG实现包。
- 严格TS配置包括`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`及`verbatimModuleSyntax`。依据现有入口增量实现，不放宽编译要求。

## 允许的写入范围

| 路径 | 目的 |
|---|---|
| `packages/core/` | 公共契约、Zod schema、纯结构／引用校验、针对性测试及合成样本；package.json加入Zod |
| `packages/rulesets/classic-coldwar/` | 必要的Classic训练／属性schema边界及测试，保留现有Web所用描述入口 |
| `package-lock.json` | 用npm更新真实依赖锁文件 |
| `docs/development.md` | 更新实际契约入口、命令及依赖边界说明 |
| `docs/implementation/m03-contracts.md` | 公开API、语义边界、样本覆盖及检查分工说明 |
| `docs/implementation/m03-result.md` | 完整交付报告 |
| `.tmp/m03-validation/` | 本任务验证日志、退出码与临时输出 |

依赖安装可以写入现有被忽略的`node_modules`，工程构建／浏览器验证可以生成既有`dist`和测试产物；它们是工具生成物，不是新增产品范围。不要修改Web源文件、M01 fixtures、原始资料、任务契约、AGENTS或其他阶段文档。无需删除或重命名已有产品文件；保留工作区所有无关内容，不提交／推送。需要超出上述产品路径时先报告原因，不能自行扩大任务。

## 契约必须保留的语义

1. 记录引用包含体系、目录及准确revision，localId不按名称匹配；玩家实例ID独立。引用校验接收显式目录上下文，不进行网络／文件加载，不提供M04加载器。
2. 军表分区树与购买树分开。固定子排／成员属于父价，独立付费附件保留自己的实例和归属；稳定成员目标不用排序数组下标。明确无实体与组成未知分开。
3. 选项定义与实际选择分开，明确父编制／分区／全军等作用域、组内及逐项数量、one each、稳定目标、一次／按目标计价、零及负差额。递归all可以声明为作用域选择器；本阶段不执行型号升级或费用计算。
4. 支援额度的产生、消费、类别资格和作用域可表达；全军Support units与本排Platoon Support Options是不同资源，不内置一个统一support上限。规则阈值属于具体数据／规则，不能硬编码进core。
5. 基础Points／BR与选项差额分开；已知0、未知和不适用有可辨别状态，限制另分有限／无上限。允许负差额不意味着允许负购买数量；仅列Points的已核实选项用已知BR差额0。
6. 来源身份、PDF页序／印刷页码、权威性、转录核对、勘误应用状态独立；版本至少分文件schema、rulesRevision和catalogRevision。预算与规模分别保存，不互相推导。
7. Evaluation／Availability只定义协议：身份及输入revision、组成、ChargeLine及计费归属、带完整性的总额、统计／额度、带定位／来源的问题、独立覆盖状态、allowed／blocked／unknown。不得导出貌似可用的计费或游戏合法性评估函数。
8. core不含具体训练枚举或共享战斗装备库。Classic训练允许i/r/v/e；未经核验的属性明确未知。其他体系仅用合成数据证明隔离，不建立真实目录或共享同名游戏记录。

现有`dependencyBoundary.test.ts`把M02的core零依赖写成断言，须随Zod引入调整为允许明确的纯schema依赖，同时保留禁止React／DOM／浏览器存储／具体规则反向依赖。Classic如直接import Zod，必须声明直接依赖，并相应更新边界测试；不能依赖偶然的npm提升或弱化隔离保证。新依赖API以安装版本及官方文档为准。

## 样本与检查分工

- 从`classic-sample-scope.md`及M01已核实事实构造小型测试目录和购买文档；它们是契约测试数据，不是正式可发布目录。
- 在契约说明中逐项映射23份M01账目所需的表示能力。重点正例覆盖B01、连内固定组成、附属BMP参与all、第二Fire Support、独立的两种支援池、PT-76嵌套选择、免费／负差额及训练变化。
- M01中故意超预算、超游戏名额或违反PT-76规则的案例仍可能具有合法的文档结构。不能为了“负例通过”在M03提前实现游戏规则；结构负例另行构造并测试。
- Zod检查形状、数值范围、可辨别状态；纯关系校验检查重复ID、孤儿、父子循环、分区归属、目标存在／归属、目录版本与同体系引用。明确每类检查的入口、前置及返回问题，不把未检查项宣称已覆盖。
- 三套合成目录使用相同名称及属性，并可故意复用localId以证明完整身份隔离；单独校验不需要其他体系记录，跨体系／错误revision引用必须拒绝。NORTHAG只表达已知分区结构、one each及非实体请求，不写未经核实的真实阈值。
- A05／A06相关含混组合不开放，不新造解释。原始PDF仅在必要时读取定位，不重做M01或扩展数据范围。

## 验证与交付

在仓库根目录执行，逐条保存完整stdout／stderr和真实退出码到`.tmp/m03-validation/`，失败也保留：

1. 加入必要Zod依赖后，用npm更新锁文件；运行`npm ci`确认复装。
2. `npm run typecheck`。
3. `npm test`，包含有区分度的结构／引用正负例及既有边界测试。
4. `npm run build`，检查产物不含references、fixtures和协作日志。
5. 系统Chrome运行既有5项Web测试：PowerShell设置`$env:PLAYWRIGHT_CHANNEL='chrome'`后运行`npm run test:e2e`。沿用M02已有浏览器，不为本任务长时间下载Chromium；端口被无关服务占用时使用临时专用配置及端口，禁止终止无关进程。
6. `python tools/data-import/check_m01_fixtures.py`确认原始来源和23份账目保留；若python不在PATH，使用现有uv Python解释器。该检查不是规则引擎测试。

若验证受环境权限影响，如实保留失败和未验证项，不通过放宽测试断言消除。必要验证完成即交付，时间／轮次数量是上限，不要求耗尽。

`m03-result.md`必须包含：实现与公开入口、实际修改文件、样本映射、schema与关系校验的分工、每条关键命令及退出码、失败／未执行、剩余范围，以及执行器提供的本轮关联码。正式CLI最终回复也必须完整说明交付，不能只返回“报告已写入”。不委派其他执行者，不继续M04或部署。主Agent回传后核对B→C差异并独立验收；验收后暂停。

## 输入冻结

主Agent在派发前计算当前必读文件SHA256，通过Spacecraft的`requiredInputs`冻结，并在`.tmp/m03-dispatch/`保留契约副本。以本契约、当前AGENTS、架构、最新Classic解释及M02实际配置为依据，不复用历史M02哈希。执行器不修改冻结输入；`docs/development.md`及包入口作为可写的现状资料读取，不当作禁止修改的冻结文档。
