import type {
  ServerStatus,
  ServerTaskRecord,
  ServiceInfo,
  ServiceReport,
} from '#/api/types';

import dayjs from 'dayjs';

export function formatBytes(value?: null | number) {
  if (value === undefined || value === null) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index++;
  }
  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function formatPercent(value?: null | number) {
  return value === undefined || value === null ? '—' : `${value.toFixed(1)}%`;
}

export function ratio(used?: number, total?: number) {
  return used !== undefined && total ? (used / total) * 100 : undefined;
}

/** 秒数转成「3 天 4 小时」这样的时长 */
export function formatDuration(seconds?: null | number) {
  if (seconds === undefined || seconds === null || seconds < 0) return '—';
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days} 天 ${hours} 小时`;
  if (hours > 0) return `${hours} 小时 ${minutes} 分`;
  return `${Math.max(minutes, 0)} 分钟`;
}

export const serverStatusTags: Record<ServerStatus, { color: string; text: string }> = {
  offline: { color: 'error', text: '离线' },
  online: { color: 'success', text: '在线' },
  pending: { color: 'default', text: '未接入' },
};

const UNKNOWN_STATE = { color: 'default', text: '未知' };

/** systemd 的 ActiveState */
const processStateTags: Record<string, { color: string; text: string }> = {
  activating: { color: 'processing', text: '启动中' },
  active: { color: 'success', text: '运行中' },
  deactivating: { color: 'processing', text: '停止中' },
  failed: { color: 'error', text: '异常退出' },
  inactive: { color: 'default', text: '已停止' },
  unknown: UNKNOWN_STATE,
};

export function processStateTag(state?: string) {
  return processStateTags[state ?? 'unknown'] ?? UNKNOWN_STATE;
}

export const actionNames: Record<ServerTaskRecord['action'], string> = {
  deploy: '部署',
  remove: '删除',
  restart: '重启',
  start: '启动',
  stop: '停止',
};

export const taskStatusTags: Record<
  ServerTaskRecord['status'],
  { color: string; text: string }
> = {
  failed: { color: 'error', text: '失败' },
  running: { color: 'processing', text: '执行中' },
  success: { color: 'success', text: '成功' },
  timeout: { color: 'warning', text: '超时' },
  waiting: { color: 'default', text: '等待' },
};

/** 业务服上报的绑定状态；tip 为鼠标悬停时的说明 */
export function serviceTag(service: ServiceInfo, typeCode = '') {
  switch (service.status) {
    case 'mismatch': {
      return {
        color: 'error',
        text: '类型不符',
        tip: `登记 ${typeCode || '—'}，上报 ${service.type || '—'}`,
      };
    }
    case 'not_ready': {
      return { color: 'warning', text: '未就绪', tip: '进程在运行，但 30 秒内没有收到它的上报' };
    }
    case 'online': {
      return { color: 'success', text: '在线', tip: '' };
    }
    default: {
      return { color: 'default', text: '离线', tip: '' };
    }
  }
}

/** 上报的关键内容：游戏服为「N 区 · :port · GM :gmPort」，其他为「nodeId · :port」；没有上报为 — */
export function serviceSummary(report?: null | ServiceReport) {
  if (!report || !report.reportTime) return '—';
  if (report.type === 'logic') {
    const parts = [`${report.serverId ?? '?'} 区`, `:${report.port}`];
    if (report.gmPort) parts.push(`GM :${report.gmPort}`);
    return parts.join(' · ');
  }
  return [report.nodeId || '—', `:${report.port}`].join(' · ');
}

/** 毫秒时间戳转成「3 秒前」「2 分钟前」，超过 1 天显示日期时间；0 为 — */
export function formatReportTime(time?: null | number) {
  if (!time) return '—';
  const seconds = Math.max(Math.floor((Date.now() - time) / 1000), 0);
  if (seconds < 60) return `${seconds} 秒前`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} 小时前`;
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss');
}
