# 进程与服务绑定：各仓库改动清单

交互示意：`docs/mockups/service-binding.html`。

## 0. 方案要点

- **服务之间**：登录服、回调服、游戏服仍走 zfoo 服务发现，不改。
- **服务 → 后台**：每个业务服定时 HTTP 上报自己的信息（类型、节点 ID、实例 ID、地址端口；游戏服带区号）。
- **绑定**：后台启动进程时，由 Agent 注入环境变量 `ADM_INSTANCE_ID=<后台进程 ID>`，业务服把它作为实例 ID 上报，后台按实例 ID 找到进程。
- **零配置**：上报地址、上报密钥也由 Agent 注入；后台托管的进程不需要在配置文件里写任何后台相关的东西。不是后台启动的进程读不到这些变量，就不上报；也可以手动配置地址和密钥上报，后台显示为「未托管」。
- 业务字段（区号等）只在上报内容里出现，不进入启动参数。

### 注入的环境变量

| 变量 | 值 | 谁提供 |
| --- | --- | --- |
| `ADM_INSTANCE_ID` | 后台进程 ID，例如 `12` | 后台生成，Agent 写入 |
| `ADM_REPORT_SECRET` | 项目上报密钥 | 后台生成，Agent 写入 |
| `ADM_REPORT_URL` | `<Agent 自己的 baseUrl>/api/node/report` | Agent 自己拼（Agent 能连上后台，这个地址就一定可达；gz 上是 `http://127.0.0.1/...`） |

- 变量写在每个进程自己的文件 `/etc/admin-agent/env/adm-<进程名>.env`（权限 0600），服务文件用 `EnvironmentFile=` 引用。一台服务器多个进程各有各的文件，互不影响；密钥不出现在任何人可读的服务文件和 `systemctl show` 里。
- 进程表单里的「环境变量」不允许 `ADM_` 开头。

### 上报内容（字段只增不改）

```json
{
  "type": "logic",            // 新增，必填：login / callback / logic，写死在各服务代码里
  "nodeId": "logic-1",        // 新增，可选：zfoo 节点 ID，只用于显示
  "instanceId": "12",         // 已有：有 ADM_INSTANCE_ID 用它，否则随机 UUID
  "serverId": 1,              // 已有：只有 logic 必填，表示区号
  "host": "111.230.143.165",  // 已有
  "port": 9020,               // 已有
  "innerHost": "10.0.0.8",    // 已有
  "gmPort": 9021              // 已有，没有 GM 接口填 0
}
```

签名不变：`X-Admin-Project`（App Key）、`X-Admin-Timestamp`、`X-Admin-Signature = hex(HMAC-SHA256(上报密钥, 时间戳 + "\n" + hex(SHA256(请求体))))`。密钥从数据中心数据源的密钥改为**项目上报密钥**。

## 1. admin-background

### 1.1 数据库（`schema.sql` + 一次性升级脚本 `.ops/upgrade-service-binding.sql`）

- `project` 加 `report_secret text not null default ''`：项目上报密钥，加密保存；为空时首次查看自动生成。
- `server_process_type` 加 `code varchar(32) not null default ''`：业务类型编码，项目内非空时唯一；为空表示不上报、不参与绑定。
- 升级脚本：给 gz 现有类型补编码（登录服 `login`、游戏服 `logic`，回调服按实际情况）；所有进程 `config_version + 1`，让页面提示「待重启」（重启后才带上新环境变量）。

### 1.2 上报接口 `POST /api/node/report`

- `NodeInfoReportRequest` 加 `type`、`nodeId`。
- 校验：`type` 非空；`type=logic` 时 `serverId > 0`；其余规则不变。
- 验签：按 App Key 找项目，用项目上报密钥验签；不再读数据源密钥。
- `NodeInfoReportService` 存储改为 `App Key → instanceId → Node`（Node 加 `type`、`nodeId`），仍是内存、30 秒在线、不删除；记录超过 1 天没有上报的定期清掉（实例 ID 随机的进程每次重启都会产生新记录）。
- 提供：按项目取在线节点、按实例 ID 取节点、未托管节点（实例 ID 对不上本项目进程）。

### 1.3 数据中心

- `ZoneDiscoveryService.zones`：只取 `type=logic` 的在线节点，区 ID 取 `serverId`；同一个区有多条在线记录时取最新一条。
- 按区自动发现数据源的密钥仍用于后台调用游戏服 GM 接口，只是不再用于上报验签。

### 1.4 进程管理

- `ServerProcessService` 生成服务文件时加 `EnvironmentFile=-/etc/admin-agent/env/adm-<进程名>.env`；下发给 Agent 的进程定义加 `env`：`ADM_INSTANCE_ID`、`ADM_REPORT_SECRET`。
- 新增 / 编辑进程：类型必填；环境变量拒绝 `ADM_` 开头。
- 进程列表、详情返回 `service`：`status`（online / not_ready / mismatch / offline）、`type`、`nodeId`、`serverId`、`host`、`port`、`innerHost`、`gmPort`、`reportTime`、原始上报。判断：
  - 进程运行中 + 30 秒内有上报 → online；类型编码与上报 `type` 不同 → mismatch；
  - 进程运行中 + 没有上报 → not_ready；进程已停止 → offline；类型没有编码 → 不显示。
