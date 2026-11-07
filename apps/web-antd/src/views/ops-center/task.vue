<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { OpsHostOption, OpsTaskRecord } from '#/api/types';

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';

import { Button, Select, Tag } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getOpsHostOptionsApi, getOpsTasksApi } from '#/api';

import TaskOutput from './components/task-output.vue';
import {
  formatElapsed,
  formatTime,
  taskStatusTags,
  taskTypeNames,
} from './format';

/** 列表里有执行中的任务时每 5 秒刷新 */
const REFRESH_MS = 5000;

const route = useRoute();

const hosts = ref<OpsHostOption[]>([]);
/** 为空表示全部主机 */
const hostId = ref<number | undefined>(
  route.query.hostId ? Number(route.query.hostId) : undefined,
);
/** 只能从程序页带过来，不在界面上选 */
const appId = route.query.appId ? Number(route.query.appId) : undefined;
const taskId = ref<null | number>(null);
let timer: ReturnType<typeof setTimeout> | undefined;

const hostOptions = computed(() =>
  hosts.value.map((host) => ({
    label: `${host.ip}${host.hostname ? `（${host.hostname}）` : ''}${host.remark ? ` ${host.remark}` : ''}`,
    value: host.id,
  })),
);

onMounted(async () => {
  const { list } = await getOpsHostOptionsApi();
  hosts.value = list;
});

function stopTimer() {
  if (timer) clearTimeout(timer);
  timer = undefined;
}

onBeforeUnmount(stopTimer);

function elapsed(row: OpsTaskRecord) {
  if (!row.startedAt) return '—';
  if (row.status === 'running')
    return formatElapsed(Date.now() - row.startedAt);
  return row.finishedAt ? formatElapsed(row.finishedAt - row.startedAt) : '—';
}

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: [
      {
        field: 'startedAt',
        formatter: ({ cellValue }) => formatTime(cellValue),
        title: '时间',
        width: 170,
      },
      { align: 'left', field: 'title', minWidth: 280, title: '任务' },
      {
        field: 'type',
        formatter: ({ cellValue }) => taskTypeNames[cellValue] ?? cellValue,
        title: '类型',
        width: 100,
      },
      {
        field: 'account',
        formatter: ({ cellValue }) => cellValue || '—',
        title: '操作人',
        width: 140,
      },
      {
        field: 'status',
        slots: { default: 'status' },
        title: '结果',
        width: 100,
      },
      {
        field: 'elapsed',
        formatter: ({ row }) => elapsed(row),
        title: '耗时',
        width: 120,
      },
      {
        field: 'operation',
        fixed: 'right',
        slots: { default: 'action' },
        title: '操作',
        width: 110,
      },
    ],
    height: 'auto',
    keepSource: true,
    pagerConfig: { pageSize: 20, pageSizes: [20, 50, 100, 200] },
    proxyConfig: {
      ajax: {
        query: async ({ page }) => {
          stopTimer();
          const result = await getOpsTasksApi({
            appId,
            hostId: hostId.value,
            page: page.currentPage,
            pageSize: page.pageSize,
          });
          if (result.items.some((item) => item.status === 'running')) {
            timer = setTimeout(() => gridApi.query(), REFRESH_MS);
          }
          return { items: result.items, total: result.total };
        },
      },
    },
    rowConfig: { keyField: 'id' },
    toolbarConfig: { custom: true, refresh: true, zoom: true },
  } as VxeTableGridOptions<OpsTaskRecord>,
});

watch(hostId, () => gridApi.reload());
</script>

<template>
  <Page auto-content-height>
    <Grid table-title="运维任务">
      <template #toolbar-actions>
        <Select
          v-model:value="hostId"
          :options="hostOptions"
          allow-clear
          class="ml-4 w-72"
          placeholder="全部主机"
        />
      </template>
      <template #toolbar-tools>
        <span class="text-muted-foreground mr-3 text-sm">
          有执行中的任务时每 5 秒刷新
        </span>
      </template>
      <template #status="{ row }">
        <Tag :color="taskStatusTags[row.status]?.color">
          {{ taskStatusTags[row.status]?.text ?? row.status }}
        </Tag>
      </template>
      <template #action="{ row }">
        <Button size="small" type="link" @click="taskId = row.id">
          查看输出
        </Button>
      </template>
    </Grid>
    <TaskOutput
      :task-id="taskId"
      @close="taskId = null"
      @finished="gridApi.query()"
    />
  </Page>
</template>
