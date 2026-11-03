# M02 实现结果（工程与构建基础）

日期：2026-10-31。执行者：外部实现协作者（Claude Code 执行器 + GLM，经用户授权）。交接单：[m02-spacecraft-task.md](m02-spacecraft-task.md)。验证日志：`.tmp/m02-validation/`（01–15）。

## 1. 状态总览

M02 交付完成，验收条件逐项核对见 §5。未实现 M03 领域 schema、计价、编辑器、存储、数据发布与部署；未提交/推送。环境：Node v22.22.2、npm 10.9.7（与交接单一致，执行前实测确认）。

## 2. 实际修改/新增文件（全部在 writeScope 内）

新建源码与配置：

```text
.gitignore
package.json
package-lock.json                （npm install 生成，lockfileVersion 3）
tsconfig.base.json
tsconfig.json                    （solution 引用；tsc -b 实测通过）
vitest.config.ts
playwright.config.ts
README.md
docs/development.md
docs/implementation/m02-result.md
apps/web/package.json
apps/web/tsconfig.json
apps/web/vite.config.ts
apps/web/index.html
apps/web/src/main.tsx
apps/web/src/styles.css
apps/web/src/app/App.tsx
apps/web/src/app/hashRouter.ts
apps/web/src/app/routes.ts
apps/web/src/i18n/en.ts
apps/web/src/i18n/index.ts
apps/web/src/pages/HomePage.tsx
apps/web/src/pages/RoadmapPage.tsx
apps/web/src/pages/NotFoundPage.tsx
packages/core/package.json
packages/core/tsconfig.json
packages/core/src/index.ts
packages/core/src/index.test.ts
packages/core/src/dependencyBoundary.test.ts
packages/rulesets/classic-coldwar/package.json
packages/rulesets/classic-coldwar/tsconfig.json
packages/rulesets/classic-coldwar/src/index.ts
packages/rulesets/classic-coldwar/src/index.test.ts
tests/e2e/web-shell.spec.ts
```

生成物（gitignored，非源码交付）：`node_modules/`、`apps/web/dist/`、`test-results/`、`.tmp/m02-validation/*.log`。

未修改任何既有文件：AGENTS.md、docs/ 既有文档、references/、tests/fixtures/、tools/、LICENSE 均保持原样（git status 仅显示新增；fixtures 目录未动）。

## 3. 设计决定与偏离

1. **依赖版本（均已查 npm registry 的 engines/peerDependencies 后选定，并实测安装）：**
   TypeScript 7.0.2（当前 latest 稳定线）、Vite 8.3.5（node ^20.19||>=22.12）、@vitejs/plugin-react 6.1.2（peer vite ^8，可选 peers 未启用）、React/React-dom 19.3.1、Vitest 5.0.5（node ^22.12；peer vite ^6.4||^7||^8、@types/node ^22||>=24 均满足）、@playwright/test 1.64.1（node >=20）、@types/node 22.20.5（匹配 Node 22 运行时并满足 vitest peer）、@types/react(-dom) 19.3.0。
2. **`workspace:*` 协议失败并纠正：** npm 10.9.7 不支持 `workspace:*`（EUNSUPPORTEDPROTOCOL），改用 `"*"` 由 npm workspaces 按名称解析本地包；依赖边界测试同步断言 `"*"`。
3. **依赖方向：** `@battlegroup/web` → `@battlegroup/classic-coldwar` → `@battlegroup/core` → 无依赖。internal 包以 `main/exports` 直指 `src/index.ts`，由 Vite/Vitest 即时编译，M02 不为 packages 单独配置构建。core 与 classic 入口只含包身份/模块描述符（classic 显式 `status: 'planned'`），不含任何假装可用的规则函数，也未预写 M03 schema。
4. **边界测试：** `packages/core/src/dependencyBoundary.test.ts` 实际读取三个 package.json 与 core/classic 源码 import，断言单向依赖与"core/classic 不 import React/DOM/其他规则包"。首次运行发现测试自身路径计算错误（`new URL('../../')` 层级多退一级），改为 `process.cwd()`（vitest 由根配置启动）后通过。
5. **路由：** 自写极简 hash 路由（`useHashPath` + 路由表 + not-found 页），未引入 react-router——M02 只需两个路由，避免无需求依赖。`#/`（My Rosters 占位）、`#/roadmap`（里程碑真实状态）、未知路径回退页。
6. **词典：** 全部界面文案集中在 `apps/web/src/i18n/en.ts`，经 `t()` 点路径读取，缺失键回退键名；预留中文词典同构入口。
7. **小屏布局：** 单列响应式 CSS（≤640px 导航变等宽按钮、44px 触控高度），e2e 以 360px 视口实测无横向溢出。深浅色双主题。
8. **资源基础路径：** `VITE_BASE`（apps/web/.env.<mode>）→ Vite `base`；实测 `/armybuilder/` 构建产出 `/armybuilder/assets/...`。注意 Git Bash 会把内联 `VITE_BASE=/x/` 环境变量做路径改写，文档建议用 .env 文件方式。
9. **Playwright 浏览器：** `npx playwright install chromium` 需下载 chromium-1248（约170MB），本机网络实测约 1MB/min（20分钟仅约15MB），无法在任务窗口完成，已停止并在日志注明。改为 `PLAYWRIGHT_CHANNEL=chrome` 复用本机已装 Chrome 运行全部 e2e（playwright.config.ts 支持 `PLAYWRIGHT_CHANNEL` 环境变量，默认仍为随包 chromium，两种路径均写入 development.md）。本地缓存仅有 chromium-1217/1228，与 1.64.1 所需 1248 不匹配。
10. **`.gitignore` 覆盖 `.tmp/`：** 交接单要求生成物由 .gitignore 排除且验证报告放 `.tmp/`；`.tmp/` 为本地证据/暂存（AGENTS §目标目录），加入忽略不影响磁盘文件与协作工具读取，只是不再出现在 git 未跟踪列表。如主 Agent 希望保持可见可自行调整。
11. **根 tsconfig.json：** solution 式 references（无 composite）；实测 TS7 下 `tsc -b` 退出码 0，`npm run typecheck` 用逐项目 `tsc --noEmit -p` 链，两条路径均可用。
12. **e2e 范围：** 5 个用例覆盖页面加载、hash 导航往返、直接深链、not-found 回退、小屏无溢出；未堆叠逐句文案镜像测试。

