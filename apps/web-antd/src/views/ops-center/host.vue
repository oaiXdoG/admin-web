<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { OpsHostRecord, OpsHostWrite } from '#/api/types';

import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Alert,
  Button,
  Dropdown,
  Menu,
  MenuItem,
  message,
  Modal,
  Space,
  Tag,
  Tooltip,
} from 'ant-design-vue';

import { useVbenForm, z } from '#/adapter/form';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  createOpsHostApi,
  getOpsHostsApi,
  initOpsHostApi,
  removeOpsHostApi,
  testOpsHostApi,
  updateOpsHostApi,
} from '#/api';

import TaskOutput from './components/task-output.vue';
import UsageCell from './components/usage-cell.vue';
import { formatBytes, formatDuration, formatTime } from './format';

/** 列表每 10 秒刷新；接口要 SSH 到每台主机采样，上一次没返回时跳过 */
const REFRESH_MS = 10_000;

const { hasAccessByCodes } = useAccess();
const router = useRouter();
/** 监控是页面菜单，不在按钮权限码里，按路由是否存在判断 */
const canMonitor = router.hasRoute('ops_monitor');

const loading = ref(false);
let loadingInBackground = false;
let timer: ReturnType<typeof setInterval> | undefined;

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    cellConfig: { height: 58 },
    columns: [
      {
        align: 'left',
        field: 'ip',
        minWidth: 160,
        slots: { default: 'host' },
        title: '主机',
      },
      {
        field: 'online',
        minWidth: 90,
        slots: { default: 'online' },
        title: '状态',
      },
      {
        align: 'left',
        field: 'cpu',
        minWidth: 170,
        slots: { default: 'cpu' },
        title: 'CPU',
      },
      {
        align: 'left',
        field: 'memory',
        minWidth: 190,
        slots: { default: 'memory' },
        title: '内存',
      },
      {
        align: 'left',
        field: 'disk',
        minWidth: 190,
        slots: { default: 'disk' },
        title: '磁盘',
        titlePrefix: { content: '使用率最高的分区；悬停查看全部分区' },
      },
      {
        align: 'left',
        field: 'network',
        minWidth: 130,
        slots: { default: 'network' },
        title: '网络',
      },
      {
        field: 'uptime',
        formatter: ({ row }) =>
          row.info ? formatDuration(row.info.uptime) : '—',
        minWidth: 110,
        title: '开机时长',
      },
      {
        field: 'apps',
        minWidth: 90,
        slots: { default: 'apps' },
        title: '程序',
        titlePrefix: { content: '运行中 / 绑定的程序数' },
      },
      { align: 'left', field: 'remark', minWidth: 120, title: '备注' },
      {
        field: 'lastSeenAt',
        formatter: ({ cellValue }) => formatTime(cellValue),
        minWidth: 170,
        title: '最近在线',
      },
      {
        field: 'operation',
        fixed: 'right',
        slots: { default: 'action' },
        title: '操作',
        width: 260,
      },
    ],
    data: [],
    height: 'auto',
    pagerConfig: { enabled: false },
    rowConfig: { keyField: 'id' },
    toolbarConfig: { custom: true, zoom: true },
  } as VxeTableGridOptions<OpsHostRecord>,
});

/** 自动刷新时不显示加载遮罩，表格原地更新 */
async function load(showLoading = false) {
  if (showLoading) loading.value = true;
  try {
    const { list } = await getOpsHostsApi();
    gridApi.setGridOptions({ data: list });
  } finally {
    loading.value = false;
  }
}

async function refreshInBackground() {
  if (loadingInBackground || loading.value) return;
  loadingInBackground = true;
  try {
    await load();
  } catch {
    // 自动刷新失败时等下一次
  } finally {
    loadingInBackground = false;
  }
}

onMounted(async () => {
  await load(true);
  timer = setInterval(refreshInBackground, REFRESH_MS);
});
onBeforeUnmount(() => clearInterval(timer));

/** 使用率最高的磁盘 */
function fullestDisk(row: OpsHostRecord) {
  let fullest: NonNullable<OpsHostRecord['info']>['disks'][number] | undefined;
  for (const disk of row.info?.disks ?? []) {
    if (!fullest || disk.used / disk.total > fullest.used / fullest.total) {
      fullest = disk;
    }
  }
  return fullest;
}

function diskDetail(row: OpsHostRecord) {
  const disk = fullestDisk(row);
  if (!disk) return '';
  const prefix = disk.mount === '/' ? '' : `${disk.mount} `;
  return `${prefix}${formatBytes(disk.used)} / ${formatBytes(disk.total)}`;
}

function openMonitor(row: OpsHostRecord) {
  router.push({ path: '/ops/monitor', query: { hostId: String(row.id) } });
}

function openApps(row: OpsHostRecord) {
  router.push({ path: '/ops/app', query: { hostId: String(row.id) } });
}

