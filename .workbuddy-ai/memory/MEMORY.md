# astro 项目长期约定

Vue 3 + astronomy-engine 的天文科普站。`frontend/src/features/demos/` 下每个演示是一个自包含场景。

## 演示场景契约（`features/demos/types.ts`）

场景由 `createScene(container, options)` 创建，通过 `options` 回调向外发布：`onLabels` /
`onReadout` / `onPhaseChange` / `onSettingsResolved` / `onState`；外壳通过返回对象的
`applySettings` / `runCommand` / `setSuspended` / `dispose` 向下驱动。场景**不读全局状态**。

**横切关注点在外壳统一处理，场景不要自己再监听一遍：**

- **页面隐藏暂停**：`DemoDetailView` 的 `visibilitychange` → `scene.setSuspended(document.hidden)`
  → `stage.stop()/start()`。场景只需实现 `setSuspended`。
- **标签渲染**：场景只发布锚点坐标，DOM 节点由外壳创建/定位/避让，`pointer-events: none`。
  标签解释走 `DemoLabelAnchor.descriptionKey`，外壳用命中测试弹 tooltip（详见
  `astro-demo-scene` skill）。
- **释放**：`stage.dispose()` 会遍历场景图释放 geometry / material / 其中的 texture，并断开
  resize observer、`controls.dispose()`、`renderer.dispose()`。场景自己 new 的非场景图对象
  （如影锥的 GPU 资源）要自己释放。
- **自建控制面板**：`DemoDefinition.controlPanel` 懒加载一个 Vue 组件，外壳把 `state` 传下去、
  把 `send` 传下去转发命令。**不要在 `DemoDetailView` 里按 slug 分支**，也不要往全局
  `DemoSceneSettings` 加某个演示独有的字段。

## engine/ 模块职责

`stage.ts`（渲染器/相机/控制器/帧循环/释放）、`globe.ts`（贴图球体与天体朝向）、
`glow.ts`（辉光贴图）、`starfield.ts`、`geometryDiagnostics.ts`、`random.ts`。
跨演示共用的东西放这里，不要从 `scenes/<a>/` import `scenes/<b>/`。

## 服务与端口

后端是 Spring Boot 多模块，`backend/services/` 下六个服务，端口在各自
`src/main/resources/application.yml` 里用 `${SERVER_PORT:默认}` 定义：

| 端口 | 服务 | 网关路由前缀 |
| --- | --- | --- |
| 8080 | api-gateway | — |
| 8081 | identity-service | `/api/identity/**` |
| 8082 | content-service | `/api/content/**` |
| 8083 | learning-service | `/api/learning/**` |
| 8084 | astronomy-service | `/api/astronomy/**` |
| 8085 | media-service | `/api/media/**` |

网关路由目标同样可用 `IDENTITY_SERVICE_URL` 等环境变量覆盖。前端 vite dev 为 **5173**，
`/api` 代理到 `VITE_DEV_PROXY_TARGET || http://localhost:8080`。

`deploy/compose/docker-compose.yml` 定义三个中间件：postgres（5432）、redis（6379）、
minio（9000/9001），容器名前缀 `astro-`。本机实际跑的是名为 `dev-postgres` 的容器，
所以排查端口占用时别只按 `astro-` 前缀找。

## 本机环境注意

- **PowerShell 工具在本机不回传 stdout**（命令 exit 0 但输出为空）。要拿输出就把结果
  `Set-Content` 写进临时文件再用 Read 读；且**不能用 bash 调 `powershell.exe`**（被安全策略拦截）。
- **`yarn` 不可用**（corepack 的 yarn.js 缺失）。用
  `node node_modules/vitest/vitest.mjs run`、`node node_modules/vue-tsc/bin/vue-tsc.js`、
  `node node_modules/vite/bin/vite.js build`。
- **`vite build` 直接跑会被沙箱的批量删除守卫拦下**（它要清空 `dist/assets`）。加
  `--outDir dist/check` 绕过，用完删掉。
- **headless Chrome 在 Windows 有最小窗口宽度（约 526px）**，`--window-size` 在小宽度上不可信，
  `--screenshot` 仍按请求尺寸裁图 → 看起来像页面横向溢出。判据是
  `documentElement.scrollWidth === clientWidth`。要验真实窄屏布局就用 iframe 定宽。
- 截图要**去掉 `--disable-gpu`**，否则 WebGL 图层不进 `--screenshot`。
- Chrome 是原生 exe，`--screenshot=/tmp/x.png` 会写到 `C:\tmp\x.png`。
- 用 `(vite ... &)` 起的 dev server **会在工具调用结束时被杀**，必须「起服务 + 用服务」同一条命令。
