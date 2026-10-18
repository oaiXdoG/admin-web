<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  DataSourceNetwork,
  DataSourceRecord,
  DataSourceServiceType,
  DataSourceTarget,
  DataSourceType,
} from '#/api/types';

import { computed, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Alert,
  Button,
  message,
  Modal,
  Space,
  Tag,
  Tooltip,
} from 'ant-design-vue';

import { useVbenForm, z } from '#/adapter/form';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  createDataSourceApi,
  getDataSourcesApi,
  removeDataSourceApi,
  testDataSourceApi,
  updateDataSourceApi,
} from '#/api';
import { useProjectStore } from '#/store';

interface FormValues {
  name: string;
  network: DataSourceNetwork;
  remark?: string;
  secret?: string;
  /** type 为 http 时不显示，取不到值 */
  serviceType?: string;
  timeoutSeconds: number;
  type: DataSourceType;
  /** type 为 discover 时不显示，取不到值 */
  url?: string;
}

const NETWORK_LABELS: Record<DataSourceNetwork, string> = {
  inner: '内网',
  public: '公网',
};

const TYPE_LABELS: Record<DataSourceType, string> = {
  discover: '按业务类型发现',
  http: '固定地址',
};

/** 游戏服的业务类型编码：按区列出，其他类型按节点列出 */
const LOGIC = 'logic';

const projectStore = useProjectStore();
const { hasAccessByCodes } = useAccess();

/** null 为新建 */
const editing = ref<DataSourceRecord | null>(null);
const open = ref(false);
const saving = ref(false);
const testing = ref(false);
const testResult = ref<{
  message: string;
  ok: boolean;
  /** 测试时选的业务类型，决定目标按区还是按节点显示 */
  serviceType: string;
  targets: DataSourceTarget[];
} | null>(null);
/** 表单里当前选择的来源，切换说明文字 */
const sourceType = ref<DataSourceType>('http');
/** 有编码的业务类型，随数据源列表返回，供「业务类型」下拉 */
const serviceTypes = ref<DataSourceServiceType[]>([]);

const serviceTypeOptions = computed(() =>
  serviceTypes.value.map((item) => ({
    label: `${item.name}（${item.code}）`,
    value: item.code,
  })),
);

const projectId = computed(() => projectStore.currentProjectId as number);

const [SourceForm, formApi] = useVbenForm({
  handleValuesChange: (values) => {
    if (values.type && values.type !== sourceType.value) {
      sourceType.value = values.type;
      testResult.value = null;
    }
    if (
      testResult.value &&
      values.serviceType !== undefined &&
      values.serviceType !== testResult.value.serviceType
    ) {
      testResult.value = null;
    }
  },
  schema: [
    {
      component: 'Input',
      componentProps: {
        maxlength: 64,
        placeholder: '自己起的名字，选数据源时显示，例如：游戏服、登录服',
      },
      fieldName: 'name',
      label: '名称',
      rules: z.string().trim().min(1, { message: '请输入名称' }),
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        optionType: 'button',
        options: [
          { label: TYPE_LABELS.http, value: 'http' },
          { label: TYPE_LABELS.discover, value: 'discover' },
        ],
      },
      defaultValue: 'http',
      fieldName: 'type',
      label: '来源',
    },
    {
      component: 'Select',
      componentProps: {
        notFoundContent: '没有设置了编码的业务类型（进程管理 → 业务类型）',
        optionFilterProp: 'label',
        placeholder: '请选择业务类型',
        showSearch: true,
      },
      dependencies: {
        if: (values) => values.type === 'discover',
        triggerFields: ['type'],
      },
      fieldName: 'serviceType',
      label: '业务类型',
      rules: 'selectRequired',
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        optionType: 'button',
        options: [
          { label: NETWORK_LABELS.inner, value: 'inner' },
          { label: NETWORK_LABELS.public, value: 'public' },
        ],
      },
      defaultValue: 'inner',
      dependencies: {
        if: (values) => values.type === 'discover',
        triggerFields: ['type'],
      },
      fieldName: 'network',
      label: '连接方式',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder:
          '例如 http://10.0.0.5:8080，会调用 地址/admin/queries 和 地址/admin/query',
      },
      dependencies: {
        if: (values) => values.type !== 'discover',
        triggerFields: ['type'],
      },
      fieldName: 'url',
      label: '接口地址',
      rules: z
        .string()
        .trim()
        .regex(/^https?:\/\/[^\s/?#]+(?:\/[^\s?#]*)?$/, {
          message: '请输入 http:// 或 https:// 开头的地址',
        }),
    },
    {
      component: 'InputPassword',
      componentProps: { autocomplete: 'new-password' },
      dependencies: {
        resolve: () => ({
          componentProps: {
            autocomplete: 'new-password',
            placeholder: editing.value?.secretSet
              ? '已设置，留空不修改'
              : '与业务服务器约定的 HMAC-SHA256 签名密钥，加密保存',
          },
        }),
        triggerFields: ['name'],
      },
      fieldName: 'secret',
      label: '签名密钥',
    },
    {
      component: 'InputNumber',
      componentProps: { addonAfter: '秒', max: 60, min: 1, precision: 0 },
      defaultValue: 10,
      fieldName: 'timeoutSeconds',
      label: '超时时间',
      rules: 'required',
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

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: [
      { align: 'left', field: 'name', title: '名称', width: 180 },
      {
        align: 'left',
        field: 'type',
        slots: { default: 'type' },
        title: '来源',
        width: 200,
      },
      {
        align: 'left',
        field: 'url',
        slots: { default: 'url' },
        minWidth: 240,
        title: '接口地址 / 可查询目标',
      },
      {
        field: 'timeoutMs',
        formatter: ({ cellValue }) => `${cellValue / 1000} 秒`,
        title: '超时',
        width: 80,
      },
      { field: 'templateCount', title: '查询模板', width: 90 },
      { align: 'left', field: 'remark', title: '备注', width: 220 },
      {
        field: 'operation',
        fixed: 'right',
        slots: { default: 'action' },
        title: '操作',
        width: 140,
      },
    ],
    height: 'auto',
    pagerConfig: { enabled: false },
    proxyConfig: {
      ajax: {
        query: async () => {
          const result = await getDataSourcesApi(projectId.value);
          const list = result.list;
          serviceTypes.value = result.serviceTypes ?? [];
          formApi.updateSchema([
            {
              componentProps: { options: serviceTypeOptions.value },
              fieldName: 'serviceType',
            },
          ]);
          return { items: list, total: list.length };
        },
      },
    },
    rowConfig: { keyField: 'id' },
    toolbarConfig: { custom: true, refresh: true, zoom: true },
  } as VxeTableGridOptions<DataSourceRecord>,
});