function hostAddress(row: OpsHostRecord) {
  return row.sshPort && row.sshPort !== 22
    ? `${row.ip}:${row.sshPort}`
    : row.ip;
}

type HostStatus = 'error' | 'offline' | 'online' | 'uninitialized';

function hostStatus(row: OpsHostRecord): HostStatus {
  if (!row.online) return 'offline';
  if (!row.initializedAt) return 'uninitialized';
  return row.error ? 'error' : 'online';
}

const statusTags: Record<HostStatus, { color: string; text: string }> = {
  error: { color: 'error', text: '异常' },
  offline: { color: 'default', text: '连不上' },
  online: { color: 'success', text: '在线' },
  uninitialized: { color: 'warning', text: '未初始化' },
};

function statusTip(row: OpsHostRecord) {
  if (row.error) return row.error;
  if (hostStatus(row) === 'uninitialized') {
    return '还没有初始化（安装 JDK、unzip），请点「初始化」';
  }
  return undefined;
}

// ---------- 添加、编辑 ----------

const editing = ref<null | OpsHostRecord>(null);
const editorOpen = ref(false);
const saving = ref(false);

const [HostForm, formApi] = useVbenForm({
  schema: [
    {
      component: 'Input',
      componentProps: { maxlength: 64, placeholder: '例如 10.0.0.12' },
      fieldName: 'ip',
      label: 'IP',
      rules: z.string().trim().min(1, { message: '请输入 IP' }),
    },
    {
      component: 'InputNumber',
      componentProps: { max: 65_535, min: 1, precision: 0 },
      defaultValue: 22,
      fieldName: 'sshPort',
      label: 'SSH 端口',
      rules: 'required',
    },
    {
      component: 'Input',
      componentProps: { maxlength: 128, placeholder: '例如：机房、用途' },
      fieldName: 'remark',
      label: '备注',
    },
  ],
  showDefaultActions: false,
});

async function openEditor(row: null | OpsHostRecord) {
  editing.value = row;
  editorOpen.value = true;
  await formApi.reset();
  if (row) {
    await formApi.setValues({
      ip: row.ip,
      remark: row.remark,
      sshPort: row.sshPort || 22,
    });
  }
}

async function save() {
  const { valid } = await formApi.validate();
  if (!valid) return;
  const form = await formApi.getValues<OpsHostWrite>();
  saving.value = true;
  try {
    if (editing.value) {
      await updateOpsHostApi(editing.value.id, form);
      message.success('主机已保存');
    } else {
      await createOpsHostApi(form);
      message.success('主机已添加，可以先「测试连接」再「初始化」');
    }
    editorOpen.value = false;
    await load(true);
  } catch {
    // 错误信息已由请求拦截器提示
  } finally {
    saving.value = false;
  }
}

// ---------- 测试连接、初始化 ----------

/** 正在测试连接的主机 */
const testing = ref(new Set<number>());
const taskId = ref<null | number>(null);

async function testConnection(row: OpsHostRecord) {
  testing.value = new Set(testing.value).add(row.id);
  try {
    const result = await testOpsHostApi(row.id);
    message.success(result.message);
  } catch {
    // 错误信息已由请求拦截器提示
  } finally {
    const next = new Set(testing.value);
    next.delete(row.id);
    testing.value = next;
  }
}

function initHost(row: OpsHostRecord) {
  const again = row.initializedAt > 0;
  Modal.confirm({
    cancelText: '取消',
    content: `${again ? '重新初始化' : '初始化'}主机 ${hostAddress(row)}？会通过 SSH 安装 JDK 21、unzip 和监控用的 exporter，可以重复执行。`,
    okText: again ? '重新初始化' : '初始化',
    title: again ? '重新初始化主机' : '初始化主机',
    async onOk() {
      const result = await initOpsHostApi(row.id);
      taskId.value = result.taskId;
    },
  });
}

function onTaskFinished() {
  load().catch(() => undefined);
}

function onMore(row: OpsHostRecord, key: string) {
  if (key === 'monitor') openMonitor(row);
  else if (key === 'edit') openEditor(row);
  else if (key === 'remove') remove(row);
}

function remove(row: OpsHostRecord) {
  Modal.confirm({
    cancelText: '取消',
    content: `删除主机 ${hostAddress(row)}？只删除管理后台里的记录，不会改动机器。`,
    okButtonProps: { danger: true },
    okText: '删除',
    title: '删除主机',
    async onOk() {
      await removeOpsHostApi(row.id);
      message.success('主机已删除');
      await load();
    },
  });
}
</script>

