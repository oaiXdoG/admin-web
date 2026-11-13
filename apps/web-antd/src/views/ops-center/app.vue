<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  OpsAppAction,
  OpsAppRecord,
  OpsAppWrite,
} from '#/api/types';

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Alert,
  Button,
  Checkbox,
  message,
  Modal,
  Progress,
  Select,
  Space,
  Tag,
  Tooltip,
  UploadDragger,
} from 'ant-design-vue';

import { useVbenForm, z } from '#/adapter/form';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  controlOpsAppApi,
  createOpsAppApi,
  deployOpsAppApi,
  getOpsAppsApi,
  removeOpsAppApi,
  updateOpsAppApi,
} from '#/api';

import TaskOutput from './components/task-output.vue';
import { formatBytes, formatDuration, formatTime, percent } from './format';

/** 列表每 5 秒在后台刷新 */
const REFRESH_MS = 5000;

const { hasAccessByCodes } = useAccess();

/** 所有程序用到的 IP，每次读取列表时更新 */
const ips = ref<string[]>([]);
/** 为空表示全部 IP */
const ip = ref<string>();
/** 正在提交启停任务的程序，按钮显示加载中 */
const submitting = ref(new Set<number>());

const ipOptions = computed(() =>
  ips.value.map((value) => ({ label: value, value })),
);

let refreshing = false;
let timer: ReturnType<typeof setInterval> | undefined;

/** 表格原地更新、不显示加载遮罩；上一次没返回、页面在后台时跳过 */
async function refreshInBackground() {
  if (refreshing || document.hidden) return;
  refreshing = true;
  const current = ip.value;
  try {
    const result = await getOpsAppsApi(current);
    // 等待期间切换了 IP 时丢掉这次结果
    if (current === ip.value) {
      ips.value = result.ips;
      await gridApi.grid.loadData(result.list);
    }
  } catch {
    // 失败时等下一次
  } finally {
    refreshing = false;
  }
}

/** 切回这个标签页时立刻刷新一次 */
function onVisibilityChange() {
  if (!document.hidden) refreshInBackground();
}

onMounted(() => {
  timer = setInterval(refreshInBackground, REFRESH_MS);
  document.addEventListener('visibilitychange', onVisibilityChange);
});

onBeforeUnmount(() => {
  clearInterval(timer);
  document.removeEventListener('visibilitychange', onVisibilityChange);
});

watch(ip, () => gridApi.query());

// ---------- 列表 ----------

/** 端口不是 22 时带上端口 */
function address(row: OpsAppRecord) {
  return row.sshPort && row.sshPort !== 22 ? `${row.ip}:${row.sshPort}` : row.ip;
}

function isRunning(row: OpsAppRecord) {
  return !!row.state?.running;
}

function canStart(row: OpsAppRecord) {
  return row.hostOnline && row.state?.status === 'stopped';
}

/** 有任务在执行（或正在提交）时禁用会改动程序的操作 */
function rowBusy(row: OpsAppRecord) {
  return row.busy || submitting.value.has(row.id);
}

/** 没有运行时，最近启动时间悬停显示原因 */
/** 状态列：运行中、已关闭、未发布、连不上；有操作在执行时显示执行中 */
function statusTag(row: OpsAppRecord) {
  if (row.busy) return { color: 'processing', text: '执行中' };
  if (!row.hostOnline) return { color: 'warning', text: '连不上' };
  switch (row.state?.status) {
    case 'not-deployed': {
      return { color: 'default', text: '未发布' };
    }
    case 'running': {
      return { color: 'success', text: '运行中' };
    }
    default: {
      return { color: 'default', text: '已关闭' };
    }
  }
}

function stateTip(row: OpsAppRecord) {
  if (!row.hostOnline) return row.error || '连不上这台机器';
  if (row.error || row.state?.error) return row.error || row.state?.error;
  if (row.state?.status === 'not-deployed') return '还没有发布';
  return '已关闭';
}

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: [
      { align: 'left', field: 'name', minWidth: 140, title: '进程名称' },
      {
        align: 'left',
        field: 'ip',
        formatter: ({ row }) => address(row),
        minWidth: 150,
        title: 'IP',
      },
      { align: 'left', field: 'dir', minWidth: 200, title: '目录' },
      { field: 'status', slots: { default: 'status' }, title: '状态', width: 100 },
      {
        field: 'startTime',
        minWidth: 170,
        slots: { default: 'startTime' },
        title: '最近启动时间',
      },
      {
        field: 'uptime',
        formatter: ({ row }) =>
          row.state?.running
            ? formatDuration((Date.now() - row.state.startTime) / 1000)
            : '—',
        minWidth: 110,
        title: '运行时长',
      },
      {
        field: 'operation',
        fixed: 'right',
        resizable: false,
        slots: { default: 'action' },
        title: '操作',
        width: 330,
      },
    ],
    height: 'auto',
    pagerConfig: { enabled: false },
    proxyConfig: {
      ajax: {
        query: async () => {
          const result = await getOpsAppsApi(ip.value);
          ips.value = result.ips;
          return { items: result.list, total: result.list.length };
        },
      },
    },
    rowConfig: { keyField: 'id' },
    toolbarConfig: { custom: true, refresh: true, zoom: true },
  } as VxeTableGridOptions<OpsAppRecord>,
});

const actionNames: Record<OpsAppAction, string> = {
  restart: '重启',
  start: '启动',
  stop: '关闭',
};

// ---------- 执行输出 ----------

const taskId = ref<null | number>(null);

