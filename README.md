# admin-front

项目运营管理后台，基于 [Vben Admin 5](https://github.com/vbenjs/vue-vben-admin)（Vue 3 + Ant Design Vue）。
仓库是 vben 的 monorepo，只保留了 `apps/web-antd` 一个应用，业务代码都在这里面。

## 开发

需要 Node 22.18+ / 24.12+，pnpm 11（仓库 `packageManager` 已指定，pnpm 会自动切换版本）。

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm build:antd   # 产物在 apps/web-antd/dist
```

开发时 `/api` 开头的请求由 vite 代理到后端，后端地址在 `apps/web-antd/.env.development` 的
`API_PROXY_TARGET` 配置（默认 `http://localhost:9050`），本机不同可写到 `.env.development.local` 覆盖。

## 和 vben 默认实现不同的地方

- **接口**：后端统一返回 `{ code, message, data }`，`code === 0` 成功；所有接口都是 POST。
  `100003` 登录失效直接退出（`src/api/request.ts`）。
- **登录**：后端没有用户信息和刷新 token 接口。登录返回的账号信息存在 localStorage，
  刷新页面后从那里恢复；退出时调用 `/api/logout` 删除服务器会话（`src/store/auth.ts`）。
- **菜单**：`accessMode: 'backend'`。`/api/access/menu` 返回平铺菜单，前端按
  `src/router/registry.ts` 的注册表转换成路由（`src/router/access.ts`），未注册的菜单会被忽略。
- **首页**：`defaultHomePath` 为 `/home`，不是真实页面，路由守卫把它跳到账号第一个可访问的菜单
  （`src/router/guard.ts`）。

## 权限模型

一套部署只服务一个项目，没有项目切换。后端设计见 `backend/docs/permission-redesign.md`，简述：

- 角色只有一种，在「系统管理 → 角色管理」维护，可以分配全部菜单（子项必须带上级）；通过「用户管理 → 分配角色」分配给账号，一个账号可以有多个角色。
- 内置「超级管理员」拥有全部启用菜单，不能修改、删除。初始另有前端、后端、测试、运营 4 个普通角色。
- 菜单类型有目录、菜单和按钮：按钮挂在菜单下，路由名称一栏保存权限标识（如 `manage_user:create`），后端写接口按它校验，前端从 `/api/access/menu` 返回的按钮得到权限码（vben `accessCodes`），页面用 `useAccess().hasAccessByCodes([...])` 决定是否显示按钮。
- 账号只能在「系统管理 → 用户管理」创建。「个人设置 → 我的权限」显示自己的角色。

每个账号可以在右上角头像菜单的「个人设置」里修改昵称、头像和密码。「系统管理 → 系统设置」分「品牌信息 / 数据备份」两个标签页（`views/system/setting`，当前标签记在地址栏 `?tab=`）。系统名称、Logo、浏览器图标、登录页文字和版权方在「品牌信息」里统一配置（图片压缩后以 base64 存进数据库），启动时读取并应用（`src/store/setting.ts`）。

## 新增一个页面

1. 在 `src/views/` 下写页面组件。
2. 在 `src/router/registry.ts` 注册：路由名 `目录_页面`、路径 `/目录/页面`、`component` 指向页面文件。
3. 在「系统管理 → 菜单管理」里新增菜单（可直接选「已注册路由」自动填入），再在「角色管理」里分配给需要的角色。
4. 页面里有写操作时：后端接口用 `页面路由名称:操作` 校验，菜单管理里在该页面下「新增按钮」填同样的权限标识，前端用 `hasAccessByCodes` 控制按钮显示。

**样式注意**：不要把 Tailwind 的外边距类（`mt-*`、`mb-*`、`ml-*` 等）直接写在 Ant Design 组件（`Card`、`Alert`、`Form`、`Tag`、`Descriptions` 等）上，组件自带的样式会把它覆盖掉；在外面套一个 `div`（或行内用 `span`）加间距，多个卡片之间用 `Page` 的 `content-class="flex flex-col gap-4"`。

字段映射编辑器（结果字段 + JSON 子字段）在 `src/components/field-mapping/`，数据查询模板使用。

标准的列表页参考 `src/views/system/role`：`useVbenVxeGrid` 做查询表格，`useVbenModal` + `useVbenForm`
做新增/编辑弹窗，字段配置写在同目录的 `data.ts`。

## 目录

```
apps/web-antd/src
├── api/            接口（types.ts 是后端数据结构）
├── layouts/        布局
├── router/         路由注册表、菜单转路由、路由守卫
├── store/          登录、系统设置
└── views/
    ├── system/       用户 / 角色 / 菜单 / 系统设置 / 操作日志
    └── data-center/  数据中心：数据查询、查询模板、数据源（调用业务服务器的查询接口，接口规范见 backend/docs/data-center.md）
```
