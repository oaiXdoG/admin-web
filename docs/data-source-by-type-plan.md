# 数据源按业务类型发现：接口约定

交互示意：`docs/mockups/data-source-by-type.html`。用户已确认：非 logic 类型默认选第一个节点。

## 数据库

- `data_source` 加 `service_type varchar(32) not null default ''`：业务类型编码（对应 `server_process_type.code`，即上报的 `type`）。
- `type` 取值：`http`（固定地址）/ `discover`（按业务类型发现，`url` 为空，`service_type` 必填）。原来的 `zone` 取消。
- 升级脚本 `admin-background/.ops/upgrade-data-discover.sql`（可重复执行）：加列；`update data_source set type='discover', service_type='logic' where type='zone'`。

## 发现规则（后台）

- 取本项目上报（`NodeInfoReportService`）中 `type = service_type`、在线（30 秒内）、`gmPort > 0` 的记录。
- 查询地址：连接方式 inner → `http://innerHost:gmPort`，public → `http://host:gmPort`。
- **目标（target）**：
  - `service_type = logic`：按区，key = 区号字符串（`"1"`），同区多条取 reportTime 最新；按区号数字排序。
  - 其他类型：按节点，key = nodeId（为空时用 instanceId），同 key 取最新；按 key 字符串排序。
- 目标结构 `DataSourceTarget`：`{ key: string, zoneId: number | null, nodeId: string, url: string }`（logic 的 zoneId 为区号，其他为 null）。
- `ZoneDiscoveryService` 改名为 `ServiceDiscoveryService`（方法 `targets(appKey, serviceType, publicNetwork)`）。

## 接口变化（请求都是 POST + JSON，带 projectId）

| 接口 | 变化 |
| --- | --- |
| `/data/source/list` | 每项加 `serviceType`、`serviceTypeName`；`type=discover` 的加 `targetCount`（当前可查询目标数），http 为 null；data 顶层加 `serviceTypes: [{ code, name }]`（code 非空的业务类型，供表单下拉，避免依赖进程管理权限） |
| `/data/source/create`、`/update`、`/test` | 加 `serviceType`（type=discover 时必填，只允许 `^[a-z0-9_]{1,32}$`）；type 只接受 http / discover |
| `/data/source/test` | 返回 `{ queryCount, targets: DataSourceTarget[] }`（原 `zones` 去掉）；discover 无可查询目标时返回原错误码（ZONE_NOT_AVAILABLE），消息改为「没有可查询的节点（需要在线且 GM 端口不为 0）」 |
| `/data/source/zones` | 改为 `/data/source/targets`，返回 `{ list: DataSourceTarget[] }`；http 返回空列表 |
| `/data/template/list` | 每项除已有的数据源类型外，加 `sourceServiceType` |
| `/data/query`、`/data/export` | `zoneIds: number[]` 改为 `targets: string[]`（target key）；discover 类型必填且非空 |
| 查询结果 | 每行 `_zone` 改为 `_target`（target key）；`failures: [{ target: string, message }]` |

## 前端

- 数据源表单：来源「固定地址 / 按业务类型发现」；选后者时显示「业务类型」下拉（来自 `/data/source/list` 返回的 `serviceTypes`，显示「名称（code）」）、连接方式，隐藏接口地址；说明文字见示意图。
- 数据源列表：来源列「按业务类型发现」+ 第二行灰字「名称 code · 内网/公网」；地址列 discover 显示 Tag：`targetCount > 0` 绿「在线 N 个区 / 节点」，否则橙「0 个可查询」。
- 测试连接结果：logic 显示「发现 N 个区」+ 区格子（`N 区`），其他显示「发现 N 个节点」+ 节点格子（nodeId），鼠标悬停显示 url。
- 数据查询：模板 `sourceServiceType === 'logic'` 时标签「区服」、选项 `N 区`、默认第一个区（保持现状）；其他 discover 类型标签「节点」、选项 nodeId、默认第一个节点；结果第一列标题相应为「区服 / 节点」，值为 `N 区` / nodeId；failures 提示同样区分。
