<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  OpsAppAction,
  OpsAppLogFile,
  OpsAppRecord,
  OpsAppWrite,
  OpsHostOption,
  OpsTaskStatus,
} from '#/api/types';

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Alert,
  Button,
  Checkbox,
  Drawer,
  Dropdown,
  Empty,
  List,
  ListItem,
  Menu,
  MenuItem,
  message,
  Modal,
  Progress,
  Select,
  Space,
  Switch,
  Tag,
  Textarea,
  Tooltip,
  UploadDragger,
} from 'ant-design-vue';

import { useVbenForm, z } from '#/adapter/form';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  controlOpsAppApi,
  createOpsAppApi,
  deployOpsAppApi,
  getOpsAppBackupsApi,
  getOpsAppConfigApi,
  getOpsAppConfigFilesApi,
  getOpsAppLogApi,
  getOpsAppsApi,
  getOpsHostOptionsApi,
  removeOpsAppApi,
  rollbackOpsAppApi,
  saveOpsAppConfigApi,
  updateOpsAppApi,
} from '#/api';

import TaskOutput from './components/task-output.vue';
import { formatBytes, formatDuration, formatTime, percent } from './format';

const { hasAccessByCodes } = useAccess();
const route = useRoute();
const router = useRouter();
/** 监控是页面菜单，不在按钮权限码里，按路由是否存在判断 */
const canMonitor = router.hasRoute('ops_monitor');

const hosts = ref<OpsHostOption[]>([]);
/** 为空表示全部主机 */
const hostId = ref<number | undefined>(
  route.query.hostId ? Number(route.query.hostId) : undefined,
);
/** 正在提交启停任务的程序，按钮显示加载中 */
const submitting = ref(new Set<number>());

const hostOptions = computed(() =>
  hosts.value.map((host) => ({
    label: `${host.ip}${host.hostname ? `（${host.hostname}）` : ''}${host.remark ? ` ${host.remark}` : ''}${host.online ? '' : ' [连不上]'}`,
    value: host.id,
  })),
);

onMounted(async () => {
  const { list } = await getOpsHostOptionsApi();
  hosts.value = list;
});

watch(hostId, () => gridApi.query());

// ---------- 列表 ----------

type Status =
  | 'activating'
  | 'deactivating'
  | 'deployless'
  | 'error'
  | 'failed'
  | 'offline'
  | 'running'
  | 'stopped'
  | 'unknown'
  | 'unmanaged';

/** 按 systemd 的 ActiveState 显示；不是 systemd 启动的进程显示为未托管 */
function status(row: OpsAppRecord): Status {
  if (!row.hostOnline) return 'offline';
  if (row.error || !row.state || row.state.error) return 'error';
  const state = row.state;
  if (state.unmanaged) return 'unmanaged';
  switch (state.status) {
    case 'activating': {
      return 'activating';
    }
    case 'active': {
      return 'running';
    }
    case 'deactivating': {
      return 'deactivating';
    }
    case 'failed': {
      return 'failed';
    }
    case 'inactive':
    case 'not-found': {
      return state.deployed ? 'stopped' : 'deployless';
    }
    default: {
      return 'unknown';
    }
  }
}

const statusTags: Record<Status, { color?: string; text: string }> = {
  activating: { color: 'processing', text: '启动中' },
  deactivating: { color: 'processing', text: '停止中' },
  deployless: { text: '未发布' },
  error: { color: 'error', text: '异常' },
  failed: { color: 'error', text: '失败' },
  offline: { color: 'default', text: '主机连不上' },
  running: { color: 'success', text: '运行中' },
  stopped: { color: 'warning', text: '已停止' },
  unknown: { text: '未知' },
  unmanaged: { color: 'success', text: '运行中（未托管）' },
};

function statusTip(row: OpsAppRecord) {
  const value = status(row);
  if (value === 'unmanaged') {
    return '不是由 systemd 启动的进程，下次启动或发布时会被接管';
  }
  if (value === 'unknown') return `systemd 状态：${row.state?.status}`;
  return row.error || row.state?.error || undefined;
}

