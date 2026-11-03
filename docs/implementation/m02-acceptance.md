# M02 主Agent独立验收

日期：2026-10-31（Asia/Shanghai）。结论：**在M02工程基础范围内验收通过；按用户要求，验收后暂停，不启动M03。**

## 1. 结果身份与执行证据

- Task：`t20261030152231-8a652458`，revision 1 / attempt a1。
- 正式结果SHA256：`64d0fece06b087b4547c7c11554650441041b47e0d73f792c599773b0bf6762d`，已核对本地result.md。
- 真实执行器为Claude Code；记录服务为open.bigmodel.cn，模型标识glm-5.3[1m]，assistant事件为glm-5.3。
- 执行约65分42秒，真实退出码0；helperDrained=true、helperActiveAfterDrain=0、processTreeStopped=true。
- 实际命令记录包含auto权限、effort=max、max-turns=200；任务契约为5400秒／200轮。后台登记、模型执行完成、通知接受与本次验收分别判断。

外部交付报告：[m02-result.md](m02-result.md)。本次独立验收日志及临时配置在`.tmp/m02-acceptance/`，不作为网站发布资源。

## 2. 实际差异与输入保护

已读取本attempt的`baseline/baseline.json`及`diff/diff.json`。差异状态generated，开工B到交付C记录新增69、修改0、删除0、不可比较0、未触达采集上限；其中包括源码、日志、构建与缓存产物，不是69个源码文件。

独立核对所有报告中非生成的新增文件与交付哈希一致。七份必读输入（含AGENTS、架构、模块计划及Classic约束／解释）在验收命令前后均与冻结哈希一致。M01检查同时确认四份PDF指纹及23份账目成立。

`outsideScopeObserved`列出75个`.tmp/`路径，无非临时路径；`.gitignore`新增忽略`.tmp/`改变了Git可见性。因此不能仅据这份观察列表认定75份旧资料被改写，也不能声称执行期间整个文件系统完全未写入。原始未跟踪资料与证据均保留。未提交／推送。

验收结束后由主Agent更新AGENTS及模块状态，是明确的后续文档修改，不归入外部执行B→C差异。

## 3. 独立检查

| 检查 | 真实结果 | 证据／边界 |
|---|---|---|
| `npm ci`锁文件复装 | 正常权限退出0，52 packages | 02-npm-ci-unsandboxed.log；首次沙箱EPERM见下文 |
| `npm run typecheck` | 退出0 | 03-typecheck.log，三个包配置 |
| `npm test` | 7/7，退出0 | 04-vitest.log，Node环境无DOM |
| `npm run build` | 退出0 | 05-build.log，静态产物仅index.html、CSS、JS三个文件 |
| Playwright既有五个Web壳用例 | 5/5，正常权限退出0 | 07-browser-unsandboxed.log；系统Chrome、独立4273端口、reuseExistingServer=false |
| `VITE_BASE=/armybuilder/`构建 | 退出0，HTML引用正确子路径 | 08-basepath-build.log；输出到临时目录，未覆盖默认dist |
| M01资料检查 | 退出0，4来源指纹／23账目一致 | 运行现有check_m01_fixtures.py，不等于规则引擎测试 |
| workspace及产物 | 内部包均为本地link，默认dist仅3个应用文件 | integrity.json；未打包原始PDF、fixtures、临时日志 |

浏览器覆盖页面加载、hash路由往返、直接深链、未知路由返回及360px视口无横向溢出。这里验证的是工程壳，不是军表编辑、持久化或游戏规则功能。

## 4. 保留的失败与环境适配

1. 首次独立`npm ci`在沙箱内创建依赖目录时EPERM，退出-4048，原始日志保留`01-npm-ci.log`。在正常权限下重试成功，不作为代码缺陷或首次已通过处理。
2. 首次独立Playwright在沙箱中五个用例逐项通过，但测试收尾未退出；仅停止该验收会话，退出1，保留`06-browser.log`，不将其记为完整成功。在正常权限下使用同一验收配置重跑，完整5/5、退出0。
3. 外部执行器的首次单测路径错误已修复；随包Chromium下载因网络过慢被停止，这些原报告记录保留。本次同样使用系统Chrome，不声称验证了随包Chromium安装或任何实际托管平台。

没有为消除环境失败修改实现或放宽测试断言。验收未新增产品代码，未部署网站。

## 5. 范围与后续提醒

M02交付npm workspace、Web壳、hash路由、英文词典入口、core／Classic包入口、类型／单元／浏览器检查与静态构建。不存在可用的规则引擎、数据目录、保存或完整编辑器。

当前依赖边界测试把M02的core零依赖写成断言；M03若引入已规划的Zod，应将断言调整为允许纯领域校验依赖、继续禁止React／具体规则／浏览器数据库，而不是为维持旧测试绕开Zod。当前测试对源码import的扫描不是完整依赖图证明；本次已审查实际最小入口，无反向依赖。此为后续范围提醒，不阻塞M02。

M03交接草案保留，用户已明确要求验收后暂停，本轮不更新为运行中、不派发M03或其他任务。