- 新接口：
  - `/api/server/node/unmanaged`：未托管服务列表（附按内网 IP 匹配到的服务器）。
  - `/api/server/report-config`：App Key、上报地址、上报密钥（手动配置时用）；`/api/server/report-config/reset`：重置密钥（按钮权限 `server_process:update`）。
- 进程类型增删改加 `code`。

### 1.5 Agent（`agent/`，0.4.0）

- 进程定义里的 `env` 写入 `/etc/admin-agent/env/adm-<进程名>.env`（0600），再补上 `ADM_REPORT_URL=<baseUrl>/api/node/report`；内容变化时与服务文件一样 `daemon-reload`。
- 删除进程时同时删除这个文件。
- 旧版 Agent 不认识 `env`：服务文件里的 `EnvironmentFile=-` 带 `-`，文件不存在也能启动，只是不上报。

### 1.6 新子项目 `report-client/`

- 坐标 `com.oaixdog:admin-report-client:1.0.0-SNAPSHOT`，Java 17，只用 JDK（HttpClient、HMAC），不引入其他依赖；本机 `mvn install` 后业务服引用（与 log-sdk 相同）。
- API：

  ```java
  AdminReporter.instanceId();                       // ADM_INSTANCE_ID，没有则启动时生成一次 UUID
  AdminReporter.start(appKey, "logic", "logic-1", () -> Map.of(...)); // 就绪后调用一次
  AdminReporter.stop();
  ```

- 地址、密钥：优先环境变量 `ADM_REPORT_URL` / `ADM_REPORT_SECRET`，没有时读 `start` 传入的配置（手动配置用），都没有就不上报、打一条 INFO。
- 每 10 秒上报一次（内容每次重新取，端口变化也能跟上）；失败只打印警告，同一原因每分钟最多一次；不影响业务。

### 1.7 文档

- `docs/server-management.md`：业务类型编码、注入的环境变量、服务状态、未托管服务、上报配置。
- `docs/data-center.md`：按区自动发现改读 `type=logic` 的上报；上报验签改为项目上报密钥。
- `docs/服务发现改造.md`：上报接口、存储 key 改为实例 ID。
- `report-client/README.md`：接入方法。

## 2. admin-front

| 文件 | 改动 |
| --- | --- |
| `views/server/components/type-modal.vue` | 业务类型加「编码」列和字段 |
| `views/server/components/process-form.vue` | 类型放第一项并必填（单选按钮）；环境变量校验 `ADM_` |
| `views/server/process.vue` | 「托管进程 / 未托管服务」两个标签；新增「服务」「服务信息」「最近上报」列；工具栏「上报配置」弹窗（App Key、上报地址、密钥，复制 / 重置） |
| `views/server/components/process-detail.vue` | 新增「服务」标签：绑定状态、类型、节点 ID、区号、地址端口、首次 / 最近上报、原始上报 |
| `views/data-center/source.vue` | 按区自动发现的说明文字改为「区服来自游戏服上报」 |
| `api/server/*` | 新接口、新字段的类型定义 |

## 3. daoshinvgui（游戏服）

- 引入 `admin-report-client`。
- `NodeInfoReportService`：
  - 实例 ID 改为 `AdminReporter.instanceId()`，`LoginReport` / `CallbackReport` 也用它（同一进程重启后实例 ID 不变，登录服、回调服不会误判区 ID 冲突）；
  - 删除自己的 HTTP 上报、签名代码，就绪后调用 `AdminReporter.start(appKey, "logic", nodeId, ...)`，内容为 `serverId`（区号）、`host`、`port`、`innerHost`、`gmPort`。
- 配置：`admin.report-url` 保留（手动配置用，默认空），新增 `admin.report-secret`；`gm.secret` 只用于 GM 接口。
- 文档 `docs/服务发现改造.md` 同步。

## 4. danmu-login（登录服）

- 引入 `admin-report-client`；HTTP 和 provider 启动后调用 `AdminReporter.start(appKey, "login", server.node-id, ...)`，内容 `host`、`port`（9030）、`innerHost`、`gmPort=0`。
- 配置加 `admin.report-url`、`admin.report-secret`（默认空）。
- `docs/service-discovery.md` 第 7 节重写：所有服务都上报、上报字段、环境变量、密钥。

## 5. danmu-callback（回调服）

- 同登录服，`type=callback`。

## 6. 其他

- `~/Project/danmu/architecture.md`：「game → admin」改为「login / callback / game → admin 上报」，补上 Agent 注入环境变量。

## 7. 上线顺序（gz 测试环境一次切换，不写兼容代码）

1. `report-client` `mvn install`。
2. 后台、Agent 0.4.0 发布；执行升级脚本；gz 的 Agent 升级。
3. 前端发布。
4. 三个业务服引入新包后，用后台「部署」发布，并在后台重启（重启后带上环境变量）。
5. 验证：三个进程「服务」都为在线；数据中心能查 1 区；本机直接启动一个游戏服并手动配置密钥，出现在「未托管服务」；停掉一个进程 30 秒后显示离线；错误密钥上报被拒。
