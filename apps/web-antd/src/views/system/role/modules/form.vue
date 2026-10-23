<script lang="ts" setup>
import type { RoleRecord, RoleWrite } from '#/api/types';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { roleApi } from '#/api';

import { useFormSchema } from '../data';

interface ModalData {
  role: null | RoleRecord;
}

const emit = defineEmits<{ success: [] }>();

const data = ref<ModalData | null>(null);

const [Form, formApi] = useVbenForm({
  schema: useFormSchema(),
  showDefaultActions: false,
});

const [Modal, modalApi] = useVbenModal<ModalData>({
  async onConfirm() {
    if (!data.value) return;
    const { valid } = await formApi.validate();
    if (!valid) return;
    const values = await formApi.getValues<RoleWrite>();
    modalApi.lock();
    try {
      if (data.value.role) {
        await roleApi.update(data.value.role.id, values);
        message.success('已修改');
      } else {
        await roleApi.create(values);
        message.success('已创建');
      }
      emit('success');
      modalApi.close();
    } finally {
      modalApi.unlock();
    }
  },
  onOpenChange(isOpen) {
    if (!isOpen) return;
    data.value = modalApi.getData() ?? null;
    formApi.reset();
    const role = data.value?.role;
    if (role) {
      const { code, description, name, status } = role;
      formApi.setValues({ code, description, name, status });
    }
  },
});

const title = computed(() => (data.value?.role ? '编辑角色' : '新增角色'));
</script>

<template>
  <Modal :title="title" class="w-[520px]">
    <Form />
  </Modal>
</template>
