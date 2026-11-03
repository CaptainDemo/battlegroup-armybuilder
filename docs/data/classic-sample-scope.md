# Classic 首批覆盖与来源基线

日期：2026-10-30。对应M01 / T01、T02。状态：当前覆盖范围的资料基线已交付；A01/A02/A03/A04/A07/A09已解决，A05/A06只影响相关选项开放，不阻塞M02/M03。

本轮仅整理 Classic Cold War 苏联装甲师样本，不建立运行时目录或最终 schema。数据身份为本地 Cold War Draft 6 + Soviet Armoured Division V4.1；不借用 AirLand / NORTHAG 单位记录。文件名为 ARMOURED DIVISION，PDF 标题为 SOVIET TANK DIVISION，先保留两者，不推断另有版本。

## 1. 交付物与证据

- [约束清单](classic-constraints.md)：已核对规则、作用域、计数对象及待解释部分。
- [歧义登记](classic-ambiguities.md)：原文冲突、候选解释和对开放范围的影响。
- [基础规则书补查](classic-base-rulebook-review.md)：通用unit、BR、等级、火力请求与场景边界，及A08收窄结论。
- [核算样本说明](classic-calibration.md)：主样本、非法变体及局部边界样本。
- [机器可读样本](../../tests/fixtures/classic-coldwar/m01-calibration.json)：带来源的人工期望值；不是应用军表格式或已发布目录。
- [来源指纹](../../tests/fixtures/classic-coldwar/m01-sources.json)：原始 PDF 的 SHA256、页数及本轮查看页。
- [样本算术检查](../../tools/data-import/check_m01_fixtures.py)：只检查基线账目与引用，不执行游戏规则引擎。

本轮使用缓存中的 PyMuPDF 渲染并目视核查：苏联军表 PDF 第 1–13、15 页（第 14 页仅看了支援表，不纳入数值样本）；Draft 6 第 28、31、32 页；基础规则 PDF 第 11 页。苏联军表和 Draft 6 所列印刷页码与 PDF 页序相同，基础规则 PDF 第 11 页为印刷 p.10。渲染图在 `.tmp/m01-pages/`，不作为发布资源或正式数据源。

AFV 卡片本轮仅登记来源指纹，未核验战斗属性。组军核算可先使用稳定的本体系 profile 占位身份，详情显示属性尚未核对，不能把未知装甲、武器等填成零。

同日补查扩展至基础书PDF第5、6、8、13、14、36、39–41、44–45、47–49、58–61页，并核查CW第29–30页。全文检索与相关章节目视核查分别记录；不再将全局组军缺口笼统表述成“尚未查基础书”。基础BR等级说明包括e（Elite），本批实际购买仅用i/r，不因此删去e。

## 2. 开放级别

这里的“核心”表示拟进入首个小范围目录；仍需 M03/M04 schema、引用和发布检查。没有程序入口已开放。

