# Cloudflare R2 图片存储

生产环境的图鉴图片保存在 Cloudflare R2 的 `astro` 桶中，通过自定义域名 `https://astro-img.shuumatsu.org` 公开分发。浏览器始终上传到受 JWT 保护的 `media-service`，R2 凭据不会发送到前端。

## Cloudflare 设置

1. 创建专用 R2 桶：`astro`。
2. 创建仅绑定该桶、拥有 **Object Read & Write** 权限的 Account API Token，并记录它生成的 S3 Access Key ID 与 Secret Access Key。
3. 将 `astro-img.shuumatsu.org` 连接为桶的自定义域名；域名和桶必须属于同一个 Cloudflare Account。
4. 自定义域名验证可用后，关闭公开 `r2.dev` 地址。
5. 为正式站和测试站设置 CORS。上传不从浏览器直传 R2，因此只需要 `GET` 与 `HEAD`。

```json
[
  {
    "AllowedOrigins": [
      "https://example.com",
      "https://staging.example.com"
    ],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": [],
    "ExposeHeaders": ["Content-Length", "Content-Type", "ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

修改 CORS 后清理自定义域名的缓存。为 JPEG、PNG、WebP 配置 Cloudflare Cache Rule，使边缘缓存遵循对象的 `Cache-Control: public, max-age=31536000, immutable` 响应头。

## 生产配置

生产服务器上，将 `deploy/production.env.example` 复制为 `deploy/compose/.env.production`，填写真实值。该文件被 Git 忽略，不能提交真实密钥。

`content-service` 与 `media-service` 会在 Spring Boot 启动前自动读取此 dotenv 文件。从项目根目录或任一服务目录启动时都会向上查找，无需再通过 PowerShell 手动导入环境变量。文件支持 `KEY=value`、`export KEY=value` 以及单、双引号包裹的值。

操作系统环境变量与 JVM 属性优先级高于文件配置，因此容器化部署仍可覆盖个别值。为了兼容旧的本地配置，`deploy/compose/.env.r2` 仍会作为回退文件。需要放在项目目录外时，可用 `ASTRO_ENV_FILE` 指定绝对路径，旧名 `ASTRO_LOCAL_ENV_FILE` 也可用。

```dotenv
CONTENT_DATABASE_URL=jdbc:postgresql://localhost:5432/astro
POSTGRES_USER=replace_with_postgres_user
POSTGRES_PASSWORD=replace_with_postgres_password

MEDIA_S3_ENDPOINT=https://26d627d3f106a8d504ec94827413d086.r2.cloudflarestorage.com
MEDIA_S3_REGION=auto
MEDIA_S3_ACCESS_KEY=replace_with_r2_access_key_id
MEDIA_S3_SECRET_KEY=replace_with_r2_secret_access_key
MEDIA_S3_BUCKET=astro
MEDIA_S3_PATH_STYLE=true
MEDIA_S3_AUTO_CREATE_BUCKET=false
MEDIA_DELIVERY_MODE=direct
MEDIA_PUBLIC_BASE_URL=https://astro-img.shuumatsu.org

ASTRO_ADMIN_USERNAME=replace_with_admin_username
ASTRO_ADMIN_PASSWORD=replace_with_admin_password
ASTRO_JWT_SECRET=replace_with_at_least_32_random_characters
```

`MEDIA_PUBLIC_BASE_URL` 必须同时提供给两个服务。在 `direct` 模式下，旧的 `/api/media/assets/{mediaId}` 链接会得到缓存一小时的 `302` 跳转，前往自定义域名。

## 启动服务

创建好 `deploy/compose/.env.production` 后，可直接启动：

```powershell
Set-Location backend/services/media-service
mvn spring-boot:run
```

启动 `content-service` 时同样不需要额外导入变量；两者会读取同一份生产配置文件。

## 部署验收

1. 先使用 `MEDIA_DELIVERY_MODE=proxy`，通过后台上传一张小图。
2. 确认 R2 中出现与返回 `mediaId` 相同的对象键。
3. 通过自定义域名访问该对象，验证 `200`、正确 MIME 类型与长期缓存头。
4. 在每个允许来源中检查后台预览和公开图鉴，确认没有 CORS 错误。
5. 切换为 `MEDIA_DELIVERY_MODE=direct`，确认旧 `/api/media/assets/{mediaId}` 链接返回 `302`，并且请求中不暴露 R2 endpoint 或任何密钥。

## 密钥安全

- 不要提交 `deploy/compose/.env.production` 或 `.env.r2`；`.gitignore` 已忽略 `.env.*`。
- 不要在前端变量、JavaScript 或部署日志中写入 R2 凭据。
- 若密钥曾出现在公开仓库、截图或工单中，应在 Cloudflare 立即吊销并重新创建。
- 应用只需要 S3 Access Key ID 和 Secret Access Key，不需要 Cloudflare 页面展示的 API Token 值。

官方参考：[R2 S3 API](https://developers.cloudflare.com/r2/api/s3/api/)、[AWS SDK for Java 示例](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-java/)、[公开桶与自定义域名](https://developers.cloudflare.com/r2/buckets/public-buckets/)、[CORS](https://developers.cloudflare.com/r2/buckets/cors/) 和 [API Token](https://developers.cloudflare.com/r2/api/tokens/)。
