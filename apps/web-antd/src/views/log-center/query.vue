<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  LogCondition,
  LogDefinition,
  LogDefinitionFieldType,
  LogOperator,
} from '#/api/types';

import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Button,
  DatePicker,
  Descriptions,
  DescriptionsItem,
  Drawer,
  Empty,
  Input,
  message,
  Select,
  Space,
  Tag,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getLogEventsApi, queryLogApi } from '#/api';

import {
  displayName,
  labelOf,
  operatorLabels,
  operatorsByType,
} from './types';

/** 编辑中的条件：date 字段的值是 Dayjs，其余是文本，提交时再转换 */
interface ConditionRow {
  key?: string;
  op?: LogOperator;
  value?: Dayjs | string;
}

const definitions = ref<LogDefinition[]>([]);
const eventName = ref<string>();
const conditions = ref<ConditionRow[]>([]);
/** 点击查询时固定下来的条件，翻页时沿用 */
const submitted = ref<{ conditions: LogCondition[] }>();
const detail = ref<null | Record<string, unknown>>(null);
let rawRows: Record<string, unknown>[] = [];

const definition = computed(() =>
  definitions.value.find((item) => item.event === eventName.value),
);
const eventOptions = computed(() =>
  definitions.value.map((item) => ({ label: labelOf(item), value: item.event })),
);
const fieldOptions = computed(() =>
  (definition.value?.fields ?? []).map((field) => ({
    label: labelOf(field),
    value: field.key,
  })),
);
const boolOptions = [
  { label: '是', value: 'true' },
  { label: '否', value: 'false' },
];

function fieldOf(key?: string) {
  return definition.value?.fields.find((field) => field.key === key);
}

function operatorOptions(key?: string) {
  const field = fieldOf(key);
  return (field ? operatorsByType[field.type] : []).map((op) => ({
    label: operatorLabels[op],
    value: op,
  }));
}

function display(value: unknown, type: LogDefinitionFieldType) {
  if (value === null || value === undefined) return '-';
  if (type === 'bool') return value ? '是' : '否';
  if (type === 'date' && typeof value === 'number') {
    return dayjs(value).format('YYYY-MM-DD HH:mm:ss.SSS');
  }
  return String(value);
}

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: [],
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [20, 50, 100, 200] },
    proxyConfig: {
      autoLoad: false,
      ajax: {
        query: async ({ page }) => {
          const current = definition.value;
          if (!current || !submitted.value) return { items: [], total: 0 };
          const result = await queryLogApi(
            { ...submitted.value, event: current.event },
            (page.currentPage - 1) * page.pageSize,
            page.pageSize,
          );
          rawRows = result.list;
          return {
            items: result.list.map((row) => toTableRow(current, row)),
            total: result.total,
          };
        },
      },
    },
    rowConfig: { isHover: true },
    toolbarConfig: { custom: true, zoom: true },
  } as VxeTableGridOptions,
});

function toTableRow(current: LogDefinition, row: Record<string, unknown>) {
  const result: Record<string, string> = {};
  for (const field of current.fields) {
    result[field.key] = display(row[field.key], field.type);
  }
  return result;
}

/**
 * 结果列是勾了「列表显示」的字段（一个都没勾时显示全部），第一个 date 字段排在最前并固定在左侧，
 * 加上固定在右侧的「详情」；详情里显示全部字段
 */
function resultColumns(current?: LogDefinition) {
  const all = current?.fields ?? [];
  const shown = all.some((field) => field.display)
    ? all.filter((field) => field.display)
    : all;
  const time = shown.find((field) => field.type === 'date');
  const ordered = time
    ? [time, ...shown.filter((field) => field !== time)]
    : shown;
  return [
    ...ordered.map((field) => ({
      field: field.key,
      fixed: field === time ? ('left' as const) : undefined,
      minWidth: field.type === 'date' ? 200 : 140,
      title: displayName(field),
    })),
    {
      field: 'operation',
      fixed: 'right' as const,
      slots: { default: 'detail' },
      title: '操作',
      width: 72,
    },
  ];
}

/** 切换事件：清空条件和结果，重建结果列 */
function onEventChange() {
  submitted.value = undefined;
  rawRows = [];
  conditions.value = [];
  gridApi.setGridOptions({
    columns: resultColumns(definition.value),
    data: [],
  });
}

function addCondition() {
  conditions.value.push({});
}

/** 换字段时默认第一个运算符并清空值 */
function onKeyChange(row: ConditionRow) {
  row.op = operatorOptions(row.key)[0]?.value;
  row.value = undefined;
}

function reset() {
  conditions.value = [];
}

/** 编辑中的条件转成提交给后端的条件：date 为毫秒；没选字段的行忽略，选了字段没填值的提示 */
function buildConditions(): LogCondition[] | null {
  const result: LogCondition[] = [];
  for (const row of conditions.value) {
    const field = fieldOf(row.key);
    if (!field || !row.op) continue;
    const value =
      field.type === 'date'
        ? (row.value as Dayjs | undefined)?.valueOf()
        : (row.value as string | undefined)?.trim();
    if (value === undefined || value === '') {
      message.warning(`请填写「${displayName(field)}」的条件值`);
      return null;
    }
    result.push({ key: field.key, op: row.op, value: String(value) });
  }
  return result;
}

