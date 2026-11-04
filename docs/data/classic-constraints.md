# Classic 约束清单

日期：2026-10-30。来源编号见[来源指纹](../../tests/fixtures/classic-coldwar/m01-sources.json)：SOV=苏联 V4.1、CW=Draft 6、BASE=基础规则。下面页码标为 PDF / 印刷。数值与版面已查看不表示所有解释都已解决。

| ID | 约束与计数对象 | 作用域／期望 | 来源 PDF / 印刷 | 状态 |
|---|---|---|---|---|
| C01 | 预算按购买及选项费用累计 | 全军 Points 不超过玩家预算；不从 profile 单价反推编制价 | BASE 11 / 10；SOV 2、6 / 同页 | 可用于强制检查 |
| C02 | 独立 BMP-1 排的 Platoon Support Options | 当前排最多4个，列出的 Medic、Fire Support、AGL、Mortar 各至多一次 | SOV 2 / 2 | 可用于强制检查；不等于全军只能一个 Medic |
| C03 | 连内排的局部选项 | 3个排各最多4个；第二Fire Support Section也占1个名额，第一和第二合计占2个；不同排独立 | SOV 3、5 / 同页；用户澄清A04 | 第二Section是明确允许的重复例外，不豁免名额 |
| C04 | 编制基础价和 BR | 父编制包含固定成员／子排；不再次收取其独立购买费用 | SOV 2–7 / 同页 | 用作核算断言；275 不等于3×95加指挥 |
| C05 | 型号升级与成员装备 | T-72 排整体 B/B1 +30；AV +15；KMT 目标最多一辆 +5 | SOV 6 / 6 | 可用于首批选项；互斥目标型号不同时选择 |
| C06 | 训练等级变化 | T-62 排 Regular +20 Points、+3 BR；连 +55、+10；等级改 r | SOV 7 / 7 | 局部算术和等级样本；不由车辆数重算基础 BR |
| C07 | Infantry 的全军支援选择 | 可选分类按页首；独立BMP排提供4个Support units选择，BMP连提供12个；与本排Platoon Support Options分别计数 | SOV 2–5 / 同页；2026-10-30用户澄清 | A02已解决；数值按具体购买定义，不额外加页首1个、不再由连内已含子排重复授予 |
| C08 | Tanks 的全军支援选择 | 可选分类按页首；T-80/T-72/T-64排各4、T-62排3；坦克连各9；具体数量是从相应全军支援类别购买的额度 | SOV 6–7 / 同页；2026-10-30用户澄清 | A02已解决；不解释成坦克自己的排内选项，也不把4/9再加1 |
| C09 | HQ / Artillery 授予支援 | HQ：Logistics 或 Additional Fire Support 二选一；Artillery：Additional Fire Support | SOV 1、8 / 同页 | 主样本 HQ→5点请求；未借子编制重复授予 |
| C10 | ToT 额外火力支援例外 | ToT 不占 Additional Support Choice；Timed122 自带预设目标，不另买10点目标 | CW 28 / 28；SOV 15 / 15 | 已目视核对；不由豁免推导第三个固定额度池 |
| C11 | Restricted 数量阈值 | Squad 2、Platoon 3、Company 4、Battalion 5；同类多份各计数 | CW 31 / 31；用户澄清 A05 | 整次升级占一份。费用仍按原表计价 |
| C12 | Unique | 每个 Unique 组全军最多一份；同时 Restricted 还消耗其额度 | BASE 49 / 48；CW 32 / 32；SOV 7 / 7；用户澄清 A05 | T-62 连最多 3 辆 Bastion 共占一份，与独立 T-62MB 和排升级共用一组 |
| C13 | 显式规模 | 基础规则推荐 Squad 100–350、Platoon 351–750、Company 751–1250、Battalion 1251–2000+；standard为250/500/1000/1500；命令骰使用所选规模 | BASE 11、13–14 / 10、12–13 | 预算范围是guideline，命令章节又说规模依点数决定；推荐不一致应提示并明确约定，不静默重选 |
| C14 | 防御设施资格 | 仅 Attack-Defence 中 defender，且本类不授予支援 | SOV 9 / 9 | 边界用例；场景或身份缺失为未知，不猜测 |
| C15 | WARPAC TOC | 只允许 Battalion；NATO 对应 Company/Battalion 不能借给苏军 | CW 32 / 32；SOV 1 / 1 | 苏联 TOC 与附属购买已接入 1.1.0 |
| C16 | PT-76影响全军坦克选择 | 独立PT-76或Recon Command改PT-76后，禁用T-62系列以外所有坦克的连／排／额外单车等编制 | SOV 10 / 10；用户澄清A07 | 遍历嵌套选项和最终型号；不只筛名为Platoon的条目；T-62M/MB属T-62系列 |
| C17 | 连内 MANPADS 上限与排内 SA-7 | 每连最多一个排购买一个 SAM Section；整个 Section 与所属连任一排的 SA-7 升级互斥 | SOV 3、5 / 同页；用户澄清 A06 | SA-14 替换后仍受限；各连独立检查 |
| C18 | 运输替换与负差额 | Engineer BTR-60PB→BTR-70/80 免费；Ambulance→Heavy Truck -5 Points / -1 BR | SOV 11 / 11 | 局部样本；保留角色规则，未证明转化为另一购买定义 |
| C19 | 购买与游戏单位分离 | 一次购买可包含多个分别行动的unit；组成数量不等于购买次数 | BASE 8 / 7 | 已确认概念；不据此自动决定支援／Restricted计数 |
| C20 | 火力请求类型 | Artillery栏自动通过Priority Check；Additional Fire Support需检定；获准的普通请求可重复用于后续火力，Timed Barrage一次性 | BASE 36、40 / 35、39；CW 25文字说明延用基础炮兵规则 | 静态购买与对局使用分离；不能套用NORTHAG请求次数消耗 |
| C21 | BR和等级 | 游戏前累计BR；Points与BR无固定换算；i/r/v/e分别表示四种训练等级 | BASE 44 / 43；CW 29 / 29 | 不限制编制合计BR≤5；不能把全军训练统一化 |
| C22 | Officer统计 | 有Officer的实际单位计数；Senior Officer同样计普通Officer；Platoon Commander名称不能自动计Officer | BASE 14、48–49 / 13、47–48；CW 31–32延用 | B01人工期望Officer=1；对局损失后变化不在首版 |
| C23 | Scout权重 | Scout计1、Scout2计2、Sniper Scout也计Scout；比较对手及场景效果另判 | BASE 49 / 48；CW 32延用 | B01人工期望Scout=1；不是侦察购买分类自动全计Scout |
| C24 | 预备队计数 | 通常每unit一次，运输及乘员合为一次到场选择，含tank riders | BASE 45 / 44 | 只用于相应对局部署，不能借此合并费用／BR／购买名额 |
| C25 | 场景资格与部署分开 | Flanking Attack已有Scout定区部署；Defence Line攻击方全部侦察进入Probing Force；High Ground额外默认防御设施 | BASE 58–60 / 57–59 | 不推导强制买侦察，也不自动购买或收费苏联防御条目；具体冷战场景适用另核对 |
| C26 | T-72连组成修正 | 10 T-72A：1连指挥、3排指挥、6普通；600 Points / 25 BR | SOV 6 / 6；用户确认A01笔误 | 不录成T-80B，不按十辆单车BR重算 |
| C27 | all BMP作用域 | 包含所购编制全部子排及已购Platoon Support Options中的匹配BMP；每个目标只处理一次 | SOV 2–5 / 同页；用户澄清A03 | 随附属选择变化重建目标集；每辆计价按实际数量，不重收同辆车的局部替换费 |
| C28 | 只列Points的选项 | BR差额明确为0，原BR保持 | 用户澄清A09；具体费用仍按各条目来源 | 这是选项不改变BR，不是允许缺失的基础BR记0 |
| C29 | BMP-1 空运转换 | 排换 1 架 Mi-8，连换 3 架；同一购买及其附件的 BMP 运输移除，人员保留 | SOV 2、3 / 同页 | 追加 Mi-8 依赖转换；被移除的运输不能同时升级 |
| C30 | 型号限定装备 | Refleks 要求所选目标已升级为 T-80U | SOV 6 / 6 | 按逐车升级后的型号检查 |

