# M04 目录与精确版本加载

日期：2026-11-03。范围为Classic苏联装甲师V4.1首批10个核心购买条目（6个顶层、4个排内附件），不是完整军表。M04不实现编辑命令、计价或规则执行。

## 交付

- `packages/catalogs/classic-coldwar/public/catalogs/`：独立的版本1.0.0 JSON及应用索引；运行时不依赖M03合成样本。JSON是权威数据，索引记录精确身份、规则版本、模块契约、受限相对路径和整个文件字节的SHA256；后续更改必须发布新版本／路径。
- core增加通用索引schema；Classic增加发布外壳schema和购买上下文检查。各体系仍独立，不用同名记录补全。
- Web目录适配器只从应用内置索引选包，区分ready／not-found／unsupported-version／network-error／digest-mismatch／invalid-data；没有最新版本回退，也不从导入文件接收任意URL。
- Vite仅复制选定catalog的public资源，支持资源基础路径。`npm run check:catalogs`在生产构建前检查JSON、关系、来源指纹、人工费用表及发布文件清单。

## 来源复核与覆盖

M01费用表与正式JSON独立对照，已知零BR保留；AFV属性全部显式unknown。组成记录已核实编制、成员和运输身份，未声称武器详情齐全。仅开启T-72排整排B及单车KMT、BMP-1整体换装、Mortar的MTLB换装等已列明选项；其他升级、连及A05/A06相关组合不开放。

重新目视核对SOV PDF第2、6页：Infantry全军支援分类为Reconnaissance／Engineer／Specialist，Tank为Reconnaissance／Engineer／Logistics／Specialist；不把M03样本的通用ALL_SUPPORT_CATEGORIES直接当正式资格。额度仍分别为4，不额外加页首1个；排内选项另计。第13页请求归Additional Fire Support，不借Artillery分区归属。HQ单独提供Logistics或Additional Fire Support的一个额度。M01原始PDF与人工样本没有修改。

## 验证

- 类型检查退出0（`.tmp/m03-local/m04-typecheck.log`）。
- 11文件150项单测通过，退出0（`.tmp/m04/tests.log`）；含原144项、精确版本／跨体系／错误父引用／哈希损坏／离线／受限路径及目录发布检查。
- 正常生产构建退出0，包含构建前目录检查（`.tmp/m04/build.log`）。
- 现有5项Web壳测试加1项实际浏览器静态目录／SHA256检查，系统Chrome共6项；使用独立4283端口、不复用服务，日志`.tmp/m04/browser.log`。
- `references/`、fixtures和.tmp未作为public根目录，发布范围仅应用文件、catalog索引及选定JSON。

只验证了当前单个Classic目录及合成的失败／隔离边界，未部署任何网站。UI仍是M02壳，编辑体验在M08接入。每个模块提交后读取账户实际额度，剩余低于20%暂停后续模块。
