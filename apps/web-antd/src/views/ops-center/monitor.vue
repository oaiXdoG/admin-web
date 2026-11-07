<script lang="ts" setup>
import type { OpsAppOption, OpsHostOption } from '#/api/types';

import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';
import { usePreferences } from '@vben/preferences';

import { Button, Empty, Select, Tag } from 'ant-design-vue';

import { getOpsAppOptionsApi, getOpsHostOptionsApi } from '#/api';

/**
 * 主机监控：嵌入 Grafana 的面板（Prometheus 拉取各主机的 node_exporter、process-exporter）。
 * Grafana 经 nginx 以同源的 /grafana/ 访问（匿名只读），面板文件在 danmu 工程的 ops/monitoring/grafana/dashboards。
 * 选主机时显示「主机」面板（danmu-host），再选程序时显示「程序」面板（danmu-app，按程序目录筛选）。
 */
const GRAFANA = '/grafana';

const RANGES = [
  { label: '最近 1 小时', value: 'now-1h' },
  { label: '最近 6 小时', value: 'now-6h' },
  { label: '最近 24 小时', value: 'now-24h' },
  { label: '最近 7 天', value: 'now-7d' },
  { label: '最近 30 天', value: 'now-30d' },
];

const route = useRoute();
const router = useRouter();
const { isDark } = usePreferences();

const hosts = ref<OpsHostOption[]>([]);
const apps = ref<OpsAppOption[]>([]);
const hostId = ref<number>();
/** 0 表示看主机 */
const appId = ref(0);
const range = ref('now-1h');
const loaded = ref(false);
/** 改变后强制重新加载 iframe */
const reloadKey = ref(0);

const host = computed(() => hosts.value.find((item) => item.id === hostId.value));
const app = computed(() => apps.value.find((item) => item.id === appId.value));

const hostOptions = computed(() =>
  hosts.value.map((item) => ({
    label: `${item.ip}${item.hostname ? `（${item.hostname}）` : ''}`,
    value: item.id,
  })),
);
const appOptions = computed(() => [
  { label: '主机', value: 0 },
  ...apps.value.map((item) => ({
    label: `${item.name}${item.remark ? `（${item.remark}）` : ''}`,
    value: item.id,
  })),
]);

const src = computed(() => {
  if (!host.value) return '';
  const params = new URLSearchParams({
    from: range.value,
    orgId: '1',
    refresh: '30s',
    theme: isDark.value ? 'dark' : 'light',
    to: 'now',
    'var-host': host.value.ip,
  });
  if (app.value) {
    params.set('var-app', app.value.dir);
    return `${GRAFANA}/d/danmu-app/app?${params}`;
  }
  return `${GRAFANA}/d/danmu-host/host?${params}`;
});

/**
 * kiosk：隐藏 Grafana 自己的导航栏，只显示面板（必须是不带值的参数）；
 * 主机、程序、时间范围由本页选择，再隐藏 Grafana 的变量和时间选择器
 */
const embedSrc = computed(() =>
  src.value ? `${src.value}&kiosk&_dash.hideTimePicker&_dash.hideVariables` : '',
);

async function loadApps() {
  apps.value = hostId.value ? (await getOpsAppOptionsApi(hostId.value)).list : [];
}

watch(hostId, async (value, old) => {
  if (!loaded.value || value === old) return;
  appId.value = 0;
  await loadApps();
});

watch([hostId, appId], () => {
  if (!loaded.value) return;
  const query: Record<string, string> = {};
  if (hostId.value) query.hostId = String(hostId.value);
  if (appId.value) query.appId = String(appId.value);
  void router.replace({ query });
});

function openGrafana() {
  window.open(src.value, '_blank', 'noopener');
}

onMounted(async () => {
  const { list } = await getOpsHostOptionsApi();
  hosts.value = list;
  const queryHost = Number(route.query.hostId);
  const queryApp = Number(route.query.appId);
  hostId.value = hosts.value.some((item) => item.id === queryHost)
    ? queryHost
    : (hosts.value.find((item) => item.online)?.id ?? hosts.value[0]?.id);
  await loadApps();
  appId.value = apps.value.some((item) => item.id === queryApp) ? queryApp : 0;
  loaded.value = true;
});
</script>

<template>
  <Page auto-content-height>
    <div class="bg-card flex h-full flex-col rounded-md p-4">
      <div class="mb-3 flex flex-wrap items-center gap-3">
        <Select
          v-model:value="hostId"
          :options="hostOptions"
          class="w-72"
          placeholder="选择主机"
          show-search
          option-filter-prop="label"
        />
        <Select
          v-model:value="appId"
          :disabled="!hostId"
          :options="appOptions"
          class="w-60"
          show-search
          option-filter-prop="label"
        />
        <Select v-model:value="range" :options="RANGES" class="w-36" />
        <Tag v-if="host" :color="host.online ? 'success' : 'default'">
          {{ host.online ? '在线' : '连不上' }}
        </Tag>
        <span v-if="app" class="text-muted-foreground text-sm">{{ app.dir }}</span>
        <div class="ml-auto flex gap-2">
          <Button :disabled="!src" @click="reloadKey++">刷新</Button>
          <Button :disabled="!src" @click="openGrafana">在 Grafana 中打开</Button>
        </div>
      </div>
      <div class="text-muted-foreground mb-3 text-xs">
        数据由 Prometheus 每 15 秒拉取主机上的 node_exporter、process-exporter（主机「初始化」时安装），保存 30 天；
        程序按目录归组，只有在运行时才有数据。
      </div>
      <div v-if="loaded && hosts.length === 0" class="flex flex-1 items-center justify-center">
        <Empty description="还没有主机，请先在主机管理里添加" />
      </div>
      <iframe
        v-else-if="embedSrc"
        :key="`${embedSrc}-${reloadKey}`"
        :src="embedSrc"
        class="min-h-0 w-full flex-1 rounded border-0"
        title="Grafana 监控面板"
      ></iframe>
    </div>
  </Page>
</template>