/** 有任务在执行（或正在提交）时禁用会改动程序的操作 */
function rowBusy(row: OpsAppRecord) {
  return row.busy || submitting.value.has(row.id);
}

function isRunning(row: OpsAppRecord) {
  const value = status(row);
  return value === 'running' || value === 'unmanaged';
}

/** 启动中（包括崩溃后等待自动拉起）也可以停止 */
function canStop(row: OpsAppRecord) {
  return isRunning(row) || status(row) === 'activating';
}

function canStart(row: OpsAppRecord) {
  const value = status(row);
  return value === 'stopped' || value === 'failed';
}

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: [
      { align: 'left', field: 'name', title: '名称', minWidth: 140 },
      {
        align: 'left',
        field: 'host',
        slots: { default: 'host' },
        title: '主机',
        minWidth: 160,
      },
      { align: 'left', field: 'dir', minWidth: 200, title: '目录' },
      {
        field: 'status',
        slots: { default: 'status' },
        title: '状态',
        minWidth: 140,
      },
      {
        field: 'pid',
        formatter: ({ row }) => (row.state?.running ? row.state.pid : '—'),
        title: 'PID',
        minWidth: 80,
      },
      {
        field: 'uptime',
        formatter: ({ row }) =>
          row.state?.running
            ? formatDuration((Date.now() - row.state.startTime) / 1000)
            : '—',
        title: '运行时长',
        minWidth: 110,
      },
      {
        field: 'memory',
        formatter: ({ row }) =>
          row.state?.running ? formatBytes(row.state.memory) : '—',
        title: '内存',
        minWidth: 90,
      },
      {
        field: 'cpu',
        formatter: ({ row }) =>
          row.state?.running ? `${percent(row.state.cpuUsage)}%` : '—',
        title: 'CPU',
        minWidth: 70,
      },
      {
        field: 'deployedAt',
        formatter: ({ cellValue }) => formatTime(cellValue),
        title: '最近发布',
        minWidth: 170,
      },
      { align: 'left', field: 'remark', minWidth: 120, title: '备注' },
      {
        field: 'operation',
        fixed: 'right',
        slots: { default: 'action' },
        title: '操作',
        width: 250,
      },
    ],
    height: 'auto',
    pagerConfig: { enabled: false },
    proxyConfig: {
      ajax: {
        query: async () => {
          const { list } = await getOpsAppsApi(hostId.value);
          return { items: list, total: list.length };
        },
      },
    },
    cellConfig: { height: 58 },
    rowConfig: { keyField: 'id' },
    toolbarConfig: { custom: true, refresh: true, zoom: true },
  } as VxeTableGridOptions<OpsAppRecord>,
});

const actionNames: Record<OpsAppAction, string> = {
  restart: '重启',
  start: '启动',
  stop: '停止',
};

// ---------- 运维任务输出 ----------

const taskId = ref<null | number>(null);

/** 打开任务输出，并刷新列表让这一行显示「任务执行中」 */
function showTask(id: number) {
  taskId.value = id;
  gridApi.query();
}

function onTaskFinished(taskStatus: OpsTaskStatus) {
  gridApi.query();
  if (taskStatus === 'success') reloadConfigAfterTask();
}

function control(row: OpsAppRecord, action: OpsAppAction) {
  const run = async () => {
    submitting.value = new Set(submitting.value).add(row.id);
    try {
      const result = await controlOpsAppApi(row.id, action);
      showTask(result.taskId);
    } catch {
      // 错误信息已由请求拦截器提示
    } finally {
      const next = new Set(submitting.value);
      next.delete(row.id);
      submitting.value = next;
    }
  };
  if (action === 'start') {
    run();
    return;
  }
  Modal.confirm({
    cancelText: '取消',
    content: `${actionNames[action]}「${row.name}」（${row.hostIp} ${row.dir}）？`,
    okButtonProps: { danger: action === 'stop' },
    okText: actionNames[action],
    title: `${actionNames[action]}程序`,
    onOk: run,
  });
}

