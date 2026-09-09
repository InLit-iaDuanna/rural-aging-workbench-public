# V2.0 安装、部署与维护

## 架构

前端保持 React/Vinext/Sites。独立 Fastify 服务负责账户、项目权限、PostgreSQL、LangGraph 检查点、文件与 CLI；不在 Cloudflare Worker 中启动进程。XState 组织角色状态，空间与时间规则由共享领域模块计算。

## 本机启动

要求 Node.js 22、PostgreSQL、CodeBuddy 2.147.0、Codex 0.153.4。后续版本先执行 CLI 连通性测试再升级。生产运行目录应由专用系统账户拥有，不挂载其他项目资料。

1. 在 `xxui` 中运行 `npm ci --legacy-peer-deps`。仓库锁文件固定版本；这里显式安装了 LangGraph 必需的 peer 依赖。
2. 参照 `.env.example` 配置业务服务环境。认证地址 AUTH_URL 是用户访问前端的地址，WEB_ORIGINS 必须列出同一来源。BETTER_AUTH_SECRET 使用随机生成的至少32字符值。
3. 运行 `npm run db:migrate`，随后配置 BOOTSTRAP_EMAIL、BOOTSTRAP_PASSWORD 并运行 `npm run bootstrap`。创建完成后移除初始化密码变量。
4. `npm run api` 启动业务服务，`npm run dev` 启动网页；前端 `.env.local` 配置 BUSINESS_API_URL。
5. 登录后新建真实项目，或明确导入合成示例。项目负责人生成成员邀请凭证，通过自己的渠道交给对应成员；系统不自动发送邮件。
6. 在受控执行账户中分别完成 CLI 登录，运行 `npx tsx scripts/cli-smoke.ts`。不要将 CLI 登录目录或密钥放入 Git。

本次本机联调数据库使用 `scripts/local-postgres.ts` 启动的真实 PostgreSQL。`work/local.env` 和 `work/local-accounts.json` 仅用于本机合成验收，已被 Git 排除。该工具拒绝覆盖已有数据库，不作为生产数据库服务。

## 容器与 Sites

`compose.yaml` 提供 PostgreSQL、API、每日备份服务。先填好 `.env.production` 与 POSTGRES_PASSWORD；容器内 DATABASE_URL 的主机名使用 `db`，数据库名为 xiangzhu。先启动 db，运行迁移与初始化，再启动 api 和 backup。

API 镜像包含两套经本机核对版本的 CLI。以容器内 node 账户配置 CLI 登录并为其认证目录配置私有持久卷；不要把认证文件打进镜像。生产 API 通过部署方的 HTTPS 反向代理提供访问，端口默认仅绑定主机回环地址。网页的 BUSINESS_API_URL 配为该 HTTPS 地址；AUTH_URL、WEB_ORIGINS 配为实际 Sites 地址。

Sites 中仅发布网页和 API 转发层。未配置可达的 BUSINESS_API_URL 时，明确显示“业务服务未连接”，仍可使用合成规则预览；这不代表已完成公网多人/AI 服务部署。WorkBuddy 实机装载需要目标账号和入口验证，网页运行不能替代这项验收。

## 运行及权限

单 worker 实例持有 PostgreSQL advisory lock，同时最多处理2个任务。每次 CLI 默认120秒；人工等待不计入执行时间。CLI 无数据库凭据，CodeBuddy 内置工具关闭，Codex 使用只读沙箱并关闭 shell 与多代理工具。所有领域调用经服务端校验项目范围。

重启时，正在执行的任务标记失败并等待显式重试；等待核查与确认的任务从持久化检查点恢复。重试创建新运行编号，不能把旧结果冒充新结果。日志不保存模型内部推理，记录结构化工具结果与摘要。

角色权限：录入负责反馈、核查、设施和回访；分析负责场景、方案与 AI 运行；复核负责证据核验与独立审查；管理负责邀请、现实变更确认、方案确认与导出。方案作者不能自行完成独立复核。Codex 复核输出是辅助意见，正式确认仍要求另一位成员审查。

## 备份与恢复

生产 backup 服务启动后立即备份，然后每24小时执行一次。备份含业务、账户、检查点和材料，放在私有 backups 卷，不自动删除历史备份。运维人员按组织留存要求管理容量、离机备份及撤回资料的历史副本。

手动备份：`node --import tsx scripts/backup.ts backup /private/backup-directory`。

恢复：先创建独立空数据库，运行业务及认证迁移、初始化 PostgresSaver 表，再将空库中框架生成的 checkpoint_migrations 初始化记录清空，然后运行 `node --import tsx scripts/backup.ts restore /private/backup-directory`。脚本拒绝覆盖任何非空业务表；材料目录也应为空。恢复后验证登录、附件、等待任务和项目关联。

本次已使用 `scripts/restore-drill.ts` 完成独立 PostgreSQL 数据库恢复，逐表检查数量。备份 JSON 含认证及私有材料，只能放私有存储。该逻辑备份适用于本版小规模试点；大量数据使用 PostgreSQL 运维工具并另行验证恢复。

## 更新与回退

更新前备份，运行测试及构建，再部署同一源码版本。前端与 API 使用同一 V2 数据类型；不要仅替换其中一个。回退代码通过 Git 版本完成；数据库回退通过独立恢复库验证后切换连接，避免覆盖仍在使用的数据。

## 尚需部署方提供

外部业务主机/域名及 HTTPS、受控 CLI 登录、真实成员和村庄授权、WorkBuddy 目标环境。代码不会伪造这些外部条件或自动联系村方。
