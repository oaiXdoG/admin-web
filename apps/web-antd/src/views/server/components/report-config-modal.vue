<script lang="ts" setup>
import type { ReportConfig } from '#/api/types';

import { computed, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { useClipboard } from '@vueuse/core';
import { Alert, Button, Descriptions, DescriptionsItem, message, Modal, Spin } from 'ant-design-vue';

import { getReportConfigApi, resetReportConfigApi } from '#/api';

/** 业务服上报配置：后台启动的进程自动注入，只有手动启动的服务需要照着配置 */
const props = defineProps<{ open: boolean; projectId: number }>();
const emit = defineEmits<{ close: [] }>();

// legacy：HTTP 页面没有 navigator.clipboard，退回 execCommand 复制
const { copy } = useClipboard({ legacy: true });
const config = ref<null | ReportConfig>(null);
const loading = ref(false);
const showSecret = ref(false);

const example = computed(() =>
  config.value
    ? `admin.report-url=${config.value.reportUrl}\nadmin.report-secret=${config.value.secret}`
    : '',
);
const maskedExample = computed(() =>
  config.value
    ? `admin.report-url=${config.value.reportUrl}\nadmin.report-secret=${showSecret.value ? config.value.secret : '********'}`
    : '',
);

async function copyText(text: string) {
  await copy(text);
  message.success('已复制');
}

function reset() {
  Modal.confirm({
    cancelText: '取消',
    content:
      '重置后旧密钥立即失效：已运行的托管进程需要重启才会用上新密钥，手动配置的服务需要改配置。确定重置？',
    okButtonProps: { danger: true },
    okText: '重置',
    title: '重置上报密钥',
    async onOk() {
      config.value = await resetReportConfigApi(props.projectId);
      showSecret.value = true;
      message.success('密钥已重置');
    },
  });
}

watch(
  () => props.open,
  async (open) => {
    if (!open) return;
    showSecret.value = false;
    loading.value = true;
    try {
      config.value = await getReportConfigApi(props.projectId);
    } catch {
      // 错误信息已由请求拦截器提示
    } finally {
      loading.value = false;
    }
  },
);
</script>

<template>
  <Modal :footer="null" :open="open" :width="640" title="上报配置" @cancel="emit('close')">
    <Spin :spinning="loading">
      <div class="mb-4">
        <Alert
          message="由后台启动的进程会自动注入，无需配置；只有手动启动的服务需要。"
          show-icon
          type="info"
        />
      </div>
      <template v-if="config">
        <Descriptions :column="1" bordered size="small">
          <DescriptionsItem label="App Key">
            <div class="flex items-center justify-between gap-2">
              <span class="break-all font-mono">{{ config.appKey }}</span>
              <Button size="small" type="link" @click="copyText(config.appKey)">复制</Button>
            </div>
          </DescriptionsItem>
          <DescriptionsItem label="上报地址">
            <div class="flex items-center justify-between gap-2">
              <span class="break-all font-mono">{{ config.reportUrl }}</span>
              <Button size="small" type="link" @click="copyText(config.reportUrl)">复制</Button>
            </div>
          </DescriptionsItem>
          <DescriptionsItem label="上报密钥">
            <div class="flex items-center justify-between gap-2">
              <span class="break-all font-mono">{{ showSecret ? config.secret : '••••••••••••••••' }}</span>
              <div class="flex shrink-0 items-center">
                <Button size="small" type="link" @click="showSecret = !showSecret">
                  <IconifyIcon :icon="showSecret ? 'lucide:eye-off' : 'lucide:eye'" class="size-4" />
                </Button>
                <Button size="small" type="link" @click="copyText(config.secret)">复制</Button>
                <Button danger size="small" type="link" @click="reset">重置密钥</Button>
              </div>
            </div>
          </DescriptionsItem>
        </Descriptions>
        <div class="mb-1 mt-4 flex items-center justify-between">
          <span class="font-medium">手动启动的服务配置示例</span>
          <Button size="small" type="link" @click="copyText(example)">复制</Button>
        </div>
        <pre class="report-example">{{ maskedExample }}</pre>
      </template>
    </Spin>
  </Modal>
</template>

<style scoped>
.report-example {
  padding: 12px;
  margin: 0;
  overflow: auto;
  font-family: Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  background: hsl(var(--accent));
  border-radius: 6px;
}
</style>
