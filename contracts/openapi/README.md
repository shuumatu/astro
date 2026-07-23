# API 契约

前端与后端之间的 REST API 使用 OpenAPI 管理。

约定：

- API 路径以 /api/{service} 开始，由 backend 中的 Gateway 统一暴露。
- 使用 Accept-Language 传递语言偏好。
- 响应中的天体和任务使用稳定 ID，不使用本地化名称作为关联键。
- 错误响应返回稳定的 code 和参数，前端负责本地化展示。
- 契约变更需要先兼容旧客户端，再删除旧字段。
