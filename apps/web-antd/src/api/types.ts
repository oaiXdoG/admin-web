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