/** 打开这次操作的输出，并刷新列表 */
function showTask(id: number) {
  taskId.value = id;
  gridApi.query();
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
    content: `${actionNames[action]}「${row.name}」（${address(row)} ${row.dir}）？`,
    okButtonProps: { danger: action === 'stop' },
    okText: actionNames[action],
    title: `${actionNames[action]}程序`,
    onOk: run,
  });
}

// ---------- 新增、编辑、删除 ----------

/** 为空表示新增 */
const editing = ref<null | OpsAppRecord>(null);
const editorOpen = ref(false);
const saving = ref(false);

const [AppForm, formApi] = useVbenForm({
  schema: [
    {
      component: 'Input',
      componentProps: { maxlength: 64, placeholder: '例如 log、logic-1' },
      fieldName: 'name',
      label: '名称',
      rules: z
        .string()
        .trim()
        .regex(/^[\w.-]{1,64}$/, { message: '只能包含字母、数字、_ . -' }),
    },
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

async function openEditor(row: null | OpsAppRecord) {
  editing.value = row;
  editorOpen.value = true;
  await formApi.reset();
  await formApi.setValues(
    row
      ? {
          dir: row.dir,
          ip: row.ip,
          name: row.name,
          remark: row.remark,
          sshPort: row.sshPort || 22,
        }
      : { ip: ip.value },
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

function remove(row: OpsAppRecord) {
  Modal.confirm({
    cancelText: '取消',
    content: `删除「${row.name}」（${address(row)} ${row.dir}）？只删除管理后台里的记录，不会停止进程，也不会删除服务器上的文件。`,
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

/** 删除按钮不可点时的原因 */
function removeTip(row: OpsAppRecord) {
  if (rowBusy(row)) return '有操作正在执行';
  if (isRunning(row)) return '运行中，请先关闭';
  if (!row.hostOnline) return '连不上这台机器，无法确认是否已关闭';
  return undefined;
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
</script>

<template>
  <Page auto-content-height>
    <Grid table-title="程序">
      <template #toolbar-actions>
        <Select
          v-model:value="ip"
          :options="ipOptions"
          allow-clear
          class="ml-4 w-56"
          placeholder="全部 IP"
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
      <template #status="{ row }">
        <Tooltip :title="row.hostOnline ? undefined : row.error">
          <Tag :color="statusTag(row).color">{{ statusTag(row).text }}</Tag>
        </Tooltip>
      </template>
      <template #startTime="{ row }">
        <span v-if="row.state?.running">
          {{ formatTime(row.state.startTime) }}
        </span>
        <Tooltip v-else :title="stateTip(row)">
          <span class="text-muted-foreground">—</span>
        </Tooltip>
      </template>
      <template #action="{ row }">
        <template v-if="hasAccessByCodes(['ops_app:control'])">
          <Button
            :disabled="!canStart(row) || rowBusy(row)"
            :loading="submitting.has(row.id)"
            size="small"
            type="link"
            @click="control(row, 'start')"
          >
            启动
          </Button>
          <Button
            :disabled="!isRunning(row) || rowBusy(row)"
            danger
            size="small"
            type="link"
            @click="control(row, 'stop')"
          >
            关闭
          </Button>
          <Button
            :disabled="!isRunning(row) || rowBusy(row)"
            size="small"
            type="link"
            @click="control(row, 'restart')"
          >
            重启
          </Button>
        </template>
        <Button
          v-if="hasAccessByCodes(['ops_app:deploy'])"
          :disabled="!row.hostOnline || rowBusy(row)"
          size="small"
          type="link"
          @click="openDeploy(row)"
        >
          发布
        </Button>
        <template v-if="hasAccessByCodes(['ops_app:manage'])">
          <Button
            :disabled="rowBusy(row)"
            size="small"
            type="link"
            @click="openEditor(row)"
          >
            编辑
          </Button>
          <Tooltip :title="removeTip(row)">
            <Button
              :disabled="!!removeTip(row)"
              danger
              size="small"
              type="link"
              @click="remove(row)"
            >
              删除
            </Button>
          </Tooltip>
        </template>
      </template>
    </Grid>

    <Modal
      v-model:open="editorOpen"
      :title="editing ? `编辑程序：${editing.name}` : '新增程序'"
      :width="620"
      destroy-on-close
    >
      <div class="mb-4">
        <Alert
          message="管理后台以 root 通过 SSH 登录这台机器，需要先把管理后台的公钥加到它的 /root/.ssh/authorized_keys；保存时会先连一次，连不上不保存。程序包和程序目录的格式为 bin（bin/app.sh）、lib（其中一个 jar 带 Main-Class）、conf、excel，先登记再用「发布」上传，第一次发布时创建目录。"
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

    <Modal
      :closable="!deploying"
      :mask-closable="false"
      :open="!!deployApp"
      :title="`发布：${deployApp?.name ?? ''}（${deployApp ? address(deployApp) : ''} ${deployApp?.dir ?? ''}）`"
      :width="620"
      @cancel="deploying || (deployApp = null)"
    >
      <Alert
        class="mb-4"
        message="上传 bin、lib、conf、excel 打成的 zip（外面可以再包一层目录），由包里的 bin/app.sh 完成发布。停止前先检查包里的 Main-Class；发布前把机器上的 bin、lib、conf、excel 备份到程序目录的 backup/ 下。不勾选覆盖配置时，机器上的 conf 保持不变。程序在运行时会先停止，发布后重新启动。"
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
        上传完成，正在发布…
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

    <TaskOutput
      :task-id="taskId"
      @close="taskId = null"
      @finished="gridApi.query()"
    />
  </Page>
</template>
