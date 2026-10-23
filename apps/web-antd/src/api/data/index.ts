import type {
  BusinessQuery,
  DataQueryResult,
  DataSourceRecord,
  DataSourceWrite,
  DataTemplateRecord,
  DataTemplateWrite,
} from '#/api/types';

import { requestClient } from '#/api/request';

function trimSource(data: DataSourceWrite) {
  return {
    name: data.name.trim(),
    remark: (data.remark ?? '').trim(),
    secret: data.secret ?? '',
    timeoutMs: data.timeoutMs,
    url: data.url.trim(),
  };
}

export async function getDataSourcesApi() {
  return requestClient.post<{ list: DataSourceRecord[] }>(
    '/data/source/list',
    {},
  );
}

export async function createDataSourceApi(data: DataSourceWrite) {
  return requestClient.post<DataSourceRecord>(
    '/data/source/create',
    trimSource(data),
  );
}

export async function updateDataSourceApi(
  sourceId: number,
  data: DataSourceWrite,
) {
  return requestClient.post<DataSourceRecord>('/data/source/update', {
    ...trimSource(data),
    sourceId,
  });
}

export async function removeDataSourceApi(sourceId: number) {
  return requestClient.post<null>('/data/source/remove', { sourceId });
}

/** 用表单里的值测试连接；sourceId 有值且密钥留空时用已保存的密钥 */
export async function testDataSourceApi(data: {
  secret?: string;
  sourceId?: number;
  timeoutMs: number;
  url: string;
}) {
  return requestClient.post<{ queryCount: number }>('/data/source/test', {
    secret: data.secret ?? '',
    sourceId: data.sourceId,
    timeoutMs: data.timeoutMs,
    url: data.url.trim(),
  });
}

/** 数据源提供的查询清单 */
export async function getSourceQueriesApi(sourceId: number) {
  return requestClient.post<{ queries: BusinessQuery[] }>(
    '/data/source/queries',
    { sourceId },
  );
}

export async function getDataTemplatesApi() {
  return requestClient.post<{ list: DataTemplateRecord[] }>(
    '/data/template/list',
    {},
  );
}

export async function createDataTemplateApi(data: DataTemplateWrite) {
  return requestClient.post<DataTemplateRecord>('/data/template/create', data);
}

export async function updateDataTemplateApi(
  templateId: number,
  data: DataTemplateWrite,
) {
  return requestClient.post<DataTemplateRecord>('/data/template/update', {
    ...data,
    templateId,
  });
}

export async function removeDataTemplateApi(templateId: number) {
  return requestClient.post<null>('/data/template/remove', { templateId });
}

/** params 是参数值对象，按模板的参数定义提交 */
export async function queryDataApi(
  templateId: number,
  params: Record<string, unknown>,
  page: number,
  pageSize: number,
) {
  return requestClient.post<DataQueryResult>(
    '/data/query',
    { page, pageSize, params: JSON.stringify(params), templateId },
    { timeout: 70_000 },
  );
}

/** 导出，最多 5 万行 */
export async function exportDataApi(
  templateId: number,
  params: Record<string, unknown>,
) {
  return requestClient.post<DataQueryResult>(
    '/data/query/export',
    { params: JSON.stringify(params), templateId },
    { timeout: 300_000 },
  );
}