/** 列表第二行：业务类型名称、编码和连接方式 */
function discoverText(row: DataSourceRecord) {
  const name = row.serviceTypeName;
  const network = NETWORK_LABELS[row.network] ?? NETWORK_LABELS.inner;
  return `${name ? `${name} ` : ''}${row.serviceType} · ${network}`;
}

function targetLabel(target: DataSourceTarget, serviceType: string) {
  return serviceType === LOGIC && target.zoneId !== null
    ? `${target.zoneId} 区`
    : target.nodeId || target.key;
}

async function openEditor(record: DataSourceRecord | null) {
  editing.value = record;
  testResult.value = null;
  sourceType.value = record?.type ?? 'http';
  open.value = true;
  await formApi.reset();
  if (record) {
    await formApi.setValues({
      name: record.name,
      remark: record.remark,
      secret: '',
      network: record.network ?? 'inner',
      serviceType: record.serviceType || undefined,
      timeoutSeconds: record.timeoutMs / 1000,
      type: record.type ?? 'http',
      url: record.url,
    });
  }
}

/** 新建时密钥必填，编辑时留空沿用 */
async function values() {
  const { valid } = await formApi.validate();
  if (!valid) return null;
  const form = await formApi.getValues<FormValues>();
  if (!editing.value && !form.secret) {
    message.warning('请输入签名密钥');
    return null;
  }
  return form;
}

async function test() {
  const form = await values();
  if (!form) return;
  testing.value = true;
  testResult.value = null;
  try {
    const result = await testDataSourceApi(projectId.value, {
      network: form.network ?? 'inner',
      secret: form.secret,
      serviceType: form.serviceType ?? '',
      sourceId: editing.value?.id,
      timeoutMs: form.timeoutSeconds * 1000,
      type: form.type,
      url: form.url ?? '',
    });
    const targets = result.targets ?? [];
    const unit = form.serviceType === LOGIC ? '区' : '节点';
    testResult.value = {
      message:
        form.type === 'discover'
          ? `连接成功：发现 ${targets.length} 个${unit}，提供 ${result.queryCount} 个查询`
          : `连接成功：提供 ${result.queryCount} 个查询`,
      ok: true,
      serviceType: form.serviceType ?? '',
      targets,
    };
  } catch (error) {
    // 业务错误由请求拦截器抛出原始响应，原因在 data.message 里
    const reason = (error as { data?: { message?: string } })?.data?.message;
    testResult.value = {
      message: reason ?? '连接失败',
      ok: false,
      serviceType: form.serviceType ?? '',
      targets: [],
    };
  } finally {
    testing.value = false;
  }
}

