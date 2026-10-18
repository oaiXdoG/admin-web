<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ProcessTypeRecord, UnmanagedServiceRecord } from '#/api/types';

import { computed, ref, watch } from 'vue';

import { useAccess } from '@vben/access';

import { Alert, Button, Modal, Tag } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';

import { formatReportTime, serviceSummary } from '../format';

/** 未托管服务：在向后台上报、但不是由后台启动的服务，只能查看；「纳入管理」带着类型和服务器去新增进程 */
const props = defineProps<{ list: UnmanagedServiceRecord[]; types: ProcessTypeRecord[] }>();
const emit = defineEmits<{ adopt: [record: UnmanagedServiceRecord] }>();

const { hasAccessByCodes } = useAccess();
const viewing = ref<null | UnmanagedServiceRecord>(null);
const rawJson = computed(() =>
  viewing.value ? JSON.stringify(viewing.value.raw ?? {}, null, 2) : '',
);

function typeLabel(code: string) {
  const type = props.types.find((item) => item.code && item.code === code);
  return type ? `${type.name}（${code}）` : code || '—';
}

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: [
      {
        align: 'left',
        field: 'type',
        formatter: ({ cellValue }) => typeLabel(cellValue),
        minWidth: 140,
        title: '类型',
      },
      { align: 'left', field: 'nodeId', formatter: ({ cellValue }) => cellValue || '—', minWidth: 130, title: '节点 ID' },
      { align: 'left', field: 'instanceId', formatter: ({ cellValue }) => cellValue || '—', minWidth: 180, title: '实例 ID' },
      {
        align: 'left',
        field: 'summary',
        formatter: ({ row }) => serviceSummary(row),
        minWidth: 180,
        title: '服务信息',
      },
      { align: 'left', field: 'innerHost', formatter: ({ cellValue }) => cellValue || '—', minWidth: 130, title: '内网地址' },
      { align: 'left', field: 'serverName', minWidth: 130, slots: { default: 'server' }, title: '服务器' },
      { field: 'online', minWidth: 80, slots: { default: 'online' }, title: '在线' },
      {
        field: 'reportTime',
        formatter: ({ cellValue }) => formatReportTime(cellValue),
        minWidth: 160,
        title: '最近上报',
      },
      { field: 'operation', fixed: 'right', slots: { default: 'action' }, title: '操作', width: 180 },
    ],
    data: [],
    height: 'auto',
    pagerConfig: { enabled: false },
    rowConfig: { isHover: true },
    toolbarConfig: { custom: true, zoom: true },
  } as VxeTableGridOptions<UnmanagedServiceRecord>,
});

watch(
  () => [props.list, props.types] as const,
  () => gridApi.setGridOptions({ data: props.list }),
  { immediate: true },
);
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="mb-2">
      <Alert
        message="这些服务在向后台上报，但不是由后台启动的，只能查看。纳入管理后需要用后台重启一次才会绑定。"
        show-icon
        type="info"
      />
    </div>
    <div class="min-h-0 flex-1">
      <Grid table-title="未托管服务">
        <template #server="{ row }">
          <span v-if="row.serverName">{{ row.serverName }}</span>
          <span v-else class="text-muted-foreground">未匹配</span>
        </template>
        <template #online="{ row }">
          <Tag :color="row.online ? 'success' : 'default'">{{ row.online ? '在线' : '离线' }}</Tag>
        </template>
        <template #action="{ row }">
          <Button size="small" type="link" @click="viewing = row">查看上报</Button>
          <Button
            v-if="hasAccessByCodes(['server_process:create'])"
            size="small"
            type="link"
            @click="emit('adopt', row)"
          >
            纳入管理
          </Button>
        </template>
      </Grid>
    </div>
    <Modal
      :footer="null"
      :open="viewing !== null"
      :title="viewing ? `上报内容：${viewing.nodeId || viewing.instanceId}` : ''"
      :width="640"
      @cancel="viewing = null"
    >
      <pre class="raw-json">{{ rawJson }}</pre>
    </Modal>
  </div>
</template>

<style scoped>
.raw-json {
  max-height: 480px;
  padding: 12px;
  margin: 0;
  overflow: auto;
  font-family: Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
  background: hsl(var(--accent));
  border-radius: 6px;
}
</style>
