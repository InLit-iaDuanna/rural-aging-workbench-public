# V2.0 开源复用清单

以下均为安装依赖；AI Town 仅作为架构参考，没有复制源码或资源。

| 依赖 | 实际版本 | 许可证 |
|---|---|---|
| @langchain/langgraph | 1.4.14 | MIT |
| @langchain/langgraph-checkpoint-postgres | 1.0.5 | MIT |
| xstate | 5.32.6 | MIT |
| @assistant-ui/react | 0.15.18 | MIT |
| survey-core | 3.0.3 | MIT |
| survey-react-ui | 3.0.3 | MIT |
| dexie | 4.4.5 | Apache-2.0 |
| fastify | 5.12.3 | MIT |
| zod | 4.6.0 | MIT |
| better-auth | 1.7.3 | MIT |
| pg | 8.23.0 | MIT |

源码移植：无。框架使用记录见实际 import 和锁文件。
AI Town：https://github.com/a16z-infra/ai-town；仅参考世界、角色、执行引擎分层。
开发验证另外使用 Vitest、PGlite，以及 embedded-postgres；后者为测试工具，其 npm 包带 beta 标识，生产服务使用 PostgreSQL 官方镜像。
不采用 SurveyJS 商业设计器，不调用 assistant-cloud 或 Dexie Cloud 服务。
