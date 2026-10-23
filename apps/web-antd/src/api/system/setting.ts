import type {
  BackupInfo,
  OperationLogParams,
  OperationLogRow,
  SystemSetting,
} from '#/api/types';

import { requestClient } from '#/api/request';

/** 不需要登录，登录页也会读取 */
export async function getSystemSettingApi() {
  return requestClient.post<SystemSetting>('/system/setting/get', {});
}

export async function updateSystemSettingApi(data: SystemSetting) {
  return requestClient.post<SystemSetting>('/system/setting/update', {
    ...data,
    appName: data.appName.trim(),
    copyright: data.copyright.trim(),
    loginDescription: data.loginDescription.trim(),
    loginTitle: data.loginTitle.trim(),
  });
}

export async function getOperationLogsApi(params: OperationLogParams) {
  return requestClient.post<{ list: OperationLogRow[]; total: number }>(
    '/system/operation-log/list',
    params,
  );
}

export async function getBackupApi() {
  return requestClient.post<BackupInfo>('/system/backup/get', {});
}

export async function updateBackupApi(data: {
  enabled: boolean;
  keep: number;
  time: string;
}) {
  return requestClient.post<BackupInfo>('/system/backup/update', data);
}

/** 立即备份，在服务器后台执行，用 getBackupApi 查看进度 */
export async function runBackupApi() {
  return requestClient.post<BackupInfo>('/system/backup/run', {});
}

/** data 是 base64 编码的备份文件 */
export async function downloadBackupApi(name: string) {
  return requestClient.post<{ data: string; name: string }>(
    '/system/backup/download',
    { name },
  );
}

export async function removeBackupApi(name: string) {
  return requestClient.post<null>('/system/backup/remove', { name });
}