function remove(row: OpsAppRecord) {
  Modal.confirm({
    cancelText: '取消',
    content: `删除程序「${row.name}」的配置？机器上的目录和文件不会删除。`,
    okButtonProps: { danger: true },
    okText: '删除',
    title: '删除程序',
    async onOk() {
      await removeOpsAppApi(row.id);
      message.success('程序已删除');
      await gridApi.query();
    },
  });
}

function onMore(row: OpsAppRecord, key: string) {
  if (key === 'config') openConfig(row);
  else if (key === 'edit') openEditor(row);
  else if (key === 'restart') control(row, 'restart');
  else if (key === 'rollback') openRollback(row);
  else if (key === 'remove') remove(row);
  else if (key === 'monitor') {
    router.push({
      path: '/ops/monitor',
      query: { appId: String(row.id), hostId: String(row.hostId) },
    });
  }
}

// ---------- 新增、编辑 ----------

const editing = ref<null | OpsAppRecord>(null);
const editorOpen = ref(false);
const saving = ref(false);

const [AppForm, formApi] = useVbenForm({
  schema: [
    {
      component: 'Input',
      componentProps: { maxlength: 64, placeholder: '例如 log、logic-1' },
      fieldName: 'name',
      help: '也是 systemd 服务名 danmu-<名称>',
      label: '名称',
      rules: z
        .string()
        .trim()
        .regex(/^[\w.-]{1,64}$/, { message: '只能包含字母、数字、_ . -' }),
    },
    {
      component: 'Select',
      componentProps: () => ({
        options: hostOptions.value,
        placeholder: '选择主机',
      }),
      fieldName: 'hostId',
      label: '主机',
      rules: 'selectRequired',
    },
    {
      component: 'Input',
      componentProps: {
        maxlength: 256,
        placeholder: '服务器上的绝对路径，例如 /opt/danmu/log',
      },
      fieldName: 'dir',
      label: '目录',
      rules: z
        .string()
        .trim()
        .regex(/^\/\S+$/, { message: '请输入绝对路径' }),
    },
    {
      component: 'Input',
      componentProps: { maxlength: 128, placeholder: '可空' },
      fieldName: 'remark',
      label: '备注',
    },
  ],
  showDefaultActions: false,
});

async function openEditor(record: null | OpsAppRecord) {
  editing.value = record;
  editorOpen.value = true;
  await formApi.reset();
  await formApi.setValues(
    record
      ? {
          dir: record.dir,
          hostId: record.hostId,
          name: record.name,
          remark: record.remark,
        }
      : { hostId: hostId.value },
  );
}

async function save() {
  const { valid } = await formApi.validate();
  if (!valid) return;
  const form = await formApi.getValues<OpsAppWrite>();
  saving.value = true;
  try {
    await (editing.value
      ? updateOpsAppApi(editing.value.id, form)
      : createOpsAppApi(form));
    message.success('程序已保存');
    editorOpen.value = false;
    await gridApi.query();
  } catch {
    // 错误信息已由请求拦截器提示
  } finally {
    saving.value = false;
  }
}

// ---------- 日志 ----------

const logApp = ref<null | OpsAppRecord>(null);
const logLines = ref(200);
const logFile = ref<OpsAppLogFile>('server.log');
const logContent = ref('');
const logLoading = ref(false);
const logFollow = ref(true);
const logRef = ref<HTMLElement>();
let logTimer: ReturnType<typeof setInterval> | undefined;

async function loadLog() {
  if (!logApp.value) return;
  logLoading.value = true;
  try {
    const { content } = await getOpsAppLogApi(
      logApp.value.id,
      logLines.value,
      logFile.value,
    );
    logContent.value = content;
    if (logFollow.value) {
      requestAnimationFrame(() => {
        if (logRef.value) logRef.value.scrollTop = logRef.value.scrollHeight;
      });
    }
  } catch {
    stopLogTimer();
  } finally {
    logLoading.value = false;
  }
}

function stopLogTimer() {
  if (logTimer) clearInterval(logTimer);
  logTimer = undefined;
}

function openLog(row: OpsAppRecord) {
  logApp.value = row;
  logContent.value = '';
  loadLog();
  stopLogTimer();
  if (logFollow.value) logTimer = setInterval(loadLog, 3000);
}

