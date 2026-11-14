<script lang="ts" setup>
import type { FormInstance } from 'ant-design-vue';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { LogDefinition, LogDefinitionField } from '#/api/types';

import { ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Checkbox,
  Empty,
  Form,
  FormItem,
  Input,
  message,
  Modal,
  Select,
  Table,
  Tag,
} from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { createLogEventApi, getLogEventsApi, updateLogEventApi } from '#/api';

import {
  fieldTypes,
  NAME_PATTERN,
  STORAGE_NAME_PATTERN,
} from './types';

const { hasAccessByCodes } = useAccess();

const editing = ref<'new' | LogDefinition | null>(null);
const state = ref<LogDefinition>(emptyState());
/** 编辑时已有字段的上报字段名：日志服务不允许删除、改名、改类型 */
const lockedKeys = ref(new Set<string>());
const saving = ref(false);
const formRef = ref<FormInstance>();

function emptyState(): LogDefinition {
  return { collection: '', event: '', fields: [], name: '' };
}

function emptyField(): LogDefinitionField {
  return {
    display: true,
    field: '',
    key: '',
    name: '',
    required: false,
    type: 'string',
  };
}

/** 展开行里的字段明细 */
const fieldColumns = [
  { dataIndex: 'name', key: 'name', title: '显示名称' },
  { dataIndex: 'key', key: 'key', title: '上报字段名' },
  { dataIndex: 'field', key: 'field', title: '存储字段名' },
  { dataIndex: 'type', key: 'type', title: '类型', width: 160 },
  { dataIndex: 'required', key: 'required', title: '必填', width: 80 },
  { dataIndex: 'display', key: 'display', title: '列表显示', width: 100 },
];
const typeLabels = Object.fromEntries(
  fieldTypes.map((item) => [item.value, item.label]),
);

function isLocked(field: LogDefinitionField) {
  return editing.value !== 'new' && lockedKeys.value.has(field.key);
}

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: [
      { slots: { content: 'fields' }, type: 'expand', width: 48 },
      { align: 'left', field: 'event', minWidth: 160, title: '事件名' },
      { align: 'left', field: 'name', minWidth: 140, title: '显示名称' },
      { align: 'left', field: 'collection', minWidth: 160, title: '集合' },
      {
        field: 'fields',
        formatter: ({ cellValue }) =>
          `${(cellValue as LogDefinitionField[]).length} 个`,
        title: '字段',
        width: 100,
      },
      {
        field: 'operation',
        fixed: 'right',
        slots: { default: 'action' },
        title: '操作',
        width: 90,
      },
    ],
    height: 'auto',
    pagerConfig: { enabled: false },
    proxyConfig: {
      ajax: {
        query: async () => {
          const { list } = await getLogEventsApi();
          return { items: list, total: list.length };
        },
      },
    },
    expandConfig: { padding: true },
    rowConfig: { keyField: 'event' },
    toolbarConfig: { custom: true, refresh: true, zoom: true },
  } as VxeTableGridOptions<LogDefinition>,
});

function open(definition: 'new' | LogDefinition) {
  if (definition === 'new') {
    state.value = { ...emptyState(), fields: [emptyField()] };
    lockedKeys.value = new Set();
  } else {
    state.value = JSON.parse(JSON.stringify(definition)) as LogDefinition;
    lockedKeys.value = new Set(definition.fields.map((field) => field.key));
  }
  editing.value = definition;
}

/** 前端只做基本检查，其余（重复、只增不改）以日志服务返回为准 */
function validFields() {
  if (state.value.fields.length === 0) {
    message.error('请至少添加一个字段');
    return false;
  }
  for (const field of state.value.fields) {
    if (!NAME_PATTERN.test(field.key.trim())) {
      message.error(`上报字段名「${field.key}」只允许字母开头的字母、数字、下划线`);
      return false;
    }
    if (!STORAGE_NAME_PATTERN.test(field.field.trim())) {
      message.error(
        `存储字段名「${field.field}」只允许小写字母开头的小写字母、数字、下划线`,
      );
      return false;
    }
  }
  return true;
}

