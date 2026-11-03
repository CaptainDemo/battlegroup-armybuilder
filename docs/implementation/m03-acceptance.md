# M03 最终实现与验收

日期：2026-11-03。结论：**M03领域契约范围内完成并通过验证；验收后暂停，M04未启动。**

用户在GLM第二轮额度中断后明确要求“由你继续进行修改吧”。主Agent基于保留的a1／a2代码完成修复、核对契约并运行本记录中的检查；没有再次调用GLM，也没有将外部失败结果改记为成功。

## 1. 外部结果与本地完成分开记录

| 阶段 | 实际状态与证据 |
|---|---|
| Spacecraft task `t20261103050906-206dcc9c`，r1/a1 | 正式结果SHA256 `4900768bb29ff9ad200d82b254b5643821104e2ca3d31ca160337cea8a8ea2ab`；主Agent发现7项缺陷，记录needs_rework，见[a1审查](m03-review-a1.md) |
| 同task r1/a2 | GLM API 429额度耗尽，退出1，无有效正式报告；已停止并排空，终态引用`19e14642e06f643670b39d3ffb785f0c6bad6e41bfef04de8cde19001c116ebb`，保留failed／needs_rework；见[a2中断记录](m03-review-a2.md) |
| 主Agent本地接手 | 先确认外部执行停止，保存58份修改前文件，完成代码／测试／文档；证据位于`.tmp/m03-local/`。这不是Spacecraft a3，没有伪造外部关联码或结果哈希 |

外部a1、a2的B→C与正式记录保持原样。本地差异以`.tmp/m03-local/baseline/manifest.json`为开工基线，而不是以HEAD或整个未跟踪仓库为本轮修改。

## 2. 契约关闭情况

| 问题 | 最终行为与验证 |
|---|---|
| R1 精确身份 | 文档上下文、起点、附属拥有者均检查ruleset/catalog/revision；外来引用不能从公开解析函数借用同localId的Classic节点 |
| R2 稳定目标 | 静态member-path与ownerSelectionId明确的attachment-member分开；相同条目重复购买、顺序变化及静态／附属同名均可正确定位；缺少拥有者或非后代被拒绝 |
| R3 Classic边界 | Classic目录及文档拒绝AirLand／NORTHAG身份，基础训练与变化token仍由Classic自己的schema校验 |
| R4 分区结构 | 不可直接购买分区不能接受顶层选择；分区孤儿、循环、ID重复和条目资格由关系检查报告 |
| R5 输入revision | 文档revision与Evaluation.identity.inputRevision承载编辑快照身份，和目录／存储版本分开；本阶段没有评估器或编辑命令 |
| R6 第二Section | 独立购买实例、35 Points／1 BR、两组成员与BMP-2、所属排及1个局部名额均显式声明；不是空效果或第一份的全价重复 |
| R7 基础训练 | baseTraining是购买上下文的三态token，已知i/r及未知／不适用可表达；Classic允许i/r/v/e，数值BR独立 |
| 接手后确认的目标漏洞 | 限定member-slots的选项不能用attachment-member绕过目标集合；新用例在修复前退出1，修复后随全套通过 |
| 来源引用遗漏 | profile及option的来源也必须存在于manifest；两项新用例修复前失败，修复后通过，补齐entry／errata原有检查 |

主Agent还修正了a2两项失败测试：创建实际存在、但不是父编制后代的HQ来验证归属；第二Section检查实际资源消耗及SOV第5页来源，不要求任意note文字。没有放宽产品行为或把错误码替换当作修复。

23份M01账目的契约正例同时通过Zod与关系检查；其中故意违反预算、游戏名额或PT-76规则的文档仍是结构正例，未提前实现游戏合法性检查。三体系合成同名同属性目录独立，NORTHAG只验证合成分区、one each及非实体请求表达能力。

## 3. 实际命令

均由主Agent在本工程运行；完整stdout／stderr及真实退出码在`.tmp/m03-local/`。

| 检查 | 结果 | 日志 |
|---|---|---|
| `npm ci` | 正常权限退出0；53 packages、0 vulnerabilities | `03-npm-ci-normal.log` |
| `npm run typecheck` | 退出0，三个包 | `08-typecheck-final.log` |
| `npm test` | 退出0，9文件144项通过 | `09-vitest-final.log` |
| `npm run build` | 退出0 | `10-build-final.log` |
| 既有Playwright五项测试 | 系统Chrome 5/5，退出0；专用4283端口且reuseExistingServer=false | `11-browser.log` |
| `check_m01_fixtures.py` | 现有uv CPython解释器，退出0；4来源指纹／23账目／父引用一致 | `12-m01-fixtures.log` |
| 资源与差异核对 | 默认dist仅HTML、CSS、JS；没有references、fixtures或日志；本地文件差异、受保护输入及文档链接结果落盘 | `final-evidence.json` |

浏览器检查覆盖页面加载、hash路由往返、直接深链、未知路由返回及360px布局；这里只验证Web工程壳，没有军表编辑流程。资料脚本检查来源指纹和账目，不是规则引擎测试。

## 4. 保留的失败及边界

- a1的4项失败探针、a2的139/141结果、GLM额度错误及各自处置保留。
- 本地`01-target-before.log`与`07-source-before.log`是修复前失败证据；后续通过不抹去失败。
- 首次本地`npm ci`在沙箱创建workspace symlink时EPERM、退出1，保留`02-npm-ci.log`；正常权限复装成功。浏览器以正常权限运行，避免此前M02已观察到的沙箱收尾问题。
- 未验证随包Chromium安装、其他浏览器或任何真实托管平台；未部署。
- 未实现正式目录加载、编辑命令、组成展开、计费、游戏规则执行、持久化、导入导出或打印。Evaluation／Availability仅为协议。scope-selector的完整目标重建与profile筛选留给评估阶段，当前只校验显式目标的身份／存在／归属。
- A05／A06组合仍不开放，未修改原始PDF或M01人工账目，未提交或推送。

当前公开API以[契约说明](m03-contracts.md)为准。[交付报告](m03-result.md)在最终摘要后保留外部a1历史自述，不能将其旧合并路径格式和105项测试数当作当前实现。