watch(logFollow, (follow) => {
  stopLogTimer();
  if (follow && logApp.value) logTimer = setInterval(loadLog, 3000);
});

function closeLog() {
  stopLogTimer();
  logApp.value = null;
}

onBeforeUnmount(stopLogTimer);

// ---------- 配置文件 ----------

const configApp = ref<null | OpsAppRecord>(null);
const configFiles = ref<string[]>([]);
const configFile = ref<string>();
const configContent = ref('');
const configOriginal = ref('');
const configLoading = ref(false);
const configSaving = ref(false);
/** 保存任务提交后记下文件，任务成功时重新读取 */
let configTask: undefined | { appId: number; file: string; taskId: number };
const configDirty = computed(
  () => configContent.value !== configOriginal.value,
);

async function openConfig(row: OpsAppRecord) {
  configApp.value = row;
  configFiles.value = [];
  configFile.value = undefined;
  configContent.value = '';
  configOriginal.value = '';
  configLoading.value = true;
  try {
    const { files } = await getOpsAppConfigFilesApi(row.id);
    configFiles.value = files;
    const first =
      configFiles.value.find((file) => file === 'application.properties') ??
      configFiles.value[0];
    if (first) await selectConfig(first);
  } catch {
    configApp.value = null;
  } finally {
    configLoading.value = false;
  }
}

async function selectConfig(file: string) {
  if (!configApp.value) return;
  if (configDirty.value) {
    const ok = await new Promise<boolean>((resolve) =>
      Modal.confirm({
        cancelText: '继续编辑',
        content: `「${configFile.value}」的修改还没有保存，放弃修改？`,
        okText: '放弃',
        onCancel: () => resolve(false),
        onOk: () => resolve(true),
        title: '未保存的修改',
      }),
    );
    if (!ok) return;
  }
  configLoading.value = true;
  try {
    const { content } = await getOpsAppConfigApi(configApp.value.id, file);
    configFile.value = file;
    configContent.value = content;
    configOriginal.value = content;
  } catch {
    // 错误信息已由请求拦截器提示
  } finally {
    configLoading.value = false;
  }
}

async function saveConfig(restart: boolean) {
  if (!configApp.value || !configFile.value) return;
  configSaving.value = true;
  try {
    const result = await saveOpsAppConfigApi(
      configApp.value.id,
      configFile.value,
      configContent.value,
      restart,
    );
    configTask = {
      appId: configApp.value.id,
      file: configFile.value,
      taskId: result.taskId,
    };
    // 保存在后台执行，先当作已保存；失败时内容还在编辑框里，可以再保存
    configOriginal.value = configContent.value;
    showTask(result.taskId);
  } catch {
    // 错误信息已由请求拦截器提示
  } finally {
    configSaving.value = false;
  }
}

/** 保存任务成功后重新读取文件；编辑框里又有新修改时不覆盖 */
async function reloadConfigAfterTask() {
  const task = configTask;
  if (!task || task.taskId !== taskId.value) return;
  configTask = undefined;
  if (
    configApp.value?.id !== task.appId ||
    configFile.value !== task.file ||
    configDirty.value
  ) {
    return;
  }
  try {
    const { content } = await getOpsAppConfigApi(task.appId, task.file);
    if (
      configApp.value?.id === task.appId &&
      configFile.value === task.file &&
      !configDirty.value
    ) {
      configContent.value = content;
      configOriginal.value = content;
    }
  } catch {
    // 错误信息已由请求拦截器提示
  }
}

// ---------- 发布 ----------

const deployApp = ref<null | OpsAppRecord>(null);
const deployFile = ref<File>();
const overwriteConf = ref(false);
const deploying = ref(false);
const deployProgress = ref(0);

function openDeploy(row: OpsAppRecord) {
  deployApp.value = row;
  deployFile.value = undefined;
  overwriteConf.value = false;
  deployProgress.value = 0;
}

function pickFile(file: File) {
  if (!file.name.toLowerCase().endsWith('.zip')) {
    message.warning('请选择 zip 文件');
    return false;
  }
  deployFile.value = file;
  return false;
}

