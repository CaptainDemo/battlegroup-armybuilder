# M12 第一批 Sites 测试部署

日期为 2026-11-09。本批完成当前 M01–M10 的测试部署和线上验收。M12 的打印及完整闭环验收在 M11 完成后补齐。

## 已发布版本

| 项目 | 值 |
|---|---|
| 测试站 | https://battlegroup-armybuilder-test-20261109.w2y3q2.chatgpt.site |
| Sites project_id | appgprj_6af1cc72fcd48191be12838703daf7e1 |
| 保存版本 | appgprj_6af1cc72fcd48191be12838703daf7e1~appgver_53b05c6014b08191bf98991ecd9b4fba |
| 部署 ID | appgdep_6af1cd952f008191bf2b6f10cc7d7a7b |
| 原工程源码提交 | 4591a216c72f33e3656280d65eac39a42cbb548c |
| Sites 专用快照提交 | cb2fe2ad4cb95c14908878869f1265a39726c00e |
| 原生部署结果 | succeeded，2026-11-09T13:41:56Z |
| 首次部署访问范围 | custom，仅所有者，1 个允许用户、0 个允许组 |
| 后续访问状态查询（2026-11-09） | public，所有者身份保持不变 |
| 目录版本 | Classic 苏联 V4.1 的 1.0.0 与 1.1.0，按精确版本加载 |
| 发布归档 SHA-256 | d8854490d0d96c75aff98ab67ea54f1f91dd45c4e7485f7360b76a12bfe76484 |

站点使用既有 React／Vite 静态构建。Sites 专用仓库保存 dist、.openai/hosting.json 和 SOURCE.json，后者记录原工程提交与构建资源指纹。实际部署归档仅包含静态资源及平台清单。仓库来源文件、原始资料、fixtures、AGENTS.md 和临时运行状态均不在网站资源中。

## 构建与资源检查

本次 npm run build 的实际退出码为 0，日志和退出码保存在 .tmp/m12/build.log／build.json。当前应用源码与已验收的 M10 提交一致，沿用 M10 的 333 项单测、18 项本机 Chrome 回归及类型检查结果。该结果与下述真实站点验收分别记录。

发布资源清单共 6 个文件，线上逐个读取并核对 SHA-256，全部与本地构建相同。

- index.html。
- assets/index-B72W71Dv.css。
- assets/index-CbvlNcNE.js。
- catalogs/index.json。
- catalogs/classic-coldwar/soviet-armoured-division/1-0-0/catalog.json。
- catalogs/classic-coldwar/soviet-armoured-division/1-1-0/catalog.json。

1.0.0 目录 SHA-256 为 5e66f1e6f0cde7e67293534b86f27939b31f027902f7db101d6b29e06812866b，1.1.0 为 656544cae8893bead7140bef5e9e8750f49e7c57cb55a8d8adb222d56244e97c。

## 真实站点验收

系统 Chrome 在首次私有部署的真实 HTTPS 来源上完成以下流程。所有者自动检查使用 Sites 支持的服务访问头，凭据只在隐藏的 stdin 和进程内存中传递。测试军表位于独立 Chrome 配置，用户自己的浏览器数据独立保存。后续查询到站点访问范围为 public；下表未登录访问结果保留为首次私有部署时的验证记录。

| 检查 | 实际结果 |
|---|---|
| 未登录浏览器 | HTTP 401，标题“需要登录”，编辑器未显示 |
| 静态资源与目录 | 6 个资源均返回 200，字节指纹匹配 |
| 示例核算 | 398 Points／23 BR |
| 宽松购买与事后检查 | 超分仍能加入坦克排，问题面板出现 C01，购买列表没有预先警告 |
| 编辑与配装 | 修改名称、预算、规模及逐目标选项后保存成功 |
| 单军表往返 | 真实下载、选择文件、预览、复制导入。成员选择及精确目录保持，军表 ID 按复制规则生成 |
| 全库备份 | 两份军表导出为备份，确认导入后共四份 |
| 双标签页覆盖 | 另一标签页先更新同一军表，原标签页覆盖被拒绝并显示冲突 |
| 浏览器重启 | Chrome 进程关闭重开，四份军表可恢复。再次导出其中的副本，文档逐字段与重启前一致，保持 583 Points |
| 页面路径 | 直接访问 /#/editor 和通过“我的军表”重新打开均正常 |
| 小屏与脚本 | 360px 无横向溢出，检查页未观察到 pageerror |

线上流程报告为 .tmp/m12/hosted-qa/result.json，匿名访问报告为 .tmp/m12/anonymous-browser.json。桌面和小屏截图、下载的单份／全库文件保存在 .tmp/m12/hosted-qa/，均被 Git 忽略。

## 过程记录与后续更新

首次 Node 检查缺少服务访问头的 Bearer 前缀，修正后 Node 请求仍收到 Cloudflare 拦截页。原始失败报告保留为 result-auth-header-failed.json 和 result-bearer-failed.json。改用标准 Chrome 及官方文档中的服务访问格式后，线上检查通过。内置浏览器工具的打开操作曾超时，已保留该验证限制；Codex 的打开站点请求返回 queued。

Sites 项目身份已保存在专用源仓库 .openai/hosting.json。本机专用目录为 .tmp/m12-site/，发布包及指纹记录位于 .tmp/m12/。后续更新复用上述 project_id，并通过 Sites source helper 打开同一仓库、提交新快照、打包和发布。若本机临时目录缺失，可用相同 project_id 的源码凭据在新空目录恢复源仓库。该项目已创建，后续使用相同身份更新。

站点 IndexedDB 按 HTTPS 来源和浏览器配置隔离。本地 localhost 军表可通过 M10 的全库备份导出，再在测试站选择文件并导入。站点目前为公开访问，访客各自的军表仍保存在自己的浏览器中。访问范围可在 https://chatgpt.com/sites 中找到本站，通过 Share 管理；首次私有部署时需要所有者的 ChatGPT 登录身份。
