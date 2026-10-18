<script lang="ts" setup>
import type { ProcessRecord } from '#/api/types';

import { computed, ref, watch } from 'vue';

import { useAccess } from '@vben/access';

import { Descriptions, DescriptionsItem, Drawer, Empty, TabPane, Tabs, Tag, Tooltip } from 'ant-design-vue';
import dayjs from 'dayjs';

import {
  formatBytes,
  formatDuration,
  formatPercent,
  formatReportTime,
  processStateTag,
  serviceTag,
} from '../format';
import ProcessFiles from './process-files.vue';
import TaskList from './task-list.vue';

/** 进程详情：当前状态、指标和执行记录，业务服上报，文件管理（监控曲线在「监控详情」页） */
const props = defineProps<{ process: null | ProcessRecord; projectId: number }>();
const emit = defineEmits<{ close: [] }>();

const { hasAccessByCodes } = useAccess();
const taskList = ref<InstanceType<typeof TaskList>>();
const tab = ref<'files' | 'overview' | 'service'>('overview');

const state = computed(() => processStateTag(props.process?.state));
const service = computed(() => props.process?.service ?? null);
const binding = computed(() =>
  service.value ? serviceTag(service.value, props.process?.typeCode) : null,
);
const rawJson = computed(() =>
  service.value?.raw ? JSON.stringify(service.value.raw, null, 2) : '',
);

/** 换一个进程时回到概况 */
watch(
  () => props.process?.id,
  () => {
    tab.value = 'overview';
  },
);

/** 指令完成后列表刷新时，执行记录也跟着刷新 */
watch(
  () => props.process?.task?.status,
  () => taskList.value?.reload(),
);
</script>

<template>
  <Drawer
    :open="process !== null"
    :title="process ? `${process.serverName} / ${process.name}` : ''"
    :width="780"
    @close="emit('close')"
  >
    <Tabs v-if="process" v-model:active-key="tab">
      <TabPane key="overview" tab="概况">
        <Descriptions :column="2" bordered size="small">
          <DescriptionsItem label="状态">
            <Tag :color="state.color">{{ state.text }}</Tag>
            <Tag v-if="process.pendingRestart" color="warning">待重启</Tag>
          </DescriptionsItem>
          <DescriptionsItem label="PID">{{ process.metric?.pid || '—' }}</DescriptionsItem>
          <DescriptionsItem label="CPU">{{ formatPercent(process.metric?.cpu) }}</DescriptionsItem>
          <DescriptionsItem label="常驻内存">{{ formatBytes(process.metric?.memory) }}</DescriptionsItem>
          <DescriptionsItem label="线程数">{{ process.metric?.threads ?? '—' }}</DescriptionsItem>
          <DescriptionsItem label="TCP 连接">{{ process.metric?.tcp ?? '—' }}</DescriptionsItem>
          <DescriptionsItem label="运行时长">
            {{
              process.state === 'active' && process.metric?.startedAt
                ? formatDuration((Date.now() - process.metric.startedAt) / 1000)
                : '—'
            }}
          </DescriptionsItem>
          <DescriptionsItem label="类型">{{ process.typeName || '—' }}</DescriptionsItem>
          <DescriptionsItem label="最近部署" :span="2">
            <template v-if="process.deployedAt">
              {{ dayjs(process.deployedAt).format('YYYY-MM-DD HH:mm:ss') }}
              <div v-if="process.deployRemark" class="text-muted-foreground break-all text-xs">
                {{ process.deployRemark }}
              </div>
            </template>
            <template v-else>—</template>
          </DescriptionsItem>
          <DescriptionsItem label="工作目录" :span="2">{{ process.workDir }}</DescriptionsItem>
          <DescriptionsItem label="服务名">adm-{{ process.name }}</DescriptionsItem>
          <DescriptionsItem label="配置版本">
            {{ process.configVersion }}
            <span v-if="process.metric?.configVersion" class="text-muted-foreground">
              （运行中：{{ process.metric.configVersion }}）
            </span>
          </DescriptionsItem>
        </Descriptions>
        <div class="mb-1 mt-6 font-medium">执行记录</div>
        <TaskList ref="taskList" :process-id="process.id" :project-id="projectId" />
      </TabPane>
      <TabPane key="service" tab="服务">
        <Empty
          v-if="!service || !binding"
          :image="Empty.PRESENTED_IMAGE_SIMPLE"
          description="该业务类型没有编码，不参与绑定"
        />
        <template v-else>
          <Descriptions :column="2" bordered size="small">
            <DescriptionsItem label="绑定" :span="2">
              <Tooltip :title="binding.tip || undefined">
                <Tag :color="binding.color">{{ binding.text }}</Tag>
              </Tooltip>
              <span v-if="service.instanceId">已绑定（实例 ID {{ service.instanceId }}）</span>
              <span v-else class="text-muted-foreground">还没有收到上报</span>
            </DescriptionsItem>
            <DescriptionsItem label="业务类型" :span="2">
              {{ process.typeName || '—' }}
              <span v-if="process.typeCode" class="text-primary ml-1 font-mono text-xs">{{ process.typeCode }}</span>
              <span v-if="service.status === 'mismatch'" class="ml-2 text-xs text-red-500">
                上报的类型是 {{ service.type || '—' }}，与登记不一致
              </span>
            </DescriptionsItem>
            <DescriptionsItem label="节点 ID">{{ service.nodeId || '—' }}</DescriptionsItem>
            <DescriptionsItem v-if="service.type === 'logic' || process.typeCode === 'logic'" label="区号">
              {{ service.serverId ?? '—' }}
            </DescriptionsItem>
            <DescriptionsItem label="公网地址">
              {{ service.host ? `${service.host}:${service.port}` : '—' }}
            </DescriptionsItem>
            <DescriptionsItem label="内网地址">{{ service.innerHost || '—' }}</DescriptionsItem>
            <DescriptionsItem label="GM 端口">{{ service.gmPort || '—' }}</DescriptionsItem>
            <DescriptionsItem label="最近上报">
              <span :title="service.reportTime ? dayjs(service.reportTime).format('YYYY-MM-DD HH:mm:ss') : undefined">
                {{ formatReportTime(service.reportTime) }}
              </span>
            </DescriptionsItem>
          </Descriptions>
          <div class="mb-1 mt-6 font-medium">原始上报</div>
          <pre v-if="rawJson" class="raw-json">{{ rawJson }}</pre>
          <div v-else class="text-muted-foreground text-sm">还没有收到上报</div>
        </template>
      </TabPane>
      <TabPane v-if="hasAccessByCodes(['server_process:file'])" key="files" tab="文件">
        <ProcessFiles v-if="tab === 'files'" :key="process.id" :process="process" :project-id="projectId" />
      </TabPane>
    </Tabs>
  </Drawer>
</template>

<style scoped>
.raw-json {
  max-height: 360px;
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