async function save() {
  const form = await values();
  if (!form) return;
  saving.value = true;
  try {
    const data = {
      name: form.name,
      network: form.network ?? 'inner',
      remark: form.remark,
      secret: form.secret,
      serviceType: form.serviceType ?? '',
      timeoutMs: form.timeoutSeconds * 1000,
      type: form.type,
      url: form.url ?? '',
    };
    await (editing.value
      ? updateDataSourceApi(projectId.value, editing.value.id, data)
      : createDataSourceApi(projectId.value, data));
    message.success('数据源已保存');
    open.value = false;
    await gridApi.query();
  } catch {
    // 错误信息已由请求拦截器提示
  } finally {
    saving.value = false;
  }
}

function remove(record: DataSourceRecord) {
  Modal.confirm({
    cancelText: '取消',
    content: `删除数据源「${record.name}」？`,
    okButtonProps: { danger: true },
    okText: '删除',
    title: '删除数据源',
    async onOk() {
      await removeDataSourceApi(projectId.value, record.id);
      message.success('数据源已删除');
      await gridApi.query();
    },
  });
}

</script>

<template>
  <Page auto-content-height>
    <Grid
      v-if="projectStore.currentProjectId !== null"
      :key="projectStore.currentProjectId"
      table-title="数据源"
    >
      <template #toolbar-tools>
        <Button
          v-if="hasAccessByCodes(['data_source:create'])"
          type="primary"
          @click="openEditor(null)"
        >
          <template #icon>
            <IconifyIcon class="size-4" icon="lucide:plus" />
          </template>
          新增数据源
        </Button>
      </template>
      <template #type="{ row }">
        <template v-if="row.type === 'discover'">
          <div>{{ TYPE_LABELS.discover }}</div>
          <div class="text-muted-foreground text-xs">
            {{ discoverText(row) }}
          </div>
        </template>
        <span v-else>{{ TYPE_LABELS[row.type as DataSourceType] ?? row.type }}</span>
      </template>
      <template #url="{ row }">
        <template v-if="row.type === 'discover'">
          <Tag v-if="(row.targetCount ?? 0) > 0" color="success">
            在线 {{ row.targetCount }} 个{{
              row.serviceType === LOGIC ? '区' : '节点'
            }}
          </Tag>
          <Tooltip
            v-else
            title="该业务类型没有在线且 GM 端口不为 0 的节点"
          >
            <Tag color="warning">0 个可查询</Tag>
          </Tooltip>
        </template>
        <span v-else>{{ row.url }}</span>
      </template>
      <template #action="{ row }">
        <Button
          v-if="hasAccessByCodes(['data_source:update'])"
          size="small"
          type="link"
          @click="openEditor(row)"
        >
          编辑
        </Button>
        <Button
          v-if="hasAccessByCodes(['data_source:remove'])"
          :disabled="row.templateCount > 0"
          danger
          size="small"
          type="link"
          @click="remove(row)"
        >
          删除
        </Button>
      </template>
    </Grid>
    <Modal
      v-model:open="open"
      :title="editing ? '编辑数据源' : '新增数据源'"
      :width="620"
      destroy-on-close
    >
      <div class="mb-4">
        <Alert
          :message="
            sourceType === 'discover'
              ? '查询地址取该业务类型在线上报的 innerHost:gmPort（公网用 host:gmPort）；gmPort 为 0 的节点没有查询接口，不参与。游戏服（logic）按区列出，其他类型按节点列出；所有目标共用签名密钥和查询模板。后台和业务服不在同一个内网时选「公网」，查询端口要对后台服务器的 IP 开放。'
              : '数据源是业务服务器按接口规范提供的查询接口（规范见 admin-background docs/data-center.md）。'
          "
          show-icon
          type="info"
        />
      </div>
      <SourceForm />
      <div v-if="testResult" class="mt-2">
        <Alert
          :message="testResult.message"
          show-icon
          :type="testResult.ok ? 'success' : 'error'"
        >
          <template v-if="testResult.targets.length > 0" #description>
            <div
              :class="
                testResult.serviceType === LOGIC ? 'zone-grid' : 'node-grid'
              "
              class="max-h-48 overflow-auto"
            >
              <Tooltip
                v-for="target in testResult.targets"
                :key="target.key"
                :title="target.url"
              >
                <div
                  class="border-border bg-background truncate rounded border px-2 py-0.5 text-center text-xs"
                >
                  {{ targetLabel(target, testResult.serviceType) }}
                </div>
              </Tooltip>
            </div>
          </template>
        </Alert>
      </div>
      <template #footer>
        <Space>
          <Button :loading="testing" @click="test">测试连接</Button>
          <Button @click="open = false">取消</Button>
          <Button :loading="saving" type="primary" @click="save">保存</Button>
        </Space>
      </template>
    </Modal>
  </Page>
</template>

<style scoped>
.zone-grid,
.node-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  gap: 6px;
}

.node-grid {
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
}
</style>
