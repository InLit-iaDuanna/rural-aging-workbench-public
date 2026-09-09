# V2 API

全部业务接口使用 `/api/v1`。登录由 `/api/auth/sign-in/email` 提供，退出用 `/api/auth/sign-out`；Cookie 会话配合同源转发使用。

项目路径统一为 `/api/v1/projects/:project`，服务端从会话读取用户，不接受请求体提供的用户身份。

| 方法与后缀 | 行为 |
|---|---|
| GET /projects；POST /projects | 成员项目列表；创建项目/显式导入演示 |
| GET /me；GET /health | 当前用户；数据库连通状态 |
| GET /members；POST /invitations | 成员列表；生成七天邀请 |
| POST /invitations/accept（根路径） | 对应邮箱接受邀请，创建账户或验证已有账户密码 |
| GET/POST /records/:kind | 查询/新增对象 |
| GET/PUT /records/:kind/:id | 读取/按版本更新对象 |
| POST /world | 保存初始现实底板或演示地图 |
| POST /observations/:id/commit | 提交已确认道路观察，形成新现实版本 |
| POST /facilities/:id/commit | 提交已核验设施，形成新现实版本 |
| GET /world-versions | 读取历史现实快照 |
| GET/POST /runs；GET /runs/:id | 创建/查询 AI 或仿真运行 |
| POST /runs/:id/cancel、retry、resume | 取消、显式新运行重试、恢复人工等待 |
| GET /evidence?q=&stage= | 中文关键词及状态检索 |
| POST /proposals/:id/confirm | 当前版本独立复核后生成行动 |
| POST /materials；GET /materials/:id | 授权上传及受控下载 |
| POST /materials/:id/withdraw | 撤回材料访问并删除在线文件 |
| POST /sync | 幂等提交离线记录、显式报告冲突 |
| GET /audit；GET /export | 管理人员审计及业务导出 |

记录写入：`{base_version,source,data}`。新记录 base_version 为0，修改时使用服务端返回的记录版本。支持 feedback、issue、observation、facility、persona、scenario、evidence、proposal、review、action、followup。

运行创建：`{type:'agent',feedback_id,instruction}` 或 `{type:'simulation',scenario_id,mode:'rules'|'ai',replay_id?}`，返回 `{run_id,status}`。前端每两秒更新正在处理的状态。回放引用已存场景与决策日志。

确认：`{base_version,request_id}`；request_id 为 UUID。事务同时保存确认记录与行动。

离线同步：`{request_id,id,kind,input:{base_version,source,data}}`。同一用户/项目/请求编号返回原结果。版本冲突返回409与服务端 current 对象。

错误：401未登录，403权限不足，404对象不存在，409版本或状态冲突，422字段/业务条件不满足，503业务服务未连接。模型、文件和对象输入经 Zod 及服务端关联校验。精确字段见 `lib/v2/schema.ts`。

## 村庄档案与知识咨询

- `POST /api/v1/projects` 接受 `geographic_location`，仅用于 reality 项目，保存 GCJ-02 坐标、来源、地址、名称、备注和确认状态。
- `PUT /api/v1/projects/:project/location`：`{base_version,location}`，使用 location_version，与空间现实版本分开；分析或项目管理角色可写，冲突返回 409。
- `GET /api/v1/knowledge?q=道路宽度`：登录后检索项目方法原文片段；`GET /api/v1/knowledge/:id` 读取单条。
- runs 新增 `type: consultation` 与 `instruction`；后台执行 CodeBuddy 知识回答和 Codex 独立复核，结果含 analysis、review、knowledge 引用和 advisory 标记。
