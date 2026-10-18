# 打包与运行

## 环境

Node `^22.18.0 || ^24.12.0`，pnpm 11（`package.json` 的 `packageManager` 已指定）。首次执行 `pnpm install`。

## 本地开发

```bash
pnpm dev
```

## 打包

```bash
pnpm build:antd
```

产物在 `apps/web-antd/dist/`，是纯静态文件：`index.html`、`js/`、`css/`、`jse/`、`_app-config-*.js` 等。每个文件旁有预压缩的 `.gz`（`VITE_COMPRESS=gzip`）。

本机预览产物：

```bash
pnpm --filter @vben/web-antd preview
```

## 运行要求

产物可以放在任意静态文件服务器上，需要满足：

| 要求 | 说明 |
| --- | --- |
| 路由回退 | 找不到的路径返回 `index.html`（history 路由） |
| 缓存 | `index.html` 不缓存；`js/`、`css/`、`jse/` 和 `_app-config-*.js` 文件名带哈希，可以长期缓存 |
| 预压缩（可选） | 支持时直接发送 `.gz` 文件 |

## 接口地址

接口请求是 `<VITE_GLOB_API_URL><业务路径>`。`VITE_GLOB_API_URL` 是部署时反向代理给接口设置的入口，按实际入口填写。

## 打包配置

在 `apps/web-antd/.env.production` 中修改，修改后重新打包：

| 项 | 当前值 | 说明 |
| --- | --- | --- |
| `VITE_GLOB_API_URL` | `/api` | 接口入口，见上文 |
| `VITE_BASE` | `/` | 部署在子路径时修改 |
| `VITE_ROUTER_HISTORY` | `history` | 改为 `hash` 时不需要路由回退 |
| `VITE_COMPRESS` | `gzip` | 预压缩：`none` / `gzip` / `brotli` |

## 发布到服务器

每台服务器的发布脚本和配置放在 `deploy/servers/<服务器名>/`。
