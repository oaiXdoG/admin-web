import type {
  OpsAppAction,
  OpsAppLogFile,
  OpsAppOption,
  OpsAppRecord,
  OpsAppWrite,
  OpsHostOption,
  OpsHostRecord,
  OpsHostWrite,
  OpsTaskDetail,
} from '#/api/types';

import { requestClient } from '#/api/request';

/** 要通过 SSH 连主机的同步接口 */
const SSH_TIMEOUT = 30_000;
/** 每片 2MB：分片只通过 HTTP 传给管理后台（请求体上限 16MB，base64 后约 2.7MB） */
export const UPLOAD_CHUNK_SIZE = 2 * 1024 * 1024;

/** 初始化、启停、发布、回滚、保存配置在后台执行，立即返回 taskId，用 getOpsTaskApi 轮询输出 */
interface TaskStarted {
  taskId: number;
}

export async function getOpsHostsApi() {
  return requestClient.post<{ list: OpsHostRecord[] }>(
    '/ops/host/list',
    {},
    {
      timeout: 20_000,
    },
  );
}

export async function getOpsHostOptionsApi() {
  return requestClient.post<{ list: OpsHostOption[] }>('/ops/host/options', {});
}

function trimHost(data: OpsHostWrite) {
  return {
    ip: data.ip.trim(),
    remark: (data.remark ?? '').trim(),
    sshPort: data.sshPort,
  };
}

export async function createOpsHostApi(data: OpsHostWrite) {
  return requestClient.post<OpsHostRecord>('/ops/host/create', trimHost(data));
}

export async function updateOpsHostApi(hostId: number, data: OpsHostWrite) {
  return requestClient.post<null>('/ops/host/update', {
    hostId,
    ...trimHost(data),
  });
}

/** 同步测试 SSH 连接，成功时返回主机名和系统 */
export async function testOpsHostApi(hostId: number) {
  return requestClient.post<{ message: string }>(
    '/ops/host/test',
    { hostId },
    { timeout: SSH_TIMEOUT },
  );
}

/** 安装 JDK、unzip 等 */
export async function initOpsHostApi(hostId: number) {
  return requestClient.post<TaskStarted>('/ops/host/init', { hostId });
}

export async function removeOpsHostApi(hostId: number) {
  return requestClient.post<null>('/ops/host/remove', { hostId });
}

function trimApp(data: OpsAppWrite) {
  return {
    dir: data.dir.trim(),
    hostId: data.hostId,
    name: data.name.trim(),
    remark: (data.remark ?? '').trim(),
  };
}

/** hostId 为空时返回全部主机上的程序 */
export async function getOpsAppsApi(hostId?: number) {
  return requestClient.post<{ list: OpsAppRecord[] }>(
    '/ops/app/list',
    { hostId },
    { timeout: 20_000 },
  );
}

export async function getOpsAppOptionsApi(hostId: number) {
  return requestClient.post<{ list: OpsAppOption[] }>('/ops/app/options', {
    hostId,
  });
}


export async function createOpsAppApi(data: OpsAppWrite) {
  return requestClient.post<OpsAppRecord>('/ops/app/create', trimApp(data));
}

export async function updateOpsAppApi(appId: number, data: OpsAppWrite) {
  return requestClient.post<OpsAppRecord>('/ops/app/update', {
    appId,
    ...trimApp(data),
  });
}

export async function removeOpsAppApi(appId: number) {
  return requestClient.post<null>('/ops/app/remove', { appId });
}

export async function controlOpsAppApi(appId: number, action: OpsAppAction) {
  return requestClient.post<TaskStarted>('/ops/app/control', {
    action,
    appId,
  });
}

/** file：server.log（全部日志）、error.log（只有 ERROR）或 console.log（最近一次启动的控制台输出） */
export async function getOpsAppLogApi(
  appId: number,
  lines: number,
  file: OpsAppLogFile,
) {
  return requestClient.post<{ content: string }>('/ops/app/log', {
    appId,
    file,
    lines,
  });
}

export async function getOpsAppConfigFilesApi(appId: number) {
  return requestClient.post<{ files: string[] }>('/ops/app/config/list', {
    appId,
  });
}

export async function getOpsAppConfigApi(appId: number, file: string) {
  return requestClient.post<{ content: string }>('/ops/app/config/get', {
    appId,
    file,
  });
}

/** restart 为 true 时保存后重启程序 */
export async function saveOpsAppConfigApi(
  appId: number,
  file: string,
  content: string,
  restart: boolean,
) {
  return requestClient.post<TaskStarted>('/ops/app/config/save', {
    appId,
    content,
    file,
    restart,
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

/** 备份名形如 20261106-074714，新的在前 */
export async function getOpsAppBackupsApi(appId: number) {
  return requestClient.post<{ list: string[] }>(
    '/ops/app/backups',
    { appId },
    { timeout: SSH_TIMEOUT },
  );
}

export async function rollbackOpsAppApi(appId: number, backup: string) {
  return requestClient.post<TaskStarted>('/ops/app/rollback', {
    appId,
    backup,
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