| 候选 ID（均属于 classic-coldwar） | 条目／上下文 | Points / BR | 组成与定位 | 级别与首批配装 |
|---|---|---|---|---|
| fhq | Forward Headquarters | 20 / 3r | 3 人 + BMP-1K；p.1 左上 | 核心；默认组成，Unique；免费改用 BMP-1Ksh/BTR-50PU 可作替换样本 |
| t72-platoon | T-72 MBT Platoon | 180 / 7r | 3 T-72A，1 排指挥、2 普通；p.6 右上 | 核心；一辆 KMT +5；全排 B1/B +30、AV +15；Svir 暂缓 |
| bmp1-platoon | BMP-1 Motor Rifle Platoon | 95 / 8r | 指挥班、助理班、普通班，各有 BMP-1；p.2 | 核心；3 个稳定班槽位；每辆换 BMP-1P +5；单班 UGL +5 |
| bmp1-platoon-medic | Combat Medic / 独立 BMP-1 排内 | 8 / 0i | 1 人；p.2 左下 | 核心；排内最多一次 |
| bmp1-platoon-fire-support | Fire Support Section / 独立 BMP-1 排内 | 25 / 1r | 2 个双人 PKM 组共用 1 BMP-1；p.2 右上 | 核心；不能复制为两辆车；运输换 BMP-1P +5 |
| bmp1-platoon-agl | AGL Section / 独立 BMP-1 排内 | 18 / 1r | 3 人 + AGS-17 + BMP-1；p.2 右 | 核心；排内最多一次 |
| bmp1-platoon-mortar | Heavy Mortar Team / 独立 BMP-1 排内 | 40 / 1r | 120mm、3 人、GAZ-66 tow；p.2 右 | 核心；换 MTLB +5；主军表未选 |
| brdm2-recon | BRDM-2 Armoured Car | 12 / 1r | 1 辆，Scout、Mortar Spotter；p.10 左下 | 核心；消耗一个明确分配的侦察支援选择 |
| zsu23-4 | ZSU-23-4 SP AA Gun | 35 / 2i | 1 辆；p.12 左上 | 核心；独立 Specialist 购买，不与步兵排内支援合并 |
| artillery-request-priority3 | Off-Table Artillery Support Request / 3rd Priority | 5 / 0 | 请求资源，无初始场上编制；p.13 左上 | 核心；占 HQ 提供的 Additional Fire Support 选择；不生成随机炮兵单位 |
| t80-company | T-80 MBT Company | 650 / 25r | 10 T-80B，1 连指挥、3 排指挥、6 普通；p.6 左上 | 建模样本；基础价完整；Restricted 升级暂缓 |
| t72-company | T-72 MBT Company | 600 / 25r | 10 T-72A，1连指挥、3排指挥、6普通；p.6 左下 | 建模样本；总述T-80B按用户确认的笔误修正，A01已解决 |
| t62-platoon | T-62 Tank Platoon | 75 / 6i | 3 T-62A；p.7 左下 | 建模样本；全排 M +30；一辆 Bastion +20；Regular +20 / +3 BR |
| t62-company | T-62 Tank Company | 240 / 20i | 10 T-62A；p.7 左上 | 建模样本；Regular +55 / +10 BR；多辆 Unique 升级见 A05 |
| bmp1-company | BMP-1 Motor Rifle Company | 275 / 25r | 连指挥 + 3 个已含费用的步兵排；p.3 | 建模样本；每排局部选项独立；不再加 3×95 |
| bmp2-platoon | BMP-2 Motor Rifle Platoon | 130 / 12r | 3 班、3 辆 BMP-2；p.4 | 建模样本；BMP-2D 等特殊升级待作用域解释 |
| bmp2-platoon-fire-support | Fire Support Section / 独立 BMP-2 排内 | 45 / 1r | 两个双人 PKM 组共用一辆 BMP-2；p.4 | 建模样本；独立 Entry ID |
| bmp2-company | BMP-2 Motor Rifle Company | 380 / 35r | 连指挥 + 3 个已含费用的步兵排；p.5 | 建模样本；不再加 3×130 |
| bmp2-company-platoon-fire-support | Fire Support Section / BMP-2 连内所属排 | 40 / 1r | 两组共用 BMP-2；p.5 | 建模样本；第二Section +35 / +1 BR，另占所属排1个附属名额，A04已解决 |
| combat-engineers | Combat Engineer Squad | 25 / 3r | 8 人、RPG-7V、BTR-60PB；p.11 左 | 建模样本；免费换 BTR-70/BTR-80 |
| ambulance | Ambulance | 20 / 2i | Ural-452，Restricted；p.11 右下 | 建模样本；降级 Heavy Truck -5 / -1 BR；不等于移除 Medic 标签 |
| timed122 | Timed 122mm HE Barrage | 25 / 0 | 六门炮的预定打击，不是购买六个场上模型；p.15 左 | 建模样本；已含预设目标点，不另加10点；ToT 豁免见 C10 |
| off-table120 | Off-Table Mortar Fire / 2×120mm | 85 / 0 | 一份场外炮兵购买；p.8 右 | 建模样本；属于 Artillery，不因同为场外而放到 Additional Fire Support |

其他国家、全量装备属性、完整军表、航空器随机载荷、物流全表不在本轮覆盖内。MANPADS、PT-76 联动、TOC、Defences 作为约束边界记录，未纳入主样本可购列表。

## 3. 选项录入边界

- 基础编制包含的车辆、班和子排不重复计费；额外支援与升级各计一次。
- Points 和数值 BR 分开累计，训练字母挂在实际适用的编制／子单位；不能把整军表统一标为 Regular。
- all的目标包括编制全部子排与已购排内支援的匹配BMP；无支援的三车排升级仍为+15，购买支援BMP后按实际目标增加，不能固定只升级基础三辆。
- 装备替换仅实现已确认目标和前置；BMP-1P 后才能选择其 Konkurs 升级。跨班同时携带一次性火箭等组合未穷举，不宣称全部配装已验证。
- T-72排+30是整排差额，连+10 each是逐辆计费；连组成已按用户确认录为10 T-72A。仅列Points的选项BR不变。

## 4. M01 验收结论

已交付代表性条目、来源定位、计价／组成／约束表、歧义登记、带人工期望值的组合样本及非法变体。主样本为 Platoon 规模、500 点预算，已核对购买账目为 **398 Points / 23 BR**。

在已检查的规则子集内，预算、排内支援数量／局部唯一性及明确分配的全军支援选择成立，没有使用Restricted或有争议的升级。Support units与Platoon Support Options的独立含义已由用户澄清，A02已解决；步兵排和T-72排各提供4个全军支援额度，排内另有自己的4选项上限。剩余仅为A08的具体全局规则覆盖核对，整体状态暂保留undetermined。版本适用需记录，但不把不存在的作者兼容声明设为永久前提。

M01当前范围可以收尾。已解决项均从未决及阻断中移除，现有23份账目；A05/A06随对应选项接入处理，A08是覆盖说明而非笼统阻断。已形成的资料与人工期望用于M02/M03及后续规则实现，不等于全量军表完成或程序验收通过。原始PDF保持不变，修正解释在项目记录中追溯。