## 4. 验证命令与真实退出码

环境：Node v22.22.2、npm 10.9.7。工作目录：仓库根。日志在 `.tmp/m02-validation/`。

| # | 命令 | 退出码 | 日志 | 结果摘要 |
|---|---|---|---|---|
| 1 | `npm install` | 0 | 01 | 52 包，0 漏洞，workspace 链接正确；耗时25分钟（网络慢） |
| 2 | `npx playwright install chromium` | 被停止（非失败完成） | 02 | 下载约15MB/170MB 后因超任务窗口被停止，已在日志注明 |
| 3 | `npm run typecheck` | 0 | 03 | TS 7.0.2 三项目全部通过；另 `npx tsc -b` 亦为 0 |
| 4 | `npm test` | 首次 1 → 修复后 0 | 04 | 首次因测试路径 bug 失败4例；修复后 3 文件 7 用例全过（Node 环境、无 DOM） |
| 5 | `npm run build` | 0 | 05 | dist：index.html 0.54kB、CSS 3.27kB、JS 225.66kB(gzip 70.64kB) |
| 6 | dist 违禁内容扫描 | 0 | 06 | FORBIDDEN_MATCHES=0（无 references/fixtures/.tmp/PDF/日志；产物仅3个应用文件） |
| 7 | `PLAYWRIGHT_CHANNEL=chrome npx playwright test` | 0 | 07 | 5/5 通过（12.7s，针对已构建产物的 preview 服务器） |
| 8 | `npm ci` | 0 | 08 | 6秒完成（缓存复现），52 包，0 漏洞——锁文件可复现安装 |
| 9 | `npm ci` 后 `npm run typecheck` / `npm test` | 0 / 0 | 09 / 10 | 重装后冒烟通过（7/7） |
| 10 | `.env.basetest`（VITE_BASE=/armybuilder/）`npx vite build --mode basetest` | 0 | 11 | 产物引用 `/armybuilder/assets/...`；临时 env 文件已删除 |
| 11 | `npm run build`（恢复默认 base） | 0 | 12 | `src="/assets/index-*.js"` |
| 12 | `PLAYWRIGHT_CHANNEL=chrome npx playwright test` | 0 | 13 | 最终产物复验 5/5 |
| 13 | dev 服务器探针（`npm run dev` 后 curl） | HTTP 200 | 14 | `/` 与 `/#/roadmap` 均 200，含正确 title 与 #root |
| 14 | `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` | 0 | 15 | 文档化脚本端到端：build + 5/5 e2e |

## 5. 验收条件核对（对照交接单 §验收）

1. **锁文件复现与脚本：** ✅ `npm ci` 退出码 0（§4 #8）；dev/typecheck/test/test:e2e/build/preview 脚本真实可用并实际执行（#3/4/5/13/14），README 与 docs/development.md 写明。
2. **Web 壳与词典、小屏：** ✅ hash 路由两页 + not-found；页面明示"Early development — planning stage"并说明 M02/M07/M09 边界，不假装军表功能可用；英文词典集中管理；360px 视口无横向溢出（#7）。
3. **Core/Classic 可在无 DOM 的 Node 导入、单向依赖：** ✅ Vitest node 环境 7 用例（含依赖边界断言：core 零依赖、classic 仅依赖 core、web 组合两者+React、源码无 React/DOM/跨规则包 import）（#4/9）。
4. **类型检查/测试/构建/浏览器验证实际执行：** ✅ 全部有退出码记录（§4）。附加说明：浏览器验证使用本机 Chrome channel 而非随包 chromium（原因见 §3.9，属如实报告的环境适配，非跳过）。
5. **静态产物纯净：** ✅ dist 仅 3 个应用文件，违禁扫描 0 命中（#6）；资源基础路径可配置并实测（#10/11）。
6. **不堆镜像测试、不预建 M03 框架：** ✅ e2e 仅主路径 5 例；core/classic 入口仅包身份，无领域 schema、无规则函数、无 AirLand/NORTHAG 伪实现。

## 6. 失败/未执行事项

- `npx playwright install chromium` 未完成（网络速度限制），已停止；随包 chromium 路径未被本轮实测，e2e 证据基于系统 Chrome channel。下次网络良好时执行一次即可补齐。
- 首次 `npm test` 失败 4 例（测试自身路径计算 bug），已修复并复测通过（§3.4）。
- 未执行：任何部署/Sites 操作、`python tools/data-import/check_m01_fixtures.py`（M01 工具与本轮改动无交集，未动也未重跑）、lint（本轮未配置，M02 未要求）。
- 未修改：插件、用户模型/账户配置、Git index（无 add/commit/push）。

## 7. 剩余边界 / 最小下一步

- M03（领域契约与 Zod schema）待主 Agent 冻结输入后另行派发；本轮未预写任何领域类型。
- 随包 chromium 下载补齐（可选）：`npx playwright install chromium`。
- 部署相关（VITE_BASE 实际取值、托管平台选择）留到部署时核对，本轮仅保证可配置并已验证。
