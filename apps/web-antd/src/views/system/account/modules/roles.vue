<script lang="ts" setup>
import type { AccountRecord, RoleRecord } from '#/api/types';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Alert, CheckboxGroup, message, Spin } from 'ant-design-vue';

import { getAccountRoleOptionsApi, updateAccountRolesApi } from '#/api';

/**
 * 分配角色，可以多选；分配「超级管理员」需要操作者本身是超级管理员。
 */
const emit = defineEmits<{ success: [] }>();

const account = ref<AccountRecord | null>(null);
const roles = ref<RoleRecord[]>([]);
const selected = ref<number[]>([]);
const loading = ref(false);

const [Modal, modalApi] = useVbenModal<AccountRecord>({
  async onConfirm() {
    if (!account.value) return;
    modalApi.lock();
    try {
      await updateAccountRolesApi(account.value.id, selected.value);
      message.success('角色已保存');
      emit('success');
      modalApi.close();
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen) {
    if (!isOpen) return;
    const data = modalApi.getData();
    if (!data) return;
    account.value = data;
    selected.value = data.roles.map((role) => role.id);
    loading.value = true;
    try {
      roles.value = await getAccountRoleOptionsApi();
    } finally {
      loading.value = false;
    }
  },
});
</script>

<template>
  <Modal :title="`分配角色 · ${account?.account ?? ''}`" class="w-[480px]">
    <div class="mb-4">
      <Alert
        message="账号拥有所分配角色的全部菜单；超级管理员拥有全部菜单。"
        show-icon
        type="info"
      />
    </div>
    <Spin :spinning="loading">
      <CheckboxGroup
        v-model:value="selected"
        :options="
          roles.map((role) => ({
            label: `${role.name}（${role.code}）`,
            value: role.id,
          }))
        "
        class="flex flex-col gap-2"
      />
    </Spin>
  </Modal>
</template>
