<script lang="ts" setup>
import { Page } from '@vben/common-ui';

import { Card } from 'ant-design-vue';

import Brand from './brand.vue';
</script>

<template>
  <Page>
    <Card :bordered="false">
      <Brand />
    </Card>
  </Page>
</template>