## 计算与校验实现要求

为 C02 等局部约束保存父实例 ID；不要仅以标签统计整军表。C07–C09 的额度需要记录来源购买及消费条目，主样本中的分配是一个满足关系的证明，不代表玩家 UI 必须逐项手动分配。

**2026-10-30纠正：** `For each Platoon you may choose 4 Support units` 是从对应全军支援类别购买的额度；`up to four Platoon Support Options` 是该排自身的附属选项上限。前者按军表对应的Reconnaissance、Engineer、Logistics、Specialist、Additional Fire Support等分类资格选择，不能理解成所有购买都允许所有类别。后者只指该排的Medic、Fire Support、AGL、Mortar等菜单。两种额度分别计算，排内附属不占前者，也不再产生新额度。这是用户对规则含义的明确澄清，原PDF无需修改。

规则状态应分“适用且已确认”“本军表未触发”“依赖缺失解释／输入”。主样本未购买 ToT、Restricted、PT-76 或 MANPADS，不能把这些规则在该样本中未触发解释为完整实现通过。

核算 JSON 的 `expectedViolations` 是供未来实现比对的人工断言；算术检查脚本不会证明这些规则已执行。独立局部样本不满足完整军表要求，也不应由其通过推导全军合法。

基础书补查的证据、查阅范围与A08收窄结论见[核对记录](classic-base-rulebook-review.md)。没有在所查基础组军章节发现统一HQ／步兵最低购买条件；这不等于已证实所有补充军表均没有此类条件。