<template>
  <Page auto-content-height>
    <Grid :loading="loading" table-title="主机">
      <template #toolbar-tools>
        <span class="text-muted-foreground mr-3 text-sm">
          通过 SSH 管理，每 10 秒刷新
        </span>
        <Button :loading="loading" class="mr-2" @click="load(true)">
          <template #icon>
            <IconifyIcon class="size-4" icon="lucide:refresh-cw" />
          </template>
          刷新
        </Button>
        <Button
          v-if="hasAccessByCodes(['ops_host:manage'])"
          class="mr-2"
          type="primary"
          @click="openEditor(null)"
        >
          <template #icon>
            <IconifyIcon class="size-4" icon="lucide:plus" />
          </template>
          添加主机
        </Button>
      </template>
      <template #host="{ row }">
        <div class="leading-relaxed">
          <div class="font-medium">{{ hostAddress(row) }}</div>
          <div class="text-muted-foreground truncate text-xs">
            {{ row.hostname || '—' }}
          </div>
        </div>
      </template>
      <template #online="{ row }">
        <Tooltip :title="statusTip(row)">
          <Tag :color="statusTags[hostStatus(row)].color">
            {{ statusTags[hostStatus(row)].text }}
          </Tag>
        </Tooltip>
      </template>
      <template #cpu="{ row }">
        <UsageCell
          :detail="`${row.info?.cpuCores ?? '—'} 核`"
          :ratio="row.info?.cpuUsage"
        />
      </template>
      <template #memory="{ row }">
        <UsageCell
          :detail="
            row.info
              ? `${formatBytes(row.info.memoryUsed)} / ${formatBytes(row.info.memoryTotal)}`
              : ''
          "
          :ratio="
            row.info ? row.info.memoryUsed / row.info.memoryTotal : undefined
          "
        />
      </template>
      <template #disk="{ row }">
        <Tooltip v-if="fullestDisk(row)">
          <template #title>
            <div v-for="disk in row.info?.disks" :key="disk.mount">
              {{ disk.mount }}：{{ formatBytes(disk.used) }} /
              {{ formatBytes(disk.total) }}
            </div>
          </template>
          <div>
            <UsageCell
              :detail="diskDetail(row)"
              :ratio="fullestDisk(row)!.used / fullestDisk(row)!.total"
            />
          </div>
        </Tooltip>
        <span v-else class="text-muted-foreground">—</span>
      </template>
      <template #network="{ row }">
        <div v-if="row.info" class="leading-relaxed">
          <div>
            <span class="text-muted-foreground mr-1 text-xs">收</span>
            {{ formatBytes(row.info.netIn) }}/s
          </div>
          <div>
            <span class="text-muted-foreground mr-1 text-xs">发</span>
            {{ formatBytes(row.info.netOut) }}/s
          </div>
        </div>
        <span v-else class="text-muted-foreground">—</span>
      </template>
      <template #apps="{ row }">
        {{ row.online ? row.runningCount : '—' }} / {{ row.appCount }}
      </template>
      <template #action="{ row }">
        <template v-if="hasAccessByCodes(['ops_host:manage'])">
          <Button
            :loading="testing.has(row.id)"
            size="small"
            type="link"
            @click="testConnection(row)"
          >
            测试连接
          </Button>
          <Button size="small" type="link" @click="initHost(row)">
            {{ row.initializedAt > 0 ? '重新初始化' : '初始化' }}
          </Button>
        </template>
        <Button size="small" type="link" @click="openApps(row)">程序</Button>
        <Dropdown v-if="canMonitor || hasAccessByCodes(['ops_host:manage'])">
          <Button size="small" type="link">
            更多
            <IconifyIcon
              class="ml-1 inline size-3"
              icon="lucide:chevron-down"
            />
          </Button>
          <template #overlay>
            <Menu @click="({ key }) => onMore(row, String(key))">
              <MenuItem v-if="canMonitor" key="monitor" :disabled="!row.online">
                监控
              </MenuItem>
              <MenuItem v-if="hasAccessByCodes(['ops_host:manage'])" key="edit">
                编辑
              </MenuItem>
              <MenuItem
                v-if="hasAccessByCodes(['ops_host:manage'])"
                key="remove"
                :disabled="row.appCount > 0"
                danger
              >
                删除
              </MenuItem>
            </Menu>
          </template>
        </Dropdown>
      </template>
    </Grid>

    <Modal
      v-model:open="editorOpen"
      :title="editing ? `编辑主机：${editing.ip}` : '添加主机'"
      :width="560"
      destroy-on-close
    >
      <div class="mb-4">
        <Alert
          message="管理后台以 root 通过 SSH 登录这台机器，需要先把管理后台的公钥加到它的 /root/.ssh/authorized_keys"
          show-icon
          type="info"
        />
      </div>
      <HostForm />
      <template #footer>
        <Space>
          <Button @click="editorOpen = false">取消</Button>
          <Button :loading="saving" type="primary" @click="save">保存</Button>
        </Space>
      </template>
    </Modal>

    <TaskOutput
      :task-id="taskId"
      @close="taskId = null"
      @finished="onTaskFinished"
    />
  </Page>
</template>
