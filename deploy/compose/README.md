# 本地基础设施

~~~powershell
Copy-Item deploy/compose/.env.example deploy/compose/.env
docker compose --env-file deploy/compose/.env -f deploy/compose/docker-compose.yml up -d
docker compose --env-file deploy/compose/.env -f deploy/compose/docker-compose.yml down
~~~

本地默认提供 PostgreSQL、Redis 和 MinIO。Nacos、消息队列和可观测性组件在业务闭环确定后加入，避免一开始让基础设施成为主要工作量。

PostgreSQL 默认映射到本机 `15432`，容器内仍使用 `5432`。Content 服务默认连接 `jdbc:postgresql://localhost:15432/astro`。

Windows 可能将 `5432` 纳入系统保留端口范围，导致 Docker 报 `bind: An attempt was made to access a socket in a way forbidden by its access permissions`。可用 `netsh interface ipv4 show excludedportrange protocol=tcp` 检查。如果需要自定义端口，在 `.env` 中设置 `POSTGRES_PORT`，并在启动 Content 服务的终端中设置相同的 `$env:POSTGRES_PORT`，或通过 `CONTENT_DATABASE_URL` 指定完整连接地址；Compose 的 `--env-file` 不会自动设置后端进程的环境变量。
