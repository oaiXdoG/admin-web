/**
 * 与后端约定的数据结构，接口返回统一为 { code, message, data }，code 为 0 表示成功。
 * 后端会省略值为 null 的字段，所以可能为空的字段都写成可选。
 * 状态统一为 1 启用、2 停用；时间均为毫秒时间戳。
 */

export const STATUS_ENABLED = 1;
export const STATUS_DISABLED = 2;

export interface LoginResult {
  token: string;
  id: number;
  account: string;
  username: string;
}

export interface AccountRecord {
  id: number;
  account: string;
  username: string;
  status: number;
  remark?: string;
  lastLoginAt?: number;
  createdAt: number;
  roles: { code: string; id: number; name: string }[];
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
  roles: string[];
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

/** 数据源：业务服务器的查询接口（固定地址），密钥不返回，只返回是否已设置 */
export interface DataSourceRecord {
  id: number;
  name: string;
  url: string;
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
export interface DataQueryResult {
  total: number;
  list: Record<string, unknown>[];
}

/** 日志服务里的字段类型 */
export type LogDefinitionFieldType =
  | 'bool'
  | 'date'
  | 'decimal'
  | 'double'
  | 'int'
  | 'long'
  | 'string';

/** 事件定义中的字段：key 是上报字段名，field 是存储字段名，name 是显示名称（可为空），display 决定是否作为查询结果列 */
export interface LogDefinitionField {
  key: string;
  field: string;
  type: LogDefinitionFieldType;
  required: boolean;
  name: string;
  display: boolean;
}

/** 日志服务里的事件定义：一个事件对应一个 Mongo 集合，name 是显示名称（可为空） */
export interface LogDefinition {
  event: string;
  name: string;
  collection: string;
  fields: LogDefinitionField[];
}

export type LogOperator = 'eq' | 'ge' | 'gt' | 'le' | 'like' | 'lt' | 'ne';

/** 查询条件：value 为文本，date 字段为毫秒 */
export interface LogCondition {
  key: string;
  op: LogOperator;
  value: string;
}

export interface LogQueryParams {
  event: string;
  conditions: LogCondition[];
}

/** 结果行以上报字段名为 key */
export interface LogQueryResult {
  total: number;
  list: Record<string, unknown>[];
}

export interface OpsAppState {
  dir: string;
  error: string;
  deployed: boolean;
  running: boolean;
  /** bin/app.sh status 的结果；not-deployed：还没有发布（没有 bin/app.sh 或 lib 下没有 jar） */
  status: 'not-deployed' | 'running' | 'stopped';
  pid: number;
  startTime: number;
}

/** 运维中心的程序：一台机器（ip、sshPort）上的一个目录。机器连不上或读取失败时 state 为空，error 为原因 */
export interface OpsAppRecord {
  id: number;
  name: string;
  ip: string;
  sshPort: number;
  hostOnline: boolean;
  dir: string;
  remark: string;
  deployedAt: number;
  createdAt: number;
  updatedAt: number;
  error: string;
  /** 有任务正在执行 */
  busy: boolean;
  state?: OpsAppState;
}

export interface OpsAppWrite {
  name: string;
  ip: string;
  sshPort: number;
  dir: string;
  remark?: string;
}

export type OpsAppAction = 'restart' | 'start' | 'stop';

export type OpsTaskStatus = 'failed' | 'running' | 'success';

/** 一次后台运维操作（通过 SSH 执行）：发起操作的页面按 taskId 轮询输出。做了什么记在操作日志 */
export interface OpsTaskRecord {
  id: number;
  /** start、stop、restart、deploy */
  type: string;
  title: string;
  appId: number;
  account: string;
  status: OpsTaskStatus;
  startedAt: number;
  finishedAt: number;
}

export interface OpsTaskDetail extends OpsTaskRecord {
  /** 请求的 offset 之后的输出 */
  output: string;
  /** 下次轮询传这个 offset */
  offset: number;
}
