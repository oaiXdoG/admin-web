import type { LogDefinitionFieldType, LogOperator } from '#/api/types';

/** 事件名、上报字段名：字母开头的字母、数字、下划线，最长 64 位，与日志服务一致 */
export const NAME_PATTERN = /^[A-Z]\w{0,63}$/i;

/** 集合名、存储字段名：小写字母开头的小写字母、数字、下划线，最长 63 位，与日志服务一致 */
export const STORAGE_NAME_PATTERN = /^[a-z][a-z0-9_]{0,62}$/;

/** 显示名称为空时用上报的名字 */
export function displayName(item: { event?: string; key?: string; name?: string }) {
  return item.name || item.key || item.event || '';
}

/** 「显示名称（名字）」，没有显示名称时只显示名字 */
export function labelOf(item: { event?: string; key?: string; name?: string }) {
  const raw = item.key ?? item.event ?? '';
  return item.name ? `${item.name}（${raw}）` : raw;
}

export const fieldTypes: { label: string; value: LogDefinitionFieldType }[] = [
  { label: 'string 文本', value: 'string' },
  { label: 'int 整数', value: 'int' },
  { label: 'long 长整数', value: 'long' },
  { label: 'double 小数', value: 'double' },
  { label: 'decimal 精确小数', value: 'decimal' },
  { label: 'bool 布尔', value: 'bool' },
  { label: 'date 时间（毫秒）', value: 'date' },
];

export const operatorLabels: Record<LogOperator, string> = {
  eq: '等于',
  ge: '大于等于',
  gt: '大于',
  le: '小于等于',
  like: '开头是',
  lt: '小于',
  ne: '不等于',
};

const COMPARE: LogOperator[] = ['eq', 'ne', 'gt', 'ge', 'lt', 'le'];

/** 各类型可用的运算符，与日志服务一致：like 只用于 string，前缀匹配 */
export const operatorsByType: Record<LogDefinitionFieldType, LogOperator[]> = {
  bool: ['eq', 'ne'],
  date: COMPARE,
  decimal: COMPARE,
  double: COMPARE,
  int: COMPARE,
  long: COMPARE,
  string: ['eq', 'ne', 'like'],
};