async function deploy() {
  if (!deployApp.value || !deployFile.value) return;
  deploying.value = true;
  deployProgress.value = 0;
  try {
    const result = await deployOpsAppApi(
      deployApp.value.id,
      deployFile.value,
      overwriteConf.value,
      (progress) => (deployProgress.value = percent(progress)),
    );
    deployApp.value = null;
    showTask(result.taskId);
  } catch {
    // 错误信息已由请求拦截器提示
  } finally {
    deploying.value = false;
  }
}

// ---------- 回滚 ----------

const rollbackApp = ref<null | OpsAppRecord>(null);
const backups = ref<string[]>([]);
const backupsLoading = ref(false);

async function openRollback(row: OpsAppRecord) {
  rollbackApp.value = row;
  backups.value = [];
  backupsLoading.value = true;
  try {
    const { list } = await getOpsAppBackupsApi(row.id);
    if (rollbackApp.value?.id === row.id) backups.value = list;
  } catch {
    rollbackApp.value = null;
  } finally {
    backupsLoading.value = false;
  }
}

/** 20261106-074714 → 2026-11-06 07:47:14，不是这个格式时原样显示 */
function backupTime(name: string) {
  const match = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/.exec(name);
  if (!match) return name;
  const [, y, mo, d, h, mi, se] = match;
  return `${y}-${mo}-${d} ${h}:${mi}:${se}`;
}

function rollback(backup: string) {
  const app = rollbackApp.value;
  if (!app) return;
  Modal.confirm({
    cancelText: '取消',
    content: `把「${app.name}」（${app.hostIp} ${app.dir}）回滚到 ${backupTime(backup)} 备份的版本？`,
    okText: '回滚',
    title: '回滚程序',
    async onOk() {
      const result = await rollbackOpsAppApi(app.id, backup);
      rollbackApp.value = null;
      showTask(result.taskId);
    },
  });
}
</script>

