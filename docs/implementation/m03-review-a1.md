# M03 a1 主Agent审查：需要返工

日期：2026-11-03。Task `t20261103050906-206dcc9c`，revision 1 / attempt a1。正式结果SHA256为`4900768bb29ff9ad200d82b254b5643821104e2ca3d31ca160337cea8a8ea2ab`。本文件记录原M03契约内的问题，不扩大到M04或规则引擎。

## 已核对的交付与验证

- get_task确认本attempt为当前执行，退出0，Job树已排空，进程停止；正式结果完整且关联码正确。实际assistant事件为GLM-5.3，服务open.bigmodel.cn。
- B→C差异generated：新增32项、修改7项、删除0项；无范围外观察、不可比较或截断。
- 独立逐项检查18份冻结输入，以及全部新增／修改文件的交付后SHA256，均一致。证据`.tmp/m03-acceptance/integrity.json`；未将整个dirty工作区当作本次修改。
- 独立`npm run typecheck`退出0；`npm test`退出0、9文件105项通过。日志在`.tmp/m03-acceptance/01-typecheck.log`和`02-vitest.log`。
- 新增独立结构验收探针4项，运行`npx vitest run --config .tmp/m03-acceptance/vitest.acceptance.config.ts`：退出1、4项均失败，证据`03-regression-probes.log`。失败是实际行为断言，不是文件名或实现形式断言。
- a1报告的npm ci、build、Chrome 5项及M01资料检查已有日志；主Agent发现下列阻塞后尚未独立重复这些检查，不能将外部报告写成独立验收通过。

## 返工关闭条件

### R1：成员路径解析绕过精确身份

`resolveRosterMemberPath`的`ownerRoot()`只用entryReference.localId查找目录，未校验体系、目录和revision。将B01的tank引用改为airland，Zod形状仍合法，公开解析函数仍返回Classic的t72a节点。对合法父实例的解析也可能穿过带外来引用的附件。原契约要求引用只在本体系和明确版本内解析，不能借用同localId记录。

关闭：公开解析入口及每次跨附件解析均验证完整身份和上下文；不匹配时拒绝解析，不返回借用节点。覆盖外来起点、外来附件、错误revision与roster目录上下文不匹配。关系校验不能一边报告身份错误，一边继续从另一个入口借用该记录。

### R2：附属成员目标依赖数组顺序，重复购买发生身份碰撞

给F01的同一子排增加另一份相同Fire Support、使用不同selectionId，现有schema与关系校验接受。路径`platoon-1/fire-support/transport`先解析为fs，反转selections数组后变为fs2。两份独立附件无法从父编制唯一寻址；静态节点与附属根同名也被静默优先选择。这里不要求执行重复购买上限，故不能以一律拒绝重复购买掩盖问题。

关闭：目标表达须保留实际拥有成员的selectionId或等价稳定实例身份，再配合稳定组成路径；必要时可调整尚未发布的M03格式、测试与文档。两份相同条目的独立附件及其运输均可分别寻址；重新排序不改变目标；歧义旧路径不得静默选第一项。补充父编制all同时覆盖重复附件、静态节点与附属根同名的案例。不能仅改样本root名称避开碰撞。

### R3：Classic专属schema未绑定Classic体系

将B01的catalogRef和全部selection引用改成northag，保持Classic规模token，`classicRosterDocumentSchema.safeParse`仍成功。`classicCatalogShellSchema`同样没有manifest体系限定，只扩展了属性及训练变化token。这会让专属schema错误地认领其他体系数据。

关闭：Classic目录与文档边界明确拒绝非classic-coldwar身份；其内部引用按原结构／关系校验职责完整检查。测试Classic正例及AirLand/NORTHAG同名同属性的负例，不将其他体系训练或属性强套Classic。

### R4：忽略directlyPurchasable导致分区结构约束无效

将B01目录tank分区标为`directlyPurchasable=false`，形状合法，但其顶层tank购买在`validateRosterRelations`中仍返回零问题。这个字段表达目录结构，属于既定分区归属检查，不是具体游戏阈值。

关闭：拒绝顶层选择放入不可直接购买的分区；保留通过可购买子分区的正常行为。覆盖NORTHAG合成main-force与其子分区的结构边界，不增加未核实数量规则。

### R5：Evaluation协议缺少输入revision

`EvaluationIdentity`只有rosterId、catalog和versions；`Evaluation`也无输入revision。原契约第7条和架构5.1明确要求输入revision以便拒绝过期结果。目录revision不能识别同一军表的连续编辑。

关闭：在纯协议中显式包含编辑输入revision（与目录版本及存储保存revision含义分开），说明生产者／消费者约定，并用类型／协议例子区分同一rosterId的两个编辑快照。无需实现编辑会话、数据库或评估器。

### R6：第二Fire Support只有费用和名额，没有新增组成

F02只有第一Section的独立购买；`second-fire-support`的effects为空，只声明费用差额及资源消耗，未声明第二Section的成员或其运输，也未有第二付费实例。schema只支持替换、训练变化及tag-grant效果，不能由这些数据表达该选项新增单位。23项结构零issue不证明这部分真实样本已完整表达。该缺口会直接影响已确认的all包含附属BMP，而不仅是未来计价。

关闭：通过显式新增组成的契约或上下文独立购买条目，完整表达第二Section及运输、自己的费用归属和所属排名额。它不是简单的第一Section重复全价，也不通过硬编码字符串ID推导隐藏组成。添加“两份Section + all升级”的组合契约正例，能唯一定位两辆附属运输；这里只声明与验证，不执行展开或计价。

### R7：缺少基础训练等级的实际承载字段

Classic提供i/r/v/e枚举并校验training-change，但core条目／组成与Classic专属条目／profile边界没有基础训练字段。现有样本只记录数值BR，不能表达B01中Regular坦克／步兵与Inexperienced Medic／ZSU并存，也不能描述T-62由i变r的起点。不能把等级藏在名称、备注或数值BR中反推。

关闭：以规则体系自己的schema承载基础训练值及所需目标范围；core若提供通用承载位，枚举仍留在Classic。允许未核实训练明确未知，不猜测；同一profile在不同购买上下文的训练不能被全局合并。用已核实M01事实演示混合训练与i→r声明，BR仍独立；不实现训练变更执行器。

## 本轮止步与后续验证

本attempt不接受，记录needs_rework。允许在原M03范围内返工；不修改冻结输入／M01资料，不继续M04。原始失败探针及日志保留。若因修复R2调整契约API，可新增适配后的正式回归测试，不要求临时探针永久兼容旧格式；必须保留其失败原因与通过证据的对应关系。

返工应收敛上述7项，不增加未来模块或无关规则。按原契约保留真实日志并重新运行与修改有关的检查；主Agent在回传后独立验收，验收通过后暂停。