async function submit() {
  if (!editing.value) return;
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  if (!validFields()) return;
  const definition: LogDefinition = {
    collection: state.value.collection.trim(),
    name: (state.value.name ?? '').trim(),
    event: state.value.event.trim(),
    fields: state.value.fields.map((field) => ({
      field: field.field.trim(),
      key: field.key.trim(),
      name: (field.name ?? '').trim(),
      required: field.required,
      display: field.display,
      type: field.type,
    })),
  };
  saving.value = true;
  try {
    await (editing.value === 'new'
      ? createLogEventApi(definition)
      : updateLogEventApi(definition));
    message.success('日志事件已保存');
    editing.value = null;
    await gridApi.query();
  } catch {
    // 错误信息已由请求拦截器提示
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Page auto-content-height>
    <Grid table-title="日志事件">
      <template #toolbar-tools>
        <Button
          v-if="hasAccessByCodes(['log_event:create'])"
          type="primary"
          @click="open('new')"
        >
          <template #icon>
            <IconifyIcon class="size-4" icon="lucide:plus" />
          </template>
          新增事件
        </Button>
      </template>
      <template #fields="{ row }">
        <Table
          :columns="fieldColumns"
          :data-source="row.fields"
          :pagination="false"
          row-key="key"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              {{ record.name || '-' }}
            </template>
            <template v-else-if="column.key === 'type'">
              {{ typeLabels[record.type] ?? record.type }}
            </template>
            <template v-else-if="column.key === 'required'">
              <Tag v-if="record.required" color="blue">必填</Tag>
              <span v-else class="lc-muted">选填</span>
            </template>
            <template v-else-if="column.key === 'display'">
              <Tag v-if="record.display" color="green">显示</Tag>
              <span v-else class="lc-muted">仅详情</span>
            </template>
          </template>
        </Table>
      </template>
      <template #action="{ row }">
        <Button
          v-if="hasAccessByCodes(['log_event:update'])"
          size="small"
          type="link"
          @click="open(row)"
        >
          编辑
        </Button>
      </template>
      <template #empty>
        <Empty description="暂无事件" :image="Empty.PRESENTED_IMAGE_SIMPLE" />
      </template>
    </Grid>

    <Modal
      :confirm-loading="saving"
      :open="editing !== null"
      :title="editing === 'new' ? '新增日志事件' : '编辑日志事件'"
      :width="900"
      cancel-text="取消"
      destroy-on-close
      ok-text="保存"
      @cancel="editing = null"
      @ok="submit"
    >
      <Form
        ref="formRef"
        :model="state"
        :required-mark="false"
        class="lc-editor"
        layout="vertical"
      >
        <section class="lc-section">
          <h3>基本信息</h3>
          <p class="lc-hint">
            事件名是其他服务上报时用的名字，事件存入日志服务 Mongo
            里的集合，保存后不能修改；显示名称用于后台展示，可随时修改，不填时显示事件名。
          </p>
          <div class="lc-grid3">
            <FormItem
              :rules="[
                { required: true, message: '请输入事件名' },
                {
                  pattern: NAME_PATTERN,
                  message: '字母开头的字母、数字、下划线',
                },
              ]"
              label="事件名"
              name="event"
            >
              <Input
                v-model:value="state.event"
                :disabled="editing !== 'new'"
                placeholder="例如 GiftSend"
              />
            </FormItem>
            <FormItem
              :rules="[
                { required: true, message: '请输入集合名' },
                {
                  pattern: STORAGE_NAME_PATTERN,
                  message: '小写字母开头的小写字母、数字、下划线',
                },
              ]"
              label="集合"
              name="collection"
            >
              <Input
                v-model:value="state.collection"
                :disabled="editing !== 'new'"
                placeholder="例如 gift_send"
              />
            </FormItem>
            <FormItem label="显示名称" name="name">
              <Input
                v-model:value="state.name"
                :maxlength="64"
                placeholder="例如 送礼"
              />
            </FormItem>
          </div>
        </section>
        <section class="lc-section">
          <h3>字段</h3>
          <p class="lc-hint">
            上报字段名是上报 JSON 里的 key，存储字段名是 Mongo
            文档里的字段名，显示名称用于日志查询的条件和结果列，不填时显示上报字段名。勾选「列表显示」的字段作为日志查询结果的列，其余在详情里查看。已保存的字段只能修改显示名称、是否必填和列表显示，不能删除、改名或改类型；date
            类型上报毫秒时间戳。
          </p>
          <div v-if="state.fields.length > 0" class="lc-fields">
            <div class="lc-field lc-field-head">
              <span>上报字段名</span>
              <span>存储字段名</span>
              <span>显示名称</span>
              <span>类型</span>
              <span>必填</span>
              <span>列表显示</span>
              <span></span>
            </div>
            <div
              v-for="(field, index) in state.fields"
              :key="index"
              class="lc-field"
            >
              <Input
                v-model:value="field.key"
                :disabled="isLocked(field)"
                placeholder="例如 userId"
              />
              <Input
                v-model:value="field.field"
                :disabled="isLocked(field)"
                placeholder="例如 user_id"
              />
              <Input
                v-model:value="field.name"
                :maxlength="64"
                placeholder="例如 用户 ID"
              />
              <Select
                v-model:value="field.type"
                :disabled="isLocked(field)"
                :options="fieldTypes"
              />
              <Checkbox v-model:checked="field.required" />
              <Checkbox v-model:checked="field.display" />
              <Button
                v-if="!isLocked(field)"
                danger
                size="small"
                type="text"
                @click="state.fields.splice(index, 1)"
              >
                <IconifyIcon class="size-4" icon="lucide:trash-2" />
              </Button>
            </div>
          </div>
          <Button
            block
            class="mt-3"
            type="dashed"
            @click="state.fields.push(emptyField())"
          >
            <template #icon>
              <IconifyIcon class="size-4" icon="lucide:plus" />
            </template>
            添加字段
          </Button>
        </section>
      </Form>
    </Modal>
  </Page>
</template>

<style scoped>
.lc-editor {
  max-height: 68vh;
  padding: 8px 4px 0;
  overflow-y: auto;
}

.lc-grid3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0 20px;
}

.lc-section + .lc-section {
  padding-top: 20px;
  margin-top: 20px;
  border-top: 1px solid hsl(var(--border));
}

.lc-section h3 {
  margin: 0 0 16px;
  font-size: 14px;
  font-weight: 600;
}

.lc-muted {
  color: hsl(var(--muted-foreground));
}

.lc-hint {
  margin: -8px 0 16px;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.lc-fields {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.lc-field {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 170px 40px 64px 40px;
  gap: 12px;
  align-items: center;
}

.lc-field-head {
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}
</style>