async function search() {
  if (!definition.value) {
    message.warning('请选择日志事件');
    return;
  }
  const built = buildConditions();
  if (!built) return;
  submitted.value = { conditions: built };
  await gridApi.query();
}

onMounted(async () => {
  const { list } = await getLogEventsApi();
  definitions.value = list;
});
</script>

<template>
  <Page auto-content-height>
    <div class="lc-page">
      <section class="lc-panel">
        <div class="lc-row">
          <span class="lc-label">日志事件</span>
          <Select
            v-model:value="eventName"
            :options="eventOptions"
            class="lc-select"
            option-filter-prop="label"
            placeholder="请选择日志事件"
            show-search
            @change="onEventChange"
          />
          <Tag v-if="definition" color="blue">{{ definition.collection }}</Tag>
        </div>
        <template v-if="definition">
          <div class="lc-row lc-top mt-4">
            <span class="lc-label">查询条件</span>
            <div class="lc-conditions">
              <div
                v-for="(row, index) in conditions"
                :key="index"
                class="lc-condition"
              >
                <Select
                  v-model:value="row.key"
                  :options="fieldOptions"
                  class="lc-field"
                  placeholder="字段"
                  @change="onKeyChange(row)"
                />
                <Select
                  v-model:value="row.op"
                  :options="operatorOptions(row.key)"
                  class="lc-op"
                  placeholder="运算符"
                />
                <template v-if="row.key && row.op">
                  <DatePicker
                    v-if="fieldOf(row.key)?.type === 'date'"
                    v-model:value="row.value as Dayjs"
                    show-time
                  />
                  <Select
                    v-else-if="fieldOf(row.key)?.type === 'bool'"
                    v-model:value="row.value as string"
                    :options="boolOptions"
                    class="lc-value"
                    placeholder="请选择"
                  />
                  <Input
                    v-else
                    v-model:value="row.value as string"
                    allow-clear
                    class="lc-value"
                    :placeholder="
                      fieldOf(row.key)?.type === 'string' ? '请输入' : '请输入数字'
                    "
                  />
                </template>
                <Button
                  danger
                  size="small"
                  type="text"
                  @click="conditions.splice(index, 1)"
                >
                  <IconifyIcon class="size-4" icon="lucide:x" />
                </Button>
              </div>
              <Button class="lc-add" type="dashed" @click="addCondition">
                <template #icon>
                  <IconifyIcon class="size-4" icon="lucide:plus" />
                </template>
                添加条件
              </Button>
            </div>
          </div>
          <div class="lc-actions">
            <Space>
              <Button @click="reset">重置</Button>
              <Button type="primary" @click="search">
                <template #icon>
                  <IconifyIcon class="size-4" icon="lucide:search" />
                </template>
                查询
              </Button>
            </Space>
          </div>
        </template>
      </section>
      <div class="lc-result">
        <Grid table-title="查询结果">
          <template #detail="{ rowIndex }">
            <Button
              size="small"
              type="link"
              @click="detail = rawRows[rowIndex] ?? null"
            >
              详情
            </Button>
          </template>
          <template #empty>
            <Empty
              :description="definition ? '暂无结果' : '请选择日志事件'"
              :image="Empty.PRESENTED_IMAGE_SIMPLE"
            />
          </template>
        </Grid>
      </div>
    </div>
    <Drawer
      :open="!!detail"
      :width="560"
      title="日志详情"
      @close="detail = null"
    >
      <Descriptions
        v-if="detail && definition"
        :column="1"
        bordered
        size="small"
      >
        <DescriptionsItem
          v-for="field in definition.fields"
          :key="field.key"
          :label="labelOf(field)"
        >
          {{ display(detail[field.key], field.type) }}
        </DescriptionsItem>
      </Descriptions>
    </Drawer>
  </Page>
</template>

<style scoped>
.lc-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
}

.lc-panel {
  padding: 20px 24px;
  background: hsl(var(--card));
  border-radius: 8px;
}

.lc-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.lc-top {
  align-items: flex-start;
}

.lc-top .lc-label {
  line-height: 32px;
}

.lc-label {
  flex-shrink: 0;
  width: 88px;
  font-size: 14px;
}

.lc-select {
  width: 360px;
  max-width: 100%;
}

.lc-hint {
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.lc-conditions {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
}

.lc-condition {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.lc-field {
  width: 180px;
}

.lc-op {
  width: 110px;
}

.lc-value {
  width: 200px;
}

.lc-add {
  align-self: flex-start;
}

.lc-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 12px;
  margin-top: 16px;
  border-top: 1px solid hsl(var(--border));
}

.lc-result {
  flex: 1;
  min-height: 320px;
}
</style>
