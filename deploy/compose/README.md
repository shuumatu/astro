# 本地基础设施

~~~powershell
Copy-Item deploy/compose/.env.example deploy/compose/.env
docker compose --env-file deploy/compose/.env -f deploy/compose/docker-compose.yml up -d
docker compose --env-file deploy/compose/.env -f deploy/compose/docker-compose.yml down
~~~

本地默认提供 PostgreSQL、Redis 和 MinIO。Nacos、消息队列和可观测性组件在业务闭环确定后加入，避免一开始让基础设施成为主要工作量。
