import dayjs from 'dayjs';

export function formatBytes(bytes: number) {
  if (!bytes || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value >= 100 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

/** 秒 → 3 天 4 小时、5 小时 6 分、7 分 */
export function formatDuration(seconds: number) {
  if (!seconds || seconds < 0) return '—';
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days} 天 ${hours} 小时`;
  if (hours > 0) return `${hours} 小时 ${minutes} 分`;
  return `${Math.max(minutes, 1)} 分`;
}

export function formatTime(millis: number) {
  return millis ? dayjs(millis).format('YYYY-MM-DD HH:mm:ss') : '—';
}

/** 0～1 → 0～100，保留整数 */
export function percent(ratio: number) {
  return Math.min(100, Math.max(0, Math.round((ratio || 0) * 100)));
}

/** 毫秒 → 8 秒、1 分 5 秒、1 小时 2 分；任务耗时用 */
export function formatElapsed(millis: number) {
  if (!millis || millis < 0) return '0 秒';
  const seconds = Math.round(millis / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours} 小时 ${minutes} 分`;
  if (minutes > 0) return `${minutes} 分 ${seconds % 60} 秒`;
  return `${seconds} 秒`;
}

export const taskTypeNames: Record<string, string> = {
  deploy: '发布',
  restart: '重启',
  start: '启动',
  stop: '关闭',
};

export const taskStatusTags: Record<string, { color: string; text: string }> = {
  failed: { color: 'error', text: '失败' },
  running: { color: 'processing', text: '执行中' },
  success: { color: 'success', text: '成功' },
};