<template>
  <Page auto-content-height>
    <Grid table-title="程序">
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
        <Button
          v-if="hasAccessByCodes(['ops_app:manage'])"
          type="primary"
          @click="openEditor(null)"
        >
          <template #icon>
            <IconifyIcon class="size-4" icon="lucide:plus" />
          </template>
          新增程序
        </Button>
      </template>
      <template #host="{ row }">
        <div>{{ row.hostIp }}</div>
        <div v-if="row.hostname" class="text-muted-foreground text-xs">
          {{ row.hostname }}
        </div>
      </template>
      <template #status="{ row }">
        <div class="leading-relaxed">
          <div>
            <Tooltip :title="statusTip(row)">
              <Tag :color="statusTags[status(row)].color">
                {{ statusTags[status(row)].text }}
              </Tag>
            </Tooltip>
            <Tag v-if="row.busy" color="processing">任务执行中</Tag>
          </div>
          <div
            v-if="row.hostOnline && (row.state?.restarts ?? 0) > 0"
            class="text-warning text-xs"
          >
            systemd 自动拉起 {{ row.state?.restarts }} 次
          </div>
        </div>
      </template>
      <template #action="{ row }">
        <template v-if="hasAccessByCodes(['ops_app:control'])">
          <Button
            v-if="canStop(row)"
            :disabled="row.busy"
            :loading="submitting.has(row.id)"
            danger
            size="small"
            type="link"
            @click="control(row, 'stop')"
          >
            停止
          </Button>
          <Button
            v-else
            :disabled="!canStart(row) || row.busy"
            :loading="submitting.has(row.id)"
            size="small"
            type="link"
            @click="control(row, 'start')"
          >
            启动
          </Button>
        </template>
        <Button
          :disabled="!row.hostOnline"
          size="small"
          type="link"
          @click="openLog(row)"
        >
          日志
        </Button>
        <Button
          v-if="hasAccessByCodes(['ops_app:deploy'])"
          :disabled="!row.hostOnline || rowBusy(row)"
          size="small"
          type="link"
          @click="openDeploy(row)"
        >
          发布
        </Button>
        <Dropdown>
          <Button size="small" type="link">
            更多
            <IconifyIcon
              class="ml-1 inline size-3"
              icon="lucide:chevron-down"
            />
          </Button>
          <template #overlay>
            <Menu @click="({ key }) => onMore(row, String(key))">
              <MenuItem
                v-if="hasAccessByCodes(['ops_app:control'])"
                key="restart"
                :disabled="!isRunning(row) || rowBusy(row)"
              >
                重启
              </MenuItem>
              <MenuItem
                v-if="hasAccessByCodes(['ops_app:deploy'])"
                key="rollback"
                :disabled="!row.hostOnline || rowBusy(row)"
              >
                回滚
              </MenuItem>
              <MenuItem
                v-if="canMonitor"
                key="monitor"
                :disabled="!row.hostOnline"
              >
                监控
              </MenuItem>
              <MenuItem
                v-if="hasAccessByCodes(['ops_app:config'])"
                key="config"
                :disabled="!row.hostOnline || rowBusy(row)"
              >
                配置文件
              </MenuItem>
              <MenuItem
                v-if="hasAccessByCodes(['ops_app:manage'])"
                key="edit"
                :disabled="rowBusy(row)"
              >
                编辑
              </MenuItem>
              <MenuItem
                v-if="hasAccessByCodes(['ops_app:manage'])"
                key="remove"
                :disabled="isRunning(row) || rowBusy(row)"
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
      :title="editing ? '编辑程序' : '新增程序'"
      :width="620"
      destroy-on-close
    >
      <div class="mb-4">
        <Alert
          message="程序目录里放 mvn package 的产物（bin、conf、lib、excel），可以先登记再用「发布」上传。程序作为 systemd 服务 danmu-<名称> 运行，执行 <目录>/bin/start.sh --foreground。JVM 参数在程序的 conf/jvm.options，用「配置文件」修改。运行中不能修改主机和目录。"
          show-icon
          type="info"
        />
      </div>
      <AppForm />
      <template #footer>
        <Space>
          <Button @click="editorOpen = false">取消</Button>
          <Button :loading="saving" type="primary" @click="save">保存</Button>
        </Space>
      </template>
    </Modal>

    <Drawer
      :open="!!logApp"
      :title="`日志：${logApp?.name ?? ''}（${logApp?.hostIp ?? ''} ${logApp?.dir ?? ''}/logs/${logFile}）`"
      width="70%"
      @close="closeLog"
    >
      <template #extra>
        <Space>
          <Select
            v-model:value="logFile"
            :options="[
              { label: 'server.log（全部）', value: 'server.log' },
              { label: 'error.log（错误）', value: 'error.log' },
            ]"
            class="w-40"
            @change="loadLog"
          />
          <Select
            v-model:value="logLines"
            :options="
              [200, 500, 1000, 2000].map((value) => ({
                label: `最后 ${value} 行`,
                value,
              }))
            "
            class="w-32"
            @change="loadLog"
          />
          <span class="text-sm">自动刷新</span>
          <Switch v-model:checked="logFollow" size="small" />
          <Button :loading="logLoading" @click="loadLog">刷新</Button>
        </Space>
      </template>
      <pre
        ref="logRef"
        class="bg-muted m-0 h-full overflow-auto whitespace-pre-wrap break-all rounded p-3 font-mono text-xs leading-5"
        >{{ logContent || '（暂无日志）' }}</pre>
    </Drawer>

    <Modal
      :open="!!configApp"
      :title="`配置文件：${configApp?.name ?? ''}（${configApp?.dir ?? ''}/conf）`"
      :width="1000"
      destroy-on-close
      @cancel="configApp = null"
    >
      <div v-if="configFiles.length === 0 && !configLoading" class="py-8">
        <Empty description="conf 目录下没有文件，请先发布程序" />
      </div>
      <div v-else class="flex h-[60vh] gap-3">
        <div class="w-56 shrink-0 overflow-auto">
          <Menu
            :selected-keys="configFile ? [configFile] : []"
            mode="inline"
            @click="({ key }) => selectConfig(String(key))"
          >
            <MenuItem v-for="file in configFiles" :key="file">
              {{ file }}
            </MenuItem>
          </Menu>
        </div>
        <div class="min-w-0 flex-1">
          <Textarea
            v-model:value="configContent"
            :disabled="configLoading"
            :spellcheck="false"
            class="font-mono text-xs"
            style="height: 100%; resize: none"
          />
        </div>
      </div>
      <template #footer>
        <Space>
          <span v-if="configDirty" class="text-warning text-sm">有未保存的修改</span>
          <span class="text-muted-foreground text-sm">重启程序后生效</span>
          <Button @click="configApp = null">关闭</Button>
          <Button
            :disabled="!configFile || !configDirty"
            :loading="configSaving"
            @click="saveConfig(false)"
          >
            保存
          </Button>
          <Button
            v-if="hasAccessByCodes(['ops_app:control'])"
            :disabled="!configFile || !configDirty"
            :loading="configSaving"
            type="primary"
            @click="saveConfig(true)"
          >
            保存并重启
          </Button>
        </Space>
      </template>
    </Modal>

    <Modal
      :closable="!deploying"
      :mask-closable="false"
      :open="!!deployApp"
      :title="`发布：${deployApp?.name ?? ''}（${deployApp?.hostIp ?? ''} ${deployApp?.dir ?? ''}）`"
      :width="620"
      @cancel="deploying || (deployApp = null)"
    >
      <Alert
        class="mb-4"
        message="上传 mvn package 产物目录（bin、conf、lib、excel）打成的 zip。旧的 bin、lib、excel 移入 backup，可以用「回滚」恢复；程序在运行时会先停止，发布后重新启动。不是由 systemd 启动的旧进程会被接管。"
        show-icon
        type="info"
      />
      <UploadDragger
        :before-upload="pickFile"
        :disabled="deploying"
        :max-count="1"
        :show-upload-list="false"
        accept=".zip"
      >
        <p class="py-4">
          <IconifyIcon class="mx-auto mb-2 size-8" icon="lucide:file-archive" />
          <span v-if="deployFile">
            {{ deployFile.name }}（{{ formatBytes(deployFile.size) }}）
          </span>
          <span v-else>点击或拖入 zip 文件</span>
        </p>
      </UploadDragger>
      <Checkbox
        v-model:checked="overwriteConf"
        :disabled="deploying"
        class="mt-4"
      >
        覆盖配置：用包里的 conf 替换机器上的
        conf（不勾选时保留机器上的，目录里还没有 conf 时总是使用包里的）
      </Checkbox>
      <Progress
        v-if="deploying"
        :percent="deployProgress"
        :status="deployProgress >= 100 ? 'active' : 'normal'"
        class="mt-4"
      />
      <div
        v-if="deploying && deployProgress >= 100"
        class="text-muted-foreground text-sm"
      >
        上传完成，正在提交发布任务…
      </div>
      <template #footer>
        <Space>
          <Button :disabled="deploying" @click="deployApp = null">取消</Button>
          <Button
            :disabled="!deployFile"
            :loading="deploying"
            type="primary"
            @click="deploy"
          >
            发布
          </Button>
        </Space>
      </template>
    </Modal>

    <Modal
      :footer="null"
      :open="!!rollbackApp"
      :title="`回滚：${rollbackApp?.name ?? ''}（${rollbackApp?.hostIp ?? ''} ${rollbackApp?.dir ?? ''}）`"
      :width="620"
      @cancel="rollbackApp = null"
    >
      <Alert
        class="mb-4"
        message="当前版本会先备份，回滚后也能再回滚回来；程序原来在运行的会自动重启"
        show-icon
        type="info"
      />
      <List
        :data-source="backups"
        :loading="backupsLoading"
        :locale="{ emptyText: '还没有可以回滚的版本' }"
        bordered
        size="small"
      >
        <template #renderItem="{ item }">
          <ListItem>
            <span class="font-mono">{{ backupTime(item) }}</span>
            <template #actions>
              <Button size="small" type="link" @click="rollback(item)">
                回滚到此版本
              </Button>
            </template>
          </ListItem>
        </template>
      </List>
    </Modal>

    <TaskOutput
      :task-id="taskId"
      @close="taskId = null"
      @finished="onTaskFinished"
    />
  </Page>
</template>
