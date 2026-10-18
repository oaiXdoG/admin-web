/**
 * 与后端约定的数据结构，接口返回统一为 { code, message, data }，code 为 0 表示成功。
 * 后端会省略值为 null 的字段，所以可能为空的字段都写成可选。
 * 状态统一为 1 启用（项目为正常）、2 停用（项目为已关闭）；时间均为毫秒时间戳。
 */

export const STATUS_ENABLED = 1;
export const STATUS_DISABLED = 2;

/** 菜单范围 */
export const SCOPE_PLATFORM = 1;
export const SCOPE_PROJECT = 2;

/** 角色类型 */
export const ROLE_PLATFORM = 1;
export const ROLE_TEMPLATE = 2;
export const ROLE_PROJECT = 3;

export interface LoginResult {
  token: string;
  id: number;
  account: string;
  username: string;
}

/** 项目切换器里的项目；超级管理员没有 roleId */
export interface ProjectItem {
  projectId: number;
  appKey?: string;
  name: string;
  createdAt?: number;
  roleId?: number;
  roleName?: string;
}

export interface ProjectListResult {
  currentProjectId?: number;
  projects: ProjectItem[];
}

/** 项目管理列表里的项目，包含已关闭项目 */
export interface ProjectManageItem {
  projectId: number;
  appKey: string;
  name: string;
  description: string;
  status: number;
  memberCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectWrite {
  appKey: string;
  name: string;
  description?: string;
}

export interface ProjectCreateResult {
  projectId: number;
  appKey: string;
  name: string;
  description?: string;
  createdAt: number;
  currentProjectId: number;
}

export interface AccountRecord {
  id: number;
  account: string;
  username: string;
  status: number;
  remark?: string;
  lastLoginAt?: number;
  createdAt: number;
  platformRoles: { code: string; id: number; name: string }[];
  projectCount: number;
}

export interface AccountMembership {
  projectId: number;
  roleId: number;
}

export interface ProjectMember {
  accountId: number;
  account: string;
  username: string;
  status: number;
  roleId: number;
  roleName: string;
  createdAt: number;
}

/** 菜单类型 */
export const MENU_DIRECTORY = 1;
export const MENU_ITEM = 2;
export const MENU_BUTTON = 3;

export interface MenuRecord {
  id: number;
  parentId: number;
  /** 1 目录，2 菜单，3 按钮（routeName 是权限标识） */
  menuType: number;
  /** 1 平台，2 项目；子项跟随上级 */
  scope: number;
  name: string;
  icon: string;
  routeName: string;
  routePath: string;
  status: number;
  hidden: boolean;
  builtIn: boolean;
  sort: number;
}

export interface MenuWrite {
  parentId?: number;
  menuType: number;
  scope?: number;
  name: string;
  icon?: string;
  routeName?: string;
  routePath?: string;
  status: number;
  hidden?: boolean;
  sort?: number;
}

export interface RoleRecord {
  id: number;
  roleType: number;
  projectId?: number;
  templateId?: number;
  templateName?: string;
  name: string;
  code: string;
  description: string;
  status: number;
  builtIn: boolean;
  createdAt: number;
}

export interface RoleWrite {
  name: string;
  code: string;
  description: string;
  status: number;
}

export interface RoleMenuResult {
  menus: MenuRecord[];
  menuIds: number[];
}

export interface Profile {
  id: number;
  account: string;
  username: string;
  /** 图片 data URL，未设置为空字符串 */
  avatar: string;
  remark?: string;
  lastLoginAt?: number;
  createdAt: number;
  superAdmin: boolean;
  platformRoles: string[];
  projects: { projectId: number; projectName: string; roleName: string }[];
}

/** 全局品牌信息；copyright 是版权方名称，页脚显示为「Copyright © 当年 版权方」 */
export interface SystemSetting {
  appName: string;
  logo: string;
  favicon: string;
  loginTitle: string;
  loginDescription: string;
  copyright: string;
}

/** 平台日志存储：只用于管理普通日志的保留期（管理账号），密码不返回 */
export interface LogStorage {
  url: string;
  database: string;
  adminUser: string;
  adminPasswordSet: boolean;
}

/** 管理密码留空表示沿用已保存的密码 */
export interface LogStorageWrite {
  url: string;
  database: string;
  adminUser: string;
  adminPassword?: string;
}

export interface LogStorageTestResult {
  adminOk: boolean;
  adminMessage?: string;
  version?: string;
  retentionDays?: number;
}

/** path 为日志自带列（time、actor 等）或 data.<路径>；值都以文本传递 */
export interface LogQueryCondition {
  path: string;
  type: string;
  operator: string;
  value?: string;
  value2?: string;
}

/** 日志查询：events 为空表示全部事件；actor、server 精确匹配；keyword 在 data 里搜索；conditions 按字段路径过滤 */
export interface LogQueryParams {
  startTime: number;
  endTime: number;
  events: string[];
  actor?: string;
  server?: string;
  keyword?: string;
  relation: string;
  conditions: LogQueryCondition[];
  page: number;
  pageSize: number;
}

/** 日志源：项目查询日志用的 ClickHouse（只读账号），每个项目一个，密码不返回 */
export interface LogSourceRecord {
  url: string;
  database: string;
  readUser: string;
  readPasswordSet: boolean;
  updatedAt: number;
}

/** 密码留空表示沿用已保存的密码 */
export interface LogSourceWrite {
  url: string;
  database: string;
  readUser: string;
  readPassword?: string;
}

/** 事件字典：fields 是 JSON 文本 [{ path, label, type }] */
export interface LogEventDict {
  event: string;
  label: string;
  description: string;
  fields: string;
  updatedAt?: number;
}

/** 最近有数据的事件 */
export interface EventSummary {
  event: string;
  total: number;
  lastTime: number;
}

/** 事件的字段：types 是 ClickHouse 类型，同一字段可能出现过多种；sample 是最新一条日志的 data */
export interface EventFields {
  fields: { path: string; types: string[] }[];
  sample?: Record<string, unknown>;
}

export interface LogRow {
  logId: string;
  time: number;
  server: string;
  actor: string;
  event: string;
  retention: string;
  data: Record<string, unknown>;
}

export interface LogQueryResult {
  database: string;
  total: number;
  list: LogRow[];
}

/** 后台操作日志的一行；params 是请求参数，密码和图片已脱敏 */
export interface OperationLogRow {
  id: number;
  time: number;
  accountId?: number;
  account: string;
  action: string;
  route: string;
  success: boolean;
  code: number;
  params: Record<string, unknown>;
}

export interface OperationLogParams {
  startTime: number;
  endTime: number;
  account?: string;
  action?: string;
  success?: boolean;
  page: number;
  pageSize: number;
}

/** 数据库备份设置、最近一次结果和已有备份；lastSuccess 为空表示还没有备份过 */
export interface BackupInfo {
  enabled: boolean;
  /** 每天备份的时间，HH:mm */
  time: string;
  keep: number;
  dir: string;
  running: boolean;
  lastTime?: number;
  lastSuccess?: boolean;
  lastMessage: string;
  files: { createdAt: number; name: string; size: number }[];
}

/** 数据源：业务服务器的查询接口，密钥不返回，只返回是否已设置 */
/** http：固定地址；discover：按业务类型发现（从该类型的在线上报里取查询地址，url 为空） */
export type DataSourceType = 'discover' | 'http';

/** 按业务类型发现的连接方式：inner 内网地址，public 公网地址（后台和业务服不在同一个内网时） */
export type DataSourceNetwork = 'inner' | 'public';

export interface DataSourceRecord {
  id: number;
  name: string;
  type: DataSourceType;
  network: DataSourceNetwork;
  /** 业务类型编码（server_process_type.code），type 为 discover 时有值 */
  serviceType: string;
  /** 业务类型名称，匹配不到为空 */
  serviceTypeName: string;
  url: string;
  /** discover 类型当前可查询的目标数；http 为 null */
  targetCount: null | number;
  secretSet: boolean;
  timeoutMs: number;
  remark: string;
  templateCount: number;
  createdAt: number;
  updatedAt: number;
}

/** 密钥留空表示沿用已保存的密钥 */
export interface DataSourceWrite {
  name: string;
  type: DataSourceType;
  network: DataSourceNetwork;
  /** type 为 discover 时必填 */
  serviceType: string;
  /** type 为 discover 时为空 */
  url: string;
  secret?: string;
  timeoutMs: number;
  remark?: string;
}

/** 查询参数定义；select 的 options 是可选值 */
export interface DataParam {
  name: string;
  label: string;
  type: 'boolean' | 'number' | 'select' | 'string' | 'time';
  required: boolean;
  options?: { label: string; value: string }[];
}

/** 业务服务器查询清单里的一项（GET /admin/queries） */
export interface BusinessQuery {
  name: string;
  label?: string;
  description?: string;
  params?: DataParam[];
  fields?: { key: string; label?: string; type?: string }[];
}

/** 数据查询模板；params、fields 是 JSON 文本 */
export interface DataTemplateRecord {
  id: number;
  sourceId: number;
  sourceName?: string;
  /** 数据源类型；后端未返回时由数据查询页按区服列表判断 */
  sourceType?: DataSourceType;
  /** 数据源的业务类型编码；logic 按区查询，其他 discover 类型按节点查询 */
  sourceServiceType?: string;
  name: string;
  query: string;
  params: string;
  fields: string;
  createdAt: number;
  updatedAt: number;
}

export interface DataTemplateWrite {
  sourceId: number;
  name: string;
  query: string;
  params: string;
  fields: string;
}

/** 业务服务器返回的结果行原样透传 */
/**
 * 按业务类型发现的数据源当前可查询的目标；url 为查询接口地址。
 * logic 按区：key 为区号字符串，zoneId 为区号；其他类型按节点：key 为 nodeId，zoneId 为 null
 */
/** 数据源可选的业务类型（业务类型中编码非空的），随数据源列表返回 */
export interface DataSourceServiceType {
  code: string;
  name: string;
}

export interface DataSourceTarget {
  key: string;
  zoneId: null | number;
  nodeId: string;
  url: string;
}

/** discover 类型数据源：每行带 _target（目标 key），查询失败或离线的目标记在 failures */
export interface DataQueryResult {
  total: number;
  list: Record<string, unknown>[];
  failures: { message: string; target: string }[];
}

/** 服务器管理：主机指标（cpu 为百分比，内存和磁盘为字节，网络为字节/秒，uptime 为秒），time 为采集时间 */
export interface HostMetric {
  cpu: number;
  load1: number;
  memoryUsed: number;
  memoryTotal: number;
  diskUsed: number;
  diskTotal: number;
  netIn: number;
  netOut: number;
  packetsIn?: number;
  packetsOut?: number;
  tcp?: number;
  uptime: number;
  time: number;
}

/** pending 未接入、online 在线、offline 离线 */
export type ServerStatus = 'offline' | 'online' | 'pending';

export interface ServerRecord {
  id: number;
  name: string;
  groupName: string;
  remark: string;
  status: ServerStatus;
  hostname: string;
  /** 后台看到的访问来源（出口公网 IP） */
  ip: string;
  /** Agent 上报的本机内网 IP，多个用逗号分隔 */
  privateIp: string;
  os: string;
  cpuCores: number;
  memoryTotal: number;
  agentVersion: string;
  registeredAt: number;
  lastSeenAt: null | number;
  metric: HostMetric | null;
  processCount: number;
}

export interface ServerWrite {
  name: string;
  groupName: string;
  remark: string;
}

/** 进程指标：cpu 为占整机的百分比，memory 为常驻内存字节 */
export interface ProcessMetric {
  state: string;
  pid: number;
  cpu?: number;
  memory?: number;
  threads?: number;
  tcp?: number;
  startedAt?: number;
  configVersion: number;
  time: number;
}

/** waiting 等待、running 执行中、success 成功、failed 失败、timeout 超时 */
export interface ServerTaskRecord {
  id: number;
  serverId: number;
  processId: number;
  processName: string;
  action: 'deploy' | 'remove' | 'restart' | 'start' | 'stop';
  status: 'failed' | 'running' | 'success' | 'timeout' | 'waiting';
  /** 部署记录为「文件名（大小）· 备注」，其他为空 */
  remark: string;
  output: string;
  operator: string;
  createdAt: number;
  finishedAt: number;
}

/** 托管进程表单 */
export interface ProcessWrite {
  remark: string;
  /** 业务类型，必填（旧数据可能为 null） */
  typeId: null | number;
  workDir: string;
  javaPath: string;
  templateId: null | number;
  jvmOptions: string;
  /** -jar 方式的 jar；-cp 方式为空 */
  jar: string;
  /** -cp 方式：填了主类时用 -cp classpath mainClass 启动 */
  classpath: string;
  mainClass: string;
  programArgs: string;
  env: string;
  runUser: string;
  port: number;
}

export interface ProcessRecord extends ProcessWrite {
  id: number;
  serverId: number;
  serverName: string;
  serverStatus: ServerStatus;
  name: string;
  templateName: string;
  typeName: string;
  /** 最近一次成功部署的时间和执行记录备注，没有部署过为 null / 空 */
  deployedAt: null | number;
  deployRemark: string;
  configVersion: number;
  updatedAt: number;
  /** systemd 状态：active、inactive、failed、activating、deactivating；服务器离线为 unknown */
  state: string;
  pendingRestart: boolean;
  metric: null | ProcessMetric;
  task: null | ServerTaskRecord;
  /** 业务类型编码，类型没有编码时为空 */
  typeCode: string;
  /** 业务服上报的绑定结果；类型没有编码时为 null */
  service: null | ServiceInfo;
}

/** 绑定状态：online 30 秒内有上报；not_ready 进程在运行但没有上报；mismatch 上报类型和登记的不一致；offline 进程没在运行 */
export type ServiceStatus = 'mismatch' | 'not_ready' | 'offline' | 'online';

/** 业务服上报的关键内容（type 为上报的业务类型编码） */
export interface ServiceReport {
  type: string;
  nodeId: string;
  instanceId: string;
  /** 区号，只有游戏服（logic）有 */
  serverId: null | number;
  host: string;
  port: number;
  innerHost: string;
  /** 0 表示没有 GM 端口 */
  gmPort: number;
  /** 毫秒，0 表示从未上报 */
  reportTime: number;
  raw: null | Record<string, unknown>;
}

export interface ServiceInfo extends ServiceReport {
  status: ServiceStatus;
}

/** 在上报但不是由后台启动的服务；serverName 为按内网地址匹配的服务器，空为未匹配 */
export interface UnmanagedServiceRecord extends ServiceReport {
  online: boolean;
  serverName: string;
}

/** 业务服上报配置 */
export interface ReportConfig {
  appKey: string;
  reportUrl: string;
  secret: string;
}

export interface JvmTemplateRecord {
  id: number;
  name: string;
  options: string;
  processCount: number;
  updatedAt: number;
}

export interface ProcessTypeRecord {
  id: number;
  name: string;
  /** 与业务服上报的类型一致，例如 login、callback、logic；空表示不上报 */
  code: string;
  processCount: number;
}

/** 文件管理：list 返回的一项，modifiedAt 为毫秒 */
export interface ProcessFileEntry {
  name: string;
  dir: boolean;
  size: number;
  modifiedAt: number;
}

/** 文件操作结果：pending 等待 Agent 领取执行，timeout 为 60 秒没有结果 */
export interface ProcessFileResult<T = unknown> {
  status: 'done' | 'pending' | 'timeout';
  success: boolean;
  message: string;
  data: T;
}

/** 监控曲线上的一个点（该粒度内的平均值）：主机指标或进程指标，进程的 memoryUsed 为常驻内存 */
export interface MetricPoint {
  time: number;
  cpu: number;
  load1: number;
  memoryUsed: number;
  memoryTotal: number;
  diskUsed: number;
  diskTotal: number;
  netIn: number;
  netOut: number;
  packetsIn: number;
  packetsOut: number;
  tcp: number;
  threads: number;
}
