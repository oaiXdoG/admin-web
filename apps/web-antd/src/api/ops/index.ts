import type {
  OpsAppAction,
  OpsAppRecord,
  OpsAppWrite,
  OpsTaskDetail,
} from '#/api/types';

import { requestClient } from '#/api/request';

/** 每片 2MB：分片只通过 HTTP 传给管理后台（请求体上限 16MB，base64 后约 2.7MB） */
export const UPLOAD_CHUNK_SIZE = 2 * 1024 * 1024;

/** 启停、发布在后台执行，立即返回 taskId，用 getOpsTaskApi 轮询输出 */
interface TaskStarted {
  taskId: number;
}

function trimApp(data: OpsAppWrite) {
  return {
    dir: data.dir.trim(),
    ip: data.ip.trim(),
    name: data.name.trim(),
    remark: (data.remark ?? '').trim(),
    sshPort: data.sshPort,
  };
}

/** ip 为空时返回全部程序；ips 为所有程序用到的 IP，给筛选下拉框 */
export async function getOpsAppsApi(ip?: string) {
  return requestClient.post<{ ips: string[]; list: OpsAppRecord[] }>(
    '/ops/app/list',
    { ip },
    { timeout: 20_000 },
  );
}

/** 保存前先 SSH 连一次，连不上不保存 */
export async function createOpsAppApi(data: OpsAppWrite) {
  return requestClient.post<OpsAppRecord>('/ops/app/create', trimApp(data), {
    timeout: 30_000,
  });
}

/** 改了 IP 或端口时先 SSH 连一次，连不上不保存 */
export async function updateOpsAppApi(appId: number, data: OpsAppWrite) {
  return requestClient.post<null>(
    '/ops/app/update',
    { appId, ...trimApp(data) },
    { timeout: 30_000 },
  );
}

/** 只删记录；运行中的要先关闭 */
export async function removeOpsAppApi(appId: number) {
  return requestClient.post<null>(
    '/ops/app/remove',
    { appId },
    { timeout: 40_000 },
  );
}

export async function controlOpsAppApi(appId: number, action: OpsAppAction) {
  return requestClient.post<TaskStarted>('/ops/app/control', {
    action,
    appId,
  });
}

/**
 * 分片上传程序包并发布：先拿 uploadId，按顺序逐片上传，最后提交发布任务。
 * onProgress 的参数为 0～1。
 */
export async function deployOpsAppApi(
  appId: number,
  file: File,
  overwriteConf: boolean,
  onProgress: (progress: number) => void,
) {
  const { uploadId } = await requestClient.post<{ uploadId: string }>(
    '/ops/app/upload/start',
    { appId },
  );
  const total = Math.max(1, Math.ceil(file.size / UPLOAD_CHUNK_SIZE));
  for (let index = 0; index < total; index++) {
    const chunk = file.slice(
      index * UPLOAD_CHUNK_SIZE,
      (index + 1) * UPLOAD_CHUNK_SIZE,
    );
    await requestClient.post<null>(
      '/ops/app/upload/chunk',
      { appId, data: await toBase64(chunk), index, uploadId },
      { timeout: 60_000 },
    );
    onProgress((index + 1) / total);
  }
  return requestClient.post<TaskStarted>('/ops/app/deploy', {
    appId,
    overwriteConf,
    uploadId,
  });
}

/** output 是 offset 之后的输出，下次轮询传返回的 offset */
export async function getOpsTaskApi(taskId: number, offset: number) {
  return requestClient.post<OpsTaskDetail>('/ops/task/get', {
    offset,
    taskId,
  });
}

async function toBase64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x80_00) {
    binary += String.fromCodePoint(...bytes.subarray(offset, offset + 0x80_00));
  }
  return btoa(binary);
}
