import type { MenuRecord } from '#/api/types';

import { requestClient } from '#/api/request';

/**
 * 获取当前账号可访问的菜单（平铺结构）
 */
export async function getAccessMenusApi() {
  return requestClient.post<MenuRecord[]>('/access/menu', {});
}
