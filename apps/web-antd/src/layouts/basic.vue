<script lang="ts" setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';

import { BasicLayout, UserDropdown } from '@vben/layouts';
import { preferences } from '@vben/preferences';
import { useUserStore } from '@vben/stores';

import { useAuthStore } from '#/store';

const router = useRouter();
const userStore = useUserStore();
const authStore = useAuthStore();

const avatar = computed(() => {
  return userStore.userInfo?.avatar || preferences.app.defaultAvatar;
});

/** 用户下拉里显示登录名 */
const description = computed(() => userStore.userInfo?.username);

const menus = [
  {
    handler: () => router.push({ name: 'Profile' }),
    icon: 'lucide:user-cog',
    text: '个人设置',
  },
];

async function handleLogout() {
  await authStore.logout(false);
}
</script>

<template>
  <BasicLayout
    :avatar
    :text="userStore.userInfo?.realName"
    @clear-preferences-and-logout="handleLogout"
    @logout="handleLogout"
  >
    <template #user-dropdown>
      <UserDropdown
        :avatar
        :description
        :menus
        :text="userStore.userInfo?.realName"
        @clear-preferences-and-logout="handleLogout"
        @logout="handleLogout"
      />
    </template>
  </BasicLayout>
</template>
