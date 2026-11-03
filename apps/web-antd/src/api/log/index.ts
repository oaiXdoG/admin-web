import type { LogDefinition, LogQueryParams, LogQueryResult } from '#/api/types';

import { requestClient } from '#/api/request';

/** 日志服务里的事件定义 */
export async function getLogEventsApi() {
  return requestClient.post<{ list: LogDefinition[] }>('/log/event/list', {});
}

export async function createLogEventApi(definition: LogDefinition) {
  return requestClient.post<null>('/log/event/create', toRequest(definition));
}

export async function updateLogEventApi(definition: LogDefinition) {
  return requestClient.post<null>('/log/event/update', toRequest(definition));
}

function toRequest(definition: LogDefinition) {
  return {
    collection: definition.collection,
    event: definition.event,
    fields: JSON.stringify(definition.fields),
    name: definition.name,
  };
}

export async function queryLogApi(
  params: LogQueryParams,
  offset: number,
  limit: number,
) {
  return requestClient.post<LogQueryResult>(
    '/log/query',
    {
      ...params,
      conditions: JSON.stringify(params.conditions),
      limit,
      offset,
    },
    { timeout: 70_000 },
  );
}
