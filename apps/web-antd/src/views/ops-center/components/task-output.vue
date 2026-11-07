<script lang="ts" setup>
import type { OpsTaskStatus } from '#/api/types';

import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

import { Drawer, Tag } from 'ant-design-vue';

import { getOpsTaskApi } from '#/api';

import { formatElapsed, taskStatusTags } from '../format';

/**
 * 运维任务输出：taskId 不为空时打开，每秒轮询一次增量输出。
 * 关闭只是不再查看，任务继续在后台执行。
 */
const props = defineProps<{ taskId: null | number }>();
const emit = defineEmits<{
  close: [];
  /** 任务结束时触发一次，父页面据此刷新列表 */
  finished: [status: OpsTaskStatus];
}>();

const POLL_MS = 1000;

const title = ref('');
const status = ref<OpsTaskStatus>();
const output = ref('');
const startedAt = ref(0);
const finishedAt = ref(0);
const now = ref(Date.now());
const loadError = ref('');
const outputRef = ref<HTMLElement>();

let offset = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
/** 每次打开新任务加一，丢弃旧任务还在路上的响应 */
let generation = 0;

const elapsed = computed(() => {
  if (!startedAt.value) return '';
  const end = finishedAt.value || now.value;
  return formatElapsed(end - startedAt.value);
});

function stop() {
  if (timer) clearTimeout(timer);
  timer = undefined;
}

/** 在底部附近时跟着滚动，用户往上翻看时不打扰 */
function nearBottom() {
  const el = outputRef.value;
  return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 40;
}

async function poll(taskId: number, current: number) {
  try {
    const task = await getOpsTaskApi(taskId, offset);
    if (current !== generation) return;
    title.value = task.title;
    startedAt.value = task.startedAt;
    finishedAt.value = task.finishedAt;
    now.value = Date.now();
    offset = task.offset;
    if (task.output) {
      const follow = nearBottom();
      output.value += task.output;
      if (follow) {
        await nextTick();
        if (outputRef.value) {
          outputRef.value.scrollTop = outputRef.value.scrollHeight;
        }
      }
    }
    status.value = task.status;
    if (task.status === 'running') {
      timer = setTimeout(() => poll(taskId, current), POLL_MS);
    } else {
      emit('finished', task.status);
    }
  } catch {
    // 错误信息已由请求拦截器提示
    if (current === generation) loadError.value = '读取任务输出失败';
    // 不再轮询，避免每秒弹一次错误
  }
}

watch(
  () => props.taskId,
  (taskId) => {
    stop();
    generation++;
    if (taskId === null) return;
    title.value = '';
    status.value = undefined;
    output.value = '';
    startedAt.value = 0;
    finishedAt.value = 0;
    loadError.value = '';
    offset = 0;
    poll(taskId, generation);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  stop();
  generation++;
});
</script>

<template>
  <Drawer
    :open="taskId !== null"
    :title="title || '运维任务'"
    width="70%"
    @close="emit('close')"
  >
    <template #extra>
      <div class="flex items-center gap-3">
        <Tag v-if="status" :color="taskStatusTags[status]?.color">
          {{ taskStatusTags[status]?.text ?? status }}
        </Tag>
        <span v-if="elapsed" class="text-muted-foreground text-sm">
          耗时 {{ elapsed }}
        </span>
      </div>
    </template>
    <div class="flex h-full flex-col gap-2">
      <div class="text-muted-foreground text-xs">
        关闭后任务继续在后台执行，可以在运维任务里查看
      </div>
      <pre
        ref="outputRef"
        class="bg-muted m-0 min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-all rounded p-3 font-mono text-xs leading-5"
        >{{
          output ||
          (status === 'running' || !status ? '等待输出…' : '（没有输出）')
        }}</pre>
      <div v-if="loadError" class="text-destructive text-xs">
        {{ loadError }}，关闭后重新打开可以继续查看
      </div>
    </div>
  </Drawer>
</template>
