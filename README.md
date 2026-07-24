# Astro Platform

面向天文科普学习的多语言微服务平台骨架。

当前仓库只包含工程基础结构和最小可运行入口，业务功能按 PROJECT_SETUP_PLAN.md 分阶段建设。

## 目录

- frontend：Vue 3 + TypeScript 前端工程
- backend/services：Spring Boot / Spring Cloud 微服务
- contracts：OpenAPI 和事件契约
- deploy：本地基础设施和部署配置
- PROJECT_SETUP_PLAN.md：项目搭建与迭代计划

## 当前服务端口

| 服务 | 端口 |
| --- | ---: |
| API Gateway | 8080 |
| Identity | 8081 |
| Content | 8082 |
| Learning | 8083 |
| Astronomy | 8084 |
| Media | 8085 |

## 开发前置条件

- Eclipse Temurin JDK 21 LTS
- Maven 3.9+
- Node.js 20+ 和 Corepack 管理的 Yarn 4
- Docker Desktop

## 启动方式

后端：

~~~powershell
cd backend
mvn spring-boot:run -pl services/api-gateway
~~~

前端（从项目根目录另开终端）：

~~~powershell
corepack enable
cd frontend
yarn install --immutable
yarn dev
~~~

基础设施：

~~~powershell
Copy-Item deploy/compose/.env.example deploy/compose/.env
docker compose --env-file deploy/compose/.env -f deploy/compose/docker-compose.yml up -d
~~~

当前网关路由指向本机服务端口，服务发现和配置中心将在基础业务闭环完成后接入。
